'use client'
// Force re-render to fix hydration mismatch after logo size change

import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Menu, X, ChevronDown, User, ShoppingCart, LogOut, LayoutDashboard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n'
import { useCart } from '@/contexts/CartContext'
import { PANEL_LOGIN_HREF, PUBLIC_PANEL_ENTRY } from '@/lib/panel-origin'
import { ThemeToggle } from '@/components/theme/ThemeToggle'
import { useAuth } from '@/components/auth/AuthProvider'

const webNavigation = [
  { id: 'brands', nameKey: 'header.nav.services', isMega: true, items: [
      { nameKey: 'header.nav.brands.web', descKey: 'header.nav.brands.web.desc', href: '/visualweb', icon: 'monitor' },
      { nameKey: 'header.nav.brands.design', descKey: 'header.nav.brands.design.desc', href: '/', icon: 'palette' },
      { nameKey: 'header.nav.brands.eventos', descKey: 'header.nav.brands.eventos.desc', href: '/visualeventos', icon: 'calendar' },
      { nameKey: 'header.nav.brands.pro', descKey: 'header.nav.brands.pro.desc', href: '/visualpro', icon: 'film' },
      { nameKey: 'header.nav.brands.transporte', descKey: 'header.nav.brands.transporte.desc', href: '/visualtransporte', icon: 'truck' },
      { nameKey: 'header.nav.brands.gifts', descKey: 'header.nav.brands.gifts.desc', href: '/visualgifts', icon: 'gift' }
    ]
  },
  { id: 'domain', nameKey: 'header.nav.domain', href: '/servicos/dominios', isMega: true, items: [
      { nameKey: 'header.nav.domain.register', descKey: 'header.nav.domain.register.desc', href: '/servicos/dominios', icon: 'globe' },
      { nameKey: 'header.nav.domain.prices', descKey: 'header.nav.domain.prices.desc', href: '/precos/dominios', icon: 'tag' },
      { nameKey: 'header.nav.domain.transfer', descKey: 'header.nav.domain.transfer.desc', href: '/servicos/transferencia', icon: 'refresh' },
      { nameKey: 'header.nav.domain.renewal', descKey: 'header.nav.domain.renewal.desc', href: PANEL_LOGIN_HREF, icon: 'lock' },
      { nameKey: 'header.nav.domain.premium', descKey: 'header.nav.domain.premium.desc', href: '/servicos/premium', icon: 'award' },
      { nameKey: 'header.nav.domain.privacy', descKey: 'header.nav.domain.privacy.desc', href: '/servicos/privacidade', icon: 'shield' }
    ]
  },
  { id: 'hosting', nameKey: 'header.nav.hosting', href: '/servicos/hospedagem', dropdown: [
      { nameKey: 'header.nav.hosting.web', href: '/servicos/hospedagem', icon: 'monitor' },
      { nameKey: 'header.nav.hosting.prices', href: '/precos/hospedagem', icon: 'tag' }
    ]
  },
  { id: 'server', nameKey: 'header.nav.server', href: '/servicos/servidor', dropdown: [
      { nameKey: 'header.nav.server.vps', href: '/servicos/servidor', icon: 'monitor' }
    ]
  },
  { id: 'support', nameKey: 'header.nav.support', href: '/servicos/suporte', dropdown: [
      { nameKey: 'header.nav.support.technical', href: '/servicos/suporte', icon: 'help-circle' },
      { nameKey: 'header.nav.support.faq', href: '/faq', icon: 'help-circle' }
    ]
  }
]

const designNavigation = [
  { id: 'brands', nameKey: 'header.nav.services', isMega: true, items: [
      { nameKey: 'header.nav.brands.web', descKey: 'header.nav.brands.web.desc', href: '/visualweb', icon: 'monitor' },
      { nameKey: 'header.nav.brands.design', descKey: 'header.nav.brands.design.desc', href: '/', icon: 'palette' },
      { nameKey: 'header.nav.brands.eventos', descKey: 'header.nav.brands.eventos.desc', href: '/visualeventos', icon: 'calendar' },
      { nameKey: 'header.nav.brands.pro', descKey: 'header.nav.brands.pro.desc', href: '/visualpro', icon: 'film' },
      { nameKey: 'header.nav.brands.transporte', descKey: 'header.nav.brands.transporte.desc', href: '/visualtransporte', icon: 'truck' },
      { nameKey: 'header.nav.brands.gifts', descKey: 'header.nav.brands.gifts.desc', href: '/visualgifts', icon: 'gift' }
    ]
  },
  { id: 'design-grafico', nameKey: 'Design Gráfico', href: '/#design' },
  { id: 'branding', nameKey: 'Branding & Marca', href: '/#design' },
  { id: 'envelopamento', nameKey: 'Envelopamento', href: '/#envelopamento' },
  { id: 'contacto', nameKey: 'Contacto', href: '/contacto' }
]

