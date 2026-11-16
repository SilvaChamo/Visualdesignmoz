import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { resolveRoleForAuthUser } from '@/lib/server-auth-role'

// A cópia da cotação que a calculadora publicou para esta encomenda (ver /api/admin/cotacoes/[batchId]/copia); só o dono da encomenda ou um administrador a lêem.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ success: false, error: 'Faça login para continuar.' }, { status: 401 })
  const admin = getSupabaseAdmin()
  if (!admin) return NextResponse.json({ success: false, error: 'Serviço indisponível.' }, { status: 503 })
  const { data: row } = await admin.from('quotation_requests').select('user_id, batch_id').eq('id', id).maybeSingle()
  if (!row) return NextResponse.json({ success: false, error: 'Não foi possível encontrar esta cotação.' }, { status: 404 })
  if (row.user_id !== user.id && (await resolveRoleForAuthUser(supabase, user)) !== 'admin') return NextResponse.json({ success: false, error: 'Não tem permissão para ver esta cotação.' }, { status: 403 })
  const { data } = await admin.from('cotacao_site_copia').select('html, updated_at').eq('batch_id', row.batch_id).maybeSingle()
  return NextResponse.json({ success: true, html: data?.html ?? null, atualizada: data?.updated_at ?? null })
}
