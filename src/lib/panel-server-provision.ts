/**
 * Provisiona contas criadas no espelho no servidor de hospedagem (best-effort).
 * Se o servidor estiver indisponível, a conta permanece no painel até à próxima sincronização.
 */

import { createClient } from '@supabase/supabase-js';
import { daPostViaSsh } from '@/lib/da-api-ssh';
import * as hestiaAdapter from '@/lib/hestia-adapter';
import { decryptDaSecret } from '@/lib/da-credential-store';
import { upsertPanelAuthAccount } from '@/lib/panel-auth-accounts';
import { saveProfileForAuthUser } from '@/lib/profile-db';
import { getDaSyncAdmin } from '@/lib/da-sync-schema';
import { PANEL_SLUG } from '@/lib/panel-tenant';
import type { UserRole } from '@/lib/user-roles';
import { patchMirrorUser } from '@/lib/panel-mirror-write';
import { runHestiaFullSyncDeduped } from '@/lib/hestia-sync-engine';
import { getProviderByUsername, isHestiaOnlyDeploy } from '@/lib/hosting-provider';
import { getServerHost } from '@/lib/server-config';
import { pointDomainToServerIp } from '@/lib/cloudflare-dns';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function accountCreateFields(input: {
  userName: string;
  email: string;
  password: string;
  domain: string;
  packageName: string;
}): Record<string, string> {
  return {
    action: 'create',
    username: input.userName,
    email: input.email,
    passwd: input.password,
    passwd2: input.password,
    domain: input.domain,
    package: input.packageName,
    ip: 'shared',
    notify: 'no',
  };
}

function isDaAlreadyExistsError(error?: string): boolean {
  const t = (error || '').toLowerCase();
  return (
    t.includes('already') ||
    t.includes('exists') ||
    t.includes('duplicate') ||
    t.includes('in use') ||
    t.includes('já existe')
  );
}

function isDaLicenseOrUnavailable(error?: string): boolean {
  const t = (error || '').toLowerCase();
  return (
    t.includes('license') ||
    t.includes('licen') ||
    t.includes('unauthorized') ||
    t.includes('not logged in') ||
    t.includes('access denied') ||
    t.includes('indisponível') ||
    t.includes('unavailable') ||
    t.includes('connection')
  );
}

async function markAccountServerLinked(params: {
  userId: string;
  email: string;
  role: UserRole;
  name?: string | null;
  userName: string;
  domain: string;
}): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return;
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  await saveProfileForAuthUser(admin, params.userId, {
    email: params.email,
    da_username: params.userName,
    da_domain: params.domain,
    da_provisioned_at: new Date().toISOString(),
  });
  await upsertPanelAuthAccount(admin, {
    userId: params.userId,
    email: params.email,
    role: params.role,
    name: params.name,
    serverLinked: true,
    daUsername: params.userName,
    provider: isHestiaOnlyDeploy() ? 'hestia' : undefined,
  });
  await patchMirrorUser(params.userName, { updated_at: new Date().toISOString() });
}

