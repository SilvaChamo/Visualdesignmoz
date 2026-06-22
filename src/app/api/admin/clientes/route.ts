import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import {
  getAdminDirectAdminAPI,
  getDirectAdminAPIForDaUsername,
  listAllHostingUsersFromDa,
} from '@/lib/directadmin-adapter';
import { daPostViaSsh } from '@/lib/da-api-ssh';
import { requireAdminOrReseller } from '@/lib/panel-api-auth';
import { runDaFullSyncDeduped, scheduleDaSync } from '@/lib/da-sync-engine';
import { loadResellerCredentialsByDaUsername } from '@/lib/da-credential-store';
import { sendEmail } from '@/lib/email-service';
import { pushUserEditToServer } from '@/lib/da-user-push-ssh';
import { getDaSyncAdmin } from '@/lib/da-sync-schema';
import { saveProfileForAuthUser } from '@/lib/profile-db';
import { upsertDownloadableCredentials } from '@/lib/panel-access-credentials';
import { upsertPanelAuthAccount } from '@/lib/panel-auth-accounts';
import { PANEL_SLUG } from '@/lib/panel-tenant';
import type { UserRole } from '@/lib/user-roles';
import {
  deleteMirrorUser,
  mirrorAfterDaMutation,
  patchMirrorUser,
  mutationSucceeded,
  upsertMirrorSite,
  upsertMirrorUser,
} from '@/lib/panel-mirror-write';
import {
  getMirrorLastSyncAt,
  isMirrorStale,
  listMirrorPackages,
  listMirrorUsers,
  listMirrorWebsites,
} from '@/lib/panel-mirror-read';

import { enrichPanelAccounts } from '@/lib/panel-contas-enrich';
import {
  schedulePanelServerProvision,
} from '@/lib/panel-server-provision';

const OSHER_RESELLER = 'oshercollective';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function deriveUsername(domain: string, email: string): string {
  const fromDomain = domain.replace(/[^a-z0-9]/gi, '').slice(0, 10).toLowerCase();
  if (fromDomain) return fromDomain;
  const fromEmail = email.split('@')[0]?.replace(/[^a-z0-9]/gi, '').slice(0, 10).toLowerCase();
  return fromEmail || 'cliente';
}

function panelRoleForAccountType(accountType: 'client' | 'reseller' | 'professional'): UserRole {
  if (accountType === 'reseller') return 'reseller';
  if (accountType === 'professional') return 'manager';
  return 'client';
}

function panelAclForAccountType(accountType: 'client' | 'reseller' | 'professional'): string {
  if (accountType === 'reseller') return 'reseller';
  if (accountType === 'professional') return 'manager';
  return 'user';
}

function formatPackageSize(value: unknown): string {
  if (value === null) return 'Ilimitado';
  const raw = String(value ?? '').trim();
  if (!raw || raw === '—') return '—';
  if (raw === '-' || raw.toLowerCase() === 'unlimited' || raw === '-1') return 'Ilimitado';
  if (/[a-z]/i.test(raw)) return raw.toUpperCase();
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return '—';
  if (n >= 1024 && n % 1024 === 0) return `${n / 1024}G`;
  return `${n} MB`;
}

function resolvePackageMeta(
  packageMap: Map<string, import('@/lib/directadmin-hosting-api').PanelPackage>,
  name: string,
) {
  if (!name) return undefined;
  const direct = packageMap.get(name);
  if (direct) return direct;
  const lower = name.toLowerCase();
  for (const [key, pkg] of packageMap) {
    if (key.toLowerCase() === lower) return pkg;
  }
  return undefined;
}

