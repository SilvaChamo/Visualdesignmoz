'use client'

import { useI18n } from '@/lib/i18n'
import Link from 'next/link'
import { useCart } from '@/contexts/CartContext'
import { ArrowLeft } from 'lucide-react'

export default function PrecosSSL() {
  const { t } = useI18n()
  const { addItem, setIsCartOpen } = useCart()

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
            <h1 className="text-3xl font-bold text-white mb-2">
              {t('pricing.ssl.title')}
            </h1>
            <p className="text-base text-white font-normal">
              {t('pricing.ssl.subtitle')}
            </p>
          </div>
        </div>
      </div>

      {/* Pricing Section */}
      <div className="bg-white py-16">
        <div className="container mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
              <h4 className="text-xl font-bold text-black mb-4">{t('pricing.hosting.basic')}</h4>
              <div className="text-3xl font-bold text-red-600 mb-4">800 MZN<span className="text-lg font-normal">/ano</span></div>
              <ul className="space-y-2 mb-6">
                <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> {t('pricing.ssl.dv')}</li>
                <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> 128-bit Encryption</li>
                <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> Browser Trust</li>
                <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> $10.000 Seguro</li>
              </ul>
              <button
                onClick={() => {
                  addItem({ id: 'ssl-dv', type: 'ssl', name: `SSL ${t('pricing.ssl.dv')}`, price: 800, period: 1 })
                  setIsCartOpen(true)
                }}
                className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-medium transition-colors">
                {t('pricing.hosting.hire')}
              </button>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow border-2 border-red-500">
              <h4 className="text-xl font-bold text-black mb-4">{t('pricing.hosting.pro')}</h4>
              <div className="text-3xl font-bold text-red-600 mb-4">1.500 MZN<span className="text-lg font-normal">/ano</span></div>
              <ul className="space-y-2 mb-6">
                <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> {t('pricing.ssl.ov')}</li>
                <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> 256-bit Encryption</li>
                <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> Green Bar Browser</li>
                <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> $250.000 Seguro</li>
                <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> {t('pricing.ssl.features.2')}</li>
              </ul>
              <button
                onClick={() => {
                  addItem({ id: 'ssl-ov', type: 'ssl', name: `SSL ${t('pricing.ssl.ov')}`, price: 1500, period: 1 })
                  setIsCartOpen(true)
                }}
                className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-medium transition-colors">
                {t('pricing.hosting.hire')}
              </button>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
              <h4 className="text-xl font-bold text-black mb-4">{t('pricing.ssl.ev')}</h4>
              <div className="text-3xl font-bold text-red-600 mb-4">3.000 MZN<span className="text-lg font-normal">/ano</span></div>
              <ul className="space-y-2 mb-6">
                <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> {t('pricing.ssl.ev')} (Extended)</li>
                <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> 256-bit Encryption</li>
                <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> Green Bar Browser</li>
                <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> $1.000.000 Seguro</li>
                <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> {t('pricing.ssl.features.2')}</li>
                <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> Mostrar Endereço</li>
              </ul>
              <button
                onClick={() => {
                  addItem({ id: 'ssl-ev', type: 'ssl', name: `SSL ${t('pricing.ssl.ev')}`, price: 3000, period: 1 })
                  setIsCartOpen(true)
                }}
                className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-medium transition-colors">
                {t('pricing.hosting.hire')}
              </button>
            </div>
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-bold text-black mb-3">Por que usar SSL?</h3>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>Protege dados dos usuários</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>Melhora ranking no Google</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>Aumenta confiança do cliente</span>
                </li>
              </ul>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-bold text-black mb-3">Compatibilidade</h3>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>99.9% dos navegadores</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>Dispositivos móveis</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>Servidores web populares</span>
                </li>
              </ul>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-bold text-black mb-3">Instalação</h3>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>Instalação gratuita</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>Guia passo a passo</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>{t('pricing.hosting.support')}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
