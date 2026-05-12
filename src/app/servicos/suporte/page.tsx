'use client'

import { useI18n } from '@/lib/i18n'
import { HeadphonesIcon, Clock, Wrench, Monitor, MessageCircle, FileText } from 'lucide-react'

export default function Suporte() {
  const { t } = useI18n()

  const servicosSuporte = [
    { icone: <HeadphonesIcon className="w-8 h-8" />, titulo: "Suporte Técnico 24/7", descricao: "Assistência técnica disponível a qualquer hora para resolver os seus problemas", servicos: ["Chat em tempo real", "Email prioritário", "Telefone direto", "Ticket system", "Tempo resposta < 1h"] },
    { icone: <Wrench className="w-8 h-8" />, titulo: "Manutenção de Sites", descricao: "Manutenção preventiva e corretiva para manter o seu site sempre atualizado", servicos: ["Atualizações de segurança", "Backup regular", "Otimização performance", "Correção de bugs", "Monitoramento 24/7"] },
    { icone: <Monitor className="w-8 h-8" />, titulo: "Monitoramento de Servidores", descricao: "Vigilância contínua dos seus serviços para máxima disponibilidade", servicos: ["Uptime monitoring", "Alertas instantâneos", "Relatórios de performance", "Prevenção de falhas", "SLA garantido"] },
    { icone: <Clock className="w-8 h-8" />, titulo: "Consultoria Técnica", descricao: "Aconselhamento especializado para otimizar a sua infraestrutura", servicos: ["Análise de arquitetura", "Recomendações", "Planeamento de migração", "Otimização de custos", "Roadmap tecnológico"] },
    { icone: <MessageCircle className="w-8 h-8" />, titulo: "Formação e Treino", descricao: "Capacitação da sua equipa para gerir as ferramentas e plataformas", servicos: ["Formação WordPress", "Gestão de email", "Painel de controlo", "Boas práticas", "Documentação"] },
    { icone: <FileText className="w-8 h-8" />, titulo: "Contratos de Suporte", descricao: "Planos de suporte contínuo com SLA e prioridade garantida", servicos: ["Plano Básico", "Plano Profissional", "Plano Enterprise", "SLA personalizado", "Gestor dedicado"] }
  ]

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-[#404040] relative overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20" style={{ backgroundImage: "url('/assets/BG.jpg')" }} />
        <div className="absolute inset-0 bg-black/50" />
        <div className="container mx-auto max-w-7xl px-6 pt-[150px] pb-[80px] flex items-center justify-center min-h-[300px] relative z-10">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-white mb-2">Suporte Técnico</h1>
            <p className="text-base text-white font-normal">Assistência técnica profissional e manutenção para o seu negócio digital</p>
          </div>
        </div>
      </div>
      <div className="py-16">
        <div className="container mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {servicosSuporte.map((s, i) => (
              <div key={i} className="bg-white text-black/70 p-6 rounded-lg">
                <div className="flex items-center mb-4"><div className="text-red-500 mr-3">{s.icone}</div><h3 className="text-xl font-bold">{s.titulo}</h3></div>
                <p className="text-black/70 mb-6 text-sm leading-relaxed">{s.descricao}</p>
                <div className="mb-6">
                  <h4 className="font-medium mb-3 text-sm">O que inclui:</h4>
                  <ul className="space-y-0">{s.servicos.map((item, idx) => (<li key={idx} className="flex items-center text-black/70 text-sm"><span className="w-2 h-2 bg-red-500 rounded-full mr-3"></span>{item}</li>))}</ul>
                </div>
                <button className="w-full bg-black text-white px-4 py-3 rounded font-medium hover:bg-red-600 transition-colors">Contactar Suporte</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
