import { NextRequest, NextResponse } from 'next/server';
import { Client } from 'ssh2';
import { createClient as createAdminClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createAdminClient(supabaseUrl, supabaseServiceKey);

async function execSSH(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    let out = '';
    const rawKey = process.env.SSH_PRIVATE_KEY || '';
    
    // Validate key format
    if (!rawKey.includes('BEGIN') || !rawKey.includes('END')) {
      return reject(new Error('SSH_PRIVATE_KEY appears to be invalid - missing BEGIN/END markers'));
    }
    
    const privateKey = rawKey.replace(/\\n/g, '\n');
    const host = process.env.CYBERPANEL_IP || '109.199.104.22';

    console.log('[SSH] Connecting to', host, '- Key length:', privateKey.length);
    console.log('[SSH] Key starts with:', privateKey.substring(0, 50));
    console.log('[SSH] Command:', command.substring(0, 150));

    // Set a timeout for the entire operation
    const timeout = setTimeout(() => {
      conn.end();
      reject(new Error('SSH operation timed out after 20 seconds'));
    }, 20000);

    conn.on('ready', () => {
      clearTimeout(timeout);
      console.log('[SSH] Connected! Executing command...');
      conn.exec(command, (err, stream) => {
        if (err) { conn.end(); return reject(err); }
        stream.on('data', (d: Buffer) => { out += d.toString(); });
        stream.stderr.on('data', (d: Buffer) => { out += d.toString(); });
        stream.on('close', () => { 
          console.log('[SSH] Command finished. Output length:', out.length);
          conn.end(); 
          resolve(out); 
        });
      });
    });

    conn.on('error', (err) => {
      clearTimeout(timeout);
      console.error('[SSH] Connection ERROR:', err.message);
      // Melhorar mensagem de erro para o usuário
      let errorMessage = err.message;
      if (err.message.includes('handshake')) {
        errorMessage = 'Falha na conexão SSH: handshake timeout. Verifique se a chave SSH está configurada corretamente no servidor CyberPanel (109.199.104.22) e se a porta 22 está aberta.';
      } else if (err.message.includes('connect')) {
        errorMessage = 'Não foi possível conectar ao servidor. Verifique se o IP 109.199.104.22 está acessível e se o serviço SSH está em execução.';
      } else if (err.message.includes('authentication')) {
        errorMessage = 'Autenticação SSH falhou. Verifique se a chave privada está correta e se o usuário root tem acesso via SSH.';
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
      debug: (msg: string) => {
        if (msg.includes('error') || msg.includes('fail') || msg.includes('timeout')) {
          console.log('[SSH Debug]', msg);
        }
      }
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

    switch (action) {

      case 'listWebsites': {
        // Listar todos os sites via MYSQL directo (muito mais rápido que o script python)
        const sitesRaw = await execSSH(`mysql cyberpanel -e "SELECT domain, adminEmail, package_id, state FROM websiteFunctions_websites;" -B -N 2>/dev/null`);

        const sites = sitesRaw.split('\n').filter(Boolean).map(line => {
          const [domain, adminEmail, pkg, state] = line.split('\t');
          return { domain, adminEmail, package: pkg, state };
        });

        // Para cada site verificar se tem conteúdo real em public_html
        const checkScript = `
for domain in $(mysql cyberpanel -se "SELECT domain FROM websiteFunctions_websites;" 2>/dev/null); do
  # WordPress — ficheiros chave
  wp_config=$([ -f /home/$domain/public_html/wp-config.php ] && echo "1" || echo "0")
  wp_content=$([ -d /home/$domain/public_html/wp-content ] && echo "1" || echo "0")
  wp_includes=$([ -d /home/$domain/public_html/wp-includes ] && echo "1" || echo "0")
  wp_admin=$([ -d /home/$domain/public_html/wp-admin ] && echo "1" || echo "0")
  
  # Next.js — ficheiros chave
  next_config=$([ -f /home/$domain/public_html/next.config.js ] || [ -f /home/$domain/public_html/next.config.ts ] && echo "1" || echo "0")
  next_folder=$([ -d /home/$domain/public_html/.next ] || [ -d /home/$domain/public_html/src ] && echo "1" || echo "0")
  package_json=$([ -f /home/$domain/public_html/package.json ] && echo "1" || echo "0")
  
  # HTML/PHP simples — ficheiros chave
  index_php=$([ -f /home/$domain/public_html/index.php ] && echo "1" || echo "0")
  index_html=$([ -f /home/$domain/public_html/index.html ] && echo "1" || echo "0")
  htaccess=$([ -f /home/$domain/public_html/.htaccess ] && echo "1" || echo "0")
  
  # Calcular score — precisa de pelo menos 3 ficheiros/pastas chave
  wp_score=$((wp_config + wp_content + wp_includes + wp_admin))
  next_score=$((next_config + next_folder + package_json))
  basic_score=$((index_php + index_html + htaccess))
  
  # isActive = WordPress com 3+ ficheiros OU Next.js com 2+ OU básico com 2+
  if [ $wp_score -ge 3 ] || [ $next_score -ge 2 ] || [ $basic_score -ge 2 ]; then
    is_active="1"
  else
    is_active="0"
  fi
  
  echo "$domain|$is_active|$wp_score|$next_score|$basic_score"
done
`;
        const checkRaw = await execSSH(checkScript);

        const siteStatus: Record<string, any> = {};
        checkRaw.split('\n').filter(Boolean).forEach(line => {
          const [domain, isActive, wpScore, nextScore, basicScore] = line.split('|');
          if (domain) {
            siteStatus[domain] = {
              isActive: isActive === '1',
              hasWordPress: parseInt(wpScore) >= 3,
              hasNextJs: parseInt(nextScore) >= 2,
              hasBasicSite: parseInt(basicScore) >= 2,
              siteType: parseInt(wpScore) >= 3 ? 'wordpress' :
                parseInt(nextScore) >= 2 ? 'nextjs' :
                  parseInt(basicScore) >= 2 ? 'html' : 'empty'
            };
          }
        });

        data = {
          sites: sites.map((s: any) => ({
            ...s,
            ...(siteStatus[s.domain] || {}),
            isActive: true // Forçar visibilidade enquanto debugamos conteúdo
          }))
        };
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
            message: 'SnappyMail nativo configurado. Use https://109.199.104.22:8090/snappymail/' 
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
            'echo "✅ Instalação manual removida. SnappyMail nativo em uso: https://109.199.104.22:8090/snappymail/"'
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
          console.log('[listUsers] Raw SSH output preview:', raw.substring(0, 500));
          
          if (!raw || raw.trim() === '') {
            console.warn('[listUsers] Empty response from MySQL');
            data = [];
          } else {
            data = raw.split('\n').filter(Boolean).map(line => {
              const parts = line.split('\t');
              if (parts.length < 2) {
                console.warn('[listUsers] Malformed line:', line);
                return null;
              }
              const [id, userName, email, type, state, firstName, lastName] = parts;
              return { id: parseInt(id) || 0, userName: userName || '', email: email || '', type: type || '', state: state || '', firstName: firstName || '', lastName: lastName || '' };
            }).filter(Boolean);
          }
          console.log('[listUsers] Parsed users:', data.length, JSON.stringify(data).substring(0, 300));
        } catch (err: any) {
          console.error('[listUsers] Error:', err.message);
          throw err;
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
        // Fix parameter mismatch from frontend
        const domainName = params.domainName || params.domain;
        const email = params.email || params.adminEmail;
        const owner = params.owner || params.username || 'admin';
        const pkg = params.package || params.packageName || 'Default';
        // CyberPanel espera apenas a versão numérica (ex: 8.2) não "PHP 8.2"
        const phpRaw = params.php || params.phpVersion || 'PHP 8.2';
        const php = phpRaw.replace(/^PHP\s*/, '').trim();

        console.log('[createWebsite] Params:', { domainName, email, owner, pkg, php });

        const command = `cyberpanel createWebsite ` +
          `--domainName ${domainName} ` +
          `--email ${email} ` +
          `--owner ${owner} ` +
          `--package "${pkg}" ` +
          `--php "${php}" ` +
          `--ssl 1 --dkim 1 2>&1`;

        console.log('[createWebsite] Executing:', command);

        const raw = await execSSH(command);
        
        console.log('[createWebsite] Output:', raw.substring(0, 500));
        
        const hasError = raw.toLowerCase().includes('error') || raw.toLowerCase().includes('traceback') || raw.toLowerCase().includes('failed');
        const hasSuccess = raw.includes('success') || raw.includes('created') || raw.includes('ok') || raw.includes('website has been created');
        
        data = { 
          output: raw, 
          command: command,
          success: hasSuccess || !hasError,
          error: hasError ? raw : undefined
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
        const raw = await execSSH(
          `cyberpanel createEmail --domainName ${params.domain} --userName ${params.userName} --password '${params.password}' 2>&1`
        );
        data = { output: raw, success: raw.includes('"success": 1') };
        break;
      }

      case 'deleteEmail': {
        const raw = await execSSH(
          `cyberpanel deleteEmail --email ${params.email} 2>&1`
        );
        data = { output: raw, success: raw.includes('"success": 1') };
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
        // Usar API pública de screenshot (sem chave necessária)
        data = {
          screenshotUrl: `https://image.thum.io/get/width/600/crop/400/noanimate/https://${domain}`
        }
        break
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

      default:
        return NextResponse.json({ success: false, error: `Acção desconhecida: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, data });

  } catch (e: any) {
    console.error('[server-exec] CRITICAL ERROR:', e.message, e.stack);
    return NextResponse.json({ success: false, error: e.message, stack: e.stack }, { status: 500 });
  }
}
