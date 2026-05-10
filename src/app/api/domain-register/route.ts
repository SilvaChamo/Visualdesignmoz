import { NextResponse } from 'next/server';
import { requireAdminOrReseller } from '@/lib/panel-api-auth';
import { porkbunAPI } from '@/lib/porkbun-adapter';

export async function POST(req: Request) {
  const auth = await requireAdminOrReseller();
  if ('error' in auth) return auth.error;

  try {
    const { domain, agreeToTerms, costPennies } = await req.json();

    if (!domain) {
      return NextResponse.json({ status: 'ERROR', message: 'Domínio não fornecido' }, { status: 400 });
    }

    if (!agreeToTerms) {
      return NextResponse.json(
        { success: false, error: 'Tem de aceitar os termos do registrador para registar.' },
        { status: 400 }
      );
    }

    const clean = String(domain).toLowerCase().trim();
    let finalCost = typeof costPennies === 'number' ? Math.round(costPennies) : 0;
    if (finalCost <= 0) {
      const check = await porkbunAPI.checkAvailability(clean);
      if (check.status !== 'SUCCESS' || check.avail !== 'yes') {
        return NextResponse.json(
          { success: false, error: 'Domínio indisponível ou preço não confirmado. Pesquise de novo.' },
          { status: 400 }
        );
      }
      finalCost = check.costPennies;
    }

    const result = await porkbunAPI.createDomain(clean, { costPennies: finalCost, agreeToTerms: 'yes' });
    
    if (result.status === 'SUCCESS') {
      return NextResponse.json({
        success: true,
        message: `Domínio ${clean} registado com sucesso!`,
        raw: result,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: result.message || 'Erro ao registar o domínio. Verifique saldo, telefone e e-mail verificados na conta do registrador.',
        raw: result,
      },
      { status: 400 }
    );
  } catch (error) {
    console.error('API Domain Register Error:', error);
    return NextResponse.json({ success: false, error: 'Erro interno no servidor' }, { status: 500 });
  }
}
