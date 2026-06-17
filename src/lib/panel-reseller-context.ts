import { getResellerDaUsername } from '@/lib/directadmin-credentials';
import { loadResellerCredentialsByDaUsername, loadResellerCredentialsByUserId } from '@/lib/da-credential-store';
import { resolvePanelDaContext } from '@/lib/panel-api-context';
import type { PanelAuthSuccess } from '@/lib/panel-api-auth';
import { getDaSyncAdmin } from '@/lib/da-sync-schema';
import { OSHER_DOMAIN } from '@/lib/email-domains';

export type ResellerPanelContext = {
  daUsername: string;
  email: string;
  displayName: string;
  primaryDomain: string | null;
  impersonating: boolean;
};

function formatResellerUsername(username: string): string {
  const withSpaces = username
    .replace(/([a-z])(collective|group|corp|ltd)$/i, '$1 $2')
    .replace(/([a-z])([A-Z])/g, '$1 $2');
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
}

async function loadResellerDisplayName(daUsername: string): Promise<string> {
  const admin = getDaSyncAdmin();
  if (admin) {
    const { data: profile } = await admin
      .from('profiles')
      .select('name')
      .ilike('da_username', daUsername)
      .maybeSingle();
    if (profile?.name && String(profile.name).trim()) {
      return String(profile.name).trim();
    }

    const { data: panelUser } = await admin
      .from('panel_users')
      .select('first_name, last_name')
      .eq('username', daUsername)
      .maybeSingle();
    const full = [panelUser?.first_name, panelUser?.last_name]
      .filter(Boolean)
      .join(' ')
      .trim();
    if (full) return full;
  }
  return formatResellerUsername(daUsername);
}

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

  const emailPromise = ctx.impersonating
    ? loadResellerEmail(daUsername)
    : (async () => {
        const fromAuth = auth.user.email?.toLowerCase();
        return fromAuth || (await loadResellerEmail(daUsername));
      })();

  const [email, displayName] = await Promise.all([emailPromise, loadResellerDisplayName(daUsername)]);

  return {
    daUsername,
    email,
    displayName,
    primaryDomain:
      creds?.domain ||
      (daUsername.toLowerCase() === 'oshercollective' ? OSHER_DOMAIN : null),
    impersonating: Boolean(ctx.impersonating),
  };
}
