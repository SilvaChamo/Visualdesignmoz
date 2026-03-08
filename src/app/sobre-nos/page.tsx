'use client'

import { useI18n } from '@/lib/i18n'

export default function AboutPage() {
  const { t } = useI18n()

  return (
    <div className="min-h-screen bg-black">
      {/* Breadcrumb */}
      <nav className="bg-black/50 border-b border-gray-800">
        <div className="max-w-[1380px] mx-auto px-4">
          <ol className="flex items-center space-x-2 py-4 text-sm">
            <li>
              <a href="/" className="text-gray-400 hover:text-white transition-colors">
                {t('nav.home')}
              </a>
            </li>
            <li className="text-gray-600">/</li>
            <li className="text-white font-medium">{t('about.breadcrumb')}</li>
          </ol>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative py-20 lg:py-32">
        <div className="absolute inset-0 bg-black" />
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20"
          style={{ backgroundImage: "url('/assets/BG.jpg')" }}
        />

        <div className="relative z-10 max-w-[1380px] mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
              {t('about.title')} <span className="text-red-600">{t('about.titleHighlight')}</span>
            </h1>
            <p className="text-xl text-gray-300 mb-8">
              {t('about.subtitle')}
            </p>
          </div>
        </div>
      </section>

      {/* About Content */}
      <section className="py-20">
        <div className="max-w-[1380px] mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl font-bold text-white mb-6">
                {t('about.historyTitle')} <span className="text-red-600">{t('about.historyHighlight')}</span>
              </h2>
              <p className="text-gray-300 mb-6">
                {t('about.historyP1')}
              </p>
              <p className="text-gray-300 mb-6">
                {t('about.historyP2')}
              </p>
              <p className="text-gray-300">
                {t('about.historyP3')}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-8">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 text-center">
                <div className="text-4xl font-bold text-red-600 mb-2">50+</div>
                <div className="text-gray-300">{t('about.stat.projects')}</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 text-center">
                <div className="text-4xl font-bold text-red-600 mb-2">30+</div>
                <div className="text-gray-300">{t('about.stat.clients')}</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 text-center">
                <div className="text-4xl font-bold text-red-600 mb-2">4+</div>
                <div className="text-gray-300">{t('about.stat.years')}</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 text-center">
                <div className="text-4xl font-bold text-red-600 mb-2">100%</div>
                <div className="text-gray-300">{t('about.stat.dedication')}</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
