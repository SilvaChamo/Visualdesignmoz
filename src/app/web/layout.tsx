import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'VisualWeb — Alojamento Web, Domínios e SEO | Moçambique',
  description: 'Alojamento web profissional, registo de domínios (.co.mz, .com), servidores VPS, e-mail profissional, certificados SSL e soluções de SEO em Moçambique.',
  openGraph: {
    title: 'VisualWeb — Presença Digital Completa',
    description: 'Alojamento web rápido, registo de domínios e soluções de infraestrutura digital em Moçambique.',
    url: 'https://visualdesignmoz.com/web',
    siteName: 'VisualDesign',
    locale: 'pt_MZ',
    type: 'website',
  },
}

export default function VisualWebLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
