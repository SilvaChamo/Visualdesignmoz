export type DomainTldPrice = {
  value: string
  label: string
  price: number
  renewPrice: number
  icann: number
  transfer: number
  periodLabel?: string
}

/** 44 extensões disponíveis no motor de registo (preço base USD → MT no UI). */
export const DOMAIN_TLD_PRICES: DomainTldPrice[] = [
  { value: '.com', label: '.com', price: 8.88, renewPrice: 9.98, icann: 0.2, transfer: 9.48 },
  { value: '.net', label: '.net', price: 11.2, renewPrice: 11.2, icann: 0.2, transfer: 11.2 },
  { value: '.org', label: '.org', price: 6.48, renewPrice: 9.8, icann: 0.2, transfer: 9.5 },
  { value: '.farm', label: '.farm', price: 4.14, renewPrice: 31.05, icann: 0.2, transfer: 31.05 },
  { value: '.ai', label: '.ai', price: 69.98, renewPrice: 79.98, icann: 0.2, transfer: 69.98 },
  { value: '.co', label: '.co', price: 25, renewPrice: 25, icann: 0.2, transfer: 25 },
  { value: '.io', label: '.io', price: 35, renewPrice: 35, icann: 0.2, transfer: 35 },
  { value: '.app', label: '.app', price: 15, renewPrice: 15, icann: 0.2, transfer: 15 },
  { value: '.dev', label: '.dev', price: 15, renewPrice: 15, icann: 0.2, transfer: 15 },
  { value: '.online', label: '.online', price: 5, renewPrice: 5, icann: 0.2, transfer: 5 },
  { value: '.tech', label: '.tech', price: 5, renewPrice: 5, icann: 0.2, transfer: 5 },
  { value: '.store', label: '.store', price: 5, renewPrice: 5, icann: 0.2, transfer: 5 },
  { value: '.biz', label: '.biz', price: 12, renewPrice: 12, icann: 0.2, transfer: 12 },
  { value: '.info', label: '.info', price: 15, renewPrice: 15, icann: 0.2, transfer: 15 },
  { value: '.me', label: '.me', price: 10, renewPrice: 10, icann: 0.2, transfer: 10 },
  { value: '.xyz', label: '.xyz', price: 3, renewPrice: 12, icann: 0.2, transfer: 12 },
  { value: '.site', label: '.site', price: 4, renewPrice: 25, icann: 0.2, transfer: 25 },
  { value: '.club', label: '.club', price: 5, renewPrice: 12, icann: 0.2, transfer: 12 },
  { value: '.top', label: '.top', price: 3, renewPrice: 8, icann: 0.2, transfer: 8 },
  { value: '.live', label: '.live', price: 4, renewPrice: 20, icann: 0.2, transfer: 20 },
  { value: '.cloud', label: '.cloud', price: 12, renewPrice: 12, icann: 0.2, transfer: 12 },
  { value: '.digital', label: '.digital', price: 5, renewPrice: 30, icann: 0.2, transfer: 30 },
  { value: '.media', label: '.media', price: 8, renewPrice: 30, icann: 0.2, transfer: 30 },
  { value: '.news', label: '.news', price: 8, renewPrice: 25, icann: 0.2, transfer: 25 },
  { value: '.world', label: '.world', price: 5, renewPrice: 30, icann: 0.2, transfer: 30 },
  { value: '.today', label: '.today', price: 4, renewPrice: 20, icann: 0.2, transfer: 20 },
  { value: '.group', label: '.group', price: 8, renewPrice: 18, icann: 0.2, transfer: 18 },
  { value: '.company', label: '.company', price: 8, renewPrice: 12, icann: 0.2, transfer: 12 },
  { value: '.solutions', label: '.solutions', price: 8, renewPrice: 25, icann: 0.2, transfer: 25 },
  { value: '.services', label: '.services', price: 8, renewPrice: 30, icann: 0.2, transfer: 30 },
  { value: '.agency', label: '.agency', price: 8, renewPrice: 25, icann: 0.2, transfer: 25 },
  { value: '.center', label: '.center', price: 8, renewPrice: 25, icann: 0.2, transfer: 25 },
  { value: '.email', label: '.email', price: 8, renewPrice: 25, icann: 0.2, transfer: 25 },
  { value: '.network', label: '.network', price: 8, renewPrice: 25, icann: 0.2, transfer: 25 },
  { value: '.software', label: '.software', price: 8, renewPrice: 30, icann: 0.2, transfer: 30 },
  { value: '.systems', label: '.systems', price: 8, renewPrice: 25, icann: 0.2, transfer: 25 },
  { value: '.tools', label: '.tools', price: 8, renewPrice: 25, icann: 0.2, transfer: 25 },
  { value: '.works', label: '.works', price: 8, renewPrice: 30, icann: 0.2, transfer: 30 },
  { value: '.zone', label: '.zone', price: 8, renewPrice: 25, icann: 0.2, transfer: 25 },
  { value: '.space', label: '.space', price: 4, renewPrice: 20, icann: 0.2, transfer: 20 },
  { value: '.website', label: '.website', price: 4, renewPrice: 20, icann: 0.2, transfer: 20 },
  { value: '.click', label: '.click', price: 4, renewPrice: 12, icann: 0.2, transfer: 12 },
  { value: '.link', label: '.link', price: 6, renewPrice: 10, icann: 0.2, transfer: 10 },
  { value: '.pro', label: '.pro', price: 12, renewPrice: 15, icann: 0.2, transfer: 15 },
]

export function formatMtPrice(usdPrice: number): string {
  const mt = (usdPrice * 65 * 1.5) * 1.075
  return mt.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
