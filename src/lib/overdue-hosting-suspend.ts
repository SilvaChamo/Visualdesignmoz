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
 *  1b. período de recuperação (Silva, 26/10/2026: "o básico que todos usam"): RECUPERACAO_DIAS (30) depois do fim do prazo, com o
 *     serviço suspenso e nada apagado; o cliente é avisado no dia da suspensão, a meio e nos últimos dias
 *     (recuperacao-renovacao.ts, chamado pelo cron);
 *  2. fim do período de redenção do domínio (~60 dias, ver domain-redemption.ts)
 *     — avisa o admin para fazer a cópia e remover do servidor;
 *  3. um ano depois — avisa o admin que a cópia já pode ser apagada.
 * Os passos 2 e 3 só avisam: apagar é irreversível e fica com a equipa.
 */

/** Dias de recuperação depois do fim do prazo: o mesmo período de graça de 30 dias que os domínios já têm (domain-redemption.ts). */
export const RECUPERACAO_DIAS = 30;
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
    if (provider !== 'hestia') return { ok: false, error: `${domain}: plano de email fora do Vhost — ${verb} à mão` };
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

/** Travões da suspensão automática (Silva, 24/10/2026: "quando chegar o último dia, suspender"). Como a tabela de renovações pode ter linhas
 *  velhas ou incompletas (o basededadosagro.com chegou a faltar), nunca se suspende às cegas: */
const ATRASO_MAX_DIAS = 30; // só se suspende o que expirou há 30 dias ou menos; mais antigo avisa o admin e fica para rever à mão
const SUSPENSOES_MAX_POR_CORRIDA = 5; // no máximo 5 por dia; o resto fica para o dia seguinte e o admin é avisado
const NUNCA_SUSPENDER_POR_OMISSAO = 'basededadosagro.com,visualdesignmoz.com';

/** Domínios que nunca se suspendem automaticamente (RENOVACOES_NUNCA_SUSPENDER, separados por vírgulas) */
export function dominioProtegido(domain: string): boolean {
  const lista = (process.env.RENOVACOES_NUNCA_SUSPENDER || NUNCA_SUSPENDER_POR_OMISSAO)
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const d = domain.trim().toLowerCase();
  return lista.some((p) => d === p || d.endsWith('.' + p));
}

export type ResultadoAtrasos = {
  attempted: number;
  suspended: number;
  errors: string[];
  /** expirou há mais de ATRASO_MAX_DIAS: não se suspende, avisa-se o admin */
  antigos: number;
  /** domínios que nunca se suspendem */
  protegidos: string[];
  /** ficaram para o dia seguinte (limite por corrida) */
  adiados: number;
  /** só na simulação: o que seria suspenso */
  planeados?: { domain: string; expiration: string | null; server: string | null }[];
};

/**
 * Hospedagem e planos de email com data de validade já passada: suspende no servidor e marca a linha como expired.
 * O serviço vale até ao último dia (a data de validade); a suspensão é no dia a seguir. Com `simular`, só diz o que faria.
 */
export async function suspendOverdueHostingAccounts(
  admin: SupabaseClient,
  opcoes: { simular?: boolean } = {},
): Promise<ResultadoAtrasos> {
  const hoje = new Date();
  const today = hoje.toISOString().slice(0, 10);
  const limite = new Date(hoje.getTime() - ATRASO_MAX_DIAS * 86_400_000).toISOString().slice(0, 10);
  const result: ResultadoAtrasos = { attempted: 0, suspended: 0, errors: [], antigos: 0, protegidos: [], adiados: 0 };
  if (opcoes.simular) result.planeados = [];

  // o que expirou há mais de 30 dias nunca se suspende sozinho: pode ser uma linha velha ou esquecida
  const { count: velhos } = await admin
    .from('hosting_renewals')
    .select('id', { count: 'exact', head: true })
    .lt('expiration_date', limite)
    .in('status', ['active', 'pending']);
  result.antigos = velhos || 0;
  if (result.antigos > 0 && !opcoes.simular) {
    await notifyAdminOnce(
      admin,
      'Renovações em atraso há mais de 30 dias',
      `${result.antigos} renovação(ões) de hospedagem expiraram há mais de ${ATRASO_MAX_DIAS} dias e ainda estão activas: não são suspensas automaticamente. Reveja-as em Admin › Renovações.`,
    ).catch(() => false);
  }

  const { data: rows, error } = await admin
    .from('hosting_renewals')
    .select('id, user_id, domain_name, status, server, expiration_date')
    .lt('expiration_date', today)
    .gte('expiration_date', limite)
    .in('status', ['active', 'pending']);

  if (error) {
    result.errors.push(error.message);
    return result;
  }

  const suspensos: string[] = [];
  for (const row of (rows || []) as RenewalRow[]) {
    // Plano de email ainda sem domínio associado — nada no servidor para suspender.
    if (!String(row.domain_name || '').trim()) continue;
    const dominio = String(row.domain_name).trim().toLowerCase();
    if (dominioProtegido(dominio)) {
      result.protegidos.push(dominio);
      continue;
    }
    if (opcoes.simular) {
      result.planeados!.push({ domain: dominio, expiration: row.expiration_date ?? null, server: row.server });
      continue;
    }
    if (result.suspended >= SUSPENSOES_MAX_POR_CORRIDA) {
      result.adiados += 1;
      continue;
    }
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
      suspensos.push(dominio);
    } catch (itemError) {
      result.errors.push(
        `${row.domain_name}: ${itemError instanceof Error ? itemError.message : 'erro ao suspender'}`,
      );
    }
  }

  if (suspensos.length > 0 || result.adiados > 0) {
    await notifyAdminOnce(
      admin,
      'Serviços suspensos por atraso',
      `${today}: suspensos ${suspensos.length} (${suspensos.join(', ') || '—'})${result.adiados ? `; ${result.adiados} ficam para amanhã (limite de ${SUSPENSOES_MAX_POR_CORRIDA} por dia)` : ''}. A renovação paga volta a activá-los; os clientes têm ${RECUPERACAO_DIAS} dias para recuperar e são avisados.`,
    ).catch(() => false);
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
