// Sugestões da pesquisa de brindes (até 6 produtos enquanto se escreve). Só devolve o que a página mostra: o valor vem em
// meticais (o rand do fornecedor nunca sai do servidor).

import { NextResponse } from 'next/server'
import { cambioZarMzn } from '@/lib/cambio-brindes'
import { emMt, sugerir } from '@/lib/catalogo-brindes'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get('q') ?? '').trim().slice(0, 80)
  if (q.length < 2) return NextResponse.json({ total: 0, produtos: [] })

  const { total, produtos } = sugerir(q, 6)
  const taxa = await cambioZarMzn()
  return NextResponse.json(
    {
      total,
      produtos: emMt(produtos, taxa).map(({ sku, slug, nome, marca, imagem, esgotado, precoMt }) => ({ sku, slug, nome, marca, imagem, esgotado, precoMt })),
    },
    { headers: { 'cache-control': 'public, max-age=60' } },
  )
}
