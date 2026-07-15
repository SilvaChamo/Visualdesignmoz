import { NextRequest, NextResponse } from 'next/server'
import { Client } from 'ssh2'
import { getServerHost } from '@/lib/server-config'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

/**
 * Motor de hospedagem NATIVO — cria contas diretamente no servidor
 * (utilizador Linux isolado + vhost Apache + SSL Let's Encrypt), sem passar
 * pela DirectAdmin. Existe para não ficarmos limitados às 2 contas da
 * licença DA atual.
 *
 * Importante: isto NUNCA mexe nos ficheiros de configuração que a própria
 * DirectAdmin gere — usa uma pasta própria (NATIVE_VHOST_DIR) que é incluída
 * à parte na configuração do Apache. Ver scripts/setup-native-hosting.sh
 * para o passo de configuração única do servidor (só precisa de correr 1 vez).
 *
 * Nota: este ficheiro já teve uma tentativa de integração com a HestiaCP
 * (comandos v-list-web-domains, etc.) — a HestiaCP não está instalada no
 * servidor, por isso essa parte foi substituída. Fica planeado para o
 * futuro como motor adicional.
 */

const NATIVE_VHOST_DIR = '/etc/httpd/conf/native-sites'
const NATIVE_HOME_BASE = '/home'
const NATIVE_USER_PREFIX = 'nv_'

function execSSH(command: string): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve, reject) => {
    const conn = new Client()
    let out = ''
    const rawKey = process.env.SSH_PRIVATE_KEY || ''
    const privateKey = rawKey.includes('-----BEGIN') ? rawKey.replace(/\\n/g, '\n') : rawKey

    conn.on('ready', () => {
      conn.exec(command, (err, stream) => {
        if (err) {
          conn.end()
          return reject(err)
        }
        stream.on('data', (d: Buffer) => {
          out += d.toString()
        })
        stream.stderr.on('data', (d: Buffer) => {
          out += d.toString()
        })
        stream.on('close', (code: number) => {
          conn.end()
          resolve({ ok: code === 0, output: out })
        })
      })
    })

    conn.on('error', (err) => {
      console.error('SSH SITE-MANAGER ERROR:', err.message)
      reject(err)
    })

    conn.connect({
      host: process.env.SERVER_IP || getServerHost(),
      port: parseInt(process.env.SSH_PORT || process.env.SERVER_SSH_PORT || '2234', 10),
      username: process.env.SSH_USER || 'root',
      privateKey,
      password: process.env.SSH_PASS,
    })
  })
}

/** Só letras, números, pontos e hífens — bloqueia qualquer tentativa de
 *  injetar comandos através do nome de domínio. */
function isValidDomain(domain: string): boolean {
  return /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(domain)
}

function domainToLinuxUsername(domain: string): string {
  const clean = domain
    .toLowerCase()
    .replace(/^www\./, '')
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 28)
  return `${NATIVE_USER_PREFIX}${clean}`
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'list'
    const domain = searchParams.get('domain')

    if (action === 'details') {
      if (!domain) return NextResponse.json({ error: 'Domain required' }, { status: 400 })
      return await getSiteDetails(domain)
    }
    if (action === 'list') {
      return await listSites()
    }
    return NextResponse.json({ success: true, message: 'Native Site Manager Ready' })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

async function listSites() {
  const admin = getSupabaseAdmin()
  if (!admin) return NextResponse.json({ success: false, error: 'Supabase não configurado', sites: [] })

  const { data, error } = await admin
    .from('native_sites')
    .select('domain, status, ssl_enabled, php_version, owner_email, created_at')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ success: false, error: error.message, sites: [] })

  const sites = (data || []).map((s) => ({
    domain: s.domain,
    status: s.status,
    owner: s.owner_email || '—',
    php: s.php_version || '8.2',
    ssl: s.ssl_enabled,
    provider: 'native' as const,
  }))
  return NextResponse.json({ success: true, sites })
}

