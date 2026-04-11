import { NextResponse } from 'next/server';
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
      port: 22, username: 'root', privateKey,
    });
  });
}

function parseBindZone(zoneContent: string, domain: string) {
  const records: any[] = [];
  let idCounter = 1;
  const lines = zoneContent.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('$')) continue;
    
    // Match: name TTL class type value
    const match = trimmed.match(/^(\S+)\s+(\d+)\s+IN\s+(\w+)\s+(.+)$/i) ||
                  trimmed.match(/^(\S+)\s+IN\s+(\w+)\s+(.+)$/i);
    
    if (match) {
      if (match.length === 5) {
        records.push({
          id: idCounter++,
          name: match[1] === '@' ? domain : match[1].replace(/\.$/, ''),
          ttl: match[2],
          type: match[3].toUpperCase(),
          content: match[4].trim(),
        });
      } else if (match.length === 4) {
        records.push({
          id: idCounter++,
          name: match[1] === '@' ? domain : match[1].replace(/\.$/, ''),
          ttl: '14400',
          type: match[2].toUpperCase(),
          content: match[3].trim(),
        });
      }
    }
  }
  return records;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const domain = searchParams.get('domain');
    if (!domain) return NextResponse.json({ error: 'Domain required' }, { status: 400 });
    
    const cleanDomain = domain.replace(/[^a-zA-Z0-9_.-]/g, '');
    
    const output = await execSSH(
      `mysql cyberpanel -e "SELECT r.id, r.name, r.type, r.content, r.ttl FROM records r ` +
      `INNER JOIN domains d ON r.domain_id = d.id ` +
      `WHERE d.name='${cleanDomain}';" 2>&1`
    );
    
    if (output.toLowerCase().includes('error')) {
      const output2 = await execSSH(
        `mysql cyberpanel -e "SHOW TABLES LIKE '%dns%'; SHOW TABLES LIKE '%record%'; SHOW TABLES LIKE '%domain%';" 2>&1`
      );
      return NextResponse.json({ success: false, error: output, tables: output2 });
    }
    
    const lines = output.trim().split('\n').filter(l => l && !l.startsWith('id'));
    const records = lines.map((line, i) => {
      const parts = line.split('\t');
      return {
        id: (parts[0]?.trim() || String(i)),
        name: parts[1]?.trim() || '',
        type: parts[2]?.trim() || '',
        content: parts[3]?.trim() || '',
        ttl: parts[4]?.trim() || '14400',
      };
    }).filter(r => r.name && r.type);
    
    return NextResponse.json({ success: true, records });
    
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { domainName, name, type, value, ttl = 14400, priority } = body;
    if (!domainName || !name || !type || !value) {
      return NextResponse.json({ error: 'Parâmetros em falta' }, { status: 400 });
    }
    
    const cleanDomain = domainName.replace(/[^a-zA-Z0-9_.-]/g, '');
    // Fix 1: Verificar se o nome já contém o domínio para evitar duplicação
    let cleanName = name.replace(/[^a-zA-Z0-9_.*@-]/g, '');
    if (cleanName.endsWith('.' + cleanDomain) || cleanName.endsWith('.')) {
      // Já tem o domínio completo ou é root
      cleanName = cleanName.replace(/\.$/, ''); // Remover ponto final se existir
    }
    
    const cleanType = type.replace(/[^A-Z]/g, '');
    let cleanValue = type === 'MX' ? `${priority || 10} ${value}` : value;
    const cleanTtl = parseInt(String(ttl)) || 14400;
    
    // Fix 2: Escapar aspas no valor para não quebrar a query SQL
    // DKIM e outros records TXT podem ter aspas que precisam ser escapadas
    const escapedValue = cleanValue.replace(/'/g, "'\\''").replace(/"/g, '\\"');
    
    // Determinar o nome completo do registro
    const fullRecordName = cleanName.includes(cleanDomain) 
      ? cleanName 
      : (cleanName === '@' ? cleanDomain : `${cleanName}.${cleanDomain}`);
    
    // INSERT MySQL directo na tabela records do PowerDNS
    const insertQuery = `
      INSERT INTO records (domain_id, name, type, content, ttl, prio)
      SELECT id, '${fullRecordName}', '${cleanType}', '${escapedValue}', ${cleanTtl}, 0
      FROM domains WHERE name='${cleanDomain}'
    `;
    
    const raw = await execSSH(`mysql cyberpanel -e "${insertQuery}" 2>&1`);
    
    // Fix 3: Melhor detecção de sucesso/erro
    const rawLower = raw.toLowerCase();
    const hasError = rawLower.includes('error') || rawLower.includes('failed') || rawLower.includes('syntax');
    const isDuplicate = rawLower.includes('duplicate') || rawLower.includes('already exists');
    const success = !hasError || isDuplicate;
    
    let message = 'Registo criado com sucesso!';
    if (isDuplicate) message = 'Registo já existe (duplicado).';
    else if (hasError) message = `Erro ao criar registo: ${raw}`;
    
    return NextResponse.json({ 
      success, 
      message, 
      details: raw,
      query: insertQuery.replace(/'[^']*'/g, "'***'"), // Não logar valores sensíveis
      recordName: fullRecordName
    });
    
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { domainName, id, name, type, value, ttl, priority } = body;
    if (!domainName || !id) {
      return NextResponse.json({ error: 'domainName e id são obrigatórios' }, { status: 400 });
    }
    
    const cleanDomain = domainName.replace(/[^a-zA-Z0-9_.-]/g, '');
    const cleanValue = type === 'MX' ? `${priority || 10} ${value}` : value;
    
    // CyberPanel: apagar e recriar
    await execSSH(`cyberpanel deleteDnsRecord --domainName ${cleanDomain} --recordID ${id} 2>&1`);
    const raw = await execSSH(
      `cyberpanel createDnsRecord ` +
      `--domainName ${cleanDomain} ` +
      `--name "${name}" ` +
      `--recordType ${type} ` +
      `--value "${cleanValue}" ` +
      `--ttl ${ttl || 14400} 2>&1`
    );
    
    const success = !raw.toLowerCase().includes('error');
    return NextResponse.json({ success, details: raw });
    
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { domainName, id } = body;
    if (!domainName || !id) {
      return NextResponse.json({ error: 'domainName e id são obrigatórios' }, { status: 400 });
    }
    
    const cleanDomain = domainName.replace(/[^a-zA-Z0-9_.-]/g, '');
    const cleanId = String(id).replace(/[^0-9]/g, '');
    
    // DELETE MySQL directo da tabela records do PowerDNS
    const deleteQuery = `DELETE FROM records WHERE id=${cleanId}`;
    
    const raw = await execSSH(`mysql cyberpanel -e "${deleteQuery}" 2>&1`);
    
    const success = !raw.toLowerCase().includes('error');
    return NextResponse.json({ 
      success, 
      message: success ? 'Registo removido!' : 'Erro ao remover', 
      details: raw,
      query: deleteQuery
    });
    
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

