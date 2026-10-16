import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getAttachmentSignedUrls } from '@/lib/quotation-attachments-bucket';
import { resolveEffectiveClientUser } from '@/lib/client-impersonation';

type RenewalRow = {
  id: string;
  domain_name: string | null;
  package_name?: string | null;
  server?: string | null;
  expiration_date: string | null;
  status: string | null;
};

type SessionItem = Record<string, unknown> & {
  name?: string;
  type?: string;
  hostingDomain?: string | null;
  status?: string;
};

/** O período pago terminou e não foi renovado (o cron de renovações também marca 'expired'). */
function isRenewalDue(row: RenewalRow): boolean {
  if (row.status === 'cancelled') return false;
  if (row.status === 'expired') return true;
  if (!row.expiration_date) return false;
  return new Date(`${row.expiration_date.slice(0, 10)}T23:59:59`) < new Date();
}

/**
 * Liga cada item pago ao seu registo de renovação — domain_renewals /
 * hosting_renewals não guardam o id da compra, por isso a ligação é pelo que
 * identifica o serviço: domínio pelo nome, hospedagem pelo domínio da
 * hospedagem, plano de email pelo nome do plano (por ordem de compra, um
 * registo para cada plano comprado). Devolve, por compra, o link para renovar
 * quando algum desses serviços já passou da data e ficou por pagar.
 */
function renewalLinksBySession(
  sessions: Array<{ id: string; status: string; items: SessionItem[]; created_at: string }>,
  domainRows: RenewalRow[],
  hostingRows: RenewalRow[],
): Record<string, string> {
  const usedMailPlans = new Set<string>();
  const out: Record<string, string> = {};
  const oldestFirst = [...sessions].sort((a, b) => a.created_at.localeCompare(b.created_at));

  for (const session of oldestFirst) {
    for (const item of session.items) {
      if ((item.status ?? session.status) !== 'paid') continue;
      let row: RenewalRow | undefined;
      let kind: 'domain' | 'hosting' = 'hosting';
      if (item.type === 'domain') {
        kind = 'domain';
        const name = String(item.name || '').toLowerCase();
        row = domainRows.find((r) => String(r.domain_name || '').toLowerCase() === name);
      } else if (item.type === 'hosting' && item.hostingDomain) {
        const domain = String(item.hostingDomain).toLowerCase();
        row = hostingRows.find((r) => r.server !== 'Mail' && String(r.domain_name || '').toLowerCase() === domain);
      } else if (item.type === 'email') {
        const free = hostingRows.filter((r) => r.server === 'Mail' && !usedMailPlans.has(r.id));
        row = free.find((r) => r.package_name === item.name) ?? free[0];
        if (row) usedMailPlans.add(row.id);
      }
      if (row && isRenewalDue(row) && !out[session.id]) {
        out[session.id] = `/renovacao/iniciar/${kind}/${row.id}`;
      }
    }
  }
  return out;
}

/**
 * #10: histórico de compras do próprio cliente (carrinho/checkout) — até
 * agora só existia visão de admin (checkout-pagamentos); o cliente não tinha
 * onde rever o que comprou depois de o ecrã de "Pagamento confirmado" sumir.
 * Escopo sempre ao próprio user_id — nunca lista compras de outra pessoa.
 */
export async function GET() {
  // Admin a impersonar um cliente (painel /cliente) vê as compras dele.
  const user = (await resolveEffectiveClientUser())?.user ?? null;
  if (!user) {
    return NextResponse.json({ success: false, error: 'Faça login para continuar.' }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ success: false, error: 'Serviço indisponível.' }, { status: 503 });
  }

  try {
    const [sessionsRes, domainRes, hostingRes] = await Promise.all([
      admin
        .from('checkout_sessions')
        .select('id, items, total_mt, metodo_pagamento, status, comprovativo_url, rejection_reason, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      admin
        .from('domain_renewals')
        .select('id, domain_name, expiration_date, status')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true }),
      admin
        .from('hosting_renewals')
        .select('id, domain_name, package_name, server, expiration_date, status')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true }),
    ]);
    if (sessionsRes.error) throw sessionsRes.error;
    const data = sessionsRes.data || [];

    // #11: bucket privado — comprovativo_url guardado é só o caminho, gera-se
    // aqui um URL temporário assinado para o próprio cliente poder abrir.
    const signedUrls = await getAttachmentSignedUrls(data.map((s) => s.comprovativo_url));

    const sessions = data.map((s) => ({
      ...s,
      items: ((s.items as SessionItem[] | null) ?? []).map((item) => ({
        ...item,
        status: item.status ?? s.status,
      })),
    }));
    const renewalLinks = renewalLinksBySession(
      sessions,
      (domainRes.data as RenewalRow[] | null) ?? [],
      (hostingRes.data as RenewalRow[] | null) ?? [],
    );

    const compras = sessions.map((s, idx) => ({
      ...s,
      comprovativo_url: signedUrls[idx],
      renovacao_url: renewalLinks[s.id] ?? null,
    }));

    return NextResponse.json({ success: true, compras });
  } catch (error: unknown) {
    console.error('[client/minhas-compras] GET:', error);
    const message = error instanceof Error ? error.message : 'Erro ao listar compras';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
