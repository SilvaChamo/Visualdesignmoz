import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { produtoPorSku } from '@/lib/catalogo-brindes'
import { valorBrindeSemIva } from '@/lib/valor-brinde'

// Nome e valor por unidade (sem IVA, o do site) de um brinde do catálogo, para trocar o produto de uma linha da cotação no painel do cliente. Só com sessão; nunca devolve o custo do fornecedor.
export async function GET(req: Request) {
  const {
    data: { user },
  } = await (await createClient()).auth.getUser()
  if (!user) return NextResponse.json({ success: false, error: 'Faça login para continuar.' }, { status: 401 })
  const sku = (new URL(req.url).searchParams.get('sku') ?? '').slice(0, 80)
  const p = produtoPorSku(sku)
  const valorSemIva = p ? await valorBrindeSemIva(` — ref. ${sku}`) : null
  if (!p || !valorSemIva) return NextResponse.json({ success: false, error: 'Produto sem valor.' }, { status: 404 })
  return NextResponse.json({ success: true, nome: p.nome, valorSemIva })
}
