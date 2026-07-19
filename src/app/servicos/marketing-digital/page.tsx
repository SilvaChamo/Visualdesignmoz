'use client'

import { useI18n } from '@/lib/i18n'
import Link from 'next/link'
import { TrendingUp, Target, Megaphone, BarChart3, Users, Search, ArrowRight, CheckCircle2 } from 'lucide-react'

export default function MarketingDigital() {
  const { t } = useI18n()

  const servicosMarketing = [
    {
      icone: <TrendingUp className="w-8 h-8" />,
      tituloKey: 'services.marketing.seo',
      descKey: 'services.marketing.seo.desc',
      servicos: ["SEO on-page", "SEO técnico", "Link building", "SEO local", "SEO de conteúdo"]
    },
    {
      icone: <Target className="w-8 h-8" />,
      tituloKey: 'services.marketing.content',
      descKey: 'services.marketing.content.desc',
      servicos: ["Blog posts", "E-books", "Infográficos", "Vídeos", "Podcasts"]
    },
    {
      icone: <Megaphone className="w-8 h-8" />,
      tituloKey: 'services.marketing.ads',
      descKey: 'services.marketing.ads.desc',
      servicos: ["Google Ads", "Facebook Ads", "Instagram Ads", "LinkedIn Ads", "Display ads"]
    },
    {
      icone: <BarChart3 className="w-8 h-8" />,
      tituloKey: 'services.marketing.analytics',
      descKey: 'services.marketing.analytics.desc',
      servicos: ["Google Analytics", "Heatmaps", "A/B testing", "Relatórios mensais", "KPIs tracking"]
    },
    {
      icone: <Users className="w-8 h-8" />,
      tituloKey: 'services.marketing.social',
      descKey: 'services.marketing.social.desc',
      servicos: ["Content calendar", "Community management", "Social ads", "Influencer marketing", "Social listening"]
    },
    {
      icone: <Search className="w-8 h-8" />,
      titulo: "Email Marketing",
      descKey: 'services.marketing.email.desc',
      servicos: ["Newsletters", "Email automation", "Lead nurturing", "Segmentação", "Email design"]
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
            <h1 className="text-3xl font-bold text-white mb-2">{t('services.marketing.pageTitle')}</h1>
            <p className="text-base text-zinc-300 font-normal">
              {t('services.marketing.pageSubtitle')}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="py-16">
        <div className="container mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {servicosMarketing.map((servico, index) => (
              <div key={index} className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 p-6 rounded-2xl shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center mb-4">
                    <div className="text-red-500 mr-3">
                      {servico.icone}
                    </div>
                    <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{servico.tituloKey ? t(servico.tituloKey) : servico.titulo}</h3>
                  </div>
                  
                  <p className="text-zinc-600 dark:text-zinc-400 mb-6 text-sm leading-relaxed">
                    {t(servico.descKey)}
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
            <h2 className="text-3xl font-extrabold">Deseja acelerar o crescimento do seu negócio?</h2>
            <p className="text-lg text-red-100 max-w-xl mx-auto">
              Desenhamos estratégias completas de tráfego pago, email marketing e gestão de redes sociais para converter visitantes em clientes reais.
            </p>
            <Link
              href="/contacto?servico=marketing-digital"
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
