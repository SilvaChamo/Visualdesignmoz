import { createClient as createServiceClient } from '@supabase/supabase-js';
import { getProfileForAuthUser } from '@/lib/profile-db';
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

/** Domínios permitidos no espelho — admin exclui sites de revendedores. */
export async function getAllowedPanelWpDomains(scope: PanelWpScope): Promise<Set<string>> {
  const { listHostingDomains, listHostingUsers, hostingProvider } = await import('@/lib/hosting-resolver');
  const sites = await listHostingDomains(
    scope.role === 'admin'
      ? { role: 'admin' }
      : { role: 'reseller', userId: scope.userId, daUsername: scope.daUsername },
  );

  if (scope.role === 'reseller' || hostingProvider === 'hestia') {
    return new Set(sites.map((s) => (s.domain || '').toLowerCase()).filter(Boolean));
  }

  const users = await listHostingUsers();
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
  if (scope.role === 'admin') {
    // O admin gere contas em mais do que um utilizador de sistema (DirectAdmin
    // 'admin' no Hetzner, mas no Contabo cada conta Hestia tem o seu próprio
    // username real — 'vdadmin', 'aamihe', 'oshercollective', etc.) — nunca
    // só um. Comparar install.user com um único valor fixo ('admin') excluía
    // sempre todos os sites Hestia da lista, mesmo os do próprio admin.
    // allowedDomains (já calculado a partir do espelho, correcto nos dois
    // painéis via isAdminPanelSite) é o filtro certo. Confirmado ao vivo 1
    // set: mltmark.com e aamihe.com (WordPress reais) ficavam invisíveis.
    return installs.filter((install) => allowedDomains.has(install.domain.toLowerCase()));
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
    // Mesmo raciocínio de filterWpInstallsForPanel — o admin não está preso a
    // um único username de sistema, por isso qualquer instalação real
    // encontrada no servidor chega (o domínio só não estava ainda no espelho).
    const { resolveWpInstall } = await import('@/lib/wp-cli-server');
    const install = await resolveWpInstall(normalized);
    if (install) return;
  }

  throw new Error('Sem permissão para este domínio.');
}
