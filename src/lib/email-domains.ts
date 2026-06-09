/**
 * Osher: caixas no DirectAdmin (webmail / Outlook / Apple Mail).
 * Brevo só para envio automático do site (convites, recuperação de senha).
 */

export type EmailProvider = 'directadmin' | 'brevo-app-only';

export const OSHER_DOMAIN = 'oshercollective.com';

export const OSHER_EMAIL = {
  osher: 'osher@oshercollective.com',
  geral: 'geral@oshercollective.com',
  admin: 'admin@oshercollective.com',
  info: 'info@oshercollective.com',
  hello: 'hello@oshercollective.com',
  noreply: 'noreply@oshercollective.com',
} as const;

/** Remetentes do site via Brevo (não substituem webmail/Outlook) */
export const BREVO_SENDERS_OSHER = [
  OSHER_EMAIL.noreply,
  OSHER_EMAIL.geral,
] as const;

export const DIRECTADMIN_EMAIL_DOMAINS = [
  'visualdesignmoz.com',
  OSHER_DOMAIN,
] as const;

export function getDomainFromEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at < 0) return '';
  return email.slice(at + 1).toLowerCase().trim();
}

/** True = caixa gerida no DirectAdmin (webmail, Outlook, IMAP) */
export function isDirectAdminMailboxDomain(domainOrEmail: string): boolean {
  const domain = domainOrEmail.includes('@')
    ? getDomainFromEmail(domainOrEmail)
    : domainOrEmail.toLowerCase().trim();
  return (DIRECTADMIN_EMAIL_DOMAINS as readonly string[]).includes(domain);
}

/** Brevo só para emails automáticos do site — não para o utilizador ler/enviar */
export function useBrevoForAppEmail(domainOrEmail: string): boolean {
  return getDomainFromEmail(domainOrEmail) === OSHER_DOMAIN || domainOrEmail === OSHER_DOMAIN;
}

export function getDefaultFromForDomain(domain: string): string {
  if (domain.toLowerCase() === OSHER_DOMAIN) {
    return `Osher Collective <${OSHER_EMAIL.noreply}>`;
  }
  return '';
}
