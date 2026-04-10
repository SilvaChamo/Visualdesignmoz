-- ============================================================
-- TABELA DE REPUTAÇÃO DE DOMÍNIOS (Email Marketing Warm-up)
-- ============================================================
-- Esta tabela rastreia a reputação de cada domínio para o sistema
-- de warm-up automático, garantindo entregabilidade gradual.

CREATE TABLE IF NOT EXISTS domain_reputation (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    domain VARCHAR(255) NOT NULL UNIQUE,
    
    -- Fase atual do warm-up
    current_phase VARCHAR(50) DEFAULT 'NEW' CHECK (current_phase IN (
        'NEW', 'PHASE_1', 'PHASE_2', 'PHASE_3', 'PHASE_4', 'ESTABLISHED'
    )),
    
    -- Contadores de envio
    emails_sent_today INTEGER DEFAULT 0,
    emails_sent_total INTEGER DEFAULT 0,
    
    -- Datas de rastreamento
    first_send_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_send_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Métricas de qualidade
    bounce_count INTEGER DEFAULT 0,
    bounce_rate DECIMAL(5,2) DEFAULT 0.00,
    
    complaint_count INTEGER DEFAULT 0,
    complaint_rate DECIMAL(5,2) DEFAULT 0.00,
    
    -- Score de reputação (0-100)
    reputation_score INTEGER DEFAULT 50 CHECK (reputation_score >= 0 AND reputation_score <= 100),
    
    -- Campos de auditoria
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Metadados adicionais (JSONB para flexibilidade)
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_domain_reputation_domain ON domain_reputation(domain);
CREATE INDEX IF NOT EXISTS idx_domain_reputation_phase ON domain_reputation(current_phase);
CREATE INDEX IF NOT EXISTS idx_domain_reputation_score ON domain_reputation(reputation_score);

-- Comentários explicativos
COMMENT ON TABLE domain_reputation IS 'Rastreia a reputação de envio de email por domínio para sistema de warm-up';
COMMENT ON COLUMN domain_reputation.current_phase IS 'Fase do warm-up: NEW(50/dia), PHASE_1(100), PHASE_2(300), PHASE_3(600), PHASE_4(1000), ESTABLISHED(2000)';
COMMENT ON COLUMN domain_reputation.emails_sent_today IS 'Quantidade enviada hoje (reseta à meia-noite UTC)';
COMMENT ON COLUMN domain_reputation.reputation_score IS 'Score 0-100 baseado em bounces, complaints e histórico';

-- ============================================================
-- FUNÇÃO PARA RESETAR CONTADOR DIÁRIO (UTC)
-- ============================================================
CREATE OR REPLACE FUNCTION reset_daily_email_counters()
RETURNS void AS $$
BEGIN
    UPDATE domain_reputation 
    SET emails_sent_today = 0,
        updated_at = NOW()
    WHERE emails_sent_today > 0;
    
    -- Log da operação (opcional, pode ser removido em produção)
    RAISE NOTICE 'Reset daily counters executed at %', NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TRIGGER PARA ATUALIZAR updated_at AUTOMATICAMENTE
-- ============================================================
CREATE OR REPLACE FUNCTION update_domain_reputation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_domain_reputation_timestamp ON domain_reputation;

CREATE TRIGGER trigger_update_domain_reputation_timestamp
    BEFORE UPDATE ON domain_reputation
    FOR EACH ROW
    EXECUTE FUNCTION update_domain_reputation_timestamp();

-- ============================================================
-- VIEW AMIGÁVEL PARA MONITORAMENTO
-- ============================================================
CREATE OR REPLACE VIEW domain_reputation_summary AS
SELECT 
    domain,
    current_phase as phase,
    CASE current_phase
        WHEN 'NEW' THEN 'Novo (50/dia)'
        WHEN 'PHASE_1' THEN 'Inicial (100/dia)'
        WHEN 'PHASE_2' THEN 'Crescendo (300/dia)'
        WHEN 'PHASE_3' THEN 'Estável (600/dia)'
        WHEN 'PHASE_4' THEN 'Maduro (1000/dia)'
        WHEN 'ESTABLISHED' THEN 'Premium (2000/dia)'
    END as phase_label,
    emails_sent_today as sent_today,
    CASE current_phase
        WHEN 'NEW' THEN 50 - emails_sent_today
        WHEN 'PHASE_1' THEN 100 - emails_sent_today
        WHEN 'PHASE_2' THEN 300 - emails_sent_today
        WHEN 'PHASE_3' THEN 600 - emails_sent_today
        WHEN 'PHASE_4' THEN 1000 - emails_sent_today
        WHEN 'ESTABLISHED' THEN 2000 - emails_sent_today
    END as remaining_today,
    emails_sent_total as total_sent,
    reputation_score as score,
    ROUND(bounce_rate, 2) as bounce_rate_pct,
    ROUND(complaint_rate, 2) as complaint_rate_pct,
    first_send_date,
    last_send_date,
    EXTRACT(DAY FROM (NOW() - first_send_date)) as days_active
FROM domain_reputation;

-- ============================================================
-- POLÍTICA RLS (Row Level Security) - OPCIONAL
-- Descomente se quiser restringir acesso por usuário
-- ============================================================

-- -- Habilitar RLS
-- ALTER TABLE domain_reputation ENABLE ROW LEVEL SECURITY;

-- -- Política: usuários só veem seus próprios domínios
-- -- (requer coluna user_id na tabela)
-- CREATE POLICY domain_reputation_user_isolation ON domain_reputation
--     FOR ALL
--     TO authenticated
--     USING (domain IN (
--         SELECT domain FROM user_domains WHERE user_id = auth.uid()
--     ));

-- -- Admin vê tudo
-- CREATE POLICY domain_reputation_admin ON domain_reputation
--     FOR ALL
--     TO authenticated
--     USING (auth.jwt() ->> 'role' = 'admin');

-- ============================================================
-- INSTRUÇÕES DE USO
-- ============================================================
-- 
-- 1. RESET DIÁRIO AUTOMÁTICO:
--    Configure um cron job ou trigger no Supabase para executar:
--    SELECT reset_daily_email_counters();
--    Recomendado: Todo dia às 00:00 UTC
--
-- 2. EXEMPLOS DE CONSULTAS:
--
--    -- Ver reputação de um domínio:
--    SELECT * FROM domain_reputation_summary WHERE domain = 'cliente.com';
--
--    -- Domínios com reputação baixa:
--    SELECT * FROM domain_reputation_summary WHERE score < 70;
--
--    -- Domínios que atingiram limite hoje:
--    SELECT * FROM domain_reputation_summary WHERE remaining_today <= 0;
--
-- 3. INSERÇÃO MANUAL (se necessário):
--    INSERT INTO domain_reputation (domain, current_phase) 
--    VALUES ('novodominio.com', 'NEW')
--    ON CONFLICT (domain) DO NOTHING;

