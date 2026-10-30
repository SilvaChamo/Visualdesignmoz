import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { nomeContaValido, NOME_CONTA_ERRO } from '@/lib/conta-hospedagem';
import { nomeContaOcupado } from '@/lib/conta-hospedagem-servidor';

/** GET /api/checkout/utilizador-disponivel?u=nome — o nome de utilizador da conta de hospedagem está livre? (só com sessão) */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Inicie sessão para continuar.' }, { status: 401 });

  const nome = (request.nextUrl.searchParams.get('u') || '').trim().toLowerCase();
  if (!nomeContaValido(nome)) return NextResponse.json({ valido: false, livre: false, error: NOME_CONTA_ERRO });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 });
  const ocupado = await nomeContaOcupado(admin, nome, { id: user.id, email: user.email });
  return NextResponse.json({ valido: true, livre: !ocupado, error: ocupado ? 'Este nome de utilizador já existe.' : undefined });
}
