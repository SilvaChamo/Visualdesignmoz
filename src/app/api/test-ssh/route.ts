import { NextResponse } from 'next/server';
import { executeServerCommand } from '@/lib/server-ssh-exec';
import { getServerHost } from '@/lib/server-config';

export async function GET() {
  const results: {
    timestamp: string;
    env: Record<string, string | number | boolean>;
    tests: Record<string, string>;
    success?: boolean;
    error?: string;
  } = {
    timestamp: new Date().toISOString(),
    env: {
      SERVER_HOST: getServerHost(),
      SSH_PRIVATE_KEY_SET: !!process.env.SSH_PRIVATE_KEY,
      SSH_KEY_LENGTH: process.env.SSH_PRIVATE_KEY?.length || 0,
    },
    tests: {},
  };

  try {
    results.tests.ssh_basic = await executeServerCommand('echo "SSH_OK"');
    results.tests.hostname = await executeServerCommand('hostname');
    results.tests.uptime = await executeServerCommand('uptime -p 2>/dev/null || uptime');
    results.success = true;
  } catch (error: unknown) {
    results.success = false;
    results.error = error instanceof Error ? error.message : 'Erro SSH';
  }

  return NextResponse.json(results);
}