async function lookupPackageLimits(packageName: string): Promise<{
  diskMb: number | null | undefined;
  bandwidthMb: number | null | undefined;
  quotaLabel: string;
}> {
  const parseLimit = (v: unknown): number | null | undefined => {
    if (v === null || v === undefined) return undefined;
    const raw = String(v).trim();
    if (!raw || raw === '-' || raw.toLowerCase() === 'unlimited' || raw === '-1') return null;
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return undefined;
    return n;
  };

  let diskMb: number | null | undefined;
  let bandwidthMb: number | null | undefined;

  try {
    const adminApi = await getAdminDirectAdminAPI();
    const pkgs = await adminApi.listPackages();
    const pkg = pkgs.find((p) => p.packageName.toLowerCase() === packageName.toLowerCase());
    if (pkg) {
      diskMb = parseLimit(pkg.diskSpace);
      bandwidthMb = parseLimit(pkg.bandwidth);
    }
  } catch {
    /* espelho abaixo */
  }

  if (diskMb === undefined) {
    const sb = getDaSyncAdmin();
    if (sb) {
      const { data } = await sb
        .from('panel_packages')
        .select('disk_space, bandwidth')
        .ilike('package_name', packageName)
        .maybeSingle();
      if (data) {
        diskMb = data.disk_space === -1 ? null : Number(data.disk_space) || undefined;
        bandwidthMb = data.bandwidth === -1 ? null : Number(data.bandwidth) || undefined;
      }
    }
  }

  const quotaLabel =
    diskMb === null ? 'Ilimitado' : diskMb !== undefined ? formatPackageSize(diskMb) : '—';

  return { diskMb, bandwidthMb, quotaLabel };
}

