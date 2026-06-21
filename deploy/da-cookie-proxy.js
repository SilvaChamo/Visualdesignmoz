#!/usr/bin/env node
/**
 * Proxy HTTPS na porta pública do DirectAdmin.
 * Remove cookies grandes (painel/Supabase) antes de encaminhar — evita erro 500
 * "httpd header lentgh (4096) is too big".
 */
const fs = require('fs');
const https = require('https');
const httpProxy = require('http-proxy');

const LISTEN_HOST = process.env.DA_PROXY_LISTEN_HOST || '0.0.0.0';
const LISTEN_PORT = Number(process.env.DA_PROXY_PORT || 2026);
const TARGET = process.env.DA_PROXY_TARGET || 'https://127.0.0.1:2027';
const CERT = process.env.DA_PROXY_CERT || '/usr/local/directadmin/conf/ssl/server.crt';
const KEY = process.env.DA_PROXY_KEY || '/usr/local/directadmin/conf/ssl/server.key';

const BLOCKED_NAME = /^(sb-|__Secure-|__Host-)/i;
const BLOCKED_TOKEN = /supabase|auth-token|chunk/i;

function filterCookieHeader(raw) {
  if (!raw || typeof raw !== 'string') return '';
  const kept = raw
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => {
      const eq = part.indexOf('=');
      const name = (eq > 0 ? part.slice(0, eq) : part).trim();
      const value = eq > 0 ? part.slice(eq + 1) : '';
      if (!name) return false;
      if (BLOCKED_NAME.test(name)) return false;
      if (BLOCKED_TOKEN.test(name)) return false;
      if (value.length > 400) return false;
      return true;
    });
  return kept.join('; ');
}

const proxy = httpProxy.createProxyServer({
  target: TARGET,
  changeOrigin: true,
  secure: false,
  ws: true,
  xfwd: true,
});

proxy.on('proxyReq', (proxyReq, req) => {
  const filtered = filterCookieHeader(req.headers.cookie);
  if (filtered) proxyReq.setHeader('Cookie', filtered);
  else proxyReq.removeHeader('Cookie');
});

proxy.on('error', (err, req, res) => {
  console.error('[da-cookie-proxy]', err.message);
  if (res && !res.headersSent && typeof res.writeHead === 'function') {
    res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Proxy error');
  }
});

const server = https.createServer(
  {
    key: fs.readFileSync(KEY),
    cert: fs.readFileSync(CERT),
  },
  (req, res) => {
    proxy.web(req, res);
  },
);

server.on('upgrade', (req, socket, head) => {
  proxy.ws(req, socket, head);
});

server.listen(LISTEN_PORT, LISTEN_HOST, () => {
  console.log(`[da-cookie-proxy] ${LISTEN_HOST}:${LISTEN_PORT} -> ${TARGET}`);
});
