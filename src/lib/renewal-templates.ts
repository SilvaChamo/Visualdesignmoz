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
// - {{invoiceNumber}} - Número da factura do ciclo de cobrança
// - {{invoiceDate}} - Data em que a factura foi gerada

// ============================================
// CABEÇALHO E RODAPÉ PADRÃO - CORES VISUALDESIGN
// ============================================
// Cores: Vermelho #dc2626, Cinza #374151, Preto #000000

// URL base do site - usa variável de ambiente ou fallback para o domínio de produção
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://visualdesignmoz.com'
// Imagens de email têm de ser sempre alcançáveis por quem as recebe — ao
// contrário de SITE_URL (usado em links "clique aqui"), nunca deve resolver
// para localhost mesmo quando NEXT_PUBLIC_SITE_URL aponta para lá em
// desenvolvimento local (o logo aparecia partido nos emails de erro do dev).
const ASSET_BASE_URL = /^https?:\/\/(localhost|127\.0\.0\.1)/i.test(SITE_URL)
  ? 'https://visualdesignmoz.com'
  : SITE_URL
// Logo horizontal (texto a branco, pensado para fundos escuros) — o mesmo já usado
// nos templates de mailmarketing (src/components/admin/EmailTemplates.tsx).
const LOGO_URL = `${ASSET_BASE_URL}/assets/Logo_horizontal_branco.png`
const LOGO_NATIVE_WIDTH = 2241
const LOGO_NATIVE_HEIGHT = 642
const LOGO_DISPLAY_WIDTH = 160
const LOGO_DISPLAY_HEIGHT = Math.round(LOGO_DISPLAY_WIDTH * (LOGO_NATIVE_HEIGHT / LOGO_NATIVE_WIDTH))

// Reset "à prova de bala" para o cabeçalho ficar mesmo colado às margens do
// cliente de email (sem tirar o padding interno dos cartões de conteúdo) —
// o Outlook (motor Word) ignora margin/padding:0 do body e acrescenta espaço
// à volta das tabelas por conta própria a menos que se anule explicitamente
// com mso-table-lspace/rspace e os atributos HTML4 no <body>. Nota: NÃO zerar
// padding de <td> em geral — isso tirava o respiro interno da saudação e do
// cartão de conteúdo, que têm o próprio padding inline de propósito.
const EMAIL_CLIENT_RESET_STYLE = `<style type="text/css">
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table { mso-table-lspace: 0pt !important; mso-table-rspace: 0pt !important; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; }
    .vd-cta-btn:hover { background: #dc2626 !important; }
    .vd-cta-btn-red:hover { background: #000000 !important; }
  </style>`

// Ícones de redes sociais (mesmo estilo circular usado em EmailTemplates.tsx).
const socialIconsHtml = () => `<table cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="padding:0 3px;"><a href="#" style="display:inline-block;width:20px;height:20px;line-height:20px;border-radius:50%;background:#dc2626;color:#fff;font-size:10px;font-weight:800;text-decoration:none;text-align:center;">f</a></td>
        <td style="padding:0 3px;"><a href="#" style="display:inline-block;width:20px;height:20px;line-height:20px;border-radius:50%;background:#dc2626;color:#fff;font-size:10px;font-weight:800;text-decoration:none;text-align:center;">in</a></td>
        <td style="padding:0 3px;"><a href="#" style="display:inline-block;width:20px;height:20px;line-height:20px;border-radius:50%;background:#dc2626;color:#fff;font-size:10px;font-weight:800;text-decoration:none;text-align:center;">ig</a></td>
      </tr></table>`

