-- Ligação automática Visual Design ↔ DirectAdmin por revendedor
-- Executar UMA VEZ no Supabase SQL Editor (ou via Admin → supabase-init se exec_sql existir)
-- Também corre automaticamente em /api/supabase-init e no primeiro auto-provisionamento

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
