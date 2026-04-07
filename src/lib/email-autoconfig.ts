// Sistema de configurações automáticas para contas de e-mail
// Este arquivo mapeia domínios para seus servidores IMAP/SMTP e URLs de Webmail.

export interface DomainEmailConfig {
  imap: string;
  smtp: string;
  ports: { imap: number; smtp: number };
  ssl: boolean;
  webmail: string;
}

export const DOMAIN_CONFIGS: Record<string, DomainEmailConfig> = {
  'aamihe.com': {
    imap: 'mail.aamihe.com',
    smtp: 'mail.aamihe.com',
    ports: { imap: 993, smtp: 465 },
    ssl: true,
    webmail: 'https://aamihe.com:8090/snappymail/'
  },
  'oshercollective.com': {
    imap: 'mail.oshercollective.com',
    smtp: 'mail.oshercollective.com', 
    ports: { imap: 993, smtp: 465 },
    ssl: true,
    webmail: 'https://oshercollective.com:8090/snappymail/'
  },
  'visualdesigne.com': {
    imap: 'mail.visualdesigne.com',
    smtp: 'mail.visualdesigne.com',
    ports: { imap: 993, smtp: 465 },
    ssl: true,
    webmail: 'https://visualdesigne.com:8090/snappymail/'
  },
  'visualdesigne.pt': {
    imap: 'mail.visualdesigne.pt',
    smtp: 'mail.visualdesigne.pt',
    ports: { imap: 993, smtp: 465 },
    ssl: true,
    webmail: 'https://visualdesigne.pt:8090/snappymail/'
  }
};

/**
 * Retorna as configurações padrão do servidor principal para domínios não mapeados.
 */
export const getDefaultConfig = (domain?: string): DomainEmailConfig => {
  const host = domain ? `mail.${domain}` : '109.199.104.22';
  return {
    imap: host,
    smtp: host,
    ports: { imap: 993, smtp: 465 },
    ssl: true,
    webmail: domain ? `https://mail.${domain}:8090/snappymail/` : 'https://109.199.104.22:8090/snappymail/'
  };
};

/**
 * Detecta a configuração ideal baseada no email fornecido.
 */
export function detectDomainConfig(email: string): DomainEmailConfig {
  if (!email || !email.includes('@')) return getDefaultConfig();
  
  const domain = email.split('@')[1].toLowerCase();
  return DOMAIN_CONFIGS[domain] || getDefaultConfig(domain);
}
