import { getServerHost, getCPUrl, getSnappyMailUrl } from './server-config';

// Sistema de configurações automáticas para contas de e-mail
// Este arquivo mapeia domínios para seus servidores IMAP/SMTP e URLs de Webmail.

export interface DomainEmailConfig {
  imap: string;
  smtp: string;
  ports: { imap: number; smtp: number };
  ssl: boolean;
  secure?: boolean; // true = SSL direto (465), false = STARTTLS (587)
  webmail: string;
}

/**
 * Retorna as configurações padrão do servidor principal para domínios não mapeados.
 * Garante que todos os painéis herdem o servidor master por padrão.
 */
export const getDefaultConfig = (domain?: string): DomainEmailConfig => {
  const host = getServerHost();
  return {
    imap: host,
    smtp: host,
    ports: { imap: 993, smtp: 587 },
    ssl: true,
    secure: false, // 587 = STARTTLS
    webmail: getSnappyMailUrl(domain)
  };
};

// Configurações de email - Dinâmicas baseadas no servidor configurado
export const DOMAIN_CONFIGS: Record<string, DomainEmailConfig> = {
  'aamihe.com': getDefaultConfig('aamihe.com'),
  'visualdesignmoz.com': getDefaultConfig('visualdesignmoz.com'),
  'visualdesigne.pt': getDefaultConfig('visualdesigne.pt'),
  'anap.co.mz': getDefaultConfig('anap.co.mz'),
  'entrecampos.co.mz': getDefaultConfig('entrecampos.co.mz')
};

/**
 * Detecta a configuração ideal baseada no email fornecido.
 */
export function detectDomainConfig(email: string): DomainEmailConfig {
  if (!email || !email.includes('@')) return getDefaultConfig();
  
  const domain = email.split('@')[1].toLowerCase();
  return DOMAIN_CONFIGS[domain] || getDefaultConfig(domain);
}
