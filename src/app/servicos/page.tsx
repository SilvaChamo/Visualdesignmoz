'use client'
import { useI18n } from "@/lib/i18n"

export default function ServicesPage() {
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
            <li className="text-white font-medium">{t('nav.services')}</li>
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
              {t('services.page.title')} <span className="text-red-600">{t('services.page.titleHighlight')}</span>
            </h1>
            <p className="text-xl text-gray-300 mb-8">
              {t('services.page.subtitle')}
            </p>
          </div>
        </div>
      </section>

      {/* Services Grid */}
      <section className="py-20">
        <div className="max-w-[1380px] mx-auto px-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 hover:transform hover:scale-105 transition-transform">
              <div className="w-16 h-16 bg-red-600 rounded-lg flex items-center justify-center mb-6">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-4">{t('services.web')}</h3>
              <p className="text-gray-300">
                {t('services.web.card.desc')}
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 hover:transform hover:scale-105 transition-transform">
              <div className="w-16 h-16 bg-red-600 rounded-lg flex items-center justify-center mb-6">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-4">{t('services.graphic')}</h3>
              <p className="text-gray-300">
                {t('services.graphic.card.desc')}
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 hover:transform hover:scale-105 transition-transform">
              <div className="w-16 h-16 bg-red-600 rounded-lg flex items-center justify-center mb-6">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a4 4 0 00-3.564 6.683z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-4">{t('services.marketing')}</h3>
              <p className="text-gray-300">
                {t('services.marketing.card.desc')}
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 hover:transform hover:scale-105 transition-transform">
              <div className="w-16 h-16 bg-red-600 rounded-lg flex items-center justify-center mb-6">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-4">{t('services.dev')}</h3>
              <p className="text-gray-300">
                {t('services.dev.card.desc')}
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
