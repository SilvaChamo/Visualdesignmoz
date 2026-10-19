import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { formatMt } from '@/lib/pricing-catalog';
import { notifyQuoteTeam } from '@/lib/notify-quote-team';
import { resolveRoleForAuthUser } from '@/lib/server-auth-role';
import { encomendaPaymentSplit } from '@/lib/encomenda-checkout';

const VALID_METHODS = ['mpesa', 'transferencia'];

// Pagamento do remanescente (30% restante, pago na entrega/levantamento) —
// só depois de a equipa marcar os itens como 'delivered' ("Concluída", pronta
// para levantamento). Não muda o estado (fica 'delivered' até a equipa
// confirmar o recebimento e marcar 'done', "Entregue") — só regista o método
// escolhido, mesmo padrão de /pagamento para o adiantamento.
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
      console.error('[cotacoes/pagamento-remanescente] Supabase service role não configurado.');
      return NextResponse.json({ error: 'Não foi possível actualizar a cotação. Tente novamente mais tarde.' }, { status: 503 });
    }

    const { data: quotation, error: fetchError } = await admin
      .from('quotation_requests')
      .select('id, batch_id, user_id, empresa, produto, categoria_label, total_mt, sob_consulta')
      .eq('id', id)
      .single();

    if (fetchError || !quotation) {
      return NextResponse.json({ error: 'Cotação não encontrada.' }, { status: 404 });
    }

    if (quotation.user_id !== user.id) {
      const role = await resolveRoleForAuthUser(supabase, user);
      if (role !== 'admin') {
        return NextResponse.json({ error: 'Não tem permissão para alterar esta cotação.' }, { status: 403 });
      }
    }

    const { data: siblings } = await admin
      .from('quotation_requests')
      .select('id, produto, categoria_label, total_mt, sob_consulta')
      .eq('batch_id', quotation.batch_id)
      .eq('status', 'delivered');

    if (!siblings || siblings.length === 0) {
      return NextResponse.json(
        { error: 'Esta encomenda ainda não está pronta para levantamento.' },
        { status: 409 },
      );
    }

    const { error: updateError } = await admin
      .from('quotation_requests')
      .update({ remanescente_metodo_pagamento: metodoPagamento, updated_at: new Date().toISOString() })
      .in('id', siblings.map((i) => i.id));

    if (updateError) {
      console.error('[cotacoes/pagamento-remanescente] update error:', updateError);
      return NextResponse.json({ error: 'Não foi possível actualizar a cotação.' }, { status: 500 });
    }

    const metodoLabel = metodoPagamento === 'mpesa' ? 'M-Pesa' : 'Transferência Bancária';
    const totalBatch = siblings.reduce((sum, i) => sum + (i.sob_consulta ? 0 : i.total_mt), 0);
    const remanescente = encomendaPaymentSplit(totalBatch).remanescenteMt;
    notifyQuoteTeam({
      title: 'Cliente escolheu método para o remanescente',
      message: `${quotation.empresa} escolheu ${metodoLabel} para pagar o remanescente da encomenda (${siblings.map((i) => i.produto).join(', ')}). Valor: ${formatMt(remanescente)} MT.`,
      link: `${process.env.NEXT_PUBLIC_SITE_URL || ''}/dashboard?section=cotacoes`,
    }).catch((err) => console.error('[cotacoes/pagamento-remanescente] falha ao notificar equipa:', err));

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('[cotacoes/pagamento-remanescente] error:', error);
    const message = error instanceof Error ? error.message : 'Erro interno';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
