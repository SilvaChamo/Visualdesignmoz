-- ============================================================
-- MIGRAÇÃO: Adicionar colunas synced_at e emails_limit
-- Execute no Supabase SQL Editor
-- ============================================================

-- 1. Adicionar synced_at à tabela panel_packages (se não existir)
ALTER TABLE panel_packages 
ADD COLUMN IF NOT EXISTS synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 2. Adicionar emails_limit à tabela panel_users (se não existir)
ALTER TABLE panel_users 
ADD COLUMN IF NOT EXISTS emails_limit INTEGER DEFAULT 0;

-- 3. Garantir que synced_at existe em panel_users
ALTER TABLE panel_users 
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
  table_name IN ('panel_packages', 'panel_users')
  AND column_name IN ('synced_at', 'emails_limit')
ORDER BY 
  table_name, 
  column_name;
