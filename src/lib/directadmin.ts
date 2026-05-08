/**
 * DirectAdmin API Integration Core
 * Handles authentication and HTTP requests to the DirectAdmin server.
 */

import http from 'node:http';
import https from 'node:https';

// These should be configured in your .env.local file
const DA_HOST = process.env.DIRECTADMIN_HOST || '109.199.104.22';
const DA_PORT = process.env.DIRECTADMIN_PORT || '2222';
const DA_USER = process.env.DIRECTADMIN_USER || 'admin';
const DA_PASSWORD =
  process.env.DIRECTADMIN_PASSWORD ||
  process.env.DIRECTADMIN_LOGIN_KEY ||
  process.env.DIRECTADMIN_PASS ||
  '';
const DA_PROTOCOL = process.env.DIRECTADMIN_PROTOCOL || 'https'; // Use 'http' if SSL is not yet configured
const DA_BASE = (process.env.DIRECTADMIN_URL || `${DA_PROTOCOL}://${DA_HOST}:${DA_PORT}`).replace(/\/$/, '');
const DA_REJECT_UNAUTHORIZED = process.env.DIRECTADMIN_REJECT_UNAUTHORIZED === 'true';

export interface DaResponse {
  error: boolean;
  text?: string;
  details?: string;
  data?: Record<string, any>;
}

/**
 * Parses DirectAdmin API urlencoded response string into an object.
 * DirectAdmin returns data in the format: error=0&text=Success&details=Account%20Created
 */
export function parseDaResponse(responseString: string): DaResponse {
  try {
    const parsed = new URLSearchParams(responseString);
    const result: DaResponse = {
      error: parsed.get('error') === '1',
      text: parsed.get('text') || undefined,
      details: parsed.get('details') || undefined,
      data: {}
    };

    // Store the rest of the keys in data object
    for (const [key, value] of parsed.entries()) {
      if (key !== 'error' && key !== 'text' && key !== 'details') {
        result.data![key] = value;
      }
    }

    return result;
  } catch (error) {
    return { error: true, text: 'Parse Error', details: 'Could not parse DirectAdmin response' };
  }
}

async function requestDirectAdmin(
  endpoint: string,
  method: 'GET' | 'POST',
  params: Record<string, string>
): Promise<string> {
  if (!DA_PASSWORD) {
    throw new Error(
      'Credencial DirectAdmin ausente. Configure DIRECTADMIN_LOGIN_KEY ou DIRECTADMIN_PASSWORD no Vercel.'
    );
  }

  const url = new URL(`${DA_BASE}/${endpoint}`);
  const body = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (method === 'GET') url.searchParams.append(key, value);
    else body.append(key, value);
  });

  const bodyText = body.toString();
  const transport = url.protocol === 'http:' ? http : https;
  const headers: Record<string, string> = {
    Authorization: `Basic ${Buffer.from(`${DA_USER}:${DA_PASSWORD}`).toString('base64')}`,
  };

  if (method === 'POST') {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    headers['Content-Length'] = String(Buffer.byteLength(bodyText));
  }

  return new Promise((resolve, reject) => {
    const req = transport.request(
      {
        method,
        hostname: url.hostname,
        port: url.port,
        path: `${url.pathname}${url.search}`,
        headers,
        timeout: 30000,
        rejectUnauthorized: url.protocol === 'https:' ? DA_REJECT_UNAUTHORIZED : undefined,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
            reject(
              new Error(
                `${endpoint}: DirectAdmin HTTP ${res.statusCode || 0} - ${text.replace(/\s+/g, ' ').trim().substring(0, 300)}`
              )
            );
            return;
          }
          resolve(text);
        });
      }
    );

    req.on('timeout', () => req.destroy(new Error(`${endpoint}: ligação ao DirectAdmin expirou`)));
    req.on('error', (error: NodeJS.ErrnoException) => {
      reject(
        new Error(
          `${endpoint}: falha de ligação ao DirectAdmin (${error.code || error.name}) - ${error.message}`
        )
      );
    });

    if (method === 'POST') req.write(bodyText);
    req.end();
  });
}

/**
 * Makes a direct request to the DirectAdmin API.
 * 
 * @param endpoint The API command, e.g. 'CMD_API_POP'
 * @param method 'GET' | 'POST'
 * @param params Query parameters or POST body data
 */
export async function daRequest(
  endpoint: string,
  method: 'GET' | 'POST' = 'GET',
  params: Record<string, string> = {}
): Promise<DaResponse> {
  try {
    const textData = await requestDirectAdmin(endpoint, method, params);
    
    // Check if the response is JSON (some newer DA commands support json=yes parameter)
    if (params.json === 'yes' || textData.startsWith('{')) {
      try {
        const jsonData = JSON.parse(textData);
        // Normalize error flag
        if (jsonData.error !== undefined) {
           // DA returns error="0" string in some json responses
           jsonData.error = jsonData.error === "1" || jsonData.error === true;
        }
        return jsonData;
      } catch (e) {
        // Fallback to urlencoded parser
        return parseDaResponse(textData);
      }
    }

    return parseDaResponse(textData);
  } catch (error: any) {
    console.error('DirectAdmin API Error:', error);
    return {
      error: true,
      text: 'Connection Error',
      details: error.message || 'Failed to connect to DirectAdmin',
    };
  }
}

/**
 * Helper to execute commands specifically formatted for JSON responses
 * This is preferred for modern DirectAdmin APIs
 */
export async function daJsonRequest(
  endpoint: string,
  method: 'GET' | 'POST' = 'GET',
  params: Record<string, string> = {}
): Promise<any> {
  // Add json=yes to enforce JSON response from DirectAdmin
  const finalParams = { ...params, json: 'yes' };
  return daRequest(endpoint, method, finalParams);
}
