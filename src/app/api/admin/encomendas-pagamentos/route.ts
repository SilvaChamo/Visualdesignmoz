import { NextResponse } from 'next/server';
import { requireAdminOrReseller } from '@/lib/panel-api-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getAttachmentSignedUrls } from '@/lib/quotation-attachments-bucket';
import { groupIntoBatches } from '@/lib/quotation-batch';
import { encomendaPaymentSplit } from '@/lib/encomenda-checkout';
import { COMPROVATIVO_REJEITADO_PREFIX, pickComprovativo, type ComprovativoFase } from '@/lib/quotation-comprovativo';

type Phase = 'advance' | 'remainder';

const FASE_BY_PHASE: Record<Phase, ComprovativoFase> = { advance: 'adiantamento', remainder: 'remanescente' };

const PAID_ADVANCE_STATUSES = ['approved', 'delivered', 'done'];

type QuotationRow = {
  id: string;
  batch_id: string;
  status: string;
  categoria_id: string;
  categoria_label: string;
  produto: string;
  quantidade: number;
  total_mt: number;
  sob_consulta: boolean;
  metodo_pagamento: string | null;
  remanescente_metodo_pagamento: string | null;
  empresa: string;
  responsavel: string;
  email: string;
  telefone: string;
  endereco: string | null;
  created_at: string;
};

type AttachmentRow = { id: string; quotation_id: string; file_name: string; file_url: string; created_at: string };

/** Anexos do cliente de uma encomenda, do mais antigo para o mais recente. */
async function fetchClientAttachments(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  quotationIds: string[],
): Promise<AttachmentRow[]> {
  if (quotationIds.length === 0) return [];
  const { data, error } = await supabase
    .from('quotation_attachments')
    .select('id, quotation_id, file_name, file_url, created_at')
    .eq('uploaded_by_role', 'client')
    .in('quotation_id', quotationIds)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []) as AttachmentRow[];
}

/**
 * Pagamentos de encomendas VisualDesign (adiantamento 70% e remanescente 30%)
 * para a Contabilidade — mesmo papel dos separadores Domínios/Hospedagem/
 * E-mails para as compras do carrinho: ver o comprovativo e confirmar ou
 * rejeitar. Uma linha por encomenda e por fase em que o cliente já escolheu
 * o método de pagamento.
 */
