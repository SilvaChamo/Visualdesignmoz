'use client'

import React, { useState } from 'react'
import { useI18n } from '@/lib/i18n'
import Link from 'next/link'
import { Mail, Users, Shield, Settings, Cloud, Smartphone, ArrowRight, CheckCircle2 } from 'lucide-react'
import { NotchSection } from '@/components/home/NotchSection'
import { BudgetRequestModal } from '@/components/forms/BudgetRequestModal'

export default function EmailProfissional() {
  const { t } = useI18n()
  const [isModalOpen, setIsModalOpen] = useState(false)

  const servicosEmail = [
    { icone: <Mail className="w-8 h-8" />, titulo: "Email com Domínio Próprio", descricao: "Caixas de correio profissionais com o seu domínio (nome@suaempresa.com)", servicos: ["Endereço personalizado", "Armazenamento generoso", "Sem publicidade", "Webmail moderno", "Configuração incluída"] },
    { icone: <Users className="w-8 h-8" />, titulo: "Email Corporativo", descricao: "Solução completa para equipas com gestão centralizada", servicos: ["Contas ilimitadas", "Calendário partilhado", "Contactos corporativos", "Grupos de distribuição", "Painel admin"] },
    { icone: <Cloud className="w-8 h-8" />, titulo: "Microsoft 365 / Google Workspace", descricao: "Integração com as principais plataformas de produtividade", servicos: ["Office 365 completo", "Google Workspace", "OneDrive / Drive", "Teams / Meet", "Licenciamento"] },
    { icone: <Shield className="w-8 h-8" />, titulo: "Segurança de Email", descricao: "Proteção avançada contra spam, phishing e malware", servicos: ["Anti-spam avançado", "Anti-phishing", "SPF / DKIM / DMARC", "Encriptação TLS", "Proteção malware"] },
    { icone: <Settings className="w-8 h-8" />, titulo: "Migração de Email", descricao: "Migração completa sem perda de dados", servicos: ["Migração de dados", "Importação contactos", "Preservação histórico", "Zero downtime", "Suporte transição"] },
    { icone: <Smartphone className="w-8 h-8" />, titulo: "Email Mobile", descricao: "Acesso em qualquer dispositivo com sincronização real-time", servicos: ["iOS e Android", "Push notifications", "Sincronização auto", "Exchange ActiveSync", "App nativo"] }
  ]

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-foreground">
      
      {/* Hero Section */}
      <NotchSection shape="start" bg="bg-[#09090b]" first>
        <div className="relative overflow-hidden pt-[180px] pb-[100px]">
          <div className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-10" style={{ backgroundImage: "url('/assets/BG.jpg')" }} />
          <div className="absolute inset-0 bg-black/55" />
          <div className="container mx-auto max-w-7xl px-6 relative z-10 text-center">
            <h1 className="text-4xl font-extrabold text-white mb-2 tracking-tight">Email Profissional</h1>
            <p className="text-lg text-zinc-300 font-normal max-w-2xl mx-auto">Comunique com profissionalismo usando email com o domínio da sua empresa</p>
          </div>
        </div>
      </NotchSection>

      {/* Services Grid Section */}
      <NotchSection shape="end" bg="bg-zinc-50 dark:bg-zinc-950">
        <div className="py-20">
          <div className="container mx-auto max-w-7xl px-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {servicosEmail.map((s, i) => (
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
              <h2 className="text-3xl font-extrabold">Eleve o profissionalismo do seu negócio</h2>
              <p className="text-lg text-red-100 max-w-xl mx-auto">
                Obtenha caixas de correio profissionais com o seu domínio, segurança avançada anti-spam e suporte total na configuração e migração.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <Link
                  href="/precos/email"
                  className="inline-flex items-center gap-2 bg-white hover:bg-zinc-100 text-red-600 font-extrabold px-10 py-4 rounded-xl shadow-lg transition-all transform hover:-translate-y-0.5 cursor-pointer"
                >
                  <span>Ver Planos e Preços</span>
                  <ArrowRight className="w-5 h-5" />
                </Link>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="inline-flex items-center gap-2 bg-transparent border border-white text-white font-extrabold px-10 py-4 rounded-xl hover:bg-white/10 transition-all cursor-pointer"
                >
                  <span>Solicitar Orçamento Gratuito</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </NotchSection>

      {/* Budget Modal */}
      <BudgetRequestModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialService="email"
      />

    </div>
  )
}
