import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { createClient } from '@/utils/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { c2bSingleStagePay } from '@/lib/mpesa-client';
import { resolveCheckoutActor } from '@/lib/checkout-actor';

// Passo M-Pesa do checkout para clientes normais enquanto o M-Pesa está em sandbox (MPESA_ENV=sandbox): o cliente
// dá o número e o pedido segue o protocolo C2B de teste, mas NADA é cobrado nem activado — o pedido continua
// 'pending' e o cliente paga a sério e envia o comprovativo (ver /api/checkout/[id]/comprovativo). Em produção
// isto fica desligado e o checkout vai direito ao comprovativo. A cobrança real com activação automática é
// /api/checkout/mpesa-pay (só administradores).
function sandboxActivo(): boolean {
  return (process.env.MPESA_ENV || '').trim().toLowerCase() === 'sandbox';
}

export async function GET() {
  return NextResponse.json({ sandbox: sandboxActivo() });
}

export async function POST(request: NextRequest) {
  if (!sandboxActivo()) {
    return NextResponse.json({ error: 'O pagamento por M-Pesa de teste não está activo.' }, { status: 403 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'A sua sessão expirou. Entre novamente para realizar esta acção.' }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const sessionId = String(body.sessionId || '').trim();
  const msisdn = String(body.msisdn || '').replace(/\D/g, '');
  if (!sessionId || !/^258\d{9}$/.test(msisdn)) {
    return NextResponse.json({ error: 'Indique um número M-Pesa válido (ex.: 84 000 0000).' }, { status: 400 });
  }

  const { data: session } = await admin
    .from('checkout_sessions')
    .select('id, user_id, status, metodo_pagamento, total_mt, mpesa_last_response')
    .eq('id', sessionId)
    .maybeSingle();
  if (!session || session.user_id !== (await resolveCheckoutActor(admin, user)).buyerUserId) {
    return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 });
  }
  if (session.status !== 'pending' || session.metodo_pagamento !== 'mpesa') {
    return NextResponse.json({ error: 'Este pedido não está à espera de pagamento M-Pesa.' }, { status: 409 });
  }
  // Uma tentativa de teste por pedido.
  if (session.mpesa_last_response) {
    return NextResponse.json({ success: true, simulated: true, jaTestado: true });
  }

  // A referência NÃO é gravada em `mpesa_third_party_reference`: se o callback do sandbox chegasse a
  // /api/webhook/mpesa com esta referência, o pedido seria dado como pago e activado.
  const result = await c2bSingleStagePay(
    {
      msisdn,
      amountMt: Number(session.total_mt) || 0,
      thirdPartyReference: randomBytes(10).toString('hex'),
      transactionReference: `VD${Date.now().toString().slice(-10)}`,
    },
    2,
  );

  await admin
    .from('checkout_sessions')
    .update({ mpesa_last_response: `[teste] ${result.ok ? result.raw : result.raw || result.error}` })
    .eq('id', sessionId);

  return NextResponse.json({ success: true, simulated: true, aprovado: result.ok });
}
