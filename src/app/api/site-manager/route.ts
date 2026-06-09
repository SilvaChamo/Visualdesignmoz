import { NextRequest, NextResponse } from 'next/server'
import { Client } from 'ssh2'
import { getServerHost } from '@/lib/server-config'

const HESTIA_BIN = '/usr/local/hestia/bin/'

async function execSSH(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const conn = new Client();
        let out = '';
        const rawKey = process.env.SSH_PRIVATE_KEY || '';
        const privateKey = rawKey.includes('-----BEGIN') 
            ? rawKey.replace(/\\n/g, '\n') 
            : rawKey;

        conn.on('ready', () => {
            const fullCommand = command.startsWith('v-') ? `${HESTIA_BIN}${command}` : command;
            conn.exec(fullCommand, (err, stream) => {
                if (err) { conn.end(); return reject(err); }
                stream.on('data', (d: Buffer) => { out += d.toString(); });
                stream.stderr.on('data', (d: Buffer) => { out += d.toString(); });
                stream.on('close', () => { conn.end(); resolve(out); });
            });
        });

        conn.on('error', (err) => { 
            console.error('SSH SITE-MANAGER ERROR:', err.message);
            reject(err); 
        });

        conn.connect({
            host: process.env.SERVER_IP || getServerHost(),
            port: parseInt(process.env.SSH_PORT || process.env.SERVER_SSH_PORT || '2234', 10),
            username: process.env.SSH_USER || 'root',
            privateKey,
            password: process.env.SSH_PASS,
        });
    });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'list'
    const domain = searchParams.get('domain')
    const user = searchParams.get('user') || 'admin'

    switch (action) {
      case 'list':
        return await listSites(user)
      case 'details':
        if (!domain) return NextResponse.json({ error: 'Domain required' }, { status: 400 });
        return await getSiteDetails(user, domain)
      default:
        return NextResponse.json({ success: true, message: 'HestiaCP Site Manager Ready' })
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

async function listSites(user: string) {
  try {
    const raw = await execSSH(`v-list-web-domains ${user} json`);
    const sitesObj = JSON.parse(raw);
    const sites = Object.keys(sitesObj).map(domain => ({
      domain,
      status: sitesObj[domain].SUSPENDED === 'no' ? 'active' : 'suspended',
      owner: user,
      php: sitesObj[domain].PHP_VERSION || '8.2',
      ssl: sitesObj[domain].LETSENCRYPT === 'yes'
    }));
    
    return NextResponse.json({ success: true, sites })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message, sites: [] })
  }
}

async function getSiteDetails(user: string, domain: string) {
  try {
    const raw = await execSSH(`v-list-web-domain ${user} ${domain} json`);
    const data = JSON.parse(raw)[domain];
    
    const details = {
      domain: domain,
      status: data.SUSPENDED === 'no' ? 'active' : 'suspended',
      owner: user,
      package: data.TEMPLATE || 'default',
      email: data.STATS_USER || `admin@${domain}`,
      diskUsage: 'N/A', 
      bandwidthUsage: data.U_BANDWIDTH || '0',
      sslEnabled: data.LETSENCRYPT === 'yes',
      phpVersion: data.PHP_VERSION || '8.2',
      serverIP: getServerHost(),
      documentRoot: `/home/${user}/web/${domain}/public_html`,
      features: {
        fileManager: true,
        databaseManager: true,
        emailManager: true,
        sslManager: true,
        backupManager: true
      }
    }

    return NextResponse.json({ success: true, site: details })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message })
  }
}

export async function POST(request: NextRequest) {
  return NextResponse.json({ error: 'Not implemented yet' }, { status: 501 })
}

