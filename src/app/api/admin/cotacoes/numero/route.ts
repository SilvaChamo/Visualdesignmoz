import { NextResponse } from 'next/server'
import { requireAdminOrReseller } from '@/lib/panel-api-auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

// Número da cotação da calculadora, escrito pelo sistema: série sequencial por ano («COT 2026/0001»), no modelo da factura (função assign_cotacao_number).
// Pedir outra vez a mesma chave devolve o mesmo número. A chave é o batch_id da encomenda do site ou um identificador de cotação livre.
const CHAVE = /^[0-9a-zA-Z-]{8,64}$/

export async function POST(req: Request) {
  const auth = await requireAdminOrReseller()
  if ('error' in auth) return auth.error
  if (auth.user.role !== 'admin') return NextResponse.json({ success: false, error: 'Acção restrita a administradores.' }, { status: 403 })
  const corpo = (await req.json().catch(() => null)) as { chave?: unknown } | null
  const chave = typeof corpo?.chave === 'string' ? corpo.chave : ''
  if (!CHAVE.test(chave)) return NextResponse.json({ success: false, error: 'Cotação inválida.' }, { status: 400 })
  const supabase = getSupabaseAdmin()
  if (!supabase) return NextResponse.json({ success: false, error: 'Supabase Service Role não configurado.' }, { status: 503 })
  const { data, error } = await supabase.rpc('assign_cotacao_number', { p_chave: chave })
  if (error || typeof data !== 'string') return NextResponse.json({ success: false, error: 'Não foi possível atribuir o número.' }, { status: 500 })
  return NextResponse.json({ success: true, numero: data })
}
