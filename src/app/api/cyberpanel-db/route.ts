import { NextRequest, NextResponse } from 'next/server';
import { Client } from 'ssh2';
import { getServerHost } from '@/lib/server-config';

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
            const fullCommand = command.startsWith('v-') ? `${HESTIA_BIN}${command}` : command;
            conn.exec(fullCommand, (err, stream) => {
                if (err) { conn.end(); return reject(err); }
                stream.on('data', (d: Buffer) => { out += d.toString(); });
                stream.stderr.on('data', (d: Buffer) => { out += d.toString(); });
                stream.on('close', () => { conn.end(); resolve(out); });
            });
        });

        conn.on('error', (err) => { 
            console.error('SSH DB ERROR:', err.message);
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
    const type = searchParams.get('type') || 'websites';
    const user = searchParams.get('user') || 'admin';

    try {
        if (type === 'websites') {
            const raw = await execSSH(`v-list-web-domains ${user} json`);
            const sitesObj = JSON.parse(raw);
            const sites = Object.keys(sitesObj).map(domain => ({
                domain,
                package: sitesObj[domain].TEMPLATE || 'default',
                admin: user,
                state: sitesObj[domain].SUSPENDED === 'no' ? 'Active' : 'Inactive',
                ssl: sitesObj[domain].LETSENCRYPT === 'yes' ? 'Enabled' : 'Disabled'
            }));
            return NextResponse.json({ success: true, data: sites });
        }

        if (type === 'users') {
            const raw = await execSSH(`v-list-users json`);
            const usersObj = JSON.parse(raw);
            const users = Object.keys(usersObj).map(username => ({
                userName: username,
                email: usersObj[username].CONTACT,
                type: usersObj[username].ROLE
            }));
            return NextResponse.json({ success: true, data: users });
        }

        if (type === 'packages') {
            const raw = await execSSH(`v-list-user-packages json`);
            const pkgObj = JSON.parse(raw);
            const packages = Object.keys(pkgObj).map(name => ({
                packageName: name,
                diskSpace: pkgObj[name].DISK_QUOTA,
                bandwidth: pkgObj[name].BANDWIDTH,
                emailAccounts: pkgObj[name].MAIL_ACCOUNTS,
                dataBases: pkgObj[name].DATABASES,
                ftpAccounts: pkgObj[name].FTP_ACCOUNTS,
                allowedDomains: pkgObj[name].WEB_DOMAINS
            }));
            return NextResponse.json({ success: true, data: packages });
        }

        return NextResponse.json({ error: 'Unknown type' }, { status: 400 });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, domainName, adminUser } = body;
        const user = adminUser || 'admin';

        switch (action) {
            case 'createWebsite': {
                const raw = await execSSH(`v-add-web-domain ${user} ${domainName}`);
                const ok = raw === '' || !raw.toLowerCase().includes('error');
                return NextResponse.json({ success: ok, message: ok ? 'Website criado no HestiaCP' : 'Erro ao criar website', details: raw });
            }

            case 'deleteWebsite': {
                const raw = await execSSH(`v-delete-web-domain ${user} ${domainName}`);
                const ok = raw === '' || !raw.toLowerCase().includes('error');
                return NextResponse.json({ success: ok, message: ok ? 'Website removido do HestiaCP' : 'Erro ao remover', details: raw });
            }

            case 'addDNSRecord': {
                const { name, recordType, value, priority } = body;
                // v-add-dns-record user domain record type value [priority]
                const cmd = `v-add-dns-record ${user} ${domainName} ${name} ${recordType} ${value} ${priority || ''}`;
                const raw = await execSSH(cmd);
                const ok = raw === '' || !raw.toLowerCase().includes('error');
                return NextResponse.json({ success: ok, message: ok ? 'Registo DNS adicionado' : 'Erro no DNS', details: raw });
            }

            case 'deleteDNSRecord': {
                const { recordID } = body;
                // v-delete-dns-record user domain id
                const raw = await execSSH(`v-delete-dns-record ${user} ${domainName} ${recordID}`);
                const ok = raw === '' || !raw.toLowerCase().includes('error');
                return NextResponse.json({ success: ok, message: ok ? 'Registo DNS removido' : 'Erro ao remover DNS', details: raw });
            }

            case 'issueSSL': {
                const raw = await execSSH(`v-add-letsencrypt-domain ${user} ${domainName}`);
                const ok = raw === '' || !raw.toLowerCase().includes('error');
                return NextResponse.json({ success: ok, message: ok ? 'SSL (Let\'s Encrypt) ativado' : 'Erro ao ativar SSL', details: raw });
            }

            default:
                return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
        }
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

