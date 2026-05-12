'use client'

import { useI18n } from '@/lib/i18n'
import { Share2, Calendar, TrendingUp, Users, MessageSquare, Target } from 'lucide-react'

export default function RedesSociais() {
  const { t } = useI18n()

  const servicosRedesSociais = [
    {
      icone: <Share2 className="w-8 h-8" />,
      titulo: "Gestão de Conteúdo",
      descricao: "Criação e publicação estratégica de conteúdo para todas as redes",
      servicos: ["Content calendar", "Post creation", "Copywriting", "Visual design", "Hashtag strategy"]
    },
    {
      icone: <Calendar className="w-8 h-8" />,
      titulo: "Planejamento Estratégico",
      descricao: "Desenvolvimento de estratégias personalizadas para cada plataforma",
      servicos: ["Social media strategy", "Platform selection", "Content pillars", "Campaign planning", "Goal setting"]
    },
    {
      icone: <TrendingUp className="w-8 h-8" />,
      titulo: "Análise e Métricas",
      descricao: "Monitoramento completo de performance e relatórios detalhados",
      servicos: ["Performance tracking", "Engagement analysis", "Follower growth", "ROI analysis", "Monthly reports"]
    },
    {
      icone: <Users className="w-8 h-8" />,
      titulo: "Community Management",
      descricao: "Gestão ativa da comunidade e engajamento com seguidores",
      servicos: ["Comment moderation", "Customer service", "Community engagement", "Crisis management", "Brand voice consistency"]
    },
    {
      icone: <MessageSquare className="w-8 h-8" />,
      titulo: "Social Ads",
      descricao: "Campanhas pagas em redes sociais para aumentar alcance e conversões",
      servicos: ["Facebook Ads", "Instagram Ads", "LinkedIn Ads", "Twitter Ads", "TikTok Ads"]
    },
    {
      icone: <Target className="w-8 h-8" />,
      titulo: "Influencer Marketing",
      descricao: "Parcerias estratégicas com influenciadores para amplificar sua marca",
      servicos: ["Influencer identification", "Campaign management", "Partnership negotiation", "Content collaboration", "Performance tracking"]
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
            <h1 className="text-3xl font-bold text-white mb-2">{t('services.social')}</h1>
            <p className="text-base text-white font-normal">
              {t('services.social.desc')}
            </p>
          </div>
        </div>
      </div>

      <div className="py-16">
        <div className="container mx-auto max-w-7xl px-6">

          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {servicosRedesSociais.map((servico, index) => (
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
                  <h4 className="font-medium mb-3 text-sm">{t('common.included')}</h4>
                  <ul className="space-y-0">
                    {servico.servicos.map((item, idx) => (
                      <li key={idx} className="flex items-center text-black/70 text-sm">
                        <span className="w-2 h-2 bg-red-500 rounded-full mr-3"></span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                
                <button className="w-fit bg-black text-white px-4 py-3 rounded font-medium hover:bg-red-600 hover:text-white transition-colors">
                  {t('common.requestQuote')}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