async function isPanelManagedWithoutServer(userName: string): Promise<boolean> {
  const sb = getDaSyncAdmin();
  if (!sb) return false;
  const { data: user } = await sb
    .from('panel_users')
    .select('auth_user_id')
    .eq('username', userName)
    .maybeSingle();
  if (!user?.auth_user_id) return false;
  const { data: auth } = await sb
    .from('panel_auth_accounts')
    .select('server_linked')
    .eq('user_id', user.auth_user_id)
    .maybeSingle();
  return auth?.server_linked !== true;
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdminOrReseller();
    if ('error' in auth) return auth.error;
    if (auth.user.role !== 'admin') {
      return NextResponse.json({ error: 'Apenas administradores' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const syncNow = searchParams.get('sync') === '1';

    const mirrorScope = { role: 'admin' as const, userId: auth.user.id };
    let [users, sites, packages] = await Promise.all([
      listMirrorUsers(mirrorScope),
      listMirrorWebsites(mirrorScope),
      listMirrorPackages(mirrorScope),
    ]);

    if (syncNow) {
      await runDaFullSyncDeduped();
      [users, sites, packages] = await Promise.all([
        listMirrorUsers(mirrorScope),
        listMirrorWebsites(mirrorScope),
        listMirrorPackages(mirrorScope),
      ]);
    } else {
      const stale = await isMirrorStale(5);
      if (stale) scheduleDaSync(0);
    }

    let source: 'mirror' | 'live' = 'mirror';

    // Espelho vazio — leitura live do DA (admin + sub-contas revenda) e sync em background
    if (users.length === 0 && !syncNow) {
      scheduleDaSync(0);
      try {
        const adminApi = await getAdminDirectAdminAPI();
        const [liveUsers, liveSites, livePackages] = await Promise.all([
          listAllHostingUsersFromDa(),
          adminApi.listWebsites(),
          adminApi.listPackages(),
        ]);
        if (liveUsers.length > 0) {
          users = liveUsers;
          sites = liveSites;
          packages = livePackages;
          source = 'live';
        }
      } catch {
        /* espelho apenas */
      }
    }

    const osherCreds = await loadResellerCredentialsByDaUsername(OSHER_RESELLER);

    // Pacotes admin — leitura live evita «Default» obsoleto no espelho
    try {
      const adminApi = await getAdminDirectAdminAPI();
      const liveAdminPkgs = await adminApi.listPackages();
      if (liveAdminPkgs.length) packages = liveAdminPkgs;
    } catch {
      packages = packages.filter((p) => p.packageName !== 'Default');
    }

    // Pacotes do servidor: admin live + revendas (ex. Osher) para o wizard
    const packageMap = new Map(packages.map((p) => [p.packageName, p]));
    if (osherCreds) {
      try {
        const osherApi = await getDirectAdminAPIForDaUsername(OSHER_RESELLER);
        const resellerPkgs = await osherApi.listPackages();
        for (const p of resellerPkgs) {
          if (p.packageName) packageMap.set(p.packageName, p);
        }
      } catch {
        /* espelho apenas */
      }
    }
    const allPackages = Array.from(packageMap.values()).sort((a, b) =>
      a.packageName.localeCompare(b.packageName),
    );

    const enriched = enrichPanelAccounts(users, sites, packageMap).map((row) => ({
      ...row,
      packageName: row.packageName || '—',
      quotaLabel:
        row.quotaLabel ||
        (row.packageName && row.packageName !== '—'
          ? formatPackageSize(resolvePackageMeta(packageMap, row.packageName)?.diskSpace)
          : '—'),
    }));

    const lastSyncedAt = await getMirrorLastSyncAt();
    const stale = await isMirrorStale(5);

    return NextResponse.json({
      success: true,
      users: enriched,
      packages: allPackages,
      resellerPackages: allPackages.map((p) => p.packageName).filter(Boolean),
      osherReseller: OSHER_RESELLER,
      osherCredsOk: Boolean(osherCreds),
      meta: {
        source,
        lastSyncedAt,
        stale,
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Erro interno';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdminOrReseller();
    if ('error' in auth) return auth.error;
    if (auth.user.role !== 'admin') {
      return NextResponse.json({ error: 'Apenas administradores' }, { status: 403 });
    }

    const body = await req.json();
    const accountType = String(body.accountType || 'client') as 'client' | 'reseller' | 'professional';
    const email = String(body.email || '').trim();
    const password = String(body.password || '');
    const domain = String(body.domain || '').trim().toLowerCase();
    const packageName = String(body.packageName || 'Default');
    const adminEmail = String(body.adminEmail || email).trim();
    const userName = String(body.userName || '').trim() || deriveUsername(domain, email);

    if (!email.includes('@') || password.length < 8) {
      return NextResponse.json(
        { success: false, error: 'Email válido e password (mín. 8 caracteres) são obrigatórios.' },
        { status: 400 },
      );
    }

    const firstName = String(body.firstName || '').trim();
    const lastName = String(body.lastName || '').trim();
    const effectivePackageName = String(packageName || '').trim();
    const createdDomain =
      accountType === 'client' ? domain : domain || `${userName}.com`;
    const panelRole = panelRoleForAccountType(accountType);
    const panelAcl = panelAclForAccountType(accountType);
    const displayName = `${firstName} ${lastName}`.trim() || email.split('@')[0] || userName;

    if (!effectivePackageName) {
      return NextResponse.json(
        { success: false, error: 'Seleccione um pacote.' },
        { status: 400 },
      );
    }

    if (accountType === 'client' && !domain.includes('.')) {
      return NextResponse.json(
        { success: false, error: 'Domínio obrigatório para cliente (ex.: exemplo.com).' },
        { status: 400 },
      );
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return NextResponse.json(
        { success: false, error: 'Serviço de contas indisponível.' },
        { status: 500 },
      );
    }

    const admin = createAdminClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const normalizedEmail = email.toLowerCase();

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

    await saveProfileForAuthUser(admin, created.user.id, {
      email: normalizedEmail,
      role: panelRole,
      name: displayName,
    });

    await upsertDownloadableCredentials(admin, {
      email: normalizedEmail,
      password,
      userId: created.user.id,
      role: panelRole,
    });

    await upsertPanelAuthAccount(admin, {
      userId: created.user.id,
      email: normalizedEmail,
      role: panelRole,
      name: displayName,
      serverLinked: false,
      daUsername: null,
    });

    const pkgLimits = await lookupPackageLimits(effectivePackageName);

    const mirrorUser = await upsertMirrorUser({
      username: userName,
      email: normalizedEmail,
      first_name: firstName,
      last_name: lastName,
      acl: panelAcl,
      status: 'Active',
      auth_user_id: created.user.id,
      package_name: effectivePackageName,
      quota_limit_mb: pkgLimits.diskMb === null ? null : pkgLimits.diskMb,
      bandwidth_limit_mb: pkgLimits.bandwidthMb === null ? null : pkgLimits.bandwidthMb,
    });
    if (!mirrorUser.ok) {
      return NextResponse.json(
        { success: false, error: mirrorUser.error || 'Falha ao registar conta no painel.' },
        { status: 500 },
      );
    }

    if (createdDomain.includes('.')) {
      const mirrorSite = await upsertMirrorSite({
        domain: createdDomain,
        owner: userName,
        admin_email: adminEmail,
        package: effectivePackageName,
      });
      if (!mirrorSite.ok) {
        return NextResponse.json(
          { success: false, error: mirrorSite.error || 'Falha ao registar domínio no painel.' },
          { status: 500 },
        );
      }
    }

    const primaryDomain = createdDomain.includes('.') ? createdDomain : `${userName}.com`;

    schedulePanelServerProvision(userName, 800);

    return NextResponse.json({
      success: true,
      userName,
      domain: createdDomain,
      accountType,
      provisionMode: 'panel',
      serverSynced: false,
      user: {
        userName,
        email: normalizedEmail,
        type: panelAcl,
        firstName,
        lastName,
        primaryDomain,
        packageName: effectivePackageName,
        quotaLabel: pkgLimits.quotaLabel,
        diskUsedLabel: '0 MB',
        resellerOwner: '—',
        domainCount: createdDomain.includes('.') ? 1 : 0,
        registeredAt: new Date().toISOString(),
        suspended: false,
        ownedDomains: createdDomain.includes('.')
          ? [{
              domain: createdDomain,
              package: effectivePackageName,
              diskUsage: '0',
              status: 'Active',
            }]
          : [],
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Erro interno';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAdminOrReseller();
    if ('error' in auth) return auth.error;
    if (auth.user.role !== 'admin') {
      return NextResponse.json({ error: 'Apenas administradores' }, { status: 403 });
    }

    const body = await req.json();
    const { action, userName, password, subject, message, toEmail } = body;
    if (!userName) {
      return NextResponse.json({ success: false, error: 'userName obrigatório' }, { status: 400 });
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
      if (email !== undefined && !email.includes('@')) {
        return NextResponse.json({ success: false, error: 'Email inválido' }, { status: 400 });
      }
      if (adminEmail !== undefined && adminEmail && !adminEmail.includes('@')) {
        return NextResponse.json({ success: false, error: 'Email admin inválido' }, { status: 400 });
      }

      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
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

      if (primaryDomain && (packageName !== undefined || adminEmail !== undefined)) {
        await mirrorAfterDaMutation('modifyWebsite', {
          domain: primaryDomain,
          packageName,
          adminEmail,
        });
      }

      if (!pushed.ok) {
        schedulePanelServerProvision(userName, 1500);
        scheduleDaSync(1500);
        return NextResponse.json({
          success: true,
          data,
          serverSynced: false,
          warning: 'Conta actualizada no painel. O servidor sincroniza quando estiver disponível.',
        });
      }

      scheduleDaSync(1500);
      return NextResponse.json({ success: true, data, serverSynced: true });
    }

    let data: unknown;

    switch (action) {
      case 'suspend': {
        const r = await daPostViaSsh('CMD_API_SELECT_USERS', { suspend: 'yes', select0: userName });
        data = { success: r.ok, error: r.error };
        break;
      }
      case 'unsuspend': {
        const r = await daPostViaSsh('CMD_API_SELECT_USERS', { suspend: 'no', select0: userName });
        data = { success: r.ok, error: r.error };
        break;
      }
      case 'changePassword':
        if (!password || String(password).length < 8) {
          return NextResponse.json({ success: false, error: 'Password inválida' }, { status: 400 });
        }
        {
          const r = await daPostViaSsh('CMD_API_MODIFY_USER', {
            action: 'single',
            user: userName,
            passwd: String(password),
            passwd2: String(password),
          });
          data = { success: r.ok, error: r.error };
        }
        break;
      case 'delete': {
        const r = await daPostViaSsh('CMD_API_SELECT_USERS', { delete: 'yes', select0: userName });
        data = { success: r.ok, error: r.error };
        break;
      }
      case 'sendMessage': {
        const users = await listMirrorUsers({ role: 'admin', userId: auth.user.id });
        const target = users.find((u) => u.userName === userName);
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
    } else if (action === 'suspend' || action === 'unsuspend' || action === 'delete') {
      const panelOnly = await isPanelManagedWithoutServer(userName);
      if (panelOnly) {
        if (action === 'suspend') await patchMirrorUser(userName, { status: 'Suspended' });
        else if (action === 'unsuspend') await patchMirrorUser(userName, { status: 'Active' });
        else if (action === 'delete') await deleteMirrorUser(userName);
        return NextResponse.json({
          success: true,
          data,
          serverSynced: false,
          warning: 'Alteração aplicada no painel. O servidor sincroniza quando estiver disponível.',
        });
      }
    }

    if (action !== 'sendMessage' && ok) scheduleDaSync(1500);
    return NextResponse.json({ success: ok, data });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Erro interno';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
