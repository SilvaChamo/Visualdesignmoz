'use client'

import { useI18n } from '@/lib/i18n'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import DomainSearch from '@/components/DomainSearch'

export default function PrecosDominios() {
  const { t } = useI18n()

  const domains = [
    { ext: '.com', reg: '8,88 US$', ren: '9,98 US$', icann: '0,20 US$ /ano', trans: '9,48 US$' },
    { ext: '.farm', reg: '4,14 US$', ren: '31,05 US$', icann: '0,20 US$ /ano', trans: '31,05 US$' },
    { ext: '.org', reg: '6,48 US$', ren: '9,80 US$', icann: '0,20 US$ /ano', trans: '9,50 US$' },
    { ext: '.net', reg: '11,20 US$', ren: '11,20 US$', icann: '0,20 US$ /ano', trans: '11,20 US$' },
    { ext: '.ai', reg: '69,98 US$', ren: '79,98 US$', icann: '0,20 US$ /ano', trans: '69,98 US$' },
  ]

  return (
    <div className="min-h-screen bg-white">
      {/* Header Section */}
      <div className="bg-[#404040] relative overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20"
          style={{ backgroundImage: "url('/assets/BG.jpg')" }}
        />
        <div className="absolute inset-0 bg-black/50" />
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 pt-[80px] sm:pt-[100px] md:pt-[120px] pb-[30px] flex flex-col justify-between items-center min-h-[300px] sm:min-h-[350px] relative z-10">
          <div className="w-full max-w-4xl text-center mb-8">
            <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-2 sm:mb-4">
              {t('pricing.domains.title')}
            </h1>
            <p className="text-sm sm:text-base md:text-lg text-white font-normal mb-8 max-w-2xl mx-auto">
              {t('pricing.domains.subtitle')}
            </p>
            
            <div className="flex justify-center">
              <DomainSearch activeTab="pricing" />
            </div>
          </div>
        </div>
      </div>

      {/* Modern Pricing List Section */}
      <div className="bg-white py-12">
        <div className="container mx-auto max-w-5xl px-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-slate-800">Tabela de Preços</h2>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
            <div className="divide-y divide-slate-100">
              {domains.map((domain, index) => (
                <div key={index} className="p-5 sm:p-6 hover:bg-slate-50 transition-colors grid grid-cols-1 sm:grid-cols-5 gap-4 items-center">
                  
                  {/* Extensão */}
                  <div className="sm:col-span-1">
                    <h3 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                      {domain.ext}
                    </h3>
                  </div>

                  {/* Registar */}
                  <div className="sm:col-span-1 flex flex-col">
                    <span className="text-xs text-slate-500 mb-1">{t('pricing.domains.table.reg')}</span>
                    <span className="font-bold text-slate-800 text-lg">{domain.reg} <span className="text-xs font-normal text-slate-500">/ano</span></span>
                  </div>

                  {/* Renovar */}
                  <div className="sm:col-span-1 flex flex-col">
                    <span className="text-xs text-slate-500 mb-1">{t('pricing.domains.table.ren')}</span>
                    <span className="font-bold text-slate-800 text-lg">{domain.ren} <span className="text-xs font-normal text-slate-500">/ano</span></span>
                  </div>

                  {/* ICANN */}
                  <div className="sm:col-span-1 flex flex-col">
                    <span className="text-xs text-slate-500 mb-1">Taxa ICANN</span>
                    <span className="font-bold text-slate-800 text-lg">{domain.icann}</span>
                  </div>

                  {/* Transferir */}
                  <div className="sm:col-span-1 flex flex-col">
                    <span className="text-xs text-slate-500 mb-1">{t('pricing.domains.table.trans')}</span>
                    <span className="font-bold text-slate-800 text-lg">{domain.trans}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-6">
              <h3 className="text-lg font-bold text-slate-800 mb-4">{t('pricing.domains.why.title')}</h3>
              <ul className="space-y-3 text-slate-600">
                <li className="flex items-start">
                  <span className="text-green-500 mr-2 font-bold">✓</span>
                  <span className="text-sm">{t('pricing.domains.why.1')}</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2 font-bold">✓</span>
                  <span className="text-sm">{t('pricing.domains.why.2')}</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2 font-bold">✓</span>
                  <span className="text-sm">{t('pricing.domains.why.3')}</span>
                </li>
              </ul>
            </div>
            
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-6">
              <h3 className="text-lg font-bold text-slate-800 mb-4">{t('pricing.domains.included.title')}</h3>
              <ul className="space-y-3 text-slate-600">
                <li className="flex items-start">
                  <span className="text-green-500 mr-2 font-bold">✓</span>
                  <span className="text-sm">{t('pricing.domains.included.1')}</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2 font-bold">✓</span>
                  <span className="text-sm">{t('pricing.domains.included.2')}</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2 font-bold">✓</span>
                  <span className="text-sm">{t('pricing.domains.included.3')}</span>
                </li>
              </ul>
            </div>
            
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-6">
              <h3 className="text-lg font-bold text-slate-800 mb-4">{t('pricing.domains.support.title')}</h3>
              <ul className="space-y-3 text-slate-600">
                <li className="flex items-start">
                  <span className="text-green-500 mr-2 font-bold">✓</span>
                  <span className="text-sm">{t('pricing.domains.support.1')}</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2 font-bold">✓</span>
                  <span className="text-sm">{t('pricing.domains.support.2')}</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2 font-bold">✓</span>
                  <span className="text-sm">{t('pricing.domains.support.3')}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