export async function GET() {
  const auth = await requireAdminOrReseller();
  if ('error' in auth) return auth.error;
  if (auth.user.role !== 'admin') {
    return NextResponse.json({ success: false, error: 'Acção restrita a administradores.' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Supabase Service Role não configurado.' }, { status: 503 });
  }

  try {
    const { data, error } = await supabase
      .from('quotation_requests')
      .select(
        'id, batch_id, status, categoria_id, categoria_label, produto, quantidade, total_mt, sob_consulta, metodo_pagamento, remanescente_metodo_pagamento, empresa, responsavel, email, telefone, endereco, created_at',
      )
      .or('metodo_pagamento.not.is.null,remanescente_metodo_pagamento.not.is.null')
      .order('created_at', { ascending: false });
    if (error) throw error;

    const rows = (data || []) as QuotationRow[];
    const anexosByBatch = new Map<string, AttachmentRow[]>();
    if (rows.length > 0) {
      const anexos = await fetchClientAttachments(supabase, rows.map((r) => r.id));
      const batchByQuotation = new Map(rows.map((r) => [r.id, r.batch_id]));
      for (const anexo of anexos) {
        const batchId = batchByQuotation.get(anexo.quotation_id);
        if (!batchId) continue;
        const list = anexosByBatch.get(batchId) ?? [];
        list.push(anexo);
        anexosByBatch.set(batchId, list);
      }
    }

    const pagamentos: Array<{
      key: string;
      batchId: string;
      anchorId: string;
      phase: Phase;
      status: 'pending' | 'paid';
      metodo: string | null;
      valorMt: number;
      createdAt: string;
      itens: { id: string; status: string; categoria_label: string; produto: string; quantidade: number }[];
      cliente: { nome: string | null; email: string | null; telefone: string | null; morada: string | null; empresa: string | null };
      comprovativoPath: string | null;
    }> = [];

    for (const batch of groupIntoBatches(rows)) {
      const anchor = batch.primaryItem;
      const split = encomendaPaymentSplit(batch.totalMt);
      const anexos = anexosByBatch.get(batch.batchId) ?? [];
      const base = {
        batchId: batch.batchId,
        anchorId: anchor.id,
        createdAt: batch.createdAt,
        itens: batch.items.map((i) => ({
          id: i.id,
          status: i.status,
          categoria_label: i.categoria_label,
          produto: i.produto,
          quantidade: i.quantidade,
        })),
        cliente: {
          nome: anchor.responsavel || null,
          email: anchor.email || null,
          telefone: anchor.telefone || null,
          morada: anchor.endereco || null,
          empresa: anchor.empresa || null,
        },
      };

      const metodoAdiantamento = batch.items.find((i) => i.metodo_pagamento)?.metodo_pagamento ?? null;
      // 'pending' com método gravado = encomenda antiga anterior a este fluxo,
      // ou comprovativo rejeitado antes de o método ser limpo — nada a decidir.
      if (metodoAdiantamento && (batch.status === 'payment_selected' || PAID_ADVANCE_STATUSES.includes(batch.status))) {
        pagamentos.push({
          ...base,
          key: `${batch.batchId}-advance`,
          phase: 'advance',
          status: batch.status === 'payment_selected' ? 'pending' : 'paid',
          metodo: metodoAdiantamento,
          valorMt: split.adiantamentoMt,
          comprovativoPath: pickComprovativo(anexos, 'adiantamento')?.file_url ?? null,
        });
      }

      const metodoRemanescente = batch.items.find((i) => i.remanescente_metodo_pagamento)?.remanescente_metodo_pagamento ?? null;
      if (metodoRemanescente && (batch.status === 'delivered' || batch.status === 'done')) {
        pagamentos.push({
          ...base,
          key: `${batch.batchId}-remainder`,
          phase: 'remainder',
          status: batch.status === 'delivered' ? 'pending' : 'paid',
          metodo: metodoRemanescente,
          valorMt: split.remanescenteMt,
          comprovativoPath: pickComprovativo(anexos, 'remanescente')?.file_url ?? null,
        });
      }
    }

    // #11: bucket privado — gera URLs assinadas temporárias só para mostrar.
    const signedUrls = await getAttachmentSignedUrls(pagamentos.map((p) => p.comprovativoPath));
    const result = pagamentos.map(({ comprovativoPath: _path, ...p }, idx) => ({ ...p, comprovativoUrl: signedUrls[idx] }));

    return NextResponse.json({
      success: true,
      pagamentos: result,
      stats: { pendentes: result.filter((p) => p.status === 'pending').length },
    });
  } catch (error: any) {
    console.error('[admin/encomendas-pagamentos GET] error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * Rejeita o comprovativo de uma fase — não a encomenda (isso é "Rejeitada"
 * no painel das Encomendas, outra coisa). A encomenda volta a "Aguarda
 * pagamento" (adiantamento) ou fica "Concluída" sem método escolhido
 * (remanescente), o método é limpo para o cliente poder escolher/anexar de
 * novo, e o motivo fica na conversa da encomenda para o cliente o ver.
 * Confirmar não passa por aqui: usa o PATCH de /api/admin/cotacoes item a
 * item, que já emite factura, regista o pagamento e avisa o cliente.
 */
export async function PATCH(request: Request) {
  const auth = await requireAdminOrReseller();
  if ('error' in auth) return auth.error;
  if (auth.user.role !== 'admin') {
    return NextResponse.json({ success: false, error: 'Acção restrita a administradores.' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Supabase Service Role não configurado.' }, { status: 503 });
  }

  try {
    const { batchId, phase, motivo } = (await request.json()) || {};
    if (!batchId || (phase !== 'advance' && phase !== 'remainder')) {
      return NextResponse.json({ success: false, error: 'batchId e phase são obrigatórios.' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const update =
      phase === 'advance'
        ? { status: 'pending', metodo_pagamento: null, updated_at: now }
        : { remanescente_metodo_pagamento: null, updated_at: now };
    const { data: updated, error } = await supabase
      .from('quotation_requests')
      .update(update)
      .eq('batch_id', batchId)
      .eq('status', phase === 'advance' ? 'payment_selected' : 'delivered')
      .select('id');
    if (error) throw error;
    if (!updated || updated.length === 0) {
      return NextResponse.json({ success: false, error: 'Este pagamento já foi respondido.' }, { status: 409 });
    }

    // O comprovativo que a equipa viu e rejeitou fica guardado, mas marcado —
    // deixa de contar como "já enviado" e o cliente pode anexar outro.
    try {
      const { data: siblings } = await supabase.from('quotation_requests').select('id').eq('batch_id', batchId);
      const anexos = await fetchClientAttachments(supabase, (siblings || []).map((r) => r.id));
      const rejeitado = pickComprovativo(anexos, FASE_BY_PHASE[phase as Phase]);
      if (rejeitado) {
        await supabase
          .from('quotation_attachments')
          .update({ file_name: `${COMPROVATIVO_REJEITADO_PREFIX}${rejeitado.file_name}` })
          .eq('id', rejeitado.id);
      }
    } catch (attachmentError) {
      console.error('[admin/encomendas-pagamentos PATCH] falha ao marcar comprovativo rejeitado:', attachmentError);
    }

    const motivoTexto = typeof motivo === 'string' && motivo.trim() ? motivo.trim() : null;
    const faseLabel = phase === 'advance' ? 'adiantamento (70%)' : 'remanescente (30%)';

    if (phase === 'advance') {
      const { error: historyError } = await supabase.from('quotation_status_history').insert(
        updated.map((row) => ({
          quotation_id: row.id,
          status: 'pending',
          note: `Comprovativo do ${faseLabel} rejeitado${motivoTexto ? `: ${motivoTexto}` : ''}`,
          changed_by: 'admin',
        })),
      );
      if (historyError) console.error('[admin/encomendas-pagamentos PATCH] falha ao registar histórico:', historyError);
    }

    const { error: messageError } = await supabase.from('quotation_messages').insert({
      quotation_id: updated[0].id,
      sender_role: 'admin',
      sender_user_id: auth.user.id,
      message: `O comprovativo do ${faseLabel} não foi aceite${motivoTexto ? `: ${motivoTexto}` : '.'} Por favor, volte a escolher o método de pagamento e anexe um comprovativo válido.`,
    });
    if (messageError) console.error('[admin/encomendas-pagamentos PATCH] falha ao avisar cliente:', messageError);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[admin/encomendas-pagamentos PATCH] error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
