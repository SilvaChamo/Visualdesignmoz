'use client'

import { useState, useEffect } from 'react'
import { Header } from './Header'
import { useI18n } from '@/lib/i18n'
import { Globe } from 'lucide-react'

export function Navbar() {
  const { t, lang, toggleLang } = useI18n()
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 40)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <>
      {/* Top Menu Bar - Aparece apenas sem scroll */}
      {!isScrolled && (
        <div className="fixed top-0 left-0 right-0 z-[60] bg-black h-[40px] flex items-center transition-all duration-300 shadow-lg">
          <div className="container mx-auto max-w-7xl px-6 grid grid-cols-4 items-center h-full">
            <div className="flex justify-start">
              <a href="#faq" className="text-white text-sm hover:text-red-500 transition-colors">{t('nav.help')}</a>
            </div>
            <div className="flex justify-center">
              <a href="#faq" className="text-white text-sm hover:text-red-500 transition-colors">{t('nav.faq')}</a>
            </div>
            <div className="flex justify-center">
              <a href="#faq" className="text-white text-sm hover:text-red-500 transition-colors">{t('nav.questions')}</a>
            </div>
            <div className="flex justify-end">
              <button
                onClick={toggleLang}
                className="flex items-center gap-1.5 text-white text-sm hover:text-red-500 transition-colors"
                title={lang === 'pt' ? t('lang.english') : t('lang.portuguese')}
              >
                <Globe className="w-4 h-4" />
                <span className="font-medium">{lang === 'pt' ? 'EN' : 'PT'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header - Fixo e ocupa espaço do top menu quando scrolled */}
      <Header isScrolled={isScrolled} />
    </>
  )
}

