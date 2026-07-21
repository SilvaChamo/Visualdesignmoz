import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { formatMt } from '@/lib/pricing-catalog';
import { notifyQuoteTeam } from '@/lib/notify-quote-team';

const VALID_METHODS = ['mpesa', 'transferencia'];

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Faça login para continuar.' }, { status: 401 });
    }

    const body = await request.json();
    const metodoPagamento = body?.metodoPagamento;

    if (!VALID_METHODS.includes(metodoPagamento)) {
      return NextResponse.json({ error: 'Método de pagamento inválido.' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    if (!admin) {
      console.error('[cotacoes/pagamento] Supabase service role não configurado.');
      return NextResponse.json({ error: 'Não foi possível actualizar a cotação. Tente novamente mais tarde.' }, { status: 503 });
    }

    const { data: quotation, error: fetchError } = await admin
      .from('quotation_requests')
      .select('id, user_id, empresa, produto, categoria_label, total_mt, sob_consulta')
      .eq('id', id)
      .single();

    if (fetchError || !quotation) {
      return NextResponse.json({ error: 'Cotação não encontrada.' }, { status: 404 });
    }

    if (quotation.user_id !== user.id) {
      const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();
      if (profile?.role !== 'admin') {
        return NextResponse.json({ error: 'Não tem permissão para alterar esta cotação.' }, { status: 403 });
      }
    }

    const { error: updateError } = await admin
      .from('quotation_requests')
      .update({ metodo_pagamento: metodoPagamento, status: 'payment_selected', updated_at: new Date().toISOString() })
      .eq('id', id);

    if (updateError) {
      console.error('[cotacoes/pagamento] update error:', updateError);
      return NextResponse.json({ error: 'Não foi possível actualizar a cotação.' }, { status: 500 });
    }

    const metodoLabel = metodoPagamento === 'mpesa' ? 'M-Pesa' : 'Transferência Bancária';
    await notifyQuoteTeam({
      title: 'Cliente escolheu método de pagamento',
      message: `${quotation.empresa} escolheu ${metodoLabel} para a cotação de "${quotation.produto}" (${quotation.categoria_label}). ${
        quotation.sob_consulta ? 'Valor sob consulta — confirmar com o cliente.' : `Valor: ${formatMt(quotation.total_mt)} MT.`
      }`,
      link: `${process.env.NEXT_PUBLIC_SITE_URL || ''}/dashboard?section=cotacoes`,
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('[cotacoes/pagamento] error:', error);
    const message = error instanceof Error ? error.message : 'Erro interno';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
