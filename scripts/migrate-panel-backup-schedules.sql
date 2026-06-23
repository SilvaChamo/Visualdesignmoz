-- Agendamento de backups automáticos → armazenamento do painel (bucket panel-backups)
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
