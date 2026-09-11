/**
 * Execução SSH genérica no servidor de hospedagem (Hetzner / DirectAdmin).
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  getSshConnectOptions,
  resolveSshKeyPath,
  resolveSshPrivateKey,
} from '@/lib/ssh-connect-options';
import { withSshSlot } from '@/lib/ssh-connection-queue';

const execFileAsync = promisify(execFile);

let sshpassAvailable: boolean | null = null;
async function hasSshpass(): Promise<boolean> {
  if (sshpassAvailable !== null) return sshpassAvailable;
  try {
    await execFileAsync('sshpass', ['-V']);
    sshpassAvailable = true;
  } catch {
    sshpassAvailable = false;
  }
  return sshpassAvailable;
}

// A biblioteca ssh2 (JS puro) falha a autenticação por password de forma
// intermitente/consistente quando corre dentro do processo do `next dev`
// (funciona isoladamente via tsx/node simples) — usar o `ssh` nativo com
// sshpass para password evita depender da negociação criptográfica do ssh2.
function hestiaRunsLocally(): boolean {
  try {
    return fs.existsSync('/usr/local/hestia/bin/v-list-users');
  } catch {
    return false;
  }
}

function useLocalServerExec(): boolean {
  if (process.env.SERVER_USE_LOCAL_EXEC === 'true') return true;
  if (process.env.SERVER_USE_LOCAL_EXEC === 'false') return false;
  return hestiaRunsLocally();
}

function sanitizeServerOutput(raw: string): string {
  return raw
    .split(/\r?\n/)
    .filter((line) => {
      const t = line.trim();
      if (!t) return false;
      if (/permanently added/i.test(t)) return false;
      if (/known hosts/i.test(t)) return false;
      if (/^warning:/i.test(t) && /ssh|host/i.test(t)) return false;
      return true;
    })
    .join('\n')
    .trim();
}

function localServerExec(command: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve) => {
    const { exec } = require('child_process') as typeof import('child_process');
    exec(command, { timeout: timeoutMs, maxBuffer: 50 * 1024 * 1024 }, (error, stdout, stderr) => {
      const out = sanitizeServerOutput((stdout || '').toString());
      if (error) {
        const errText = sanitizeServerOutput((stderr || error.message || '').toString());
        resolve(out || errText);
        return;
      }
      resolve(out);
    });
  });
}

async function executeViaNativeSsh(command: string, fast = false, timeoutMs?: number): Promise<string> {
  const opts = getSshConnectOptions();
  const keyPath = resolveSshKeyPath();

  let tempKeyPath: string | undefined;
  let identityArg: string[] = [];
  let useSshpass = false;

  if (keyPath) {
    identityArg = ['-i', keyPath];
  } else {
    const key = resolveSshPrivateKey();
    if (key) {
      tempKeyPath = path.join(os.tmpdir(), `vd-ssh-${process.pid}-${Date.now()}.key`);
      fs.writeFileSync(tempKeyPath, key, { mode: 0o600 });
      identityArg = ['-i', tempKeyPath];
    } else if (opts.password && (await hasSshpass())) {
      useSshpass = true;
    } else {
      throw new Error('Chave SSH indisponível');
    }
  }

  const sshOpts = [
    ...identityArg,
    '-p',
    String(opts.port),
    '-o',
    'StrictHostKeyChecking=no',
    '-o',
    'UserKnownHostsFile=/dev/null',
    '-o',
    useSshpass ? 'BatchMode=no' : 'BatchMode=yes',
    '-o',
    `ConnectTimeout=${fast ? 6 : 15}`,
    '-o',
    'ConnectionAttempts=1',
  ];
  if (fast) {
    sshOpts.push('-o', 'Compression=no');
  }

  const sshArgs = [...sshOpts, `${opts.username}@${opts.host}`, command];

  try {
    try {
      const { stdout, stderr } = await execFileAsync(
        useSshpass ? 'sshpass' : 'ssh',
        useSshpass ? ['-e', 'ssh', ...sshArgs] : sshArgs,
        {
          maxBuffer: 10 * 1024 * 1024,
          timeout: timeoutMs ?? (fast ? 20000 : 120000),
          env: useSshpass ? { ...process.env, SSHPASS: opts.password } : process.env,
        },
      );
      return sanitizeServerOutput(`${stdout || ''}\n${stderr || ''}`.trim());
    } catch (e: unknown) {
      const err = e as NodeJS.ErrnoException & { stdout?: string; stderr?: string };
      const out = sanitizeServerOutput(`${err.stdout || ''}\n${err.stderr || ''}`.trim());
      const sshBroke =
        !out ||
        /Connection refused|Permission denied \(publickey|Could not resolve|No route to host|Connection timed out|ECONNREFUSED|ETIMEDOUT|Host key verification/i.test(
          err.message || '',
        );
      if (!sshBroke) return out;
      throw err;
    }
  } finally {
    if (tempKeyPath) {
      try {
        fs.unlinkSync(tempKeyPath);
      } catch {
        /* ignore */
      }
    }
  }
}

