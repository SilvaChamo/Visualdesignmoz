'use client'

import { useI18n } from '@/lib/i18n'

export default function PortfolioPage() {
  const { t } = useI18n()

  return (
    <div className="min-h-screen bg-black">
      {/* Hero Section */}
      <section className="relative py-20 lg:py-32">
        <div className="absolute inset-0 bg-black" />
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20"
          style={{ backgroundImage: "url('/assets/BG.jpg')" }}
        />

        <div className="relative z-10 container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
              {t('portfolio.title')} <span className="text-red-600">{t('portfolio.titleHighlight')}</span>
            </h1>
            <p className="text-xl text-gray-300 mb-8">
              {t('portfolio.subtitle')}
            </p>
          </div>
        </div>
      </section>

      {/* Projects Grid */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-white/10 backdrop-blur-sm rounded-2xl overflow-hidden hover:transform hover:scale-105 transition-transform">
                <div className="h-48 bg-gradient-to-br from-red-600 to-red-800"></div>
                <div className="p-6">
                  <h3 className="text-xl font-bold text-white mb-2">{t('portfolio.project')} {i}</h3>
                  <p className="text-gray-300 mb-4">{t('portfolio.project.desc')}</p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-3 py-1 bg-red-600/20 text-red-400 rounded-full text-sm">{t('services.web.title')}</span>
                    <span className="px-3 py-1 bg-red-600/20 text-red-400 rounded-full text-sm">Next.js</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
