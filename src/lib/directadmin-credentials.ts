/**
 * Credenciais DirectAdmin — admin via env; revendedor via Supabase (automático).
 */

import {
  loadResellerCredentialsByUserId,
  loadResellerCredentialsByEmail,
  loadResellerCredentialsByDaUsername,
} from '@/lib/da-credential-store';

export type DirectAdminRole = 'admin' | 'reseller';

export interface DirectAdminCredentials {
  role: DirectAdminRole;
  user: string;
  password: string;
  /**
   * Ignora a password e usa sempre o proxy SSH (`directadmin api-url --user=X`),
   * que o DirectAdmin gera localmente no servidor sem precisar de conhecer a
   * password real de X. Usado para impersonar um revendedor sem depender de
   * uma password guardada à parte, que fica facilmente desactualizada
   * (foi a causa de o impersonate mostrar os dados do admin em vez do
   * revendedor — a password guardada já não batia certo com o servidor).
   */
  forceSshProxy?: boolean;
  /**
   * Nunca cair para o proxy SSH, nem no caminho normal nem como recurso após um
   * 401/403 HTTP. O proxy SSH gera acesso via chave root do servidor e ignora a
   * password por completo — está certo para o admin representar um revendedor,
   * mas destrói por completo qualquer chamada cujo objectivo seja precisamente
   * confirmar se ESTA password é a correcta (ex.: login do painel a validar
   * contra o DirectAdmin). Nessas chamadas, um 401 tem de continuar a ser 401.
   */
  skipSshFallback?: boolean;
}

export type DirectAdminAuthContext = {
  id?: string;
  email?: string;
  role: DirectAdminRole;
};

function readEnv(name: string): string {
  const value = process.env[name];
  if (!value) return '';
  return value.trim().replace(/^['"]|['"]$/g, '');
}

function pickAdminPassword(): string {
  const candidates = [
    readEnv('DIRECTADMIN_LOGIN_KEY'),
    readEnv('DIRECTADMIN_PASSWORD'),
    readEnv('DIRECTADMIN_PASS'),
  ];
  return candidates.find(Boolean) || '';
}

/** Login web DirectAdmin aceita email; API Basic auth exige o nome da conta (`admin`). */
export function getAdminDaUsername(): string {
  return resolveAdminApiUsername(readEnv('DIRECTADMIN_USER'));
}

function resolveAdminApiUsername(configured: string): string {
  const user = configured || 'admin';
  return user.includes('@') ? 'admin' : user;
}

function resolveAdminCredentials(): DirectAdminCredentials {
  const user = resolveAdminApiUsername(readEnv('DIRECTADMIN_USER'));
  const password = pickAdminPassword();
  if (!password) {
    throw new Error(
      'Credencial DirectAdmin admin ausente. Configure DIRECTADMIN_PASSWORD ou DIRECTADMIN_LOGIN_KEY.',
    );
  }
  return { role: 'admin', user, password };
}

/** Legado — migração de contas já existentes no servidor (ex.: Osher). */
async function resolveLegacyEnvReseller(): Promise<DirectAdminCredentials | null> {
  const user = readEnv('DIRECTADMIN_RESELLER_USER');
  const password =
    readEnv('DIRECTADMIN_RESELLER_LOGIN_KEY') ||
    readEnv('DIRECTADMIN_RESELLER_PASSWORD') ||
    readEnv('DIRECTADMIN_RESELLER_PASS');
  if (!user || !password) return null;
  return { role: 'reseller', user, password };
}

export async function resolveDirectAdminCredentials(
  role: DirectAdminRole = 'admin',
  context?: DirectAdminAuthContext,
): Promise<DirectAdminCredentials> {
  if ((process.env.DEFAULT_HOSTING_PROVIDER || '').trim().toLowerCase() === 'hestia') {
    throw new Error('DirectAdmin não está disponível neste servidor (Hestia).');
  }
  if (role === 'admin') {
    return resolveAdminCredentials();
  }

  if (context?.id) {
    const stored = await loadResellerCredentialsByUserId(context.id);
    if (stored) {
      return { role: 'reseller', user: stored.user, password: stored.password };
    }
  }

  if (context?.email) {
    const stored = await loadResellerCredentialsByEmail(context.email);
    if (stored) {
      return { role: 'reseller', user: stored.user, password: stored.password };
    }
  }

  // Sem credenciais ligadas a esta conta — não usar env legado (evita ver dados de outro revendedor).
  if (context?.id || context?.email) {
    throw new Error(
      'Conta de revenda em provisionamento. Aguarde alguns segundos ou sincronize em Admin → Utilizadores.',
    );
  }

  const legacy = await resolveLegacyEnvReseller();
  if (legacy) return legacy;

  throw new Error(
    'Conta de revenda em provisionamento. Aguarde alguns segundos ou sincronize em Admin → Utilizadores.',
  );
}

/**
 * Credenciais DA de quem é dono do domínio no servidor — para operações que um
 * cliente comum pode disparar sobre a própria conta (ex.: trocar a password do
 * seu email), mas que o DirectAdmin só aceita de admin/revendedor. O cliente
 * nunca tem credenciais DA próprias; usa-se sempre as de quem realmente é dono
 * do domínio (admin ou o revendedor a quem esse domínio pertence).
 */
export async function resolveDirectAdminCredentialsForDomainOwner(
  domain: string,
): Promise<DirectAdminCredentials> {
  const { getMirrorSiteOwner } = await import('@/lib/panel-mirror-read');
  const owner = await getMirrorSiteOwner(domain);

  if (owner && owner !== getAdminDaUsername()) {
    const stored = await loadResellerCredentialsByDaUsername(owner);
    if (stored) return { role: 'reseller', user: stored.user, password: stored.password };
  }

  return resolveAdminCredentials();
}

export async function getResellerDaUsername(context?: DirectAdminAuthContext): Promise<string> {
  if (context?.id) {
    const stored = await loadResellerCredentialsByUserId(context.id);
    if (stored?.user) return stored.user;
  }
  if (context?.email) {
    const stored = await loadResellerCredentialsByEmail(context.email);
    if (stored?.user) return stored.user;
  }

  // Uma conta já no Hestia nunca devolve credenciais acima (de propósito —
  // ver da-credential-store.ts), mas o username continua a existir no
  // espelho. Sem este fallback, todo o resto do painel (getResellerDaUsername
  // é a base de resolvePanelDaContext/resolveResellerPanelContext) tratava
  // o revendedor como se não tivesse conta nenhuma — dashboard vazio.
  const { getDaSyncAdmin } = await import('@/lib/da-sync-schema');
  const sb = getDaSyncAdmin();
  if (sb) {
    if (context?.id) {
      const { getProfileForAuthUser } = await import('@/lib/profile-db');
      const profile = await getProfileForAuthUser(sb, context.id);
      if (profile?.da_username) return profile.da_username;

      const { data: panelUser } = await sb
        .from('panel_users')
        .select('username')
        .eq('auth_user_id', context.id)
        .maybeSingle();
      if (panelUser?.username) return panelUser.username;
    }
    if (context?.email) {
      const { data: panelUser } = await sb
        .from('panel_users')
        .select('username')
        .eq('email', context.email.toLowerCase())
        .maybeSingle();
      if (panelUser?.username) return panelUser.username;
    }
  }

  return readEnv('DIRECTADMIN_RESELLER_USER') || readEnv('NEXT_PUBLIC_DIRECTADMIN_RESELLER_USER') || '';
}
