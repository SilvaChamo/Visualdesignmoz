import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

/**
 * Rota legada — já não encaminha pedidos a painéis de hospedagem externos.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
    }

    await req.json().catch(() => null);

    return NextResponse.json(
      {
        success: false,
        error:
          'Integração com painel de hospedagem externo foi removida. Use as ferramentas deste painel (Supabase / DNS interno / email).',
      },
      { status: 503 }
    );
  } catch {
    return NextResponse.json({ success: false, error: 'Erro interno' }, { status: 500 });
  }
}
