-- Contas de acesso ao painel (Auth) — independentes do espelho do servidor.
-- Permite reconhecer utilizadores mesmo quando o DirectAdmin está indisponível.

CREATE TABLE IF NOT EXISTS public.panel_auth_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'reseller', 'client', 'guest')),
  name TEXT,
  panel_slug TEXT NOT NULL DEFAULT 'visualdesign',
  server_linked BOOLEAN NOT NULL DEFAULT false,
  da_username TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (panel_slug, email)
);

CREATE INDEX IF NOT EXISTS idx_panel_auth_accounts_slug ON public.panel_auth_accounts (panel_slug);
CREATE INDEX IF NOT EXISTS idx_panel_auth_accounts_role ON public.panel_auth_accounts (role);
CREATE INDEX IF NOT EXISTS idx_panel_auth_accounts_email ON public.panel_auth_accounts (email);

ALTER TABLE public.panel_auth_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on panel_auth_accounts" ON public.panel_auth_accounts;
CREATE POLICY "Allow all on panel_auth_accounts" ON public.panel_auth_accounts FOR ALL USING (true) WITH CHECK (true);
