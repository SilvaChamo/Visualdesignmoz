'use client'

import React, { useState } from 'react'
import { useI18n } from '@/lib/i18n'
import Link from 'next/link'
import { HeadphonesIcon, Clock, Wrench, Monitor, MessageCircle, FileText, ArrowRight, CheckCircle2 } from 'lucide-react'
import { NotchSection } from '@/components/home/NotchSection'
import { BudgetRequestModal } from '@/components/forms/BudgetRequestModal'

export default function Suporte() {
  const { t } = useI18n()
  const [isModalOpen, setIsModalOpen] = useState(false)

  const servicosSuporte = [
    { icone: <HeadphonesIcon className="w-8 h-8" />, titulo: "Suporte Técnico 24/7", descricao: "Assistência técnica disponível a qualquer hora para resolver os seus problemas", servicos: ["Chat em tempo real", "Email prioritário", "Telefone direto", "Ticket system", "Tempo resposta < 1h"] },
    { icone: <Wrench className="w-8 h-8" />, titulo: "Manutenção de Sites", descricao: "Manutenção preventiva e corretiva para manter o seu site sempre atualizado", servicos: ["Atualizações de segurança", "Backup regular", "Otimização performance", "Correção de bugs", "Monitoramento 24/7"] },
    { icone: <Monitor className="w-8 h-8" />, titulo: "Monitoramento de Servidores", descricao: "Vigilância contínua dos seus serviços para máxima disponibilidade", servicos: ["Uptime monitoring", "Alertas instantâneos", "Relatórios de performance", "Prevenção de falhas", "SLA garantido"] },
    { icone: <Clock className="w-8 h-8" />, titulo: "Consultoria Técnica", descricao: "Aconselhamento especializado para otimizar a sua infraestrutura", servicos: ["Análise de arquitetura", "Recomendações", "Planeamento de migração", "Otimização de custos", "Roadmap tecnológico"] },
    { icone: <MessageCircle className="w-8 h-8" />, titulo: "Formação e Treino", descricao: "Capacitação da sua equipa para gerir as ferramentas e plataformas", servicos: ["Formação WordPress", "Gestão de email", "Painel de controlo", "Boas práticas", "Documentação"] },
    { icone: <FileText className="w-8 h-8" />, titulo: "Contratos de Suporte", descricao: "Planos de suporte contínuo com SLA e prioridade garantida", servicos: ["Plano Básico", "Plano Profissional", "Plano Enterprise", "SLA personalizado", "Gestor dedicado"] }
  ]

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-foreground">
      
      {/* Hero Section */}
      <NotchSection shape="start" bg="bg-[#09090b]" first>
        <div className="relative overflow-hidden pt-[180px] pb-[100px]">
          <div className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-10" style={{ backgroundImage: "url('/assets/BG.jpg')" }} />
          <div className="absolute inset-0 bg-black/55" />
          <div className="container mx-auto max-w-7xl px-6 relative z-10 text-center">
            <h1 className="text-4xl font-extrabold text-white mb-2 tracking-tight">Suporte Técnico</h1>
            <p className="text-lg text-zinc-300 font-normal max-w-2xl mx-auto">Assistência técnica profissional e manutenção para o seu negócio digital</p>
          </div>
        </div>
      </NotchSection>

      {/* Services Grid Section */}
      <NotchSection shape="end" bg="bg-zinc-50 dark:bg-zinc-950">
        <div className="py-20">
          <div className="container mx-auto max-w-7xl px-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {servicosSuporte.map((s, i) => (
                <div key={i} className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 p-6 rounded-2xl shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center mb-4">
                      <div className="text-red-500 mr-3">{s.icone}</div>
                      <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{s.titulo}</h3>
                    </div>
                    <p className="text-zinc-600 dark:text-zinc-400 mb-6 text-sm leading-relaxed">{s.descricao}</p>
                    <div>
                      <h4 className="font-semibold text-zinc-700 dark:text-zinc-300 mb-3 text-sm">O que inclui:</h4>
                      <ul className="space-y-2">
                        {s.servicos.map((item, idx) => (
                          <li key={idx} className="flex items-start text-zinc-600 dark:text-zinc-400 text-sm">
                            <CheckCircle2 className="w-4 h-4 text-red-500 shrink-0 mr-2 mt-0.5" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </NotchSection>

      {/* CTA Banner Section */}
      <NotchSection shape="end" bg="bg-zinc-50 dark:bg-zinc-950">
        <div className="py-20">
          <div className="container mx-auto max-w-7xl px-6">
            <div className="bg-red-600 dark:bg-red-700 text-white py-16 rounded-[2.5rem] text-center space-y-6 shadow-xl shadow-red-600/10 relative overflow-hidden">
              <h2 className="text-3xl font-extrabold">Precisa de assistência técnica para o seu projeto?</h2>
              <p className="text-lg text-red-100 max-w-xl mx-auto">
                A nossa equipa técnica está pronta para resolver incidentes, atualizar segurança ou criar um plano de manutenção permanente para o seu site ou servidor.
              </p>
              <button
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center gap-2 bg-white hover:bg-zinc-100 text-red-600 font-extrabold px-10 py-4 rounded-xl shadow-lg transition-all transform hover:-translate-y-0.5 cursor-pointer"
              >
                <span>Pedir Apoio Técnico</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </NotchSection>

      {/* Budget Modal */}
      <BudgetRequestModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialService="suporte"
      />

    </div>
  )
}
