-- ============================================
-- SISTEMA DE RENOVAÇÃO AUTOMÁTICA
-- ============================================

-- Tabela: domain_renewals (Domínios para renovação)
CREATE TABLE IF NOT EXISTS domain_renewals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    domain_name VARCHAR(255) NOT NULL,
    registrar VARCHAR(100) DEFAULT 'CyberPanel',
    registration_date DATE,
    expiration_date DATE NOT NULL,
    renewal_price DECIMAL(10,2) DEFAULT 0.00,
    currency VARCHAR(3) DEFAULT 'EUR',
    auto_renew BOOLEAN DEFAULT false,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'expired', 'pending', 'cancelled', 'renewed')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela: hosting_renewals (Hospedagem para renovação)
CREATE TABLE IF NOT EXISTS hosting_renewals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    website_id UUID,
    domain_name VARCHAR(255) NOT NULL,
    package_name VARCHAR(100),
    server VARCHAR(100) DEFAULT 'CyberPanel',
    start_date DATE,
    expiration_date DATE NOT NULL,
    renewal_price DECIMAL(10,2) DEFAULT 0.00,
    currency VARCHAR(3) DEFAULT 'EUR',
    auto_renew BOOLEAN DEFAULT false,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'expired', 'pending', 'cancelled', 'renewed')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela: renewal_reminders (Controle de lembretes enviados)
CREATE TABLE IF NOT EXISTS renewal_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    service_type VARCHAR(20) NOT NULL CHECK (service_type IN ('domain', 'hosting')),
    service_id UUID NOT NULL,
    service_name VARCHAR(255) NOT NULL,
    expiration_date DATE NOT NULL,
    reminder_days INTEGER NOT NULL,
    notification_id UUID REFERENCES notifications(id) ON DELETE SET NULL,
    email_sent BOOLEAN DEFAULT false,
    email_sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(service_id, reminder_days)
);

-- Tabela: renewal_settings (Configurações do sistema)
CREATE TABLE IF NOT EXISTS renewal_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(100) UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_domain_renewals_user_id ON domain_renewals(user_id);
CREATE INDEX IF NOT EXISTS idx_domain_renewals_expiration ON domain_renewals(expiration_date);
CREATE INDEX IF NOT EXISTS idx_domain_renewals_status ON domain_renewals(status);
CREATE INDEX IF NOT EXISTS idx_hosting_renewals_user_id ON hosting_renewals(user_id);
CREATE INDEX IF NOT EXISTS idx_hosting_renewals_expiration ON hosting_renewals(expiration_date);
CREATE INDEX IF NOT EXISTS idx_hosting_renewals_status ON hosting_renewals(status);
CREATE INDEX IF NOT EXISTS idx_renewal_reminders_service ON renewal_reminders(service_type, service_id);
CREATE INDEX IF NOT EXISTS idx_renewal_reminders_user ON renewal_reminders(user_id);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_domain_renewals ON domain_renewals;
CREATE TRIGGER trigger_update_domain_renewals
    BEFORE UPDATE ON domain_renewals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_update_hosting_renewals ON hosting_renewals;
CREATE TRIGGER trigger_update_hosting_renewals
    BEFORE UPDATE ON hosting_renewals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Função: Verificar renovações próximas
