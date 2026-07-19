'use client'

import React, { useState } from 'react'
import { useI18n } from '@/lib/i18n'
import { Palette, PenTool, Layers, Printer, ArrowRight, CheckCircle2 } from 'lucide-react'
import { NotchSection } from '@/components/home/NotchSection'
import { BudgetRequestModal } from '@/components/forms/BudgetRequestModal'

const tabs = [
  {
    label: 'Identidade Visual',
    icon: <Palette className="w-10 h-10" />,
    desc: 'Criação completa da identidade visual da sua marca com logo, cores, tipografia e manual de normas gráficas.',
    items: ['Criação de logotipo', 'Manual de identidade visual', 'Paleta de cores e tipografia', 'Favicon e ícones de marca'],
  },
  {
    label: 'Materiais de Comunicação',
    icon: <PenTool className="w-10 h-10" />,
    desc: 'Design de materiais impressos e digitais para comunicar com o seu público de forma profissional e consistente.',
    items: ['Cartões de visita', 'Brochuras e flyers', 'Banners e mupis', 'Apresentações corporativas'],
  },
  {
    label: 'Design para Redes Sociais',
    icon: <Layers className="w-10 h-10" />,
    desc: 'Criação de templates e conteúdos visuais otimizados para Instagram, Facebook, LinkedIn e outras plataformas.',
    items: ['Templates de posts e stories', 'Capas de perfil e banner', 'Peças publicitárias digitais', 'Pacotes de conteúdo mensal'],
  },
  {
    label: 'Produção Gráfica',
    icon: <Printer className="w-10 h-10" />,
    desc: 'Preparação de ficheiros prontos para impressão com qualidade profissional e atenção aos detalhes técnicos.',
    items: ['Ficheiros prontos para impressão', 'Embalagens e rótulos', 'Sinalética e roll-ups', 'Revisão e pré-press'],
  },
]

