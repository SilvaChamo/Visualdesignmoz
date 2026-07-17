import { NextResponse } from 'next/server';
import { requireAdminOrReseller } from '@/lib/panel-api-auth';
import { checkAvailability, porkbunAPI } from '@/lib/porkbun-adapter';

export async function POST(req: Request) {
  const auth = await requireAdminOrReseller();
  if ('error' in auth) return auth.error;

  try {
    const { domain, agreeToTerms } = await req.json();

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

    // 1. Verificar disponibilidade real via Porkbun
    const check = await checkAvailability(clean);
    if (!check.available) {
      return NextResponse.json(
        { success: false, error: check.error || 'Este domínio já não se encontra disponível para registo.' },
        { status: 400 }
      );
    }

    // Nota: a Porkbun regista contra saldo pré-pago da conta e usa o contacto
    // WHOIS configurado a nível de conta (não é necessário criar/enviar um
    // contacto por domínio, ao contrário da Spaceship).

    // 2. Registar domínio na Porkbun
    console.log(`[API] Iniciando compra do domínio ${clean} na Porkbun...`);
    const registerResult = await porkbunAPI.registerDomain(clean);

    if (registerResult.success) {
      return NextResponse.json({
        success: true,
        message: `Domínio ${clean} registado com sucesso!`,
        orderId: registerResult.orderId,
        raw: registerResult.raw,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: registerResult.error || 'Erro ao registar o domínio. Verifique o saldo ou os limites do serviço de registo.',
        raw: registerResult.raw,
      },
      { status: 400 }
    );
  } catch (error) {
    console.error('API Domain Register Error:', error);
    return NextResponse.json({ success: false, error: 'Erro interno no servidor' }, { status: 500 });
  }
}
