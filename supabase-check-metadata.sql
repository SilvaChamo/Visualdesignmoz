-- Script para verificar metadados dos utilizadores admin
-- Execute para ver exatamente o que está nos metadados

SELECT 
  u.id,
  u.email,
  u.email_confirmed_at,
  u.raw_user_meta_data,
  u.created_at,
  u.updated_at,
  -- Verificar se o metadado contém 'role'
  CASE 
    WHEN u.raw_user_meta_data IS NOT NULL THEN 
      (u.raw_user_meta_data->>'role')
    ELSE NULL
  END as extracted_role,
  -- Verificar se o metadado é válido JSON
  CASE 
    WHEN u.raw_user_meta_data IS NOT NULL AND 
         jsonb_typeof(u.raw_user_meta_data) = 'object' THEN 'Valid JSON'
    ELSE 'Invalid or NULL'
  END as metadata_status
FROM auth.users u
WHERE u.email IN ('silva.chamo@gmail.com', 'admin@visualdesignmoz.com');

-- Verificar também na tabela profiles
SELECT 
  p.id,
  p.user_id,
  p.email,
  p.role,
  p.name,
  p.created_at,
  p.updated_at
FROM public.profiles p
WHERE p.email IN ('silva.chamo@gmail.com', 'admin@visualdesignmoz.com');

-- Se os metadados estiverem incorretos, corrigir:
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
