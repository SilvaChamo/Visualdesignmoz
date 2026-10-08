import { getEffectiveTldPrices } from '@/lib/domain-price-sync';
import { domainRegistrationPriceMt, domainTransferPriceMt } from '@/lib/domain-tld-prices';
import { HOSTING_PLANS, getHostingCyclePrice, type HostingBillingCycle } from '@/lib/hosting-plans';
import { emailCycleForMonths, getEmailCyclePrice, getEmailPlan } from '@/lib/email-plans';

export type CatalogCartItem = {
  id: string;
  type: 'domain' | 'hosting' | 'ssl' | 'email';
  name: string;
  price: number;
  period: number;
  /** Presente só quando o item é uma transferência de domínio de outro registador
   * (não um registo novo) — código de autorização (EPP) do dono actual. */
  authCode?: string;
  /** #6: domínio de destino de um item de hospedagem — nunca usar `name`
   * (nome comercial do plano) como domínio. */
  hostingDomain?: string;
};

/**
 * Planos de email (Básico/Premium/Enterprise — ver email-plans.ts), sem
 * domínio incluído: o domínio é escolhido depois, no painel do cliente (ver
 * ClientProductsHub / attach-email-domain). O atalho rápido (DomainSearch,
 * CartDrawer) adiciona o Básico mensal.
 */
export const EMAIL_BASICO_ID = 'email-basico';
export const EMAIL_BASICO_PRICE_MT = getEmailCyclePrice(getEmailPlan(EMAIL_BASICO_ID)!, 'monthly');

const HOSTING_CYCLES: HostingBillingCycle[] = ['monthly', 'semiannual', 'annual'];
const HOSTING_CYCLE_MONTHS: Record<HostingBillingCycle, number> = { monthly: 1, semiannual: 6, annual: 12 };

export type ResolvedCartItem = {
  item: CatalogCartItem;
  priceMt: number;
  /** #26: custo real em USD (tabela de revenda da Dynadot) — só definido
   * para domínios, é o piso que a cobrança em dólar nunca pode furar. */
  costUsd?: number;
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
export async function resolveCartItems(items: CatalogCartItem[]): Promise<CatalogResolution> {
  const resolved: ResolvedCartItem[] = [];
  const rejected: CatalogCartItem[] = [];
  const tldPrices = await getEffectiveTldPrices();

  for (const item of items) {
    if (item.type === 'domain') {
      const domainName = (item.id || item.name || '').toLowerCase().trim();
      const tld = tldPrices.find((t) => domainName.endsWith(t.value));
      if (!tld) {
        rejected.push(item);
        continue;
      }
      const years = Math.max(1, item.period || 1);
      // Transferência de outro registador usa o preço de transferência (normalmente
      // já inclui 1 ano), não o de registo novo — nunca o valor fixo de compra.
      const priceMt = item.authCode
        ? domainTransferPriceMt(tld, years)
        : domainRegistrationPriceMt(tld, years);
      const costUsd = (item.authCode ? tld.transfer : tld.price) * years;
      resolved.push({ item, priceMt, costUsd });
      continue;
    }

    if (item.type === 'hosting') {
      const plan = HOSTING_PLANS.find((p) => p.id === item.id);
      if (!plan) {
        rejected.push(item);
        continue;
      }
      // O carrinho envia o preço já resolvido (mensal, semestral ou anual); só
      // aceitamos o valor se corresponder exatamente a um dos três ciclos
      // oficiais do plano — e #2: o `period` (em meses, usado para calcular a
      // validade do serviço) tem de bater certo com esse mesmo ciclo. Sem
      // isto, um `period` incoerente com o preço passava despercebido (ex.:
      // preço anual com period=1 dava 12 meses de pagamento por 1 de serviço).
      const cycle = HOSTING_CYCLES.find((c) => getHostingCyclePrice(plan.basePrice, c) === item.price);
      if (cycle === undefined || (item.period || 1) !== HOSTING_CYCLE_MONTHS[cycle]) {
        rejected.push(item);
        continue;
      }
      resolved.push({ item, priceMt: item.price });
      continue;
    }

    if (item.type === 'email') {
      const plan = getEmailPlan(item.id);
      if (!plan) {
        rejected.push(item);
        continue;
      }
      // Mesma regra da hospedagem: o preço tem de ser exactamente o de um dos
      // três ciclos do plano e o `period` (meses) tem de ser o desse ciclo.
      const cycle = emailCycleForMonths(item.period || 1);
      if (!cycle || getEmailCyclePrice(plan, cycle) !== item.price) {
        rejected.push(item);
        continue;
      }
      resolved.push({ item, priceMt: item.price });
      continue;
    }

    // 'ssl' e outros tipos ainda não têm catálogo server-side definido.
    rejected.push(item);
  }

  return { resolved, rejected };
}

/**
 * #12: converte itens resolvidos de volta para CatalogCartItem, mas com o
 * preço VALIDADO pelo servidor (`priceMt`) — nunca `r.item.price` (o valor
 * originalmente enviado pelo browser). A cobrança em si já usava sempre
 * `priceMt`; isto fecha o resto: o que fica gravado em checkout_sessions.items
 * e o que chega a fulfillCheckout (ex.: domain_renewals.renewal_price) também
 * passam a ser sempre o valor confirmado no servidor.
 */
export function toValidatedCartItems(resolved: ResolvedCartItem[]): CatalogCartItem[] {
  return resolved.map((r) => ({ ...r.item, price: r.priceMt }));
}
