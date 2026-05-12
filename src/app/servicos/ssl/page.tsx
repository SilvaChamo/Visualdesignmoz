'use client'

import { useI18n } from '@/lib/i18n'
import { Shield, Lock, CheckCircle, Globe, Award, Zap } from 'lucide-react'

export default function SSL() {
  const { t } = useI18n()

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
    <div className="min-h-screen bg-gray-100">
      <div className="bg-[#404040] relative overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20"
          style={{ backgroundImage: "url('/assets/BG.jpg')" }}
        />
        <div className="absolute inset-0 bg-black/50" />
        <div className="container mx-auto max-w-7xl px-6 pt-[150px] pb-[80px] flex items-center justify-center min-h-[300px] relative z-10">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-white mb-2">Certificados SSL</h1>
            <p className="text-base text-white font-normal">
              Proteja o seu site e os dados dos seus clientes com certificados de segurança
            </p>
          </div>
        </div>
      </div>

      <div className="py-16">
        <div className="container mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {certificadosSSL.map((cert, index) => (
              <div key={index} className="bg-white text-black/70 p-6 rounded-lg">
                <div className="flex items-center mb-4">
                  <div className="text-red-500 mr-3">
                    {cert.icone}
                  </div>
                  <h3 className="text-xl font-bold">{cert.titulo}</h3>
                </div>
                
                <p className="text-black/70 mb-6 text-sm leading-relaxed">
                  {cert.descricao}
                </p>
                
                <div className="mb-6">
                  <h4 className="font-medium mb-3 text-sm">O que inclui:</h4>
                  <ul className="space-y-0">
                    {cert.servicos.map((item, idx) => (
                      <li key={idx} className="flex items-center text-black/70 text-sm">
                        <span className="w-2 h-2 bg-red-500 rounded-full mr-3"></span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                
                <button className="w-full bg-black text-white px-4 py-3 rounded font-medium hover:bg-red-600 hover:text-white transition-colors">
                  Solicitar Certificado
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
