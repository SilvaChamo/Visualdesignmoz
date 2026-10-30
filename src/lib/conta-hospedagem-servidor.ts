import type { SupabaseClient } from '@supabase/supabase-js';
import { nomeContaValido, NOME_CONTA_ERRO } from '@/lib/conta-hospedagem';
import type { CatalogCartItem } from '@/lib/package-catalog';

/** Quem quer o nome (para o nome que sobrou de uma compra sua não o impedir): o login e/ou o e-mail digitado. */
export type DonoDoNome = { id?: string | null; email?: string | null };

/** O nome existe mesmo no servidor? null = não foi possível ler (o servidor demora ou não responde). */
async function nomeNoServidor(nome: string): Promise<boolean | null> {
  try {
    const { listUsers } = await import('@/lib/hestia-adapter');
    // O servidor pode demorar: não se espera mais de 3 s
    const contas = await Promise.race([listUsers(), new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000))]);
    if (!contas || !contas.length) return null; // a leitura que falha também dá lista vazia
    return contas.some((c) => c.username.toLowerCase() === nome);
  } catch {
    return null;
  }
}

/**
 * O nome de utilizador já está ocupado? (sem maiúsculas) (Silva, 30/10/2026: «o nome diz que já existe e não existe a conta»)
 * Ocupado é: a conta existe no servidor; ou há registo no painel e o servidor não se consegue ler; ou o registo é de outra pessoa
 * que tem um pedido de hospedagem por tratar com esse nome. Um registo sem conta no servidor (sobra de uma compra que não chegou
 * a criá-la) não ocupa o nome, nem para quem o deixou: o nome volta a poder ser usado.
 */
export async function nomeContaOcupado(admin: SupabaseClient, nome: string, dono: DonoDoNome = {}): Promise<boolean> {
  const [{ data: painel }, { data: perfis }] = await Promise.all([
    admin.from('panel_users').select('auth_user_id').ilike('username', nome).limit(5),
    admin.from('profiles').select('user_id').ilike('da_username', nome).limit(5),
  ]);
  const registos = [...(painel || []).map((r) => r.auth_user_id), ...(perfis || []).map((r) => r.user_id)] as (string | null)[];
  const noServidor = await nomeNoServidor(nome);
  if (noServidor === true) return true;
  if (!registos.length) return false;
  if (noServidor === null) return true; // sem ver o servidor, vale o registo

  const donos = [...new Set(registos.filter((id): id is string => Boolean(id)))];
  const email = String(dono.email || '').trim().toLowerCase();
  const reservados: string[] = [];
  for (const id of donos) {
    if (dono.id && id === dono.id) continue;
    const { data } = await admin.auth.admin.getUserById(id).catch(() => ({ data: null }));
    if (email && data?.user?.email?.toLowerCase() === email) continue; // é da própria pessoa (outro login com o mesmo e-mail)
    reservados.push(id);
  }
  if (!reservados.length) return false;
  // de outra pessoa: só reserva o nome se ela tiver um pedido ainda por tratar
  const { data: pedidos } = await admin.from('checkout_sessions').select('id').in('user_id', reservados).in('status', ['pending', 'paid']).limit(1);
  return Boolean(pedidos?.length);
}

/** Valida o nome de utilizador de cada hospedagem do pedido: obrigatório, bem escrito, livre e sem repetições. */
export async function validarContasDeHospedagem(admin: SupabaseClient, itens: CatalogCartItem[], dono: DonoDoNome = {}): Promise<string | null> {
  const vistos = new Set<string>();
  for (const item of itens) {
    if (item.type !== 'hosting') continue;
    const nome = String(item.contaUtilizador || '').trim().toLowerCase();
    if (!nome) return `Indique o nome de utilizador da conta de hospedagem de ${item.hostingDomain || item.name}.`;
    if (!nomeContaValido(nome)) return NOME_CONTA_ERRO;
    if (vistos.has(nome)) return `O nome de utilizador "${nome}" está repetido neste pedido.`;
    vistos.add(nome);
    if (await nomeContaOcupado(admin, nome, dono)) return `O nome de utilizador "${nome}" já existe. Escolha outro.`;
  }
  return null;
}
