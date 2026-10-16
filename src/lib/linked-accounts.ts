/**
 * Contas de domínio ligadas a uma conta principal (Premium/Enterprise).
 *
 * O Hestia não tem revenda — cada conta é independente no servidor. A ligação
 * "esta conta pertence àquela" vive só no painel, em
 * `panel_users.parent_username` (a mesma coluna que o revendedor já preenche
 * ao criar contas de clientes; o hestia-sync nunca a apaga porque não a
 * envia no upsert).
 *
 * Premium: entrar numa conta ligada exige as credenciais dessa conta. Depois
 * de confirmadas no Hestia, o painel guarda numa cookie ASSINADA qual a conta
 * em que o login entrou — assinada com o id do login, para uma cookie
 * copiada/forjada nunca servir de atalho para saltar a password.
 */

import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'crypto';
import { getDaSyncAdmin } from '@/lib/da-sync-schema';
import {
  accountLevelForPackage,
  levelAllowsLinkedAccounts,
  type AccountLevel,
} from '@/lib/account-levels';

export const LINKED_ACCOUNT_COOKIE = 'vd_linked_account';
const ENTER_TTL_SECONDS = 60 * 60 * 8;

export type LinkedAccountRow = {
  username: string;
  packageName: string | null;
  email: string | null;
};

export type AccountScope = {
  /** Conta principal (a do login, ou a impersonada pelo admin). */
  main: string;
  mainPackage: string | null;
  level: AccountLevel | null;
  /** Contas ligadas que o nível reconhece (vazio em Básico/sem plano). */
  linked: LinkedAccountRow[];
  /** Conta ligada em que o login entrou com credenciais (só Premium). */
  entered: string | null;
  /** Contas cujos domínios o login gere directamente neste momento. */
  manageOwners: string[];
  /** Contas listadas mas trancadas — pedem credenciais (Premium). */
  lockedOwners: string[];
};

type AccountRows = {
  mainPackage: string | null;
  /** O login dono da conta principal é revendedor (ex.: Osher Collective). */
  ownerIsReseller: boolean;
  linked: LinkedAccountRow[];
};

const ROWS_CACHE_MS = 30_000;
const rowsCache = new Map<string, AccountRows & { at: number }>();

