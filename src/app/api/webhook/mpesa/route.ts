import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { fulfillCheckout } from '@/lib/checkout-fulfillment';

// Callback assíncrono do M-Pesa (backup do fluxo síncrono em
// /api/checkout/mpesa-pay — como o "Single Stage" já devolve o resultado
// na própria resposta HTTP, isto só importa se a ligação cair a meio dos
// até 60s de espera). NOTA: para registar este URL no campo "Asynchronous
// Response URL" do portal M-Pesa, a doc exige uma porta entre 11000 e
// 19000 — ainda não configurámos um listener Nginx dedicado nessa gama,
// por isso este endpoint só serve de retaguarda enquanto isso não existir.
export async function POST(request: NextRequest) {
  if ((process.env.MPESA_ENV || '').trim().toLowerCase() !== 'sandbox') {
    return NextResponse.json({ error: 'not enabled' }, { status: 403 });
  }
  // Autenticação (4/11/2026): sem segredo configurado a rota fica desligada, e com ele só aceita quem o traz — no cabeçalho
  // `x-webhook-secret` ou no endereço registado no portal (`?segredo=…`). Antes, no sandbox, qualquer pedido com uma
  // referência válida activava os produtos.
  const segredo = (process.env.MPESA_WEBHOOK_SECRET || '').trim();
  const trazido = (request.headers.get('x-webhook-secret') || request.nextUrl.searchParams.get('segredo') || '').trim();
  const igual = segredo.length >= 16 && trazido.length === segredo.length && timingSafeEqual(Buffer.from(trazido), Buffer.from(segredo));
  if (!igual) return NextResponse.json({ error: 'not enabled' }, { status: 403 });

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ received: true });
  }

  const thirdPartyReference = String(
    payload.output_ThirdPartyConversationID || payload.input_ThirdPartyReference || payload.thirdPartyReference || '',
  ).trim();
  const responseCode = String(payload.output_ResponseCode ?? '');
  const success = responseCode === 'INS-0' || responseCode === '0';

  if (!thirdPartyReference) {
    console.warn('[webhook/mpesa] callback sem referência reconhecível:', payload);
    return NextResponse.json({ received: true });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !supabaseUrl) {
    return NextResponse.json({ received: true });
  }
  const admin = createAdminClient(supabaseUrl, serviceKey);

  const { data: session } = await admin
    .from('checkout_sessions')
    .select('*')
    .eq('mpesa_third_party_reference', thirdPartyReference)
    .maybeSingle();

  if (!session) {
    console.warn('[webhook/mpesa] sessão não encontrada para referência:', thirdPartyReference);
    return NextResponse.json({ received: true });
  }

  // Idempotência — pode chegar depois de /api/checkout/mpesa-pay já ter confirmado.
  if (session.status === 'paid' || !success) {
    if (!success) {
      await admin
        .from('checkout_sessions')
        .update({ mpesa_last_response: JSON.stringify(payload) })
        .eq('id', session.id);
    }
    return NextResponse.json({ received: true });
  }

  try {
    await fulfillCheckout(admin, session.user_id, session.items, 'mpesa');
    await admin
      .from('checkout_sessions')
      .update({
        status: 'paid',
        fulfilled_at: new Date().toISOString(),
        mpesa_transaction_id: String(payload.output_TransactionID || session.mpesa_transaction_id || ''),
        mpesa_last_response: JSON.stringify(payload),
      })
      .eq('id', session.id);
  } catch (fulfillError) {
    console.error('[webhook/mpesa] erro ao activar produtos:', fulfillError);
    await admin.from('checkout_sessions').update({ status: 'failed' }).eq('id', session.id);
  }

  return NextResponse.json({ received: true });
}