// Cabeçalho partilhado por todos os emails transaccionais: fundo esticado à
// largura total da página (igual ao email anterior e aos templates de
// mailmarketing), mas o conteúdo (logo + redes sociais) fica alinhado à
// mesma largura/margens do cartão de conteúdo (600px) — não à largura total
// do fundo. Logo à esquerda, redes sociais à direita — sem linha de destaque
// aqui (essa passou a ficar por cima do cartão de conteúdo, ver wrapContentInFrame).
export const emailHeader = (companyName: string) => `
<tr>
  <td align="center" style="background: linear-gradient(135deg, #000000 0%, #1a1a1a 50%, #000000 100%); padding: 16px 0;">
    <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%;">
      <tr>
        <td align="left" valign="middle">
          <img src="${LOGO_URL}"
               alt="${companyName}"
               width="${LOGO_DISPLAY_WIDTH}"
               height="${LOGO_DISPLAY_HEIGHT}"
               style="display: block; width: ${LOGO_DISPLAY_WIDTH}px; height: ${LOGO_DISPLAY_HEIGHT}px; border: 0; outline: none;" />
        </td>
        <td align="right" valign="middle">${socialIconsHtml()}</td>
      </tr>
    </table>
  </td>
</tr>
`.trim()

// Texto de utilizador entra sempre escapado no cartão.
export const escapeHtml = (text: string) =>
  String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

// Layout único de todos os e-mails (Silva, 26/10/2026): cabeçalho preto, e por
// baixo UM cartão com a linha vermelha em cima — "Olá: nome", título com linha,
// conteúdo e rodapé de uma linha, tudo lá dentro. Quem envia só fornece o título
// e o corpo; nada fica fora do cartão.
const EMAIL_FONT = "'Exo 2', sans-serif"

export const emailCard = (params: { clientName: string; title?: string; bodyHtml: string }) => `
<tr>
  <td align="center" style="padding: 24px 12px; background: #f3f4f6; font-family: ${EMAIL_FONT};">
    <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%; background: #ffffff; border: 1px solid #e5e7eb; border-top: 3px solid #dc2626; font-family: ${EMAIL_FONT};">
      <tr><td style="padding: 12px 24px 0 24px; font-size: 11px; color: #111827; text-align: left; font-family: ${EMAIL_FONT};">Olá: ${escapeHtml(params.clientName)}</td></tr>
      ${params.title ? `<tr><td style="padding: 6px 24px 0 24px; text-align: left;">
        <h2 style="margin: 0; padding: 0 0 8px 0; border-bottom: 1px solid #d1d5db; color: #1f2937; font-size: 18px; font-weight: bold; font-family: ${EMAIL_FONT};">${escapeHtml(params.title)}</h2>
      </td></tr>` : ''}
      <tr><td style="padding: 16px 24px 24px 24px; text-align: left; font-size: 14px; color: #4b5563; font-family: ${EMAIL_FONT};">${params.bodyHtml}</td></tr>
      <tr><td style="padding: 16px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; color: #374151; font-size: 11px; font-family: ${EMAIL_FONT};"><strong>VisualDESIGN</strong> &copy; ${new Date().getFullYear()} Todos os direitos reservados</td></tr>
    </table>
  </td>
</tr>
`.trim()

export const buildEmailDocument = (params: {
  companyName: string
  clientName: string
  title: string
  bodyHtml: string
  /** Título do separador/assunto, quando diferente do título do cartão. */
  docTitle?: string
}) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(params.docTitle || params.title)}</title>
  ${EMAIL_CLIENT_RESET_STYLE}
</head>
<body marginwidth="0" marginheight="0" topmargin="0" leftmargin="0" style="margin: 0; padding: 0; width: 100%; font-family: ${EMAIL_FONT}; font-size: 14px; background: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0; padding:0; font-family: ${EMAIL_FONT};">
    ${emailHeader(params.companyName)}
    ${emailCard({ clientName: params.clientName, title: params.title, bodyHtml: params.bodyHtml })}
  </table>
