import { NextResponse } from 'next/server';
import { requireAdminOrReseller } from '@/lib/panel-api-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getAttachmentSignedUrls } from '@/lib/quotation-attachments-bucket';
import { cadastroDoPedido } from '@/lib/pedido-sem-conta';

// Lista (só os concluídos pelo cliente, ver o filtro abaixo) os pedidos de pagamento manual (M-Pesa/Transferência) de compras
// novas do carrinho, para a equipa confirmar/rejeitar. Pagamentos por
// Cartão (Stripe) nunca aparecem aqui — já chegam confirmados pelo webhook.
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
      .from('checkout_sessions')
      .select('id, user_id, items, total_mt, metodo_pagamento, status, comprovativo_url, rejection_reason, created_at, cadastro')
      .neq('metodo_pagamento', 'stripe')
      // Só cai na Contabilidade depois de concluído pelo cliente: pedido com comprovativo enviado (o último passo) ou já pago.
      // Os que ainda esperam pelo pagamento, ou que ficaram sem comprovativo, não aparecem.
      .or('comprovativo_url.not.is.null,status.eq.paid')
      .order('created_at', { ascending: false });
    if (error) throw error;

    const userIds = Array.from(new Set((data || []).map((s) => s.user_id).filter(Boolean))) as string[];
    const profileById: Record<string, { nome?: string; email?: string; telefone?: string; morada?: string; cidade?: string; empresa?: string }> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name, email, telefone, morada, cidade, empresa')
        .in('user_id', userIds);
      for (const p of profiles || []) {
        if (p.user_id) profileById[p.user_id] = { nome: p.name, email: p.email, telefone: p.telefone, morada: p.morada, cidade: p.cidade, empresa: p.empresa };
      }
    }

    // Contas por Google (OAuth) nunca passam por /api/auth/register — não
    // têm linha em profiles. Sem isto a coluna "Cliente" ficava sempre "—"
    // para elas, mesmo a conta tendo nome/email reais no próprio Auth.
    const missingIds = userIds.filter((id) => !profileById[id]?.nome && !profileById[id]?.email);
    if (missingIds.length > 0) {
      const authUsers = await Promise.all(
        missingIds.map((id) => supabase.auth.admin.getUserById(id).catch(() => null)),
      );
      authUsers.forEach((res, idx) => {
        const user = res?.data?.user;
        if (!user) return;
        const id = missingIds[idx];
        profileById[id] = {
          ...profileById[id],
          nome: profileById[id]?.nome || user.user_metadata?.full_name || user.user_metadata?.name || undefined,
          email: profileById[id]?.email || user.email || undefined,
        };
      });
    }

    // Cada item do carrinho tem o seu próprio estado (aprovação por-item, não
    // por pedido inteiro — mesma lógica das Encomendas). Pedidos antigos ainda
    // não têm `status` gravado por item: nesse caso herda o estado do pedido
    // inteiro (linha), para não aparecerem como "pendentes" à toa se o pedido
    // já tiver sido confirmado/rejeitado antes desta funcionalidade existir.
    // #11: bucket privado — o URL guardado é só o caminho, gera-se aqui um
    // URL temporário assinado para a equipa poder abrir o comprovativo.
    const signedUrls = await getAttachmentSignedUrls((data || []).map((s) => s.comprovativo_url));

    const pedidos = (data || []).map(({ cadastro: _cadastro, ...s }, idx) => {
      // pedido de quem ainda não tem conta (o login nasce ao confirmar): os dados digitados no checkout
      const c = s.user_id ? null : cadastroDoPedido({ cadastro: _cadastro });
      const cliente = s.user_id
        ? profileById[s.user_id] || null
        : c
          ? { nome: [c.nome, c.apelido].filter(Boolean).join(' '), email: c.email, telefone: c.telefone, morada: c.morada, cidade: c.provincia, empresa: c.empresa }
          : null;
      return {
      ...s,
      sem_conta: !s.user_id,
      comprovativo_url: signedUrls[idx],
      user_email: cliente?.email || null,
      cliente,
      items: (s.items as Array<Record<string, unknown>>).map((item) => ({
        ...item,
        status: item.status ?? s.status,
      })),
      };
    });

    const pendentes = pedidos.reduce(
      (sum, p) => sum + p.items.filter((i) => i.status === 'pending').length,
      0,
    );

    return NextResponse.json({ success: true, pedidos, stats: { pendentes } });
  } catch (error: any) {
    console.error('[admin/checkout-pagamentos GET] error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
