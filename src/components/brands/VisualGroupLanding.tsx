'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { 
  Globe, ShieldCheck, Users, Gauge, ArrowRight,
  Monitor, Palette, Calendar, Film, Truck, Gift,
  CheckCircle2, ChevronDown, Check
} from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import ServicosWebCarousel from '@/components/ServicosWebCarousel'
import { NotchSection } from '@/components/home/NotchSection'
import { BudgetRequestModal } from '@/components/forms/BudgetRequestModal'

export function VisualGroupHero({ onCtaClick }: { onCtaClick: () => void }) {
  return (
    <NotchSection shape="start" bg="bg-black" first>
      <Image
        src="/assets/IMG-VD/Design/design_grafico.jpg"
        alt="VisualDesign Grupo Corporativo"
        fill
        priority
        sizes="100vw"
        className="object-cover object-top opacity-30 dark:opacity-35"
        aria-hidden
      />
      <div className="absolute inset-0 bg-black/30 dark:bg-black/35" />
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 pt-[145px] pb-[50px] sm:pt-[160px] sm:pb-[60px] md:pt-[180px] md:pb-[70px] relative z-10 flex items-center h-[560px] sm:h-[640px] md:h-[760px]">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center w-full">
          <div className="lg:col-span-7 flex flex-col items-start text-left space-y-6 pb-[50px]">
            <h1 className="font-bold leading-[1.15] text-white text-[clamp(1.75rem,3.2vw+1rem,2.75rem)] max-w-2xl">
              Soluções Integradas de Tecnologia, Design e Eventos
            </h1>
            <p className="text-sm sm:text-base text-zinc-300 max-w-xl leading-relaxed">
              Foque no crescimento do seu negócio enquanto nós cuidamos de toda a imagem, presença digital e logística da sua marca. A VisualDesign oferece suporte corporativo completo sob o mesmo teto.
            </p>

            <div className="flex items-start flex-nowrap mr-0 sm:mr-[30px] text-zinc-300 bg-transparent my-6 sm:my-8">
              <div className="flex items-start gap-2.5 pr-4 flex-1 min-w-0">
                <ShieldCheck className="w-5 h-5 text-red-500 shrink-0 mt-0.5" strokeWidth={2} />
                <span className="text-sm sm:text-base font-bold leading-snug">Garantia de Excelência e Rigor</span>
              </div>
              <span className="w-px h-10 bg-white/20 shrink-0" />
              <div className="flex items-start gap-2.5 px-4 flex-1 min-w-0">
                <Users className="w-5 h-5 text-red-500 shrink-0 mt-0.5" strokeWidth={2} />
                <span className="text-sm sm:text-base font-bold leading-snug">Parceiro de Grandes Marcas</span>
              </div>
              <span className="w-px h-10 bg-white/20 shrink-0" />
              <div className="flex items-start gap-2.5 pl-4 flex-1 min-w-0">
                <Gauge className="w-5 h-5 text-red-500 shrink-0 mt-0.5" strokeWidth={2} />
                <span className="text-sm sm:text-base font-bold leading-snug">Rapidez e Suporte Local</span>
              </div>
            </div>

            <button 
              onClick={onCtaClick}
              className="group/btn bg-red-600 hover:bg-red-700 text-white font-bold px-10 py-3.5 rounded-md transition-all duration-300 transform hover:-translate-y-0.5 inline-flex items-center justify-center gap-2 shadow-lg shadow-red-600/20 cursor-pointer"
            >
              <span>Pedir Orçamento Gratuito</span>
              <ArrowRight className="w-4 h-4 transition-all duration-300 transform translate-x-[-4px] opacity-0 group-hover/btn:translate-x-0 group-hover/btn:opacity-100" />
            </button>
          </div>
          <div className="lg:col-span-5 hidden lg:block" />
        </div>
      </div>
    </NotchSection>
  )
}

