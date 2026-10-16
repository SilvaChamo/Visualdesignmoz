/**
 * Operações de ciclo de vida de conta no HestiaCP — equivalente ao subconjunto
 * de `directadmin-adapter.ts` realmente usado pelo checkout e pela gestão de
 * clientes (ver plano: criar/suspender/reactivar/apagar/mudar password).
 */

import { hestiaCall, hestiaCallJson } from '@/lib/hestia-client';
import { CONTABO_NS } from '@/lib/visualdesign-dns';

function isAlreadyExistsError(error?: string): boolean {
  return (error || '').toLowerCase().includes('exists');
}

export type HestiaPackage = { packageName: string };

export async function listPackages(): Promise<HestiaPackage[]> {
  const result = await hestiaCallJson<Record<string, unknown>>('v-list-user-packages');
  if (!result.ok) return [];
  return Object.keys(result.data)
    .filter((name) => name !== 'system')
    .map((packageName) => ({ packageName }));
}

export async function createAccount(input: {
  username: string;
  password: string;
  email: string;
  domain: string;
  packageName: string;
}): Promise<{ ok: boolean; error?: string }> {
  const userResult = await hestiaCall('v-add-user', [
    input.username,
    input.password,
    input.email,
    input.packageName,
  ]);
  if (!userResult.ok && !isAlreadyExistsError(userResult.error)) {
    return { ok: false, error: userResult.error };
  }

  const domainResult = await hestiaCall('v-add-web-domain', [input.username, input.domain]);
  if (!domainResult.ok && !isAlreadyExistsError(domainResult.error)) {
    return { ok: false, error: domainResult.error };
  }

  // Zona DNS best-effort — `v-add-web-domain` só cria o site; sem zona, o
  // ns3/ns4 (Contabo) respondem REFUSED e o registador recusa apontar o
  // domínio para eles. Usa o IP com que o Hestia criou o site.
  await addDnsZone(input.username, input.domain).catch(() => {});

  // SSL best-effort — a conta e o domínio já ficam criados mesmo que o
  // Let's Encrypt falhe (ex.: DNS ainda não propagado); não bloqueia o
  // resultado da criação da conta em si.
  await hestiaCall('v-add-letsencrypt-domain', [input.username, input.domain]).catch(() => {});

  return { ok: true };
}

async function addDnsZone(username: string, domain: string): Promise<void> {
  const web = await hestiaCallJson<Record<string, { IP?: string }>>('v-list-web-domain', [username, domain]);
  const ip = web.ok ? web.data[domain]?.IP : undefined;
  if (!ip) return;
  const result = await hestiaCall('v-add-dns-domain', [username, domain, ip, CONTABO_NS.ns1, CONTABO_NS.ns2]);
  if (!result.ok && !isAlreadyExistsError(result.error)) {
    console.error(`[hestia-adapter] zona DNS de ${domain} não criada:`, result.error);
  }
}

/** Remove só este site da conta (`v-delete-web-domain`) — nunca a conta em
 * si, mesmo quando `username` é a conta principal (ex.: "admin"), que fica
 * intacta com os restantes sites que tiver. */
export async function deleteWebDomain(username: string, domain: string): Promise<{ ok: boolean; error?: string }> {
  const result = await hestiaCall('v-delete-web-domain', [username, domain]);
  return { ok: result.ok, error: result.error };
}

/** Suspende só este site (não a conta) — equivalente ao `da suspend-domain`
 * do DirectAdmin. Nunca testado ao vivo neste servidor; confirmar antes de
 * confiar nisto para clientes reais. */
export async function suspendWebDomain(username: string, domain: string): Promise<{ ok: boolean; error?: string }> {
  const result = await hestiaCall('v-suspend-web-domain', [username, domain]);
  return { ok: result.ok, error: result.error };
}

export async function unsuspendWebDomain(username: string, domain: string): Promise<{ ok: boolean; error?: string }> {
  const result = await hestiaCall('v-unsuspend-web-domain', [username, domain]);
  return { ok: result.ok, error: result.error };
}

