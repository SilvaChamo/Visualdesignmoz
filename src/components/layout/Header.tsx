'use client'
// Force re-render to fix hydration mismatch after logo size change

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Menu, X, ChevronDown, User, ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n'
import { useCart } from '@/contexts/CartContext'

const navigation = [
  { name: 'Domínio', href: '/servicos/dominios', isMega: true, items: [
      { name: 'Registo de Domínios', href: '/servicos/dominios', desc: 'Registe seu domínio com segurança e rapidez no mercado.', icon: 'globe' },
      { name: 'Preços de Domínios', href: '/precos/dominios', desc: 'Consulte a tabela completa de preços de todas as extensões.', icon: 'tag' },
      { name: 'Transferência', href: '/servicos/transferencia', desc: 'Traga seu domínio para nós e aproveite nossas vantagens.', icon: 'refresh' },
      { name: 'Renovação', href: '/auth/login?from=/admin/dominios', desc: 'Renove seu domínio existente. É necessário fazer login.', icon: 'lock' },
      { name: 'Domínios Premium', href: '/servicos/premium', desc: 'Adquira nomes exclusivos para destacar seu negócio online.', icon: 'award' },
      { name: 'Privacidade WHOIS', href: '/servicos/privacidade', desc: 'Proteja seus dados pessoais contra spam e roubo de identidade.', icon: 'shield' }
    ]
  },
  { name: 'Hospedagem', href: '/servicos/hospedagem', dropdown: [
      { name: 'Hospedagem Web', href: '/servicos/hospedagem', icon: 'monitor' },
      { name: 'Preços de Hospedagem', href: '/precos/hospedagem', icon: 'tag' }
    ]
  },
  { name: 'Servidor', href: '/servicos/servidor', dropdown: [
      { name: 'VPS / Cloud', href: '/servicos/servidor', icon: 'monitor' }
    ]
  },
  { name: 'Serviços', href: '/servicos', isMega: true, items: [
      { name: 'Web Design', href: '/servicos/webdesign', desc: 'Criação de sites profissionais e responsivos para o seu negócio.', icon: 'monitor' },
      { name: 'Design Gráfico', href: '/servicos/design-grafico', desc: 'Identidade visual, logótipos e materiais de comunicação.', icon: 'palette' },
      { name: 'Marketing Digital', href: '/servicos/marketing-digital', desc: 'Gestão de redes sociais e tráfego pago para crescer online.', icon: 'trending-up' },
      { name: 'Feiras e Eventos', href: '/servicos/feiras-eventos', desc: 'Organização completa, stands e logística para eventos.', icon: 'calendar' },
      { name: 'Katring', href: '/servicos/katring', desc: 'Serviço de catering completo para eventos corporativos e sociais.', icon: 'coffee' },
      { name: 'Aluguer de Material', href: '/servicos/aluguer', desc: 'Equipamentos de som, luz, tendas e mobiliário para eventos.', icon: 'truck' }
    ]
  },
  { name: 'Apoio, suporte', href: '/servicos/suporte', dropdown: [
      { name: 'Suporte Técnico', href: '/servicos/suporte', icon: 'help-circle' },
      { name: 'FAQ', href: '/faq', icon: 'help-circle' }
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
  const { items, setIsCartOpen } = useCart()

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY
      
      if (currentScrollY > 50) {
        setScrolled(true)
      } else {
        setScrolled(false)
      }

      if (currentScrollY > lastScrollY && currentScrollY > 50) {
        setShowTopBar(false)
      } else {
        setShowTopBar(true)
      }
      
      setLastScrollY(currentScrollY)
    }

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.menu-item-container')) {
        setActiveDropdown(null);
      }
    };
    window.addEventListener('scroll', handleScroll)
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
    <header className={`fixed left-0 right-0 z-50 transition-all duration-300 bg-white shadow-sm ${scrolled ? 'shadow-md' : ''} ${showTopBar ? 'top-[40px]' : 'top-0'}`}>
      {/* Red line top bar */}
      <div className={`h-[2.5px] bg-red-600 transition-all duration-300 ${showTopBar ? 'opacity-100' : 'opacity-0'}`}></div>
      
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-[1fr_2fr_1fr] items-stretch h-[70px] relative w-full">
          {/* Left Column - Logo */}
          <div className="flex items-center justify-start">
            <Link href="/" className="flex-shrink-0">
              <div className="h-[48px] w-[192px] relative">
                <img 
                  src="/assets/Horizontal_logo.png" 
                  alt="VisualDesign Logo" 
                  className="w-full h-full object-contain"
                />
              </div>
            </Link>
          </div>

          {/* Center Column - Navigation */}
          <div className="flex items-stretch justify-center">
            <nav className="hidden lg:flex items-stretch justify-center w-full">
              <div className="flex items-stretch space-x-6">
                {navigation.map((item) => {
                  return (
                    <div 
                      key={item.name} 
                      className={item.isMega ? "menu-item-container" : "relative menu-item-container"}
                    >
                      <button 
                        onClick={() => setActiveDropdown(activeDropdown === item.name ? null : item.name)}
                        className="text-slate-800 text-base font-medium hover:text-red-600 transition-colors flex items-center gap-1 h-full"
                      >
                        {item.name}
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      </button>
                      
                      {item.isMega ? (
                        <div className={cn(
                          "absolute top-full left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-xl border border-slate-100 p-6 w-[900px] z-[70] transition-all duration-300 mt-1",
                          activeDropdown === item.name ? 'visible opacity-100 translate-y-0' : 'invisible opacity-0 translate-y-4'
                        )}>
                          <div className="grid grid-cols-3 gap-6">
                            {item.items?.map((subItem) => (
                              <Link 
                                key={subItem.name} 
                                href={subItem.href} 
                                className="flex items-start gap-4 p-3 hover:bg-slate-50 rounded-lg transition-colors group/item"
                                onClick={() => setActiveDropdown(null)}
                              >
                                <div className="w-12 h-12 flex items-center justify-center flex-shrink-0 text-slate-400 transition-colors">
                                  {/* Icones Finos */}
                                  {subItem.icon === 'globe' && <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" /></svg>}
                                  {subItem.icon === 'tag' && <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>}
                                  {subItem.icon === 'refresh' && <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.582m0 0a8.001 8.001 0 01-15.356-2m0 0H15" /></svg>}
                                  {subItem.icon === 'lock' && <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>}
                                  {subItem.icon === 'award' && <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.674M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547a3.374 3.374 0 00-.493.732l-.323.324a.75.75 0 01-1.06 0l-.324-.324a3.374 3.374 0 00-.493-.732l-.548-.547z" /></svg>}
                                  {subItem.icon === 'shield' && <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>}
                                  {subItem.icon === 'settings' && <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
                                  {subItem.icon === 'map-pin' && <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.828 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
                                  
                                  {subItem.icon === 'monitor' && <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>}
                                  {subItem.icon === 'palette' && <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
                                  {subItem.icon === 'trending-up' && <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
                                  {subItem.icon === 'calendar' && <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
                                  {subItem.icon === 'coffee' && <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 20h16a1 1 0 001-1v-3a4 4 0 00-4-4H7a4 4 0 00-4 4v3a1 1 0 001 1z" /><path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 018 0v4M12 3v2" /></svg>}
                                  {subItem.icon === 'truck' && <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4-4m-4 4l4 4" /></svg>}
                                  {subItem.icon === 'help-circle' && <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                                </div>
                                <div>
                                  <h4 className="text-base font-bold text-slate-800 group-hover/item:text-red-600 transition-colors">{subItem.name}</h4>
                                  <p className="text-sm text-slate-500 mt-1 line-clamp-2">{subItem.desc}</p>
                                </div>
                              </Link>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className={cn(
                          "absolute top-full left-0 bg-white rounded-lg shadow-lg border border-slate-200 p-4 w-max z-[70] transition-all duration-300 mt-1",
                          activeDropdown === item.name ? 'visible opacity-100 translate-y-0' : 'invisible opacity-0 translate-y-4'
                        )}>
                          {item.dropdown?.map((subItem) => (
                            <Link
                              key={subItem.name}
                              href={subItem.href}
                              className="flex items-center gap-2 py-1.5 text-base text-slate-600 hover:text-red-600 transition-colors group whitespace-nowrap"
                              onClick={() => setActiveDropdown(null)}
                            >
                              <div className="w-6 h-6 flex items-center justify-center flex-shrink-0 text-slate-400 transition-colors">
                                {subItem.icon === 'monitor' && <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>}
                                {subItem.icon === 'tag' && <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>}
                                {subItem.icon === 'help-circle' && <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                              </div>
                              {subItem.name}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
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

      {/* Mobile Menu */}
      <div
        className={cn(
          'lg:hidden bg-black border-t border-gray-300 absolute top-full left-0 right-0 z-50 overflow-hidden transition-all duration-300 ease-in-out',
          isOpen ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        <div className="container mx-auto px-4 py-4 space-y-4">
          {navigation.map((item) => (
            <div key={item.name}>
              <div>
                <button
                  onClick={(e) => handleDropdownClick(e, item.name)}
                  className="flex items-center justify-between w-full text-left text-white hover:text-white hover:bg-red-600 font-medium transition-colors py-2"
                >
                  <span>{item.name}</span>
                  <ChevronDown className={cn(
                    'w-4 h-4 transition-transform',
                    activeDropdown === item.name ? 'rotate-180' : ''
                  )} />
                </button>
                <div
                  className={cn(
                    'overflow-hidden transition-all duration-200 ease-in-out',
                    activeDropdown === item.name ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                  )}
                >
                  <div className="mt-2 space-y-2">
                    {(item.dropdown || item.items)?.map((dropdownItem) => (
                      <Link
                        key={dropdownItem.name}
                        href={dropdownItem.href}
                        className="block px-4 py-3 text-white hover:text-white hover:bg-red-600 rounded-lg transition-colors"
                        onClick={() => setIsOpen(false)}
                      >
                        {dropdownItem.name}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
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
