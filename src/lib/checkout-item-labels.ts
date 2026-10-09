/**
 * Como se descreve um item do carrinho (checkout_sessions.items) ao cliente —
 * partilhado pela tabela "As Minhas Compras" e pelo Recibo, para os dois
 * dizerem exactamente o mesmo.
 */

export type CheckoutItemLike = {
  name?: string;
  type?: string;
  price?: number;
  period?: number;
  hostingDomain?: string | null;
  status?: string;
};

export const CHECKOUT_ITEM_TYPE_LABELS: Record<string, string> = {
  domain: 'Registo de domínio',
  hosting: 'Hospedagem web',
  email: 'Plano de e-mail',
  ssl: 'Certificado SSL',
};

/** Domínios registam-se por anos; hospedagem e email têm ciclos em meses (ver checkout). */
export function checkoutItemPeriod(item: CheckoutItemLike): string | null {
  const n = Number(item.period);
  if (!n || n < 1) return null;
  if (item.type === 'domain') return `${n} ${n === 1 ? 'ano' : 'anos'}`;
  if (n === 1) return 'Mensal';
  if (n === 6) return 'Semestral';
  if (n === 12) return 'Anual';
  if (n % 12 === 0) return `${n / 12} anos`;
  return `${n} meses`;
}

/** O produto comprado tal como aparece no Recibo (ex.: "Alojamento Web Pro — meusite.co.mz"). */
export function checkoutItemDetail(item: CheckoutItemLike): string {
  if (item.type === 'hosting' && item.hostingDomain) return `${item.name || ''} — ${item.hostingDomain}`;
  return item.name || '—';
}

/**
 * Uma linha com o plano e o ciclo — "Email Básico · Mensal",
 * "Alojamento Web Pro · Anual — meusite.co.mz", "Domínio meusite.co.mz · 1 ano".
 */
export function checkoutItemSummary(item: CheckoutItemLike): string {
  const period = checkoutItemPeriod(item);
  const name = item.name || '—';
  if (item.type === 'domain') return [`Domínio ${name}`, period].filter(Boolean).join(' · ');
  const plano = [name, period].filter(Boolean).join(' · ');
  if (item.type === 'hosting' && item.hostingDomain) return `${plano} — ${item.hostingDomain}`;
  return plano;
}