</body>
</html>
`.trim()

// Notificações admin livres (tab "Enviar Notificação" em Notificações → Servidor):
// layout em branco, sem cartão/linha de destaque nem botão pré-formatado — só o
// cabeçalho e rodapé partilhados, com espaço aberto para o título/mensagem que o
// admin escrever no formulário.
export const NOTIFICATION_SUPPORT_EMAIL = 'suporte@visualdesignmoz.com'
export const NOTIFICATION_SUPPORT_PHONE = '+258 85 242 5525'
export const NOTIFICATION_COMPANY_NAME = 'VisualDesign'

export function urgencyForNotificationType(type: string): string {
  switch (type) {
    case 'error': return 'critical'
    case 'warning': return 'medium'
    case 'success':
    case 'info':
    default: return 'low'
  }
}

export function buildSimpleNotificationEmailHtml(params: {
  clientName: string
  title: string
  message: string
  /** Corpo em HTML rico (editor "Enviar Notificação") — quando presente, substitui `message`
   *  no email (que fica em texto simples, usado só no sino de notificações do painel). */
  messageHtml?: string
  link?: string
  linkText?: string
  type: string
}): string {
  const { clientName, title, message, messageHtml, link, linkText, type } = params

  const messageBlock = messageHtml
    ? `<div style="color: #374151; font-size: 14px; line-height: 1.6; font-family: 'Exo 2', sans-serif; font-weight: normal;">${messageHtml}</div>`
    : `<p style="margin: 0; color: #374151; font-size: 14px; line-height: 1.6; white-space: pre-line; font-family: 'Exo 2', sans-serif; font-weight: normal;">${message}</p>`

  const body = `
    ${messageBlock}
    ${link ? `<p style="margin: 20px 0 0 0;"><a href="${link}" style="display: inline-block; padding: 8px 14px; background: #dc2626; color: #ffffff; text-decoration: none; border-radius: 2px; font-size: 12px; font-weight: bold; font-family: 'Exo 2', sans-serif;">${escapeHtml(linkText || 'Ver mais')} &rarr;</a></p>` : ''}
  `

  return buildEmailDocument({
    companyName: NOTIFICATION_COMPANY_NAME,
    clientName,
    title,
    bodyHtml: wrapContentInFrame(body, urgencyForNotificationType(type)),
  })
}

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

// Sem caixa/cartão nem linha de destaque — a cor de urgência (getUrgencyColor)
// passou a ficar só no cartão "Preview ao Vivo" do dashboard, não no email.
export const wrapContentInFrame = (content: string, _urgency: string) => `
<div style="font-family: 'Exo 2', sans-serif; font-size: 14px; color: #1f2937;">
  ${content}
</div>
  `.trim()

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
  // Template 0: 90 dias = 3 meses (Primeiro aviso; Silva, 24/10/2026: "avisar o utilizador desde os 3 meses")
  {
    id: 'renewal-90-days',
    name: 'Renovação em 3 Meses',
    daysBefore: 90,
    title: '🔔 Renovação em 3 meses - {{serviceName}}',
    message: 'Olá {{clientName}}, o seu {{serviceName}} expira em 3 meses ({{expirationDate}}). Renove com tempo: se não for renovado até ao último dia, o serviço é suspenso.',
    emailSubject: '🔔 {{serviceName}} expira em 3 meses ({{expirationDate}})',
    emailBody: `
<p>Faltam <strong>3 meses</strong> para o fim do prazo do seu serviço <strong>{{serviceName}}</strong>.</p>
<div style="background:#f8fafc;border-left:4px solid #3b82f6;padding:20px;margin:25px 0;">
  <p style="margin:8px 0;"><strong>📅 Último dia:</strong> {{expirationDate}}</p>
  <p style="margin:8px 0;"><strong>💰 Renovação:</strong> {{renewalPrice}}</p>
  <p style="margin:8px 0;"><strong>Faltam:</strong> {{daysRemaining}} dias</p>
</div>
<div style="text-align:left;margin:24px 0;">
  <a href="{{renewalLink}}" class="vd-cta-btn" style="display:inline-block;background:#000000;color:white;padding:10px 24px;text-decoration:none;border-radius:4px;font-weight:bold;font-size:14px;">RENOVAR AGORA</a>
