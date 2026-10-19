// Submete um pedido de transferência de domínio (de outro registador para a
// Dynadot) depois de pago no carrinho — chamado só para itens 'domain' com
// authCode (ver checkout-fulfillment.ts). Não é instantâneo: o registador
// antigo tem de aprovar (ou passar 5-7 dias sem responder, que conta como
// aprovação silenciosa) — daí existir domain_transfer_requests para
// acompanhar o estado, em vez de assumir sucesso logo aqui.
import type { SupabaseClient } from '@supabase/supabase-js';
import { dynadotAPI } from '@/lib/dynadot-adapter';
import { autoProvisionPurchasedDomain } from '@/lib/domain-purchase-provision';
import { after } from 'next/server';

const DYNADOT_STATUS_MAP: Record<string, string> = {
  waiting: 'waiting',
  pending: 'waiting',
  completed: 'completed',
  success: 'completed',
  // Valor real confirmado ao vivo (19 ago) para uma transferência já
  // concluída — "transfer_status":"Transferred" — que não estava mapeado e
  // por isso nunca disparava a conclusão: o pedido ficava preso em "waiting"
  // para sempre, mesmo com order_completed_date já preenchida pela Dynadot.
  transferred: 'completed',
  rejected: 'rejected',
  cancelled: 'rejected',
  failed: 'failed',
  locked: 'locked',
};

/**
 * A Dynadot devolve o estado "locked" quando o registador antigo tem o
 * domínio bloqueado contra transferências — fica parado até o dono
 * desbloquear lá, não é algo que resolvamos deste lado. O nome exacto do
 * valor devolvido não está documentado com certeza, por isso aceitamos
 * qualquer variante que contenha "lock" (ex: "locked", "LOCKED").
 */
function mapDynadotStatus(raw: string, fallback: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes('lock')) return 'locked';
  return DYNADOT_STATUS_MAP[lower] || fallback;
}

type TransferRequestRow = {
  id: string;
  user_id: string;
  domain_name: string;
  status: string;
  dynadot_order_id: string | null;
  error_message: string | null;
};

/**
 * Pergunta à Dynadot o estado ao vivo de um pedido já submetido e actualiza a
 * nossa tabela + notificações se tiver mudado. Partilhado entre o endpoint
 * consultado pelo dashboard (só corre enquanto o cliente tem a página aberta)
 * e o cron server-side (corre sempre, independente de haver alguém a ver).
 */
