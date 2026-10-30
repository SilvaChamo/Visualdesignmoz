import { NextResponse } from 'next/server';
import { requireAdminOrReseller } from '@/lib/panel-api-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { fulfillCheckout, HOSTING_DOMAIN_REGEX } from '@/lib/checkout-fulfillment';
import { deleteHostingWebDomain, getProviderByUsername } from '@/lib/hosting-provider';
import { dominioProtegido } from '@/lib/overdue-hosting-suspend';
import { mensagemPublica } from '@/lib/mensagem-publica';
import { sanitizeDaUsername } from '@/lib/reseller-provision';
import type { CatalogCartItem } from '@/lib/package-catalog';
import { avisarClienteCompra } from '@/lib/notify-checkout-client';
import { garantirPedidosSemConta } from '@/lib/checkout-schema';
import { destinatarioDoPedido, donoDoPedidoAoAprovar } from '@/lib/pedido-sem-conta';

type CartItemWithStatus = CatalogCartItem & { status?: 'pending' | 'paid' | 'failed'; rejectionReason?: string | null };

/**
 * Confirma (activa o produto) ou rejeita UM item de um pedido de pagamento
 * manual (M-Pesa/Transferência) — não o pedido inteiro. Um pedido pode ter
 * vários itens de tipos diferentes (ex: domínio + hospedagem juntos); cada
 * um é aprovado separadamente, mesma lógica usada nas Encomendas
 * (quotation_requests → computeBatchStatus). O estado do pedido inteiro
 * (`checkout_sessions.status`) fica derivado: só passa a 'paid' quando
 * todos os itens estiverem 'paid'.
 */
