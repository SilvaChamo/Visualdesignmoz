import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import {
  getAdminDirectAdminAPI,
  getDirectAdminAPIForDaUsername,
  listAllHostingUsersFromDa,
} from '@/lib/directadmin-adapter';
import { daPostViaSsh } from '@/lib/da-api-ssh';
import {
  getProviderByUsername,
  suspendHostingAccount,
  unsuspendHostingAccount,
  deleteHostingAccount,
  changeHostingAccountPassword,
} from '@/lib/hosting-provider';
import * as hestiaAdapter from '@/lib/hestia-adapter';
import { requireAdminOrReseller } from '@/lib/panel-api-auth';
import { runDaFullSyncDeduped, scheduleDaSync } from '@/lib/da-sync-engine';
import { loadResellerCredentialsByDaUsername, encryptDaSecret } from '@/lib/da-credential-store';
import { sendEmail } from '@/lib/email-service';
import { pushUserEditToServer } from '@/lib/da-user-push-ssh';
import { getDaSyncAdmin } from '@/lib/da-sync-schema';
import { saveProfileForAuthUser, getProfileForAuthUser } from '@/lib/profile-db';
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

import { enrichPanelAccounts, belongsToResellerAccount } from '@/lib/panel-contas-enrich';
import {
  schedulePanelServerProvision,
} from '@/lib/panel-server-provision';
import { normalizeResellerTier } from '@/lib/panel-role-capabilities';

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

    const hestiaOnly = (process.env.DEFAULT_HOSTING_PROVIDER || '').trim().toLowerCase() === 'hestia';
    if (hestiaOnly) {
      const { listHostingDomains, listHostingUsers, listHostingPackages } = await import('@/lib/hosting-resolver');
      const [sites, users, packages] = await Promise.all([
        listHostingDomains(),
        listHostingUsers(),
        listHostingPackages(),
      ]);
      const packageMap = new Map(packages.map((p) => [p.packageName, p]));
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
      return NextResponse.json({
        success: true,
        users: enriched,
        packages: allPackages,
        resellerPackages: allPackages.map((p) => p.packageName).filter(Boolean),
        osherReseller: OSHER_RESELLER,
        osherCredsOk: false,
        meta: { source: 'hestia-direct', lastSyncedAt: new Date().toISOString(), stale: false },
      });
    }

    const mirrorScope = { role: 'admin' as const, userId: auth.user.id };
    let [users, sites, packages] = await Promise.all([
      listMirrorUsers(mirrorScope),
      listMirrorWebsites(mirrorScope),
      listMirrorPackages(mirrorScope),
    ]);

    let stale = false;
    if (syncNow) {
      await runDaFullSyncDeduped();
      [users, sites, packages] = await Promise.all([
        listMirrorUsers(mirrorScope),
        listMirrorWebsites(mirrorScope),
        listMirrorPackages(mirrorScope),
      ]);
    } else {
      stale = await isMirrorStale(120);
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

    // A senha DA guardada só serve para chamadas ao vivo ao DirectAdmin — uma
    // conta já migrada para o Hestia não tem essa senha actualizada (foi
    // encriptada com a chave antiga do Hetzner) nem precisa dela. Confirmar
    // o fornecedor real primeiro evita tentar desencriptar algo que já não é
    // suposto usar-se, e que faz esta página inteira falhar com "Unsupported
    // state or unable to authenticate data" (erro de decifragem do Node) —
    // aconteceu na oshercollective a seguir a passar para Hestia (30 ago).
    const osherProvider = await getProviderByUsername(OSHER_RESELLER);
    const osherCreds =
      osherProvider === 'directadmin' ? await loadResellerCredentialsByDaUsername(OSHER_RESELLER) : null;

    // Pacotes admin — leitura live síncrona só quando o espelho está mesmo vazio.
    // Antes também disparava quando "stale" (>120min), o que travava toda a
    // resposta à espera de chamadas SSH ao DirectAdmin (admin + revenda) em
    // qualquer visita a esta página com o espelho só ligeiramente desactualizado
    // — exactamente quando `scheduleDaSync(0)`, já chamado acima, está a
    // refrescar tudo (incluindo pacotes) em background. Deixar o refresco
    // ficar só a cargo do sync assíncrono elimina essa espera duplicada.
    if (packages.length === 0) {
      try {
        const adminApi = await getAdminDirectAdminAPI();
        const liveAdminPkgs = await adminApi.listPackages();
        if (liveAdminPkgs.length) {
          const { mergePackageListByName } = await import('@/lib/panel-list-resolve');
          packages = mergePackageListByName(packages, liveAdminPkgs);
        }
      } catch {
        packages = packages.filter((p) => p.packageName !== 'Default');
      }

      if (osherCreds) {
        try {
          const osherApi = await getDirectAdminAPIForDaUsername(OSHER_RESELLER);
          const resellerPkgs = await osherApi.listPackages();
          for (const p of resellerPkgs) {
            if (p.packageName) packages.push(p);
          }
        } catch {
          /* espelho apenas */
        }
      }
    }

    // Pacotes do servidor: admin live + revendas (ex. Osher) para o wizard
    const packageMap = new Map(packages.map((p) => [p.packageName, p]));
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
    const existingUserId = String(body.existingUserId || '').trim();
    const isExistingUser = Boolean(existingUserId);
    const email = String(body.email || '').trim();
    const password = String(body.password || '');
    const domain = String(body.domain || '').trim().toLowerCase();
    const packageName = String(body.packageName || '').trim();
    // Ligar a uma conta de hospedagem já real no servidor (ver
    // /api/admin/unlinked-hosting-accounts) em vez de criar hospedagem nova a
    // partir de um pacote — é o caminho normal aqui: contas reais nascem no
    // checkout público, este formulário só dá login do painel a quem já as tem.
    const linkExistingHostingUsername = String(body.linkExistingHostingUsername || '').trim();
    const simpleAccount = !linkExistingHostingUsername && (body.simpleAccount === true || !packageName);
    const adminEmail = String(body.adminEmail || email).trim();
    let userName = String(body.userName || '').trim() || deriveUsername(domain, email);
    const resellerTier =
      accountType === 'reseller' ? normalizeResellerTier(body.resellerTier) : null;

    if (!isExistingUser && (!email.includes('@') || password.length < 8)) {
      return NextResponse.json(
        { success: false, error: 'Email válido e password (mín. 8 caracteres) são obrigatórios.' },
        { status: 400 },
      );
    }

    if (isExistingUser && !existingUserId) {
      return NextResponse.json(
        { success: false, error: 'Utilizador existente inválido.' },
        { status: 400 },
      );
    }

    const firstName = String(body.firstName || '').trim();
    const lastName = String(body.lastName || '').trim();
    const effectivePackageName = packageName;
    const createdDomain =
      accountType === 'client' ? domain : domain || `${userName}.com`;
    const panelRole = panelRoleForAccountType(accountType);
    const panelAcl = panelAclForAccountType(accountType);
    const displayName = `${firstName} ${lastName}`.trim() || email.split('@')[0] || userName;

    if (!simpleAccount && !linkExistingHostingUsername && !effectivePackageName) {
      return NextResponse.json(
        { success: false, error: 'Seleccione uma conta de hospedagem ou crie conta simples.' },
        { status: 400 },
      );
    }

    if (!simpleAccount && !linkExistingHostingUsername && accountType === 'client' && !domain.includes('.')) {
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
    let authUserId: string;
    let normalizedEmail = email.toLowerCase();

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

      const profile = await getProfileForAuthUser(admin, authUserId);
      const sb = getDaSyncAdmin();
      if (sb) {
        const { data: linked } = await sb
          .from('panel_users')
          .select('username')
          .eq('auth_user_id', authUserId)
          .maybeSingle();
        if (linked?.username) userName = String(linked.username);
      }

      if (firstName || lastName || resellerTier) {
        await saveProfileForAuthUser(admin, authUserId, {
          email: normalizedEmail,
          role: panelRole,
          name: displayName || profile?.name,
          ...(resellerTier ? { reseller_tier: resellerTier } : {}),
        });
      } else {
        await saveProfileForAuthUser(admin, authUserId, {
          email: normalizedEmail,
          role: panelRole,
          ...(resellerTier ? { reseller_tier: resellerTier } : {}),
        });
      }

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
        await saveProfileForAuthUser(admin, authUserId, {
          da_password_encrypted: encryptDaSecret(password),
        });
      }

      await upsertPanelAuthAccount(admin, {
        userId: authUserId,
        email: normalizedEmail,
        role: panelRole,
        name: displayName || profile?.name,
        serverLinked: false,
        daUsername: profile?.da_username ?? userName,
        resellerTier: resellerTier || profile?.reseller_tier || null,
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
        ...(resellerTier ? { reseller_tier: resellerTier } : {}),
      });

      await saveProfileForAuthUser(admin, authUserId, {
        da_password_encrypted: encryptDaSecret(password),
      });

      await upsertPanelAuthAccount(admin, {
        userId: authUserId,
        email: normalizedEmail,
        role: panelRole,
        name: displayName,
        serverLinked: false,
        daUsername: null,
        resellerTier,
      });
    }

    if (simpleAccount) {
      // Conta simples (sem hospedagem) só ficava em profiles/panel_auth_accounts
      // -- nunca aparecia em Hospedagem > Contas, que lê só panel_users. Cria-se
      // aqui também uma linha "conta simples" (sem da_username/pacote real) para
      // ela aparecer na mesma listagem, editável/removível como qualquer outra.
      const simpleUserName = userName || deriveUsername('', normalizedEmail);
      const sbSimple = getDaSyncAdmin();
      if (sbSimple) {
        await sbSimple.from('panel_users').upsert(
          {
            username: simpleUserName,
            email: normalizedEmail,
            first_name: firstName,
            last_name: lastName,
            acl: panelAcl,
            status: 'Active',
            auth_user_id: authUserId,
            websites_limit: 0,
            emails_limit: 0,
          },
          { onConflict: 'username' },
        );
      }

      return NextResponse.json({
        success: true,
        userName: simpleUserName,
        domain: '',
        accountType,
        provisionMode: 'simple',
        serverSynced: false,
        user: {
          email: normalizedEmail,
          type: panelAcl,
          firstName,
          lastName,
          packageName: '—',
          quotaLabel: '—',
          diskUsedLabel: '—',
          resellerOwner: '—',
          domainCount: 0,
          registeredAt: new Date().toISOString(),
          suspended: false,
          ownedDomains: [],
        },
      });
    }

    if (linkExistingHostingUsername) {
      const sb = getDaSyncAdmin();
      if (!sb) {
        return NextResponse.json({ success: false, error: 'Base de dados indisponível.' }, { status: 503 });
      }
      const { data: hostingRow, error: hostingLookupError } = await sb
        .from('panel_users')
        .select('username, email, package_name, auth_user_id')
        .eq('username', linkExistingHostingUsername)
        .maybeSingle();
      if (hostingLookupError || !hostingRow) {
        return NextResponse.json(
          { success: false, error: 'Conta de hospedagem não encontrada.' },
          { status: 404 },
        );
      }
      if (hostingRow.auth_user_id) {
        return NextResponse.json(
          { success: false, error: 'Essa conta de hospedagem já tem um login associado.' },
          { status: 409 },
        );
      }

      // Só liga o login (auth_user_id) — não mexe em email/pacote/quota já
      // reais dessa conta, ao contrário de um upsert completo.
      const { error: linkError } = await sb
        .from('panel_users')
        .update({ auth_user_id: authUserId, updated_at: new Date().toISOString() })
        .eq('username', linkExistingHostingUsername);
      if (linkError) {
        return NextResponse.json({ success: false, error: linkError.message }, { status: 500 });
      }

      const hostingProvider = await getProviderByUsername(linkExistingHostingUsername);
      await upsertPanelAuthAccount(admin, {
        userId: authUserId,
        email: normalizedEmail,
        role: panelRole,
        name: displayName,
        serverLinked: true,
        daUsername: linkExistingHostingUsername,
        resellerTier,
        provider: hostingProvider,
      });

      return NextResponse.json({
        success: true,
        userName: linkExistingHostingUsername,
        domain: '',
        accountType,
        provisionMode: 'linked',
        serverSynced: true,
        user: {
          userName: linkExistingHostingUsername,
          email: normalizedEmail,
          type: panelAcl,
          firstName,
          lastName,
          packageName: hostingRow.package_name || '—',
          quotaLabel: '—',
          diskUsedLabel: '—',
          resellerOwner: '—',
          domainCount: 0,
          registeredAt: new Date().toISOString(),
          suspended: false,
          ownedDomains: [],
        },
      });
    }

    const pkgLimits = await lookupPackageLimits(effectivePackageName);

    const mirrorUser = await upsertMirrorUser({
      username: userName,
      email: normalizedEmail,
      first_name: firstName,
      last_name: lastName,
      acl: panelAcl,
      status: 'Active',
      auth_user_id: authUserId,
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
      const accountType = body.accountType as 'client' | 'reseller' | 'professional' | undefined;
      const packageName =
        body.packageName !== undefined ? String(body.packageName || '').trim() : undefined;
      const primaryDomain =
        body.primaryDomain !== undefined ? String(body.primaryDomain || '').trim().toLowerCase() : undefined;
      const adminEmail =
        body.adminEmail !== undefined ? String(body.adminEmail || '').trim() : undefined;
      const resellerTier =
        accountType === 'reseller' && body.resellerTier !== undefined
          ? normalizeResellerTier(body.resellerTier)
          : undefined;
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
      if (accountType) updates.acl = panelAclForAccountType(accountType);

      const { data: beforeRow } = await sb
        .from('panel_users')
        .select('username, email, first_name, last_name, websites_limit, emails_limit, acl, status, auth_user_id')
        .eq('username', userName)
        .maybeSingle();

      if (!beforeRow) {
        return NextResponse.json({ success: false, error: 'Conta não encontrada' }, { status: 404 });
      }

      // O formulário "Editar conta" só actualizava o espelho (panel_users/
      // profiles) quando o e-mail mudava — o login real (auth.users) nunca
      // era tocado, por isso o painel mostrava "guardado" mas entrar com o
      // e-mail novo continuava a ser rejeitado. Corrige-se AQUI, antes de
      // tocar no espelho, para nunca ficar um "guardado" parcial/enganador
      // se o e-mail novo já estiver noutra conta.
      const emailChanged =
        email !== undefined && email.toLowerCase() !== String(beforeRow.email || '').toLowerCase();
      if (emailChanged && beforeRow.auth_user_id && SUPABASE_URL && SUPABASE_SERVICE_KEY) {
        const authAdmin = createAdminClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
        const { error: authEmailError } = await authAdmin.auth.admin.updateUserById(
          String(beforeRow.auth_user_id),
          { email: email!.toLowerCase(), email_confirm: true },
        );
        if (authEmailError) {
          return NextResponse.json(
            { success: false, error: `Não foi possível mudar o e-mail de login: ${authEmailError.message}` },
            { status: 409 },
          );
        }
      }

      const { data, error } = await sb
        .from('panel_users')
        .update(updates)
        .eq('username', userName)
        .select('username, email, first_name, last_name, websites_limit, emails_limit, acl, status, auth_user_id')
        .maybeSingle();

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }
      if (!data) {
        return NextResponse.json({ success: false, error: 'Conta não encontrada' }, { status: 404 });
      }

      if (accountType && data.auth_user_id && SUPABASE_URL && SUPABASE_SERVICE_KEY) {
        const admin = createAdminClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
        const panelRole = panelRoleForAccountType(accountType);
        const displayName =
          `${String(body.firstName ?? data.first_name ?? '').trim()} ${String(body.lastName ?? data.last_name ?? '').trim()}`.trim() ||
          String(data.email || '').split('@')[0];
        await saveProfileForAuthUser(admin, String(data.auth_user_id), {
          email: (email ?? String(data.email || '')).toLowerCase(),
          role: panelRole,
          name: displayName,
          ...(resellerTier ? { reseller_tier: resellerTier } : {}),
        });
        // upsertPanelAuthAccount trata serverLinked ausente como `false` —
        // sem isto, editar o tipo de conta (Cliente/Profissional/Revendedor)
        // desligava silenciosamente uma conta já provisionada no servidor real.
        const { data: currentAuthAccount } = await admin
          .from('panel_auth_accounts')
          .select('server_linked')
          .eq('user_id', String(data.auth_user_id))
          .maybeSingle();
        await upsertPanelAuthAccount(admin, {
          userId: String(data.auth_user_id),
          email: (email ?? String(data.email || '')).toLowerCase(),
          role: panelRole,
          name: displayName,
          daUsername: userName,
          resellerTier: resellerTier ?? null,
          serverLinked: currentAuthAccount?.server_linked === true,
        });
        const { data: authUser } = await admin.auth.admin.getUserById(String(data.auth_user_id));
        if (authUser?.user) {
          await admin.auth.admin.updateUserById(String(data.auth_user_id), {
            user_metadata: {
              ...(authUser.user.user_metadata || {}),
              role: panelRole,
              name: displayName,
              nome: displayName,
              site: PANEL_SLUG,
            },
          });
        }
      }

      // pushUserEditToServer só sabe falar com o DirectAdmin (CMD_API_MODIFY_USER) —
      // para uma conta Hestia isto falhava sempre (o utilizador nem existe no DA),
      // sem trazer nenhum benefício. O Hestia ainda não tem um "editar utilizador"
      // próprio (nome/email/limites individuais), por isso confiamos no espelho
      // para esses campos — mas mudar de PACOTE já tem comando directo
      // (v-change-user-package) e aplicamos a sério.
      const editProvider = await getProviderByUsername(userName);
      const pushed =
        editProvider === 'hestia'
          ? packageName
            ? await hestiaAdapter.changeUserPackage(userName, packageName)
            : { ok: true }
          : await pushUserEditToServer({
              userName,
              email: email ?? String(data.email || ''),
              firstName: body.firstName !== undefined ? String(body.firstName).trim() : String(data.first_name || ''),
              lastName: body.lastName !== undefined ? String(body.lastName).trim() : String(data.last_name || ''),
              websitesLimit: Number(data.websites_limit) || 0,
              emailsLimit: Number(data.emails_limit) || 0,
              packageName,
            });

      // Só espelha no Supabase depois de confirmar que o DirectAdmin aceitou a
      // alteração — escrever antes (como acontecia aqui) deixava o Supabase a
      // mostrar o pacote/email novo mesmo quando o servidor real ainda tinha o
      // antigo, por até 60 min (janela do próximo scheduleDaSync).
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

      if (primaryDomain && (packageName !== undefined || adminEmail !== undefined)) {
        await mirrorAfterDaMutation('modifyWebsite', {
          domain: primaryDomain,
          packageName,
          adminEmail,
        });
      }

      scheduleDaSync(1500);
      return NextResponse.json({ success: true, data, serverSynced: true });
    }

    let data: unknown;

    switch (action) {
      case 'suspend': {
        const provider = await getProviderByUsername(userName);
        const r = await suspendHostingAccount(provider, userName);
        data = { success: r.ok, error: r.error };
        break;
      }
      case 'unsuspend': {
        const provider = await getProviderByUsername(userName);
        const r = await unsuspendHostingAccount(provider, userName);
        data = { success: r.ok, error: r.error };
        break;
      }
      case 'changePassword':
        if (!password || String(password).length < 8) {
          return NextResponse.json({ success: false, error: 'Password inválida' }, { status: 400 });
        }
        {
          // Conta simples (sem hospedagem real) não existe em nenhum servidor
          // DA/Hestia -- tentar mudar a password lá falhava sempre. Para essas,
          // a única password que existe a sério é a do login (auth.users).
          const sbPwd = getDaSyncAdmin();
          const { data: pwdRow } = sbPwd
            ? await sbPwd.from('panel_users').select('hosting_provider, auth_user_id').eq('username', userName).maybeSingle()
            : { data: null };
          if (pwdRow && !pwdRow.hosting_provider) {
            if (!pwdRow.auth_user_id || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
              return NextResponse.json({ success: false, error: 'Conta sem login associado.' }, { status: 409 });
            }
            const authAdmin = createAdminClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
            const { error: authPwdError } = await authAdmin.auth.admin.updateUserById(String(pwdRow.auth_user_id), {
              password: String(password),
            });
            data = { success: !authPwdError, error: authPwdError?.message };
          } else {
            const provider = await getProviderByUsername(userName);
            const r = await changeHostingAccountPassword(provider, userName, String(password));
            data = { success: r.ok, error: r.error };
          }
        }
        break;
      case 'moveToReseller': {
        // Conceito exclusivo do DirectAdmin — o Hestia não tem hierarquia de
        // revendedor equivalente (cada conta é independente lá).
        const provider = await getProviderByUsername(userName);
        if (provider === 'hestia') {
          return NextResponse.json(
            { success: false, error: 'Esta conta vive no HestiaCP, que não tem conceito de revendedor — mudança não aplicável.' },
            { status: 409 },
          );
        }
        const fromReseller = String(body.fromReseller || '').trim();
        const toReseller = String(body.toReseller || '').trim();
        if (!fromReseller || !toReseller) {
          return NextResponse.json({ success: false, error: 'Revendedores de origem e destino são obrigatórios.' }, { status: 400 });
        }
        if (fromReseller === toReseller) {
          return NextResponse.json({ success: false, error: 'Origem e destino devem ser diferentes.' }, { status: 400 });
        }
        // Confirmar que a conta pertence de facto ao revendedor de origem indicado —
        // evita mover a conta errada se a UI estiver desactualizada (dados em cache).
        const currentUsers = await listMirrorUsers({ role: 'admin', userId: auth.user.id });
        const currentUser = currentUsers.find((u) => u.userName === userName);
        if (!currentUser || !belongsToResellerAccount(currentUser, fromReseller)) {
          return NextResponse.json(
            { success: false, error: 'A conta não pertence ao revendedor de origem indicado.' },
            { status: 409 },
          );
        }
        const r = await daPostViaSsh('CMD_API_MOVE_USERS', {
          action: 'move',
          select0: userName,
          reseller: fromReseller,
          new_reseller: toReseller,
        });
        data = { success: r.ok, error: r.error };
        break;
      }
      case 'delete': {
        const provider = await getProviderByUsername(userName);
        const r = await deleteHostingAccount(provider, userName);
        data = { success: r.ok, error: r.error };
        break;
      }
      case 'setQuota': {
        // Edição em linha da quota na tabela Contas — grava só no espelho por
        // agora (não empurra ainda para o servidor real). Um valor explícito
        // aqui passa a ser respeitado pelo da-sync-engine (não é substituído
        // pelo valor ao vivo do DA em cada sincronização, ver esse ficheiro).
        const sb = getDaSyncAdmin();
        if (!sb) {
          return NextResponse.json({ success: false, error: 'Base de dados indisponível.' }, { status: 503 });
        }
        const raw = body.quotaMb;
        const quotaMb = raw === null || raw === '' || raw === undefined ? null : Number(raw);
        if (quotaMb !== null && (!Number.isFinite(quotaMb) || quotaMb <= 0)) {
          return NextResponse.json({ success: false, error: 'Quota inválida.' }, { status: 400 });
        }
        const { error: quotaError } = await sb
          .from('panel_users')
          .update({ quota_limit_mb: quotaMb, updated_at: new Date().toISOString() })
          .eq('username', userName);
        if (quotaError) {
          return NextResponse.json({ success: false, error: quotaError.message }, { status: 500 });
        }
        return NextResponse.json({
          success: true,
          data: { quotaLabel: quotaMb === null ? 'Ilimitado' : formatPackageSize(quotaMb) },
        });
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
        return NextResponse.json({ success: false, error: 'Acção inválida' }, { status: 400 });
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
