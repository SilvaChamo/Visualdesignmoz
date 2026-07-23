import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { findItem, formatMt, CUSTOM_CATEGORIA_ID } from '@/lib/pricing-catalog';
import { notifyQuoteTeam } from '@/lib/notify-quote-team';

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

    const admin = getSupabaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Não foi possível carregar as cotações.' }, { status: 503 });
    }

    const { data: quotations, error } = await admin
      .from('quotation_requests')
      .select('id, categoria_label, produto, quantidade, total_mt, sob_consulta, status, data_limite_entrega, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[cotacoes] list error:', error);
      return NextResponse.json({ error: 'Não foi possível carregar as cotações.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, quotations: quotations || [] });
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
    } = body ?? {};

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

    const rows = validatedItems.map(({ categoriaId, categoriaLabel, produto, precoUnitario, quantidadeNum, sobConsulta, totalMt }) => ({
      user_id: user.id,
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
      notas: notas || null,
      status: 'pending',
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

    await notifyQuoteTeam({
      title: validatedItems.length > 1 ? `Nova cotação recebida (${validatedItems.length} serviços)` : 'Nova cotação recebida',
      message: `${empresa} (${responsavel}) pediu cotação: ${resumo}. Contacto: ${telefone} / ${email}. Entrega pretendida até ${dataLimiteEntrega}.`,
      link: `${process.env.NEXT_PUBLIC_SITE_URL || ''}/dashboard?section=cotacoes`,
    });

    return NextResponse.json({ success: true, id: quotations[0].id, ids: quotations.map((q) => q.id) });
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
