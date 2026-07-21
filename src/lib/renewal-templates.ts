// ============================================
// TEMPLATES DE NOTIFICAÇÃO DE RENOVAÇÃO
// ============================================
// Edite este arquivo para personalizar as mensagens
// As variáveis disponíveis são:
// - {{clientName}} - Nome do cliente
// - {{serviceName}} - Nome do domínio/hospedagem
// - {{expirationDate}} - Data de vencimento (DD/MM/AAAA)
// - {{daysRemaining}} - Dias restantes
// - {{renewalPrice}} - Preço da renovação
// - {{renewalLink}} - Link para renovar
// - {{companyName}} - Nome da empresa (VisualDesign)
// - {{supportEmail}} - Email de suporte
// - {{supportPhone}} - Telefone de suporte

// ============================================
// CABEÇALHO E RODAPÉ PADRÃO - CORES VISUALDESIGN
// ============================================
// Cores: Vermelho #dc2626, Cinza #374151, Preto #000000

// URL base do site - usa variável de ambiente ou fallback para o domínio de produção
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://visualdesignmoz.com'
const LOGO_URL = `${SITE_URL}/assets/logotipoII.png`

export const emailHeader = (clientName: string, companyName: string) => `
<!--[if mso]>
<table role="presentation" border="0" cellspacing="0" cellpadding="0" align="center" width="600">
<tr>
<td align="center" valign="top" width="600">
<![endif]-->
<div style="background: linear-gradient(135deg, #000000 0%, #1a1a1a 50%, #000000 100%); padding: 15px; text-align: center; border-bottom: 3px solid #dc2626; width: 100%; margin: 0 auto;">
  <center>
    <img src="${LOGO_URL}" 
         alt="${companyName}" 
         width="150" 
         height="60" 
         style="display: block; margin-left: auto; margin-right: auto; max-width: 150px; height: auto; border: 0; outline: none; text-align: center;" />
  </center>
</div>
<!--[if mso]>
</td>
</tr>
</table>
<![endif]-->

<div style="padding: 12px 20px; background: #f3f4f6; border-bottom: 1px solid #d1d5db; font-family: 'Exo 2', sans-serif;">
  <p style="margin: 0; font-size: 14px; color: #1f2937; font-weight: normal; font-family: 'Exo 2', sans-serif;">
    <strong style="color: #000000;">Prezado(a) Sr(a). ${clientName}</strong>,
  </p>
</div>
`.trim()

export const emailFooter = (supportEmail: string, supportPhone: string, companyName: string) => `
<div style="padding: 20px; background: #374151; text-align: center; font-family: 'Exo 2', sans-serif;">
  <p style="margin: 0; color: #f3f4f6; font-size: 13px; font-weight: 600; letter-spacing: 1px; font-family: 'Exo 2', sans-serif;">${companyName.toUpperCase()}</p>
  <p style="margin: 8px 0 0 0; color: #d1d5db; font-size: 10px; font-family: 'Exo 2', sans-serif;">
    © ${new Date().getFullYear()} Todos os direitos reservados
  </p>
</div>
`.trim()

export const emailAttentionCard = (supportEmail: string, dashboardLink?: string, clientAreaLink?: string) => `
<div style="padding: 12px 15px; background: #fef2f2; border-left: 3px solid #dc2626; margin-top: 15px;">
  <p style="margin: 0; font-size: 11px; color: #7f1d1d; line-height: 1.5;">
    <strong style="color: #dc2626;">⚠️ Atenção:</strong> Transações realizadas por transferência bancária podem levar até <strong>24 horas</strong> para serem aprovadas. Para agilizar, envie o comprovante com <strong>Data, Hora e Número da transação</strong> para <a href="mailto:${supportEmail}" style="color: #dc2626; text-decoration: underline;">${supportEmail}</a>.${dashboardLink ? ` <strong>Dashboard:</strong> <a href="${dashboardLink}" style="color: #dc2626; text-decoration: underline;">Acessar Conta →</a>` : ''}${clientAreaLink ? ` | <a href="${clientAreaLink}" style="color: #dc2626; text-decoration: underline;">Área de Cliente →</a>` : ''}
  </p>
</div>
`.trim()

