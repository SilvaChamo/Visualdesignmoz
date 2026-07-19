'use client'

import React, { useState } from 'react'
import { useI18n } from '@/lib/i18n'
import Link from 'next/link'
import { Tent, Calendar, Megaphone, Camera, MapPin, Users, ArrowRight, CheckCircle2 } from 'lucide-react'
import { NotchSection } from '@/components/home/NotchSection'
import { BudgetRequestModal } from '@/components/forms/BudgetRequestModal'

export default function FeirasEventos() {
  const { t } = useI18n()
  const [isModalOpen, setIsModalOpen] = useState(false)

  const servicosEventos = [
    { icone: <Tent className="w-8 h-8" />, titulo: "Design de Stands", descricao: "Projeto e montagem de stands para feiras e exposições com impacto visual", servicos: ["Projeto 3D", "Materiais premium", "Montagem e desmontagem", "Iluminação especial", "Personalização total"] },
    { icone: <Calendar className="w-8 h-8" />, titulo: "Organização de Eventos", descricao: "Planeamento e gestão completa de eventos corporativos e sociais", servicos: ["Planeamento estratégico", "Gestão de fornecedores", "Logística completa", "Cronograma detalhado", "Coordenação no dia"] },
    { icone: <Megaphone className="w-8 h-8" />, titulo: "Materiais Promocionais", descricao: "Criação de todo o material gráfico e promocional para o seu evento", servicos: ["Banners e rollups", "Flyers e convites", "Brindes personalizados", "Merchandising", "Sinalética"] },
    { icone: <Camera className="w-8 h-8" />, titulo: "Cobertura do Evento", descricao: "Registo fotográfico e audiovisual profissional do seu evento", servicos: ["Fotografia profissional", "Vídeo de cobertura", "Drone footage", "Live streaming", "Edição e entrega rápida"] },
    { icone: <MapPin className="w-8 h-8" />, titulo: "Cenografia e Decoração", descricao: "Ambientação e decoração temática para criar experiências memoráveis", servicos: ["Cenografia criativa", "Decoração temática", "Flores e arranjos", "Mobiliário especial", "Efeitos visuais"] },
    { icone: <Users className="w-8 h-8" />, titulo: "Ativações de Marca", descricao: "Experiências interativas para promover a sua marca em eventos", servicos: ["Brand activation", "Experiências interativas", "Sampling e degustação", "Photobooth branded", "Gamificação"] }
  ]

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-foreground">
      
      {/* Hero Section */}
      <NotchSection shape="start" bg="bg-[#09090b]" first>
        <div className="relative overflow-hidden pt-[180px] pb-[100px]">
          <div className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-10" style={{ backgroundImage: "url('/assets/BG.jpg')" }} />
          <div className="absolute inset-0 bg-black/55" />
          <div className="container mx-auto max-w-7xl px-6 relative z-10 text-center">
            <h1 className="text-4xl font-extrabold text-white mb-2 tracking-tight">Feiras e Eventos</h1>
            <p className="text-lg text-zinc-300 font-normal max-w-2xl mx-auto">Stands, materiais e cobertura completa para o seu evento</p>
          </div>
        </div>
      </NotchSection>

      {/* Services Grid Section */}
      <NotchSection shape="end" bg="bg-zinc-50 dark:bg-zinc-950">
        <div className="py-20">
          <div className="container mx-auto max-w-7xl px-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {servicosEventos.map((s, i) => (
                <div key={i} className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 p-6 rounded-2xl shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center mb-4">
                      <div className="text-red-500 mr-3">{s.icone}</div>
                      <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{s.titulo}</h3>
                    </div>
                    <p className="text-zinc-600 dark:text-zinc-400 mb-6 text-sm leading-relaxed">{s.descricao}</p>
                    <div>
                      <h4 className="font-semibold text-zinc-700 dark:text-zinc-300 mb-3 text-sm">O que inclui:</h4>
                      <ul className="space-y-2">
                        {s.servicos.map((item, idx) => (
                          <li key={idx} className="flex items-start text-zinc-600 dark:text-zinc-400 text-sm">
                            <CheckCircle2 className="w-4 h-4 text-red-500 shrink-0 mr-2 mt-0.5" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </NotchSection>

      {/* CTA Banner Section */}
      <NotchSection shape="end" bg="bg-zinc-50 dark:bg-zinc-950">
        <div className="py-20">
          <div className="container mx-auto max-w-7xl px-6">
            <div className="bg-red-600 dark:bg-red-700 text-white py-16 rounded-[2.5rem] text-center space-y-6 shadow-xl shadow-red-600/10 relative overflow-hidden">
              <h2 className="text-3xl font-extrabold">Tem uma feira ou evento corporativo a preparar?</h2>
              <p className="text-lg text-red-100 max-w-xl mx-auto">
                Da cenografia e stands 3D personalizados à coordenação e cobertura de imagem no local, tratamos de tudo de ponta a ponta.
              </p>
              <button
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center gap-2 bg-white hover:bg-zinc-100 text-red-600 font-extrabold px-10 py-4 rounded-xl shadow-lg transition-all transform hover:-translate-y-0.5 cursor-pointer"
              >
                <span>Pedir Orçamento Gratuito</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </NotchSection>

      {/* Budget Modal */}
      <BudgetRequestModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialService="feiras-eventos"
      />

    </div>
  )
}