export function executeServerCommand(
  command: string,
  options?: { fast?: boolean; timeoutMs?: number },
): Promise<string> {
  const fast = options?.fast === true;
  const timeoutMs = options?.timeoutMs ?? (fast ? 20_000 : 120_000);
  if (useLocalServerExec()) {
    return localServerExec(command, timeoutMs);
  }

  // Preferir ssh nativo — mais fiável com chaves OpenSSH multilinha
  return withSshSlot(() =>
    executeViaNativeSsh(command, fast, timeoutMs).catch((nativeErr: Error) => {
    return new Promise((resolve, reject) => {
      let connectOptions: ReturnType<typeof getSshConnectOptions>;
      try {
        connectOptions = getSshConnectOptions();
      } catch (e: unknown) {
        reject(nativeErr);
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Client } = require('ssh2');
      const conn = new Client();

      conn.on('ready', () => {
        conn.exec(
          command,
          (
            err: Error | undefined,
            stream: NodeJS.ReadableStream & {
              stderr: NodeJS.ReadableStream;
              on(event: string, cb: (...args: unknown[]) => void): void;
            },
          ) => {
            if (err) {
              conn.end();
              reject(err);
              return;
            }

            let output = '';
            let errOutput = '';

            stream.on('close', (code: number) => {
              conn.end();
              if (code !== 0 && errOutput && !output) {
                reject(new Error(`SSH falhou (${code}): ${errOutput}`));
              } else {
                resolve(sanitizeServerOutput(output));
              }
            });
            stream.on('data', (data: Buffer) => {
              output += data;
            });
            stream.stderr.on('data', (data: Buffer) => {
              errOutput += data;
            });
          },
        );
      });
      conn.on('error', (err: Error) => {
        reject(
          new Error(
            `${nativeErr.message}; ssh2: ${err.message} — confira SERVER_SSH_KEY_PATH ou SSH_PRIVATE_KEY`,
          ),
        );
      });
      conn.connect(connectOptions);
    });
    }),
  );
}

export function uploadFileViaSsh(remotePath: string, fileData: Buffer | import('stream/web').ReadableStream): Promise<void> {
  if (useLocalServerExec()) {
    return new Promise(async (resolve, reject) => {
      try {
        if (Buffer.isBuffer(fileData)) {
          fs.writeFile(remotePath, fileData, (err) => {
            if (err) reject(err);
            else resolve();
          });
        } else {
          const stream = require('stream');
          const fileStream = fs.createWriteStream(remotePath);
          stream.Readable.fromWeb(fileData as any).pipe(fileStream);
          fileStream.on('finish', resolve);
          fileStream.on('error', reject);
        }
      } catch (e) {
        reject(e);
      }
    });
  }

  return withSshSlot(async () => {
    const opts = getSshConnectOptions();
    const keyPath = resolveSshKeyPath();
    let tempKeyPath: string | undefined;
    let identityArg: string[];

    if (keyPath) {
      identityArg = ['-i', keyPath];
    } else {
      const key = resolveSshPrivateKey();
      if (!key) throw new Error('Chave SSH indisponível');
      tempKeyPath = path.join(os.tmpdir(), `vd-ssh-${process.pid}-${Date.now()}.key`);
      fs.writeFileSync(tempKeyPath, key, { mode: 0o600 });
      identityArg = ['-i', tempKeyPath];
    }

    const sshOpts = [
      ...identityArg,
      '-p', String(opts.port),
      '-o', 'StrictHostKeyChecking=no',
      '-o', 'UserKnownHostsFile=/dev/null',
      '-o', 'BatchMode=yes',
      '-o', 'ConnectTimeout=15',
      '-o', 'ConnectionAttempts=1',
      `${opts.username}@${opts.host}`,
      `cat > "${remotePath}"`
    ];

    return new Promise<void>((resolve, reject) => {
      const { spawn } = require('child_process') as typeof import('child_process');
      const child = spawn('ssh', sshOpts);
      
      let errOutput = '';
      child.stderr.on('data', data => { errOutput += data; });
      
      child.on('close', code => {
        if (tempKeyPath) {
          try { fs.unlinkSync(tempKeyPath); } catch {}
        }
        if (code === 0) resolve();
        else reject(new Error(`Upload falhou com código ${code}: ${errOutput}`));
      });
      
      child.on('error', err => {
        if (tempKeyPath) {
          try { fs.unlinkSync(tempKeyPath); } catch {}
        }
        reject(err);
      });

      if (Buffer.isBuffer(fileData)) {
        child.stdin.write(fileData);
        child.stdin.end();
      } else {
        const stream = require('stream');
        stream.Readable.fromWeb(fileData as any).pipe(child.stdin);
      }
    });
  });
}
