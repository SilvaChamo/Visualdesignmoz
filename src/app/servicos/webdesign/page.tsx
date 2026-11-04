'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ShieldCheck, Users, Gauge, Building2, Database, Smartphone, ShoppingCart, Code2, PenTool, MonitorSmartphone, Settings, TrendingUp, Share2 } from 'lucide-react';
import { useI18n } from '@/lib/i18n'
import { NotchSection } from '@/components/home/NotchSection'
import PortfolioShowcase from '@/components/PortfolioShowcase'

function ExitArrow({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  )
}

function SectionPretitle({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs sm:text-sm font-bold uppercase tracking-wider flex items-center gap-1.5 text-red-600 dark:text-red-500 mb-2">
      <span className="text-red-600 dark:text-red-500 font-normal inline-block transform scale-x-[2.5] mx-2.5">—</span>
      {children}
      <span className="text-red-600 dark:text-red-500 font-normal inline-block transform scale-x-[2.5] mx-2.5">—</span>
    </span>
  )
}

function ServiceTile({
  Icon, title, desc, id,
}: { Icon: typeof Building2; title: string; desc: string; id?: string }) {
  return (
    <div
      id={id}
      className="scroll-mt-32 group flex gap-4 p-4 rounded-lg border transition-all duration-300 bg-white dark:bg-black/40 border-zinc-200/80 dark:border-white/10 hover:bg-red-50 dark:hover:bg-black/60 hover:border-red-300 dark:hover:border-red-500/40"
    >
      <div className="shrink-0 w-11 h-11 rounded-lg border flex items-center justify-center transition-all duration-300 border-red-600/40 dark:border-red-500/40 bg-red-600/5 dark:bg-red-500/5 group-hover:bg-red-600 group-hover:border-red-600">
        <Icon className="w-5 h-5 transition-colors duration-300 text-red-600 dark:text-red-500 group-hover:text-white" strokeWidth={2} />
      </div>
      <div>
        <h3 className="font-bold text-black dark:text-white mb-1 relative inline-block transition-colors duration-300">
          {title}
          <span className="block h-[2px] w-8 bg-red-600 dark:bg-red-500 mt-1" />
        </h3>
        <p className="text-sm text-black/60 dark:text-zinc-400 mt-2">{desc}</p>
      </div>
    </div>
  )
}

