-- ============================================
-- TABELA DE TEMPLATES DE RENOVAÇÃO
-- Persistência permanente no servidor
-- ============================================

-- Criar tabela admin_users se não existir (necessária para RLS)
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'admin',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS na tabela admin_users
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Política para usuários autenticados do domínio visualdesigne.com
CREATE POLICY "Admins can manage admin_users"
    ON admin_users
    FOR ALL
    TO authenticated
    USING (auth.jwt() ->> 'email' LIKE '%@visualdesigne.com')
    WITH CHECK (auth.jwt() ->> 'email' LIKE '%@visualdesigne.com');

-- Criar tabela de templates de renovação
CREATE TABLE IF NOT EXISTS renewal_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id VARCHAR(50) UNIQUE NOT NULL, -- ex: 'renewal-60-days'
    name VARCHAR(255) NOT NULL,
    days_before INTEGER NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    email_subject TEXT NOT NULL,
    email_body TEXT NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'info', -- 'info' | 'warning' | 'error' | 'success'
    urgency VARCHAR(20) NOT NULL DEFAULT 'low', -- 'low' | 'medium' | 'high' | 'critical'
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE renewal_templates ENABLE ROW LEVEL SECURITY;

-- Política para admins poderem gerenciar templates (baseada em email do domínio visualdesigne.com)
-- Substitua 'seu-email@visualdesigne.com' pelo email do admin real
CREATE POLICY "Admins can manage renewal templates"
    ON renewal_templates
    FOR ALL
    TO authenticated
    USING (
        auth.jwt() ->> 'email' LIKE '%@visualdesigne.com' OR
        auth.uid() IN (SELECT id FROM admin_users)
    )
    WITH CHECK (
        auth.jwt() ->> 'email' LIKE '%@visualdesigne.com' OR
        auth.uid() IN (SELECT id FROM admin_users)
    );

-- Política para leitura pública (para o sistema de cron/notificações)
CREATE POLICY "System can read active templates"
    ON renewal_templates
    FOR SELECT
    TO anon, authenticated
    USING (is_active = true);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_renewal_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER renewal_templates_updated_at_trigger
    BEFORE UPDATE ON renewal_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_renewal_templates_updated_at();

