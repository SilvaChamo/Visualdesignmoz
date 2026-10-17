import type { CartItem } from '@/contexts/CartContext';

/** Página onde se escolhe o domínio de um item de hospedagem antes do checkout. */
export const DOMAIN_STEP_PATH = '/checkout/dominio';

// #6: um item de hospedagem só pode ser activado com um domínio real associado.
export const HOSTING_DOMAIN_REGEX = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

/** Itens de hospedagem e de plano de e-mail no carrinho que ainda não têm um domínio válido associado. O plano de e-mail
 *  também precisa de domínio para se comprar: ou compra um, ou traz o seu (Silva, 17/10/2026). */
export function hostingItemsNeedingDomain(items: CartItem[]): CartItem[] {
  return items.filter((item) => (item.type === 'hosting' || item.type === 'email') && !HOSTING_DOMAIN_REGEX.test(item.hostingDomain || ''));
}

/** Para onde deve ir quem tenta ir ao checkout a partir do estado actual do carrinho. */
export function checkoutEntryPath(items: CartItem[]): string {
  return hostingItemsNeedingDomain(items).length > 0 ? DOMAIN_STEP_PATH : '/checkout';
}
