-- ============================================================
-- FIX: Tabela tickets_suporte e Storage
-- Executar no Supabase SQL Editor
-- ============================================================

-- 1. Adicionar coluna anexo_url
ALTER TABLE public.tickets_suporte 
ADD COLUMN IF NOT EXISTS anexo_url TEXT;

-- 2. Garantir que as restrições de categoria e prioridade permitem os novos valores (se necessário)
-- A tabela original já permite:
-- categorias: 'general', 'technical', 'billing', 'domain', 'email', 'ssl', 'backup'
-- prioridades: 'low', 'normal', 'high', 'urgent'

-- 3. NOTA: Deve criar o bucket 'ticket-attachments' manualmente no Supabase Dashboard
-- Vá a Storage -> New Bucket -> Nome: 'ticket-attachments' -> Público (ou configurar RLS)