const eventosNavigation = [
  { id: 'brands', nameKey: 'header.nav.services', isMega: true, items: [
      { nameKey: 'header.nav.brands.web', descKey: 'header.nav.brands.web.desc', href: '/visualweb', icon: 'monitor' },
      { nameKey: 'header.nav.brands.design', descKey: 'header.nav.brands.design.desc', href: '/', icon: 'palette' },
      { nameKey: 'header.nav.brands.eventos', descKey: 'header.nav.brands.eventos.desc', href: '/visualeventos', icon: 'calendar' },
      { nameKey: 'header.nav.brands.pro', descKey: 'header.nav.brands.pro.desc', href: '/visualpro', icon: 'film' },
      { nameKey: 'header.nav.brands.transporte', descKey: 'header.nav.brands.transporte.desc', href: '/visualtransporte', icon: 'truck' },
      { nameKey: 'header.nav.brands.gifts', descKey: 'header.nav.brands.gifts.desc', href: '/visualgifts', icon: 'gift' }
    ]
  },
  { id: 'stands', nameKey: 'Stands & Feiras', href: '/visualeventos/feiras' },
  { id: 'catering', nameKey: 'Catering Premium', href: '/visualeventos/catering' },
  { id: 'aluguer', nameKey: 'Aluguer de Material', href: '/visualeventos' },
  { id: 'organizacao', nameKey: 'Organização', href: '/visualeventos' },
  { id: 'contacto', nameKey: 'Contacto', href: '/contacto' }
]

const proNavigation = [
  { id: 'brands', nameKey: 'header.nav.services', isMega: true, items: [
      { nameKey: 'header.nav.brands.web', descKey: 'header.nav.brands.web.desc', href: '/visualweb', icon: 'monitor' },
      { nameKey: 'header.nav.brands.design', descKey: 'header.nav.brands.design.desc', href: '/', icon: 'palette' },
      { nameKey: 'header.nav.brands.eventos', descKey: 'header.nav.brands.eventos.desc', href: '/visualeventos', icon: 'calendar' },
      { nameKey: 'header.nav.brands.pro', descKey: 'header.nav.brands.pro.desc', href: '/visualpro', icon: 'film' },
      { nameKey: 'header.nav.brands.transporte', descKey: 'header.nav.brands.transporte.desc', href: '/visualtransporte', icon: 'truck' },
      { nameKey: 'header.nav.brands.gifts', descKey: 'header.nav.brands.gifts.desc', href: '/visualgifts', icon: 'gift' }
    ]
  },
  { id: 'video', nameKey: 'Produção de Vídeo', href: '/visualpro' },
  { id: 'fotografia', nameKey: 'Fotografia', href: '/visualpro/fotografia' },
  { id: 'eventos', nameKey: 'Cobertura de Eventos', href: '/visualpro/eventos' },
  { id: 'contacto', nameKey: 'Contacto', href: '/contacto' }
]

const transporteNavigation = [
  { id: 'brands', nameKey: 'header.nav.services', isMega: true, items: [
      { nameKey: 'header.nav.brands.web', descKey: 'header.nav.brands.web.desc', href: '/visualweb', icon: 'monitor' },
      { nameKey: 'header.nav.brands.design', descKey: 'header.nav.brands.design.desc', href: '/', icon: 'palette' },
      { nameKey: 'header.nav.brands.eventos', descKey: 'header.nav.brands.eventos.desc', href: '/visualeventos', icon: 'calendar' },
      { nameKey: 'header.nav.brands.pro', descKey: 'header.nav.brands.pro.desc', href: '/visualpro', icon: 'film' },
      { nameKey: 'header.nav.brands.transporte', descKey: 'header.nav.brands.transporte.desc', href: '/visualtransporte', icon: 'truck' },
      { nameKey: 'header.nav.brands.gifts', descKey: 'header.nav.brands.gifts.desc', href: '/visualgifts', icon: 'gift' }
    ]
  },
  { id: 'mobilidade', nameKey: 'Serviços de Mobilidade', href: '/visualtransporte' },
  { id: 'aluguer-viaturas', nameKey: 'Aluguer de Viaturas', href: '/visualtransporte' },
  { id: 'logistica-eventos', nameKey: 'Logística de Eventos', href: '/visualtransporte' },
  { id: 'contacto', nameKey: 'Contacto', href: '/contacto' }
]

