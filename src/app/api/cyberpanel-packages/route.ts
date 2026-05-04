import { NextRequest, NextResponse } from 'next/server';
import { Client } from 'ssh2';
import { getServerHost } from '@/lib/server-config';

const HESTIA_BIN = '/usr/local/hestia/bin/';

async function execSSH(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const conn = new Client();
        let out = '';
        const rawKey = process.env.SSH_PRIVATE_KEY || '';
        
        // Robust key cleaning: handles escaped newlines and missing headers
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
            console.error('SSH CONNECTION ERROR:', err.message);
            reject(new Error(`Autenticação SSH falhou: ${err.message}`)); 
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

export async function GET() {
    try {
        const raw = await execSSH(`v-list-user-packages json`);
        const pkgObj = JSON.parse(raw);
        const packages = Object.keys(pkgObj).map(name => ({
            name,
            diskSpace: pkgObj[name].DISK_QUOTA,
            bandwidth: pkgObj[name].BANDWIDTH,
            emailAccounts: pkgObj[name].MAIL_ACCOUNTS,
            dataBases: pkgObj[name].DATABASES,
            allowedDomains: pkgObj[name].WEB_DOMAINS
        }));
        return NextResponse.json({ success: true, packages });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { packageName, diskSpace, bandwidth, emailAccounts, dataBases, allowedDomains } = body;

        if (!packageName) {
            return NextResponse.json({ error: 'packageName é obrigatório.' }, { status: 400 });
        }

        // v-add-user-package package [disk] [bandwidth] [emails] [databases] [domains]
        const cmd = `v-add-user-package ${packageName} ${diskSpace || 1000} ${bandwidth || 10000} ${emailAccounts || 10} ${dataBases || 10} ${allowedDomains || 5}`;
        const raw = await execSSH(cmd);
        const ok = raw === '' || !raw.toLowerCase().includes('error');
        
        if (ok) {
            return NextResponse.json({ success: true, message: 'Pacote criado no HestiaCP' });
        } else {
            return NextResponse.json({ error: 'Erro ao criar pacote', details: raw }, { status: 400 });
        }
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const body = await request.json();
        const { packageName } = body;
        if (!packageName) return NextResponse.json({ error: 'packageName é obrigatório.' }, { status: 400 });

        const raw = await execSSH(`v-delete-user-package ${packageName}`);
        const ok = raw === '' || !raw.toLowerCase().includes('error');
        
        if (ok) {
            return NextResponse.json({ success: true, message: 'Pacote removido com sucesso!' });
        } else {
            return NextResponse.json({ error: 'Erro ao remover pacote', details: raw }, { status: 400 });
        }
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

