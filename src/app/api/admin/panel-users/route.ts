import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/admin-api-auth';
import {
  resolveUserRole,
  getRedirectPathForRole,
  type UserRole,
} from '@/lib/user-roles';
import {
  ensureResellerProvisioned,
  provisionAllPendingResellers,
} from '@/lib/reseller-auto-provision';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export type PanelAccountRow = {
  id: string;
  email: string;
  userName: string;
  panelRole: UserRole;
  panelPath: string;
  state: string;
  lastSignIn: string | null;
  nome: string | null;
};

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

async function buildPanelAccounts(): Promise<PanelAccountRow[]> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('Supabase Service Role não configurado.');
  }

  const admin = createAdminClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const [authUsers, profilesRes] = await Promise.all([
    listAllAuthUsers(admin),
    admin.from('profiles').select('id, email, role, nome'),
  ]);

  const profilesById = new Map(
    (profilesRes.data ?? []).map((p) => [p.id as string, p]),
  );

  const paidIds = await loadPaidUserIds(
    admin,
    authUsers.map((u) => u.id),
  );

  const rows: PanelAccountRow[] = authUsers
    .filter((u) => u.email)
    .map((authUser) => {
      const email = authUser.email!.toLowerCase();
      const profile = profilesById.get(authUser.id);
      const panelRole = resolveUserRole({
        email,
        userMetadata: authUser.user_metadata as Record<string, unknown>,
        appMetadata: authUser.app_metadata as Record<string, unknown>,
        profileRole: profile?.role ?? null,
        hasPaidProducts: paidIds.has(authUser.id),
      });

      return {
        id: authUser.id,
        email,
        userName: (profile?.nome as string) || email.split('@')[0],
        panelRole,
        panelPath: getRedirectPathForRole(panelRole),
        state: 'Active',
        lastSignIn: authUser.last_sign_in_at ?? null,
        nome: (profile?.nome as string) || (authUser.user_metadata?.nome as string) || null,
      };
    });

  rows.sort((a, b) => a.email.localeCompare(b.email));
  return rows;
}

export async function GET() {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  try {
    const users = await buildPanelAccounts();
    const counts = {
      all: users.length,
      admin: users.filter((u) => u.panelRole === 'admin').length,
      reseller: users.filter((u) => u.panelRole === 'reseller').length,
      client: users.filter((u) => u.panelRole === 'client').length,
      guest: users.filter((u) => u.panelRole === 'guest').length,
    };

    return NextResponse.json({ success: true, users, counts });
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
      const { data: profile } = await admin
        .from('profiles')
        .select('role')
        .eq('id', authUser.id)
        .maybeSingle();

      const role = resolveUserRole({
        email,
        userMetadata: authUser.user_metadata as Record<string, unknown>,
        appMetadata: authUser.app_metadata as Record<string, unknown>,
        profileRole: profile?.role ?? null,
        hasPaidProducts: paidIds.has(authUser.id),
      });

      await admin.from('profiles').upsert(
        {
          id: authUser.id,
          email,
          role,
          nome: (authUser.user_metadata?.nome as string) || email.split('@')[0],
        },
        { onConflict: 'id' },
      );

      if (authUser.user_metadata?.role !== role) {
        await admin.auth.admin.updateUserById(authUser.id, {
          user_metadata: { ...authUser.user_metadata, role },
        });
      }

      profilesSynced += 1;
    }

    const provision = await provisionAllPendingResellers();
    const users = await buildPanelAccounts();

    return NextResponse.json({
      success: true,
      results: {
        authAccounts: authUsers.length,
        profilesSynced,
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

/** Alterar papel e auto-provisionar revendedor no DirectAdmin. */
export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  try {
    const body = await req.json();
    const { userId, role, email, nome } = body as {
      userId?: string;
      role?: UserRole;
      email?: string;
      nome?: string;
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
    const { data: authUser } = await admin.auth.admin.getUserById(userId);
    const resolvedEmail = (email || authUser.user?.email || '').toLowerCase();

    if (!resolvedEmail) {
      return NextResponse.json({ success: false, error: 'Email não encontrado.' }, { status: 400 });
    }

    await admin.from('profiles').upsert(
      {
        id: userId,
        email: resolvedEmail,
        role,
        nome: nome || authUser.user?.user_metadata?.nome || resolvedEmail.split('@')[0],
      },
      { onConflict: 'id' },
    );

    await admin.auth.admin.updateUserById(userId, {
      user_metadata: {
        ...authUser.user?.user_metadata,
        role,
      },
    });

    let provisionResult = null;
    if (role === 'reseller') {
      provisionResult = await ensureResellerProvisioned({
        userId,
        email: resolvedEmail,
        nome: nome || (authUser.user?.user_metadata?.nome as string),
      });
    }

    const users = await buildPanelAccounts();

    return NextResponse.json({
      success: true,
      message:
        role === 'reseller'
          ? `Revendedor activo — DirectAdmin: ${provisionResult?.daUsername}`
          : `Papel actualizado para ${role}`,
      provision: provisionResult,
      users,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao actualizar papel';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
