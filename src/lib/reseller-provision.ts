/**
 * Provisionamento automático: painel Visual Design ↔ conta revendedor DirectAdmin.
 */

import { createClient } from '@supabase/supabase-js';
import { daRequest } from '@/lib/directadmin';
import { resolveDirectAdminCredentials } from '@/lib/directadmin-credentials';
import { saveResellerCredentials } from '@/lib/da-credential-store';

const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'yahoo.com',
  'icloud.com',
  'proton.me',
  'protonmail.com',
]);

export type ProvisionResellerInput = {
  email: string;
  password: string;
  nome?: string;
  firstName?: string;
  lastName?: string;
  userName?: string;
  domain?: string;
  packageName?: string;
  websitesLimit?: number;
  emailsLimit?: number;
  /** Ligar conta DA já existente (ex.: oshercollective) em vez de criar nova */
  linkExisting?: boolean;
  authUserId?: string;
};

export type ProvisionResellerResult = {
  authUserId: string;
  daUsername: string;
  daDomain: string;
  createdAuth: boolean;
  createdDirectAdmin: boolean;
  linkedExisting: boolean;
};

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase Service Role não configurado.');
  return createClient(url, key);
}

export function sanitizeDaUsername(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 20) || 'revendedor';
}

export function deriveResellerDomain(email: string, userName: string): string {
  const emailDomain = email.split('@')[1]?.toLowerCase().trim();
  if (emailDomain && !FREE_EMAIL_DOMAINS.has(emailDomain)) {
    return emailDomain;
  }
  return `${userName}.com`;
}

async function pickResellerPackage(): Promise<string> {
  const res = await daRequest('CMD_API_PACKAGES_RESELLER', 'GET', { json: 'yes' }, 'admin');
  if (res.error || !res.data) {
    return process.env.DIRECTADMIN_RESELLER_DEFAULT_PACKAGE || 'reseller';
  }
  const list = res.data.list;
  if (Array.isArray(list) && list.length > 0) return String(list[0]);
  for (const [k, v] of Object.entries(res.data)) {
    if (k.startsWith('list') && v) return String(v);
  }
  return process.env.DIRECTADMIN_RESELLER_DEFAULT_PACKAGE || 'reseller';
}

async function daUserExists(username: string): Promise<boolean> {
  const res = await daRequest('CMD_API_SHOW_USER_CONFIG', 'GET', { user: username, json: 'yes' }, 'admin');
  return !res.error;
}

async function createDirectAdminReseller(params: {
  username: string;
  email: string;
  password: string;
  domain: string;
  packageName: string;
}): Promise<void> {
  const response = await daRequest(
    'CMD_API_ACCOUNT_RESELLER',
    'POST',
    {
      action: 'create',
      username: params.username,
      email: params.email,
      passwd: params.password,
      passwd2: params.password,
      domain: params.domain,
      package: params.packageName,
      ip: 'shared',
      notify: 'no',
    },
    'admin',
  );

  if (response.error) {
    throw new Error(response.details || response.text || 'Erro ao criar revendedor no DirectAdmin');
  }
}

async function ensureAuthUser(input: ProvisionResellerInput): Promise<{ id: string; created: boolean }> {
  const admin = adminClient();
  const email = input.email.toLowerCase().trim();

  if (input.authUserId) {
    return { id: input.authUserId, created: false };
  }

  const { data: listed } = await admin.auth.admin.listUsers();
  const existing = listed.users.find((u) => u.email?.toLowerCase() === email);

  if (existing) {
    await admin.auth.admin.updateUserById(existing.id, {
      password: input.password,
      email_confirm: true,
      user_metadata: {
        ...existing.user_metadata,
        role: 'reseller',
        nome: input.nome || existing.user_metadata?.nome,
        da_username: input.userName,
      },
    });
    return { id: existing.id, created: false };
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      role: 'reseller',
      nome: input.nome || email.split('@')[0],
      da_username: input.userName,
    },
  });

  if (error || !data.user) {
    throw new Error(error?.message || 'Erro ao criar utilizador no painel Visual Design');
  }

  return { id: data.user.id, created: true };
}

export async function provisionResellerAccount(
  input: ProvisionResellerInput,
): Promise<ProvisionResellerResult> {
  const email = input.email.toLowerCase().trim();
  if (!email || !input.password) {
    throw new Error('Email e password são obrigatórios.');
  }

  const daUsername = sanitizeDaUsername(
    input.userName || email.split('@')[0] || input.nome || 'revendedor',
  );
  const daDomain = input.domain?.trim() || deriveResellerDomain(email, daUsername);
  const packageName = input.packageName || (await pickResellerPackage());

  let createdDirectAdmin = false;
  let linkedExisting = false;

  const exists = await daUserExists(daUsername);

  if (input.linkExisting) {
    if (!exists) {
      throw new Error(`Conta DirectAdmin "${daUsername}" não encontrada para ligação.`);
    }
    linkedExisting = true;
  } else if (exists) {
    linkedExisting = true;
  } else {
    await createDirectAdminReseller({
      username: daUsername,
      email,
      password: input.password,
      domain: daDomain,
      packageName,
    });
    createdDirectAdmin = true;
  }

  if (linkedExisting) {
    const syncBody: Record<string, string> = {
      action: 'single',
      user: daUsername,
      passwd: input.password,
      passwd2: input.password,
    };
    if (email.includes('@')) syncBody.email = email;
    await daRequest('CMD_API_MODIFY_USER', 'POST', syncBody, 'admin');
  }

  const auth = await ensureAuthUser({ ...input, userName: daUsername });

  await saveResellerCredentials({
    userId: auth.id,
    email,
    nome: input.nome || `${input.firstName || ''} ${input.lastName || ''}`.trim(),
    daUsername,
    daPassword: input.password,
    daDomain,
    websitesLimit: input.websitesLimit,
    emailsLimit: input.emailsLimit,
  });

  const supabase = adminClient();
  await supabase.auth.admin.updateUserById(auth.id, {
    user_metadata: {
      role: 'reseller',
      nome: input.nome || email.split('@')[0],
      da_username: daUsername,
      da_domain: daDomain,
    },
  });

  return {
    authUserId: auth.id,
    daUsername,
    daDomain,
    createdAuth: auth.created,
    createdDirectAdmin,
    linkedExisting,
  };
}