const giftsNavigation = [
  { id: 'brands', nameKey: 'header.nav.services', isMega: true, items: [
      { nameKey: 'header.nav.brands.web', descKey: 'header.nav.brands.web.desc', href: '/visualweb', icon: 'monitor' },
      { nameKey: 'header.nav.brands.design', descKey: 'header.nav.brands.design.desc', href: '/', icon: 'palette' },
      { nameKey: 'header.nav.brands.eventos', descKey: 'header.nav.brands.eventos.desc', href: '/visualeventos', icon: 'calendar' },
      { nameKey: 'header.nav.brands.pro', descKey: 'header.nav.brands.pro.desc', href: '/visualpro', icon: 'film' },
      { nameKey: 'header.nav.brands.transporte', descKey: 'header.nav.brands.transporte.desc', href: '/visualtransporte', icon: 'truck' },
      { nameKey: 'header.nav.brands.gifts', descKey: 'header.nav.brands.gifts.desc', href: '/visualgifts', icon: 'gift' }
    ]
  },
  { id: 'merchandising', nameKey: 'Merchandising', href: '/visualgifts' },
  { id: 'texteis', nameKey: 'Têxteis & Fardamento', href: '/visualgifts/texteis' },
  { id: 'kits', nameKey: 'Kits Onboarding', href: '/visualgifts/kits' },
  { id: 'contacto', nameKey: 'Contacto', href: '/contacto' }
]

const groupNavigation = [
  { id: 'brands', nameKey: 'header.nav.services', isMega: true, items: [
      { nameKey: 'header.nav.brands.web', descKey: 'header.nav.brands.web.desc', href: '/visualweb', icon: 'monitor' },
      { nameKey: 'header.nav.brands.design', descKey: 'header.nav.brands.design.desc', href: '/', icon: 'palette' },
      { nameKey: 'header.nav.brands.eventos', descKey: 'header.nav.brands.eventos.desc', href: '/visualeventos', icon: 'calendar' },
      { nameKey: 'header.nav.brands.pro', descKey: 'header.nav.brands.pro.desc', href: '/visualpro', icon: 'film' },
      { nameKey: 'header.nav.brands.transporte', descKey: 'header.nav.brands.transporte.desc', href: '/visualtransporte', icon: 'truck' },
      { nameKey: 'header.nav.brands.gifts', descKey: 'header.nav.brands.gifts.desc', href: '/visualgifts', icon: 'gift' }
    ]
  },
  { id: 'sobre-nos', nameKey: 'nav.about', href: '/sobre-nos' },
  { id: 'portfolio', nameKey: 'nav.portfolio', href: '/portfolio' },
  { id: 'diferencial', nameKey: 'Diferencial', href: '/diferencial' },
  { id: 'consultoria-cursos', nameKey: 'Cursos', href: '/cursos' },
  { id: 'contacto', nameKey: 'nav.contact', href: '/contacto' }
]

