import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { daPostViaSshAsDaUser } from '@/lib/da-api-ssh';
import { requireAdminOrReseller } from '@/lib/panel-api-auth';
import { resolvePanelDaContext } from '@/lib/panel-api-context';
import { resolveResellerPanelContext } from '@/lib/panel-reseller-context';
import { assertResellerHostingQuota } from '@/lib/panel-reseller-tier';
import { scheduleDaSync } from '@/lib/da-sync-engine';
import { sendEmail } from '@/lib/email-service';
import { pushUserEditToServer } from '@/lib/da-user-push-ssh';
import { getDaSyncAdmin } from '@/lib/da-sync-schema';
import { saveProfileForAuthUser } from '@/lib/profile-db';
import { upsertDownloadableCredentials } from '@/lib/panel-access-credentials';
import { upsertPanelAuthAccount } from '@/lib/panel-auth-accounts';
import { PANEL_SLUG } from '@/lib/panel-tenant';
import { upsertMirrorUser } from '@/lib/panel-mirror-write';
import {
  belongsToResellerAccount,
  enrichPanelAccounts,
  excludeResellerSelfAccount,
  excludeResellerSelfPackages,
  isPanelAdminAccount,
  PRIMARY_RESELLER_DA_USER,
} from '@/lib/panel-contas-enrich';
import {
  deleteMirrorUser,
  mirrorAfterDaMutation,
  mutationSucceeded,
  patchMirrorUser,
} from '@/lib/panel-mirror-write';
import {
  getMirrorLastSyncAt,
  isMirrorStale,
  listMirrorPackages,
  listMirrorUsers,
  listMirrorWebsites,
} from '@/lib/panel-mirror-read';
import type { PanelUser } from '@/lib/directadmin-hosting-api';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function deriveUsername(domain: string, email: string): string {
  const fromDomain = domain.replace(/[^a-z0-9]/gi, '').slice(0, 10).toLowerCase();
  if (fromDomain) return fromDomain;
  const fromEmail = email.split('@')[0]?.replace(/[^a-z0-9]/gi, '').slice(0, 10).toLowerCase();
  return fromEmail || 'cliente';
}

