'use client'
// Force re-render to fix hydration mismatch after logo size change

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X, ChevronDown, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n'

const navigation = [
  { nameKey: 'nav.home', href: '/' },
  { nameKey: 'nav.about', href: '/sobre-nos' },
  {
    nameKey: 'nav.services', href: '/servicos', dropdown: [
      { nameKey: 'services.web', href: '/servicos/web-design' },
      { nameKey: 'services.graphic', href: '/servicos/design-grafico' },
      { nameKey: 'services.fairs', href: '/servicos/feiras-eventos' },
      { nameKey: 'services.products', href: '/servicos/produtos' },
      { nameKey: 'services.domains', href: '/servicos/dominios' },
      { nameKey: 'services.hosting', href: '/servicos/hospedagem' },
      { nameKey: 'services.ssl', href: '/servicos/ssl' },
      { nameKey: 'services.email', href: '/servicos/email' },
      { nameKey: 'services.support', href: '/servicos/suporte' }
    ]
  },
  { nameKey: 'nav.portfolio', href: '/portfolio' },
  { nameKey: 'nav.courses', href: '/cursos' },
  { nameKey: 'nav.contact', href: '/contacto' }
]

export function Header({ isScrolled = false }: { isScrolled?: boolean }) {
  const { lang, t, toggleLang } = useI18n()
  const [isOpen, setIsOpen] = useState(false)
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)
  const [scrolled, setScrolled] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    const handleClickOutside = () => {
      setActiveDropdown(null)
    }
    window.addEventListener('scroll', handleScroll)
    document.addEventListener('click', handleClickOutside)
    return () => {
      window.removeEventListener('scroll', handleScroll)
      document.removeEventListener('click', handleClickOutside)
    }
  }, [])

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
      className={`fixed ${scrolled ? 'top-0 shadow-md' : 'top-[40px]'} left-0 right-0 z-50 transition-all duration-300 bg-white border-b border-gray-100`}
    >
      <div className="relative">
        <div className="max-w-7xl mx-auto px-0">
          <div className="grid grid-cols-[1fr_2fr_1fr] items-center h-[70px] relative">
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
                    <div key={item.nameKey} className="relative">
                      {item.dropdown ? (
                        <div>
                          <button
                            onClick={(e) => handleDropdownClick(e, item.nameKey)}
                            className="flex items-center space-x-1 text-black hover:text-red-600 font-medium transition-colors py-2"
                          >
                            <span>{t(item.nameKey)}</span>
                            <ChevronDown className={cn(
                              'w-4 h-4 transition-transform',
                              activeDropdown === item.nameKey ? 'rotate-180' : ''
                            )} />
                          </button>
                          <div
                            className={cn(
                              'absolute top-full left-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-300 z-50 transition-all duration-200 origin-top',
                              activeDropdown === item.nameKey
                                ? 'opacity-100 scale-y-100 pointer-events-auto'
                                : 'opacity-0 scale-y-95 pointer-events-none'
                            )}
                          >
                            <div className="p-4">
                              {item.dropdown?.map((subItem) => (
                                <Link
                                  key={subItem.nameKey}
                                  href={subItem.href}
                                  className="block px-4 py-3 text-black hover:text-red-600 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                  {t(subItem.nameKey)}
                                </Link>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <Link
                          href={item.href}
                          className={cn(
                            "text-black hover:text-red-600 font-medium transition-colors py-2",
                            pathname === item.href && "text-red-600"
                          )}
                          onClick={() => setActiveDropdown(null)}
                        >
                          {t(item.nameKey)}
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              </nav>
            </div>

            {/* Right Column - Buttons */}
            <div className="flex items-center justify-end space-x-4">
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
