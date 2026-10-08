/**
 * Verificação única de "este login pode gerir este domínio?" para as rotas do
 * painel que actuam sobre um domínio (emails, bases de dados, DNS, backups,
 * ficheiros...). Antes cada rota fazia a sua própria comparação — e algumas
 * (db-manager, backup-manager) não faziam nenhuma, aceitando qualquer domínio
 * de qualquer revendedor/cliente.
 *
 * Regras (ver account-levels.ts / linked-accounts.ts):
 * - admin sem impersonação → qualquer domínio;
 * - restantes → só domínios das contas que o âmbito gere directamente: a
 *   conta activa + (Enterprise) as contas ligadas;
 * - Premium → os domínios das contas ligadas ficam trancados até o login
 *   entrar na conta com as credenciais dela.
 */

import { NextResponse } from 'next/server';
import type { PanelStaffAuthSuccess } from '@/lib/panel-api-auth';
import { resolvePanelDaContext, type PanelDaContext } from '@/lib/panel-api-context';
import { resolveHostingOwner } from '@/lib/hosting-resolver';
import type { MirrorScope } from '@/lib/panel-mirror-read';
import type { AccountScope } from '@/lib/linked-accounts';

export type DomainAccessDeniedReason = 'locked-linked-account' | 'outside-scope';

export const LOCKED_LINKED_ACCOUNT_MESSAGE =
  'Este domínio tem conta própria. Para o gerir, entre na conta dele (Domínios → Contas dos domínios) com as credenciais dessa conta.';
export const OUTSIDE_SCOPE_MESSAGE = 'Domínio fora do seu painel.';

export type CallerManagedOwners = {
  /** null = admin sem impersonação (gere tudo). */
  owners: Set<string> | null;
  /** Contas ligadas visíveis mas trancadas (Premium). */
  locked: Set<string>;
  /** Conta activa do âmbito (a principal, ou a ligada em que entrou). */
  activeAccount: string | null;
  /** Conta principal do login (as contas ligadas pertencem-lhe). */
  mainAccount: string | null;
};

/** Mesmo cálculo a partir de um contexto já resolvido (evita resolver duas vezes). */
export function managedOwnersFromContext(
  ctx: Pick<PanelDaContext, 'effectiveRole' | 'mirrorScope' | 'accountScope'>,
): CallerManagedOwners {
  if (ctx.effectiveRole === 'admin') {
    return { owners: null, locked: new Set(), activeAccount: null, mainAccount: null };
  }
  const active = String(ctx.mirrorScope.daUsername || '').trim().toLowerCase();
  const owners = new Set(
    [active, ...(ctx.mirrorScope.linkedOwners || [])]
      .map((owner) => owner.trim().toLowerCase())
      .filter(Boolean),
  );
  return {
    owners,
    locked: new Set(ctx.accountScope?.lockedOwners ?? []),
    activeAccount: active || null,
    mainAccount: ctx.accountScope?.main || active || null,
  };
}

export async function resolveCallerManagedOwners(auth: PanelStaffAuthSuccess): Promise<CallerManagedOwners> {
  return managedOwnersFromContext(await resolvePanelDaContext(auth));
}

export function isOwnerManaged(managed: CallerManagedOwners, owner: string | null | undefined): boolean {
  if (!managed.owners) return true;
  const normalized = String(owner || '').trim().toLowerCase();
  return Boolean(normalized) && managed.owners.has(normalized);
}

export type DomainAccess =
  | { allowed: true; owner: string }
  | { allowed: false; owner: string; reason: DomainAccessDeniedReason };

export async function resolveCallerDomainAccess(
  auth: PanelStaffAuthSuccess,
  domain: string,
  managed?: CallerManagedOwners,
): Promise<DomainAccess> {
  return domainAccessForManaged(managed ?? (await resolveCallerManagedOwners(auth)), domain);
}

export async function domainAccessForManaged(managed: CallerManagedOwners, domain: string): Promise<DomainAccess> {
  const owner = String(await resolveHostingOwner(domain.trim().toLowerCase())).trim().toLowerCase();
  if (isOwnerManaged(managed, owner)) return { allowed: true, owner };
  return {
    allowed: false,
    owner,
    reason: managed.locked.has(owner) ? 'locked-linked-account' : 'outside-scope',
  };
}

export function domainAccessDeniedResponse(reason: DomainAccessDeniedReason): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: reason === 'locked-linked-account' ? LOCKED_LINKED_ACCOUNT_MESSAGE : OUTSIDE_SCOPE_MESSAGE,
      code: reason,
    },
    { status: 403 },
  );
}

/**
 * Para rotas fora do painel de staff (webmail, passwords de caixas de email),
 * chamadas por qualquer login: o âmbito é só a conta de alojamento ligada ao
 * PRÓPRIO login (perfil ou panel_users.auth_user_id — a mesma regra que estas
 * rotas já usavam, sem o atalho por email do painel), mais as contas ligadas
 * que o nível dessa conta gere directamente. Nunca dá âmbito de admin.
 */
export async function resolveOwnAccountDomainAccess(userId: string, domain: string): Promise<DomainAccess> {
  const owner = String(await resolveHostingOwner(domain.trim().toLowerCase())).trim().toLowerCase();
  const { resolveOwnerDaUsername } = await import('@/lib/da-credential-store');
  const main = String((await resolveOwnerDaUsername(userId)) || '').trim().toLowerCase();
  if (!main) return { allowed: false, owner, reason: 'outside-scope' };
  const { resolveAccountScope } = await import('@/lib/linked-accounts');
  const scope = await resolveAccountScope(main, userId);
  if (owner === scope.main || scope.manageOwners.includes(owner)) return { allowed: true, owner };
  return {
    allowed: false,
    owner,
    reason: scope.lockedOwners.includes(owner) ? 'locked-linked-account' : 'outside-scope',
  };
}

/**
 * Âmbito do painel (MirrorScope) da conta de alojamento ligada ao PRÓPRIO
 * login — mesma regra de resolveOwnAccountDomainAccess, para rotas que um
 * cliente/profissional também chama (contas de e-mail em /api/da). null quando
 * o login não tem conta de alojamento própria.
 */
export async function resolveOwnAccountMirrorScope(
  userId: string,
): Promise<{ mirrorScope: MirrorScope; accountScope: AccountScope } | null> {
  const { resolveOwnerDaUsername } = await import('@/lib/da-credential-store');
  const main = String((await resolveOwnerDaUsername(userId)) || '').trim().toLowerCase();
  if (!main) return null;
  const { resolveAccountScope } = await import('@/lib/linked-accounts');
  const accountScope = await resolveAccountScope(main, userId);
  // Igual a resolvePanelDaContext: Premium que entrou numa conta ligada
  // trabalha só nela; Enterprise gere também as ligadas.
  const active = accountScope.entered || accountScope.main || main;
  const linkedOwners = accountScope.entered
    ? []
    : accountScope.manageOwners.filter((owner) => owner !== accountScope.main);
  return {
    mirrorScope: {
      role: 'reseller',
      userId,
      daUsername: active,
      ...(linkedOwners.length ? { linkedOwners } : {}),
    },
    accountScope,
  };
}

/** Resposta 403 pronta a devolver, ou null quando o login pode gerir o domínio. */
export async function denyUnlessCallerManagesDomain(
  auth: PanelStaffAuthSuccess,
  domain: string,
): Promise<NextResponse | null> {
  const access = await resolveCallerDomainAccess(auth, domain);
  return access.allowed ? null : domainAccessDeniedResponse(access.reason);
}
