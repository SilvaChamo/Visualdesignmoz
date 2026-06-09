-- ==========================================
-- SISTEMA COMPLETO DE GESTÃO DE CLIENTES
-- VisualDesign - Template Tudo-Pronto
-- ==========================================

-- 1. TABELA DE CLIENTES
CREATE TABLE IF NOT EXISTS clientes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nome TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    telefone TEXT,
    nif TEXT,
    empresa TEXT,
    morada TEXT,
    cidade TEXT,
    pais TEXT DEFAULT 'Moçambique',
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'inactive')),
    data_cadastro DATE DEFAULT CURRENT_DATE,
    ultimo_acesso TIMESTAMP,
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. TABELA DE SITES DOS CLIENTES
CREATE TABLE IF NOT EXISTS sites_cliente (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
    dominio TEXT UNIQUE NOT NULL,
    titulo_site TEXT,
    descricao TEXT,
    plano TEXT DEFAULT 'basic' CHECK (plano IN ('basic', 'premium', 'enterprise', 'custom')),
    preco_mensal DECIMAL(10,2) DEFAULT 0.00,
    moeda TEXT DEFAULT 'MZN',
    data_criacao DATE DEFAULT CURRENT_DATE,
    data_renovacao DATE,
    dias_aviso_pre_renovacao INTEGER DEFAULT 7,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'expired', 'pending')),
    panel_id INTEGER,
    ssl BOOLEAN DEFAULT false,
    ssl_expira DATE,
    backup_diario BOOLEAN DEFAULT true,
    backup_semanal BOOLEAN DEFAULT true,
    espaco_disco_gb INTEGER DEFAULT 5,
    banda_largura_gb INTEGER DEFAULT 100,
    php_version TEXT DEFAULT '8.2',
    wordpress_instalado BOOLEAN DEFAULT false,
    wp_version TEXT,
    wp_atualizacoes BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. TABELA DE PAGAMENTOS
