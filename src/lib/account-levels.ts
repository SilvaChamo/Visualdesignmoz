/**
 * Níveis de gestão de domínios por conta de alojamento (Hestia não tem contas
 * de revenda — o agrupamento "uma conta principal com várias contas de
 * domínio" é feito pelo painel, via `panel_users.parent_username`).
 *
 * O nível NÃO é guardado à parte: sai sempre do pacote da conta principal,
 * por isso escolher o plano ao criar/comprar a conta já activa o nível certo
 * (o carrinho converte hosting-basico/pro/business/enterprise nos pacotes
 * VD-Host-* — ver checkout-fulfillment.ts).
 *
 * - Básico     → um domínio, com a sua própria conta, que se gere sozinha.
 * - Premium    → vários domínios (limite do plano), cada um com conta própria;
 *                todos aparecem na conta principal, mas para gerir um domínio
 *                é preciso entrar na conta dele com as credenciais dessa conta.
 * - Enterprise → a conta principal gere directamente todos os domínios/contas
 *                ligados, sem entrar em cada um.
 *
 * Excepção: a conta de um revendedor (ex.: Osher Collective) é sempre
 * Enterprise — gere directamente as contas dos seus clientes, seja qual for
 * o pacote da sua própria conta (ver linked-accounts.ts).
 *
 * Sem dependências de servidor — seguro em componentes cliente.
 */

export type AccountLevel = 'basico' | 'premium' | 'enterprise';

export const ACCOUNT_LEVEL_LABELS: Record<AccountLevel, string> = {
  basico: 'Básico',
  premium: 'Premium',
  enterprise: 'Enterprise',
};

export const ACCOUNT_LEVEL_SUMMARIES: Record<AccountLevel, string> = {
  basico: 'Um domínio, com a sua própria conta, que se gere sozinha.',
  premium:
    'Vários domínios, cada um com a sua própria conta. Todos aparecem aqui; para gerir um domínio entra-se na conta dele com as respectivas credenciais.',
  enterprise:
    'Vários domínios e contas, todos geridos directamente a partir desta conta, sem entrar em cada um.',
};

const LEVEL_BY_PACKAGE: Record<string, AccountLevel> = {
  'vd-host-basico': 'basico',
  'vd-host-pro': 'premium',
  'vd-host-business': 'premium',
  'vd-host-enterprise': 'enterprise',
};

/** Nível do pacote, ou null para pacotes fora dos planos (ex.: "default" da
 * própria VisualDesign, pacotes antigos do DirectAdmin) — nesses nada muda. */
export function accountLevelForPackage(packageName: string | null | undefined): AccountLevel | null {
  const key = String(packageName || '').trim().toLowerCase();
  return LEVEL_BY_PACKAGE[key] ?? null;
}

/** Limite total de domínios (conta principal + contas ligadas) por pacote,
 * usado quando o Hestia não devolve o seu próprio limite de web domains.
 * null = sem limite. Valores confirmados no servidor (31 ago). */
const DEFAULT_DOMAIN_LIMIT_BY_PACKAGE: Record<string, number | null> = {
  'vd-host-basico': 1,
  'vd-host-pro': 5,
  'vd-host-business': null,
  'vd-host-enterprise': null,
};

export function defaultDomainLimitForPackage(packageName: string | null | undefined): number | null {
  const key = String(packageName || '').trim().toLowerCase();
  return key in DEFAULT_DOMAIN_LIMIT_BY_PACKAGE ? DEFAULT_DOMAIN_LIMIT_BY_PACKAGE[key] : null;
}

/** Pacote com que é criada a conta própria de cada domínio adicionado a uma
 * conta Premium/Enterprise — cada domínio fica com a quota de um Básico. */
export const LINKED_DOMAIN_ACCOUNT_PACKAGE = 'VD-Host-Basico';

/** Só Premium e Enterprise podem ter contas de domínio ligadas. */
export function levelAllowsLinkedAccounts(level: AccountLevel | null): boolean {
  return level === 'premium' || level === 'enterprise';
}

/** Resumo do âmbito de uma conta, tal como o painel o mostra (sem segredos). */
export type AccountScopeSummary = {
  /** Conta principal (a do login). */
  main: string;
  mainPackage: string | null;
  level: AccountLevel | null;
  /** Conta de domínio em que o utilizador entrou com credenciais (só Premium). */
  entered: string | null;
  /** Limite total de domínios do plano; null = sem limite. */
  domainLimit: number | null;
  /** Domínios já em uso (conta principal + contas ligadas). */
  domainCount: number;
  linked: Array<{
    username: string;
    packageName: string | null;
    domains: string[];
    /** true = aparece na lista mas pede credenciais para ser gerida (Premium). */
    locked: boolean;
  }>;
};
