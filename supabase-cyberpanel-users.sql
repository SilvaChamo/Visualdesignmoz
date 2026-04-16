-- Tabela para sincronizar utilizadores do CyberPanel com Supabase
CREATE TABLE IF NOT EXISTS cyberpanel_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  acl TEXT DEFAULT 'user',
  websites_limit INTEGER DEFAULT 0,
  emails_limit INTEGER DEFAULT 0,
  status TEXT DEFAULT 'Active',
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trigger para updated_at
CREATE TRIGGER update_cyberpanel_users_updated_at BEFORE UPDATE ON cyberpanel_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Índices
CREATE INDEX idx_cyberpanel_users_username ON cyberpanel_users(username);

-- RLS
ALTER TABLE cyberpanel_users ENABLE ROW LEVEL SECURITY;

-- Permitir todas as operações (admin panel usa anon key)
CREATE POLICY "Allow all operations on cyberpanel_users" ON cyberpanel_users
  FOR ALL USING (true) WITH CHECK (true);
