'use client'

import { useI18n } from '@/lib/i18n'
import { Palette, PenTool, Layers, Download } from 'lucide-react'

export default function DesignGrafico() {
  const { t } = useI18n()

  const servicosDesign = [
    { icone: <Palette className="w-8 h-8" />, tituloKey: 'services.design.identity', descKey: 'services.design.identity.desc', servicos: [t('services.list.design.1'), t('services.list.design.2'), t('services.list.design.3'), t('services.list.design.4')] },
    { icone: <PenTool className="w-8 h-8" />, tituloKey: 'services.design.materials', descKey: 'services.design.materials.desc', servicos: [t('services.list.design.5'), t('services.list.design.6'), t('services.list.design.7'), t('services.list.design.8')] },
    { icone: <Layers className="w-8 h-8" />, tituloKey: 'services.design.social', descKey: 'services.design.social.desc', servicos: [t('services.list.design.9'), t('services.list.design.10'), t('services.list.design.11'), t('services.list.design.12')] },
    { icone: <Download className="w-8 h-8" />, tituloKey: 'services.design.print', descKey: 'services.design.print.desc', servicos: [t('services.list.design.13'), t('services.list.design.14'), t('services.list.design.15'), t('services.list.design.16')] }
  ]

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-[#404040] relative overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20" style={{ backgroundImage: "url('/assets/BG.jpg')" }} />
        <div className="absolute inset-0 bg-black/50" />
        <div className="container mx-auto max-w-7xl px-6 pt-[150px] pb-[80px] flex items-center justify-center min-h-[300px] relative z-10">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-white mb-2">{t('services.design.pageTitle')}</h1>
            <p className="text-base text-white font-normal">{t('services.design.identity.desc')}</p>
          </div>
        </div>
      </div>

      <div className="py-16">
        <div className="container mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {servicosDesign.map((servico, index) => (
              <div key={index} className="bg-white text-black/70 p-6 rounded-lg">
                <div className="flex items-center mb-4">
                  <div className="text-red-500 mr-3">{servico.icone}</div>
                  <h3 className="text-xl font-bold">{t(servico.tituloKey)}</h3>
                </div>
                <p className="text-black/70 mb-6 text-sm leading-relaxed">{t(servico.descKey)}</p>
                <div className="mb-6">
                  <h4 className="font-medium mb-3 text-sm">{t('services.design.included')}</h4>
                  <ul className="space-y-0">
                    {servico.servicos.map((item, idx) => (
                      <li key={idx} className="flex items-center text-black/70 text-sm">
                        <span className="w-2 h-2 bg-red-500 rounded-full mr-3"></span>{item}
                      </li>
                    ))}
                  </ul>
                </div>
                <button className="w-full bg-black text-white px-4 py-3 rounded font-medium hover:bg-red-600 hover:text-white transition-colors">
                  {t('services.design.quote')}
                </button>
              </div>
            ))}
          </div>

          <div className="mt-16 text-center">
            <h3 className="text-xl font-bold text-black mb-4">{t('services.design.methodology')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-lg">
                <h4 className="font-medium text-black mb-3">{t('services.design.briefing')}</h4>
                <p className="text-gray-600 text-sm">{t('services.design.briefing.desc')}</p>
              </div>
              <div className="bg-white p-6 rounded-lg">
                <h4 className="font-medium text-black mb-3">{t('services.design.mockups')}</h4>
                <p className="text-gray-600 text-sm">{t('services.design.mockups.desc')}</p>
              </div>
              <div className="bg-white p-6 rounded-lg">
                <h4 className="font-medium text-black mb-3">{t('services.design.delivery')}</h4>
                <p className="text-gray-600 text-sm">{t('services.design.delivery.desc')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
