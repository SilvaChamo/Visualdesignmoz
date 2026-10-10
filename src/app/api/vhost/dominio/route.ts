import { NextRequest, NextResponse } from 'next/server';
import { Resolver } from 'node:dns/promises';
import { requirePanelBootstrapAccess } from '@/lib/panel-api-auth';
import { executeServerCommand } from '@/lib/server-ssh-exec';
import { hestiaCall } from '@/lib/hestia-client';
import * as hestia from '@/lib/hestia-adapter';
import { deleteCloudflareDnsRecord, findCloudflareZoneId, listCloudflareDnsRecords, updateCloudflareDnsRecord, upsertCloudflareRecord, type CloudflareRecordInput } from '@/lib/cloudflare-dns';
import { esquecerLeitura, lerServidor, type LeituraServidor } from '@/lib/vhost-servidor';
import { lerRegisto, montarDados } from '@/lib/vhost-dados';

export const dynamic = 'force-dynamic';

/**
 * /api/vhost/dominio — Gestão de domínios do painel VisualHost (Hestia + Cloudflare).
 * GET  ?conta=&d=  detalhe de um domínio: redirecionamento, SSL forçado, certificado (nunca a chave), DNS
 *                  (zona do Hestia ou da Cloudflare), regras PHP (.user.ini) e regras do VisualHost no .htaccess.
 * POST { acao, conta, dominio, … }  alterações (domínios, subdomínios, apontadores, SSL, FTP, bases de dados,
 *                  DNS, redirecionamentos, hotlink, PHP). Só nas contas que a sessão pode ver.
 */

