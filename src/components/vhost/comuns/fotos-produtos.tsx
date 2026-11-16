'use client'

// A foto de cada produto na calculadora e na cotação: procura no catálogo de brindes o produto com este nome (só se o nome for igual); sem correspondência, não há foto.
import { useEffect, useRef, useState } from 'react'
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

// a imagem escolhida no computador reduz-se (lado maior 500 px, fundo branco, JPEG) para caber na cotação e no PDF
function reduzirImagem(f: File): Promise<string> {
  return new Promise((ok, falha) => {
    const url = URL.createObjectURL(f)
    const im = new Image()
    im.onload = () => {
      const k = Math.min(1, 500 / Math.max(im.naturalWidth, im.naturalHeight))
      const c = document.createElement('canvas')
      c.width = Math.max(1, Math.round(im.naturalWidth * k))
      c.height = Math.max(1, Math.round(im.naturalHeight * k))
      const x = c.getContext('2d')!
      x.fillStyle = '#fff'
      x.fillRect(0, 0, c.width, c.height)
      x.drawImage(im, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      ok(c.toDataURL('image/jpeg', 0.82))
    }
    im.onerror = () => {
      URL.revokeObjectURL(url)
      falha(new Error('imagem'))
    }
    im.src = url
  })
}

const BOTAO_ZOOM = 'cursor-pointer rounded-[5px] border border-zinc-300 bg-white/95 px-2.5 py-1 text-xs font-semibold text-zinc-700 shadow-sm hover:border-red-500 hover:text-red-600'

/** A miniatura do produto; ao passar o rato abre ao lado uma foto grande (por cima do resto, sem ser cortada pela tabela), com entrada suave. Só no ecrã.
 *  Com `aoTrocar`, a foto grande deixa trocar a imagem por uma do computador (só para esta cotação, o produto não muda) e repor a original. */
export function Miniatura({ src, aoTrocar, personalizada }: { src: string; aoTrocar?: (imagem: string | null) => void; personalizada?: boolean }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const [visivel, setVisivel] = useState(false)
  const [erro, setErro] = useState(false)
  const temporizador = useRef<number | undefined>(undefined)
  const ficheiro = useRef<HTMLInputElement>(null)
  const L = 300
  const abrir = (e: import('react').MouseEvent<HTMLElement>) => {
    window.clearTimeout(temporizador.current)
    if (pos) return
    const r = e.currentTarget.getBoundingClientRect()
    const x = r.right + 14 + L > window.innerWidth ? Math.max(8, r.left - 14 - L) : r.right + 14
    const y = Math.min(Math.max(8, r.top + r.height / 2 - L / 2), window.innerHeight - L - 8)
    setPos({ x, y })
    requestAnimationFrame(() => setVisivel(true))
  }
  // fecha um instante depois de o rato sair: dá tempo de passar da miniatura à foto grande (e aos botões dela)
  const fechar = () => {
    window.clearTimeout(temporizador.current)
    temporizador.current = window.setTimeout(() => {
      setVisivel(false)
      setPos(null)
    }, 220)
  }
  const escolhida = async (f: File | undefined) => {
    if (!f || !aoTrocar) return
    setErro(false)
    try {
      aoTrocar(await reduzirImagem(f))
      setVisivel(false)
      setPos(null)
    } catch {
      setErro(true)
    }
  }
  return (
    <span className="shrink-0" onMouseEnter={abrir} onMouseLeave={fechar}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" width={40} height={40} style={{ width: 40, height: 40, objectFit: 'contain' }} className="cursor-zoom-in rounded-[5px] border border-zinc-200 bg-white" />
      {pos &&
        createPortal(
          <div
            data-sem-imprimir
            style={{ position: 'fixed', left: pos.x, top: pos.y, width: L, height: L, zIndex: 9999, opacity: visivel ? 1 : 0, transform: visivel ? 'scale(1)' : 'scale(0.94)', transition: 'opacity 160ms ease, transform 160ms ease', pointerEvents: aoTrocar ? 'auto' : 'none' }}
            className="rounded-[5px] border border-zinc-200 bg-white shadow-2xl"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src.replace('&w=96', '&w=640')} alt="" className="h-full w-full rounded-[5px] object-contain p-3" />
            {aoTrocar && (
              <div className="absolute inset-x-0 bottom-2 flex flex-wrap items-center justify-center gap-1.5 px-2">
                <button type="button" className={BOTAO_ZOOM} onClick={() => ficheiro.current?.click()}>
                  Trocar imagem
                </button>
                {personalizada && (
                  <button
                    type="button"
                    className={BOTAO_ZOOM}
                    onClick={() => {
                      aoTrocar(null)
                      setVisivel(false)
                      setPos(null)
                    }}
                  >
                    Repor original
                  </button>
                )}
                {erro && <span className="w-full text-center text-xs font-semibold text-red-600">Não foi possível ler a imagem.</span>}
              </div>
            )}
          </div>,
          document.body,
        )}
      <input
        ref={ficheiro}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          void escolhida(e.target.files?.[0])
          e.target.value = ''
        }}
      />
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
