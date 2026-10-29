import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { resolveCheckoutActor } from '@/lib/checkout-actor';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'A sua sessão expirou. Entre novamente para realizar esta acção.' }, { status: 401 });
  }

  const sessionId = request.nextUrl.searchParams.get('session_id');
  if (!sessionId) {
    return NextResponse.json({ error: 'session_id em falta' }, { status: 400 });
  }

  // O dono do pedido; um administrador a comprar «em nome de» outra conta (entrar como) lê o pedido dessa conta.
  const admin = getSupabaseAdmin();
  const dono = admin ? (await resolveCheckoutActor(admin, user)).buyerUserId : user.id;
  const cliente = admin && dono !== user.id ? admin : supabase;

  const { data, error } = await cliente
    .from('checkout_sessions')
    .select('id, status, items, total_mt, metodo_pagamento, comprovativo_url, rejection_reason')
    .eq('id', sessionId)
    .eq('user_id', dono)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 });
  }

  return NextResponse.json({ success: true, session: data });
}
