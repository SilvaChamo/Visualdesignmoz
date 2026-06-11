import { getResellerDaUsername } from '@/lib/directadmin-credentials';
import { loadResellerCredentialsByDaUsername, loadResellerCredentialsByUserId } from '@/lib/da-credential-store';
import { resolvePanelDaContext } from '@/lib/panel-api-context';
import type { PanelAuthSuccess } from '@/lib/panel-api-auth';
import { getDaSyncAdmin } from '@/lib/da-sync-schema';

export type ResellerPanelContext = {
  daUsername: string;
  email: string;
  primaryDomain: string | null;
  impersonating: boolean;
};

async function loadResellerEmail(daUsername: string, fallback?: string): Promise<string> {
  const admin = getDaSyncAdmin();
  if (admin) {
    const { data: panelUser } = await admin
      .from('panel_users')
      .select('email')
      .eq('username', daUsername)
      .maybeSingle();
    if (panelUser?.email) return String(panelUser.email).toLowerCase();

    const { data: profile } = await admin
      .from('profiles')
      .select('email')
      .ilike('da_username', daUsername)
      .maybeSingle();
    if (profile?.email) return String(profile.email).toLowerCase();
  }
  return (fallback || '').toLowerCase();
}

export async function resolveResellerPanelContext(
  auth: PanelAuthSuccess,
): Promise<ResellerPanelContext | null> {
  const ctx = await resolvePanelDaContext(auth);

  if (ctx.effectiveRole !== 'reseller') {
    return null;
  }

  const daUsername =
    ctx.mirrorScope.daUsername ||
    ctx.impersonating ||
    (await getResellerDaUsername({
      id: auth.user.id,
      email: auth.user.email,
      role: 'reseller',
    }));

  if (!daUsername) return null;

  const creds =
    (await loadResellerCredentialsByDaUsername(daUsername)) ||
    (auth.user.id ? await loadResellerCredentialsByUserId(auth.user.id) : null);

  const email = ctx.impersonating
    ? await loadResellerEmail(daUsername)
    : (auth.user.email || (await loadResellerEmail(daUsername)));

  return {
    daUsername,
    email,
    primaryDomain: creds?.domain || null,
    impersonating: Boolean(ctx.impersonating),
  };
}
