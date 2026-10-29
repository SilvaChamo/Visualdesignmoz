import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { ensureQuotationAttachmentsBucket, QUOTATION_ATTACHMENTS_BUCKET, getAttachmentSignedUrl } from '@/lib/quotation-attachments-bucket';
import { compressImageToMaxSize } from '@/lib/image-compress';
import { notifyQuoteTeam } from '@/lib/notify-quote-team';
import { comprovativoValido, COMPROVATIVO_ERRO } from '@/lib/comprovativo-ficheiro';
import { resolveCheckoutActor } from '@/lib/checkout-actor';
import { avisarClienteCompra } from '@/lib/notify-checkout-client';
import { referenciaPedido } from '@/lib/checkout-referencia';
import { garantirPedidosSemConta } from '@/lib/checkout-schema';
import { cadastroDoPedido, destinatarioDoPedido, donoDoPedidoAoAprovar, tokenDoPedidoConfere } from '@/lib/pedido-sem-conta';
import { decryptDaSecret } from '@/lib/da-credential-store';
import { promoteBuyerAfterPurchase } from '@/lib/checkout-fulfillment';

const MAX_SIZE_BYTES = 10 * 1024 * 1024;

// Comprovativo de pagamento manual (M-Pesa/Transferência) de uma compra nova
// do carrinho — mesmo bucket usado para comprovativos de renovação/cotação.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 });
  }

  await garantirPedidosSemConta(admin);

  const { id } = await params;

  const { data: session, error: sessionError } = await admin
    .from('checkout_sessions')
    .select('id, user_id, status, items, total_mt, metodo_pagamento, comprovativo_url, cadastro, token_acesso')
    .eq('id', id)
    .single();
  if (sessionError || !session) {
    return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 });
  }

  const form = await request.formData();
  if (!session.user_id) {
    // pedido de quem ainda não tem conta: vale a chave que o navegador guardou ao criar o pedido
    if (!tokenDoPedidoConfere(session.token_acesso, form.get('token'))) {
      return NextResponse.json({ error: 'Não tem permissão para editar este pedido.' }, { status: 403 });
    }
  } else if (!user) {
    return NextResponse.json({ error: 'Faça login para continuar.' }, { status: 401 });
  } else if (session.user_id !== user.id) {
    // o dono do pedido; ou um administrador a comprar «em nome de» essa conta (entrar como), cujo pedido fica na conta imitada
    const actor = await resolveCheckoutActor(admin, user);
    if (actor.buyerUserId !== session.user_id) {
      return NextResponse.json({ error: 'Não tem permissão para editar este pedido.' }, { status: 403 });
    }
  }
  if (session.status !== 'pending') {
    return NextResponse.json({ error: 'Este pedido já foi respondido pela equipa.' }, { status: 409 });
  }

  const file = form.get('file') as File | null;
  if (!file) {
    return NextResponse.json({ error: 'Ficheiro em falta.' }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'Ficheiro demasiado grande (máx. 10MB).' }, { status: 400 });
  }
  if (!comprovativoValido(file)) {
    return NextResponse.json({ error: COMPROVATIVO_ERRO }, { status: 400 });
  }

  await ensureQuotationAttachmentsBucket();

  const ext = file.name.split('.').pop() || 'bin';
  const baseName = file.name.replace(/\.[^/.]+$/, '');
  const safeName = baseName.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  const path = `checkout/${id}/${Date.now()}-${safeName}.${ext}`;

  const bytes = await file.arrayBuffer();
  const { buffer, contentType } = await compressImageToMaxSize(
    Buffer.from(bytes),
    file.type || 'application/octet-stream',
  );

  const { data: uploadData, error: uploadError } = await admin.storage
    .from(QUOTATION_ATTACHMENTS_BUCKET)
    .upload(path, buffer, { contentType, upsert: false });
  if (uploadError) {
    console.error('[checkout comprovativo] upload error:', uploadError);
    return NextResponse.json({ error: 'Não foi possível enviar o ficheiro.' }, { status: 500 });
  }

  // #11: grava o caminho no bucket, não um URL público — o bucket é privado
  // agora, o URL para mostrar/descarregar é sempre gerado na hora (assinado,
  // temporário), nunca guardado permanentemente.
  const { data: updated, error: updateError } = await admin
    .from('checkout_sessions')
    .update({ comprovativo_url: uploadData.path, rejection_reason: null })
    .eq('id', id)
    .select()
    .single();
  if (updateError) {
    console.error('[checkout comprovativo] update error:', updateError);
    return NextResponse.json({ error: 'Não foi possível registar o comprovativo.' }, { status: 500 });
  }

  // Pedido de quem ainda não tinha conta: com o comprovativo enviado, a pessoa passa a ter o login do site (para entrar no painel,
  // onde espera pela confirmação com o plano ainda fechado). A conta de hospedagem no servidor só nasce quando a equipa confirma.
  let donoId: string | null = session.user_id || null;
  let sessaoIniciada = Boolean(user);
  if (!donoId) {
    try {
      const cad = cadastroDoPedido(session);
      const senha = cad?.senha ? decryptDaSecret(cad.senha) : '';
      const dono = await donoDoPedidoAoAprovar(admin, session);
      donoId = dono.userId;
      await promoteBuyerAfterPurchase(admin, donoId, Array.isArray(session.items) ? session.items : []).catch((err) =>
        console.error('[checkout comprovativo] promoteBuyerAfterPurchase falhou:', err),
      );
      if (dono.contaCriada && cad && senha) {
        const { error: erroEntrada } = await supabase.auth.signInWithPassword({ email: cad.email, password: senha });
        sessaoIniciada = !erroEntrada;
      }
    } catch (err) {
      console.error('[checkout comprovativo] não foi possível criar o login do cliente:', err);
    }
  }

  // Só agora o pedido é "novo" para a equipa: o cliente já pagou e enviou o comprovativo. Avisa uma vez
  // (um segundo envio do mesmo pedido substitui o ficheiro, sem repetir o aviso).
  if (!session.comprovativo_url) {
    const nomes = (Array.isArray(session.items) ? session.items : []).map((i: { name?: string }) => i.name).filter(Boolean).join(', ');
    notifyQuoteTeam({
      title: 'Novo comprovativo de pagamento (checkout)',
      message: `${user?.email || destinatarioDoPedido(session)?.email || 'O cliente'} enviou o comprovativo do pedido ${referenciaPedido(id)}: ${nomes || 'um pedido'} (${session.total_mt} MT) via ${
        session.metodo_pagamento === 'mpesa' ? 'M-Pesa' : 'Transferência Bancária'
      }. Aguarda confirmação da equipa.`,
      link: `${process.env.NEXT_PUBLIC_SITE_URL || ''}/vhost:2026`,
    }).catch((err) => console.error('[checkout comprovativo] falha ao notificar equipa:', err));
  }
  // o cliente fica a saber que o comprovativo chegou (também ao reenviar depois de um pedido de novo comprovativo)
  avisarClienteCompra({
    userId: donoId,
    para: destinatarioDoPedido(session),
    evento: 'comprovativo',
    pedido: { id, total_mt: Number(session.total_mt) || 0, metodo_pagamento: session.metodo_pagamento, items: Array.isArray(session.items) ? session.items : [] },
  }).catch(() => {});

  const signedUrl = await getAttachmentSignedUrl(updated.comprovativo_url);
  const { token_acesso: _t, cadastro: _c, ...semSegredos } = updated;
  void _t;
  void _c;
  return NextResponse.json({ success: true, sessaoIniciada, session: { ...semSegredos, comprovativo_url: signedUrl } });
}