export async function provisionPanelAccountToServer(userName: string): Promise<{
  ok: boolean;
  linked: boolean;
  error?: string;
}> {
  const sb = getDaSyncAdmin();
  if (!sb) return { ok: false, linked: false, error: 'Base de dados indisponível' };

  const username = String(userName || '').trim();
  if (!username) return { ok: false, linked: false, error: 'Utilizador inválido' };

  const { data: panelUser } = await sb
    .from('panel_users')
    .select('username, acl, package_name, email, first_name, last_name, auth_user_id')
    .eq('username', username)
    .maybeSingle();

  if (!panelUser?.auth_user_id) {
    return { ok: false, linked: false, error: 'Conta sem ligação ao painel' };
  }

  const userId = String(panelUser.auth_user_id);

  const { data: authRow } = await sb
    .from('panel_auth_accounts')
    .select('server_linked, email, role, name, provider')
    .eq('user_id', userId)
    .eq('panel_slug', PANEL_SLUG.toLowerCase())
    .maybeSingle();

  if (authRow?.server_linked === true) {
    return { ok: true, linked: true };
  }

  const { data: site } = await sb
    .from('panel_sites')
    .select('domain, admin_email, package')
    .eq('owner', username)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const domain = String(site?.domain || `${username}.com`).trim().toLowerCase();
  const packageName = String(panelUser.package_name || site?.package || 'Default').trim() || 'Default';
  const email = String(site?.admin_email || panelUser.email || authRow?.email || '').trim();

  if (!email.includes('@')) {
    return { ok: false, linked: false, error: 'Email da conta em falta' };
  }

  // A password vive em profiles.da_password_encrypted — NÃO em
  // email_contas.senha_servidor: essa tabela tem cliente_id como FK para
  // 'clientes' (tabela legada, vazia em produção), nunca para auth.users,
  // por isso o lookup por cliente_id=userId falhava sempre em silêncio.
  const { data: profileRow } = await sb
    .from('profiles')
    .select('da_password_encrypted')
    .eq('user_id', userId)
    .maybeSingle();

  if (!profileRow?.da_password_encrypted) {
    return { ok: false, linked: false, error: 'Credenciais da conta em falta' };
  }

  const password = decryptDaSecret(String(profileRow.da_password_encrypted));
  if (!password || password.length < 8) {
    return { ok: false, linked: false, error: 'Password da conta inválida' };
  }

  const acl = String(panelUser.acl || 'user').toLowerCase();
  const provider = isHestiaOnlyDeploy()
    ? 'hestia'
    : await getProviderByUsername(username);

  const result =
    provider === 'hestia'
      ? await hestiaAdapter.createAccount({ username, password, email, domain, packageName })
      : await daPostViaSsh(
          acl === 'reseller' ? 'CMD_API_ACCOUNT_RESELLER' : 'CMD_API_ACCOUNT_USER',
          accountCreateFields({ userName: username, email, password, domain, packageName }),
        );

  if (!result.ok && !isDaAlreadyExistsError(result.error)) {
    return {
      ok: false,
      linked: false,
      error: isDaLicenseOrUnavailable(result.error)
        ? 'Servidor de hospedagem indisponível'
        : result.error || 'Falha ao criar conta no servidor',
    };
  }

  const displayName =
    `${String(panelUser.first_name || '')} ${String(panelUser.last_name || '')}`.trim() ||
    authRow?.name ||
    email.split('@')[0];
  const role: UserRole = (authRow?.role as UserRole) || 'client';

  await markAccountServerLinked({
    userId,
    email: email.toLowerCase(),
    role,
    name: displayName,
    userName: username,
    domain,
  });

  // Só notifica o cliente quando a conta foi mesmo criada agora nesta
  // tentativa (result.ok) — se caiu no ramo "já existe" (isDaAlreadyExistsError),
  // a password que enviámos ao DA foi ignorada e não corresponde à real.
  if (result.ok && role === 'client') {
    const { notifyHostingAccountProvisioned } = await import('@/lib/notify-hosting-client');
    await notifyHostingAccountProvisioned({
      to: email,
      clientName: displayName,
      domain,
      daUsername: username,
      password,
    }).catch(() => {});
  }

  // A conta acabou de nascer no servidor real com quota/limites do pacote —
  // sem isto, o admin só via esses valores 20 min depois (na próxima cron),
  // e nem isso corria de facto (crontab do Contabo nunca chegou a ser
  // instalado com sucesso, ver deploy-contabo.yml). Não bloqueia a resposta
  // ao cliente por causa disto.
  if (result.ok && provider === 'hestia') {
    runHestiaFullSyncDeduped().catch((err) =>
      console.error('[panel-server-provision] sync Hestia pós-criação falhou:', err),
    );
    const serverIp = getServerHost();
    void pointDomainToServerIp(domain, serverIp).catch((err) =>
      console.error('[panel-server-provision] A/www Cloudflare:', err),
    );
    void (async () => {
      for (const waitMs of [20_000, 60_000, 180_000]) {
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        const ssl = await hestiaAdapter.issueLetsEncrypt(username, domain);
        if (ssl.ok) return;
      }
    })().catch((err) => console.error('[panel-server-provision] retry SSL:', err));
  }

  return { ok: true, linked: true };
}

export async function provisionPendingPanelAccounts(): Promise<{
  attempted: number;
  linked: number;
  errors: string[];
}> {
  const sb = getDaSyncAdmin();
  if (!sb) return { attempted: 0, linked: 0, errors: ['Base de dados indisponível'] };

  const { data: pending } = await sb
    .from('panel_auth_accounts')
    .select('user_id')
    .eq('panel_slug', PANEL_SLUG.toLowerCase())
    .eq('server_linked', false);

  const errors: string[] = [];
  let linked = 0;
  let attempted = 0;

  for (const row of pending || []) {
    const userId = String(row.user_id || '');
    if (!userId) continue;

    const { data: panelUser } = await sb
      .from('panel_users')
      .select('username')
      .eq('auth_user_id', userId)
      .maybeSingle();

    const username = String(panelUser?.username || '').trim();
    if (!username) continue;

    attempted += 1;
    const result = await provisionPanelAccountToServer(username);
    if (result.linked) {
      linked += 1;
    } else if (result.error && !isDaLicenseOrUnavailable(result.error)) {
      errors.push(`${username}: ${result.error}`);
    }
    if (isDaLicenseOrUnavailable(result.error)) break;
  }

  return { attempted, linked, errors };
}

let provisionTimer: ReturnType<typeof setTimeout> | null = null;

/** Tenta provisionar no servidor sem bloquear a UI. */
export function schedulePanelServerProvision(userName?: string, delayMs = 2000): void {
  if (typeof setImmediate !== 'undefined') {
    setImmediate(() => {
      if (provisionTimer) clearTimeout(provisionTimer);
      provisionTimer = setTimeout(() => {
        provisionTimer = null;
        const run = userName
          ? provisionPanelAccountToServer(userName)
          : provisionPendingPanelAccounts().then(() => ({ ok: true, linked: false }));
        run.catch((e) => console.error('[panel-server-provision]', e));
      }, delayMs);
    });
  }
}