export async function suspendAccount(username: string): Promise<{ ok: boolean; error?: string }> {
  const result = await hestiaCall('v-suspend-user', [username]);
  return { ok: result.ok, error: result.error };
}

export async function unsuspendAccount(username: string): Promise<{ ok: boolean; error?: string }> {
  const result = await hestiaCall('v-unsuspend-user', [username]);
  return { ok: result.ok, error: result.error };
}

export async function deleteAccount(username: string): Promise<{ ok: boolean; error?: string }> {
  const result = await hestiaCall('v-delete-user', [username]);
  return { ok: result.ok, error: result.error };
}

/** Atribui um pacote JÁ EXISTENTE no Hestia a uma conta. Criar/editar os
 * limites de um pacote (disco, contas de email/BD, etc.) não tem um comando
 * CLI directo no Hestia — exige gerar um ficheiro de definição do pacote
 * (`v-add-user-package TMPFILE PACKAGE`) ou editar `$HESTIA/data/packages/*.pkg`
 * directamente por SSH; não implementado aqui de propósito (ver nota no plano). */
export async function changeUserPackage(username: string, packageName: string): Promise<{ ok: boolean; error?: string }> {
  const result = await hestiaCall('v-change-user-package', [username, packageName]);
  return { ok: result.ok, error: result.error };
}

export async function changePassword(
  username: string,
  password: string,
): Promise<{ ok: boolean; error?: string }> {
  const result = await hestiaCall('v-change-user-password', [username, password]);
  return { ok: result.ok, error: result.error };
}

export type HestiaUser = {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  packageName: string;
  suspended: boolean;
  diskUsedMb: number;
  bandwidthUsedMb: number;
  diskLimitMb: number | null;
  bandwidthLimitMb: number | null;
};

