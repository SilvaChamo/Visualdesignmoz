'use client'

import { useI18n } from '@/lib/i18n'
import Link from 'next/link'
import { Palette, PenTool, Layers, Download, ArrowRight, CheckCircle2 } from 'lucide-react'

export default function DesignGrafico() {
  const { t } = useI18n()

  const servicosDesign = [
    { icone: <Palette className="w-8 h-8" />, tituloKey: 'services.design.identity', descKey: 'services.design.identity.desc', servicos: [t('services.list.design.1'), t('services.list.design.2'), t('services.list.design.3'), t('services.list.design.4')] },
    { icone: <PenTool className="w-8 h-8" />, tituloKey: 'services.design.materials', descKey: 'services.design.materials.desc', servicos: [t('services.list.design.5'), t('services.list.design.6'), t('services.list.design.7'), t('services.list.design.8')] },
    { icone: <Layers className="w-8 h-8" />, tituloKey: 'services.design.social', descKey: 'services.design.social.desc', servicos: [t('services.list.design.9'), t('services.list.design.10'), t('services.list.design.11'), t('services.list.design.12')] },
    { icone: <Download className="w-8 h-8" />, tituloKey: 'services.design.print', descKey: 'services.design.print.desc', servicos: [t('services.list.design.13'), t('services.list.design.14'), t('services.list.design.15'), t('services.list.design.16')] }
  ]

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-foreground">
      {/* Hero Section */}
      <div className="bg-[#09090b] relative overflow-hidden border-b border-zinc-200 dark:border-zinc-800">
        <div className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-10" style={{ backgroundImage: "url('/assets/BG.jpg')" }} />
        <div className="absolute inset-0 bg-black/55" />
        <div className="container mx-auto max-w-7xl px-6 pt-[150px] pb-[80px] flex items-center justify-center min-h-[300px] relative z-10">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-white mb-2">{t('services.design.pageTitle')}</h1>
            <p className="text-base text-zinc-300 font-normal">{t('services.design.identity.desc')}</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="py-16">
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

          {/* Methodology */}
          <div className="mt-20 text-center">
            <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-10">{t('services.design.methodology')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 p-6 rounded-2xl">
                <span className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/20 text-red-600 dark:text-red-400 font-extrabold text-lg flex items-center justify-center mx-auto mb-4">1</span>
                <h4 className="font-bold text-zinc-900 dark:text-zinc-100 mb-3">{t('services.design.briefing')}</h4>
                <p className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed">{t('services.design.briefing.desc')}</p>
              </div>
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 p-6 rounded-2xl">
                <span className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/20 text-red-600 dark:text-red-400 font-extrabold text-lg flex items-center justify-center mx-auto mb-4">2</span>
                <h4 className="font-bold text-zinc-900 dark:text-zinc-100 mb-3">{t('services.design.mockups')}</h4>
                <p className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed">{t('services.design.mockups.desc')}</p>
              </div>
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 p-6 rounded-2xl">
                <span className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/20 text-red-600 dark:text-red-400 font-extrabold text-lg flex items-center justify-center mx-auto mb-4">3</span>
                <h4 className="font-bold text-zinc-900 dark:text-zinc-100 mb-3">{t('services.design.delivery')}</h4>
                <p className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed">{t('services.design.delivery.desc')}</p>
              </div>
            </div>
          </div>

          {/* Unified CTA Banner at the bottom */}
          <div className="bg-red-600 dark:bg-red-700 text-white py-16 mt-20 rounded-3xl text-center space-y-6 shadow-xl shadow-red-600/10">
            <h2 className="text-3xl font-extrabold">Quer dar uma nova imagem à sua marca?</h2>
            <p className="text-lg text-red-100 max-w-xl mx-auto">
              A nossa equipa desenvolve materiais visuais, branding e designs promocionais únicos que destacam a sua empresa no mercado.
            </p>
            <Link
              href="/contacto?servico=design-grafico"
              className="inline-flex items-center gap-2 bg-white text-red-600 font-bold px-10 py-4 rounded-xl shadow-lg hover:bg-zinc-100 transition-all transform hover:-translate-y-0.5"
            >
              <span>Pedir Orçamento Gratuito</span>
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>

        </div>
      </div>
    </div>
  )
}
