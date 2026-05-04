import type { Session } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export const adminEmails = [
  'admin@your-domain.com',
  'geral@your-domain.com',
  'silva.chamo@gmail.com',
  'silva.chamo@your-domain.com',
].map((e) => e.toLowerCase());

/**
 * Sessão obrigatória com papel admin, revendedor ou lista explícita (alinhado a outras rotas /api).
 */
export async function requireAdminOrReseller() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    return { error: NextResponse.json({ error: 'Não autorizado.' }, { status: 401 }) };
  }
  const role = session.user.user_metadata?.role || session.user.app_metadata?.role;
  const email = (session.user.email || '').toLowerCase();
  const allowed =
    role === 'admin' ||
    role === 'reseller' ||
    adminEmails.includes(email) ||
    email.includes('silva.chamo') ||
    email.includes('chamo.silva');
  if (!allowed) {
    return { error: NextResponse.json({ error: 'Acesso restrito.' }, { status: 403 }) };
  }
  return { session };
}

/** Admin / revendedor / lista explícita (para operações sensíveis no painel). */
export function isStaffSession(session: Session | null): boolean {
  if (!session?.user) return false;
  const role = session.user.user_metadata?.role || session.user.app_metadata?.role;
  const email = (session.user.email || '').toLowerCase();
  return (
    role === 'admin' ||
    role === 'reseller' ||
    adminEmails.includes(email) ||
    email.includes('silva.chamo') ||
    email.includes('chamo.silva')
  );
}

/**
 * Leituras / stubs seguros para qualquer utilizador com sessão (ex.: painel cliente).
 * Todas as outras acções do bridge exigem admin ou revendedor.
 */
const PANEL_BRIDGE_ANY_AUTH_ACTIONS = new Set([
  'listWebsites',
  'listEmails',
  'listDNS',
  'listSubdomains',
  'listDatabases',
  'listFTPAccounts',
  'getEmailForwarding',
  'getCatchAllEmail',
  'getPatternForwarding',
  'getPlusAddressing',
  'getDKIMStatus',
  'getPHPConfig',
  'getFirewallStatus',
  'getModSecurityStatus',
  'getBlockedIPs',
  'listWordPress',
  'listWPPlugins',
  'listWPBackups',
]);

/**
 * @returns null se OK, ou NextResponse de erro.
 */
export function panelBridgeStaffGate(
  session: Session | null,
  action: string
): NextResponse | null {
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Não autorizado.' }, { status: 401 });
  }
  if (PANEL_BRIDGE_ANY_AUTH_ACTIONS.has(action)) {
    return null;
  }
  if (!isStaffSession(session)) {
    return NextResponse.json(
      { success: false, error: 'Esta acção requer conta de administrador ou revendedor.' },
      { status: 403 }
    );
  }
  return null;
}
