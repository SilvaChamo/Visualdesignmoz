'use client'

import { useState } from 'react'
import { useI18n } from '@/lib/i18n'
import Link from 'next/link'
import { ArrowLeft, HardDrive, Mail, Send, Megaphone, Globe, GitBranch, FolderOpen, Database, Lock, LifeBuoy } from 'lucide-react'

export default function PrecosHospedagem() {
  const { t } = useI18n()
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
    
    if (billingCycle === 'semiannual') {
      const monthlyDiscounted = Math.round(basePrice * 0.9)
      mainPrice = monthlyDiscounted * 6
      cycleSuffix = '/6 meses'
      monthlyEquivalent = monthlyDiscounted
      savings = basePrice - monthlyDiscounted
      savingsText = `Poupe ${formatPrice(savings)} MT/mês!`
    } else if (billingCycle === 'annual') {
      const monthlyDiscounted = Math.round(basePrice * 0.8)
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
              {t('pricing.hosting.title')}
            </h1>
            <p className="text-base text-white font-normal">
              {t('pricing.hosting.subtitle')}
            </p>
          </div>
        </div>
      </div>

      {/* Pricing Section */}
      <div className="bg-white py-16">
        <div className="container mx-auto max-w-7xl px-6">
          <div className="flex items-center justify-center mb-10 gap-3">
            <span className="h-[1.5px] w-[50px] bg-zinc-300 dark:bg-zinc-700"></span>
            <div
              className="bg-zinc-200 dark:bg-zinc-800 p-1 flex items-center gap-1.5 border border-zinc-300 dark:border-zinc-700"
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
                  className={`px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
                    billingCycle === cycle.id
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'text-black/60 dark:text-zinc-400 hover:text-black dark:hover:text-white'
                  }`}
                  style={{
                    clipPath: 'polygon(0% 50%, 8px 0%, calc(100% - 8px) 0%, 100% 50%, calc(100% - 8px) 100%, 8px 100%)'
                  }}
                >
                  {cycle.label}
                </button>
              ))}
            </div>
            <span className="h-[1.5px] w-[50px] bg-zinc-300 dark:bg-zinc-700"></span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                  { text: t('pricing.hosting.emails.unlimited'), Icon: Mail },
                  { text: '200 ' + t('pricing.hosting.emailsPerDay'), Icon: Send },
                  { text: t('pricing.hosting.mailmarketing.limit').replace('{limit}', '500'), Icon: Megaphone },
                  { text: t('pricing.hosting.addons.limit').replace('{limit}', '10'), Icon: Globe },
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
                  className={`bg-zinc-50/80 dark:bg-zinc-900/40 rounded-lg shadow-lg hover:shadow-xl transition-shadow relative flex flex-col justify-between border border-zinc-150 dark:border-white/5 ${
                    plan.popular ? 'border-2 border-red-500 shadow-red-500/10' : ''
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
                    <h4 className={`text-xl font-extrabold uppercase tracking-wide mb-0.5 ${
                      plan.popular ? 'text-white' : 'text-black dark:text-white'
                    }`}>{t(plan.nameKey)}</h4>
                    <div className="flex flex-col items-center justify-center mt-1">
                      <span className={`text-3xl font-black ${plan.popular ? 'text-red-500' : 'text-red-600 dark:text-red-500'}`}>
                        {planPrice} MT
                      </span>
                      {savingsText && (
                        <span className="bg-red-600/10 text-red-600 dark:text-red-400 text-[8px] sm:text-[9px] font-bold px-1.5 py-0.5 rounded-sm whitespace-nowrap mt-1">
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
                          <li key={fIdx} className="flex items-center gap-2.5 text-sm text-black/70 dark:text-zinc-350">
                            <FeatIcon className="w-4.5 h-4.5 text-zinc-500 dark:text-zinc-400 shrink-0" />
                            <span className="line-clamp-1">{feat.text}</span>
                          </li>
                        );
                      })}
                    </ul>
                    <button className={`w-full py-3 rounded-lg font-medium transition-colors ${
                      plan.popular
                        ? 'bg-zinc-950 dark:bg-black text-white hover:bg-red-600 dark:hover:bg-red-600'
                        : 'bg-zinc-200 dark:bg-zinc-800 hover:bg-red-600 dark:hover:bg-red-600 text-black dark:text-white hover:text-white'
                    }`}>
                      {t('pricing.hosting.hire')}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-bold text-black mb-3">{t('pricing.hosting.techFeatures')}</h3>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>{t('pricing.hosting.servers')}</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>PHP 7.4, 8.0, 8.1, 8.2, 8.3</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>MySQL, PostgreSQL, Redis</span>
                </li>
              </ul>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-bold text-black mb-3">{t('pricing.hosting.security')}</h3>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>{t('pricing.hosting.firewall')}</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>{t('pricing.hosting.ddos')}</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>{t('pricing.hosting.ssl')}</span>
                </li>
              </ul>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-bold text-black mb-3">{t('pricing.hosting.support')}</h3>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>{t('pricing.hosting.chat')}</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>{t('pricing.hosting.emailSupport')}</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>{t('pricing.hosting.phoneSupport')}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
