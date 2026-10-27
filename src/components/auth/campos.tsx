'use client'

/**
 * Peças comuns do login e do registo no modelo dividido (LoginDividido.tsx): campos com a etiqueta que sobe para a
 * linha de cima ao clicar, o olho da palavra-passe e as classes do título e dos botões. Os tamanhos acompanham a
 * largura do ecrã (clamp): entre 1024 e 1440 px o formulário vai reduzindo aos poucos (pedido do Silva, 13/10/2026).
 * Cores com "#fff" e não "bg-white": no escuro, o site pinta de #18181b todos os .bg-white dentro de .font-panel.
 */
import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Eye, EyeOff } from 'lucide-react'
import { PAISES, separarTelefone, urlBandeira } from '@/components/auth/paises'

// título e descrição dos formulários sempre ao centro (pedido do Silva, 13/10/2026); medidas mais pequenas, menos
// "agressivas" (Silva, 14/10/2026)
export const tituloCls = 'text-center text-[clamp(20px,1.65vw,24px)] font-semibold leading-tight tracking-tight text-zinc-900 dark:text-zinc-50'
export const subtituloCls = 'mt-1.5 text-center text-[clamp(12.5px,0.95vw,14px)] text-zinc-500 dark:text-zinc-400'
/** descrição do login: um pouco mais pequena que a dos outros formulários (Silva, 27/10/2026) */
export const subtituloLoginCls = 'mt-1.5 text-balance text-center text-[clamp(11.5px,0.85vw,12.5px)] text-zinc-500 dark:text-zinc-400'
export const botaoCls =
  'inline-flex h-[clamp(38px,2.8vw,40px)] w-full items-center justify-center gap-2 rounded-md bg-red-600 text-[clamp(13.5px,0.98vw,14.5px)] font-semibold text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60'
export const botaoClaroCls =
  'inline-flex h-[clamp(38px,2.8vw,40px)] w-full items-center justify-center gap-2.5 rounded-md border border-zinc-300 bg-[#fff] text-[clamp(12.5px,0.95vw,13.5px)] font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-60 dark:border-[#393e4d] dark:bg-[#272a34] dark:text-zinc-200 dark:hover:bg-[#303440]'
/** espaço do formulário por baixo do título e entre os campos (login, registo, recuperar e nova palavra-passe) */
export const formularioCls = 'mt-[clamp(16px,1.6vw,24px)] space-y-[clamp(11px,1vw,14px)]'
export const ligacaoCls = 'text-[clamp(12.5px,0.92vw,13.5px)] font-medium text-red-600 hover:text-red-500 dark:text-red-400'

const caixaCls =
  'peer h-[clamp(38px,2.9vw,42px)] w-full rounded-md border border-zinc-300 bg-transparent px-3.5 text-center text-[clamp(13.5px,0.98vw,14.5px)] text-zinc-900 outline-none transition-colors lg:text-left ' +
  'focus:border-red-500 focus:ring-2 focus:ring-red-500/20 dark:border-[#393e4d] dark:text-zinc-100 dark:focus:border-red-500 '
const etiquetaCls =
  'pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap bg-[#fff] px-1 text-xs font-medium text-zinc-500 transition-all duration-150 lg:left-2.5 lg:translate-x-0 dark:bg-[#15161e] dark:text-zinc-400 '

/** Campo com a etiqueta a meio; ao clicar (ou já preenchido) a etiqueta sobe para a linha de cima do campo
 *  (pedido do Silva, 13/10/2026). Ao clicar o campo fica vazio, à espera de dados (sem dica dentro). No telemóvel e no
 *  tablet a etiqueta e o texto ficam ao centro. */
