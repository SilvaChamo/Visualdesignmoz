-- ============================================================
-- MIGRAÇÃO: Adicionar colunas synced_at e emails_limit
-- Execute no Supabase SQL Editor
-- ============================================================

-- 1. Adicionar synced_at à tabela cyberpanel_packages (se não existir)
ALTER TABLE cyberpanel_packages 
ADD COLUMN IF NOT EXISTS synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 2. Adicionar emails_limit à tabela cyberpanel_users (se não existir)
ALTER TABLE cyberpanel_users 
ADD COLUMN IF NOT EXISTS emails_limit INTEGER DEFAULT 0;

-- 3. Garantir que synced_at existe em cyberpanel_users
ALTER TABLE cyberpanel_users 
ADD COLUMN IF NOT EXISTS synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Verificar se as colunas foram adicionadas
SELECT 
  table_name,
  column_name, 
  data_type,
  column_default
FROM 
  information_schema.columns 
WHERE 
  table_name IN ('cyberpanel_packages', 'cyberpanel_users')
  AND column_name IN ('synced_at', 'emails_limit')
ORDER BY 
  table_name, 
  column_name;
