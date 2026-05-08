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

-- Criar utilizadores admin com roles
INSERT INTO auth.users (
  id,
  email,
  email_confirmed_at,
  phone,
  phone_confirmed_at,
  last_sign_in_at,
  raw_user_meta_data,
  is_super_admin,
  created_at,
  updated_at,
  name
) VALUES 
(
  gen_random_uuid(),
  'silva.chamo@gmail.com',
  NOW(),
  NULL,
  NULL,
  NOW(),
  '{"role": "admin", "name": "Silva Chamo"}',
  false,
  NOW(),
  NOW(),
  'Silva Chamo'
),
(
  gen_random_uuid(), 
  'admin@visualdesignmoz.com',
  NOW(),
  NULL,
  NULL,
  NOW(),
  '{"role": "admin", "name": "VisualDesign Admin"}',
  false,
  NOW(),
  NOW(),
  'VisualDesign Admin'
) ON CONFLICT (email) DO UPDATE SET
  email_confirmed_at = NOW(),
  raw_user_meta_data = EXCLUDED.raw_user_meta_data,
  updated_at = NOW();

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
