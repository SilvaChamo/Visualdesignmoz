import { getDaSyncAdmin } from '@/lib/da-sync-schema';
import { PRIMARY_RESELLER_DA_USER } from '@/lib/panel-contas-enrich';
import { ADMIN_BOOTSTRAP_EMAILS } from '@/lib/panel-user-registry';

export type DomainOwnershipBucket = 'mine' | 'client' | 'foreign';

/** Contas no servidor que são a VisualDesign — não clientes nem a Osher. */
function visualDesignServerOwners(): Set<string> {
  const owners = new Set(['admin', 'visualdesign']);
  if ((process.env.DEFAULT_HOSTING_PROVIDER || '').trim().toLowerCase() === 'hestia') {
    owners.add((process.env.HESTIA_USER || 'vdadmin').trim().toLowerCase());
  }
  return owners;
}

function isVisualDesignStaffEmail(email: string): boolean {
  const e = email.trim().toLowerCase();
  if (!e) return false;
  if (ADMIN_BOOTSTRAP_EMAILS.has(e)) return true;
  return e.endsWith('@visualdesignmoz.com');
}

function isVisualDesignStaffRole(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'manager';
}

function bucketFromAccount(row: {
  email?: string | null;
  role?: string | null;
  da_username?: string | null;
}): DomainOwnershipBucket {
  const daUser = String(row.da_username || '').trim().toLowerCase();
  if (daUser && daUser === PRIMARY_RESELLER_DA_USER.toLowerCase()) return 'foreign';
  const email = String(row.email || '').trim().toLowerCase();
  const role = String(row.role || '').trim().toLowerCase();
  if (isVisualDesignStaffRole(role) || isVisualDesignStaffEmail(email)) return 'mine';
  return 'client';
}

/**
 * A conta Dynadot é única e partilhada. Separa VisualDesign / clientes / Osher
 * para as tabs "Meus domínios" e "Domínios de Clientes" não se misturarem
 * nem esconderem compras de clientes.
 */
export async function classifyRegistrarDomains<T extends { domain: string }>(
  domains: T[],
): Promise<{ mine: T[]; clients: T[]; foreign: T[] }> {
  const empty = { mine: [] as T[], clients: [] as T[], foreign: [] as T[] };
  const sb = getDaSyncAdmin();
  if (!sb || domains.length === 0) {
    return { ...empty, mine: domains };
  }

  const names = domains.map((d) => d.domain.trim().toLowerCase()).filter(Boolean);
  const vdOwners = visualDesignServerOwners();
  const foreignOwners = new Set<string>([PRIMARY_RESELLER_DA_USER.toLowerCase()]);

  const [{ data: sites }, { data: renewals }] = await Promise.all([
    sb.from('panel_sites').select('domain, owner').in('domain', names),
    sb.from('domain_renewals').select('domain_name, user_id').in('domain_name', names),
  ]);

  const ownerByDomain = new Map<string, string>();
  for (const row of sites || []) {
    const domain = String(row.domain || '').trim().toLowerCase();
    const owner = String(row.owner || '').trim().toLowerCase();
    if (domain && owner) ownerByDomain.set(domain, owner);
  }

  const userIdByDomain = new Map<string, string>();
  const userIds = new Set<string>();
  for (const row of renewals || []) {
    const domain = String(row.domain_name || '').trim().toLowerCase();
    const userId = String(row.user_id || '').trim();
    if (domain && userId) {
      userIdByDomain.set(domain, userId);
      userIds.add(userId);
    }
  }

  const bucketByUserId = new Map<string, DomainOwnershipBucket>();
  if (userIds.size > 0) {
    const ids = [...userIds];
    const [{ data: profiles }, { data: authAccounts }] = await Promise.all([
      sb.from('profiles').select('user_id, email, role, da_username').in('user_id', ids),
      sb.from('panel_auth_accounts').select('user_id, email, role, da_username').in('user_id', ids),
    ]);
    for (const row of [...(profiles || []), ...(authAccounts || [])]) {
      const id = String(row.user_id || '').trim();
      if (!id || bucketByUserId.has(id)) continue;
      bucketByUserId.set(id, bucketFromAccount(row));
    }
  }

  const mine: T[] = [];
  const clients: T[] = [];
  const foreign: T[] = [];

  for (const item of domains) {
    const domain = item.domain.trim().toLowerCase();
    const owner = ownerByDomain.get(domain);
    const userBucket = userIdByDomain.has(domain)
      ? bucketByUserId.get(userIdByDomain.get(domain)!)
      : undefined;

    let bucket: DomainOwnershipBucket;
    if (owner && foreignOwners.has(owner)) {
      bucket = 'foreign';
    } else if (userBucket === 'foreign') {
      bucket = 'foreign';
    } else if (userBucket) {
      // Compra no carrinho: o dono da renovação manda — mesmo que o site
      // viva na conta partilhada vdadmin.
      bucket = userBucket;
    } else if (owner && vdOwners.has(owner)) {
      bucket = 'mine';
    } else if (owner) {
      bucket = 'client';
    } else {
      bucket = 'mine';
    }

    if (bucket === 'client') clients.push(item);
    else if (bucket === 'foreign') foreign.push(item);
    else mine.push(item);
  }

  return { mine, clients, foreign };
}

/** Só os da VisualDesign — prefetch / tabs "Meus". */
export async function keepVisualDesignRegistrarDomains<T extends { domain: string }>(
  domains: T[],
): Promise<T[]> {
  const { mine } = await classifyRegistrarDomains(domains);
  return mine;
}
