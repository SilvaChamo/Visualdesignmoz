import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { acrescentarIva } from '@/lib/iva';
import { resolveCartItems, toValidatedCartItems, type CatalogCartItem } from '@/lib/package-catalog';
import { validarContasDeHospedagem } from '@/lib/conta-hospedagem-servidor';
import { mensagemContaExiste, senhaConfere, temContaReal, utilizadorPorEmail } from '@/lib/conta-existe';
import { garantirPedidosSemConta } from '@/lib/checkout-schema';
import { mensagemEmailInvalido } from '@/lib/email-valido';
import { cifrarSenhaPedido, novoTokenPedido, tokenDoPedidoConfere, type CadastroPedido } from '@/lib/pedido-sem-conta';

const VALID_METHODS = ['mpesa', 'transferencia'];

/**
 * POST /api/checkout/pedido-sem-conta — «Pagar» por M-Pesa/Transferência de quem ainda não tem conta. Não cria login, conta no
 * servidor nem hospedagem: grava o pedido sem dono, com os dados digitados, e devolve a chave com que o navegador envia o
 * comprovativo. Tudo o resto nasce quando a equipa aprova (ver lib/pedido-sem-conta.ts).
 * Corpo: { items, metodoPagamento, dados: { nome, apelido, email, telefone, morada, provincia, empresa }, senha, anterior?: { id, token } }
 */
export async function POST(request: NextRequest) {
  try {
    const admin = getSupabaseAdmin();
    if (!admin) return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 });

    await garantirPedidosSemConta(admin);

    const body = await request.json().catch(() => ({}));
    const items: CatalogCartItem[] = Array.isArray(body.items) ? body.items : [];
    const metodoPagamento = String(body.metodoPagamento || '');
    const d = (body.dados || {}) as Record<string, unknown>;
    const texto = (v: unknown, max = 200) => String(v ?? '').trim().slice(0, max);
    const dados: Omit<CadastroPedido, 'senha'> = {
      nome: texto(d.nome, 80),
      apelido: texto(d.apelido, 80),
      email: texto(d.email, 160).toLowerCase(),
      telefone: texto(d.telefone, 30),
      morada: texto(d.morada),
      provincia: texto(d.provincia, 60),
      empresa: texto(d.empresa, 120),
      emailEmpresa: texto(d.emailEmpresa, 160).toLowerCase(),
      cargo: texto(d.cargo, 80),
    };
    const senha = String(body.senha || '');

    if (!VALID_METHODS.includes(metodoPagamento)) return NextResponse.json({ error: 'Método de pagamento inválido.' }, { status: 400 });
    if (items.length === 0) return NextResponse.json({ error: 'Carrinho vazio.' }, { status: 400 });
    if (!dados.nome) return NextResponse.json({ error: 'Por favor, preencha o seu Nome.' }, { status: 400 });
    const erroEmail = mensagemEmailInvalido(dados.email, 'O e-mail da pessoa responsável');
    if (erroEmail) return NextResponse.json({ error: erroEmail }, { status: 400 });
    const erroEmailEmpresa = dados.emailEmpresa ? mensagemEmailInvalido(dados.emailEmpresa, 'O e-mail da empresa') : null;
    if (erroEmailEmpresa) return NextResponse.json({ error: erroEmailEmpresa }, { status: 400 });
    if (!dados.telefone || !dados.morada || !dados.provincia) {
      return NextResponse.json({ error: 'Indique o telefone, a morada e a província: são os dados da conta e, nos domínios, do registo oficial (WHOIS).' }, { status: 400 });
    }
    if (senha.length < 6 || senha.length > 20) return NextResponse.json({ error: 'A palavra-passe deve ter entre 6 e 20 caracteres.' }, { status: 400 });
    // Só o essencial e tudo ao mesmo tempo (o «Pagar» demorava uma eternidade): preços, e-mail e nome da conta em paralelo.
    const [existente, { resolved, rejected }] = await Promise.all([utilizadorPorEmail(admin, dados.email), resolveCartItems(items)]);
    if (rejected.length > 0) {
      return NextResponse.json(
        { error: `Não foi possível validar o preço de: ${rejected.map((i) => i.name).join(', ')}. Remova estes itens do carrinho e tente novamente.` },
        { status: 400 },
      );
    }
    // O mesmo e-mail pode ter muitas contas (Silva, 30/10/2026): um login vazio (sem hospedagem, sem compras) não ocupa o e-mail, e
    // quem já tem conta a sério compra outra com a sua palavra-passe. Só se recusa o que não se pode provar que é da pessoa.
    if (existente && (await temContaReal(admin, existente)) && !(await senhaConfere(dados.email, senha))) {
      return NextResponse.json({ error: mensagemContaExiste(dados.email, 'responsavel') }, { status: 409 });
    }
    const itensValidados = toValidatedCartItems(resolved);
    const erroConta = await validarContasDeHospedagem(admin, itensValidados, { email: dados.email });
    if (erroConta) return NextResponse.json({ error: erroConta }, { status: 400 });

    const { totalMt } = acrescentarIva(resolved.reduce((sum, r) => sum + r.priceMt, 0));
    const cadastro: CadastroPedido = { ...dados, senha: cifrarSenhaPedido(senha) };

    // Voltou atrás e clicou outra vez em «Pagar»: o pedido que este navegador já tinha (ainda sem comprovativo) é actualizado,
    // em vez de nascer outro.
    const anterior = body.anterior as { id?: string; token?: string } | undefined;
    if (anterior?.id) {
      const { data: velho } = await admin
        .from('checkout_sessions')
        .select('id, token_acesso, status, comprovativo_url, user_id')
        .eq('id', String(anterior.id))
        .maybeSingle();
      if (velho && !velho.user_id && velho.status === 'pending' && !velho.comprovativo_url && tokenDoPedidoConfere(velho.token_acesso, anterior.token)) {
        const { data: actualizado, error } = await admin
          .from('checkout_sessions')
          .update({ items: itensValidados, total_mt: totalMt, metodo_pagamento: metodoPagamento, cadastro })
          .eq('id', velho.id)
          .select('id, status, items, total_mt, metodo_pagamento, comprovativo_url, rejection_reason')
          .single();
        if (!error && actualizado) return NextResponse.json({ success: true, session: actualizado, token: String(anterior.token) });
      }
    }

    const token = novoTokenPedido();
    const { data: session, error } = await admin
      .from('checkout_sessions')
      .insert({
        user_id: null,
        items: itensValidados,
        total_mt: totalMt,
        currency: 'mzn',
        status: 'pending',
        metodo_pagamento: metodoPagamento,
        cadastro,
        token_acesso: token,
      })
      .select('id, status, items, total_mt, metodo_pagamento, comprovativo_url, rejection_reason')
      .single();
    if (error || !session) {
      console.error('[checkout/pedido-sem-conta] insert error:', error);
      // no projecto local, a causa habitual é a base de dados ainda não ter a alteração deste fluxo
      const dica = process.env.NODE_ENV !== 'production' ? ' (confirme que a base de dados tem a alteração supabase-checkout-sessions-sem-conta.sql)' : '';
      return NextResponse.json({ error: 'Não foi possível iniciar o pedido.' + dica }, { status: 500 });
    }
    return NextResponse.json({ success: true, session, token });
  } catch (error: unknown) {
    console.error('[checkout/pedido-sem-conta] error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro interno' }, { status: 500 });
  }
}
