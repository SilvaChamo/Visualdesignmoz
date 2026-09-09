import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import crypto from 'node:crypto';

function loadEnv(file) {
  const text = readFileSync(file, 'utf8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv(resolve(process.cwd(), '.env.local'));

function isTest(domain) {
  const d = domain.trim().toLowerCase();
  return /^vdtsh[a-z0-9]+\./i.test(d) || /^vdtest[-_]/i.test(d) || /^claude-[a-z0-9-]+-\d{10,}\./i.test(d);
}

function alreadyGone(error) {
  const t = String(error || '').toLowerCase();
  return /not found|not exist|doesn't exist|no such|unknown domain/.test(t);
}

const env = (process.env.DYNADOT_ENV || 'sandbox').trim().toLowerCase();
const apiKey = env === 'production' ? process.env.DYNADOT_API_KEY : process.env.DYNADOT_SANDBOX_API_KEY;
const secretKey = env === 'production' ? process.env.DYNADOT_SECRET_KEY : process.env.DYNADOT_SANDBOX_SECRET_KEY;
const restBase = env === 'production' ? 'https://api.dynadot.com' : 'https://api-sandbox.dynadot.com';
const api3 = env === 'production' ? 'https://api.dynadot.com/api3.json' : 'https://api-sandbox.dynadot.com/api3.json';

async function dynadotRest(method, path, body) {
  const bodyStr = body ? JSON.stringify(body) : '';
  const requestId = crypto.randomUUID();
  const signature = crypto
    .createHmac('sha256', secretKey)
    .update(`${apiKey}\n${path}\n${requestId}\n${bodyStr}`)
    .digest('hex');
  const headers = {
    Accept: 'application/json',
    Authorization: `Bearer ${apiKey}`,
    'X-Request-ID': requestId,
    'X-Signature': signature,
  };
  if (bodyStr) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${restBase}${path}`, { method, headers, body: bodyStr || undefined });
  const json = await res.json().catch(() => ({}));
  if (json.code !== 200) {
    return { ok: false, error: json.error?.description || json.message || `código ${json.code}` };
  }
  return { ok: true, data: json.data || {} };
}

async function dynadotApi3(command, params) {
  const qs = new URLSearchParams({ key: apiKey, command, ...params });
  const res = await fetch(`${api3}?${qs}`);
  const json = await res.json().catch(() => ({}));
  const key = Object.keys(json).find((k) => /Response$/.test(k));
  const resp = key ? json[key] : json.Response;
  if (!resp) return { ok: false, error: 'resposta inesperada' };
  if (String(resp.ResponseCode) !== '0' && String(resp.Status || '').toLowerCase() !== 'success') {
    return { ok: false, error: resp.Error || `código ${resp.ResponseCode}` };
  }
  return { ok: true, data: resp };
}

function cfHeaders() {
  const email = process.env.CLOUDFLARE_EMAIL?.trim();
  const globalKey = process.env.CLOUDFLARE_GLOBAL_API_KEY?.trim();
  if (email && globalKey) {
    return { 'X-Auth-Email': email, 'X-Auth-Key': globalKey, 'Content-Type': 'application/json' };
  }
  const token = process.env.CLOUDFLARE_API_TOKEN_ACCOUNT?.trim();
  if (token) return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  return null;
}

async function supabase(path, init = {}) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const res = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) return { ok: false, error: typeof data === 'string' ? data : JSON.stringify(data) };
  return { ok: true, data };
}

async function hestiaDelete(owner, domain) {
  const host = process.env.HESTIA_HOST?.trim();
  const port = process.env.HESTIA_PORT?.trim() || '8083';
  const user = process.env.HESTIA_USER?.trim() || 'vdadmin';
  const password = process.env.HESTIA_PASSWORD?.trim();
  if (!host || !password) return { ok: false, error: 'Hestia não configurado' };
  const body = new URLSearchParams({
    user,
    password,
    cmd: 'v-delete-web-domain',
    arg1: owner,
    arg2: domain,
  });
  const res = await fetch(`https://${host}:${port}/api/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const exit = res.headers.get('Hestia-Exit-Code');
  const output = await res.text();
  if (exit && exit !== '0') return { ok: false, error: output || `exit ${exit}` };
  return { ok: true };
}

const names = new Set();
const listed = await dynadotRest('GET', '/restful/v1/domains');
if (!listed.ok) {
  console.error('Falha a listar no registador:', listed.error);
} else {
  for (const item of listed.data.domainInfo || []) {
    const domain = String(item.domainName || '').toLowerCase();
    if (isTest(domain)) names.add(domain);
  }
}

for (const table of [
  ['panel_sites', 'domain'],
  ['domain_renewals', 'domain_name'],
  ['hosting_renewals', 'domain_name'],
]) {
  const rows = await supabase(`${table[0]}?select=${table[1]}`);
  if (rows.ok && Array.isArray(rows.data)) {
    for (const row of rows.data) {
      const domain = String(row[table[1]] || '').toLowerCase();
      if (isTest(domain)) names.add(domain);
    }
  }
}

const deleted = [];
const errors = [];
const cf = cfHeaders();

console.log(`A apagar ${names.size} domínio(s) de teste…`);

for (const domain of [...names].sort()) {
  await dynadotApi3('set_privacy', { domain, whois_privacy_option: 'no', option: 'off' });
  const del = await dynadotApi3('delete', { domain });
  if (!del.ok && !alreadyGone(del.error)) errors.push(`${domain} (registador): ${del.error}`);

  if (cf) {
    const zoneRes = await fetch(`https://api.cloudflare.com/client/v4/zones?name=${encodeURIComponent(domain)}`, { headers: cf });
    const zoneJson = await zoneRes.json().catch(() => ({}));
    const zoneId = zoneJson.result?.[0]?.id;
    if (zoneId) {
      const rm = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}`, { method: 'DELETE', headers: cf });
      if (!rm.ok) errors.push(`${domain} (cloudflare): HTTP ${rm.status}`);
    }
  }

  const site = await supabase(`panel_sites?domain=eq.${encodeURIComponent(domain)}&select=owner`);
  const owner = site.ok && Array.isArray(site.data) && site.data[0]?.owner;
  if (owner) {
    const host = await hestiaDelete(owner, domain);
    if (!host.ok && !alreadyGone(host.error)) errors.push(`${domain} (servidor): ${host.error}`);
  }

  await supabase(`panel_sites?domain=eq.${encodeURIComponent(domain)}`, { method: 'DELETE' });
  await supabase(`panel_emails?domain=eq.${encodeURIComponent(domain)}`, { method: 'DELETE' });
  await supabase(`panel_subdomains?domain=eq.${encodeURIComponent(domain)}`, { method: 'DELETE' });
  await supabase(`panel_databases?domain=eq.${encodeURIComponent(domain)}`, { method: 'DELETE' });
  await supabase(`panel_ftp?domain=eq.${encodeURIComponent(domain)}`, { method: 'DELETE' });
  await supabase(`panel_dns?domain=eq.${encodeURIComponent(domain)}`, { method: 'DELETE' });
  await supabase(`domain_renewals?domain_name=eq.${encodeURIComponent(domain)}`, { method: 'DELETE' });
  await supabase(`hosting_renewals?domain_name=eq.${encodeURIComponent(domain)}`, { method: 'DELETE' });

  if (del.ok || alreadyGone(del.error)) deleted.push(domain);
  else deleted.push(`${domain} (painel limpo; registador falhou)`);
  console.log('—', domain, del.ok ? 'apagado' : del.error);
}

console.log(JSON.stringify({ deleted, errors }, null, 2));
if (errors.length) process.exitCode = 1;
