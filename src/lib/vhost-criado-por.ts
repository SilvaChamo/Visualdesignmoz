/**
 * Quem criou cada conta (Silva, 18/11/2026): um administrador normal só mexe nas contas que ele próprio criou; o super administrador
 * mexe em todas. Guarda-se em panel_users.criado_por (id do login do site de quem criou). A coluna acrescenta-se sozinha
 * (exec_sql, como as outras); se não existir, nada é gravado nem lido e um administrador normal fica sem contas «suas» (só o super
 * administrador as altera) — nunca ao contrário.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

let pronta = false;

export async function garantirCriadoPor(sb: SupabaseClient): Promise<boolean> {
  if (pronta) return true;
  try {
    await sb.rpc('exec_sql', { sql: 'ALTER TABLE panel_users ADD COLUMN IF NOT EXISTS criado_por TEXT;' });
  } catch {
    /* a função pode não existir: o teste abaixo diz se a coluna está lá */
  }
  const { error } = await sb.from('panel_users').select('criado_por').limit(1);
  pronta = !error;
  return pronta;
}

/** Contas criadas por este utilizador do site (vazio se a coluna ainda não existe) */
export async function contasCriadasPor(sb: SupabaseClient, userId: string): Promise<Set<string>> {
  const { data, error } = await sb.from('panel_users').select('username').eq('criado_por', userId);
  if (error) return new Set();
  return new Set((data || []).map((r) => String(r.username).toLowerCase()));
}

/** Regista quem criou a conta (sem falhar se a coluna não existir) */
export async function registarCriadoPor(sb: SupabaseClient, conta: string, userId: string): Promise<void> {
  if (!(await garantirCriadoPor(sb))) return;
  await sb.from('panel_users').update({ criado_por: userId }).eq('username', conta);
}
