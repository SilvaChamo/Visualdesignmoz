import type { SupabaseClient } from '@supabase/supabase-js';
import { nomeContaValido, NOME_CONTA_ERRO } from '@/lib/conta-hospedagem';
import type { CatalogCartItem } from '@/lib/package-catalog';

/** O nome já existe no registo do painel ou no servidor? (comparação sem maiúsculas) */
export async function nomeContaOcupado(admin: SupabaseClient, nome: string): Promise<boolean> {
  const { data } = await admin.from('panel_users').select('username').ilike('username', nome).limit(1);
  if (data && data.length) return true;
  const { data: perfil } = await admin.from('profiles').select('da_username').ilike('da_username', nome).limit(1);
  if (perfil && perfil.length) return true;
  try {
    const { listUsers } = await import('@/lib/hestia-adapter');
    const contas = await listUsers();
    if (contas.some((c) => c.username.toLowerCase() === nome)) return true;
  } catch {
    /* sem resposta do servidor: vale o registo do painel; a activação escolhe outro nome se este já existir lá */
  }
  return false;
}

/** Valida o nome de utilizador de cada hospedagem do pedido: obrigatório, bem escrito, livre e sem repetições. */
export async function validarContasDeHospedagem(admin: SupabaseClient, itens: CatalogCartItem[]): Promise<string | null> {
  const vistos = new Set<string>();
  for (const item of itens) {
    if (item.type !== 'hosting') continue;
    const nome = String(item.contaUtilizador || '').trim().toLowerCase();
    if (!nome) return `Indique o nome de utilizador da conta de hospedagem de ${item.hostingDomain || item.name}.`;
    if (!nomeContaValido(nome)) return NOME_CONTA_ERRO;
    if (vistos.has(nome)) return `O nome de utilizador "${nome}" está repetido neste pedido.`;
    vistos.add(nome);
    if (await nomeContaOcupado(admin, nome)) return `O nome de utilizador "${nome}" já existe. Escolha outro.`;
  }
  return null;
}
