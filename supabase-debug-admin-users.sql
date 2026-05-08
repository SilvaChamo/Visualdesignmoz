-- Script para verificar e corrigir utilizadores admin
-- Execute este script para diagnosticar o problema

-- 1. Verificar se os utilizadores existem
SELECT 
  id,
  email,
  email_confirmed_at,
  raw_user_meta_data,
  created_at
FROM auth.users 
WHERE email IN ('silva.chamo@gmail.com', 'admin@visualdesignmoz.com');

-- 2. Verificar se a tabela profiles existe e tem dados
SELECT 
  p.id,
  p.user_id,
  p.email,
  p.role,
  p.name,
  u.email as user_email
FROM public.profiles p
LEFT JOIN auth.users u ON p.user_id = u.id
WHERE u.email IN ('silva.chamo@gmail.com', 'admin@visualdesignmoz.com');

-- 3. Se os utilizadores não existirem, criar manualmente
-- NOTA: Isto só funciona se tiver permissões para inserir na auth.users

-- 4. Se os utilizadores existirem mas sem metadados corretos:
UPDATE auth.users 
SET 
  raw_user_meta_data = '{"role": "admin", "name": "Silva Chamo"}',
  updated_at = NOW()
WHERE email = 'silva.chamo@gmail.com';

UPDATE auth.users 
SET 
  raw_user_meta_data = '{"role": "admin", "name": "VisualDesign Admin"}',
  updated_at = NOW()
WHERE email = 'admin@visualdesignmoz.com';

-- 5. Garantir que a tabela profiles existe
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  role TEXT DEFAULT 'client',
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Inserir/Atualizar perfis
INSERT INTO public.profiles (
  id,
  user_id,
  email,
  role,
  name,
  created_at,
  updated_at
)
SELECT 
  gen_random_uuid(),
  u.id,
  u.email,
  'admin',
  COALESCE(u.raw_user_meta_data->>'name', u.email),
  NOW(),
  NOW()
FROM auth.users u
WHERE u.email IN ('silva.chamo@gmail.com', 'admin@visualdesignmoz.com')
ON CONFLICT (email) DO UPDATE SET
  role = EXCLUDED.role,
  name = EXCLUDED.name,
  updated_at = NOW();

-- 7. Verificação final
SELECT 
  u.email,
  u.raw_user_meta_data,
  p.role as profile_role,
  p.name as profile_name
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.user_id
WHERE u.email IN ('silva.chamo@gmail.com', 'admin@visualdesignmoz.com');
