'use client'

import { useI18n } from '@/lib/i18n'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function PrecosHospedagem() {
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
              {t('pricing.hosting.title')}
            </h1>
            <p className="text-base text-white font-normal">
              {t('pricing.hosting.subtitle')}
            </p>
          </div>
        </div>
      </div>

      {/* Pricing Section */}
      <div className="bg-white py-16">
        <div className="container mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
              <h4 className="text-xl font-bold text-black mb-4">{t('pricing.hosting.basic')}</h4>
              <div className="text-3xl font-bold text-red-600 mb-4">250 MZN<span className="text-lg font-normal">/{t('pricing.hosting.month')}</span></div>
              <ul className="space-y-2 mb-6">
                <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> 10 GB {t('pricing.hosting.storage')}</li>
                <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> 100 GB {t('pricing.hosting.bandwidth')}</li>
                <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> 5 {t('pricing.hosting.emails')}</li>
                <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> 1 {t('pricing.hosting.databases')}</li>
                <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> {t('pricing.hosting.backup')}</li>
              </ul>
              <button className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-medium transition-colors">
                {t('pricing.hosting.hire')}
              </button>
            </div>
            
            <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow border-2 border-red-500">
              <h4 className="text-xl font-bold text-black mb-4">{t('pricing.hosting.pro')}</h4>
              <div className="text-3xl font-bold text-red-600 mb-4">500 MZN<span className="text-lg font-normal">/{t('pricing.hosting.month')}</span></div>
              <ul className="space-y-2 mb-6">
                <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> 50 GB {t('pricing.hosting.storage')}</li>
                <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> 500 GB {t('pricing.hosting.bandwidth')}</li>
                <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> 20 {t('pricing.hosting.emails')}</li>
                <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> 5 {t('pricing.hosting.databases')}</li>
                <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> {t('pricing.hosting.backup')}</li>
                <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> {t('pricing.hosting.ssl')}</li>
              </ul>
              <button className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-medium transition-colors">
                {t('pricing.hosting.hire')}
              </button>
            </div>
            
            <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
              <h4 className="text-xl font-bold text-black mb-4">{t('pricing.hosting.business')}</h4>
              <div className="text-3xl font-bold text-red-600 mb-4">1.000 MZN<span className="text-lg font-normal">/{t('pricing.hosting.month')}</span></div>
              <ul className="space-y-2 mb-6">
                <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> 100 GB {t('pricing.hosting.storage')} SSD</li>
                <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> 1 TB {t('pricing.hosting.bandwidth')}</li>
                <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> 50 {t('pricing.hosting.emails')}</li>
                <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> 10 {t('pricing.hosting.databases')}</li>
                <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> {t('pricing.hosting.backup')}</li>
                <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> {t('pricing.hosting.ssl')}</li>
                <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> {t('pricing.hosting.priority')}</li>
              </ul>
              <button className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-medium transition-colors">
                {t('pricing.hosting.hire')}
              </button>
            </div>
            
            <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
              <h4 className="text-xl font-bold text-black mb-4">{t('pricing.hosting.enterprise')}</h4>
              <div className="text-3xl font-bold text-red-600 mb-4">2.500 MZN<span className="text-lg font-normal">/{t('pricing.hosting.month')}</span></div>
              <ul className="space-y-2 mb-6">
                <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> 200 GB {t('pricing.hosting.storage')} SSD</li>
                <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> 2 TB {t('pricing.hosting.bandwidth')}</li>
                <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> 100 {t('pricing.hosting.emails')}</li>
                <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> 20 {t('pricing.hosting.databases')}</li>
                <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> {t('pricing.hosting.backup')}</li>
                <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> {t('pricing.hosting.ssl')}</li>
                <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> {t('pricing.hosting.support247')}</li>
                <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> {t('pricing.hosting.dedicatedIp')}</li>
              </ul>
              <button className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-medium transition-colors">
                {t('pricing.hosting.hire')}
              </button>
            </div>
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-bold text-black mb-3">{t('pricing.hosting.techFeatures')}</h3>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>{t('pricing.hosting.servers')}</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>PHP 7.4, 8.0, 8.1, 8.2, 8.3</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>MySQL, PostgreSQL, Redis</span>
                </li>
              </ul>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-bold text-black mb-3">{t('pricing.hosting.security')}</h3>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>{t('pricing.hosting.firewall')}</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>{t('pricing.hosting.ddos')}</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>{t('pricing.hosting.ssl')}</span>
                </li>
              </ul>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-bold text-black mb-3">{t('pricing.hosting.support')}</h3>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>{t('pricing.hosting.chat')}</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>{t('pricing.hosting.emailSupport')}</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>{t('pricing.hosting.phoneSupport')}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
