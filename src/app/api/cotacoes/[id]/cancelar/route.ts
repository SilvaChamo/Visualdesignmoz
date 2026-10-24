import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { notifyQuoteTeam } from '@/lib/notify-quote-team';

// Cancelamento de uma encomenda pelo próprio cliente. Só permitido enquanto
// ainda não houve reacção da equipa (pending) ou o cliente só escolheu o
// método de pagamento (payment_selected) — depois de aprovada/rejeitada, o
// cancelamento passa a ser uma decisão da equipa via /dashboard.
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

    const admin = getSupabaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 });
    }

    const { data: quotation, error: fetchError } = await admin
      .from('quotation_requests')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !quotation) {
      return NextResponse.json({ error: 'Encomenda não encontrada.' }, { status: 404 });
    }

    if (quotation.user_id !== user.id) {
      return NextResponse.json({ error: 'Não tem permissão para cancelar esta encomenda.' }, { status: 403 });
    }

    if (!['pending', 'payment_selected'].includes(quotation.status)) {
      return NextResponse.json(
        { error: 'Esta encomenda já não pode ser cancelada pelo cliente. Contacte a equipa.' },
        { status: 409 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const motivo = typeof body?.motivo === 'string' ? body.motivo.trim().slice(0, 500) : '';

    // Cancela a encomenda toda (todas as linhas do mesmo batch_id ainda
    // canceláveis), não só a linha que o cliente estava a ver.
    const { data: siblings } = await admin
      .from('quotation_requests')
      .select('id')
      .eq('batch_id', quotation.batch_id)
      .in('status', ['pending', 'payment_selected']);
    const batchIds = siblings && siblings.length > 0 ? siblings.map((s) => s.id) : [id];

    const { data: updatedQuotations, error: updateError } = await admin
      .from('quotation_requests')
      .update({
        status: 'cancelled',
        cancellation_reason: motivo || null,
        updated_at: new Date().toISOString(),
      })
      .in('id', batchIds)
      .select();

    if (updateError) {
      console.error('[cotacoes/[id]/cancelar] update error:', updateError);
      return NextResponse.json({ error: 'Não foi possível cancelar a encomenda.' }, { status: 500 });
    }

    const { error: historyError } = await admin.from('quotation_status_history').insert({
      quotation_id: id,
      status: 'cancelled',
      note: motivo
        ? `${motivo}${batchIds.length > 1 ? ` (${batchIds.length} itens)` : ''}`
        : batchIds.length > 1
          ? `Encomenda cancelada (${batchIds.length} itens)`
          : null,
      changed_by: 'client',
    });
    if (historyError) {
      console.error('[cotacoes/[id]/cancelar] history insert error:', historyError);
    }

    notifyQuoteTeam({
      title: 'Cliente cancelou uma encomenda',
      message: `${quotation.empresa} cancelou a encomenda "${quotation.produto}" (${quotation.categoria_label})${batchIds.length > 1 ? ` e mais ${batchIds.length - 1} item(ns)` : ''}. Motivo: ${motivo || 'não indicado'}.`,
      link: `${process.env.NEXT_PUBLIC_SITE_URL || ''}/vhost:2026`,
    }).catch((err) => console.error('[cotacoes/[id]/cancelar] falha ao notificar equipa:', err));

    return NextResponse.json({ success: true, quotation: updatedQuotations?.[0] });
  } catch (error: unknown) {
    console.error('[cotacoes/[id]/cancelar] error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
