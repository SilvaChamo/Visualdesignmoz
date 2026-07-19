import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'VisualDesign — Design Gráfico, Branding & Envelopamento | VisualDesign Moçambique',
  description: 'Identidade visual, logótipos, materiais gráficos, branding e envelopamento de viaturas em Moçambique. Criamos marcas que ficam na memória.',
  openGraph: {
    title: 'VisualDesign — Design Gráfico & Branding',
    description: 'Criação de identidade visual, branding e materiais gráficos para empresas em Moçambique.',
    url: 'https://provisualcorporate.co.mz/visualdesign',
    siteName: 'VisualDesign',
    locale: 'pt_MZ',
    type: 'website',
  },
}

export default function VisualDesignLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
