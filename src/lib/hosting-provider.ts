/**
 * Despachante DirectAdmin ↔ HestiaCP para as operações de gestão de contas
 * usadas pelo admin (`/api/admin/clientes`): suspender, reactivar, apagar,
 * mudar password. A criação de conta despacha directamente dentro de
 * `panel-server-provision.ts` (já tem a linha carregada com os dados
 * necessários); aqui só cobre as operações que actuam sobre uma conta já
 * identificada apenas pelo username.
 */

import { daPostViaSsh } from '@/lib/da-api-ssh';
import * as hestiaAdapter from '@/lib/hestia-adapter';
import { getDaSyncAdmin } from '@/lib/da-sync-schema';
import { PANEL_SLUG } from '@/lib/panel-tenant';

export type HostingProvider = 'directadmin' | 'hestia';

/** Este deploy (Contabo) só fala com o Hestia. O código DirectAdmin fica no
 * repo para o Hetzner; aqui não pode ser chamado. */
export function isHestiaOnlyDeploy(): boolean {
  return (process.env.DEFAULT_HOSTING_PROVIDER || '').trim().toLowerCase() === 'hestia';
}

/** Servidor onde a conta com este username vive de facto. 'directadmin' por
 * omissão — mesmo default da coluna, e comportamento seguro se a conta não
 * for encontrada (nunca aponta silenciosamente para o servidor errado).
 *
 * panel_auth_accounts.provider sozinho não é fiável: várias chamadas que
 * criam/actualizam essa linha (ex.: markAccountServerLinked, o "editAccount"
 * do admin/clientes) nunca passam `provider`, e a coluna cai para o default
 * 'directadmin' mesmo em contas reais do Hestia — foi isto que fez a mudança
 * de password da aamihe (conta real, confirmada no servidor) apontar para o
 * DirectAdmin de produção por engano. panel_users.hosting_provider é gravado
 * de forma mais consistente (upsertMirrorUser só o define explicitamente),
 * por isso serve de segunda fonte: qualquer um dos dois a dizer 'hestia' já
 * chega, porque um falso positivo para 'hestia' é inofensivo (Hestia diz
 * "utilizador não existe" e pára) enquanto um falso positivo para
 * 'directadmin' manda o comando para um servidor de produção partilhado. */
export async function getProviderByUsername(username: string): Promise<HostingProvider> {
  const defaultProvider = (process.env.DEFAULT_HOSTING_PROVIDER || '').trim().toLowerCase();

  // Esta instalação usa um único servidor Hestia na Contabo. O espelho pode
  // ainda conter owners/provider antigos do período em que existia DA; não
  // deixar esses dados redireccionarem operações actuais para outro servidor.
  if (defaultProvider === 'hestia') return 'hestia';

  // A própria conta principal do Hestia (HESTIA_USER, normalmente 'vdadmin')
  // nunca aparece em panel_users nem panel_auth_accounts — de propósito,
  // não é uma conta de cliente (ver hestia-sync-engine.ts) — por isso caía
  // sempre no 'directadmin' por omissão abaixo, mesmo sendo Hestia a sério.
  // Confirmado ao vivo 1 set: por causa disto, instalar WordPress num
  // domínio criado directamente nesta conta (ex.: entrecamposblog.com)
  // criava a base de dados no DirectAdmin/Hetzner errado, e o wp-cli falhava
  // silenciosamente a instalar no Hestia/Contabo certo — o domínio ficava só
  // com a página "Coming Soon" por omissão do Hestia.
  if (
    username &&
    defaultProvider === 'hestia' &&
    username === (process.env.HESTIA_USER || 'vdadmin').trim()
  ) {
    return 'hestia';
  }

  const sb = getDaSyncAdmin();
  if (!sb || !username) return 'directadmin';
  const [authAccount, mirrorUser] = await Promise.all([
    sb
      .from('panel_auth_accounts')
      .select('provider')
      .eq('da_username', username)
      .eq('panel_slug', PANEL_SLUG.toLowerCase())
      .maybeSingle(),
    sb.from('panel_users').select('hosting_provider').eq('username', username).maybeSingle(),
  ]);
  if (authAccount.data?.provider === 'hestia' || mirrorUser.data?.hosting_provider === 'hestia') {
    return 'hestia';
  }
  return 'directadmin';
}

export async function suspendHostingAccount(
  provider: HostingProvider,
  username: string,
): Promise<{ ok: boolean; error?: string }> {
  if (provider === 'hestia') return hestiaAdapter.suspendAccount(username);
  const r = await daPostViaSsh('CMD_API_SELECT_USERS', { suspend: 'yes', select0: username });
  return { ok: r.ok, error: r.error };
}

export async function unsuspendHostingAccount(
  provider: HostingProvider,
  username: string,
): Promise<{ ok: boolean; error?: string }> {
  if (provider === 'hestia') return hestiaAdapter.unsuspendAccount(username);
  const r = await daPostViaSsh('CMD_API_SELECT_USERS', { suspend: 'no', select0: username });
  return { ok: r.ok, error: r.error };
}

export async function deleteHostingAccount(
  provider: HostingProvider,
  username: string,
): Promise<{ ok: boolean; error?: string }> {
  if (provider === 'hestia') return hestiaAdapter.deleteAccount(username);
  const r = await daPostViaSsh('CMD_API_SELECT_USERS', { delete: 'yes', select0: username });
  return { ok: r.ok, error: r.error };
}

/** Remove só um site (não a conta inteira) — usado para limpar encomendas de
 * teste sem arriscar apagar a conta principal do servidor. Ainda não
 * implementado para DirectAdmin de propósito (não confirmado no servidor). */
export async function deleteHostingWebDomain(
  provider: HostingProvider,
  username: string,
  domain: string,
): Promise<{ ok: boolean; error?: string }> {
  if (provider === 'hestia') return hestiaAdapter.deleteWebDomain(username, domain);
  return { ok: false, error: 'Eliminação de site individual ainda não implementada para DirectAdmin.' };
}

export async function changeHostingAccountPassword(
  provider: HostingProvider,
  username: string,
  password: string,
): Promise<{ ok: boolean; error?: string }> {
  if (provider === 'hestia') return hestiaAdapter.changePassword(username, password);
  const r = await daPostViaSsh('CMD_API_MODIFY_USER', {
    action: 'single',
    user: username,
    passwd: password,
    passwd2: password,
  });
  return { ok: r.ok, error: r.error };
}
