import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'VisualGifts — Merchandising, Têxteis e Brindes Corporativos | Moçambique',
  description: 'Brindes personalizados, fardamento e têxteis corporativos, kits de boas-vindas onboarding e artigos promocionais sob medida em Moçambique.',
  openGraph: {
    title: 'VisualGifts — Brindes e Merchandising',
    description: 'Personalização de brindes corporativos, fardamento e kits onboarding em Moçambique.',
    url: 'https://provisualcorporate.co.mz/visualgifts',
    siteName: 'VisualDesign',
    locale: 'pt_MZ',
    type: 'website',
  },
}

export default function VisualGiftsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