</div>
<p style="font-size:14px;color:#64748b;">Avisamos de novo aos 60, 45, 30, 15, 7, 3 e 1 dias. <strong>Se o serviço não for renovado até ao último dia, é suspenso</strong>; volta a funcionar quando a renovação for paga.</p>
    `.trim(),
    type: 'info',
    urgency: 'low'
  },

  // Template 1: 60 dias (Primeiro aviso)
  {
    id: 'renewal-60-days',
    name: 'Renovação em 60 Dias',
    daysBefore: 60,
    title: '🔔 Renovação em Breve - {{serviceName}}',
    message: 'Olá {{clientName}}, seu {{serviceName}} expira em 60 dias ({{expirationDate}}). Renove agora para evitar interrupções no serviço.',
    emailSubject: '🔔 Lembrete: Renovação de {{serviceName}} em 60 dias',
    emailBody: `
<p>Este é um aviso de que uma factura nº <strong>{{invoiceNumber}}</strong>, de cobrança de serviços de hospedagem, foi gerada no dia <strong>{{invoiceDate}}</strong> e vence no dia <strong>{{expirationDate}}</strong>, faltam apenas: {{daysRemaining}} dias.</p>
<div style="border:1px solid #e5e7eb;border-radius:4px;margin:25px 0;overflow:hidden;">
  <div style="padding:10px 15px;background:#f9fafb;border-bottom:1px solid #e5e7eb;font-size:13px;color:#6b7280;font-weight:600;">Descrição dos Serviços</div>
  <div style="padding:16px;font-size:14px;color:#374151;">
    <p style="margin:6px 0;"><strong>Forma de Pagamento:</strong> {{paymentMethod}}</p>
    <p style="margin:6px 0;"><strong>Detalhes:</strong> Renovação de {{serviceName}}</p>
    <p style="margin:6px 0;"><strong>Vencimento:</strong> {{expirationDate}}</p>
    <p style="margin:6px 0;"><strong>Faltam apenas:</strong> {{daysRemaining}} dias</p>
    <hr style="border:none;border-top:1px dashed #d1d5db;margin:14px 0;">
    <p style="margin:4px 0;">Sub-total: {{subtotal}}</p>
    <p style="margin:4px 0;">Crédito: {{creditAmount}}</p>
    <p style="margin:4px 0;font-weight:bold;">Total: {{renewalPrice}}</p>
  </div>
</div>
<p><strong>Observação:</strong> Para prosseguir com o pagamento clique no botão pagar agora.</p>
<div style="text-align:left;margin:24px 0;">
  <a href="{{renewalLink}}" class="vd-cta-btn-red" style="display:inline-block;background:#dc2626;color:white;padding:12px 30px;text-decoration:none;border-radius:5px;font-weight:bold;font-size:14px;">PAGAR AGORA</a>
</div>
<p style="font-size:14px;color:#64748b;">Renovando com antecedência, garante a continuidade do serviço sem interrupções e evita taxas de reactivação.</p>
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
<div style="text-align:left;margin:24px 0;">
  <a href="{{renewalLink}}" class="vd-cta-btn" style="display:inline-block;background:#000000;color:white;padding:10px 24px;text-decoration:none;border-radius:4px;font-weight:bold;font-size:14px;">RENOVAR AGORA →</a>
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

<div style="text-align:left;margin:24px 0;">
  <a href="{{renewalLink}}" class="vd-cta-btn" style="display:inline-block;background:#000000;color:white;padding:10px 24px;text-decoration:none;border-radius:4px;font-weight:bold;font-size:14px;">🛡️ PROTEJA SEU SERVIÇO AGORA →</a>
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

<div style="background: #dbeafe; border: 2px solid #2563eb; padding: 15px; margin: 20px 0; text-align: left;">
  <p style="margin: 0 0 10px 0; font-weight: bold; color: #1e40af;">🛡️ PROTEJA SEU SERVIÇO AGORA</p>
  <a href="{{renewalLink}}" class="vd-cta-btn-red" style="background: #dc2626; color: white; padding: 10px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">
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

