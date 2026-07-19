'use client'

import { useI18n } from '@/lib/i18n'
import Link from 'next/link'
import { Sparkles, Target, Lightbulb, Award, Users, Zap, ArrowRight, CheckCircle2 } from 'lucide-react'

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
            <h1 className="text-3xl font-bold text-white mb-2">{t('services.branding')}</h1>
            <p className="text-base text-zinc-300 font-normal font-sans">
              {t('services.branding.desc')}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="py-16">
        <div className="container mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {servicosBranding.map((servico, index) => (
              <div key={index} className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 p-6 rounded-2xl shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center mb-4">
                    <div className="text-red-500 mr-3">
                      {servico.icone}
                    </div>
                    <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{servico.titulo}</h3>
                  </div>
                  
                  <p className="text-zinc-600 dark:text-zinc-400 mb-6 text-sm leading-relaxed">
                    {servico.descricao}
                  </p>
                  
                  <div>
                    <h4 className="font-semibold text-zinc-700 dark:text-zinc-300 mb-3 text-sm">{t('common.included')}</h4>
                    <ul className="space-y-2">
                      {servico.servicos.map((item, idx) => (
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
            <h2 className="text-3xl font-extrabold">Deseja construir uma marca inesquecível?</h2>
            <p className="text-lg text-red-100 max-w-xl mx-auto">
              Desenvolvemos estratégias de branding completas, naming, logos e identidade visual para que a sua marca se destaque.
            </p>
            <Link
              href="/contacto?servico=branding"
              className="inline-flex items-center gap-2 bg-white text-red-600 font-bold px-10 py-4 rounded-xl shadow-lg hover:bg-zinc-100 transition-all transform hover:-translate-y-0.5"
            >
              <span>Pedir Orçamento Gratuito</span>
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>

        </div>
      </div>
    </div>
  )
}
