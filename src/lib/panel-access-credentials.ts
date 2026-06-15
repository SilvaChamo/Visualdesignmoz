import type { SupabaseClient } from '@supabase/supabase-js';
import { getRedirectPathForRole, type UserRole } from '@/lib/user-roles';

export function encryptStoredPassword(plain: string): string {
  return Buffer.from(plain).toString('base64');
}

export function decryptStoredPassword(encoded: string): string {
  return Buffer.from(encoded, 'base64').toString('utf8');
}

/** Guarda credenciais exportáveis (espelho ProvisualCorporate — password recuperável para download). */
export async function upsertDownloadableCredentials(
  admin: SupabaseClient,
  params: {
    email: string;
    password: string;
    userId: string;
    role?: UserRole | string;
  },
): Promise<void> {
  const email = params.email.toLowerCase().trim();
  if (!email || !params.password) return;

  const tipo =
    params.role === 'admin' || params.role === 'manager' || params.role === 'reseller'
      ? 'panel'
      : 'webmail';

  await admin.from('email_contas').upsert(
    {
      email,
      senha_servidor: encryptStoredPassword(params.password),
      tipo_conta: tipo,
      status: 'active',
      cliente_id: params.userId,
    },
    { onConflict: 'email' },
  );
}

export function buildPanelAccessConfigText(params: {
  email: string;
  password: string;
  panelRole: UserRole | string;
  name?: string | null;
  origin?: string;
}): { plainText: string; outlookFile: string; shareText: string } {
  const origin = params.origin || 'https://visualdesignmoz.com';
  const panelPath = getRedirectPathForRole(
    (params.panelRole as UserRole) || 'client',
  );
  const plainText = `
ACESSO AO PAINEL
================

Nome: ${params.name || params.email.split('@')[0]}
Email: ${params.email}
Palavra-passe: ${params.password}
Destino: ${panelPath}
URL de entrada: ${origin}/auth/login

Guarde estas credenciais em local seguro.
`.trim();

  return {
    plainText,
    outlookFile: plainText,
    shareText: plainText,
  };
}
