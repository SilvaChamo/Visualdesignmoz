/**
 * Sincronização completa HestiaCP (Contabo) → espelho Supabase (panel_*).
 * Equivalente a da-sync-engine.ts, mas para o segundo motor de hospedagem
 * (ver [[project_hestia-migration-longterm-plan]] — o Contabo/Hestia é o
 * protótipo do destino final, não deve ficar atrás do DirectAdmin em
 * paridade de funcionalidades). Só corre a sério na instância Contabo
 * (onde HESTIA_HOST aponta para um servidor real); no Hetzner as variáveis
 * HESTIA_* existem só para o código compilar, a chamada à API falha e o
 * sync termina sem alterar nada.
 *
 * Âmbito inicial: contas (panel_users) e sites (panel_sites), com limpeza de
 * registos obsoletos restrita a contas já confirmadas como hosting_provider
 * 'hestia' — nunca apaga nem toca em contas/sites geridos pelo DirectAdmin.
 * Recursos por domínio (emails/subdomínios/bases de dados/FTP/DNS) ficam de
 * fora por agora — a API do Hestia não tem um `v-list-*` de bases de dados
 * equivalente ainda confirmado (ver nota "Bases de Dados" em
 * [[project_hestia-migration-longterm-plan]]), e emails deste projecto vivem
 * fora do Hestia (Brevo/Cloudflare), não dentro dele.
 */

import { listUsers, listWebDomains } from '@/lib/hestia-adapter';
import { getDaSyncAdmin } from '@/lib/da-sync-schema';

export type HestiaSyncResult = {
  ok: boolean;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  counts: {
    users: number;
    sites: number;
  };
  errors: string[];
};

function nowIso() {
  return new Date().toISOString();
}

