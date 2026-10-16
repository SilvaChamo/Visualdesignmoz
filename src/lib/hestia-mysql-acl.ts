/**
 * Privilégios MySQL/MariaDB para contas Hestia.
 *
 * O Hestia só conhece o par 1 base ↔ 1 utilizador criado com v-add-database.
 * Utilizadores extra, GRANT/REVOKE e hosts vivem no MariaDB — daí este
 * módulo, com tudo scoped ao prefixo `${owner}_`.
 */

import { executeServerCommand } from '@/lib/server-ssh-exec';
import {
  emptyDbPrivileges,
  fullDbPrivileges,
  hasFullAccess,
  type DbDatabaseUser,
  type DbPrivs,
  type DbUserDatabase,
  type DbUserEntry,
} from '@/lib/da-database-types';
import { changeDatabasePassword, listDatabases } from '@/lib/hestia-adapter';

const SQL_PRIV_BY_KEY: Record<string, string> = {
  alter: 'ALTER',
  alterRoutine: 'ALTER ROUTINE',
  create: 'CREATE',
  createRoutine: 'CREATE ROUTINE',
  createTmpTable: 'CREATE TEMPORARY TABLES',
  createView: 'CREATE VIEW',
  delete: 'DELETE',
  drop: 'DROP',
  event: 'EVENT',
  execute: 'EXECUTE',
  index: 'INDEX',
  insert: 'INSERT',
  lockTables: 'LOCK TABLES',
  references: 'REFERENCES',
  select: 'SELECT',
  showView: 'SHOW VIEW',
  trigger: 'TRIGGER',
  update: 'UPDATE',
};

const KEY_BY_SQL_PRIV: Record<string, string> = Object.fromEntries(
  Object.entries(SQL_PRIV_BY_KEY).map(([key, sql]) => [sql, key]),
);

const SYSTEM_SCHEMAS = [
  'mysql',
  'information_schema',
  'performance_schema',
  'sys',
  'phpmyadmin',
  'roundcube',
] as const;

function assertIdent(name: string, label: string): string {
  if (!name || !/^[A-Za-z0-9_]+$/.test(name)) {
    throw new Error(`${label} inválido.`);
  }
  return name;
}

function isHestiaAdmin(operator: string): boolean {
  return operator.toLowerCase() === (process.env.HESTIA_USER || 'vdadmin').trim().toLowerCase();
}

function assertOwned(owner: string, name: string, label: string): string {
  const id = assertIdent(name, label);
  const prefix = `${assertIdent(owner, 'Conta')}_`;
  if (!id.startsWith(prefix)) {
    throw new Error(`${label} fora desta conta.`);
  }
  return id;
}

function assertManaged(operator: string, name: string, label: string): string {
  if (isHestiaAdmin(operator)) return assertIdent(name, label);
  return assertOwned(operator, name, label);
}

