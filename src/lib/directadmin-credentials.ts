/**
 * Credenciais DirectAdmin — admin via env; revendedor via Supabase (automático).
 */

import {
  loadResellerCredentialsByUserId,
  loadResellerCredentialsByEmail,
} from '@/lib/da-credential-store';

export type DirectAdminRole = 'admin' | 'reseller';

export interface DirectAdminCredentials {
  role: DirectAdminRole;
  user: string;
  password: string;
}

export type DirectAdminAuthContext = {
  id?: string;
  email?: string;
  role: DirectAdminRole;
};

function readEnv(name: string): string {
  const value = process.env[name];
  if (!value) return '';
  return value.trim().replace(/^['"]|['"]$/g, '');
}

function pickAdminPassword(): string {
  const candidates = [
    readEnv('DIRECTADMIN_LOGIN_KEY'),
    readEnv('DIRECTADMIN_PASSWORD'),
    readEnv('DIRECTADMIN_PASS'),
  ];
  return candidates.find(Boolean) || '';
}

function resolveAdminCredentials(): DirectAdminCredentials {
  const user = readEnv('DIRECTADMIN_USER') || 'admin';
  const password = pickAdminPassword();
  if (!password) {
    throw new Error(
      'Credencial DirectAdmin admin ausente. Configure DIRECTADMIN_PASSWORD ou DIRECTADMIN_LOGIN_KEY.',
    );
  }
  return { role: 'admin', user, password };
}

/** Legado — migração de contas já existentes no servidor (ex.: Osher). */
async function resolveLegacyEnvReseller(): Promise<DirectAdminCredentials | null> {
  const user = readEnv('DIRECTADMIN_RESELLER_USER');
  const password =
    readEnv('DIRECTADMIN_RESELLER_LOGIN_KEY') ||
    readEnv('DIRECTADMIN_RESELLER_PASSWORD') ||
    readEnv('DIRECTADMIN_RESELLER_PASS');
  if (!user || !password) return null;
  return { role: 'reseller', user, password };
}

export async function resolveDirectAdminCredentials(
  role: DirectAdminRole = 'admin',
  context?: DirectAdminAuthContext,
): Promise<DirectAdminCredentials> {
  if (role === 'admin') {
    return resolveAdminCredentials();
  }

  if (context?.id) {
    const stored = await loadResellerCredentialsByUserId(context.id);
    if (stored) {
      return { role: 'reseller', user: stored.user, password: stored.password };
    }
  }

  if (context?.email) {
    const stored = await loadResellerCredentialsByEmail(context.email);
    if (stored) {
      return { role: 'reseller', user: stored.user, password: stored.password };
    }
  }

  // Sem credenciais ligadas a esta conta — não usar env legado (evita ver dados de outro revendedor).
  if (context?.id || context?.email) {
    throw new Error(
      'Conta de revenda em provisionamento. Aguarde alguns segundos ou sincronize em Admin → Utilizadores.',
    );
  }

  const legacy = await resolveLegacyEnvReseller();
  if (legacy) return legacy;

  throw new Error(
    'Conta de revenda em provisionamento. Aguarde alguns segundos ou sincronize em Admin → Utilizadores.',
  );
}

export async function getResellerDaUsername(context?: DirectAdminAuthContext): Promise<string> {
  if (context?.id) {
    const stored = await loadResellerCredentialsByUserId(context.id);
    if (stored?.user) return stored.user;
  }
  if (context?.email) {
    const stored = await loadResellerCredentialsByEmail(context.email);
    if (stored?.user) return stored.user;
  }
  return readEnv('DIRECTADMIN_RESELLER_USER') || readEnv('NEXT_PUBLIC_DIRECTADMIN_RESELLER_USER') || '';
}