<div style="background: #dbeafe; border: 2px solid #2563eb; padding: 15px; margin: 20px 0; text-align: left;">
  <p style="margin: 0 0 10px 0; font-weight: bold; color: #1e40af;">⏰ ACÇÃO IMEDIATA NECESSÁRIA!</p>
  <a href="{{renewalLink}}" class="vd-cta-btn-red" style="background: #dc2626; color: white; padding: 10px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">
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

<div style="background: #dbeafe; border: 2px solid #2563eb; padding: 15px; margin: 20px 0; text-align: left;">
  <p style="margin: 0 0 10px 0; font-weight: bold; color: #1e40af;">🛡️ PROTEJA SEU SERVIÇO AGORA</p>
  <a href="{{renewalLink}}" class="vd-cta-btn-red" style="background: #dc2626; color: white; padding: 10px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">
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

<div style="text-align: left; margin: 24px 0;">
  <a href="{{renewalLink}}" class="vd-cta-btn-red" style="background: #dc2626; color: white; padding: 10px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; font-size: 14px; display: inline-block;">
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
  // Método de pagamento habitual do cliente (último usado numa renovação real).
  // Sem histórico, vem como "A escolher no pagamento" — nunca inventado.
  paymentMethod?: string
  // Valor cheio antes de aplicar crédito, e crédito disponível do cliente
  // (client_credits). renewalPrice já vem com o crédito descontado (o valor
  // que falta mesmo pagar) — subtotal/creditAmount são só para mostrar a conta.
  subtotal?: string
  creditAmount?: string
  // Links com autenticação automática para acesso direto quando logado
  dashboardAutoLoginLink?: string
  clientAreaAutoLoginLink?: string
  // Número da factura do ciclo de cobrança actual e data em que foi gerada.
  // Atribuído uma única vez por ciclo (service + expirationDate) e reutilizado
  // em todos os lembretes seguintes — ver assign_renewal_invoice_number()
  // (supabase-renewal-invoices.sql) e o cron em api/cron/renewal-check.
  invoiceNumber?: string
  invoiceDate?: string
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
      .replace(/\{\{paymentMethod\}\}/g, variables.paymentMethod || 'A escolher no pagamento')
      .replace(/\{\{subtotal\}\}/g, variables.subtotal || variables.renewalPrice)
      .replace(/\{\{creditAmount\}\}/g, variables.creditAmount || '0,00 MT')
      .replace(/\{\{invoiceNumber\}\}/g, variables.invoiceNumber || 'A gerar')
      .replace(/\{\{invoiceDate\}\}/g, variables.invoiceDate || '—')
  }
  
  processed.title = replaceVars(processed.title)
  processed.message = replaceVars(processed.message)
  processed.emailSubject = replaceVars(processed.emailSubject)
  
  // Corpo do email dentro do cartão único (ver emailCard). A saudação "Olá: nome"
  // já vem no topo do cartão, por isso tira-se a linha "Olá nome," que os modelos
  // (também os guardados no servidor) repetem no início do texto.
  const nomeEscapado = variables.clientName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const processedBody = replaceVars(processed.emailBody).replace(
    new RegExp(`(<p[^>]*>\\s*)?Olá\\s+${nomeEscapado}\\s*,\\s*(</p>)?`, 'gi'),
    '',
  ).trim()

  // Card de atenção é opcional - só adiciona se includeAttentionCard não for explicitamente false
  const includeAttentionCard = template.includeAttentionCard !== false
  // Usar links com autenticação automática se disponíveis
  const dashboardLink = variables.dashboardAutoLoginLink || 'https://visualdesignmoz.com/client'
  const clientAreaLink = variables.clientAreaAutoLoginLink || 'https://visualdesignmoz.com/client'
  const attentionCard = includeAttentionCard ? emailAttentionCard(variables.supportEmail, dashboardLink, clientAreaLink) : ''

  const mainContent = wrapContentInFrame(processedBody, template.urgency)
  const fullContent = mainContent + (attentionCard ? `<div style="margin-top: 15px;">${attentionCard}</div>` : '')

  processed.emailBody = buildEmailDocument({
    companyName: variables.companyName,
    clientName: variables.clientName,
    title: processed.emailSubject,
    bodyHtml: fullContent,
  })

  return processed
}

