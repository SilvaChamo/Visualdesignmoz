'use client'

import { useI18n } from '@/lib/i18n'
import { Server, Cpu, HardDrive, Cloud, Shield, Zap } from 'lucide-react'

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
    <div className="min-h-screen bg-gray-100">
      <div className="bg-[#404040] relative overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20"
          style={{ backgroundImage: "url('/assets/BG.jpg')" }}
        />
        <div className="absolute inset-0 bg-black/50" />
        <div className="container mx-auto max-w-7xl px-6 pt-[150px] pb-[80px] flex items-center justify-center min-h-[300px] relative z-10">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-white mb-2">Alojamento Web Profissional</h1>
            <p className="text-base text-white font-normal">
              Soluções de hosting rápidas, seguras e escaláveis para qualquer projeto
            </p>
          </div>
        </div>
      </div>

      <div className="py-16">
        <div className="container mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {planosHospedagem.map((plano, index) => (
              <div key={index} className="bg-white text-black/70 p-6 rounded-lg">
                <div className="flex items-center mb-4">
                  <div className="text-red-500 mr-3">
                    {plano.icone}
                  </div>
                  <h3 className="text-xl font-bold">{plano.titulo}</h3>
                </div>
                
                <p className="text-black/70 mb-6 text-sm leading-relaxed">
                  {plano.descricao}
                </p>
                
                <div className="mb-6">
                  <h4 className="font-medium mb-3 text-sm">O que inclui:</h4>
                  <ul className="space-y-0">
                    {plano.servicos.map((item, idx) => (
                      <li key={idx} className="flex items-center text-black/70 text-sm">
                        <span className="w-2 h-2 bg-red-500 rounded-full mr-3"></span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                
                <button className="w-full bg-black text-white px-4 py-3 rounded font-medium hover:bg-red-600 hover:text-white transition-colors">
                  Ver Planos e Preços
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
