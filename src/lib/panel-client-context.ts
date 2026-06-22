/**
 * Resolve dados do painel cliente a partir do utilizador Auth (conta única).
 */

import { getDaSyncAdmin } from '@/lib/da-sync-schema';
import { listMirrorWebsitesForClientUser } from '@/lib/panel-mirror-read';
import type { PanelWebsite } from '@/lib/directadmin-hosting-api';
import type { UserProductsSummary } from '@/lib/user-products';
import { createClient } from '@supabase/supabase-js';

export type ClientPanelContext = {
  panelUsername: string | null;
  sites: PanelWebsite[];
  products: UserProductsSummary | null;
};

async function fetchProductsForUserId(userId: string): Promise<UserProductsSummary | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !userId) return null;

  const { fetchUserProductsSummary } = await import('@/lib/user-products');
  const admin = createClient(url, key);
  return fetchUserProductsSummary(admin, userId);
}

/** Sites e produtos do cliente — ligação por auth_user_id. */
export async function resolveClientPanelContext(
  userId: string,
  email?: string | null,
): Promise<ClientPanelContext> {
  const sites = await listMirrorWebsitesForClientUser(userId, email);
  const products = await fetchProductsForUserId(userId);

  const sb = getDaSyncAdmin();
  let panelUsername: string | null = null;
  if (sb) {
    const { data } = await sb
      .from('panel_users')
      .select('username')
      .eq('auth_user_id', userId)
      .maybeSingle();
    panelUsername = data?.username ? String(data.username) : null;
  }

  return { panelUsername, sites, products };
}
