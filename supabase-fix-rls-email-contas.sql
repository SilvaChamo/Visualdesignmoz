-- ==========================================
-- CORREÇÃO RLS: Permitir inserções no email_contas
-- Execute no SQL Editor do Supabase
-- ==========================================

-- Remover políticas antigas que podem estar conflitando
DROP POLICY IF EXISTS "Clientes verem próprios emails" ON email_contas;
DROP POLICY IF EXISTS "Admin acesso total emails" ON email_contas;

-- Política 1: Usuários autenticados podem ver seus próprios emails
CREATE POLICY "Users view own emails" ON email_contas
    FOR SELECT
    USING (
        auth.uid()::text = cliente_id::text 
        OR 
        auth.jwt()->>'role' = 'admin'
        OR
        auth.jwt()->>'role' = 'service_role'
    );

-- Política 2: Usuários autenticados podem inserir seus próprios emails
CREATE POLICY "Users insert own emails" ON email_contas
    FOR INSERT
    WITH CHECK (
        auth.uid()::text = cliente_id::text 
        OR 
        auth.jwt()->>'role' = 'admin'
        OR
        auth.jwt()->>'role' = 'service_role'
    );

-- Política 3: Usuários autenticados podem atualizar seus próprios emails
CREATE POLICY "Users update own emails" ON email_contas
    FOR UPDATE
    USING (
        auth.uid()::text = cliente_id::text 
        OR 
        auth.jwt()->>'role' = 'admin'
        OR
        auth.jwt()->>'role' = 'service_role'
    )
    WITH CHECK (
        auth.uid()::text = cliente_id::text 
        OR 
        auth.jwt()->>'role' = 'admin'
        OR
        auth.jwt()->>'role' = 'service_role'
    );

-- Política 4: Admin/service_role pode tudo
CREATE POLICY "Admin full access" ON email_contas
    FOR ALL
    USING (auth.jwt()->>'role' = 'service_role')
    WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- ==========================================
-- VERIFICAÇÃO
-- ==========================================
SELECT * FROM pg_policies WHERE tablename = 'email_contas';
