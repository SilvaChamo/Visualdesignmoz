-- ============================================
-- SQL para criar tabela email_contas no Supabase
-- Execute no SQL Editor do Supabase
-- ============================================

-- Criar tabela email_contas
CREATE TABLE IF NOT EXISTS email_contas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    senha_cyberpanel TEXT,
    tipo_conta VARCHAR(50) DEFAULT 'webmail',
    status VARCHAR(50) DEFAULT 'active',
    cliente_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_email_contas_email ON email_contas(email);
CREATE INDEX IF NOT EXISTS idx_email_contas_cliente_id ON email_contas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_email_contas_status ON email_contas(status);

-- Habilitar Row Level Security (RLS)
ALTER TABLE email_contas ENABLE ROW LEVEL SECURITY;

-- Política: Administradores podem ver todas as contas
CREATE POLICY "Admins podem ver todas as contas" ON email_contas
    FOR SELECT
    TO authenticated
    USING (
        auth.email() IN ('silva.chamo@gmail.com', 'geral@visualdesignmoz.com', 'suporte@visualdesignmoz.com', 'admin@visualdesignmoz.com')
    );

-- Política: Usuários podem ver apenas suas próprias contas
CREATE POLICY "Usuários veem suas próprias contas" ON email_contas
    FOR SELECT
    TO authenticated
    USING (cliente_id = auth.uid());

-- Política: Administradores podem criar contas
CREATE POLICY "Admins podem criar contas" ON email_contas
    FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.email() IN ('silva.chamo@gmail.com', 'geral@visualdesignmoz.com', 'suporte@visualdesignmoz.com', 'admin@visualdesignmoz.com')
    );

-- Política: Administradores podem atualizar contas
CREATE POLICY "Admins podem atualizar contas" ON email_contas
    FOR UPDATE
    TO authenticated
    USING (
        auth.email() IN ('silva.chamo@gmail.com', 'geral@visualdesignmoz.com', 'suporte@visualdesignmoz.com', 'admin@visualdesignmoz.com')
    );

-- Política: Administradores podem eliminar contas
CREATE POLICY "Admins podem eliminar contas" ON email_contas
    FOR DELETE
    TO authenticated
    USING (
        auth.email() IN ('silva.chamo@gmail.com', 'geral@visualdesignmoz.com', 'suporte@visualdesignmoz.com', 'admin@visualdesignmoz.com')
    );

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Remover trigger se existir (para evitar erro)
DROP TRIGGER IF EXISTS update_email_contas_updated_at ON email_contas;

-- Criar trigger
CREATE TRIGGER update_email_contas_updated_at
    BEFORE UPDATE ON email_contas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Inserir emails padrão do sistema (opcional)
-- ============================================

-- Nota: Execute estes INSERTs manualmente se quiser pre-popular
-- As senhas devem ser encriptadas em base64

-- INSERT INTO email_contas (email, senha_cyberpanel, tipo_conta, status) VALUES
-- ('geral@visualdesignmoz.com', 'R2UuVmQjMjQyNT8q', 'webmail', 'active'),
-- ('admin@visualdesignmoz.com', 'RW1haWxBZG1pbiMyNDI1', 'webmail', 'active'),
-- ('suporte@visualdesignmoz.com', 'U3VwYUVtYWlsIzIwMjY/Kg==', 'webmail', 'active'),
-- ('info@visualdesignmoz.com', 'SW5mb3JtYcOnw6NvISMjMjAyMD8q', 'webmail', 'active')
-- ON CONFLICT (email) DO UPDATE SET
--     senha_cyberpanel = EXCLUDED.senha_cyberpanel,
--     updated_at = NOW();

-- ============================================
-- Verificar se a tabela foi criada
-- ============================================
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'email_contas' 
ORDER BY ordinal_position;
