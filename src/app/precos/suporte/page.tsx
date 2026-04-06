'use client'

import { useI18n } from '@/lib/i18n'
import Link from 'next/link'
import { ArrowLeft, ArrowRight } from 'lucide-react'

export default function PrecosSuporte() {

  const { t } = useI18n()

  const frequentQuestions = [
    t('pricing.support.q1'),
    t('pricing.support.q2'),
    t('pricing.support.q3'),
    t('pricing.support.q4'),
    t('pricing.support.q5'),
    t('pricing.support.q6'),
    t('pricing.support.q7'),
    t('pricing.support.q8'),
    t('pricing.support.q9'),
    t('pricing.support.q10'),
    t('pricing.support.q11'),
    t('pricing.support.q12')
  ]


  return (
    <div className="min-h-screen bg-white">
      <div className="bg-[#404040] relative overflow-hidden">

        <div className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20" style={{ backgroundImage: "url('/assets/BG.jpg')" }} />
        <div className="absolute inset-0 bg-black/50" />
        <div className="container mx-auto max-w-7xl px-6 pt-[100px] pb-[60px] flex items-center justify-center min-h-[300px] relative z-10">
          <div className="text-center">
            <div className="flex items-center justify-center mb-4">
              <Link href="/" className="text-white hover:text-red-500 transition-colors flex items-center">
                <ArrowLeft className="w-5 h-5 mr-2" />
                {t('common.backToHome')}
              </Link>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">{t('pricing.support.title')}</h1>
            <p className="text-base text-white font-normal">{t('pricing.support.subtitle')}</p>
          </div>
        </div>
      </div>

      <div className="bg-white py-16">
        <div className="container mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {frequentQuestions.map((question, index) => (
              <div key={index} className="bg-black hover:bg-gray-900 rounded-lg p-4 cursor-pointer transition-all group min-h-[120px] flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="text-white font-medium text-sm group-hover:text-red-500 transition-colors leading-tight">{question}</h3>
                    <p className="text-gray-400 text-xs mt-2 font-light">{t('pricing.support.clickForDetails')}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-red-500 transition-colors flex-shrink-0 ml-2" />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-bold text-black mb-3">{t('pricing.support.channels')}</h3>
              <ul className="space-y-2 text-gray-600">
                <li>{t('pricing.hosting.chat')} 24/7</li>
                <li>E-mail: suporte@visualdesign.co.mz</li>
                <li>{t('pricing.domains.support.3')}: +258 84 123 4567</li>
              </ul>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-bold text-black mb-3">{t('pricing.support.hours')}</h3>
              <ul className="space-y-2 text-gray-600">
                <li>{t('pricing.support.monFri')}: 8h - 18h</li>
                <li>{t('pricing.support.sat')}: 9h - 13h</li>
                <li>{t('pricing.support.sun')}: {t('pricing.support.emergencies')}</li>
              </ul>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-bold text-black mb-3">{t('pricing.support.responseTime')}</h3>
              <ul className="space-y-2 text-gray-600">
                <li>Chat: {t('pricing.support.immediate')}</li>
                <li>E-mail: {t('pricing.support.upTo2h')}</li>
                <li>{t('pricing.domains.support.3')}: {t('pricing.support.immediate')}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
