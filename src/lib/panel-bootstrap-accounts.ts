/**
 * Contas Auth do painel — leitura rápida a partir de `profiles` (sem paginar Auth API).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getDaSyncAdmin } from '@/lib/da-sync-schema';
import { profileName, type ProfileRow } from '@/lib/profile-db';
import { belongsToCurrentPanel, resolveAccountPanelSite } from '@/lib/panel-tenant';
import { getRedirectPathForRole, resolveUserRole, type UserRole } from '@/lib/user-roles';

export type PanelBootstrapAccount = {
  id: string;
  email: string;
  userName: string;
  panelRole: UserRole;
  panelPath: string;
  state: string;
  lastSignIn: string | null;
  nome: string | null;
};

export function buildPanelAccountCounts(users: PanelBootstrapAccount[]) {
  return {
    all: users.length,
    admin: users.filter((u) => u.panelRole === 'admin').length,
    reseller: users.filter((u) => u.panelRole === 'reseller').length,
    client: users.filter((u) => u.panelRole === 'client').length,
    guest: users.filter((u) => u.panelRole === 'guest').length,
  };
}

export function filterPanelAccountsForCaller(
  users: PanelBootstrapAccount[],
  callerRole: 'admin' | 'reseller',
): PanelBootstrapAccount[] {
  if (callerRole === 'admin') return users;
  return users.filter((u) => u.panelRole === 'client');
}

function mapProfileToAccount(profile: ProfileRow): PanelBootstrapAccount | null {
  const email = (profile.email || '').toLowerCase().trim();
  if (!email) {
    return null;
  }

  const panelSite = resolveAccountPanelSite({ email });
  if (!belongsToCurrentPanel(panelSite)) {
    return null;
  }

  const authId = String(profile.user_id || profile.id || '').trim();
  if (!authId) {
    return null;
  }

  const panelRole = resolveUserRole({
    email,
    profileRole: profile.role ?? null,
    daUsername: profile.da_username ?? null,
    hasPaidProducts: false,
  });
  const displayName = profileName(profile, email.split('@')[0]);

  return {
    id: authId,
    email,
    userName: displayName,
    panelRole,
    panelPath: getRedirectPathForRole(panelRole),
    state: 'Active',
    lastSignIn: null,
    nome: displayName,
  };
}

export async function listAllBootstrapPanelAccounts(
  adminClient?: SupabaseClient | null,
): Promise<PanelBootstrapAccount[]> {
  const admin = adminClient ?? getDaSyncAdmin();
  if (!admin) {
    return [];
  }

  const { data, error } = await admin
    .from('profiles')
    .select('id, user_id, email, role, name, da_username');

  if (error) {
    console.error('[panel-bootstrap-accounts]', error.message);
    return [];
  }

  const rows: PanelBootstrapAccount[] = [];
  for (const row of data || []) {
    const mapped = mapProfileToAccount(row as ProfileRow);
    if (mapped) {
      rows.push(mapped);
    }
  }

  return rows.sort((a, b) => a.email.localeCompare(b.email));
}

export async function listBootstrapPanelAccounts(
  callerRole: 'admin' | 'reseller',
  adminClient?: SupabaseClient | null,
): Promise<{ accounts: PanelBootstrapAccount[]; counts: ReturnType<typeof buildPanelAccountCounts> }> {
  const all = await listAllBootstrapPanelAccounts(adminClient);
  const accounts = filterPanelAccountsForCaller(all, callerRole);
  return { accounts, counts: buildPanelAccountCounts(accounts) };
}
