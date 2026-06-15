/**
 * Resolve qual conta DirectAdmin abrir (admin vs revenda — nunca conta de cliente final).
 */

import {
  getAdminDaUsername,
  getResellerDaUsername,
} from '@/lib/directadmin-credentials';
import { loadResellerCredentialsByUserId } from '@/lib/da-credential-store';
import { readImpersonateDaUsername } from '@/lib/panel-api-context';
import type { PanelAuthSuccess } from '@/lib/panel-api-auth';
import { getDaSyncAdmin } from '@/lib/da-sync-schema';
import type { DirectAdminAccessTarget } from '@/lib/server-config';

async function climbToResellerDaUsername(username: string): Promise<string> {
  const trimmed = username.trim().toLowerCase();
  const admin = getDaSyncAdmin();
  if (!admin) return trimmed;

  let current = trimmed;
  for (let depth = 0; depth < 4; depth++) {
    const { data } = await admin
      .from('panel_users')
      .select('username, acl, parent_username')
      .eq('username', current)
      .maybeSingle();

    if (!data?.username) return current;

    const acl = String(data.acl || '').toLowerCase();
    if (acl === 'reseller' || acl === 'admin') return String(data.username).toLowerCase();

    const parent = String(data.parent_username || '').trim().toLowerCase();
    if (!parent || parent === current) return current;
    current = parent;
  }

  return current;
}

/** Caminho rápido — sem `resolvePanelDaContext` nem credenciais DA completas. */
export async function resolveDirectAdminLoginUsernameFast(
  auth: PanelAuthSuccess,
  target: DirectAdminAccessTarget,
): Promise<string> {
  if (target === 'admin') {
    return getAdminDaUsername();
  }

  let daUsername: string | null = null;

  if (auth.user.role === 'admin') {
    daUsername = await readImpersonateDaUsername();
  } else {
    const stored = await loadResellerCredentialsByUserId(auth.user.id);
    daUsername =
      stored?.user ||
      (await getResellerDaUsername({
        id: auth.user.id,
        email: auth.user.email,
        role: 'reseller',
      }));
  }

  if (!daUsername?.trim()) {
    throw new Error('Conta de revenda não encontrada para este utilizador.');
  }

  return climbToResellerDaUsername(daUsername);
}
