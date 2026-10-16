import { NextRequest, NextResponse } from 'next/server';
import { requirePanelBootstrapAccess } from '@/lib/panel-api-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { refreshTransferStatus } from '@/lib/domain-transfer-provision';

/**
 * Consulta o estado actual de um pedido de transferência — sempre pergunta à
 * Dynadot ao vivo (não só à nossa tabela), porque a aprovação acontece do
 * lado do registador antigo, fora do nosso controlo.
 */
export async function GET(request: NextRequest) {
  const auth = await requirePanelBootstrapAccess();
  if ('error' in auth) return auth.error;

  const domain = request.nextUrl.searchParams.get('domain')?.trim().toLowerCase();
  if (!domain) {
    return NextResponse.json({ success: false, error: 'Domínio obrigatório' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Serviço indisponível.' }, { status: 503 });
  }

  let query = supabase
    .from('domain_transfer_requests')
    .select('*')
    .eq('domain_name', domain)
    .order('created_at', { ascending: false })
    .limit(1);
  if (auth.user.role !== 'admin') {
    query = query.eq('user_id', auth.user.id);
  }
  const { data: request_, error } = await query.maybeSingle();
  if (error || !request_) {
    return NextResponse.json({ success: false, error: 'Pedido de transferência não encontrado.' }, { status: 404 });
  }

  // Só vale a pena perguntar à Dynadot se já foi submetido lá — 'pending'/'failed'
  // locais significam que nunca chegou a sair da nossa base de dados.
  if (request_.status === 'pending' || request_.status === 'failed') {
    return NextResponse.json({
      success: true,
      status: request_.status,
      errorMessage: request_.error_message,
      createdAt: request_.created_at,
    });
  }

  const result = await refreshTransferStatus(supabase, request_);
  if (!result.rawStatus && !result.changed) {
    return NextResponse.json({
      success: true,
      status: result.status,
      errorMessage: request_.error_message,
      createdAt: request_.created_at,
    });
  }

  // Prefere a data que a própria Dynadot regista para o pedido de
  // transferência (order_created_date) — é essa data, não a da nossa
  // tabela, que a Dynadot usa para calcular quando o prazo termina do lado
  // dela, e é o que aparece no painel deles. Usar a nossa criava uma
  // contagem decrescente diferente da que o cliente vê directamente na
  // Dynadot para o mesmo domínio.
  return NextResponse.json({
    success: true,
    status: result.status,
    rawStatus: result.rawStatus,
    orderId: result.orderId,
    createdAt: result.createdAt || request_.created_at,
    completedAt: result.completedAt,
  });
}
