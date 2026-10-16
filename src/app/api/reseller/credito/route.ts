import { NextResponse } from 'next/server';
import { requireAdminResellerOrManager } from '@/lib/panel-api-auth';
import { resolveResellerPanelContext } from '@/lib/panel-reseller-context';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { notifyQuoteTeam } from '@/lib/notify-quote-team';
import { getAttachmentSignedUrls } from '@/lib/quotation-attachments-bucket';

const VALID_METHODS = ['mpesa', 'transferencia', 'stripe'];

// Saldo + histórico de pedidos de carregamento do revendedor autenticado
// (ou impersonado, se for um admin a ver como o revendedor).
export async function GET() {
  const auth = await requireAdminResellerOrManager();
  if ('error' in auth) return auth.error;

  const ctx = await resolveResellerPanelContext(auth);
  if (!ctx) {
    return NextResponse.json({ error: 'Esta conta não é de revendedor.' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 });
  }

  const [{ data: credito }, { data: pedidos, error: pedidosError }] = await Promise.all([
    supabase.from('reseller_credits').select('saldo_mt').eq('da_username', ctx.mainAccount).maybeSingle(),
    supabase
      .from('reseller_credit_requests')
      .select('*')
      .eq('da_username', ctx.mainAccount)
      .order('created_at', { ascending: false }),
  ]);
  if (pedidosError) {
    console.error('[reseller/credito GET] error:', pedidosError);
    return NextResponse.json({ error: 'Não foi possível carregar os pedidos.' }, { status: 500 });
  }

  // #11: bucket privado — comprovativo_url guardado é só o caminho.
  const signedUrls = await getAttachmentSignedUrls((pedidos || []).map((p) => p.comprovativo_url));
  const pedidosComUrl = (pedidos || []).map((p, idx) => ({ ...p, comprovativo_url: signedUrls[idx] }));

  return NextResponse.json({
    success: true,
    saldoMt: Number(credito?.saldo_mt) || 0,
    pedidos: pedidosComUrl,
  });
}

// Regista um novo pedido de carregamento — fica 'pending' até a equipa
// confirmar que o dinheiro entrou (ver /api/admin/reseller-creditos/[id]).
export async function POST(request: Request) {
  const auth = await requireAdminResellerOrManager();
  if ('error' in auth) return auth.error;

  const ctx = await resolveResellerPanelContext(auth);
  if (!ctx) {
    return NextResponse.json({ error: 'Esta conta não é de revendedor.' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const valorMt = Number(body?.valorMt);
    const metodoPagamento = String(body?.metodoPagamento || '');

    if (!Number.isFinite(valorMt) || valorMt <= 0) {
      return NextResponse.json({ error: 'Valor inválido.' }, { status: 400 });
    }
    if (!VALID_METHODS.includes(metodoPagamento)) {
      return NextResponse.json({ error: 'Método de pagamento inválido.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('reseller_credit_requests')
      .insert({
        da_username: ctx.mainAccount,
        email: ctx.email,
        valor_mt: valorMt,
        metodo_pagamento: metodoPagamento,
        status: 'pending',
      })
      .select()
      .single();
    if (error) throw error;

    const metodoLabel = metodoPagamento === 'mpesa' ? 'M-Pesa' : metodoPagamento === 'transferencia' ? 'Transferência Bancária' : 'Cartão';
    if (metodoPagamento !== 'stripe') {
      // Pagamento por cartão só notifica a equipa depois de o webhook do
      // Stripe confirmar — antes disso ainda pode nem ter sido pago.
      notifyQuoteTeam({
        title: 'Novo pedido de carregamento de saldo',
        message: `${ctx.displayName} (${ctx.mainAccount}) pediu um carregamento de ${valorMt} MT via ${metodoLabel}. Fica a aguardar comprovativo e confirmação da equipa.`,
        link: `${process.env.NEXT_PUBLIC_SITE_URL || ''}/credito/${data.id}`,
      }).catch((err) => console.error('[reseller/credito] falha ao notificar equipa:', err));
    }

    return NextResponse.json({ success: true, pedido: data });
  } catch (error: any) {
    console.error('[reseller/credito POST] error:', error);
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 });
  }
}
