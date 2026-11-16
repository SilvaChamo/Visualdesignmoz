'use client'

// Margem de preços do catálogo: dois niveladores (mínimo e máximo, em MT por unidade); ao largar, a página mostra só os produtos dessa margem.
// A escala é logarítmica: os preços vão de poucos meticais a dezenas de milhares e, numa escala recta, quase todos ficariam colados à esquerda.
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useCurrency } from '@/contexts/CurrencyContext'

const PASSOS = 1000
const arredondar = (v: number) => {
  const passo = v < 1000 ? 10 : v < 10000 ? 50 : 500
  return Math.max(1, Math.round(v / passo) * passo)
}

export function FiltroPreco({ min, max, de, ate, base }: { min: number; max: number; de: number | null; ate: number | null; /** a pesquisa actual, sem a margem nem a página */ base: string }) {
  const router = useRouter()
  // os valores mostram-se na moeda escolhida no topo, como os dos cartões; a margem em si é sempre em MT
  const { formatPrice: fmt } = useCurrency()
  const k = Math.log(max / min)
  const valor = (p: number) => (p <= 0 ? min : p >= PASSOS ? max : Math.min(max, Math.max(min, arredondar(min * Math.exp((k * p) / PASSOS)))))
  const posicao = (v: number) => Math.min(PASSOS, Math.max(0, Math.round((PASSOS * Math.log(Math.max(v, min) / min)) / k)))
  const [lo, setLo] = useState(Math.max(de ?? min, min))
  const [hi, setHi] = useState(Math.min(ate ?? max, max))
  const ativo = de != null || ate != null

  const ir = (a: number, b: number) => {
    const q = new URLSearchParams(base)
    if (a > min) q.set('pmin', String(a))
    if (b < max) q.set('pmax', String(b))
    const s = q.toString()
    router.push(`/brindes${s ? `?${s}` : ''}#catalogo`, { scroll: false })
  }
  // um nivelador não passa o outro
  const mudarLo = (p: number) => setLo(Math.min(valor(p), hi))
  const mudarHi = (p: number) => setHi(Math.max(valor(p), lo))
  const limpar = () => {
    setLo(min)
    setHi(max)
    ir(min, max)
  }

  // os dois niveladores ficam um sobre o outro: só as bolinhas apanham o rato
  const nivelador =
    'pointer-events-none absolute inset-0 h-5 w-full cursor-pointer appearance-none bg-transparent accent-red-600 [&::-moz-range-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:pointer-events-auto'
  const [a, b] = [(posicao(lo) / PASSOS) * 100, (posicao(hi) / PASSOS) * 100]
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-zinc-900 dark:text-zinc-300 sm:text-sm">
      <span className="font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-500">Preço</span>
      <span className="tabular-nums">{fmt(lo)}</span>
      <div className="relative h-5 w-44 sm:w-56">
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded bg-zinc-300 dark:bg-zinc-700" />
        <div className="absolute top-1/2 h-1 -translate-y-1/2 rounded bg-red-600" style={{ left: `${a}%`, right: `${100 - b}%` }} />
        <input type="range" aria-label="Preço mínimo" min={0} max={PASSOS} step={1} value={posicao(lo)} onChange={(e) => mudarLo(Number(e.target.value))} onPointerUp={() => ir(lo, hi)} onKeyUp={() => ir(lo, hi)} className={nivelador} />
        <input type="range" aria-label="Preço máximo" min={0} max={PASSOS} step={1} value={posicao(hi)} onChange={(e) => mudarHi(Number(e.target.value))} onPointerUp={() => ir(lo, hi)} onKeyUp={() => ir(lo, hi)} className={nivelador} />
      </div>
      <span className="tabular-nums">{fmt(hi)}</span>
      {ativo && (
        <button type="button" onClick={limpar} className="cursor-pointer font-bold text-red-600 hover:underline">
          Limpar
        </button>
      )}
    </div>
  )
}
