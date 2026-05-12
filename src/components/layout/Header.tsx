'use client'
// Force re-render to fix hydration mismatch after logo size change

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X, ChevronDown, User, ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n'
import { useCart } from '@/contexts/CartContext'

const navigation = [
  { name: 'Domínio', href: '/servicos/dominios', dropdown: [
      { name: 'Registo de Domínios', href: '/servicos/dominios' },
      { name: 'Preços de Domínios', href: '/precos/dominios' }
    ]
  },
  { name: 'Hospedagem', href: '/servicos/hospedagem', dropdown: [
      { name: 'Hospedagem Web', href: '/servicos/hospedagem' },
      { name: 'Preços de Hospedagem', href: '/precos/hospedagem' }
    ]
  },
  { name: 'Servidor', href: '/servicos/servidor', dropdown: [
      { name: 'VPS / Cloud', href: '/servicos/servidor' }
    ]
  },
  { name: 'Serviços', href: '/servicos', isMega: true, items: [
      { name: 'Web Design', href: '/servicos/webdesign', desc: 'Criação de sites profissionais.', icon: 'monitor' },
      { name: 'Design Gráfico', href: '/servicos/design-grafico', desc: 'Identidade visual e logótipos.', icon: 'palette' },
      { name: 'Marketing Digital', href: '/servicos/marketing-digital', desc: 'Gestão de redes sociais e tráfego.', icon: 'trending-up' },
      { name: 'Branding', href: '/servicos/branding', desc: 'Construção de marcas fortes.', icon: 'award' },
      { name: 'SEO', href: '/servicos/seo', desc: 'Otimização para motores de busca.', icon: 'search' },
      { name: 'Redes Sociais', href: '/servicos/redes-sociais', desc: 'Gestão de conteúdo e engajamento.', icon: 'users' },
      { name: 'Produção de Vídeo', href: '/servicos/video-producao', desc: 'Vídeos institucionais e comerciais.', icon: 'video' },
      { name: 'Suporte Técnico', href: '/servicos/suporte', desc: 'Apoio e manutenção para o seu site.', icon: 'help-circle' }
    ]
  },
  { name: 'Apoio, suporte', href: '/servicos/suporte', dropdown: [
      { name: 'Suporte Técnico', href: '/servicos/suporte' },
      { name: 'FAQ', href: '/faq' }
    ]
  }
]

