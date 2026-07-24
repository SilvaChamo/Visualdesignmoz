'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n'
import { Tent, Award, Clock, Users, CheckCircle2, ArrowRight } from 'lucide-react'
import { NotchSection } from '@/components/home/NotchSection'

export default function FeirasEventosSubPage() {
  const { t } = useI18n()
  const router = useRouter()

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
              VisualEventos — Stands & Exposições
            </span>
            <h1 className="text-4xl font-extrabold text-white mb-4 tracking-tight">
              Feiras e Stands Promocionais
            </h1>
            <p className="text-lg text-zinc-300 font-normal max-w-2xl mx-auto">
              Desenho, produção e montagem de stands corporativos e estruturas promocionais de alto impacto para feiras, congressos e exposições.
            </p>
            <div className="mt-8">
              <button
                onClick={() => router.push('/cotacao?categoria=feiras-eventos')}
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
                  <Tent className="w-10 h-10" />
                </div>
                <h2 className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-100 tracking-tight">
                  Destaque a sua empresa em qualquer espaço de exposição
                </h2>
                <p className="text-zinc-600 dark:text-zinc-400 text-base leading-relaxed">
                  Para atrair clientes numa feira ou congresso, o seu espaço precisa de comunicar profissionalismo e inovação. A nossa equipa assegura todo o ciclo: desde a modelação 3D do stand até à produção gráfica, montagem no local, aluguer de som, luz, e desmontagem após o evento.
                </p>
              </div>

              {/* Direita - Checklist */}
              <div className="md:col-span-5 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-white/10 p-8 rounded-lg">
                <h4 className="font-bold text-zinc-800 dark:text-zinc-200 mb-4 text-sm tracking-wide uppercase border-b border-zinc-100 dark:border-white/10 pb-2">
                  O que oferecemos:
                </h4>
                <ul className="space-y-3">
                  {[
                    'Design e modelação 3D personalizada do stand',
                    'Stands modulares e stands construídos sob medida',
                    'Impressão de painéis, banners, vinil e roll-ups',
                    'Montagem e desmontagem técnica no local da feira',
                    'Instalação de sistemas de iluminação e ecrãs multimedia'
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
              Fluxo do Projecto
              <span className="font-normal inline-block transform scale-x-[2.5] mx-2.5">—</span>
            </span>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-zinc-100 mb-12">
              Planeamento de ponta a ponta sem imprevistos
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">
              {[
                { step: '1', title: 'Conceito & Maquete 3D', desc: 'Apresentamos um estudo detalhado em 3D do stand para aprovação do espaço e circulação.' },
                { step: '2', title: 'Produção & Logística', desc: 'Fabricamos os componentes e impressões gráficas e transportamos para o local do evento.' },
                { step: '3', title: 'Montagem & Entrega', desc: 'Nossa equipa de técnicos monta e verifica todos os pontos (eléctrico, luz, som) antes da abertura.' }
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
              <h2 className="text-3xl font-extrabold">Tem uma feira ou exposição brevemente?</h2>
              <p className="text-lg text-red-100 max-w-xl mx-auto">
                Partilhe connosco a data e as medidas do espaço. A nossa equipa criará um layout à medida dos seus objectivos comerciais.
              </p>
              <button
                onClick={() => router.push('/cotacao?categoria=feiras-eventos')}
                className="inline-flex items-center gap-2 bg-white hover:bg-zinc-100 text-red-600 font-extrabold px-10 py-4 rounded-md shadow-lg transition-all transform hover:-translate-y-0.5 cursor-pointer"
              >
                <span>Solicitar Proposta Comercial</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </NotchSection>

    </div>
  )
}
