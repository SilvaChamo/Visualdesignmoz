'use client'

// A amostra de uma cor (quadrado ou bolinha). A cor que o fornecedor dá em hexadecimal nem sempre se parece com a da foto
// (um azul «escuro» na lista e uma peça azul-claro na foto): por isso mede-se a cor na própria foto dessa cor (pequena, já em cache
// no site), ignorando o fundo branco, e só enquanto isso não chega (ou se a foto não dá) vale o hexadecimal. As cores de duas
// tonalidades ficam como o fornecedor as dá (a média de duas cores não é nenhuma delas).

import { useEffect, useState } from 'react'
import { caminhoImagem, urlImagem } from '@/lib/catalogo-imagens'

export const fundo = (h: string[]) => (h.length > 1 ? `linear-gradient(135deg, ${h[0]} 50%, ${h[1]} 50%)` : h[0] || '#d4d4d8')

const medidas = new Map<string, string | null>()
const pedidos = new Map<string, Promise<string | null>>()

/** A cor média da peça na foto (sem o fundo branco ou transparente), ou null se a foto não dá (peça branca, erro). */
function medir(caminho: string): Promise<string | null> {
  let p = pedidos.get(caminho)
  if (!p) {
    p = new Promise<string | null>((resolver) => {
      const img = new Image()
      img.onload = () => {
        try {
          const L = 32
          const c = document.createElement('canvas')
          c.width = c.height = L
          const ctx = c.getContext('2d', { willReadFrequently: true })
          if (!ctx) return resolver(null)
          ctx.drawImage(img, 0, 0, L, L)
          const d = ctx.getImageData(0, 0, L, L).data
          let r = 0, g = 0, b = 0, n = 0
          for (let i = 0; i < d.length; i += 4) {
            if (d[i + 3] < 200) continue
            // fundo (branco ou quase) e as sombras muito claras não contam
            if (d[i] > 235 && d[i + 1] > 235 && d[i + 2] > 235) continue
            r += d[i]; g += d[i + 1]; b += d[i + 2]; n++
          }
          // menos de 12% da imagem com cor: peça branca ou foto sem peça, vale o hexadecimal do fornecedor
          if (n < L * L * 0.12) return resolver(null)
          const h = (v: number) => Math.round(v / n).toString(16).padStart(2, '0')
          resolver(`#${h(r)}${h(g)}${h(b)}`)
        } catch {
          resolver(null)
        }
      }
      img.onerror = () => resolver(null)
      img.src = urlImagem(caminho, 96)
    }).then((h) => {
      medidas.set(caminho, h)
      return h
    })
    pedidos.set(caminho, p)
  }
  return p
}

export function AmostraCor({ sku, cor, className = '' }: { sku: string; cor: { h: string[]; i: string | null }; className?: string }) {
  const caminho = cor.i && cor.h.length <= 1 ? caminhoImagem(sku, cor.i) : null
  const [real, setReal] = useState<string | null>(() => (caminho ? (medidas.get(caminho) ?? null) : null))

  useEffect(() => {
    if (!caminho) return
    let vivo = true
    medir(caminho).then((h) => vivo && setReal(h))
    return () => {
      vivo = false
    }
  }, [caminho])

  return <span aria-hidden className={className} style={{ background: real ?? fundo(cor.h) }} />
}
