import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/admin-api-auth';
import { requireAdminOrReseller } from '@/lib/panel-api-auth';
import {
  resolveUserRole,
  getRedirectPathForRole,
  type UserRole,
} from '@/lib/user-roles';
import {
  ensureResellerProvisioned,
  provisionAllPendingResellers,
} from '@/lib/reseller-auto-provision';
import {
  getProfileForAuthUser,
  profileName,
  saveProfileForAuthUser,
  type ProfileRow,
} from '@/lib/profile-db';
import { upsertDownloadableCredentials, decryptStoredPassword } from '@/lib/panel-access-credentials';
import { STANDARD_PANEL_PASSWORD } from '@/lib/stored-panel-password';
import {
  filterPanelAccountsForCaller,
  listAllBootstrapPanelAccounts,
  buildPanelAccountCounts,
} from '@/lib/panel-mirror-read';
import {
  belongsToCurrentPanel,
  resolveAccountPanelSite,
  PANEL_SLUG,
} from '@/lib/panel-tenant';
import {
  backfillPanelAuthAccountsFromProfiles,
  deletePanelAuthAccount,
  upsertPanelAuthAccount,
} from '@/lib/panel-auth-accounts';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const PANEL_USERS_SERVER_CACHE_MS = 60_000;

let panelUsersServerCache: {
  at: number;
  users: PanelAccountRow[];
} | null = null;

function clearPanelUsersServerCache() {
  panelUsersServerCache = null;
}

async function backfillDownloadableCredentials(
  admin: SupabaseClient,
  authUsers: User[],
) {
  for (const authUser of authUsers) {
    if (!authUser.email) continue;
    const email = authUser.email.toLowerCase();
    const panelSite = resolveAccountPanelSite({
      userMetadata: authUser.user_metadata as Record<string, unknown>,
      email,
    });
    if (!belongsToCurrentPanel(panelSite)) continue;

    const { data: row } = await admin
      .from('email_contas')
      .select('senha_servidor')
      .eq('email', email)
      .maybeSingle();
    if (row?.senha_servidor) continue;

    const profile = await getProfileForAuthUser(admin, authUser.id);
    const role =
      profile?.role ||
      authUser.user_metadata?.role ||
      'client';

    await upsertDownloadableCredentials(admin, {
      email,
      password: STANDARD_PANEL_PASSWORD,
      userId: authUser.id,
      role: String(role),
    });
  }
}

async function assertAccountBelongsToPanel(
  admin: SupabaseClient,
  userId: string,
): Promise<{ user: User; panelSite: string }> {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data.user) {
    throw new Error('Conta não encontrada.');
  }
  const panelSite = resolveAccountPanelSite({
    userMetadata: data.user.user_metadata as Record<string, unknown>,
    email: data.user.email,
  });
  if (!belongsToCurrentPanel(panelSite)) {
    throw new Error('Esta conta pertence a outro painel e não pode ser alterada aqui.');
  }
  return { user: data.user, panelSite };
}

export type PanelAccountRow = {
  id: string;
  email: string;
  userName: string;
  daUsername?: string | null;
  serverLinked?: boolean;
  panelRole: UserRole;
  panelPath: string;
  state: string;
  lastSignIn: string | null;
  nome: string | null;
};

function profileDisplayName(
  profile: ProfileRow | null | undefined,
  authUser: User,
  email: string,
): string {
  return (
    profileName(profile) ||
    (authUser.user_metadata?.nome as string) ||
    (authUser.user_metadata?.name as string) ||
    email.split('@')[0]
  );
}

async function listAllAuthUsers(admin: SupabaseClient) {
  const users: User[] = [];
  let page = 1;

  while (page <= 50) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...(data.users || []));
    if (!data.users?.length || data.users.length < 1000) break;
    page += 1;
  }

  return users;
}

