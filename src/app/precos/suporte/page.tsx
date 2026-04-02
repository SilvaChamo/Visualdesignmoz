'use client'

import { useI18n } from '@/lib/i18n'
import Link from 'next/link'
import { ArrowLeft, ArrowRight } from 'lucide-react'

export default function PrecosSuporte() {

  const { t } = useI18n()

  const frequentQuestions = [
    'Como registrar um domínio?',
    'Quanto custa um domínio .mz?',
    'Como transferir meu domínio?',
    'O que é DNS?',
    'Qual plano de hospedagem escolher?',
    'Como migrar meu site?',
    'Hospedagem WordPress disponível?',
    'Backup automático incluído?',
    'Por que preciso de certificado SSL?',
    'Como instalar SSL no meu site?',
    'Como criar email profissional?',
    'Configurar email no celular?'
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
                Voltar para Home
              </Link>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Suporte Técnico</h1>
            <p className="text-base text-white font-normal">Estamos aqui para ajudar com todas as suas dúvidas</p>
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
                    <p className="text-gray-400 text-xs mt-2 font-light">Clique para ver resposta detalhada</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-red-500 transition-colors flex-shrink-0 ml-2" />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-bold text-black mb-3">Canais de Atendimento</h3>
              <ul className="space-y-2 text-gray-600">
                <li>Chat online 24/7</li>
                <li>E-mail: suporte@visualdesign.co.mz</li>
                <li>Telefone: +258 84 123 4567</li>
              </ul>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-bold text-black mb-3">Horário de Atendimento</h3>
              <ul className="space-y-2 text-gray-600">
                <li>Segunda a Sexta: 8h - 18h</li>
                <li>Sábado: 9h - 13h</li>
                <li>Domingo: Emergências</li>
              </ul>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-bold text-black mb-3">Tempo de Resposta</h3>
              <ul className="space-y-2 text-gray-600">
                <li>Chat: Imediato</li>
                <li>E-mail: Até 2 horas</li>
                <li>Telefone: Imediato</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
