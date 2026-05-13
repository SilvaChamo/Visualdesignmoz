'use client'

import { useI18n } from '@/lib/i18n'
import { Users } from 'lucide-react'

export default function Organizacao() {
  const { t } = useI18n()

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#404040] relative overflow-hidden">
        <div className="absolute inset-0 bg-black/50" />
        <div className="container mx-auto max-w-7xl px-6 pt-[160px] pb-[100px] relative z-10">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl font-bold text-white mb-4">Organização de Eventos</h1>
            <p className="text-lg text-white/90 font-normal">
              Planeamento e execução de eventos memoráveis de ponta a ponta.
            </p>
          </div>
        </div>
      </div>

      <div className="py-20">
        <div className="container mx-auto max-w-7xl px-6">
          <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-100 max-w-4xl mx-auto">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-red-50 text-red-600 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800">Gestão Completa</h2>
            </div>
            <p className="text-slate-600 mb-6 leading-relaxed">
              Assumimos a responsabilidade total pela organização do seu evento. Desde a conceção do conceito até à execução no terreno e avaliação pós-evento.
            </p>
            <p className="text-slate-600 mb-6 leading-relaxed">
              Seja uma conferência corporativa, um lançamento de produto, ou uma festa de gala, nossa equipa garante que cada detalhe seja perfeito.
            </p>
            
            <button className="bg-red-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-black transition-colors">
              Falar com um Especialista
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
