import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { refreshTransferStatus } from '@/lib/domain-transfer-provision';

const CRON_SECRET = process.env.CRON_SECRET || 'default-secret-change-in-production';

/**
 * Verifica junto da Dynadot todos os pedidos de transferência ainda em
 * curso (submitted/waiting/locked) e actualiza o estado + notificações. Sem
 * isto, uma transferência só avança quando alguém tem a página "Transferir
 * Domínio" do dashboard aberta (polling só no browser) — este cron garante
 * que avança mesmo que ninguém esteja a olhar. Inclui "locked" para
 * detectar quando o dono desbloqueia o domínio no registador antigo.
 */
export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret');
  if (secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'A sua sessão expirou. Entre novamente para realizar esta acção.' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const admin = createAdminClient(supabaseUrl, supabaseKey);

  const { data: pending, error } = await admin
    .from('domain_transfer_requests')
    .select('*')
    .in('status', ['submitted', 'waiting', 'locked']);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  const results: Array<{ domain: string; status: string; changed: boolean }> = [];
  for (const row of pending || []) {
    try {
      const result = await refreshTransferStatus(admin, row);
      results.push({ domain: row.domain_name, status: result.status, changed: result.changed });
    } catch {
      results.push({ domain: row.domain_name, status: 'erro', changed: false });
    }
  }

  return NextResponse.json({ success: true, checked: results.length, results });
}