// ============================================
// CARREGAR TEMPLATES PERSONALIZADOS
// ============================================

const STORAGE_KEY = 'visualdesign_custom_templates'

function mergeTemplatesWithDefaults(customTemplates: RenewalTemplate[] | null | undefined): RenewalTemplate[] {
  const source = Array.isArray(customTemplates) ? customTemplates : []
  return defaultRenewalTemplates.map(defaultT => {
    const custom = source.find(t => t.id === defaultT.id)
    return custom || defaultT
  })
}

export function loadCustomTemplates(): RenewalTemplate[] {
  if (typeof window === 'undefined') return defaultRenewalTemplates

  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const customTemplates = JSON.parse(saved) as RenewalTemplate[]
      return mergeTemplatesWithDefaults(customTemplates)
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

export type TemplatesLoadResult = {
  templates: RenewalTemplate[]
  /** De onde vieram os dados mostrados — 'server' é o único caso "saudável". */
  source: 'server' | 'localStorage' | 'default'
  /** Motivo da falha, quando source !== 'server' — para mostrar ao utilizador em vez de falhar em silêncio. */
  error?: string
}

// Carregar templates do servidor (persistência permanente)
export async function loadTemplatesFromServer(): Promise<TemplatesLoadResult> {
  try {
    const response = await fetch('/api/admin/renewal-templates', { cache: 'no-store' })
    if (!response.ok) {
      let reason = `Erro ${response.status} ao carregar templates do servidor`
      try {
        const errBody = await response.json()
        if (errBody?.error) reason = errBody.error
      } catch {
        // corpo não é JSON — mantém a mensagem genérica com o status
      }
      throw new Error(reason)
    }
    const data = await response.json()

    if (data.success && Array.isArray(data.templates)) {
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

      if (fromDb.length > 0) {
        return {
          templates: mergeTemplatesWithDefaults(fromDb),
          source: 'server',
        }
      }
    }

    // Se o servidor responder sem templates utilizáveis, tenta usar a cópia local
    // do browser para não perder as edições feitas recentemente.
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
      if (saved) {
        const customTemplates = JSON.parse(saved) as RenewalTemplate[]
        return {
          templates: mergeTemplatesWithDefaults(customTemplates),
          source: 'localStorage',
          error: 'O servidor não devolveu templates válidos; a mostrar a cópia guardada localmente.'
        }
      }
    } catch (e) {
      console.error('Erro ao carregar do localStorage:', e)
    }

    return { templates: defaultRenewalTemplates, source: 'server' }
  } catch (error: any) {
    console.error('Erro ao carregar templates do servidor:', error)
    // Fallback para localStorage ou padrão — mas sem esconder o motivo da falha
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
      if (saved) {
        const customTemplates = JSON.parse(saved) as RenewalTemplate[]
        return { templates: mergeTemplatesWithDefaults(customTemplates), source: 'localStorage', error: error?.message }
      }
    } catch (e) {
      console.error('Erro ao carregar do localStorage:', e)
    }
    return { templates: defaultRenewalTemplates, source: 'default', error: error?.message }
  }
}

// Salvar templates no servidor (persistência permanente)
export async function saveTemplatesToServer(templates: RenewalTemplate[]): Promise<boolean> {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(templates))
    }

    const response = await fetch('/api/admin/renewal-templates', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ templates }),
      cache: 'no-store'
    })
    
    if (!response.ok) {
      // Tentar obter mensagem de erro da API
      let errorMessage = 'Erro ao guardar modelos no servidor'
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
    console.error('Erro ao guardar modelos no servidor:', error)
    // Fallback: tentar salvar no localStorage apenas
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(templates))
      }
    } catch (e) {
      console.error('Erro ao guardar no localStorage:', e)
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