function mysqlQuote(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function assertHost(host: string): string {
  const h = host.trim();
  if (!h || h.length > 60 || !/^[%a-zA-Z0-9._:*-]+$/.test(h)) {
    throw new Error(`Host inválido: ${host}`);
  }
  return h;
}

function userAtHost(dbuser: string, host: string): string {
  return `\`${dbuser}\`@\`${assertHost(host)}\``;
}

async function mysqlExec(sql: string): Promise<string> {
  const b64 = Buffer.from(sql, 'utf8').toString('base64');
  const marker = '__MYSQL_OK__';
  const out = await executeServerCommand(
    `echo '${b64}' | base64 -d | mysql --batch --raw --skip-column-names --default-character-set=utf8mb4 && echo ${marker}`,
  );
  const failed = /ERROR\s+\d+/i.test(out) || !out.includes(marker);
  if (failed) {
    throw new Error(out.replace(marker, '').trim() || 'Comando MySQL falhou.');
  }
  return out.replace(marker, '').trim();
}

async function listUserHosts(owner: string, dbuser: string): Promise<string[]> {
  const user = assertManaged(owner, dbuser, 'Utilizador');
  const raw = await mysqlExec(
    `SELECT Host FROM mysql.user WHERE User=${mysqlQuote(user)} ORDER BY Host`,
  );
  return raw
    .split(/\n/)
    .map((h) => h.trim())
    .filter(Boolean);
}

function privsFromSqlTypes(types: string[]): DbPrivs {
  const privs = emptyDbPrivileges();
  for (const type of types) {
    const key = KEY_BY_SQL_PRIV[type.trim().toUpperCase()];
    if (key) privs[key] = true;
  }
  return privs;
}

function grantListSql(privileges: DbPrivs): string {
  if (hasFullAccess(privileges)) return 'ALL PRIVILEGES';
  const parts = Object.entries(SQL_PRIV_BY_KEY)
    .filter(([key]) => privileges[key])
    .map(([, sql]) => sql);
  if (!parts.length) {
    throw new Error('Seleccione pelo menos um privilégio, ou revogue o acesso.');
  }
  return parts.join(', ');
}

export async function listMysqlUsers(owner: string): Promise<DbUserEntry[]> {
  const skip = new Set(['root', 'mysql', 'mariadb.sys', 'phpmyadmin', 'pma', 'debian-sys-maint']);
  const prefix = `${assertIdent(owner, 'Conta')}_`;
  const raw = await mysqlExec(
    `SELECT User, Host FROM mysql.user WHERE User LIKE ${mysqlQuote(`${prefix}%`)} ORDER BY User, Host`,
  );
  const byUser = new Map<string, string[]>();
  for (const line of raw.split(/\n/)) {
    const [user, host] = line.split('\t');
    if (!user || !host || skip.has(user) || user.startsWith('pma_vd_')) continue;
    if (!user.startsWith(prefix)) continue;
    const hosts = byUser.get(user) || [];
    hosts.push(host);
    byUser.set(user, hosts);
  }
  return [...byUser.entries()].map(([dbuser, hostPatterns]) => ({ dbuser, hostPatterns }));
}

export async function getMysqlUser(owner: string, dbuser: string): Promise<DbUserEntry | null> {
  const user = assertOwned(owner, dbuser, 'Utilizador');
  const hosts = await listUserHosts(owner, user);
  if (!hosts.length) return null;
  return { dbuser: user, hostPatterns: hosts };
}

export async function listDatabaseUsersFromMysql(
  owner: string,
  database: string,
): Promise<DbDatabaseUser[]> {
  const db = assertManaged(owner, database, 'Base de dados');
  const prefix = `${db.split('_')[0] || assertIdent(owner, 'Conta')}_`;
  const raw = await mysqlExec(
    `SELECT GRANTEE, PRIVILEGE_TYPE FROM information_schema.SCHEMA_PRIVILEGES WHERE TABLE_SCHEMA=${mysqlQuote(db)}`,
  );
  const grouped = new Map<string, { hosts: Set<string>; types: Set<string> }>();
  for (const line of raw.split(/\n/)) {
    if (!line.trim()) continue;
    const tab = line.indexOf('\t');
    const grantee = tab === -1 ? line : line.slice(0, tab);
    const privType = tab === -1 ? '' : line.slice(tab + 1);
    const match = grantee.match(/^'([^']+)'@'([^']*)'$/);
    if (!match) continue;
    const [, user, host] = match;
    if (!user.startsWith(prefix)) continue;
    const entry = grouped.get(user) || { hosts: new Set<string>(), types: new Set<string>() };
    entry.hosts.add(host);
    if (privType) entry.types.add(privType);
    grouped.set(user, entry);
  }
  return [...grouped.entries()].map(([dbuser, entry]) => ({
    dbuser,
    hostPatterns: [...entry.hosts],
    privileges: privsFromSqlTypes([...entry.types]),
  }));
}

export async function listUserDatabasesFromMysql(
  owner: string,
  dbuser: string,
): Promise<DbUserDatabase[]> {
  const user = assertOwned(owner, dbuser, 'Utilizador');
  const prefix = `${assertIdent(owner, 'Conta')}_`;
  const raw = await mysqlExec(
    `SELECT TABLE_SCHEMA, PRIVILEGE_TYPE FROM information_schema.SCHEMA_PRIVILEGES WHERE REPLACE(SUBSTRING_INDEX(GRANTEE,'@',1),'''','')=${mysqlQuote(user)}`,
  );
  const grouped = new Map<string, Set<string>>();
  for (const line of raw.split(/\n/)) {
    if (!line.trim()) continue;
    const tab = line.indexOf('\t');
    const schema = tab === -1 ? line : line.slice(0, tab);
    const privType = tab === -1 ? '' : line.slice(tab + 1);
    if (!schema.startsWith(prefix)) continue;
    const types = grouped.get(schema) || new Set<string>();
    if (privType) types.add(privType);
    grouped.set(schema, types);
  }
  return [...grouped.entries()].map(([database, types]) => ({
    database,
    privileges: privsFromSqlTypes([...types]),
  }));
}

export async function countUsersPerDatabase(
  owner: string,
  databases: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  await Promise.all(
    databases.map(async (database) => {
      try {
        const users = await listDatabaseUsersFromMysql(owner, database);
        counts.set(database, users.length);
      } catch {
        counts.set(database, 1);
      }
    }),
  );
  return counts;
}

export async function createMysqlUser(
  owner: string,
  suffix: string,
  password: string,
): Promise<{ dbuser: string }> {
  const ownerId = assertIdent(owner, 'Conta');
  const cleanSuffix = suffix.startsWith(`${ownerId}_`) ? suffix.slice(ownerId.length + 1) : suffix;
  const dbuser = assertOwned(ownerId, `${ownerId}_${assertIdent(cleanSuffix, 'Utilizador')}`, 'Utilizador');
  if (!password || password.length < 8) {
    throw new Error('A senha tem de ter pelo menos 8 caracteres.');
  }
  const existing = await listUserHosts(ownerId, dbuser).catch(() => []);
  if (existing.length) {
    throw new Error(`O utilizador ${dbuser} já existe.`);
  }
  const pass = mysqlQuote(password);
  await mysqlExec(
    [
      `CREATE USER ${userAtHost(dbuser, 'localhost')} IDENTIFIED BY ${pass}`,
      `CREATE USER ${userAtHost(dbuser, '%')} IDENTIFIED BY ${pass}`,
      'FLUSH PRIVILEGES',
    ].join('; '),
  );
  return { dbuser };
}

export async function dropMysqlUser(owner: string, dbuser: string): Promise<void> {
  const user = assertOwned(owner, dbuser, 'Utilizador');
  const hestiaRows = await listDatabases(owner);
  const bound = hestiaRows.find((r) => r.dbUser === user);
  if (bound) {
    throw new Error(
      `«${user}» nasceu ligado à base «${bound.database}». Elimine a base de dados para remover este par, ou revogue só o acesso extra.`,
    );
  }
  const hosts = await listUserHosts(owner, user);
  if (!hosts.length) throw new Error('Utilizador não encontrado.');
  const drops = hosts.map((host) => `DROP USER IF EXISTS ${userAtHost(user, host)}`);
  await mysqlExec([...drops, 'FLUSH PRIVILEGES'].join('; '));
}

export async function changeMysqlUserPassword(
  owner: string,
  dbuser: string,
  password: string,
): Promise<{ hestiaDatabase?: string }> {
  const user = assertManaged(owner, dbuser, 'Utilizador');
  if (!password || password.length < 8) {
    throw new Error('A senha tem de ter pelo menos 8 caracteres.');
  }
  const hestiaRows = await listDatabases(owner);
  const bound = hestiaRows.find((r) => r.dbUser === user);
  const hosts = await listUserHosts(owner, user);
  if (!hosts.length) throw new Error('Utilizador não encontrado.');
  const pass = mysqlQuote(password);
  const alters = hosts.map((host) => `ALTER USER ${userAtHost(user, host)} IDENTIFIED BY ${pass}`);
  await mysqlExec([...alters, 'FLUSH PRIVILEGES'].join('; '));
  return { hestiaDatabase: bound?.database };
}

export async function grantDatabaseAccess(
  owner: string,
  dbuser: string,
  database: string,
  privileges?: DbPrivs,
): Promise<void> {
  const user = assertManaged(owner, dbuser, 'Utilizador');
  const db = assertManaged(owner, database, 'Base de dados');
  const hosts = await listUserHosts(owner, user);
  if (!hosts.length) throw new Error('Utilizador não encontrado.');
  const grant = grantListSql(privileges || fullDbPrivileges());
  const stmts = hosts.map(
    (host) => `GRANT ${grant} ON \`${db}\`.* TO ${userAtHost(user, host)}`,
  );
  await mysqlExec([...stmts, 'FLUSH PRIVILEGES'].join('; '));
}

export async function revokeDatabaseAccess(
  owner: string,
  dbuser: string,
  database: string,
): Promise<void> {
  const user = assertManaged(owner, dbuser, 'Utilizador');
  const db = assertManaged(owner, database, 'Base de dados');
  const hosts = await listUserHosts(owner, user);
  if (!hosts.length) throw new Error('Utilizador não encontrado.');
  const stmts = hosts.map(
    (host) => `REVOKE ALL PRIVILEGES ON \`${db}\`.* FROM ${userAtHost(user, host)}`,
  );
  await mysqlExec([...stmts, 'FLUSH PRIVILEGES'].join('; '));
}

export async function changeDatabasePrivileges(
  owner: string,
  dbuser: string,
  database: string,
  privileges: DbPrivs,
): Promise<void> {
  const anyOn = Object.values(privileges).some(Boolean);
  if (!anyOn) {
    await revokeDatabaseAccess(owner, dbuser, database);
    return;
  }
  const user = assertManaged(owner, dbuser, 'Utilizador');
  const db = assertManaged(owner, database, 'Base de dados');
  const hosts = await listUserHosts(owner, user);
  if (!hosts.length) throw new Error('Utilizador não encontrado.');
  const grant = grantListSql(privileges);
  const stmts = hosts.flatMap((host) => [
    `REVOKE ALL PRIVILEGES ON \`${db}\`.* FROM ${userAtHost(user, host)}`,
    `GRANT ${grant} ON \`${db}\`.* TO ${userAtHost(user, host)}`,
  ]);
  await mysqlExec([...stmts, 'FLUSH PRIVILEGES'].join('; '));
}

export async function changeMysqlUserHosts(
  owner: string,
  dbuser: string,
  hostPatterns: string[],
): Promise<void> {
  const user = assertManaged(owner, dbuser, 'Utilizador');
  const wanted = [...new Set(hostPatterns.map(assertHost))];
  if (!wanted.length) throw new Error('Indique pelo menos um host.');
  const current = await listUserHosts(owner, user);
  if (!current.length) throw new Error('Utilizador não encontrado.');

  const keepHost = current.includes('localhost') ? 'localhost' : current[0];
  const createOut = await mysqlExec(`SHOW CREATE USER ${userAtHost(user, keepHost)}`);
  const hashMatch = createOut.match(/IDENTIFIED BY PASSWORD '(\*[0-9A-F]+)'/i);
  if (!hashMatch) throw new Error('Não foi possível copiar a senha do utilizador para o novo host.');
  const hash = hashMatch[1];

  const grantsRaw = await mysqlExec(`SHOW GRANTS FOR ${userAtHost(user, keepHost)}`);
  const grantLines = grantsRaw
    .split(/\n/)
    .map((line) => line.trim())
    .filter((line) => /^GRANT\s+/i.test(line) && !/ON \*\.\*/i.test(line));

  const toAdd = wanted.filter((h) => !current.includes(h));
  const toDrop = current.filter((h) => !wanted.includes(h));

  const stmts: string[] = [];
  for (const host of toAdd) {
    stmts.push(
      `CREATE USER ${userAtHost(user, host)} IDENTIFIED BY PASSWORD ${mysqlQuote(hash)}`,
    );
    for (const grant of grantLines) {
      const rewritten = grant
        .replace(/TO\s+`[^`]+`@`[^`]+`/i, `TO ${userAtHost(user, host)}`)
        .replace(/\s+IDENTIFIED BY PASSWORD\s+'[^']+'/i, '');
      stmts.push(rewritten);
    }
  }
  for (const host of toDrop) {
    stmts.push(`DROP USER IF EXISTS ${userAtHost(user, host)}`);
  }
  if (!stmts.length) return;
  stmts.push('FLUSH PRIVILEGES');
  await mysqlExec(stmts.join('; '));
}

export async function listMysqlSchemas(owner: string): Promise<string[]> {
  const prefix = `${assertIdent(owner, 'Conta')}_`;
  const raw = await mysqlExec(`SHOW DATABASES LIKE ${mysqlQuote(`${prefix}%`)}`);
  return raw
    .split(/\n/)
    .map((name) => name.trim())
    .filter((name) => name.startsWith(prefix));
}

/** Bases dos sites (não as do sistema). Usado no SSO do phpMyAdmin. */
export async function listSiteMysqlSchemas(): Promise<string[]> {
  const skip = new Set<string>(SYSTEM_SCHEMAS);
  const raw = await mysqlExec('SHOW DATABASES');
  return raw
    .split(/\n/)
    .map((name) => name.trim())
    .filter((name) => name && !skip.has(name.toLowerCase()));
}

export async function listMysqlSchemaStats(
  names: string[],
): Promise<Map<string, { sizeBytes: number; tableCount: number }>> {
  const stats = new Map<string, { sizeBytes: number; tableCount: number }>();
  const ids = names.filter((name) => /^[A-Za-z0-9_]+$/.test(name));
  if (!ids.length) return stats;
  const inList = ids.map(mysqlQuote).join(',');
  const raw = await mysqlExec(
    `SELECT TABLE_SCHEMA, IFNULL(SUM(CASE WHEN TABLE_TYPE='BASE TABLE' THEN DATA_LENGTH+INDEX_LENGTH ELSE 0 END),0), IFNULL(SUM(CASE WHEN TABLE_TYPE='BASE TABLE' THEN 1 ELSE 0 END),0) FROM information_schema.TABLES WHERE TABLE_SCHEMA IN (${inList}) GROUP BY TABLE_SCHEMA`,
  );
  for (const line of raw.split(/\n/)) {
    const [schema, size, tables] = line.split('\t');
    if (!schema) continue;
    stats.set(schema, {
      sizeBytes: Number(size || 0) || 0,
      tableCount: Number(tables || 0) || 0,
    });
  }
  return stats;
}

export async function createMysqlDatabase(
  owner: string,
  suffix: string,
  charset = 'utf8mb4',
): Promise<{ database: string }> {
  const ownerId = assertIdent(owner, 'Conta');
  const clean = suffix.startsWith(`${ownerId}_`) ? suffix.slice(ownerId.length + 1) : suffix;
  const database = assertOwned(ownerId, `${ownerId}_${assertIdent(clean, 'Base de dados')}`, 'Base de dados');
  const cs = (charset || 'utf8mb4').replace(/[^A-Za-z0-9_]/g, '') || 'utf8mb4';
  const collation = cs === 'utf8mb4' ? 'utf8mb4_unicode_ci' : `${cs}_general_ci`;
  await mysqlExec(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET ${cs} COLLATE ${collation}`);
  return { database };
}

export async function dropMysqlDatabase(owner: string, database: string): Promise<void> {
  const db = assertOwned(owner, database, 'Base de dados');
  await mysqlExec(`DROP DATABASE IF EXISTS \`${db}\``);
}

function secretsFile(owner: string): string {
  return `/usr/local/hestia/data/users/${assertIdent(owner, 'Conta')}/vd-db-secrets.json`;
}

type DbSecretFile = { byUser?: Record<string, string>; byDatabase?: Record<string, string> };

async function readSecretFile(owner: string): Promise<DbSecretFile> {
  const path = secretsFile(owner);
  const raw = await executeServerCommand(`test -s ${path} && cat ${path} || true`).catch(() => '');
  try {
    const parsed = JSON.parse(raw) as DbSecretFile;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export async function rememberDatabaseSecret(
  owner: string,
  password: string,
  keys: { database?: string; dbuser?: string },
): Promise<void> {
  if (!password || password.length < 8) return;
  const ownerId = assertIdent(owner, 'Conta');
  const path = secretsFile(ownerId);
  const current = await readSecretFile(ownerId);
  const byUser = { ...(current.byUser || {}) };
  const byDatabase = { ...(current.byDatabase || {}) };
  if (keys.dbuser) byUser[assertManaged(ownerId, keys.dbuser, 'Utilizador')] = password;
  if (keys.database) byDatabase[assertManaged(ownerId, keys.database, 'Base de dados')] = password;
  const json = JSON.stringify({ byUser, byDatabase });
  const b64 = Buffer.from(json, 'utf8').toString('base64');
  await executeServerCommand(
    `echo '${b64}' | base64 -d > ${path} && chmod 600 ${path}`,
  );
}

function usableSecret(value: string | undefined): string | null {
  const password = (value || '').trim();
  if (!password || /permanently added|known hosts/i.test(password)) return null;
  return password;
}

async function mysqlPasswordMatches(dbuser: string, password: string): Promise<boolean> {
  const user = assertIdent(dbuser, 'Utilizador');
  const raw = await mysqlExec(
    `SELECT COUNT(*) FROM mysql.user WHERE User=${mysqlQuote(user)} AND authentication_string=CONCAT('*',UPPER(SHA1(UNHEX(SHA1(${mysqlQuote(password)})))))`,
  ).catch(() => '0');
  return Number(raw.trim().split(/\n/).pop() || 0) > 0;
}

type WpConfigRow = { path: string; name: string; user: string; password: string };

async function listWpConfigSecrets(): Promise<WpConfigRow[]> {
  const py = `
import glob, json, re
found_re = re.compile(r"['\\"]DB_(NAME|USER|PASSWORD)['\\"]\\s*,\\s*['\\"]([^'\\"]*)['\\"]", re.I)
rows = []
paths = set(glob.glob("/home/*/web/*/public_html/wp-config.php"))
paths.update(glob.glob("/home/*/web/*/public_html/*/wp-config.php"))
for path in paths:
    try:
        text = open(path, encoding="utf-8", errors="ignore").read()
    except OSError:
        continue
    found = {k.upper(): v for k, v in found_re.findall(text)}
    password = found.get("PASSWORD") or ""
    if not password:
        continue
    rows.append({"path": path, "name": found.get("NAME") or "", "user": found.get("USER") or "", "password": password})
print(json.dumps(rows))
`.trim();
  const b64 = Buffer.from(py, 'utf8').toString('base64');
  const out = await executeServerCommand(`echo '${b64}' | base64 -d | python3 -`).catch(() => '');
  const json = out.trim().split(/\n/).filter((line) => line.startsWith('[') || line.startsWith('{')).pop() || '';
  try {
    const parsed = JSON.parse(json) as WpConfigRow[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Lê a senha em texto: ficheiro do painel, wp-config, ou hash MySQL conhecido. */
export async function revealPasswordFromWpConfig(
  owner: string,
  dbuser: string,
  database?: string,
  domain?: string,
): Promise<string | null> {
  const user = assertManaged(owner, dbuser, 'Utilizador');
  const db = database ? assertManaged(owner, database, 'Base de dados') : '';
  const secrets = await readSecretFile(owner);
  const stored = usableSecret(secrets.byUser?.[user]) || (db ? usableSecret(secrets.byDatabase?.[db]) : null);
  if (stored && (await mysqlPasswordMatches(user, stored))) return stored;

  const wpRows = await listWpConfigSecrets();
  const domainNeedle = (domain || '').replace(/^www\./i, '').toLowerCase();
  const ranked: string[] = [];
  const push = (password: string) => {
    const value = usableSecret(password);
    if (value && !ranked.includes(value)) ranked.push(value);
  };
  if (stored) push(stored);
  for (const row of wpRows) {
    if ((row.user && row.user === user) || (db && row.name === db)) push(row.password);
  }
  if (domainNeedle) {
    for (const row of wpRows) {
      if (row.path.toLowerCase().includes(`/${domainNeedle}/`)) push(row.password);
    }
  }
  if (db) {
    const suffix = db.split('_').slice(1).join('_').toLowerCase();
    if (suffix.length >= 4) {
      for (const row of wpRows) {
        if (row.name.toLowerCase().includes(suffix) || row.path.toLowerCase().includes(suffix)) {
          push(row.password);
        }
      }
    }
  }
  for (const candidate of ranked) {
    if (await mysqlPasswordMatches(user, candidate)) {
      await rememberDatabaseSecret(owner, candidate, { dbuser: user, database: db || undefined });
      return candidate;
    }
  }
  const first = ranked[0] || null;
  if (first) {
    await rememberDatabaseSecret(owner, first, { dbuser: user, database: db || undefined });
    const bound = (await listDatabases(owner)).find((row) => row.dbUser === user);
    if (bound) {
      await changeDatabasePassword(owner, bound.database, first).catch(() => undefined);
    } else {
      await changeMysqlUserPassword(owner, user, first).catch(() => undefined);
    }
    return first;
  }
  return stored;
}
