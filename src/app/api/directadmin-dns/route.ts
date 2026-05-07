import { NextResponse } from 'next/server';
import { daRequest } from '@/lib/directadmin';

type DNSRecord = {
  id: string;
  name: string;
  type: string;
  content: string;
  ttl: string;
  priority?: string;
};

function normalizeDNSRecords(data: Record<string, any> = {}): DNSRecord[] {
  const records: DNSRecord[] = [];

  for (const [key, value] of Object.entries(data)) {
    const match = key.match(/^(a|aaaa|cname|mx|txt|srv|ns)(\d*)$/i);
    if (!match) continue;

    const type = match[1].toUpperCase();
    const raw = String(value || '');
    const priority = type === 'MX' ? raw.trim().split(/\s+/)[0] : undefined;

    records.push({
      id: key,
      name: key,
      type,
      content: raw,
      ttl: String(data[`ttl_${key}`] || data.ttl || '300'),
      priority,
    });
  }

  return records;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const domain = searchParams.get('domain');

    if (!domain) {
      return NextResponse.json({ success: false, error: 'Domain required' }, { status: 400 });
    }

    const res = await daRequest('CMD_API_DNS_CONTROL', 'GET', {
      action: 'list',
      domain,
    });

    if (res.error) {
      return NextResponse.json({ success: false, error: res.details || res.text || 'Erro ao listar DNS' });
    }

    return NextResponse.json({
      success: true,
      records: normalizeDNSRecords(res.data),
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { domainName, name, type, value, ttl = 300, priority } = body;

    if (!domainName || !name || !type || !value) {
      return NextResponse.json({ success: false, error: 'domainName, name, type e value são obrigatórios' }, { status: 400 });
    }

    const recordValue = type === 'MX' && priority ? `${priority} ${value}` : value;
    const res = await daRequest('CMD_API_DNS_CONTROL', 'POST', {
      action: 'add',
      domain: domainName,
      name,
      type,
      value: recordValue,
      ttl: String(ttl),
    });

    if (res.error) {
      return NextResponse.json({ success: false, error: res.details || res.text || 'Erro ao criar registo DNS' });
    }

    return NextResponse.json({ success: true, message: 'Registo DNS criado no DirectAdmin.' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { domainName, id } = body;

    if (!domainName || !id) {
      return NextResponse.json({ success: false, error: 'domainName e id são obrigatórios' }, { status: 400 });
    }

    const res = await daRequest('CMD_API_DNS_CONTROL', 'POST', {
      action: 'delete',
      domain: domainName,
      select0: String(id),
    });

    if (res.error) {
      return NextResponse.json({ success: false, error: res.details || res.text || 'Erro ao remover registo DNS' });
    }

    return NextResponse.json({ success: true, message: 'Registo DNS removido do DirectAdmin.' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
