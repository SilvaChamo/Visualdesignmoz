import { createClient as createServiceClient } from '@supabase/supabase-js';
import { getProfileForAuthUser } from '@/lib/profile-db';
import { listMirrorUsers, listMirrorWebsites } from '@/lib/panel-mirror-read';
import { buildResellerOwnerTree, isAdminPanelSite } from '@/lib/panel-scope-filter';
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
  role: 'admin' | 'reseller',
): Promise<PanelWpScope> {
  if (role === 'admin') {
    return { role: 'admin', userId, daUsername: 'admin' };
  }

  const admin = createServiceClient(supabaseUrl, supabaseKey);
  const profile = await getProfileForAuthUser(admin, userId);
  const daUsername = String(profile?.da_username || '').trim().toLowerCase();
  if (!daUsername) {
    throw new Error('Conta de revenda sem utilizador DirectAdmin ligado.');
  }
  return { role: 'reseller', userId, daUsername };
}

/** Domínios permitidos no espelho — admin exclui sites de revendedores. */
export async function getAllowedPanelWpDomains(scope: PanelWpScope): Promise<Set<string>> {
  const mirrorScope =
    scope.role === 'admin'
      ? ({ role: 'admin' as const })
      : ({ role: 'reseller' as const, userId: scope.userId, daUsername: scope.daUsername });

  const sites = await listMirrorWebsites(mirrorScope);

  if (scope.role === 'reseller') {
    return new Set(sites.map((s) => (s.domain || '').toLowerCase()).filter(Boolean));
  }

  const users = await listMirrorUsers({ role: 'admin' });
  const resellerTree = buildResellerOwnerTree(users);

  return new Set(
    sites
      .filter((s) => isAdminPanelSite(s, resellerTree))
      .map((s) => (s.domain || '').toLowerCase())
      .filter(Boolean),
  );
}

export function filterWpInstallsForPanel(
  installs: WpInstallInfo[],
  scope: PanelWpScope,
  allowedDomains: Set<string>,
): WpInstallInfo[] {
  const daUser = scope.daUsername.toLowerCase();
  return installs.filter((install) => {
    if (install.user.toLowerCase() !== daUser) return false;
    if (scope.role === 'reseller' && allowedDomains.size > 0) {
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
    if (install?.user.toLowerCase() === scope.daUsername.toLowerCase()) return;
  }

  throw new Error('Sem permissão para este domínio.');
}
