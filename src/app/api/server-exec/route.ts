import { NextRequest, NextResponse } from 'next/server';
import { Client } from 'ssh2';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { getServerHost } from '@/lib/server-config';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createAdminClient(supabaseUrl, supabaseServiceKey);

async function execSSH(command: string, timeoutMs: number = 20000): Promise<string> {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    let out = '';
    const rawKey = process.env.SSH_PRIVATE_KEY || '';
    
    // Validate key format
    if (!rawKey.includes('BEGIN') || !rawKey.includes('END')) {
      return reject(new Error('SSH_PRIVATE_KEY appears to be invalid - missing BEGIN/END markers'));
    }
    
    const privateKey = rawKey.replace(/\\n/g, '\n');
    const host = process.env.CYBERPANEL_IP || getServerHost();

    console.log('[SSH] Connecting to', host, '- Timeout:', timeoutMs, 'ms');
    console.log('[SSH] Command:', command.substring(0, 150));

    // Set a timeout for the entire operation
    const timeout = setTimeout(() => {
      conn.end();
      reject(new Error(`SSH operation timed out after ${timeoutMs / 1000} seconds`));
    }, timeoutMs);

    conn.on('ready', () => {
      console.log('[SSH] Connected! Executing command...');
      conn.exec(command, (err, stream) => {
        if (err) { conn.end(); return reject(err); }
        stream.on('data', (d: Buffer) => { out += d.toString(); });
        stream.stderr.on('data', (d: Buffer) => { out += d.toString(); });
        stream.on('close', () => { 
          clearTimeout(timeout);
          console.log('[SSH] Command finished. Output length:', out.length);
          conn.end(); 
          resolve(out); 
        });
      });
    });

    conn.on('error', (err) => {
      clearTimeout(timeout);
      console.error('[SSH] Connection ERROR:', err.message);
      let errorMessage = err.message;
      if (err.message.includes('handshake')) {
        errorMessage = 'Falha na conexão SSH: handshake timeout.';
      } else if (err.message.includes('connect')) {
        errorMessage = 'Não foi possível conectar ao servidor CyberPanel.';
      } else if (err.message.includes('authentication')) {
        errorMessage = 'Autenticação SSH falhou.';
      }
      reject(new Error(errorMessage));
    });

    conn.connect({
      host,
      port: 22,
      username: 'root',
      privateKey: Buffer.from(privateKey),
      readyTimeout: 15000,
      keepaliveInterval: 5000,
      keepaliveCountMax: 3,
    });
  });
}

