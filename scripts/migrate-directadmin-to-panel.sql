-- Unificar tabelas legadas directadmin_* → panel_* (Supabase)
-- Executar no SQL Editor do Supabase

ALTER TABLE public.panel_users
  ADD COLUMN IF NOT EXISTS parent_username TEXT;

CREATE INDEX IF NOT EXISTS idx_panel_users_parent ON public.panel_users (parent_username);

-- Emails
INSERT INTO public.panel_emails (domain, email_user, quota, usage, created_at)
SELECT d.domain, d.email_user, COALESCE(d.quota, '500'), COALESCE(d.usage, '0'), COALESCE(d.created_at, NOW())
FROM public.directadmin_emails d
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'directadmin_emails')
ON CONFLICT (domain, email_user) DO UPDATE SET
  quota = EXCLUDED.quota,
  usage = EXCLUDED.usage;

-- Subdomínios
INSERT INTO public.panel_subdomains (domain, subdomain, path, created_at)
SELECT d.domain, d.subdomain, COALESCE(d.path, ''), COALESCE(d.created_at, NOW())
FROM public.directadmin_subdomains d
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'directadmin_subdomains')
ON CONFLICT (domain, subdomain) DO UPDATE SET path = EXCLUDED.path;

-- Bases de dados
INSERT INTO public.panel_databases (domain, db_name, db_user, created_at)
SELECT d.domain, d.db_name, COALESCE(d.db_user, d.db_name), COALESCE(d.created_at, NOW())
FROM public.directadmin_databases d
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'directadmin_databases')
ON CONFLICT (domain, db_name) DO UPDATE SET db_user = EXCLUDED.db_user;

-- FTP
INSERT INTO public.panel_ftp (domain, username, path, created_at)
SELECT d.domain, d.username, COALESCE(d.path, '/'), COALESCE(d.created_at, NOW())
FROM public.directadmin_ftp d
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'directadmin_ftp')
ON CONFLICT (domain, username) DO UPDATE SET path = EXCLUDED.path;

DROP TABLE IF EXISTS public.directadmin_emails CASCADE;
DROP TABLE IF EXISTS public.directadmin_subdomains CASCADE;
DROP TABLE IF EXISTS public.directadmin_databases CASCADE;
DROP TABLE IF EXISTS public.directadmin_ftp CASCADE;
