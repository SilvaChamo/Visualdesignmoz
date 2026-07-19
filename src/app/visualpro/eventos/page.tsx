'use client'

import React, { useState } from 'react'
import { useI18n } from '@/lib/i18n'
import { Video, ShieldCheck, Clock, Award, CheckCircle2, ArrowRight } from 'lucide-react'
import { NotchSection } from '@/components/home/NotchSection'
import { BudgetRequestModal } from '@/components/forms/BudgetRequestModal'

export default function EventosAudioVisualPage() {
  const { t } = useI18n()
  const [isModalOpen, setIsModalOpen] = useState(false)

  return (
    <div className="min-h-screen bg-white dark:bg-black text-foreground">
      
      {/* Hero Section */}
      <NotchSection shape="start" bg="bg-black" first>
        <div className="relative overflow-hidden pt-[180px] pb-[100px]">
          <div 
            className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-15"
            style={{ backgroundImage: "url('/assets/BG.jpg')" }}
          />
          <div className="absolute inset-0 bg-black/55" />
          <div className="container mx-auto max-w-7xl px-6 relative z-10 text-center">
            <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-red-500 mb-2 block">
              VisualPro — Cobertura Multimédia
            </span>
            <h1 className="text-4xl font-extrabold text-white mb-4 tracking-tight">
              Cobertura de Eventos (Foto & Vídeo)
            </h1>
            <p className="text-lg text-zinc-300 font-normal max-w-2xl mx-auto">
              Gravação profissional, reportagem fotográfica e pós-produção audiovisual completa para congressos, feiras e galas corporativas.
            </p>
            <div className="mt-8">
              <button
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-10 py-3.5 rounded-md shadow-lg transition-all transform hover:-translate-y-0.5 cursor-pointer text-sm"
              >
                <span>Pedir Orçamento Gratuito</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </NotchSection>

      {/* O que inclui */}
      <NotchSection shape="end" bg="bg-zinc-50 dark:bg-zinc-950">
        <div className="py-20">
          <div className="container mx-auto max-w-7xl px-6">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-10 items-start">
              
              {/* Esquerda - Detalhes */}
              <div className="md:col-span-7 space-y-6">
                <div className="text-red-500 bg-red-50 dark:bg-red-950/20 p-4 rounded-lg w-fit">
                  <Video className="w-10 h-10" />
                </div>
                <h2 className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-100 tracking-tight">
                  Registe todos os momentos chave em alta definição
                </h2>
                <p className="text-zinc-600 dark:text-zinc-400 text-base leading-relaxed">
                  Garantimos a cobertura completa de eventos corporativos através de equipa técnica experiente no terreno. Captamos palestras, dinâmicas de networking, stands e entrevistas com participantes para gerar vídeos resumo (aftermovies) e galerias fotográficas completas.
                </p>
              </div>

              {/* Direita - Checklist */}
              <div className="md:col-span-5 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-white/10 p-8 rounded-lg">
                <h4 className="font-bold text-zinc-800 dark:text-zinc-200 mb-4 text-sm tracking-wide uppercase border-b border-zinc-100 dark:border-white/10 pb-2">
                  Serviços Incluídos:
                </h4>
                <ul className="space-y-3">
                  {[
                    'Gravação com câmaras de cinema digitais',
                    'Captação de som direto de alta fidelidade',
                    'Reportagem fotográfica jornalística e corporativa',
                    'Edição de vídeo com banda sonora licenciada',
                    'Geração de aftermovies curtos (reels) e vídeo resumo completo'
                  ].map((item, idx) => (
                    <li key={idx} className="flex items-start text-zinc-600 dark:text-zinc-400 text-sm">
                      <div className="shrink-0 w-6 h-6 rounded-lg border flex items-center justify-center border-red-600/40 dark:border-red-500/40 bg-red-600/5 dark:bg-red-500/5 mr-3 mt-0.5">
                        <CheckCircle2 className="w-4 h-4 text-red-500" />
                      </div>
                      <span className="font-semibold leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

            </div>
          </div>
        </div>
      </NotchSection>

      {/* Como funciona */}
      <NotchSection shape="mid" bg="bg-zinc-200 dark:bg-black">
        <div className="py-20">
          <div className="container mx-auto max-w-7xl px-6 text-center">
            <span className="text-xs sm:text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 text-red-600 dark:text-red-500 mb-3">
              <span className="font-normal inline-block transform scale-x-[2.5] mx-2.5">—</span>
              Processo Audiovisual
              <span className="font-normal inline-block transform scale-x-[2.5] mx-2.5">—</span>
            </span>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-zinc-100 mb-12">
              Da montagem à entrega final
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">
              {[
                { step: '1', title: 'Briefing do Evento', desc: 'Mapeamos o cronograma do evento, momentos-chave que precisam de ser gravados e entrevistas a realizar.' },
                { step: '2', title: 'Captação no Local', desc: 'Nossos técnicos chegam antes para montagem e realizam a captação discreta e profissional.' },
                { step: '3', title: 'Pós-Produção Rápida', desc: 'Montagem, correção de cor, sonorização e entrega rápida das fotos e do vídeo resumo final.' }
              ].map(({ step, title, desc }) => (
                <div key={step} className="flex gap-4 p-6 rounded-lg border bg-white dark:bg-zinc-800 border-zinc-200/80 dark:border-white/10 text-left">
                  <span className="shrink-0 w-10 h-10 rounded-lg border flex items-center justify-center border-red-600/40 dark:border-red-500/40 bg-red-600/5 dark:bg-red-500/5 font-extrabold text-red-600 dark:text-red-500 text-lg">
                    {step}
                  </span>
                  <div>
                    <h4 className="font-bold text-black dark:text-white mb-1">{title}</h4>
                    <p className="text-sm text-black/60 dark:text-zinc-400 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </NotchSection>

      {/* CTA Banner */}
      <NotchSection shape="end" bg="bg-zinc-50 dark:bg-zinc-950">
        <div className="py-20">
          <div className="container mx-auto max-w-7xl px-6">
            <div className="bg-red-600 dark:bg-red-700 text-white py-16 rounded-lg text-center space-y-6 shadow-xl shadow-red-600/10 relative overflow-hidden">
              <h2 className="text-3xl font-extrabold">Planeia um congresso, feira ou gala corporativa?</h2>
              <p className="text-lg text-red-100 max-w-xl mx-auto">
                Garanta que o seu investimento fica registado com qualidade profissional para as suas próximas campanhas de marketing.
              </p>
              <button
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center gap-2 bg-white hover:bg-zinc-100 text-red-600 font-extrabold px-10 py-4 rounded-md shadow-lg transition-all transform hover:-translate-y-0.5 cursor-pointer"
              >
                <span>Solicitar Proposta de Cobertura</span>
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
        initialService="video-producao"
      />

    </div>
  )
}