export default function DesignGrafico() {
  const { t } = useI18n()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState(0)

  const active = tabs[activeTab]

  return (
    <div className="min-h-screen bg-white dark:bg-black text-foreground">

      {/* ── Hero ──────────────────────────────────────────────── */}
      <NotchSection shape="start" bg="bg-black" first>
        <div className="relative overflow-hidden pt-[180px] pb-[90px]">
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20 dark:opacity-10"
            style={{ backgroundImage: "url('/assets/BG.jpg')" }}
          />
          <div className="absolute inset-0 bg-black/50" />
          <div className="container mx-auto max-w-7xl px-4 sm:px-6 relative z-10 text-center">
            <h1 className="font-bold leading-[1.15] text-white text-[clamp(1.75rem,3.2vw+1rem,2.75rem)] max-w-2xl mx-auto">
              Nossos Serviços de Design Gráfico
            </h1>
            <p className="text-sm sm:text-base text-zinc-300 max-w-xl mx-auto mt-4 leading-relaxed">
              Da identidade visual aos materiais impressos — criamos peças que comunicam, diferenciam e marcam presença.
            </p>
          </div>
        </div>
      </NotchSection>

      {/* ── Tabs: texto puro centrado dentro da secção fechada ── */}
      <NotchSection shape="end" bg="bg-black dark:bg-black">
        <div className="py-12">
          <div className="container mx-auto max-w-7xl px-4 sm:px-6">
            <nav className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
              {tabs.map((tab, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveTab(idx)}
                  className={`relative text-sm sm:text-base font-bold tracking-wide uppercase transition-colors duration-300 cursor-pointer pb-1 ${
                    activeTab === idx
                      ? 'text-white'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {tab.label}
                  {/* underline indicator */}
                  <span
                    className={`absolute bottom-0 left-0 right-0 h-[2px] bg-red-500 transition-transform duration-300 origin-left ${
                      activeTab === idx ? 'scale-x-100' : 'scale-x-0'
                    }`}
                  />
                </button>
              ))}
            </nav>
          </div>
        </div>
      </NotchSection>

      {/* ── Conteúdo do tab ativo ─────────────────────────────── */}
      <NotchSection shape="mid" bg="bg-zinc-50 dark:bg-zinc-950">
        <div className="py-20">
          <div className="container mx-auto max-w-7xl px-4 sm:px-6">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-10 items-start">

              {/* Esquerda — descrição + CTA */}
              <div className="md:col-span-7 space-y-6">
                <div className="text-red-500 bg-red-50 dark:bg-red-950/20 p-4 rounded-2xl w-fit">
                  {active.icon}
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-black dark:text-white tracking-tight">
                  {active.label}
                </h2>
                <p className="text-sm sm:text-base text-black/60 dark:text-zinc-400 leading-relaxed">
                  {active.desc}
                </p>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-8 py-3 rounded-md shadow-lg shadow-red-600/20 transition-all duration-300 transform hover:-translate-y-0.5 cursor-pointer text-sm"
                >
                  <span>Solicitar Orçamento</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              {/* Direita — checklist */}
              <div className="md:col-span-5 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-white/10 p-6 rounded-lg">
                <h4 className="font-bold text-black dark:text-white mb-4 text-xs uppercase tracking-widest border-b border-zinc-100 dark:border-white/10 pb-3">
                  O que incluímos:
                </h4>
                <ul className="space-y-3">
                  {active.items.map((item, idx) => (
                    <li key={idx} className="flex items-center gap-3 text-sm text-black/70 dark:text-zinc-400">
                      <div className="shrink-0 w-6 h-6 rounded-lg border flex items-center justify-center border-red-600/40 dark:border-red-500/40 bg-red-600/5 dark:bg-red-500/5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-red-600 dark:text-red-500" />
                      </div>
                      <span className="font-semibold">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

            </div>
          </div>
        </div>
      </NotchSection>

      {/* ── Metodologia ──────────────────────────────────────── */}
      <NotchSection shape="mid-alt" bg="bg-zinc-200 dark:bg-black">
        <div className="py-20">
          <div className="container mx-auto max-w-7xl px-4 sm:px-6 text-center">
            <span className="text-xs sm:text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 text-red-600 dark:text-red-500 mb-3">
              <span className="font-normal inline-block transform scale-x-[2.5] mx-2.5">—</span>
              Como Trabalhamos
              <span className="font-normal inline-block transform scale-x-[2.5] mx-2.5">—</span>
            </span>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-black dark:text-white mb-12">
              A Nossa Metodologia
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8 mx-5">
              {[
                { step: '1', title: 'Briefing', desc: 'Ouvimos as suas necessidades, entendemos o mercado e definimos os objetivos do projeto.' },
                { step: '2', title: 'Criação e Revisão', desc: 'Desenvolvemos conceitos, apresentamos mockups e refinamos até à aprovação final.' },
                { step: '3', title: 'Entrega', desc: 'Fornecemos todos os ficheiros nos formatos adequados, prontos para uso digital e impressão.' },
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

      {/* ── CTA Banner ───────────────────────────────────────── */}
      <NotchSection shape="end" bg="bg-zinc-50 dark:bg-zinc-950">
        <div className="py-20">
          <div className="container mx-auto max-w-7xl px-4 sm:px-6">
            <div className="bg-red-600 text-white py-16 rounded-lg text-center space-y-6 shadow-lg shadow-red-600/20">
              <h2 className="text-2xl sm:text-3xl font-extrabold">Quer dar uma nova imagem à sua marca?</h2>
              <p className="text-sm sm:text-base text-red-100 max-w-xl mx-auto leading-relaxed">
                A nossa equipa desenvolve materiais visuais, branding e designs promocionais únicos que destacam a sua empresa no mercado.
              </p>
              <button
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center gap-2 bg-white hover:bg-zinc-100 text-red-600 font-bold px-10 py-3 rounded-md shadow-lg transition-all duration-300 transform hover:-translate-y-0.5 cursor-pointer"
              >
                <span>Pedir Orçamento Gratuito</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </NotchSection>

      {/* ── Modal ────────────────────────────────────────────── */}
      <BudgetRequestModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialService="design-grafico"
      />

    </div>
  )
}
