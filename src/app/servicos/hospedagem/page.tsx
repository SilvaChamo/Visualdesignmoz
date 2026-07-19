'use client'

import { useI18n } from '@/lib/i18n'
import Link from 'next/link'
import { Server, Cpu, HardDrive, Cloud, Shield, Zap, ArrowRight, CheckCircle2 } from 'lucide-react'

export default function Hospedagem() {
  const { t } = useI18n()

  const planosHospedagem = [
    {
      icone: <Server className="w-8 h-8" />,
      titulo: "Hospedagem Partilhada",
      descricao: "Ideal para sites pessoais e pequenos negócios com tráfego moderado",
      servicos: ["cPanel incluído", "SSL gratuito", "Email ilimitado", "Backup semanal", "Suporte 24/7"]
    },
    {
      icone: <Cpu className="w-8 h-8" />,
      titulo: "VPS (Servidor Virtual)",
      descricao: "Recursos dedicados para sites com tráfego elevado e aplicações complexas",
      servicos: ["Root access", "Recursos garantidos", "SSD NVMe", "Escalabilidade", "IP dedicado"]
    },
    {
      icone: <HardDrive className="w-8 h-8" />,
      titulo: "Servidor Dedicado",
      descricao: "Máximo desempenho com hardware exclusivo para a sua operação",
      servicos: ["Hardware exclusivo", "Personalização total", "Alta disponibilidade", "Gestão completa", "Firewall dedicado"]
    },
    {
      icone: <Cloud className="w-8 h-8" />,
      titulo: "Cloud Hosting",
      descricao: "Infraestrutura escalável na nuvem com alta disponibilidade e redundância",
      servicos: ["Auto-scaling", "Load balancing", "Multi-região", "99.9% uptime", "Pay-as-you-go"]
    },
    {
      icone: <Shield className="w-8 h-8" />,
      titulo: "Hospedagem WordPress",
      descricao: "Ambiente otimizado especificamente para sites WordPress",
      servicos: ["WordPress pré-instalado", "Cache LiteSpeed", "Atualizações automáticas", "Staging environment", "Migração gratuita"]
    },
    {
      icone: <Zap className="w-8 h-8" />,
      titulo: "Hospedagem E-commerce",
      descricao: "Infraestrutura robusta para lojas online com PCI compliance",
      servicos: ["WooCommerce / PrestaShop", "SSL EV incluído", "CDN global", "Proteção DDoS", "Backups diários"]
    }
  ]

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-foreground">
      {/* Hero Section */}
      <div className="bg-[#09090b] relative overflow-hidden border-b border-zinc-200 dark:border-zinc-800">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-10"
          style={{ backgroundImage: "url('/assets/BG.jpg')" }}
        />
        <div className="absolute inset-0 bg-black/55" />
        <div className="container mx-auto max-w-7xl px-6 pt-[150px] pb-[80px] flex items-center justify-center min-h-[300px] relative z-10">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-white mb-2">Alojamento Web Profissional</h1>
            <p className="text-base text-zinc-300 font-normal">
              Soluções de hosting rápidas, seguras e escaláveis para qualquer projeto
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="py-16">
        <div className="container mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {planosHospedagem.map((plano, index) => (
              <div key={index} className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 p-6 rounded-2xl shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center mb-4">
                    <div className="text-red-500 mr-3">
                      {plano.icone}
                    </div>
                    <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{plano.titulo}</h3>
                  </div>
                  
                  <p className="text-zinc-600 dark:text-zinc-400 mb-6 text-sm leading-relaxed">
                    {plano.descricao}
                  </p>
                  
                  <div>
                    <h4 className="font-semibold text-zinc-700 dark:text-zinc-300 mb-3 text-sm">O que inclui:</h4>
                    <ul className="space-y-2">
                      {plano.servicos.map((item, idx) => (
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

          {/* Unified CTA Banner at the bottom */}
          <div className="bg-red-600 dark:bg-red-700 text-white py-16 mt-20 rounded-3xl text-center space-y-6 shadow-xl shadow-red-600/10">
            <h2 className="text-3xl font-extrabold">Precisa de alojamento para a sua empresa?</h2>
            <p className="text-lg text-red-100 max-w-xl mx-auto">
              Veja a nossa gama completa de planos e registe o seu domínio instantaneamente, ou solicite apoio para uma infraestrutura customizada.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link
                href="/precos/hospedagem"
                className="inline-flex items-center gap-2 bg-white text-red-600 font-bold px-10 py-4 rounded-xl shadow-lg hover:bg-zinc-100 transition-all transform hover:-translate-y-0.5"
              >
                <span>Ver Planos e Preços</span>
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="/contacto?servico=hospedagem"
                className="inline-flex items-center gap-2 bg-transparent border border-white text-white font-bold px-10 py-4 rounded-xl hover:bg-white/10 transition-all"
              >
                <span>Pedir Proposta Customizada</span>
              </Link>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