// Pedidos que estão a ser confirmados neste momento (o site corre num só processo): dois cliques, ou dois
// administradores, não activam o mesmo item duas vezes.
const emCurso = new Set<string>();

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminOrReseller();
  if ('error' in auth) return auth.error;
  if (auth.user.role !== 'admin') {
    return NextResponse.json({ success: false, error: 'Acção restrita a administradores.' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Supabase Service Role não configurado.' }, { status: 503 });
  }

  const { id } = await params;
  if (emCurso.has(id)) {
    return NextResponse.json({ success: false, error: 'Este pedido está a ser tratado agora. Espere uns segundos e actualize a lista.' }, { status: 409 });
  }
  emCurso.add(id);

  try {
    const body = await request.json();
    const { itemIndex, status, rejectionReason, hostingDomain, semComprovativo } = body || {};
    // 'reenviar' = o comprovativo não serve: o item continua por pagar e o cliente envia outro (a rejeição final é 'failed')
    if (status !== 'paid' && status !== 'failed' && status !== 'reenviar') {
      return NextResponse.json({ success: false, error: 'Estado inválido.' }, { status: 400 });
    }
    if (typeof itemIndex !== 'number') {
      return NextResponse.json({ success: false, error: 'itemIndex obrigatório.' }, { status: 400 });
    }

    await garantirPedidosSemConta(supabase);
    const { data: session, error: sessionError } = await supabase
      .from('checkout_sessions')
      .select('id, user_id, items, status, metodo_pagamento, total_mt, comprovativo_url, cadastro')
      .eq('id', id)
      .single();
    if (sessionError || !session) {
      return NextResponse.json({ success: false, error: 'Pedido não encontrado.' }, { status: 404 });
    }
    const para = destinatarioDoPedido(session);

    const items = (session.items as CartItemWithStatus[]) || [];
    let item = items[itemIndex];
    if (!item) {
      return NextResponse.json({ success: false, error: 'Item não encontrado neste pedido.' }, { status: 404 });
    }
    const currentItemStatus = item.status ?? session.status;
    if (currentItemStatus !== 'pending') {
      return NextResponse.json({ success: false, error: 'Este item já foi respondido.' }, { status: 409 });
    }

    // Activar um serviço (domínio registado a sério, conta criada) sem ter visto o comprovativo só com decisão expressa.
    if (status === 'paid' && !session.comprovativo_url && semComprovativo !== true) {
      return NextResponse.json(
        { success: false, error: 'Este pedido ainda não tem comprovativo. Confirme só se o dinheiro já entrou na conta.', semComprovativo: true },
        { status: 409 },
      );
    }

    const motivo = typeof rejectionReason === 'string' && rejectionReason.trim() ? rejectionReason.trim() : null;
    const pedidoParaAviso = { id: session.id, total_mt: Number(session.total_mt) || 0, metodo_pagamento: session.metodo_pagamento, items: [item] };

    if (status === 'reenviar') {
      const updatedItems = items.map((it, idx) => (idx === itemIndex ? { ...it, rejectionReason: motivo } : it));
      const { data, error } = await supabase
        .from('checkout_sessions')
        .update({ items: updatedItems, comprovativo_url: null, rejection_reason: motivo })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      await avisarClienteCompra({ userId: session.user_id || null, para, evento: 'novo-comprovativo', pedido: pedidoParaAviso, motivo });
      return NextResponse.json({ success: true, pedido: data });
    }

    // #6: o admin pode corrigir/definir o domínio de uma hospedagem aqui mesmo,
    // antes de confirmar — sem isto, um pedido sem domínio ficava preso sem
    // forma de o resolver a partir da Contabilidade.
    const normalizedDomain = typeof hostingDomain === 'string' ? hostingDomain.toLowerCase().trim() : '';
    if (
      status === 'paid' &&
      (item as any).type === 'hosting' &&
      normalizedDomain &&
      HOSTING_DOMAIN_REGEX.test(normalizedDomain)
    ) {
      item = { ...item, hostingDomain: normalizedDomain } as CartItemWithStatus;
    }

    // Confirmar é o gatilho final: quem comprou sem conta só recebe o login agora (e a seguir a hospedagem).
    let dono: string | null = session.user_id || null;
    let contaCriada = false;
    let avisosServidor: string[] = [];
    if (status === 'paid') {
      const r = await donoDoPedidoAoAprovar(supabase, session);
      dono = r.userId;
      contaCriada = r.contaCriada || r.senhaDefinida;
      // o pedido inteiro vai como contexto: a conta «só domínio» não pode ser criada por o item confirmado primeiro ser o domínio
      const feito = await fulfillCheckout(supabase, dono, [item], session.metodo_pagamento, items, { esperarServidor: true });
      avisosServidor = feito.avisos || [];
    }

    const updatedItems = items.map((it, idx) =>
      idx === itemIndex ? { ...item, status, rejectionReason: status === 'failed' ? motivo : null } : it,
    );
    const allPaid = updatedItems.every((it) => (it.status ?? session.status) === 'paid');
    const allDone = updatedItems.every((it) => (it.status ?? session.status) !== 'pending');
    const newRowStatus = allPaid ? 'paid' : allDone ? 'failed' : 'pending';

    const { data, error } = await supabase
      .from('checkout_sessions')
      .update({
        items: updatedItems,
        status: newRowStatus,
        fulfilled_at: allPaid ? new Date().toISOString() : undefined,
        ...(status === 'paid' ? { rejection_reason: null } : {}),
        ...(status === 'failed' ? { rejection_reason: motivo } : {}),
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;

    await avisarClienteCompra({
      userId: dono,
      para,
      contaCriada,
      evento: status === 'paid' ? 'confirmado' : 'rejeitado',
      pedido: pedidoParaAviso,
      motivo,
    });

    return NextResponse.json({ success: true, pedido: data, avisos: avisosServidor });
  } catch (error: any) {
    console.error('[admin/checkout-pagamentos PATCH] error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  } finally {
    emCurso.delete(id);
  }
}

/**
 * Elimina UM item de hospedagem de um pedido — para limpar encomendas de
 * teste (ex.: durante a migração para o Hestia) sem deixar sobras: apaga o
 * site real no servidor (só o site, nunca a conta inteira — mesmo que o dono
 * real seja "admin"), o registo de renovação (hosting_renewals) e o espelho
 * do painel (panel_sites/panel_users), além do próprio item no pedido. Só
 * itens de hospedagem — domínios e outros tipos não passam por aqui.
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminOrReseller();
  if ('error' in auth) return auth.error;
  if (auth.user.role !== 'admin') {
    return NextResponse.json({ success: false, error: 'Acção restrita a administradores.' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Supabase Service Role não configurado.' }, { status: 503 });
  }

  const { id } = await params;

  try {
    const body = await request.json().catch(() => ({}));
    const itemIndex = Number(body?.itemIndex);
    if (!Number.isInteger(itemIndex) || itemIndex < 0) {
      return NextResponse.json({ success: false, error: 'itemIndex obrigatório.' }, { status: 400 });
    }

    const { data: session, error: sessionError } = await supabase
      .from('checkout_sessions')
      .select('id, user_id, items, status')
      .eq('id', id)
      .single();
    if (sessionError || !session) {
      return NextResponse.json({ success: false, error: 'Pedido não encontrado.' }, { status: 404 });
    }

    const items = (session.items as CartItemWithStatus[]) || [];
    const item = items[itemIndex] as (CartItemWithStatus & { hostingDomain?: string }) | undefined;
    if (!item) {
      return NextResponse.json({ success: false, error: 'Item não encontrado neste pedido.' }, { status: 404 });
    }
    if ((item as any).type !== 'hosting') {
      return NextResponse.json({ success: false, error: 'Só é possível eliminar itens de hospedagem por aqui.' }, { status: 400 });
    }

    const domain = String(item.hostingDomain || '').toLowerCase().trim();
    const warnings: string[] = [];

    if (domain) {
      const { data: renewal } = await supabase
        .from('hosting_renewals')
        .select('id, server')
        .eq('user_id', session.user_id)
        .eq('domain_name', domain)
        .maybeSingle();

      const { getMirrorSiteOwner } = await import('@/lib/panel-mirror-read');
      const siteOwner = await getMirrorSiteOwner(domain);
      const site = siteOwner ? { owner: siteOwner } : null;

      // Um site que vive na conta principal do servidor, ou num domínio protegido, não foi criado por esta
      // encomenda (o checkout cria uma conta própria para o cliente): é um site real, nunca se apaga daqui.
      const contaPrincipal = (process.env.HESTIA_USER || 'vdadmin').trim();
      const siteReal = !!site?.owner && (site.owner === contaPrincipal || dominioProtegido(domain));

      if (siteReal) {
        warnings.push(`O site ${domain} é um site real do servidor, não foi criado por esta encomenda; por isso foi mantido. Só apaguei a encomenda e o registo de hospedagem.`);
      } else if (site?.owner) {
        const provider = await getProviderByUsername(site.owner);
        const result = await deleteHostingWebDomain(provider, site.owner, domain);
        if (!result.ok) {
          warnings.push(`Não foi possível remover o site do servidor (${site.owner}/${domain}): ${mensagemPublica(result.error, false, 'o servidor não confirmou a remoção')}. Confirme manualmente.`);
        }
        await supabase.from('panel_sites').delete().eq('domain', domain);
      } else {
        warnings.push(`Não encontrei o dono deste domínio no servidor — só apaguei os registos do painel; confirme manualmente se ficou alguma coisa em ${domain}.`);
      }

      if (renewal?.id) {
        await supabase.from('hosting_renewals').delete().eq('id', renewal.id);
      }

      // Mirror panel_users criado no checkout (username = prefixo do domínio) —
      // nunca toca em "admin" nem noutra conta, só no que tiver sido gerado
      // para este utilizador a partir deste domínio (aceita sufixos "1"/"2"/
      // timestamp de pickAvailableMirrorUsername).
      const base = sanitizeDaUsername(domain.split('.')[0] || '');
      if (base) {
        await supabase
          .from('panel_users')
          .delete()
          .eq('auth_user_id', session.user_id)
          .ilike('username', `${base}%`);
      }
    }

    const remainingItems = items.filter((_, idx) => idx !== itemIndex);
    if (remainingItems.length === 0) {
      await supabase.from('checkout_sessions').delete().eq('id', id);
    } else {
      const allPaid = remainingItems.every((it) => (it.status ?? session.status) === 'paid');
      const allDone = remainingItems.every((it) => (it.status ?? session.status) !== 'pending');
      await supabase
        .from('checkout_sessions')
        .update({ items: remainingItems, status: allPaid ? 'paid' : allDone ? 'failed' : 'pending' })
        .eq('id', id);
    }

    return NextResponse.json({ success: true, warnings });
  } catch (error: any) {
    console.error('[admin/checkout-pagamentos DELETE] error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
