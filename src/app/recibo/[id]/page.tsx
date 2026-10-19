import { redirect } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import { resolveEffectiveClientUser } from '@/lib/client-impersonation';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import type { CheckoutItemLike } from '@/lib/checkout-item-labels';
import { ReciboDocument } from './ReciboDocument';

function Notice({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-black px-4">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-8 text-center space-y-4 max-w-md">
        <AlertCircle className="w-12 h-12 text-red-600 mx-auto" />
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{message}</p>
      </div>
    </div>
  );
}

/**
 * Recibo de uma compra do carrinho (checkout_sessions) — o mesmo documento
 * oficial da Factura das encomendas (/cotacao/[id]?tipo=factura), com número
 * da série própria dos recibos (supabase-checkout-receipts.sql). Abre em
 * popup a partir de "As Minhas Compras" (?embed=1, sem o cabeçalho do site).
 */
export default async function ReciboPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // O dono da compra, ou um admin dentro da conta dele (impersonação).
  const user = (await resolveEffectiveClientUser())?.user ?? null;
  if (!user) {
    redirect(`/login?redirect=/recibo/${id}`);
  }

  const admin = getSupabaseAdmin();
  if (!admin) return <Notice message="Serviço indisponível." />;

  const { data: session } = await admin
    .from('checkout_sessions')
    .select('id, user_id, items, total_mt, metodo_pagamento, status, created_at, fulfilled_at, updated_at')
    .eq('id', id)
    .maybeSingle();

  if (!session || session.user_id !== user.id) {
    return <Notice message="Recibo não encontrado." />;
  }
  if (session.status !== 'paid') {
    return <Notice message="Esta compra ainda não tem recibo — o pagamento não está confirmado." />;
  }

  // Número da série de recibos — atribuído uma vez (idempotente). Se a série
  // ainda não existir na base de dados, o documento sai com "a emitir", tal
  // como a Factura antes de ter número.
  let receiptNumber: string | null = null;
  let issuedAt: string | null = null;
  const { data: assigned, error: assignError } = await admin.rpc('assign_checkout_receipt_number', {
    p_session_id: session.id,
    p_user_id: session.user_id,
  });
  if (assignError) {
    // PGRST202 = a função ainda não existe (supabase-checkout-receipts.sql por
    // aplicar) — estado esperado até a série ser criada, não é um erro.
    if (assignError.code !== 'PGRST202') {
      console.error('[recibo] assign_checkout_receipt_number:', assignError.message);
    }
  } else {
    receiptNumber = typeof assigned === 'string' ? assigned : null;
    const { data: receipt } = await admin
      .from('checkout_receipts')
      .select('issued_at')
      .eq('session_id', session.id)
      .maybeSingle();
    issuedAt = receipt?.issued_at ?? null;
  }

  const { data: profileRows } = await admin
    .from('profiles')
    .select('name, email, telefone, morada, cidade, empresa')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1);
  const profile = profileRows?.[0] ?? null;
  const nome = profile?.name || user.user_metadata?.full_name || user.user_metadata?.name || null;
  const email = profile?.email || user.email || null;

  return (
    <ReciboDocument
      receiptNumber={receiptNumber}
      issuedAt={issuedAt}
      cliente={{
        nome,
        empresa: profile?.empresa || null,
        morada: [profile?.morada, profile?.cidade].filter(Boolean).join(', ') || null,
        telefone: profile?.telefone || null,
        email,
      }}
      compra={{
        items: (session.items as CheckoutItemLike[] | null) ?? [],
        totalMt: Number(session.total_mt) || 0,
        metodoPagamento: session.metodo_pagamento,
        createdAt: session.created_at,
        paidAt: session.fulfilled_at || session.updated_at || session.created_at,
      }}
    />
  );
}
