export type DbListEntry = {
  database: string;
  sizeBytes: number;
  userCount: number;
  tableCount: number;
  definerIssues?: number;
};

export type DbMetadata = {
  database: string;
  defaultCharset: string;
  defaultCollation: string;
  sizeBytes: number;
  userCount: number;
  tableCount: number;
  viewCount: number;
  eventCount: number;
  triggerCount: number;
  routineCount: number;
  definerIssues?: number;
};

export type DbPrivs = Record<string, boolean>;

export type DbUserEntry = {
  dbuser: string;
  hostPatterns: string[];
};

export type DbDatabaseUser = {
  dbuser: string;
  hostPatterns: string[];
  privileges: DbPrivs;
  conflictingHosts?: boolean;
};

export type DbUserDatabase = {
  database: string;
  privileges: DbPrivs;
  conflictingHosts?: boolean;
};

export function fullDbPrivileges(): DbPrivs {
  return {
    alter: true,
    alterRoutine: true,
    create: true,
    createRoutine: true,
    createTmpTable: true,
    createView: true,
    delete: true,
    drop: true,
    event: true,
    execute: true,
    index: true,
    insert: true,
    lockTables: true,
    references: true,
    select: true,
    showView: true,
    trigger: true,
    update: true,
  };
}

export function emptyDbPrivileges(): DbPrivs {
  return Object.fromEntries(Object.keys(fullDbPrivileges()).map((k) => [k, false])) as DbPrivs;
}

export function formatDbSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v < 10 && i > 0 ? v.toFixed(2) : Math.round(v * 100) / 100} ${units[i]}`;
}

export function hasFullAccess(privileges: DbPrivs | undefined): boolean {
  if (!privileges) return false;
  const full = fullDbPrivileges();
  return Object.keys(full).every((k) => privileges[k] === true);
}
