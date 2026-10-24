import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { formatMt } from '@/lib/pricing-catalog';
import { notifyQuoteTeam } from '@/lib/notify-quote-team';
import { resolveRoleForAuthUser } from '@/lib/server-auth-role';

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

    // Aplica-se a toda a encomenda (todas as linhas do mesmo batch_id) —
    // só às que ainda estão pendentes, para não voltar atrás em itens já
    // aprovados/concluídos/cancelados/rejeitados nesse mesmo lote.
    const { data: siblings } = await admin
      .from('quotation_requests')
      .select('id, produto, categoria_label, total_mt, sob_consulta')
      .eq('batch_id', quotation.batch_id)
      .eq('status', 'pending');
    const batchItems = siblings && siblings.length > 0 ? siblings : [quotation];

    const { error: updateError } = await admin
      .from('quotation_requests')
      .update({ metodo_pagamento: metodoPagamento, status: 'payment_selected', updated_at: new Date().toISOString() })
      .in('id', batchItems.map((i) => i.id));

    if (updateError) {
      console.error('[cotacoes/pagamento] update error:', updateError);
      return NextResponse.json({ error: 'Não foi possível actualizar a cotação.' }, { status: 500 });
    }

    // Não aguardar o envio do email (ver /api/cotacoes) — o cliente já
    // confirmou o método de pagamento, isso não pode falhar por causa de um
    // SMTP lento.
    const metodoLabel = metodoPagamento === 'mpesa' ? 'M-Pesa' : 'Transferência Bancária';
    const totalBatch = batchItems.reduce((sum, i) => sum + (i.sob_consulta ? 0 : i.total_mt), 0);
    const allSobConsulta = batchItems.every((i) => i.sob_consulta);
    notifyQuoteTeam({
      title: 'Cliente escolheu método de pagamento',
      message: `${quotation.empresa} escolheu ${metodoLabel} para a encomenda (${batchItems.map((i) => i.produto).join(', ')}). ${
        allSobConsulta ? 'Valor sob consulta — confirmar com o cliente.' : `Valor: ${formatMt(totalBatch)} MT.`
      }`,
      link: `${process.env.NEXT_PUBLIC_SITE_URL || ''}/vhost:2026`,
    }).catch((err) => console.error('[cotacoes/pagamento] falha ao notificar equipa:', err));

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('[cotacoes/pagamento] error:', error);
    const message = error instanceof Error ? error.message : 'Erro interno';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
