/**
 * Execução SSH genérica no servidor de hospedagem (Hetzner / DirectAdmin).
 */

import { exec } from 'child_process';
import { getServerHost } from '@/lib/server-config';

export function executeServerCommand(command: string): Promise<string> {
  if (process.env.SERVER_USE_LOCAL_EXEC === 'true') {
    return new Promise((resolve) => {
      exec(command, { timeout: 30000 }, (error, stdout, stderr) => {
        if (error) resolve(stderr || error.message);
        else resolve(stdout);
      });
    });
  }

  const sshPass = process.env.SERVER_SSH_PASS;
  const sshKeyPath = process.env.SERVER_SSH_KEY_PATH;
  const sshKey = process.env.SSH_PRIVATE_KEY;

  if (!sshPass && !sshKeyPath && !sshKey) {
    return Promise.resolve('');
  }

  return new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Client } = require('ssh2');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs');
    const conn = new Client();

    conn.on('ready', () => {
      conn.exec(command, (err: Error | undefined, stream: NodeJS.ReadableStream & { stderr: NodeJS.ReadableStream; on(event: string, cb: (...args: unknown[]) => void): void }) => {
        if (err) {
          conn.end();
          return reject(err);
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
      });
    });
    conn.on('error', (err: Error) => reject(new Error(`SSH: ${err.message}`)));
    conn.connect({
      host: process.env.SERVER_IP || getServerHost(),
      port: Number(process.env.SERVER_SSH_PORT || 22),
      username: process.env.SERVER_SSH_USER || 'root',
      privateKey: sshKeyPath
        ? fs.readFileSync(sshKeyPath, 'utf8')
        : sshKey
          ? sshKey.replace(/\\n/g, '\n')
          : undefined,
      password: sshPass,
      readyTimeout: 15000,
    });
  });
}
