import { MZN_TO_USD_RATE } from '@/lib/currency'

export type DomainTldPrice = {
  value: string
  label: string
  price: number
  renewPrice: number
  icann: number
  transfer: number
  periodLabel?: string
  /**
   * Preço de COMPRA (registo novo) fixo em MT, decidido directamente pelo
   * negócio — ignora a conversão USD×margem só para este valor. Não afecta
   * renovação nem transferência, que continuam a usar `renewPrice`/`transfer`
   * pela fórmula normal. Usar sempre através de `domainRegistrationPriceMt`,
   * nunca ler este campo directamente, para o checkout e a UI nunca divergir.
   */
  fixedPurchasePriceMt?: number
  /**
   * A API da Dynadot não regista esta extensão (.app/.dev — Google Registry):
   * a compra é aceite na mesma, mas o registo é feito à mão pela equipa e a
   * activação demora até 1 dia útil. Ver domain-registration-support.ts e o
   * ramo de domínio em checkout-fulfillment.ts.
   */
  manualRegistration?: boolean
}

/**
 * 44 extensões disponíveis no motor de registo (preço base USD → MT no UI).
 *
 * `price`/`renewPrice`/`transfer` = custo real de revenda na Dynadot (USD), tal
 * como reportado na tabela oficial de preços de revenda ("price_reseller_regular_USD.csv").
 * A margem (61,25%) é aplicada uniformemente na conversão para MT em `formatMtPrice`
 * (`* 65 * 1.5 * 1.075`) — não somar margem aqui.
 *
 * Actualizado em 2026-08-06 a partir da tabela real da Dynadot. Antes desta correcção,
 * 12 extensões (incl. .software, .com, .net, .org, .ai, .tech) estavam a ser vendidas
 * ABAIXO do custo real. A Dynadot raramente actualiza estes preços de revenda, pelo que
 * esta tabela fixa é razoável — mas deve ser revista periodicamente.
 *
 * `.farm` não consta na tabela de revenda fornecida — mantido com o valor anterior
 * até se confirmar o custo real.
 */
