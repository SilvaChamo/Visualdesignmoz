'use client'

import { useI18n } from '@/lib/i18n'
import { Globe, Shield, RefreshCw, Search, Zap, Lock } from 'lucide-react'

export default function Dominios() {
  const { t } = useI18n()

  const servicosDominios = [
    {
      icone: <Globe className="w-8 h-8" />,
      titulo: "Registo de Domínios",
      descricao: "Registe o seu domínio .com, .mz, .org, .net e muitas outras extensões disponíveis",
      servicos: ["Domínios .com", "Domínios .mz", "Domínios .org / .net", "Domínios regionais", "Extensões premium"]
    },
    {
      icone: <RefreshCw className="w-8 h-8" />,
      titulo: "Transferência de Domínios",
      descricao: "Transfira os seus domínios de outros registrars com suporte completo",
      servicos: ["Transferência segura", "Sem tempo de inatividade", "Assistência na migração", "Código de autorização", "Verificação WHOIS"]
    },
    {
      icone: <Shield className="w-8 h-8" />,
      titulo: "Gestão DNS",
      descricao: "Controle total sobre os registos DNS do seu domínio com painel avançado",
      servicos: ["Registos A, AAAA, CNAME", "Registos MX para email", "Registos TXT / SPF / DKIM", "Nameservers personalizados", "TTL configurável"]
    },
    {
      icone: <Lock className="w-8 h-8" />,
      titulo: "Privacidade WHOIS",
      descricao: "Proteja os seus dados pessoais nos registos públicos de domínio",
      servicos: ["Ocultação de dados", "Proteção anti-spam", "Email proxy", "Conformidade GDPR", "Incluído gratuitamente"]
    },
    {
      icone: <Search className="w-8 h-8" />,
      titulo: "Pesquisa de Domínios",
      descricao: "Encontre o domínio perfeito para o seu negócio com a nossa ferramenta de pesquisa",
      servicos: ["Verificação instantânea", "Sugestões alternativas", "Comparação de preços", "Domínios expirados", "Monitoramento de disponibilidade"]
    },
    {
      icone: <Zap className="w-8 h-8" />,
      titulo: "Renovação Automática",
      descricao: "Nunca perca o seu domínio com renovação automática e alertas antecipados",
      servicos: ["Auto-renovação", "Alertas por email", "Período de graça", "Proteção contra expiração", "Gestão multi-domínio"]
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
            <h1 className="text-3xl font-bold text-white mb-2">Registo e Gestão de Domínios</h1>
            <p className="text-base text-white font-normal">
              Registe, transfira e gira os seus domínios com facilidade e segurança
            </p>
          </div>
        </div>
      </div>

      <div className="py-16">
        <div className="container mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {servicosDominios.map((servico, index) => (
              <div key={index} className="bg-white text-black/70 p-6 rounded-lg">
                <div className="flex items-center mb-4">
                  <div className="text-red-500 mr-3">
                    {servico.icone}
                  </div>
                  <h3 className="text-xl font-bold">{servico.titulo}</h3>
                </div>
                
                <p className="text-black/70 mb-6 text-sm leading-relaxed">
                  {servico.descricao}
                </p>
                
                <div className="mb-6">
                  <h4 className="font-medium mb-3 text-sm">O que inclui:</h4>
                  <ul className="space-y-0">
                    {servico.servicos.map((item, idx) => (
                      <li key={idx} className="flex items-center text-black/70 text-sm">
                        <span className="w-2 h-2 bg-red-500 rounded-full mr-3"></span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                
                <button className="w-full bg-black text-white px-4 py-3 rounded font-medium hover:bg-red-600 hover:text-white transition-colors">
                  Solicitar Orçamento
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
