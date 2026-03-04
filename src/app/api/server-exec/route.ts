import { NextRequest, NextResponse } from 'next/server';
import { Client } from 'ssh2';

async function execSSH(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    let out = '';
    const rawKey = process.env.SSH_PRIVATE_KEY || '';
    const privateKey = rawKey.replace(/\\n/g, '\n');

    conn.on('ready', () => {
      conn.exec(command, (err, stream) => {
        if (err) { conn.end(); return reject(err); }
        stream.on('data', (d: Buffer) => { out += d.toString(); });
        stream.stderr.on('data', (d: Buffer) => { out += d.toString(); });
        stream.on('close', () => { conn.end(); resolve(out); });
      });
    });

    conn.on('error', reject);
    conn.connect({
      host: process.env.CYBERPANEL_IP || '109.199.104.22',
      port: 22,
      username: 'root',
      privateKey,
    });
  });
}

export async function POST(req: NextRequest) {
  try {
    const { action, params = {} } = await req.json();
    let data: any = {};

    switch (action) {

      case 'listWebsites': {
        // Listar todos os sites via MYSQL directo (muito mais rápido que o script python)
        const sitesRaw = await execSSH(`mysql cyberpanel -e "SELECT domain, adminEmail, package, state FROM websiteFunctions_websites;" -B -N 2>/dev/null`);

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
            isActive: siteStatus[s.domain]?.isActive ?? false
          })),
          success: true
        };
        break;
      }

      case 'listPackages': {
        const raw = await execSSH(`mysql cyberpanel -e "SELECT id, packageName, diskSpace, bandwidth, emailAccounts, dataBases FROM packages_package;" -B -N 2>/dev/null`);
        data = raw.split('\n').filter(Boolean).map(line => {
          const [id, packageName, diskSpace, bandwidth, emailAccounts, dataBases] = line.split('\t');
          return {
            id: parseInt(id),
            packageName,
            diskSpace: parseInt(diskSpace),
            bandwidth: parseInt(bandwidth),
            emailAccounts: parseInt(emailAccounts),
            dataBases: parseInt(dataBases)
          };
        });
        break;
      }

      case 'createPackage': {
        const raw = await execSSH(`/usr/local/CyberPanel/bin/python /usr/local/CyberCP/manage.py shell -c "
from packages.models import Package
from loginSystem.models import Administrator
admin = Administrator.objects.first()
pkg = Package.objects.create(
  admin=admin,
  packageName='${params.packageName}',
  diskSpace='${params.diskSpace}',
  bandwidth='${params.bandwidth}',
  emailAccounts='${params.emailAccounts}',
  dataBases='${params.dataBases}'
)
print({'success': True, 'id': pkg.id})
"`);
        // Parse do output do Django shell
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
from packages.models import Package
deleted, _ = Package.objects.filter(packageName='${params.packageName}').delete()
print({'success': deleted > 0, 'deleted': deleted})
"`);
        // Parse do output do Django shell
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
from packages.models import Package
Package.objects.filter(packageName='${params.packageName}').update(
  diskSpace=${params.diskSpace || 1000},
  bandwidth=${params.bandwidth || 1000},
  emailAccounts=${params.emailAccounts || 10},
  dataBases=${params.dataBases || 5}
)
print('ok')
"`);
        data = { success: raw.includes('ok'), output: raw };
        break;
      }

      case 'listUsers': {
        const raw = await execSSH(`mysql cyberpanel -e "SELECT id, userName, email, type, state FROM loginSystem_administrator;" -B -N 2>/dev/null`);
        data = raw.split('\n').filter(Boolean).map(line => {
          const [id, userName, email, type, state] = line.split('\t');
          return { id: parseInt(id), userName, email, type, state };
        });
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
        const raw = await execSSH(
          `cyberpanel createWebsite ` +
          `--domainName ${params.domain} ` +
          `--email ${params.email} ` +
          `--owner ${params.username || 'admin'} ` +
          `--package "${params.packageName || 'Default'}" ` +
          `--php "${params.php || 'PHP 8.2'}" ` +
          `--ssl 1 --dkim 1 2>&1`
        );
        data = { output: raw, success: !raw.toLowerCase().includes('error') && !raw.toLowerCase().includes('traceback') };
        break;
      }

      case 'listEmails': {
        const raw = await execSSH(
          `doveadm user '*@${params.domain}' 2>/dev/null || echo ""`
        );
        data = { emails: raw.trim().split('\n').filter(Boolean) };
        break;
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

      case 'suspendUser': {
        const raw = await execSSH(
          `cyberpanel suspendUser --userName ${params.userName} --state ${params.state} 2>&1`
        );
        data = { output: raw, success: raw.includes('"status": 1') };
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

      default:
        return NextResponse.json({ success: false, error: `Acção desconhecida: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, data });

  } catch (e: any) {
    console.error('[server-exec]', e.message);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
