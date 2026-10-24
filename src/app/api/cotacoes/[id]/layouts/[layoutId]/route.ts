import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { resolveQuotationAccess } from '@/lib/quotation-access';
import { notifyQuoteTeam } from '@/lib/notify-quote-team';

// Só o cliente dono da encomenda aprova/rejeita — a equipa só envia layouts
// (ver POST em /api/cotacoes/[id]/layouts). Rejeitar exige descrever o que
// corrigir, para a equipa produzir a fase seguinte com base nisso.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; layoutId: string }> },
) {
  const { id, layoutId } = await params;
  const access = await resolveQuotationAccess(id);
  if (!access.ok) return access.response;

  if (access.role !== 'client') {
    return NextResponse.json({ error: 'Só o cliente pode aprovar ou rejeitar um layout.' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const status = body?.status;
  const feedback = String(body?.feedback || '').trim();

  if (status !== 'approved' && status !== 'rejected' && status !== 'changes_requested') {
    return NextResponse.json({ error: 'Estado inválido.' }, { status: 400 });
  }
  if ((status === 'rejected' || status === 'changes_requested') && !feedback) {
    return NextResponse.json({ error: 'Descreva o que precisa de ser corrigido.' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 });
  }

  const { data: layout, error: fetchError } = await admin
    .from('quotation_layouts')
    .select('*')
    .eq('id', layoutId)
    .in('quotation_id', access.batchQuotationIds)
    .single();

  if (fetchError || !layout) {
    return NextResponse.json({ error: 'Layout não encontrado.' }, { status: 404 });
  }

  const { data: updated, error: updateError } = await admin
    .from('quotation_layouts')
    .update({
      status,
      client_feedback: status !== 'approved' ? feedback : null,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', layoutId)
    .select()
    .single();

  if (updateError) {
    console.error('[cotacoes/[id]/layouts/[layoutId]] update error:', updateError);
    return NextResponse.json({ error: 'Não foi possível registar a sua decisão.' }, { status: 500 });
  }

  const quotation = access.quotation;

  // Regista no histórico da PRÓPRIA encomenda (quotation_status_history) —
  // mesma tabela/convenção usada por PATCH /api/admin/cotacoes e
  // /cotacao/[id]/cancelar — para a decisão sobre o layout aparecer no
  // QuotationHistoryTimeline junto com o resto, não espalhada noutro sítio.
  // Mantém o `status` da encomenda (não o do layout) para o badge do
  // histórico continuar a resolver um estado reconhecido; o detalhe da fase
  // fica na nota.
  const historyNote =
    status === 'approved'
      ? `Layout Fase ${layout.fase} ("${layout.descricao}") aprovado pelo cliente.`
      : status === 'changes_requested'
        ? `Layout Fase ${layout.fase} ("${layout.descricao}") — cliente pediu correcções: ${feedback}`
        : `Layout Fase ${layout.fase} ("${layout.descricao}") rejeitado pelo cliente: ${feedback}`;

  try {
    await admin.from('quotation_status_history').insert({
      quotation_id: layout.quotation_id,
      status: quotation.status,
      note: historyNote,
      changed_by: 'client',
    });
  } catch (historyError) {
    console.error('[cotacoes/[id]/layouts/[layoutId]] falha ao registar histórico:', historyError);
  }

  const title =
    status === 'approved'
      ? `Layout aprovado — Fase ${layout.fase}`
      : status === 'changes_requested'
        ? `Correcções pedidas — Fase ${layout.fase}`
        : `Layout rejeitado — Fase ${layout.fase}`;
  const message =
    status === 'approved'
      ? `${quotation.empresa} (${quotation.responsavel}) aprovou a Fase ${layout.fase} ("${layout.descricao}") da encomenda "${quotation.produto}". Pode avançar com a produção.`
      : `${quotation.empresa} (${quotation.responsavel}) ${status === 'changes_requested' ? 'pediu correcções' : 'rejeitou'} a Fase ${layout.fase} ("${layout.descricao}") da encomenda "${quotation.produto}".\n\nCorrecções pedidas: ${feedback}`;

  notifyQuoteTeam({
    title,
    message,
    link: `${process.env.NEXT_PUBLIC_SITE_URL || ''}/vhost:2026`,
  }).catch((err) => console.error('[cotacoes/[id]/layouts/[layoutId]] falha ao notificar equipa:', err));

  return NextResponse.json({ success: true, layout: updated });
}
