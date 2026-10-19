import type { SupabaseClient } from '@supabase/supabase-js';
import {
  getProviderByUsername,
  suspendHostingAccount,
  unsuspendHostingAccount,
} from '@/lib/hosting-provider';
import { profileAuthOrFilter } from '@/lib/profile-db';
import * as hestiaAdapter from '@/lib/hestia-adapter';

/**
 * Depois de um serviço expirar (política combinada a 9 out 2026):
 *  1. no dia seguinte à expiração — suspende no servidor (site ou email),
 *     reversível: o pagamento da renovação volta a activar
 *     (reactivateRenewedHosting, chamado em confirmRenewalPayment);
 *  2. fim do período de redenção do domínio (~60 dias, ver domain-redemption.ts)
 *     — avisa o admin para fazer a cópia e remover do servidor;
 *  3. um ano depois — avisa o admin que a cópia já pode ser apagada.
 * Os passos 2 e 3 só avisam: apagar é irreversível e fica com a equipa.
 */

const REDEMPTION_END_DAYS = 60;
const BACKUP_KEEP_DAYS = 365;

type RenewalRow = {
  id: string;
  user_id: string | null;
  domain_name: string | null;
  status: string | null;
  server: string | null;
  expiration_date?: string | null;
};

function sharedHostingUsernames(): Set<string> {
  return new Set(
    [
      (process.env.HESTIA_USER || 'vdadmin').trim().toLowerCase(),
      'oshercollective',
      'admin',
    ].filter(Boolean),
  );
}

/** Conta de alojamento onde está o domínio do registo (site ou email). */
async function resolveRenewalOwner(admin: SupabaseClient, row: RenewalRow, domain: string): Promise<string> {
  let owner = (await (await import('@/lib/hosting-resolver')).resolveHostingOwner(domain))?.trim() || '';
  if (!owner && row.user_id) {
    const { data: profile } = await admin
      .from('profiles')
      .select('da_username')
      .or(profileAuthOrFilter(row.user_id))
      .maybeSingle();
    owner = String(profile?.da_username || '').trim();
  }
  return owner;
}

/**
 * Suspende (ou reactiva) no servidor o serviço de um registo de hospedagem:
 *  - plano de email (server='Mail') → só o domínio de email, nunca a conta
 *    (pode estar na mesma conta de um site do cliente);
 *  - conta partilhada (vdadmin / Osher / admin) → só o site;
 *  - conta própria do cliente → a conta inteira.
 */
async function setServiceSuspended(
  admin: SupabaseClient,
  row: RenewalRow,
  suspended: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const domain = String(row.domain_name || '').trim().toLowerCase();
  if (!domain) return { ok: false, error: 'registo sem domínio' };
  const owner = await resolveRenewalOwner(admin, row, domain);
  if (!owner) return { ok: false, error: `${domain}: sem conta de hospedagem associada` };

  const provider = await getProviderByUsername(owner);
  const verb = suspended ? 'suspender' : 'reactivar';

  if (row.server === 'Mail') {
    if (provider !== 'hestia') return { ok: false, error: `${domain}: plano de email fora do Hestia — ${verb} à mão` };
    const mail = suspended
      ? await hestiaAdapter.suspendMailDomain(owner, domain)
      : await hestiaAdapter.unsuspendMailDomain(owner, domain);
    return mail.ok ? { ok: true } : { ok: false, error: `${domain}: ${mail.error || `falha a ${verb} o email`}` };
  }

  if (sharedHostingUsernames().has(owner.toLowerCase())) {
    if (provider !== 'hestia') return { ok: false, error: `${domain}: conta partilhada — não ${verb} a conta inteira` };
    const site = suspended
      ? await hestiaAdapter.suspendWebDomain(owner, domain)
      : await hestiaAdapter.unsuspendWebDomain(owner, domain);
    return site.ok ? { ok: true } : { ok: false, error: `${domain}: ${site.error || `falha a ${verb} o site`}` };
  }

  const account = suspended
    ? await suspendHostingAccount(provider, owner)
    : await unsuspendHostingAccount(provider, owner);
  return account.ok ? { ok: true } : { ok: false, error: `${domain}: ${account.error || `falha a ${verb} a conta`}` };
}

/**
 * Hospedagem e planos de email com data de validade já passada: suspende no
 * servidor e marca a linha como expired.
 */