export function Header({ isScrolled = false }: { isScrolled?: boolean }) {
  const { lang, t, toggleLang } = useI18n()
  const [isOpen, setIsOpen] = useState(false)
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)
  const [scrolled, setScrolled] = useState(false)
  const [showTopBar, setShowTopBar] = useState(true)
  const [lastScrollY, setLastScrollY] = useState(0)
  const pathname = usePathname()
  const { items, setIsCartOpen } = useCart()

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY
      setScrolled(currentScrollY > 20)
      
      if (currentScrollY > lastScrollY && currentScrollY > 50) {
        setShowTopBar(false)
      } else {
        setShowTopBar(true)
      }
      setLastScrollY(currentScrollY)
    }
    const handleClickOutside = () => {
      setActiveDropdown(null)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    document.addEventListener('click', handleClickOutside)
    return () => {
      window.removeEventListener('scroll', handleScroll)
      document.removeEventListener('click', handleClickOutside)
    }
  }, [lastScrollY])

  const toggleMobileMenu = () => {
    setIsOpen(!isOpen)
  }

  const handleDropdownClick = (e: React.MouseEvent, name: string) => {
    e.stopPropagation()
    setActiveDropdown(activeDropdown === name ? null : name)
  }

  const otherLangLabel = lang === 'pt' ? 'EN' : 'PT'

  return (
    <header
      className={`fixed ${showTopBar ? 'top-[40px]' : 'top-0'} left-0 right-0 z-50 transition-all duration-300 bg-white border-b border-gray-100 ${scrolled ? 'shadow-md' : ''}`}
    >
      <div className="relative">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-[1fr_2fr_1fr] items-center h-[70px] relative w-full">
            {/* Left Column - Logo */}
            <div className="flex items-center justify-start">
              <Link href="/" className="flex items-center">
                <div className="w-12 h-12 lg:w-40 lg:h-12 flex items-center justify-center overflow-hidden hover:scale-105 transition-transform duration-200">
                  <img
                    src="/assets/Horizontal_logo.png"
                    alt="Visual Design Logo"
                    className="w-full h-full object-contain"
                  />
                </div>
              </Link>
            </div>

            {/* Center Column - Navigation */}
            <div className="flex items-center justify-center">
              <nav className="hidden lg:flex items-center justify-center w-full">
                <div className="flex items-center space-x-6">
                  {navigation.map((item) => (
                    <div key={item.name} className="relative">
                      <button 
                        onClick={(e) => handleDropdownClick(e, item.name)}
                        className="text-slate-800 text-sm font-medium hover:text-red-600 transition-colors flex items-center gap-1 py-2"
                      >
                        {item.name}
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      </button>
                      
                      {activeDropdown === item.name && (
                        item.isMega ? (
                          <div className="absolute top-full left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-xl border border-slate-100 p-6 mt-2 w-[650px] z-[70]">
                            <div className="grid grid-cols-2 gap-4">
                              {item.items?.map((subItem) => (
                                <Link 
                                  key={subItem.name} 
                                  href={subItem.href} 
                                  className="flex items-start gap-4 p-3 hover:bg-slate-50 rounded-lg transition-colors group"
                                  onClick={() => setActiveDropdown(null)}
                                >
                                  <div className="w-10 h-10 bg-red-50 text-red-600 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-red-100 transition-colors">
                                    {/* Icones dinâmicos baseados no nome ou string */}
                                    {subItem.icon === 'monitor' && <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>}
                                    {subItem.icon === 'palette' && <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
                                    {subItem.icon === 'trending-up' && <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
                                    {subItem.icon === 'award' && <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.674M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547a3.374 3.374 0 00-.493.732l-.323.324a.75.75 0 01-1.06 0l-.324-.324a3.374 3.374 0 00-.493-.732l-.548-.547z" /></svg>}
                                    {subItem.icon === 'search' && <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>}
                                    {subItem.icon === 'users' && <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>}
                                    {subItem.icon === 'video' && <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>}
                                    {subItem.icon === 'help-circle' && <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                                  </div>
                                  <div>
                                    <h4 className="text-sm font-bold text-slate-800 group-hover:text-red-600 transition-colors">{subItem.name}</h4>
                                    <p className="text-xs text-slate-500 mt-1">{subItem.desc}</p>
                                  </div>
                                </Link>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="absolute top-full left-0 bg-white rounded-lg shadow-lg border border-slate-200 py-2 w-48 z-[70] mt-1">
                            {item.dropdown?.map((subItem) => (
                              <Link
                                key={subItem.name}
                                href={subItem.href}
                                className="block px-4 py-2 text-xs text-slate-800 hover:bg-slate-50 hover:text-red-600 transition-colors"
                                onClick={() => setActiveDropdown(null)}
                              >
                                {subItem.name}
                              </Link>
                            ))}
                          </div>
                        )
                      )}
                    </div>
                  ))}
                </div>
              </nav>
            </div>

            {/* Right Column - Buttons */}
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={toggleLang}
                className="h-8 w-10 rounded-lg bg-black hover:bg-red-600 border border-gray-600 flex items-center justify-center text-white transition-colors text-xs font-extrabold"
                type="button"
              >
                {otherLangLabel}
              </button>
              <Link
                href="/auth/login?from=/admin"
                className="px-4 py-2 bg-red-600 text-white text-[10px] lg:text-xs font-black uppercase tracking-tighter rounded-md hover:bg-black hover:text-white transition-all shadow-lg shadow-red-900/20 flex items-center gap-2 group whitespace-nowrap"
              >
                <User className="w-4 h-4 group-hover:scale-110 transition-transform" />
                Login
              </Link>
              <button
                onClick={toggleMobileMenu}
                className="lg:hidden p-2 rounded-lg hover:bg-gray-700 transition-colors"
              >
                {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <div
        className={cn(
          'lg:hidden bg-black border-t border-gray-300 absolute top-full left-0 right-0 z-50 overflow-hidden transition-all duration-300 ease-in-out',
          isOpen ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        <div className="container mx-auto px-4 py-4 space-y-4">
          {navigation.map((item) => (
            <div key={item.nameKey}>
              {item.dropdown ? (
                <div>
                  <button
                    onClick={(e) => handleDropdownClick(e, item.nameKey)}
                    className="flex items-center justify-between w-full text-left text-white hover:text-white hover:bg-red-600 font-medium transition-colors py-2"
                  >
                    <span>{t(item.nameKey)}</span>
                    <ChevronDown className={cn(
                      'w-4 h-4 transition-transform',
                      activeDropdown === item.nameKey ? 'rotate-180' : ''
                    )} />
                  </button>
                  <div
                    className={cn(
                      'overflow-hidden transition-all duration-200 ease-in-out',
                      activeDropdown === item.nameKey ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                    )}
                  >
                    <div className="mt-2 space-y-2">
                      {item.dropdown?.map((dropdownItem) => (
                        <Link
                          key={dropdownItem.nameKey}
                          href={dropdownItem.href}
                          className="block px-4 py-3 text-white hover:text-white hover:bg-red-600 rounded-lg transition-colors"
                          onClick={() => setIsOpen(false)}
                        >
                          {t(dropdownItem.nameKey)}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <Link
                  href={item.href}
                  className={cn(
                    "text-white hover:text-white hover:bg-red-600 font-medium transition-colors py-2",
                    pathname === item.href && "text-red-600"
                  )}
                  onClick={() => { setActiveDropdown(null); setIsOpen(false); }}
                >
                  {t(item.nameKey)}
                </Link>
              )}
            </div>
          ))}
          <Link
            href="/auth/login?from=/admin"
            className="flex items-center gap-2 px-4 py-3 bg-red-600/10 text-red-600 rounded-xl font-bold text-sm"
            onClick={() => setIsOpen(false)}
          >
            <User className="w-4 h-4" />
            Login
          </Link>
          <div className="pt-4 border-t border-gray-300 space-y-3">
            <button
              onClick={toggleLang}
              className="w-full flex items-center justify-center py-3 rounded-lg bg-black hover:bg-red-600 border border-gray-600 text-white transition-colors font-extrabold"
              type="button"
            >
              {otherLangLabel}
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
