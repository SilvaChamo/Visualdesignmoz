import type { SupabaseClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import type { UserRole } from '@/lib/user-roles';

const ALGO = 'aes-256-gcm';
const SALT = 'visualdesign-panel-credentials-v1';

function encryptionKey(): Buffer {
  const secret =
    process.env.PANEL_CREDENTIALS_SECRET ||
    process.env.DA_CREDENTIALS_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    '';
  if (!secret) {
    throw new Error('PANEL_CREDENTIALS_SECRET ou SUPABASE_SERVICE_ROLE_KEY necessário para encriptar credenciais.');
  }
  return crypto.scryptSync(secret, SALT, 32);
}

export function encryptStoredPassword(plain: string): string {
  const key = encryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

export function decryptStoredPassword(encoded: string): string {
  if (!encoded) return '';
  if (!encoded.startsWith('v1:')) {
    // legado: valores gravados antes da migração para AES-256-GCM (apenas base64)
    try {
      return Buffer.from(encoded, 'base64').toString('utf8');
    } catch {
      return encoded;
    }
  }
  try {
    const [, ivB64, tagB64, dataB64] = encoded.split(':');
    if (!ivB64 || !tagB64 || !dataB64) return '';
    const key = encryptionKey();
    const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    const dec = Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64')),
      decipher.final(),
    ]);
    return dec.toString('utf8');
  } catch {
    // AES-GCM recusa o ciphertext se a chave for outra (ex.: PANEL_CREDENTIALS_SECRET
    // diferente entre Hetzner e Contabo) ou se o blob estiver corrompido. Nunca
    // rebentar o GET — o chamador trata string vazia como "sem password guardada".
    return '';
  }
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
    params.role === 'admin' ||
    params.role === 'manager' ||
    params.role === 'reseller' ||
    params.role === 'profissional'
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

