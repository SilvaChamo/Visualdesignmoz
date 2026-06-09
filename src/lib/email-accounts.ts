/**
 * Contas @visualdesignmoz.com — papéis e uso.
 *
 * Brevo: verificar cada remetente usado no "De:" (Remetentes no painel).
 * DirectAdmin: caixas @visualdesignmoz.com no servidor (IMAP/webmail).
 * Osher: caixas no DirectAdmin; Brevo só para emails automáticos do site
 */
export const VD_EMAIL = {
  /** Automáticos: recuperar senha, confirmações — site + Supabase */
  noreply: 'noreply@visualdesignmoz.com',
  /** Comunicação geral da empresa — marketing, avisos */
  geral: 'geral@visualdesignmoz.com',
  /** Tickets e suporte técnico */
  suporte: 'suporte@visualdesignmoz.com',
  /** Caixa administrativa (legado) */
  admin: 'admin@visualdesignmoz.com',
  /** Email principal do servidor (substitui admin nessa função) */
  servidor: 'servidor@visualdesignmoz.com',
  /** Pessoal Silva — webmail/campanhas manuais; NÃO usar no site por defeito */
  silvaChamo: 'silva.chamo@visualdesignmoz.com',
} as const;

/** Remetentes a verificar no Brevo → Remetentes */
export const BREVO_SENDERS_VISUALDESIGN = [
  VD_EMAIL.noreply,
  VD_EMAIL.geral,
  VD_EMAIL.suporte,
  VD_EMAIL.admin,
  VD_EMAIL.servidor,
  VD_EMAIL.silvaChamo,
] as const;

export { OSHER_EMAIL, BREVO_SENDERS_OSHER } from '@/lib/email-domains';
