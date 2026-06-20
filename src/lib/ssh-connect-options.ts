/**
 * Normalização da chave SSH e opções de ligação ao servidor Hetzner.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { getServerHost } from '@/lib/server-config';

export function normalizeSshPrivateKey(raw: string): string {
  let key = raw.trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1).trim();
  }
  key = key.replace(/\\n/g, '\n').replace(/\r\n/g, '\n');
  if (!key.includes('\n') && key.includes('-----BEGIN')) {
    const begin = key.match(/-----BEGIN [^-]+-----/)?.[0];
    const end = key.match(/-----END [^-]+-----/)?.[0];
    if (begin && end) {
      const middle = key.slice(key.indexOf(begin) + begin.length, key.indexOf(end));
      const body = middle.replace(/\s+/g, '');
      const lines = body.match(/.{1,64}/g) ?? [];
      key = `${begin}\n${lines.join('\n')}\n${end}`;
    }
  }
  if (!key.endsWith('\n')) key += '\n';
  return key;
}

function isValidPrivateKey(key: string): boolean {
  return key.includes('-----BEGIN') && key.includes('-----END') && key.length > 200;
}

function expandHome(filePath: string): string {
  if (filePath.startsWith('~/')) {
    return path.join(os.homedir(), filePath.slice(2));
  }
  return filePath;
}

function readKeyFromPath(filePath: string): string | undefined {
  try {
    const resolved = expandHome(filePath);
    const fromFile = fs.readFileSync(resolved, 'utf8').trim();
    if (!isValidPrivateKey(fromFile)) return undefined;
    return normalizeSshPrivateKey(fromFile);
  } catch {
    return undefined;
  }
}

export function resolveSshPrivateKey(): string | undefined {
  const candidates = [
    process.env.SERVER_SSH_KEY_PATH,
    process.env.SSH_KEY_PATH,
    path.join(os.homedir(), '.ssh', 'visualdesign_hetzner'),
    path.join(os.homedir(), '.ssh', 'id_rsa'),
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    const key = readKeyFromPath(candidate);
    if (key) return key;
  }

  const raw = process.env.SSH_PRIVATE_KEY?.trim();
  if (!raw) return undefined;

  const key = normalizeSshPrivateKey(raw);
  return isValidPrivateKey(key) ? key : undefined;
}

export function resolveSshKeyPath(): string | undefined {
  const candidates = [
    process.env.SERVER_SSH_KEY_PATH,
    process.env.SSH_KEY_PATH,
    path.join(os.homedir(), '.ssh', 'visualdesign_hetzner'),
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    const resolved = expandHome(candidate);
    try {
      const content = fs.readFileSync(resolved, 'utf8');
      if (isValidPrivateKey(content)) return resolved;
    } catch {
      /* próximo */
    }
  }
  return undefined;
}

export function getSshConnectOptions(): {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  readyTimeout: number;
} {
  const privateKey = resolveSshPrivateKey();
  const password = process.env.SERVER_SSH_PASS?.trim() || undefined;

  if (!privateKey && !password) {
    throw new Error(
      'SSH não configurado: defina SERVER_SSH_KEY_PATH ou SSH_PRIVATE_KEY válida',
    );
  }

  return {
    host: process.env.SERVER_IP || getServerHost(),
    port: Number(process.env.SERVER_SSH_PORT || process.env.SSH_PORT || 2234),
    username: process.env.SERVER_SSH_USER || process.env.SSH_USER || 'root',
    password,
    privateKey,
    readyTimeout: 20000,
  };
}
