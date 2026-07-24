'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n'
import { Coffee, ShieldCheck, Clock, Award, CheckCircle2, ArrowRight } from 'lucide-react'
import { NotchSection } from '@/components/home/NotchSection'

export default function CateringSubPage() {
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
              VisualEventos — Catering Premium
            </span>
            <h1 className="text-4xl font-extrabold text-white mb-4 tracking-tight">
              Serviços de Catering & Banquetes
            </h1>
            <p className="text-lg text-zinc-300 font-normal max-w-2xl mx-auto">
              Menus personalizados e serviço premium de alimentação e bebidas para coffee breaks, cocktails, casamentos e banquetes corporativos.
            </p>
            <div className="mt-8">
              <button
                onClick={() => router.push('/cotacao?categoria=catering')}
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
                  <Coffee className="w-10 h-10" />
                </div>
                <h2 className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-100 tracking-tight">
                  Alimentação de alta qualidade para o seu evento
                </h2>
                <p className="text-zinc-600 dark:text-zinc-400 text-base leading-relaxed">
                  Oferecemos soluções completas de catering adaptadas ao tipo e tamanho do seu evento. Do planeamento do menu, fornecimento de louças, talheres, mesas, ao staff de serviço especializado (cozinheiros, chefes de mesa e empregados de mesa), garantimos qualidade e elegância gastronómica.
                </p>
              </div>

              {/* Direita - Checklist */}
              <div className="md:col-span-5 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-white/10 p-8 rounded-lg">
                <h4 className="font-bold text-zinc-800 dark:text-zinc-200 mb-4 text-sm tracking-wide uppercase border-b border-zinc-100 dark:border-white/10 pb-2">
                  Menus e Modalidades:
                </h4>
                <ul className="space-y-3">
                  {[
                    'Coffee Breaks e Welcome Drinks para conferências',
                    'Cocktails volantes e Finger Food corporativos',
                    'Almoços e jantares de gala / banquetes',
                    'Equipamento completo de buffet, mesas e cadeiras',
                    'Staff especializado de cozinha e serviço de mesa'
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
              Como organizamos
              <span className="font-normal inline-block transform scale-x-[2.5] mx-2.5">—</span>
            </span>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-zinc-100 mb-12">
              Processo de Planeamento de Menus
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">
              {[
                { step: '1', title: 'Definição do Menu', desc: 'Apoiamos na escolha dos pratos, bebidas e formatos ideais com base no perfil e número de convidados.' },
                { step: '2', title: 'Logística & Montagem', desc: 'Montamos toda a estrutura de cozinha móvel, buffet e mesas no local com antecedência técnica.' },
                { step: '3', title: 'Serviço Premium', desc: 'Servimos com rigor e simpatia, garantindo a reposição contínua e a total limpeza pós-evento.' }
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
              <h2 className="text-3xl font-extrabold">Planeia um almoço, jantar ou coffee break corporativo?</h2>
              <p className="text-lg text-red-100 max-w-xl mx-auto">
                Diga-nos o número aproximado de participantes e as restrições alimentares. Criaremos opções de menu exclusivas.
              </p>
              <button
                onClick={() => router.push('/cotacao?categoria=catering')}
                className="inline-flex items-center gap-2 bg-white hover:bg-zinc-100 text-red-600 font-extrabold px-10 py-4 rounded-md shadow-lg transition-all transform hover:-translate-y-0.5 cursor-pointer"
              >
                <span>Solicitar Proposta de Catering</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </NotchSection>

    </div>
  )
}
