'use client'
// Force re-render to fix hydration mismatch after logo size change

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Globe, Mail, ShieldCheck, DatabaseBackup, RefreshCw, AppWindow, Server, LifeBuoy, Sparkles, LayoutDashboard, Send, HardDrive, Megaphone, FolderOpen, Database, Lock, GitBranch } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import DomainSearch from '@/components/DomainSearch'
import { CompactFooter } from '@/components/layout/CompactFooter'
import ServicosWebCarousel from '@/components/ServicosWebCarousel'

function HomePage() {
  const { t } = useI18n()
  const [activeTab, setActiveTab] = useState('home.tabs.domains')
  const [hideServices, setHideServices] = useState(false)
  const [openWhyUs, setOpenWhyUs] = useState<Record<number, boolean>>({})
  const [subscribed, setSubscribed] = useState(false)
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'semiannual' | 'annual'>('monthly')

  const formatPrice = (val: number) => {
    if (val >= 1000) {
      const thousands = Math.floor(val / 1000)
      const remainder = val % 1000
      return `${thousands}.${remainder.toString().padStart(3, '0')}`
    }
    return val.toString()
  }

  const getPlanPrice = (basePrice: number) => {
    let mainPrice = basePrice
    let cycleSuffix = `/${t('pricing.hosting.month')}`
    let monthlyEquivalent = basePrice
    let savings = 0
    let savingsText = ''
    
    const isBasic = basePrice === 680
    const semiannualRate = isBasic ? 0.9 : 0.95
    const annualRate = isBasic ? 0.8 : 0.9
    
    if (billingCycle === 'semiannual') {
      const monthlyDiscounted = Math.round(basePrice * semiannualRate)
      mainPrice = monthlyDiscounted * 6
      cycleSuffix = '/6 meses'
      monthlyEquivalent = monthlyDiscounted
      savings = basePrice - monthlyDiscounted
      savingsText = `Poupe ${formatPrice(savings)} MT/mês!`
    } else if (billingCycle === 'annual') {
      const monthlyDiscounted = Math.round(basePrice * annualRate)
      mainPrice = monthlyDiscounted * 12
      cycleSuffix = '/12 meses'
      monthlyEquivalent = monthlyDiscounted
      savings = basePrice - monthlyDiscounted
      savingsText = `Poupe ${formatPrice(savings)} MT/mês!`
    }
    
    return {
      price: formatPrice(mainPrice),
      cycleSuffix,
      monthlyEquivalent: formatPrice(monthlyEquivalent),
      savingsText
    }
  }

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault()
    setSubscribed(true)
    setTimeout(() => {
      setSubscribed(false)
    }, 5000)
  }

  const tabs = ['home.tabs.domains', 'home.tabs.hosting', 'home.tabs.ssl', 'home.tabs.email', 'home.tabs.support']

  const whyUsItems = [
    { Icon: Globe, titleKey: 'home.whyus.domain.title', descKey: 'home.whyus.domain.desc', teaserKey: 'home.whyus.domain.teaser' },
    { Icon: Server, titleKey: 'home.whyus.servers.title', descKey: 'home.whyus.servers.desc', teaserKey: 'home.whyus.servers.teaser' },
    { Icon: LifeBuoy, titleKey: 'home.whyus.support.title', descKey: 'home.whyus.support.desc', teaserKey: 'home.whyus.support.teaser' },
    { Icon: ShieldCheck, titleKey: 'home.whyus.security.title', descKey: 'home.whyus.security.desc', teaserKey: 'home.whyus.security.teaser' },
    { Icon: RefreshCw, titleKey: 'home.whyus.migration.title', descKey: 'home.whyus.migration.desc', teaserKey: 'home.whyus.migration.teaser' },
    { Icon: Sparkles, titleKey: 'home.whyus.custom.title', descKey: 'home.whyus.custom.desc', teaserKey: 'home.whyus.custom.teaser' },
  ]
  const whyUsColumns = [whyUsItems.slice(0, 3), whyUsItems.slice(3, 6)]

  return (
    <div className="min-h-screen bg-black/10 dark:bg-black">
      {/* Header Section - Gray 25% */}
      <div
        className="bg-black relative overflow-hidden"
        style={{
          '--cl': 'max(24px, calc(50% - 616px))',
          clipPath:
            'polygon(0% 0%, 100% 0%, 100% 100%, calc(100% - var(--cl)) 100%, calc(100% - var(--cl) - 15px) calc(100% - 16px), calc(var(--cl) + 15px) calc(100% - 16px), var(--cl) 100%, 0% 100%)',
        } as React.CSSProperties}
      >
        <Image
          src="/assets/Melhor-alojamento-web.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-top opacity-30 dark:opacity-35"
          aria-hidden
        />
        <div className="absolute inset-0 bg-black/20 dark:bg-black/25" />
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 pt-[145px] pb-[30px] sm:pt-[160px] sm:pb-[35px] md:pt-[175px] md:pb-[40px] flex flex-col justify-center items-center min-h-[390px] sm:min-h-[440px] md:min-h-[490px] relative z-10">
          <div className="w-full max-w-4xl text-center">
            <h1 className="w-full px-2 text-center font-bold leading-[1.15] text-white mb-0 sm:mb-1 text-[clamp(1.375rem,2.8vw+0.75rem,2.25rem)]">
              {t('home.title')}
            </h1>
            <p className="text-sm sm:text-base md:text-lg lg:text-xl text-white mb-[28px] sm:mb-[25px] md:mb-[30px] font-normal text-center max-w-3xl sm:max-w-4xl md:max-w-5xl lg:max-w-6xl mx-auto">
              {t('home.subtitle')}
            </p>

            {/* Domain Search Box */}
            <div className="flex justify-center mb-[48px] sm:mb-[40px] w-full max-w-[830px] mx-auto">
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
                    className={`px-2 sm:px-3 md:px-4 py-1 rounded-md font-medium text-xs sm:text-sm transition-all relative flex items-center justify-center text-center ${activeTab === tabKey
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
        <div className="-mt-[16px] relative z-20">
          <div className="container mx-auto max-w-7xl px-4 sm:px-6 pt-0 pb-8">
            {/* Design Services */}
            <div className="text-center pt-[30px]">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-black dark:text-white mb-8">
                <span className="text-zinc-400 dark:text-zinc-500 font-normal">—</span> {t('carousel.section.title')} <span className="text-zinc-400 dark:text-zinc-500 font-normal">—</span>
              </h2>
              <ServicosWebCarousel />
            </div>
          </div>

          {/* Hosting Features Section */}
          <div
            className="bg-white dark:bg-zinc-950 pt-16 pb-12 sm:pt-24 sm:pb-16 relative"
            style={{
              '--cl': 'max(24px, calc(50% - 616px))',
              clipPath:
                'polygon(0% 100%, 100% 100%, 100% 0%, calc(100% - var(--cl)) 0%, calc(100% - var(--cl) - 15px) 16px, calc(var(--cl) + 15px) 16px, var(--cl) 0%, 0% 0%)',
            } as React.CSSProperties}
          >
            <div className="container mx-auto max-w-7xl px-4 sm:px-6">
              <div className="text-center mb-10 sm:mb-12 flex flex-col items-center max-w-4xl mx-auto px-4 md:px-[100px]">
                <div className="flex flex-col items-center mb-3">
                  <img
                    src="/assets/IMG-VD/managed-server.svg"
                    alt=""
                    className="w-16 h-16 mb-2"
                  />
                  <span className="text-xs sm:text-sm font-bold uppercase tracking-wider flex items-center gap-1.5 text-red-600 dark:text-red-500">
                    <span className="text-red-600 dark:text-red-500 font-normal inline-block transform scale-x-[2.5] mx-2.5">—</span>
                    {t('home.hosting.pretitle')}
                    <span className="text-red-600 dark:text-red-500 font-normal inline-block transform scale-x-[2.5] mx-2.5">—</span>
                  </span>
                </div>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-black dark:text-white mb-4 md:whitespace-nowrap">
                  {t('home.hosting.title')}
                </h2>
                <p className="text-sm text-black/60 dark:text-zinc-400 mx-auto">
                  {t('home.hosting.subtitle')}
                </p>
              </div>

              <div className="mt-8 sm:mt-10 mx-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[
                    { Icon: Globe, titleKey: 'home.hosting.domain.title', descKey: 'home.hosting.domain.desc' },
                    { Icon: Mail, titleKey: 'home.hosting.email.title', descKey: 'home.hosting.email.desc' },
                    { Icon: ShieldCheck, titleKey: 'home.hosting.ssl.title', descKey: 'home.hosting.ssl.desc' },
                    { Icon: DatabaseBackup, titleKey: 'home.hosting.backup.title', descKey: 'home.hosting.backup.desc' },
                    { Icon: RefreshCw, titleKey: 'home.hosting.migration.title', descKey: 'home.hosting.migration.desc' },
                    { Icon: AppWindow, titleKey: 'home.hosting.wordpress.title', descKey: 'home.hosting.wordpress.desc' },
                  ].map(({ Icon, titleKey, descKey }) => (
                    <div
                      key={titleKey}
                      className="flex gap-4 p-4 rounded-lg border border-zinc-200/80 dark:border-white/10 bg-black/[0.02] dark:bg-black/40 transition-all duration-300 hover:bg-black/[0.05] dark:hover:bg-black/60 hover:border-red-500/40 dark:hover:border-red-500/40"
                    >
                      <div className="shrink-0 w-11 h-11 rounded-lg border border-red-600/40 dark:border-red-500/40 bg-red-600/5 dark:bg-red-500/5 flex items-center justify-center">
                        <Icon className="w-5 h-5 text-red-600 dark:text-red-500" strokeWidth={2} />
                      </div>
                      <div>
                        <h3 className="font-bold text-black dark:text-white mb-1 relative inline-block">
                          {t(titleKey)}
                          <span className="block h-[2px] w-8 bg-red-600 dark:bg-red-500 mt-1" />
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
        </div>
      )}

      {/* Why Choose Us Section - after Hosting, image background */}
      {!hideServices && (
        <div
          className="bg-zinc-200 dark:bg-black py-8 sm:py-10 relative overflow-hidden -mt-[16px] z-20"
          style={{
            '--cl': 'max(24px, calc(50% - 616px))',
            clipPath:
              'polygon(0% 16px, var(--cl) 16px, calc(var(--cl) + 15px) 0%, calc(100% - var(--cl) - 15px) 0%, calc(100% - var(--cl)) 16px, 100% 16px, 100% calc(100% - 16px), calc(100% - var(--cl)) calc(100% - 16px), calc(100% - var(--cl) - 15px) 100%, calc(var(--cl) + 15px) 100%, var(--cl) calc(100% - 16px), 0% calc(100% - 16px))',
          } as React.CSSProperties}
        >
          <div className="container mx-auto max-w-7xl px-4 sm:px-6 relative z-10">
            <div className="text-center flex flex-col items-center max-w-4xl mx-auto px-4 md:px-[100px] mb-0">
              <img
                src="/assets/IMG-VD/icon-custom-solutions-red.svg"
                alt=""
                className="w-16 h-16 mb-2"
              />
              <span className="text-xs sm:text-sm font-bold uppercase tracking-wider flex items-center gap-1.5 text-red-600 dark:text-red-500 mb-2">
                <span className="text-red-600 dark:text-red-500 font-normal inline-block transform scale-x-[2.5] mx-2.5">—</span>
                {t('home.whyus.pretitle')}
                <span className="text-red-600 dark:text-red-500 font-normal inline-block transform scale-x-[2.5] mx-2.5">—</span>
              </span>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-black dark:text-white mb-3">
                {t('home.whyus.title')}
              </h2>
              <p className="text-sm text-black/60 dark:text-white/70 mx-auto">
                {t('home.whyus.subtitle')}
              </p>
            </div>

            <div className="mt-8 sm:mt-10 mx-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {whyUsColumns.map((column, colIdx) => (
                  <div key={colIdx} className="flex flex-col gap-3">
                    {column.map((item, itemIdx) => {
                      const idx = colIdx * column.length + itemIdx
                      const isOpen = Boolean(openWhyUs[idx])
                      const { Icon } = item
                      return (
                        <div key={item.titleKey} className="flex flex-col gap-2">
                          <button
                            type="button"
                            onClick={() => setOpenWhyUs((prev) => ({ ...prev, [idx]: !prev[idx] }))}
                            className="w-full flex items-stretch text-left bg-white dark:bg-zinc-800 rounded-md overflow-hidden shadow-sm"
                          >
                            <span className="shrink-0 w-20 flex items-center justify-center bg-red-600">
                              <Icon className="w-6 h-6 text-white" />
                            </span>
                            <span className="flex-1 flex items-center justify-between gap-3 px-4 py-4">
                              <span className="flex flex-col gap-1 min-w-0 flex-1">
                                <span className="text-base sm:text-lg font-bold text-black dark:text-white leading-tight">
                                  {t(item.titleKey)}
                                </span>
                                <span className="text-xs sm:text-sm text-black/60 dark:text-zinc-400 line-clamp-1 block">
                                  {t(item.teaserKey)}
                                </span>
                              </span>
                              <span className="shrink-0 w-6 h-6 flex items-center justify-center text-red-600 dark:text-red-500 text-lg font-bold leading-none">
                                {isOpen ? '−' : '+'}
                              </span>
                            </span>
                          </button>
                          <div
                            className={`grid transition-all duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
                          >
                            <div className="overflow-hidden">
                              <div className="px-4 py-8 text-sm text-black/70 dark:text-white/70 bg-white dark:bg-zinc-800 rounded-md shadow-sm">
                                {t(item.descKey)}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hosting Plans & Prices Section */}
      {!hideServices && (
        <div
          className="bg-white dark:bg-zinc-800 py-16 sm:py-20 relative overflow-hidden -mt-[16px] z-20"
          style={{
            '--cl': 'max(24px, calc(50% - 616px))',
            clipPath:
              'polygon(0% 0%, var(--cl) 0%, calc(var(--cl) + 15px) 16px, calc(100% - var(--cl) - 15px) 16px, calc(100% - var(--cl)) 0%, 100% 0%, 100% 100%, calc(100% - var(--cl)) 100%, calc(100% - var(--cl) - 15px) calc(100% - 16px), calc(var(--cl) + 15px) calc(100% - 16px), var(--cl) 100%, 0% 100%)',
          } as React.CSSProperties}
        >
          <div className="container mx-auto max-w-7xl px-4 sm:px-6 relative z-10">
            <div className="text-center flex flex-col items-center max-w-4xl mx-auto px-4 md:px-[100px] mb-10 sm:mb-12">
              <span className="text-xs sm:text-sm font-bold uppercase tracking-wider flex items-center gap-1.5 text-red-600 dark:text-red-500 mb-2">
                <span className="text-red-600 dark:text-red-500 font-normal inline-block transform scale-x-[2.5] mx-2.5">—</span>
                Hospedagem
                <span className="text-red-600 dark:text-red-500 font-normal inline-block transform scale-x-[2.5] mx-2.5">—</span>
              </span>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-black dark:text-white mb-3">
                Planos e preços de hospedagem
              </h2>
              <p className="text-sm text-black/60 dark:text-zinc-400 mx-auto">
                {t('pricing.hosting.subtitle')}
              </p>
              
              <div className="flex items-center justify-center mt-12 gap-3">
                <span className="h-[1.5px] w-[50px] bg-zinc-400 dark:bg-zinc-600"></span>
                <div
                  className="bg-zinc-200 dark:bg-zinc-800 p-0 flex items-stretch gap-0 h-9"
                  style={{
                    clipPath: 'polygon(0% 50%, 10px 0%, calc(100% - 10px) 0%, 100% 50%, calc(100% - 10px) 100%, 10px 100%)'
                  }}
                >
                  {[
                    { id: 'monthly', label: 'Mensal' },
                    { id: 'semiannual', label: 'Semestral' },
                    { id: 'annual', label: 'Anual' }
                  ].map((cycle) => (
                    <button
                      key={cycle.id}
                      onClick={() => setBillingCycle(cycle.id as any)}
                      className={`px-5 py-0 text-xs font-bold uppercase tracking-wider transition-all duration-300 flex items-center justify-center ${
                        billingCycle === cycle.id
                          ? 'bg-red-600 text-white shadow-sm'
                          : 'text-zinc-800 dark:text-zinc-200 hover:text-black dark:hover:text-white'
                      }`}
                      style={{
                        clipPath: 'polygon(0% 50%, 8px 0%, calc(100% - 8px) 0%, 100% 50%, calc(100% - 8px) 100%, 8px 100%)'
                      }}
                    >
                      {cycle.label}
                    </button>
                  ))}
                </div>
                <span className="h-[1.5px] w-[50px] bg-zinc-400 dark:bg-zinc-600"></span>
              </div>
            </div>

            <div className="mx-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  {
                    nameKey: 'pricing.hosting.basic',
                    basePrice: 680,
                    popular: false,
                    features: [
                      { text: '10 GB ' + t('pricing.hosting.storage'), Icon: HardDrive },
                      { text: '10 ' + t('pricing.hosting.emails'), Icon: Mail },
                      { text: '100 ' + t('pricing.hosting.emailsPerDay'), Icon: Send },
                      { text: t('pricing.hosting.noMailmarketing'), Icon: Megaphone },
                      { text: t('pricing.hosting.addons.single'), Icon: Globe },
                      { text: t('pricing.hosting.subdomains.unlimited'), Icon: GitBranch },
                      { text: t('pricing.hosting.ftp.unlimited'), Icon: FolderOpen },
                      { text: '1 ' + t('pricing.hosting.databases'), Icon: Database },
                      { text: t('pricing.hosting.ssl'), Icon: Lock },
                      { text: t('pricing.hosting.support24h'), Icon: LifeBuoy }
                    ]
                  },
                  {
                    nameKey: 'pricing.hosting.pro',
                    basePrice: 1040,
                    popular: true,
                    features: [
                      { text: '20 GB ' + t('pricing.hosting.storage'), Icon: HardDrive },
                      { text: '20 ' + t('pricing.hosting.emails'), Icon: Mail },
                      { text: '200 ' + t('pricing.hosting.emailsPerDay'), Icon: Send },
                      { text: t('pricing.hosting.mailmarketing.limit').replace('{limit}', '500'), Icon: Megaphone },
                      { text: t('pricing.hosting.addons.limit').replace('{limit}', '5'), Icon: Globe },
                      { text: t('pricing.hosting.subdomains.unlimited'), Icon: GitBranch },
                      { text: t('pricing.hosting.ftp.unlimited'), Icon: FolderOpen },
                      { text: '10 ' + t('pricing.hosting.databases'), Icon: Database },
                      { text: t('pricing.hosting.ssl'), Icon: Lock },
                      { text: t('pricing.hosting.support24h'), Icon: LifeBuoy }
                    ]
                  },
                  {
                    nameKey: 'pricing.hosting.business',
                    basePrice: 1360,
                    popular: false,
                    features: [
                      { text: '30 GB ' + t('pricing.hosting.storage'), Icon: HardDrive },
                      { text: t('pricing.hosting.emails.unlimited'), Icon: Mail },
                      { text: '300 ' + t('pricing.hosting.emailsPerDay'), Icon: Send },
                      { text: t('pricing.hosting.mailmarketing.limit').replace('{limit}', '1.000'), Icon: Megaphone },
                      { text: t('pricing.hosting.addons.unlimited'), Icon: Globe },
                      { text: t('pricing.hosting.subdomains.unlimited'), Icon: GitBranch },
                      { text: t('pricing.hosting.ftp.unlimited'), Icon: FolderOpen },
                      { text: t('pricing.hosting.databases.unlimited'), Icon: Database },
                      { text: t('pricing.hosting.ssl'), Icon: Lock },
                      { text: t('pricing.hosting.support24h'), Icon: LifeBuoy }
                    ]
                  },
                  {
                    nameKey: 'pricing.hosting.enterprise',
                    basePrice: 2040,
                    popular: false,
                    features: [
                      { text: '40 GB ' + t('pricing.hosting.storage'), Icon: HardDrive },
                      { text: t('pricing.hosting.emails.unlimited'), Icon: Mail },
                      { text: '300 ' + t('pricing.hosting.emailsPerDay'), Icon: Send },
                      { text: t('pricing.hosting.mailmarketing.unlimited'), Icon: Megaphone },
                      { text: t('pricing.hosting.addons.unlimited'), Icon: Globe },
                      { text: t('pricing.hosting.subdomains.unlimited'), Icon: GitBranch },
                      { text: t('pricing.hosting.ftp.unlimited'), Icon: FolderOpen },
                      { text: t('pricing.hosting.databases.unlimited'), Icon: Database },
                      { text: t('pricing.hosting.ssl'), Icon: Lock },
                      { text: t('pricing.hosting.support24h'), Icon: LifeBuoy }
                    ]
                  }
                ].map((plan) => {
                  const { price: planPrice, savingsText } = getPlanPrice(plan.basePrice);
                  return (
                    <div
                      key={plan.nameKey}
                      className={`bg-zinc-50/80 dark:bg-zinc-900/40 rounded-lg hover:shadow-lg transition-all duration-300 relative flex flex-col justify-between border ${
                        plan.popular
                          ? 'border-red-500 dark:border-red-500 shadow-md ring-2 ring-red-500/20'
                          : 'border-zinc-200/80 dark:border-white/5 hover:border-red-500/40 dark:hover:border-red-500/40'
                      }`}
                    >
                      {plan.popular && (
                        <div className="absolute top-0 right-1/2 translate-x-1/2 -translate-y-1/2 flex items-center gap-2.5 z-20">
                          <span className="h-[1.5px] w-[30px] bg-red-600"></span>
                          <span
                            className="bg-red-600 text-white text-[10px] sm:text-xs uppercase font-extrabold px-4 py-1.5 shadow-sm tracking-wider"
                            style={{
                              clipPath: 'polygon(0% 50%, 10px 0%, calc(100% - 10px) 0%, 100% 50%, calc(100% - 10px) 100%, 10px 100%)'
                            }}
                          >
                            {t('pricing.hosting.recommended')}
                          </span>
                          <span className="h-[1.5px] w-[30px] bg-red-600"></span>
                        </div>
                      )}
                      <div className={`p-5 text-center rounded-t-lg relative ${
                        plan.popular
                          ? 'bg-zinc-950 dark:bg-black text-white'
                          : 'bg-zinc-200 dark:bg-zinc-800 text-black dark:text-white'
                      }`}>
                        <h4 className={`text-lg sm:text-xl font-extrabold uppercase tracking-wide mb-0.5 ${
                          plan.popular ? 'text-white' : 'text-black dark:text-white'
                        }`}>
                          {t(plan.nameKey)}
                        </h4>
                        <div className="flex flex-col items-center justify-center mt-1">
                          <span className={`text-2xl sm:text-3xl font-black ${plan.popular ? 'text-red-500' : 'text-red-600 dark:text-red-500'}`}>
                            {planPrice} MT
                          </span>
                          {savingsText && (
                            <span className="bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-[8px] sm:text-[9px] font-extrabold px-1.5 py-0.5 rounded-sm whitespace-nowrap mt-1">
                              {savingsText}
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Divider line that doesn't touch the edges (5px thickness, placed OUTSIDE header) */}
                      <div className="px-6 w-full mt-0">
                        <div className={`h-[5px] w-full ${
                          plan.popular ? 'bg-red-600' : 'bg-zinc-300 dark:bg-zinc-700'
                        }`} />
                      </div>
                      <div className="p-6 flex-1 flex flex-col justify-between">
                        <ul className="space-y-2.5 mb-6 text-left">
                          {plan.features.map((feat, fIdx) => {
                            const FeatIcon = feat.Icon;
                            return (
                              <li key={fIdx} className="flex items-center gap-2.5 text-xs sm:text-sm text-black/70 dark:text-zinc-300">
                                <FeatIcon className="w-4 h-4 text-zinc-500 dark:text-zinc-400 shrink-0" />
                                <span className="line-clamp-1">{feat.text}</span>
                              </li>
                            );
                          })}
                        </ul>
                        <button className={`w-full py-2.5 rounded-md font-semibold text-sm transition-all ${
                          plan.popular
                            ? 'bg-zinc-950 dark:bg-black text-white hover:bg-red-600 dark:hover:bg-red-600 shadow-md'
                            : 'bg-zinc-200 dark:bg-zinc-800 hover:bg-red-600 dark:hover:bg-red-600 text-black dark:text-white hover:text-white'
                        }`}>
                          {t('pricing.hosting.hire')}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Newsletter Section */}
      {!hideServices && (
        <div
          className="bg-zinc-200 dark:bg-black py-8 sm:py-10 relative overflow-hidden -mt-[16px] z-20"
          style={{
            '--cl': 'max(24px, calc(50% - 616px))',
            clipPath:
              'polygon(0% 16px, var(--cl) 16px, calc(var(--cl) + 15px) 0%, calc(100% - var(--cl) - 15px) 0%, calc(100% - var(--cl)) 16px, 100% 16px, 100% calc(100% - 16px), calc(100% - var(--cl)) calc(100% - 16px), calc(100% - var(--cl) - 15px) 100%, calc(var(--cl) + 15px) 100%, var(--cl) calc(100% - 16px), 0% calc(100% - 16px))',
          } as React.CSSProperties}
        >
          <div className="container mx-auto max-w-7xl px-4 sm:px-6 relative z-10">
            <div className="mx-5 flex flex-col md:flex-row items-center justify-between gap-6 py-2">
              <div className="text-center md:text-left">
                <h3 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-black dark:text-white mb-1">
                  {t('home.newsletter.title')}
                </h3>
                <p className="text-xs sm:text-sm text-black/60 dark:text-white/70">
                  {t('home.newsletter.subtitle')}
                </p>
              </div>

              <div className="w-full md:w-auto max-w-2xl md:flex-1 flex justify-end">
                {subscribed ? (
                  <div className="bg-green-600/10 dark:bg-green-500/10 border border-green-600/30 dark:border-green-500/30 text-green-600 dark:text-green-500 px-4 py-2.5 rounded-md text-sm font-medium flex items-center justify-center gap-2 w-full max-w-md">
                    <span>✓</span> {t('home.newsletter.success')}
                  </div>
                ) : (
                  <form onSubmit={handleSubscribe} className="flex items-center gap-2 w-full max-w-xl md:max-w-2xl">
                    <input
                      type="email"
                      placeholder={t('home.newsletter.placeholder')}
                      className="px-4 py-3 text-sm rounded-md border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-800 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-red-600 w-full"
                      required
                    />
                    <button
                      type="submit"
                      className="px-5 py-3 text-sm bg-red-600 hover:bg-red-700 text-white rounded-md font-semibold transition-colors whitespace-nowrap shadow-sm"
                    >
                      {t('home.newsletter.button')}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="relative -mt-[16px] z-10">
        <CompactFooter />
      </div>
    </div>
  )
}

export default function Inicio() {
  return <HomePage />
}
