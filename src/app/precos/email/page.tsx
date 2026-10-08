'use client'

import { useI18n } from '@/lib/i18n'
import Link from 'next/link'
import { useCart } from '@/contexts/CartContext'
import { useCurrency } from '@/contexts/CurrencyContext'
import { useEffect, useState } from 'react'
import { HardDrive, Mail, Globe, Monitor, Smartphone, ShieldCheck, Lock, LifeBuoy } from 'lucide-react'
import {
  EMAIL_CYCLE_LABELS,
  EMAIL_CYCLE_MONTHS,
  EMAIL_PLANS,
  emailPlanProductName,
  getEmailCyclePrice,
  type EmailBillingCycle,
} from '@/lib/email-plans'

const CYCLE_SUFFIX: Record<EmailBillingCycle, string> = {
  monthly: 'por mês',
  semiannual: 'por semestre',
  annual: 'por ano',
}

export default function PrecosEmail() {
  const { t } = useI18n()
  const { addItem, setIsCartOpen } = useCart()
  const { formatPrice } = useCurrency()
  const [billingCycle, setBillingCycle] = useState<EmailBillingCycle>('annual')

  return (
    <div className="min-h-screen bg-white">
      {/* Header Section - Gray 25% */}
      <div className="bg-[#404040] relative overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20"
          style={{ backgroundImage: "url('/assets/BG.jpg')" }}
        />
        <div className="absolute inset-0 bg-black/50" />
        <div className="container mx-auto max-w-7xl px-6 pt-[100px] pb-[60px] flex items-center justify-center min-h-[300px] relative z-10">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-white mb-2">
              {t('pricing.email.title')}
            </h1>
            <p className="text-base text-white font-normal">
              {t('pricing.email.subtitle')}
            </p>
          </div>
        </div>
      </div>

      {/* Características — carrossel (um cartão por slide, loop infinito) */}
      <div className="bg-white pt-12">
        <div className="container mx-auto max-w-7xl px-6">
          <EmailFeaturesCarousel
            cards={[
              {
                title: t('pricing.hosting.techFeatures'),
                items: [t('pricing.email.features.4'), t('pricing.email.features.5'), 'POP3/IMAP/SMTP'],
              },
              {
                title: t('pricing.hosting.security'),
                items: [t('pricing.email.features.3'), 'TLS/SSL', 'Two-Factor Auth (2FA)'],
              },
              {
                title: t('pricing.hosting.support'),
                items: [t('pricing.hosting.chat'), t('pricing.hosting.emailSupport'), t('pricing.hosting.backup')],
              },
              {
                title: 'Gestão no painel',
                items: ['Criar e apagar contas de e-mail', 'Encaminhamento e catch-all', 'DNS e nameservers do domínio'],
              },
            ]}
          />
        </div>
      </div>

      {/* Pricing Section — mesmos cartões e selector de ciclo da home (VisualWebLanding) */}
      <div className="bg-white py-16">
        <div className="container mx-auto max-w-7xl px-6">
          <div className="text-center flex flex-col items-center max-w-4xl mx-auto mb-10 sm:mb-12">
            <span className="text-xs sm:text-sm font-bold uppercase tracking-wider flex items-center gap-1.5 text-red-600 mb-2">
              <span className="text-red-600 font-normal inline-block transform scale-x-[2.5] mx-2.5">—</span>
              Hospedagem de Emails
              <span className="text-red-600 font-normal inline-block transform scale-x-[2.5] mx-2.5">—</span>
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-black mb-3">
              Planos e preços de email
            </h2>
            <p className="text-sm text-black/60 mx-auto">
              O domínio escolhe-se depois de comprar — no seu painel, indica um domínio que já tenha ou compra um connosco.
            </p>

            <div className="flex items-center justify-center mt-12 gap-3">
              <span className="h-[1.5px] w-[50px] bg-zinc-400"></span>
              <div
                className="bg-zinc-200 p-0 flex items-stretch gap-0 h-9"
                style={{ clipPath: 'polygon(0% 50%, 10px 0%, calc(100% - 10px) 0%, 100% 50%, calc(100% - 10px) 100%, 10px 100%)' }}
              >
                {(Object.keys(EMAIL_CYCLE_MONTHS) as EmailBillingCycle[]).map((cycle) => (
                  <button
                    key={cycle}
                    type="button"
                    onClick={() => setBillingCycle(cycle)}
                    className={`px-5 py-0 text-xs font-bold uppercase tracking-wider transition-all duration-300 flex items-center justify-center ${billingCycle === cycle
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'text-zinc-800 hover:text-black'
                      }`}
                    style={{ clipPath: 'polygon(0% 50%, 8px 0%, calc(100% - 8px) 0%, 100% 50%, calc(100% - 8px) 100%, 8px 100%)' }}
                  >
                    {EMAIL_CYCLE_LABELS[cycle]}
                  </button>
                ))}
              </div>
              <span className="h-[1.5px] w-[50px] bg-zinc-400"></span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {EMAIL_PLANS.map((plan) => {
              const price = getEmailCyclePrice(plan, billingCycle)
              const features = [
                { text: `${plan.storageGb} GB ${t('pricing.hosting.storage')}`, Icon: HardDrive },
                {
                  text: plan.accounts === null ? t('pricing.hosting.emails.unlimited') : `${plan.accounts} ${t('pricing.email.features.1')}`,
                  Icon: Mail,
                },
                { text: '1 domínio de email', Icon: Globe },
                { text: t('pricing.email.features.4'), Icon: Monitor },
                { text: 'POP3 / IMAP / SMTP', Icon: Smartphone },
                { text: t('pricing.email.features.3'), Icon: ShieldCheck },
                { text: t('pricing.hosting.ssl'), Icon: Lock },
                { text: t('pricing.hosting.support24h'), Icon: LifeBuoy },
              ]
              return (
                <div
                  key={plan.id}
                  className={`bg-black/[0.02] hover:bg-black/[0.05] rounded-lg hover:shadow-lg transition-all duration-300 relative flex flex-col justify-between border ${plan.popular
                    ? 'border-red-500 shadow-md ring-2 ring-red-500/20'
                    : 'border-zinc-200/80 hover:border-red-500/40'
                    }`}
                >
                  {plan.popular && (
                    <div className="absolute top-0 right-1/2 translate-x-1/2 -translate-y-1/2 flex items-center gap-2.5 z-20">
                      <span className="h-[1.5px] w-[30px] bg-red-600"></span>
                      <span
                        className="bg-red-600 text-white text-[10px] sm:text-xs uppercase font-extrabold px-4 py-1.5 shadow-sm tracking-wider"
                        style={{ clipPath: 'polygon(0% 50%, 10px 0%, calc(100% - 10px) 0%, 100% 50%, calc(100% - 10px) 100%, 10px 100%)' }}
                      >
                        {t('pricing.hosting.recommended')}
                      </span>
                      <span className="h-[1.5px] w-[30px] bg-red-600"></span>
                    </div>
                  )}
                  <div
                    className={`h-[140px] flex flex-col justify-center items-center text-center rounded-t-lg relative px-5 pb-2 ${plan.popular ? 'bg-zinc-950 text-white' : 'bg-zinc-200 text-black'}`}
                    style={{ clipPath: 'polygon(0% 0%, 100% 0%, 100% calc(100% - 6px), calc(100% - 24px) calc(100% - 6px), calc(100% - 30px) 100%, 30px 100%, 24px calc(100% - 6px), 0% calc(100% - 6px))' }}
                  >
                    <h4 className={`text-lg sm:text-xl font-extrabold uppercase tracking-wide mb-0 ${plan.popular ? 'text-white' : 'text-black'}`}>
                      {plan.label}
                    </h4>
                    <span className={`text-2xl sm:text-3xl font-black ${plan.popular ? 'text-red-500' : 'text-red-600'}`}>
                      {formatPrice(price)}
                    </span>
                    <span className={`text-[11px] font-semibold ${plan.popular ? 'text-white/70' : 'text-black/50'}`}>
                      {CYCLE_SUFFIX[billingCycle]}
                    </span>
                  </div>
                  <div className="p-6 flex-1 flex flex-col justify-between">
                    <ul className="space-y-2.5 mb-6 text-left">
                      {features.map((feat) => {
                        const FeatIcon = feat.Icon
                        return (
                          <li key={feat.text} className="flex items-center gap-2.5 text-xs sm:text-sm text-black/70">
                            <FeatIcon className="w-4 h-4 text-zinc-500 shrink-0" />
                            <span className="line-clamp-1">{feat.text}</span>
                          </li>
                        )
                      })}
                    </ul>
                    <button
                      type="button"
                      onClick={() => {
                        addItem({
                          id: plan.id,
                          type: 'email',
                          name: emailPlanProductName(plan),
                          price,
                          period: EMAIL_CYCLE_MONTHS[billingCycle],
                        })
                        setIsCartOpen(true)
                      }}
                      className={`w-full py-2.5 rounded-md font-semibold text-sm transition-all ${plan.popular
                        ? 'bg-red-600 text-white hover:bg-red-700 shadow-md'
                        : 'bg-zinc-200 hover:bg-red-600 text-black hover:text-white'
                        }`}
                    >
                      {t('pricing.hosting.hire')}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

const CAROUSEL_AUTOPLAY_MS = 4000
const CAROUSEL_TRANSITION_MS = 600

type FeatureCard = { title: string; items: string[] }

/** Um cartão por slide, em loop infinito: clones do último no início e do
 * primeiro no fim; ao chegar a um clone salta sem transição para o real. */
function EmailFeaturesCarousel({ cards }: { cards: FeatureCard[] }) {
  const total = cards.length
  const track = [cards[total - 1], ...cards, cards[0]]
  const [index, setIndex] = useState(1)
  const [withTransition, setWithTransition] = useState(true)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (paused) return
    const timer = setInterval(() => {
      setWithTransition(true)
      setIndex((i) => i + 1)
    }, CAROUSEL_AUTOPLAY_MS)
    return () => clearInterval(timer)
  }, [paused])

  const handleTransitionEnd = () => {
    if (index > total) {
      setWithTransition(false)
      setIndex(1)
    } else if (index < 1) {
      setWithTransition(false)
      setIndex(total)
    }
  }

  // Reactiva a transição só depois de o browser pintar o salto (evita piscar).
  useEffect(() => {
    if (withTransition) return
    let raf2 = 0
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setWithTransition(true))
    })
    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
    }
  }, [withTransition])

  const activeDot = ((index - 1) % total + total) % total

  return (
    <div className="max-w-2xl mx-auto" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="overflow-hidden">
        <div
          className="flex"
          style={{
            width: `${track.length * 100}%`,
            transform: `translateX(-${(index * 100) / track.length}%)`,
            transition: withTransition ? `transform ${CAROUSEL_TRANSITION_MS}ms ease` : 'none',
          }}
          onTransitionEnd={handleTransitionEnd}
        >
          {track.map((card, i) => (
            <div key={`${card.title}-${i}`} className="shrink-0 px-1" style={{ width: `${100 / track.length}%` }}>
              <div className="bg-gray-50 rounded-lg p-6 h-full">
                <h3 className="text-lg font-bold text-black mb-3">{card.title}</h3>
                <ul className="space-y-2 text-gray-600">
                  {card.items.map((item) => (
                    <li key={item} className="flex items-start">
                      <span className="text-green-500 mr-2">✓</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex justify-center gap-2 mt-5">
        {cards.map((card, i) => (
          <button
            key={card.title}
            type="button"
            aria-label={`Ir para ${card.title}`}
            onClick={() => {
              setWithTransition(true)
              setIndex(i + 1)
            }}
            className={`h-2 rounded-full transition-all ${activeDot === i ? 'w-6 bg-red-600' : 'w-2 bg-black/20'}`}
          />
        ))}
      </div>
    </div>
  )
}