function parseHestiaLimit(value: string | undefined): number | null {
  if (!value || value.toLowerCase() === 'unlimited') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseHestiaUsage(value: string | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Lista todas as contas reais do Hestia (equivalente a `listAllHostingUsersFromDa`
 * do DirectAdmin) — usado pelo hestia-sync para espelhar o estado real do
 * servidor no Supabase. Exclui o próprio utilizador de login da API
 * (HESTIA_USER, ex: 'vdadmin'), que não é uma conta de cliente.
 */
export async function listUsers(): Promise<HestiaUser[]> {
  const result = await hestiaCallJson<Record<string, Record<string, string>>>('v-list-users');
  if (!result.ok) return [];
  const apiUser = (process.env.HESTIA_USER || 'vdadmin').trim();
  return Object.entries(result.data)
    .filter(([username]) => username !== apiUser)
    .map(([username, u]) => ({
      username,
      email: u.EMAIL || '',
      firstName: u.FNAME || '',
      lastName: u.LNAME || '',
      packageName: u.PACKAGE || '',
      suspended: (u.SUSPENDED || 'no').toLowerCase() === 'yes',
      diskUsedMb: parseHestiaUsage(u.U_DISK),
      bandwidthUsedMb: parseHestiaUsage(u.U_BANDWIDTH),
      diskLimitMb: parseHestiaLimit(u.DISK_QUOTA),
      // #campo-real: v-list-users devolve "BANDWIDTH", não "BANDWIDTH_QUOTA"
      // (confirmado directamente na resposta real do servidor) — o nome
      // errado fazia isto ser sempre null, mesmo com quota real definida.
      bandwidthLimitMb: parseHestiaLimit(u.BANDWIDTH),
    }));
}

export type HestiaWebDomain = {
  domain: string;
  ip: string;
  suspended: boolean;
  sslEnabled: boolean;
  diskUsedMb: number;
  bandwidthUsedMb: number;
};

/** Lista os domínios/websites reais de uma conta Hestia (equivalente a `da.listWebsites()` filtrado por dono). */
export async function listWebDomains(username: string): Promise<HestiaWebDomain[]> {
  const result = await hestiaCallJson<Record<string, Record<string, string>>>('v-list-web-domains', [username]);
  if (!result.ok) return [];
  return Object.entries(result.data).map(([domain, d]) => ({
    domain,
    ip: d.IP || '',
    suspended: (d.SUSPENDED || 'no').toLowerCase() === 'yes',
    sslEnabled: (d.SSL || 'no').toLowerCase() !== 'no' && Boolean(d.SSL),
    diskUsedMb: parseHestiaUsage(d.U_DISK),
    bandwidthUsedMb: parseHestiaUsage(d.U_BANDWIDTH),
  }));
}

// ---------------------------------------------------------------------------
// Bases de dados — confirmado directamente no servidor (ssh, bin/v-add-database
// etc, 2026-08-11): v-add-database USER DBNAME DBUSER DBPASS [TYPE] [HOST]
// [CHARSET] cria `${USER}_${DBNAME}`/`${USER}_${DBUSER}` (o Hestia junta o
// prefixo sozinho — nunca enviar o nome já prefixado para "criar"). Delete e
// change-password já exigem o nome completo (tal como devolvido por listDatabases).
// ---------------------------------------------------------------------------

export type HestiaDatabase = {
  database: string;
  dbUser: string;
  host: string;
  type: string;
  charset: string;
  diskUsedMb: number;
  suspended: boolean;
};

export async function listDatabases(username: string): Promise<HestiaDatabase[]> {
  const result = await hestiaCallJson<Record<string, Record<string, string>>>('v-list-databases', [username]);
  if (!result.ok) return [];
  return Object.entries(result.data).map(([database, d]) => ({
    database,
    dbUser: d.DBUSER || '',
    host: d.HOST || '',
    type: d.TYPE || 'mysql',
    charset: d.CHARSET || '',
    diskUsedMb: parseHestiaUsage(d.U_DISK),
    suspended: (d.SUSPENDED || 'no').toLowerCase() === 'yes',
  }));
}

export async function createDatabase(input: {
  username: string;
  dbNameSuffix: string;
  dbUserSuffix: string;
  password: string;
}): Promise<{ ok: boolean; error?: string; database?: string; dbUser?: string }> {
  const result = await hestiaCall('v-add-database', [
    input.username,
    input.dbNameSuffix,
    input.dbUserSuffix,
    input.password,
  ]);
  if (!result.ok) return { ok: false, error: result.error };
  return {
    ok: true,
    database: `${input.username}_${input.dbNameSuffix}`,
    dbUser: `${input.username}_${input.dbUserSuffix}`,
  };
}

/** `database` tem de vir já com o prefixo `${username}_` (como devolvido por listDatabases). */
export async function deleteDatabase(username: string, database: string): Promise<{ ok: boolean; error?: string }> {
  const result = await hestiaCall('v-delete-database', [username, database]);
  return { ok: result.ok, error: result.error };
}

export async function changeDatabasePassword(
  username: string,
  database: string,
  password: string,
): Promise<{ ok: boolean; error?: string }> {
  const result = await hestiaCall('v-change-database-password', [username, database, password]);
  return { ok: result.ok, error: result.error };
}

// ---------------------------------------------------------------------------
// Email — confirmado no servidor: uma conta de email exige primeiro um "mail
// domain" (v-add-mail-domain, idempotente aqui via isAlreadyExistsError) antes
// de v-add-mail-account. Sufixo/quota tal como documentado no CLI oficial.
// ---------------------------------------------------------------------------

export async function addMailDomain(username: string, domain: string): Promise<{ ok: boolean; error?: string }> {
  const result = await hestiaCall('v-add-mail-domain', [username, domain]);
  if (!result.ok && !isAlreadyExistsError(result.error)) return { ok: false, error: result.error };
  return { ok: true };
}

export type HestiaMailAccount = {
  account: string;
  quotaMb: number | null;
  diskUsedMb: number;
};

export async function listMailAccounts(username: string, domain: string): Promise<HestiaMailAccount[]> {
  const result = await hestiaCallJson<Record<string, Record<string, string>>>('v-list-mail-accounts', [username, domain]);
  if (!result.ok) return [];
  return Object.entries(result.data).map(([account, a]) => ({
    account,
    quotaMb: parseHestiaLimit(a.QUOTA),
    diskUsedMb: parseHestiaUsage(a.U_DISK),
  }));
}

export async function addMailAccount(
  username: string,
  domain: string,
  account: string,
  password: string,
  quotaMb?: number,
): Promise<{ ok: boolean; error?: string }> {
  const domainStep = await addMailDomain(username, domain);
  if (!domainStep.ok) return domainStep;
  const args = [username, domain, account, password];
  if (quotaMb) args.push(String(quotaMb));
  const result = await hestiaCall('v-add-mail-account', args);
  return { ok: result.ok, error: result.error };
}

export async function deleteMailAccount(
  username: string,
  domain: string,
  account: string,
): Promise<{ ok: boolean; error?: string }> {
  const result = await hestiaCall('v-delete-mail-account', [username, domain, account]);
  return { ok: result.ok, error: result.error };
}

export async function changeMailAccountPassword(
  username: string,
  domain: string,
  account: string,
  password: string,
): Promise<{ ok: boolean; error?: string }> {
  const result = await hestiaCall('v-change-mail-account-password', [username, domain, account, password]);
  return { ok: result.ok, error: result.error };
}

export async function suspendMailAccount(
  username: string,
  domain: string,
  account: string,
): Promise<{ ok: boolean; error?: string }> {
  const result = await hestiaCall('v-suspend-mail-account', [username, domain, account]);
  return { ok: result.ok, error: result.error };
}

export async function unsuspendMailAccount(
  username: string,
  domain: string,
  account: string,
): Promise<{ ok: boolean; error?: string }> {
  const result = await hestiaCall('v-unsuspend-mail-account', [username, domain, account]);
  return { ok: result.ok, error: result.error };
}

export async function addMailForward(
  username: string,
  domain: string,
  account: string,
  forwardTo: string,
): Promise<{ ok: boolean; error?: string }> {
  const result = await hestiaCall('v-add-mail-account-forward', [username, domain, account, forwardTo]);
  return { ok: result.ok, error: result.error };
}

// ---------------------------------------------------------------------------
// FTP — confirmado no servidor (bin/v-add-web-domain-ftp e afins, 2026-08-11):
// contas FTP são sempre associadas a um domínio (não existe FTP "solto" da
// conta), e não há v-list-web-domain-ftp — a lista vem embutida nos campos
// FTP_USER/FTP_PATH (separados por vírgula) do próprio v-list-web-domain.
// ---------------------------------------------------------------------------

export type HestiaFtpAccount = { ftpUser: string; path: string };

export async function listFtpAccounts(username: string, domain: string): Promise<HestiaFtpAccount[]> {
  const result = await hestiaCallJson<Record<string, Record<string, string>>>('v-list-web-domain', [username, domain]);
  if (!result.ok) return [];
  const fields = result.data[domain];
  if (!fields) return [];
  const users = (fields.FTP_USER || '').split(',').map((s) => s.trim()).filter(Boolean);
  const paths = (fields.FTP_PATH || '').split(',').map((s) => s.trim());
  return users.map((ftpUser, i) => ({ ftpUser, path: paths[i] || '' }));
}

export async function addFtpAccount(
  username: string,
  domain: string,
  ftpUserSuffix: string,
  password: string,
  path?: string,
): Promise<{ ok: boolean; error?: string; ftpUser?: string }> {
  const args = [username, domain, ftpUserSuffix, password];
  if (path) args.push(path);
  const result = await hestiaCall('v-add-web-domain-ftp', args);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, ftpUser: `${username}_${ftpUserSuffix}` };
}

/** `ftpUser` tem de vir já com o prefixo `${username}_` (como devolvido por listFtpAccounts). */
export async function deleteFtpAccount(
  username: string,
  domain: string,
  ftpUser: string,
): Promise<{ ok: boolean; error?: string }> {
  const result = await hestiaCall('v-delete-web-domain-ftp', [username, domain, ftpUser]);
  return { ok: result.ok, error: result.error };
}

export async function changeFtpPassword(
  username: string,
  domain: string,
  ftpUser: string,
  password: string,
): Promise<{ ok: boolean; error?: string }> {
  const result = await hestiaCall('v-change-web-domain-ftp-password', [username, domain, ftpUser, password]);
  return { ok: result.ok, error: result.error };
}
