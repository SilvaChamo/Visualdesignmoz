'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n'
import { Globe, User, Bell, ShoppingCart, HelpCircle, Rocket, Server, CreditCard, Shield, Grid, Layers, Package, BookOpen, Lock, Camera, Palette, Monitor, Mail, FileText, Megaphone, PenTool, Film, Search as SearchIcon } from 'lucide-react'
import Link from 'next/link'
import { useCart } from '@/contexts/CartContext'

export function Navbar() {
  const { t } = useI18n()
  const { items, setIsCartOpen } = useCart()
  const router = useRouter()
  const [showLaunchpad, setShowLaunchpad] = useState(false)
  const [showTopBar, setShowTopBar] = useState(true)
  const [lastScrollY, setLastScrollY] = useState(0)
  const launchpadRef = useRef<HTMLDivElement>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Itens de Acesso Rápido (sempre visíveis quando não há busca)
  const quickAccessItems = [
    { href: '/client/domains', icon: Globe, title: 'Gestor de Domínios', desc: 'Gerir os seus domínios', bg: 'bg-teal-50', text: 'text-teal-600', category: 'Acesso Rápido', requiresLogin: false },
    { href: '/servicos/hospedagem', icon: Server, title: 'Gestor de Alojamento', desc: 'Hospedagem CPanel', bg: 'bg-blue-50', text: 'text-blue-600', category: 'Acesso Rápido', requiresLogin: false },
    { href: '/client/domains', icon: Shield, title: 'DNS Avançado', desc: 'Registos e Zonas', bg: 'bg-purple-50', text: 'text-purple-600', category: 'Acesso Rápido', requiresLogin: false },
    { href: '/notificacoes', icon: CreditCard, title: 'Faturas e Pagamentos', desc: 'Histórico e Pendentes', bg: 'bg-orange-50', text: 'text-orange-600', category: 'Acesso Rápido', requiresLogin: false },
  ]

  // Índice completo para pesquisa
  const allSearchableItems = [
    // Serviços - Design e Criativo
    { href: '/servicos', icon: Package, title: 'Todos os Serviços', desc: 'Lista completa de serviços disponíveis', bg: 'bg-red-50', text: 'text-red-600', tags: 'serviços lista completa', requiresLogin: false },
    { href: '/servicos/webdesign', icon: Monitor, title: 'Web Design', desc: 'Criação de sites e lojas online profissionais', bg: 'bg-cyan-50', text: 'text-cyan-600', tags: 'site website loja online ecommerce desenvolvimento serviços', requiresLogin: false },
    { href: '/servicos/design-grafico', icon: Palette, title: 'Design Gráfico', desc: 'Identidade visual, logótipos e materiais gráficos', bg: 'bg-rose-50', text: 'text-rose-600', tags: 'logo logótipo cartão visita flyer poster banner serviços', requiresLogin: false },
    { href: '/servicos/branding', icon: PenTool, title: 'Branding', desc: 'Construção e gestão de marca', bg: 'bg-fuchsia-50', text: 'text-fuchsia-600', tags: 'marca identidade visual rebranding serviços', requiresLogin: false },
    { href: '/servicos/fotografia', icon: Camera, title: 'Fotografia', desc: 'Fotografia profissional e edição', bg: 'bg-amber-50', text: 'text-amber-600', tags: 'fotos sessão fotográfica produto serviços', requiresLogin: false },
    { href: '/servicos/video-producao', icon: Film, title: 'Vídeo e Produção', desc: 'Produção audiovisual e edição de vídeo', bg: 'bg-red-50', text: 'text-red-600', tags: 'vídeo filmagem edição produção audiovisual serviços', requiresLogin: false },

    // Serviços - Marketing
    { href: '/servicos/marketing-digital', icon: Megaphone, title: 'Marketing Digital', desc: 'Estratégias de marketing online', bg: 'bg-violet-50', text: 'text-violet-600', tags: 'marketing digital google ads facebook campanha publicidade serviços', requiresLogin: false },
    { href: '/servicos/redes-sociais', icon: Globe, title: 'Redes Sociais', desc: 'Gestão de redes sociais', bg: 'bg-blue-50', text: 'text-blue-600', tags: 'instagram facebook tiktok social media serviços', requiresLogin: false },
    { href: '/servicos/seo', icon: SearchIcon, title: 'SEO', desc: 'Otimização para motores de busca', bg: 'bg-green-50', text: 'text-green-600', tags: 'google ranking otimização pesquisa serviços', requiresLogin: false },

    // Serviços - Infraestrutura
    { href: '/servicos/dominios', icon: Globe, title: 'Domínios', desc: 'Registo e transferência de domínios', bg: 'bg-teal-50', text: 'text-teal-600', tags: 'domínio registar .com .mz dns serviços', requiresLogin: false },
    { href: '/servicos/hospedagem', icon: Server, title: 'Hospedagem', desc: 'Alojamento web CPanel e servidores', bg: 'bg-blue-50', text: 'text-blue-600', tags: 'hosting alojamento servidor cpanel vps serviços', requiresLogin: false },
    { href: '/servicos/ssl', icon: Shield, title: 'Certificado SSL', desc: 'Segurança HTTPS para o seu site', bg: 'bg-emerald-50', text: 'text-emerald-600', tags: 'ssl https segurança certificado serviços', requiresLogin: false },
    { href: '/servicos/email', icon: Mail, title: 'Email Profissional', desc: 'Email com o seu domínio personalizado', bg: 'bg-violet-50', text: 'text-violet-600', tags: 'email profissional correio caixa serviços', requiresLogin: false },
    { href: '/servicos/suporte', icon: HelpCircle, title: 'Suporte Técnico', desc: 'Assistência técnica e manutenção', bg: 'bg-sky-50', text: 'text-sky-600', tags: 'suporte ajuda assistência manutenção técnico serviços', requiresLogin: false },
    { href: '/servicos/feiras-eventos', icon: Rocket, title: 'Feiras e Eventos', desc: 'Stands, materiais e cobertura de eventos', bg: 'bg-amber-50', text: 'text-amber-600', tags: 'evento feira stand exposição conferência serviços', requiresLogin: false },

    // Preços
    { href: '/precos', icon: FileText, title: 'Preços', desc: 'Tabela de preços e planos disponíveis', bg: 'bg-yellow-50', text: 'text-yellow-600', tags: 'preço plano custo valor tabela', requiresLogin: false },
    { href: '/precos/dominios', icon: Globe, title: 'Preços de Domínios', desc: 'Tabela de preços de registo de domínios', bg: 'bg-teal-50', text: 'text-teal-600', tags: 'preço domínio custo', requiresLogin: false },
    { href: '/precos/hospedagem', icon: Server, title: 'Preços de Hospedagem', desc: 'Planos de alojamento web', bg: 'bg-blue-50', text: 'text-blue-600', tags: 'preço hosting plano servidor', requiresLogin: false },
    { href: '/precos/email', icon: Mail, title: 'Preços de Email', desc: 'Planos de email profissional', bg: 'bg-violet-50', text: 'text-violet-600', tags: 'preço email plano correio', requiresLogin: false },
    { href: '/precos/ssl', icon: Shield, title: 'Preços de SSL', desc: 'Planos de certificados SSL', bg: 'bg-emerald-50', text: 'text-emerald-600', tags: 'preço ssl certificado', requiresLogin: false },

    // Conta
    { href: '/auth/login', icon: User, title: 'Login', desc: 'Aceder à sua conta', bg: 'bg-slate-50', text: 'text-slate-600', tags: 'entrar aceder conta', requiresLogin: false },

    // Área do Cliente (requer login)
    { href: '/client', icon: Lock, title: 'Painel do Cliente', desc: 'Gerir a sua conta e serviços', bg: 'bg-slate-100', text: 'text-slate-700', tags: 'painel dashboard conta cliente', requiresLogin: true },
    { href: '/client/domains', icon: Lock, title: 'Meus Domínios', desc: 'Gerir os seus domínios registados', bg: 'bg-teal-50', text: 'text-teal-700', tags: 'domínios meus gerir dns', requiresLogin: true },
    { href: '/admin', icon: Lock, title: 'Administração', desc: 'Painel de administração', bg: 'bg-red-50', text: 'text-red-700', tags: 'admin painel gestão administração', requiresLogin: true },
  ]

  const isSearching = searchQuery.trim().length > 0

  const searchResults = allSearchableItems.filter(item => {
    const q = searchQuery.toLowerCase()
    return (
      item.title.toLowerCase().includes(q) ||
      item.desc.toLowerCase().includes(q) ||
      (item.tags && item.tags.toLowerCase().includes(q))
    )
  })

  const handleItemClick = (item: typeof allSearchableItems[0]) => {
    if (item.requiresLogin) {
      router.push(`/auth/login?from=${encodeURIComponent(item.href)}`)
    } else {
      router.push(item.href)
    }
    setShowLaunchpad(false)
    setSearchQuery('')
  }

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY

      // Esconde a barra preta quando scrolla para baixo
      if (currentScrollY > lastScrollY && currentScrollY > 50) {
        setShowTopBar(false)
        setShowLaunchpad(false)
      } else {
        // Mostra quando scrolla para cima
        setShowTopBar(true)
      }

      setLastScrollY(currentScrollY)
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (launchpadRef.current && !launchpadRef.current.contains(event.target as Node)) {
        setShowLaunchpad(false)
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    document.addEventListener('mousedown', handleClickOutside)

    return () => {
      window.removeEventListener('scroll', handleScroll)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [lastScrollY])

  return (
    <>
      {/* Top Menu Bar - Esconde ao scrollar para baixo, mostra ao scrollar para cima */}
      <div
        className={`fixed left-0 right-0 z-[60] bg-black h-[40px] flex items-center transition-transform duration-300 shadow-lg ${showTopBar ? 'translate-y-0 top-0' : '-translate-y-full top-0'
          }`}
      >
        <div className="max-w-7xl mx-auto w-full px-4 flex justify-between items-center h-full">
          {/* Coluna Esquerda: Menu inspirado na imagem */}
          <div className="flex items-center gap-3">
            <Link href="/servicos" className="text-slate-300 text-xs font-bold hover:text-red-500 transition-colors flex items-center gap-1">
              <Grid className="w-3.5 h-3.5" />
              Todos os produtos
            </Link>
            <div className="h-3 w-px bg-slate-700"></div>

            <Link href="/servicos/suporte" className="text-slate-300 text-xs hover:text-red-500 transition-colors flex items-center gap-1">
              <HelpCircle className="w-3.5 h-3.5" />
              FAQ
            </Link>

            {/* Launchpad com Modal Centralizado */}
            <div className="relative">
              <button
                onClick={() => setShowLaunchpad(!showLaunchpad)}
                className={`text-slate-300 text-xs hover:text-red-500 transition-colors flex items-center gap-1 ${showLaunchpad ? 'text-red-500' : ''}`}
              >
                <Rocket className="w-3.5 h-3.5" />
                Launchpad
              </button>

              {showLaunchpad && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center">
                  {/* Fundo Transparente sem Desfoque */}
                  <div
                    className="absolute inset-0 bg-black/40"
                    onClick={() => setShowLaunchpad(false)}
                  />

                  {/* Modal Centralizado (Layout Claro) */}
                  <div ref={launchpadRef} className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col">

                    {/* Barra de Pesquisa */}
                    <div className="p-6 border-b border-slate-300 bg-slate-50">
                      <div className="flex items-center gap-3 px-3 py-2 bg-white rounded-xl border border-slate-200">
                        <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                          type="text"
                          placeholder="Encontra qualquer coisa no VisualDesign"
                          className="bg-transparent border-none outline-none text-slate-800 text-sm flex-1 placeholder-slate-400"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          autoFocus
                        />
                      </div>
                    </div>

                    {/* Grelha de Apps */}
                    <div className="p-6 max-h-[400px] overflow-y-auto">
                      {!isSearching ? (
                        <>
                          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-4 ml-2">Acesso Rápido</p>
                          <div className="grid grid-cols-2 gap-4">
                            {quickAccessItems.map((item, index) => (
                              <button 
                                key={index}
                                onClick={() => handleItemClick(item)}
                                className="flex items-center gap-4 hover:bg-slate-50 p-4 rounded-xl transition-all duration-200 group border border-transparent hover:border-slate-200 hover:shadow-sm text-left"
                              >
                                <div className={`w-12 h-12 ${item.bg} rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform`}>
                                  <item.icon className={`w-6 h-6 ${item.text}`} />
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-base font-bold text-slate-800 group-hover:text-red-600 transition-colors">{item.title}</span>
                                  <span className="text-slate-500 text-sm mt-0.5">{item.desc}</span>
                                </div>
                              </button>
                            ))}
                          </div>
                        </>
                      ) : searchResults.length > 0 ? (
                        <div className="grid grid-cols-2 gap-3">
                          {searchResults.map((item, index) => (
                            <button
                              key={index}
                              onClick={() => handleItemClick(item)}
                              className="flex items-center gap-4 hover:bg-slate-50 p-4 rounded-xl transition-all duration-200 group border border-transparent hover:border-slate-200 hover:shadow-sm text-left"
                            >
                              <div className={`w-12 h-12 ${item.bg} rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform`}>
                                <item.icon className={`w-6 h-6 ${item.text}`} />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-base font-bold text-slate-800 group-hover:text-red-600 transition-colors flex items-center gap-1.5">
                                  {item.title}
                                  {item.requiresLogin && <Lock className="w-3 h-3 text-slate-400" />}
                                </span>
                                <span className="text-slate-500 text-sm mt-0.5">
                                  {item.requiresLogin ? 'Requer login para aceder' : item.desc}
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                          <svg className="w-10 h-10 mb-3 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                          <p className="text-sm font-medium">Nenhum resultado para &quot;{searchQuery}&quot;</p>
                          <p className="text-xs mt-1">Tente outro termo de pesquisa</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>,
                document.body
              )}
            </div>
          </div>


          {/* Coluna Direita: Ícones limpos com tooltips instantâneos */}
          <div className="flex items-center gap-5">
            <Link href="/client/domains" className="text-slate-300 hover:text-red-500 transition-colors relative group">
              <Globe className="w-4 h-4" />
              <span className="absolute top-full mt-2 right-0 md:left-1/2 md:-translate-x-1/2 whitespace-nowrap w-max bg-slate-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">Meus Domínios</span>
            </Link>

            <Link href="/client/notificacoes" className="text-slate-300 hover:text-red-500 transition-colors relative group">
              <Bell className="w-4 h-4" />
              {/* Exemplo de badge de notificação */}
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              <span className="absolute top-full mt-2 right-0 md:left-1/2 md:-translate-x-1/2 whitespace-nowrap w-max bg-slate-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">Notificações</span>
            </Link>

            <button
              onClick={() => setIsCartOpen(true)}
              className="text-slate-300 hover:text-red-500 transition-colors relative group"
            >
              <ShoppingCart className="w-4 h-4" />
              {items.length > 0 && (
                <span className="absolute -top-2 -right-2 inline-flex items-center justify-center w-4 h-4 text-[9px] font-bold text-white bg-red-600 border border-black rounded-full">
                  {items.length}
                </span>
              )}
              <span className="absolute top-full mt-2 right-0 md:left-1/2 md:-translate-x-1/2 whitespace-nowrap w-max bg-slate-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">Carrinho de Compras</span>
            </button>

            <Link href="/auth/login" className="text-slate-300 hover:text-red-500 transition-colors ml-2 relative group">
              <User className="w-4 h-4" />
              <span className="absolute top-full mt-2 right-0 md:left-1/2 md:-translate-x-1/2 whitespace-nowrap w-max bg-slate-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">Minha Conta</span>
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