async function loadPaidUserIds(admin: SupabaseClient, userIds: string[]): Promise<Set<string>> {
  const paid = new Set<string>();
  if (!userIds.length) return paid;

  const chunkSize = 200;
  for (let i = 0; i < userIds.length; i += chunkSize) {
    const chunk = userIds.slice(i, i + chunkSize);
    const [pagamentos, domains, hosting, sites] = await Promise.all([
      admin.from('pagamentos').select('user_id').in('user_id', chunk).in('status', ['paid', 'completed']),
      admin.from('domain_renewals').select('user_id').in('user_id', chunk),
      admin.from('hosting_renewals').select('user_id').in('user_id', chunk),
      admin.from('site_clientes').select('cliente_id').in('cliente_id', chunk),
    ]);

    for (const row of (pagamentos.data ?? []) as Array<{ user_id?: string }>) {
      if (row.user_id) paid.add(row.user_id);
    }
    for (const row of (domains.data ?? []) as Array<{ user_id?: string }>) {
      if (row.user_id) paid.add(row.user_id);
    }
    for (const row of (hosting.data ?? []) as Array<{ user_id?: string }>) {
      if (row.user_id) paid.add(row.user_id);
    }
    for (const row of (sites.data ?? []) as Array<{ cliente_id?: string }>) {
      if (row.cliente_id) paid.add(row.cliente_id);
    }
  }

  return paid;
}

/** Sincroniza papéis automáticos (revenda/cliente/visitante). Admin/gestão nunca são automáticos. */
async function syncAutomaticPanelRoles(admin: SupabaseClient) {
  const authUsers = await listAllAuthUsers(admin);
  const paidIds = await loadPaidUserIds(
    admin,
    authUsers.map((u) => u.id),
  );

  for (const authUser of authUsers) {
    if (!authUser.email) continue;
    const panelSite = resolveAccountPanelSite({
      userMetadata: authUser.user_metadata as Record<string, unknown>,
      email: authUser.email,
    });
    if (!belongsToCurrentPanel(panelSite)) continue;

    const email = authUser.email.toLowerCase();
    const profile = await getProfileForAuthUser(admin, authUser.id);
    const daUsername =
      (profile?.da_username as string) ||
      (authUser.user_metadata?.da_username as string) ||
      null;

    const currentMetaRole = readRoleFromMeta(authUser.user_metadata?.role);
    const currentProfileRole = readRoleFromMeta(profile?.role);

    // Admin e gestão são manuais — não sobrescrever.
    if (isManualPanelRole(currentProfileRole) || isManualPanelRole(currentMetaRole)) continue;

    let role = resolveUserRole({
      email,
      userMetadata: authUser.user_metadata as Record<string, unknown>,
      appMetadata: authUser.app_metadata as Record<string, unknown>,
      profileRole: profile?.role ?? null,
      daUsername,
      hasPaidProducts: paidIds.has(authUser.id),
    });

    if (role === 'admin' || role === 'manager') continue;

    const needsProfile = !profile || profile.role !== role;
    const needsMeta = currentMetaRole !== role;

    if (!needsProfile && !needsMeta) continue;

    await saveProfileForAuthUser(admin, authUser.id, {
      email,
      role,
      name: profileDisplayName(profile, authUser, email),
      da_username: daUsername,
    });

    if (needsMeta) {
      await admin.auth.admin.updateUserById(authUser.id, {
        user_metadata: { ...authUser.user_metadata, role },
      });
    }
  }
}

