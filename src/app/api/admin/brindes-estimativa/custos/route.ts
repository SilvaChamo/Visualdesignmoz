import { NextResponse } from 'next/server'
import { requireAdminOrReseller } from '@/lib/panel-api-auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { configValida } from '@/lib/preco-brindes'
import { configGuardada, esquecerEstimativa } from '@/lib/estimativa-brindes'

// O valor dos brindes vem da calculadora (Admin › Contabilidade › Calculadora): ela grava aqui, sozinha, o que tem em «Custos da remessa» e nas margens
// sempre que se altera um valor. Só administradores.

async function soAdmin() {
  const auth = await requireAdminOrReseller()
  if ('error' in auth) return { erro: auth.error }
  if (auth.user.role !== 'admin') return { erro: NextResponse.json({ success: false, error: 'Acção restrita a administradores.' }, { status: 403 }) }
  return { user: auth.user }
}

export async function GET() {
  const a = await soAdmin()
  if ('erro' in a) return a.erro
  return NextResponse.json({ success: true, calculo: await configGuardada() })
}

export async function PUT(req: Request) {
  const a = await soAdmin()
  if ('erro' in a) return a.erro
  const calculo = configValida(await req.json().catch(() => null))
  if (!calculo) return NextResponse.json({ success: false, error: 'Valores inválidos: indique números iguais ou acima de zero, com a margem abaixo de 100.' }, { status: 400 })
  const supabase = getSupabaseAdmin()
  if (!supabase) return NextResponse.json({ success: false, error: 'Supabase Service Role não configurado.' }, { status: 503 })
  const { error } = await supabase.from('brindes_custos_remessa').upsert({ id: 1, calculo, updated_at: new Date().toISOString(), updated_by: a.user.email ?? a.user.id })
  if (error) return NextResponse.json({ success: false, error: `Não foi possível guardar: ${error.message}` }, { status: 500 })
  esquecerEstimativa()
  return NextResponse.json({ success: true, calculo })
}
