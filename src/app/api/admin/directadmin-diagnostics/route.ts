import http from 'node:http';
import https from 'node:https';
import { NextResponse } from 'next/server';
import { requireAdminOrReseller } from '@/lib/panel-api-auth';
import { buildDirectAdminBase, normalizeDirectAdminHost, normalizeDirectAdminPort } from '@/lib/directadmin-url';

function readEnv(name: string) {
  const value = process.env[name];
  if (!value) return '';
  return value.trim().replace(/^['"]|['"]$/g, '');
}

function authSource() {
  const candidates = [
    ['DIRECTADMIN_PASSWORD', readEnv('DIRECTADMIN_PASSWORD')],
    ['DIRECTADMIN_LOGIN_KEY', readEnv('DIRECTADMIN_LOGIN_KEY')],
    ['DIRECTADMIN_PASS', readEnv('DIRECTADMIN_PASS')],
  ] as const;

  return candidates.find(([, value]) => Boolean(value)) || [null, ''] as const;
}

function maskValue(value: string) {
  if (!value) return null;
  if (value.length <= 8) return `${value[0] || ''}***`;
  return `${value.slice(0, 3)}***${value.slice(-3)}`;
}

function requestDirectAdmin(url: URL, user: string, password: string) {
  const transport = url.protocol === 'http:' ? http : https;
  const auth = Buffer.from(`${user}:${password}`).toString('base64');

  return new Promise<{ status: number; text: string }>((resolve, reject) => {
    const req = transport.request(
      {
        method: 'GET',
        hostname: url.hostname,
        port: url.port,
        path: `${url.pathname}${url.search}`,
        headers: { Authorization: `Basic ${auth}` },
        timeout: 15000,
        rejectUnauthorized: readEnv('DIRECTADMIN_REJECT_UNAUTHORIZED') === 'true',
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on('end', () => {
          resolve({
            status: res.statusCode || 0,
            text: Buffer.concat(chunks).toString('utf8').replace(/\s+/g, ' ').trim().substring(0, 500),
          });
        });
      }
    );

    req.on('timeout', () => req.destroy(new Error('DirectAdmin diagnostic timeout')));
    req.on('error', reject);
    req.end();
  });
}

export async function GET() {
  const auth = await requireAdminOrReseller();
  if ('error' in auth) return auth.error;

  const host = normalizeDirectAdminHost(readEnv('DIRECTADMIN_HOST'));
  const port = normalizeDirectAdminPort(readEnv('DIRECTADMIN_PORT'));
  const user = readEnv('DIRECTADMIN_USER') || 'admin';
  const protocol = readEnv('DIRECTADMIN_PROTOCOL') || 'https';
  const base = buildDirectAdminBase({
    explicitUrl: readEnv('DIRECTADMIN_URL'),
    protocol,
    host,
    port,
  });
  const [source, credential] = authSource();

  if (!credential) {
    return NextResponse.json({
      ok: false,
      message: 'Nenhuma credencial DirectAdmin configurada.',
      expected: ['DIRECTADMIN_LOGIN_KEY', 'DIRECTADMIN_PASSWORD', 'DIRECTADMIN_PASS'],
    });
  }

  const url = new URL(`${base}/CMD_API_SHOW_ALL_USERS`);
  url.searchParams.set('json', 'yes');

  try {
    const result = await requestDirectAdmin(url, user, credential);
    return NextResponse.json({
      ok: result.status >= 200 && result.status < 300 && !result.text.includes('"success":"no"'),
      directAdmin: {
        base,
        user,
        authSource: source,
        credentialLength: credential.length,
        credentialPreview: maskValue(credential),
        status: result.status,
        response: result.text,
      },
      deployment: {
        commit: process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || null,
        environment: process.env.VERCEL_ENV || null,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        directAdmin: {
          base,
          user,
          authSource: source,
          credentialLength: credential.length,
          credentialPreview: maskValue(credential),
        },
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}
