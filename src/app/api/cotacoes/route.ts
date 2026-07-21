import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { findItem } from '@/lib/pricing-catalog';

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
      .select('id, categoria_label, produto, quantidade, total_mt, status, data_limite_entrega, created_at')
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
      categoriaId,
      produto,
      quantidade,
      dataLimiteEntrega,
    } = body ?? {};

    if (
      !empresa ||
      !telefoneInstitucional ||
      !emailInstitucional ||
      !responsavel ||
      !telefone ||
      !email ||
      !categoriaId ||
      !produto ||
      !dataLimiteEntrega
    ) {
      return NextResponse.json({ error: 'Preencha todos os campos obrigatórios.' }, { status: 400 });
    }

    const quantidadeNum = Math.round(Number(quantidade));
    if (!Number.isFinite(quantidadeNum) || quantidadeNum <= 0) {
      return NextResponse.json({ error: 'Quantidade inválida.' }, { status: 400 });
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

    const found = findItem(categoriaId, produto);
    if (!found) {
      return NextResponse.json({ error: 'Produto ou categoria não reconhecidos.' }, { status: 400 });
    }

    const totalMt = Math.round(found.item.price * quantidadeNum * 100) / 100;

    const admin = getSupabaseAdmin();
    if (!admin) {
      console.error('[cotacoes] Supabase service role não configurado.');
      return NextResponse.json({ error: 'Não foi possível gerar a cotação. Tente novamente mais tarde.' }, { status: 503 });
    }

    const { data: quotation, error: insertError } = await admin
      .from('quotation_requests')
      .insert({
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
        categoria_id: found.category.id,
        categoria_label: found.category.label,
        produto: found.item.name,
        preco_unitario_mt: found.item.price,
        quantidade: quantidadeNum,
        data_limite_entrega: dataLimiteEntrega,
        total_mt: totalMt,
        status: 'pending',
      })
      .select()
      .single();

    if (insertError || !quotation) {
      console.error('[cotacoes] insert error:', insertError);
      return NextResponse.json({ error: 'Não foi possível gerar a cotação.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: quotation.id });
  } catch (error: unknown) {
    console.error('[cotacoes] error:', error);
    const message = error instanceof Error ? error.message : 'Erro interno';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
