import type { SupabaseClient } from '@supabase/supabase-js';
import { getMirrorSiteOwner } from '@/lib/panel-mirror-read';
import {
  getProviderByUsername,
  suspendHostingAccount,
} from '@/lib/hosting-provider';
import { profileAuthOrFilter } from '@/lib/profile-db';
import * as hestiaAdapter from '@/lib/hestia-adapter';

function sharedHostingUsernames(): Set<string> {
  return new Set(
    [
      (process.env.HESTIA_USER || 'vdadmin').trim().toLowerCase(),
      'oshercollective',
      'admin',
    ].filter(Boolean),
  );
}

/**
 * Hospedagem com data de validade já passada: suspende no servidor e marca
 * a linha como expired. Contas partilhadas (vdadmin / Osher / admin) só
 * perdem o site, não a conta inteira.
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
  const shared = sharedHostingUsernames();

  for (const row of rows || []) {
    if (row.server === 'Mail') continue;
    const domain = String(row.domain_name || '').trim().toLowerCase();
    if (!domain) continue;
    result.attempted += 1;

    try {
      let owner = (await getMirrorSiteOwner(domain))?.trim() || '';
      if (!owner && row.user_id) {
        const { data: profile } = await admin
          .from('profiles')
          .select('da_username')
          .or(profileAuthOrFilter(row.user_id))
          .maybeSingle();
        owner = String(profile?.da_username || '').trim();
      }
      if (!owner) {
        result.errors.push(`${domain}: sem conta de hospedagem associada`);
        continue;
      }

      const username = owner.toLowerCase();
      const provider = await getProviderByUsername(owner);
      if (shared.has(username)) {
        if (provider !== 'hestia') {
          result.errors.push(`${domain}: conta partilhada — não suspender a conta inteira`);
          continue;
        }
        const site = await hestiaAdapter.suspendWebDomain(owner, domain);
        if (!site.ok) {
          result.errors.push(`${domain}: ${site.error || 'falha a suspender o site'}`);
          continue;
        }
      } else {
        const account = await suspendHostingAccount(provider, owner);
        if (!account.ok) {
          result.errors.push(`${domain}: ${account.error || 'falha a suspender a conta'}`);
          continue;
        }
      }

      const { error: updateError } = await admin
        .from('hosting_renewals')
        .update({ status: 'expired' })
        .eq('id', row.id);
      if (updateError) {
        result.errors.push(`${domain}: suspenso no servidor, mas o estado na BD falhou (${updateError.message})`);
      }
      result.suspended += 1;
    } catch (itemError) {
      result.errors.push(
        `${domain}: ${itemError instanceof Error ? itemError.message : 'erro ao suspender'}`,
      );
    }
  }

  return result;
}
