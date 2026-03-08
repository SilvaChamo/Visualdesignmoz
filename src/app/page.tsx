'use client'

import { Header } from '@/components/layout/Header'
import { I18nProvider, useI18n } from '@/lib/i18n'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Search, ArrowRight, Sparkles } from 'lucide-react'
import DomainSearch from '@/components/DomainSearch'

function HomePage() {
  const { t } = useI18n()
  const [activeTab, setActiveTab] = useState('home.tabs.domains')
  const [searchQuery, setSearchQuery] = useState('')
  const [isScrolled, setIsScrolled] = useState(false)

  const tabs = ['home.tabs.domains', 'home.tabs.hosting', 'home.tabs.ssl', 'home.tabs.email', 'home.tabs.support']

  const frequentQuestions = [
    {
      category: t('home.faq.domains'),
      questions: [
        t('home.faq.domains.q1'),
        t('home.faq.domains.q2'),
        t('home.faq.domains.q3'),
        t('home.faq.domains.q4')
      ]
    },
    {
      category: t('home.faq.hosting'),
      questions: [
        t('home.faq.hosting.q1'),
        t('home.faq.hosting.q2'),
        t('home.faq.hosting.q3'),
        t('home.faq.hosting.q4')
      ]
    },
    {
      category: t('home.faq.ssl'),
      questions: [
        t('home.faq.ssl.q1'),
        t('home.faq.ssl.q2'),
        t('home.faq.ssl.q3'),
        t('home.faq.ssl.q4')
      ]
    },
    {
      category: t('home.faq.email'),
      questions: [
        t('home.faq.email.q1'),
        t('home.faq.email.q2'),
        t('home.faq.email.q3'),
        t('home.faq.email.q4')
      ]
    },
    {
      category: t('home.faq.support'),
      questions: [
        t('home.faq.support.q1'),
        t('home.faq.support.q2'),
        t('home.faq.support.q3'),
        t('home.faq.support.q4')
      ]
    }
  ]

  const currentQuestions = frequentQuestions.find(q => q.category === activeTab)?.questions || []

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 40)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className="min-h-screen bg-black/10">
      {/* Top Menu Bar - Aparece apenas sem scroll */}
      {!isScrolled && (
        <div className="fixed top-0 left-0 right-0 z-[60] bg-black h-[40px] flex items-center transition-all duration-300 shadow-lg">
          <div className="container mx-auto max-w-7xl px-6 grid grid-cols-3 items-center h-full">
            <div className="flex justify-start">
              <a href="#faq" className="text-white text-sm hover:text-red-500 transition-colors">{t('nav.help')}</a>
            </div>
            <div className="flex justify-center">
              <a href="#faq" className="text-white text-sm hover:text-red-500 transition-colors">{t('nav.faq')}</a>
            </div>
            <div className="flex justify-end">
              <a href="#faq" className="text-white text-sm hover:text-red-500 transition-colors">{t('nav.questions')}</a>
            </div>
          </div>
        </div>
      )}

      {/* Header - Fixo e ocupa espaço do top menu quando scrolled */}
      <Header isScrolled={isScrolled} />

      {/* Header Section - Gray 25% */}
      <div className="bg-[#404040] relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20"
          style={{ backgroundImage: "url('/assets/BG.jpg')" }}
        />
        <div className="absolute inset-0 bg-black/50" />
        <div className="container mx-auto max-w-7xl px-6 pt-[80px] sm:pt-[100px] md:pt-[120px] lg:pt-[150px] pb-[20px] sm:pb-[30px] flex flex-col justify-between items-center min-h-[300px] sm:min-h-[350px] md:min-h-[400px] relative z-10">
          <div className="w-full max-w-4xl text-center">
            <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-2 sm:mb-3 md:mb-4 whitespace-nowrap">
              {t('home.title')}
            </h1>
            <p className="text-sm sm:text-base md:text-lg lg:text-xl text-white mb-[20px] sm:mb-[25px] md:mb-[30px] font-normal text-center max-w-3xl sm:max-w-4xl md:max-w-5xl lg:max-w-6xl mx-auto">
              {t('home.subtitle')}
            </p>

            {/* Domain Search Box */}
            <div className="flex justify-center mb-[40px]">
              <DomainSearch />
            </div>

            {/* Tabs */}
            <div className="flex justify-center pb-0 mb-0">
              <div className="flex flex-wrap justify-center gap-1 sm:gap-2 mb-0 px-2 sm:px-0">
                {tabs.map((tabKey) => (
                  <button
                    key={tabKey}
                    onClick={() => {
                      setActiveTab(tabKey)
                      // Redirecionar para página específica
                      if (tabKey === 'home.tabs.domains') window.location.href = '/precos/dominios'
                      else if (tabKey === 'home.tabs.hosting') window.location.href = '/precos/hospedagem'
                      else if (tabKey === 'home.tabs.ssl') window.location.href = '/precos/ssl'
                      else if (tabKey === 'home.tabs.email') window.location.href = '/precos/email'
                      else if (tabKey === 'home.tabs.support') window.location.href = '/precos/suporte'
                    }}
                    className={`px-2 sm:px-3 md:px-4 py-1 rounded-lg font-medium text-xs sm:text-sm transition-all relative flex items-center justify-center text-center ${activeTab === tabKey
                      ? 'bg-red-600 text-white'
                      : 'bg-black text-white hover:bg-red-600'
                      }`}
                  >
                    {t(tabKey)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Service Categories - Bottom Center */}
          {/* <div className="w-full max-w-4xl text-center mt-4">
            <div className="flex flex-wrap justify-center gap-4">
              <Link href="/servicos/design-grafico" className="text-white hover:text-red-500 transition-colors font-medium text-sm">
                Design Gráfico
              </Link>
              <Link href="/servicos/webdesign" className="text-white hover:text-red-500 transition-colors font-medium text-sm">
                Web Design
              </Link>
              <Link href="/servicos/marketing-digital" className="text-white hover:text-red-500 transition-colors font-medium text-sm">
                Marketing Digital
              </Link>
              <Link href="/servicos/branding" className="text-white hover:text-red-500 transition-colors font-medium text-sm">
                Branding
              </Link>
              <Link href="/servicos/seo" className="text-white hover:text-red-500 transition-colors font-medium text-sm">
                SEO
              </Link>
              <Link href="/servicos/redes-sociais" className="text-white hover:text-red-500 transition-colors font-medium text-sm">
                Redes Sociais
              </Link>
              <Link href="/servicos/video-producao" className="text-white hover:text-red-500 transition-colors font-medium text-sm">
                Produção de Vídeo
              </Link>
              <Link href="/servicos/fotografia" className="text-white hover:text-red-500 transition-colors font-medium text-sm">
                Fotografia
              </Link>
            </div>
          </div> */}
        </div>
      </div>

      {/* Content Section */}
      <div>
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 py-8">
          {/* Design Services */}
          <div className="text-center">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
              <div className="bg-white text-black/70 p-3 sm:p-4 rounded-lg">
                <h4 className="font-bold mb-2">{t('services.graphic')}</h4>
                <div className="text-black/70 text-sm mb-4">{t('services.graphic.desc')}</div>
                <Link href="/servicos/design-grafico" className="bg-black text-white px-3 sm:px-4 py-2 rounded text-xs sm:text-sm font-medium hover:bg-red-600 hover:text-white transition-colors inline-block cursor-pointer">
                  {t('services.view')}
                </Link>
              </div>
              <div className="bg-white text-black/70 p-3 sm:p-4 rounded-lg">
                <h4 className="font-bold mb-2">{t('services.web')}</h4>
                <p className="text-black/70 text-sm mb-4">{t('services.web.desc')}</p>
                <Link href="/servicos/webdesign" className="bg-black text-white px-3 sm:px-4 py-2 rounded text-xs sm:text-sm font-medium hover:bg-red-600 hover:text-white transition-colors inline-block cursor-pointer">
                  {t('services.view')}
                </Link>
              </div>
              <div className="bg-white text-black/70 p-3 sm:p-4 rounded-lg">
                <h4 className="font-bold mb-2">{t('services.marketing')}</h4>
                <p className="text-black/70 text-sm mb-4">{t('services.marketing.desc')}</p>
                <Link href="/servicos/marketing-digital" className="bg-black text-white px-3 sm:px-4 py-2 rounded text-xs sm:text-sm font-medium hover:bg-red-600 hover:text-white transition-colors inline-block cursor-pointer">
                  {t('services.view')}
                </Link>
              </div>
              <div className="bg-white text-black/70 p-3 sm:p-4 rounded-lg">
                <h4 className="font-bold mb-2">{t('services.branding')}</h4>
                <p className="text-black/70 text-sm mb-4">{t('services.branding.desc')}</p>
                <Link href="/servicos/branding" className="bg-black text-white px-3 sm:px-4 py-2 rounded text-xs sm:text-sm font-medium hover:bg-red-600 hover:text-white transition-colors inline-block cursor-pointer">
                  {t('services.view')}
                </Link>
              </div>
              <div className="bg-white text-black/70 p-3 sm:p-4 rounded-lg">
                <h4 className="font-bold mb-2">{t('services.seo')}</h4>
                <p className="text-black/70 text-sm mb-4">{t('services.seo.desc')}</p>
                <Link href="/servicos/seo" className="bg-black text-white px-3 sm:px-4 py-2 rounded text-xs sm:text-sm font-medium hover:bg-red-600 hover:text-white transition-colors inline-block cursor-pointer">
                  {t('services.view')}
                </Link>
              </div>
              <div className="bg-white text-black/70 p-3 sm:p-4 rounded-lg">
                <h4 className="font-bold mb-2">{t('services.social')}</h4>
                <p className="text-black/70 text-sm mb-4">{t('services.social.desc')}</p>
                <Link href="/servicos/redes-sociais" className="bg-black text-white px-3 sm:px-4 py-2 rounded text-xs sm:text-sm font-medium hover:bg-red-600 hover:text-white transition-colors inline-block cursor-pointer">
                  {t('services.view')}
                </Link>
              </div>
              <div className="bg-white text-black/70 p-3 sm:p-4 rounded-lg">
                <h4 className="font-bold mb-2">{t('services.video')}</h4>
                <p className="text-black/70 text-sm mb-4">{t('services.video.desc')}</p>
                <Link href="/servicos/video-producao" className="bg-black text-white px-3 sm:px-4 py-2 rounded text-xs sm:text-sm font-medium hover:bg-red-600 hover:text-white transition-colors inline-block cursor-pointer">
                  {t('services.view')}
                </Link>
              </div>
              <div className="bg-white text-black/70 p-3 sm:p-4 rounded-lg">
                <h4 className="font-bold mb-2">{t('services.photography')}</h4>
                <p className="text-black/70 text-sm mb-4">{t('services.photography.desc')}</p>
                <Link href="/servicos/fotografia" className="bg-black text-white px-3 sm:px-4 py-2 rounded text-xs sm:text-sm font-medium hover:bg-red-600 hover:text-white transition-colors inline-block cursor-pointer">
                  {t('services.view')}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Inicio() {
  return (
    <I18nProvider>
      <HomePage />
    </I18nProvider>
  )
}
