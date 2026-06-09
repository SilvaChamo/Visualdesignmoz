/**
 * Sistema de Limites de Email - Proteção contra bloqueio
 * 
 * REGRAS:
 * 1. Email principal do servidor: servidor@visualdesignmoz.com
 * 2. Limite diário: 200 emails (para evitar bloqueio do Google)
 * 3. Gmail APENAS como fallback de emergência
 * 4. Nunca mostrar "via Google" no receptor
 */

export const EMAIL_LIMITS = {
  // Limite diário de segurança (evita bloqueio)
  DAILY_LIMIT: 200,
  
  // Sender principal do servidor (identidade técnica)
  PRIMARY_SENDER: process.env.SERVER_EMAIL?.trim() || 'servidor@visualdesignmoz.com',
  PRIMARY_PASSWORD: 'Ad.Vd#2425?*',
  
  // Configuração SMTP principal
  PRIMARY_SMTP: {
    host: '109.199.104.22',
    port: 587,
    secure: false, // STARTTLS
  },
  
  // Gmail apenas como fallback (quando servidor próprio falha)
  FALLBACK_SENDER: 'mailmarketing@gmail.com',
  FALLBACK_PASSWORD: 'buuf daoy jdkl skvr',
  FALLBACK_SMTP: {
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
  },
  
  // Avisos
  WARNING_AT: 150, // Avisar quando atingir 150 emails (75%)
  BLOCK_AT: 200,   // Bloquear quando atingir 200 emails
} as const;

/**
 * Verifica se o sender é válido (não é Gmail para envios principais)
 */
export function isValidSender(email: string): boolean {
  // Gmail NÃO deve ser usado como sender principal
  // (apenas como fallback de emergência)
  if (email.toLowerCase().endsWith('@gmail.com')) {
    console.warn('⚠️  AVISO: Gmail não deve ser usado como sender principal!');
    console.warn('   Use admin@visualdesignmoz.com para não aparecer "via Google"');
    return false;
  }
  return true;
}

/**
 * Obtém o sender correto (sempre servidor próprio)
 */
export function getPrimarySender(): { email: string; password: string } {
  return {
    email: EMAIL_LIMITS.PRIMARY_SENDER,
    password: EMAIL_LIMITS.PRIMARY_PASSWORD,
  };
}

/**
 * Obtém configuração SMTP correta
 */
export function getPrimarySMTPConfig() {
  return {
    ...EMAIL_LIMITS.PRIMARY_SMTP,
    auth: {
      user: EMAIL_LIMITS.PRIMARY_SENDER,
      pass: EMAIL_LIMITS.PRIMARY_PASSWORD,
    },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 10000,
    socketTimeout: 15000,
  };
}
