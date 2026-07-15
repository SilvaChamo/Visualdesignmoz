'use client'

import { useI18n } from '@/lib/i18n'
import Link from 'next/link'
import { ArrowLeft, HardDrive, Mail, Send, Megaphone, Globe, GitBranch, FolderOpen, Database, Lock, LifeBuoy } from 'lucide-react'

export default function PrecosHospedagem() {
  const { t } = useI18n()

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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                nameKey: 'pricing.hosting.basic',
                price: '680',
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
                price: '1.040',
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
                price: '1.360',
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
                price: '2.040',
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
            ].map((plan) => (
              <div
                key={plan.nameKey}
                className={`bg-white dark:bg-zinc-900/40 rounded-lg shadow-lg hover:shadow-xl transition-shadow relative flex flex-col justify-between border border-zinc-150 dark:border-white/5 ${
                  plan.popular ? 'border-2 border-red-500 shadow-red-500/10' : ''
                }`}
              >
                {plan.popular && (
                  <span className="absolute top-0 right-1/2 translate-x-1/2 -translate-y-1/2 bg-red-600 text-white text-[10px] uppercase font-bold px-3 py-1 rounded-full tracking-wider shadow-sm z-20">
                    {t('pricing.hosting.recommended')}
                  </span>
                )}
                <div className={`p-5 border-b text-center rounded-t-lg ${
                  plan.popular
                    ? 'bg-zinc-950 dark:bg-black border-b-black text-white'
                    : 'bg-zinc-50 dark:bg-white/[0.02] border-zinc-150 dark:border-white/5 text-black dark:text-white'
                }`}>
                  <h4 className="text-xl font-extrabold uppercase tracking-wide mb-1">{t(plan.nameKey)}</h4>
                  <div className="flex flex-col items-center justify-center mt-2.5">
                    <span className={`text-3xl font-black ${plan.popular ? 'text-red-500' : 'text-red-600 dark:text-red-500'}`}>
                      {plan.price} MT
                    </span>
                    <span className={`text-[10px] sm:text-xs uppercase tracking-wider font-bold mt-1 ${
                      plan.popular ? 'text-zinc-400' : 'text-black/45 dark:text-zinc-500'
                    }`}>
                      {t('pricing.hosting.month')}
                    </span>
                  </div>
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
                  <button className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-medium transition-colors">
                    {t('pricing.hosting.hire')}
                  </button>
                </div>
              </div>
            ))}
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
