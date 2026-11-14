import { NextResponse } from 'next/server'
import { requireAdminOrReseller } from '@/lib/panel-api-auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { CHAVES_REMESSA, custosRemessaValidos } from '@/lib/preco-brindes'
import { custosRemessaGuardados, esquecerEstimativa } from '@/lib/estimativa-brindes'

// Custos fixos da remessa (Calculadora › Custos da remessa) que se somam ao valor dos brindes: a calculadora grava-os sozinha ao alterar um valor.

async function soAdmin() {
  const auth = await requireAdminOrReseller()
  if ('error' in auth) return { erro: auth.error }
  if (auth.user.role !== 'admin') return { erro: NextResponse.json({ success: false, error: 'Acção restrita a administradores.' }, { status: 403 }) }
  return { user: auth.user }
}

export async function GET() {
  const a = await soAdmin()
  if ('erro' in a) return a.erro
  return NextResponse.json({ success: true, custos: await custosRemessaGuardados() })
}

export async function PUT(req: Request) {
  const a = await soAdmin()
  if ('erro' in a) return a.erro
  const c = custosRemessaValidos(await req.json().catch(() => null))
  if (!c) return NextResponse.json({ success: false, error: 'Valores inválidos: indique números iguais ou acima de zero.' }, { status: 400 })
  const supabase = getSupabaseAdmin()
  if (!supabase) return NextResponse.json({ success: false, error: 'Supabase Service Role não configurado.' }, { status: 503 })
  const { error } = await supabase.from('brindes_custos_remessa').upsert({
    id: 1,
    ...Object.fromEntries(CHAVES_REMESSA.map((k) => [k === 'entregaDom' ? 'entrega_dom' : k, c[k]])),
    unidades: Math.round(c.unidades),
    updated_at: new Date().toISOString(),
    updated_by: a.user.email ?? a.user.id,
  })
  if (error) return NextResponse.json({ success: false, error: `Não foi possível guardar: ${error.message}` }, { status: 500 })
  esquecerEstimativa()
  return NextResponse.json({ success: true, custos: c })
}
