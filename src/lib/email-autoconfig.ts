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

// Configurações de email - Todas sincronizadas com o servidor CyberPanel (109.199.104.22)
// onde o SnappyMail está instalado
export const DOMAIN_CONFIGS: Record<string, DomainEmailConfig> = {
  'aamihe.com': {
    imap: '109.199.104.22', // Servidor CyberPanel (mesmo do SnappyMail)
    smtp: '109.199.104.22',
    ports: { imap: 993, smtp: 587 },
    ssl: true,
    secure: false,
    webmail: 'https://109.199.104.22:8090/snappymail/index.php'
  },
  'visualdesigne.com': {
    imap: '109.199.104.22', // Servidor CyberPanel (mesmo do SnappyMail)
    smtp: '109.199.104.22',
    ports: { imap: 993, smtp: 587 },
    ssl: true,
    secure: false,
    webmail: 'https://109.199.104.22:8090/snappymail/index.php'
  },
  'visualdesigne.pt': {
    imap: '109.199.104.22', // Servidor CyberPanel (mesmo do SnappyMail)
    smtp: '109.199.104.22',
    ports: { imap: 993, smtp: 587 },
    ssl: true,
    secure: false,
    webmail: 'https://109.199.104.22:8090/snappymail/index.php'
  },
  'anap.co.mz': {
    imap: '109.199.104.22', // Servidor CyberPanel (mesmo do SnappyMail)
    smtp: '109.199.104.22',
    ports: { imap: 993, smtp: 587 },
    ssl: true,
    secure: false,
    webmail: 'https://109.199.104.22:8090/snappymail/index.php'
  },
  'entrecampos.co.mz': {
    imap: '109.199.104.22', // Servidor CyberPanel (mesmo do SnappyMail)
    smtp: '109.199.104.22',
    ports: { imap: 993, smtp: 587 },
    ssl: true,
    secure: false,
    webmail: 'https://109.199.104.22:8090/snappymail/index.php'
  }
};

/**
 * Retorna as configurações padrão do servidor principal para domínios não mapeados.
 * Garante que todos os painéis herdem o servidor master (CyberPanel/SnappyMail) por padrão.
 */
export const getDefaultConfig = (domain?: string): DomainEmailConfig => {
  // Servidor Master CyberPanel onde o SnappyMail está instalado
  const host = '109.199.104.22';
  return {
    imap: host,
    smtp: host,
    ports: { imap: 993, smtp: 587 },
    ssl: true,
    secure: false, // 587 = STARTTLS
    webmail: 'https://109.199.104.22:8090/snappymail/index.php'
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
