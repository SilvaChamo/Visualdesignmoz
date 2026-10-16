/**
 * Regras de domínios por nível (ver account-levels.ts):
 *
 * - Básico:     um domínio (subdomínios dele continuam permitidos até ao
 *               limite do próprio pacote no Hestia).
 * - Premium:    cada domínio novo tem a sua própria conta — nunca entra na
 *               conta principal; o total (principal + ligadas) respeita o
 *               limite do plano.
 * - Enterprise: domínios na conta principal ou em contas ligadas, sem limite
 *               (ou o limite que o pacote tiver no Hestia).
 *
 * "Domínio" conta só domínios de topo — blog.exemplo.com não gasta um lugar
 * quando exemplo.com já está nas contas do cliente.
 */

import { listHostingDomains } from '@/lib/hosting-resolver';
import {
  defaultDomainLimitForPackage,
  levelAllowsLinkedAccounts,
  type AccountScopeSummary,
} from '@/lib/account-levels';
import type { AccountScope } from '@/lib/linked-accounts';

export const PREMIUM_NEW_DOMAIN_MESSAGE =
  'No plano Premium cada domínio tem a sua própria conta. Adicione-o em Domínios → Contas dos domínios → "Adicionar domínio com conta própria".';

type Check = { ok: true } | { ok: false; error: string };

export function topLevelDomains(domains: string[]): string[] {
  const all = [...new Set(domains.map((d) => d.trim().toLowerCase()).filter(Boolean))];
  return all.filter((d) => !all.some((other) => other !== d && d.endsWith(`.${other}`)));
}

function isSubdomainOfAny(domain: string, existing: string[]): boolean {
  return existing.some((d) => domain.endsWith(`.${d}`));
}

/** Limite de domínios do plano: o do pacote no Hestia, senão o conhecido. */
export async function resolvePackageDomainLimit(packageName: string | null): Promise<number | null> {
  const key = String(packageName || '').trim().toLowerCase();
  if (!key) return null;
  try {
    const { listPackageDomainLimits } = await import('@/lib/hestia-adapter');
    const limits = await listPackageDomainLimits();
    if (limits.has(key)) return limits.get(key) ?? null;
  } catch {
    /* Hestia indisponível — usa os valores conhecidos */
  }
  return defaultDomainLimitForPackage(packageName);
}

/** Domínios de cada conta do âmbito (principal + todas as ligadas, mesmo trancadas). */
export async function listScopeDomainsByOwner(scope: AccountScope): Promise<Map<string, string[]>> {
  const byOwner = new Map<string, string[]>();
  byOwner.set(scope.main, []);
  for (const row of scope.linked) byOwner.set(row.username, []);
  const rows = await listHostingDomains();
  for (const site of rows) {
    const owner = String(site.owner || '').trim().toLowerCase();
    const list = byOwner.get(owner);
    if (list) list.push(String(site.domain || '').trim().toLowerCase());
  }
  for (const list of byOwner.values()) list.sort();
  return byOwner;
}

function limitMessage(limit: number): string {
  return limit === 1
    ? 'O seu plano inclui um domínio. Para ter mais domínios, mude para o plano Premium ou Enterprise.'
    : `O seu plano inclui até ${limit} domínios e já estão todos em uso. Para mais domínios, mude de plano.`;
}

/** Decisão pura (testável): pode juntar-se `domain` à conta ACTIVA? */
export function decideNewDomainInActiveAccount(
  scope: Pick<AccountScope, 'entered' | 'level'>,
  domain: string,
  byOwner: Map<string, string[]>,
  limit: number | null,
): Check {
  const target = domain.trim().toLowerCase();
  const everything = [...byOwner.values()].flat();

  // Subdomínio de um domínio que o cliente já tem — não é um domínio novo.
  if (isSubdomainOfAny(target, everything)) return { ok: true };

  if (scope.entered) {
    const own = topLevelDomains(byOwner.get(scope.entered) || []);
    return own.length >= 1
      ? { ok: false, error: 'Esta conta de domínio inclui um só domínio. Volte à conta principal para adicionar outro.' }
      : { ok: true };
  }

  if (scope.level === 'premium') return { ok: false, error: PREMIUM_NEW_DOMAIN_MESSAGE };
  if (!scope.level) return { ok: true };

  if (limit !== null && topLevelDomains(everything).length >= limit) {
    return { ok: false, error: limitMessage(limit) };
  }
  return { ok: true };
}

/** Decisão pura (testável): pode criar-se uma conta própria para `domain`? */
export function decideNewLinkedAccount(
  scope: Pick<AccountScope, 'entered' | 'level'>,
  domain: string,
  byOwner: Map<string, string[]>,
  limit: number | null,
): Check {
  if (!levelAllowsLinkedAccounts(scope.level)) {
    return { ok: false, error: 'Só os planos Premium e Enterprise têm domínios com conta própria.' };
  }
  if (scope.entered) {
    return { ok: false, error: 'Volte à conta principal para adicionar domínios com conta própria.' };
  }
  const target = domain.trim().toLowerCase();
  const everything = [...byOwner.values()].flat();
  if (everything.includes(target)) return { ok: false, error: 'Este domínio já está nas suas contas.' };
  if (isSubdomainOfAny(target, everything)) {
    return { ok: false, error: 'Subdomínios ficam na conta do domínio principal — crie-o em Subdomínios.' };
  }
  if (limit !== null && topLevelDomains(everything).length >= limit) {
    return { ok: false, error: limitMessage(limit) };
  }
  return { ok: true };
}

/** Pode juntar-se `domain` à conta ACTIVA (criar site/domínio normal)? */
export async function checkNewDomainInActiveAccount(scope: AccountScope, domain: string): Promise<Check> {
  const [byOwner, limit] = await Promise.all([
    listScopeDomainsByOwner(scope),
    resolvePackageDomainLimit(scope.mainPackage),
  ]);
  return decideNewDomainInActiveAccount(scope, domain, byOwner, limit);
}

/** Pode criar-se uma conta própria para `domain`, ligada à conta principal? */
export async function checkNewLinkedAccount(scope: AccountScope, domain: string): Promise<Check> {
  if (!levelAllowsLinkedAccounts(scope.level) || scope.entered) {
    return decideNewLinkedAccount(scope, domain, new Map(), null);
  }
  const [byOwner, limit] = await Promise.all([
    listScopeDomainsByOwner(scope),
    resolvePackageDomainLimit(scope.mainPackage),
  ]);
  return decideNewLinkedAccount(scope, domain, byOwner, limit);
}

/** O que o painel mostra em "Contas dos domínios" (sem segredos). */
export async function buildAccountScopeSummary(scope: AccountScope): Promise<AccountScopeSummary> {
  const [byOwner, domainLimit] = await Promise.all([
    listScopeDomainsByOwner(scope),
    resolvePackageDomainLimit(scope.mainPackage),
  ]);
  const locked = new Set(scope.lockedOwners);
  return {
    main: scope.main,
    mainPackage: scope.mainPackage,
    level: scope.level,
    entered: scope.entered,
    domainLimit,
    domainCount: topLevelDomains([...byOwner.values()].flat()).length,
    linked: scope.linked.map((row) => ({
      username: row.username,
      packageName: row.packageName,
      domains: byOwner.get(row.username) || [],
      locked: locked.has(row.username),
    })),
  };
}
