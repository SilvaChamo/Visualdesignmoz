import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdminOrReseller } from '@/lib/panel-api-auth';
import { notifyQuoteClientStatusChange, notifyQuoteClientPriceDefined } from '@/lib/notify-quote-client';
import { computeBatchStatus } from '@/lib/quotation-status-labels';
import { batchNumero } from '@/lib/quotation-batch';
import { computeNumeroMap, letterForCategoria } from '@/lib/quotation-numero';
import { QUOTATION_ATTACHMENTS_BUCKET, extractStoragePath } from '@/lib/quotation-attachments-bucket';
import { QUOTATION_LAYOUTS_BUCKET } from '@/lib/quotation-layouts-bucket';
import { computeUnreadByBatch } from '@/lib/quotation-unread';
import { encomendaPaymentSplit } from '@/lib/encomenda-checkout';

const IVA_PERCENT = 16;

// Cópia fixa para a Contabilidade (abas "Cotações"/"Facturas") — gravada uma
// única vez quando a encomenda INTEIRA (todas as linhas do batch) atinge
// 'done'. Ao contrário dos dados de origem, este registo nunca muda depois,
// mesmo que a encomenda seja editada ou uma despesa seja lançada mais tarde.
// Letra da marca do lote — mesma regra do "número prático" (ordenar por id,
// letra do primeiro item), para o número prático e a factura real nunca
// discordarem sobre a categoria de uma encomenda.
function primaryBrandLetter(siblings: { id: string; categoria_id: string }[]): string {
  const sorted = [...siblings].sort((a, b) => a.id.localeCompare(b.id));
  return sorted[0] ? letterForCategoria(sorted[0].categoria_id) : 'O';
}

