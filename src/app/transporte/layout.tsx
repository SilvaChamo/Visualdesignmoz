import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'VisualTransporte — Serviços de Mobilidade e Aluguer | Moçambique',
  description: 'Serviços de mobilidade, transferes executivos, aluguer de viaturas corporativas e logística de transporte para mercadorias e eventos em Moçambique.',
  openGraph: {
    title: 'VisualTransporte — Mobilidade e Logística',
    description: 'Transferes corporativos, aluguer de viaturas e transporte de mercadorias em Moçambique.',
    url: 'https://visualdesignmoz.com/transporte',
    siteName: 'VisualDesign',
    locale: 'pt_MZ',
    type: 'website',
  },
}

export default function VisualTransporteLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