export function invalidateLinkedAccountsCache(main?: string): void {
  if (main) rowsCache.delete(main.trim().toLowerCase());
  else rowsCache.clear();
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

async function loadAccountRows(main: string): Promise<AccountRows> {
  const key = main.trim().toLowerCase();
  const cached = rowsCache.get(key);
  if (cached && Date.now() - cached.at < ROWS_CACHE_MS) {
    return { mainPackage: cached.mainPackage, ownerIsReseller: cached.ownerIsReseller, linked: cached.linked };
  }

  const sb = getDaSyncAdmin();
  if (!sb || !key) return { mainPackage: null, ownerIsReseller: false, linked: [] };

  const [mainRes, childRes, profileRes] = await Promise.all([
    sb.from('panel_users').select('username, package_name, auth_user_id').ilike('username', escapeLike(key)).maybeSingle(),
    sb.from('panel_users').select('username, package_name, email').ilike('parent_username', escapeLike(key)),
    sb.from('profiles').select('role').ilike('da_username', escapeLike(key)),
  ]);

  let ownerIsReseller = (profileRes.data || []).some((row) => String(row.role || '') === 'reseller');
  const ownerUserId = mainRes.data?.auth_user_id ? String(mainRes.data.auth_user_id) : '';
  if (!ownerIsReseller && ownerUserId) {
    const { data: ownerProfile } = await sb.from('profiles').select('role').eq('user_id', ownerUserId).maybeSingle();
    ownerIsReseller = String(ownerProfile?.role || '') === 'reseller';
  }

  const mainPackage = mainRes.data?.package_name ? String(mainRes.data.package_name) : null;
  const linked = (childRes.data || [])
    .map((row) => ({
      username: String(row.username || '').trim().toLowerCase(),
      packageName: row.package_name ? String(row.package_name) : null,
      email: row.email ? String(row.email) : null,
    }))
    .filter((row) => row.username && row.username !== key)
    .sort((a, b) => a.username.localeCompare(b.username));

  rowsCache.set(key, { at: Date.now(), mainPackage, ownerIsReseller, linked });
  return { mainPackage, ownerIsReseller, linked };
}

function cookieSecret(): string {
  return (process.env.LINKED_ACCOUNT_COOKIE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
}

function signEntry(secret: string, userId: string, username: string, exp: number): string {
  return createHmac('sha256', secret).update(`${userId}|${username}|${exp}`).digest('base64url');
}

/** Valor da cookie de entrada — "<conta>.<expira em s>.<assinatura>". A
 * assinatura junta o id do login, por isso a cookie não serve a mais ninguém. */
export function buildLinkedEntryValue(userId: string, username: string, exp: number, secret: string): string | null {
  if (!secret || !userId || !username) return null;
  return `${username}.${exp}.${signEntry(secret, userId, username, exp)}`;
}

/** Conta em que o login entrou, ou null se a cookie expirou, foi forjada,
 * pertence a outro login, ou a conta já não está ligada à principal. */
export function parseLinkedEntryValue(
  raw: string,
  userId: string,
  allowedUsernames: string[],
  secret: string,
  nowMs = Date.now(),
): string | null {
  if (!raw || !secret || !userId) return null;
  const [username, expRaw, sig, ...rest] = raw.trim().split('.');
  const exp = Number(expRaw);
  if (rest.length || !username || !sig || !Number.isFinite(exp) || exp * 1000 < nowMs) return null;
  const a = Buffer.from(sig);
  const b = Buffer.from(signEntry(secret, userId, username, exp));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return allowedUsernames.includes(username) ? username : null;
}

async function readEnteredLinkedAccount(userId: string, allowed: LinkedAccountRow[]): Promise<string | null> {
  const store = await cookies();
  const raw = store.get(LINKED_ACCOUNT_COOKIE)?.value;
  if (!raw) return null;
  return parseLinkedEntryValue(raw, userId, allowed.map((row) => row.username), cookieSecret());
}

export async function setEnteredLinkedAccount(userId: string, username: string): Promise<boolean> {
  const exp = Math.floor(Date.now() / 1000) + ENTER_TTL_SECONDS;
  const value = buildLinkedEntryValue(userId, username, exp, cookieSecret());
  if (!value) return false;
  const store = await cookies();
  store.set(LINKED_ACCOUNT_COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ENTER_TTL_SECONDS,
  });
  return true;
}

export async function clearEnteredLinkedAccount(): Promise<void> {
  const store = await cookies();
  store.delete(LINKED_ACCOUNT_COOKIE);
}

/**
 * Âmbito real de uma conta principal: que contas o login gere directamente
 * agora e quais aparecem trancadas. `sessionUserId` é o id do login real —
 * null quando é o admin a impersonar (o admin entra directamente na conta
 * que quiser, não precisa de credenciais de conta ligada).
 */
export async function resolveAccountScope(main: string, sessionUserId: string | null): Promise<AccountScope> {
  const normalizedMain = main.trim().toLowerCase();
  const { mainPackage, ownerIsReseller, linked: allLinked } = await loadAccountRows(normalizedMain);
  // Um revendedor gere sempre directamente as contas dos seus clientes —
  // é Enterprise seja qual for o pacote da sua própria conta.
  const level = ownerIsReseller ? 'enterprise' : accountLevelForPackage(mainPackage);
  const linked = levelAllowsLinkedAccounts(level) ? allLinked : [];

  const base = { main: normalizedMain, mainPackage, level, linked };

  if (level === 'premium' && sessionUserId && linked.length) {
    const entered = await readEnteredLinkedAccount(sessionUserId, linked);
    if (entered) {
      return { ...base, entered, manageOwners: [entered], lockedOwners: [] };
    }
  }

  if (level === 'enterprise') {
    return {
      ...base,
      entered: null,
      manageOwners: [normalizedMain, ...linked.map((row) => row.username)],
      lockedOwners: [],
    };
  }

  return {
    ...base,
    entered: null,
    manageOwners: [normalizedMain],
    lockedOwners: level === 'premium' ? linked.map((row) => row.username) : [],
  };
}
