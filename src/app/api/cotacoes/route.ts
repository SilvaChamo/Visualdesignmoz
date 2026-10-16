import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { findItem, formatMt, CUSTOM_CATEGORIA_ID } from '@/lib/pricing-catalog';
import { notifyQuoteTeam } from '@/lib/notify-quote-team';
import { resolveRoleForAuthUser } from '@/lib/server-auth-role';
import { resolveEffectiveClientUserId } from '@/lib/client-impersonation';
import { computeUnreadByBatch } from '@/lib/quotation-unread';

const VALID_PAYMENT_METHODS = ['mpesa', 'transferencia'];

// Lista as cotações do próprio utilizador autenticado — usada no painel da
// conta para mostrar o que já foi submetido, sem expor cotações de outros clientes.
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Faça login para ver as suas cotações.' }, { status: 401 });
    }

    // Um admin a "entrar" como cliente (ver src/lib/client-impersonation.ts)
    // continua autenticado como si próprio — só troca o user_id usado neste
    // filtro, nunca a sessão. Por isso o papel tem de vir sempre da conta
    // real, nunca confiar só na presença da cookie.
    const role = await resolveRoleForAuthUser(supabase, user);
    const effectiveUserId = await resolveEffectiveClientUserId(user.id, role === 'admin');

    const admin = getSupabaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Não foi possível carregar as cotações.' }, { status: 503 });
    }

    // Os campos de empresa/responsável vão incluídos (são só do próprio
    // utilizador, filtrado por user_id) para permitir reaproveitar os dados
    // da última encomenda ao pedir uma nova a partir do painel — sem ter de
    // preencher tudo outra vez.
    const { data: quotations, error } = await admin
      .from('quotation_requests')
      .select(
        'id, batch_id, categoria_id, categoria_label, produto, quantidade, total_mt, sob_consulta, status, data_limite_entrega, metodo_pagamento, remanescente_metodo_pagamento, created_at, empresa, nif, endereco, telefone_institucional, email_institucional, website, responsavel, cargo, telefone, email',
      )
      .eq('user_id', effectiveUserId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[cotacoes] list error:', error);
      return NextResponse.json({ error: 'Não foi possível carregar as cotações.' }, { status: 500 });
    }

    // Quantas mensagens da equipa ficaram por responder, por encomenda —
    // alimenta a bolinha vermelha na aba "Mensagens" do painel do cliente.
    const unreadByBatch = await computeUnreadByBatch(admin, quotations || [], 'admin');
    const unreadTotal = Object.values(unreadByBatch).reduce((sum, n) => sum + n, 0);

    return NextResponse.json({ success: true, quotations: quotations || [], unreadByBatch, unreadTotal });
  } catch (error: unknown) {
    console.error('[cotacoes] list error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Faça login para pedir uma cotação.' }, { status: 401 });
    }

    const body = await request.json();
    const {
      empresa,
      nif,
      endereco,
      telefoneInstitucional,
      emailInstitucional,
      website,
      responsavel,
      cargo,
      telefone,
      email,
      itens,
      dataLimiteEntrega,
      notas,
      metodoPagamento: rawMetodoPagamento,
    } = body ?? {};

    // Vem do checkout único (/checkout?encomenda=1): a encomenda só é gravada
    // depois de o cliente escolher como paga, por isso já nasce com o método
    // registado — mesmo efeito de /api/cotacoes/[id]/pagamento, sem um segundo
    // pedido que podia falhar e deixar uma encomenda órfã por pagar.
    if (rawMetodoPagamento !== undefined && rawMetodoPagamento !== null && !VALID_PAYMENT_METHODS.includes(rawMetodoPagamento)) {
      return NextResponse.json({ error: 'Método de pagamento inválido.' }, { status: 400 });
    }

    if (
      !empresa ||
      !telefoneInstitucional ||
      !emailInstitucional ||
      !responsavel ||
      !telefone ||
      !email ||
      !Array.isArray(itens) ||
      itens.length === 0 ||
      !dataLimiteEntrega
    ) {
      return NextResponse.json({ error: 'Preencha todos os campos obrigatórios.' }, { status: 400 });
    }

    const dataLimite = new Date(dataLimiteEntrega);
    if (Number.isNaN(dataLimite.getTime())) {
      return NextResponse.json({ error: 'Data-limite de entrega inválida.' }, { status: 400 });
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (dataLimite < today) {
      return NextResponse.json({ error: 'A data-limite de entrega não pode ser no passado.' }, { status: 400 });
    }

    // Cada serviço seleccionado (possivelmente vários, de /precos) vira a sua
    // própria linha em quotation_requests — cada um com a sua quantidade e
    // preço, mas a partilhar os dados da empresa/responsável.
    const validatedItems: {
      categoriaId: string;
      categoriaLabel: string;
      produto: string;
      precoUnitario: number;
      quantidadeNum: number;
      sobConsulta: boolean;
      totalMt: number;
    }[] = [];
    for (const raw of itens) {
      const quantidadeNum = Math.round(Number(raw?.quantidade));
      if (!Number.isFinite(quantidadeNum) || quantidadeNum <= 0) {
        return NextResponse.json({ error: 'Quantidade inválida.' }, { status: 400 });
      }

      // Pedido personalizado — não está no catálogo, o "produto" é a
      // descrição livre escrita pelo cliente; preço sempre por contacto.
      if (raw?.categoriaId === CUSTOM_CATEGORIA_ID) {
        const descricao = String(raw?.produto || '').trim();
        if (!descricao) {
          return NextResponse.json({ error: 'Descreva o pedido personalizado.' }, { status: 400 });
        }
        if (descricao.length > 255) {
          return NextResponse.json({ error: 'A descrição do pedido personalizado é demasiado longa (máx. 255 caracteres).' }, { status: 400 });
        }
        validatedItems.push({
          categoriaId: CUSTOM_CATEGORIA_ID,
          categoriaLabel: 'Pedido Personalizado',
          produto: descricao,
          precoUnitario: 0,
          quantidadeNum,
          sobConsulta: true,
          totalMt: 0,
        });
        continue;
      }

      const found = findItem(raw?.categoriaId, raw?.produto);
      if (!found) {
        return NextResponse.json({ error: 'Produto ou categoria não reconhecidos.' }, { status: 400 });
      }
      // Sem preço fixo (ex.: serviços de outras marcas ainda "Sob Consulta") — não
      // faz sentido calcular um total nem exigir adiantamento de 70% sobre nada.
      const sobConsulta = Boolean(found.item.sobConsulta);
      const totalMt = sobConsulta ? 0 : Math.round(found.item.price * quantidadeNum * 100) / 100;
      validatedItems.push({
        categoriaId: found.category.id,
        categoriaLabel: found.category.label,
        produto: found.item.name,
        precoUnitario: found.item.price,
        quantidadeNum,
        sobConsulta,
        totalMt,
      });
    }

    const admin = getSupabaseAdmin();
    if (!admin) {
      console.error('[cotacoes] Supabase service role não configurado.');
      return NextResponse.json({ error: 'Não foi possível gerar a cotação. Tente novamente mais tarde.' }, { status: 503 });
    }

    // Todas as linhas desta submissão partilham o mesmo batch_id — é o que
    // as torna "uma encomenda só", mesmo que incluam serviços de categorias
    // diferentes (ex.: cartões + webdesign na mesma cotação).
    const batchId = crypto.randomUUID();

    // Só faz sentido registar o pagamento se houver algum valor fixo a pagar —
    // uma encomenda só com itens Sob Consulta continua 'pending' (aguarda
    // contacto), tal como a página de pagamento já a ignorava.
    const metodoPagamento =
      rawMetodoPagamento && validatedItems.some((i) => !i.sobConsulta) ? (rawMetodoPagamento as string) : null;

    const rows = validatedItems.map(({ categoriaId, categoriaLabel, produto, precoUnitario, quantidadeNum, sobConsulta, totalMt }) => ({
      user_id: user.id,
      batch_id: batchId,
      empresa,
      nif: nif || null,
      endereco: endereco || null,
      telefone_institucional: telefoneInstitucional,
      email_institucional: emailInstitucional,
      website: website || null,
      responsavel,
      cargo: cargo || null,
      telefone,
      email,
      categoria_id: categoriaId,
      categoria_label: categoriaLabel,
      produto,
      preco_unitario_mt: precoUnitario,
      quantidade: quantidadeNum,
      data_limite_entrega: dataLimiteEntrega,
      total_mt: totalMt,
      sob_consulta: sobConsulta,
      sob_consulta_original: sobConsulta,
      notas: notas || null,
      status: metodoPagamento ? 'payment_selected' : 'pending',
      metodo_pagamento: metodoPagamento,
    }));

    const { data: quotations, error: insertError } = await admin
      .from('quotation_requests')
      .insert(rows)
      .select();

    if (insertError || !quotations || quotations.length !== rows.length) {
      console.error('[cotacoes] insert error:', insertError);
      return NextResponse.json({ error: 'Não foi possível gerar a cotação.' }, { status: 500 });
    }

    const resumo = validatedItems
      .map(({ categoriaLabel, produto, quantidadeNum, sobConsulta, totalMt }) =>
        `"${produto}" (${categoriaLabel}) x${quantidadeNum}${sobConsulta ? ' — Sob Consulta' : ` — ${formatMt(totalMt)} MT`}`
      )
      .join('; ');

    // Não aguardar o envio do email — a notificação à equipa é um efeito
    // secundário; se o SMTP estiver lento/em baixo, o cliente não deve ficar
    // à espera nem arriscar ver o pedido falhar por causa disso.
    const pagamentoNota = metodoPagamento
      ? ` Vai pagar o adiantamento por ${metodoPagamento === 'mpesa' ? 'M-Pesa' : 'Transferência Bancária'} — o comprovativo chega à Contabilidade › Encomendas.`
      : '';
    notifyQuoteTeam({
      title: validatedItems.length > 1 ? `Nova cotação recebida (${validatedItems.length} serviços)` : 'Nova cotação recebida',
      message: `${empresa} (${responsavel}) pediu cotação: ${resumo}. Contacto: ${telefone} / ${email}. Entrega pretendida até ${dataLimiteEntrega}.${pagamentoNota}`,
      link: `${process.env.NEXT_PUBLIC_SITE_URL || ''}/dashboard?section=cotacoes`,
    }).catch((err) => console.error('[cotacoes] falha ao notificar equipa:', err));

    // O primeiro id serve de âncora da encomenda (anexos/mensagens agregam
    // todas as linhas do mesmo batch — ver resolveQuotationAccess).
    return NextResponse.json({ success: true, id: quotations[0].id, ids: quotations.map((q) => q.id), batchId, metodoPagamento });
  } catch (error: unknown) {
    // Nunca expor a mensagem interna (ex.: "fetch failed" de uma falha de rede
    // a chegar ao Supabase) — o cliente só precisa de saber que falhou e que
    // pode tentar de novo.
    console.error('[cotacoes] error:', error);
    return NextResponse.json(
      { success: false, error: 'Não foi possível submeter o pedido. Tente novamente em instantes.' },
      { status: 500 },
    );
  }
}