function accountUserCreateFields(input: {
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

async function resolveResellerContext() {
  const auth = await requireAdminOrReseller();
  if ('error' in auth) return { error: auth.error };

  const ctx = await resolveResellerPanelContext(auth);
  if (!ctx) {
    return {
      error: NextResponse.json(
        { success: false, error: 'Contexto de revendedor indisponível' },
        { status: 403 },
      ),
    };
  }

  if (auth.user.role === 'admin' && !ctx.impersonating) {
    return {
      error: NextResponse.json(
        { success: false, error: 'Use o painel de administração para contas globais.' },
        { status: 403 },
      ),
    };
  }

  const { mirrorScope } = await resolvePanelDaContext(auth);
  return { auth, ctx, mirrorScope };
}

function filterResellerUsers(users: PanelUser[], daUsername: string): PanelUser[] {
  const scoped = users.filter((u) => {
    if (isPanelAdminAccount(u)) return false;
    return belongsToResellerAccount(u, daUsername);
  });
  return excludeResellerSelfAccount(scoped, daUsername);
}

function assertManagedUser(user: PanelUser | undefined, daUsername: string): string | null {
  if (!user) return 'Conta não encontrada';
  if (isPanelAdminAccount(user)) return 'Conta reservada ao administrador';
  if (!belongsToResellerAccount(user, daUsername)) return 'Conta fora do seu painel';
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const resolved = await resolveResellerContext();
    if ('error' in resolved && resolved.error) return resolved.error;
    const { ctx, mirrorScope } = resolved as Exclude<typeof resolved, { error: NextResponse }>;

    const { searchParams } = new URL(req.url);
    if (searchParams.get('sync') === '1') {
      scheduleDaSync(0);
    } else {
      const stale = await isMirrorStale(5);
      if (stale) scheduleDaSync(0);
    }

    const daUsername = ctx.daUsername;
    const [rawUsers, sites, packages] = await Promise.all([
      listMirrorUsers(mirrorScope),
      listMirrorWebsites(mirrorScope),
      listMirrorPackages(mirrorScope),
    ]);

    const users = filterResellerUsers(rawUsers, daUsername);
    const visiblePackages = excludeResellerSelfPackages(packages, sites, daUsername);
    const packageMap = new Map(visiblePackages.map((p) => [p.packageName, p]));
    const enriched = enrichPanelAccounts(users, sites, packageMap, {
      resellerOwnerLabel: daUsername,
    });

    const lastSyncedAt = await getMirrorLastSyncAt();
    const stale = await isMirrorStale(5);

    return NextResponse.json({
      success: true,
      users: enriched,
      packages: visiblePackages,
      primaryResellerAccount: daUsername,
      meta: {
        source: 'mirror',
        lastSyncedAt,
        stale,
        scope: 'reseller',
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Erro interno';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const resolved = await resolveResellerContext();
    if ('error' in resolved && resolved.error) return resolved.error;
    const { ctx } = resolved as Exclude<typeof resolved, { error: NextResponse }>;

    const body = await req.json();
    const accountType = String(body.accountType || 'client');
    const existingUserId = String(body.existingUserId || '').trim();
    const isExistingUser = Boolean(existingUserId);
    const email = String(body.email || '').trim();
    const password = String(body.password || '');
    const domain = String(body.domain || '').trim().toLowerCase();
    const packageName = String(body.packageName || '').trim();
    const simpleAccount = body.simpleAccount === true || !packageName || packageName === '—';
    const adminEmail = String(body.adminEmail || email).trim();
    const userName = String(body.userName || '').trim() || deriveUsername(domain, email);
    const panelRole = accountType === 'reseller' ? 'reseller' : accountType === 'professional' ? 'manager' : 'client';

    if (!isExistingUser && (!email.includes('@') || password.length < 8)) {
      return NextResponse.json(
        { success: false, error: 'Email válido e password (mín. 8 caracteres) são obrigatórios.' },
        { status: 400 },
      );
    }

    if (!simpleAccount && !domain.includes('.')) {
      return NextResponse.json(
        { success: false, error: 'Domínio obrigatório (ex.: exemplo.com).' },
        { status: 400 },
      );
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return NextResponse.json(
        { success: false, error: 'Serviço de contas indisponível.' },
        { status: 500 },
      );
    }

    // 1. Provision Supabase Auth User & Profile immediately
    const admin = createAdminClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    let authUserId: string;
    let normalizedEmail = email.toLowerCase();
    const displayName = `${body.firstName || ''} ${body.lastName || ''}`.trim() || email.split('@')[0] || userName;

    if (isExistingUser) {
      const { data: existingAuth, error: loadErr } = await admin.auth.admin.getUserById(existingUserId);
      if (loadErr || !existingAuth?.user) {
        return NextResponse.json(
          { success: false, error: 'Utilizador do painel não encontrado.' },
          { status: 404 },
        );
      }
      authUserId = existingAuth.user.id;
      normalizedEmail = (existingAuth.user.email || normalizedEmail).toLowerCase();

      await saveProfileForAuthUser(admin, authUserId, {
        email: normalizedEmail,
        role: panelRole,
        name: displayName,
      });

      await admin.auth.admin.updateUserById(authUserId, {
        user_metadata: {
          ...(existingAuth.user.user_metadata || {}),
          role: panelRole,
          name: displayName,
          nome: displayName,
          site: PANEL_SLUG,
        },
      });

      if (password.length >= 8) {
        await admin.auth.admin.updateUserById(authUserId, { password });
        await upsertDownloadableCredentials(admin, {
          email: normalizedEmail,
          password,
          userId: authUserId,
          role: panelRole,
        });
      }

      await upsertPanelAuthAccount(admin, {
        userId: authUserId,
        email: normalizedEmail,
        role: panelRole,
        name: displayName,
        serverLinked: !simpleAccount,
        daUsername: simpleAccount ? null : userName,
        resellerTier: null,
      });
    } else {
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
        user_metadata: {
          role: panelRole,
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

      authUserId = created.user.id;

      await saveProfileForAuthUser(admin, authUserId, {
        email: normalizedEmail,
        role: panelRole,
        name: displayName,
      });

      await upsertDownloadableCredentials(admin, {
        email: normalizedEmail,
        password,
        userId: authUserId,
        role: panelRole,
      });

      await upsertPanelAuthAccount(admin, {
        userId: authUserId,
        email: normalizedEmail,
        role: panelRole,
        name: displayName,
        serverLinked: !simpleAccount,
        daUsername: simpleAccount ? null : userName,
        resellerTier: null,
      });
    }

    // 2. Flow for Simple Accounts (Bypasses DirectAdmin)
    if (simpleAccount) {
      await upsertMirrorUser({
        username: userName,
        email: normalizedEmail,
        first_name: body.firstName || '',
        last_name: body.lastName || '',
        acl: 'user',
        parent_username: ctx.daUsername,
        auth_user_id: authUserId,
        status: 'Active',
      });

      return NextResponse.json({
        success: true,
        userName,
        accountType,
        provisionMode: 'simple',
        serverSynced: false,
        user: {
          email: normalizedEmail,
          type: 'user',
          firstName: body.firstName || '',
          lastName: body.lastName || '',
          packageName: '—',
          quotaLabel: '—',
          diskUsedLabel: '—',
          resellerOwner: ctx.daUsername,
          domainCount: 0,
          registeredAt: new Date().toISOString(),
          suspended: false,
          ownedDomains: [],
        },
      });
    }

    // 3. Flow for Hosting Accounts (DirectAdmin sync)
    const resolvedAuth = resolved as Exclude<typeof resolved, { error: NextResponse }>;
    const quota = await assertResellerHostingQuota({
      userId: resolvedAuth.auth.user.id,
      daUsername: ctx.daUsername,
    });
    if (!quota.ok) {
      return NextResponse.json({ success: false, error: quota.error }, { status: 403 });
    }

    const result = await daPostViaSshAsDaUser(
      ctx.daUsername,
      'CMD_API_ACCOUNT_USER',
      accountUserCreateFields({
        userName,
        email: adminEmail,
        password,
        domain,
        packageName,
      }),
    );

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Falha ao criar conta no servidor' },
        { status: 400 },
      );
    }

    // Save server association to Auth Profile
    await saveProfileForAuthUser(admin, authUserId, {
      da_username: userName,
      da_domain: domain,
      da_provisioned_at: new Date().toISOString(),
    });

    // Mirror mutation locally
    await mirrorAfterDaMutation('createUser', {
      userName,
      email: adminEmail,
      acl: 'user',
      domain,
      packageName,
      parent_username: ctx.daUsername,
    });

    // Update mirror auth link
    const sb = getDaSyncAdmin();
    if (sb) {
      await sb
        .from('panel_users')
        .update({ auth_user_id: authUserId })
        .eq('username', userName);
    }

    scheduleDaSync(1500);

    return NextResponse.json({
      success: true,
      userName,
      accountType,
      user: {
        email: normalizedEmail,
        type: 'user',
        firstName: body.firstName || '',
        lastName: body.lastName || '',
        packageName,
        quotaLabel: 'Calculando...',
        diskUsedLabel: '0 MB',
        resellerOwner: ctx.daUsername,
        domainCount: 1,
        registeredAt: new Date().toISOString(),
        suspended: false,
        ownedDomains: [
          { domain, package: packageName, diskUsage: '0', status: 'Active' },
        ],
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Erro interno';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const resolved = await resolveResellerContext();
    if ('error' in resolved && resolved.error) return resolved.error;
    const { ctx, mirrorScope } = resolved as Exclude<typeof resolved, { error: NextResponse }>;

    const body = await req.json();
    const { action, userName, password, subject, message, toEmail } = body;
    if (!userName) {
      return NextResponse.json({ success: false, error: 'userName obrigatório' }, { status: 400 });
    }

    const rawUsers = await listMirrorUsers(mirrorScope);
    const target = rawUsers.find((u) => u.userName === userName);
    const guard = assertManagedUser(target, ctx.daUsername);
    if (guard) {
      return NextResponse.json({ success: false, error: guard }, { status: 403 });
    }

    if (action === 'delete' || action === 'suspend') {
      if (String(userName).toLowerCase() === ctx.daUsername.toLowerCase()) {
        return NextResponse.json(
          { success: false, error: 'Não pode alterar a conta principal do painel.' },
          { status: 403 },
        );
      }
    }

    if (action === 'editAccount') {
      const sb = getDaSyncAdmin();
      if (!sb) {
        return NextResponse.json({ success: false, error: 'Base de dados indisponível' }, { status: 503 });
      }

      const email = body.email !== undefined ? String(body.email).trim() : undefined;
      const packageName =
        body.packageName !== undefined ? String(body.packageName || '').trim() : undefined;
      const primaryDomain =
        body.primaryDomain !== undefined ? String(body.primaryDomain || '').trim().toLowerCase() : undefined;
      const adminEmail =
        body.adminEmail !== undefined ? String(body.adminEmail || '').trim() : undefined;

      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (email !== undefined) updates.email = email;
      if (body.firstName !== undefined) updates.first_name = String(body.firstName).trim();
      if (body.lastName !== undefined) updates.last_name = String(body.lastName).trim();
      if (body.websitesLimit !== undefined) {
        updates.websites_limit = Math.max(0, Number(body.websitesLimit) || 0);
      }
      if (body.emailsLimit !== undefined) {
        updates.emails_limit = Math.max(0, Number(body.emailsLimit) || 0);
      }

      const { data, error } = await sb
        .from('panel_users')
        .update(updates)
        .eq('username', userName)
        .select('username, email, first_name, last_name, websites_limit, emails_limit, acl, status')
        .maybeSingle();

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }
      if (!data) {
        return NextResponse.json({ success: false, error: 'Conta não encontrada' }, { status: 404 });
      }

      const pushed = await pushUserEditToServer({
        userName,
        email: email ?? String(data.email || ''),
        firstName: body.firstName !== undefined ? String(body.firstName).trim() : String(data.first_name || ''),
        lastName: body.lastName !== undefined ? String(body.lastName).trim() : String(data.last_name || ''),
        websitesLimit:
          body.websitesLimit !== undefined
            ? Math.max(0, Number(body.websitesLimit) || 0)
            : Number(data.websites_limit) || 0,
        emailsLimit:
          body.emailsLimit !== undefined
            ? Math.max(0, Number(body.emailsLimit) || 0)
            : Number(data.emails_limit) || 0,
        packageName,
      });

      if (!pushed.ok) {
        return NextResponse.json(
          { success: false, error: pushed.error || 'Não foi possível aplicar no servidor' },
          { status: 502 },
        );
      }

      if (primaryDomain && (packageName !== undefined || adminEmail !== undefined)) {
        await mirrorAfterDaMutation('modifyWebsite', {
          domain: primaryDomain,
          packageName,
          adminEmail,
        });
      }

      scheduleDaSync(1500);
      return NextResponse.json({ success: true, data });
    }

    let data: unknown;
    const daUser = ctx.daUsername;

    switch (action) {
      case 'suspend': {
        const r = await daPostViaSshAsDaUser(daUser, 'CMD_API_SELECT_USERS', {
          suspend: 'yes',
          select0: userName,
        });
        data = { success: r.ok, error: r.error };
        break;
      }
      case 'unsuspend': {
        const r = await daPostViaSshAsDaUser(daUser, 'CMD_API_SELECT_USERS', {
          suspend: 'no',
          select0: userName,
        });
        data = { success: r.ok, error: r.error };
        break;
      }
      case 'changePassword':
        if (!password || String(password).length < 8) {
          return NextResponse.json({ success: false, error: 'Password inválida' }, { status: 400 });
        }
        {
          const r = await daPostViaSshAsDaUser(daUser, 'CMD_API_MODIFY_USER', {
            action: 'single',
            user: userName,
            passwd: String(password),
            passwd2: String(password),
          });
          data = { success: r.ok, error: r.error };
        }
        break;
      case 'delete': {
        const r = await daPostViaSshAsDaUser(daUser, 'CMD_API_SELECT_USERS', {
          delete: 'yes',
          select0: userName,
        });
        data = { success: r.ok, error: r.error };
        break;
      }
      case 'sendMessage': {
        const email = String(toEmail || target?.email || '').trim();
        if (!email.includes('@')) {
          return NextResponse.json({ success: false, error: 'Email do destinatário não encontrado.' }, { status: 400 });
        }
        if (!subject || !message) {
          return NextResponse.json({ success: false, error: 'Assunto e mensagem são obrigatórios.' }, { status: 400 });
        }
        await sendEmail({
          to: email,
          subject: String(subject),
          html: `<p>${String(message).replace(/\n/g, '<br>')}</p>`,
          text: String(message),
          category: 'transactional',
        });
        return NextResponse.json({ success: true, data: { sentTo: email } });
      }
      default:
        return NextResponse.json({ success: false, error: 'Ação inválida' }, { status: 400 });
    }

    const ok = mutationSucceeded(data);
    if (ok) {
      if (action === 'suspend') await patchMirrorUser(userName, { status: 'Suspended' });
      else if (action === 'unsuspend') await patchMirrorUser(userName, { status: 'Active' });
      else if (action === 'delete') await deleteMirrorUser(userName);
    }

    if (action !== 'sendMessage' && ok) scheduleDaSync(1500);
    return NextResponse.json({ success: ok, data });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Erro interno';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export { PRIMARY_RESELLER_DA_USER };