export async function suspendOverdueHostingAccounts(admin: SupabaseClient): Promise<{
  attempted: number;
  suspended: number;
  errors: string[];
}> {
  const today = new Date().toISOString().slice(0, 10);
  const { data: rows, error } = await admin
    .from('hosting_renewals')
    .select('id, user_id, domain_name, status, server')
    .lt('expiration_date', today)
    .in('status', ['active', 'pending']);

  if (error) {
    return { attempted: 0, suspended: 0, errors: [error.message] };
  }

  const result = { attempted: 0, suspended: 0, errors: [] as string[] };

  for (const row of (rows || []) as RenewalRow[]) {
    // Plano de email ainda sem domínio associado — nada no servidor para suspender.
    if (!String(row.domain_name || '').trim()) continue;
    result.attempted += 1;

    try {
      const done = await setServiceSuspended(admin, row, true);
      if (!done.ok) {
        result.errors.push(done.error);
        continue;
      }

      const { error: updateError } = await admin
        .from('hosting_renewals')
        .update({ status: 'expired' })
        .eq('id', row.id);
      if (updateError) {
        result.errors.push(`${row.domain_name}: suspenso no servidor, mas o estado na BD falhou (${updateError.message})`);
      }
      result.suspended += 1;
    } catch (itemError) {
      result.errors.push(
        `${row.domain_name}: ${itemError instanceof Error ? itemError.message : 'erro ao suspender'}`,
      );
    }
  }

  return result;
}

/**
 * Renovação paga de um serviço que o cron tinha suspendido (status
 * 'expired'): volta a activá-lo no servidor. Nunca falha a confirmação do
 * pagamento — se não conseguir, avisa o admin para reactivar à mão.
 */
export async function reactivateRenewedHosting(admin: SupabaseClient, row: RenewalRow): Promise<void> {
  if (row.status !== 'expired') return;
  try {
    const done = await setServiceSuspended(admin, row, false);
    if (!done.ok) await notifyAdminOnce(admin, 'Reactivar serviço renovado', `Renovação paga, mas não foi possível reactivar no servidor — ${done.error}. Reactive à mão.`);
  } catch (err) {
    await notifyAdminOnce(admin, 'Reactivar serviço renovado', `Renovação paga de ${row.domain_name}, mas a reactivação falhou: ${err instanceof Error ? err.message : 'erro'}. Reactive à mão.`);
  }
}

let cachedAdminUserId: string | null = null;

async function findAdminUserId(admin: SupabaseClient): Promise<string | null> {
  if (cachedAdminUserId) return cachedAdminUserId;
  const { ADMIN_EMAILS } = await import('@/lib/user-roles');
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) return null;
    const found = data.users.find((u) => u.email && ADMIN_EMAILS.has(u.email.toLowerCase()));
    if (found) return (cachedAdminUserId = found.id);
    if (data.users.length < 1000) return null;
  }
  return null;
}

/** Notificação ao admin, sem repetir a mesma mensagem em cada corrida do cron. */
async function notifyAdminOnce(admin: SupabaseClient, title: string, message: string): Promise<boolean> {
  const adminUserId = await findAdminUserId(admin);
  if (!adminUserId) return false;
  const { data: existing } = await admin
    .from('notifications')
    .select('id')
    .eq('user_id', adminUserId)
    .eq('title', title)
    .eq('message', message)
    .limit(1);
  if (existing?.length) return false;
  const { error } = await admin.from('notifications').insert({
    user_id: adminUserId,
    title,
    message,
    type: 'warning',
    category: 'system',
  });
  return !error;
}

/**
 * Passos 2 e 3 da política: avisa o admin quando um serviço expirado (e não
 * renovado) chega ao fim do período de redenção, e quando passa um ano.
 */
export async function notifyExpiredCleanupDue(admin: SupabaseClient): Promise<{ notified: number; errors: string[] }> {
  const result = { notified: 0, errors: [] as string[] };
  const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
  const { data: rows, error } = await admin
    .from('hosting_renewals')
    .select('id, user_id, domain_name, status, server, expiration_date')
    .eq('status', 'expired')
    .lte('expiration_date', daysAgo(REDEMPTION_END_DAYS));
  if (error) return { notified: 0, errors: [error.message] };

  for (const row of (rows || []) as RenewalRow[]) {
    const domain = String(row.domain_name || '').trim().toLowerCase();
    if (!domain || !row.expiration_date) continue;
    const kind = row.server === 'Mail' ? 'o domínio de email (e as caixas)' : 'o site';
    const owner = await resolveRenewalOwner(admin, row, domain).catch(() => '');
    const where = owner ? ` da conta ${owner}` : '';
    const yearOver = row.expiration_date.slice(0, 10) <= daysAgo(BACKUP_KEEP_DAYS);
    const sent = yearOver
      ? await notifyAdminOnce(
          admin,
          'Limpeza: cópia com mais de 1 ano',
          `${domain}${where} expirou a ${row.expiration_date.slice(0, 10)} e não foi renovado há mais de um ano — a cópia de segurança já pode ser apagada.`,
        )
      : await notifyAdminOnce(
          admin,
          'Limpeza: fim do período de redenção',
          `${domain}${where} expirou a ${row.expiration_date.slice(0, 10)} e não foi renovado. O período de redenção acabou — faça uma cópia de segurança e remova ${kind} do servidor.`,
        );
    if (sent) result.notified += 1;
  }
  return result;
}
