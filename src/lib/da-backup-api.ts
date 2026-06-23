import { daLegacyRequestViaSshAsDaUser, daPostViaSshAsDaUser } from '@/lib/da-api-ssh';
import { executeServerCommand } from '@/lib/server-ssh-exec';
import type { BackupFileRow, BackupItemId, BackupTab } from '@/lib/da-backup-types';

function selectFields(items: BackupItemId[]): Record<string, string> {
  const fields: Record<string, string> = {};
  items.forEach((item, i) => {
    fields[`select${i}`] = item;
  });
  return fields;
}

function extractList(data: Record<string, unknown> | unknown[]): string[] {
  const isTar = (f: string) => /\.tar(\.gz)?$/i.test(f) && !/\s/.test(f);
  if (Array.isArray(data)) {
    return data.map(String).filter(isTar);
  }
  const out: string[] = [];
  if (Array.isArray(data.list)) {
    return data.list.map(String).filter(isTar);
  }
  if (Array.isArray(data.backup)) {
    return data.backup.map(String).filter(isTar);
  }
  for (const [k, v] of Object.entries(data)) {
    if (/^list\d*$/i.test(k) || /^backup\d*$/i.test(k)) {
      const s = String(v);
      if (isTar(s)) out.push(s);
    }
  }
  if (typeof data.file === 'string' && isTar(data.file)) out.push(data.file);
  return [...new Set(out)];
}

function backupServerPath(owner: string, filename: string): string {
  if (filename.includes('/')) return filename;
  if (/\.sql$/i.test(filename)) return `/home/${owner}/backups/backup/${filename}`;
  return `/home/${owner}/backups/${filename}`;
}

function parseFindOutput(raw: string, scope: BackupTab): BackupFileRow[] {
  return raw.split('\n').filter((l) => /^\d+\s+\d{4}-\d{2}-\d{2}/.test(l.trim())).map((line) => {
    const parts = line.trim().split(/\s+/);
    const sizeBytes = Number(parts[0]) || 0;
    const date = `${parts[1] || ''} ${parts[2] || ''}`.trim();
    const fullPath = parts.slice(3).join(' ');
    const filename = fullPath.split('/').pop() || '';
    return {
      filename,
      size: formatBytes(sizeBytes),
      sizeBytes,
      date,
      path: fullPath,
      scope,
      source: 'server' as const,
    };
  }).filter((r) => r.filename && !r.filename.startsWith('.'));
}

function extractViewItems(data: Record<string, unknown>): BackupItemId[] {
  const allowed = new Set([
    'domain', 'subdomain', 'email', 'forwarder', 'autoresponder', 'vacation',
    'list', 'emailsettings', 'ftp', 'ftpsettings', 'database',
  ]);
  const out: BackupItemId[] = [];
  for (const [k, v] of Object.entries(data)) {
    if (/^select\d+$/i.test(k)) {
      const item = String(v) as BackupItemId;
      if (allowed.has(item)) out.push(item);
    }
  }
  return out;
}

