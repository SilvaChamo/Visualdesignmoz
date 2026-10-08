'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useAuth } from '@/components/auth/AuthProvider'
import Image from 'next/image'
import { useI18n } from '@/lib/i18n'
import { Globe, Shield, RefreshCw, Search, Zap, Lock, HardDrive } from 'lucide-react'
import DomainSearch from '@/components/DomainSearch'
import { NotchSection } from '@/components/home/NotchSection'

export default function Dominios() {
  const { t } = useI18n()
  const { user } = useAuth()
  // Veio do painel ("Comprar domínio connosco"): compra com a sessão da
  // própria conta (o checkout carrega os dados de faturação dela) e volta ao
  // painel no fim. Lido no cliente para não exigir Suspense no prerender.
  const [fromPanel, setFromPanel] = useState(false)
  useEffect(() => {
    setFromPanel(new URLSearchParams(window.location.search).get('origem') === 'painel')
  }, [])

  const cardsApelo = [
    {
      icone: <Search className="w-8 h-8" />,
      titulo: "Registar",
      descricao: "Encontre e registe o nome perfeito para o seu site em segundos.",
      href: "/servicos/dominios"
    },
    {
      icone: <RefreshCw className="w-8 h-8" />,
      titulo: "Transferir",
      descricao: "Traga seu domínio para nós e aproveite nossa gestão simplificada.",
      href: "/servicos/dominios"
    },
    {
      icone: <Zap className="w-8 h-8" />,
      titulo: "Renovar",
      descricao: "Mantenha seu domínio activo e evite que outros o registem.",
      href: "/servicos/dominios"
    },
    {
      icone: <HardDrive className="w-8 h-8" />,
      titulo: "Parquear",
      descricao: "Reserve seu nome de domínio mesmo antes de criar o site.",
      href: "/servicos/dominios"
    }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Banner Principal com Motor de Busca */}
      <NotchSection shape="start" bg="bg-black" first>
        <Image
          src="/assets/IMG-VD/web-hosting.svg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center opacity-20"
          aria-hidden
        />
        <div className="absolute inset-0 bg-black/50" />
        <div className="container mx-auto max-w-7xl px-6 pt-[160px] pb-[100px] relative z-10">
          <div className="text-center max-w-3xl mx-auto mb-10">
            <h1 className="text-4xl font-bold text-white mb-4">Registo de Domínios</h1>
            <p className="text-lg text-white/90 font-normal">
              Encontre o nome perfeito para o seu negócio e garanta a sua presença online hoje mesmo.
            </p>
          </div>

          {fromPanel && user && (
            <div className="max-w-4xl mx-auto mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-sm text-white">
              <span>
                A comprar com a sua conta: <strong>{user.email}</strong>. No fim da compra volta ao seu painel.
              </span>
              <Link href="/cliente" className="font-bold text-white underline-offset-2 hover:underline whitespace-nowrap">
                ← Voltar à minha conta
              </Link>
            </div>
          )}

          {/* Motor de busca de domínios */}
          <div className="max-w-4xl mx-auto">
            <DomainSearch />
          </div>
        </div>
      </NotchSection>

      {/* Seção de Apelo com 4 Cards */}
      <div className="pt-20 pb-10">
        <div className="container mx-auto max-w-7xl px-6">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-3xl font-bold text-slate-800 mb-4">Registe seu domínio com segurança.</h2>
            <p className="text-lg text-slate-600">
              Registe seu domínio connosco a preços acessíveis do mercado e obtenha seu domínio online a menos de 30 minutos.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {cardsApelo.map((card, index) => (
              <Link href={card.href} key={index} className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 hover:shadow-md hover:border-red-200 transition-all group flex flex-col h-full">
                <div className="text-red-600 mb-4 transition-transform group-hover:scale-110">
                  {card.icone}
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-2 group-hover:text-red-600 transition-colors">{card.titulo}</h3>
                <p className="text-sm text-slate-600 flex-1">{card.descricao}</p>
                <div className="mt-4 text-xs font-bold text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">Saiba mais →</div>
              </Link>
            ))}
          </div>
        </div>
      </div>

    </div>
  )
}
