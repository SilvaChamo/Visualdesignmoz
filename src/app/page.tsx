'use client'
// Force re-render to fix hydration mismatch after logo size change

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Globe, Mail, ShieldCheck, DatabaseBackup, RefreshCw, AppWindow } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import DomainSearch from '@/components/DomainSearch'

function HomePage() {
  const { t } = useI18n()
  const [activeTab, setActiveTab] = useState('home.tabs.domains')
  const [hideServices, setHideServices] = useState(false)

  const tabs = ['home.tabs.domains', 'home.tabs.hosting', 'home.tabs.ssl', 'home.tabs.email', 'home.tabs.support']

  return (
    <div className="min-h-screen bg-black/10 dark:bg-black">
      {/* Header Section - Gray 25% */}
      <div className="bg-[#404040] dark:bg-black relative overflow-hidden">
        <Image
          src="/assets/BG.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center opacity-20 dark:opacity-25"
          aria-hidden
        />
        <div className="absolute inset-0 bg-black/40 dark:bg-black/45" />
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 pt-[120px] sm:pt-[100px] md:pt-[120px] lg:pt-[150px] pb-[20px] sm:pb-[30px] flex flex-col justify-between items-center min-h-[300px] sm:min-h-[350px] md:min-h-[400px] relative z-10">
          <div className="w-full max-w-4xl text-center">
            <h1 className="w-full px-2 text-center font-bold leading-[1.15] text-white mb-0 sm:mb-1 text-[clamp(1.375rem,2.8vw+0.75rem,2.25rem)]">
              {t('home.title')}
            </h1>
            <p className="text-sm sm:text-base md:text-lg lg:text-xl text-white mb-[20px] sm:mb-[25px] md:mb-[30px] font-normal text-center max-w-3xl sm:max-w-4xl md:max-w-5xl lg:max-w-6xl mx-auto">
              {t('home.subtitle')}
            </p>

            {/* Domain Search Box */}
            <div className="flex justify-center mb-[40px] w-full max-w-[830px] mx-auto">
              <DomainSearch
                panelFieldRounding
                onResultsAction={(results) => setHideServices(results.length > 0)}
              />
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
                      : 'bg-black dark:bg-zinc-900 dark:border dark:border-zinc-700 text-white hover:bg-red-600 dark:hover:bg-zinc-800'
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
      {!hideServices && (
        <div>
          <div className="container mx-auto max-w-7xl px-4 sm:px-6 py-8">
            {/* Design Services */}
            <div className="text-center">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
                <div className="bg-white dark:bg-white/10 dark:backdrop-blur-md dark:border dark:border-white/15 text-black/70 dark:text-zinc-100 p-3 sm:p-4 rounded-lg">
                  <h4 className="font-bold mb-2">{t('services.graphic')}</h4>
                  <div className="text-black/70 dark:text-zinc-300 text-sm mb-4">{t('services.graphic.desc')}</div>
                  <Link href="/servicos/design-grafico" className="bg-black text-white px-3 sm:px-4 py-2 rounded text-xs sm:text-sm font-medium hover:bg-red-600 hover:text-white dark:bg-transparent dark:border dark:border-white/25 dark:text-white dark:hover:bg-red-600 dark:hover:border-red-600 transition-colors inline-block cursor-pointer">
                    {t('services.view')}
                  </Link>
                </div>
                <div className="bg-white dark:bg-white/10 dark:backdrop-blur-md dark:border dark:border-white/15 text-black/70 dark:text-zinc-100 p-3 sm:p-4 rounded-lg">
                  <h4 className="font-bold mb-2">{t('services.web')}</h4>
                  <p className="text-black/70 dark:text-zinc-300 text-sm mb-4">{t('services.web.desc')}</p>
                  <Link href="/servicos/webdesign" className="bg-black text-white px-3 sm:px-4 py-2 rounded text-xs sm:text-sm font-medium hover:bg-red-600 hover:text-white dark:bg-transparent dark:border dark:border-white/25 dark:text-white dark:hover:bg-red-600 dark:hover:border-red-600 transition-colors inline-block cursor-pointer">
                    {t('services.view')}
                  </Link>
                </div>
                <div className="bg-white dark:bg-white/10 dark:backdrop-blur-md dark:border dark:border-white/15 text-black/70 dark:text-zinc-100 p-3 sm:p-4 rounded-lg">
                  <h4 className="font-bold mb-2">{t('services.marketing')}</h4>
                  <p className="text-black/70 dark:text-zinc-300 text-sm mb-4">{t('services.marketing.desc')}</p>
                  <Link href="/servicos/marketing-digital" className="bg-black text-white px-3 sm:px-4 py-2 rounded text-xs sm:text-sm font-medium hover:bg-red-600 hover:text-white dark:bg-transparent dark:border dark:border-white/25 dark:text-white dark:hover:bg-red-600 dark:hover:border-red-600 transition-colors inline-block cursor-pointer">
                    {t('services.view')}
                  </Link>
                </div>
                <div className="bg-white dark:bg-white/10 dark:backdrop-blur-md dark:border dark:border-white/15 text-black/70 dark:text-zinc-100 p-3 sm:p-4 rounded-lg">
                  <h4 className="font-bold mb-2">{t('services.branding')}</h4>
                  <p className="text-black/70 dark:text-zinc-300 text-sm mb-4">{t('services.branding.desc')}</p>
                  <Link href="/servicos/branding" className="bg-black text-white px-3 sm:px-4 py-2 rounded text-xs sm:text-sm font-medium hover:bg-red-600 hover:text-white dark:bg-transparent dark:border dark:border-white/25 dark:text-white dark:hover:bg-red-600 dark:hover:border-red-600 transition-colors inline-block cursor-pointer">
                    {t('services.view')}
                  </Link>
                </div>
                <div className="bg-white dark:bg-white/10 dark:backdrop-blur-md dark:border dark:border-white/15 text-black/70 dark:text-zinc-100 p-3 sm:p-4 rounded-lg">
                  <h4 className="font-bold mb-2">{t('services.seo')}</h4>
                  <p className="text-black/70 dark:text-zinc-300 text-sm mb-4">{t('services.seo.desc')}</p>
                  <Link href="/servicos/seo" className="bg-black text-white px-3 sm:px-4 py-2 rounded text-xs sm:text-sm font-medium hover:bg-red-600 hover:text-white dark:bg-transparent dark:border dark:border-white/25 dark:text-white dark:hover:bg-red-600 dark:hover:border-red-600 transition-colors inline-block cursor-pointer">
                    {t('services.view')}
                  </Link>
                </div>
                <div className="bg-white dark:bg-white/10 dark:backdrop-blur-md dark:border dark:border-white/15 text-black/70 dark:text-zinc-100 p-3 sm:p-4 rounded-lg">
                  <h4 className="font-bold mb-2">{t('services.social')}</h4>
                  <p className="text-black/70 dark:text-zinc-300 text-sm mb-4">{t('services.social.desc')}</p>
                  <Link href="/servicos/redes-sociais" className="bg-black text-white px-3 sm:px-4 py-2 rounded text-xs sm:text-sm font-medium hover:bg-red-600 hover:text-white dark:bg-transparent dark:border dark:border-white/25 dark:text-white dark:hover:bg-red-600 dark:hover:border-red-600 transition-colors inline-block cursor-pointer">
                    {t('services.view')}
                  </Link>
                </div>
                <div className="bg-white dark:bg-white/10 dark:backdrop-blur-md dark:border dark:border-white/15 text-black/70 dark:text-zinc-100 p-3 sm:p-4 rounded-lg">
                  <h4 className="font-bold mb-2">{t('services.video')}</h4>
                  <p className="text-black/70 dark:text-zinc-300 text-sm mb-4">{t('services.video.desc')}</p>
                  <Link href="/servicos/video-producao" className="bg-black text-white px-3 sm:px-4 py-2 rounded text-xs sm:text-sm font-medium hover:bg-red-600 hover:text-white dark:bg-transparent dark:border dark:border-white/25 dark:text-white dark:hover:bg-red-600 dark:hover:border-red-600 transition-colors inline-block cursor-pointer">
                    {t('services.view')}
                  </Link>
                </div>
                <div className="bg-white dark:bg-white/10 dark:backdrop-blur-md dark:border dark:border-white/15 text-black/70 dark:text-zinc-100 p-3 sm:p-4 rounded-lg">
                  <h4 className="font-bold mb-2">{t('services.photography')}</h4>
                  <p className="text-black/70 dark:text-zinc-300 text-sm mb-4">{t('services.photography.desc')}</p>
                  <Link href="/servicos/fotografia" className="bg-black text-white px-3 sm:px-4 py-2 rounded text-xs sm:text-sm font-medium hover:bg-red-600 hover:text-white dark:bg-transparent dark:border dark:border-white/25 dark:text-white dark:hover:bg-red-600 dark:hover:border-red-600 transition-colors inline-block cursor-pointer">
                    {t('services.view')}
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Hosting Features Section */}
          <div className="bg-white dark:bg-zinc-950 py-12 sm:py-16">
            <div className="container mx-auto max-w-7xl px-4 sm:px-6">
              <div className="text-center mb-10 sm:mb-12">
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-black dark:text-white mb-4">
                  {t('home.hosting.title')}
                </h2>
                <p className="text-sm sm:text-base text-black/60 dark:text-zinc-400 max-w-3xl mx-auto">
                  {t('home.hosting.subtitle')}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
                {[
                  { Icon: Globe, titleKey: 'home.hosting.domain.title', descKey: 'home.hosting.domain.desc' },
                  { Icon: Mail, titleKey: 'home.hosting.email.title', descKey: 'home.hosting.email.desc' },
                  { Icon: ShieldCheck, titleKey: 'home.hosting.ssl.title', descKey: 'home.hosting.ssl.desc' },
                  { Icon: DatabaseBackup, titleKey: 'home.hosting.backup.title', descKey: 'home.hosting.backup.desc' },
                  { Icon: RefreshCw, titleKey: 'home.hosting.migration.title', descKey: 'home.hosting.migration.desc' },
                  { Icon: AppWindow, titleKey: 'home.hosting.wordpress.title', descKey: 'home.hosting.wordpress.desc' },
                ].map(({ Icon, titleKey, descKey }) => (
                  <div key={titleKey} className="flex gap-4">
                    <div className="shrink-0 w-11 h-11 rounded-lg border border-green-600/40 bg-green-600/5 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-green-600" strokeWidth={2} />
                    </div>
                    <div>
                      <h3 className="font-bold text-black dark:text-white mb-1 relative inline-block">
                        {t(titleKey)}
                        <span className="block h-[2px] w-8 bg-green-600 mt-1" />
                      </h3>
                      <p className="text-sm text-black/60 dark:text-zinc-400 mt-2">
                        {t(descKey)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Inicio() {
  return <HomePage />
}