export function Header({ isScrolled = false }: { isScrolled?: boolean }) {
  const { lang, t, toggleLang } = useI18n()
  const [isOpen, setIsOpen] = useState(false)
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)
  const [scrolled, setScrolled] = useState(false)
  const [showTopBar, setShowTopBar] = useState(true)
  const [lastScrollY, setLastScrollY] = useState(0)
  const { items, setIsCartOpen } = useCart()
  const { user, signOut } = useAuth()

  const pathname = usePathname()

  const navigation = useMemo(() => {
    if (pathname.startsWith('/visualdesign')) return designNavigation
    if (pathname.startsWith('/visualeventos')) return eventosNavigation
    if (pathname.startsWith('/visualpro')) return proNavigation
    if (pathname.startsWith('/visualtransporte')) return transporteNavigation
    if (pathname.startsWith('/visualgifts')) return giftsNavigation
    if (pathname.startsWith('/visualweb') || pathname.startsWith('/precos') || pathname.startsWith('/servicos')) return webNavigation
    return groupNavigation
  }, [pathname])

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

    window.addEventListener('scroll', handleScroll)
    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [lastScrollY])

  const toggleMobileMenu = () => {
    setIsOpen(!isOpen)
  }

  const handleDropdownClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setActiveDropdown(activeDropdown === id ? null : id)
  }

  const otherLangLabel = lang === 'pt' ? 'EN' : 'PT'

  const selectLang = (target: 'pt' | 'en') => {
    if (lang !== target) toggleLang()
  }

  const mobileBarBtn =
    'h-8 w-9 sm:w-10 rounded-lg border border-gray-600 dark:border-zinc-700 flex items-center justify-center transition-colors'

  return (
    <header className={`fixed left-0 right-0 z-50 transition-all duration-300 bg-white shadow-sm dark:bg-white/10 dark:backdrop-blur-md dark:shadow-none dark:border-b dark:border-white/15 ${scrolled ? 'shadow-md dark:shadow-none' : ''} ${showTopBar ? 'top-[40px]' : 'top-0'}`}>
      {/* Linha superior — mais suave no layout escuro */}
      <div className={`h-[2.5px] bg-red-600 transition-all duration-300 dark:h-[1px] dark:bg-red-950/45 dark:opacity-80 ${showTopBar ? 'opacity-100' : 'opacity-0'}`}></div>
      
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex lg:grid lg:grid-cols-[1fr_2fr_1fr] items-center lg:items-stretch h-[70px] w-full gap-2">
          {/* Left Column - Logo */}
          <div className="flex items-center justify-start min-w-0 shrink">
            <Link href="/" className="flex-shrink-0">
              <div className="h-[36px] w-[130px] sm:h-[48px] sm:w-[192px] relative">
                <Image
                  src="/assets/Logo - horizontal.jpg"
                  alt="VisualDesign Logo"
                  fill
                  priority
                  sizes="(max-width: 640px) 130px, 192px"
                  className="object-contain dark:hidden"
                />
                <Image
                  src="/assets/Logo - Branco.png"
                  alt="VisualDesign Logo"
                  fill
                  priority
                  sizes="(max-width: 640px) 130px, 192px"
                  className="hidden object-contain dark:block"
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
                      key={item.id} 
                      className={item.isMega ? "menu-item-container" : "relative menu-item-container"}
                      onMouseEnter={() => setActiveDropdown(item.id)}
                      onMouseLeave={() => setActiveDropdown(null)}
                    >
                      {item.href && !item.isMega && !(item as any).dropdown ? (
                        <Link
                          href={item.href}
                          className="text-slate-800 dark:text-zinc-100 text-base font-medium hover:text-red-600 dark:hover:text-white transition-colors flex items-center h-full whitespace-nowrap"
                        >
                          {t(item.nameKey)}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          className="text-slate-800 dark:text-zinc-100 text-base font-medium hover:text-red-600 dark:hover:text-white transition-colors flex items-center h-full whitespace-nowrap"
                        >
                          {t(item.nameKey)}
                        </button>
                      )}
                      
                      {item.isMega && (
                        <div className={cn(
                          "absolute top-full left-1/2 -translate-x-1/2 pt-1 w-[900px] z-[70]",
                          activeDropdown === item.id ? 'visible' : 'invisible'
                        )}>
                          <div className={cn(
                            "bg-white border border-slate-200 rounded-xl shadow-xl p-6 transition-all duration-300 dark:bg-black dark:border-white/25",
                            activeDropdown === item.id ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
                          )}>
                          <div className="grid grid-cols-3 gap-6">
                            {item.items?.map((subItem) => (
                              <Link 
                                key={subItem.nameKey} 
                                href={subItem.href} 
                                className="flex items-start gap-4 p-3 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors group/item"
                                onClick={() => setActiveDropdown(null)}
                              >
                                <div className="w-12 h-12 flex items-center justify-center flex-shrink-0 text-slate-400 dark:text-zinc-500 transition-colors">
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
                                  {subItem.icon === 'film' && <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 3h12a3 3 0 013 3v12a3 3 0 01-3 3H6a3 3 0 01-3-3V6a3 3 0 013-3zm0 4h12M6 17h12M6 12h12M6 3v18M18 3v18" /></svg>}
                                  {subItem.icon === 'gift' && <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V6a2 2 0 10-2 2h2zm-8 4h16M5 8h14a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1V9a1 1 0 011-1z" /></svg>}
                                </div>
                                <div>
                                  <h4 className="text-base font-bold text-slate-900 group-hover/item:text-red-600 dark:text-white dark:group-hover/item:text-red-500 transition-colors">{t(subItem.nameKey)}</h4>
                                  <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1 line-clamp-2">{subItem.descKey ? t(subItem.descKey) : ''}</p>
                                </div>
                              </Link>
                            ))}
                          </div>
                          </div>
                        </div>
                      )}
                      
                      {!item.isMega && (item as any).dropdown && (
                        <div className={cn(
                          "absolute top-full left-0 pt-1 z-[70]",
                          activeDropdown === item.id ? 'visible' : 'invisible'
                        )}>
                          <div className={cn(
                            "bg-white border border-slate-200 rounded-lg shadow-lg p-4 w-max transition-all duration-300 dark:bg-black dark:border-white/25",
                            activeDropdown === item.id ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
                          )}>
                          {(item as any).dropdown?.map((subItem: any) => (
                            <Link
                              key={subItem.nameKey}
                              href={subItem.href}
                              className="flex items-center gap-2 py-1.5 text-base text-slate-800 hover:text-red-600 dark:text-white dark:hover:text-red-500 transition-colors group whitespace-nowrap"
                              onClick={() => setActiveDropdown(null)}
                            >
                              <div className="w-6 h-6 flex items-center justify-center flex-shrink-0 text-slate-400 dark:text-zinc-500 transition-colors">
                                {subItem.icon === 'monitor' && <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>}
                                {subItem.icon === 'tag' && <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>}
                                {subItem.icon === 'help-circle' && <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                              </div>
                              {t(subItem.nameKey)}
                            </Link>
                          ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </nav>
          </div>

            {/* Right Column - Buttons */}
            <div className="flex items-center justify-end gap-1.5 sm:gap-2 ml-auto lg:ml-0 shrink-0">
              <ThemeToggle
                size="sm"
                className={cn(
                  mobileBarBtn,
                  'lg:hidden !bg-black dark:!bg-zinc-900 hover:!bg-red-600 dark:hover:!bg-zinc-800 !text-white dark:!text-white dark:hover:!text-white !border-gray-600 dark:!border-zinc-700'
                )}
              />
              <button
                onClick={toggleLang}
                className={cn(
                  mobileBarBtn,
                  'bg-black dark:bg-zinc-900 hover:bg-red-600 dark:hover:bg-zinc-800 text-white text-xs font-extrabold',
                  isOpen ? 'hidden lg:flex' : 'flex'
                )}
                type="button"
              >
                {otherLangLabel}
              </button>
              {user ? (
                <>
                  <Link
                    href={PUBLIC_PANEL_ENTRY}
                    className="px-2.5 py-1.5 sm:px-4 sm:py-2 bg-black dark:bg-zinc-900 text-white text-[10px] lg:text-xs font-black uppercase tracking-tighter rounded-md hover:bg-red-600 dark:hover:bg-zinc-800 transition-all shadow-lg shadow-black/20 dark:shadow-none flex items-center gap-1.5 sm:gap-2 group whitespace-nowrap"
                  >
                    <LayoutDashboard className="w-4 h-4 shrink-0 group-hover:scale-110 transition-transform" />
                    <span>Painel</span>
                  </Link>
                  <button
                    type="button"
                    onClick={async () => {
                      await signOut()
                      window.location.href = '/login'
                    }}
                    className="px-2.5 py-1.5 sm:px-4 sm:py-2 bg-red-600 text-white text-[10px] lg:text-xs font-black uppercase tracking-tighter rounded-md hover:bg-black dark:hover:bg-white dark:hover:text-black transition-all shadow-lg shadow-red-900/20 dark:shadow-none flex items-center gap-1.5 sm:gap-2 group whitespace-nowrap"
                  >
                    <LogOut className="w-4 h-4 shrink-0 group-hover:scale-110 transition-transform" />
                    <span>Sair</span>
                  </button>
                </>
              ) : (
                <Link
                  href={PANEL_LOGIN_HREF}
                  className="px-2.5 py-1.5 sm:px-4 sm:py-2 bg-red-600 text-white text-[10px] lg:text-xs font-black uppercase tracking-tighter rounded-md hover:bg-black dark:hover:bg-white dark:hover:text-black transition-all shadow-lg shadow-red-900/20 dark:shadow-none flex items-center gap-1.5 sm:gap-2 group whitespace-nowrap"
                >
                  <User className="w-4 h-4 shrink-0 group-hover:scale-110 transition-transform" />
                  <span>Login</span>
                </Link>
              )}
              <button
                onClick={toggleMobileMenu}
                className={cn(
                  mobileBarBtn,
                  'lg:hidden text-slate-800 dark:text-zinc-100 hover:bg-slate-100 dark:hover:bg-zinc-900'
                )}
                type="button"
              >
                {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="lg:hidden fixed inset-0 z-[49] bg-black/70"
            onClick={() => setIsOpen(false)}
            aria-hidden
          />,
          document.body
        )}

      {/* Mobile Menu */}
      <div
        className={cn(
          'lg:hidden absolute top-full right-0 w-[80%] max-w-sm z-[55] overflow-hidden transition-all duration-300 ease-in-out bg-white border-l border-t border-slate-200 shadow-xl dark:bg-black dark:border-white/25',
          isOpen ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        <div className="py-1">
          {navigation.map((item, index) => {
            const hasSub = !!((item as any).dropdown || item.items)
            return (
              <div key={item.id} className={index === navigation.length - 1 ? 'pb-5' : undefined}>
                <div>
                  {hasSub ? (
                    <button
                      onClick={(e) => handleDropdownClick(e, item.id)}
                      className="flex items-center justify-between w-full text-left text-slate-800 dark:text-white hover:text-white hover:bg-red-600 font-medium transition-colors py-1.5 !pl-[20px] pr-4"
                    >
                      <span>{t(item.nameKey)}</span>
                      <ChevronDown className={cn(
                        'w-4 h-4 transition-transform shrink-0 mr-4',
                        activeDropdown === item.id ? 'rotate-180' : ''
                      )} />
                    </button>
                  ) : (
                    <Link
                      href={item.href || '#'}
                      className="block w-full text-left text-slate-800 dark:text-white hover:text-white hover:bg-red-600 font-medium transition-colors py-1.5 !pl-[20px] pr-4"
                      onClick={() => setIsOpen(false)}
                    >
                      {t(item.nameKey)}
                    </Link>
                  )}
                  {hasSub && (
                    <div
                      className={cn(
                        'overflow-hidden transition-all duration-200 ease-in-out',
                        activeDropdown === item.id ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                      )}
                    >
                      <div className="space-y-0 bg-slate-100 dark:bg-zinc-800 border-y border-slate-200 dark:border-white/10">
                        {((item as any).dropdown || item.items)?.map((dropdownItem: any) => (
                          <Link
                            key={dropdownItem.nameKey}
                            href={dropdownItem.href}
                            className="block w-full !pl-[20px] pr-4 py-1.5 text-slate-800 dark:text-white hover:text-white hover:bg-red-600 transition-colors"
                            onClick={() => setIsOpen(false)}
                          >
                            {t(dropdownItem.nameKey)}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          <div className="flex border-t border-slate-200 dark:border-white/25">
            <button
              onClick={() => selectLang('pt')}
              className={cn(
                'flex-1 py-2.5 text-sm font-extrabold transition-colors',
                lang === 'pt'
                  ? 'bg-red-600 text-white'
                  : 'bg-white dark:bg-black text-slate-800 dark:text-white hover:bg-slate-100 dark:hover:bg-zinc-900'
              )}
              type="button"
            >
              {t('lang.portuguese')}
            </button>
            <button
              onClick={() => selectLang('en')}
              className={cn(
                'flex-1 py-2.5 text-sm font-extrabold transition-colors border-l border-slate-200 dark:border-white/25',
                lang === 'en'
                  ? 'bg-red-600 text-white'
                  : 'bg-white dark:bg-black text-slate-800 dark:text-white hover:bg-slate-100 dark:hover:bg-zinc-900'
              )}
              type="button"
            >
              {t('lang.english')}
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
