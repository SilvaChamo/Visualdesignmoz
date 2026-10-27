/**
 * Língua escolhida pelo utilizador (site e painel falam a mesma). A língua de origem é sempre o português; só se muda
 * quando a pessoa escolhe o inglês, e essa escolha fica para todas as sessões deste navegador (Silva, 27/10/2026):
 * guarda-se no localStorage e num cookie de 1 ano ('vd-lang'), e não se apaga ao terminar a sessão nem ao limpar as caches
 * do painel (ver panel-session-cache-clear.ts e /auth/clear-storage).
 */
export const CHAVE_LINGUA = 'vd-lang'
export type LinguaGuardada = 'pt' | 'en'

const UM_ANO = 60 * 60 * 24 * 365

/** A língua guardada, ou null se a pessoa nunca escolheu (então vale o português) */
export function lerLinguaGuardada(): LinguaGuardada | null {
  if (typeof window === 'undefined') return null
  let valor: string | null = null
  try {
    // 'visualhost_lang' era a chave que só o painel usava: quem só tinha essa continua com a língua que escolheu
    valor = localStorage.getItem(CHAVE_LINGUA) || localStorage.getItem('visualhost_lang')
  } catch {}
  if (valor !== 'en' && valor !== 'pt') {
    const m = document.cookie.match(/(?:^|; )vd-lang=(pt|en)(?:;|$)/)
    valor = m ? m[1] : null
  }
  return valor === 'en' || valor === 'pt' ? valor : null
}

/** Guarda a língua escolhida (localStorage + cookie de 1 ano) */
export function guardarLingua(l: LinguaGuardada): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(CHAVE_LINGUA, l)
  } catch {}
  try {
    document.cookie = `${CHAVE_LINGUA}=${l}; path=/; max-age=${UM_ANO}; SameSite=Lax${window.location.protocol === 'https:' ? '; Secure' : ''}`
  } catch {}
}