-- Inserir templates padrão com conteúdo completo
INSERT INTO renewal_templates (template_id, name, days_before, title, message, email_subject, email_body, type, urgency)
VALUES 
    ('renewal-60-days', 'Renovação em 60 Dias', 60, '🔔 Renovação em Breve - {{serviceName}}', 'Olá {{clientName}}, seu {{serviceName}} expira em 60 dias ({{expirationDate}}). Renove agora para evitar interrupções no serviço.', '🔔 Lembrete: Renovação de {{serviceName}} em 60 dias', '<p>Esperamos que esteja tudo bem!</p><p>Gostaríamos de informar que o serviço <strong>{{serviceName}}</strong> está programado para expirar em <strong>{{expirationDate}}</strong> ({{daysRemaining}} dias).</p><div style="background:#f8fafc;border-left:4px solid #7c3aed;padding:20px;margin:25px 0;"><h3 style="margin:0 0 15px 0;color:#1e293b;font-size:16px;">📋 Detalhes do Serviço</h3><p style="margin:8px 0;"><strong>Serviço:</strong> {{serviceName}}</p><p style="margin:8px 0;"><strong>Vencimento:</strong> {{expirationDate}}</p><p style="margin:8px 0;"><strong>Valor:</strong> {{renewalPrice}}</p></div><div style="text-align:center;margin:30px 0;"><a href="{{renewalLink}}" style="display:inline-block;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;padding:15px 40px;text-decoration:none;border-radius:8px;font-weight:bold;font-size:16px;">RENOVAR AGORA →</a></div><p style="font-size:14px;color:#64748b;">Renovando com antecedência, você garante continuidade do serviço sem interrupções e evita taxas de reativação.</p>', 'info', 'low'),
    ('renewal-30-days', 'Renovação em 30 Dias', 30, '⏰ Renovação em 30 Dias - {{serviceName}}', 'Olá {{clientName}}, seu {{serviceName}} expira em 30 dias ({{expirationDate}}). Não deixe para última hora!', '⏰ Importante: Renovação de {{serviceName}} em 30 dias', '<p>Olá {{clientName}},</p><p>O serviço <strong>{{serviceName}}</strong> expira em exatamente <strong>30 dias</strong> ({{expirationDate}}).</p><div style="background:#f8fafc;border-left:4px solid #3b82f6;padding:20px;margin:25px 0;"><p style="margin:8px 0;"><strong>📅 Data de Vencimento:</strong> {{expirationDate}}</p><p style="margin:8px 0;"><strong>💰 Investimento:</strong> {{renewalPrice}}</p></div><div style="text-align:center;margin:30px 0;"><a href="{{renewalLink}}" style="display:inline-block;background:#3b82f6;color:white;padding:15px 40px;text-decoration:none;border-radius:8px;font-weight:bold;font-size:16px;">RENOVAR AGORA →</a></div><p>Evite contratempos e renove com tranquilidade.</p>', 'warning', 'medium'),
    ('renewal-7-days', 'Renovação em 7 Dias', 7, '⚠️ Urgente: Renovação em 7 Dias', '{{clientName}}, seu {{serviceName}} expira em apenas 7 dias ({{expirationDate}}). Renove IMEDIATAMENTE para evitar suspensão!', '⚠️ URGENTE: Renovação de {{serviceName}} em 7 dias', '<p>{{clientName}},</p><p><strong style="color: #dc2626;">ATENÇÃO URGENTE!</strong></p><p>Seu serviço <strong>{{serviceName}}</strong> expira em <strong style="color: #dc2626;">7 dias</strong> ({{expirationDate}}).</p><div style="background: #fee2e2; border: 2px solid #dc2626; padding: 15px; margin: 10px 0;"><strong style="color: #dc2626; font-size: 18px;">⚠️ SITUAÇÃO CRÍTICA ⚠️</strong><p style="margin: 10px 0; color: #991b1b;">Seu serviço expira em apenas <strong>7 DIAS</strong>!</p></div><div style="background: #dbeafe; border: 2px solid #2563eb; padding: 15px; margin: 20px 0; text-align: center;"><p style="margin: 0 0 10px 0; font-weight: bold; color: #1e40af;">💰 Investimento: {{renewalPrice}}</p><a href="{{renewalLink}}" style="background: #dc2626; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">RENOVAR AGORA →</a></div><p><strong>Contato de Emergência:</strong><br>📧 {{supportEmail}}<br>📞 {{supportPhone}}</p>', 'error', 'high'),
    ('renewal-1-day', 'Último Dia - Renovação', 1, '🚨 ÚLTIMO DIA: {{serviceName}}', '{{clientName}}, HOJE {{expirationDate}} é o ÚLTIMO DIA para renovar {{serviceName}}. O serviço será SUSPENSO amanhã!', '🚨 ÚLTIMO DIA: Renove {{serviceName}} AGORA!', '<p style="color: #dc2626; font-size: 18px; font-weight: bold;">🚨 ÚLTIMO AVISO 🚨</p><p>{{clientName}},</p><p>Hoje, <strong>{{expirationDate}}</strong>, é o <strong style="color: #dc2626;">ÚLTIMO DIA</strong> para renovar seu serviço <strong>{{serviceName}}</strong>.</p><div style="background: #dc2626; color: white; padding: 20px; margin: 20px 0; text-align: center;"><p style="margin: 0 0 15px 0; font-size: 16px; font-weight: bold;">⏰ O SERVIÇO SERÁ SUSPENSO AMANHÃ!</p><p style="margin: 0;">💰 Valor: {{renewalPrice}}</p></div><div style="text-align:center;margin:30px 0;"><a href="{{renewalLink}}" style="display:inline-block;background:#000;color:#dc2626;padding:15px 40px;text-decoration:none;border:3px solid #dc2626;border-radius:8px;font-weight:bold;font-size:18px;">RENOVAR IMEDIATAMENTE →</a></div><p style="color: #991b1b; font-weight: bold;">Este é o último aviso. Renove HOJE!</p><p><strong>Emergência:</strong><br>📧 {{supportEmail}}<br>📞 {{supportPhone}}</p>', 'error', 'critical')
ON CONFLICT (template_id) DO UPDATE SET 
    name = EXCLUDED.name,
    days_before = EXCLUDED.days_before,
    title = EXCLUDED.title,
    message = EXCLUDED.message,
    email_subject = EXCLUDED.email_subject,
    email_body = EXCLUDED.email_body,
    type = EXCLUDED.type,
    urgency = EXCLUDED.urgency,
    updated_at = NOW();

-- Criar índice para busca eficiente
CREATE INDEX IF NOT EXISTS idx_renewal_templates_days_before ON renewal_templates(days_before);
CREATE INDEX IF NOT EXISTS idx_renewal_templates_is_active ON renewal_templates(is_active);