// Função para criar quadro com linha colorida conforme urgência
export const getUrgencyColor = (urgency: string): string => {
  switch (urgency) {
    case 'critical': return '#dc2626' // Vermelho
    case 'high': return '#ea580c' // Laranja
    case 'medium': return '#ca8a04' // Amarelo/Dourado
    case 'low':
    default: return '#2563eb' // Azul
  }
}

export const wrapContentInFrame = (content: string, urgency: string) => {
  const borderColor = getUrgencyColor(urgency)
  return `
<div style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; margin: 20px 0; font-family: 'Exo 2', sans-serif;">
  <div style="height: 4px; background: ${borderColor};"></div>
  <div style="padding: 20px; background: #ffffff; font-family: 'Exo 2', sans-serif; font-weight: normal;">
    ${content}
  </div>
</div>
  `.trim()
}

export interface RenewalTemplate {
  id: string
  name: string
  daysBefore: number
  title: string
  message: string
  emailSubject: string
  emailBody: string
  type: 'info' | 'warning' | 'error' | 'success'
  urgency: 'low' | 'medium' | 'high' | 'critical'
  includeAttentionCard?: boolean // Campo opcional - se false, não inclui o card de atenção
}

// ============================================
// TEMPLATES PADRÃO - EDITE AQUI
// ============================================

