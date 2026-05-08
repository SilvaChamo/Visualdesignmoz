-- Script simples para criar utilizadores admin via signup
-- Execute este script se os utilizadores ainda não existem

-- NOTA: Este script usa a função auth.signup para criar os utilizadores
-- Pode ser necessário executar com permissões de administrador

-- Criar utilizador silva.chamo@gmail.com
SELECT auth.sign_up(
  'silva.chamo@gmail.com',
  'Admin123!', -- senha temporária - alterar depois
  '{"role": "admin", "name": "Silva Chamo"}'
);

-- Criar utilizador admin@visualdesignmoz.com
SELECT auth.sign_up(
  'admin@visualdesignmoz.com',
  'Admin123!', -- senha temporária - alterar depois
  '{"role": "admin", "name": "VisualDesign Admin"}'
);

-- Confirmar emails automaticamente (se tiver permissões)
UPDATE auth.users 
SET email_confirmed_at = NOW()
WHERE email IN ('silva.chamo@gmail.com', 'admin@visualdesignmoz.com');

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

-- Inserir perfis
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

-- Verificação final
SELECT 
  u.email,
  u.raw_user_meta_data,
  p.role as profile_role
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.user_id
WHERE u.email IN ('silva.chamo@gmail.com', 'admin@visualdesignmoz.com');
