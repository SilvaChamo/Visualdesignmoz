/**
 * API moderna de bases de dados DirectAdmin (`/api/db-show`, `/api/db-manage`).
 */

import {
  daBinaryGetViaSshAsDaUser,
  daImportSqlViaSshAsDaUser,
  daJsonRequestViaSshAsDaUser,
} from '@/lib/da-api-ssh';
import type { DbPrivs } from '@/lib/da-database-types';
import { emptyDbPrivileges, fullDbPrivileges } from '@/lib/da-database-types';

export type {
  DbListEntry,
  DbMetadata,
  DbPrivs,
  DbUserEntry,
  DbDatabaseUser,
  DbUserDatabase,
} from '@/lib/da-database-types';

export { formatDbSize, fullDbPrivileges, emptyDbPrivileges, hasFullAccess } from '@/lib/da-database-types';

export type DbInfoResponse = {
  version: string;
  address: string;
  maxDatabaseLength: number;
  maxUsernameLength: number;
  maxHostsPerUser: number;
  defaultHostPatterns: string[];
};

function encDb(name: string): string {
  return encodeURIComponent(name);
}

export async function daDbGetInfo(owner: string) {
  return daJsonRequestViaSshAsDaUser(owner, 'GET', 'api/db-show/info');
}

export async function daDbListDatabases(owner: string, noSize = false) {
  return daJsonRequestViaSshAsDaUser(owner, 'GET', 'api/db-show/databases', {
    query: noSize ? { 'no-size': 'yes' } : undefined,
  });
}

export async function daDbGetDatabase(owner: string, database: string) {
  return daJsonRequestViaSshAsDaUser(owner, 'GET', `api/db-show/databases/${encDb(database)}`);
}

export async function daDbListDatabaseUsers(owner: string, database: string) {
  return daJsonRequestViaSshAsDaUser(owner, 'GET', `api/db-show/databases/${encDb(database)}/users`);
}

export async function daDbListUsers(owner: string) {
  return daJsonRequestViaSshAsDaUser(owner, 'GET', 'api/db-show/users');
}

export async function daDbGetUser(owner: string, dbuser: string) {
  return daJsonRequestViaSshAsDaUser(owner, 'GET', `api/db-show/users/${encDb(dbuser)}`);
}

export async function daDbListUserDatabases(owner: string, dbuser: string) {
  return daJsonRequestViaSshAsDaUser(owner, 'GET', `api/db-show/users/${encDb(dbuser)}/databases`);
}

export async function daDbCreateWithUser(
  owner: string,
  body: {
    database: string;
    dbuser?: string;
    password?: string;
    charset?: string;
    collation?: string;
    hostPatterns?: string[];
    privileges?: DbPrivs;
  },
) {
  return daJsonRequestViaSshAsDaUser(owner, 'POST', 'api/db-manage/create-db-with-user', { body });
}

export async function daDbCreateUser(
  owner: string,
  body: { dbuser: string; password: string; hostPatterns?: string[] },
) {
  return daJsonRequestViaSshAsDaUser(owner, 'POST', 'api/db-manage/create-user', { body });
}

export async function daDbDeleteDatabase(owner: string, database: string, dropOrphanUsers = true) {
  return daJsonRequestViaSshAsDaUser(owner, 'DELETE', `api/db-manage/databases/${encDb(database)}`, {
    query: dropOrphanUsers ? { 'drop-orphan-users': 'yes' } : undefined,
  });
}

export async function daDbDeleteUser(owner: string, dbuser: string) {
  return daJsonRequestViaSshAsDaUser(owner, 'DELETE', `api/db-manage/users/${encDb(dbuser)}`);
}

export async function daDbChangePassword(owner: string, dbuser: string, newPassword: string) {
  return daJsonRequestViaSshAsDaUser(owner, 'POST', `api/db-manage/users/${encDb(dbuser)}/change-password`, {
    body: { newPassword },
  });
}

export async function daDbChangeHosts(owner: string, dbuser: string, hostPatterns: string[]) {
  return daJsonRequestViaSshAsDaUser(owner, 'POST', `api/db-manage/users/${encDb(dbuser)}/change-hosts`, {
    body: hostPatterns,
  });
}

export async function daDbChangePrivs(owner: string, dbuser: string, database: string, privileges: DbPrivs) {
  return daJsonRequestViaSshAsDaUser(
    owner,
    'PUT',
    `api/db-manage/users/${encDb(dbuser)}/databases/${encDb(database)}/change-privs`,
    { body: { privileges } },
  );
}

export async function daDbGrantFullAccess(owner: string, dbuser: string, database: string) {
  return daDbChangePrivs(owner, dbuser, database, fullDbPrivileges());
}

export async function daDbRevokeAccess(owner: string, dbuser: string, database: string) {
  return daDbChangePrivs(owner, dbuser, database, emptyDbPrivileges());
}

export async function daDbCheck(owner: string, database: string) {
  return daJsonRequestViaSshAsDaUser(owner, 'POST', `api/db-manage/databases/${encDb(database)}/check`);
}

export async function daDbRepair(owner: string, database: string) {
  return daJsonRequestViaSshAsDaUser(owner, 'POST', `api/db-manage/databases/${encDb(database)}/repair`);
}

export async function daDbOptimize(owner: string, database: string) {
  return daJsonRequestViaSshAsDaUser(owner, 'POST', `api/db-manage/databases/${encDb(database)}/optimize`);
}

export async function daDbFixDefiners(owner: string, database: string) {
  return daJsonRequestViaSshAsDaUser(owner, 'POST', `api/db-manage/databases/${encDb(database)}/fix-definers`);
}

export async function daDbExport(owner: string, database: string, gzip = false) {
  return daBinaryGetViaSshAsDaUser(owner, `api/db-manage/databases/${encDb(database)}/export`, {
    gzip: gzip ? 'yes' : 'no',
  });
}

export async function daDbImport(owner: string, database: string, sqlBase64: string, clean = false) {
  return daImportSqlViaSshAsDaUser(owner, database, sqlBase64, clean);
}

export async function daPhpMyAdminSso(owner: string, database?: string) {
  if (database) {
    return daJsonRequestViaSshAsDaUser(owner, 'POST', `api/phpmyadmin-sso/database-access/${encDb(database)}`);
  }
  return daJsonRequestViaSshAsDaUser(owner, 'POST', 'api/phpmyadmin-sso/account-access');
}