export const defaultRenewalTemplates: RenewalTemplate[] = [
  // Template 1: 60 dias (Primeiro aviso)
  {
    id: 'renewal-60-days',
    name: 'Renovação em 60 Dias',
    daysBefore: 60,
    title: '🔔 Renovação em Breve - {{serviceName}}',
    message: 'Olá {{clientName}}, seu {{serviceName}} expira em 60 dias ({{expirationDate}}). Renove agora para evitar interrupções no serviço.',
    emailSubject: '🔔 Lembrete: Renovação de {{serviceName}} em 60 dias',
    emailBody: `
<p>Esperamos que esteja tudo bem!</p>
<p>Gostaríamos de informar que o serviço <strong>{{serviceName}}</strong> está programado para expirar em <strong>{{expirationDate}}</strong> ({{daysRemaining}} dias).</p>
<div style="background:#f8fafc;border-left:4px solid #7c3aed;padding:20px;margin:25px 0;">
  <h3 style="margin:0 0 15px 0;color:#1e293b;font-size:16px;">📋 Detalhes do Serviço</h3>
  <p style="margin:8px 0;"><strong>Serviço:</strong> {{serviceName}}</p>
  <p style="margin:8px 0;"><strong>Vencimento:</strong> {{expirationDate}}</p>
  <p style="margin:8px 0;"><strong>Valor:</strong> {{renewalPrice}}</p>
</div>
<div style="text-align:center;margin:30px 0;">
  <a href="{{renewalLink}}" style="display:inline-block;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;padding:15px 40px;text-decoration:none;border-radius:8px;font-weight:bold;font-size:16px;">RENOVAR AGORA →</a>
</div>
<p style="font-size:14px;color:#64748b;">Renovando com antecedência, você garante continuidade do serviço sem interrupções e evita taxas de reativação.</p>
    `.trim(),
    type: 'info',
    urgency: 'low'
  },

  // Template 2: 45 dias (Lembrete)
  {
    id: 'renewal-45-days',
    name: 'Lembrete - 45 Dias',
    daysBefore: 45,
    title: '⏰ Renovação em 45 Dias - {{serviceName}}',
    message: 'Lembrete: Faltam 45 dias para o vencimento de {{serviceName}} ({{expirationDate}}). Não deixe para última hora!',
    emailSubject: '⏰ Lembrete: {{serviceName}} expira em 45 dias',
    emailBody: `
<p>Passando para lembrar que faltam <strong>45 dias</strong> para a renovação do seu serviço <strong>{{serviceName}}</strong>.</p>
<div style="background:#f8fafc;border-left:4px solid #3b82f6;padding:20px;margin:25px 0;">
  <p style="margin:8px 0;"><strong>📅 Data de Vencimento:</strong> {{expirationDate}}</p>
  <p style="margin:8px 0;"><strong>💰 Investimento:</strong> {{renewalPrice}}</p>
</div>
<div style="text-align:center;margin:30px 0;">
  <a href="{{renewalLink}}" style="display:inline-block;background:#3b82f6;color:white;padding:15px 40px;text-decoration:none;border-radius:8px;font-weight:bold;font-size:16px;">RENOVAR AGORA →</a>
</div>
<p>Evite contratempos e renove com tranquilidade.</p>
    `.trim(),
    type: 'warning',
    urgency: 'medium'
  },

  // Template 3: 30 dias (Atenção)
  {
    id: 'renewal-30-days',
    name: 'Atenção - 30 Dias',
    daysBefore: 30,
    title: '⚠️ Atenção: Renovação em 30 Dias - {{serviceName}}',
    message: 'Olá {{clientName}}, faltam apenas 30 dias para o vencimento de {{serviceName}}. Não deixe expirar!',
    emailSubject: '⚠️ Atenção: {{serviceName}} expira em 30 dias - Acção Necessária',
    emailBody: `
<p>Olá {{clientName}},</p>

<p><strong>Atenção importante!</strong> Seu serviço <strong>{{serviceName}}</strong> expira em exatamente <strong>30 dias</strong> ({{expirationDate}}).</p>

<div style="background: #fef9c3; border: 2px solid #ca8a04; padding: 15px; margin: 20px 0;">
  <p style="margin: 0 0 10px 0; font-weight: bold; color: #854d0e;">⏳ Após esta data, o serviço poderá ser suspenso, causando:</p>
  <ul style="margin: 0; padding-left: 20px; color: #854d0e;">
    <li>Indisponibilidade do site/email</li>
    <li>Perda de dados (se não houver backup)</li>
    <li>Taxas adicionais de reativação</li>
  </ul>
</div>

<div style="background:#f8fafc;border-left:4px solid #ca8a04;padding:20px;margin:25px 0;">
  <h3 style="margin:0 0 15px 0;color:#1e293b;font-size:16px;">📊 Resumo</h3>
  <p style="margin:8px 0;"><strong>Serviço:</strong> {{serviceName}}</p>
  <p style="margin:8px 0;"><strong>Vencimento:</strong> {{expirationDate}}</p>
  <p style="margin:8px 0;"><strong>Investimento:</strong> {{renewalPrice}}</p>
</div>

<div style="text-align:center;margin:30px 0;">
  <a href="{{renewalLink}}" style="display:inline-block;background:#ca8a04;color:white;padding:15px 40px;text-decoration:none;border-radius:8px;font-weight:bold;font-size:16px;">🛡️ PROTEJA SEU SERVIÇO AGORA →</a>
</div>

<p>
  Dúvidas? Estamos aqui para ajudar!<br>
  📧 {{supportEmail}} | 📞 {{supportPhone}}
</p>

<p>
  Atenciosamente,<br>
  Equipe {{companyName}}
</p>
    `.trim(),
    type: 'warning',
    urgency: 'medium'
  },

  // Template 4: 15 dias (Aviso Importante)
  {
    id: 'renewal-15-days',
    name: 'Aviso Importante - 15 Dias',
    daysBefore: 15,
    title: '📢 Aviso Importante: {{serviceName}} expira em 15 dias',
    message: 'Aviso importante: {{serviceName}} expira em 15 dias ({{expirationDate}}). Renove imediatamente para evitar suspensão!',
    emailSubject: '📢 Aviso Importante: {{serviceName}} - 15 dias para vencer',
    emailBody: `
Olá {{clientName}},

<div style="background: #fee2e2; border: 2px solid #dc2626; padding: 15px; margin: 10px 0;">
  <strong style="color: #dc2626; font-size: 18px;">⚠️ SITUAÇÃO CRÍTICA ⚠️</strong>
  <p style="margin: 10px 0; color: #991b1b;">
    Seu serviço <strong>{{serviceName}}</strong> expira em apenas <strong>15 DIAS</strong>!
  </p>
</div>

<h3 style="color: #dc2626;">🚨 RISCOS IMINENTES:</h3>
<ul style="color: #7f1d1d;">
  <li>✗ Suspensão TOTAL do serviço em {{expirationDate}}</li>
  <li>✗ Site completamente fora do ar</li>
  <li>✗ Todos os emails pararão</li>
  <li>✗ Risco real de PERDA DE DADOS</li>
  <li>✗ Taxas de reativação (até 50% mais caro)</li>
</ul>

<div style="background: #dbeafe; border: 2px solid #2563eb; padding: 15px; margin: 20px 0; text-align: center;">
  <p style="margin: 0 0 10px 0; font-weight: bold; color: #1e40af;">🛡️ PROTEJA SEU SERVIÇO AGORA</p>
  <a href="{{renewalLink}}" style="background: #dc2626; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
    RENOVAR AGORA →
  </a>
  <p style="margin: 10px 0 0 0; font-size: 14px; color: #1e40af;">
    Investimento: {{renewalPrice}}
  </p>
</div>

<p style="color: #7f1d1d;"><strong>⏰ NÃO HÁ MAIS TEMPO A PERDER!</strong></p>

<p>
  <strong>Contato de Emergência:</strong><br>
  📧 {{supportEmail}}<br>
  📞 {{supportPhone}}
</p>

<p style="color: #991b1b; font-weight: bold;">
  Este é um dos últimos avisos. Renove hoje para garantir seu serviço!
</p>

Urgente,<br>
Equipe {{companyName}}
    `.trim(),
    type: 'error',
    urgency: 'high'
  },

  // Template 5: 7 dias (Crítico)
  {
    id: 'renewal-7-days',
    name: 'URGENTE - 7 Dias',
    daysBefore: 7,
    title: '🚨 URGENTE: Renovação em 7 Dias - {{serviceName}}',
    message: '🚨 URGENTE: Seu {{serviceName}} expira em apenas 7 dias ({{expirationDate}})! Renove IMEDIATAMENTE para evitar suspensão do serviço.',
    emailSubject: '🚨 URGENTE: {{serviceName}} expira em 7 dias - Risco de Suspensão',
    emailBody: `
<p>Olá {{clientName}},</p>

<div style="background: #fee2e2; border: 2px solid #dc2626; padding: 15px; margin: 10px 0;">
  <strong style="color: #dc2626; font-size: 18px;">⚠️ SITUAÇÃO URGENTE ⚠️</strong>
  <p style="margin: 10px 0; color: #991b1b;">
    Seu serviço <strong>{{serviceName}}</strong> expira em apenas <strong>7 DIAS</strong> ({{expirationDate}}).
  </p>
</div>

<h3 style="color: #dc2626;">🚨 SE NÃO RENOVAR:</h3>
<ul style="color: #7f1d1d;">
  <li>Serviço será suspenso na data de vencimento</li>
  <li>Site ficará inacessível</li>
  <li>Emails pararão de funcionar</li>
  <li>Perda de dados pode ocorrer</li>
  <li>Taxas de reativação serão aplicadas</li>
</ul>

<div style="background: #dbeafe; border: 2px solid #2563eb; padding: 15px; margin: 20px 0; text-align: center;">
  <p style="margin: 0 0 10px 0; font-weight: bold; color: #1e40af;">⏰ ACÇÃO IMEDIATA NECESSÁRIA!</p>
  <a href="{{renewalLink}}" style="background: #dc2626; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
    RENOVAR AGORA →
  </a>
  <p style="margin: 10px 0 0 0; font-size: 14px; color: #1e40af;">
    Investimento: {{renewalPrice}}
  </p>
</div>

<p>
  Dúvidas urgentes?<br>
  📧 {{supportEmail}}<br>
  📞 {{supportPhone}}
</p>

<p style="color: #991b1b; font-weight: bold;">Não ignore este aviso. Renove hoje mesmo!</p>

<p>
  Atenciosamente,<br>
  Equipe {{companyName}}
</p>
    `.trim(),
    type: 'error',
    urgency: 'high'
  },

  // Template 6: 3 dias (Crítico)
  {
    id: 'renewal-3-days',
    name: 'CRÍTICO - 3 Dias',
    daysBefore: 3,
    title: '🔴 CRÍTICO: {{serviceName}} expira em 3 dias!',
    message: '🔴 SITUAÇÃO CRÍTICA: {{serviceName}} expira em 3 dias ({{expirationDate}}). RENOVAÇÃO URGENTE para evitar perda de serviço!',
    emailSubject: '🔴 CRÍTICO: {{serviceName}} - Apenas 3 dias! Renove AGORA',
    emailBody: `
Olá {{clientName}},

<div style="background: #fee2e2; border: 2px solid #dc2626; padding: 15px; margin: 10px 0;">
  <strong style="color: #dc2626; font-size: 18px;">⚠️ SITUAÇÃO CRÍTICA ⚠️</strong>
  <p style="margin: 10px 0; color: #991b1b;">
    Seu serviço <strong>{{serviceName}}</strong> expira em apenas <strong>3 DIAS</strong>!
  </p>
</div>

<h3 style="color: #dc2626;">🚨 RISCOS IMINENTES:</h3>
<ul style="color: #7f1d1d;">
  <li>✗ Suspensão TOTAL do serviço em {{expirationDate}}</li>
  <li>✗ Site completamente fora do ar</li>
  <li>✗ Todos os emails pararão</li>
  <li>✗ Risco real de PERDA DE DADOS</li>
  <li>✗ Taxas de reativação (até 50% mais caro)</li>
</ul>

<div style="background: #dbeafe; border: 2px solid #2563eb; padding: 15px; margin: 20px 0; text-align: center;">
  <p style="margin: 0 0 10px 0; font-weight: bold; color: #1e40af;">🛡️ PROTEJA SEU SERVIÇO AGORA</p>
  <a href="{{renewalLink}}" style="background: #dc2626; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
    RENOVAR AGORA →
  </a>
  <p style="margin: 10px 0 0 0; font-size: 14px; color: #1e40af;">
    Investimento: {{renewalPrice}}
  </p>
</div>

<p style="color: #7f1d1d;"><strong>⏰ NÃO HÁ MAIS TEMPO A PERDER!</strong></p>

<p>
  <strong>Contato de Emergência:</strong><br>
  📧 {{supportEmail}}<br>
  📞 {{supportPhone}}
</p>

<p style="color: #991b1b; font-weight: bold;">
  Este é um dos últimos avisos. Renove hoje para garantir seu serviço!
</p>

Urgente,<br>
Equipe {{companyName}}
    `.trim(),
    type: 'error',
    urgency: 'critical'
  },

  // Template 7: 1 dia (Último Aviso)
  {
    id: 'renewal-1-day',
    name: 'ÚLTIMO AVISO - 1 Dia',
    daysBefore: 1,
    title: '⚠️⚠️ ÚLTIMO AVISO: {{serviceName}} expira AMANHÃ!',
    message: '⚠️⚠️ ÚLTIMO AVISO: {{serviceName}} expira AMANHÃ ({{expirationDate}})! RENOVAÇÃO IMEDIATA necessária ou serviço será suspenso!',
    emailSubject: '⚠️⚠️ ÚLTIMO AVISO: {{serviceName}} expira AMANHÃ - Renove Imediatamente!',
    emailBody: `
<div style="background: #dc2626; color: white; padding: 20px; text-align: center; margin-bottom: 20px;">
  <h2 style="margin: 0; font-size: 24px;">⚠️ ÚLTIMO AVISO ⚠️</h2>
  <p style="margin: 10px 0 0 0; font-size: 16px;">
    Seu serviço expira <strong>AMANHÃ</strong>
  </p>
</div>

<p>Olá {{clientName}},</p>

<p style="font-size: 18px; color: #dc2626; font-weight: bold;">
  🚨 SITUAÇÃO EXTREMA 🚨
</p>

<p>
  Seu serviço <strong>{{serviceName}}</strong> <span style="color: #dc2626; font-weight: bold;">EXPIRA AMANHÃ</span> em {{expirationDate}}.
</p>

<div style="background: #fee2e2; border: 3px solid #dc2626; padding: 20px; margin: 20px 0;">
  <h3 style="margin-top: 0; color: #7f1d1d;">⚠️ CONSEQUÊNCIAS APÓS AMANHÃ:</h3>
  <ul style="color: #991b1b; font-weight: bold;">
    <li>Serviço SUSPENSO IMEDIATAMENTE</li>
    <li>Site INACESSÍVEL</li>
    <li>Emails SEM FUNCIONAMENTO</li>
    <li>Perda de dados em 30 dias</li>
    <li>Reativação mais cara</li>
  </ul>
</div>

<div style="text-align: center; margin: 30px 0;">
  <a href="{{renewalLink}}" style="background: #dc2626; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 18px; display: inline-block; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    🛡️ RENOVAR AGORA →
  </a>
  <p style="margin-top: 15px; font-size: 16px;">
    <strong>{{renewalPrice}}</strong> | Vencimento: <strong>{{expirationDate}}</strong>
  </p>
</div>

<p style="color: #7f1d1d; font-size: 16px; font-weight: bold;">
  ⏰ ESTA É SUA ÚLTIMA CHANCE ANTES DA SUSPENSÃO!
</p>

<p style="text-align: center;">
  <strong>Contato Urgente:</strong><br>
  📧 {{supportEmail}} | 📞 {{supportPhone}}
</p>

<p style="color: #dc2626; font-weight: bold; text-align: center;">
  NÃO IGNORE ESTE AVISO. RENOVE HOJE!
</p>

<p>
  Atenciosamente,<br>
  <strong>Equipe {{companyName}}</strong>
</p>
    `.trim(),
    type: 'error',
    urgency: 'critical'
  },

  // Template 8: Renovação Confirmada (Sucesso)
  {
    id: 'renewal-confirmed',
    name: 'Renovação Confirmada',
    daysBefore: 0,
    title: '✅ Renovação Confirmada - {{serviceName}}',
    message: 'Óptimo, {{clientName}}! Sua renovação de {{serviceName}} foi confirmada. Serviço garantido até {{expirationDate}}.',
    emailSubject: '✅ Renovação Confirmada: {{serviceName}} está garantido!',
    emailBody: `
<div style="background: #d1fae5; border: 2px solid #10b981; padding: 20px; text-align: center; margin-bottom: 20px;">
  <h2 style="margin: 0; color: #047857; font-size: 24px;">✅ RENOVAÇÃO CONFIRMADA!</h2>
</div>

<p>Olá {{clientName}},</p>

<p style="font-size: 18px; color: #047857;">
  <strong>Excelente notícia!</strong>
</p>

<p>
  Sua renovação do serviço <strong>{{serviceName}}</strong> foi <span style="color: #047857; font-weight: bold;">CONFIRMADA COM SUCESSO</span>!
</p>

<div style="background: #f0fdf4; border-left: 4px solid #10b981; padding: 20px; margin: 20px 0;">
  <h3 style="margin-top: 0; color: #047857;">📋 Detalhes da Renovação:</h3>
  <ul style="list-style: none; padding: 0;">
    <li>✅ Serviço: <strong>{{serviceName}}</strong></li>
    <li>✅ Valor Pago: <strong>{{renewalPrice}}</strong></li>
    <li>✅ Nova Data de Vencimento: <strong>{{expirationDate}}</strong></li>
    <li>✅ Status: <strong>ACTIVO</strong></li>
  </ul>
</div>

<p style="color: #047857; font-weight: bold;">
  🎉 Seu serviço está garantido e seguro!
</p>

<p>
  Agradecemos pela sua confiança. Continuaremos trabalhando para oferecer o melhor serviço.
</p>

<p>
  Se precisar de algo, estamos à disposição:<br>
  📧 {{supportEmail}} | 📞 {{supportPhone}}
</p>

<p>
  Atenciosamente,<br>
  <strong>Equipe {{companyName}}</strong>
</p>

<hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">

<p style="font-size: 12px; color: #6b7280; text-align: center;">
  Este é um email automático de confirmação. Por favor, não responda diretamente.
</p>
    `.trim(),
    type: 'success',
    urgency: 'low'
  }
]

