import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'VisualDesign — Identidade Visual, Branding e Envelopamento | Moçambique',
  description: 'Identidade visual, branding, design gráfico e envelopamento de viaturas para marcas em Moçambique.',
  openGraph: {
    title: 'VisualDesign — Identidade Visual e Branding',
    description: 'Do logótipo à viatura da sua frota: identidade visual, design gráfico e envelopamento em Moçambique.',
    url: 'https://visualdesignmoz.com/visualdesign',
    siteName: 'VisualDesign',
    locale: 'pt_MZ',
    type: 'website',
  },
}

export default function VisualDesignLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