export function VisualGroupBody({ onCtaClick }: { onCtaClick: () => void }) {
  const { t } = useI18n()
  const [openWhyUs, setOpenWhyUs] = useState<Record<number, boolean>>({})
  const [subscribed, setSubscribed] = useState(false)

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault()
    setSubscribed(true)
    setTimeout(() => setSubscribed(false), 5000)
  }

  const whyUsItems = [
    { title: 'Um Único Parceiro', desc: 'Não precisa de coordenar múltiplos fornecedores. Gerimos design, web, eventos e brindes de forma integrada.', teaser: 'Centralize todos os serviços de imagem corporativa connosco.' },
    { title: 'Experiência Comprovada', desc: 'Anos de atuação no mercado moçambicano a apoiar marcas em frentes digitais e físicas.', teaser: 'Portefólio sólido com clientes de referência em diversos setores.' },
    { title: 'Suporte e Equipa Local', desc: 'Atendimento personalizado com equipa especializada sempre pronta a intervir.', teaser: 'Respostas rápidas e equipas no terreno sempre que necessário.' },
    { title: 'Controlo de Qualidade', desc: 'Da maquete 3D à aplicação final, supervisionamos cada processo para garantir perfeição.', teaser: 'Garantia de fidelidade de cor e rigor técnico em todas as marcas.' },
  ]

  const brands = [
    { Icon: Monitor, name: 'VisualWeb', desc: 'Sites corporativos, e-commerce, alojamento, domínios e marketing digital.', href: '/visualweb' },
    { Icon: Palette, name: 'VisualDesign', desc: 'Identidade de marca, design de logotipos, materiais gráficos e envelopamento.', href: '/visualdesign' },
    { Icon: Calendar, name: 'VisualEventos', desc: 'Stands para exposições, catering completo, aluguer e organização.', href: '/visualeventos' },
    { Icon: Film, name: 'VisualPro', desc: 'Vídeo institucional, fotografia profissional e cobertura multimedia.', href: '/visualpro' },
    { Icon: Truck, name: 'VisualTransporte', desc: 'Serviços de mobilidade, transferes executivos e logística integrada.', href: '/visualtransporte' },
    { Icon: Gift, name: 'VisualGifts', desc: 'Merchandising promocional, fardamento técnico e welcome kits corporativos.', href: '/visualgifts' },
  ]

  return (
    <>
      {/* Brands List Section */}
      <div className="-mt-[16px] relative z-20">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 pt-[70px] pb-[70px]">
          <div className="text-center mb-10 sm:mb-12 flex flex-col items-center max-w-4xl mx-auto px-4">
            <span className="text-xs sm:text-sm font-bold uppercase tracking-wider flex items-center gap-1.5 text-red-600 dark:text-red-500 mb-2">
              <span className="text-red-600 dark:text-red-500 font-normal inline-block transform scale-x-[2.5] mx-2.5">—</span>
              As Nossas Marcas
              <span className="text-red-600 dark:text-red-500 font-normal inline-block transform scale-x-[2.5] mx-2.5">—</span>
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-black dark:text-white mb-4">
              Soluções Especializadas por Segmento
            </h2>
            <p className="text-sm text-black/60 dark:text-zinc-400 max-w-xl mx-auto">
              Cada uma das nossas divisões é especializada para oferecer o melhor resultado com o máximo rigor técnico.
            </p>
          </div>

          <div className="mt-8 sm:mt-10 mx-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {brands.map(({ Icon, name, desc, href }) => {
                return (
                  <Link
                    key={name}
                    href={href}
                    className="group flex gap-4 p-5 rounded-lg border transition-all duration-300 bg-white dark:bg-black/45 border-zinc-200/80 dark:border-white/10 hover:bg-red-50/50 dark:hover:bg-zinc-900/40 hover:border-red-400/40 dark:hover:border-red-500/40 shadow-sm"
                  >
                    <div className="shrink-0 w-12 h-12 rounded-lg border flex items-center justify-center transition-all duration-300 border-red-600/30 dark:border-red-500/30 bg-red-600/5 dark:bg-red-500/5 group-hover:bg-red-600 group-hover:border-red-600">
                      <Icon className="w-6 h-6 transition-colors duration-300 text-red-600 dark:text-red-500 group-hover:text-white" strokeWidth={2} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-extrabold text-black dark:text-white text-lg mb-1 inline-flex items-center gap-1.5 transition-colors group-hover:text-red-600 dark:group-hover:text-red-500">
                        <span>{name}</span>
                        <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-all transform group-hover:translate-x-0.5" />
                      </h3>
                      <p className="text-sm text-black/60 dark:text-zinc-400 leading-relaxed mt-1">{desc}</p>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>

        {/* Portfolio Showcase Carousel */}
        <NotchSection shape="end" bg="bg-white dark:bg-zinc-950" first className="pt-16 pb-16 sm:pt-24 sm:pb-24">
          <div className="container mx-auto max-w-7xl px-4 sm:px-6">
            <div className="text-center">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-black dark:text-white mb-8">
                <span className="text-zinc-400 dark:text-zinc-500 font-normal">—</span> Destaques do Grupo <span className="text-zinc-400 dark:text-zinc-500 font-normal">—</span>
              </h2>
              <ServicosWebCarousel />
            </div>
          </div>
        </NotchSection>
      </div>

      {/* Why Us Accordion */}
      <NotchSection shape="mid" bg="bg-zinc-200 dark:bg-black" className="pt-16 pb-16 sm:pt-24 sm:pb-24">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            <div className="lg:col-span-5 text-left flex flex-col justify-center">
              <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-red-600 dark:text-red-500 mb-2">
                Diferencial
              </span>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-black dark:text-white leading-tight mb-4">
                Porque escolher o Grupo VisualDesign?
              </h2>
              <p className="text-sm text-black/60 dark:text-zinc-400 leading-relaxed mb-6">
                Oferecemos coordenação e supervisão integrada em todas as etapas, garantindo consistência visual, prazos rigorosos e soluções personalizadas.
              </p>
            </div>
            
            <div className="lg:col-span-7 space-y-4">
              {whyUsItems.map((item, idx) => {
                const isOpen = !!openWhyUs[idx]
                return (
                  <div 
                    key={idx} 
                    className="border border-zinc-300 dark:border-white/10 rounded-lg overflow-hidden bg-white/50 dark:bg-zinc-900/30 transition-colors"
                  >
                    <button
                      onClick={() => setOpenWhyUs(prev => ({ ...prev, [idx]: !prev[idx] }))}
                      className="w-full flex items-center justify-between p-5 text-left font-bold text-black dark:text-white hover:text-red-600 dark:hover:text-red-500 transition-colors"
                    >
                      <span className="text-base sm:text-lg">{item.title}</span>
                      <ChevronDown className={`w-5 h-5 transition-transform duration-300 shrink-0 ${isOpen ? 'rotate-180 text-red-600' : 'text-zinc-400'}`} />
                    </button>
                    <div className={`transition-all duration-300 overflow-hidden ${isOpen ? 'max-h-60' : 'max-h-0'}`}>
                      <div className="p-5 pt-0 border-t border-zinc-200 dark:border-white/5 text-sm text-black/75 dark:text-zinc-400 leading-relaxed space-y-2">
                        <p className="font-semibold text-zinc-800 dark:text-zinc-300">{item.teaser}</p>
                        <p>{item.desc}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </NotchSection>

      {/* CTA Final */}
      <NotchSection shape="mid-alt" bg="bg-white dark:bg-zinc-950" className="py-16 sm:py-20">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 relative z-10">
          <div className="text-center flex flex-col items-center max-w-2xl mx-auto gap-4">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-black dark:text-white">
              Pronto para impulsionar a sua empresa?
            </h2>
            <p className="text-sm sm:text-base text-black/60 dark:text-zinc-400 max-w-lg">
              Fale com um dos nossos consultores e descubra como as nossas soluções integradas podem poupar custos e gerar mais valor.
            </p>
            <button 
              onClick={onCtaClick}
              className="bg-red-600 hover:bg-red-700 text-white font-bold px-10 py-3.5 rounded-md shadow-lg transition-all transform hover:-translate-y-0.5 cursor-pointer text-sm"
            >
              Solicitar Orçamento Geral
            </button>
          </div>
        </div>
      </NotchSection>

      {/* Newsletter */}
      <NotchSection shape="mid" bg="bg-zinc-200 dark:bg-black" className="py-8 sm:py-10">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 relative z-10">
          <div className="mx-5 flex flex-col md:flex-row items-center justify-between gap-6 py-2">
            <div className="text-center md:text-left">
              <h3 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-black dark:text-white mb-1">
                Subscreva a nossa newsletter
              </h3>
              <p className="text-xs sm:text-sm text-black/60 dark:text-white/70">Receba notícias, novidades e ofertas diretamente no seu email.</p>
            </div>
            <div className="w-full md:w-auto max-w-2xl md:flex-1 flex justify-end">
              {subscribed ? (
                <div className="bg-green-600/10 dark:bg-green-500/10 border border-green-600/30 dark:border-green-500/30 text-green-600 dark:text-green-500 px-4 py-2.5 rounded-md text-sm font-medium flex items-center justify-center gap-2 w-full max-w-md">
                  <span>✓</span> Subscrição efetuada com sucesso!
                </div>
              ) : (
                <form onSubmit={handleSubscribe} className="flex items-center gap-[15px] w-full max-w-xl md:max-w-2xl">
                  <input
                    type="email"
                    placeholder="O seu endereço de email"
                    className="px-4 py-3.5 text-sm rounded-md border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-800 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-red-600 w-full"
                    required
                  />
                  <button type="submit" className="px-5 py-3.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded-md font-semibold transition-colors whitespace-nowrap shadow-sm">
                    Subscrever
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </NotchSection>
    </>
  )
}

export default function VisualGroupLanding() {
  const [isModalOpen, setIsModalOpen] = useState(false)

  return (
    <>
      <VisualGroupHero onCtaClick={() => setIsModalOpen(true)} />
      <VisualGroupBody onCtaClick={() => setIsModalOpen(true)} />
      <BudgetRequestModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialService="design-grafico"
      />
    </>
  )
}
