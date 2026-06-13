/**
 * Armazenamento seguro das credenciais DirectAdmin por revendedor (Supabase).
 */

import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const ALGO = 'aes-256-gcm';
const SALT = 'visualdesign-da-v1';

function encryptionKey(): Buffer {
  const secret =
    process.env.DA_CREDENTIALS_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.DIRECTADMIN_PASSWORD ||
    '';
  if (!secret) {
    throw new Error('DA_CREDENTIALS_SECRET ou SUPABASE_SERVICE_ROLE_KEY necessário para encriptar credenciais.');
  }
  return crypto.scryptSync(secret, SALT, 32);
}

export function encryptDaSecret(plain: string): string {
  const key = encryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

export function decryptDaSecret(stored: string): string {
  if (!stored.startsWith('v1:')) {
    // legado base64 (email_contas)
    try {
      return Buffer.from(stored, 'base64').toString('utf8');
    } catch {
      return stored;
    }
  }
  const [, ivB64, tagB64, dataB64] = stored.split(':');
  const key = encryptionKey();
  const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]);
  return dec.toString('utf8');
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase Service Role não configurado.');
  return createClient(url, key);
}

export type StoredResellerCredentials = {
  user: string;
  password: string;
  domain?: string | null;
};

export async function loadResellerCredentialsByUserId(
  userId: string,
): Promise<StoredResellerCredentials | null> {
  const admin = adminClient();
  const { getProfileForAuthUser } = await import('@/lib/profile-db');
  const profile = await getProfileForAuthUser(admin, userId);

  if (!profile?.da_username || !profile?.da_password_encrypted) return null;

  return {
    user: profile.da_username,
    password: decryptDaSecret(profile.da_password_encrypted),
    domain: profile.da_domain,
  };
}

export async function loadResellerCredentialsByDaUsername(
  daUsername: string,
): Promise<StoredResellerCredentials | null> {
  const admin = adminClient();
  const username = daUsername.trim().toLowerCase();

  const { data: panelUser } = await admin
    .from('panel_users')
    .select('username, da_password_encrypted, da_domain')
    .eq('username', daUsername)
    .maybeSingle();

  if (panelUser?.username && panelUser?.da_password_encrypted) {
    return {
      user: panelUser.username,
      password: decryptDaSecret(panelUser.da_password_encrypted),
      domain: panelUser.da_domain,
    };
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('da_username, da_password_encrypted, da_domain')
    .ilike('da_username', username)
    .maybeSingle();

  if (profile?.da_username && profile?.da_password_encrypted) {
    return {
      user: profile.da_username,
      password: decryptDaSecret(profile.da_password_encrypted),
      domain: profile.da_domain,
    };
  }

  return null;
}

export async function loadResellerCredentialsByEmail(
  email: string,
): Promise<(StoredResellerCredentials & { userId?: string }) | null> {
  const admin = adminClient();
  const normalized = email.toLowerCase().trim();

  const { data: profile } = await admin
    .from('profiles')
    .select('id, da_username, da_password_encrypted, da_domain')
    .eq('email', normalized)
    .maybeSingle();

  if (profile?.da_username && profile?.da_password_encrypted) {
    return {
      userId: profile.id,
      user: profile.da_username,
      password: decryptDaSecret(profile.da_password_encrypted),
      domain: profile.da_domain,
    };
  }

  const { data: panelUser } = await admin
    .from('panel_users')
    .select('username, da_password_encrypted, da_domain, auth_user_id')
    .eq('email', normalized)
    .maybeSingle();

  if (panelUser?.username && panelUser?.da_password_encrypted) {
    return {
      userId: panelUser.auth_user_id || undefined,
      user: panelUser.username,
      password: decryptDaSecret(panelUser.da_password_encrypted),
      domain: panelUser.da_domain,
    };
  }

  return null;
}

export async function saveResellerCredentials(input: {
  userId: string;
  email: string;
  nome?: string;
  daUsername: string;
  daPassword: string;
  daDomain: string;
  websitesLimit?: number;
  emailsLimit?: number;
}): Promise<void> {
  const admin = adminClient();
  const encrypted = encryptDaSecret(input.daPassword);
  const now = new Date().toISOString();

  const { saveProfileForAuthUser } = await import('@/lib/profile-db');
  await saveProfileForAuthUser(admin, input.userId, {
    email: input.email.toLowerCase(),
    role: 'reseller',
    name: input.nome || input.email.split('@')[0],
    da_username: input.daUsername,
    da_password_encrypted: encrypted,
    da_domain: input.daDomain,
    da_provisioned_at: now,
  });

  const { data: existing } = await admin
    .from('panel_users')
    .select('id')
    .eq('username', input.daUsername)
    .maybeSingle();

  const panelPayload = {
    username: input.daUsername,
    email: input.email.toLowerCase(),
    first_name: input.nome?.split(' ')[0] || '',
    last_name: input.nome?.split(' ').slice(1).join(' ') || '',
    acl: 'reseller',
    websites_limit: input.websitesLimit ?? 0,
    emails_limit: input.emailsLimit ?? 0,
    status: 'Active',
    auth_user_id: input.userId,
    da_password_encrypted: encrypted,
    da_domain: input.daDomain,
    synced_at: now,
  };

  if (existing?.id) {
    await admin.from('panel_users').update(panelPayload).eq('id', existing.id);
  } else {
    await admin.from('panel_users').insert([panelPayload]);
  }
}
