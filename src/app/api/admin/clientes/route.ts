import { NextRequest, NextResponse } from 'next/server';
import { getAdminDirectAdminAPI, getDirectAdminAPIForDaUsername } from '@/lib/directadmin-adapter';
import { daPostViaSsh } from '@/lib/da-api-ssh';
import { requireAdminOrReseller } from '@/lib/panel-api-auth';
import { runDaFullSyncDeduped, scheduleDaSync } from '@/lib/da-sync-engine';
import { loadResellerCredentialsByDaUsername } from '@/lib/da-credential-store';
import { sendEmail } from '@/lib/email-service';
import { pushUserEditToServer } from '@/lib/da-user-push-ssh';
import { getDaSyncAdmin } from '@/lib/da-sync-schema';
import {
  deleteMirrorUser,
  mirrorAfterDaMutation,
  patchMirrorUser,
  mutationSucceeded,
} from '@/lib/panel-mirror-write';
import {
  getMirrorLastSyncAt,
  isMirrorStale,
  listMirrorPackages,
  listMirrorUsers,
  listMirrorWebsites,
} from '@/lib/panel-mirror-read';

const OSHER_RESELLER = 'oshercollective';
const LICENSE_MAX_ACCOUNTS = 2;

function deriveUsername(domain: string, email: string): string {
  const fromDomain = domain.replace(/[^a-z0-9]/gi, '').slice(0, 10).toLowerCase();
  if (fromDomain) return fromDomain;
  const fromEmail = email.split('@')[0]?.replace(/[^a-z0-9]/gi, '').slice(0, 10).toLowerCase();
  return fromEmail || 'cliente';
}

