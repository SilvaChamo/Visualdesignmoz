'use client'

/**
 * Página de login do site dividida ao meio (pedido do Silva, 13/10/2026): à esquerda uma imagem com a mensagem da
 * VisualDesign, à direita o formulário; no canto de cima à direita os mesmos botões da entrada do painel, no mesmo sítio
 * (modo claro · automático · escuro e a língua — src/components/vhost/entrada.tsx, TopoEntrada). No telemóvel e no
 * tablet a imagem sai e fica só o formulário. No escuro, as cores do tema escuro do painel (o fundo é a parte mais escura
 * dele, --bg #15161e; linhas #393e4d; caixas #272a34).
 */
import { useEffect, useRef, useState } from 'react'
import { Contrast, Globe, Mail, Moon, Server, Sun, type LucideIcon } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { useI18n } from '@/lib/i18n'

/** as mesmas chaves que a entrada do painel lê (entrada.tsx: modo do tema e LINGUA_LS) — o painel abre igual */
const MODO_LS = 'visualhost_theme'
const LINGUA_LS = 'visualhost_lang'

type Modo = 'light' | 'auto' | 'dark'

/** Duas versões do logótipo no computador, para o Silva escolher (13/10/2026): 1 = aba branca a entrar pela foto
 *  (/login); 2 = logótipo branco no canto da foto com uma linha branca de 12 px encostada à esquerda (/login?modelo=2) */
