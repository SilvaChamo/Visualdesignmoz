'use client'

// A foto de cada produto na calculadora e na cotação: procura no catálogo de brindes o produto com este nome (só se o nome for igual); sem correspondência, não há foto.
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronsUpDown } from 'lucide-react'

const norm = (t: string) => t.toLowerCase().replace(/\s+/g, ' ').trim()

/** devolve `fotoDe(nome)`: o endereço da miniatura do produto ou '' */
export function useFotosProdutos(nomes: string[]) {
  const [fotos, setFotos] = useState<Record<string, string>>({})
  const chave = nomes.map((n) => n.trim()).join('\n')
  useEffect(() => {
    let vivo = true
    for (const nome of new Set(chave.split('\n').filter((n) => n.length > 2))) {
      if (fotos[norm(nome)] !== undefined) continue
      fetch(`/api/brindes/pesquisa?q=${encodeURIComponent(nome)}`)
        .then((r) => r.json())
        .then((j: { produtos?: { nome: string; imagem: string }[] }) => {
          const achado = j.produtos?.find((p) => norm(p.nome) === norm(nome))
          if (vivo) setFotos((f) => ({ ...f, [norm(nome)]: achado ? `/api/brindes/imagem?p=${encodeURIComponent(achado.imagem)}&w=96` : '' }))
        })
        .catch(() => vivo && setFotos((f) => ({ ...f, [norm(nome)]: '' })))
    }
    return () => {
      vivo = false
    }
    // só quando mudam os nomes dos produtos
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave])
  return (nome: string) => fotos[norm(nome)] || ''
}

/** A miniatura do produto; ao passar o rato abre ao lado uma foto grande (por cima do resto, sem ser cortada pela tabela), com entrada suave. Só no ecrã. */
export function Miniatura({ src }: { src: string }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const [visivel, setVisivel] = useState(false)
  const L = 300
  const abrir = (e: import('react').MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const x = r.right + 14 + L > window.innerWidth ? Math.max(8, r.left - 14 - L) : r.right + 14
    const y = Math.min(Math.max(8, r.top + r.height / 2 - L / 2), window.innerHeight - L - 8)
    setPos({ x, y })
    requestAnimationFrame(() => setVisivel(true))
  }
  const fechar = () => {
    setVisivel(false)
    setPos(null)
  }
  return (
    <span className="shrink-0" onMouseEnter={abrir} onMouseLeave={fechar}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" width={40} height={40} style={{ width: 40, height: 40, objectFit: 'contain' }} className="cursor-zoom-in rounded-[5px] border border-zinc-200 bg-white" />
      {pos &&
        createPortal(
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src.replace('&w=96', '&w=640')}
            alt=""
            style={{ position: 'fixed', left: pos.x, top: pos.y, width: L, height: L, zIndex: 9999, pointerEvents: 'none', opacity: visivel ? 1 : 0, transform: visivel ? 'scale(1)' : 'scale(0.94)', transition: 'opacity 160ms ease, transform 160ms ease' }}
            className="rounded-[5px] border border-zinc-200 bg-white object-contain p-3 shadow-2xl"
          />,
          document.body,
        )}
    </span>
  )
}


interface Semelhante {
  sku: string
  nome: string
  imagem: string
  esgotado: boolean
}
const memoria = new Map<string, Semelhante[]>()

/** O seletor «produtos semelhantes»: abre uma lista com a foto e o nome dos produtos da mesma família; ao escolher um, chama `aoEscolher(sku)`. */
export function SeletorSemelhantes({ nome, aoEscolher }: { nome: string; aoEscolher: (sku: string) => void | Promise<void> }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const [lista, setLista] = useState<Semelhante[] | null>(null)
  const L = 360
  const abrir = (e: React.MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    setPos({ x: Math.max(8, Math.min(r.left, window.innerWidth - L - 8)), y: Math.min(r.bottom + 6, Math.max(8, window.innerHeight - 400)) })
    const chave = nome.trim()
    if (memoria.has(chave)) return setLista(memoria.get(chave) ?? [])
    setLista(null)
    fetch(`/api/admin/brindes-semelhantes?nome=${encodeURIComponent(chave)}`)
      .then((x) => x.json())
      .then((j: { success?: boolean; produtos?: Semelhante[] }) => {
        const p = j.success && j.produtos ? j.produtos : []
        memoria.set(chave, p)
        setLista(p)
      })
      .catch(() => setLista([]))
  }
  useEffect(() => {
    if (!pos) return
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && setPos(null)
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [pos])
  return (
    <>
      <button type="button" data-sem-imprimir aria-label="Trocar por um produto semelhante" title="Trocar por um produto semelhante" onClick={abrir} className="inline-flex shrink-0 cursor-pointer items-center rounded-[5px] p-1 text-slate-500 transition hover:bg-slate-100 hover:text-red-600">
        <ChevronsUpDown className="h-4 w-4" aria-hidden />
      </button>
      {pos &&
        createPortal(
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => setPos(null)} />
            <div style={{ position: 'fixed', left: pos.x, top: pos.y, width: L, maxHeight: 380, zIndex: 9999 }} className="overflow-y-auto rounded-[5px] border border-slate-200 bg-white p-2 text-[12px] text-slate-800 shadow-2xl">
              <p className="px-1 pb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Produtos semelhantes</p>
              {lista === null ? (
                <p className="px-1 py-3 text-slate-500">A procurar…</p>
              ) : lista.length === 0 ? (
                <p className="px-1 py-3 text-slate-500">Sem produtos semelhantes.</p>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {lista.map((p) => (
                    <button
                      key={p.sku}
                      type="button"
                      onClick={() => {
                        setPos(null)
                        void aoEscolher(p.sku)
                      }}
                      className="flex w-full cursor-pointer items-center gap-3 rounded-[5px] border border-slate-200 p-1.5 text-left transition hover:border-red-500 hover:bg-red-50"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/api/brindes/imagem?p=${encodeURIComponent(p.imagem)}&w=96`} alt="" width={48} height={48} loading="lazy" style={{ width: 48, height: 48, objectFit: 'contain' }} className="shrink-0 rounded-[5px] bg-white" />
                      <span className={`leading-tight ${p.esgotado ? 'text-slate-400' : ''}`}>{p.nome}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>,
          document.body,
        )}
    </>
  )
}
