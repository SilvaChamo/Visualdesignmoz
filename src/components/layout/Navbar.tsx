'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '@/lib/i18n'
import { Globe, User, Bell, ShoppingCart, HelpCircle, Rocket, Server, CreditCard, Shield, Grid, Layers, Package, BookOpen } from 'lucide-react'
import Link from 'next/link'
import { useCart } from '@/contexts/CartContext'

export function Navbar() {
  const { t } = useI18n()
  const { items, setIsCartOpen } = useCart()
  const [showLaunchpad, setShowLaunchpad] = useState(false)
  const [showTopBar, setShowTopBar] = useState(true)
  const [lastScrollY, setLastScrollY] = useState(0)
  const launchpadRef = useRef<HTMLDivElement>(null)

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
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 flex justify-between items-center h-full">
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

                    {/* Barra de Pesquisa Simulada */}
                    <div className="p-4 border-b border-slate-100">
                      <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-xl border border-slate-200">
                        <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                          type="text"
                          placeholder="Encontra qualquer coisa no VisualDesign"
                          className="bg-transparent border-none outline-none text-slate-800 text-base flex-1 placeholder-slate-400"
                          readOnly
                        />
                        <div className="flex items-center gap-1">
                          <kbd className="px-2 py-1 bg-white rounded border border-slate-200 text-xs text-slate-500 font-mono shadow-sm">/</kbd>
                          <span className="text-slate-400 text-xs">ou</span>
                          <kbd className="px-2 py-1 bg-white rounded border border-slate-200 text-xs text-slate-500 font-mono shadow-sm">⌘+K</kbd>
                        </div>
                      </div>
                    </div>

                    {/* Grelha de Apps (2 Colunas e 2 Linhas) */}
                    <div className="p-6">
                      <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-4 ml-2">Acesso Rápido</p>
                      <div className="grid grid-cols-2 gap-4">
                        {/* Item 1 */}
                        <Link href="/client/domains" onClick={() => setShowLaunchpad(false)} className="flex items-center gap-4 hover:bg-slate-50 p-4 rounded-xl transition-all duration-200 group border border-transparent hover:border-slate-200 hover:shadow-sm">
                          <div className="w-12 h-12 bg-teal-50 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                            <Globe className="w-6 h-6 text-teal-600" />
                          </div>
                          <div className="flex flex-col text-left">
                            <span className="text-base font-bold text-slate-800 group-hover:text-red-600 transition-colors">Gestor de Domínios</span>
                            <span className="text-slate-500 text-sm mt-0.5">Gerir os seus domínios</span>
                          </div>
                        </Link>

                        {/* Item 2 */}
                        <Link href="/servicos/hospedagem" onClick={() => setShowLaunchpad(false)} className="flex items-center gap-4 hover:bg-slate-50 p-4 rounded-xl transition-all duration-200 group border border-transparent hover:border-slate-200 hover:shadow-sm">
                          <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                            <Server className="w-6 h-6 text-blue-600" />
                          </div>
                          <div className="flex flex-col text-left">
                            <span className="text-base font-bold text-slate-800 group-hover:text-red-600 transition-colors">Gestor de Alojamento</span>
                            <span className="text-slate-500 text-sm mt-0.5">Hospedagem CPanel</span>
                          </div>
                        </Link>

                        {/* Item 3 */}
                        <Link href="/client/domains" onClick={() => setShowLaunchpad(false)} className="flex items-center gap-4 hover:bg-slate-50 p-4 rounded-xl transition-all duration-200 group border border-transparent hover:border-slate-200 hover:shadow-sm">
                          <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                            <Shield className="w-6 h-6 text-purple-600" />
                          </div>
                          <div className="flex flex-col text-left">
                            <span className="text-base font-bold text-slate-800 group-hover:text-red-600 transition-colors">DNS Avançado</span>
                            <span className="text-slate-500 text-sm mt-0.5">Registos e Zonas</span>
                          </div>
                        </Link>

                        {/* Item 4 */}
                        <Link href="/notificacoes" onClick={() => setShowLaunchpad(false)} className="flex items-center gap-4 hover:bg-slate-50 p-4 rounded-xl transition-all duration-200 group border border-transparent hover:border-slate-200 hover:shadow-sm">
                          <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                            <CreditCard className="w-6 h-6 text-orange-600" />
                          </div>
                          <div className="flex flex-col text-left">
                            <span className="text-base font-bold text-slate-800 group-hover:text-red-600 transition-colors">Faturas e Pagamentos</span>
                            <span className="text-slate-500 text-sm mt-0.5">Histórico e Pendentes</span>
                          </div>
                        </Link>
                      </div>
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