CREATE OR REPLACE FUNCTION get_upcoming_renewals(p_days INTEGER)
RETURNS TABLE (
    service_id UUID,
    service_type TEXT,
    service_name TEXT,
    user_id UUID,
    expiration_date DATE,
    days_remaining INTEGER,
    renewal_price DECIMAL,
    status TEXT
) AS $$
BEGIN
    -- Domínios
    RETURN QUERY
    SELECT 
        dr.id as service_id,
        'domain'::TEXT as service_type,
        dr.domain_name as service_name,
        dr.user_id,
        dr.expiration_date,
        (dr.expiration_date - CURRENT_DATE)::INTEGER as days_remaining,
        dr.renewal_price,
        dr.status::TEXT
    FROM domain_renewals dr
    WHERE dr.status = 'active'
    AND dr.expiration_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + p_days)
    AND NOT EXISTS (
        SELECT 1 FROM renewal_reminders rr
        WHERE rr.service_id = dr.id 
        AND rr.reminder_days = p_days
    );
    
    -- Hospedagem
    RETURN QUERY
    SELECT 
        hr.id as service_id,
        'hosting'::TEXT as service_type,
        hr.domain_name as service_name,
        hr.user_id,
        hr.expiration_date,
        (hr.expiration_date - CURRENT_DATE)::INTEGER as days_remaining,
        hr.renewal_price,
        hr.status::TEXT
    FROM hosting_renewals hr
    WHERE hr.status = 'active'
    AND hr.expiration_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + p_days)
    AND NOT EXISTS (
        SELECT 1 FROM renewal_reminders rr
        WHERE rr.service_id = hr.id 
        AND rr.reminder_days = p_days
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função: Registrar lembrete enviado
CREATE OR REPLACE FUNCTION record_renewal_reminder(
    p_user_id UUID,
    p_service_type VARCHAR,
    p_service_id UUID,
    p_service_name VARCHAR,
    p_expiration_date DATE,
    p_reminder_days INTEGER,
    p_notification_id UUID DEFAULT NULL,
    p_email_sent BOOLEAN DEFAULT false
)
RETURNS UUID AS $$
DECLARE
    v_reminder_id UUID;
BEGIN
    INSERT INTO renewal_reminders (
        user_id, service_type, service_id, service_name,
        expiration_date, reminder_days, notification_id, email_sent
    ) VALUES (
        p_user_id, p_service_type, p_service_id, p_service_name,
        p_expiration_date, p_reminder_days, p_notification_id, p_email_sent
    )
    ON CONFLICT (service_id, reminder_days) 
    DO UPDATE SET 
        notification_id = EXCLUDED.notification_id,
        email_sent = EXCLUDED.email_sent,
        email_sent_at = CASE WHEN EXCLUDED.email_sent THEN NOW() ELSE NULL END
    RETURNING id INTO v_reminder_id;
    
    RETURN v_reminder_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Inserir configurações padrão
INSERT INTO renewal_settings (key, value, description) VALUES
('reminder_days', '[60, 45, 30, 15, 7, 3, 1]', 'Dias antes do vencimento para enviar lembretes'),
('default_renewal_price_domain', '{"amount": 15.00, "currency": "EUR"}', 'Preço padrão de renovação de domínio'),
('default_renewal_price_hosting', '{"amount": 50.00, "currency": "EUR"}', 'Preço padrão de renovação de hospedagem'),
('company_info', '{"name": "VisualDesign", "email": "suporte@visualdesigne.com", "phone": "+351 XXX XXX XXX"}', 'Informações da empresa para notificações'),
('cron_enabled', 'true', 'Habilitar verificação automática de renovações')
ON CONFLICT (key) DO NOTHING;

-- RLS (Row Level Security)
ALTER TABLE domain_renewals ENABLE ROW LEVEL SECURITY;
ALTER TABLE hosting_renewals ENABLE ROW LEVEL SECURITY;
ALTER TABLE renewal_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE renewal_settings ENABLE ROW LEVEL SECURITY;

-- Políticas para domain_renewals
CREATE POLICY "Users can view their own domains"
    ON domain_renewals FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all domains"
    ON domain_renewals FOR ALL 
    USING (auth.uid() IN (SELECT id FROM auth.users WHERE email IN ('silva.chamo@gmail.com', 'admin@visualdesigne.com')));

-- Políticas para hosting_renewals
CREATE POLICY "Users can view their own hosting"
    ON hosting_renewals FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all hosting"
    ON hosting_renewals FOR ALL 
    USING (auth.uid() IN (SELECT id FROM auth.users WHERE email IN ('silva.chamo@gmail.com', 'admin@visualdesigne.com')));

-- Políticas para renewal_reminders
CREATE POLICY "Admins can view all reminders"
    ON renewal_reminders FOR SELECT 
    USING (auth.uid() IN (SELECT id FROM auth.users WHERE email IN ('silva.chamo@gmail.com', 'admin@visualdesigne.com')));

-- Comentários
COMMENT ON TABLE domain_renewals IS 'Domínios dos clientes com datas de vencimento';
COMMENT ON TABLE hosting_renewals IS 'Serviços de hospedagem com datas de renovação';
COMMENT ON TABLE renewal_reminders IS 'Registro de lembretes de renovação enviados';
COMMENT ON TABLE renewal_settings IS 'Configurações do sistema de renovação';