function parseLicenseLimit(message: string): boolean {
  return /licen[cç]a.*limitad|limited to \d+ account/i.test(message);
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

    if (syncNow) {
      await runDaFullSyncDeduped();
    } else {
      const stale = await isMirrorStale(5);
      if (stale) scheduleDaSync(0);
    }

    const mirrorScope = { role: 'admin' as const, userId: auth.user.id };
    let [users, sites, packages] = await Promise.all([
      listMirrorUsers(mirrorScope),
      listMirrorWebsites(mirrorScope),
      listMirrorPackages(mirrorScope),
    ]);

    let source: 'mirror' | 'live' = 'mirror';

    // Espelho vazio (primeira vez) — uma leitura live para não mostrar página em branco
    if (users.length === 0 && !syncNow) {
      scheduleDaSync(0);
      const adminApi = await getAdminDirectAdminAPI();
      const [liveUsers, liveSites, livePackages] = await Promise.all([
        adminApi.listUsers(),
        adminApi.listWebsites(),
        adminApi.listPackages(),
      ]);
      if (liveUsers.length > 0) {
        users = liveUsers;
        sites = liveSites;
        packages = livePackages;
        source = 'live';
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

    const enriched = users.map((u) => {
      const owned = sites.filter((s) => s.owner === u.userName);
      return {
        ...u,
        domainCount: owned.length,
        registeredAt: u.registeredAt || null,
      };
    });

    const licenseUsed = users.filter(
      (u) =>
        !u.parentUsername &&
        ['admin', 'reseller'].includes(String(u.acl || u.type || '').toLowerCase()),
    ).length;
    const lastSyncedAt = await getMirrorLastSyncAt();
    const stale = await isMirrorStale(5);

    return NextResponse.json({
      success: true,
      users: enriched,
      packages: allPackages,
      osherReseller: OSHER_RESELLER,
      osherCredsOk: Boolean(osherCreds),
      meta: {
        source,
        lastSyncedAt,
        stale,
      },
      license: {
        used: licenseUsed,
        max: LICENSE_MAX_ACCOUNTS,
        canCreateReseller: licenseUsed < LICENSE_MAX_ACCOUNTS,
        message:
          licenseUsed >= LICENSE_MAX_ACCOUNTS
            ? `Licença DirectAdmin limitada a ${LICENSE_MAX_ACCOUNTS} contas de nível raiz (${licenseUsed}/${LICENSE_MAX_ACCOUNTS}). Novos clientes são criados sob ${OSHER_RESELLER}.`
            : null,
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
    const accountType = String(body.accountType || 'client') as 'client' | 'reseller';
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

    const mirrorUsers = await listMirrorUsers({ role: 'admin', userId: auth.user.id });
    const rootAccounts = mirrorUsers.filter(
      (u) =>
        !u.parentUsername &&
        ['admin', 'reseller'].includes(String(u.acl || u.type || '').toLowerCase()),
    );

    if (accountType === 'reseller') {
      if (rootAccounts.length >= LICENSE_MAX_ACCOUNTS) {
        return NextResponse.json(
          {
            success: false,
            error: `Não é possível criar revendedor: licença limitada a ${LICENSE_MAX_ACCOUNTS} contas e já existem ${rootAccounts.length} (${rootAccounts.map((u) => u.userName).join(', ')}).`,
            licenseLimited: true,
          },
          { status: 403 },
        );
      }

      const createdDomain = domain || `${userName}.com`;
      const result = await daPostViaSsh('CMD_API_ACCOUNT_RESELLER', {
        action: 'create',
        username: userName,
        email,
        passwd: password,
        passwd2: password,
        domain: createdDomain,
        package: packageName,
        ip: 'shared',
        notify: 'no',
      });

      if (!result.ok) {
        throw new Error(result.error || 'Falha ao criar revendedor');
      }

      await mirrorAfterDaMutation('createUser', {
        userName,
        email,
        acl: 'reseller',
        domain: createdDomain,
        packageName,
      });
      scheduleDaSync(1500);
      return NextResponse.json({ success: true, userName, accountType: 'reseller' });
    }

    // Cliente final → criar sob Osher (não consome licença raiz)
    if (!domain.includes('.')) {
      return NextResponse.json(
        { success: false, error: 'Domínio obrigatório para cliente (ex.: exemplo.com).' },
        { status: 400 },
      );
    }

    const osherCreds = await loadResellerCredentialsByDaUsername(OSHER_RESELLER);
    if (!osherCreds) {
      return NextResponse.json(
        {
          success: false,
          error: `Credenciais de ${OSHER_RESELLER} não encontradas. Ligue a revenda Osher no painel antes de criar clientes.`,
        },
        { status: 503 },
      );
    }

    const resellerCreds = {
      role: 'reseller' as const,
      user: osherCreds.user,
      password: osherCreds.password,
    };
    const result = await daPostViaSsh(
      'CMD_API_ACCOUNT_USER',
      {
        action: 'create',
        username: userName,
        email: adminEmail,
        passwd: password,
        passwd2: password,
        domain,
        package: packageName,
        ip: 'shared',
        notify: 'no',
      },
      resellerCreds,
    );

    if (!result.ok) {
      const errMsg = String(result.error || 'Falha ao criar cliente');
      return NextResponse.json(
        {
          success: false,
          error: errMsg,
          licenseLimited: parseLicenseLimit(errMsg),
        },
        { status: 400 },
      );
    }

    if (body.createEmail && body.emailUser) {
      await daPostViaSsh(
        'CMD_API_POP',
        {
          action: 'create',
          domain,
          user: String(body.emailUser),
          passwd: password,
          passwd2: password,
          quota: '500',
        },
        resellerCreds,
      );
    }

    if (body.issueSsl) {
      await daPostViaSsh('CMD_API_SSL', { action: 'save', domain, type: 'acme' }, resellerCreds);
    }

    await mirrorAfterDaMutation('createUser', {
      userName,
      email: adminEmail,
      acl: 'user',
      domain,
      packageName,
      parentReseller: OSHER_RESELLER,
    });
    if (body.createEmail && body.emailUser) {
      await mirrorAfterDaMutation('createEmail', {
        domain,
        userName: String(body.emailUser),
        quota: '500',
      });
    }
    if (body.issueSsl) {
      await mirrorAfterDaMutation('issueSSL', { domain });
    }

    scheduleDaSync(1500);
    return NextResponse.json({
      success: true,
      userName,
      domain,
      accountType: 'client',
      parentReseller: OSHER_RESELLER,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Erro interno';
    return NextResponse.json(
      {
        success: false,
        error: message,
        licenseLimited: parseLicenseLimit(message),
      },
      { status: 500 },
    );
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
      if (email !== undefined && !email.includes('@')) {
        return NextResponse.json({ success: false, error: 'Email inválido' }, { status: 400 });
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
      });

      if (!pushed.ok) {
        return NextResponse.json(
          { success: false, error: pushed.error || 'Não foi possível aplicar no servidor' },
          { status: 502 },
        );
      }

      scheduleDaSync(1500);
      return NextResponse.json({ success: true, data });
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
    }

    if (action !== 'sendMessage' && ok) scheduleDaSync(1500);
    return NextResponse.json({ success: ok, data });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Erro interno';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
