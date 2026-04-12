import { NextRequest, NextResponse } from 'next/server';
import { Client } from 'ssh2';

// API Wrapper que usa SSH para executar comandos reais no servidor CyberPanel

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

    conn.on('error', (err) => { reject(err); });
    conn.connect({
      host: process.env.CYBERPANEL_IP || '109.199.104.22',
      port: 22,
      username: 'root',
      privateKey,
    });
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  try {
    switch (action) {
      case 'listUsers': {
        const raw = await execSSH(`mysql cyberpanel -e "SELECT id, userName, email, type, state, firstName, lastName FROM loginSystem_administrator;" -B -N 2>/dev/null`);
        const users = raw.split('\n').filter(Boolean).map(line => {
          const [id, userName, email, type, state, firstName, lastName] = line.split('\t');
          return { id: parseInt(id), userName, email, type, state, firstName, lastName };
        });
        return NextResponse.json({ success: true, data: users });
      }

      case 'listWebsites': {
        const raw = await execSSH(`mysql cyberpanel -e "SELECT domain, adminEmail, package_id, state FROM websiteFunctions_websites;" -B -N 2>/dev/null`);
        const sites = raw.split('\n').filter(Boolean).map(line => {
          const [domain, adminEmail, pkg, state] = line.split('\t');
          return { domain, adminEmail, package: pkg, state };
        });
        return NextResponse.json({ success: true, data: sites });
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
    console.error('[cyberpanel-cli] GET Error:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...params } = body;

    switch (action) {
      case 'createUser': {
        const raw = await execSSH(
          `cyberpanel createAdministrator ` +
          `--userName ${params.userName} ` +
          `--password '${params.password}' ` +
          `--email ${params.email} ` +
          `--firstName '${params.firstName || ''}' ` +
          `--lastName '${params.lastName || ''}' ` +
          `--selectedACL ${params.acl || 'user'} ` +
          `--websitesLimit ${params.websitesLimit ?? 0} ` +
          `--securityLevel ${params.securityLevel || 'HIGH'} 2>&1`
        );
        const success = raw.includes('"status": 1') || raw.includes('successfully created') || raw.includes('Success') || raw.includes('created successfully');
        return NextResponse.json({ success, output: raw, error: success ? null : raw });
      }

      case 'deleteUser': {
        const raw = await execSSH(`cyberpanel deleteUser --userName ${params.userName} 2>&1`);
        return NextResponse.json({ success: raw.includes('"deleteStatus": 1'), output: raw });
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
        const success = raw.includes('Success') || raw.includes('successfully modified') || raw.includes('"status": 1');
        return NextResponse.json({ success, output: raw });
      }

      case 'createWebsite': {
        const domainName = params.domainName || params.domain;
        const email = params.email || params.adminEmail;
        const owner = params.owner || params.username || 'admin';
        const pkg = params.package || params.packageName || 'Default';
        const phpRaw = params.php || params.phpVersion || 'PHP 8.2';
        const php = phpRaw.replace(/^PHP\s*/, '').trim();
        const raw = await execSSH(
          `cyberpanel createWebsite --domainName ${domainName} --email ${email} --owner ${owner} --package "${pkg}" --php "${php}" --ssl 1 --dkim 1 2>&1`
        );
        const hasError = raw.toLowerCase().includes('error') || raw.toLowerCase().includes('traceback') || raw.toLowerCase().includes('failed');
        const hasSuccess = raw.includes('success') || raw.includes('created') || raw.includes('ok');
        return NextResponse.json({ success: hasSuccess || !hasError, output: raw });
      }

      case 'deleteWebsite': {
        const raw = await execSSH(`cyberpanel deleteWebsite --domainName ${params.domain} 2>&1`);
        return NextResponse.json({ success: raw.includes('"success": 1') || raw.includes('Website successfully deleted'), output: raw });
      }

      case 'createEmail': {
        const raw = await execSSH(`cyberpanel createEmail --domainName ${params.domain} --userName ${params.userName} --password '${params.password}' 2>&1`);
        return NextResponse.json({ success: raw.includes('"success": 1'), output: raw });
      }

      case 'deleteEmail': {
        const raw = await execSSH(`cyberpanel deleteEmail --email ${params.email} 2>&1`);
        return NextResponse.json({ success: raw.includes('"success": 1'), output: raw });
      }

      case 'issueSSL': {
        const raw = await execSSH(`cyberpanel issueSSL --domainName ${params.domain} 2>&1`);
        return NextResponse.json({ success: raw.includes('"status": 1') || raw.includes('Success'), output: raw });
      }

      default:
        return NextResponse.json({ success: false, error: 'Action not recognized' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('[cyberpanel-cli] POST Error:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