export async function runHestiaFullSync(): Promise<HestiaSyncResult> {
  const startedAt = nowIso();
  const t0 = Date.now();
  const errors: string[] = [];
  const counts = { users: 0, sites: 0 };

  const admin = getDaSyncAdmin();
  if (!admin) {
    return {
      ok: false,
      startedAt,
      finishedAt: nowIso(),
      durationMs: Date.now() - t0,
      counts,
      errors: ['Supabase Service Role não configurado'],
    };
  }

  let users: Awaited<ReturnType<typeof listUsers>>;
  try {
    users = await listUsers();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Falha ao ler HestiaCP';
    return {
      ok: false,
      startedAt,
      finishedAt: nowIso(),
      durationMs: Date.now() - t0,
      counts,
      errors: [msg],
    };
  }

  const syncedAt = nowIso();
  const liveUsernames = new Set<string>();

  // A própria conta principal (HESTIA_USER, normalmente 'vdadmin') fica de
  // propósito fora de listUsers() — não é uma conta de cliente, não faz
  // sentido ter uma linha em panel_users para ela. MAS pode ter sites reais
  // próprios (ex.: um domínio criado directamente nela pelo admin, como
  // aconteceu com entrecamposblog.com) — sem isto no conjunto abaixo, esses
  // sites nunca entravam no espelho panel_sites (o loop de sites só percorre
  // liveUsernames), ficando invisíveis em TODAS as listas do painel mesmo
  // existindo de facto no Hestia. Confirmado ao vivo 1 set: hestia-sync
  // corria com sucesso (users:0, sites:0, sem erros) e nunca via este site.
  liveUsernames.add((process.env.HESTIA_USER || 'vdadmin').trim());

  // ── Contas ──
  for (const user of users) {
    liveUsernames.add(user.username);
    try {
      const { data: existing } = await admin
        .from('panel_users')
        .select('auth_user_id, package_name, quota_limit_mb, bandwidth_limit_mb')
        .eq('username', user.username)
        .maybeSingle();
      const panelManaged = Boolean(existing?.auth_user_id);

      const { error } = await admin.from('panel_users').upsert(
        {
          username: user.username,
          first_name: user.firstName,
          last_name: user.lastName,
          email: user.email,
          acl: 'user',
          hosting_provider: 'hestia',
          package_name: panelManaged && existing?.package_name ? existing.package_name : user.packageName || null,
          disk_used_mb: user.diskUsedMb,
          bandwidth_used_mb: user.bandwidthUsedMb,
          quota_limit_mb:
            panelManaged && existing?.quota_limit_mb !== undefined && existing?.quota_limit_mb !== null
              ? existing.quota_limit_mb
              : user.diskLimitMb,
          bandwidth_limit_mb:
            panelManaged && existing?.bandwidth_limit_mb !== undefined && existing?.bandwidth_limit_mb !== null
              ? existing.bandwidth_limit_mb
              : user.bandwidthLimitMb,
          status: user.suspended ? 'Suspended' : 'Active',
          synced_at: syncedAt,
          updated_at: syncedAt,
          ...(existing?.auth_user_id ? { auth_user_id: existing.auth_user_id } : {}),
        },
        { onConflict: 'username' },
      );
      if (error) errors.push(`user ${user.username}: ${error.message}`);
      else counts.users++;
    } catch (e: unknown) {
      errors.push(`user ${user.username}: ${e instanceof Error ? e.message : 'erro'}`);
    }
  }

  // Só apaga contas Hestia que desapareceram do servidor e nunca tiveram
  // login real ligado no painel — mesma regra do da-sync, restrita a
  // hosting_provider='hestia' para nunca tocar em contas DirectAdmin.
  const { data: existingHestiaUsers } = await admin
    .from('panel_users')
    .select('username, auth_user_id')
    .eq('hosting_provider', 'hestia');
  const staleUsers = (existingHestiaUsers || [])
    .map((r) => ({ username: r.username as string, authUserId: r.auth_user_id as string | null | undefined }))
    .filter((r) => r.username && !liveUsernames.has(r.username) && !r.authUserId)
    .map((r) => r.username);
  if (staleUsers.length) {
    await admin.from('panel_users').delete().in('username', staleUsers);
  }

  // ── Sites (por conta) ──
  // Detecta WordPress a sério (procura wp-config.php no servidor) em vez de
  // confiar só na instalação feita pelo próprio painel — mesmo raciocínio
  // aplicado ao lado DirectAdmin (ver da-sync-engine.ts).
  const { listWpInstalls } = await import('@/lib/wp-cli-server');
  const wpDomains = new Set(
    (await listWpInstalls().catch(() => [])).map((w) => w.domain),
  );

  const liveDomainsByOwner = new Map<string, Set<string>>();
  for (const username of liveUsernames) {
    try {
      const domains = await listWebDomains(username);
      const liveDomains = new Set<string>();
      for (const d of domains) {
        liveDomains.add(d.domain);
        const { error } = await admin.from('panel_sites').upsert(
          {
            domain: d.domain,
            owner: username,
            admin_email: users.find((u) => u.username === username)?.email || '',
            package: users.find((u) => u.username === username)?.packageName || 'Default',
            status: d.suspended ? 'Suspended' : 'Active',
            disk_usage: String(d.diskUsedMb),
            bandwidth_usage: String(d.bandwidthUsedMb),
            ssl_status: d.sslEnabled ? 'Secure' : 'No SSL',
            ip: d.ip || null,
            ...(wpDomains.has(d.domain) ? { site_type: 'wordpress' } : {}),
            synced_at: syncedAt,
            updated_at: syncedAt,
          },
          { onConflict: 'domain' },
        );
        if (error) errors.push(`site ${d.domain}: ${error.message}`);
        else counts.sites++;
      }
      liveDomainsByOwner.set(username, liveDomains);
    } catch (e: unknown) {
      errors.push(`sites de ${username}: ${e instanceof Error ? e.message : 'erro'}`);
    }
  }

  // Limpeza de sites obsoletos, restrita aos donos que sabemos serem contas
  // Hestia (liveUsernames) — nunca mexe em sites de donos DirectAdmin.
  //
  // #achado 24 ago: associar um domínio a uma conta nova (attach-hosting)
  // grava o novo "owner" no painel logo, mas propaga para o Hestia em
  // segundo plano (best-effort, pode falhar ou ainda não ter corrido). Se
  // este sync corresse nesse intervalo, via o domínio como "não existe no
  // Hestia para este owner" e apagava tudo (site + email + BD + FTP + DNS
  // do nosso espelho) — aconteceu a sério com elimservicos.com. Ignora
  // sites actualizados há menos de 15 min para dar tempo à propagação.
  const GRACE_PERIOD_MS = 15 * 60 * 1000;
  const graceCutoff = new Date(Date.now() - GRACE_PERIOD_MS).toISOString();
  for (const [owner, liveDomains] of liveDomainsByOwner) {
    const { data: existingSites } = await admin
      .from('panel_sites')
      .select('domain, updated_at')
      .eq('owner', owner)
      .lt('updated_at', graceCutoff);
    const staleDomains = (existingSites || [])
      .map((r) => r.domain as string)
      .filter((d) => d && !liveDomains.has(d));
    if (staleDomains.length) {
      await admin.from('panel_sites').delete().in('domain', staleDomains);
      for (const d of staleDomains) {
        await admin.from('panel_emails').delete().eq('domain', d);
        await admin.from('panel_subdomains').delete().eq('domain', d);
        await admin.from('panel_databases').delete().eq('domain', d);
        await admin.from('panel_ftp').delete().eq('domain', d);
        await admin.from('panel_dns').delete().eq('domain', d);
      }
    }
  }

  const durationMs = Date.now() - t0;
  const ok = errors.length === 0;
  return { ok, startedAt, finishedAt: nowIso(), durationMs, counts, errors };
}

let syncInFlight: Promise<HestiaSyncResult> | null = null;

/** Evita syncs paralelos (mesmo padrão de runDaFullSyncDeduped). */
export function runHestiaFullSyncDeduped(): Promise<HestiaSyncResult> {
  if (syncInFlight) return syncInFlight;
  syncInFlight = runHestiaFullSync().finally(() => {
    syncInFlight = null;
  });
  return syncInFlight;
}

let _lastHestiaScheduledAt = 0;
const HESTIA_SCHEDULE_THROTTLE_MS = 2 * 60 * 1000;

/** Sync Hestia → espelho, em segundo plano. Na Contabo substitui o DA. */
export function scheduleHestiaSync(delayMs = 2000) {
  const now = Date.now();
  if (now - _lastHestiaScheduledAt < HESTIA_SCHEDULE_THROTTLE_MS) return;
  _lastHestiaScheduledAt = now;
  setTimeout(() => {
    runHestiaFullSyncDeduped().catch((e) => console.error('[hestia-sync] background:', e));
  }, delayMs);
}
