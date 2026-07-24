import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'VisualEventos — Organização, Catering e Stands para Feiras | Moçambique',
  description: 'Organização de eventos corporativos, feiras, aluguer de equipamento de som e imagem, catering premium e montagem de stands em Moçambique.',
  openGraph: {
    title: 'VisualEventos — Eventos Memoráveis',
    description: 'Soluções integradas de stands, catering e organização de eventos em Moçambique.',
    url: 'https://visualdesignmoz.com/eventos',
    siteName: 'VisualDesign',
    locale: 'pt_MZ',
    type: 'website',
  },
}

export default function VisualEventosLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
