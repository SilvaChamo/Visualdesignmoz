import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireAdminOrReseller } from '@/lib/panel-api-auth';

// Só para decidir o destino pós-login (painel /encomendas) — não confundir
// com resolveQuotationAccess, que valida acesso a UMA encomenda específica.
export async function userHasQuotationRequests(userId: string): Promise<boolean> {
  const admin = getSupabaseAdmin();
  if (!admin) return false;
  const { count } = await admin
    .from('quotation_requests')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  return (count ?? 0) > 0;
}

export type QuotationAccess =
  | { ok: true; role: 'client' | 'admin'; userId: string; quotation: Record<string, any>; batchQuotationIds: string[] }
  | { ok: false; response: NextResponse };

// Resolve quem pode ver/escrever numa encomenda (quotation_requests): o
// próprio dono (role='client') ou um admin/reseller (role='admin'). Usado
// pelas rotas de histórico, mensagens, anexos e layouts, que são
// partilhadas entre o painel do cliente e o painel admin.
//
// Também resolve `batchQuotationIds` — todas as linhas irmãs (mesmo
// batch_id, ou seja, submetidas juntas como uma encomenda só) — para essas
// rotas conseguirem agregar tudo o que pertence à encomenda, e não só à
// linha específica passada no URL (evita mensagens/anexos "perdidos" numa
// linha diferente da que o utilizador está a ver).
export async function resolveQuotationAccess(quotationId: string): Promise<QuotationAccess> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, response: NextResponse.json({ error: 'A sua sessão expirou. Entre novamente para realizar esta acção.' }, { status: 401 }) };
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return { ok: false, response: NextResponse.json({ error: 'Serviço indisponível' }, { status: 503 }) };
  }

  const { data: quotation, error } = await admin
    .from('quotation_requests')
    .select('*')
    .eq('id', quotationId)
    .single();

  if (error || !quotation) {
    return { ok: false, response: NextResponse.json({ error: 'Encomenda não encontrada' }, { status: 404 }) };
  }

  const { data: siblings } = await admin
    .from('quotation_requests')
    .select('id')
    .eq('batch_id', quotation.batch_id);
  const batchQuotationIds = siblings && siblings.length > 0 ? siblings.map((s) => s.id) : [quotationId];

  if (quotation.user_id === user.id) {
    return { ok: true, role: 'client', userId: user.id, quotation, batchQuotationIds };
  }

  const adminAuth = await requireAdminOrReseller();
  if ('error' in adminAuth) {
    return { ok: false, response: NextResponse.json({ error: 'Sem permissão' }, { status: 403 }) };
  }
  return { ok: true, role: 'admin', userId: user.id, quotation, batchQuotationIds };
}
