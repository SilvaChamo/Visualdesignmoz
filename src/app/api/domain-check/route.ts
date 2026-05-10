import { NextResponse } from 'next/server';
import { porkbunAPI } from '@/lib/porkbun-adapter';

export async function POST(req: Request) {
  try {
    const { domain, tld } = await req.json();
    
    if (!domain) {
      return NextResponse.json({ status: 'ERROR', message: 'Domínio não fornecido' }, { status: 400 });
    }

    // Formata o domínio e o TLD corretamente
    let fullDomain = domain.toLowerCase().trim();
    
    // Se o user enviar apenas o nome sem TLD e um TLD no campo tld
    if (!fullDomain.includes('.') && tld) {
      const cleanTld = tld.startsWith('.') ? tld.substring(1) : tld;
      fullDomain = `${fullDomain}.${cleanTld}`;
    }

    const result = await porkbunAPI.checkAvailability(fullDomain);

    if (result.status === 'SUCCESS') {
      const isAvailable = result.avail === 'yes';
      return NextResponse.json({
        available: isAvailable,
        domain: result.domain || fullDomain,
        price: result.priceUsd,
        costPennies: result.costPennies,
        minDuration: result.minDuration,
        currency: 'USD',
        raw: result.raw,
      });
    }

    const errorMessage = result.message || 'Erro ao verificar disponibilidade';
    return NextResponse.json({ available: false, error: errorMessage, raw: result.raw }, { status: 400 });
  } catch (error) {
    console.error('API Domain Check Error:', error);
    return NextResponse.json({ available: false, error: 'Erro interno no servidor' }, { status: 500 });
  }
}
