'use client'

import { useState, useEffect } from 'react'

import { ArrowRight, Play, CheckCircle, Phone, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n'

const slides = [
  {
    id: 1,
    titleKey: 'banner.title.1',
    descKey: 'banner.desc.1',
    badgeKey: 'banner.badge.1',
    icon: "🎨"
  },
  {
    id: 2,
    titleKey: 'banner.title.2',
    descKey: 'banner.desc.2',
    badgeKey: 'banner.badge.2',
    icon: "💡"
  },
  {
    id: 3,
    titleKey: 'banner.title.3',
    descKey: 'banner.desc.3',
    badgeKey: 'banner.badge.3',
    icon: "📈"
  }
]

export function BannerSlider() {
  const { t } = useI18n()
  const [currentSlide, setCurrentSlide] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length)
    }, 10000)

    return () => clearInterval(timer)
  }, [])

  const goToSlide = (index: number) => {
    setCurrentSlide(index)
  }

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length)
  }

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length)
  }

  return (
    <section className="relative h-[800px] overflow-hidden">
      {/* Background cinza 95% */}
      <div className="absolute inset-0 bg-[#f2f2f2]" />

        <div
          key={currentSlide}
          className="relative z-10 h-full flex items-center justify-center"
        >
          <div className="container mx-auto px-4 h-full flex items-center justify-center">
            <div className="max-w-6xl w-full">
              <div className="grid lg:grid-cols-2 gap-12 items-center w-full lg:grid-cols-[1.3fr_1fr]">
                {/* Left Column - Text Content */}
                <div
                  className="text-center lg:text-left"
                >
                    {/* Badge */}
                    <div
                      className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-full text-sm font-medium mb-6"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      {t(slides[currentSlide].badgeKey)}
                    </div>

                    {/* Main Title */}
                    <h1
                      className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 leading-tight mb-6 text-left"
                    >
                      {t(slides[currentSlide].titleKey).split('\n').map((line, index) => (
                        <span key={index}>
                          {line}
                          {index < t(slides[currentSlide].titleKey).split('\n').length - 1 && <br />}
                        </span>
                      ))}
                    </h1>

                    {/* Description */}
                    <p
                      className="text-xl text-gray-700 mb-8 text-left"
                    >
                      {t(slides[currentSlide].descKey)}
                    </p>

                    {/* CTA Buttons */}
                    <div
                      className="flex flex-col sm:flex-row gap-4 mb-12 lg:justify-start justify-center"
                    >
                      <Button size="lg" className="group" asChild>
                        <Link href="/contacto">
                          {t('cta.quote')}
                          <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </Link>
                      </Button>
                      <Button variant="outline" size="lg" className="group border-white text-white hover:bg-white hover:text-black">
                        <Play className="mr-2 w-4 h-4" />
                        {t('banner.button.portfolio')}
                      </Button>
                    </div>

                    {/* Contact Info */}
                    <div
                      className="flex flex-col sm:flex-row gap-4 lg:justify-start justify-center text-gray-600"
                    >
                      <a href="tel:+258821234567" className="flex items-center space-x-2 hover:text-gray-900 transition-colors">
                        <Phone className="w-4 h-4" />
                        <span>+258 821 234 567</span>
                      </a>
                      <a href="mailto:info@visualdesign.co.mz" className="flex items-center space-x-2 hover:text-gray-900 transition-colors">
                        <Mail className="w-4 h-4" />
                        <span>info@visualdesign.co.mz</span>
                      </a>
                    </div>
                  </div>

                  {/* Right Column - Visual Element */}
                  <div
                    className="relative hidden lg:block flex items-center justify-center h-full"
                  >
                    {/* Card */}
                    <div className="relative rounded-2xl overflow-hidden shadow-2xl bg-white p-8">
                      <div className="text-8xl mb-6 text-center">
                        {slides[currentSlide].icon}
                      </div>
                      <div className="text-gray-900 text-center">
                        <h3 className="text-2xl font-bold mb-3">
                          {currentSlide === 0 && t('banner.card.title.1')}
                          {currentSlide === 1 && t('banner.card.title.2')}
                          {currentSlide === 2 && t('banner.card.title.3')}
                        </h3>
                        <p className="text-base opacity-80">
                          {currentSlide === 0 && t('banner.card.sub.1')}
                          {currentSlide === 1 && t('banner.card.sub.2')}
                          {currentSlide === 2 && t('banner.card.sub.3')}
                        </p>
                      </div>
                    </div>

                    {/* Floating Elements */}
                    <div
                      className="absolute -top-4 -right-4 w-16 h-16 bg-red-600/30 rounded-full"
                    />
                    <div
                      className="absolute -bottom-4 -left-4 w-12 h-12 bg-red-600/30 rounded-full"
                    />
                  </div>
              </div>
            </div>
          </div>

          {/* Bolas Saltitando */}
          <div
            className="absolute top-20 right-10 w-20 h-20 bg-red-600/30 rounded-full"
          />
          <div
            className="absolute bottom-20 right-32 w-16 h-16 bg-red-600/30 rounded-full"
          />
          <div
            className="absolute top-1/2 -left-8 w-12 h-12 bg-red-600/30 rounded-full"
          />
          <div
            className="absolute top-32 left-20 w-8 h-8 bg-red-600/40 rounded-full"
          />
          <div
            className="absolute bottom-32 left-40 w-6 h-6 bg-red-600/35 rounded-full"
          />
        </div>

      {/* Slide Controls */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-20">
        <div className="flex items-center space-x-4">
          {/* Previous Button */}
          <button
            onClick={prevSlide}
            className="w-10 h-10 rounded-full flex items-center justify-center text-gray-600 hover:text-red-500 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Slide Indicators */}
          <div className="flex space-x-3">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={`h-3 rounded-full transition-all duration-300 relative overflow-hidden`}
                style={{
                  width: currentSlide === index ? '32px' : '12px',
                  backgroundColor: currentSlide === index ? '#FF0000' : 'rgba(0, 0, 0, 0.3)'
                }}
              >
                <div
                  className="absolute inset-0 bg-red-500"
                />
              </button>
            ))}
          </div>

          {/* Next Button */}
          <button
            onClick={nextSlide}
            className="w-10 h-10 rounded-full flex items-center justify-center text-gray-600 hover:text-red-500 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  )
}
