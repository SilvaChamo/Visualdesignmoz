import { getEmailPlan } from '@/lib/email-plans';
import { chavePacote } from '@/lib/pacote-nome';

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

/** Pacotes de recurso, por ordem, para quando o do plano ainda não existe no servidor. */
const PACOTES_DE_RECURSO = ['VisualDESIGN', 'default'];

/**
 * O pacote como existe no servidor: o mesmo pacote com o nome novo ou o antigo (ver `chavePacote`). Se não existir, usa o primeiro
 * pacote de recurso que exista; sem nenhum, o primeiro da lista. `reais` vazio = não foi possível ler o servidor: fica o pedido, que
 * o servidor aceita ou recusa.
 */
export function pacoteNoServidor(pedido: string, reais: Iterable<string>): { nome: string; recurso: boolean } {
  const porChave = new Map([...reais].map((n) => [chavePacote(n), n]));
  if (!porChave.size) return { nome: pedido, recurso: false };
  const igual = porChave.get(chavePacote(pedido));
  if (igual) return { nome: igual, recurso: false };
  const recurso = PACOTES_DE_RECURSO.map((n) => porChave.get(chavePacote(n))).find(Boolean);
  return { nome: recurso || [...porChave.values()][0], recurso: true };
}
