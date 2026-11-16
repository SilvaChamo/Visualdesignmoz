import { NextResponse } from 'next/server'
import { requireAdminOrReseller } from '@/lib/panel-api-auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { podeEditarCotacao } from '@/lib/cotacao-acesso'
import { semPrecosDoCliente } from '@/lib/folha-sem-precos-do-cliente'

// Estado da calculadora de importação e da cotação ao cliente, guardado no servidor (tabela calculadora_estado). Só administradores.
// 'cotacao-imagens': as fotos que o Silva troca na cotação (reduzidas no navegador), por linha
const CHAVES = ['calculadora', 'cotacao', 'cotacao-imagens']
const MAX_BYTES = 200_000
const MAX_IMAGENS = 1_500_000

// no painel do cliente a mesma folha edita-se e guarda-se por encomenda, na mesma tabela: «cotacao:<lote>» e «cotacao-imagens:<lote>» (dono da encomenda ou administrador)
const POR_LOTE = /^(cotacao|cotacao-imagens):([0-9a-f-]{36})$/i
async function acesso(chave: string) {
  const m = POR_LOTE.exec(chave)
  if (!m) return soAdmin()
  const r = await podeEditarCotacao(m[2])
  return 'erro' in r ? { erro: r.erro } : { user: { email: r.email, id: r.email }, admin: r.admin }
}

async function soAdmin() {
  const auth = await requireAdminOrReseller()
  if ('error' in auth) return { erro: auth.error }
  if (auth.user.role !== 'admin') return { erro: NextResponse.json({ success: false, error: 'Acção restrita a administradores.' }, { status: 403 }) }
  return { user: auth.user }
}

export async function GET(req: Request) {
  const chave = new URL(req.url).searchParams.get('chave') ?? ''
  const a = await acesso(chave)
  if ('erro' in a) return a.erro
  if (!CHAVES.includes(chave) && !POR_LOTE.test(chave)) return NextResponse.json({ success: false, error: 'Chave inválida.' }, { status: 400 })
  const supabase = getSupabaseAdmin()
  if (!supabase) return NextResponse.json({ success: false, error: 'Supabase Service Role não configurado.' }, { status: 503 })
  const { data, error } = await supabase.from('calculadora_estado').select('estado').eq('chave', chave).maybeSingle()
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  const lote = POR_LOTE.exec(chave)
  if (!lote) return NextResponse.json({ success: true, estado: data?.estado ?? null })
  // folha de uma encomenda ainda sem versão própria: parte da que o administrador tinha na calculadora, se era a desta encomenda
  if (data?.estado) return NextResponse.json({ success: true, estado: data.estado })
  const { data: cot } = await supabase.from('calculadora_estado').select('estado').eq('chave', 'cotacao').maybeSingle()
  if ((cot?.estado as { chave?: string } | null)?.chave !== lote[2]) return NextResponse.json({ success: true, estado: null })
  if (lote[1] === 'cotacao') return NextResponse.json({ success: true, estado: cot?.estado ?? null })
  const { data: fotos } = await supabase.from('calculadora_estado').select('estado').eq('chave', 'cotacao-imagens').maybeSingle()
  return NextResponse.json({ success: true, estado: fotos?.estado ?? null })
}

export async function PUT(req: Request) {
  const corpo = (await req.json().catch(() => null)) as { chave?: string; estado?: unknown } | null
  const a = await acesso(corpo?.chave ?? '')
  if ('erro' in a) return a.erro
  if (!corpo || (!CHAVES.includes(corpo.chave ?? '') && !POR_LOTE.test(corpo.chave ?? ''))) return NextResponse.json({ success: false, error: 'Chave inválida.' }, { status: 400 })
  if (!corpo.estado || typeof corpo.estado !== 'object' || JSON.stringify(corpo.estado).length > (corpo.chave?.startsWith('cotacao-imagens') ? MAX_IMAGENS : MAX_BYTES)) return NextResponse.json({ success: false, error: 'Estado inválido.' }, { status: 400 })
  const supabase = getSupabaseAdmin()
  if (!supabase) return NextResponse.json({ success: false, error: 'Supabase Service Role não configurado.' }, { status: 503 })
  let estado: object = corpo.estado
  if ('admin' in a && !a.admin && corpo.chave?.startsWith('cotacao:')) {
    const { data: atual } = await supabase.from('calculadora_estado').select('estado').eq('chave', corpo.chave).maybeSingle()
    estado = semPrecosDoCliente(estado, atual?.estado)
  }
  const { error } = await supabase.from('calculadora_estado').upsert({ chave: corpo.chave, estado, updated_at: new Date().toISOString(), updated_by: a.user.email ?? a.user.id })
  if (error) return NextResponse.json({ success: false, error: `Não foi possível guardar: ${error.message}` }, { status: 500 })
  return NextResponse.json({ success: true })
}
