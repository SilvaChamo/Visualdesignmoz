import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { isComprovativoRejeitado } from '@/lib/quotation-comprovativo';

const DESCARTAVEL_STATUSES = ['pending', 'payment_selected'];

/**
 * Apaga uma encomenda acabada de gravar no checkout (/checkout?encomenda=1),
 * quando o cliente, no passo do comprovativo, quer voltar a editar os dados
 * ou cancelar — a encomenda volta a ser só o rascunho local, e é gravada de
 * novo quando pagar. Ao contrário do DELETE de /api/cotacoes/[id] (só para
 * encomendas já fechadas), isto só aceita encomendas que ainda não começaram:
 * do próprio cliente, todos os itens por pagar/em confirmação, sem
 * comprovativo válido enviado e sem factura emitida. Mensagens, histórico e
 * anexos saem juntos (ON DELETE CASCADE).
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Faça login para continuar.' }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 });
    }

    const { data: quotation } = await admin
      .from('quotation_requests')
      .select('id, batch_id, user_id')
      .eq('id', id)
      .maybeSingle();
    if (!quotation) {
      return NextResponse.json({ error: 'Encomenda não encontrada.' }, { status: 404 });
    }
    if (quotation.user_id !== user.id) {
      return NextResponse.json({ error: 'Não tem permissão para alterar esta encomenda.' }, { status: 403 });
    }

    const { data: batchItems, error: batchError } = await admin
      .from('quotation_requests')
      .select('id, status')
      .eq('batch_id', quotation.batch_id);
    if (batchError || !batchItems || batchItems.length === 0) {
      return NextResponse.json({ error: 'Não foi possível verificar a encomenda.' }, { status: 500 });
    }
    if (batchItems.some((item) => !DESCARTAVEL_STATUSES.includes(item.status))) {
      return NextResponse.json(
        { error: 'Esta encomenda já está a ser tratada pela equipa — acompanhe-a no painel das encomendas.' },
        { status: 409 },
      );
    }

    const batchIds = batchItems.map((item) => item.id);
    const [{ data: anexos }, { data: factura }] = await Promise.all([
      admin.from('quotation_attachments').select('file_name').eq('uploaded_by_role', 'client').in('quotation_id', batchIds),
      admin.from('quotation_invoices').select('invoice_number').eq('batch_id', quotation.batch_id).limit(1).maybeSingle(),
    ]);
    if ((anexos || []).some((a) => !isComprovativoRejeitado(a.file_name))) {
      return NextResponse.json(
        { error: 'Já enviou o comprovativo desta encomenda — acompanhe-a no painel das encomendas.' },
        { status: 409 },
      );
    }
    if (factura) {
      return NextResponse.json({ error: `Esta encomenda já tem a factura ${factura.invoice_number} emitida.` }, { status: 409 });
    }

    const { error: deleteError } = await admin.from('quotation_requests').delete().eq('batch_id', quotation.batch_id);
    if (deleteError) {
      console.error('[cotacoes/descartar] delete error:', deleteError);
      return NextResponse.json({ error: 'Não foi possível alterar a encomenda.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('[cotacoes/descartar] error:', error);
    return NextResponse.json({ error: 'Não foi possível alterar a encomenda.' }, { status: 500 });
  }
}
