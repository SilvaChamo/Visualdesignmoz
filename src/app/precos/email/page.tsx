'use client'

import { useI18n } from '@/lib/i18n'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function PrecosEmail() {


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
                Voltar para Home
              </Link>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">
              E-mail Profissional
            </h1>
            <p className="text-base text-white font-normal">
              Comunicação profissional com seu próprio domínio
            </p>
          </div>
        </div>
      </div>

      {/* Pricing Section */}
      <div className="bg-white py-16">
        <div className="container mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
              <h4 className="text-xl font-bold text-black mb-4">Básico</h4>
              <div className="text-3xl font-bold text-red-600 mb-4">150 MZN<span className="text-lg font-normal">/mês</span></div>
              <ul className="space-y-2 mb-6">
                <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> 5 GB Armazenamento</li>
                <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> 10 Contas E-mail</li>
                <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> Anti-virus</li>
                <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> Anti-spam</li>
              </ul>
              <button className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-medium transition-colors">
                Contratar
              </button>
            </div>
            
            <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow border-2 border-red-500">
              <h4 className="text-xl font-bold text-black mb-4">Profissional</h4>
              <div className="text-3xl font-bold text-red-600 mb-4">300 MZN<span className="text-lg font-normal">/mês</span></div>
              <ul className="space-y-2 mb-6">
                <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> 15 GB Armazenamento</li>
                <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> 25 Contas E-mail</li>
                <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> Anti-virus</li>
                <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> Anti-spam</li>
                <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> Calendário Compartilhado</li>
              </ul>
              <button className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-medium transition-colors">
                Contratar
              </button>
            </div>
            
            <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
              <h4 className="text-xl font-bold text-black mb-4">Enterprise</h4>
              <div className="text-3xl font-bold text-red-600 mb-4">600 MZN<span className="text-lg font-normal">/mês</span></div>
              <ul className="space-y-2 mb-6">
                <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> 50 GB Armazenamento</li>
                <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> 100 Contas E-mail</li>
                <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> Anti-virus</li>
                <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> Anti-spam</li>
                <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> Calendário Compartilhado</li>
                <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> Suporte Prioritário</li>
              </ul>
              <button className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-medium transition-colors">
                Contratar
              </button>
            </div>
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-bold text-black mb-3">Recursos</h3>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>Webmail completo</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>Configuração automática</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>Sincronização móvel</span>
                </li>
              </ul>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-bold text-black mb-3">Segurança</h3>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>Anti-virus avançado</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>Filtro anti-spam</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>Autenticação 2FA</span>
                </li>
              </ul>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-bold text-black mb-3">Suporte</h3>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>Configuração gratuita</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>Suporte técnico</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>Backup diário</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
