import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/admin-api-auth';
import { resolveEffectiveClientUser } from '@/lib/client-impersonation';

/**
 * "Conta" do painel /cliente quando é o admin dentro da conta de um cliente
 * (impersonação) — o próprio cliente continua a ler/gravar o perfil pela
 * sessão dele no browser. Sem esta rota, o formulário mostrava e gravava o
 * perfil do ADMIN. Só os campos do formulário são aceites (nunca role,
 * da_username, etc.).
 */
const EDITABLE_FIELDS = ['name', 'telefone', 'empresa', 'nuit', 'site', 'morada', 'cidade'] as const;

type ProfileRow = Record<string, unknown> & { id: string; da_username?: string | null; created_at?: string | null };

/** Mesma escolha de getProfileForAuthUser quando há linhas duplicadas: a que tem alojamento, senão a mais antiga. */
async function findProfileRow(admin: SupabaseClient, userId: string): Promise<ProfileRow | null> {
  const { data } = await admin.from('profiles').select('*').eq('user_id', userId);
  const rows = (data as ProfileRow[] | null) ?? [];
  if (rows.length <= 1) return rows[0] ?? null;
  return [...rows].sort((a, b) => {
    const aHas = a.da_username ? 1 : 0;
    const bHas = b.da_username ? 1 : 0;
    if (aHas !== bHas) return bHas - aHas;
    return String(a.created_at || '').localeCompare(String(b.created_at || ''));
  })[0];
}

async function requireImpersonation() {
  // resolveEffectiveClientUser já só impersona para admins — mas esta rota
  // grava perfis com a service role, por isso exige admin explicitamente
  // (mesma regra das rotas irmãs em /api/admin/impersonate-client).
  const auth = await requireAdmin();
  if ('error' in auth) return { error: auth.error };
  const effective = await resolveEffectiveClientUser();
  if (!effective?.impersonating) {
    return { error: NextResponse.json({ success: false, error: 'Não autorizado.' }, { status: 403 }) };
  }
  const admin = getSupabaseAdmin();
  if (!admin) return { error: NextResponse.json({ success: false, error: 'Serviço indisponível.' }, { status: 503 }) };
  return { user: effective.user, admin };
}

export async function GET() {
  const ctx = await requireImpersonation();
  if ('error' in ctx) return ctx.error;
  const profile = await findProfileRow(ctx.admin, ctx.user.id);
  const meta = ctx.user.user_metadata || {};
  return NextResponse.json({
    success: true,
    dados: {
      nome: String(profile?.name || profile?.nome || meta.name || meta.nome || ''),
      email: ctx.user.email || '',
      telefone: String(profile?.telefone || ''),
      empresa: String(profile?.empresa || ''),
      nuit: String(profile?.nuit || ''),
      site: String(profile?.site || ''),
      morada: String(profile?.morada || ''),
      cidade: String(profile?.cidade || ''),
    },
  });
}

export async function PUT(req: NextRequest) {
  const ctx = await requireImpersonation();
  if ('error' in ctx) return ctx.error;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const values: Record<string, string | null> = {};
  for (const field of EDITABLE_FIELDS) {
    const source = field === 'name' ? body.nome : body[field];
    if (source === undefined) continue;
    const value = String(source ?? '').trim();
    values[field] = value || null;
  }

  const existing = await findProfileRow(ctx.admin, ctx.user.id);
  const { error } = existing
    ? await ctx.admin
        .from('profiles')
        .update({ ...values, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
    : await ctx.admin
        .from('profiles')
        .insert({ ...values, user_id: ctx.user.id, email: ctx.user.email, updated_at: new Date().toISOString() });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
