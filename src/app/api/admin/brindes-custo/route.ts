import { NextResponse } from 'next/server'
import { requireAdminOrReseller } from '@/lib/panel-api-auth'
import { produtoPorSku } from '@/lib/catalogo-brindes'

// O custo (rand, do fornecedor) de um produto do catálogo, para a calculadora o pôr na lista quando se junta um produto à cotação. Só administradores.
export async function GET(req: Request) {
  const auth = await requireAdminOrReseller()
  if ('error' in auth) return auth.error
  if (auth.user.role !== 'admin') return NextResponse.json({ success: false, error: 'Acção restrita a administradores.' }, { status: 403 })
  const sku = (new URL(req.url).searchParams.get('sku') ?? '').slice(0, 80)
  const p = produtoPorSku(sku)
  if (!p) return NextResponse.json({ success: false, error: 'Produto não encontrado.' }, { status: 404 })
  return NextResponse.json({ success: true, nome: p.nome, precoZar: p.precoZar })
}
