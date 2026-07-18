import { DOMAIN_TLD_PRICES } from '@/lib/domain-tld-prices';

export type CatalogCartItem = {
  id: string;
  type: 'domain' | 'hosting' | 'ssl' | 'email';
  name: string;
  price: number;
  period: number;
};

/** Mesma fórmula usada em toda a app para converter USD -> MT (ver src/lib/domain-tld-prices.ts). */
function usdToMt(usd: number): number {
  return Math.round(usd * 65 * 1.5 * 1.075);
}

/**
 * Planos de hospedagem/email vendidos hoje através do carrinho (DomainSearch, CartDrawer).
 * Preços em MT, para os dois ciclos de faturação usados na UI.
 */
const HOSTING_EMAIL_CATALOG: Record<string, { name: string; monthly: number; annual: number }> = {
  'hosting-basico': { name: 'Alojamento Web Básico', monthly: 680, annual: 7344 },
  'hosting-pro': { name: 'Webhost Pro', monthly: 1500, annual: 16200 },
  'email-pro': { name: 'Email Profissional', monthly: 250, annual: 2700 },
};

export type ResolvedCartItem = {
  item: CatalogCartItem;
  priceMt: number;
};

export type CatalogResolution = {
  resolved: ResolvedCartItem[];
  rejected: CatalogCartItem[];
};

/**
 * Recalcula o preço de cada item do carrinho a partir de uma fonte de verdade no servidor,
 * em vez de confiar no `price` que o browser envia. Itens que não sejam reconhecidos
 * são rejeitados (fail closed) — nunca ficam a passar com o preço enviado pelo cliente.
 */
export function resolveCartItems(items: CatalogCartItem[]): CatalogResolution {
  const resolved: ResolvedCartItem[] = [];
  const rejected: CatalogCartItem[] = [];

  for (const item of items) {
    if (item.type === 'domain') {
      const domainName = (item.id || item.name || '').toLowerCase().trim();
      const tld = DOMAIN_TLD_PRICES.find((t) => domainName.endsWith(t.value));
      if (!tld) {
        rejected.push(item);
        continue;
      }
      const years = Math.max(1, item.period || 1);
      resolved.push({ item, priceMt: usdToMt(tld.price * years) });
      continue;
    }

    if (item.type === 'hosting' || item.type === 'email') {
      const plan = HOSTING_EMAIL_CATALOG[item.id];
      if (!plan) {
        rejected.push(item);
        continue;
      }
      // O carrinho envia o preço já resolvido (mensal ou anual) com period fixo em 1;
      // aceitamos o valor que corresponder exatamente a um dos dois ciclos do catálogo.
      const priceMt = item.price === plan.monthly ? plan.monthly : plan.annual;
      resolved.push({ item, priceMt });
      continue;
    }

    // 'ssl' e outros tipos ainda não têm catálogo server-side definido.
    rejected.push(item);
  }

  return { resolved, rejected };
}
