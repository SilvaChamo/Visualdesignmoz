'use client'

// Campo de pesquisa do catálogo de brindes: ao escrever, mostra até 6 produtos como sugestão (foto, nome, referência e valor).
// Clicar leva à ficha; Enter sem escolher nenhum faz a pesquisa de sempre (o formulário). As sugestões saem num portal
// porque a faixa cinzenta onde está o campo corta o que passa por baixo dela.

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Search } from 'lucide-react'
import { urlImagem } from '@/lib/catalogo-imagens'
import { useCurrency } from '@/contexts/CurrencyContext'

interface Sugestao {
  sku: string
  slug: string
  nome: string
  marca: string | null
  imagem: string
  esgotado: boolean
  precoMt: number | null
}

export function PesquisaBrindes({ defaultValue, className }: { defaultValue: string; className: string }) {
  const router = useRouter()
  const { formatPrice } = useCurrency()
  const lista = useId()
  const caixa = useRef<HTMLLabelElement>(null)
  const campo = useRef<HTMLInputElement>(null)
  const [q, setQ] = useState(defaultValue)
  const [res, setRes] = useState<{ q: string; total: number; produtos: Sugestao[] } | null>(null)
  const [aberto, setAberto] = useState(false)
  const [activo, setActivo] = useState(-1)
  const [pos, setPos] = useState({ left: 0, top: 0, width: 0 })

  const medir = () => {
    const r = caixa.current?.getBoundingClientRect()
    if (r) setPos({ left: r.left, top: r.bottom + 4, width: r.width })
  }

  useEffect(() => {
    const t = q.trim()
    if (t.length < 2) return
    const ctl = new AbortController()
    const espera = setTimeout(() => {
      fetch(`/api/brindes/pesquisa?q=${encodeURIComponent(t)}`, { signal: ctl.signal })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { total: number; produtos: Sugestao[] } | null) => {
          if (d) {
            setRes({ q: t, ...d })
            setActivo(-1)
          }
        })
        .catch(() => {})
    }, 200)
    return () => {
      clearTimeout(espera)
      ctl.abort()
    }
  }, [q])

  useEffect(() => {
    if (!aberto) return
    const fora = (e: MouseEvent) => {
      const alvo = e.target as Node
      if (!caixa.current?.contains(alvo) && !(alvo instanceof Element && alvo.closest('[data-sugestoes-brindes]'))) setAberto(false)
    }
    document.addEventListener('mousedown', fora)
    window.addEventListener('resize', medir)
    window.addEventListener('scroll', medir, true)
    return () => {
      document.removeEventListener('mousedown', fora)
      window.removeEventListener('resize', medir)
      window.removeEventListener('scroll', medir, true)
    }
  }, [aberto])

  const mostra = aberto && q.trim().length >= 2 && res !== null && res.q === q.trim()

  const teclas = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const n = res?.produtos.length ?? 0
    if (e.key === 'ArrowDown' && mostra && n) {
      e.preventDefault()
      setActivo((a) => (a + 1) % n)
    } else if (e.key === 'ArrowUp' && mostra && n) {
      e.preventDefault()
      setActivo((a) => (a <= 0 ? n - 1 : a - 1))
    } else if (e.key === 'Escape') {
      setAberto(false)
    } else if (e.key === 'Enter' && mostra && activo >= 0 && res?.produtos[activo]) {
      e.preventDefault()
      setAberto(false)
      router.push(`/brindes/produto/${res.produtos[activo].slug}`)
    }
  }

  return (
    <>
      <label ref={caixa} className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          ref={campo}
          type="search"
          name="q"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setAberto(true)
            medir()
          }}
          onFocus={() => {
            setAberto(true)
            medir()
          }}
          onKeyDown={teclas}
          autoComplete="off"
          role="combobox"
          aria-expanded={mostra}
          aria-controls={lista}
          aria-autocomplete="list"
          placeholder="Procurar por nome ou referência"
          aria-label="Procurar por nome ou referência"
          className={`${className} w-full pl-9`}
        />
      </label>
      {mostra &&
        res &&
        createPortal(
          <div
            id={lista}
            role="listbox"
            data-sugestoes-brindes
            style={{ left: pos.left, top: pos.top, width: pos.width }}
            className="fixed z-[70] overflow-hidden rounded-md border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
          >
            {res.produtos.length === 0 ? (
              <p className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">Nenhum produto encontrado</p>
            ) : (
              <>
                {res.produtos.map((p, i) => (
                  <Link
                    key={p.sku}
                    href={`/brindes/produto/${p.slug}`}
                    role="option"
                    aria-selected={i === activo}
                    onMouseEnter={() => setActivo(i)}
                    onClick={() => setAberto(false)}
                    className={`flex items-center gap-3 border-b border-zinc-100 px-3 py-2 last:border-b-0 dark:border-zinc-800 ${i === activo ? 'bg-zinc-100 dark:bg-zinc-800' : ''}`}
                  >
                    <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded bg-white ring-1 ring-zinc-200 dark:ring-zinc-700">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={urlImagem(p.imagem, 96)} alt="" decoding="async" className="absolute inset-0 h-full w-full object-contain p-0.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-zinc-900 dark:text-white">{p.nome}</span>
                      <span className="block truncate text-xs text-zinc-500">{p.marca ? `${p.marca} · ${p.sku}` : p.sku}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      {p.precoMt !== null && <span className="block text-sm font-extrabold text-zinc-900 dark:text-white">{formatPrice(p.precoMt)}</span>}
                      <span className={`block text-xs font-semibold ${p.esgotado ? 'text-zinc-500' : 'text-emerald-600 dark:text-emerald-500'}`}>{p.esgotado ? 'Sem stock' : 'Em stock'}</span>
                    </span>
                  </Link>
                ))}
                {res.total > res.produtos.length && (
                  <button
                    type="button"
                    onClick={() => {
                      setAberto(false)
                      campo.current?.form?.requestSubmit()
                    }}
                    className="flex w-full cursor-pointer items-baseline justify-center gap-1.5 bg-zinc-50 px-3 py-2.5 text-sm font-bold text-red-600 hover:bg-zinc-100 dark:bg-zinc-950 dark:hover:bg-zinc-800"
                  >
                    <span>Ver todos os</span>
                    <span>{res.total.toLocaleString('pt-PT')}</span>
                    <span>resultados</span>
                  </button>
                )}
              </>
            )}
          </div>,
          document.body,
        )}
    </>
  )
}