export function CampoFlutuante({
  id,
  rotulo,
  dica,
  type = 'text',
  autoComplete,
  minLength,
  obrigatorio = false,
  alto = false,
  value,
  onChange,
  children,
}: {
  id: string
  rotulo: string
  dica?: string
  type?: string
  autoComplete?: string
  minLength?: number
  obrigatorio?: boolean
  /** campo ligeiramente mais alto (login do site, Silva, 27/10/2026: +4 px) */
  alto?: boolean
  value: string
  onChange: (v: string) => void
  /** botão dentro do campo, à direita (ex.: o olho da palavra-passe) */
  children?: React.ReactNode
}) {
  return (
    <div className="relative">
      <input
        id={id}
        type={type}
        autoComplete={autoComplete}
        autoCapitalize="none"
        spellCheck={false}
        minLength={minLength}
        required={obrigatorio}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder=" "
        className={
          (alto ? caixaCls.replace('h-[clamp(38px,2.9vw,42px)]', 'h-[clamp(40px,3.05vw,44px)]') : caixaCls) +
          'placeholder:text-transparent ' +
          (children ? 'px-10 lg:pl-3.5' : '')
        }
      />
      <label
        htmlFor={id}
        className={
          etiquetaCls +
          'peer-placeholder-shown:top-1/2 peer-placeholder-shown:text-[clamp(13.5px,0.98vw,14.5px)] peer-placeholder-shown:font-normal ' +
          'peer-autofill:top-0 peer-autofill:text-xs peer-autofill:font-medium ' +
          'peer-focus:top-0 peer-focus:text-xs peer-focus:font-medium peer-focus:text-red-600 dark:peer-focus:text-red-400'
        }
      >
        {rotulo}
      </label>
      {children}
    </div>
  )
}

