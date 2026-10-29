import { NextResponse } from 'next/server';
import { requireAdminOrReseller } from '@/lib/panel-api-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { pickComprovativo } from '@/lib/quotation-comprovativo';

/**
 * Contagem única de tudo o que está pendente de confirmação na Contabilidade
 * (créditos de revendedor + renovações + itens de compras novas do carrinho
 * — domínio/hospedagem/e-mail — + pagamentos de encomendas VisualDesign),
 * para o balão do menu "Contabilidade" no
 * AdminSidebar. Junta as 3 fontes em vez de cada separador ter o seu próprio
 * balão.
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
    const [creditos, renovacoes, compras, encomendasRows] = await Promise.all([
      supabase.from('reseller_credit_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('renewal_payment_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      // só pedidos que já têm comprovativo: sem ele não há nada para a equipa decidir
      supabase.from('checkout_sessions').select('items').neq('metodo_pagamento', 'stripe').eq('status', 'pending').not('comprovativo_url', 'is', null),
      // Adiantamento à espera ('payment_selected') ou remanescente com método
      // já escolhido numa encomenda pronta ('delivered') — mesmas regras de
      // /api/admin/encomendas-pagamentos, contadas por encomenda e fase.
      supabase
        .from('quotation_requests')
        .select('id, batch_id, status, remanescente_metodo_pagamento')
        .in('status', ['payment_selected', 'delivered']),
    ]);

    // Por tipo de item — para os balões de cada separador (Domínios/Hospedagem/
    // E-mails), não só o total geral do menu "Contabilidade".
    let dominios = 0;
    let hospedagem = 0;
    let emails = 0;
    for (const s of compras.data || []) {
      const items = (s.items as Array<{ status?: string; type?: string }>) || [];
      for (const item of items) {
        if ((item.status ?? 'pending') !== 'pending') continue;
        if (item.type === 'domain') dominios += 1;
        else if (item.type === 'hosting' || item.type === 'ssl') hospedagem += 1;
        else if (item.type === 'email') emails += 1;
      }
    }
    const comprasPendentes = dominios + hospedagem + emails;

    // Encomendas: só contam as que o cliente já concluiu, isto é, com o comprovativo da fase enviado (mesma regra de
    // /api/admin/encomendas-pagamentos). Antes contavam desde o clique em «Pagar».
    const linhas = encomendasRows.data || [];
    const anexosPorLote = new Map<string, { file_url: string; file_name: string }[]>();
    if (linhas.length > 0) {
      const { data: anexos } = await supabase
        .from('quotation_attachments')
        .select('quotation_id, file_url, file_name')
        .eq('uploaded_by_role', 'client')
        .in('quotation_id', linhas.map((r) => r.id))
        .order('created_at', { ascending: true });
      const loteDe = new Map(linhas.map((r) => [r.id, r.batch_id]));
      for (const anexo of anexos || []) {
        const lote = loteDe.get(anexo.quotation_id);
        if (!lote) continue;
        anexosPorLote.set(lote, [...(anexosPorLote.get(lote) ?? []), anexo]);
      }
    }
    const encomendasPendentes = new Set<string>();
    for (const row of linhas) {
      const anexos = anexosPorLote.get(row.batch_id) ?? [];
      if (row.status === 'payment_selected' && pickComprovativo(anexos, 'adiantamento')) encomendasPendentes.add(`${row.batch_id}-advance`);
      else if (row.status === 'delivered' && row.remanescente_metodo_pagamento && pickComprovativo(anexos, 'remanescente')) encomendasPendentes.add(`${row.batch_id}-remainder`);
    }
    const encomendas = encomendasPendentes.size;

    const pendentes = (creditos.count || 0) + (renovacoes.count || 0) + comprasPendentes + encomendas;

    return NextResponse.json({
      success: true,
      stats: {
        pendentes,
        porTab: {
          creditos: creditos.count || 0,
          renovacoes: renovacoes.count || 0,
          encomendas,
          dominios,
          hospedagem,
          emails,
        },
      },
    });
  } catch (error: any) {
    console.error('[admin/contabilidade-pendentes GET] error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
