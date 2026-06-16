/**
 * Garante tabelas/colunas do espelho DA → Supabase.
 */

import { createClient } from '@supabase/supabase-js';

const MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS panel_sync_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'running',
  sites_count INTEGER DEFAULT 0,
  users_count INTEGER DEFAULT 0,
  packages_count INTEGER DEFAULT 0,
  emails_count INTEGER DEFAULT 0,
  subdomains_count INTEGER DEFAULT 0,
  databases_count INTEGER DEFAULT 0,
  ftp_count INTEGER DEFAULT 0,
  dns_count INTEGER DEFAULT 0,
  errors JSONB DEFAULT '[]'::jsonb,
  duration_ms INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_panel_sync_log_started ON panel_sync_log(started_at DESC);
ALTER TABLE panel_sites ADD COLUMN IF NOT EXISTS php_version TEXT;
ALTER TABLE panel_sites ADD COLUMN IF NOT EXISTS ssl_status TEXT;
ALTER TABLE panel_sites ADD COLUMN IF NOT EXISTS ip TEXT;
ALTER TABLE panel_sites ADD COLUMN IF NOT EXISTS site_type TEXT DEFAULT 'empty';
ALTER TABLE panel_users ADD COLUMN IF NOT EXISTS parent_username TEXT;
ALTER TABLE panel_dns ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE panel_packages ADD COLUMN IF NOT EXISTS package_form_json JSONB;
CREATE UNIQUE INDEX IF NOT EXISTS idx_panel_dns_domain_name_type ON panel_dns (domain, name, type);
CREATE INDEX IF NOT EXISTS idx_panel_sites_owner ON panel_sites(owner);
`;

let schemaReady = false;

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function ensureDaSyncSchema(): Promise<boolean> {
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

  const { error: probe } = await admin.from('panel_sync_log').select('id').limit(1);
  if (!probe) {
    schemaReady = true;
    return true;
  }

  console.warn('[da-sync-schema] Execute scripts/migrate-da-sync-mirror.sql no Supabase.');
  return false;
}

export function getDaSyncAdmin() {
  return adminClient();
}
