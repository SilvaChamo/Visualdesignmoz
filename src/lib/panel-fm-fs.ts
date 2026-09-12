/**
 * Operações do gestor de ficheiros em disco local (Hestia/Contabo).
 * Evita python+SSH para listar/mover — mais rápido e sem "Failed to fetch"
 * quando o subprocesso ou a fila SSH falham.
 */

import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { isValidHomePath } from '@/lib/panel-fs-ownership';

export type FmDirRow = {
  name: string;
  isDir: boolean;
  isLink: boolean;
  size: number;
  permissions: string;
  date: string;
};

export type FmPathResult = {
  done: string[];
  errors: Array<{ path: string; error: string }>;
};

export function canUseLocalFmFs(): boolean {
  if (process.env.SERVER_USE_LOCAL_EXEC === 'true') return true;
  if (process.env.SERVER_USE_LOCAL_EXEC === 'false') return false;
  try {
    return (
      fs.existsSync('/usr/local/hestia/bin/v-list-users') ||
      fs.existsSync('/home/vdadmin')
    );
  } catch {
    return false;
  }
}

function assertHome(target: string): string {
  const p = path.posix.resolve(target.trim());
  if (!isValidHomePath(p)) {
    throw new Error('Caminho inválido');
  }
  return p;
}

function uniqueName(dir: string, basename: string, suffix: string): string {
  const ext = path.posix.extname(basename);
  const stem = ext ? basename.slice(0, -ext.length) : basename;
  let i = 0;
  let candidate = basename;
  while (fs.existsSync(path.posix.join(dir, candidate))) {
    i += 1;
    candidate = i === 1 ? `${stem}${suffix}${ext}` : `${stem}${suffix}${i}${ext}`;
  }
  return candidate;
}

async function isDir(target: string): Promise<boolean> {
  try {
    const st = await fsp.stat(target);
    return st.isDirectory();
  } catch {
    return false;
  }
}

