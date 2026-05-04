import { NextRequest, NextResponse } from 'next/server';
import { Client } from 'ssh2';
import { getServerHost } from '@/lib/server-config';

// HestiaCP Path (usually in /usr/local/hestia/bin/)
const HESTIA_BIN = '/usr/local/hestia/bin/';

async function execSSH(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    let out = '';
    const rawKey = process.env.SSH_PRIVATE_KEY || '';
    const privateKey = rawKey.includes('-----BEGIN') 
      ? rawKey.replace(/\\n/g, '\n') 
      : rawKey;

    conn.on('ready', () => {
      // Use absolute path for Hestia commands to be safe
      const fullCommand = command.startsWith('v-') ? `${HESTIA_BIN}${command}` : command;
      
      conn.exec(fullCommand, (err, stream) => {
        if (err) { conn.end(); return reject(err); }
        stream.on('data', (d: Buffer) => { out += d.toString(); });
        stream.stderr.on('data', (d: Buffer) => { out += d.toString(); });
        stream.on('close', () => { conn.end(); resolve(out); });
      });
    });

    conn.on('error', (err) => { 
      console.error('SSH ERROR:', err.message);
      reject(err); 
    });

    conn.connect({
      host: process.env.CYBERPANEL_IP || getServerHost(),
      port: parseInt(process.env.CYBERPANEL_SSH_PORT || '22'),
      username: process.env.CYBERPANEL_SSH_USER || 'root',
      privateKey,
      password: process.env.CYBERPANEL_PASS, // Fallback to password
    });
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  try {
    switch (action) {
      case 'listUsers': {
        const raw = await execSSH(`v-list-users json`);
        try {
          const usersObj = JSON.parse(raw);
          const users = Object.keys(usersObj).map(username => ({
            id: username,
            userName: username,
            email: usersObj[username].CONTACT,
            type: usersObj[username].ROLE,
            state: usersObj[username].SUSPENDED === 'no' ? 'active' : 'suspended',
            firstName: username,
            lastName: ''
          }));
          return NextResponse.json({ success: true, data: users });
        } catch (e) {
          return NextResponse.json({ success: false, error: 'Failed to parse Hestia users', raw });
        }
      }

      case 'listWebsites': {
        const user = searchParams.get('user') || 'admin';
        const raw = await execSSH(`v-list-web-domains ${user} json`);
        try {
          const sitesObj = JSON.parse(raw);
          const sites = Object.keys(sitesObj).map(domain => ({
            domain,
            adminEmail: '', // Not directly in this JSON
            package: sitesObj[domain].TEMPLATE,
            state: sitesObj[domain].SUSPENDED === 'no' ? 'active' : 'suspended'
          }));
          return NextResponse.json({ success: true, data: sites });
        } catch (e) {
          return NextResponse.json({ success: false, error: 'Failed to parse Hestia domains', raw });
        }
      }

      case 'serverStatus': {
        const raw = await execSSH(
          `echo "CPU:$(top -bn1 | grep 'Cpu(s)' | awk '{print $2}')" && ` +
          `echo "RAM:$(free -m | awk 'NR==2{printf "%s/%s", $3,$2}')" && ` +
          `echo "DISK:$(df -h / | awk 'NR==2{print $3"/"$2}')"`
        );
        const data = Object.fromEntries(
          raw.trim().split('\n').filter(Boolean).map(l => l.split(':'))
        );
        return NextResponse.json({ success: true, data });
      }

      default:
        return NextResponse.json({ success: false, error: 'Action not recognized' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('[hestia-cli] GET Error:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...params } = body;

    switch (action) {
      case 'createUser': {
        // v-add-user user password email [package] [name] [surname]
        const cmd = `v-add-user ${params.userName} '${params.password}' ${params.email} ${params.package || 'default'} '${params.firstName || ''}' '${params.lastName || ''}'`;
        const raw = await execSSH(cmd);
        const success = raw === '' || !raw.toLowerCase().includes('error');
        return NextResponse.json({ success, output: raw });
      }

      case 'deleteUser': {
        const raw = await execSSH(`v-delete-user ${params.userName}`);
        return NextResponse.json({ success: raw === '' || !raw.toLowerCase().includes('error'), output: raw });
      }

      case 'createWebsite': {
        const domain = params.domainName || params.domain;
        const user = params.owner || params.username || 'admin';
        // v-add-web-domain user domain [ip] [restart]
        const raw = await execSSH(`v-add-web-domain ${user} ${domain}`);
        const success = raw === '' || !raw.toLowerCase().includes('error');
        
        // Optional: add SSL immediately if requested
        if (success && params.ssl) {
            await execSSH(`v-add-letsencrypt-domain ${user} ${domain}`);
        }

        return NextResponse.json({ success, output: raw });
      }

      case 'deleteWebsite': {
        const domain = params.domain;
        const user = params.user || 'admin';
        const raw = await execSSH(`v-delete-web-domain ${user} ${domain}`);
        return NextResponse.json({ success: raw === '' || !raw.toLowerCase().includes('error'), output: raw });
      }

      case 'createEmail': {
        const domain = params.domain;
        const account = params.userName;
        const password = params.password;
        const user = params.user || 'admin';
        // v-add-mail-account user domain account password
        const raw = await execSSH(`v-add-mail-account ${user} ${domain} ${account} '${password}'`);
        return NextResponse.json({ success: raw === '' || !raw.toLowerCase().includes('error'), output: raw });
      }

      case 'deleteEmail': {
        const [account, domain] = params.email.split('@');
        const user = params.user || 'admin';
        const raw = await execSSH(`v-delete-mail-account ${user} ${domain} ${account}`);
        return NextResponse.json({ success: raw === '' || !raw.toLowerCase().includes('error'), output: raw });
      }

      case 'issueSSL': {
        const domain = params.domain;
        const user = params.user || 'admin';
        const raw = await execSSH(`v-add-letsencrypt-domain ${user} ${domain}`);
        return NextResponse.json({ success: raw === '' || !raw.toLowerCase().includes('error'), output: raw });
      }

      default:
        return NextResponse.json({ success: false, error: 'Action not recognized' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('[hestia-cli] POST Error:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

