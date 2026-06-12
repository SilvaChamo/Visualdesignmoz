import { createClient as createServiceClient } from '@supabase/supabase-js';
import { getProfileForAuthUser } from '@/lib/profile-db';
import { listMirrorWebsites } from '@/lib/panel-mirror-read';
import type { PanelWebsite } from '@/lib/directadmin-hosting-api';

function siteMatchesClient(site: PanelWebsite, email: string, daDomain?: string | null): boolean {
  const domain = (site.domain || '').toLowerCase();
  const emailLower = email.toLowerCase();
  const local = emailLower.split('@')[0];

  if (daDomain && domain === daDomain.toLowerCase()) return true;
  if ((site.adminEmail || '').toLowerCase() === emailLower) return true;
  if ((site.owner || '').toLowerCase() === emailLower) return true;
  if (local && domain.includes(local)) return true;
  return false;
}

export async function listClientHostingSites(
  userId: string,
  email: string,
): Promise<PanelWebsite[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const admin = createServiceClient(supabaseUrl, supabaseKey);

  const profile = await getProfileForAuthUser(admin, userId);
  const allSites = await listMirrorWebsites({ role: 'admin' });

  return allSites.filter((site) =>
    siteMatchesClient(site, email, profile?.da_domain),
  );
}

export async function assertClientOwnsDomain(
  userId: string,
  email: string,
  domain: string,
): Promise<void> {
  const allowed = await listClientHostingSites(userId, email);
  const ok = allowed.some((s) => (s.domain || '').toLowerCase() === domain.toLowerCase());
  if (!ok) {
    throw new Error('Sem permissão para este domínio');
  }
}

export function pickClientPrimaryDomain(sites: PanelWebsite[]): string {
  const wp =
    sites.find((s) => s.hasWordPress || s.siteType === 'wordpress') ||
    sites.find((s) => !s.domain.includes('contaboserver')) ||
    sites[0];
  return (wp?.domain || '').toLowerCase();
}
