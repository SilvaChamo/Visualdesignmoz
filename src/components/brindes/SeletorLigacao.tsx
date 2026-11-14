'use client'

// Selector do catálogo /brindes («Ordenar por», «Subcategoria»): vai para a ligação da opção logo ao escolher (as ligações já trazem os outros filtros).

import { useRouter } from 'next/navigation'
import type { CSSProperties } from 'react'

export function SeletorLigacao({ rotulo, opcoes, atual, className, style }: { rotulo: string; opcoes: { id: string; nome: string; href: string }[]; atual: string; className?: string; style?: CSSProperties }) {
  const router = useRouter()
  return (
    <select
      aria-label={rotulo}
      value={atual}
      onChange={(e) => {
        const o = opcoes.find((x) => x.id === e.target.value)
        if (o) router.push(o.href)
      }}
      className={className}
      style={style}
    >
      {opcoes.map((o) => (
        <option key={o.id} value={o.id}>{o.nome}</option>
      ))}
    </select>
  )
}
