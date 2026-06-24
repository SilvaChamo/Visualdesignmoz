import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cachedAdminClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient | null {
  if (cachedAdminClient) return cachedAdminClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;

  cachedAdminClient = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cachedAdminClient;
}
