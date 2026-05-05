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
    
    // Porkbun retorna algo como:
    // { "status": "SUCCESS", "avail": "yes", "domain": "example.com" }
    if (result.status === 'SUCCESS') {
      const isAvailable = result.avail === 'yes';
      
      return NextResponse.json({
        available: isAvailable,
        domain: fullDomain,
        price: 10.37, // Estimação caso a API não devolva o preço directamente
        currency: 'USD',
        raw: result
      });
    }

    return NextResponse.json({ available: false, error: 'Erro ao verificar disponibilidade', raw: result }, { status: 400 });
  } catch (error) {
    console.error('API Domain Check Error:', error);
    return NextResponse.json({ available: false, error: 'Erro interno no servidor' }, { status: 500 });
  }
}
