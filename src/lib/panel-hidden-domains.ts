/**
 * Sites escondidos do painel de uma conta de alojamento (revendedor /
 * profissional) — ver supabase-panel-hidden-domains.sql. Nada é apagado no
 * servidor; as listas do painel dessa conta só deixam de os mostrar.
 * Enquanto a tabela não existir, nada é escondido (listHiddenDomains devolve
 * um conjunto vazio) e esconder devolve um erro claro.
 */
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function listHiddenDomains(owner: string | null | undefined): Promise<Set<string>> {
  const normalized = String(owner || '').trim().toLowerCase();
  const admin = getSupabaseAdmin();
  if (!normalized || !admin) return new Set();
  const { data, error } = await admin.from('panel_hidden_domains').select('domain').eq('owner', normalized);
  if (error) return new Set();
  return new Set((data || []).map((r) => String(r.domain).toLowerCase()));
}

export async function hideDomainFromPanel(
  owner: string,
  domain: string,
  hiddenBy: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false, error: 'Serviço indisponível.' };
  const { error } = await admin.from('panel_hidden_domains').upsert(
    { owner: owner.trim().toLowerCase(), domain: domain.trim().toLowerCase(), hidden_by: hiddenBy, hidden_at: new Date().toISOString() },
    { onConflict: 'owner,domain' },
  );
  if (error) {
    // PGRST205 / 42P01 = tabela ainda não criada (SQL por aplicar).
    if (error.code === 'PGRST205' || error.code === '42P01') {
      return { ok: false, error: 'Falta criar a tabela panel_hidden_domains (supabase-panel-hidden-domains.sql).' };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
