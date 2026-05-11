'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '@/lib/i18n'
import { Globe, User, Bell, ShoppingCart, HelpCircle, BookOpen, Rocket, Server, CreditCard, Shield } from 'lucide-react'
import Link from 'next/link'

export function Navbar() {
  const { t } = useI18n()
  const [showTopBar, setShowTopBar] = useState(true)
  const [lastScrollY, setLastScrollY] = useState(0)
  const [showLaunchpad, setShowLaunchpad] = useState(false)
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
              Todos os produtos
            </Link>
            <div className="h-3 w-px bg-slate-700"></div>

            <Link href="/servicos/suporte" className="text-slate-300 text-xs hover:text-red-500 transition-colors flex items-center gap-1">
              <HelpCircle className="w-3.5 h-3.5" />
              Perguntas Frequentes
            </Link>

            <Link href="/servicos" className="text-slate-300 text-xs hover:text-red-500 transition-colors flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5" />
              Biblioteca
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
                  {/* Fundo Preto Transparente (Backdrop) */}
                  <div
                    className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                    onClick={() => setShowLaunchpad(false)}
                  />

                  {/* Modal Centralizado */}
                  <div className="relative w-full max-w-2xl bg-[#1E1E24] border border-zinc-700/50 rounded-2xl shadow-2xl overflow-hidden flex flex-col">

                    {/* Barra de Pesquisa Simulada */}
                    <div className="p-4 border-b border-zinc-800/50">
                      <div className="flex items-center gap-3 px-4 py-3 bg-black/20 rounded-xl border border-zinc-800">
                        <svg className="w-5 h-5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                          type="text"
                          placeholder="Encontra qualquer coisa no VisualDesign"
                          className="bg-transparent border-none outline-none text-zinc-300 text-base flex-1 placeholder-zinc-600"
                          readOnly
                        />
                        <div className="flex items-center gap-1">
                          <kbd className="px-2 py-1 bg-zinc-800 rounded border border-zinc-700 text-xs text-zinc-400 font-mono">/</kbd>
                          <span className="text-zinc-600 text-xs">ou</span>
                          <kbd className="px-2 py-1 bg-zinc-800 rounded border border-zinc-700 text-xs text-zinc-400 font-mono">⌘+K</kbd>
                        </div>
                      </div>
                    </div>

                    {/* Grelha de Apps (2 Colunas e 2 Linhas) */}
                    <div className="p-6">
                      <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-4 ml-2">Acesso Rápido</p>
                      <div className="grid grid-cols-2 gap-4">
                        {/* Item 1 */}
                        <Link href="/servicos" onClick={() => setShowLaunchpad(false)} className="flex items-center gap-4 hover:bg-zinc-800/50 p-4 rounded-xl transition-all duration-200 group border border-transparent hover:border-zinc-700/50">
                          <div className="w-12 h-12 bg-[#00A99D]/10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                            <Globe className="w-6 h-6 text-[#00A99D]" />
                          </div>
                          <div className="flex flex-col text-left">
                            <span className="text-base font-bold text-zinc-100 group-hover:text-white transition-colors">Gestor de Domínios</span>
                            <span className="text-zinc-500 text-sm mt-0.5">Gerir os seus domínios</span>
                          </div>
                        </Link>

                        {/* Item 2 */}
                        <Link href="/servicos" onClick={() => setShowLaunchpad(false)} className="flex items-center gap-4 hover:bg-zinc-800/50 p-4 rounded-xl transition-all duration-200 group border border-transparent hover:border-zinc-700/50">
                          <div className="w-12 h-12 bg-[#2D9CDB]/10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                            <Server className="w-6 h-6 text-[#2D9CDB]" />
                          </div>
                          <div className="flex flex-col text-left">
                            <span className="text-base font-bold text-zinc-100 group-hover:text-white transition-colors">Gestor de Alojamento</span>
                            <span className="text-zinc-500 text-sm mt-0.5">Hospedagem CPanel</span>
                          </div>
                        </Link>

                        {/* Item 3 */}
                        <Link href="/servicos/suporte" onClick={() => setShowLaunchpad(false)} className="flex items-center gap-4 hover:bg-zinc-800/50 p-4 rounded-xl transition-all duration-200 group border border-transparent hover:border-zinc-700/50">
                          <div className="w-12 h-12 bg-[#9B51E0]/10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                            <Shield className="w-6 h-6 text-[#9B51E0]" />
                          </div>
                          <div className="flex flex-col text-left">
                            <span className="text-base font-bold text-zinc-100 group-hover:text-white transition-colors">DNS Avançado</span>
                            <span className="text-zinc-500 text-sm mt-0.5">Registos e Zonas</span>
                          </div>
                        </Link>

                        {/* Item 4 */}
                        <Link href="/servicos" onClick={() => setShowLaunchpad(false)} className="flex items-center gap-4 hover:bg-zinc-800/50 p-4 rounded-xl transition-all duration-200 group border border-transparent hover:border-zinc-700/50">
                          <div className="w-12 h-12 bg-[#F2994A]/10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                            <CreditCard className="w-6 h-6 text-[#F2994A]" />
                          </div>
                          <div className="flex flex-col text-left">
                            <span className="text-base font-bold text-zinc-100 group-hover:text-white transition-colors">Faturas e Pagamentos</span>
                            <span className="text-zinc-500 text-sm mt-0.5">Histórico e Pendentes</span>
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


          {/* Coluna Direita: Ícones limpos */}
          <div className="flex items-center gap-4">
            <button className="text-slate-300 hover:text-red-500 transition-colors">
              <Globe className="w-4 h-4" />
            </button>
            <button className="text-slate-300 hover:text-red-500 transition-colors">
              <Bell className="w-4 h-4" />
            </button>
            <button className="text-slate-300 hover:text-red-500 transition-colors">
              <ShoppingCart className="w-4 h-4" />
            </button>
            <Link href="/auth/login" className="text-slate-300 hover:text-red-500 transition-colors">
              <User className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