// ============================================
// FUNÇÃO PARA PROCESSAR TEMPLATES
// ============================================

export interface TemplateVariables {
  clientName: string
  serviceName: string
  expirationDate: string
  daysRemaining: number
  renewalPrice: string
  renewalLink: string
  companyName: string
  supportEmail: string
  supportPhone: string
  // Links com autenticação automática para acesso direto quando logado
  dashboardAutoLoginLink?: string
  clientAreaAutoLoginLink?: string
}

export function processTemplate(
  template: RenewalTemplate,
  variables: TemplateVariables
): RenewalTemplate {
  const processed = { ...template }
  
  // Substituir variáveis em todos os campos de texto
  const replaceVars = (text: string): string => {
    return text
      .replace(/\{\{clientName\}\}/g, variables.clientName)
      .replace(/\{\{serviceName\}\}/g, variables.serviceName)
      .replace(/\{\{expirationDate\}\}/g, variables.expirationDate)
      .replace(/\{\{daysRemaining\}\}/g, variables.daysRemaining.toString())
      .replace(/\{\{renewalPrice\}\}/g, variables.renewalPrice)
      .replace(/\{\{renewalLink\}\}/g, variables.renewalLink)
      .replace(/\{\{companyName\}\}/g, variables.companyName)
      .replace(/\{\{supportEmail\}\}/g, variables.supportEmail)
      .replace(/\{\{supportPhone\}\}/g, variables.supportPhone)
  }
  
  processed.title = replaceVars(processed.title)
  processed.message = replaceVars(processed.message)
  processed.emailSubject = replaceVars(processed.emailSubject)
  
  // Processar corpo do email e adicionar cabeçalho/rodapé
  const processedBody = replaceVars(processed.emailBody)
  const header = emailHeader(variables.clientName, variables.companyName)
  const footer = emailFooter(variables.supportEmail, variables.supportPhone, variables.companyName)
  
  // Card de atenção é opcional - só adiciona se includeAttentionCard não for explicitamente false
  const includeAttentionCard = template.includeAttentionCard !== false
  // Usar links com autenticação automática se disponíveis
  const dashboardLink = variables.dashboardAutoLoginLink || 'https://visualdesignmoz.com/client'
  const clientAreaLink = variables.clientAreaAutoLoginLink || 'https://visualdesignmoz.com/client'
  const attentionCard = includeAttentionCard ? emailAttentionCard(variables.supportEmail, dashboardLink, clientAreaLink) : ''
  
  // Envolver o conteúdo principal no quadro com linha colorida conforme urgência
  const mainContent = wrapContentInFrame(processedBody, template.urgency)
  
  // Card de atenção fica FORA do quadro, aparecendo separadamente abaixo
  const fullContent = mainContent + (attentionCard ? `<div style="margin-top: 15px;">${attentionCard}</div>` : '')
  
  processed.emailBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${processed.emailSubject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Exo 2', sans-serif; background: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family: 'Exo 2', sans-serif;">
    <tr>
      <td align="center" style="padding: 10px 0; background: #f3f4f6; font-family: 'Exo 2', sans-serif;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.15); font-family: 'Exo 2', sans-serif;">
          <tr>
            <td>
              ${header}
            </td>
          </tr>
          <tr>
            <td style="padding: 20px;">
              ${fullContent}
            </td>
          </tr>
          <tr>
            <td>
              ${footer}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
  
  return processed
}

// ============================================
// CARREGAR TEMPLATES PERSONALIZADOS
// ============================================

const STORAGE_KEY = 'visualdesign_custom_templates'

export function loadCustomTemplates(): RenewalTemplate[] {
  if (typeof window === 'undefined') return defaultRenewalTemplates
  
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const customTemplates = JSON.parse(saved) as RenewalTemplate[]
      // Merge com templates padrão, mantendo customizações
      return defaultRenewalTemplates.map(defaultT => {
        const custom = customTemplates.find(t => t.id === defaultT.id)
        return custom || defaultT
      })
    }
  } catch (error) {
    console.error('Erro ao carregar templates personalizados:', error)
  }
  return defaultRenewalTemplates
}

