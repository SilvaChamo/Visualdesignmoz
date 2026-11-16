import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { produtoPorSku } from '@/lib/catalogo-brindes'

// Nome de um brinde do catálogo, para trocar o produto de uma linha da cotação no painel do cliente. Só com sessão; nunca devolve valores: o valor da encomenda só o cliente vê depois de a equipa o autorizar.
export async function GET(req: Request) {
  const {
    data: { user },
  } = await (await createClient()).auth.getUser()
  if (!user) return NextResponse.json({ success: false, error: 'Faça login para continuar.' }, { status: 401 })
  const p = produtoPorSku((new URL(req.url).searchParams.get('sku') ?? '').slice(0, 80))
  if (!p) return NextResponse.json({ success: false, error: 'Produto sem valor.' }, { status: 404 })
  return NextResponse.json({ success: true, nome: p.nome })
}
