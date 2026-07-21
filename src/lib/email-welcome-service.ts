/**
 * Serviço de Email de Boas-Vindas
 * Envia configurações automáticas quando uma conta de email é criada
 */

import { detectDomainConfig } from './email-autoconfig';

export interface EmailAccountInfo {
  email: string;
  password: string;
  domain: string;
  username: string;
  quota: string;
  contactEmail?: string;
}

export interface ServerConfig {
  ip: string;
  nameservers: string[];
  package?: string;
}

const TERMS_AND_CONDITIONS_WARMUP = `
TERMOS E CONDIÇÕES - SISTEMA DE AQUECIMENTO DE EMAIL (WARM-UP)

1. SISTEMA DE AQUECIMENTO PROGRESSIVO
Ao criar esta conta de email, o cliente aceita participar no sistema de warm-up automático 
que protege a reputação do domínio e garante melhor entregabilidade.

2. LIMITES DE ENVIO PROGRESSIVOS
- Dias 0-1 (NOVO): Máximo 50 emails/dia
- Dias 2-3 (INICIAL): Máximo 100 emails/dia  
- Dias 4-7 (CRESCENDO): Máximo 300 emails/dia
- Dias 8-14 (ESTÁVEL): Máximo 600 emails/dia
- Dias 15-30 (MADURO): Máximo 1000 emails/dia
- Após 30 dias (PREMIUM): Máximo 2000 emails/dia

3. MONITORAMENTO DE REPUTAÇÃO
O sistema monitora automaticamente:
- Taxa de bounce (devoluções)
- Taxa de reclamações (spam)
- Volume de envios diários
- Histórico de entregas

4. BLOQUEIOS AUTOMÁTICOS
O sistema pode bloquear temporariamente envios se:
- Taxa de bounce exceder 5%
- Taxa de reclamações exceder 0.1%
- Limite diário for atingido
- Reputação do domínio cair abaixo de 50/100

5. RESPONSABILIDADES DO CLIENTE
- Manter lista de contactos limpa e actualizada
- Não enviar spam ou conteúdo não solicitado
- Respeitar limites diários impostos pelo sistema
- Não tentar burlar o sistema de warm-up

6. BENEFÍCIOS DO SISTEMA
- Protecção automática contra blacklists
- Melhor taxa de entrega para inbox
- Reputação protegida do domínio
- Monitoramento contínuo 24/7

7. ACEITAÇÃO
Ao utilizar esta conta de email marketing, o cliente confirma que:
✓ Leu e compreendeu estes termos
✓ Aceita os limites progressivos de envio
✓ Compromete-se a seguir boas práticas de email marketing
✓ Entende que o sistema bloqueia automaticamente envios abusivos

Para mais informações: admin@visualdesignmoz.com
`;

/**
 * Gera o conteúdo HTML do email de boas-vindas
 */
