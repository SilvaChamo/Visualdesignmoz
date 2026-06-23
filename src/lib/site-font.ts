import { Exo_2 } from 'next/font/google'

/** Fonte única do site — Exo 2 (Google Fonts via next/font). */
export const siteFont = Exo_2({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-site',
  display: 'swap',
})

export const siteFontFamily = 'var(--font-site), sans-serif'
