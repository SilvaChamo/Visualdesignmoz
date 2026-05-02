-- ============================================
-- SCRIPT DE ATUALIZAÇÃO DOS TEMPLATES
-- Atualiza todos os templates com conteúdo completo
-- ============================================

-- Atualizar templates existentes com conteúdo completo

-- Template 60 dias
UPDATE renewal_templates 
SET 
    name = 'Renovação em 60 Dias',
    title = '🔔 Renovação em Breve - {{serviceName}}',
    message = 'Olá {{clientName}}, seu {{serviceName}} expira em 60 dias ({{expirationDate}}). Renove agora para evitar interrupções no serviço.',
    email_subject = '🔔 Lembrete: Renovação de {{serviceName}} em 60 dias',
    email_body = '<p>Esperamos que esteja tudo bem!</p><p>Gostaríamos de informar que o serviço <strong>{{serviceName}}</strong> está programado para expirar em <strong>{{expirationDate}}</strong> ({{daysRemaining}} dias).</p><div style="background:#f8fafc;border-left:4px solid #7c3aed;padding:20px;margin:25px 0;"><h3 style="margin:0 0 15px 0;color:#1e293b;font-size:16px;">📋 Detalhes do Serviço</h3><p style="margin:8px 0;"><strong>Serviço:</strong> {{serviceName}}</p><p style="margin:8px 0;"><strong>Vencimento:</strong> {{expirationDate}}</p><p style="margin:8px 0;"><strong>Valor:</strong> {{renewalPrice}}</p></div><div style="text-align:center;margin:30px 0;"><a href="{{renewalLink}}" style="display:inline-block;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;padding:15px 40px;text-decoration:none;border-radius:8px;font-weight:bold;font-size:16px;">RENOVAR AGORA →</a></div><p style="font-size:14px;color:#64748b;">Renovando com antecedência, você garante continuidade do serviço sem interrupções e evita taxas de reativação.</p>',
    type = 'info',
    urgency = 'low',
    updated_at = NOW()
WHERE template_id = 'renewal-60-days';

-- Template 30 dias
UPDATE renewal_templates 
SET 
    name = 'Renovação em 30 Dias',
    title = '⏰ Renovação em 30 Dias - {{serviceName}}',
    message = 'Olá {{clientName}}, seu {{serviceName}} expira em 30 dias ({{expirationDate}}). Não deixe para última hora!',
    email_subject = '⏰ Importante: Renovação de {{serviceName}} em 30 dias',
    email_body = '<p>Olá {{clientName}},</p><p>O serviço <strong>{{serviceName}}</strong> expira em exatamente <strong>30 dias</strong> ({{expirationDate}}).</p><div style="background:#f8fafc;border-left:4px solid #3b82f6;padding:20px;margin:25px 0;"><p style="margin:8px 0;"><strong>📅 Data de Vencimento:</strong> {{expirationDate}}</p><p style="margin:8px 0;"><strong>💰 Investimento:</strong> {{renewalPrice}}</p></div><div style="text-align:center;margin:30px 0;"><a href="{{renewalLink}}" style="display:inline-block;background:#3b82f6;color:white;padding:15px 40px;text-decoration:none;border-radius:8px;font-weight:bold;font-size:16px;">RENOVAR AGORA →</a></div><p>Evite contratempos e renove com tranquilidade.</p>',
    type = 'warning',
    urgency = 'medium',
    updated_at = NOW()
WHERE template_id = 'renewal-30-days';

-- Template 7 dias
UPDATE renewal_templates 
SET 
    name = 'Renovação em 7 Dias',
    title = '⚠️ Urgente: Renovação em 7 Dias - {{serviceName}}',
    message = '{{clientName}}, seu {{serviceName}} expira em apenas 7 dias ({{expirationDate}}). Renove IMEDIATAMENTE para evitar suspensão!',
    email_subject = '⚠️ URGENTE: Renovação de {{serviceName}} em 7 dias',
    email_body = '<p>{{clientName}},</p><p><strong style="color: #dc2626;">ATENÇÃO URGENTE!</strong></p><p>Seu serviço <strong>{{serviceName}}</strong> expira em <strong style="color: #dc2626;">7 dias</strong> ({{expirationDate}}).</p><div style="background: #fee2e2; border: 2px solid #dc2626; padding: 15px; margin: 10px 0;"><strong style="color: #dc2626; font-size: 18px;">⚠️ SITUAÇÃO CRÍTICA ⚠️</strong><p style="margin: 10px 0; color: #991b1b;">Seu serviço expira em apenas <strong>7 DIAS</strong>!</p></div><div style="background: #dbeafe; border: 2px solid #2563eb; padding: 15px; margin: 20px 0; text-align: center;"><p style="margin: 0 0 10px 0; font-weight: bold; color: #1e40af;">💰 Investimento: {{renewalPrice}}</p><a href="{{renewalLink}}" style="background: #dc2626; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">RENOVAR AGORA →</a></div><p><strong>Contato de Emergência:</strong><br>📧 {{supportEmail}}<br>📞 {{supportPhone}}</p>',
    type = 'error',
    urgency = 'high',
    updated_at = NOW()
WHERE template_id = 'renewal-7-days';

-- Template 1 dia
UPDATE renewal_templates 
SET 
    name = 'Último Dia - Renovação',
    title = '🚨 ÚLTIMO DIA: {{serviceName}}',
    message = '{{clientName}}, HOJE {{expirationDate}} é o ÚLTIMO DIA para renovar {{serviceName}}. O serviço será SUSPENSO amanhã!',
    email_subject = '🚨 ÚLTIMO DIA: Renove {{serviceName}} AGORA!',
    email_body = '<p style="color: #dc2626; font-size: 18px; font-weight: bold;">🚨 ÚLTIMO AVISO 🚨</p><p>{{clientName}},</p><p>Hoje, <strong>{{expirationDate}}</strong>, é o <strong style="color: #dc2626;">ÚLTIMO DIA</strong> para renovar seu serviço <strong>{{serviceName}}</strong>.</p><div style="background: #dc2626; color: white; padding: 20px; margin: 20px 0; text-align: center;"><p style="margin: 0 0 15px 0; font-size: 16px; font-weight: bold;">⏰ O SERVIÇO SERÁ SUSPENSO AMANHÃ!</p><p style="margin: 0;">💰 Valor: {{renewalPrice}}</p></div><div style="text-align:center;margin:30px 0;"><a href="{{renewalLink}}" style="display:inline-block;background:#000;color:#dc2626;padding:15px 40px;text-decoration:none;border:3px solid #dc2626;border-radius:8px;font-weight:bold;font-size:18px;">RENOVAR IMEDIATAMENTE →</a></div><p style="color: #991b1b; font-weight: bold;">Este é o último aviso. Renove HOJE!</p><p><strong>Emergência:</strong><br>📧 {{supportEmail}}<br>📞 {{supportPhone}}</p>',
    type = 'error',
    urgency = 'critical',
    updated_at = NOW()
WHERE template_id = 'renewal-1-day';

-- Verificar templates atualizados
SELECT template_id, name, days_before, type, urgency, updated_at 
FROM renewal_templates 
ORDER BY days_before DESC;