export function generateWelcomeEmailHTML(account: EmailAccountInfo, serverConfig: ServerConfig): string {
  const domainConfig = detectDomainConfig(account.email);
  
  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Nova Conta de Email - ${account.domain}</title>
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; background: #f5f5f5; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
        .content { padding: 30px; }
        .info-box { background: #f8fafc; border-left: 4px solid #3b82f6; padding: 20px; margin: 20px 0; border-radius: 4px; }
        .info-box h3 { margin-top: 0; color: #1e3a8a; font-size: 16px; }
        .data-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0; }
        .data-row:last-child { border-bottom: none; }
        .label { font-weight: 600; color: #64748b; }
        .value { font-family: 'Courier New', monospace; color: #1e293b; font-weight: 500; }
        .password { background: #fef3c7; padding: 2px 8px; border-radius: 4px; color: #92400e; }
        .config-section { background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .config-section h3 { color: #166534; margin-top: 0; }
        .config-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 15px; }
        .config-item { background: white; padding: 12px; border-radius: 6px; border: 1px solid #bbf7d0; }
        .config-item h4 { margin: 0 0 5px 0; color: #15803d; font-size: 13px; }
        .config-item p { margin: 0; font-family: 'Courier New', monospace; font-size: 12px; color: #374151; }
        .warning-box { background: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .warning-box h3 { color: #92400e; margin-top: 0; }
        .warning-box ul { margin: 10px 0; padding-left: 20px; }
        .warning-box li { margin: 5px 0; color: #78350f; }
        .footer { background: #f8fafc; padding: 20px; text-align: center; color: #64748b; font-size: 12px; border-top: 1px solid #e2e8f0; }
        .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 10px 0; }
        .button:hover { background: #2563eb; }
        .divider { height: 1px; background: #e2e8f0; margin: 25px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎉 Nova Conta de Email Criada</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Bem-vindo ao VisualDesign Email Marketing</p>
        </div>
        
        <div class="content">
            <p>Olá <strong>${account.username}</strong>,</p>
            <p>A sua conta de email foi criada com sucesso! Aqui estão os dados de acesso e configurações:</p>
            
            <div class="info-box">
                <h3>📧 Dados da Conta</h3>
                <div class="data-row">
                    <span class="label">Email:</span>
                    <span class="value">${account.email}</span>
                </div>
                <div class="data-row">
                    <span class="label">Password:</span>
                    <span class="value password">${account.password}</span>
                </div>
                <div class="data-row">
                    <span class="label">Domínio:</span>
                    <span class="value">${account.domain}</span>
                </div>
                <div class="data-row">
                    <span class="label">Quota:</span>
                    <span class="value">${account.quota}</span>
                </div>
                <div class="data-row">
                    <span class="label">Servidor IP:</span>
                    <span class="value">${serverConfig.ip}</span>
                </div>
                ${serverConfig.package ? `
                <div class="data-row">
                    <span class="label">Package:</span>
                    <span class="value">${serverConfig.package}</span>
                </div>
                ` : ''}
            </div>
            
            <div class="info-box">
                <h3>🌐 NameServers</h3>
                ${serverConfig.nameservers.map((ns, i) => `
                <div class="data-row">
                    <span class="label">NS${i + 1}:</span>
                    <span class="value">${ns}</span>
                </div>
                `).join('')}
            </div>
            
            <div class="config-section">
                <h3>⚙️ Configurações para Outlook / Thunderbird / Apple Mail</h3>
                
                <div class="config-grid">
                    <div class="config-item">
                        <h4>📥 IMAP (Receber)</h4>
                        <p>Servidor: ${domainConfig.imap}</p>
                        <p>Porta: ${domainConfig.ports.imap}</p>
                        <p>Segurança: SSL/TLS</p>
                    </div>
                    <div class="config-item">
                        <h4>📤 SMTP (Enviar)</h4>
                        <p>Servidor: ${domainConfig.smtp}</p>
                        <p>Porta: ${domainConfig.ports.smtp}</p>
                        <p>Segurança: SSL/TLS</p>
                    </div>
                </div>
                
                <div style="margin-top: 15px; padding: 12px; background: white; border-radius: 6px; border: 1px solid #bbf7d0;">
                    <h4 style="margin: 0 0 8px 0; color: #15803d;">🔐 Autenticação</h4>
                    <p style="margin: 0; font-family: 'Courier New', monospace; font-size: 12px; color: #374151;">
                        Username: ${account.email}<br>
                        Password: ${account.password}<br>
                        Método: Normal password
                    </p>
                </div>
            </div>
            
            <div class="warning-box">
                <h3>🚀 Sistema de Aquecimento (Warm-up) - IMPORTANTE</h3>
                <p style="margin: 0 0 10px 0; color: #78350f;">
                    Para proteger a reputação do seu domínio e garantir melhor entregabilidade, 
                    implementamos um sistema de warm-up automático:
                </p>
                <ul>
                    <li><strong>Dias 0-1:</strong> Máximo 50 emails/dia</li>
                    <li><strong>Dias 2-3:</strong> Máximo 100 emails/dia</li>
                    <li><strong>Dias 4-7:</strong> Máximo 300 emails/dia</li>
                    <li><strong>Dias 8-14:</strong> Máximo 600 emails/dia</li>
                    <li><strong>Dias 15-30:</strong> Máximo 1000 emails/dia</li>
                    <li><strong>Após 30 dias:</strong> Até 2000 emails/dia</li>
                </ul>
                <p style="margin: 10px 0 0 0; color: #92400e; font-weight: 600;">
                    ⚠️ O sistema bloqueia automaticamente envios que excedam estes limites 
                    ou que apresentem taxas de bounce elevadas.
                </p>
            </div>
            
            <div class="divider"></div>
            
            <p style="text-align: center;">
                <a href="${domainConfig.webmail}" class="button" target="_blank">
                    Aceder ao Webmail
                </a>
            </p>
            
            <p style="font-size: 12px; color: #64748b; text-align: center; margin-top: 20px;">
                Contacto de suporte: ${account.contactEmail || 'admin@visualdesignmoz.com'}
            </p>
        </div>
        
        <div class="footer">
            <p>© ${new Date().getFullYear()} VisualDesign - Todos os direitos reservados</p>
            <p style="margin: 5px 0 0 0;">Esta é uma mensagem automática. Por favor não responda.</p>
        </div>
    </div>
</body>
</html>
`;
}

/**
 * Gera o conteúdo texto plano do email (para clientes que não suportam HTML)
 */
export function generateWelcomeEmailText(account: EmailAccountInfo, serverConfig: ServerConfig): string {
  const domainConfig = detectDomainConfig(account.email);
  
  return `
===================================
NOVA CONTA DE EMAIL - ${account.domain}
===================================

Olá ${account.username},

A sua conta de email foi criada com sucesso!

DADOS DA CONTA:
-----------------------------------
Email: ${account.email}
Password: ${account.password}
Domínio: ${account.domain}
Quota: ${account.quota}
Servidor IP: ${serverConfig.ip}
${serverConfig.package ? `Package: ${serverConfig.package}` : ''}

NAMESERVERS:
-----------------------------------
${serverConfig.nameservers.map((ns, i) => `NS${i + 1}: ${ns}`).join('\n')}

CONFIGURAÇÕES DE EMAIL (Outlook/Thunderbird):
-----------------------------------
📥 IMAP (Receber):
   Servidor: ${domainConfig.imap}
   Porta: ${domainConfig.ports.imap}
   Segurança: SSL/TLS

📤 SMTP (Enviar):
   Servidor: ${domainConfig.smtp}
   Porta: ${domainConfig.ports.smtp}
   Segurança: SSL/TLS

🔐 Autenticação:
   Username: ${account.email}
   Password: ${account.password}
   Método: Normal password

🚀 SISTEMA DE AQUECIMENTO (WARM-UP):
-----------------------------------
Para proteger a reputação do seu domínio:

• Dias 0-1: Máximo 50 emails/dia
• Dias 2-3: Máximo 100 emails/dia
• Dias 4-7: Máximo 300 emails/dia
• Dias 8-14: Máximo 600 emails/dia
• Dias 15-30: Máximo 1000 emails/dia
• Após 30 dias: Até 2000 emails/dia

⚠️ O sistema bloqueia automaticamente envios que excedam estes limites.

Webmail: ${domainConfig.webmail}
Suporte: ${account.contactEmail || 'admin@visualdesignmoz.com'}

===================================
© ${new Date().getFullYear()} VisualDesign
===================================
`;
}

/**
 * Gera arquivo de configuração para Outlook (.prf ou similar)
 */
export function generateOutlookConfigFile(account: EmailAccountInfo, serverConfig: ServerConfig): string {
  const domainConfig = detectDomainConfig(account.email);
  
  return `; Outlook Configuration File
; Generated by VisualDesign Email System
; Account: ${account.email}
; Date: ${new Date().toISOString()}

[General]
Custom=1
ProfileName=${account.domain}
DefaultProfile=Yes

[Service1]
ServiceName=Microsoft Outlook Client
MDBGUID=5494A1C0-6DD1-11d0-9C2F-00A0C91619C5

[Service2]
ServiceName=Internet E-mail
MDBGUID=002F0C0A-6EE5-11d0-9C2F-00A0C91619C5

[Internet E-mail]
AccountName=${account.email}
EmailAddress=${account.email}
IMAPServer=${domainConfig.imap}
IMAPPort=${domainConfig.ports.imap}
IMAPUseSSL=1
IMAPAuth=1
SMTPServer=${domainConfig.smtp}
SMTPPort=${domainConfig.ports.smtp}
SMTPUseSSL=1
SMTPAuth=1
UserName=${account.email}
Password=${account.password}
ReplyToAddress=${account.email}
FullName=${account.username}
Organization=${account.domain}

[Nameservers]
${serverConfig.nameservers.map((ns, i) => `NS${i + 1}=${ns}`).join('\n')}

[Account Info]
Domain=${account.domain}
IP=${serverConfig.ip}
Quota=${account.quota}
Created=${new Date().toISOString()}
`;
}

/**
 * Retorna os termos e condições do warm-up
 */
export function getWarmupTermsAndConditions(): string {
  return TERMS_AND_CONDITIONS_WARMUP;
}

/**
 * Gera o HTML dos termos e condições para aceitação
 */
export function generateTermsHTML(): string {
  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
        h1 { color: #1e3a8a; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; }
        h2 { color: #1e40af; margin-top: 30px; }
        .highlight { background: #fef3c7; padding: 2px 6px; border-radius: 3px; }
        .warning { background: #fee2e2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; }
        .success { background: #d1fae5; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; }
        ul { line-height: 2; }
        li { margin: 8px 0; }
    </style>
</head>
<body>
    <h1>📋 Termos e Condições - Sistema de Email Marketing</h1>
    
    <div class="success">
        <strong>✓ Sistema de Warm-up Automático</strong><br>
        Protegemos a reputação do seu domínio para garantir que seus emails cheguem à caixa de entrada.
    </div>
    
    <h2>🚀 Limites de Envio Progressivos</h2>
    <p>O sistema aplica limites automáticos baseados na idade do domínio:</p>
    <ul>
        <li><span class="highlight">NOVO (Dias 0-1):</span> 50 emails/dia</li>
        <li><span class="highlight">INICIAL (Dias 2-3):</span> 100 emails/dia</li>
        <li><span class="highlight">CRESCENDO (Dias 4-7):</span> 300 emails/dia</li>
        <li><span class="highlight">ESTÁVEL (Dias 8-14):</span> 600 emails/dia</li>
        <li><span class="highlight">MADURO (Dias 15-30):</span> 1000 emails/dia</li>
        <li><span class="highlight">PREMIUM (30+ dias):</span> 2000 emails/dia</li>
    </ul>
    
    <h2>🛡️ Protecções Automáticas</h2>
    <div class="warning">
        <strong>⚠️ Bloqueios Automáticos:</strong>
        <ul style="margin: 10px 0;">
            <li>Taxa de bounce > 5% → Pausa automática</li>
            <li>Taxa de reclamações > 0.1% → Revisão obrigatória</li>
            <li>Reputação < 50/100 → Limites reduzidos</li>
            <li>Excesso de limite diário → Bloqueio temporário</li>
        </ul>
    </div>
    
    <h2>✓ Compromissos do Cliente</h2>
    <ul>
        <li>Manter lista de contactos actualizada e válida</li>
        <li>Não enviar spam ou conteúdo não solicitado</li>
        <li>Respeitar os limites impostos pelo sistema</li>
        <li>Seguir boas práticas de email marketing</li>
    </ul>
    
    <h2>📈 Benefícios</h2>
    <ul>
        <li>✓ Protecção automática contra blacklists</li>
        <li>✓ Melhor taxa de entrega (inbox vs spam)</li>
        <li>✓ Reputação do domínio protegida</li>
        <li>✓ Monitoramento contínuo 24/7</li>
        <li>✓ Aumento automático de limites com boa reputação</li>
    </ul>
    
    <p style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280;">
        Ao criar esta conta, confirma que leu e aceita estes termos.<br>
        VisualDesign - ${new Date().getFullYear()}
    </p>
</body>
</html>
`;
}