export async function POST(req: NextRequest) {
  try {
    const { action, params = {} } = await req.json();
    console.log(`[server-exec] Action: ${action}, Params:`, JSON.stringify(params).substring(0, 200));
    
    // Check env vars
    if (!process.env.SSH_PRIVATE_KEY) {
      console.error('[server-exec] ERROR: SSH_PRIVATE_KEY not set');
      return NextResponse.json({ success: false, error: 'SSH_PRIVATE_KEY not configured' }, { status: 500 });
    }
    
    let data: any = {};
    
    // Helper to log audit results
    const auditLogs: string[] = [];
    const logAudit = (msg: string) => {
      console.log(`[AUDIT] ${msg}`);
      auditLogs.push(msg);
    };

    switch (action) {

      case 'fullSync': {
        logAudit('Iniciando auditoria completa e sincronização...');
        
        // 1. Sincronizar Pacotes
        logAudit('Sincronizando pacotes...');
        const pkgsRaw = await execSSH(`mysql cyberpanel -e "SELECT packageName, diskSpace, bandwidth, emailAccounts, dataBases, ftpAccounts, allowedDomains FROM packages_package;" -B -N 2>/dev/null`);
        const pkgs = pkgsRaw.split('\n').filter(Boolean).map(line => {
          const [name, disk, bw, emails, dbs, ftp, domains] = line.split('\t');
          return {
            package_name: name,
            disk_space: parseInt(disk || '1000'),
            bandwidth: parseInt(bw || '1000'),
            email_accounts: parseInt(emails || '10'),
            databases: parseInt(dbs || '5'),
            ftp_accounts: parseInt(ftp || '5'),
            allowed_domains: parseInt(domains || '1'),
            synced_at: new Date().toISOString()
          };
        });
        
        for (const pkg of pkgs) {
          await supabaseAdmin.from('cyberpanel_packages').upsert(pkg, { onConflict: 'package_name' });
        }
        logAudit(`${pkgs.length} pacotes sincronizados.`);

        // 2. Sincronizar Utilizadores
        logAudit('Sincronizando utilizadores...');
        const usersRaw = await execSSH(`mysql cyberpanel -e "SELECT userName, email, type, firstName, lastName FROM loginSystem_administrator;" -B -N 2>/dev/null`);
        const users = usersRaw.split('\n').filter(Boolean).map(line => {
          const [userName, email, type, firstName, lastName] = line.split('\t');
          return {
            username: userName,
            email: email,
            acl: type,
            first_name: firstName || '',
            last_name: lastName || '',
            synced_at: new Date().toISOString()
          };
        });
        
        for (const user of users) {
          await supabaseAdmin.from('cyberpanel_users').upsert(user, { onConflict: 'username' });
        }
        logAudit(`${users.length} utilizadores sincronizados.`);

        // 3. Sincronizar Websites e Activar Suspended
        logAudit('Sincronizando websites e verificando estado...');
        const sitesQuery = `
          SELECT w.domain, w.adminEmail, p.packageName, w.state, u.userName 
          FROM websiteFunctions_websites w 
          LEFT JOIN packages_package p ON w.package_id = p.id 
          LEFT JOIN loginSystem_administrator u ON w.admin_id = u.id;
        `;
        const sitesRaw = await execSSH(`mysql cyberpanel -e "${sitesQuery}" -B -N 2>/dev/null`);
        const sites = sitesRaw.split('\n').filter(Boolean).map(line => line.split('\t'));
        
        let activatedCount = 0;
        
        // Obter tipos de sites para o sync completo
        const checkScript = `
for domain in $(mysql cyberpanel -se "SELECT domain FROM websiteFunctions_websites;" 2>/dev/null); do
  wp_config=$([ -f /home/$domain/public_html/wp-config.php ] && echo "1" || echo "0")
  wp_content=$([ -d /home/$domain/public_html/wp-content ] && echo "1" || echo "0")
  next_config=$([ -f /home/$domain/public_html/next.config.js ] || [ -f /home/$domain/public_html/next.config.ts ] && echo "1" || echo "0")
  next_folder=$([ -d /home/$domain/public_html/.next ] || [ -d /home/$domain/public_html/src ] && echo "1" || echo "0")
  package_json=$([ -f /home/$domain/public_html/package.json ] && echo "1" || echo "0")
  index_html=$([ -f /home/$domain/public_html/index.html ] && echo "1" || echo "0")
  index_php=$([ -f /home/$domain/public_html/index.php ] && echo "1" || echo "0")
  
  wp_score=$((wp_config + wp_content))
  next_score=$((next_config + next_folder + package_json))
  basic_score=$((index_html + index_php))
  
  if [ $wp_score -ge 1 ]; then type="wordpress";
  elif [ $next_score -ge 2 ]; then type="nextjs";
  elif [ $basic_score -ge 1 ]; then type="html";
  else type="empty"; fi
  echo "$domain|$type"
done
`;
        const typesRaw = await execSSH(checkScript);
        const siteTypes: Record<string, string> = {};
        typesRaw.split('\n').filter(Boolean).forEach(line => {
          const [d, t] = line.split('|');
          if (d) siteTypes[d] = t;
        });

        for (const [domain, email, pkg, state, owner] of sites) {
          if (state === '1') {
            logAudit(`⚠️ Site ${domain} está suspenso. Activando...`);
            await execSSH(`cyberpanel unsuspendWebsite --domainName ${domain}`);
            activatedCount++;
          }
          
          await supabaseAdmin.from('cyberpanel_sites').upsert({
            domain,
            admin_email: email,
            package: pkg || 'Default',
            status: 'Active', 
            owner: owner || 'admin',
            site_type: siteTypes[domain] || 'empty',
            synced_at: new Date().toISOString()
          }, { onConflict: 'domain' });
        }
        
        logAudit(`${sites.length} websites sincronizados. ${activatedCount} reactivados.`);
        
        return NextResponse.json({ 
          success: true, 
          data: { 
            logs: auditLogs,
            counts: {
              packages: pkgs.length,
              users: users.length,
              sites: sites.length,
              activated: activatedCount
            }
          } 
        });
      }

      case 'listWebsites': {
        // Listar todos os sites via MYSQL directo com JOINS para performance e dados completos
        const query = `SELECT w.domain, w.adminEmail, p.packageName, w.state, a.userName, w.phpSelection, w.ssl, w.config FROM websiteFunctions_websites w JOIN loginSystem_administrator a ON w.admin_id = a.id JOIN packages_package p ON w.package_id = p.id;`;
        const raw = await execSSH(`mysql cyberpanel -e "${query}" -B -N 2>/dev/null`);
        const sites = raw.split('\n').filter(Boolean).map(line => {
          const [domain, adminEmail, pkg, state, owner, php, ssl, configStr] = line.split('\t');
          let diskUsage = '0 MB';
          try {
            if (configStr) {
              const cfg = JSON.parse(configStr);
              diskUsage = `${cfg.DiskUsage || 0} MB`;
            }
          } catch (e) {}

          return { 
            domain, 
            adminEmail, 
            package: pkg, 
            state: parseInt(state),
            owner,
            phpVersion: php,
            sslStatus: parseInt(ssl) === 1 ? 'Secure' : 'No SSL',
            diskUsage,
            site_type: 'empty' 
          };
        });

        // Para cada site verificar se tem conteúdo real em public_html
        const checkScript = `
for domain in $(mysql cyberpanel -se "SELECT domain FROM websiteFunctions_websites;" 2>/dev/null); do
  # WordPress — ficheiros chave
  wp_config=$([ -f /home/$domain/public_html/wp-config.php ] && echo "1" || echo "0")
  wp_content=$([ -d /home/$domain/public_html/wp-content ] && echo "1" || echo "0")
  
  # Next.js — ficheiros chave
  next_config=$([ -f /home/$domain/public_html/next.config.js ] || [ -f /home/$domain/public_html/next.config.ts ] && echo "1" || echo "0")
  next_folder=$([ -d /home/$domain/public_html/.next ] || [ -d /home/$domain/public_html/src ] && echo "1" || echo "0")
  package_json=$([ -f /home/$domain/public_html/package.json ] && echo "1" || echo "0")
  
  # HTML/PHP simples — ficheiros chave
  index_php=$([ -f /home/$domain/public_html/index.php ] && echo "1" || echo "0")
  index_html=$([ -f /home/$domain/public_html/index.html ] && echo "1" || echo "0")
  
  # Calcular score e definir tipo
  if [ $wp_config -eq 1 ] || [ $wp_content -eq 1 ]; then type="wordpress";
  elif [ $next_config -eq 1 ] || [ $next_folder -eq 1 ] || [ $package_json -eq 1 ]; then type="nextjs";
  elif [ $index_php -eq 1 ] || [ $index_html -eq 1 ]; then type="html";
  else type="empty"; fi
  echo "$domain|$type"
done
`;
        const typesRaw = await execSSH(checkScript);
        const siteTypes: Record<string, string> = {};
        typesRaw.split('\n').filter(Boolean).forEach(line => {
          const [d, t] = line.split('|');
          if (d) siteTypes[d] = t;
        });

        // Adicionar tipos detectados aos sites
        data = sites.map(s => ({
          ...s,
          site_type: siteTypes[s.domain] || 'empty'
        }));
        break;
      }

      case 'listPackages': {
        try {
          const raw = await execSSH(`mysql cyberpanel -e "SELECT id, packageName, diskSpace, bandwidth, emailAccounts, dataBases, ftpAccounts, allowedDomains FROM packages_package;" -B -N 2>/dev/null`);
          console.log('[listPackages] Raw output:', raw.substring(0, 500));

          if (!raw || raw.trim() === '') {
            data = [];
          } else {
            data = raw.split('\n').filter(Boolean).map(line => {
              const parts = line.split('\t');
              if (parts.length < 8) return null;
              return {
                id: parseInt(parts[0]) || null,
                packageName: parts[1] || '',
                diskSpace: parseInt(parts[2]) || 0,
                bandwidth: parseInt(parts[3]) || 0,
                emailAccounts: parseInt(parts[4]) || 0,
                dataBases: parseInt(parts[5]) || 0,
                ftpAccounts: parseInt(parts[6]) || 0,
                allowedDomains: parseInt(parts[7]) || 0
              };
            }).filter(Boolean);
          }
          console.log('[listPackages] Parsed packages:', data.length);
        } catch (error: any) {
          console.error('[listPackages] Error:', error);
          data = [];
        }
        break;
      }

      case 'createPackage': {
        const raw = await execSSH(`/usr/local/CyberPanel/bin/python /usr/local/CyberCP/manage.py shell -c "
import sys, os, django
sys.path.insert(0, '/usr/local/CyberCP')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'CyberCP.settings')
django.setup()
from packages.models import Package
from loginSystem.models import Administrator
admin = Administrator.objects.first()
pkg = Package.objects.create(
  admin=admin,
  packageName='${params.packageName}',
  diskSpace='${params.diskSpace}',
  bandwidth='${params.bandwidth}',
  emailAccounts='${params.emailAccounts}',
  dataBases='${params.dataBases}',
  ftpAccounts='${params.ftpAccounts || 5}',
  allowedDomains='${params.allowedDomains || 1}'
)
print({'success': True, 'id': pkg.id})
"`);
        const match = raw.match(/\{'success': True, 'id': (\d+)\}/);
        if (match) {
          data = { success: true, id: parseInt(match[1]) };
        } else {
          data = { success: false, error: raw };
        }
        break;
      }

      case 'deletePackage': {
        const raw = await execSSH(`/usr/local/CyberPanel/bin/python /usr/local/CyberCP/manage.py shell -c "
import sys, os, django
sys.path.insert(0, '/usr/local/CyberCP')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'CyberCP.settings')
django.setup()
from packages.models import Package
deleted, _ = Package.objects.filter(packageName='${params.packageName}').delete()
print({'success': deleted > 0, 'deleted': deleted})
"`);
        const match = raw.match(/\{'success': (True|False), 'deleted': (\d+)\}/);
        if (match) {
          data = { success: match[1] === 'True', deleted: parseInt(match[2]) };
        } else {
          data = { success: false, error: raw };
        }
        break;
      }

      case 'editPackage': {
        const raw = await execSSH(`/usr/local/CyberPanel/bin/python /usr/local/CyberCP/manage.py shell -c "
import sys, os, django
sys.path.insert(0, '/usr/local/CyberCP')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'CyberCP.settings')
django.setup()
from packages.models import Package
Package.objects.filter(packageName='${params.packageName}').update(
  diskSpace=${params.diskSpace || 1000},
  bandwidth=${params.bandwidth || 1000},
  emailAccounts=${params.emailAccounts || 10},
  dataBases=${params.dataBases || 5},
  ftpAccounts=${params.ftpAccounts || 5},
  allowedDomains=${params.allowedDomains || 1}
)
print('ok')
"`);
        data = { success: raw.includes('ok'), output: raw };
        break;
      }

      case 'fixSnappyMailPermissions': {
        // Agora apenas configura o nativo - instalação manual foi removida
        try {
          console.log('[fixSnappyMailPermissions] Configurando SnappyMail nativo do CyberPanel...');
          
          const configCmd = [
            'echo "=== CONFIGURANDO SNAPPYMAIL NATIVO ==="',
            'chown -R lscpd:lscpd /usr/local/lscp/cyberpanel/snappymail/',
            'chmod -R 755 /usr/local/lscp/cyberpanel/snappymail/',
            'chmod -R 777 /usr/local/lscp/cyberpanel/snappymail/data/ 2>/dev/null || true',
            '',
            'echo "=== LIMPANDO INSTALACAO MANUAL (SE EXISTIR) ==="',
            'rm -rf /usr/local/CyberCP/public/snappymail 2>/dev/null || true',
            '',
            'echo "=== STATUS ==="',
            'ls -la /usr/local/lscp/cyberpanel/snappymail/ | head -5',
            'echo "✅ SnappyMail nativo configurado!"'
          ].join(' && ');
          
          const output = await execSSH(configCmd);
          console.log('[fixSnappyMailPermissions] Output:', output);
          
          data = { 
            success: true, 
            output: output,
            message: 'SnappyMail nativo configurado. Use ${getHestiaUrl()}/snappymail/' 
          };
          
        } catch (err: any) {
          console.error('[fixSnappyMailPermissions] Error:', err.message);
          data = { success: false, error: err.message };
        }
        break;
      }

      case 'cleanupSnappyMailManual': {
        try {
          console.log('[cleanupSnappyMailManual] Removendo instalação manual...');
          
          const cleanupCmd = [
            'echo "=== REMOVENDO INSTALACAO MANUAL DO SNAPPYMAIL ==="',
            'rm -rf /usr/local/CyberCP/public/snappymail',
            'rm -f /usr/local/CyberCP/public/snappymail.php',
            'echo "✅ Instalação manual removida. SnappyMail nativo em uso: ${getHestiaUrl()}/snappymail/"'
          ].join(' && ');
          
          const output = await execSSH(cleanupCmd);
          
          data = { 
            success: true, 
            output: output,
            message: 'Instalação manual removida' 
          };
          
        } catch (err: any) {
          data = { success: false, error: err.message };
        }
        break;
      }

      case 'listUsers': {
        try {
          console.log('[listUsers] Starting MySQL query...');
          const raw = await execSSH(`mysql cyberpanel -e "SELECT id, userName, email, type, state, firstName, lastName FROM loginSystem_administrator;" -B -N 2>/dev/null`);
          console.log('[listUsers] Raw SSH output length:', raw.length);
          
          if (!raw || raw.trim() === '') {
            console.warn('[listUsers] Empty response from MySQL, trying fallback query...');
            // Fallback: tentar sem colunas firstName/lastName caso elas não existam em versões antigas
            const fallbackRaw = await execSSH(`mysql cyberpanel -e "SELECT id, userName, email, type, state FROM loginSystem_administrator;" -B -N 2>/dev/null`);
            if (fallbackRaw && fallbackRaw.trim() !== '') {
              data = fallbackRaw.split('\n').filter(Boolean).map(line => {
                const parts = line.split('\t');
                const [id, userName, email, type, state] = parts;
                return { id: parseInt(id) || 0, userName: userName || '', email: email || '', type: type || '', state: state || '', firstName: '', lastName: '' };
              });
            } else {
              data = [];
            }
          } else {
            data = raw.split('\n').filter(Boolean).map(line => {
              const parts = line.split('\t');
              if (parts.length < 2) return null;
              const [id, userName, email, type, state, firstName, lastName] = parts;
              return { id: parseInt(id) || 0, userName: userName || '', email: email || '', type: type || '', state: state || '', firstName: firstName || '', lastName: lastName || '' };
            }).filter(Boolean);
          }
        } catch (err: any) {
          console.error('[listUsers] Non-critical error:', err.message);
          // Return empty array instead of failing the whole request
          data = [];
        }
        break;
      }

      case 'suspendWebsite': {
        const raw = await execSSH(`/usr/local/CyberPanel/bin/python /usr/local/CyberCP/manage.py shell -c "
import sys
sys.path.insert(0, '/usr/local/CyberCP')
import django, os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'CyberCP.settings')
django.setup()
from websiteFunctions.models import Websites
Websites.objects.filter(domain='${params.domain}').update(state=0)
print('ok')
"`);
        data = { success: raw.includes('ok') };
        break;
      }

      case 'unsuspendWebsite': {
        const raw = await execSSH(`/usr/local/CyberPanel/bin/python /usr/local/CyberCP/manage.py shell -c "
import sys
sys.path.insert(0, '/usr/local/CyberCP')
import django, os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'CyberCP.settings')
django.setup()
from websiteFunctions.models import Websites
Websites.objects.filter(domain='${params.domain}').update(state=1)
print('ok')
"`);
        data = { success: raw.includes('ok') };
        break;
      }

      case 'deleteWebsite': {
        const raw = await execSSH(
          `cyberpanel deleteWebsite --domainName ${params.domain} 2>&1`
        );
        // Consider success if contains "success": 1 or doesn't contain error/traceback
        const hasSuccess = raw.includes('"success": 1') || raw.includes('Website successfully deleted');
        const hasError = raw.toLowerCase().includes('error') && raw.toLowerCase().includes('traceback');
        data = { output: raw, success: !hasError && hasSuccess };
        break;
      }

      case 'createWebsite': {
        const domainName = params.domainName || params.domain;
        const email = params.email || params.adminEmail;
        const owner = params.owner || params.username || 'admin';
        const pkg = params.package || params.packageName || 'Default';
        const phpRaw = params.php || params.phpVersion || 'PHP 8.2';
        const php = phpRaw.replace(/^PHP\s*/, '').trim();

        console.log('[createWebsite] Params:', { domainName, email, owner, pkg, php });

        if (!domainName || !email) {
          data = { success: false, error: 'Domínio e email são obrigatórios' };
          break;
        }

        // ── Tentativa 1: CyberPanel CLI (sem --ssl/--dkim para evitar timeout) ──
        // O SSL pode ser emitido separadamente. O --ssl 1 e --dkim 1 causam timeout
        // porque o acme.sh fica em loop quando o domínio ainda não está resolvido.
        const cliCommand = `cyberpanel createWebsite ` +
          `--domainName ${domainName} ` +
          `--email ${email} ` +
          `--owner ${owner} ` +
          `--package "${pkg}" ` +
          `--php "${php}" ` +
          `--ssl 0 ` +
          `--dkim 0 2>&1`;

        console.log('[createWebsite] Trying CLI:', cliCommand);

        let raw = '';
        let siteCreated = false;

        try {
          // Timeout de 60s para este comando (é mais lento que o normal)
          raw = await execSSH(cliCommand, 60000);
          console.log('[createWebsite] CLI output:', raw.substring(0, 400));

          const hasError = raw.toLowerCase().includes('error') && !raw.toLowerCase().includes('opendkim') && !raw.toLowerCase().includes('postfix');
          const hasSuccess = raw.includes('success') || raw.includes('created') || raw.includes('website has been created') || raw.includes('"errorMessage": "None"');
          siteCreated = hasSuccess || !hasError;
        } catch (cliErr: any) {
          console.warn('[createWebsite] CLI failed:', cliErr.message, '— trying Django fallback...');

          // ── Fallback: criar website directamente via Django ORM ──────────────
          const pythonScript = `
python3 -c "
import sys, os
sys.path.insert(0, '/usr/local/CyberCP')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'CyberCP.settings')
import django; django.setup()
import { getServerHost, getHestiaUrl } from '@/lib/server-config'
from websiteFunctions.models import Websites
from packages.models import Package
from loginSystem.models import Administrator
try:
    admin = Administrator.objects.filter(userName='${owner}').first() or Administrator.objects.first()
    pkg = Package.objects.filter(packageName='${pkg}').first() or Package.objects.first()
    if not Websites.objects.filter(domain='${domainName}').exists():
        site = Websites(admin=admin, package=pkg, domain='${domainName}', adminEmail='${email}')
        site.save()
        print('CREATED_OK')
    else:
        print('ALREADY_EXISTS')
except Exception as e:
    print('PY_ERROR:' + str(e))
" 2>&1`;
          try {
            raw = await execSSH(pythonScript, 30000);
            console.log('[createWebsite] Django fallback output:', raw.substring(0, 300));
            siteCreated = raw.includes('CREATED_OK') || raw.includes('ALREADY_EXISTS');
          } catch (pyErr: any) {
            console.error('[createWebsite] Django fallback also failed:', pyErr.message);
            raw = pyErr.message;
            siteCreated = false;
          }
        }

        // ── Sync automático ao Supabase logo após criação ─────────────────────
        if (siteCreated && domainName) {
          try {
            console.log('[createWebsite] Syncing to Supabase:', domainName);
            await supabaseAdmin
              .from('cyberpanel_sites')
              .upsert({
                domain: domainName,
                admin_email: email || '',
                package: pkg || 'Default',
                owner: owner || 'admin',
                status: 'Active',
                disk_usage: '0',
                bandwidth_usage: '0',
                wp_installed: false,
                synced_at: new Date().toISOString(),
              }, { onConflict: 'domain' });
            console.log('[createWebsite] Supabase sync OK:', domainName);
          } catch (syncErr: any) {
            console.warn('[createWebsite] Supabase sync warning:', syncErr.message);
          }
        }
        // ─────────────────────────────────────────────────────────────────────
        
        data = { 
          output: raw, 
          success: siteCreated,
          domain: domainName,
          error: !siteCreated ? raw : undefined
        };
        break;
      }


      case 'listEmails': {
        const domain = params.domain || 'your-domain.com'
        const raw = await execSSH(
          `mysql vmail -e "SELECT username FROM users WHERE domain='${domain}';" -B -N 2>/dev/null || ` +
          `mysql cyberpanel -e "SELECT emailUser FROM e_manager_email WHERE domainOwner_id IN (SELECT id FROM websiteBase_websites WHERE domain='${domain}');" -B -N 2>/dev/null`
        )
        const emails = raw.trim().split('\n')
          .filter(Boolean)
          .map((user: string) => ({
            email: user.includes('@') ? user : `${user}@${domain}`,
            user: user.includes('@') ? user.split('@')[0] : user,
            domain,
            quota: '500',
            usage: '0'
          }))
        data = { emails }
        break
      }

      case 'createEmail': {
        const raw = await execSSH(`cyberpanel createEmail --domainName ${params.domain} --userName ${params.userName} --password '${params.password}' 2>&1`);
        data = { output: raw, success: raw.includes('"success": 1') };
        break;
      }

      case 'deleteEmail': {
        const raw = await execSSH(`cyberpanel deleteEmail --email ${params.email} 2>&1`);
        data = { output: raw, success: raw.includes('"success": 1') };
        break;
      }

      case 'issueSSL': {
        const raw = await execSSH(`cyberpanel issueSSL --domainName ${params.domain} --isChild 0 2>&1`);
        data = { output: raw, success: raw.toLowerCase().includes('success') || raw.includes('"status": 1') };
        break;
      }

      case 'createDatabase': {
        const raw = await execSSH(
          `cyberpanel createDatabase --dbName ${params.dbName} --dbUsername ${params.dbUsername} --dbPassword '${params.dbPassword}' --databaseWebsite ${params.databaseWebsite} 2>&1`
        );
        data = { output: raw, success: raw.includes('"success": 1') };
        break;
      }

      case 'createFTP': {
        const raw = await execSSH(
          `cyberpanel createFTP --domainName ${params.domain} --userName ${params.userName} --password '${params.password}' --path ${params.path || '/'} 2>&1`
        );
        data = { output: raw, success: raw.includes('"success": 1') };
        break;
      }

      case 'changePHP': {
        const raw = await execSSH(
          `cyberpanel changePHP --domainName ${params.domain} --php "${params.php}" 2>&1`
        );
        data = { output: raw, success: raw.includes('"success": 1') };
        break;
      }

      case 'changePackage': {
        const raw = await execSSH(
          `cyberpanel changePackage --domainName ${params.domain} --packageName ${params.packageName} 2>&1`
        );
        data = { output: raw, success: raw.includes('"success": 1') };
        break;
      }

      case 'createUser': {
        // DIAGNOSTIC: Test basic SSH connectivity first
        console.log('[createUser] Testing SSH connectivity...');
        const testConnection = await execSSH('echo "SSH_OK"');
        console.log('[createUser] SSH test result:', testConnection.trim());
        
        // Use direct Python script path (more reliable than symlink)
        const cyberpanelPath = '/usr/local/CyberCP/cli/cyberPanel.py';
        console.log('[createUser] Using direct Python script path:', cyberpanelPath);
        
        // Check if file exists
        const checkFile = await execSSH(`ls -la ${cyberpanelPath} 2>&1 || echo "FILE_NOT_FOUND"`);
        console.log('[createUser] File check:', checkFile.trim());
        
        // First try: Use cyberpanel CLI command
        const command = `python3 ${cyberpanelPath} createAdministrator ` +
          `--userName ${params.userName} ` +
          `--password '${params.password}' ` +
          `--email ${params.email} ` +
          `--firstName '${params.firstName || ''}' ` +
          `--lastName '${params.lastName || ''}' ` +
          `--selectedACL ${params.acl || 'user'} ` +
          `--websitesLimit ${params.websitesLimit ?? 0} ` +
          `--securityLevel ${params.securityLevel || 'HIGH'} 2>&1`;
        
        console.log('[createUser] Executing command:', command.substring(0, 200));
        let raw = '';
        let success = false;
        
        try {
          raw = await execSSH(command);
          console.log('[createUser] Raw output:', raw || '(empty)');
          console.log('[createUser] Output length:', raw.length);
          
          // Check for various success indicators
          success = raw.includes('"status": 1') || 
                     raw.includes('successfully created') || 
                     raw.includes('Success') || 
                     raw.includes('created successfully') ||
                     raw.includes('User created');
        } catch (cmdError: any) {
          console.error('[createUser] Command execution error:', cmdError.message);
          raw = `Command failed: ${cmdError.message}`;
        }
        
        // FALLBACK: If CLI failed, try direct MySQL insert
        let finalOutput = raw;
        if (!success) {
          console.log('[createUser] CLI failed or returned empty, trying direct MySQL insert...');
          try {
            // Check if user already exists
            const checkUser = await execSSH(`mysql cyberpanel -e "SELECT userName FROM loginSystem_administrator WHERE userName='${params.userName}';" -B -N 2>&1`);
            console.log('[createUser] Check existing user:', checkUser.trim());
            
            if (checkUser.trim()) {
              success = false;
              finalOutput = `User '${params.userName}' already exists in CyberPanel.`;
            } else {
              // Hash password using Python (CyberPanel uses sha512_crypt)
              const hashedPassword = await execSSH(
                `python3 -c "from passlib.hash import sha512_crypt; print(sha512_crypt.hash('${params.password}'))" 2>&1`
              );
              console.log('[createUser] Password hashed, length:', hashedPassword.length);
              
              // Insert directly into CyberPanel database
              const insertCmd = `mysql cyberpanel -e "INSERT INTO loginSystem_administrator (userName, password, email, firstName, lastName, type, state, initWebsitesLimit, securityLevel) VALUES ('${params.userName}', '${hashedPassword.trim()}', '${params.email}', '${params.firstName || ''}', '${params.lastName || ''}', 0, 'ACTIVE', ${params.websitesLimit ?? 0}, '${params.securityLevel || 'HIGH'}');" 2>&1`;
              const insertResult = await execSSH(insertCmd);
              console.log('[createUser] MySQL insert result:', insertResult.trim());
              
              if (!insertResult.toLowerCase().includes('error')) {
                success = true;
                finalOutput = 'User created via MySQL direct insert.';
              } else {
                finalOutput = `MySQL insert failed: ${insertResult}`;
              }
            }
          } catch (mysqlError: any) {
            console.error('[createUser] MySQL fallback error:', mysqlError.message);
            finalOutput = `MySQL fallback error: ${mysqlError.message}. Original CLI output: ${raw}`;
          }
        }
        
        let supabaseAuthId = null;
        if (success) {
          try {
            // Sincronizar com Supabase Auth
            const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
              email: params.email,
              password: params.password,
              email_confirm: true,
              user_metadata: { 
                nome: `${params.firstName || ''} ${params.lastName || ''}`.trim(),
                role: params.acl === 'admin' ? 'admin' : 'client'
              }
            });

            if (authError) {
              console.error('[createUser] Supabase Auth Error:', authError);
              // Se o erro for que o utilizador já existe, tentamos apenas obter o ID
              if (authError.message.includes('already registered')) {
                 const { data: existing } = await supabaseAdmin.from('profiles').select('id').eq('email', params.email).single();
                 supabaseAuthId = existing?.id;
              }
            } else {
              supabaseAuthId = authUser.user?.id;
              console.log('[createUser] Supabase Auth Success:', supabaseAuthId);
            }

            // Atualizar tabela cyberpanel_users com o user_id do Supabase
            if (supabaseAuthId) {
              await supabaseAdmin
                .from('cyberpanel_users')
                .update({ user_id: supabaseAuthId })
                .eq('username', params.userName);
            }
          } catch (e) {
            console.error('[createUser] Sync error:', e);
          }
        }

        // If output is empty, likely SSH connection or command issue
        let errorMsg = success ? null : finalOutput;
        if (!success && !finalOutput.trim()) {
          errorMsg = 'Command returned empty output. SSH connection may have failed or cyberpanel CLI not found.';
        }
        
        data = { output: finalOutput, success, error: errorMsg, authSync: !!supabaseAuthId, cyberpanelPath };
        break;
      }

      case 'suspendUser': {
        const raw = await execSSH(
          `cyberpanel suspendUser --userName ${params.userName} --state ${params.state} 2>&1`
        );
        data = { output: raw, success: raw.includes('"status": 1') };
        break;
      }

      case 'modifyUser': {
        const raw = await execSSH(
          `cyberpanel modifyAdministrator ` +
          `--userName ${params.userName} ` +
          `--email ${params.email} ` +
          `--firstName '${params.firstName || ''}' ` +
          `--lastName '${params.lastName || ''}' ` +
          `--selectedACL ${params.acl || 'user'} ` +
          `--websitesLimit ${params.websitesLimit ?? 10} ` +
          `--securityLevel ${params.securityLevel || 'HIGH'} 2>&1`
        );
        data = { output: raw, success: raw.includes('Success') || raw.includes('successfully modified') || raw.includes('"status": 1') };
        break;
      }

      case 'deleteUser': {
        const raw = await execSSH(
          `cyberpanel deleteUser --userName ${params.userName} 2>&1`
        );
        data = { output: raw, success: raw.includes('"deleteStatus": 1') };
        break;
      }

      case 'listDNS': {
        const raw = await execSSH(
          `cat /etc/named/conf.d/${params.domain}.conf 2>/dev/null || echo ""`
        );
        data = { zone: raw };
        break;
      }

      case 'serverStats': {
        const raw = await execSSH(
          `echo "CPU:$(top -bn1 | grep 'Cpu(s)' | awk '{print $2}')" && ` +
          `echo "RAM:$(free -m | awk 'NR==2{printf "%s/%s", $3,$2}')" && ` +
          `echo "DISK:$(df -h / | awk 'NR==2{print $3"/"$2}')"`
        );
        data = Object.fromEntries(
          raw.trim().split('\n').filter(Boolean).map(l => l.split(':'))
        );
        break;
      }

      case 'restoreBackup': {
        const { domain, filename, tab = 'full' } = params
        const filepath = `/home/backup/${tab}/${filename}`
        const raw = await execSSH(
          `cyberpanel restoreBackup --domainName ${domain} --fileName ${filename} --backupPath /home/backup/${tab} 2>&1`
        )
        data = { output: raw, success: !raw.toLowerCase().includes('error') && !raw.toLowerCase().includes('traceback') }
        break;
      }

      case 'execCommand': {
        data = { output: await execSSH(params.command) };
        break;
      }

      case 'deploySuspendedPage': {
        const raw = await execSSH(
          `cp /path/to/suspended.html /usr/local/CyberCP/public/suspendedPage.html 2>&1 || echo "copied"`
        );
        data = { output: raw };
        break;
      }

      case 'getScreenshot': {
        const domain = params.domain || 'your-domain.com'
        return NextResponse.redirect(`https://image.thum.io/get/width/600/crop/400/noanimate/https://${domain}`)
      }

      case 'serverDiskUsage': {
        const raw = await execSSH(`df -h / | tail -1`)
        const parts = raw.trim().split(/\s+/)
        // formato: Filesystem Size Used Avail Use% Mounted
        data = {
          total: parts[1] || '0',
          used: parts[2] || '0',
          available: parts[3] || '0',
          percentage: parts[4] || '0%'
        }
        break
      }

      case 'siteDiskUsage': {
        const domain = params.domain || ''
        const raw = await execSSH(`du -sh /home/${domain} 2>/dev/null | cut -f1`)
        data = { usage: raw.trim() || '0' }
        break
      }

      case 'getDKIMStatus': {
        const domain = params.domainName || ''
        const raw = await execSSH(
          `if [ -f /etc/opendkim/keys/${domain}/default.txt ]; then cat /etc/opendkim/keys/${domain}/default.txt; else echo '{"enabled": false, "record": ""}'; fi`
        )
        const hasKey = raw.includes('v=DKIM1')
        data = { 
          output: raw, 
          success: hasKey,
          enabled: hasKey,
          record: hasKey ? raw : ''
        }
        break
      }

      case 'enableDKIM': {
        const domain = params.domainName || ''
        const raw = await execSSH(
          `mkdir -p /etc/opendkim/keys/${domain} && cd /etc/opendkim/keys/${domain} && opendkim-genkey -b 2048 -d ${domain} -s default -S rsa-sha256 2>&1 && chown -R opendkim:opendkim /etc/opendkim/keys/${domain} && chmod 600 /etc/opendkim/keys/${domain}/default.private`
        )
        data = { output: raw, success: true }
        break
      }

      case 'rescueSnappyMail': {
        logAudit('Iniciando resgate do SnappyMail...')
        const loginScript = `<?php
session_start();
$email = $_POST['email'] ?? '';
$password = $_POST['password'] ?? '';
if (!$email || !$password) {
    die('Credenciais necessarias');
}
// Forcar login via POST para o SnappyMail nativo
?>
<form id="f" action="/snappymail/" method="POST">
    <input type="hidden" name="_user" value="<?php echo htmlspecialchars($email); ?>">
    <input type="hidden" name="_pass" value="<?php echo htmlspecialchars($password); ?>">
    <input type="hidden" name="_timezone" value="">
</form>
<script>document.getElementById('f').submit();</script>`

        const cmd = [
          '# 1. Corrigir permissoes da instalacao nativa',
          'chown -R lscpd:lscpd /usr/local/lscp/cyberpanel/snappymail/',
          'chmod -R 755 /usr/local/lscp/cyberpanel/snappymail/',
          'chmod -R 777 /usr/local/lscp/cyberpanel/snappymail/data/ 2>/dev/null || true',
          '',
          '# 2. Criar script de auto-login no public_html do CyberPanel',
          `echo '${loginScript.replace(/'/g, "'\\''")}' > /usr/local/CyberCP/public/snappymail-login.php`,
          'chown lscpd:lscpd /usr/local/CyberCP/public/snappymail-login.php',
          'chmod 644 /usr/local/CyberCP/public/snappymail-login.php',
          '',
          '# 3. Limpar lixo de instalacoes manuais anteriores',
          'rm -rf /usr/local/CyberCP/public/snappymail 2>/dev/null || true',
          'echo "RESGATE CONCLUIDO"'
        ].join('\n')

        const raw = await execSSH(cmd)
        data = { output: raw, success: raw.includes('RESGATE CONCLUIDO') }
        break
      }

      case 'deployMarketingScripts': {
        const sendEmailApiPhp = `<?php
header('Content-Type: application/json');
$token = "vd_api_2024_secure_token";
$headers = getallheaders();
$auth = isset($headers['Authorization']) ? $headers['Authorization'] : '';
if ($auth !== "Bearer " . $token) {
    http_response_code(401);
    echo json_encode(["success" => false, "error" => "Unauthorized"]);
    exit;
}
$data = json_decode(file_get_contents('php://input'), true);
if (!$data || !isset($data['to']) || !isset($data['subject']) || !isset($data['html'])) {
    http_response_code(400);
    echo json_encode(["success" => false, "error" => "Invalid data"]);
    exit;
}
$to = is_array($data['to']) ? implode(',', $data['to']) : $data['to'];
$subject = $data['subject'];
$message = $data['html'];
$from = isset($data['from']) ? $data['from'] : 'marketing@visualdesignmoz.com';
$headers = "MIME-Version: 1.0" . "\\r\\n";
$headers .= "Content-type:text/html;charset=UTF-8" . "\\r\\n";
$headers .= "From: " . $from . "\\r\\n";
$success = mail($to, $subject, $message, $headers);
echo json_encode(["success" => $success, "details" => ["to_count" => count($data['to'])]]);
?>`;

        const snappyLoginPhp = `<?php
// Proxy de login para SnappyMail via POST
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['Email']) && isset($_POST['Password'])) {
    $email = $_POST['Email'];
    $password = $_POST['Password'];
    ?>
    <form id="loginForm" method="POST" action="\${getHestiaUrl()}/snappymail/index.php">
        <input type="hidden" name="Email" value="<?php echo htmlspecialchars($email); ?>">
        <input type="hidden" name="Password" value="<?php echo htmlspecialchars($password); ?>">
        <input type="hidden" name="Action" value="Login">
    </form>
    <script>document.getElementById('loginForm').submit();</script>
    <?php
    exit;
}
echo "Aguardando POST...";
?>`;

        const cmd = `
echo '${sendEmailApiPhp.replace(/'/g, "'\\''")}' > /usr/local/CyberCP/public/send-email-api.php && \\
echo '${snappyLoginPhp.replace(/'/g, "'\\''")}' > /usr/local/CyberCP/public/snappymail-login.php && \\
chmod 644 /usr/local/CyberCP/public/send-email-api.php /usr/local/CyberCP/public/snappymail-login.php && \\
chown lscpd:lscpd /usr/local/CyberCP/public/send-email-api.php /usr/local/CyberCP/public/snappymail-login.php && \\
echo "Scripts deployed successfully"
`;
        data = { output: await execSSH(cmd) };
        break;
      }

      default:
        return NextResponse.json({ success: false, error: `Acção desconhecida: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, data });

  } catch (e: any) {
    console.error('[server-exec] CRITICAL ERROR:', e.message, e.stack);
    return NextResponse.json({ success: false, error: e.message, stack: e.stack }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')
  const domain = searchParams.get('domain') || 'your-domain.com'

  if (action === 'getScreenshot') {
    return NextResponse.redirect(`https://image.thum.io/get/width/600/crop/400/noanimate/https://${domain}`)
  }

  return NextResponse.json({ error: 'Action not allowed via GET' }, { status: 405 })
}