const DOM = /^(?=.{3,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;
const CONTA = /^[a-z0-9][a-z0-9_.-]{0,31}$/;
const MARCA_HT = ['# VisualHost: inicio (não editar à mão)', '# VisualHost: fim'];
const MARCA_INI = ['; VisualHost: inicio (não editar à mão)', '; VisualHost: fim'];
const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64');
const q = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

type Sessao = { userId: string; email: string; role: string };

async function sessao(): Promise<{ s: Sessao } | { erro: NextResponse }> {
  const auth = await requirePanelBootstrapAccess();
  if ('error' in auth) return { erro: NextResponse.json({ erro: 'Inicie sessão no site.' }, { status: auth.error.status }) };
  return { s: { userId: auth.user.id, email: auth.user.email || '', role: auth.user.role } };
}

/** A conta tem de estar entre as que a sessão vê, e o domínio tem de ser dessa conta */
async function verificar(s: Sessao, conta: string, d: string, srv: LeituraServidor): Promise<string | null> {
  if (!CONTA.test(conta) || !DOM.test(d)) return 'Conta ou domínio inválido.';
  const dados = montarDados(srv, await lerRegisto(), s);
  if (!dados.contas[conta]) return 'Conta fora do seu painel.';
  if (!srv.web[conta]?.[d] && !srv.mail[conta]?.[d]) return 'Esse domínio não é desta conta.';
  return null;
}

/** Domínio principal da zona (sub.exemplo.co.mz → exemplo.co.mz), para procurar a zona na Cloudflare */
const zonaDe = (d: string) => {
  const p = d.split('.');
  const curto = p.length > 2 && ['co', 'com', 'org', 'net', 'gov', 'edu', 'ac'].includes(p[p.length - 2]);
  return p.slice(curto ? -3 : -2).join('.');
};

// Memória curta: o id da zona na Cloudflare quase nunca muda; os nameservers públicos também não.
const zonasCf = new Map<string, { at: number; id: Promise<string | null> }>();
function zonaCf(zona: string): Promise<string | null> {
  const m = zonasCf.get(zona);
  if (m && Date.now() - m.at < 10 * 60_000) return m.id;
  const id = findCloudflareZoneId(zona);
  zonasCf.set(zona, { at: Date.now(), id });
  id.then((x) => !x && zonasCf.delete(zona)).catch(() => zonasCf.delete(zona));
  return id;
}
const nsGuardados = new Map<string, { at: number; ns: string[] }>();
async function nameservers(zona: string): Promise<string[]> {
  const m = nsGuardados.get(zona);
  if (m && Date.now() - m.at < 5 * 60_000) return m.ns;
  try {
    const r = new Resolver({ timeout: 2500, tries: 1 });
    r.setServers(['1.1.1.1', '8.8.8.8']);
    const ns = (await r.resolveNs(zona)).map((x) => x.toLowerCase().replace(/\.$/, '')).filter((x) => /^[a-z0-9.-]+$/.test(x)).sort().slice(0, 6);
    nsGuardados.set(zona, { at: Date.now(), ns });
    return ns;
  } catch {
    return m?.ns || [];
  }
}

type DnsDominio = { fonte: 'hestia' | 'cloudflare' | 'nenhuma'; zona: string; registos: { id: string; nome: string; tipo: string; valor: string; ttl: number; prio?: string }[] };

/** Registos da zona na Cloudflare (quando a zona não está no Hestia) */
async function dnsCloudflare(d: string): Promise<DnsDominio> {
  const zona = zonaDe(d);
  const zid = await zonaCf(zona);
  if (!zid) return { fonte: 'nenhuma', zona: '', registos: [] };
  const regs = await listCloudflareDnsRecords(zid, zona);
  return { fonte: 'cloudflare', zona, registos: regs.map((x) => ({ id: x.id, nome: x.name, tipo: x.type, valor: x.content, ttl: x.ttl, prio: x.priority != null ? String(x.priority) : undefined })) };
}

function secoes(out: string): Map<string, string> {
  const m = new Map<string, string>();
  let cur = '';
  for (const l of out.split('\n')) {
    if (l.startsWith('@@')) {
      cur = l.slice(2).trim();
      m.set(cur, '');
    } else if (cur) m.set(cur, m.get(cur) + l + '\n');
  }
  return m;
}
const json = <T,>(t: string | undefined, vazio: T): T => {
  try {
    return t && t.trim() ? (JSON.parse(t) as T) : vazio;
  } catch {
    return vazio;
  }
};
/** Linhas do bloco do VisualHost num ficheiro (.htaccess / .user.ini) */
const bloco = (txt: string, marca: string[]) => {
  const i = txt.indexOf(marca[0]);
  const j = txt.indexOf(marca[1]);
  return i >= 0 && j > i ? txt.slice(i + marca[0].length, j).split('\n').map((x) => x.trim()).filter(Boolean) : [];
};

export async function GET(req: NextRequest) {
  const r = await sessao();
  if ('erro' in r) return r.erro;
  const conta = req.nextUrl.searchParams.get('conta') || '';
  const d = (req.nextUrl.searchParams.get('d') || '').toLowerCase();
  // ?so=dns: a página de DNS só precisa dos registos e dos nameservers
  const soDns = req.nextUrl.searchParams.get('so') === 'dns';
  const srv = await lerServidor();
  const e = await verificar(r.s, conta, d, srv);
  if (e) return NextResponse.json({ erro: e }, { status: 403 });
  const w = srv.web[conta]?.[d];
  const raiz = (w?.DOCUMENT_ROOT || `/home/${conta}/web/${d}/public_html/`).replace(/\/+$/, '');
  if (!/^\/home\/[a-z0-9_.-]+\/web\/[a-z0-9.-]+\/public_html$/.test(raiz)) return NextResponse.json({ erro: 'Pasta do site inesperada.' }, { status: 500 });
  const temZona = !!srv.dns[conta]?.[d];
  const H = '/usr/local/hestia/bin';
  const site = w && !soDns;
  const linhas = [
    site ? `echo @@WEB; ${H}/v-list-web-domain ${conta} ${d} json` : '',
    site ? `echo @@SSL; ${H}/v-list-web-domain-ssl ${conta} ${d} json 2>/dev/null` : '',
    site ? `echo @@INI; cat ${q(raiz + '/.user.ini')} 2>/dev/null` : '',
    site ? `echo @@HT; cat ${q(raiz + '/.htaccess')} 2>/dev/null` : '',
    temZona ? `echo @@DNS; ${H}/v-list-dns-records ${conta} ${d} json` : '',
  ].filter(Boolean);
  // ao mesmo tempo: o servidor (só se houver algo a ler lá), a Cloudflare e os nameservers públicos
  const [out, dnsCf, ns] = await Promise.all([
    linhas.length ? executeServerCommand([...linhas, 'echo @@FIM'].join('; '), { timeoutMs: 30_000 }) : Promise.resolve(''),
    temZona ? Promise.resolve(null) : dnsCloudflare(d),
    nameservers(zonaDe(d)),
  ]);
  const sec = secoes(out);

  let dns: DnsDominio = dnsCf || { fonte: 'nenhuma', zona: '', registos: [] };
  if (temZona) {
    const regs = json<Record<string, Record<string, string>>>(sec.get('DNS'), {});
    dns = { fonte: 'hestia', zona: d, registos: Object.entries(regs).map(([id, x]) => ({ id, nome: x.RECORD || '@', tipo: (x.TYPE || '').toUpperCase(), valor: x.VALUE || '', ttl: Number(x.TTL) || 14400, prio: x.PRIORITY || undefined })) };
  }
  if (soDns) return NextResponse.json({ dns, ns }, { headers: { 'Cache-Control': 'no-store' } });

  const web = (Object.values(json<Record<string, Record<string, string>>>(sec.get('WEB'), {}))[0] || {}) as Record<string, string>;
  const ssl = (Object.values(json<Record<string, Record<string, string>>>(sec.get('SSL'), {}))[0] || {}) as Record<string, string>;
  return NextResponse.json(
    {
      redirecionamento: web.REDIRECT ? { url: web.REDIRECT, codigo: web.REDIRECT_CODE || '301' } : null,
      sslForcado: (web.SSL_FORCE || 'no') === 'yes',
      hsts: (web.SSL_HSTS || 'no') === 'yes',
      modelo: web.TPL || '',
      backend: web.BACKEND || '',
      certificado: ssl.SUBJECT || ssl.NOT_AFTER ? { para: ssl.SUBJECT || '', nomes: (ssl.ALIASES || '').split(/[ ,]+/).filter(Boolean), desde: ssl.NOT_BEFORE || '', ate: ssl.NOT_AFTER || '', emissor: ssl.ISSUER || '' } : null,
      dns,
      ns,
      php: bloco(sec.get('INI') || '', MARCA_INI).map((l) => {
        const [k, ...v] = l.split('=');
        return { k: k.trim(), v: v.join('=').trim() };
      }),
      htaccess: bloco(sec.get('HT') || '', MARCA_HT),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

type Corpo = {
  acao: string;
  conta: string;
  dominio: string;
  [k: string]: unknown;
};

/** Reescreve o bloco do VisualHost num ficheiro do site (cria o ficheiro se faltar), com o dono da conta */
async function escreverBloco(conta: string, ficheiro: string, marca: string[], linhas: string[]) {
  const atual = await executeServerCommand(`cat ${q(ficheiro)} 2>/dev/null`, { timeoutMs: 20_000 });
  const i = atual.indexOf(marca[0]);
  const j = atual.indexOf(marca[1]);
  const fora = i >= 0 && j > i ? atual.slice(0, i) + atual.slice(j + marca[1].length) : atual;
  const novo = (linhas.length ? [marca[0], ...linhas, marca[1], ''].join('\n') : '') + fora.replace(/^\n+/, '');
  const tmp = ficheiro + '.vhost-tmp';
  await executeServerCommand(`echo ${b64(novo)} | base64 -d > ${q(tmp)} && chown ${conta}:${conta} ${q(tmp)} && mv ${q(tmp)} ${q(ficheiro)}`, { timeoutMs: 20_000 });
}

const linhaLimpa = (v: unknown) => String(v ?? '').replace(/[\r\n]/g, ' ').trim();

export async function POST(req: NextRequest) {
  const r = await sessao();
  if ('erro' in r) return r.erro;
  let c: Corpo;
  try {
    c = (await req.json()) as Corpo;
  } catch {
    return NextResponse.json({ erro: 'Pedido inválido.' }, { status: 400 });
  }
  const conta = String(c.conta || '');
  const d = String(c.dominio || '').toLowerCase();
  const srv = await lerServidor();
  // `esquecer`: a alteração muda a lista de contas/domínios (os registos de DNS não mudam)
  const resposta = async (p: Promise<{ ok: boolean; error?: string }> | { ok: boolean; error?: string }, esquecer = true) => {
    const x = await p;
    if (x.ok && esquecer) esquecerLeitura();
    return NextResponse.json(x.ok ? { ok: true } : { erro: x.error || 'O servidor recusou.' }, { status: x.ok ? 200 : 400 });
  };
  const call = async (cmd: string, args: string[]) => {
    const x = await hestiaCall(cmd, args);
    return { ok: x.ok, error: x.error };
  };

  // Criar domínio: a conta tem de ser visível; o domínio ainda não existe
  if (c.acao === 'dominio-criar' || c.acao === 'subdominio-criar') {
    if (!CONTA.test(conta)) return NextResponse.json({ erro: 'Conta inválida.' }, { status: 400 });
    const dados = montarDados(srv, await lerRegisto(), r.s);
    if (!dados.contas[conta]) return NextResponse.json({ erro: 'Conta fora do seu painel.' }, { status: 403 });
    const novo = c.acao === 'subdominio-criar' ? `${linhaLimpa(c.sub).toLowerCase()}.${d}` : d;
    if (!DOM.test(novo)) return NextResponse.json({ erro: 'Nome inválido. Sem maiúsculas, www ou http://.' }, { status: 400 });
    if (c.acao === 'subdominio-criar' && !srv.web[conta]?.[d]) return NextResponse.json({ erro: 'O domínio principal não é desta conta.' }, { status: 403 });
    for (const [u, w] of Object.entries(srv.web)) if (w[novo]) return NextResponse.json({ erro: 'Esse domínio já existe no servidor' + (u === conta ? ' nesta conta.' : '.') }, { status: 400 });
    // só o site no Hestia (sem mexer no DNS da Cloudflare); certificado se pedido
    const x = await call('v-add-web-domain', [conta, novo]);
    if (x.ok && c.ssl) hestiaCall('v-add-letsencrypt-domain', [conta, novo]).catch(() => null);
    return resposta(x);
  }

  const e = await verificar(r.s, conta, d, srv);
  if (e) return NextResponse.json({ erro: e }, { status: 403 });
  const w = srv.web[conta]?.[d];
  const raiz = (w?.DOCUMENT_ROOT || `/home/${conta}/web/${d}/public_html/`).replace(/\/+$/, '');

  switch (c.acao) {
    case 'dominio-nome': {
      if (!w) return NextResponse.json({ erro: 'Só se muda o nome de domínios com site.' }, { status: 400 });
      const novo = linhaLimpa(c.novo).toLowerCase().replace(/^www\./, '');
      if (!DOM.test(novo)) return NextResponse.json({ erro: 'Nome novo inválido.' }, { status: 400 });
      for (const ws of Object.values(srv.web)) if (ws[novo]) return NextResponse.json({ erro: 'Esse domínio já existe no servidor.' }, { status: 400 });
      return resposta(call('v-change-web-domain-name', [conta, d, novo, 'yes']));
    }
    case 'ssl-proprio': {
      // certificado próprio colado no painel: ficheiros <domínio>.crt/.key/.ca numa pasta temporária, depois o Hestia
      if (!w) return NextResponse.json({ erro: 'Este domínio não tem site.' }, { status: 400 });
      const crt = String(c.crt || '').trim();
      const key = String(c.key || '').trim();
      const ca = String(c.ca || '').trim();
      if (!/^-----BEGIN CERTIFICATE-----[\s\S]+-----END CERTIFICATE-----$/.test(crt) || !/^-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]+-----END [A-Z ]*PRIVATE KEY-----$/.test(key)) return NextResponse.json({ erro: 'Cole o certificado e a chave privada completos (com as linhas BEGIN/END).' }, { status: 400 });
      const dir = `/tmp/vhost-ssl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const fich = [`${d}.crt`, crt, `${d}.key`, key, ...(ca ? [`${d}.ca`, ca] : [])];
      const escrever = [];
      for (let i = 0; i < fich.length; i += 2) escrever.push(`echo ${b64(fich[i + 1] + '\n')} | base64 -d > ${q(dir + '/' + fich[i])}`);
      await executeServerCommand(`umask 077 && mkdir -p ${q(dir)} && ${escrever.join(' && ')}`, { timeoutMs: 20_000 });
      const temSsl = (w.SSL || 'no').toLowerCase() === 'yes';
      const x = await call(temSsl ? 'v-change-web-domain-sslcert' : 'v-add-web-domain-ssl', [conta, d, dir, ...(temSsl ? [] : ['same']), 'yes']);
      await executeServerCommand(`rm -rf ${q(dir)}`, { timeoutMs: 20_000 }).catch(() => '');
      return resposta(x);
    }
    case 'dominio-apagar':
      return resposta(call(w ? 'v-delete-web-domain' : 'v-delete-mail-domain', [conta, d]));
    case 'dominio-suspender':
      return resposta(call('v-suspend-web-domain', [conta, d]));
    case 'dominio-reativar':
      return resposta(call('v-unsuspend-web-domain', [conta, d]));
    case 'alias-criar': {
      const a = linhaLimpa(c.alias).toLowerCase().replace(/^www\./, '');
      if (!DOM.test(a)) return NextResponse.json({ erro: 'Apontador inválido.' }, { status: 400 });
      return resposta(call('v-add-web-domain-alias', [conta, d, a]));
    }
    case 'alias-apagar':
      return resposta(call('v-delete-web-domain-alias', [conta, d, linhaLimpa(c.alias).toLowerCase()]));
    case 'ssl-le':
      return resposta(hestia.issueLetsEncrypt(conta, d));
    case 'ssl-forcar':
      return resposta(call(c.ligar ? 'v-add-web-domain-ssl-force' : 'v-delete-web-domain-ssl-force', [conta, d]));
    case 'ftp-criar': {
      const user = linhaLimpa(c.user).toLowerCase();
      const pasta = linhaLimpa(c.pasta).replace(/^\/+|\/+$/g, '');
      if (!/^[a-z0-9_]{1,24}$/.test(user)) return NextResponse.json({ erro: 'Nome da conta FTP: letras, números e _.' }, { status: 400 });
      if (pasta.includes('..')) return NextResponse.json({ erro: 'Pasta inválida.' }, { status: 400 });
      if (String(c.senha || '').length < 8) return NextResponse.json({ erro: 'A palavra-passe precisa de pelo menos 8 caracteres.' }, { status: 400 });
      return resposta(hestia.addFtpAccount(conta, d, user, String(c.senha), pasta || undefined));
    }
    case 'ftp-apagar':
      return resposta(hestia.deleteFtpAccount(conta, d, linhaLimpa(c.user)));
    case 'ftp-senha':
      if (String(c.senha || '').length < 8) return NextResponse.json({ erro: 'A palavra-passe precisa de pelo menos 8 caracteres.' }, { status: 400 });
      return resposta(hestia.changeFtpPassword(conta, d, linhaLimpa(c.user), String(c.senha)));
    case 'bd-criar': {
      if (String(c.senha || '').length < 8) return NextResponse.json({ erro: 'A palavra-passe precisa de pelo menos 8 caracteres.' }, { status: 400 });
      const x = await hestia.createDatabase({ username: conta, dbNameSuffix: linhaLimpa(c.nome), dbUserSuffix: linhaLimpa(c.user || c.nome), password: String(c.senha) });
      return resposta(x);
    }
    case 'bd-apagar':
      return resposta(hestia.deleteDatabase(conta, linhaLimpa(c.nome)));
    case 'bd-senha':
      if (String(c.senha || '').length < 8) return NextResponse.json({ erro: 'A palavra-passe precisa de pelo menos 8 caracteres.' }, { status: 400 });
      return resposta(hestia.changeDatabasePassword(conta, linhaLimpa(c.nome), String(c.senha)));
    case 'dns-criar': {
      const tipo = linhaLimpa(c.tipo).toUpperCase();
      const nome = linhaLimpa(c.nome) || '@';
      const valor = linhaLimpa(c.valor);
      const ttl = Number(c.ttl) || 3600;
      if (!['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV', 'CAA'].includes(tipo) || !valor) return NextResponse.json({ erro: 'Tipo ou valor do registo inválido.' }, { status: 400 });
      if (srv.dns[conta]?.[d]) return resposta(hestia.addDnsRecord(conta, d, nome, tipo, valor, ttl, linhaLimpa(c.prio) || undefined), false);
      const zid = await zonaCf(zonaDe(d));
      if (!zid) return NextResponse.json({ erro: 'O DNS deste domínio não está nem no servidor nem na Cloudflare.' }, { status: 400 });
      if (!['A', 'AAAA', 'CNAME', 'TXT', 'MX'].includes(tipo)) return NextResponse.json({ erro: 'Na Cloudflare, por agora só A, AAAA, CNAME, TXT e MX.' }, { status: 400 });
      const x = await upsertCloudflareRecord(zid, zonaDe(d), { type: tipo as CloudflareRecordInput['type'], name: nome, content: valor, ttl, priority: Number(c.prio) || undefined });
      return resposta({ ok: x.ok, error: x.error }, false);
    }
    case 'dns-editar': {
      const id = linhaLimpa(c.id);
      const tipo = linhaLimpa(c.tipo).toUpperCase();
      const nome = linhaLimpa(c.nome) || '@';
      const valor = linhaLimpa(c.valor);
      const ttl = Number(c.ttl) || 3600;
      if (!id || !valor) return NextResponse.json({ erro: 'Registo inválido.' }, { status: 400 });
      if (srv.dns[conta]?.[d]) return resposta(call('v-change-dns-record', [conta, d, id, nome, tipo, valor, linhaLimpa(c.prio), 'yes', String(ttl)]), false);
      const zid = await zonaCf(zonaDe(d));
      if (!zid) return NextResponse.json({ erro: 'Zona não encontrada.' }, { status: 400 });
      if (!['A', 'AAAA', 'CNAME', 'TXT', 'MX'].includes(tipo)) return NextResponse.json({ erro: 'Este tipo de registo muda-se na Cloudflare.' }, { status: 400 });
      return resposta(updateCloudflareDnsRecord(zid, id, zonaDe(d), { type: tipo as CloudflareRecordInput['type'], name: nome, content: valor, ttl, priority: Number(c.prio) || undefined }), false);
    }
    case 'dns-apagar': {
      const id = linhaLimpa(c.id);
      if (srv.dns[conta]?.[d]) return resposta(hestia.deleteDnsRecord(conta, d, id), false);
      const zid = await zonaCf(zonaDe(d));
      return zid ? resposta(deleteCloudflareDnsRecord(zid, id), false) : NextResponse.json({ erro: 'Zona não encontrada.' }, { status: 400 });
    }
    case 'redir-dominio': {
      const url = linhaLimpa(c.url);
      if (!/^https?:\/\/\S+$/.test(url)) return NextResponse.json({ erro: 'Destino inválido (https://…).' }, { status: 400 });
      return resposta(call('v-add-web-domain-redirect', [conta, d, url, ['301', '302'].includes(String(c.codigo)) ? String(c.codigo) : '301', 'yes']));
    }
    case 'redir-dominio-tirar':
      return resposta(call('v-delete-web-domain-redirect', [conta, d, 'yes']));
    case 'htaccess': {
      // regras do VisualHost no .htaccess: redirecionamentos por caminho e proteção hotlink (sites com Apache)
      if (!w) return NextResponse.json({ erro: 'Este domínio não tem site.' }, { status: 400 });
      const linhas = (Array.isArray(c.linhas) ? c.linhas : []).map(linhaLimpa).filter(Boolean);
      if (linhas.some((l) => !/^(Redirect (301|302) \/\S* https?:\/\/\S+|RewriteEngine On|RewriteCond .+|RewriteRule .+|# .*)$/.test(l))) return NextResponse.json({ erro: 'Regra inválida.' }, { status: 400 });
      await escreverBloco(conta, raiz + '/.htaccess', MARCA_HT, linhas);
      return NextResponse.json({ ok: true });
    }
    case 'php-versao':
      return resposta(hestia.changeWebDomainPhp(conta, d, linhaLimpa(c.versao)));
    case 'php-ini': {
      if (!w) return NextResponse.json({ erro: 'Este domínio não tem site.' }, { status: 400 });
      const pares = (Array.isArray(c.regras) ? c.regras : []) as { k: string; v: string }[];
      const linhas = pares.map((p) => `${linhaLimpa(p.k)} = ${linhaLimpa(p.v)}`);
      if (pares.some((p) => !/^[a-z0-9_.]{2,60}$/.test(linhaLimpa(p.k)) || /[;\n]/.test(String(p.v)))) return NextResponse.json({ erro: 'Diretiva PHP inválida.' }, { status: 400 });
      await escreverBloco(conta, raiz + '/.user.ini', MARCA_INI, linhas);
      return NextResponse.json({ ok: true });
    }
    default:
      return NextResponse.json({ erro: 'Ação desconhecida.' }, { status: 400 });
  }
}
