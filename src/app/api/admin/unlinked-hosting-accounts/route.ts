import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-api-auth';
import { getDaSyncAdmin } from '@/lib/da-sync-schema';

/**
 * Contas de hospedagem reais (panel_users) que ainda não têm nenhum login do
 * painel associado (auth_user_id nulo) — usado pelo formulário "Criar/Editar
 * conta" para ligar um login a uma conta já existente, em vez de criar
 * hospedagem nova a partir de um pacote (ver ProvisionClienteSection.tsx).
 */
export async function GET() {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  try {
    const sb = getDaSyncAdmin();
    if (!sb) return NextResponse.json({ success: true, accounts: [] });

    const { data: users, error } = await sb
      .from('panel_users')
      .select('username, email, package_name, hosting_provider')
      .is('auth_user_id', null)
      .order('username');
    if (error) throw new Error(error.message);

    const usernames = (users || []).map((u) => u.username).filter(Boolean);
    const domainByOwner = new Map<string, string>();
    if (usernames.length) {
      const { listMirrorWebsites } = await import('@/lib/panel-mirror-read');
      const owned = new Set(usernames);
      const sites = (await listMirrorWebsites({ role: 'admin' })).filter((s) => s.owner && owned.has(s.owner));
      for (const s of sites) {
        if (s.owner && !domainByOwner.has(s.owner)) domainByOwner.set(s.owner, s.domain);
      }
    }

    const accounts = (users || []).map((u) => ({
      daUsername: u.username,
      email: u.email || '',
      packageName: u.package_name || '',
      hostingProvider: u.hosting_provider || 'directadmin',
      domain: domainByOwner.get(u.username) || '',
    }));

    return NextResponse.json({ success: true, accounts });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Erro ao listar contas de hospedagem';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
