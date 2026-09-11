import { createClient as createServiceClient } from '@supabase/supabase-js';
import { getProfileForAuthUser } from '@/lib/profile-db';
import { isCompanyHostingOwner } from '@/lib/panel-contas-enrich';
import type { WpInstallInfo } from '@/lib/wp-cli-server';

export type PanelWpScope = {
  role: 'admin' | 'reseller';
  userId: string;
  /** Utilizador DirectAdmin (directório /home/{daUsername}/). */
  daUsername: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function resolvePanelWpScope(
  userId: string,
  role: 'admin' | 'reseller' | 'manager' | 'profissional',
  impersonatingDaUsername?: string | null,
): Promise<PanelWpScope> {
  // Admin a impersonar um revendedor: a sessão real continua 'admin', mas o
  // scope tem de ficar preso à conta impersonada — nunca cair no ramo
  // 'admin' abaixo, que devolveria sempre o (vazio) escopo do próprio admin.
  if (impersonatingDaUsername) {
    return { role: 'reseller', userId, daUsername: impersonatingDaUsername };
  }

  if (role === 'admin') {
    return { role: 'admin', userId, daUsername: 'admin' };
  }

  // "manager" (conta colaborador) e "profissional" (comprador self-service)
  // usam o mesmo mecanismo escopado que um revendedor — ficam sempre
  // limitados ao seu próprio da_username, nunca a admin real.
  const admin = createServiceClient(supabaseUrl, supabaseKey);
  const profile = await getProfileForAuthUser(admin, userId);
  const daUsername = String(profile?.da_username || '').trim().toLowerCase();
  if (!daUsername) {
    throw new Error('Conta de revenda sem utilizador DirectAdmin ligado.');
  }
  return { role: 'reseller', userId, daUsername };
}

/** Domínios permitidos — conta principal só vê sites da Visual Design; Osher só os dela. */
export async function getAllowedPanelWpDomains(scope: PanelWpScope): Promise<Set<string>> {
  const { listHostingDomains } = await import('@/lib/hosting-resolver');
  const sites = await listHostingDomains(
    scope.role === 'admin'
      ? { role: 'admin' }
      : { role: 'reseller', userId: scope.userId, daUsername: scope.daUsername },
  );

  if (scope.role === 'reseller') {
    const owner = scope.daUsername.toLowerCase();
    return new Set(
      sites
        .filter((s) => (s.owner || '').trim().toLowerCase() === owner)
        .map((s) => (s.domain || '').toLowerCase())
        .filter(Boolean),
    );
  }

  return new Set(
    sites
      .filter((s) => isCompanyHostingOwner(s.owner))
      .map((s) => (s.domain || '').toLowerCase())
      .filter(Boolean),
  );
}

export function filterWpInstallsForPanel(
  installs: WpInstallInfo[],
  scope: PanelWpScope,
  allowedDomains: Set<string>,
): WpInstallInfo[] {
  if (scope.role === 'admin') {
    return installs.filter((install) => {
      if (!isCompanyHostingOwner(install.user)) return false;
      return allowedDomains.has(install.domain.toLowerCase());
    });
  }
  const daUser = scope.daUsername.toLowerCase();
  return installs.filter((install) => {
    if (install.user.toLowerCase() !== daUser) return false;
    if (allowedDomains.size > 0) {
      return allowedDomains.has(install.domain.toLowerCase());
    }
    return true;
  });
}

export async function assertPanelOwnsWpDomain(
  scope: PanelWpScope,
  domain: string,
): Promise<void> {
  const normalized = domain.toLowerCase().trim();
  if (!normalized) {
    throw new Error('Domínio inválido.');
  }

  const allowed = await getAllowedPanelWpDomains(scope);
  if (allowed.has(normalized)) return;

  if (scope.role === 'admin') {
    const { resolveWpInstall } = await import('@/lib/wp-cli-server');
    const install = await resolveWpInstall(normalized);
    if (install && isCompanyHostingOwner(install.user)) return;
  }

  throw new Error('Sem permissão para este domínio.');
}
