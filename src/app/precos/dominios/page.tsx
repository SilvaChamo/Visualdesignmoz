'use client'

import { useI18n } from '@/lib/i18n'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function PrecosDominios() {
  const { t } = useI18n()

  return (
    <div className="min-h-screen bg-white">
      {/* Header Section - Gray 25% */}

      <div className="bg-[#404040] relative overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20"
          style={{ backgroundImage: "url('/assets/BG.jpg')" }}
        />
        <div className="absolute inset-0 bg-black/50" />
        <div className="container mx-auto max-w-7xl px-6 pt-[100px] pb-[60px] flex items-center justify-center min-h-[300px] relative z-10">
          <div className="text-center">
            <div className="flex items-center justify-center mb-4">
              <Link href="/" className="text-white hover:text-red-500 transition-colors flex items-center">
                <ArrowLeft className="w-5 h-5 mr-2" />
                {t('common.backToHome')}
              </Link>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">
              {t('pricing.domains.title')}
            </h1>
            <p className="text-base text-white font-normal">
              {t('pricing.domains.subtitle')}
            </p>
          </div>
        </div>
      </div>

      {/* Pricing Section */}
      <div className="bg-white py-16">
        <div className="container mx-auto max-w-7xl px-6">
          <div className="overflow-x-auto">
            <table className="w-full bg-white rounded-lg shadow-lg overflow-hidden">
              <thead className="bg-red-600 text-white">
                <tr>
                  <th className="px-6 py-4 text-left">{t('pricing.domains.table.ext')}</th>
                  <th className="px-6 py-4 text-left">{t('pricing.domains.table.reg')}</th>
                  <th className="px-6 py-4 text-left">{t('pricing.domains.table.ren')}</th>
                  <th className="px-6 py-4 text-left">{t('pricing.domains.table.trans')}</th>
                  <th className="px-6 py-4 text-left">{t('pricing.domains.table.action')}</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium">.mz</td>
                  <td className="px-6 py-4">2.500 MZN</td>
                  <td className="px-6 py-4">2.500 MZN</td>
                  <td className="px-6 py-4">1.500 MZN</td>
                  <td className="px-6 py-4">
                    <button className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm transition-colors">
                      {t('pricing.domains.register')}
                    </button>
                  </td>
                </tr>
                <tr className="border-b hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium">.com</td>
                  <td className="px-6 py-4">450 MZN</td>
                  <td className="px-6 py-4">450 MZN</td>
                  <td className="px-6 py-4">350 MZN</td>
                  <td className="px-6 py-4">
                    <button className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm transition-colors">
                      {t('pricing.domains.register')}
                    </button>
                  </td>
                </tr>
                <tr className="border-b hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium">.org</td>
                  <td className="px-6 py-4">850 MZN</td>
                  <td className="px-6 py-4">850 MZN</td>
                  <td className="px-6 py-4">750 MZN</td>
                  <td className="px-6 py-4">
                    <button className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm transition-colors">
                      {t('pricing.domains.register')}
                    </button>
                  </td>
                </tr>
                <tr className="border-b hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium">.net</td>
                  <td className="px-6 py-4">450 MZN</td>
                  <td className="px-6 py-4">450 MZN</td>
                  <td className="px-6 py-4">350 MZN</td>
                  <td className="px-6 py-4">
                    <button className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm transition-colors">
                      {t('pricing.domains.register')}
                    </button>
                  </td>
                </tr>
                <tr className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium">.co.mz</td>
                  <td className="px-6 py-4">3.500 MZN</td>
                  <td className="px-6 py-4">3.500 MZN</td>
                  <td className="px-6 py-4">2.500 MZN</td>
                  <td className="px-6 py-4">
                    <button className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm transition-colors">
                      {t('pricing.domains.register')}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-bold text-black mb-3">{t('pricing.domains.why.title')}</h3>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>{t('pricing.domains.why.1')}</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>{t('pricing.domains.why.2')}</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>{t('pricing.domains.why.3')}</span>
                </li>
              </ul>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-bold text-black mb-3">{t('pricing.domains.included.title')}</h3>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>{t('pricing.domains.included.1')}</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>{t('pricing.domains.included.2')}</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>{t('pricing.domains.included.3')}</span>
                </li>
              </ul>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-bold text-black mb-3">{t('pricing.domains.support.title')}</h3>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>{t('pricing.domains.support.1')}</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>{t('pricing.domains.support.2')}</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>{t('pricing.domains.support.3')}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
