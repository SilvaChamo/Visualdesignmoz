import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'VisualPro — Produção Audiovisual, Vídeo e Fotografia | Moçambique',
  description: 'Produção de vídeo institucional, spot de publicidade TV, cobertura audiovisual de eventos corporativos e sessões fotográficas profissionais em Moçambique.',
  openGraph: {
    title: 'VisualPro — Audiovisual Profissional',
    description: 'Vídeo institucional, cobertura de eventos e fotografia profissional em Moçambique.',
    url: 'https://visualdesignmoz.com/producoes',
    siteName: 'VisualDesign',
    locale: 'pt_MZ',
    type: 'website',
  },
}

export default function VisualProLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