// ============================================
// OBTER TEMPLATE POR DIAS
// ============================================

export function getTemplateByDays(days: number): RenewalTemplate | undefined {
  const templates = loadCustomTemplates()
  return templates.find(t => t.daysBefore === days)
}

export function getAllTemplates(): RenewalTemplate[] {
  return loadCustomTemplates()
}

export function getActiveReminderDays(): number[] {
  const templates = loadCustomTemplates()
  return templates
    .filter(t => t.daysBefore > 0)
    .map(t => t.daysBefore)
    .sort((a, b) => b - a) // Ordem decrescente
}

// ============================================
// PERSISTÊNCIA NO SERVIDOR (SUPABASE)
// ============================================

// Carregar templates do servidor (persistência permanente)
export async function loadTemplatesFromServer(): Promise<RenewalTemplate[]> {
  try {
    const response = await fetch('/api/admin/renewal-templates')
    if (!response.ok) {
      throw new Error('Erro ao carregar templates do servidor')
    }
    const data = await response.json()
    
    if (data.success && Array.isArray(data.templates) && data.templates.length > 0) {
      // Converter do formato do banco para o formato da aplicação, mantendo
      // os templates padrão para qualquer dia que ainda não tenha sido
      // customizado na base de dados (mesma lógica de merge do loadCustomTemplates).
      const fromDb: RenewalTemplate[] = data.templates.map((t: any) => ({
        id: t.template_id,
        name: t.name,
        daysBefore: t.days_before,
        title: t.title,
        message: t.message,
        emailSubject: t.email_subject,
        emailBody: t.email_body,
        type: t.type,
        urgency: t.urgency
      }))
      return defaultRenewalTemplates.map(defaultT => fromDb.find(t => t.id === defaultT.id) || defaultT)
    }
    return defaultRenewalTemplates
  } catch (error) {
    console.error('Erro ao carregar templates do servidor:', error)
    // Fallback para localStorage ou padrão
    return loadCustomTemplates()
  }
}

