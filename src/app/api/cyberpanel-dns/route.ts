import { NextResponse } from 'next/server';
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
      console.error('SSH DNS ERROR:', err.message);
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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const domain = searchParams.get('domain');
    const user = searchParams.get('user') || 'admin';

    if (!domain) return NextResponse.json({ error: 'Domain required' }, { status: 400 });

    const raw = await execSSH(`v-list-dns-records ${user} ${domain} json`);
    try {
      const recordsObj = JSON.parse(raw);
      const records = Object.keys(recordsObj).map(id => ({
        id: id,
        name: recordsObj[id].RECORD,
        type: recordsObj[id].TYPE,
        content: recordsObj[id].VALUE,
        ttl: recordsObj[id].TTL || '14400',
        priority: recordsObj[id].PRIORITY || '0'
      }));
      return NextResponse.json({ success: true, records });
    } catch (e) {
      return NextResponse.json({ success: false, error: 'Failed to list DNS records', raw });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { domainName, name, type, value, ttl = 14400, priority } = body;
    const user = body.user || 'admin';

    if (!domainName || !name || !type || !value) {
      return NextResponse.json({ error: 'Parâmetros em falta' }, { status: 400 });
    }

    // v-add-dns-record user domain record type value [priority] [id]
    const cmd = `v-add-dns-record ${user} ${domainName} ${name} ${type} '${value}' ${priority || ''}`;
    const raw = await execSSH(cmd);

    const success = raw === '' || !raw.toLowerCase().includes('error');
    return NextResponse.json({ success, message: success ? 'Registo criado com sucesso!' : `Erro: ${raw}`, details: raw });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  // Hestia doesn't update directly, we delete and recreate
  try {
    const body = await request.json();
    const { domainName, id, name, type, value, priority } = body;
    const user = body.user || 'admin';

    await execSSH(`v-delete-dns-record ${user} ${domainName} ${id}`);
    const cmd = `v-add-dns-record ${user} ${domainName} ${name} ${type} '${value}' ${priority || ''}`;
    const raw = await execSSH(cmd);

    const success = raw === '' || !raw.toLowerCase().includes('error');
    return NextResponse.json({ success, message: success ? 'Registo atualizado!' : `Erro: ${raw}`, details: raw });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { domainName, id } = body;
    const user = body.user || 'admin';

    if (!domainName || !id) {
      return NextResponse.json({ error: 'domainName e id são obrigatórios' }, { status: 400 });
    }

    const raw = await execSSH(`v-delete-dns-record ${user} ${domainName} ${id}`);
    const success = raw === '' || !raw.toLowerCase().includes('error');

    return NextResponse.json({ 
      success, 
      message: success ? 'Registo removido!' : 'Erro ao remover', 
      details: raw
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

