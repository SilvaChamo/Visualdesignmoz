import net from 'node:net';
import { NextResponse } from 'next/server';
import { getDirectAdminFallbackUrl, getDirectAdminUrl } from '@/lib/server-config';

function sanitizePath(rawPath: string | null) {
  if (!rawPath) return '';
  if (rawPath.includes('://')) return '';
  const normalized = rawPath.trim().replace(/^\/+/, '');
  return normalized ? `/${normalized}` : '';
}

async function isReachable(targetUrl: string, timeoutMs = 1800): Promise<boolean> {
  const url = new URL(targetUrl);
  const port = Number(url.port || (url.protocol === 'https:' ? '443' : '80'));

  return new Promise((resolve) => {
    const socket = net.createConnection({ host: url.hostname, port });
    let finished = false;

    const done = (result: boolean) => {
      if (finished) return;
      finished = true;
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

function withPath(baseUrl: string, extraPath: string) {
  if (!extraPath) return baseUrl;
  const url = new URL(baseUrl);
  url.pathname = extraPath;
  return url.toString();
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const extraPath = sanitizePath(searchParams.get('path'));
  const force = searchParams.get('force');

  const primaryUrl = withPath(getDirectAdminUrl(), extraPath);
  const fallbackUrl = withPath(getDirectAdminFallbackUrl(), extraPath);

  let destination = primaryUrl;
  if (force === 'fallback') {
    destination = fallbackUrl;
  } else if (!(await isReachable(primaryUrl))) {
    destination = fallbackUrl;
  }

  return NextResponse.redirect(destination, {
    status: 307,
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
  });
}
