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

async function executeViaNativeSsh(command: string, fast = false): Promise<string> {
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
    '-p',
    String(opts.port),
    '-o',
    'StrictHostKeyChecking=no',
    '-o',
    'UserKnownHostsFile=/dev/null',
    '-o',
    'BatchMode=yes',
    '-o',
    `ConnectTimeout=${fast ? 6 : 15}`,
    '-o',
    'ConnectionAttempts=1',
  ];
  if (fast) {
    sshOpts.push('-o', 'Compression=no');
  }

  try {
    const { stdout, stderr } = await execFileAsync(
      'ssh',
      [
        ...sshOpts,
        `${opts.username}@${opts.host}`,
        command,
      ],
      { maxBuffer: 10 * 1024 * 1024, timeout: fast ? 20000 : 120000 },
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

export function executeServerCommand(command: string, options?: { fast?: boolean }): Promise<string> {
  const fast = options?.fast === true;
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
    executeViaNativeSsh(command, fast).catch((nativeErr: Error) => {
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

export function uploadFileViaSsh(remotePath: string, fileData: Buffer | import('stream/web').ReadableStream): Promise<void> {
  if (process.env.SERVER_USE_LOCAL_EXEC === 'true') {
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