function readRoleFromMeta(value: unknown): UserRole | null {
  if (
    value === 'admin' ||
    value === 'manager' ||
    value === 'reseller' ||
    value === 'client' ||
    value === 'guest'
  ) {
    return value;
  }
  return null;
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function isManualPanelRole(role: UserRole | null): boolean {
  return role === 'admin' || role === 'manager';
}

function shouldTryServerProvision(role: UserRole, provisionDa?: boolean): boolean {
  return role === 'reseller' && provisionDa !== false;
}

async function resolveResellerProvisionPassword(
  admin: SupabaseClient,
  userId: string,
  email: string,
  explicitPassword?: string,
): Promise<{ password?: string; syncGeneratedPassword: boolean }> {
  if (explicitPassword && explicitPassword.length >= 6) {
    return { password: explicitPassword, syncGeneratedPassword: true };
  }

  const { data: cred } = await admin
    .from('email_contas')
    .select('senha_servidor')
    .eq('email', email.toLowerCase())
    .maybeSingle();

  if (cred?.senha_servidor) {
    const stored = decryptStoredPassword(String(cred.senha_servidor));
    if (stored && stored.length >= 6) {
      return { password: stored, syncGeneratedPassword: false };
    }
  }

  return { password: undefined, syncGeneratedPassword: false };
}

async function tryProvisionReseller(
  admin: SupabaseClient,
  params: {
    userId: string;
    email: string;
    nome?: string;
    explicitPassword?: string;
    provisionDa?: boolean;
    role: UserRole;
  },
) {
  if (!shouldTryServerProvision(params.role, params.provisionDa)) {
    return { provisionResult: null as Awaited<ReturnType<typeof ensureResellerProvisioned>> | null, provisionWarning: null as string | null };
  }

  try {
    const resolved = await resolveResellerProvisionPassword(
      admin,
      params.userId,
      params.email,
      params.explicitPassword,
    );
    const provisionResult = await ensureResellerProvisioned({
      userId: params.userId,
      email: params.email,
      nome: params.nome,
      password: resolved.password ?? params.explicitPassword,
      syncGeneratedPassword: resolved.syncGeneratedPassword,
    });
    return { provisionResult, provisionWarning: null };
  } catch (e: unknown) {
    return {
      provisionResult: null,
      provisionWarning: stripHtml(e instanceof Error ? e.message : 'Erro ao provisionar no servidor'),
    };
  }
}

async function buildPanelAccounts(options?: {
  sync?: boolean;
  includePaidCheck?: boolean;
}): Promise<PanelAccountRow[]> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('Supabase Service Role não configurado.');
  }

  const admin = createAdminClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  if (options?.sync) {
    try {
      await syncAutomaticPanelRoles(admin);
    } catch (syncError) {
      console.error('[panel-users] syncAutomaticPanelRoles:', syncError);
    }
  }

  const [authUsers, profilesRes, authAccountsRes] = await Promise.all([
    listAllAuthUsers(admin),
    admin.from('profiles').select('id, user_id, email, role, name, da_username'),
    admin
      .from('panel_auth_accounts')
      .select('user_id, server_linked, da_username')
      .eq('panel_slug', PANEL_SLUG.toLowerCase()),
  ]);

  if (profilesRes.error) {
    throw new Error(profilesRes.error.message);
  }

  const profilesByAuthId = new Map<string, ProfileRow>();
  for (const profile of profilesRes.data ?? []) {
    const authId = (profile.user_id as string) || (profile.id as string);
    if (authId) profilesByAuthId.set(authId, profile as ProfileRow);
  }

  const authAccountByUserId = new Map<
    string,
    { server_linked?: boolean; da_username?: string | null }
  >();
  for (const row of authAccountsRes.data ?? []) {
    const userId = String((row as { user_id?: string }).user_id || '');
    if (userId) authAccountByUserId.set(userId, row as { server_linked?: boolean; da_username?: string | null });
  }

  const paidIds = options?.includePaidCheck
    ? await loadPaidUserIds(
        admin,
        authUsers.map((u) => u.id),
      )
    : new Set<string>();

  const rows: PanelAccountRow[] = authUsers
    .filter((u) => u.email)
    .filter((authUser) => {
      const panelSite = resolveAccountPanelSite({
        userMetadata: authUser.user_metadata as Record<string, unknown>,
        email: authUser.email,
      });
      return belongsToCurrentPanel(panelSite);
    })
    .map((authUser) => {
      const email = authUser.email!.toLowerCase();
      const profile = profilesByAuthId.get(authUser.id);
      const authAccount = authAccountByUserId.get(authUser.id);
      const daUsername =
        (profile?.da_username as string) ||
        (authUser.user_metadata?.da_username as string) ||
        authAccount?.da_username ||
        null;
      const panelRole = resolveUserRole({
        email,
        userMetadata: authUser.user_metadata as Record<string, unknown>,
        appMetadata: authUser.app_metadata as Record<string, unknown>,
        profileRole: profile?.role ?? null,
        daUsername,
        hasPaidProducts: paidIds.has(authUser.id),
      });
      const displayName = profileDisplayName(profile, authUser, email);

      return {
        id: authUser.id,
        email,
        userName: displayName,
        daUsername,
        serverLinked: authAccount?.server_linked === true || Boolean(daUsername),
        panelRole,
        panelPath: getRedirectPathForRole(panelRole),
        state: 'Active',
        lastSignIn: authUser.last_sign_in_at ?? null,
        nome: displayName,
      };
    });

  rows.sort((a, b) => a.email.localeCompare(b.email));
  return rows;
}