/** Escolha numa lista com a mesma etiqueta (sempre em cima, porque a lista mostra sempre um valor) */
export function EscolhaFlutuante({
  id,
  rotulo,
  value,
  onChange,
  opcoes,
  vazio,
}: {
  id: string
  rotulo: string
  value: string
  onChange: (v: string) => void
  opcoes: string[]
  /** texto da opção sem valor (ex.: "Seleccione") */
  vazio?: string
}) {
  return (
    <div className="relative">
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={caixaCls + 'appearance-auto'}>
        {vazio !== undefined && <option value="">{vazio}</option>}
        {opcoes.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <label htmlFor={id} className={etiquetaCls + 'peer-focus:text-red-600 dark:peer-focus:text-red-400'}>
        {rotulo}
      </label>
    </div>
  )
}

/** Olho para mostrar / esconder a palavra-passe, dentro do campo */
export function OlhoSenha({ ver, onClick }: { ver: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 transition-colors hover:text-zinc-600 dark:hover:text-zinc-300"
      aria-label={ver ? 'Ocultar palavra-passe' : 'Mostrar palavra-passe'}
    >
      {ver ? <EyeOff className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden /> : <Eye className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />}
    </button>
  )
}

/** Telefone com o indicativo do país escolhido pela bandeira (pedido do Silva, 13/10/2026). Guarda "+258 84 123 4567". */
export function CampoTelefone({
  id,
  rotulo,
  dica,
  obrigatorio = false,
  value,
  onChange,
}: {
  id: string
  rotulo: string
  dica?: string
  obrigatorio?: boolean
  value: string
  onChange: (v: string) => void
}) {
  const sep = separarTelefone(value)
  // o país escolhido fica mesmo antes de se escrever o número
  const [escolhido, setEscolhido] = useState(sep.pais)
  const pais = value.trim() ? sep.pais : escolhido
  const numero = sep.numero
  const [aberto, setAberto] = useState(false)
  const caixa = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!aberto) return
    const fora = (e: MouseEvent) => !caixa.current?.contains(e.target as Node) && setAberto(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAberto(false)
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', fora)
      document.removeEventListener('keydown', esc)
    }
  }, [aberto])
  const juntar = (indicativo: string, n: string) => onChange(n.trim() ? indicativo + ' ' + n.trimStart() : '')
  return (
    <div className="relative" ref={caixa}>
      <div className="flex h-[clamp(38px,2.9vw,42px)] w-full items-stretch rounded-md border border-zinc-300 transition-colors focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-500/20 dark:border-[#393e4d]">
        <button
          type="button"
          onClick={() => setAberto(!aberto)}
          aria-haspopup="listbox"
          aria-expanded={aberto}
          aria-label={'País: ' + pais.nome + ' (' + pais.indicativo + ')'}
          className="flex shrink-0 items-center gap-1.5 border-r border-zinc-300 pl-3 pr-2 text-[clamp(12.5px,0.95vw,13.5px)] text-zinc-700 dark:border-[#393e4d] dark:text-zinc-200"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={urlBandeira(pais)} alt="" className="h-[14px] w-[21px] rounded-[2px] object-cover ring-1 ring-black/10" />
          {pais.indicativo}
          <ChevronDown className="h-3.5 w-3.5 text-zinc-400" aria-hidden />
        </button>
        <input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          required={obrigatorio}
          value={numero}
          onChange={(e) => juntar(pais.indicativo, e.target.value)}
          placeholder={dica}
          className="min-w-0 flex-1 bg-transparent px-3 text-center text-[clamp(13.5px,0.98vw,14.5px)] text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100 dark:placeholder:text-zinc-500 lg:text-left"
        />
      </div>
      <label htmlFor={id} className={etiquetaCls}>
        {rotulo}
      </label>
      {aberto && (
        <div role="listbox" className="absolute left-0 top-[calc(100%+6px)] z-30 max-h-[260px] w-[min(300px,100%)] overflow-auto rounded-md border border-zinc-200 bg-[#fff] py-1 shadow-[0_14px_34px_rgba(0,0,0,0.18)] dark:border-[#393e4d] dark:bg-[#272a34]">
          {PAISES.map((p) => (
            <button
              key={p.codigo}
              type="button"
              role="option"
              aria-selected={p.codigo === pais.codigo}
              onClick={() => {
                setEscolhido(p)
                juntar(p.indicativo, numero)
                setAberto(false)
              }}
              className={
                'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-[#303440] ' +
                (p.codigo === pais.codigo ? 'bg-red-600/[0.08] font-medium' : '')
              }
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={urlBandeira(p)} alt="" className="h-[14px] w-[21px] shrink-0 rounded-[2px] object-cover ring-1 ring-black/10" />
              <span className="flex-1">{p.nome}</span>
              <span className="text-zinc-400">{p.indicativo}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Nível da palavra-passe: 0 vazia, 1 muito fraca, 2 razoável, 3 boa */
export function nivelSenha(s: string): 0 | 1 | 2 | 3 {
  if (!s) return 0
  let p = 0
  if (s.length >= 8) p++
  if (s.length >= 12) p++
  if (/[a-z]/.test(s) && /[A-Z]/.test(s)) p++
  if (/\d/.test(s)) p++
  if (/[^A-Za-z0-9]/.test(s)) p++
  return p <= 2 ? 1 : p === 3 ? 2 : 3
}

/** Barras da força da palavra-passe, sem texto (pedido do Silva, 13/10/2026): vermelho muito fraca, laranja razoável,
 *  verde boa */
export function ForcaSenha({ senha }: { senha: string }) {
  const nivel = nivelSenha(senha)
  const cor = nivel === 1 ? 'bg-red-500' : nivel === 2 ? 'bg-amber-500' : 'bg-emerald-500'
  const nome = ['', 'muito fraca', 'razoável', 'boa'][nivel]
  return (
    <div className="flex gap-1.5" role="meter" aria-valuemin={0} aria-valuemax={3} aria-valuenow={nivel} aria-label={'Força da palavra-passe' + (nome ? ': ' + nome : '')}>
      {[1, 2, 3].map((n) => (
        <span key={n} className={'h-1 flex-1 rounded-full transition-colors duration-200 ' + (n <= nivel ? cor : 'bg-zinc-200 dark:bg-[#393e4d]')} />
      ))}
    </div>
  )
}
