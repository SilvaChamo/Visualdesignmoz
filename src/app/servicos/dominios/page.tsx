'use client'

import { useI18n } from '@/lib/i18n'
import { Globe, Shield, RefreshCw, Search, Zap, Lock, HardDrive } from 'lucide-react'
import DomainSearch from '@/components/DomainSearch'

export default function Dominios() {
  const { t } = useI18n()

  const cardsApelo = [
    {
      icone: <Search className="w-8 h-8" />,
      titulo: "Registar",
      descricao: "Encontre e registe o nome perfeito para o seu site em segundos."
    },
    {
      icone: <RefreshCw className="w-8 h-8" />,
      titulo: "Transferir",
      descricao: "Traga seu domínio para nós e aproveite nossa gestão simplificada."
    },
    {
      icone: <Zap className="w-8 h-8" />,
      titulo: "Renovar",
      descricao: "Mantenha seu domínio ativo e evite que outros o registem."
    },
    {
      icone: <HardDrive className="w-8 h-8" />,
      titulo: "Parquear",
      descricao: "Reserve seu nome de domínio mesmo antes de criar o site."
    }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Banner Principal com Motor de Busca */}
      <div className="bg-[#404040] relative overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20"
          style={{ backgroundImage: "url('/assets/BG.jpg')" }}
        />
        <div className="absolute inset-0 bg-black/50" />
        <div className="container mx-auto max-w-7xl px-6 pt-[160px] pb-[100px] relative z-10">
          <div className="text-center max-w-3xl mx-auto mb-10">
            <h1 className="text-4xl font-bold text-white mb-4">Registo de Domínios</h1>
            <p className="text-lg text-white/90 font-normal">
              Encontre o nome perfeito para o seu negócio e garanta a sua presença online hoje mesmo.
            </p>
          </div>
          
          {/* Motor de busca de domínios */}
          <div className="max-w-4xl mx-auto">
            <DomainSearch />
          </div>
        </div>
      </div>

      {/* Seção de Apelo com 4 Cards */}
      <div className="py-20">
        <div className="container mx-auto max-w-7xl px-6">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-3xl font-bold text-slate-800 mb-4">Registe seu domínio com segurança.</h2>
            <p className="text-lg text-slate-600">
              Registe seu domínio connosco a preços acessíveis do mercado e obtenha seu domínio online a menos de 30 minutos.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {cardsApelo.map((card, index) => (
              <div key={index} className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                <div className="text-red-600 mb-4">
                  {card.icone}
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-2">{card.titulo}</h3>
                <p className="text-sm text-slate-600">{card.descricao}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Lista de Preços */}
      <div className="py-20 bg-white">
        <div className="container mx-auto max-w-7xl px-6">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-3xl font-bold text-slate-800 mb-4">Tabela de Preços de Domínios</h2>
            <p className="text-lg text-slate-600">
              Confira os preços de registo, transferência e renovação para as principais extensões.
            </p>
          </div>

          {/* Componente de busca com a aba de preços ativa */}
          <div className="max-w-4xl mx-auto">
            <DomainSearch activeTab="pricing" />
          </div>
        </div>
      </div>
    </div>
  )
}
