import { NextResponse } from 'next/server';
import net from 'net';
import {
  buildDirectAdminBase,
  buildDirectAdminFallbackUrl,
} from '@/lib/directadmin-url';
import { requireAdminOrReseller } from '@/lib/panel-api-auth';

function readEnv(...keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return '';
}

function probeTcp(host: string, port: number, timeoutMs = 3000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port, timeout: timeoutMs }, () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('error', () => resolve(false));
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
  });
}

/** Redireciona para o login do DirectAdmin (canónico ou fallback IP). Só admin/revendedor. */
export async function GET() {
  const auth = await requireAdminOrReseller();
  if ('error' in auth) return auth.error;

  const primary = buildDirectAdminBase({
    explicitUrl: readEnv('DIRECTADMIN_URL'),
    protocol: readEnv('DIRECTADMIN_PROTOCOL', 'NEXT_PUBLIC_DIRECTADMIN_PROTOCOL') || 'https',
    host: readEnv('DIRECTADMIN_HOST', 'NEXT_PUBLIC_DIRECTADMIN_HOST'),
    port: readEnv('DIRECTADMIN_PORT', 'NEXT_PUBLIC_DIRECTADMIN_PORT'),
  });

  const fallback = buildDirectAdminFallbackUrl(
    readEnv('DIRECTADMIN_FALLBACK_HOST', 'NEXT_PUBLIC_DIRECTADMIN_FALLBACK_HOST'),
    readEnv('DIRECTADMIN_FALLBACK_PORT', 'NEXT_PUBLIC_DIRECTADMIN_FALLBACK_PORT'),
    readEnv('DIRECTADMIN_FALLBACK_PROTOCOL', 'NEXT_PUBLIC_DIRECTADMIN_FALLBACK_PROTOCOL'),
  );

  try {
    const parsed = new URL(primary);
    const port = parsed.port
      ? Number(parsed.port)
      : parsed.protocol === 'https:'
        ? 443
        : 80;
    const reachable = await probeTcp(parsed.hostname, port);
    if (reachable) {
      return NextResponse.redirect(primary, {
        status: 307,
        headers: { 'Cache-Control': 'no-store' },
      });
    }
  } catch {
    // usa fallback
  }

  return NextResponse.redirect(fallback, {
    status: 307,
    headers: { 'Cache-Control': 'no-store' },
  });
}