export async function daBackupListFiles(owner: string, domain: string): Promise<BackupFileRow[]> {
  const dir = `/home/${owner}/backups`;
  const tarCmd = `find ${dir} -maxdepth 4 -type f \\( -name '*.tar.gz' -o -name '*.tar' \\) -printf '%s %TY-%Tm-%Td %TH:%TM %p\\n' 2>/dev/null`;
  const sqlCmd = `find ${dir}/backup -maxdepth 1 -type f \\( -name '*_bd.sql' -o -name 'admin_*.sql' \\) -printf '%s %TY-%Tm-%Td %TH:%TM %p\\n' 2>/dev/null`;
  const found = [await executeServerCommand(tarCmd), await executeServerCommand(sqlCmd)]
    .map((s) => s.trim())
    .filter(Boolean)
    .join('\n');
  if (found) {
    const rows = found.split('\n').filter(Boolean).map((line) => {
      const parts = line.trim().split(/\s+/);
      const fullPath = parts.slice(3).join(' ');
      const filename = fullPath.split('/').pop() || '';
      const scope: BackupTab = /\.sql$/i.test(filename) ? 'databases' : 'full';
      const parsed = parseFindOutput(line, scope)[0];
      return parsed;
    }).filter((r) => r?.filename);
    const byName = new Map<string, BackupFileRow>();
    for (const row of rows) byName.set(row.filename, row);
    return [...byName.values()].sort((a, b) => b.filename.localeCompare(a.filename));
  }

  const api = await daLegacyRequestViaSshAsDaUser(owner, 'GET', 'CMD_API_SITE_BACKUP', { domain });
  if (!api.ok || !api.data) return [];
  const list = Array.isArray(api.data) ? api.data : extractList(api.data);
  return list.map((filename) => ({
    filename,
    size: '—',
    sizeBytes: 0,
    date: '—',
    path: backupServerPath(owner, filename),
    scope: 'full' as const,
    source: 'server' as const,
  }));
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i += 1; }
  return `${v < 10 && i > 0 ? v.toFixed(1) : Math.round(v)} ${units[i]}`;
}

export async function daBackupCreate(
  owner: string,
  domain: string,
  items: BackupItemId[],
): Promise<{ ok: boolean; filename?: string; error?: string }> {
  const result = await daLegacyRequestViaSshAsDaUser(owner, 'POST', 'CMD_API_SITE_BACKUP', {
    action: 'backup',
    domain,
    ...selectFields(items),
  });
  if (!result.ok) return { ok: false, error: result.error };
  const data = result.data || {};
  const filename = typeof data.file === 'string' ? data.file : undefined;
  return { ok: true, filename };
}

export async function daBackupViewItems(
  owner: string,
  domain: string,
  file: string,
): Promise<{ ok: boolean; items?: BackupItemId[]; error?: string }> {
  if (/\.sql$/i.test(file)) {
    return { ok: true, items: ['database'] };
  }
  const result = await daLegacyRequestViaSshAsDaUser(owner, 'POST', 'CMD_API_SITE_BACKUP', {
    action: 'view',
    domain,
    file,
  });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, items: extractViewItems(result.data || {}) };
}

export async function daBackupRestore(
  owner: string,
  domain: string,
  file: string,
  items: BackupItemId[],
): Promise<{ ok: boolean; error?: string }> {
  const result = await daLegacyRequestViaSshAsDaUser(owner, 'POST', 'CMD_API_SITE_BACKUP', {
    action: 'restore',
    domain,
    file,
    ...selectFields(items),
  });
  return { ok: result.ok, error: result.error };
}

export async function daBackupDelete(owner: string, filename: string): Promise<{ ok: boolean; error?: string }> {
  const full = backupServerPath(owner, filename);
  const relPath = full.replace(`/home/${owner}`, '');
  const result = await daPostViaSshAsDaUser(owner, 'CMD_API_FILE_MANAGER', {
    action: 'multiple',
    button: 'delete',
    path: relPath.includes('/backups/backup/') ? '/backups/backup' : '/backups',
    select0: full,
    json: 'yes',
  });
  return { ok: result.ok, error: result.error };
}

export async function daBackupReadFile(owner: string, filename: string): Promise<{ ok: boolean; base64?: string; error?: string }> {
  if (!/^[\w.-]+$/.test(filename)) {
    return { ok: false, error: 'Nome de ficheiro inválido' };
  }
  const path = backupServerPath(owner, filename);
  try {
    const quoted = `'${path.replace(/'/g, `'\\''`)}'`;
    const out = (await executeServerCommand(`base64 -w0 ${quoted} 2>/dev/null`)).trim();
    if (!out || out.toLowerCase().includes('error')) {
      return { ok: false, error: 'Não foi possível ler o backup' };
    }
    return { ok: true, base64: out };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Download falhou' };
  }
}