export const DOMAIN_TLD_PRICES: DomainTldPrice[] = [
  { value: '.com', label: '.com', price: 10.88, renewPrice: 10.88, icann: 0.2, transfer: 10.88, fixedPurchasePriceMt: 985 },
  { value: '.net', label: '.net', price: 12.52, renewPrice: 12.52, icann: 0.2, transfer: 12.52 },
  { value: '.org', label: '.org', price: 7.99, renewPrice: 11.64, icann: 0.2, transfer: 11.64 },
  { value: '.farm', label: '.farm', price: 4.14, renewPrice: 31.05, icann: 0.2, transfer: 31.05 },
  { value: '.ai', label: '.ai', price: 85.6, renewPrice: 85.6, icann: 0.2, transfer: 85.6 },
  { value: '.co', label: '.co', price: 3.48, renewPrice: 31.2, icann: 0.2, transfer: 31.2 },
  { value: '.io', label: '.io', price: 28.89, renewPrice: 53.5, icann: 0.2, transfer: 53.5 },
  { value: '.app', label: '.app', price: 9.99, renewPrice: 14.5, icann: 0.2, transfer: 13.99, manualRegistration: true },
  { value: '.dev', label: '.dev', price: 8, renewPrice: 12.5, icann: 0.2, transfer: 11.99, manualRegistration: true },
  { value: '.online', label: '.online', price: 2.5, renewPrice: 29.64, icann: 0.2, transfer: 26.97 },
  { value: '.tech', label: '.tech', price: 6.64, renewPrice: 52.65, icann: 0.2, transfer: 52.65 },
  { value: '.store', label: '.store', price: 2.5, renewPrice: 43.02, icann: 0.2, transfer: 43.02 },
  { value: '.biz', label: '.biz', price: 6.65, renewPrice: 18.93, icann: 0.2, transfer: 18.93 },
  { value: '.info', label: '.info', price: 3.99, renewPrice: 22.69, icann: 0.2, transfer: 22.69 },
  { value: '.me', label: '.me', price: 9.71, renewPrice: 17.8, icann: 0.2, transfer: 17.8 },
  { value: '.xyz', label: '.xyz', price: 1.99, renewPrice: 13.17, icann: 0.2, transfer: 13.17 },
  { value: '.site', label: '.site', price: 2.5, renewPrice: 26.97, icann: 0.2, transfer: 26.97 },
  { value: '.club', label: '.club', price: 4, renewPrice: 15.96, icann: 0.2, transfer: 15.96 },
  { value: '.top', label: '.top', price: 2.99, renewPrice: 4.88, icann: 0.2, transfer: 4.88 },
  { value: '.live', label: '.live', price: 2.5, renewPrice: 26.97, icann: 0.2, transfer: 26.97 },
  { value: '.cloud', label: '.cloud', price: 3.99, renewPrice: 21.62, icann: 0.2, transfer: 21.62 },
  { value: '.digital', label: '.digital', price: 2.99, renewPrice: 34.14, icann: 0.2, transfer: 34.14 },
  { value: '.media', label: '.media', price: 4.5, renewPrice: 37.67, icann: 0.2, transfer: 37.67 },
  { value: '.news', label: '.news', price: 9.85, renewPrice: 26.97, icann: 0.2, transfer: 26.97 },
  { value: '.world', label: '.world', price: 2.5, renewPrice: 34.2, icann: 0.2, transfer: 34.2 },
  { value: '.today', label: '.today', price: 3.49, renewPrice: 23.76, icann: 0.2, transfer: 23.76 },
  { value: '.group', label: '.group', price: 6.1, renewPrice: 21.62, icann: 0.2, transfer: 21.62 },
  { value: '.company', label: '.company', price: 2.5, renewPrice: 17.34, icann: 0.2, transfer: 17.34 },
  { value: '.solutions', label: '.solutions', price: 3.5, renewPrice: 25.9, icann: 0.2, transfer: 25.9 },
  { value: '.services', label: '.services', price: 8.78, renewPrice: 32.32, icann: 0.2, transfer: 32.32 },
  { value: '.agency', label: '.agency', price: 3.5, renewPrice: 25.9, icann: 0.2, transfer: 25.9 },
  { value: '.center', label: '.center', price: 3.5, renewPrice: 26.97, icann: 0.2, transfer: 26.97 },
  { value: '.email', label: '.email', price: 5.57, renewPrice: 25.9, icann: 0.2, transfer: 25.9 },
  { value: '.network', label: '.network', price: 4.5, renewPrice: 29.11, icann: 0.2, transfer: 29.11 },
  { value: '.software', label: '.software', price: 16.22, renewPrice: 34.35, icann: 0.2, transfer: 34.35 },
  { value: '.systems', label: '.systems', price: 11.99, renewPrice: 29.11, icann: 0.2, transfer: 29.11 },
  { value: '.tools', label: '.tools', price: 9.85, renewPrice: 30.18, icann: 0.2, transfer: 30.18 },
  { value: '.works', label: '.works', price: 4.5, renewPrice: 32.21, icann: 0.2, transfer: 32.21 },
  { value: '.zone', label: '.zone', price: 8.24, renewPrice: 32.21, icann: 0.2, transfer: 32.21 },
  { value: '.space', label: '.space', price: 2.5, renewPrice: 21.62, icann: 0.2, transfer: 21.62 },
  { value: '.website', label: '.website', price: 2.5, renewPrice: 21.62, icann: 0.2, transfer: 21.62 },
  { value: '.click', label: '.click', price: 1.99, renewPrice: 10.92, icann: 0.2, transfer: 10.92 },
  { value: '.link', label: '.link', price: 7.71, renewPrice: 7.71, icann: 0.2, transfer: 7.71 },
  { value: '.pro', label: '.pro', price: 3.79, renewPrice: 22.69, icann: 0.2, transfer: 22.69 },
]

export function formatMtPrice(usdPrice: number): string {
  const mt = (usdPrice * 65 * 1.5) * 1.075
  return mt.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * Preço de registo (compra nova) em MT para N anos — fonte única usada tanto
 * na UI (pesquisa, carrinho, checkout) como na validação server-side
 * (`resolveCartItems`), para nunca poderem divergir. Usa o valor fixo do
 * negócio (`fixedPurchasePriceMt`) quando existe; senão cai na fórmula
 * USD × margem, arredondada ao MT inteiro.
 */
export function domainRegistrationPriceMt(
  tld: Pick<DomainTldPrice, 'price' | 'fixedPurchasePriceMt'>,
  years: number,
): number {
  const safeYears = Math.max(1, years || 1)
  if (tld.fixedPurchasePriceMt !== undefined) return tld.fixedPurchasePriceMt * safeYears
  return Math.round(tld.price * safeYears * MZN_TO_USD_RATE)
}

/** Preço de renovação em MT — sempre pela fórmula, nunca pelo valor fixo de compra. */
export function domainRenewalPriceMt(
  tld: Pick<DomainTldPrice, 'renewPrice'>,
  years = 1,
): number {
  const safeYears = Math.max(1, years || 1)
  return Math.round(tld.renewPrice * safeYears * MZN_TO_USD_RATE)
}

/** Preço de transferência de outro registador em MT — sempre pela fórmula. */
export function domainTransferPriceMt(
  tld: Pick<DomainTldPrice, 'transfer'>,
  years = 1,
): number {
  const safeYears = Math.max(1, years || 1)
  return Math.round(tld.transfer * safeYears * MZN_TO_USD_RATE)
}

/** Taxa ICANN em MT — sempre pela fórmula. */
export function domainIcannFeeMt(tld: Pick<DomainTldPrice, 'icann'>): number {
  return Math.round(tld.icann * MZN_TO_USD_RATE)
}
