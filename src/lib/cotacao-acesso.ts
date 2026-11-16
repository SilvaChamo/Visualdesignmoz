import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { requireAdminOrReseller } from '@/lib/panel-api-auth'

export const UUID_LOTE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Quem pode editar a cotação de uma encomenda do site: o administrador (como sempre) e o dono da encomenda, que edita a mesma folha no
 * painel do cliente. Para o dono só vale uma encomenda sua; a calculadora e o resto continuam só do administrador.
 */
export async function podeEditarCotacao(batchId: string): Promise<{ erro: NextResponse } | { email: string }> {
  const admin = await requireAdminOrReseller()
  if (!('error' in admin) && admin.user.role === 'admin') return { email: admin.user.email ?? admin.user.id }
  if (!UUID_LOTE.test(batchId)) return { erro: NextResponse.json({ success: false, error: 'Encomenda inválida.' }, { status: 400 }) }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { erro: NextResponse.json({ success: false, error: 'Faça login para continuar.' }, { status: 401 }) }
  const servico = getSupabaseAdmin()
  if (!servico) return { erro: NextResponse.json({ success: false, error: 'Serviço indisponível.' }, { status: 503 }) }
  const { data } = await servico.from('quotation_requests').select('user_id').eq('batch_id', batchId).limit(1).maybeSingle()
  if (!data || data.user_id !== user.id) return { erro: NextResponse.json({ success: false, error: 'Não tem permissão para esta cotação.' }, { status: 403 }) }
  return { email: user.email ?? user.id }
}