async function saveAccountingSnapshot(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  batchId: string,
  siblings: { id: string; status: string; categoria_label: string; categoria_id: string; produto: string; total_mt: number; sob_consulta: boolean; empresa: string; nif: string | null }[],
) {
  try {
    const sorted = [...siblings].sort((a, b) => a.id.localeCompare(b.id));
    const primary = sorted[0];
    if (!primary) return;

    const receitaMt = siblings.reduce((sum, r) => sum + (r.sob_consulta ? 0 : Number(r.total_mt) || 0), 0);
    // Sempre "N serviços" — nunca a descrição completa do item, mesmo quando
    // só há um, para ficar consistente com as restantes linhas na Contabilidade.
    const resumo = `${siblings.length} serviço${siblings.length === 1 ? '' : 's'}`;

    const { data: invoices } = await supabase
      .from('quotation_invoices')
      .select('phase, invoice_number')
      .eq('batch_id', batchId);

    const { data: expenses } = await supabase
      .from('quotation_batch_expenses')
      .select('valor_mt, quantidade')
      .eq('batch_id', batchId);
    const custosProducaoMt = (expenses || []).reduce((sum: number, e: any) => sum + (Number(e.valor_mt) || 0) * (Number(e.quantidade) || 1), 0);

    // Mesmo número prático mostrado em Recebidas/Entregues/no documento —
    // batchNumero() aqui é só rede de segurança (nunca deve ser preciso).
    const { data: allRequests } = await supabase
      .from('quotation_requests')
      .select('id, batch_id, categoria_id, created_at')
      .order('created_at', { ascending: true });
    const numero = computeNumeroMap(allRequests || []).get(batchId) ?? batchNumero(batchId);

    // IVA sai depois de retirar os custos de produção, nunca sobre a receita
    // bruta — e é sempre a taxa fixa de 16%, nunca editável.
    const ivaMt = ((receitaMt - custosProducaoMt) * IVA_PERCENT) / 100;
    const lucroMt = receitaMt - custosProducaoMt - ivaMt;

    await supabase
      .from('accounting_batch_snapshots')
      .upsert(
        {
          batch_id: batchId,
          primary_item_id: primary.id,
          numero,
          advance_invoice_number: (invoices || []).find((i: any) => i.phase === 'advance')?.invoice_number ?? null,
          remainder_invoice_number: (invoices || []).find((i: any) => i.phase === 'remainder')?.invoice_number ?? null,
          empresa: primary.empresa,
          nif: primary.nif,
          resumo,
          receita_mt: receitaMt,
          custos_producao_mt: custosProducaoMt,
          iva_percent: IVA_PERCENT,
          iva_mt: ivaMt,
          lucro_mt: lucroMt,
          done_at: new Date().toISOString(),
        },
        { onConflict: 'batch_id', ignoreDuplicates: true },
      );
  } catch (snapshotError) {
    console.error('[admin/cotacoes] falha ao gravar cópia de contabilidade:', snapshotError);
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function getSupabaseAdmin() {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase Service Role não configurado.');
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

const VALID_STATUS = ['pending', 'payment_selected', 'approved', 'delivered', 'rejected', 'done', 'cancelled'];

// Conta, por encomenda (batch), quantas mensagens do cliente ficaram "por
// responder" — as que vieram depois da última mensagem da equipa (ou todas,
// Lista todos os pedidos de cotação recebidos, para a equipa acompanhar no dashboard.
export async function GET(request: Request) {
  const auth = await requireAdminOrReseller();
  if ('error' in auth) return auth.error;
  if (auth.user.role !== 'admin') {
    return NextResponse.json({ success: false, error: 'Acção restrita a administradores.' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const supabase = getSupabaseAdmin();

    let query = supabase
      .from('quotation_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (status && VALID_STATUS.includes(status)) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;

    const unreadByBatch = await computeUnreadByBatch(supabase, data || [], 'client');

    return NextResponse.json({ success: true, cotacoes: data || [], unreadByBatch });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Actualiza o estado de um pedido de cotação (ex.: marcar como concluída ou cancelada).
export async function PATCH(request: Request) {
  const auth = await requireAdminOrReseller();
  if ('error' in auth) return auth.error;
  if (auth.user.role !== 'admin') {
    return NextResponse.json({ success: false, error: 'Acção restrita a administradores.' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { id, status, rejectionReason, batchId, dataLimiteEntrega, precoUnitarioMt } = body || {};

    // Alterar a data limite de entrega prevista — aplica-se a todos os itens da mesma
    // encomenda (batch), já que foram todos submetidos com o mesmo prazo original.
    if (batchId && dataLimiteEntrega) {
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from('quotation_requests')
        .update({ data_limite_entrega: dataLimiteEntrega, updated_at: new Date().toISOString() })
        .eq('batch_id', batchId)
        .select();

      if (error) throw error;
      return NextResponse.json({ success: true, cotacoes: data });
    }

    // Define/edita o valor unitário de um item "Sob Consulta" — tanto para o
    // fechar pela primeira vez como para o reeditar mais tarde, se for
    // preciso corrigir. Restrito a itens que nasceram Sob Consulta
    // (sob_consulta_original) — a equipa não tem o direito de alterar o preço
    // de um item de catálogo com valor fixo, só de negociar e registar o
    // valor dos pedidos personalizados/sem preço de tabela. Assim que a linha
    // muda, o painel do cliente já mostra o preço (lê sempre ao vivo de
    // quotation_requests); o email de "valor definido" só sai da primeira vez
    // (transição sob_consulta -> com preço), não em reedições seguintes.
    if (id && precoUnitarioMt !== undefined && status === undefined) {
      const valor = Number(precoUnitarioMt);
      if (!Number.isFinite(valor) || valor <= 0) {
        return NextResponse.json({ success: false, error: 'Valor inválido.' }, { status: 400 });
      }

      const supabase = getSupabaseAdmin();
      const { data: existing, error: existingError } = await supabase
        .from('quotation_requests')
        .select('quantidade, sob_consulta, sob_consulta_original, produto, empresa, responsavel, email')
        .eq('id', id)
        .single();

      if (existingError || !existing) {
        return NextResponse.json({ success: false, error: 'Cotação não encontrada.' }, { status: 404 });
      }
      if (!existing.sob_consulta_original) {
        return NextResponse.json({ success: false, error: 'Este item tem valor de catálogo — só itens "Sob Consulta" podem ter o preço definido pela equipa.' }, { status: 409 });
      }
      const wasSobConsulta = existing.sob_consulta;

      const totalMt = Math.round(valor * existing.quantidade * 100) / 100;
      const { data, error } = await supabase
        .from('quotation_requests')
        .update({ preco_unitario_mt: valor, total_mt: totalMt, sob_consulta: false, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      if (wasSobConsulta) {
        notifyQuoteClientPriceDefined({
          to: existing.email,
          clientName: existing.responsavel || existing.empresa,
          produto: existing.produto,
          valorMt: totalMt,
        }).catch((err) => console.error('[admin/cotacoes] falha ao notificar cliente do valor definido:', err));
      }

      return NextResponse.json({ success: true, cotacao: data });
    }

    if (!id || !status) {
      return NextResponse.json({ success: false, error: 'id e status são obrigatórios.' }, { status: 400 });
    }
    if (!VALID_STATUS.includes(status)) {
      return NextResponse.json({ success: false, error: 'Status inválido.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const update: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
    if (status === 'rejected') {
      update.rejection_reason = rejectionReason || null;
    }
    if (status === 'done') {
      update.delivered_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('quotation_requests')
      .update(update)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    try {
      await supabase.from('quotation_status_history').insert({
        quotation_id: id,
        status,
        note: status === 'rejected' ? (rejectionReason || null) : null,
        changed_by: 'admin',
      });
    } catch (historyError) {
      console.error('[admin/cotacoes] falha ao registar histórico:', historyError);
    }

    // Emite o número de factura (série própria, sequencial, imutável) na
    // primeira vez que a encomenda é aprovada — é o momento em que a aba
    // "Factura" passa a ficar visível para o cliente. Idempotente: chamadas
    // repetidas devolvem sempre o mesmo número, nunca criam outro.
    //
    // Nunca emite factura para uma encomenda sem valor definido (0 MT ou
    // negativo — ex.: ainda só tem itens "Sob Consulta" por preçar). Por
    // isso o total do lote (mesma fórmula do livro de pagamentos, abaixo) é
    // calculado ANTES de decidir se há factura a emitir, não depois.
    let invoiceNumber: string | null = null;
    let siblings: { id: string; status: string; categoria_label: string; categoria_id: string; produto: string; total_mt: number; sob_consulta: boolean; empresa: string; nif: string | null }[] = [];
    let batchTotal = 0;
    if (status === 'approved' || status === 'done' || status === 'delivered') {
      const { data: sib, error: siblingsError } = await supabase
        .from('quotation_requests')
        .select('id, status, categoria_label, categoria_id, produto, total_mt, sob_consulta, empresa, nif')
        .eq('batch_id', data.batch_id);
      if (siblingsError) throw siblingsError;
      siblings = sib || [];
      batchTotal = siblings.reduce((sum, row) => sum + (row.sob_consulta ? 0 : Number(row.total_mt) || 0), 0);
    }

    if (status === 'approved') {
      if (batchTotal > 0) {
        try {
          const { data: rpcData, error: rpcError } = await supabase.rpc('assign_quotation_invoice_number', {
            p_batch_id: data.batch_id,
            p_letter: primaryBrandLetter(siblings),
          });
          if (rpcError) throw rpcError;
          invoiceNumber = rpcData as string;
        } catch (invoiceError) {
          console.error('[admin/cotacoes] falha ao emitir número de factura:', invoiceError);
        }
      } else {
        console.warn('[admin/cotacoes] encomenda aprovada sem valor definido — factura não emitida:', data.batch_id);
      }
    }

    // Livro de pagamentos: regista o valor confirmado nos dois momentos em
    // que o admin efectivamente confirma dinheiro recebido — 'approved'
    // (adiantamento, 70%) e 'done' (remanescente, 30%). Como o estado é
    // actualizado item-a-item (uma encomenda com vários serviços pode
    // disparar este PATCH várias vezes para o mesmo lote), o upsert com
    // `ignoreDuplicates` garante um único registo por fase, sem sobrescrever
    // um valor já confirmado/corrigido manualmente. O remanescente só pode
    // ser registado quando TODOS os itens do lote já estão 'done' — caso
    // contrário, marcar um único item como "Entregue" (agora possível
    // directamente no dropdown de estado por item) registaria o remanescente
    // como recebido antes de a encomenda estar mesmo concluída.
    if (status === 'approved' || (status === 'done' && computeBatchStatus(siblings) === 'done')) {
      try {
        const phase = status === 'approved' ? 'advance' : 'remainder';
        // Valor efectivamente pago pelo cliente — com IVA acrescido, igual ao
        // documento da cotação/factura e ao checkout (encomendaPaymentSplit).
        const split = encomendaPaymentSplit(batchTotal);
        const valorMt = phase === 'advance' ? split.adiantamentoMt : split.remanescenteMt;
        const metodo = phase === 'advance' ? data.metodo_pagamento : data.remanescente_metodo_pagamento;

        const { error: paymentError } = await supabase
          .from('quotation_payments')
          .upsert(
            { batch_id: data.batch_id, phase, metodo, valor_mt: valorMt },
            { onConflict: 'batch_id,phase', ignoreDuplicates: true },
          );
        if (paymentError) throw paymentError;

        if (status === 'done') {
          // Segunda factura da encomenda — remanescente, só emitida quando a
          // encomenda fica mesmo paga na totalidade (a do adiantamento já foi
          // emitida em 'approved', mais acima) e só se houver valor real.
          // Mesma função RPC, agora com fase 'remainder'; idempotente como a
          // primeira.
          if (batchTotal > 0) {
            try {
              const { error: rpcError } = await supabase.rpc('assign_quotation_invoice_number', {
                p_batch_id: data.batch_id,
                p_phase: 'remainder',
                p_letter: primaryBrandLetter(siblings),
              });
              if (rpcError) throw rpcError;
            } catch (invoiceError) {
              console.error('[admin/cotacoes] falha ao emitir factura do remanescente:', invoiceError);
            }
          } else {
            console.warn('[admin/cotacoes] encomenda concluída sem valor definido — factura do remanescente não emitida:', data.batch_id);
          }

          await saveAccountingSnapshot(supabase, data.batch_id, siblings);
        }
      } catch (paymentError) {
        console.error('[admin/cotacoes] falha ao registar pagamento:', paymentError);
      }
    }

    // Não aguardar o envio do email (ver /api/cotacoes) — a actualização de
    // estado já ficou gravada, não pode falhar por causa de um SMTP lento.
    // 'delivered'/'done' são estados por item — só notifica quando o LOTE
    // inteiro atinge esse estado (mesmo guard usado acima para pagamento/
    // factura do remanescente), para não mandar um email por cada item de
    // uma encomenda com vários serviços.
    const shouldNotifyBatchState =
      (status === 'delivered' || status === 'done') && computeBatchStatus(siblings) === status;
    if (status === 'approved' || status === 'rejected' || shouldNotifyBatchState) {
      notifyQuoteClientStatusChange({
        to: data.email,
        clientName: data.responsavel || data.empresa,
        produto: data.produto,
        status,
        rejectionReason: data.rejection_reason,
      }).catch((err) => console.error('[admin/cotacoes] falha ao notificar cliente:', err));
    }

    return NextResponse.json({ success: true, cotacao: data, invoiceNumber });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Elimina definitivamente uma encomenda (todas as linhas do batch) — só
// depois de concluída, mesma regra usada do lado do cliente (ver
// /api/cotacoes/[id] DELETE). Mensagens/anexos/histórico saem juntos via ON
// DELETE CASCADE; os ficheiros no bucket têm de ser removidos à parte.
export async function DELETE(request: Request) {
  const auth = await requireAdminOrReseller();
  if ('error' in auth) return auth.error;
  if (auth.user.role !== 'admin') {
    return NextResponse.json({ success: false, error: 'Acção restrita a administradores.' }, { status: 403 });
  }

  try {
    const { batchId, itemId } = (await request.json()) || {};
    if (!batchId && !itemId) {
      return NextResponse.json({ success: false, error: 'batchId ou itemId é obrigatório.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Elimina um único item (linha) da encomenda — só antes de a encomenda
    // ter factura emitida (ainda 'pending'/'payment_selected'), para não
    // desalinhar uma factura já gerada com os itens que a compõem. Anexos,
    // layouts, mensagens e histórico desse item saem via ON DELETE CASCADE
    // (mensagens/histórico) ou são removidos do storage aqui (anexos/layouts).
    if (itemId) {
      const { data: item, error: itemError } = await supabase
        .from('quotation_requests')
        .select('id, batch_id, status')
        .eq('id', itemId)
        .single();

      if (itemError || !item) {
        return NextResponse.json({ success: false, error: 'Item não encontrado.' }, { status: 404 });
      }
      if (item.status !== 'pending' && item.status !== 'payment_selected') {
        return NextResponse.json(
          { success: false, error: 'Só é possível eliminar itens antes de a encomenda ser aprovada.' },
          { status: 409 },
        );
      }

      const { count } = await supabase
        .from('quotation_requests')
        .select('id', { count: 'exact', head: true })
        .eq('batch_id', item.batch_id);

      if ((count ?? 0) <= 1) {
        return NextResponse.json(
          { success: false, error: 'É o único item da encomenda — elimine a encomenda inteira.' },
          { status: 409 },
        );
      }

      const { data: attachments } = await supabase
        .from('quotation_attachments')
        .select('file_url')
        .eq('quotation_id', itemId);
      if (attachments && attachments.length > 0) {
        const paths = attachments
          .map((a) => extractStoragePath(a.file_url))
          .filter((p): p is string => Boolean(p));
        if (paths.length > 0) await supabase.storage.from(QUOTATION_ATTACHMENTS_BUCKET).remove(paths);
      }

      const { data: layouts } = await supabase
        .from('quotation_layouts')
        .select('file_url')
        .eq('quotation_id', itemId);
      if (layouts && layouts.length > 0) {
        const paths = layouts
          .map((l) => l.file_url.split(`${QUOTATION_LAYOUTS_BUCKET}/`)[1])
          .filter((p): p is string => Boolean(p));
        if (paths.length > 0) await supabase.storage.from(QUOTATION_LAYOUTS_BUCKET).remove(paths);
      }

      const { error: itemDeleteError } = await supabase.from('quotation_requests').delete().eq('id', itemId);
      if (itemDeleteError) throw itemDeleteError;

      return NextResponse.json({ success: true });
    }

    const { data: batchItems, error: batchError } = await supabase
      .from('quotation_requests')
      .select('id, status, total_mt, sob_consulta')
      .eq('batch_id', batchId);

    if (batchError || !batchItems || batchItems.length === 0) {
      return NextResponse.json({ success: false, error: 'Encomenda não encontrada.' }, { status: 404 });
    }

    if (computeBatchStatus(batchItems) !== 'done') {
      return NextResponse.json(
        { success: false, error: 'Só é possível eliminar encomendas já concluídas.' },
        { status: 409 },
      );
    }

    const batchTotal = batchItems.reduce((sum, row) => sum + (row.sob_consulta ? 0 : Number(row.total_mt) || 0), 0);

    // Uma factura emitida com valor real (número sequencial imutável) nunca
    // pode desaparecer silenciosamente — bloqueia a eliminação em vez de
    // apagar o registo. Mas uma factura sem valor (0 MT ou negativo) nunca
    // devia ter sido emitida (ver guarda em PATCH) — essa é lixo, não um
    // documento fiscal real, por isso sai junto com a encomenda em vez de a
    // bloquear para sempre.
    const { data: existingInvoice } = await supabase
      .from('quotation_invoices')
      .select('invoice_number')
      .eq('batch_id', batchId)
      .maybeSingle();

    if (existingInvoice && batchTotal > 0) {
      return NextResponse.json(
        { success: false, error: `Não é possível eliminar: já tem a factura ${existingInvoice.invoice_number} emitida.` },
        { status: 409 },
      );
    }

    if (existingInvoice && batchTotal <= 0) {
      await supabase.from('quotation_invoices').delete().eq('batch_id', batchId);
    }

    const ids = batchItems.map((i) => i.id);

    const { data: attachments } = await supabase
      .from('quotation_attachments')
      .select('file_url')
      .in('quotation_id', ids);

    if (attachments && attachments.length > 0) {
      const paths = attachments
        .map((a) => extractStoragePath(a.file_url))
        .filter((p): p is string => Boolean(p));
      if (paths.length > 0) {
        await supabase.storage.from(QUOTATION_ATTACHMENTS_BUCKET).remove(paths);
      }
    }

    const { data: layouts } = await supabase
      .from('quotation_layouts')
      .select('file_url')
      .in('quotation_id', ids);

    if (layouts && layouts.length > 0) {
      const paths = layouts
        .map((l) => l.file_url.split(`${QUOTATION_LAYOUTS_BUCKET}/`)[1])
        .filter((p): p is string => Boolean(p));
      if (paths.length > 0) {
        await supabase.storage.from(QUOTATION_LAYOUTS_BUCKET).remove(paths);
      }
    }

    const { error: deleteError } = await supabase.from('quotation_requests').delete().in('id', ids);
    if (deleteError) throw deleteError;

    // A encomenda pode já ter um registo fixo na Contabilidade (ver
    // saveAccountingSnapshot, em PATCH) — marca-o como eliminado em vez de o
    // apagar, para sair do Balanço mas continuar disponível na aba
    // "Eliminadas". Sem efeito (0 linhas afectadas) se nunca chegou a existir.
    await supabase
      .from('accounting_batch_snapshots')
      .update({ deleted_at: new Date().toISOString() })
      .eq('batch_id', batchId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[admin/cotacoes DELETE] error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
