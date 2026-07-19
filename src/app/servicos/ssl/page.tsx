'use client'

import React, { useState } from 'react'
import { useI18n } from '@/lib/i18n'
import Link from 'next/link'
import { Shield, Lock, CheckCircle, Globe, Award, Zap, ArrowRight, CheckCircle2 } from 'lucide-react'
import { NotchSection } from '@/components/home/NotchSection'
import { BudgetRequestModal } from '@/components/forms/BudgetRequestModal'

export default function SSL() {
  const { t } = useI18n()
  const [isModalOpen, setIsModalOpen] = useState(false)

  const certificadosSSL = [
    {
      icone: <Shield className="w-8 h-8" />,
      titulo: "SSL DV (Domain Validation)",
      descricao: "Certificado básico com validação de domínio, ideal para blogs e sites pessoais",
      servicos: ["Emissão em minutos", "Cadeado HTTPS", "Criptografia 256-bit", "Compatível com todos os browsers", "Renovação automática"]
    },
    {
      icone: <CheckCircle className="w-8 h-8" />,
      titulo: "SSL OV (Organization Validation)",
      descricao: "Validação da organização para maior confiança em sites comerciais",
      servicos: ["Verificação da empresa", "Selo de confiança", "Garantia até $1M", "Suporte prioritário", "Validação em 1-3 dias"]
    },
    {
      icone: <Award className="w-8 h-8" />,
      titulo: "SSL EV (Extended Validation)",
      descricao: "Nível máximo de confiança com barra verde para e-commerce e bancos",
      servicos: ["Barra verde no browser", "Validação rigorosa", "Garantia até $2M", "Nome da empresa visível", "Máxima confiança"]
    },
    {
      icone: <Globe className="w-8 h-8" />,
      titulo: "Wildcard SSL",
      descricao: "Proteja o domínio principal e todos os subdomínios com um único certificado",
      servicos: ["Subdomínios ilimitados", "*.seudominio.com", "Gestão simplificada", "Custo-benefício", "DV ou OV disponível"]
    },
    {
      icone: <Lock className="w-8 h-8" />,
      titulo: "Multi-Domain SSL (SAN)",
      descricao: "Um certificado para proteger múltiplos domínios diferentes",
      servicos: ["Até 100 domínios", "Gestão centralizada", "Flexibilidade total", "Adicionar domínios depois", "Ideal para empresas"]
    },
    {
      icone: <Zap className="w-8 h-8" />,
      titulo: "SSL Gratuito (Let's Encrypt)",
      descricao: "Certificado gratuito incluído em todos os nossos planos de hospedagem",
      servicos: ["100% gratuito", "Renovação automática", "Instalação automática", "Incluído no hosting", "Criptografia completa"]
    }
  ]

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-foreground">
      
      {/* Hero Section */}
      <NotchSection shape="start" bg="bg-[#09090b]" first>
        <div className="relative overflow-hidden pt-[180px] pb-[100px]">
          <div 
            className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-10"
            style={{ backgroundImage: "url('/assets/BG.jpg')" }}
          />
          <div className="absolute inset-0 bg-black/55" />
          <div className="container mx-auto max-w-7xl px-6 relative z-10 text-center">
            <h1 className="text-4xl font-extrabold text-white mb-2 tracking-tight">Certificados SSL</h1>
            <p className="text-lg text-zinc-300 font-normal max-w-2xl mx-auto font-sans">
              Proteja o seu site e os dados dos seus clientes com certificados de segurança
            </p>
          </div>
        </div>
      </NotchSection>

      {/* Services Grid Section */}
      <NotchSection shape="end" bg="bg-zinc-50 dark:bg-zinc-950">
        <div className="py-20">
          <div className="container mx-auto max-w-7xl px-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {certificadosSSL.map((cert, index) => (
                <div key={index} className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 p-6 rounded-2xl shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center mb-4">
                      <div className="text-red-500 mr-3">
                        {cert.icone}
                      </div>
                      <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{cert.titulo}</h3>
                    </div>
                    
                    <p className="text-zinc-600 dark:text-zinc-400 mb-6 text-sm leading-relaxed">
                      {cert.descricao}
                    </p>
                    
                    <div>
                      <h4 className="font-semibold text-zinc-700 dark:text-zinc-300 mb-3 text-sm">O que inclui:</h4>
                      <ul className="space-y-2">
                        {cert.servicos.map((item, idx) => (
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
              <h2 className="text-3xl font-extrabold">Garanta a segurança e credibilidade do seu site</h2>
              <p className="text-lg text-red-100 max-w-xl mx-auto">
                Proteja transações, melhore o seu posicionamento no Google e transmita segurança total aos seus utilizadores.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <Link
                  href="/precos/ssl"
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
        initialService="ssl"
      />

    </div>
  )
}