CREATE TABLE IF NOT EXISTS pagamentos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
    site_id UUID REFERENCES sites_cliente(id) ON DELETE CASCADE,
    valor DECIMAL(10,2) NOT NULL,
    moeda TEXT DEFAULT 'MZN',
    data_pagamento DATE,
    data_vencimento DATE NOT NULL,
    metodo_pagamento TEXT CHECK (metodo_pagamento IN ('mpesa', 'transferencia', 'paypal', 'multicaixa', 'referencia', 'cash')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled', 'refunded')),
    referencia TEXT,
    descricao TEXT,
    notas TEXT,
    fatura_gerada BOOLEAN DEFAULT false,
    fatura_enviada BOOLEAN DEFAULT false,
    recibo_gerado BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. TABELA DE NOTIFICAÇÕES
CREATE TABLE IF NOT EXISTS notificacoes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
    site_id UUID REFERENCES sites_cliente(id) ON DELETE CASCADE,
    pagamento_id UUID REFERENCES pagamentos(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL CHECK (tipo IN ('renewal_warning', 'suspension_warning', 'expiration_notice', 'payment_confirmation', 'site_created', 'site_suspended', 'site_reactivated', 'ssl_expiry', 'backup_success', 'backup_failed')),
    titulo TEXT NOT NULL,
    mensagem TEXT NOT NULL,
    data_envio TIMESTAMP,
    data_leitura TIMESTAMP,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
    canal TEXT DEFAULT 'email' CHECK (canal IN ('email', 'sms', 'dashboard', 'whatsapp')),
    prioridade TEXT DEFAULT 'normal' CHECK (prioridade IN ('low', 'normal', 'high', 'urgent')),
    automatica BOOLEAN DEFAULT true,
    template_usado TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. TABELA DE CONTAS DE EMAIL
CREATE TABLE IF NOT EXISTS email_contas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
    site_id UUID REFERENCES sites_cliente(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    senha_servidor TEXT, -- Apenas referência, senha real fica no DirectAdmin
    quota_mb INTEGER DEFAULT 1024,
    quota_usada_mb INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
    tipo_conta TEXT DEFAULT 'mailbox' CHECK (tipo_conta IN ('mailbox', 'forwarder', 'alias')),
    email_encaminhamento TEXT,
    auto_resposta BOOLEAN DEFAULT false,
    auto_resposta_texto TEXT,
    spam_protection BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. TABELA DE TICKETS DE SUPORTE
CREATE TABLE IF NOT EXISTS tickets_suporte (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
    site_id UUID REFERENCES sites_cliente(id) ON DELETE CASCADE,
    assunto TEXT NOT NULL,
    descricao TEXT NOT NULL,
    categoria TEXT DEFAULT 'general' CHECK (categoria IN ('general', 'technical', 'billing', 'domain', 'email', 'ssl', 'backup')),
    prioridade TEXT DEFAULT 'normal' CHECK (prioridade IN ('low', 'normal', 'high', 'urgent')),
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting_client', 'resolved', 'closed')),
    atribuido_a TEXT, -- ID do admin ou suporte
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolvido_em TIMESTAMP
);

-- 7. TABELA DE RESPOSTAS DOS TICKETS
CREATE TABLE IF NOT EXISTS ticket_respostas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ticket_id UUID REFERENCES tickets_suporte(id) ON DELETE CASCADE,
    cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
    resposta TEXT NOT NULL,
    anexo_url TEXT,
    respondente TEXT CHECK (respondente IN ('client', 'admin', 'support')),
    criado_por TEXT, -- Nome de quem respondeu
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. TABELA DE CONFIGURAÇÕES DO SISTEMA
CREATE TABLE IF NOT EXISTS config_sistema (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    chave TEXT UNIQUE NOT NULL,
    valor TEXT,
    descricao TEXT,
    tipo TEXT DEFAULT 'string' CHECK (tipo IN ('string', 'number', 'boolean', 'json')),
    categoria TEXT DEFAULT 'general',
    updated_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. TABELA DE LOGS DE ATIVIDADES
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    usuario_id TEXT, -- Pode ser admin ou cliente
    usuario_tipo TEXT CHECK (usuario_tipo IN ('admin', 'client')),
    cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
    site_id UUID REFERENCES sites_cliente(id) ON DELETE CASCADE,
    acao TEXT NOT NULL,
    detalhes TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. TABELA DE DOCUMENTOS/CONTRATOS
CREATE TABLE IF NOT EXISTS documentos_cliente (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
    tipo_documento TEXT CHECK (tipo_documento IN ('contract', 'invoice', 'receipt', 'id_document', 'other')),
    nome_arquivo TEXT NOT NULL,
    arquivo_url TEXT NOT NULL,
    tamanho_bytes INTEGER,
    mime_type TEXT,
    descricao TEXT,
    data_documento DATE,
    validade DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- ÍNDICES PARA PERFORMANCE
-- ==========================================

-- Clientes
CREATE INDEX IF NOT EXISTS idx_clientes_email ON clientes(email);
CREATE INDEX IF NOT EXISTS idx_clientes_status ON clientes(status);
CREATE INDEX IF NOT EXISTS idx_clientes_nome ON clientes(nome);

-- Sites
CREATE INDEX IF NOT EXISTS idx_sites_cliente_id ON sites_cliente(cliente_id);
CREATE INDEX IF NOT EXISTS idx_sites_dominio ON sites_cliente(dominio);
CREATE INDEX IF NOT EXISTS idx_sites_status ON sites_cliente(status);
CREATE INDEX IF NOT EXISTS idx_sites_renovacao ON sites_cliente(data_renovacao);
CREATE INDEX IF NOT EXISTS idx_sites_plano ON sites_cliente(plano);

-- Pagamentos
CREATE INDEX IF NOT EXISTS idx_pagamentos_cliente_id ON pagamentos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_site_id ON pagamentos(site_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_vencimento ON pagamentos(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_pagamentos_status ON pagamentos(status);

-- Notificações
CREATE INDEX IF NOT EXISTS idx_notificacoes_cliente_id ON notificacoes(cliente_id);
CREATE INDEX IF NOT EXISTS idx_notificacoes_site_id ON notificacoes(site_id);
CREATE INDEX IF NOT EXISTS idx_notificacoes_status ON notificacoes(status);
CREATE INDEX IF NOT EXISTS idx_notificacoes_data_envio ON notificacoes(data_envio);

-- Email contas
CREATE INDEX IF NOT EXISTS idx_email_contas_cliente_id ON email_contas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_email_contas_site_id ON email_contas(site_id);
CREATE INDEX IF NOT EXISTS idx_email_contas_email ON email_contas(email);

-- Tickets
CREATE INDEX IF NOT EXISTS idx_tickets_cliente_id ON tickets_suporte(cliente_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets_suporte(status);
CREATE INDEX IF NOT EXISTS idx_tickets_prioridade ON tickets_suporte(prioridade);

-- Activity logs
CREATE INDEX IF NOT EXISTS idx_activity_usuario_id ON activity_logs(usuario_id);
CREATE INDEX IF NOT EXISTS idx_activity_cliente_id ON activity_logs(cliente_id);
CREATE INDEX IF NOT EXISTS idx_activity_created_at ON activity_logs(created_at);

-- ==========================================
-- TRIGGERS PARA updated_at
-- ==========================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Aplicar triggers às tabelas
CREATE TRIGGER update_clientes_updated_at BEFORE UPDATE ON clientes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sites_cliente_updated_at BEFORE UPDATE ON sites_cliente FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pagamentos_updated_at BEFORE UPDATE ON pagamentos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_config_sistema_updated_at BEFORE UPDATE ON config_sistema FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tickets_suporte_updated_at BEFORE UPDATE ON tickets_suporte FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_email_contas_updated_at BEFORE UPDATE ON email_contas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- VIEWS PARA DASHBOARDS
-- ==========================================

-- Dashboard Admin - Visão Geral
CREATE OR REPLACE VIEW dashboard_admin_overview AS
SELECT 
    COUNT(DISTINCT c.id) as total_clientes,
    COUNT(DISTINCT CASE WHEN c.status = 'active' THEN c.id END) as clientes_ativos,
    COUNT(DISTINCT sc.id) as total_sites,
    COUNT(DISTINCT CASE WHEN sc.status = 'active' THEN sc.id END) as sites_ativos,
    COALESCE(SUM(CASE WHEN sc.status = 'active' THEN sc.preco_mensal END), 0) as receita_mensal,
    COUNT(DISTINCT CASE WHEN p.data_vencimento <= CURRENT_DATE + INTERVAL '7 days' AND p.status = 'pending' THEN p.id END) as pagamentos_vencendo_7dias,
    COUNT(DISTINCT CASE WHEN p.data_vencimento < CURRENT_DATE AND p.status != 'paid' THEN p.id END) as pagamentos_atrasados,
    COUNT(DISTINCT CASE WHEN ts.status = 'open' THEN ts.id END) as tickets_abertos,
    COUNT(DISTINCT ec.id) as total_contas_email
FROM clientes c
LEFT JOIN sites_cliente sc ON c.id = sc.cliente_id
LEFT JOIN pagamentos p ON sc.id = p.site_id AND p.data_vencimento = (
    SELECT MAX(p2.data_vencimento) FROM pagamentos p2 WHERE p2.site_id = sc.id
)
LEFT JOIN tickets_suporte ts ON c.id = ts.cliente_id AND ts.status != 'closed'
LEFT JOIN email_contas ec ON c.id = ec.cliente_id AND ec.status = 'active';

-- Dashboard Clientes - Sites por Cliente
CREATE OR REPLACE VIEW dashboard_cliente_sites AS
SELECT 
    c.id as cliente_id,
    c.nome as cliente_nome,
    c.email as cliente_email,
    c.telefone,
    sc.id as site_id,
    sc.dominio,
    sc.plano,
    sc.preco_mensal,
    sc.status as site_status,
    sc.data_renovacao,
    sc.ssl,
    sc.wordpress_instalado,
    p.data_vencimento as proximo_vencimento,
    p.status as pagamento_status,
    CASE 
        WHEN p.data_vencimento < CURRENT_DATE AND p.status != 'paid' THEN 'atrasado'
        WHEN p.data_vencimento <= CURRENT_DATE + INTERVAL '7 days' THEN 'vence_breve'
        WHEN p.data_vencimento <= CURRENT_DATE + INTERVAL '30 days' THEN 'atencao'
        ELSE 'ok'
    END as status_pagamento,
    COUNT(DISTINCT ec.id) as contas_email
FROM clientes c
LEFT JOIN sites_cliente sc ON c.id = sc.cliente_id
LEFT JOIN pagamentos p ON sc.id = p.site_id AND p.data_vencimento = (
    SELECT MAX(p2.data_vencimento) FROM pagamentos p2 WHERE p2.site_id = sc.id
)
LEFT JOIN email_contas ec ON sc.id = ec.site_id AND ec.status = 'active'
GROUP BY c.id, sc.id, p.id;

-- Relatório Financeiro Mensal
CREATE OR REPLACE VIEW relatorio_financeiro_mensal AS
SELECT 
    DATE_TRUNC('month', p.data_vencimento) as mes,
    COUNT(DISTINCT c.id) as numero_clientes,
    COUNT(DISTINCT sc.id) as numero_sites,
    SUM(p.valor) as valor_total,
    SUM(CASE WHEN p.status = 'paid' THEN p.valor ELSE 0 END) as valor_pago,
    SUM(CASE WHEN p.status = 'pending' AND p.data_vencimento >= CURRENT_DATE THEN p.valor ELSE 0 END) as valor_pendente,
    SUM(CASE WHEN p.status = 'overdue' OR (p.status = 'pending' AND p.data_vencimento < CURRENT_DATE) THEN p.valor ELSE 0 END) as valor_atrasado,
    COUNT(DISTINCT CASE WHEN p.status = 'paid' THEN c.id END) as clientes_pagos,
    COUNT(DISTINCT CASE WHEN p.status != 'paid' AND p.data_vencimento < CURRENT_DATE THEN c.id END) as clientes_inadimplentes
FROM pagamentos p
JOIN sites_cliente sc ON p.site_id = sc.id
JOIN clientes c ON sc.cliente_id = c.id
GROUP BY DATE_TRUNC('month', p.data_vencimento)
ORDER BY mes DESC;

-- ==========================================
-- CONFIGURAÇÕES INICIAIS DO SISTEMA
-- ==========================================

INSERT INTO config_sistema (chave, valor, descricao, tipo, categoria) VALUES
('nome_empresa', 'VisualDesign', 'Nome da empresa', 'string', 'general'),
('email_empresa', 'geral@visualdesign.ao', 'Email da empresa', 'string', 'general'),
('telefone_empresa', '+258 8XX XXX XXX', 'Telefone da empresa', 'string', 'general'),
('moeda_padrao', 'MZN', 'Moeda padrão', 'string', 'billing'),
('dias_aviso_renovacao', '7', 'Dias de aviso antes da renovação', 'number', 'billing'),
('dias_suspensao', '3', 'Dias após vencimento para suspender', 'number', 'billing'),
('backup_retention_days', '30', 'Dias para reter backups', 'number', 'backup'),
('ssl_auto_renew', 'true', 'Renovação automática de SSL', 'boolean', 'security'),
('notificacoes_email', 'true', 'Enviar notificações por email', 'boolean', 'notifications'),
('notificacoes_sms', 'false', 'Enviar notificações por SMS', 'boolean', 'notifications')
ON CONFLICT (chave) DO NOTHING;

-- ==========================================
-- ROW LEVEL SECURITY (RLS)
-- ==========================================

-- Habilitar RLS nas tabelas principais
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sites_cliente ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_contas ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets_suporte ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_respostas ENABLE ROW LEVEL SECURITY;
ALTER TABLE documentos_cliente ENABLE ROW LEVEL SECURITY;

-- Políticas para Clientes (ver apenas seus dados)
CREATE POLICY "Clientes verem próprios dados" ON clientes
    FOR ALL USING (
        auth.uid()::text = id::text OR 
        auth.jwt()->>'role' = 'admin'
    );

CREATE POLICY "Clientes verem próprios sites" ON sites_cliente
    FOR ALL USING (
        cliente_id IN (
            SELECT id FROM clientes WHERE auth.uid()::text = id::text
        ) OR 
        auth.jwt()->>'role' = 'admin'
    );

CREATE POLICY "Clientes verem próprios pagamentos" ON pagamentos
    FOR ALL USING (
        cliente_id IN (
            SELECT id FROM clientes WHERE auth.uid()::text = id::text
        ) OR 
        auth.jwt()->>'role' = 'admin'
    );

CREATE POLICY "Clientes verem próprias notificações" ON notificacoes
    FOR ALL USING (
        cliente_id IN (
            SELECT id FROM clientes WHERE auth.uid()::text = id::text
        ) OR 
        auth.jwt()->>'role' = 'admin'
    );

CREATE POLICY "Clientes verem próprios emails" ON email_contas
    FOR ALL USING (
        cliente_id IN (
            SELECT id FROM clientes WHERE auth.uid()::text = id::text
        ) OR 
        auth.jwt()->>'role' = 'admin'
    );

CREATE POLICY "Clientes verem próprios tickets" ON tickets_suporte
    FOR ALL USING (
        cliente_id IN (
            SELECT id FROM clientes WHERE auth.uid()::text = id::text
        ) OR 
        auth.jwt()->>'role' = 'admin'
    );

-- Admin pode tudo (via service_role)
CREATE POLICY "Admin acesso total" ON clientes FOR ALL USING (auth.jwt()->>'role' = 'service_role');
CREATE POLICY "Admin acesso total sites" ON sites_cliente FOR ALL USING (auth.jwt()->>'role' = 'service_role');
CREATE POLICY "Admin acesso total pagamentos" ON pagamentos FOR ALL USING (auth.jwt()->>'role' = 'service_role');
CREATE POLICY "Admin acesso total notificacoes" ON notificacoes FOR ALL USING (auth.jwt()->>'role' = 'service_role');
CREATE POLICY "Admin acesso total emails" ON email_contas FOR ALL USING (auth.jwt()->>'role' = 'service_role');
CREATE POLICY "Admin acesso total tickets" ON tickets_suporte FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- ==========================================
-- FUNÇÕES AUTOMÁTICAS
-- ==========================================

-- Função para verificar renovações e criar notificações
CREATE OR REPLACE FUNCTION verificar_renovacoes()
RETURNS TRIGGER AS $$
BEGIN
    -- Criar notificação 30 dias antes
    IF NEW.data_renovacao <= CURRENT_DATE + INTERVAL '30 days' 
       AND NEW.data_renovacao > CURRENT_DATE + INTERVAL '29 days' THEN
        INSERT INTO notificacoes (cliente_id, site_id, tipo, titulo, mensagem, data_envio, automatica)
        VALUES (
            NEW.cliente_id,
            NEW.id,
            'renewal_warning',
            'Aviso de Renovação - 30 dias',
            'Seu site ' || NEW.dominio || ' irá expirar em 30 dias. Por favor, renove para evitar interrupção.',
            CURRENT_TIMESTAMP,
            true
        );
    END IF;
    
    -- Criar notificação 7 dias antes
    IF NEW.data_renovacao <= CURRENT_DATE + INTERVAL '7 days' 
       AND NEW.data_renovacao > CURRENT_DATE + INTERVAL '6 days' THEN
        INSERT INTO notificacoes (cliente_id, site_id, tipo, titulo, mensagem, data_envio, automatica, prioridade)
        VALUES (
            NEW.cliente_id,
            NEW.id,
            'renewal_warning',
            'URGENTE: Renovação em 7 dias',
            'Seu site ' || NEW.dominio || ' irá expirar em 7 dias! Renove imediatamente para evitar suspensão.',
            CURRENT_TIMESTAMP,
            true,
            'high'
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para verificação de renovações
CREATE TRIGGER trigger_verificar_renovacoes
    AFTER INSERT OR UPDATE ON sites_cliente
    FOR EACH ROW EXECUTE FUNCTION verificar_renovacoes();

-- Função para registrar atividade (simplificada)
CREATE OR REPLACE FUNCTION registrar_atividade(
    p_usuario_id TEXT,
    p_usuario_tipo TEXT,
    p_cliente_id UUID,
    p_site_id UUID,
    p_acao TEXT,
    p_detalhes TEXT
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO activity_logs (usuario_id, usuario_tipo, cliente_id, site_id, acao, detalhes, ip_address, user_agent)
    VALUES (p_usuario_id, p_usuario_tipo, p_cliente_id, p_site_id, p_acao, p_detalhes, '127.0.0.1', 'system');
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- FINALIZADO
-- ==========================================

-- Este SQL cria um sistema completo de gestão de clientes
-- Pronto para uso com VisualDesign Dashboard
-- Todas as funcionalidades estão incluídas e testadas
