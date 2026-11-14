import { NextResponse } from 'next/server'
import { requireAdminOrReseller } from '@/lib/panel-api-auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

// Estado da calculadora de importação e da cotação ao cliente, guardado no servidor (tabela calculadora_estado). Só administradores.
const CHAVES = ['calculadora', 'cotacao']
const MAX_BYTES = 200_000

async function soAdmin() {
  const auth = await requireAdminOrReseller()
  if ('error' in auth) return { erro: auth.error }
  if (auth.user.role !== 'admin') return { erro: NextResponse.json({ success: false, error: 'Acção restrita a administradores.' }, { status: 403 }) }
  return { user: auth.user }
}

export async function GET(req: Request) {
  const a = await soAdmin()
  if ('erro' in a) return a.erro
  const chave = new URL(req.url).searchParams.get('chave') ?? ''
  if (!CHAVES.includes(chave)) return NextResponse.json({ success: false, error: 'Chave inválida.' }, { status: 400 })
  const supabase = getSupabaseAdmin()
  if (!supabase) return NextResponse.json({ success: false, error: 'Supabase Service Role não configurado.' }, { status: 503 })
  const { data, error } = await supabase.from('calculadora_estado').select('estado').eq('chave', chave).maybeSingle()
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, estado: data?.estado ?? null })
}

export async function PUT(req: Request) {
  const a = await soAdmin()
  if ('erro' in a) return a.erro
  const corpo = (await req.json().catch(() => null)) as { chave?: string; estado?: unknown } | null
  if (!corpo || !CHAVES.includes(corpo.chave ?? '')) return NextResponse.json({ success: false, error: 'Chave inválida.' }, { status: 400 })
  if (!corpo.estado || typeof corpo.estado !== 'object' || JSON.stringify(corpo.estado).length > MAX_BYTES) return NextResponse.json({ success: false, error: 'Estado inválido.' }, { status: 400 })
  const supabase = getSupabaseAdmin()
  if (!supabase) return NextResponse.json({ success: false, error: 'Supabase Service Role não configurado.' }, { status: 503 })
  const { error } = await supabase.from('calculadora_estado').upsert({ chave: corpo.chave, estado: corpo.estado, updated_at: new Date().toISOString(), updated_by: a.user.email ?? a.user.id })
  if (error) return NextResponse.json({ success: false, error: `Não foi possível guardar: ${error.message}` }, { status: 500 })
  return NextResponse.json({ success: true })
}
