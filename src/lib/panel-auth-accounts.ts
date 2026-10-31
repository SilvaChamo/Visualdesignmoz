import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserRole } from '@/lib/user-roles';
import { PANEL_SLUG } from '@/lib/panel-tenant';
import { profileName, type ProfileRow } from '@/lib/profile-db';

export type PanelAuthAccountRow = {
  id: string;
  user_id: string;
  email: string;
  role: UserRole;
  name: string | null;
  panel_slug: string;
  server_linked: boolean;
  da_username: string | null;
  reseller_tier?: string | null;
  provider?: string;
  created_at?: string;
  updated_at?: string;
};

const MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS public.panel_auth_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'reseller', 'client', 'guest')),
  name TEXT,
  panel_slug TEXT NOT NULL DEFAULT 'visualdesign',
  server_linked BOOLEAN NOT NULL DEFAULT false,
  da_username TEXT,
  reseller_tier TEXT,
  provider TEXT NOT NULL DEFAULT 'directadmin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (panel_slug, email)
);
-- CREATE TABLE IF NOT EXISTS acima é no-op numa tabela já existente — quem já
-- tinha esta tabela sem reseller_tier/provider precisa destes ALTER
-- explícitos (o upsert em upsertPanelAuthAccount grava sempre estes campos).
ALTER TABLE public.panel_auth_accounts ADD COLUMN IF NOT EXISTS reseller_tier TEXT;
ALTER TABLE public.panel_auth_accounts ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'directadmin';
CREATE INDEX IF NOT EXISTS idx_panel_auth_accounts_slug ON public.panel_auth_accounts (panel_slug);
CREATE INDEX IF NOT EXISTS idx_panel_auth_accounts_role ON public.panel_auth_accounts (role);
CREATE INDEX IF NOT EXISTS idx_panel_auth_accounts_email ON public.panel_auth_accounts (email);
ALTER TABLE public.panel_auth_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on panel_auth_accounts" ON public.panel_auth_accounts;
CREATE POLICY "Allow all on panel_auth_accounts" ON public.panel_auth_accounts FOR ALL USING (true) WITH CHECK (true);
`;

let schemaReady = false;

export async function ensurePanelAuthAccountsSchema(admin: SupabaseClient): Promise<boolean> {
  if (schemaReady) return true;

  try {
    const { error } = await admin.rpc('exec_sql', { sql: MIGRATION_SQL });
    if (!error) {
      schemaReady = true;
      return true;
    }
  } catch {
    /* RPC pode não existir */
  }

  const { error: probeErr } = await admin.from('panel_auth_accounts').select('id').limit(1);
  if (!probeErr) {
    schemaReady = true;
    return true;
  }

  console.warn('[panel-auth-accounts] Tabela em falta — execute scripts/migrate-panel-auth-accounts.sql no Supabase.');
  return false;
}

export async function upsertPanelAuthAccount(
  admin: SupabaseClient,
  params: {
    userId: string;
    email: string;
    role: UserRole;
    name?: string | null;
    serverLinked?: boolean;
    daUsername?: string | null;
    resellerTier?: string | null;
    panelSlug?: string;
    /** Qual servidor de hospedagem trata esta conta. Omitir preserva o valor
     * actual num upsert (não sobrescreve para 'directadmin' por engano). */
    provider?: 'directadmin' | 'hestia';
  },
): Promise<void> {
  await ensurePanelAuthAccountsSchema(admin);

  const email = params.email.toLowerCase().trim();
  const payload: Record<string, unknown> = {
    user_id: params.userId,
    email,
    // a tabela só aceita admin/manager/reseller/client/guest: «profissional» (plano Pro, Business, Enterprise) é um cliente; o painel
    // Profissional vem do plano e do perfil, não desta coluna (era isto que impedia criar a conta de quem comprava um plano Pro)
    role: params.role === 'profissional' ? 'client' : params.role,
    name: params.name?.trim() || email.split('@')[0] || null,
    panel_slug: (params.panelSlug || PANEL_SLUG).toLowerCase(),
    server_linked: params.serverLinked === true,
    da_username: params.daUsername?.trim() || null,
    reseller_tier: params.resellerTier?.trim() || null,
    updated_at: new Date().toISOString(),
  };
  if (params.provider) payload.provider = params.provider;

  // O e-mail só pode estar numa linha por painel. Uma linha de outro login com o mesmo e-mail é, quase sempre, sobra de um login que já
  // não existe (apagado e criado de novo): essa sai e a nova entra; se esse login existir mesmo, é outra conta e não se mistura.
  const { data: outras, error: erroOutras } = await admin
    .from('panel_auth_accounts')
    .select('user_id')
    .eq('panel_slug', payload.panel_slug as string)
    .eq('email', email)
    .neq('user_id', params.userId);
  if (erroOutras) throw new Error(erroOutras.message);
  for (const outra of outras || []) {
    const { data: login, error: erroLogin } = await admin.auth.admin.getUserById(outra.user_id);
    if (login?.user) throw new Error(`O e-mail ${email} já está registado noutra conta do painel.`);
    if (erroLogin && erroLogin.status !== 404 && !/not found/i.test(erroLogin.message)) throw new Error(erroLogin.message);
    await admin.from('panel_auth_accounts').delete().eq('user_id', outra.user_id);
  }

  const { error } = await admin.from('panel_auth_accounts').upsert(payload, { onConflict: 'user_id' });
  if (error) throw new Error(error.message);
}

export async function deletePanelAuthAccount(admin: SupabaseClient, userId: string): Promise<void> {
  await ensurePanelAuthAccountsSchema(admin);
  const { error } = await admin.from('panel_auth_accounts').delete().eq('user_id', userId);
  if (error) throw new Error(error.message);
}

export async function listPanelAuthAccounts(
  admin: SupabaseClient,
  panelSlug = PANEL_SLUG,
): Promise<PanelAuthAccountRow[]> {
  await ensurePanelAuthAccountsSchema(admin);
  const { data, error } = await admin
    .from('panel_auth_accounts')
    .select('*')
    .eq('panel_slug', panelSlug.toLowerCase())
    .order('email');

  if (error) {
    console.error('[panel-auth-accounts] list:', error.message);
    return [];
  }

  return (data || []) as PanelAuthAccountRow[];
}

/** Preenche a tabela a partir de profiles existentes (sync / migração). */
export async function backfillPanelAuthAccountsFromProfiles(admin: SupabaseClient): Promise<number> {
  await ensurePanelAuthAccountsSchema(admin);

  const { data: profiles, error } = await admin
    .from('profiles')
    .select('id, user_id, email, role, name, da_username');

  if (error || !profiles?.length) return 0;

  let synced = 0;
  for (const profile of profiles as ProfileRow[]) {
    const email = (profile.email || '').toLowerCase().trim();
    const userId = String(profile.user_id || profile.id || '').trim();
    if (!email || !userId) continue;

    const role = profile.role;
    if (role !== 'admin' && role !== 'manager' && role !== 'reseller' && role !== 'client' && role !== 'guest') {
      continue;
    }

    try {
      await upsertPanelAuthAccount(admin, {
        userId,
        email,
        role: role as UserRole,
        name: profileName(profile, email.split('@')[0]),
        serverLinked: Boolean(profile.da_username),
        daUsername: profile.da_username ?? null,
      });
      synced += 1;
    } catch (e) {
      console.warn('[panel-auth-accounts] backfill skip:', email, e);
    }
  }

  return synced;
}
