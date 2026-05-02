'use client'

import { useState, useEffect } from 'react'
import { useI18n } from '@/lib/i18n'
import { Globe, User } from 'lucide-react'
import Link from 'next/link'

export function Navbar() {
  const { t, lang, toggleLang } = useI18n()
  const [showTopBar, setShowTopBar] = useState(true)
  const [lastScrollY, setLastScrollY] = useState(0)

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY
      
      // Esconde a barra preta quando scrolla para baixo
      if (currentScrollY > lastScrollY && currentScrollY > 50) {
        setShowTopBar(false)
      } else {
        // Mostra quando scrolla para cima
        setShowTopBar(true)
      }
      
      setLastScrollY(currentScrollY)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [lastScrollY])

  return (
    <>
      {/* Top Menu Bar - Esconde ao scrollar para baixo, mostra ao scrollar para cima */}
      <div 
        className={`fixed left-0 right-0 z-[60] bg-black h-[40px] flex items-center transition-transform duration-300 shadow-lg ${
          showTopBar ? 'translate-y-0 top-0' : '-translate-y-full top-0'
        }`}
      >
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
          <div className="flex justify-end gap-4">
            <button
              onClick={toggleLang}
              className="flex items-center gap-1.5 text-white text-sm hover:text-red-500 transition-colors"
              title={lang === 'pt' ? t('lang.english') : t('lang.portuguese')}
            >
              <Globe className="w-4 h-4" />
              <span className="font-medium">{lang === 'pt' ? 'EN' : 'PT'}</span>
            </button>
            <Link
              href="/auth/login?from=/admin"
              className="text-white text-sm hover:text-red-500 transition-colors flex items-center gap-1"
            >
              <User className="w-4 h-4" />
              <span className="hidden sm:inline">Login</span>
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}

