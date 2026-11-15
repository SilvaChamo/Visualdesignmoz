'use client'

// A foto de cada produto na calculadora e na cotação: procura no catálogo de brindes o produto com este nome (só se o nome for igual); sem correspondência, não há foto.
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

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
      <img src={src} alt="" width={40} height={40} style={{ width: 40, height: 40, objectFit: 'contain' }} className="cursor-zoom-in rounded-md border border-zinc-200 bg-white" />
      {pos &&
        createPortal(
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src.replace('&w=96', '&w=640')}
            alt=""
            style={{ position: 'fixed', left: pos.x, top: pos.y, width: L, height: L, zIndex: 9999, pointerEvents: 'none', opacity: visivel ? 1 : 0, transform: visivel ? 'scale(1)' : 'scale(0.94)', transition: 'opacity 160ms ease, transform 160ms ease' }}
            className="rounded-xl border border-zinc-200 bg-white object-contain p-3 shadow-2xl"
          />,
          document.body,
        )}
    </span>
  )
}

