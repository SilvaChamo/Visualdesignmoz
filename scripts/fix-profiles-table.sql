-- ============================================================
-- FIX: Tabela profiles - Adicionar colunas em falta
-- Executar no Supabase SQL Editor
-- ============================================================

-- 1. Adicionar colunas em falta
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS nome TEXT,
ADD COLUMN IF NOT EXISTS telefone TEXT,
ADD COLUMN IF NOT EXISTS empresa TEXT,
ADD COLUMN IF NOT EXISTS morada TEXT,
ADD COLUMN IF NOT EXISTS cidade TEXT;

-- 2. Migrar dados existentes (name → nome)
UPDATE public.profiles SET nome = name WHERE nome IS NULL AND name IS NOT NULL;

-- 3. Garantir RLS está activo
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4. Criar política para utilizadores gerirem o próprio perfil
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- 5. Verificar resultado
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'profiles' 
ORDER BY ordinal_position;
