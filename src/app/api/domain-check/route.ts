import { NextResponse } from 'next/server';
import { checkAvailability } from '@/lib/spaceship-adapter';

export async function POST(req: Request) {
  try {
    const { domain, tld } = await req.json();
    console.log(`[API] Verificando domínio: ${domain} com TLD: ${tld} (via Spaceship)`);
    
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

    const result = await checkAvailability(fullDomain);
    console.log(`[API] Resultado do adaptador para ${fullDomain}:`, result);

    if ((result as any).error) {
      return NextResponse.json({ available: false, error: (result as any).error }, { status: 400 });
    }

    return NextResponse.json({
      available: result.available,
      domain: fullDomain,
      price: result.price,
      currency: result.currency || 'USD',
    });
  } catch (error) {
    console.error('API Domain Check Error:', error);
    return NextResponse.json({ available: false, error: 'Erro interno no servidor' }, { status: 500 });
  }
}
