-- Script para verificar se a sessão está a ser corretamente inicializada
-- Execute para ver o estado atual dos utilizadores

-- Verificar estado dos utilizadores admin
SELECT 
  u.id,
  u.email,
  u.email_confirmed_at,
  u.last_sign_in_at,
  u.created_at,
  u.updated_at,
  u.raw_user_meta_data,
  -- Verificar se o metadado contém 'role'
  (u.raw_user_meta_data->>'role') as extracted_role,
  -- Verificar se o metadado é válido JSON
  jsonb_typeof(u.raw_user_meta_data) as metadata_type
FROM auth.users u
WHERE u.email IN ('silva.chamo@gmail.com', 'admin@visualdesignmoz.com');

-- Verificar se existem sessões ativas (se possível)
SELECT 
  *
FROM auth.sessions
WHERE user_id IN (
  SELECT id 
  FROM auth.users 
  WHERE email IN ('silva.chamo@gmail.com', 'admin@visualdesignmoz.com')
)
ORDER BY created_at DESC
LIMIT 5;

-- Verificar tabela profiles
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

-- Se os utilizadores existirem mas não tiverem sessões ativas,
-- pode ser necessário forçar refresh token ou fazer login novamente
