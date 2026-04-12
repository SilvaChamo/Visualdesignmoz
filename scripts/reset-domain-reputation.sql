-- Script para limpar/resetar dados de reputação de domínios
-- Execute no SQL Editor do Supabase

-- Opção 1: Deletar TODOS os registros de reputação (limpeza completa)
-- DELETE FROM domain_reputation;

-- Opção 2: Resetar contadores para um domínio específico
-- UPDATE domain_reputation 
-- SET emails_sent_today = 0, 
--     emails_sent_total = 0,
--     last_send_date = NOW(),
--     bounce_rate = 0,
--     complaint_rate = 0
-- WHERE domain = 'seudominio.com';

-- Opção 3: Resetar TODOS os domínios (recomendado para testes)
UPDATE domain_reputation 
SET emails_sent_today = 0, 
    last_send_date = NOW();

-- Verificar resultado
SELECT domain, emails_sent_today, emails_sent_total, last_send_date 
FROM domain_reputation 
ORDER BY domain;
