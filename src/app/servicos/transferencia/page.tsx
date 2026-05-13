'use client'

import { useI18n } from '@/lib/i18n'
import { RefreshCw, Shield, Zap, Clock, Check, HelpCircle } from 'lucide-react'
import Link from 'next/link'

export default function TransferenciaDominios() {
  const { t } = useI18n()

  const vantagens = [
    {
      icone: <RefreshCw className="w-8 h-8" />,
      titulo: "Processo Simplificado",
      descricao: "Tratamos de toda a burocracia para que a sua transferência seja rápida e sem complicações."
    },
    {
      icone: <Shield className="w-8 h-8" />,
      titulo: "Segurança Total",
      descricao: "O seu domínio permanece ativo durante todo o processo, sem qualquer interrupção no seu site ou emails."
    },
    {
      icone: <Zap className="w-8 h-8" />,
      titulo: "Gestão Centralizada",
      descricao: "Gira o seu domínio, alojamento e emails numa única plataforma intuitiva."
    },
    {
      icone: <Clock className="w-8 h-8" />,
      titulo: "Suporte 24/7",
      descricao: "A nossa equipa de especialistas está sempre disponível para ajudar em qualquer passo."
    }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Banner Principal */}
      <div className="bg-[#404040] relative overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20"
          style={{ backgroundImage: "url('/assets/BG.jpg')" }}
        />
        <div className="absolute inset-0 bg-black/50" />
        <div className="container mx-auto max-w-7xl px-6 pt-[160px] pb-[100px] relative z-10">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl font-bold text-white mb-4">Transferência de Domínios</h1>
            <p className="text-lg text-white/90 font-normal">
              Traga o seu domínio para a Visual Design e aproveite a nossa gestão simplificada e suporte especializado.
            </p>
          </div>
        </div>
      </div>

      {/* Vantagens */}
      <div className="py-20">
        <div className="container mx-auto max-w-7xl px-6">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-3xl font-bold text-slate-800 mb-4">Porquê transferir para nós?</h2>
            <p className="text-lg text-slate-600">
              Oferecemos as melhores condições e um serviço de excelência para a gestão do seu nome na internet.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {vantagens.map((item, index) => (
              <div key={index} className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                <div className="text-red-600 mb-4">
                  {item.icone}
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-2">{item.titulo}</h3>
                <p className="text-sm text-slate-600">{item.descricao}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Como funciona */}
      <div className="py-20 bg-white">
        <div className="container mx-auto max-w-7xl px-6">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-3xl font-bold text-slate-800 mb-4">Como funciona o processo?</h2>
            <p className="text-lg text-slate-600">
              Apenas 3 passos simples para trazer o seu domínio para a nossa casa.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="text-center">
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">1</div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">Desbloqueie o Domínio</h3>
              <p className="text-sm text-slate-600">No seu atual registrador, certifique-se de que o domínio está desbloqueado para transferência.</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">2</div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">Obtenha o Código de Autorização</h3>
              <p className="text-sm text-slate-600">Solicite o código EPP ou chave de transferência ao seu atual provedor.</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">3</div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">Inicie a Transferência</h3>
              <p className="text-sm text-slate-600">Insira o código no nosso sistema e nós tratamos do resto!</p>
            </div>
          </div>

          <div className="text-center mt-12">
            <Link href="/servicos/transferencia/iniciar" className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-lg font-bold transition-colors inline-flex items-center gap-2">
              Iniciar Transferência
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
