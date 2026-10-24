import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { findItem, CUSTOM_CATEGORIA_ID } from '@/lib/pricing-catalog';
import { notifyQuoteTeam } from '@/lib/notify-quote-team';
import { QUOTATION_ATTACHMENTS_BUCKET, extractStoragePath } from '@/lib/quotation-attachments-bucket';
import { QUOTATION_LAYOUTS_BUCKET } from '@/lib/quotation-layouts-bucket';
import { computeBatchStatus } from '@/lib/quotation-status-labels';
import { resolveRoleForAuthUser } from '@/lib/server-auth-role';

// Uma encomenda (linha + irmãs do mesmo batch) — usada pelo documento de
// cotação e pelo painel de detalhe. Consulta com service role (não a sessão
// do browser) porque o admin precisa de ver encomendas de qualquer cliente;
// as RLS policies em quotation_requests só reconhecem profiles.role='admin',
// que é mais restrito do que resolveRoleForAuthUser (usado em todo o resto
// do painel), causando "encomenda não encontrada" para admins reais.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    // Só os campos necessários para a verificação de acesso — o resto da
    // encomenda já vem completo a seguir via `siblings` (que inclui esta
    // própria linha), não vale a pena trazer tudo duas vezes.
    const { data: row, error: fetchError } = await admin
      .from('quotation_requests')
      .select('id, user_id, batch_id')
      .eq('id', id)
      .single();

    if (fetchError || !row) {
      return NextResponse.json({ error: 'Não foi possível encontrar esta cotação.' }, { status: 404 });
    }

    if (row.user_id !== user.id) {
      const role = await resolveRoleForAuthUser(supabase, user);
      if (role !== 'admin') {
        return NextResponse.json({ error: 'Não tem permissão para ver esta cotação.' }, { status: 403 });
      }
    }

    const [{ data: siblings, error: siblingsError }, { data: invoices }, { data: payments }] = await Promise.all([
      admin
        .from('quotation_requests')
        .select('*')
        .eq('batch_id', row.batch_id)
        .order('created_at', { ascending: true }),
      // Duas facturas possíveis por encomenda — uma por fase de pagamento
      // (adiantamento / remanescente), ver saveAccountingSnapshot e
      // assign_quotation_invoice_number em /api/admin/cotacoes.
      admin
        .from('quotation_invoices')
        .select('phase, invoice_number')
        .eq('batch_id', row.batch_id),
      admin
        .from('quotation_payments')
        .select('phase, metodo, valor_mt, confirmed_at')
        .eq('batch_id', row.batch_id)
        .order('confirmed_at', { ascending: true }),
    ]);

    const items = !siblingsError && siblings && siblings.length > 0 ? siblings : null;
    if (!items) {
      return NextResponse.json({ error: 'Não foi possível encontrar esta cotação.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      items,
      invoiceNumber: invoices?.find((i) => i.phase === 'advance')?.invoice_number ?? null,
      remainderInvoiceNumber: invoices?.find((i) => i.phase === 'remainder')?.invoice_number ?? null,
      payments: payments ?? [],
    });
  } catch (error: unknown) {
    console.error('[cotacoes/[id] GET] error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// Edição de uma encomenda pelo próprio cliente, só enquanto ainda está
// 'pending' (antes de a equipa reagir). Permite ajustar notas/prazo/
// quantidade da própria linha e, opcionalmente, adicionar novos serviços —
// que entram como novas linhas em quotation_requests, já que cada linha é a
// unidade de "encomenda" nesta app (não há conceito de pedido agrupado).
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
      return NextResponse.json({ error: 'Não tem permissão para editar esta encomenda.' }, { status: 403 });
    }

    // Pendente, ou recusada pela equipa com a recomendação de editar: ao editar uma recusada, volta a pendente para nova análise
    if (quotation.status !== 'pending' && quotation.status !== 'rejected') {
      return NextResponse.json(
        { error: 'Só é possível editar enquanto a encomenda está pendente ou foi recusada.' },
        { status: 409 },
      );
    }

    const body = await request.json();
    const { notas, dataLimiteEntrega, quantidade, novosItens } = body ?? {};

    // notas/dataLimiteEntrega são conceptualmente da encomenda toda —
    // aplicam-se a todas as linhas do mesmo batch_id. quantidade (e o preço
    // recalculado) fica só na linha específica que o cliente está a editar.
    const sharedUpdate: Record<string, unknown> = {};
    const rowUpdate: Record<string, unknown> = {};
    if (quotation.status === 'rejected') rowUpdate.status = 'pending';

    if (notas !== undefined) {
      sharedUpdate.notas = notas || null;
    }

    if (dataLimiteEntrega !== undefined) {
      const dataLimite = new Date(dataLimiteEntrega);
      if (Number.isNaN(dataLimite.getTime())) {
        return NextResponse.json({ error: 'Data-limite de entrega inválida.' }, { status: 400 });
      }
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (dataLimite < today) {
        return NextResponse.json({ error: 'A data-limite de entrega não pode ser no passado.' }, { status: 400 });
      }
      sharedUpdate.data_limite_entrega = dataLimiteEntrega;
    }

    if (quantidade !== undefined) {
      const quantidadeNum = Math.round(Number(quantidade));
      if (!Number.isFinite(quantidadeNum) || quantidadeNum <= 0) {
        return NextResponse.json({ error: 'Quantidade inválida.' }, { status: 400 });
      }
      rowUpdate.quantidade = quantidadeNum;
      // Recalcula o preço a partir do catálogo actual, em vez de confiar no
      // preco_unitario_mt já gravado — protege contra o catálogo ter mudado
      // desde a submissão original.
      if (!quotation.sob_consulta && quotation.categoria_id !== CUSTOM_CATEGORIA_ID) {
        const found = findItem(quotation.categoria_id, quotation.produto);
        if (found) {
          rowUpdate.preco_unitario_mt = found.item.price;
          rowUpdate.total_mt = Math.round(found.item.price * quantidadeNum * 100) / 100;
        }
      }
    }

    // Novos serviços adicionados nesta edição — cada um vira uma linha nova,
    // clonando os dados institucionais/de contacto da linha original.
    const novasLinhas: Record<string, unknown>[] = [];
    if (Array.isArray(novosItens) && novosItens.length > 0) {
      for (const raw of novosItens) {
        const quantidadeNum = Math.round(Number(raw?.quantidade));
        if (!Number.isFinite(quantidadeNum) || quantidadeNum <= 0) {
          return NextResponse.json({ error: 'Quantidade inválida num dos novos serviços.' }, { status: 400 });
        }

        if (raw?.categoriaId === CUSTOM_CATEGORIA_ID) {
          const descricao = String(raw?.produto || '').trim();
          if (!descricao) {
            return NextResponse.json({ error: 'Descreva o pedido personalizado.' }, { status: 400 });
          }
          if (descricao.length > 255) {
            return NextResponse.json(
              { error: 'A descrição do pedido personalizado é demasiado longa (máx. 255 caracteres).' },
              { status: 400 },
            );
          }
          novasLinhas.push({
            user_id: user.id,
            batch_id: quotation.batch_id,
            empresa: quotation.empresa,
            nif: quotation.nif,
            endereco: quotation.endereco,
            telefone_institucional: quotation.telefone_institucional,
            email_institucional: quotation.email_institucional,
            website: quotation.website,
            responsavel: quotation.responsavel,
            cargo: quotation.cargo,
            telefone: quotation.telefone,
            email: quotation.email,
            categoria_id: CUSTOM_CATEGORIA_ID,
            categoria_label: 'Pedido Personalizado',
            produto: descricao,
            preco_unitario_mt: 0,
            quantidade: quantidadeNum,
            data_limite_entrega: sharedUpdate.data_limite_entrega ?? quotation.data_limite_entrega,
            total_mt: 0,
            sob_consulta: true,
            notas: sharedUpdate.notas ?? quotation.notas,
            status: 'pending',
          });
          continue;
        }

        const found = findItem(raw?.categoriaId, raw?.produto);
        if (!found) {
          return NextResponse.json({ error: 'Produto ou categoria não reconhecidos.' }, { status: 400 });
        }
        const sobConsulta = Boolean(found.item.sobConsulta);
        const totalMt = sobConsulta ? 0 : Math.round(found.item.price * quantidadeNum * 100) / 100;
        novasLinhas.push({
          user_id: user.id,
          batch_id: quotation.batch_id,
          empresa: quotation.empresa,
          nif: quotation.nif,
          endereco: quotation.endereco,
          telefone_institucional: quotation.telefone_institucional,
          email_institucional: quotation.email_institucional,
          website: quotation.website,
          responsavel: quotation.responsavel,
          cargo: quotation.cargo,
          telefone: quotation.telefone,
          email: quotation.email,
          categoria_id: found.category.id,
          categoria_label: found.category.label,
          produto: found.item.name,
          preco_unitario_mt: found.item.price,
          quantidade: quantidadeNum,
          data_limite_entrega: sharedUpdate.data_limite_entrega ?? quotation.data_limite_entrega,
          total_mt: totalMt,
          sob_consulta: sobConsulta,
          notas: sharedUpdate.notas ?? quotation.notas,
          status: 'pending',
        });
      }
    }

    if (Object.keys(sharedUpdate).length > 0) {
      const { error: sharedUpdateError } = await admin
        .from('quotation_requests')
        .update({ ...sharedUpdate, updated_at: new Date().toISOString() })
        .eq('batch_id', quotation.batch_id);

      if (sharedUpdateError) {
        console.error('[cotacoes/[id] PATCH] shared update error:', sharedUpdateError);
        return NextResponse.json({ error: 'Não foi possível actualizar a encomenda.' }, { status: 500 });
      }
    }

    let updatedQuotation = quotation;
    if (Object.keys(rowUpdate).length > 0 || Object.keys(sharedUpdate).length > 0) {
      const { data: refetched, error: rowUpdateError } = await admin
        .from('quotation_requests')
        .update({ ...rowUpdate, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (rowUpdateError) {
        console.error('[cotacoes/[id] PATCH] row update error:', rowUpdateError);
        return NextResponse.json({ error: 'Não foi possível actualizar a encomenda.' }, { status: 500 });
      }
      updatedQuotation = refetched;
    }

    let novasCotacoes: Record<string, unknown>[] = [];
    if (novasLinhas.length > 0) {
      const { data: inserted, error: insertError } = await admin
        .from('quotation_requests')
        .insert(novasLinhas)
        .select();

      if (insertError) {
        console.error('[cotacoes/[id] PATCH] insert error:', insertError);
        return NextResponse.json({ error: 'A encomenda foi actualizada, mas não foi possível adicionar os novos serviços.' }, { status: 500 });
      }
      novasCotacoes = inserted || [];
    }

    notifyQuoteTeam({
      title: 'Cliente editou uma encomenda',
      message: `${quotation.empresa} editou o pedido "${quotation.produto}" (${quotation.categoria_label}).${
        novasCotacoes.length > 0 ? ` Adicionou ${novasCotacoes.length} novo(s) serviço(s).` : ''
      }`,
      link: `${process.env.NEXT_PUBLIC_SITE_URL || ''}/vhost:2026`,
    }).catch((err) => console.error('[cotacoes/[id] PATCH] falha ao notificar equipa:', err));

    return NextResponse.json({ success: true, quotation: updatedQuotation, novasCotacoes });
  } catch (error: unknown) {
    console.error('[cotacoes/[id] PATCH] error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// Eliminação definitiva de uma encomenda pelo próprio cliente — só depois de
// 'done' (a equipa já concluiu o trabalho), para não haver risco de apagar
// algo em curso. Mensagens/anexos/histórico saem juntos via ON DELETE CASCADE;
// os ficheiros no bucket têm de ser removidos à parte.
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
      .select('id, batch_id, user_id, status')
      .eq('id', id)
      .single();

    if (fetchError || !quotation) {
      return NextResponse.json({ error: 'Encomenda não encontrada.' }, { status: 404 });
    }

    if (quotation.user_id !== user.id) {
      return NextResponse.json({ error: 'Não tem permissão para eliminar esta encomenda.' }, { status: 403 });
    }

    // Só se elimina uma encomenda que já chegou a um estado final — concluída
    // (todos os itens entregues), cancelada pelo cliente ou rejeitada pela
    // equipa — nunca uma que ainda esteja em curso. Usa a mesma regra de
    // agregação das listas (computeBatchStatus).
    const { data: batchItems, error: batchError } = await admin
      .from('quotation_requests')
      .select('id, status, total_mt, sob_consulta')
      .eq('batch_id', quotation.batch_id);

    if (batchError || !batchItems) {
      return NextResponse.json({ error: 'Não foi possível verificar a encomenda.' }, { status: 500 });
    }

    if (!['done', 'cancelled', 'rejected'].includes(computeBatchStatus(batchItems))) {
      return NextResponse.json(
        { error: 'Só é possível eliminar encomendas concluídas, canceladas ou rejeitadas.' },
        { status: 409 },
      );
    }

    const batchTotal = batchItems.reduce((sum, row) => sum + (row.sob_consulta ? 0 : Number(row.total_mt) || 0), 0);

    // Uma factura emitida com valor real (número sequencial imutável) nunca
    // pode desaparecer silenciosamente — bloqueia a eliminação em vez de
    // apagar o registo. Mas uma factura sem valor (0 MT ou negativo) nunca
    // devia ter sido emitida (ver guarda em PATCH /api/admin/cotacoes) —
    // essa é lixo, não um documento fiscal real, por isso sai junto com a
    // encomenda em vez de a bloquear para sempre.
    const { data: existingInvoice } = await admin
      .from('quotation_invoices')
      .select('invoice_number')
      .eq('batch_id', quotation.batch_id)
      .maybeSingle();

    if (existingInvoice && batchTotal > 0) {
      return NextResponse.json(
        { error: `Não é possível eliminar: já tem a factura ${existingInvoice.invoice_number} emitida. Contacte o suporte.` },
        { status: 409 },
      );
    }

    if (existingInvoice && batchTotal <= 0) {
      await admin.from('quotation_invoices').delete().eq('batch_id', quotation.batch_id);
    }

    const batchIds = batchItems.map((i) => i.id);

    const { data: attachments } = await admin
      .from('quotation_attachments')
      .select('file_url')
      .in('quotation_id', batchIds);

    if (attachments && attachments.length > 0) {
      const paths = attachments
        .map((a) => extractStoragePath(a.file_url))
        .filter((p): p is string => Boolean(p));
      if (paths.length > 0) {
        await admin.storage.from(QUOTATION_ATTACHMENTS_BUCKET).remove(paths);
      }
    }

    const { data: layouts } = await admin
      .from('quotation_layouts')
      .select('file_url')
      .in('quotation_id', batchIds);

    if (layouts && layouts.length > 0) {
      const paths = layouts
        .map((l) => l.file_url.split(`${QUOTATION_LAYOUTS_BUCKET}/`)[1])
        .filter((p): p is string => Boolean(p));
      if (paths.length > 0) {
        await admin.storage.from(QUOTATION_LAYOUTS_BUCKET).remove(paths);
      }
    }

    const { error: deleteError } = await admin.from('quotation_requests').delete().in('id', batchIds);
    if (deleteError) {
      console.error('[cotacoes/[id] DELETE] delete error:', deleteError);
      return NextResponse.json({ error: 'Não foi possível eliminar a encomenda.' }, { status: 500 });
    }

    // A encomenda pode já ter um registo fixo na Contabilidade (ver
    // saveAccountingSnapshot, em PATCH /api/admin/cotacoes) — marca-o como
    // eliminado em vez de o apagar, para sair do Balanço da equipa mas
    // continuar disponível na aba "Eliminadas". Sem efeito se nunca existiu.
    await admin
      .from('accounting_batch_snapshots')
      .update({ deleted_at: new Date().toISOString() })
      .eq('batch_id', quotation.batch_id);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('[cotacoes/[id] DELETE] error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