export function LoginDividido({ children, modelo = 1 }: { children: React.ReactNode; modelo?: 1 | 2 }) {
  const { t } = useI18n()
  const itens: [LucideIcon, string][] = [
    [Server, t('login.heroFeat1')],
    [Globe, t('login.heroFeat2')],
    [Mail, t('login.heroFeat3')],
  ]
  return (
    <div className="login-dividido font-panel relative grid min-h-screen bg-[#fff] text-zinc-900 transition-colors duration-300 dark:bg-[#15161e] dark:text-zinc-100 lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-zinc-950 lg:sticky lg:top-0 lg:block lg:h-screen">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/design_grafico_branding.jpg" alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/25" />
        <div className="absolute inset-0 bg-gradient-to-br from-red-800/35 via-transparent to-transparent" />

        {modelo === 2 && (
          <>
            {/* a linha fica à altura do desenho do logótipo (a imagem tem ~6 px vazios em cima e em baixo) */}
            <span aria-hidden className="absolute left-0 top-[42px] h-[46px] w-[12px] bg-[#fff]" />
            <a href="/" className="absolute left-10 top-9 transition-opacity hover:opacity-85" title="VisualDesign">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/assets/Logo_horizontal_branco.png" alt="VisualDesign" className="h-[58px] w-auto" />
            </a>
          </>
        )}

        <div className="absolute inset-x-[clamp(24px,2.8vw,40px)] bottom-[clamp(24px,2.8vw,40px)] max-w-[540px] text-white">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium ring-1 ring-white/20 backdrop-blur">
            {/* o ponto pisca devagar, como "no ar" (pedido do Silva, 13/10/2026) */}
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75 motion-reduce:animate-none" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
            </span>
            {t('login.heroTag')}
          </span>
          <h2 className="mt-4 text-[clamp(24px,2.36vw,34px)] font-semibold leading-[1.15] tracking-tight">{t('login.heroTitle')}</h2>
          <p className="mt-3 max-w-[460px] text-[clamp(13px,1.05vw,15px)] leading-relaxed text-white/75">{t('login.heroText')}</p>
          <ul className="mt-[clamp(18px,1.95vw,28px)] grid grid-cols-3 gap-3">
            {itens.map(([Icone, texto]) => (
              <li key={texto} className="flex items-center gap-2.5 rounded-lg bg-white/[0.07] px-3 py-2.5 text-[clamp(11.5px,0.9vw,13px)] leading-snug text-white/90 ring-1 ring-white/10 backdrop-blur">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-red-600/90 text-white">
                  <Icone className="h-4 w-4" strokeWidth={2} aria-hidden />
                </span>
                {texto}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <section className="relative flex min-h-screen flex-col">
        {modelo === 1 && <AbaLogo />}
        <BotoesCanto />
        <div className="flex flex-1 items-center justify-center px-6 pb-10 pt-8 lg:pt-20">
          {/* a largura acompanha o ecrã: 400 px a 1440, vai reduzindo aos poucos até 340 px a 1024 */}
          <div className="w-full max-w-[400px] lg:max-w-[clamp(340px,27.8vw,420px)]">
            {/* no telemóvel e no tablet não há foto: o logótipo fica por cima do formulário, grande e junto ao título
                (a imagem tem ~13% de margem vazia em cima e em baixo) */}
            <a href="/" className="-mb-1 -mt-3 flex justify-center lg:hidden" title="VisualDesign">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/assets/logotype.png" alt="VisualDesign" className="h-[124px] w-auto object-contain dark:hidden" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/assets/logotipoII.png" alt="VisualDesign" className="hidden h-[124px] w-auto object-contain dark:block" />
            </a>
            {children}
          </div>
        </div>
        <footer className="pb-6 text-center text-xs text-zinc-400 dark:text-zinc-500">
          © {new Date().getFullYear()} VisualDesign ·{' '}
          <a href="/termos" className="hover:text-zinc-600 dark:hover:text-zinc-300">
            {t('login.terms')}
          </a>{' '}
          ·{' '}
          <a href="/privacidade" className="hover:text-zinc-600 dark:hover:text-zinc-300">
            {t('login.privacy')}
          </a>
        </footer>
      </section>

      <div className="fixed bottom-0 left-0 right-0 z-50 h-[3px]" style={{ background: 'linear-gradient(90deg, #7f0000, #cc0000, #7f0000)' }} />
    </div>
  )
}

/** No computador, o fundo do formulário entra pela foto dentro na divisão, como uma aba, com o logótipo (pedido do Silva,
 *  13/10/2026, sobre o modelo de um menu com o item escolhido ligado ao conteúdo): arredondada (10 px) só do lado esquerdo,
 *  dentro da foto; do lado direito, onde se junta ao fundo, nada — passa 16 px por baixo do fundo, sem sombra, para nunca
 *  aparecer uma linha na junção (nem no claro nem no escuro). A 50 px do início da página; o tamanho acompanha o ecrã. */
function AbaLogo() {
  return (
    <a
      href="/"
      title="VisualDesign"
      className="absolute right-[calc(100%-16px)] top-[50px] z-10 hidden h-[clamp(56px,5vw,72px)] w-[calc(clamp(184px,16.7vw,240px)+48px)] items-center rounded-l-[10px] bg-[#fff] pl-4 pr-8 dark:bg-[#15161e] lg:flex"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/assets/logo-entrada.jpg" alt="VisualDesign" className="h-auto w-[clamp(184px,16.7vw,240px)] dark:hidden" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/assets/logo-entrada-escuro.png" alt="VisualDesign" className="hidden h-auto w-[clamp(184px,16.7vw,240px)] dark:block" />
    </a>
  )
}

/** Canto de cima à direita: modo claro · automático · escuro e a língua, com as medidas da entrada do painel. No
 *  telemóvel e no tablet (sem a imagem) ficam ao centro, num cabeçalho com uma linha por baixo (pedido do Silva) */
function BotoesCanto() {
  const { theme, setTheme } = useTheme()
  const { lang, toggleLang } = useI18n()
  const [modo, setModo] = useState<Modo>('light')
  const [linguas, setLinguas] = useState(false)
  const caixa = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let auto = false
    try {
      auto = localStorage.getItem(MODO_LS) === 'auto'
    } catch {}
    setModo(auto ? 'auto' : theme)
  }, [theme])

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

  const escolherModo = (m: Modo) => {
    setModo(m)
    const escuro = m === 'dark' || (m === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    setTheme(escuro ? 'dark' : 'light')
    try {
      localStorage.setItem(MODO_LS, m)
    } catch {}
  }
  const escolherLingua = (l: 'pt' | 'en') => {
    if (l !== lang) toggleLang()
    try {
      localStorage.setItem(LINGUA_LS, l)
    } catch {}
    setLinguas(false)
  }

  const modos: [Modo, LucideIcon, string][] = [
    ['light', Sun, lang === 'en' ? 'Light' : 'Claro'],
    ['auto', Contrast, lang === 'en' ? 'Auto' : 'Automático'],
    ['dark', Moon, lang === 'en' ? 'Dark' : 'Escuro'],
  ]
  return (
    <div className="relative z-20 flex items-center justify-center gap-6 border-b border-zinc-200 px-4 py-3 dark:border-[#393e4d] sm:gap-[34px] lg:absolute lg:right-4 lg:top-[10px] lg:justify-end lg:border-0 lg:p-0">
      <div className="relative flex items-center gap-[14px]" role="radiogroup" aria-label={lang === 'en' ? 'Theme' : 'Tema'}>
        <span aria-hidden className="absolute left-[18px] right-[18px] top-1/2 h-px bg-zinc-900/20 dark:bg-white/25" />
        {modos.map(([m, Icone, nome]) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={modo === m}
            onClick={() => escolherModo(m)}
            title={nome}
            aria-label={nome}
            className={
              'relative grid h-[34px] w-[34px] place-items-center rounded-full transition-colors ' +
              (modo === m
                ? 'bg-red-600 text-white shadow-[0_0_0_3px_rgba(220,38,38,0.3)]'
                : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-[#272a34] dark:text-zinc-200 dark:hover:bg-[#303440]')
            }
          >
            <Icone className="h-[15px] w-[15px]" strokeWidth={2.25} aria-hidden />
          </button>
        ))}
      </div>
      <div className="relative" ref={caixa}>
        <button
          type="button"
          onClick={() => setLinguas(!linguas)}
          aria-expanded={linguas}
          className="inline-flex items-center gap-2 text-[15px] text-zinc-800 hover:text-zinc-950 dark:text-zinc-200 dark:hover:text-white"
        >
          <Globe className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
          {lang === 'en' ? 'English' : 'Português'}
        </button>
        {linguas && (
          <div className="absolute right-0 top-[calc(100%+12px)] z-30 w-[180px] overflow-hidden rounded-[10px] border border-red-600 lg:right-[-16px] lg:rounded-r-none lg:border-r-0 bg-[#fff] shadow-[0_14px_34px_rgba(0,0,0,0.22)] dark:bg-[#272a34]">
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
                className={'block w-full px-4 py-[11px] text-left text-[14.5px] text-red-600 hover:bg-red-600/[0.08] ' + (lang === k ? 'bg-red-600/[0.16]' : '')}
              >
                {nome}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
