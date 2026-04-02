'use client'

import { useI18n } from '@/lib/i18n'
import Link from 'next/link'
import { ArrowLeft, TrendingUp, Target, Megaphone, BarChart3, Users, Search } from 'lucide-react'

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
            <h1 className="text-3xl font-bold text-white mb-2">{t('services.marketing.pageTitle')}</h1>
            <p className="text-base text-white font-normal">
              {t('services.marketing.pageSubtitle')}
            </p>
          </div>
        </div>
      </div>

      <div className="py-16">
        <div className="container mx-auto max-w-7xl px-6">
          <h2 className="text-2xl font-bold text-black mb-8 text-center">{t('services.marketing.pageTitle')}</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {servicosMarketing.map((servico, index) => (
              <div key={index} className="bg-white text-black/70 p-6 rounded-lg">
                <div className="flex items-center mb-4">
                  <div className="text-red-500 mr-3">
                    {servico.icone}
                  </div>
                  <h3 className="text-xl font-bold">{servico.tituloKey ? t(servico.tituloKey) : servico.titulo}</h3>
                </div>
                
                <p className="text-black/70 mb-6 text-sm leading-relaxed">
                  {t(servico.descKey)}
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

          <div className="mt-16 text-center">
            <h3 className="text-xl font-bold text-black mb-4">{t('services.marketing.methodology')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gray-50 p-6 rounded-lg">
                <h4 className="font-medium text-black mb-3">{t('services.marketing.step1.title')}</h4>
                <p className="text-gray-600 text-sm">{t('services.marketing.step1.desc')}</p>
              </div>
              <div className="bg-gray-50 p-6 rounded-lg">
                <h4 className="font-medium text-black mb-3">{t('services.marketing.step2.title')}</h4>
                <p className="text-gray-600 text-sm">{t('services.marketing.step2.desc')}</p>
              </div>
              <div className="bg-gray-50 p-6 rounded-lg">
                <h4 className="font-medium text-black mb-3">{t('services.marketing.step3.title')}</h4>
                <p className="text-gray-600 text-sm">{t('services.marketing.step3.desc')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
