import { getEmailPlan } from '@/lib/email-plans';

/**
 * Que pacote do servidor corresponde a cada produto do carrinho. Fonte única: a activação da compra
 * (checkout-fulfillment) e o painel de quem ainda espera pela confirmação (vhost-compra-pendente) usam a mesma tabela,
 * para o cliente ver, desde o primeiro momento, o painel do pacote que pagou.
 */
// Pacote dedicado por plano de hospedagem — tem de corresponder aos `defaultPackageName` de HOSTING_PLAN_PRESETS em
// reseller-package-form.ts, que é o que a secção «Pacotes» do admin cria de facto no servidor.
export const PACOTES_HOSPEDAGEM: Record<string, string> = {
  'hosting-basico': 'VD-Host-Basico',
  'hosting-pro': 'VD-Host-Pro',
  'hosting-business': 'VD-Host-Business',
  'hosting-enterprise': 'VD-Host-Enterprise',
};

/** Quem compra só um domínio fica numa conta sem sites nem e-mail (ver domain-only-provision). */
export const PACOTE_SO_DOMINIO = 'VD-Dominio';

/** Pacote de um item do carrinho; null para o que não cria conta própria (SSL…). */
export function pacoteDoItem(item: { type: string; id?: string }): string | null {
  if (item.type === 'hosting') return PACOTES_HOSPEDAGEM[String(item.id || '')] || null;
  if (item.type === 'email') return getEmailPlan(String(item.id || ''))?.hestiaPackage || null;
  if (item.type === 'domain') return PACOTE_SO_DOMINIO;
  return null;
}