async function findSiblingFolder(parent: string, base: string): Promise<string | null> {
  if (!parent.startsWith('/home/')) return null;
  try {
    const names = await fsp.readdir(parent);
    for (const name of names) {
      if (name.toLowerCase() !== base.toLowerCase()) continue;
      const candidate = path.posix.join(parent, name);
      if (await isDir(candidate)) return candidate;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** Resolve a pasta de destino: se `backup` for ficheiro e `Backup` for pasta, usa a pasta. */
export async function resolveDestDirectory(destDir: string): Promise<string> {
  const dest = assertHome(destDir);
  const parent = path.posix.dirname(dest);
  const base = path.posix.basename(dest);

  if (await isDir(dest)) return dest;

  const sibling = await findSiblingFolder(parent, base);
  if (sibling) return sibling;

  if (fs.existsSync(dest) && !(await isDir(dest))) {
    throw new Error(`«${base}» é um ficheiro, não uma pasta.`);
  }

  await fsp.mkdir(dest, { recursive: true });
  return dest;
}

export async function localListDirectory(dirPath: string): Promise<FmDirRow[]> {
  const dir = assertHome(dirPath);
  let names: string[];
  try {
    names = await fsp.readdir(dir);
  } catch (e: unknown) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === 'ENOENT' || err.code === 'ENOTDIR') {
      throw new Error('Pasta não encontrada');
    }
    throw new Error(err.message || 'Não foi possível listar a pasta');
  }

  const rows: FmDirRow[] = [];
  for (const name of names) {
    if (name === '.' || name === '..') continue;
    const fp = path.posix.join(dir, name);
    try {
      const st = await fsp.lstat(fp);
      const mode = st.mode & 0o777;
      rows.push({
        name,
        isDir: st.isDirectory(),
        isLink: st.isSymbolicLink(),
        size: Number(st.size) || 0,
        permissions: mode.toString(8).padStart(3, '0'),
        date: new Date(st.mtimeMs).toISOString().slice(0, 16).replace('T', ' '),
      });
    } catch {
      /* ficheiro desapareceu a meio da listagem */
    }
  }
  rows.sort((a, b) => a.name.localeCompare(b.name, 'pt', { sensitivity: 'base' }));
  return rows;
}

async function copyEntry(src: string, dest: string): Promise<void> {
  const st = await fsp.lstat(src);
  if (st.isDirectory() && !st.isSymbolicLink()) {
    await fsp.cp(src, dest, { recursive: true, errorOnExist: true, force: false });
    return;
  }
  await fsp.copyFile(src, dest);
}

export async function localCopyOrMove(
  sources: string[],
  destDir: string,
  op: 'copy' | 'move',
): Promise<FmPathResult> {
  const dest = await resolveDestDirectory(destDir);

  const done: string[] = [];
  const errors: Array<{ path: string; error: string }> = [];
  const suffix = op === 'copy' ? '_copia' : '_movido';

  for (const raw of sources) {
    const src = assertHome(raw);
    try {
      if (!fs.existsSync(src)) {
        errors.push({ path: src, error: 'origem não encontrada' });
        continue;
      }
      const base = path.posix.basename(src);
      let target = path.posix.join(dest, base);
      if (path.posix.resolve(src) === path.posix.resolve(target)) {
        if (op === 'copy') {
          target = path.posix.join(dest, uniqueName(dest, base, suffix));
        } else {
          errors.push({ path: src, error: 'já está nesta pasta — escolha outro destino' });
          continue;
        }
      } else if (fs.existsSync(target)) {
        target = path.posix.join(dest, uniqueName(dest, base, suffix));
      }
      if (op === 'move') {
        try {
          await fsp.rename(src, target);
        } catch (e: unknown) {
          const err = e as NodeJS.ErrnoException;
          if (err.code === 'EXDEV') {
            await copyEntry(src, target);
            await fsp.rm(src, { recursive: true, force: true });
          } else {
            throw e;
          }
        }
      } else {
        await copyEntry(src, target);
      }
      done.push(target);
    } catch (e: unknown) {
      errors.push({ path: src, error: e instanceof Error ? e.message : 'falhou' });
    }
  }

  return { done, errors };
}

export async function localCreateFolder(folderPath: string): Promise<void> {
  const p = assertHome(folderPath);
  await fsp.mkdir(p, { recursive: true });
}

export async function localRename(source: string, newName: string): Promise<string> {
  const src = assertHome(source);
  if (!newName || newName.includes('/') || newName.includes('..') || newName.includes('\0')) {
    throw new Error('Nome inválido');
  }
  const dest = path.posix.join(path.posix.dirname(src), newName);
  assertHome(dest);
  if (!fs.existsSync(src)) throw new Error('Origem não encontrada');
  if (fs.existsSync(dest)) throw new Error('Já existe um item com esse nome');
  await fsp.rename(src, dest);
  return dest;
}

export async function localReadFile(
  filePath: string,
  maxBytes: number,
): Promise<{ content: string; size: number }> {
  const p = assertHome(filePath);
  let st: fs.Stats;
  try {
    st = await fsp.stat(p);
  } catch {
    throw new Error('not_file');
  }
  if (!st.isFile()) throw new Error('not_file');
  if (st.size > maxBytes) throw new Error('too_large');
  const buf = await fsp.readFile(p);
  return { content: buf.toString('base64'), size: st.size };
}

export async function localWriteFile(filePath: string, contentB64: string): Promise<void> {
  const p = assertHome(filePath);
  const data = Buffer.from(contentB64, 'base64');
  await fsp.mkdir(path.posix.dirname(p), { recursive: true });
  await fsp.writeFile(p, data);
}

export async function localDuplicate(source: string): Promise<string> {
  const src = assertHome(source);
  if (!fs.existsSync(src)) throw new Error('missing');
  const parent = path.posix.dirname(src);
  const dest = path.posix.join(parent, uniqueName(parent, path.posix.basename(src), '_copia'));
  await copyEntry(src, dest);
  return dest;
}

export async function localDelete(paths: string[]): Promise<FmPathResult> {
  const done: string[] = [];
  const errors: Array<{ path: string; error: string }> = [];
  for (const raw of paths) {
    const p = assertHome(raw);
    try {
      await fsp.rm(p, { recursive: true, force: false });
      done.push(p);
    } catch (e: unknown) {
      errors.push({ path: p, error: e instanceof Error ? e.message : 'falhou' });
    }
  }
  return { done, errors };
}
