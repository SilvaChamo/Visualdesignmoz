import { NextResponse } from 'next/server';
import { Client } from 'ssh2';
import { getServerHost, getHestiaUrl } from '@/lib/server-config'

async function execSSH(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    let out = '';
    const rawKey = process.env.SSH_PRIVATE_KEY || '';
    
    // Validate key format
    if (!rawKey.includes('BEGIN') || !rawKey.includes('END')) {
      return reject(new Error('SSH_PRIVATE_KEY appears to be invalid - missing BEGIN/END markers'));
    }
    
    const privateKey = rawKey.replace(/\\n/g, '\n');
    const host = process.env.CYBERPANEL_IP || getServerHost();

    // Set a timeout for the entire operation
    const timeout = setTimeout(() => {
      conn.end();
      reject(new Error('SSH operation timed out after 20 seconds'));
    }, 20000);

    conn.on('ready', () => {
      clearTimeout(timeout);
      conn.exec(command, (err, stream) => {
        if (err) { conn.end(); return reject(err); }
        stream.on('data', (d: Buffer) => { out += d.toString(); });
        stream.stderr.on('data', (d: Buffer) => { out += d.toString(); });
        stream.on('close', () => { conn.end(); resolve(out); });
      });
    });

    conn.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
    
    conn.connect({
      host,
      port: 22,
      username: 'root',
      privateKey: Buffer.from(privateKey),
      readyTimeout: 15000,
      keepaliveInterval: 5000,
      keepaliveCountMax: 3,
    });
  });
}

export async function GET() {
  const results: any = {
    timestamp: new Date().toISOString(),
    env: {
      CYBERPANEL_IP: process.env.CYBERPANEL_IP || '109.199.104.22 (default)',
      SSH_PRIVATE_KEY_SET: !!process.env.SSH_PRIVATE_KEY,
      SSH_KEY_LENGTH: process.env.SSH_PRIVATE_KEY?.length || 0,
    },
    tests: {}
  };

  try {
    // Test 1: Basic SSH connection
    results.tests.ssh_basic = await execSSH('echo "SSH_OK"');
    
    // Test 2: Check which cyberpanel
    results.tests.which_cyberpanel = await execSSH('which cyberpanel 2>&1 || echo "NOT_FOUND"');
    
    // Test 3: Check if file exists
    const cpPath = results.tests.which_cyberpanel.trim() === 'NOT_FOUND' 
      ? '/usr/local/bin/cyberpanel' 
      : results.tests.which_cyberpanel.trim();
    results.tests.file_check = await execSSH(`ls -la ${cpPath} 2>&1 || echo "FILE_NOT_FOUND"`);
    
    // Test 4: Test MySQL connection
    results.tests.mysql = await execSSH('mysql cyberpanel -e "SELECT COUNT(*) FROM loginSystem_administrator;" 2>&1');
    
    // Test 5: List current users
    results.tests.list_users = await execSSH('mysql cyberpanel -e "SELECT userName, email FROM loginSystem_administrator;" -B -N 2>&1');
    
    results.success = true;
  } catch (error: any) {
    results.success = false;
    results.error = error.message;
    results.stack = error.stack;
  }

  return NextResponse.json(results);
}
