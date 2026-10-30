import { getEmailPlan } from '@/lib/email-plans';
import { chavePacote, familiaDoPacote } from '@/lib/pacote-nome';

/**
 * Que pacote do servidor corresponde a cada produto do carrinho. Fonte única: a activação da compra
 * (checkout-fulfillment) e o painel de quem ainda espera pela confirmação (vhost-compra-pendente) usam a mesma tabela,
 * para o cliente ver, desde o primeiro momento, o painel do pacote que pagou.
 */
// Pacote dedicado por plano de hospedagem — tem de corresponder aos `defaultPackageName` de HOSTING_PLAN_PRESETS em
// reseller-package-form.ts, que é o que a secção «Pacotes» do admin cria de facto no servidor.
export const PACOTES_HOSPEDAGEM: Record<string, string> = {
  'hosting-basico': 'vhost-basico',
  'hosting-pro': 'vhost-pro',
  'hosting-business': 'vhost-business',
  'hosting-enterprise': 'vhost-enterprise',
};

/** Quem compra só um domínio fica numa conta sem sites nem e-mail (ver domain-only-provision). */
export const PACOTE_SO_DOMINIO = 'vhost-dominio';

/** Pacote de um item do carrinho; null para o que não cria conta própria (SSL…). */
export function pacoteDoItem(item: { type: string; id?: string }): string | null {
  if (item.type === 'hosting') return PACOTES_HOSPEDAGEM[String(item.id || '')] || null;
  if (item.type === 'email') return getEmailPlan(String(item.id || ''))?.hestiaPackage || null;
  if (item.type === 'domain') return PACOTE_SO_DOMINIO;
  return null;
}

export type PacoteProcurado = { nome: string } | { erro: string };

/**
 * Procura, entre os pacotes que já existem no servidor, o que corresponde ao pedido (ex.: `vhost-pro`). Nunca cria nada nem cai num
 * pacote de recurso (Silva, 30/10/2026: «não pode criar um e não pode ir para o VisualDESIGN»):
 *  1. o mesmo nome (maiúsculas, `_` e o prefixo antigo `VD-` não contam);
 *  2. senão, o único pacote da mesma família (hospedagem, e-mail, domínio) com a palavra final do plano no nome (`pro` → `vhost-hosting-pro`);
 *  3. senão, um erro que diz o que existe, para a equipa escolher.
 * `reais` vazio = não foi possível ler o servidor: fica o nome pedido, que o servidor aceita ou recusa.
 */
export function procurarPacote(pedido: string, reais: Iterable<string>): PacoteProcurado {
  const lista = [...reais];
  if (!lista.length) return { nome: pedido };
  const chave = chavePacote(pedido);
  const igual = lista.find((n) => chavePacote(n) === chave);
  if (igual) return { nome: igual };
  const familia = familiaDoPacote(pedido);
  const palavra = chave.split('-').pop() || '';
  const parecidos = familia && palavra ? lista.filter((n) => familiaDoPacote(n) === familia && chavePacote(n).split('-').includes(palavra)) : [];
  if (parecidos.length === 1) return { nome: parecidos[0] };
  const daFamilia = lista.filter((n) => (familia ? familiaDoPacote(n) === familia : true) && chavePacote(n) !== 'default' && chavePacote(n) !== 'visualdesign');
  const existentes = daFamilia.length ? daFamilia.join(', ') : lista.join(', ');
  return {
    erro: parecidos.length
      ? `Há vários pacotes que podem ser o "${pedido}": ${parecidos.join(', ')}. Deixe só um com o nome "${pedido}" em Admin › Pacotes.`
      : `Não existe no servidor o pacote "${pedido}". Pacotes existentes: ${existentes}. Crie ou renomeie um para "${pedido}" em Admin › Pacotes e confirme outra vez.`,
  };
}
