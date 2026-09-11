import { NextRequest, NextResponse } from 'next/server';
import { requirePanelBootstrapAccess } from '@/lib/panel-api-auth';
import { resolvePanelDaContext } from '@/lib/panel-api-context';
import { resolveResellerPanelContext } from '@/lib/panel-reseller-context';
import { scheduleDaSync } from '@/lib/da-sync-engine';
import { resolveClientPanelContext } from '@/lib/panel-client-context';
import { getProfileForAuthUser } from '@/lib/profile-db';
import { getDaSyncAdmin } from '@/lib/da-sync-schema';
import {
  normalizeResellerTier,
  resolvePanelCapabilities,
  type ResellerTier,
} from '@/lib/panel-role-capabilities';
import {
  getMirrorLastSyncAt,
  listBootstrapPanelAccounts,
  listMirrorPackages,
  listMirrorUsers,
  listMirrorWebsites,
  listMirrorWebsitesForClientUser,
} from '@/lib/panel-mirror-read';
import { applyAdminPanelScope } from '@/lib/panel-scope-filter';
import { createClient } from '@supabase/supabase-js';
import type { PanelWebsite } from '@/lib/directadmin-hosting-api';

// ── Hestia directo — sem mirror ─────────────────────────────────────────────
// Quando o servidor usa Hestia (Contabo), lemos os sites directamente da API
// Hestia em vez do espelho panel_sites (que foi sincronizado de um servidor
// DirectAdmin diferente e tem owners/caminhos errados para Hestia).
const IS_HESTIA = (process.env.DEFAULT_HOSTING_PROVIDER || '').trim().toLowerCase() === 'hestia';
const HESTIA_USER = (process.env.HESTIA_USER || 'vdadmin').trim();

async function loadHestiaWebsites(): Promise<PanelWebsite[]> {
  const { listWebDomains } = await import('@/lib/hestia-adapter');
  const domains = await listWebDomains(HESTIA_USER);
  return domains.map((d) => ({
    id: d.domain,
    domain: d.domain,
    owner: HESTIA_USER,
    state: d.suspended ? 'suspended' : 'active',
    status: d.suspended ? 'suspended' : 'active',
    ssl: d.sslEnabled,
    sslStatus: d.sslEnabled ? 'Secure' : 'No SSL',
    ip: d.ip,
    diskUsage: d.diskUsedMb,
    bandwidth: d.bandwidthUsedMb,
    isActive: !d.suspended,
  } satisfies PanelWebsite));
}

