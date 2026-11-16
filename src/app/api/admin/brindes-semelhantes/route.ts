import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { semelhantesPorNome } from '@/lib/catalogo-brindes'

// Produtos da mesma família de um produto do catálogo (sem preços; o catálogo é público), para trocar um produto por outro semelhante na cotação: administrador e clientes com sessão.
export async function GET(req: Request) {
  const {
    data: { user },
  } = await (await createClient()).auth.getUser()
  if (!user) return NextResponse.json({ success: false, error: 'Faça login para continuar.' }, { status: 401 })
  const nome = (new URL(req.url).searchParams.get('nome') ?? '').slice(0, 200)
  return NextResponse.json({ success: true, produtos: semelhantesPorNome(nome) })
}
