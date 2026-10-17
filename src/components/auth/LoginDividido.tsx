'use client'

/**
 * Página de login do site dividida ao meio (pedido do Silva, 13/10/2026): à esquerda uma imagem com a mensagem da
 * VisualDesign, à direita o formulário; no canto de cima à direita os mesmos botões da entrada do painel, no mesmo sítio
 * (modo claro · automático · escuro e a língua — src/components/vhost/entrada.tsx, TopoEntrada). No telemóvel e no
 * tablet a foto fica por trás, a ocupar o ecrã, com o formulário ao centro por cima dela (Silva, 14/10/2026: o
 * formulário sempre ao centro e com a imagem, em todos os aparelhos). No escuro, as cores do tema escuro do painel (o fundo é a parte mais escura
 * dele, --bg #15161e; linhas #393e4d; caixas #272a34).
 */
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { Contrast, Globe, Mail, Moon, Server, Sun, type LucideIcon } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { useI18n } from '@/lib/i18n'

/** as mesmas chaves que a entrada do painel lê (entrada.tsx: modo do tema e LINGUA_LS) — o painel abre igual */
const MODO_LS = 'visualhost_theme'
const LINGUA_LS = 'visualhost_lang'

type Modo = 'light' | 'auto' | 'dark'

/** O modelo aprovado (Silva, 13/10/2026): no computador, a aba branca com o logótipo a entrar pela foto. Montado uma
 *  só vez pelo layout de src/app/(entrada) — as quatro páginas de entrada trocam só o conteúdo do cartão */
export function LoginDividido({ children }: { children: React.ReactNode }) {
  const { t } = useI18n()
  const itens: [LucideIcon, string][] = [
    [Server, t('login.heroFeat1')],
    [Globe, t('login.heroFeat2')],
    [Mail, t('login.heroFeat3')],
  ]
  return (
    <div className="login-dividido font-panel relative grid min-h-screen bg-[#fff] text-zinc-900 transition-colors duration-300 dark:bg-[#15161e] dark:text-zinc-100 lg:grid-cols-2">
      <aside className="fixed inset-0 bg-zinc-950 lg:sticky lg:inset-auto lg:top-0 lg:h-screen">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/design_grafico_branding.jpg" alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/25" />
        <div className="absolute inset-0 bg-gradient-to-br from-red-800/35 via-transparent to-transparent" />
        <FaixaBranca />

        <div className="absolute inset-x-[clamp(24px,2.8vw,40px)] bottom-[clamp(24px,2.8vw,40px)] hidden max-w-[540px] text-white lg:block">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium ring-1 ring-white/20 backdrop-blur">
            <span aria-hidden className="vd-ponto-vivo inline-flex h-2 w-2 rounded-full bg-red-500" />
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

      <section className="relative z-10 flex min-h-screen flex-col">
        <AbaLogo />
        <BotoesCanto />
        {/* o cartão fica ao centro do ecrã, à altura do meio da foto: o cabeçalho e o rodapé não ocupam espaço (estão
            por cima), só deixam folga em cima e em baixo. A sombra é igual à volta (sem cair para baixo), senão o cartão
            parecia mais baixo do que está (Silva, 14/10/2026) */}
        <div className="flex flex-1 items-center justify-center px-4 py-[76px] sm:px-6 lg:py-10">
          {/* a largura acompanha o ecrã (Silva, 14/10/2026: mais pequeno, menos "agressivo"): o formulário tem 340 px a
              1440 e vai reduzindo aos poucos até 300 px a 1024; o espaço de dentro do cartão acompanha também */}
          <div className="w-full max-w-[380px] lg:max-w-[calc(clamp(300px,23.6vw,360px)+clamp(44px,3.9vw,60px)+2px)]">
            <div className="rounded-[10px] bg-[#fff] px-5 pb-6 pt-5 shadow-[0_0_60px_-18px_rgba(0,0,0,0.6)] dark:bg-[#15161e] lg:border lg:border-zinc-200 lg:px-[clamp(22px,1.95vw,30px)] lg:pb-[clamp(24px,2.2vw,32px)] lg:pt-[clamp(22px,1.95vw,28px)] lg:shadow-[0_0_36px_-10px_rgba(24,24,27,0.18)] lg:dark:border-[#2a2d3a] lg:dark:shadow-[0_0_36px_-10px_rgba(0,0,0,0.7)]">
              {/* no telemóvel e no tablet o logótipo fica no cartão, por cima do título (a imagem tem ~13% de margem
                  vazia em cima e em baixo); no computador está na aba da foto */}
              <Link href="/" className="-mt-2 mb-1 flex justify-center lg:hidden" title="VisualDesign">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/assets/logotype.png" alt="VisualDesign" className="h-[84px] w-auto object-contain dark:hidden" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/assets/logotipoII.png" alt="VisualDesign" className="hidden h-[84px] w-auto object-contain dark:block" />
              </Link>
              {children}
            </div>
          </div>
        </div>
        <footer className="absolute inset-x-0 bottom-0 pb-5 text-center text-xs text-white/70 lg:text-zinc-400 lg:dark:text-zinc-500">
          © {new Date().getFullYear()} VisualDesign ·{' '}
          <Link href="/termos" className="hover:text-white lg:hover:text-zinc-600 lg:dark:hover:text-zinc-300">
            {t('login.terms')}
          </Link>{' '}
          ·{' '}
          <Link href="/privacidade" className="hover:text-white lg:hover:text-zinc-600 lg:dark:hover:text-zinc-300">
            {t('login.privacy')}
          </Link>
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
    <Link
      href="/"
      title="VisualDesign"
      className="absolute right-[calc(100%-16px)] top-[50px] z-10 hidden h-[clamp(56px,5vw,72px)] w-[calc(clamp(184px,16.7vw,240px)+48px)] items-center rounded-l-[10px] bg-[#fff] pl-4 pr-8 dark:bg-[#15161e] lg:flex"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/assets/logo-entrada.jpg" alt="VisualDesign" className="h-auto w-[clamp(184px,16.7vw,240px)] dark:hidden" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/assets/logo-entrada-escuro.png" alt="VisualDesign" className="hidden h-auto w-[clamp(184px,16.7vw,240px)] dark:block" />
    </Link>
  )
}

/** Por baixo da aba do logótipo, o fundo do formulário volta a entrar 16 px pela foto, quase até ao fundo, com as pontas
 *  cortadas a 45° (modelo do Silva, 13/10/2026). Fica dentro da foto, encostada à divisão, e passa 1 px para o lado
 *  do formulário: em larguras ímpares a divisão cai a meio de um píxel e via-se uma linha cinzenta na junção. */
function FaixaBranca() {
  return (
    <span
      aria-hidden
      className="absolute -right-px bottom-[15vh] top-[calc(clamp(56px,5vw,72px)+90px)] hidden w-[17px] bg-[#fff] dark:bg-[#15161e] lg:block"
      style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 calc(100% - 16px), 0 16px)' }}
    />
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
    <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-center gap-6 border-b border-zinc-200 bg-[#fff] px-4 py-3 dark:border-[#393e4d] dark:bg-[#15161e] sm:gap-[34px] lg:inset-x-auto lg:right-4 lg:top-[10px] lg:justify-end lg:border-0 lg:bg-transparent lg:p-0 lg:dark:bg-transparent">
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
