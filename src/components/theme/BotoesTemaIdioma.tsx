'use client'

import { useEffect, useRef, useState } from 'react'
import { Globe, Moon, Sun, SunMoon } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'

/** Canto superior direito do site: tema claro / automático / escuro e o menu da língua — os mesmos botões da entrada
 *  (login). Pensado para a barra preta de cima da home. */
export function BotoesTemaIdioma({ className, semIdioma }: { className?: string; semIdioma?: boolean }) {
  const { theme, system, setTheme, followSystem } = useTheme()
  const { lang, toggleLang, t } = useI18n()
  const [linguas, setLinguas] = useState(false)
  const caixa = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!linguas) return
    const fora = (e: MouseEvent) => !caixa.current?.contains(e.target as Node) && setLinguas(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setLinguas(false)
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', fora)
      document.removeEventListener('keydown', esc)
    }
  }, [linguas])

  const escolherLingua = (l: 'pt' | 'en') => {
    if (l !== lang) toggleLang()
    setLinguas(false)
  }

  const modos = [
    { k: 'light', Icone: Sun, nome: t('Tema claro'), activo: !system && theme === 'light', aplicar: () => setTheme('light') },
    { k: 'system', Icone: SunMoon, nome: t('Tema do aparelho'), activo: system, aplicar: followSystem },
    { k: 'dark', Icone: Moon, nome: t('Tema escuro'), activo: !system && theme === 'dark', aplicar: () => setTheme('dark') },
  ] as const

  return (
    <div className={cn('flex items-center gap-4', className)}>
      <div className="flex items-center" role="group" aria-label={t('Tema')}>
        {modos.map(({ k, Icone, nome, activo, aplicar }, i) => (
          <div key={k} className="flex items-center">
            {i > 0 && <span className="h-px w-2 bg-zinc-600" aria-hidden />}
            <button
              type="button"
              onClick={aplicar}
              title={nome}
              aria-label={nome}
              aria-pressed={activo}
              className={cn(
                'grid h-[26px] w-[26px] place-items-center rounded-full transition-colors',
                activo ? 'bg-red-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white',
              )}
            >
              <Icone className="h-[13px] w-[13px]" strokeWidth={2.25} aria-hidden />
            </button>
          </div>
        ))}
      </div>
      {!semIdioma && (
      <div className="relative" ref={caixa}>
        <button
          type="button"
          onClick={() => setLinguas(!linguas)}
          aria-expanded={linguas}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-300 transition-colors hover:text-red-500"
        >
          <Globe className="h-[15px] w-[15px]" strokeWidth={2} aria-hidden />
          {lang === 'en' ? 'English' : 'Português'}
        </button>
        {linguas && (
          <div className="absolute right-0 top-[calc(100%+10px)] z-[70] w-[170px] overflow-hidden rounded-[10px] border border-red-600 bg-white shadow-[0_14px_34px_rgba(0,0,0,0.22)] dark:bg-[#272a34]">
            {(
              [
                ['pt', 'Português'],
                ['en', 'English'],
              ] as const
            ).map(([k, nome]) => (
              <button
                key={k}
                type="button"
                onClick={() => escolherLingua(k)}
                className={cn(
                  'block w-full px-4 py-2.5 text-left text-[13.5px] text-red-600 hover:bg-red-600/[0.08]',
                  lang === k && 'bg-red-600/[0.16]',
                )}
              >
                {nome}
              </button>
            ))}
          </div>
        )}
      </div>
      )}
    </div>
  )
}
