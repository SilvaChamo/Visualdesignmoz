import { NextResponse } from 'next/server'
import { requireAdminOrReseller } from '@/lib/panel-api-auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { ESTIMATIVA_BRINDES, estimativaValida } from '@/lib/preco-brindes'
import { esquecerEstimativa, estimativaGuardada } from '@/lib/estimativa-brindes'

// Percentagens do valor estimado dos brindes (Admin › Contabilidade › Calculadora). Só administradores.

async function soAdmin() {
  const auth = await requireAdminOrReseller()
  if ('error' in auth) return { erro: auth.error }
  if (auth.user.role !== 'admin') return { erro: NextResponse.json({ success: false, error: 'Acção restrita a administradores.' }, { status: 403 }) }
  return { user: auth.user }
}

export async function GET() {
  const a = await soAdmin()
  if ('erro' in a) return a.erro
  const { valores, guardada } = await estimativaGuardada()
  return NextResponse.json({ success: true, valores, guardada, padrao: ESTIMATIVA_BRINDES })
}

export async function PUT(req: Request) {
  const a = await soAdmin()
  if ('erro' in a) return a.erro
  const valores = estimativaValida(await req.json().catch(() => null))
  if (!valores) return NextResponse.json({ success: false, error: 'Valores inválidos: indique percentagens de 0 a 1000, com a margem abaixo de 100.' }, { status: 400 })
  const supabase = getSupabaseAdmin()
  if (!supabase) return NextResponse.json({ success: false, error: 'Supabase Service Role não configurado.' }, { status: 503 })
  const { error } = await supabase.from('brindes_estimativa').upsert({
    id: 1,
    erro_pct: valores.erroPct,
    transporte_pct: valores.transportePct,
    direitos_pct: valores.direitosPct,
    margem_pct: valores.margemPct,
    iva_pct: valores.ivaPct,
    updated_at: new Date().toISOString(),
    updated_by: a.user.email ?? a.user.id,
  })
  if (error) return NextResponse.json({ success: false, error: `Não foi possível guardar: ${error.message}` }, { status: 500 })
  esquecerEstimativa()
  return NextResponse.json({ success: true, valores })
}
