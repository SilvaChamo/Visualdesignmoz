'use client'

import React, { useState } from 'react'
import { useI18n } from '@/lib/i18n'
import { Monitor, Smartphone, Globe, Code, Palette, Zap, ArrowRight, CheckCircle2 } from 'lucide-react'
import { NotchSection } from '@/components/home/NotchSection'
import { BudgetRequestModal } from '@/components/forms/BudgetRequestModal'

export default function WebDesign() {
  const { t } = useI18n()
  const [isModalOpen, setIsModalOpen] = useState(false)

  const servicosWebDesign = [
    {
      icone: <Monitor className="w-8 h-8" />,
      tituloKey: 'services.web.title',
      descKey: 'services.web.desc',
      servicos: [t('services.list.web.1'), t('services.list.web.2'), t('services.list.web.3'), t('services.list.web.4')]
    },
    {
      icone: <Smartphone className="w-8 h-8" />,
      tituloKey: 'services.web.responsive',
      descKey: 'services.web.responsive.desc',
      servicos: [t('services.list.web.5'), t('services.list.web.6'), t('services.list.web.7'), t('services.list.web.8')]
    },
    {
      icone: <Globe className="w-8 h-8" />,
      tituloKey: 'services.web.ecommerce',
      descKey: 'services.web.ecommerce.desc',
      servicos: [t('services.list.web.9'), t('services.list.web.10'), t('services.list.web.11'), t('services.list.web.12')]
    },
    {
      icone: <Code className="w-8 h-8" />,
      tituloKey: 'services.web.custom',
      descKey: 'services.web.custom.desc',
      servicos: [t('services.list.web.13'), t('services.list.web.14'), t('services.list.web.15'), t('services.list.web.16')]
    },
    {
      icone: <Palette className="w-8 h-8" />,
      tituloKey: 'services.web.uiux',
      descKey: 'services.web.uiux.desc',
      servicos: [t('services.list.web.17'), t('services.list.web.18'), t('services.list.web.19'), t('services.list.web.20')]
    },
    {
      icone: <Zap className="w-8 h-8" />,
      tituloKey: 'services.web.performance',
      descKey: 'services.web.performance.desc',
      servicos: [t('services.list.web.21'), t('services.list.web.22'), t('services.list.web.23'), t('services.list.web.24')]
    }
  ]

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-foreground">
      
      {/* Hero Section */}
      <NotchSection shape="start" bg="bg-[#09090b]" first>
        <div className="relative overflow-hidden pt-[180px] pb-[100px]">
          <div 
            className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-10"
            style={{ backgroundImage: "url('/assets/BG.jpg')" }}
          />
          <div className="absolute inset-0 bg-black/55" />
          <div className="container mx-auto max-w-7xl px-6 relative z-10 text-center">
            <h1 className="text-4xl font-extrabold text-white mb-4 tracking-tight">{t('services.web.pageTitle')}</h1>
            <p className="text-lg text-zinc-300 font-normal max-w-2xl mx-auto">
              {t('services.web.pageSubtitle')}
            </p>
          </div>
        </div>
      </NotchSection>

      {/* Services Grid Section */}
      <NotchSection shape="end" bg="bg-zinc-50 dark:bg-zinc-950">
        <div className="py-20">
          <div className="container mx-auto max-w-7xl px-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {servicosWebDesign.map((servico, index) => (
                <div key={index} className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 p-6 rounded-2xl shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center mb-4">
                      <div className="text-red-500 mr-3">
                        {servico.icone}
                      </div>
                      <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{t(servico.tituloKey)}</h3>
                    </div>
                    
                    <p className="text-zinc-600 dark:text-zinc-400 mb-6 text-sm leading-relaxed">
                      {t(servico.descKey)}
                    </p>
                    
                    <div>
                      <h4 className="font-semibold text-zinc-700 dark:text-zinc-300 mb-3 text-sm">{t('common.included')}</h4>
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
            <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-12">{t('services.web.methodology')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800 p-8 rounded-2xl">
                <span className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/20 text-red-600 dark:text-red-400 font-black text-xl flex items-center justify-center mx-auto mb-4">1</span>
                <h4 className="font-bold text-zinc-900 dark:text-zinc-100 mb-3">{t('services.web.step1.title')}</h4>
                <p className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed">{t('services.web.step1.desc')}</p>
              </div>
              <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800 p-8 rounded-2xl">
                <span className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/20 text-red-600 dark:text-red-400 font-black text-xl flex items-center justify-center mx-auto mb-4">2</span>
                <h4 className="font-bold text-zinc-900 dark:text-zinc-100 mb-3">{t('services.web.step2.title')}</h4>
                <p className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed">{t('services.web.step2.desc')}</p>
              </div>
              <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800 p-8 rounded-2xl">
                <span className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/20 text-red-600 dark:text-red-400 font-black text-xl flex items-center justify-center mx-auto mb-4">3</span>
                <h4 className="font-bold text-zinc-900 dark:text-zinc-100 mb-3">{t('services.web.step3.title')}</h4>
                <p className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed">{t('services.web.step3.desc')}</p>
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
              <h2 className="text-3xl font-extrabold">Pronto para criar o seu site?</h2>
              <p className="text-lg text-red-100 max-w-xl mx-auto">
                Desenvolvemos soluções integradas de web design, alojamento e otimização para colocar o seu negócio online hoje mesmo.
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
        initialService="webdesign"
      />
      
    </div>
  )
}
