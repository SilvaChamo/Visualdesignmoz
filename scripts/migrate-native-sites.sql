-- Contas de hospedagem "nativas" — criadas diretamente no servidor (Apache +
-- utilizador Linux + Let's Encrypt), sem passar pela DirectAdmin.
-- Isto existe para não ficarmos limitados às 2 contas da licença DA atual.
-- Cada linha = um domínio com o seu próprio utilizador Linux isolado.

CREATE TABLE IF NOT EXISTS native_sites (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  domain            TEXT UNIQUE NOT NULL,
  linux_username    TEXT UNIQUE NOT NULL,
  doc_root          TEXT NOT NULL,
  status            TEXT DEFAULT 'active',   -- active | suspended
  ssl_enabled       BOOLEAN DEFAULT false,
  php_version       TEXT DEFAULT '8.2',
  package_id        TEXT DEFAULT 'hosting-basico',   -- hosting-basico | hosting-pro | hosting-business | hosting-enterprise
  quota_mb          INTEGER DEFAULT 10000,             -- limite de disco do pacote, em MB
  quota_enforced    BOOLEAN DEFAULT false,              -- true só se o servidor conseguiu mesmo bloquear (quota real do Linux)
  owner_auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  owner_email       TEXT DEFAULT '',
  notes             TEXT DEFAULT '',
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Caso a tabela já exista de uma execução anterior deste script (sem as
-- colunas de pacote), acrescenta-as sem apagar nada do que já lá está.
ALTER TABLE native_sites ADD COLUMN IF NOT EXISTS package_id TEXT DEFAULT 'hosting-basico';
ALTER TABLE native_sites ADD COLUMN IF NOT EXISTS quota_mb INTEGER DEFAULT 10000;
ALTER TABLE native_sites ADD COLUMN IF NOT EXISTS quota_enforced BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_native_sites_domain ON native_sites(domain);
CREATE INDEX IF NOT EXISTS idx_native_sites_owner ON native_sites(owner_auth_user_id);

ALTER TABLE native_sites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on native_sites" ON native_sites;
CREATE POLICY "Allow all on native_sites" ON native_sites FOR ALL USING (true) WITH CHECK (true);

-- Marca, na tabela dos utilizadores do painel, se a conta é da DA ou nativa.
-- Não obrigatório para o motor nativo funcionar (ele usa native_sites acima),
-- mas ajuda a ter uma visão unificada mais tarde.
ALTER TABLE panel_users ADD COLUMN IF NOT EXISTS hosting_provider TEXT DEFAULT 'directadmin';
