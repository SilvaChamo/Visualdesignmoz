'use client'

import { useI18n } from '@/lib/i18n'
import Link from 'next/link'
import { ArrowLeft, Monitor, Smartphone, Globe, Code, Palette, Zap } from 'lucide-react'

export default function WebDesign() {
  const { t } = useI18n()

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
    <div className="min-h-screen bg-black/10">
      <div className="bg-[#404040] relative overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20"
          style={{ backgroundImage: "url('/assets/BG.jpg')" }}
        />
        <div className="absolute inset-0 bg-black/50" />
        <div className="container mx-auto max-w-7xl px-6 pt-[150px] pb-[80px] flex items-center justify-center min-h-[300px] relative z-10">
          <div className="text-center">
            <div className="flex items-center justify-center mb-4">
              <Link href="/" className="text-white hover:text-red-500 transition-colors flex items-center">
                <ArrowLeft className="w-5 h-5 mr-2" />
                {t('common.backToHome')}
              </Link>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">{t('services.web.pageTitle')}</h1>
            <p className="text-base text-white font-normal">
              {t('services.web.pageSubtitle')}
            </p>
          </div>
        </div>
      </div>

      <div className="py-16">
        <div className="container mx-auto max-w-7xl px-6">
          <h2 className="text-2xl font-bold text-black mb-8 text-center">{t('services.web.pageTitle')}</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {servicosWebDesign.map((servico, index) => (
              <div key={index} className="bg-white text-black/70 p-6 rounded-lg">
                <div className="flex items-center mb-4">
                  <div className="text-red-500 mr-3">
                    {servico.icone}
                  </div>
                  <h3 className="text-xl font-bold">{t(servico.tituloKey)}</h3>
                </div>
                
                <p className="text-black/70 mb-6 text-sm leading-relaxed">
                  {t(servico.descKey)}
                </p>
                
                <div className="mb-6">
                  <h4 className="font-medium mb-3 text-sm">{t('common.included')}</h4>
                  <ul className="space-y-0">
                    {servico.servicos.map((item, idx) => (
                      <li key={idx} className="flex items-center text-black/70 text-sm">
                        <span className="w-2 h-2 bg-red-500 rounded-full mr-3"></span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                
                <button className="w-full bg-black text-white px-4 py-3 rounded font-medium hover:bg-red-600 hover:text-white transition-colors">
                  {t('common.requestQuote')}
                </button>
              </div>
            ))}
          </div>

          <div className="mt-16 text-center">
            <h3 className="text-xl font-bold text-black mb-4">{t('services.web.methodology')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gray-50 p-6 rounded-lg">
                <h4 className="font-medium text-black mb-3">{t('services.web.step1.title')}</h4>
                <p className="text-gray-600 text-sm">{t('services.web.step1.desc')}</p>
              </div>
              <div className="bg-gray-50 p-6 rounded-lg">
                <h4 className="font-medium text-black mb-3">{t('services.web.step2.title')}</h4>
                <p className="text-gray-600 text-sm">{t('services.web.step2.desc')}</p>
              </div>
              <div className="bg-gray-50 p-6 rounded-lg">
                <h4 className="font-medium text-black mb-3">{t('services.web.step3.title')}</h4>
                <p className="text-gray-600 text-sm">{t('services.web.step3.desc')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
