'use client'

/**
 * Verificação "não sou um robô" da Cloudflare (Turnstile) no formulário de registo (pedido do Silva, 14/10/2026).
 * A chave do site é pública (fica aqui, ou em NEXT_PUBLIC_TURNSTILE_SITE_KEY); a chave secreta só existe no servidor
 * (TURNSTILE_SECRET_KEY, segredo do GitHub posto no .env.local pela publicação) e é ela que confirma o resultado em
 * /api/auth/register. Em localhost usa a chave de teste da Cloudflare, que passa sempre (a chave real só funciona nos
 * domínios escolhidos no painel da Cloudflare).
 */
import { useEffect, useRef } from 'react'

const CHAVE_SITE = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '0x4AAAAAABeK1sQwCUjnaB9W'
const CHAVE_TESTE = '1x00000000000000000000AA'
const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

type Opcoes = {
  sitekey: string
  theme: 'light' | 'dark' | 'auto'
  language: string
  size: 'normal' | 'flexible' | 'compact'
  callback: (token: string) => void
  'expired-callback': () => void
  'error-callback': () => void
}
type Api = { render: (el: HTMLElement, o: Opcoes) => string; remove: (id: string) => void }
declare global {
  interface Window {
    turnstile?: Api
  }
}

let carregar: Promise<Api> | null = null
function api(): Promise<Api> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  if (!carregar)
    carregar = new Promise((ok, falha) => {
      const s = document.createElement('script')
      s.src = SCRIPT
      s.async = true
      s.onload = () => (window.turnstile ? ok(window.turnstile) : falha(new Error('turnstile')))
      s.onerror = () => {
        carregar = null
        falha(new Error('turnstile'))
      }
      document.head.appendChild(s)
    })
  return carregar
}

export function Turnstile({ onToken, lang = 'pt' }: { onToken: (token: string) => void; lang?: string }) {
  const caixa = useRef<HTMLDivElement>(null)
  const aviso = useRef(onToken)
  aviso.current = onToken

  useEffect(() => {
    let id = ''
    let vivo = true
    const local = /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname)
    api()
      .then((t) => {
        if (!vivo || !caixa.current) return
        id = t.render(caixa.current, {
          sitekey: local && !process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ? CHAVE_TESTE : CHAVE_SITE,
          theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
          language: lang === 'en' ? 'en' : 'pt-br',
          size: 'flexible',
          callback: (token) => aviso.current(token),
          'expired-callback': () => aviso.current(''),
          'error-callback': () => aviso.current(''),
        })
      })
      .catch(() => aviso.current(''))
    return () => {
      vivo = false
      if (id) window.turnstile?.remove(id)
    }
  }, [lang])

  return <div ref={caixa} className="min-h-[65px] w-full" />
}
