/**
 * Garante colunas DA em profiles/panel_users (migração automática).
 */

import { createClient } from '@supabase/supabase-js';

const MIGRATION_SQL = `
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS da_username TEXT,
  ADD COLUMN IF NOT EXISTS da_password_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS da_domain TEXT,
  ADD COLUMN IF NOT EXISTS da_provisioned_at TIMESTAMPTZ;

ALTER TABLE public.panel_users
  ADD COLUMN IF NOT EXISTS auth_user_id UUID,
  ADD COLUMN IF NOT EXISTS da_password_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS da_domain TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_da_username ON public.profiles (da_username);
CREATE INDEX IF NOT EXISTS idx_panel_users_auth_user_id ON public.panel_users (auth_user_id);
`;

let schemaReady = false;

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function ensureResellerSchema(): Promise<boolean> {
  if (schemaReady) return true;

  const admin = adminClient();
  if (!admin) return false;

  try {
    const { error } = await admin.rpc('exec_sql', { sql: MIGRATION_SQL });
    if (!error) {
      schemaReady = true;
      return true;
    }
  } catch {
    /* RPC pode não existir */
  }

  // Verificar se colunas já existem (migração manual prévia)
  const { error: probeErr } = await admin.from('profiles').select('da_username').limit(1);
  if (!probeErr) {
    schemaReady = true;
    return true;
  }

  console.warn('[reseller-schema] Colunas DA em falta — execute scripts/migrate-reseller-da-columns.sql no Supabase.');
  return false;
}
