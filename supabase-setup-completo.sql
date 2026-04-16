-- ============================================================
-- VISUALDESIGNE ADMIN PANEL — Supabase Setup Completo
-- Executa este ficheiro no Supabase → SQL Editor → New query
-- ============================================================

-- Função auxiliar para updated_at (precisa de existir primeiro)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ language 'plpgsql';

-- ============================================================
-- 1. SITES / WEBSITES CYBERPANEL
-- ============================================================
CREATE TABLE IF NOT EXISTS cyberpanel_sites (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  domain       TEXT UNIQUE NOT NULL,
  admin_email  TEXT DEFAULT '',
  package      TEXT DEFAULT 'Default',
  owner        TEXT DEFAULT 'admin',
  status       TEXT DEFAULT 'Active',
  disk_usage   TEXT DEFAULT '0',
  bandwidth_usage TEXT DEFAULT '0',
  wp_installed BOOLEAN DEFAULT false,
  wp_title     TEXT DEFAULT '',
  wp_user      TEXT DEFAULT '',
  synced_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cp_sites_domain ON cyberpanel_sites(domain);
ALTER TABLE cyberpanel_sites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on cyberpanel_sites" ON cyberpanel_sites;
CREATE POLICY "Allow all on cyberpanel_sites" ON cyberpanel_sites FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 2. UTILIZADORES CYBERPANEL
-- ============================================================
CREATE TABLE IF NOT EXISTS cyberpanel_users (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username       TEXT UNIQUE NOT NULL,
  first_name     TEXT DEFAULT '',
  last_name      TEXT DEFAULT '',
  email          TEXT DEFAULT '',
  acl            TEXT DEFAULT 'user',
  websites_limit INTEGER DEFAULT 0,
  emails_limit   INTEGER DEFAULT 0,
  status         TEXT DEFAULT 'Active',
  synced_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cp_users_username ON cyberpanel_users(username);
ALTER TABLE cyberpanel_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on cyberpanel_users" ON cyberpanel_users;
CREATE POLICY "Allow all on cyberpanel_users" ON cyberpanel_users FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 3. PACOTES DE HOSTING
-- ============================================================
CREATE TABLE IF NOT EXISTS cyberpanel_packages (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  package_name    TEXT UNIQUE NOT NULL,
  disk_space      INTEGER DEFAULT 1000,
  bandwidth       INTEGER DEFAULT 10000,
  email_accounts  INTEGER DEFAULT 10,
  databases       INTEGER DEFAULT 1,
  ftp_accounts    INTEGER DEFAULT 1,
  allowed_domains INTEGER DEFAULT 1,
  synced_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE cyberpanel_packages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on cyberpanel_packages" ON cyberpanel_packages;
CREATE POLICY "Allow all on cyberpanel_packages" ON cyberpanel_packages FOR ALL USING (true) WITH CHECK (true);
INSERT INTO cyberpanel_packages (package_name) VALUES ('Default') ON CONFLICT DO NOTHING;

-- ============================================================
-- 4. CONTAS / SUBSCRIPTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vhm_username  TEXT NOT NULL,
  client_email  TEXT DEFAULT '',
  domain        TEXT DEFAULT '',
  plan          TEXT DEFAULT 'Default',
  status        TEXT DEFAULT 'active',
  setup_date    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expiry_date   TIMESTAMP WITH TIME ZONE,
  ip_address    TEXT DEFAULT '',
  quota         TEXT DEFAULT '',
  disk_used     TEXT DEFAULT '',
  client_phone  TEXT DEFAULT '',
  last_notified_at TIMESTAMP WITH TIME ZONE,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_domain ON subscriptions(domain);
CREATE INDEX IF NOT EXISTS idx_subscriptions_username ON subscriptions(vhm_username);
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on subscriptions" ON subscriptions;
CREATE POLICY "Allow all on subscriptions" ON subscriptions FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 5. E-MAILS
-- ============================================================
CREATE TABLE IF NOT EXISTS cyberpanel_emails (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  domain     TEXT NOT NULL,
  email_user TEXT NOT NULL,
  full_email TEXT GENERATED ALWAYS AS (email_user || '@' || domain) STORED,
  quota      TEXT DEFAULT '500',
  usage      TEXT DEFAULT '0',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(domain, email_user)
);
CREATE INDEX IF NOT EXISTS idx_cp_emails_domain ON cyberpanel_emails(domain);
ALTER TABLE cyberpanel_emails ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on cyberpanel_emails" ON cyberpanel_emails;
CREATE POLICY "Allow all on cyberpanel_emails" ON cyberpanel_emails FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 6. SUBDOMÍNIOS
-- ============================================================
CREATE TABLE IF NOT EXISTS cyberpanel_subdomains (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  domain     TEXT NOT NULL,
  subdomain  TEXT NOT NULL,
  path       TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(domain, subdomain)
);
CREATE INDEX IF NOT EXISTS idx_cp_subs_domain ON cyberpanel_subdomains(domain);
ALTER TABLE cyberpanel_subdomains ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on cyberpanel_subdomains" ON cyberpanel_subdomains;
CREATE POLICY "Allow all on cyberpanel_subdomains" ON cyberpanel_subdomains FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 7. BASES DE DADOS
-- ============================================================
CREATE TABLE IF NOT EXISTS cyberpanel_databases (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  domain     TEXT NOT NULL,
  db_name    TEXT NOT NULL,
  db_user    TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(domain, db_name)
);
CREATE INDEX IF NOT EXISTS idx_cp_dbs_domain ON cyberpanel_databases(domain);
ALTER TABLE cyberpanel_databases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on cyberpanel_databases" ON cyberpanel_databases;
CREATE POLICY "Allow all on cyberpanel_databases" ON cyberpanel_databases FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 8. CONTAS FTP
-- ============================================================
CREATE TABLE IF NOT EXISTS cyberpanel_ftp (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  domain     TEXT NOT NULL,
  username   TEXT NOT NULL,
  path       TEXT DEFAULT '/',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(domain, username)
);
CREATE INDEX IF NOT EXISTS idx_cp_ftp_domain ON cyberpanel_ftp(domain);
ALTER TABLE cyberpanel_ftp ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on cyberpanel_ftp" ON cyberpanel_ftp;
CREATE POLICY "Allow all on cyberpanel_ftp" ON cyberpanel_ftp FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 9. REGISTOS DNS
-- ============================================================
CREATE TABLE IF NOT EXISTS cyberpanel_dns (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  domain     TEXT NOT NULL,
  name       TEXT NOT NULL,
  type       TEXT DEFAULT 'A',
  value      TEXT NOT NULL,
  ttl        TEXT DEFAULT '3600',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cp_dns_domain ON cyberpanel_dns(domain);
ALTER TABLE cyberpanel_dns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on cyberpanel_dns" ON cyberpanel_dns;
CREATE POLICY "Allow all on cyberpanel_dns" ON cyberpanel_dns FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 10. TRANSFERÊNCIAS DE DOMÍNIOS
-- ============================================================
CREATE TABLE IF NOT EXISTS domain_transfers (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  domain          TEXT NOT NULL,
  auth_code       TEXT DEFAULT '',
  status          TEXT DEFAULT 'pending',
  requested_by    TEXT DEFAULT '',
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE domain_transfers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on domain_transfers" ON domain_transfers;
CREATE POLICY "Allow all on domain_transfers" ON domain_transfers FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 11. NOTIFICAÇÕES
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type       TEXT NOT NULL,
  title      TEXT NOT NULL,
  message    TEXT DEFAULT '',
  domain     TEXT DEFAULT '',
  read       BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on notifications" ON notifications;
CREATE POLICY "Allow all on notifications" ON notifications FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- FIM — todas as tabelas criadas com sucesso
-- ============================================================
SELECT 'Setup concluído! Tabelas criadas: cyberpanel_sites, cyberpanel_users, cyberpanel_packages, subscriptions, cyberpanel_emails, cyberpanel_subdomains, cyberpanel_databases, cyberpanel_ftp, cyberpanel_dns, domain_transfers, notifications' AS resultado;
