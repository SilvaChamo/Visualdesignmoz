/**
 * Quem acabou de comprar e ainda não tem conta no servidor entra no painel certo para o que comprou, com as configurações
 * fechadas até o serviço estar pronto (Silva, 29/10/2026):
 *  - só domínio → o painel só do domínio (com as outras ofertas);
 *  - hospedagem ou e-mail → o painel do pacote pago;
 *  - pagamento manual (M-Pesa/Transferência) → «a aguardar a confirmação» até a equipa confirmar o comprovativo;
 *  - pagamento automático (cartão, saldo) → «a preparar o serviço» durante os segundos que o servidor demora a criar a conta.
 * Não cria nada: só lê as compras do utilizador e diz qual é o pacote e em que fase está.
 */
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { pacoteDoItem } from '@/lib/pacotes-compra';

export type CompraPendente = {
  tipo: 'hospedagem' | 'email' | 'dominio';
  aguarda: 'pagamento' | 'preparacao';
  /** Pacote do servidor que o cliente comprou (ex.: VD-Host-Pro) */
  pacote: string;
  /** Nome do plano como o cliente o viu no carrinho */
  plano: string;
  dominios: string[];
};

type ItemPedido = { type?: string; id?: string; name?: string; hostingDomain?: string | null; status?: string };

/** Uma compra paga recentemente ainda pode estar a ser activada; passado este tempo já é um problema para a equipa, não uma espera. */
const PREPARACAO_MAX_MS = 24 * 60 * 60 * 1000;
/** Pedido por cartão ainda «pending»: tolera-se este tempo à espera do aviso de pagamento. */
const CARTAO_MAX_MS = 2 * 60 * 60 * 1000;
const PRIORIDADE: Record<CompraPendente['tipo'], number> = { hospedagem: 3, email: 2, dominio: 1 };

export async function lerCompraPendente(userId: string): Promise<CompraPendente | null> {
  const admin = getSupabaseAdmin();
  if (!admin || !userId) return null;
  const { data, error } = await admin
    .from('checkout_sessions')
    .select('id, status, items, created_at, fulfilled_at, metodo_pagamento')
    .eq('user_id', userId)
    .in('status', ['pending', 'paid'])
    .order('created_at', { ascending: false })
    .limit(20);
  if (error || !data) return null;

  let melhor: CompraPendente | null = null;
  for (const sessao of data) {
    const itens = (Array.isArray(sessao.items) ? sessao.items : []) as ItemPedido[];
    const recente = Date.now() - new Date(sessao.fulfilled_at || sessao.created_at).getTime() < PREPARACAO_MAX_MS;
    // cartão: o pedido fica «pending» só até o aviso do pagamento chegar (segundos); não é uma espera pela equipa.
    // Uma página de cartão abandonada há horas não conta.
    const porCartao = sessao.status === 'pending' && sessao.metodo_pagamento === 'stripe';
    if (porCartao && Date.now() - new Date(sessao.created_at).getTime() > CARTAO_MAX_MS) continue;
    // pedido por confirmar: os itens ainda sem decisão; pedido pago: os itens pagos que ainda estão a ser criados no servidor
    const doPedido = itens.filter((i) => {
      const estado = i.status ?? sessao.status;
      return sessao.status === 'pending' ? estado === 'pending' : estado === 'paid' && recente;
    });
    if (!doPedido.length) continue;
    const aguarda: CompraPendente['aguarda'] = sessao.status === 'pending' && !porCartao ? 'pagamento' : 'preparacao';
    const dominiosDoPedido = Array.from(
      new Set(
        itens
          .flatMap((i) => (i.type === 'domain' ? [i.name] : i.type === 'hosting' || i.type === 'email' ? [i.hostingDomain] : []))
          .map((d) => String(d || '').toLowerCase().trim())
          .filter(Boolean),
      ),
    );
    for (const item of doPedido) {
      const pacote = pacoteDoItem({ type: String(item.type || ''), id: item.id });
      const tipo = item.type === 'hosting' ? 'hospedagem' : item.type === 'email' ? 'email' : item.type === 'domain' ? 'dominio' : null;
      if (!pacote || !tipo) continue;
      if (!melhor || PRIORIDADE[tipo] > PRIORIDADE[melhor.tipo]) {
        melhor = { tipo, aguarda, pacote, plano: String(item.name || pacote), dominios: dominiosDoPedido };
      }
    }
  }
  return melhor;
}