async function loadResellerTier(userId: string): Promise<ResellerTier | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const admin = createClient(url, key);
  const profile = await getProfileForAuthUser(admin, userId);
  if (profile?.reseller_tier) return normalizeResellerTier(profile.reseller_tier);
  const sb = getDaSyncAdmin();
  if (sb) {
    const { data } = await sb
      .from('panel_auth_accounts')
      .select('reseller_tier')
      .eq('user_id', userId)
      .maybeSingle();
    if (data?.reseller_tier) return normalizeResellerTier(data.reseller_tier);
  }
  return 'essencial';
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requirePanelBootstrapAccess();
    if ('error' in auth) return auth.error;

    const lastSyncedAt = await getMirrorLastSyncAt();

    if (auth.user.role === 'client') {
      const ctx = await resolveClientPanelContext(auth.user.id, auth.user.email);
      const capabilities = resolvePanelCapabilities({ role: 'client' });
      // 'client' cai sempre no ramo readOnly de resolvePanelCapabilities (não
      // há ramo próprio para este role) — isso bloqueava Webmail/Mailmarketing
      // para QUALQUER cliente, mesmo com hospedagem/email/domínio activos.
      // Um cliente com pelo menos um produto comprado deixa de ser readOnly;
      // só fica limitado a "meus-produtos" quem ainda não comprou nada.
      const hasActiveProduct = Boolean(
        ctx.products && (ctx.products.tier !== 'none' || ctx.products.emailPlans.length > 0),
      );
      const readOnly = capabilities.readOnly && !hasActiveProduct;
      return NextResponse.json({
        success: true,
        sites: ctx.sites,
        users: [],
        packages: [],
        accounts: [],
        accountCounts: {},
        resellerContext: null,
        products: ctx.products,
        session: {
          role: 'client',
          readOnly,
          capabilities: { ...capabilities, readOnly },
        },
        meta: { source: 'mirror', lastSyncedAt },
      });
    }

    if (auth.user.role === 'manager') {
      const sites = await listMirrorWebsitesForClientUser(auth.user.id, auth.user.email);
      const capabilities = resolvePanelCapabilities({ role: 'manager' });
      return NextResponse.json({
        success: true,
        sites,
        users: [],
        packages: sites.length ? await listMirrorPackages({ role: 'admin', userId: auth.user.id }, sites) : [],
        accounts: [],
        accountCounts: {},
        resellerContext: null,
        session: {
          role: 'manager',
          readOnly: false,
          capabilities,
        },
        meta: { source: 'mirror', lastSyncedAt },
      });
    }

    const staffAuth = {
      user: auth.user as { id: string; email?: string; role: 'admin' | 'reseller' | 'profissional' },
    };

    // O painel /dashboard pede sempre scope=admin — se um admin estiver a impersonar
    // um revendedor (ex.: tem /revendedor aberto noutro separador), esta resposta em
    // concreto deve mostrar os dados da própria VisualDesign, não os do revendedor.
    // Importante: isto só ignora a impersonação PARA ESTA RESPOSTA — nunca apagar a
    // cookie aqui. Apagar a cookie era um efeito secundário de um GET, e como
    // cookies não são por separador, um simples pedido de bootstrap feito a partir
    // de /dashboard (ex.: um componente de chrome partilhado) terminava
    // silenciosamente a sessão de impersonação activa no separador /revendedor a
    // meio do uso. A saída de impersonação já tem um caminho explícito (botão
    // "Voltar ao painel" / aviso "A impersonar: X — Sair" na AdminSidebar).
    const requestedScope = req.nextUrl.searchParams.get('scope');
    const bypassImpersonation = requestedScope === 'admin' && staffAuth.user.role === 'admin';

    // 'profissional' (comprador self-service em /profissional) usa exactamente
    // o mesmo contexto/scope de dados que um revendedor — só o menu/UI muda,
    // nunca o que a API devolve (ver resolvePanelDaContext, que já trata
    // 'reseller'/'manager'/'profissional' da mesma forma).
    const isResellerShaped = staffAuth.user.role === 'reseller' || staffAuth.user.role === 'profissional';
    const { mirrorScope, effectiveRole } = await resolvePanelDaContext(
      {
        user: isResellerShaped
          ? staffAuth.user
          : { ...staffAuth.user, role: 'admin' },
      },
      { ignoreImpersonation: bypassImpersonation },
    );
    const isReseller = effectiveRole === 'reseller';
    const resellerTier = isReseller ? await loadResellerTier(auth.user.id) : null;

    // ── Hestia directo ─────────────────────────────────────────────────────
    // No deploy Contabo (IS_HESTIA=true) lemos directamente da API Hestia.
    // Os utilizadores e pacotes não existem no Hestia com o mesmo conceito
    // do DA, por isso devolvemos listas vazias para esses — o painel já trata
    // graciosamente ausência de utilizadores/pacotes.
    let sitesOut: PanelWebsite[];
    let usersOut: Awaited<ReturnType<typeof listMirrorUsers>>;
    let packagesOut: Awaited<ReturnType<typeof listMirrorPackages>>;
    let accountsResult: { accounts: Awaited<ReturnType<typeof listBootstrapPanelAccounts>>['accounts']; counts: Record<string, number> };
    let resellerContext: Awaited<ReturnType<typeof resolveResellerPanelContext>> | null;

    if (IS_HESTIA) {
      const { listHostingDomains, listHostingUsers, listHostingPackages } = await import('@/lib/hosting-resolver');
      resellerContext = isReseller
        ? await resolveResellerPanelContext({ user: staffAuth.user })
        : null;
      const [sites, users, packages] = await Promise.all([
        listHostingDomains(
          resellerContext?.daUsername
            ? { role: 'reseller', daUsername: resellerContext.daUsername }
            : undefined,
        ),
        listHostingUsers(),
        listHostingPackages(),
      ]);
      sitesOut = sites;
      usersOut = users;
      packagesOut = packages;
      accountsResult = { accounts: [], counts: {} };
      if (resellerContext?.daUsername) {
        const owner = resellerContext.daUsername;
        usersOut = usersOut.filter(
          (u) => u.userName === owner || u.parentUsername === owner,
        );
      }
    } else {
      const [sites, users, acctRes, resCon] = await Promise.all([
        listMirrorWebsites(mirrorScope),
        listMirrorUsers(mirrorScope),
        isReseller
          ? Promise.resolve({ accounts: [], counts: {} as Record<string, number> })
          : listBootstrapPanelAccounts(staffAuth.user.role === 'admin' ? 'admin' : 'reseller'),
        isReseller ? resolveResellerPanelContext({ user: staffAuth.user }) : Promise.resolve(null),
      ]);
      sitesOut = sites;
      usersOut = users;
      accountsResult = acctRes;
      resellerContext = resCon;
      packagesOut = await listMirrorPackages(mirrorScope, sitesOut);

      if (resellerContext?.daUsername) {
        const owner = resellerContext.daUsername;
        sitesOut = sitesOut.filter((s) => !s.owner || s.owner === owner);
        usersOut = usersOut.filter(
          (u) => u.userName === owner || u.parentUsername === owner,
        );
        packagesOut = await listMirrorPackages(mirrorScope, sitesOut);
      } else if (!isReseller) {
        const scoped = applyAdminPanelScope({
          sites: sitesOut,
          users: usersOut,
          packages: packagesOut,
        });
        sitesOut = scoped.sites;
      }

      if (!sitesOut.length && !usersOut.length) {
        scheduleDaSync(0);
      } else {
        void import('@/lib/panel-mirror-read').then(({ isMirrorStale }) =>
          isMirrorStale(120).then((stale) => {
            if (stale) scheduleDaSync(0);
          }),
        );
      }
    }

    const capabilities = resolvePanelCapabilities({
      role: isReseller ? 'reseller' : 'admin',
      resellerTier,
    });

    return NextResponse.json({
      success: true,
      sites: sitesOut,
      allSites: sitesOut,   // No Hestia não há distinção admin/reseller; no DA era isReseller ? sitesOut : sites
      hostingOwner: IS_HESTIA ? (resellerContext?.daUsername || HESTIA_USER) : null,
      hestiaOnly: IS_HESTIA,
      users: usersOut,
      packages: packagesOut,
      accounts: accountsResult.accounts,
      accountCounts: accountsResult.counts,
      resellerContext: resellerContext
        ? { ...resellerContext, resellerTier }
        : null,
      session: {
        role: isReseller ? 'reseller' : 'admin',
        readOnly: false,
        capabilities,
        resellerTier,
      },
      meta: { source: IS_HESTIA ? 'hestia-direct' : 'mirror', lastSyncedAt },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erro interno';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
