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

async function executeViaNativeSsh(command: string): Promise<string> {
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

  try {
    const { stdout, stderr } = await execFileAsync(
      'ssh',
      [
        ...identityArg,
        '-p',
        String(opts.port),
        '-o',
        'StrictHostKeyChecking=no',
        '-o',
        'UserKnownHostsFile=/dev/null',
        '-o',
        'BatchMode=yes',
        `${opts.username}@${opts.host}`,
        command,
      ],
      { maxBuffer: 10 * 1024 * 1024, timeout: 120000 },
    );
    return (stdout || stderr || '').trim();
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

export function executeServerCommand(command: string): Promise<string> {
  if (process.env.SERVER_USE_LOCAL_EXEC === 'true') {
    return new Promise((resolve) => {
      const { exec } = require('child_process') as typeof import('child_process');
      exec(command, { timeout: 120000 }, (error, stdout, stderr) => {
        if (error) resolve(stderr || error.message);
        else resolve(stdout);
      });
    });
  }

  // Preferir ssh nativo — mais fiável com chaves OpenSSH multilinha
  return withSshSlot(() =>
    executeViaNativeSsh(command).catch((nativeErr: Error) => {
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
                resolve(output || errOutput);
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
