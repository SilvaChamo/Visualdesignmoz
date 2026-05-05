import { NextResponse } from 'next/server';
import { porkbunAPI } from '@/lib/porkbun-adapter';

export async function POST(req: Request) {
  try {
    const { domain, years } = await req.json();
    
    if (!domain) {
      return NextResponse.json({ status: 'ERROR', message: 'Domínio não fornecido' }, { status: 400 });
    }

    // Registar o domínio. O Porkbun por padrão regista por 1 ano se não formos específicos
    // no adapter atual, mas o adapter só aceita o domain.
    const result = await porkbunAPI.registerDomain(domain);
    
    if (result.status === 'SUCCESS') {
      return NextResponse.json({
        success: true,
        message: `Domínio ${domain} registado com sucesso!`,
        raw: result
      });
    }

    return NextResponse.json({ 
      success: false, 
      error: result.message || 'Erro ao registar o domínio. Verifique o saldo da sua conta Porkbun.',
      raw: result 
    }, { status: 400 });
  } catch (error) {
    console.error('API Domain Register Error:', error);
    return NextResponse.json({ success: false, error: 'Erro interno no servidor' }, { status: 500 });
  }
}
