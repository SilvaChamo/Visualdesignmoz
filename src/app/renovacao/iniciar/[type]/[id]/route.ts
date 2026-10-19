import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getPublicSiteOrigin } from '@/lib/panel-origin';

const VALID_TYPES = ['domain', 'hosting', 'email'];

// Ponte mínima entre o link de notificação/email e a página de pagamento
// já existente (/renovacao/[id]): cria o pedido (com o método habitual do
// cliente, ver lookup abaixo) e redirecciona. Mesma lógica de
// POST /api/renewals/pagamento, usada hoje só pelos revendedores.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ type: string; id: string }> }
) {
  const { type, id } = await params;
  // Origem explícita (NEXT_PUBLIC_SITE_URL), não new URL(request.url).origin —
  // atrás do proxy do Hetzner esse origin resolve para "localhost:3003" em
  // vez do domínio público (mesmo problema documentado em auth/confirm/route.ts).
  const origin = getPublicSiteOrigin();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/login?redirect=/renovacao/iniciar/${type}/${id}`);
  }
  if (!VALID_TYPES.includes(type)) {
    return NextResponse.redirect(`${origin}/dashboard?section=notificacoes-servidor`);
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.redirect(`${origin}/dashboard?section=notificacoes-servidor`);
  }

  const table = type === 'domain' ? 'domain_renewals' : 'hosting_renewals';
  const renewalType = type === 'email' ? 'hosting' : type;
  const { data: renewal, error: renewalError } = await admin
    .from(table)
    .select('id, user_id, domain_name, renewal_price')
    .eq('id', id)
    .single();
  if (renewalError || !renewal || renewal.user_id !== user.id) {
    return NextResponse.redirect(`${origin}/dashboard?section=notificacoes-servidor`);
  }

  const { data: existing } = await admin
    .from('renewal_payment_requests')
    .select('id')
    .eq('renewal_type', renewalType)
    .eq('renewal_id', id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) {
    return NextResponse.redirect(`${origin}/checkout?renewalId=${existing.id}`);
  }

  const valorMt = Number(renewal.renewal_price);
  if (!Number.isFinite(valorMt) || valorMt <= 0) {
    return NextResponse.redirect(`${origin}/dashboard?section=notificacoes-servidor`);
  }

  // Método habitual do cliente (mesmo lookup do renewal-check/route.ts): último
  // usado num pedido real. Sem histórico, cai em 'mpesa' — o cliente pode
  // sempre trocar voltando a pedir a renovação com outro método.
  const { data: lastPayment } = await admin
    .from('renewal_payment_requests')
    .select('metodo_pagamento')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const metodoPagamento = lastPayment?.metodo_pagamento || 'mpesa';

  const { data: pedido, error } = await admin
    .from('renewal_payment_requests')
    .insert({
      user_id: user.id,
      renewal_type: renewalType,
      renewal_id: id,
      service_name: renewal.domain_name,
      valor_mt: valorMt,
      metodo_pagamento: metodoPagamento,
      status: 'pending',
    })
    .select()
    .single();
  if (error || !pedido) {
    return NextResponse.redirect(`${origin}/dashboard?section=notificacoes-servidor`);
  }

  return NextResponse.redirect(`${origin}/checkout?renewalId=${pedido.id}`);
}
