/**
 * DirectAdmin API — pedidos HTTP com autenticação Basic.
 */

import http from 'node:http';
import https from 'node:https';
import {
  buildDirectAdminBase,
  normalizeDirectAdminHost,
  normalizeDirectAdminPort,
} from '@/lib/directadmin-url';
import {
  resolveDirectAdminCredentials,
  type DirectAdminAuthContext,
  type DirectAdminCredentials,
  type DirectAdminRole,
} from '@/lib/directadmin-credentials';

export interface DaResponse {
  error: boolean;
  text?: string;
  details?: string;
  data?: Record<string, unknown>;
}

function readEnv(name: string): string {
  const value = process.env[name];
  if (!value) return '';
  return value.trim().replace(/^['"]|['"]$/g, '');
}

function buildDaBase(): string {
  return buildDirectAdminBase({
    explicitUrl: readEnv('DIRECTADMIN_URL'),
    protocol: readEnv('DIRECTADMIN_PROTOCOL') || 'https',
    host: normalizeDirectAdminHost(readEnv('DIRECTADMIN_HOST')),
    port: normalizeDirectAdminPort(readEnv('DIRECTADMIN_PORT')),
  });
}

export function parseDaResponse(responseString: string): DaResponse {
  try {
    const parsed = new URLSearchParams(responseString);
    const result: DaResponse = {
      error: parsed.get('error') === '1',
      text: parsed.get('text') || undefined,
      details: parsed.get('details') || undefined,
      data: {},
    };

    for (const [key, value] of parsed.entries()) {
      if (key !== 'error' && key !== 'text' && key !== 'details') {
        result.data![key] = value;
      }
    }

    return result;
  } catch {
    return { error: true, text: 'Parse Error', details: 'Could not parse DirectAdmin response' };
  }
}

function normalizeJsonResponse(jsonData: Record<string, unknown>): DaResponse {
  const errorVal = jsonData.error;
  const hasError =
    errorVal === '1' ||
    errorVal === 1 ||
    errorVal === true ||
    jsonData.success === false ||
    jsonData.success === 'no';

  return {
    error: hasError,
    text: typeof jsonData.text === 'string' ? jsonData.text : undefined,
    details: typeof jsonData.details === 'string' ? jsonData.details : undefined,
    data: jsonData,
  };
}

async function requestDirectAdminHttp(
  endpoint: string,
  method: 'GET' | 'POST',
  params: Record<string, string>,
  credentials: DirectAdminCredentials,
): Promise<string> {
  const base = buildDaBase();
  const url = new URL(`${base}/${endpoint}`);
  const body = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (method === 'GET') url.searchParams.append(key, value);
    else body.append(key, value);
  });

  const bodyText = body.toString();
  const transport = url.protocol === 'http:' ? http : https;
  const headers: Record<string, string> = {
    Authorization: `Basic ${Buffer.from(`${credentials.user}:${credentials.password}`).toString('base64')}`,
  };

  if (method === 'POST') {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    headers['Content-Length'] = String(Buffer.byteLength(bodyText));
  }

  const rejectUnauthorized = readEnv('DIRECTADMIN_REJECT_UNAUTHORIZED') === 'true';

  return new Promise((resolve, reject) => {
    const req = transport.request(
      {
        method,
        hostname: url.hostname,
        port: url.port,
        path: `${url.pathname}${url.search}`,
        headers,
        timeout: 30000,
        rejectUnauthorized: url.protocol === 'https:' ? rejectUnauthorized : undefined,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
            reject(
              new Error(
                `${endpoint}: DirectAdmin HTTP ${res.statusCode || 0} - ${text.replace(/\s+/g, ' ').trim().substring(0, 300)}`,
              ),
            );
            return;
          }
          resolve(text);
        });
      },
    );

    req.on('timeout', () => req.destroy(new Error(`${endpoint}: ligação ao DirectAdmin expirou`)));
    req.on('error', (error: NodeJS.ErrnoException) => {
      reject(
        new Error(
          `${endpoint}: falha de ligação (${error.code || error.name}) - ${error.message}`,
        ),
      );
    });

    if (method === 'POST') req.write(bodyText);
    req.end();
  });
}

async function requestDirectAdmin(
  endpoint: string,
  method: 'GET' | 'POST',
  params: Record<string, string>,
  credentials: DirectAdminCredentials,
): Promise<string> {
  if (process.env.DA_USE_SSH_PROXY === 'true') {
    const { requestDirectAdminViaSsh } = await import('@/lib/da-ssh-proxy');
    return requestDirectAdminViaSsh(endpoint, method, params, credentials);
  }

  try {
    return await requestDirectAdminHttp(endpoint, method, params, credentials);
  } catch (error) {
    const { requestDirectAdminViaSsh, shouldFallbackToDaSsh } = await import('@/lib/da-ssh-proxy');
    if (!shouldFallbackToDaSsh(error)) throw error;
    try {
      return await requestDirectAdminViaSsh(endpoint, method, params, credentials);
    } catch (sshError) {
      const httpMsg = error instanceof Error ? error.message : String(error);
      const sshMsg = sshError instanceof Error ? sshError.message : String(sshError);
      throw new Error(`${httpMsg} (SSH fallback: ${sshMsg})`);
    }
  }
}

export async function daRequest(
  endpoint: string,
  method: 'GET' | 'POST' = 'GET',
  params: Record<string, string> = {},
  roleOrCreds: DirectAdminRole | DirectAdminCredentials = 'admin',
  context?: DirectAdminAuthContext,
): Promise<DaResponse> {
  try {
    const credentials: DirectAdminCredentials =
      typeof roleOrCreds === 'object' && 'password' in roleOrCreds
        ? roleOrCreds
        : await resolveDirectAdminCredentials(roleOrCreds, context);
    const textData = await requestDirectAdmin(endpoint, method, params, credentials);

    if (params.json === 'yes' || textData.trim().startsWith('{') || textData.trim().startsWith('[')) {
      try {
        const jsonData = JSON.parse(textData) as Record<string, unknown> | unknown[];
        if (Array.isArray(jsonData)) {
          return { error: false, data: { list: jsonData } };
        }
        return normalizeJsonResponse(jsonData);
      } catch {
        return parseDaResponse(textData);
      }
    }

    return parseDaResponse(textData);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to connect to DirectAdmin';
    console.error('[DirectAdmin API]', endpoint, message);
    return {
      error: true,
      text: 'Connection Error',
      details: message,
    };
  }
}

export async function daJsonRequest(
  endpoint: string,
  method: 'GET' | 'POST' = 'GET',
  params: Record<string, string> = {},
  roleOrCreds: DirectAdminRole | DirectAdminCredentials = 'admin',
  context?: DirectAdminAuthContext,
): Promise<DaResponse> {
  return daRequest(endpoint, method, { ...params, json: 'yes' }, roleOrCreds, context);
}
