import type { SupabaseClient } from '@supabase/supabase-js';

export type ClientProductTier = 'none' | 'domain' | 'hosting' | 'both';

/**
 * Uma encomenda ainda por confirmar (checkout_sessions.status='pending'),
 * só com os itens que ainda não têm decisão final — itens já 'paid' viram
 * linhas reais em domain_renewals/hosting_renewals (contadas acima); itens
 * 'failed'/rejeitados não devem voltar a aparecer como pendentes. Alimenta
 * a secção "Pedidos Pendentes" e as linhas cinzentas/desactivadas em
 * ClientProductsHub — ver PendingOrdersSection.
 */
export type PendingCheckoutSession = {
  id: string;
  metodoPagamento: string | null;
  totalMt: number;
  createdAt: string;
  hasComprovativo: boolean;
  items: Array<{
    type: 'domain' | 'hosting' | 'ssl' | 'email';
    name: string;
    hostingDomain?: string | null;
  }>;
};

export type UserProductsSummary = {
  tier: ClientProductTier;
  hasPaidProducts: boolean;
  domains: Array<{
    id?: string;
    name: string;
    expirationDate?: string | null;
    status?: string | null;
  }>;
  hosting: Array<{
    id?: string;
    domain: string;
    plan?: string | null;
    expirationDate?: string | null;
    status?: string | null;
  }>;
  /** Planos de email (server='Mail' em hosting_renewals) — nunca contam para tier/hosting. */
  emailPlans: Array<{
    id?: string;
    /** Vazio até o cliente associar um domínio (ver attachDomainToEmailPlan). */
    domain: string;
    /** Nome do plano (ex.: "Email Premium"). */
    plan?: string | null;
    expirationDate?: string | null;
    status?: string | null;
  }>;
  pendingSessions: PendingCheckoutSession[];
};

export async function fetchUserProductsSummary(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserProductsSummary> {
  const domains: UserProductsSummary['domains'] = [];
  const hosting: UserProductsSummary['hosting'] = [];
  const emailPlans: UserProductsSummary['emailPlans'] = [];

  const [domainRenewals, hostingRenewals, pagamentos, sites, pendingRows] = await Promise.all([
    supabase
      .from('domain_renewals')
      .select('id, domain_name, expiration_date, status')
      .eq('user_id', userId),
    supabase
      .from('hosting_renewals')
      .select('id, domain_name, package_name, server, expiration_date, status')
      .eq('user_id', userId),
    supabase
      .from('pagamentos')
      .select('id, status, descricao')
      .eq('user_id', userId)
      .in('status', ['paid', 'completed']),
    supabase
      .from('site_clientes')
      .select('id, dominio, plano, status, data_renovacao')
      .eq('cliente_id', userId),
    supabase
      .from('checkout_sessions')
      .select('id, items, total_mt, metodo_pagamento, status, comprovativo_url, created_at')
      .eq('user_id', userId)
      .eq('status', 'pending'),
  ]);

  const pendingSessions: PendingCheckoutSession[] = [];
  for (const row of pendingRows.data ?? []) {
    // Item-a-item: só entram os que ainda não têm decisão (nem 'paid' nem
    // 'failed') — os já pagos já viraram linha real acima, os rejeitados não
    // devem voltar a aparecer como "a aguardar".
    const items = ((row.items as Array<Record<string, unknown>>) ?? []).filter((item) => {
      const itemStatus = (item.status as string | undefined) ?? row.status;
      return itemStatus === 'pending';
    });
    if (items.length === 0) continue;
    pendingSessions.push({
      id: row.id,
      metodoPagamento: row.metodo_pagamento ?? null,
      totalMt: row.total_mt ?? 0,
      createdAt: row.created_at,
      hasComprovativo: Boolean(row.comprovativo_url),
      items: items.map((item) => ({
        type: item.type as PendingCheckoutSession['items'][number]['type'],
        name: item.name as string,
        hostingDomain: (item.hostingDomain as string | undefined) ?? null,
      })),
    });
  }

  for (const row of domainRenewals.data ?? []) {
    domains.push({
      id: row.id,
      name: row.domain_name,
      expirationDate: row.expiration_date,
      status: row.status,
    });
  }

  for (const row of hostingRenewals.data ?? []) {
    // Planos de email (server='Mail') não são hospedagem real — nunca podem
    // contaminar tier/hasHosting, senão o painel mostra um cartão de
    // "Hospedagem" bogus para quem só comprou email.
    if (row.server === 'Mail') {
      emailPlans.push({
        id: row.id,
        domain: row.domain_name,
        plan: row.package_name,
        expirationDate: row.expiration_date,
        status: row.status,
      });
      continue;
    }
    hosting.push({
      id: row.id,
      domain: row.domain_name,
      plan: row.package_name,
      expirationDate: row.expiration_date,
      status: row.status,
    });
  }

  for (const row of sites.data ?? []) {
    if (!hosting.some((h) => h.domain === row.dominio)) {
      hosting.push({
        id: row.id,
        domain: row.dominio,
        plan: row.plano,
        expirationDate: row.data_renovacao,
        status: row.status,
      });
    }
  }

  const paidCount =
    (pagamentos.data?.length ?? 0) +
    domains.filter((d) => d.status && d.status !== 'cancelled').length +
    hosting.filter((h) => h.status && !['cancelled', 'expired'].includes(String(h.status))).length +
    emailPlans.filter((e) => e.status && !['cancelled', 'expired'].includes(String(e.status))).length;

  const hasEmailPlan = emailPlans.length > 0;
  const hasPendingDomain = pendingSessions.some((s) => s.items.some((i) => i.type === 'domain'));
  const hasPendingHosting = pendingSessions.some((s) => s.items.some((i) => i.type === 'hosting'));

  // #panel-pendente: tier decide que SECÇÕES aparecem no painel (activas ou
  // cinzentas/pendentes) — por isso conta também encomendas ainda por
  // confirmar, não só produtos já reais. `hasPaidProducts` fica de fora
  // disto de propósito (só produtos reais), é o que decide se a conta
  // resolve como 'client' vs 'guest'.
  const hasDomains = domains.length > 0 || hasPendingDomain;
  const hasHosting = hosting.length > 0 || hasPendingHosting;

  let tier: ClientProductTier = 'none';
  if (hasDomains && hasHosting) tier = 'both';
  else if (hasHosting) tier = 'hosting';
  else if (hasDomains) tier = 'domain';

  return {
    tier,
    hasPaidProducts: paidCount > 0 || domains.length > 0 || hosting.length > 0 || hasEmailPlan,
    domains,
    hosting,
    emailPlans,
    pendingSessions,
  };
}

/**
 * Verdadeiro se alguma `pendingSessions` foi criada há pouco (ver
 * `RECENT_PENDING_SESSION_WINDOW_MS` em `user-roles.ts`) — usado como
 * fallback de papel (guest→client) logo depois do checkout, ver
 * `resolveUserRole`.
 */
export function hasRecentPendingSession(
  pendingSessions: PendingCheckoutSession[],
  windowMs: number,
): boolean {
  const cutoff = Date.now() - windowMs;
  return pendingSessions.some((s) => new Date(s.createdAt).getTime() >= cutoff);
}
