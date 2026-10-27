import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { syncAllTldPrices } from '@/lib/domain-price-sync';

const CRON_SECRET = process.env.CRON_SECRET || 'default-secret-change-in-production';
const ADMIN_EMAILS = ['admin@visualdesignmoz.com', 'silva.chamo@gmail.com', 'geral@visualdesignmoz.com', 'suporte@visualdesignmoz.com'];

/**
 * Sincroniza os preços de domínio com os valores reais da Dynadot (ver
 * domain-price-sync.ts). Chamado por um cron externo (GitHub Actions/cron-job.org
 * com ?secret=CRON_SECRET) ou manualmente por um admin autenticado.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isAdmin = Boolean(user && ADMIN_EMAILS.includes(user.email || ''));

  if (!isAdmin && secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'A sua sessão expirou. Entre novamente para realizar esta acção.' }, { status: 401 });
  }

  const result = await syncAllTldPrices();
  return NextResponse.json({ success: true, ...result });
}
