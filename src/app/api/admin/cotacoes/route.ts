import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdminOrReseller } from '@/lib/panel-api-auth';
import { notifyQuoteClientStatusChange } from '@/lib/notify-quote-client';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function getSupabaseAdmin() {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase Service Role não configurado.');
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

const VALID_STATUS = ['pending', 'payment_selected', 'approved', 'rejected', 'done', 'cancelled'];

// Lista todos os pedidos de cotação recebidos, para a equipa acompanhar no dashboard.
export async function GET(request: Request) {
  const auth = await requireAdminOrReseller();
  if ('error' in auth) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const supabase = getSupabaseAdmin();

    let query = supabase
      .from('quotation_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (status && VALID_STATUS.includes(status)) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, cotacoes: data || [] });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Actualiza o estado de um pedido de cotação (ex.: marcar como concluída ou cancelada).
export async function PATCH(request: Request) {
  const auth = await requireAdminOrReseller();
  if ('error' in auth) return auth.error;

  try {
    const body = await request.json();
    const { id, status, rejectionReason } = body || {};

    if (!id || !status) {
      return NextResponse.json({ success: false, error: 'id e status são obrigatórios.' }, { status: 400 });
    }
    if (!VALID_STATUS.includes(status)) {
      return NextResponse.json({ success: false, error: 'Status inválido.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const update: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
    if (status === 'rejected') {
      update.rejection_reason = rejectionReason || null;
    }

    const { data, error } = await supabase
      .from('quotation_requests')
      .update(update)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Não aguardar o envio do email (ver /api/cotacoes) — a actualização de
    // estado já ficou gravada, não pode falhar por causa de um SMTP lento.
    if (status === 'approved' || status === 'rejected') {
      notifyQuoteClientStatusChange({
        to: data.email,
        clientName: data.responsavel || data.empresa,
        produto: data.produto,
        status,
        rejectionReason: data.rejection_reason,
      }).catch((err) => console.error('[admin/cotacoes] falha ao notificar cliente:', err));
    }

    return NextResponse.json({ success: true, cotacao: data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
