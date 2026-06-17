-- Espelho DirectAdmin → painel VisualDesign
-- Executar no Supabase SQL Editor (já aplicado no servidor Hetzner Jun 2026)

CREATE TABLE IF NOT EXISTS panel_emails (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  domain TEXT NOT NULL,
  email_user TEXT NOT NULL,
  full_email TEXT GENERATED ALWAYS AS (email_user || '@' || domain) STORED,
  quota TEXT DEFAULT '500',
  usage TEXT DEFAULT '0',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(domain, email_user)
);

CREATE TABLE IF NOT EXISTS panel_subdomains (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  domain TEXT NOT NULL,
  subdomain TEXT NOT NULL,
  path TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(domain, subdomain)
);

CREATE TABLE IF NOT EXISTS panel_databases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  domain TEXT NOT NULL,
  db_name TEXT NOT NULL,
  db_user TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(domain, db_name)
);

CREATE TABLE IF NOT EXISTS panel_ftp (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  domain TEXT NOT NULL,
  username TEXT NOT NULL,
  path TEXT DEFAULT '/',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(domain, username)
);

CREATE TABLE IF NOT EXISTS panel_dns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  domain TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'A',
  value TEXT NOT NULL,
  ttl TEXT DEFAULT '3600',
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS panel_sync_log (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  status        TEXT NOT NULL DEFAULT 'running',
  sites_count   INTEGER DEFAULT 0,
  users_count   INTEGER DEFAULT 0,
  packages_count INTEGER DEFAULT 0,
  emails_count  INTEGER DEFAULT 0,
  subdomains_count INTEGER DEFAULT 0,
  databases_count INTEGER DEFAULT 0,
  ftp_count     INTEGER DEFAULT 0,
  dns_count     INTEGER DEFAULT 0,
  errors        JSONB DEFAULT '[]'::jsonb,
  duration_ms   INTEGER DEFAULT 0,
  started_at    TIMESTAMPTZ DEFAULT NOW(),
  finished_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_panel_sync_log_started ON panel_sync_log(started_at DESC);

ALTER TABLE panel_sites
  ADD COLUMN IF NOT EXISTS php_version TEXT,
  ADD COLUMN IF NOT EXISTS ssl_status TEXT,
  ADD COLUMN IF NOT EXISTS ip TEXT,
  ADD COLUMN IF NOT EXISTS site_type TEXT DEFAULT 'empty';

ALTER TABLE panel_dns
  ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS idx_panel_dns_domain_name_type
  ON panel_dns (domain, name, type);

ALTER TABLE panel_users
  ADD COLUMN IF NOT EXISTS parent_username TEXT,
  ADD COLUMN IF NOT EXISTS disk_used_mb INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bandwidth_used_mb INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quota_limit_mb INTEGER,
  ADD COLUMN IF NOT EXISTS bandwidth_limit_mb INTEGER,
  ADD COLUMN IF NOT EXISTS package_name TEXT;

CREATE INDEX IF NOT EXISTS idx_panel_sites_owner ON panel_sites(owner);
CREATE INDEX IF NOT EXISTS idx_panel_emails_domain ON panel_emails(domain);
CREATE INDEX IF NOT EXISTS idx_panel_sync_log_status ON panel_sync_log(status);