export async function refreshTransferStatus(
  admin: SupabaseClient,
  request_: TransferRequestRow,
): Promise<{
  status: string;
  changed: boolean;
  rawStatus?: string;
  orderId?: string;
  completedAt?: string | null;
  createdAt?: string | null;
}> {
  const live = await dynadotAPI.getTransferStatus(request_.domain_name);
  if (!live.success) {
    return { status: request_.status, changed: false };
  }

  const mapped = mapDynadotStatus(live.status, request_.status);
  const changed = mapped !== request_.status || live.orderId !== request_.dynadot_order_id;
  if (!changed) {
    return {
      status: mapped,
      changed: false,
      rawStatus: live.status,
      orderId: live.orderId,
      completedAt: live.completedDate,
      createdAt: live.createdDate,
    };
  }

  await admin
    .from('domain_transfer_requests')
    .update({ status: mapped, dynadot_order_id: live.orderId, updated_at: new Date().toISOString() })
    .eq('id', request_.id);

  if (mapped === 'completed' && request_.status !== 'completed') {
    await admin
      .from('domain_renewals')
      .update({ status: 'active', notes: 'Transferência concluída' })
      .eq('user_id', request_.user_id)
      .eq('domain_name', request_.domain_name);
    await admin.from('notifications').insert({
      user_id: request_.user_id,
      title: 'Transferência de domínio concluída',
      message: `O domínio ${request_.domain_name} foi transferido com sucesso e já está activo na sua conta.`,
      type: 'success',
      category: 'system',
    });

    // #lacuna 14 ago: uma transferência concluída só actualizava o estado
    // interno — nunca criava a zona na Cloudflare nem apontava nameservers,
    // ao contrário de um domínio registado directamente (autoProvisionPurchasedDomain).
    // O cliente via "transferência concluída" mas o domínio podia ficar sem
    // DNS nenhum configurado, igual ao bug já corrigido do lado da compra
    // directa. Reaproveita a mesma automação — o passo 'registo' salta
    // sozinho porque o domínio já está na nossa conta Dynadot depois de
    // transferido (getDomainDetails já devolve sucesso), só a zona
    // Cloudflare/nameservers/DNS de e-mail é que corre a sério.
    const task = async () => {
      try {
        const { data: authUser } = await admin.auth.admin.getUserById(request_.user_id);
        const email = authUser?.user?.email || '';
        const displayName =
          authUser?.user?.user_metadata?.nome || authUser?.user?.user_metadata?.full_name || email.split('@')[0];
        const { data: profile } = await admin
          .from('profiles')
          .select('*')
          .eq('user_id', request_.user_id)
          .maybeSingle();

        const result = await autoProvisionPurchasedDomain({
          domain: request_.domain_name,
          years: 1,
          profile: profile || null,
          userEmail: email,
          displayName,
        });

        if (result.ok) {
          await admin
            .from('domain_renewals')
            .update({ dns_status: 'ok' })
            .eq('user_id', request_.user_id)
            .eq('domain_name', request_.domain_name);
        } else {
          const failed = result.steps.filter((s) => !s.ok).map((s) => `${s.step}: ${s.error}`).join(' | ');
          console.error('[domain-transfer-provision] configuração de DNS pós-transferência falhou:', request_.domain_name, failed);
          await admin
            .from('domain_renewals')
            .update({ dns_status: 'pending', notes: `DNS por configurar após transferência: ${failed}` })
            .eq('user_id', request_.user_id)
            .eq('domain_name', request_.domain_name);
          await admin.from('notifications').insert({
            user_id: request_.user_id,
            title: 'Domínio transferido: falta configurar o DNS',
            message: `O domínio ${request_.domain_name} foi transferido com sucesso, mas houve um problema a configurar o DNS automaticamente. A nossa equipa já foi avisada.`,
            type: 'warning',
            category: 'system',
          });
        }
      } catch (err) {
        console.error('[domain-transfer-provision] auto-provisionamento pós-transferência:', err);
      }
    };
    try {
      after(task);
    } catch {
      void task();
    }
  } else if (mapped === 'rejected' && request_.status !== 'rejected') {
    await admin.from('notifications').insert({
      user_id: request_.user_id,
      title: 'Transferência de domínio rejeitada',
      message: `O pedido de transferência de ${request_.domain_name} foi rejeitado pelo registador anterior. Contacte o suporte se precisar de ajuda.`,
      type: 'error',
      category: 'system',
    });
  } else if (mapped === 'locked' && request_.status !== 'locked') {
    await admin.from('notifications').insert({
      user_id: request_.user_id,
      title: 'Transferência de domínio bloqueada — precisa da sua acção',
      message: `O domínio ${request_.domain_name} está bloqueado ("locked") no registador antigo, o que impede a transferência de avançar. Entre na conta desse registador e desactive o bloqueio de transferência para o processo continuar.`,
      type: 'warning',
      category: 'system',
    });
  }

  return {
    status: mapped,
    changed: true,
    rawStatus: live.status,
    orderId: live.orderId,
    completedAt: live.completedDate,
    createdAt: live.createdDate,
  };
}

export async function submitDomainTransfer(
  admin: SupabaseClient,
  userId: string,
  domain: string,
  authCode: string,
  years: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const clean = domain.toLowerCase().trim();

  const { data: request, error: insertError } = await admin
    .from('domain_transfer_requests')
    .insert({ user_id: userId, domain_name: clean, status: 'pending', years })
    .select('id')
    .single();
  if (insertError) {
    return { ok: false, error: `Falha ao registar pedido de transferência: ${insertError.message}` };
  }

  const result = await dynadotAPI.initiateTransferIn(clean, authCode, years);

  if (!result.success) {
    await admin
      .from('domain_transfer_requests')
      .update({ status: 'failed', error_message: result.error, updated_at: new Date().toISOString() })
      .eq('id', request.id);
    return { ok: false, error: result.error };
  }

  await admin
    .from('domain_transfer_requests')
    .update({ status: 'submitted', updated_at: new Date().toISOString() })
    .eq('id', request.id);

  return { ok: true };
}
