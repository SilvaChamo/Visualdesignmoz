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
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-foreground">
      <div className="bg-[#09090b] relative overflow-hidden border-b border-zinc-200 dark:border-zinc-800">
        <div className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-10" style={{ backgroundImage: "url('/assets/BG.jpg')" }} />
        <div className="absolute inset-0 bg-black/55" />
        <div className="container mx-auto max-w-7xl px-6 pt-[150px] pb-[80px] flex items-center justify-center min-h-[300px] relative z-10">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-white mb-2">{t('pricing.support.title')}</h1>
            <p className="text-base text-zinc-300 font-normal">{t('pricing.support.subtitle')}</p>
          </div>
        </div>
      </div>

      <div className="py-16">
        <div className="container mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {frequentQuestions.map((question, index) => (
              <div key={index} className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 hover:border-red-500 rounded-lg p-4 cursor-pointer transition-all group min-h-[120px] flex flex-col justify-between">
                <div className="flex justify-between items-start w-full">
                  <div className="flex-1">
                    <h3 className="text-zinc-950 dark:text-zinc-100 font-bold text-sm group-hover:text-red-500 transition-colors leading-tight">{question}</h3>
                    <p className="text-zinc-500 dark:text-zinc-400 text-xs mt-2 font-light">{t('pricing.support.clickForDetails')}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-zinc-400 group-hover:text-red-500 transition-colors flex-shrink-0 ml-2" />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-lg p-6">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-3">{t('pricing.support.channels')}</h3>
              <ul className="space-y-2 text-zinc-600 dark:text-zinc-400 text-sm">
                <li>{t('pricing.hosting.chat')} 24/7</li>
                <li>E-mail: suporte@visualdesignmoz.com</li>
                <li>{t('pricing.domains.support.3')}: +258 82 52 88 318</li>
              </ul>
            </div>
            
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-lg p-6">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-3">{t('pricing.support.hours')}</h3>
              <ul className="space-y-2 text-zinc-600 dark:text-zinc-400 text-sm">
                <li>{t('pricing.support.monFri')}: 8h - 18h</li>
                <li>{t('pricing.support.sat')}: 9h - 13h</li>
                <li>{t('pricing.support.sun')}: {t('pricing.support.emergencies')}</li>
              </ul>
            </div>
            
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-lg p-6">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-3">{t('pricing.support.responseTime')}</h3>
              <ul className="space-y-2 text-zinc-600 dark:text-zinc-400 text-sm">
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
