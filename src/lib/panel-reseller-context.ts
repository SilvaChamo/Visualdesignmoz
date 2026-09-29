import { getResellerDaUsername } from '@/lib/directadmin-credentials';
import { loadResellerCredentialsByDaUsername, loadResellerCredentialsByUserId } from '@/lib/da-credential-store';
import { resolvePanelDaContext, readImpersonateDaUsername } from '@/lib/panel-api-context';
import type { PanelStaffAuthSuccess } from '@/lib/panel-api-auth';
import { getDaSyncAdmin } from '@/lib/da-sync-schema';
import { OSHER_DOMAIN } from '@/lib/email-domains';
import type { AccountLevel } from '@/lib/account-levels';

/**
 * Contas Supabase (logo, "Meu Perfil", etc.) são identificadas por `auth.user.id` —
 * mas quando um admin está a impersonar um revendedor, `auth.user.id` continua a
 * ser o ID do PRÓPRIO ADMIN (a sessão do browser nunca muda). Sem isto, qualquer
 * escrita "escopada ao utilizador actual" feita durante impersonação acaba a
 * gravar/ler na conta do admin em vez de na do revendedor impersonado.
 */
export async function resolveEffectivePanelUserId(auth: { id: string; role: string }): Promise<string> {
  if (auth.role !== 'admin') return auth.id;

  const daUsername = await readImpersonateDaUsername();
  if (!daUsername) return auth.id;

  const admin = getDaSyncAdmin();
  if (!admin) return auth.id;

  const { data: profile } = await admin
    .from('profiles')
    .select('user_id, id')
    .ilike('da_username', daUsername)
    .maybeSingle();
  if (profile?.user_id) return profile.user_id as string;
  if (profile?.id) return profile.id as string;

  const { data: panelUser } = await admin
    .from('panel_users')
    .select('auth_user_id')
    .eq('username', daUsername)
    .maybeSingle();
  if (panelUser?.auth_user_id) return panelUser.auth_user_id as string;

  return auth.id;
}

export type ResellerPanelContext = {
  /** Conta activa — a conta principal, ou a conta de domínio em que o login
   * entrou com credenciais (Premium). */
  daUsername: string;
  email: string;
  displayName: string;
  primaryDomain: string | null;
  impersonating: boolean;
  /** Conta principal do login (igual a daUsername excepto dentro de uma conta ligada). */
  mainAccount: string;
  /** Conta de domínio ligada em que o login entrou (Premium), ou null. */
  enteredAccount: string | null;
  /** Contas ligadas geridas directamente (Enterprise) — os seus domínios
   * fazem parte da lista do painel. */
  linkedOwners: string[];
  level: AccountLevel | null;
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
  auth: PanelStaffAuthSuccess,
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

  const scope = ctx.accountScope ?? null;
  return {
    daUsername,
    email,
    displayName,
    primaryDomain:
      creds?.domain ||
      (daUsername.toLowerCase() === 'oshercollective' ? OSHER_DOMAIN : null),
    impersonating: Boolean(ctx.impersonating),
    mainAccount: scope?.main || daUsername,
    enteredAccount: scope?.entered ?? null,
    linkedOwners: ctx.mirrorScope.linkedOwners ?? [],
    level: scope?.level ?? null,
  };
}
