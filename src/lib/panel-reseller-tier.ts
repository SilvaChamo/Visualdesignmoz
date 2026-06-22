import { getDaSyncAdmin } from '@/lib/da-sync-schema';
import {
  assertResellerCanCreateChildAccount,
  normalizeResellerTier,
  RESELLER_TIER_LIMITS,
  type ResellerTier,
} from '@/lib/panel-role-capabilities';
import { getProfileForAuthUser } from '@/lib/profile-db';
import { createClient } from '@supabase/supabase-js';

export async function loadResellerTierForUser(userId: string): Promise<ResellerTier> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    const admin = createClient(url, key);
    const profile = await getProfileForAuthUser(admin, userId);
    if (profile?.reseller_tier) return normalizeResellerTier(profile.reseller_tier);
  }
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

export async function countResellerChildAccounts(daUsername: string): Promise<number> {
  const sb = getDaSyncAdmin();
  if (!sb || !daUsername) return 0;
  const owner = daUsername.trim().toLowerCase();
  const { count } = await sb
    .from('panel_users')
    .select('username', { count: 'exact', head: true })
    .eq('parent_username', owner);
  return count ?? 0;
}

export async function assertResellerHostingQuota(params: {
  userId: string;
  daUsername: string;
}): Promise<{ ok: true; tier: ResellerTier } | { ok: false; error: string; tier: ResellerTier }> {
  const tier = await loadResellerTierForUser(params.userId);
  const childCount = await countResellerChildAccounts(params.daUsername);
  const check = assertResellerCanCreateChildAccount({ tier, currentChildCount: childCount });
  if (!check.ok) return { ok: false, error: check.error, tier };
  return { ok: true, tier };
}

export function resellerTierLabel(tier: ResellerTier): string {
  return RESELLER_TIER_LIMITS[tier].label;
}
