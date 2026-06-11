/**
 * Auto-provisionamento revendedor — zero passos manuais.
 * Idempotente: pode correr no sync admin, no login e ao abrir /revendedor.
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import { daRequest } from '@/lib/directadmin';
import { ensureResellerSchema } from '@/lib/reseller-schema';
import {
  loadResellerCredentialsByUserId,
  saveResellerCredentials,
} from '@/lib/da-credential-store';
import {
  deriveResellerDomain,
  provisionResellerAccount,
  sanitizeDaUsername,
  type ProvisionResellerResult,
} from '@/lib/reseller-provision';

export type EnsureProvisionInput = {
  userId: string;
  email: string;
  nome?: string;
  /** Se omitida, gera e actualiza Auth + DirectAdmin */
  password?: string;
  domain?: string;
};

export type EnsureProvisionResult = ProvisionResellerResult & {
  alreadyProvisioned?: boolean;
  generatedPassword?: boolean;
};

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase Service Role não configurado.');
  return createClient(url, key);
}

export function generateProvisionerPassword(): string {
  return crypto.randomBytes(12).toString('base64url').slice(0, 16);
}

function parseUsernameMap(): Record<string, string> {
  const raw = process.env.RESELLER_DA_USERNAME_MAP?.trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

export function daUsernameCandidates(email: string, nome?: string): string[] {
  const normalized = email.toLowerCase().trim();
  const map = parseUsernameMap();
  const fromMap = map[normalized];
  const local = normalized.split('@')[0] || '';
  const domainPart = normalized.split('@')[1] || '';
  const domainBase = domainPart.split('.')[0] || '';

  const candidates = [
    fromMap,
    map[domainPart],
    domainBase,
    sanitizeDaUsername(local),
    sanitizeDaUsername(nome || ''),
    sanitizeDaUsername(domainPart.replace(/\./g, '')),
  ].filter(Boolean) as string[];

  return [...new Set(candidates)];
}

async function daResellerExists(username: string): Promise<boolean> {
  const res = await daRequest(
    'CMD_API_SHOW_USER_CONFIG',
    'GET',
    { user: username, json: 'yes' },
    'admin',
  );
  return !res.error;
}

async function findExistingDaResellerUsername(email: string, nome?: string): Promise<string | null> {
  for (const candidate of daUsernameCandidates(email, nome)) {
    if (await daResellerExists(candidate)) return candidate;
  }
  return null;
}

async function syncAuthPassword(userId: string, password: string): Promise<void> {
  const admin = adminClient();
  const { data: userData } = await admin.auth.admin.getUserById(userId);
  await admin.auth.admin.updateUserById(userId, {
    password,
    email_confirm: true,
    user_metadata: {
      ...userData.user?.user_metadata,
      role: 'reseller',
    },
  });
}

async function setResellerRole(userId: string, email: string, nome?: string): Promise<void> {
  const admin = adminClient();
  const { saveProfileForAuthUser } = await import('@/lib/profile-db');
  await saveProfileForAuthUser(admin, userId, {
    email: email.toLowerCase(),
    role: 'reseller',
    name: nome || email.split('@')[0],
  });
}

/** Garante que um revendedor tem conta DA + credenciais guardadas. */
export async function ensureResellerProvisioned(
  input: EnsureProvisionInput,
): Promise<EnsureProvisionResult> {
  await ensureResellerSchema();

  const email = input.email.toLowerCase().trim();
  if (!input.userId || !email) {
    throw new Error('userId e email são obrigatórios para auto-provisionamento.');
  }

  const existing = await loadResellerCredentialsByUserId(input.userId);
  if (existing?.user) {
    return {
      authUserId: input.userId,
      daUsername: existing.user,
      daDomain: existing.domain || deriveResellerDomain(email, existing.user),
      createdAuth: false,
      createdDirectAdmin: false,
      linkedExisting: true,
      alreadyProvisioned: true,
    };
  }

  await setResellerRole(input.userId, email, input.nome);

  let password = input.password;
  let generatedPassword = false;
  if (!password) {
    password = generateProvisionerPassword();
    generatedPassword = true;
    await syncAuthPassword(input.userId, password);
  }

  const existingDa = await findExistingDaResellerUsername(email, input.nome);
  const userName = existingDa || daUsernameCandidates(email, input.nome)[0];

  const result = await provisionResellerAccount({
    authUserId: input.userId,
    email,
    password,
    nome: input.nome,
    userName,
    domain: input.domain,
    linkExisting: Boolean(existingDa),
  });

  return { ...result, generatedPassword };
}

/** Processa todos os perfis com role=reseller sem credenciais DA. */
export async function provisionAllPendingResellers(): Promise<{
  processed: number;
  provisioned: number;
  skipped: number;
  errors: string[];
}> {
  await ensureResellerSchema();
  const admin = adminClient();

  const { data: profiles, error } = await admin
    .from('profiles')
    .select('id, user_id, email, name, role, da_username')
    .eq('role', 'reseller');

  if (error) throw error;

  const pending = (profiles || []).filter((p) => !p.da_username);
  const errors: string[] = [];
  let provisioned = 0;
  let skipped = 0;

  for (const p of pending) {
    if (!p.email) {
      skipped += 1;
      continue;
    }
    try {
      const r = await ensureResellerProvisioned({
        userId: (p.user_id as string) || p.id,
        email: p.email,
        nome: (p.name as string) || undefined,
      });
      if (r.alreadyProvisioned) skipped += 1;
      else provisioned += 1;
    } catch (e: unknown) {
      errors.push(`${p.email}: ${e instanceof Error ? e.message : 'erro'}`);
    }
  }

  // Auth users com metadata reseller mas sem profile DA
  const { data: authList } = await admin.auth.admin.listUsers({ perPage: 1000 });
  for (const u of authList.users || []) {
    if (!u.email) continue;
    const role = u.user_metadata?.role || u.app_metadata?.role;
    if (role !== 'reseller') continue;
    const creds = await loadResellerCredentialsByUserId(u.id);
    if (creds) continue;
    try {
      await ensureResellerProvisioned({
        userId: u.id,
        email: u.email,
        nome: (u.user_metadata?.nome as string) || undefined,
      });
      provisioned += 1;
    } catch (e: unknown) {
      errors.push(`${u.email}: ${e instanceof Error ? e.message : 'erro'}`);
    }
  }

  return {
    processed: pending.length,
    provisioned,
    skipped,
    errors,
  };
}
