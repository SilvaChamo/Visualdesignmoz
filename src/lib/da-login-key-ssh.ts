/**
 * Cria login key DirectAdmin via SSH (root) quando a API admin não consegue.
 * Usado pelo sync para contas revendedor sem credenciais no Supabase.
 */

import { executeServerCommand } from '@/lib/server-ssh-exec';
import {
  encryptDaSecret,
  loadResellerCredentialsByDaUsername,
} from '@/lib/da-credential-store';
import { getDaSyncAdmin } from '@/lib/da-sync-schema';

const DA_BIN = '/usr/local/directadmin/directadmin';

export async function ensureDaLoginKeyForUsername(
  daUsername: string,
  panelEmail?: string,
): Promise<boolean> {
  if (!daUsername || daUsername === 'admin') return true;

  const existing = await loadResellerCredentialsByDaUsername(daUsername);
  if (existing?.password) return true;

  const raw = await executeServerCommand(
    `${DA_BIN} api-url --user=${daUsername} 2>/dev/null | tail -1`,
  );
  const match = raw.match(/https:\/\/[^:]+:([^@]+)@/);
  if (!match?.[1]) {
    console.warn(`[da-login-key-ssh] Não foi possível criar login key para ${daUsername}`);
    return false;
  }

  const password = decodeURIComponent(match[1]);
  const admin = getDaSyncAdmin();
  if (!admin) return false;

  const email = panelEmail || `${daUsername}@localhost`;
  const encrypted = encryptDaSecret(password);

  const { data: panelUser } = await admin
    .from('panel_users')
    .select('id, email, auth_user_id')
    .eq('username', daUsername)
    .maybeSingle();

  await admin.from('panel_users').upsert(
    {
      username: daUsername,
      email: panelUser?.email || email,
      acl: 'reseller',
      status: 'Active',
      da_password_encrypted: encrypted,
      da_domain: panelUser?.email?.split('@')[1] || undefined,
      synced_at: new Date().toISOString(),
    },
    { onConflict: 'username' },
  );

  if (panelUser?.auth_user_id) {
    await admin
      .from('profiles')
      .update({
        da_username: daUsername,
        da_password_encrypted: encrypted,
        da_provisioned_at: new Date().toISOString(),
        role: 'reseller',
      })
      .eq('id', panelUser.auth_user_id);
  }

  return true;
}