async function getSiteDetails(domain: string) {
  const admin = getSupabaseAdmin()
  if (!admin) return NextResponse.json({ success: false, error: 'Supabase não configurado' })

  const { data, error } = await admin.from('native_sites').select('*').eq('domain', domain).maybeSingle()
  if (error) return NextResponse.json({ success: false, error: error.message })
  if (!data) return NextResponse.json({ success: false, error: 'Domínio não encontrado' })

  return NextResponse.json({
    success: true,
    site: {
      domain: data.domain,
      status: data.status,
      owner: data.owner_email || '—',
      package: 'native',
      email: data.owner_email || '',
      diskUsage: 'N/A',
      bandwidthUsage: 'N/A',
      sslEnabled: data.ssl_enabled,
      phpVersion: data.php_version || '8.2',
      serverIP: getServerHost(),
      documentRoot: data.doc_root,
      provider: 'native',
      features: {
        fileManager: false,
        databaseManager: false,
        emailManager: false,
        sslManager: true,
        backupManager: false,
      },
    },
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const action = String(body.action || '')
    const domain = String(body.domain || '').trim().toLowerCase()

    if (!domain || !isValidDomain(domain)) {
      return NextResponse.json({ success: false, error: 'Domínio inválido' }, { status: 400 })
    }

    switch (action) {
      case 'create':
        return await createNativeSite(domain, String(body.ownerEmail || ''), String(body.ownerAuthUserId || ''))
      case 'suspend':
        return await suspendNativeSite(domain)
      case 'unsuspend':
        return await unsuspendNativeSite(domain)
      case 'delete':
        return await deleteNativeSite(domain, Boolean(body.deleteFiles))
      default:
        return NextResponse.json({ success: false, error: `Ação desconhecida: ${action}` }, { status: 400 })
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

async function createNativeSite(domain: string, ownerEmail: string, ownerAuthUserId: string) {
  const admin = getSupabaseAdmin()
  if (!admin) return NextResponse.json({ success: false, error: 'Supabase não configurado' }, { status: 500 })

  const { data: existing } = await admin.from('native_sites').select('domain').eq('domain', domain).maybeSingle()
  if (existing) {
    return NextResponse.json({ success: false, error: 'Este domínio já tem uma conta nativa.' }, { status: 409 })
  }

  const username = domainToLinuxUsername(domain)
  const docRoot = `${NATIVE_HOME_BASE}/${username}/public_html`
  const vhostPath = `${NATIVE_VHOST_DIR}/${domain}.conf`
  const steps: { step: string; ok: boolean; output: string }[] = []

  const run = async (label: string, cmd: string) => {
    const result = await execSSH(cmd)
    steps.push({ step: label, ok: result.ok, output: result.output.slice(0, 2000) })
    return result
  }

  // 1) Utilizador Linux isolado, sem shell de login (só serve para ser dono
  //    dos ficheiros — ninguém entra por SSH com ele).
  const userCheck = await run('verificar utilizador', `id ${username} 2>&1 || echo NAOEXISTE`)
  if (!userCheck.output.includes('NAOEXISTE')) {
    return NextResponse.json(
      { success: false, error: `Utilizador Linux "${username}" já existe (colisão de nome). Escolhe outro domínio ou avisa o Claude.`, steps },
      { status: 409 },
    )
  }
  const userStep = await run('criar utilizador', `useradd -m -d ${NATIVE_HOME_BASE}/${username} -s /usr/sbin/nologin ${username}`)
  if (!userStep.ok) {
    return NextResponse.json({ success: false, error: 'Falha ao criar utilizador Linux', steps }, { status: 500 })
  }

  await run('criar pasta pública', `mkdir -p ${docRoot} && chown -R ${username}:${username} ${NATIVE_HOME_BASE}/${username} && chmod 750 ${NATIVE_HOME_BASE}/${username}`)

  await run(
    'página inicial provisória',
    `cat > ${docRoot}/index.html << 'HTMLEOF'\n<!doctype html><html><head><meta charset="utf-8"><title>${domain}</title></head><body style="font-family:sans-serif;text-align:center;margin-top:15%"><h1>${domain}</h1><p>Site em construção.</p></body></html>\nHTMLEOF\nchown ${username}:${username} ${docRoot}/index.html`,
  )

  // 2) Config Apache própria — numa pasta que nunca é gerida pela DA.
  const vhostConf = `# Gerado automaticamente pelo motor nativo — não editar à mão\n<VirtualHost *:80>\n    ServerName ${domain}\n    ServerAlias www.${domain}\n    DocumentRoot ${docRoot}\n    <Directory ${docRoot}>\n        AllowOverride All\n        Require all granted\n    </Directory>\n    ErrorLog /var/log/httpd/native-${domain}-error.log\n    CustomLog /var/log/httpd/native-${domain}-access.log combined\n</VirtualHost>`

  await run('criar pasta de configs nativas (se não existir)', `mkdir -p ${NATIVE_VHOST_DIR}`)
  const writeVhost = await run(
    'escrever configuração do site',
    `cat > ${vhostPath} << 'APACHEEOF'\n${vhostConf}\nAPACHEEOF`,
  )
  if (!writeVhost.ok) {
    return NextResponse.json({ success: false, error: 'Falha ao escrever a configuração do Apache', steps }, { status: 500 })
  }

  // 3) Testar a config ANTES de recarregar — nunca arriscar tirar os outros
  //    sites do ar (incluindo os da DA) por um erro de sintaxe.
  const testConf = await run('testar configuração do Apache', 'apachectl configtest 2>&1')
  if (!testConf.ok || /error/i.test(testConf.output)) {
    await run('reverter (config com erro)', `rm -f ${vhostPath}`)
    return NextResponse.json(
      { success: false, error: 'Configuração do Apache inválida — revertido, nada foi alterado no servidor.', steps },
      { status: 500 },
    )
  }

  const reload = await run('recarregar Apache', 'systemctl reload httpd 2>&1 || apachectl graceful 2>&1')
  if (!reload.ok) {
    return NextResponse.json({ success: false, error: 'Falha ao recarregar o Apache', steps }, { status: 500 })
  }

  // 4) SSL grátis — best-effort. Se o domínio ainda não apontar para este
  //    servidor (DNS por propagar), isto falha; o site fica no ar em HTTP
  //    e o SSL pode ser pedido outra vez mais tarde.
  const certbotEmail = ownerEmail || 'admin@visualdesignmoz.com'
  const sslStep = await run(
    "pedir certificado SSL (Let's Encrypt)",
    `certbot --apache -d ${domain} -d www.${domain} --non-interactive --agree-tos -m ${certbotEmail} --redirect 2>&1 || echo SSL_FALHOU`,
  )
  const sslOk = sslStep.ok && !sslStep.output.includes('SSL_FALHOU')

  const { error: dbError } = await admin.from('native_sites').insert({
    domain,
    linux_username: username,
    doc_root: docRoot,
    status: 'active',
    ssl_enabled: sslOk,
    owner_email: ownerEmail || null,
    owner_auth_user_id: ownerAuthUserId || null,
  })
  if (dbError) {
    steps.push({ step: 'gravar no Supabase', ok: false, output: dbError.message })
  }

  return NextResponse.json({
    success: true,
    domain,
    linuxUsername: username,
    docRoot,
    sslEnabled: sslOk,
    steps,
    warning: sslOk
      ? undefined
      : 'SSL não foi ativado agora (normalmente porque o DNS ainda não aponta para este servidor). O site já está no ar em HTTP.',
  })
}

async function suspendNativeSite(domain: string) {
  const admin = getSupabaseAdmin()
  if (!admin) return NextResponse.json({ success: false, error: 'Supabase não configurado' }, { status: 500 })

  const vhostPath = `${NATIVE_VHOST_DIR}/${domain}.conf`
  const disabledPath = `${vhostPath}.disabled`

  const result = await execSSH(`mv ${vhostPath} ${disabledPath} 2>&1 && systemctl reload httpd 2>&1`)
  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.output }, { status: 500 })
  }
  await admin.from('native_sites').update({ status: 'suspended', updated_at: new Date().toISOString() }).eq('domain', domain)
  return NextResponse.json({ success: true, domain, status: 'suspended' })
}

async function unsuspendNativeSite(domain: string) {
  const admin = getSupabaseAdmin()
  if (!admin) return NextResponse.json({ success: false, error: 'Supabase não configurado' }, { status: 500 })

  const vhostPath = `${NATIVE_VHOST_DIR}/${domain}.conf`
  const disabledPath = `${vhostPath}.disabled`

  const result = await execSSH(`mv ${disabledPath} ${vhostPath} 2>&1 && systemctl reload httpd 2>&1`)
  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.output }, { status: 500 })
  }
  await admin.from('native_sites').update({ status: 'active', updated_at: new Date().toISOString() }).eq('domain', domain)
  return NextResponse.json({ success: true, domain, status: 'active' })
}

async function deleteNativeSite(domain: string, deleteFiles: boolean) {
  const admin = getSupabaseAdmin()
  if (!admin) return NextResponse.json({ success: false, error: 'Supabase não configurado' }, { status: 500 })

  const { data: site } = await admin.from('native_sites').select('linux_username').eq('domain', domain).maybeSingle()
  if (!site) return NextResponse.json({ success: false, error: 'Domínio não encontrado' }, { status: 404 })

  const vhostPath = `${NATIVE_VHOST_DIR}/${domain}.conf`
  await execSSH(`rm -f ${vhostPath} ${vhostPath}.disabled && systemctl reload httpd 2>&1`)

  if (deleteFiles) {
    // -r apaga também a pasta pessoal (ficheiros do site). Só corre se
    // explicitamente pedido — por defeito preservamos os ficheiros.
    await execSSH(`userdel -r ${site.linux_username} 2>&1`)
  }

  await admin.from('native_sites').delete().eq('domain', domain)
  return NextResponse.json({ success: true, domain, filesDeleted: deleteFiles })
}