function filterUsersForCaller(
  users: PanelAccountRow[],
  callerRole: 'admin' | 'reseller',
): PanelAccountRow[] {
  return filterPanelAccountsForCaller(users, callerRole) as PanelAccountRow[];
}

function buildPanelUserCounts(users: PanelAccountRow[]) {
  return {
    all: users.length,
    admin: users.filter((u) => u.panelRole === 'admin').length,
    manager: users.filter((u) => u.panelRole === 'manager').length,
    reseller: users.filter((u) => u.panelRole === 'reseller').length,
    client: users.filter((u) => u.panelRole === 'client').length,
    guest: users.filter((u) => u.panelRole === 'guest').length,
  };
}

export async function GET() {
  const auth = await requireAdminOrReseller();
  if ('error' in auth) return auth.error;

  try {
    if (
      panelUsersServerCache &&
      Date.now() - panelUsersServerCache.at < PANEL_USERS_SERVER_CACHE_MS
    ) {
      const users = filterUsersForCaller(panelUsersServerCache.users, auth.user.role);
      return NextResponse.json({
        success: true,
        users,
        counts: buildPanelUserCounts(users),
        cached: true,
      });
    }

    const allUsers = (await listAllBootstrapPanelAccounts()) as PanelAccountRow[];
    panelUsersServerCache = { at: Date.now(), users: allUsers };
    const users = filterUsersForCaller(allUsers, auth.user.role);

    return NextResponse.json({
      success: true,
      users,
      counts: buildPanelAccountCounts(users),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao listar contas';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST() {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return NextResponse.json(
        { success: false, error: 'Supabase Service Role não configurado.' },
        { status: 500 },
      );
    }

    const admin = createAdminClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const authUsers = await listAllAuthUsers(admin);
    const paidIds = await loadPaidUserIds(
      admin,
      authUsers.map((u) => u.id),
    );

    let profilesSynced = 0;
    for (const authUser of authUsers) {
      if (!authUser.email) continue;
      const email = authUser.email.toLowerCase();
      const profile = await getProfileForAuthUser(admin, authUser.id);
      const daUsername =
        (profile?.da_username as string) ||
        (authUser.user_metadata?.da_username as string) ||
        null;

      const currentMetaRole = readRoleFromMeta(authUser.user_metadata?.role);
      const currentProfileRole = readRoleFromMeta(profile?.role);
      if (isManualPanelRole(currentProfileRole) || isManualPanelRole(currentMetaRole)) {
        profilesSynced += 1;
        continue;
      }

      const role = resolveUserRole({
        email,
        userMetadata: authUser.user_metadata as Record<string, unknown>,
        appMetadata: authUser.app_metadata as Record<string, unknown>,
        profileRole: profile?.role ?? null,
        daUsername,
        hasPaidProducts: paidIds.has(authUser.id),
      });

      if (role === 'admin' || role === 'manager') {
        profilesSynced += 1;
        continue;
      }

      await saveProfileForAuthUser(admin, authUser.id, {
        email,
        role,
        name: profileDisplayName(profile, authUser, email),
        da_username: daUsername,
      });

      if (authUser.user_metadata?.role !== role) {
        await admin.auth.admin.updateUserById(authUser.id, {
          user_metadata: { ...authUser.user_metadata, role },
        });
      }

      profilesSynced += 1;
    }

    clearPanelUsersServerCache();
    const backfilled = await backfillPanelAuthAccountsFromProfiles(admin);
    const provision = await provisionAllPendingResellers();
    await backfillDownloadableCredentials(admin, authUsers);
    const users = await buildPanelAccounts({ sync: false, includePaidCheck: false });

    return NextResponse.json({
      success: true,
      results: {
        authAccounts: authUsers.length,
        profilesSynced,
        panelAuthBackfilled: backfilled,
        resellerProvisioned: provision.provisioned,
        resellerProvisionErrors: provision.errors,
      },
      users,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro na sincronização';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

function allowedCreateRoles(callerRole: 'admin' | 'reseller'): UserRole[] {
  if (callerRole === 'admin') return ['admin', 'manager', 'client', 'reseller'];
  return ['client'];
}

/** Criar conta de painel — Auth + profiles; servidor opcional para revenda. */
export async function PUT(req: NextRequest) {
  const auth = await requireAdminOrReseller();
  if ('error' in auth) return auth.error;

  try {
    const body = await req.json();
    const { email, password, name, role, provisionDa } = body as {
      email?: string;
      password?: string;
      name?: string;
      role?: UserRole;
      /** Só quando true tenta criar revenda no servidor (limites DA aplicam-se). */
      provisionDa?: boolean;
    };

    const normalizedEmail = (email || '').toLowerCase().trim();
    if (!normalizedEmail || !password) {
      return NextResponse.json(
        { success: false, error: 'Email e password são obrigatórios.' },
        { status: 400 },
      );
    }

    if (!role || role === 'guest') {
      return NextResponse.json(
        {
          success: false,
          error: 'Visitantes registam-se automaticamente — não podem ser criados manualmente.',
        },
        { status: 400 },
      );
    }

    if (!allowedCreateRoles(auth.user.role).includes(role)) {
      return NextResponse.json(
        {
          success: false,
          error:
            auth.user.role === 'reseller'
              ? 'Revendedores só podem criar contas de cliente.'
              : 'Papel inválido para criação de conta.',
        },
        { status: 400 },
      );
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return NextResponse.json(
        { success: false, error: 'Supabase Service Role não configurado.' },
        { status: 500 },
      );
    }

    const admin = createAdminClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const displayName = name?.trim() || normalizedEmail.split('@')[0];

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: {
        role,
        name: displayName,
        nome: displayName,
        site: PANEL_SLUG,
      },
    });

    if (createError || !created.user) {
      const msg = createError?.message || 'Erro ao criar conta';
      const status = msg.toLowerCase().includes('already') ? 409 : 400;
      return NextResponse.json({ success: false, error: msg }, { status });
    }

    await saveProfileForAuthUser(admin, created.user.id, {
      email: normalizedEmail,
      role,
      name: displayName,
    });

    await upsertDownloadableCredentials(admin, {
      email: normalizedEmail,
      password,
      userId: created.user.id,
      role,
    });

    await upsertPanelAuthAccount(admin, {
      userId: created.user.id,
      email: normalizedEmail,
      role,
      name: displayName,
      serverLinked: false,
      daUsername: null,
    });

    let provisionResult = null;
    let provisionWarning: string | null = null;
    const provisionAttempt = await tryProvisionReseller(admin, {
      userId: created.user.id,
      email: normalizedEmail,
      nome: displayName,
      explicitPassword: password,
      provisionDa,
      role,
    });
    provisionResult = provisionAttempt.provisionResult;
    provisionWarning = provisionAttempt.provisionWarning;

    if (role === 'reseller' && provisionResult?.daUsername) {
      await upsertPanelAuthAccount(admin, {
        userId: created.user.id,
        email: normalizedEmail,
        role,
        name: displayName,
        serverLinked: true,
        daUsername: provisionResult.daUsername,
      });
    }

    clearPanelUsersServerCache();
    const users = await buildPanelAccounts({ sync: false, includePaidCheck: false });

    const message =
      role === 'admin'
        ? 'Administrador criado com sucesso.'
        : role === 'manager'
          ? 'Conta de gestão criada com sucesso.'
        : role === 'reseller'
          ? provisionResult
            ? `Revendedor criado — servidor: ${provisionResult.daUsername || 'pendente'}`
            : provisionWarning
              ? `Revendedor criado no painel. Servidor: ${provisionWarning}`
              : 'Revendedor criado no painel (sem conta no servidor).'
          : 'Cliente criado com sucesso.';

    return NextResponse.json({
      success: true,
      message,
      userId: created.user.id,
      provision: provisionResult,
      users,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao criar conta';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/** Alterar papel — conta de painel; servidor opcional para revenda. */
export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  try {
    const body = await req.json();
    const { userId, role, email, nome, password, provisionDa } = body as {
      userId?: string;
      role?: UserRole;
      email?: string;
      nome?: string;
      password?: string;
      provisionDa?: boolean;
    };

    if (!userId || !role) {
      return NextResponse.json(
        { success: false, error: 'userId e role são obrigatórios.' },
        { status: 400 },
      );
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return NextResponse.json(
        { success: false, error: 'Supabase Service Role não configurado.' },
        { status: 500 },
      );
    }

    const admin = createAdminClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { user: authUser } = await assertAccountBelongsToPanel(admin, userId);
    const resolvedEmail = (email || authUser.email || '').toLowerCase();

    if (!resolvedEmail) {
      return NextResponse.json({ success: false, error: 'Email não encontrado.' }, { status: 400 });
    }

    const displayName =
      nome || (authUser.user_metadata?.nome as string) || resolvedEmail.split('@')[0];

    await saveProfileForAuthUser(admin, userId, {
      email: resolvedEmail,
      role,
      name: displayName,
    });

    const updatePayload: Parameters<typeof admin.auth.admin.updateUserById>[1] = {
      user_metadata: {
        ...authUser.user_metadata,
        role,
        name: displayName,
        nome: displayName,
        site: PANEL_SLUG,
      },
    };
    if (password && password.length >= 6) {
      updatePayload.password = password;
    }

    await admin.auth.admin.updateUserById(userId, updatePayload);

    if (password && password.length >= 6) {
      await upsertDownloadableCredentials(admin, {
        email: resolvedEmail,
        password,
        userId,
        role,
      });
    }

    const profile = await getProfileForAuthUser(admin, userId);
    await upsertPanelAuthAccount(admin, {
      userId,
      email: resolvedEmail,
      role,
      name: displayName,
      serverLinked: Boolean(profile?.da_username),
      daUsername: profile?.da_username ?? null,
    });

    let provisionResult = null;
    let provisionWarning: string | null = null;
    const provisionAttempt = await tryProvisionReseller(admin, {
      userId,
      email: resolvedEmail,
      nome: nome || (authUser.user_metadata?.nome as string),
      explicitPassword: password,
      provisionDa,
      role,
    });
    provisionResult = provisionAttempt.provisionResult;
    provisionWarning = provisionAttempt.provisionWarning;

    if (role === 'reseller' && provisionResult?.daUsername) {
      await upsertPanelAuthAccount(admin, {
        userId,
        email: resolvedEmail,
        role,
        name: displayName,
        serverLinked: true,
        daUsername: provisionResult.daUsername,
      });
    }

    clearPanelUsersServerCache();
    const users = await buildPanelAccounts({ sync: false, includePaidCheck: false });

    let message = 'Conta actualizada.';
    if (role === 'admin') message = 'Administrador actualizado.';
    else if (role === 'manager') message = 'Conta de gestão actualizada.';
    else if (role === 'reseller') {
      message = provisionResult
        ? `Revendedor activo — servidor: ${provisionResult.daUsername}`
        : provisionWarning
          ? `Conta actualizada no painel. Servidor: ${provisionWarning}`
          : 'Conta actualizada no painel (revenda sem servidor).';
    }

    return NextResponse.json({
      success: true,
      message,
      provisionWarning,
      provision: provisionResult,
      users,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao actualizar papel';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/** Eliminar conta deste painel (Auth + profile). */
export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  try {
    const userId = req.nextUrl.searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'userId é obrigatório.' }, { status: 400 });
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return NextResponse.json(
        { success: false, error: 'Supabase Service Role não configurado.' },
        { status: 500 },
      );
    }

    const admin = createAdminClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    await assertAccountBelongsToPanel(admin, userId);

    const profile = await getProfileForAuthUser(admin, userId);
    if (profile?.id) {
      await admin.from('profiles').delete().eq('id', profile.id);
    }

    await deletePanelAuthAccount(admin, userId).catch(() => undefined);

    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) {
      return NextResponse.json({ success: false, error: deleteError.message }, { status: 400 });
    }

    clearPanelUsersServerCache();
    const users = await buildPanelAccounts({ sync: false, includePaidCheck: false });

    return NextResponse.json({
      success: true,
      message: 'Conta eliminada.',
      users,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao eliminar conta';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