// Salvar templates no servidor (persistência permanente)
export async function saveTemplatesToServer(templates: RenewalTemplate[]): Promise<boolean> {
  try {
    const response = await fetch('/api/admin/renewal-templates', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ templates })
    })
    
    if (!response.ok) {
      // Tentar obter mensagem de erro da API
      let errorMessage = 'Erro ao salvar templates no servidor'
      try {
        const errorData = await response.json()
        if (errorData.error) {
          errorMessage = errorData.error
        }
      } catch (e) {
        // Se não conseguir parsear JSON, usa status
        errorMessage = `Erro ${response.status}: ${response.statusText}`
      }
      throw new Error(errorMessage)
    }
    
    const data = await response.json()
    
    // Também salvar no localStorage como backup/cache
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(templates))
    }
    
    return data.success === true
  } catch (error) {
    console.error('Erro ao salvar templates no servidor:', error)
    // Fallback: tentar salvar no localStorage apenas
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(templates))
      }
    } catch (e) {
      console.error('Erro ao salvar no localStorage:', e)
    }
    return false
  }
}

// ============================================
// CARREGAR TEMPLATES NO SERVIDOR (CRON — SEM fetch)
// ============================================

// Usado pelo cron (server-side): consulta a tabela diretamente com o client
// admin já disponível, em vez de chamar a própria API por HTTP. loadCustomTemplates()
// não serve aqui porque `typeof window === 'undefined'` no servidor faz sempre
// cair nos templates padrão, ignorando qualquer edição guardada em renewal_templates.
export async function getServerRenewalTemplates(
  admin: import('@supabase/supabase-js').SupabaseClient
): Promise<RenewalTemplate[]> {
  try {
    const { data, error } = await admin
      .from('renewal_templates')
      .select('*')
      .eq('is_active', true)

    if (error || !data || data.length === 0) {
      return defaultRenewalTemplates
    }

    const fromDb: RenewalTemplate[] = data.map((t: any) => ({
      id: t.template_id,
      name: t.name,
      daysBefore: t.days_before,
      title: t.title,
      message: t.message,
      emailSubject: t.email_subject,
      emailBody: t.email_body,
      type: t.type,
      urgency: t.urgency
    }))
    return defaultRenewalTemplates.map(defaultT => fromDb.find(t => t.id === defaultT.id) || defaultT)
  } catch (error) {
    console.error('[renewal-templates] Erro ao carregar do servidor:', error)
    return defaultRenewalTemplates
  }
}

// Resetar templates para padrão no servidor
export async function resetTemplatesOnServer(): Promise<boolean> {
  try {
    const response = await fetch('/api/admin/renewal-templates', {
      method: 'DELETE'
    })
    
    if (!response.ok) {
      throw new Error('Erro ao resetar templates no servidor')
    }
    
    // Limpar localStorage também
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY)
    }
    
    const data = await response.json()
    return data.success === true
  } catch (error) {
    console.error('Erro ao resetar templates no servidor:', error)
    return false
  }
}
