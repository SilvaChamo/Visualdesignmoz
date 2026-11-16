import { NextResponse } from 'next/server'
import { requireAdminOrReseller } from '@/lib/panel-api-auth'
import { semelhantesPorNome } from '@/lib/catalogo-brindes'

// Produtos da mesma família de um produto do catálogo (sem preços), para a calculadora trocar um produto por outro semelhante. Só administradores.
export async function GET(req: Request) {
  const auth = await requireAdminOrReseller()
  if ('error' in auth) return auth.error
  if (auth.user.role !== 'admin') return NextResponse.json({ success: false, error: 'Acção restrita a administradores.' }, { status: 403 })
  const nome = (new URL(req.url).searchParams.get('nome') ?? '').slice(0, 200)
  return NextResponse.json({ success: true, produtos: semelhantesPorNome(nome) })
}
