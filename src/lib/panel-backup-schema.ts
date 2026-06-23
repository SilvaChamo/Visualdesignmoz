/**
 * Garante tabelas do espelho de backups no Supabase.
 */

import { createClient } from '@supabase/supabase-js'

const MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS public.panel_backup_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  panel_slug TEXT NOT NULL DEFAULT 'visualdesign',
  owner TEXT NOT NULL,
  domain TEXT NOT NULL,
  filename TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'full' CHECK (scope IN ('full', 'files', 'databases', 'emails', 'ftp')),
  size_bytes BIGINT NOT NULL DEFAULT 0,
  size_label TEXT DEFAULT '—',
  source TEXT NOT NULL DEFAULT 'server' CHECK (source IN ('server', 'bucket', 'both')),
  server_path TEXT,
  bucket_path TEXT,
  backup_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (panel_slug, owner, domain, filename)
);
CREATE INDEX IF NOT EXISTS idx_panel_backup_files_owner ON public.panel_backup_files (panel_slug, owner);
CREATE INDEX IF NOT EXISTS idx_panel_backup_files_scope ON public.panel_backup_files (panel_slug, owner, scope);
CREATE INDEX IF NOT EXISTS idx_panel_backup_files_domain ON public.panel_backup_files (domain);
ALTER TABLE public.panel_backup_files ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on panel_backup_files" ON public.panel_backup_files;
CREATE POLICY "Allow all on panel_backup_files" ON public.panel_backup_files FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.panel_backup_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  panel_slug TEXT NOT NULL DEFAULT 'visualdesign',
  owner TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  frequency TEXT NOT NULL DEFAULT 'weekly' CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  run_time TIME NOT NULL DEFAULT '03:00',
  day_of_week SMALLINT CHECK (day_of_week IS NULL OR (day_of_week >= 0 AND day_of_week <= 6)),
  runs_per_month SMALLINT NOT NULL DEFAULT 1 CHECK (runs_per_month >= 1 AND runs_per_month <= 4),
  month_days SMALLINT[] NOT NULL DEFAULT ARRAY[1]::SMALLINT[],
  domain_mode TEXT NOT NULL DEFAULT 'all' CHECK (domain_mode IN ('all', 'selected')),
  domains JSONB NOT NULL DEFAULT '[]'::jsonb,
  backup_scope TEXT NOT NULL DEFAULT 'full' CHECK (backup_scope IN ('full', 'files', 'databases', 'emails', 'ftp')),
  backup_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  bucket_name TEXT NOT NULL DEFAULT 'panel-backups',
  retention_days SMALLINT NOT NULL DEFAULT 30,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (panel_slug, owner)
);
CREATE INDEX IF NOT EXISTS idx_panel_backup_schedules_next ON public.panel_backup_schedules (enabled, next_run_at)
  WHERE enabled = true;
ALTER TABLE public.panel_backup_schedules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on panel_backup_schedules" ON public.panel_backup_schedules;
CREATE POLICY "Allow all on panel_backup_schedules" ON public.panel_backup_schedules FOR ALL USING (true) WITH CHECK (true);
`

let schemaReady = false

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

export async function ensureBackupSchema(): Promise<boolean> {
  if (schemaReady) return true
  const admin = adminClient()
  if (!admin) return false

  try {
    const { error } = await admin.rpc('exec_sql', { sql: MIGRATION_SQL })
    if (!error) {
      schemaReady = true
      return true
    }
  } catch {
    /* RPC pode não existir */
  }

  const { error: probe } = await admin.from('panel_backup_files').select('id').limit(1)
  if (!probe) {
    schemaReady = true
    return true
  }

  console.warn('[panel-backup-schema] Execute scripts/migrate-panel-backup-*.sql no Supabase.')
  return false
}
