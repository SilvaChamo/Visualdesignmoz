-- =====================================================================================
-- CRITICAL SECURITY FIX: RLS Policies
--
-- Este script corrige as políticas de Row Level Security (RLS) para garantir
-- que os utilizadores só podem aceder aos seus próprios dados.
-- A política anterior 'USING (true)' permitia que qualquer utilizador visse os dados de todos.
--
-- COMO APLICAR:
-- Execute este script no SQL Editor do seu projeto Supabase ou através de uma
-- conexão direta à base de dados (e.g., usando psql).
-- =====================================================================================

-- -----------------------------------------------------
-- Tabela: panel_auth_accounts
-- Fix: Limita o acesso ao registo do próprio utilizador.
-- -----------------------------------------------------
-- 1. Remove a política insegura
DROP POLICY IF EXISTS "Allow all on panel_auth_accounts" ON public.panel_auth_accounts;

-- 2. Permite que os utilizadores vejam a sua própria conta de autenticação.
CREATE POLICY "Users can view their own auth account" ON public.panel_auth_accounts
  FOR SELECT USING (auth.uid() = user_id);

-- 3. Permite que o 'service_role' (backend) gira todos os registos.
CREATE POLICY "Service role can manage all auth accounts" ON public.panel_auth_accounts
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');


-- -----------------------------------------------------
-- Tabela: panel_backup_files
-- Fix: Permite acesso apenas a backups cujo 'owner' (DA username) corresponde ao utilizador.
-- -----------------------------------------------------
-- 1. Remove a política insegura
DROP POLICY IF EXISTS "Allow all on panel_backup_files" ON public.panel_backup_files;

-- 2. Permite que utilizadores vejam/giram os seus próprios ficheiros de backup.
--    Isto é feito comparando o 'owner' do backup com o 'da_username' do utilizador autenticado.
CREATE POLICY "Users can manage their own backup files" ON public.panel_backup_files
  FOR ALL USING (owner = (SELECT da_username FROM public.panel_auth_accounts WHERE user_id = auth.uid()))
  WITH CHECK (owner = (SELECT da_username FROM public.panel_auth_accounts WHERE user_id = auth.uid()));

-- 3. Permite que o 'service_role' (backend) gira todos os registos.
CREATE POLICY "Service role can manage all backup files" ON public.panel_backup_files
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');


-- -----------------------------------------------------
-- Tabela: panel_backup_schedules
-- Fix: Permite acesso apenas a agendamentos cujo 'owner' (DA username) corresponde ao utilizador.
-- -----------------------------------------------------
-- 1. Remove a política insegura
DROP POLICY IF EXISTS "Allow all on panel_backup_schedules" ON public.panel_backup_schedules;

-- 2. Permite que utilizadores vejam/giram os seus próprios agendamentos de backup.
CREATE POLICY "Users can manage their own backup schedules" ON public.panel_backup_schedules
  FOR ALL USING (owner = (SELECT da_username FROM public.panel_auth_accounts WHERE user_id = auth.uid()))
  WITH CHECK (owner = (SELECT da_username FROM public.panel_auth_accounts WHERE user_id = auth.uid()));

-- 3. Permite que o 'service_role' (backend) gira todos os registos.
CREATE POLICY "Service role can manage all backup schedules" ON public.panel_backup_schedules
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- =====================================================================================
-- FIM DO SCRIPT DE CORREÇÃO
-- =====================================================================================
