import { NextResponse } from 'next/server'
import { requireAdminOrReseller } from '@/lib/panel-api-auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

// A calculadora grava aqui a folha da cotação da encomenda que tem carregada (tabela cotacao_site_copia); o cliente vê esta cópia em Encomendas › Cotação.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_BYTES = 600_000

export async function PUT(req: Request, { params }: { params: Promise<{ batchId: string }> }) {
  const auth = await requireAdminOrReseller()
  if ('error' in auth) return auth.error
  if (auth.user.role !== 'admin') return NextResponse.json({ success: false, error: 'Acção restrita a administradores.' }, { status: 403 })
  const { batchId } = await params
  if (!UUID.test(batchId)) return NextResponse.json({ success: false, error: 'Encomenda inválida.' }, { status: 400 })
  const corpo = (await req.json().catch(() => null)) as { html?: unknown } | null
  if (!corpo || typeof corpo.html !== 'string' || !corpo.html.trim() || corpo.html.length > MAX_BYTES) return NextResponse.json({ success: false, error: 'Cotação inválida.' }, { status: 400 })
  const supabase = getSupabaseAdmin()
  if (!supabase) return NextResponse.json({ success: false, error: 'Supabase Service Role não configurado.' }, { status: 503 })
  const { error } = await supabase.from('cotacao_site_copia').upsert({ batch_id: batchId, html: corpo.html, updated_at: new Date().toISOString(), updated_by: auth.user.email ?? auth.user.id })
  if (error) return NextResponse.json({ success: false, error: `Não foi possível guardar: ${error.message}` }, { status: 500 })
  return NextResponse.json({ success: true })
}
