'use client'

import { useI18n } from '@/lib/i18n'
import Link from 'next/link'
import { ArrowLeft, Sparkles, Target, Lightbulb, Award, Users, Zap } from 'lucide-react'

export default function Branding() {
  const { t } = useI18n()

  const servicosBranding = [
    {
      icone: <Sparkles className="w-8 h-8" />,
      titulo: "Identidade Visual Completa",
      descricao: "Criação de marca do zero com todos os elementos visuais necessários",
      servicos: ["Logo design", "Paleta de cores", "Tipografia", "Sistema visual", "Manual de marca"]
    },
    {
      icone: <Target className="w-8 h-8" />,
      titulo: "Posicionamento de Marca",
      descricao: "Estratégia para posicionar sua marca no mercado e na mente do consumidor",
      servicos: ["Análise de mercado", "Persona do cliente", "Proposta de valor", "Diferenciação", "Brand voice"]
    },
    {
      icone: <Lightbulb className="w-8 h-8" />,
      titulo: "Naming e Slogan",
      descricao: "Criação de nomes memoráveis e slogans que comunicam sua essência",
      servicos: ["Naming", "Slogan creation", "Tagline development", "Brand storytelling", "Copywriting"]
    },
    {
      icone: <Award className="w-8 h-8" />,
      titulo: "Rebranding",
      descricao: "Atualização estratégica de marcas existentes para novos mercados",
      servicos: ["Brand audit", "Modernização", "Migração de marca", "Comunicação de mudança", "Relançamento"]
    },
    {
      icone: <Users className="w-8 h-8" />,
      titulo: "Brand Experience",
      descricao: "Design da experiência completa do cliente com sua marca",
      servicos: ["Customer journey", "Touchpoints design", "Brand activation", "Experiência digital", "Ambiente físico"]
    },
    {
      icone: <Zap className="w-8 h-8" />,
      titulo: "Gestão de Marca",
      descricao: "Manutenção e evolução contínua da sua identidade de marca",
      servicos: ["Brand guidelines", "Consistência visual", "Monitoramento", "Brand tracking", "Evolução estratégica"]
    }
  ]

  return (
    <div className="min-h-screen bg-black/10">
      <div className="bg-[#404040] relative overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20"
          style={{ backgroundImage: "url('/assets/BG.jpg')" }}
        />
        <div className="absolute inset-0 bg-black/50" />
        <div className="container mx-auto max-w-7xl px-6 pt-[150px] pb-[80px] flex items-center justify-center min-h-[300px] relative z-10">
          <div className="text-center">
            <div className="flex items-center justify-center mb-4">
              <Link href="/" className="text-white hover:text-red-500 transition-colors flex items-center">
                <ArrowLeft className="w-5 h-5 mr-2" />
                {t('common.backToHome')}
              </Link>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">{t('services.branding')}</h1>
            <p className="text-base text-white font-normal">
              {t('services.branding.desc')}
            </p>
          </div>
        </div>
      </div>

      <div className="py-16">
        <div className="container mx-auto max-w-7xl px-6">
          <h2 className="text-2xl font-bold text-black mb-8 text-center">{t('services.branding')}</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {servicosBranding.map((servico, index) => (
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
                
                <button className="w-full bg-black text-white px-4 py-3 rounded font-medium hover:bg-red-600 hover:text-white transition-colors">
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
