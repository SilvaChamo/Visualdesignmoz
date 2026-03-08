'use client'

import { useI18n } from '@/lib/i18n'

export default function CoursesPage() {
  const { t } = useI18n()

  const courses = [
    { key: 'webdesign', color: 'from-red-600 to-red-800', price: 'MZN 5.000', weeks: 8 },
    { key: 'webdev', color: 'from-blue-600 to-blue-800', price: 'MZN 7.500', weeks: 12 },
    { key: 'marketing', color: 'from-green-600 to-green-800', price: 'MZN 4.000', weeks: 6 },
    { key: 'uiux', color: 'from-purple-600 to-purple-800', price: 'MZN 6.000', weeks: 10 },
    { key: 'graphic', color: 'from-yellow-600 to-yellow-800', price: 'MZN 4.500', weeks: 8 },
    { key: 'ecommerce', color: 'from-pink-600 to-pink-800', price: 'MZN 8.000', weeks: 16 },
  ]

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
            <li className="text-white font-medium">{t('courses.breadcrumb')}</li>
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
              {t('courses.title')} <span className="text-red-600">{t('courses.titleHighlight')}</span>
            </h1>
            <p className="text-xl text-gray-300 mb-8">
              {t('courses.subtitle')}
            </p>
          </div>
        </div>
      </section>

      {/* Courses Grid */}
      <section className="py-20">
        <div className="max-w-[1380px] mx-auto px-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {courses.map((course) => (
              <div key={course.key} className="bg-white/10 backdrop-blur-sm rounded-2xl overflow-hidden hover:transform hover:scale-105 transition-transform">
                <div className={`h-48 bg-gradient-to-br ${course.color}`}></div>
                <div className="p-6">
                  <h3 className="text-xl font-bold text-white mb-2">{t(`courses.${course.key}`)}</h3>
                  <p className="text-gray-300 mb-4">
                    {t(`courses.${course.key}.desc`)}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-red-400 font-bold">{course.price}</span>
                    <span className="text-gray-400 text-sm">{course.weeks} {t('courses.weeks')}</span>
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
