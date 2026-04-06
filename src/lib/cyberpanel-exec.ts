/**
 * CyberPanel Command Executor
 *
 * Supports three modes:
 *  1. LOCAL  — CYBERPANEL_USE_LOCAL_EXEC=true → child_process.exec (same server, no SSH needed)
 *  2. SSH    — SSH key or password configured  → ssh2 over TCP
 *  3. GRACEFUL — no credentials at all        → returns empty string (caller handles fallback)
 */

import { exec } from 'child_process';

export function executeCyberPanelCommand(command: string): Promise<string> {
    // MODE 1: local exec (app running on same server as CyberPanel)
    if (process.env.CYBERPANEL_USE_LOCAL_EXEC === 'true') {
        return new Promise((resolve) => {
            exec(command, { timeout: 30000 }, (error, stdout, stderr) => {
                if (error) {
                    resolve(stderr || error.message);
                } else {
                    resolve(stdout);
                }
            });
        });
    }

    // MODE 2: SSH (remote)
    const sshPass = process.env.CYBERPANEL_SSH_PASS;
    const sshKeyPath = process.env.CYBERPANEL_SSH_KEY_PATH;
    const sshKey = process.env.CYBERPANEL_SSH_KEY || process.env.SSH_PRIVATE_KEY;

    if (!sshPass && !sshKeyPath && !sshKey) {
        // MODE 3: no credentials — return empty so caller uses API/localStorage fallback
        return Promise.resolve('');
    }

    return new Promise((resolve, reject) => {
        // Lazy import ssh2 only when needed
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { Client } = require('ssh2');
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const fs = require('fs');
        const conn = new Client();

        conn.on('ready', () => {
            conn.exec(command, (err: any, stream: any) => {
                if (err) { conn.end(); return reject(err); }

                let output = '';
                let errOutput = '';

                stream.on('close', (code: number) => {
                    conn.end();
                    if (code !== 0 && errOutput && !output) {
                        reject(new Error(`SSH Command failed (${code}): ${errOutput}`));
                    } else {
                        resolve(output || errOutput);
                    }
                })
                .on('data', (data: Buffer) => { output += data; })
                .stderr.on('data', (data: Buffer) => { errOutput += data; });
            });
        })
        .on('error', (err: Error) => reject(new Error(`SSH Connection Error: ${err.message}`)))
        .connect({
            host: process.env.CYBERPANEL_IP || '109.199.104.22',
            port: Number(process.env.CYBERPANEL_SSH_PORT || 22),
            username: process.env.CYBERPANEL_SSH_USER || 'root',
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
