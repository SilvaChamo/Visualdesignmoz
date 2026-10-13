'use client'

/**
 * Peças comuns do login e do registo no modelo dividido (LoginDividido.tsx): campos com a etiqueta que sobe para a
 * linha de cima ao clicar, o olho da palavra-passe e as classes do título e dos botões. Os tamanhos acompanham a
 * largura do ecrã (clamp): entre 1024 e 1440 px o formulário vai reduzindo aos poucos (pedido do Silva, 13/10/2026).
 * Cores com "#fff" e não "bg-white": no escuro, o site pinta de #18181b todos os .bg-white dentro de .font-panel.
 */
import { Eye, EyeOff } from 'lucide-react'

export const tituloCls =
  'text-center text-[clamp(22px,1.95vw,28px)] font-semibold leading-tight tracking-tight text-zinc-900 dark:text-zinc-50 lg:text-left'
export const subtituloCls = 'mt-2 text-center text-[clamp(13px,1.05vw,15px)] text-zinc-500 dark:text-zinc-400 lg:text-left'
export const botaoCls =
  'inline-flex h-[clamp(40px,3.05vw,44px)] w-full items-center justify-center gap-2 rounded-md bg-red-600 text-[clamp(14px,1.05vw,15px)] font-semibold text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60'
export const botaoClaroCls =
  'inline-flex h-[clamp(40px,3.05vw,44px)] w-full items-center justify-center gap-2.5 rounded-md border border-zinc-300 bg-[#fff] text-[clamp(13px,1vw,14px)] font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-60 dark:border-[#393e4d] dark:bg-[#272a34] dark:text-zinc-200 dark:hover:bg-[#303440]'
export const ligacaoCls = 'text-[clamp(13px,1vw,14px)] font-medium text-red-600 hover:text-red-500 dark:text-red-400'

const caixaCls =
  'peer h-[clamp(42px,3.35vw,48px)] w-full rounded-md border border-zinc-300 bg-transparent px-3.5 text-center text-[clamp(14px,1.05vw,15px)] text-zinc-900 outline-none transition-colors lg:text-left ' +
  'focus:border-red-500 focus:ring-2 focus:ring-red-500/20 dark:border-[#393e4d] dark:text-zinc-100 dark:focus:border-red-500 '
const etiquetaCls =
  'pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap bg-[#fff] px-1 text-xs font-medium text-zinc-500 transition-all duration-150 lg:left-2.5 lg:translate-x-0 dark:bg-[#15161e] dark:text-zinc-400 '

/** Campo com a etiqueta a meio; ao clicar (ou já preenchido) a etiqueta sobe para a linha de cima do campo
 *  (pedido do Silva, 13/10/2026). A dica (ex.: o formato do e-mail) só aparece com o campo escolhido. No telemóvel e no
 *  tablet a etiqueta e o texto ficam ao centro. */
export function CampoFlutuante({
  id,
  rotulo,
  dica,
  type = 'text',
  autoComplete,
  minLength,
  obrigatorio = false,
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
        placeholder={dica || ' '}
        className={
          caixaCls +
          'placeholder:text-transparent focus:placeholder:text-zinc-400 dark:focus:placeholder:text-zinc-500 ' +
          (children ? 'px-10 lg:pl-3.5' : '')
        }
      />
      <label
        htmlFor={id}
        className={
          etiquetaCls +
          'peer-placeholder-shown:top-1/2 peer-placeholder-shown:text-[clamp(14px,1.05vw,15px)] peer-placeholder-shown:font-normal ' +
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