export default function WebDesignPage() {
  const { t } = useI18n()

  const features = [
    { Icon: Database, title: t('services.web.title'), desc: t('services.web.page.desc') },
    { Icon: Smartphone, title: t('services.web.responsive'), desc: t('services.web.responsive.desc') },
    { Icon: ShoppingCart, title: t('services.web.ecommerce'), desc: t('services.web.ecommerce.desc') },
    { Icon: Code2, title: t('services.web.custom'), desc: t('services.web.custom.desc') },
    { Icon: PenTool, title: t('services.web.uiux'), desc: t('services.web.uiux.desc') },
    { Icon: Gauge, title: t('services.web.performance'), desc: t('services.web.performance.desc') },
  ]

  const services = [
    { Icon: MonitorSmartphone, title: t('carousel.web-design.title'), desc: t('carousel.web-design.desc'), id: 'web-design' },
    { Icon: Settings, title: t('carousel.sistemas.title'), desc: t('carousel.sistemas.desc'), id: 'sistemas' },
    { Icon: TrendingUp, title: t('carousel.seo.title'), desc: t('carousel.seo.desc'), id: 'seo' },
    { Icon: Share2, title: t('carousel.redes-sociais.title'), desc: t('carousel.redes-sociais.desc'), id: 'redes-sociais' },
    { Icon: ShoppingCart, title: t('carousel.loja-online.title'), desc: t('carousel.loja-online.desc'), id: 'loja-online' },
  ]

  const steps = [
    { n: '01', title: t('services.web.step1.title'), desc: t('services.web.step1.desc') },
    { n: '02', title: t('services.web.step2.title'), desc: t('services.web.step2.desc') },
    { n: '03', title: t('services.web.step3.title'), desc: t('services.web.step3.desc') },
  ]

  return (
    <div className="min-h-screen bg-black/10 dark:bg-black">
      {/* Hero */}
      <NotchSection shape="start" bg="bg-black" first>
        <Image
          src="/assets/Web_Home_image.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-top opacity-30 dark:opacity-35"
          aria-hidden
        />
        <div className="absolute inset-0 bg-black/20 dark:bg-black/25" />
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 pt-[145px] pb-[50px] sm:pt-[160px] sm:pb-[60px] md:pt-[180px] md:pb-[70px] relative z-10 flex items-center h-[560px] sm:h-[640px] md:h-[760px]">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center w-full">
            <div className="lg:col-span-6 flex flex-col items-start text-left space-y-6 pb-[50px]">
              <h1 className="font-bold leading-[1.15] text-white text-[clamp(1.75rem,3.2vw+1rem,2.75rem)] max-w-2xl">
                {t('services.web.pageTitle')}
              </h1>
              <p className="text-sm sm:text-base text-zinc-300 max-w-xl leading-relaxed">
                {t('services.web.pageSubtitle')}
              </p>

              <div className="flex flex-col sm:flex-row items-start flex-wrap sm:flex-nowrap gap-4 sm:gap-0 mr-0 sm:mr-[30px] text-zinc-300 bg-transparent">
                <div className="flex items-start gap-2.5 sm:pr-4 flex-1 min-w-0">
                  <ShieldCheck className="w-5 h-5 text-red-500 shrink-0 mt-0.5" strokeWidth={2} />
                  <span className="text-sm sm:text-base font-bold leading-snug">Sites seguros e sempre online</span>
                </div>
                <span className="hidden sm:block w-px h-10 bg-white/20 shrink-0" />
                <div className="flex items-start gap-2.5 sm:px-4 flex-1 min-w-0">
                  <Users className="w-5 h-5 text-red-500 shrink-0 mt-0.5" strokeWidth={2} />
                  <span className="text-sm sm:text-base font-bold leading-snug">Focados na experiência do utilizador</span>
                </div>
                <span className="hidden sm:block w-px h-10 bg-white/20 shrink-0" />
                <div className="flex items-start gap-2.5 sm:pl-4 flex-1 min-w-0">
                  <Gauge className="w-5 h-5 text-red-500 shrink-0 mt-0.5" strokeWidth={2} />
                  <span className="text-sm sm:text-base font-bold leading-snug">Rápidos, responsivos e otimizados</span>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <Link
                  href="/cotacao"
                  className="group/btn bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-2 rounded-md transition-all duration-300 transform hover:-translate-y-0.5 inline-flex items-center justify-center gap-2 shadow-lg shadow-red-600/20 cursor-pointer"
                >
                  <span>Pedir Orçamento</span>
                  <ExitArrow className="w-4 h-4 shrink-0 transition-transform duration-300 group-hover/btn:translate-x-1" />
                </Link>
                <Link
                  href="/portfolio"
                  className="group/btn border-2 border-white/40 hover:border-red-500 text-white hover:text-red-500 font-bold px-6 py-2 rounded-md transition-all duration-300 transform hover:-translate-y-0.5 inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Ver Portfólio</span>
                  <ExitArrow className="w-4 h-4 shrink-0 transition-transform duration-300 group-hover/btn:translate-x-1" />
                </Link>
              </div>
            </div>
            <div className="lg:col-span-6 hidden lg:block">
              <PortfolioShowcase />
            </div>
          </div>
        </div>
      </NotchSection>

      {/* O que incluímos */}
      <NotchSection shape="mid" bg="bg-white dark:bg-zinc-950" className="pt-16 pb-16 sm:pt-24 sm:pb-24">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center mb-10 sm:mb-12 flex flex-col items-center max-w-4xl mx-auto px-4 md:px-[100px]">
            <SectionPretitle>web design</SectionPretitle>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-black dark:text-white mb-4">
              O que incluímos no seu site
            </h2>
            <p className="text-sm text-black/60 dark:text-zinc-400 mx-auto">
              Da conceção ao lançamento, tratamos de cada detalhe técnico e visual do seu projeto.
            </p>
          </div>

          <div className="mt-8 sm:mt-10 mx-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((f) => (
                <ServiceTile key={f.title} Icon={f.Icon} title={f.title} desc={f.desc} />
              ))}
            </div>
          </div>
        </div>
      </NotchSection>

      {/* Os nossos serviços */}
      <NotchSection shape="mid-alt" bg="bg-zinc-200 dark:bg-black" className="pt-16 pb-16 sm:pt-24 sm:pb-24">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center mb-10 sm:mb-12 flex flex-col items-center max-w-4xl mx-auto px-4 md:px-[100px]">
            <SectionPretitle>{t('carousel.section.title')}</SectionPretitle>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-black dark:text-white mb-4">
              Soluções completas para a sua presença online
            </h2>
            <p className="text-sm text-black/60 dark:text-zinc-400 mx-auto">
              Tudo o que a sua marca precisa para crescer na internet, sob o mesmo teto.
            </p>
          </div>

          <div className="mt-8 sm:mt-10 mx-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {services.map((s) => (
                <ServiceTile key={s.id} id={s.id} Icon={s.Icon} title={s.title} desc={s.desc} />
              ))}
            </div>
          </div>
        </div>
      </NotchSection>

      {/* Metodologia */}
      <NotchSection shape="mid" bg="bg-white dark:bg-zinc-950" className="pt-16 pb-16 sm:pt-24 sm:pb-24">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center mb-10 sm:mb-12 flex flex-col items-center max-w-4xl mx-auto px-4 md:px-[100px]">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-black dark:text-white">
              {t('services.web.methodology')}
            </h2>
          </div>

          <div className="mt-8 sm:mt-10 mx-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {steps.map((step) => (
                <div key={step.n} className="relative p-6 rounded-lg border border-zinc-200/80 dark:border-white/10 bg-white dark:bg-black/40">
                  <span className="text-4xl font-black text-red-600/20 dark:text-red-500/20">{step.n}</span>
                  <h3 className="font-bold text-black dark:text-white mt-2 mb-2">{step.title}</h3>
                  <p className="text-sm text-black/60 dark:text-zinc-400">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </NotchSection>

      {/* CTA final */}
      <NotchSection shape="end" bg="bg-zinc-950 dark:bg-black" className="pt-16 pb-16 sm:pt-24 sm:pb-24">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 text-center flex flex-col items-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white mb-3 max-w-2xl">
            Pronto para começar o seu projeto de Web Design?
          </h2>
          <p className="text-sm sm:text-base text-zinc-400 max-w-xl mb-8">
            Peça um orçamento personalizado e a nossa equipa entra em contacto consigo em poucas horas.
          </p>
          <Link
            href="/cotacao"
            className="group/btn bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-2 rounded-md transition-all duration-300 transform hover:-translate-y-0.5 inline-flex items-center justify-center gap-2 shadow-lg shadow-red-600/20 cursor-pointer"
          >
            <span>Pedir Orçamento</span>
            <ExitArrow className="w-4 h-4 shrink-0 transition-transform duration-300 group-hover/btn:translate-x-1" />
          </Link>
        </div>
      </NotchSection>
    </div>
  )
}
