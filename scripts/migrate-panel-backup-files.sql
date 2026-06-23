-- Espelho de ficheiros de backup (painel ↔ servidor ↔ armazenamento)
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
