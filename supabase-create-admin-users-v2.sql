-- Criar utilizadores admin com método alternativo (via signup)
-- NOTA: Este script deve ser executado após criar as contas manualmente via Supabase Auth

-- 1. Primeiro, criar as contas via Supabase Dashboard → Authentication → Users → "Add user"
--    Email: silva.chamo@gmail.com, Password: (definir)
--    Email: admin@visualdesignmoz.com, Password: (definir)

-- 2. Depois, executar este SQL para atualizar os metadados e criar perfis

-- Atualizar metadados do utilizador silva.chamo@gmail.com
UPDATE auth.users 
SET 
  raw_user_meta_data = '{"role": "admin", "name": "Silva Chamo"}',
  updated_at = NOW()
WHERE email = 'silva.chamo@gmail.com';

-- Atualizar metadados do utilizador admin@visualdesignmoz.com  
UPDATE auth.users 
SET 
  raw_user_meta_data = '{"role": "admin", "name": "VisualDesign Admin"}',
  updated_at = NOW()
WHERE email = 'admin@visualdesignmoz.com';

-- Criar tabela profiles se não existir
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  role TEXT DEFAULT 'client',
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar perfis correspondentes
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
  u.id,
  u.id,
  u.email,
  (u.raw_user_meta_data->>'role')::text,
  (u.raw_user_meta_data->>'name')::text,
  u.created_at,
  u.updated_at
FROM auth.users u
WHERE u.email IN ('silva.chamo@gmail.com', 'admin@visualdesignmoz.com')
ON CONFLICT (email) DO UPDATE SET
  role = EXCLUDED.role,
  name = EXCLUDED.name,
  updated_at = NOW();

-- Verificar resultados
SELECT 
  u.email,
  u.raw_user_meta_data,
  p.role,
  p.name
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.user_id
WHERE u.email IN ('silva.chamo@gmail.com', 'admin@visualdesignmoz.com');
