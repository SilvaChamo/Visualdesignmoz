'use client'

// A foto de um produto do catálogo. Se a imagem não carrega (ou o endereço está partido), nunca aparece o nome escrito no lugar
// dela: fica um fundo neutro com um ícone discreto (`substituir="icone"`), ou nada (`substituir="nada"`, para a 2.ª foto do cartão).
import { useState, type CSSProperties } from 'react'
import { ImageOff } from 'lucide-react'

export function FotoProduto({ src, alt = '', className, style, loading, substituir = 'icone', ...resto }: { src: string; alt?: string; className?: string; style?: CSSProperties; loading?: 'lazy' | 'eager'; substituir?: 'icone' | 'nada'; draggable?: boolean; decoding?: 'async' | 'sync' | 'auto'; 'aria-hidden'?: boolean }) {
  // guarda o endereço que falhou (e não um sim/não): ao mudar de foto volta a tentar sem repor nada
  const [falhouSrc, setFalhouSrc] = useState('')
  const falhou = falhouSrc === src
  if (falhou) {
    if (substituir === 'nada') return null
    return (
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-zinc-300 dark:text-zinc-600" aria-hidden>
        <ImageOff className="h-[28%] w-[28%] max-h-12 max-w-12" strokeWidth={1.25} />
      </span>
    )
  }
  return (
    // se a imagem falhar, o img sai e entra o ícone: o texto alternativo nunca chega a aparecer no lugar da foto; se já tinha falhado antes
    // de a página ficar interactiva, o evento de erro perdeu-se: confirma-se ao ligar o elemento
    // eslint-disable-next-line @next/next/no-img-element
    <img ref={(i) => { if (i && i.complete && i.naturalWidth === 0) setFalhouSrc(src) }} src={src} alt={alt} loading={loading} className={className} style={style} onError={() => setFalhouSrc(src)} {...resto} />
  )
}
