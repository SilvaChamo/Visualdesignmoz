/**
 * Teste SMTP Brevo — visualdesignmoz.com
 * Uso: node scripts/test-email.mjs destino@gmail.com
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import nodemailer from 'nodemailer';

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

const root = resolve(import.meta.dirname, '..');
loadEnvFile(resolve(root, '.env.local'));
loadEnvFile(resolve(root, '.env'));

const to = process.argv[2]?.trim();
const from =
  process.env.SITE_EMAIL_FROM?.trim() || 'Visualdesign <noreply@visualdesignmoz.com>';

const host = process.env.SMTP_HOST || process.env.DA_SMTP_HOST || 'smtp-relay.brevo.com';
const port = Number.parseInt(process.env.SMTP_PORT || process.env.DA_SMTP_PORT || '587', 10);
const user = process.env.SMTP_USER || process.env.DA_SMTP_USER || '';
const pass =
  process.env.SMTP_PASS ||
  process.env.DA_SMTP_PASS ||
  process.env.SMTP_MASTER_PASSWORD ||
  '';

if (!to) {
  console.error('Uso: node scripts/test-email.mjs destino@gmail.com');
  process.exit(1);
}

if (!user || !pass) {
  console.error('Defina SMTP_USER e SMTP_PASS (ou DA_SMTP_*) no .env.local');
  process.exit(1);
}

console.log(`A testar Brevo como ${user} @ ${host}:${port} …`);
console.log(`From: ${from}`);

const transporter = nodemailer.createTransport({
  host,
  port,
  secure: false,
  requireTLS: port === 587,
  auth: { user, pass },
});

try {
  await transporter.verify();
  console.log('Ligação SMTP OK');
} catch (error) {
  console.error('Falha SMTP:', error instanceof Error ? error.message : error);
  process.exit(1);
}

const info = await transporter.sendMail({
  from,
  to,
  subject: 'Teste Visualdesign — Brevo SMTP',
  text: 'Se recebeu isto, o Brevo está configurado correctamente.',
  html: '<p>Se recebeu isto, o <strong>Brevo</strong> está configurado correctamente.</p>',
});

console.log('Enviado:', info.messageId || info.response);
