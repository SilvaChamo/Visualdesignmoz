'use client'

import React, { useState } from 'react'
import { useI18n } from '@/lib/i18n'
import { Palette, PenTool, Layers, Download, ArrowRight, CheckCircle2 } from 'lucide-react'
import { NotchSection } from '@/components/home/NotchSection'
import { BudgetRequestModal } from '@/components/forms/BudgetRequestModal'

export default function DesignGrafico() {
  const { t } = useI18n()
  const [isModalOpen, setIsModalOpen] = useState(false)

  const servicosDesign = [
    { icone: <Palette className="w-8 h-8" />, tituloKey: 'services.design.identity', descKey: 'services.design.identity.desc', servicos: [t('services.list.design.1'), t('services.list.design.2'), t('services.list.design.3'), t('services.list.design.4')] },
    { icone: <PenTool className="w-8 h-8" />, tituloKey: 'services.design.materials', descKey: 'services.design.materials.desc', servicos: [t('services.list.design.5'), t('services.list.design.6'), t('services.list.design.7'), t('services.list.design.8')] },
    { icone: <Layers className="w-8 h-8" />, tituloKey: 'services.design.social', descKey: 'services.design.social.desc', servicos: [t('services.list.design.9'), t('services.list.design.10'), t('services.list.design.11'), t('services.list.design.12')] },
    { icone: <Download className="w-8 h-8" />, tituloKey: 'services.design.print', descKey: 'services.design.print.desc', servicos: [t('services.list.design.13'), t('services.list.design.14'), t('services.list.design.15'), t('services.list.design.16')] }
  ]

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-foreground">
      
      {/* Hero Section */}
      <NotchSection shape="start" bg="bg-[#09090b]" first>
        <div className="relative overflow-hidden pt-[180px] pb-[100px]">
          <div className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-10" style={{ backgroundImage: "url('/assets/BG.jpg')" }} />
          <div className="absolute inset-0 bg-black/55" />
          <div className="container mx-auto max-w-7xl px-6 relative z-10 text-center">
            <h1 className="text-4xl font-extrabold text-white mb-4 tracking-tight">{t('services.design.pageTitle')}</h1>
            <p className="text-lg text-zinc-300 font-normal max-w-2xl mx-auto">{t('services.design.identity.desc')}</p>
          </div>
        </div>
      </NotchSection>

      {/* Main Content */}
      <NotchSection shape="end" bg="bg-zinc-50 dark:bg-zinc-950">
        <div className="py-20">
          <div className="container mx-auto max-w-7xl px-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {servicosDesign.map((servico, index) => (
                <div key={index} className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 p-6 rounded-2xl shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center mb-4">
                      <div className="text-red-500 mr-3">{servico.icone}</div>
                      <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{t(servico.tituloKey)}</h3>
                    </div>
                    <p className="text-zinc-600 dark:text-zinc-400 mb-6 text-sm leading-relaxed">{t(servico.descKey)}</p>
                    <div>
                      <h4 className="font-semibold text-zinc-700 dark:text-zinc-300 mb-3 text-sm">{t('services.design.included') || 'Incluído:'}</h4>
                      <ul className="space-y-2">
                        {servico.servicos.map((item, idx) => (
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

      {/* Methodology Section */}
      <NotchSection shape="mid" bg="bg-white dark:bg-zinc-900">
        <div className="py-20">
          <div className="container mx-auto max-w-7xl px-6 text-center">
            <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-12">{t('services.design.methodology')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800 p-8 rounded-2xl">
                <span className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/20 text-red-600 dark:text-red-400 font-black text-xl flex items-center justify-center mx-auto mb-4">1</span>
                <h4 className="font-bold text-zinc-900 dark:text-zinc-100 mb-3">{t('services.design.briefing')}</h4>
                <p className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed">{t('services.design.briefing.desc')}</p>
              </div>
              <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800 p-8 rounded-2xl">
                <span className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/20 text-red-600 dark:text-red-400 font-black text-xl flex items-center justify-center mx-auto mb-4">2</span>
                <h4 className="font-bold text-zinc-900 dark:text-zinc-100 mb-3">{t('services.design.mockups')}</h4>
                <p className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed">{t('services.design.mockups.desc')}</p>
              </div>
              <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800 p-8 rounded-2xl">
                <span className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/20 text-red-600 dark:text-red-400 font-black text-xl flex items-center justify-center mx-auto mb-4">3</span>
                <h4 className="font-bold text-zinc-900 dark:text-zinc-100 mb-3">{t('services.design.delivery')}</h4>
                <p className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed">{t('services.design.delivery.desc')}</p>
              </div>
            </div>
          </div>
        </div>
      </NotchSection>

      {/* CTA Banner Section */}
      <NotchSection shape="end" bg="bg-zinc-50 dark:bg-zinc-950">
        <div className="py-20">
          <div className="container mx-auto max-w-7xl px-6">
            <div className="bg-red-600 dark:bg-red-700 text-white py-16 rounded-[2.5rem] text-center space-y-6 shadow-xl shadow-red-600/10 relative overflow-hidden">
              <h2 className="text-3xl font-extrabold">Quer dar uma nova imagem à sua marca?</h2>
              <p className="text-lg text-red-100 max-w-xl mx-auto">
                A nossa equipa desenvolve materiais visuais, branding e designs promocionais únicos que destacam a sua empresa no mercado.
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
        initialService="design-grafico"
      />

    </div>
  )
}
