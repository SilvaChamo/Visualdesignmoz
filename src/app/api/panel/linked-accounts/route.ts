import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { requireAdminResellerOrManager, type PanelStaffAuthSuccess } from '@/lib/panel-api-auth';
import { resolvePanelDaContext } from '@/lib/panel-api-context';
import {
  clearEnteredLinkedAccount,
  invalidateLinkedAccountsCache,
  setEnteredLinkedAccount,
  type AccountScope,
} from '@/lib/linked-accounts';
import { buildAccountScopeSummary, checkNewLinkedAccount } from '@/lib/account-domain-limits';
import { LINKED_DOMAIN_ACCOUNT_PACKAGE } from '@/lib/account-levels';
import { sanitizeDaUsername } from '@/lib/reseller-provision';
import { getDaSyncAdmin } from '@/lib/da-sync-schema';
import { upsertMirrorSite, upsertMirrorUser } from '@/lib/panel-mirror-write';
import { HOSTING_DOMAIN_REGEX } from '@/lib/checkout-fulfillment';

export const dynamic = 'force-dynamic';

/**
 * Contas de domínio ligadas à conta principal (ver account-levels.ts):
 *   GET                      → nível, contas ligadas e domínios (sem segredos)
 *   POST { action: 'enter' } → Premium: entrar numa conta ligada com as credenciais dela
 *   POST { action: 'leave' } → voltar à conta principal
 *   POST { action: 'create'} → Premium/Enterprise: domínio novo com conta própria
 */

type ScopeResult = { scope: AccountScope; impersonating: boolean } | { error: NextResponse };

async function loadScope(auth: PanelStaffAuthSuccess): Promise<ScopeResult> {
  const ctx = await resolvePanelDaContext(auth);
  if (!ctx.accountScope) {
    return {
      error: NextResponse.json(
        { success: false, error: 'Esta sessão não tem uma conta de alojamento associada.' },
        { status: 400 },
      ),
    };
  }
  return { scope: ctx.accountScope, impersonating: Boolean(ctx.impersonating) };
}

export async function GET() {
  const auth = await requireAdminResellerOrManager();
  if ('error' in auth) return auth.error;
  const ctx = await resolvePanelDaContext(auth);
  if (!ctx.accountScope) return NextResponse.json({ success: true, data: null });
  const summary = await buildAccountScopeSummary(ctx.accountScope);
  return NextResponse.json({ success: true, data: summary });
}

// ── Tentativas de entrada (Premium) ──────────────────────────────────────────
// Cada tentativa confirma uma password no Hestia; limitar por login evita que
// a entrada sirva para adivinhar passwords das contas ligadas.
const ENTER_WINDOW_MS = 15 * 60_000;
const ENTER_MAX_ATTEMPTS = 5;
const enterAttempts = new Map<string, { count: number; since: number }>();

function tooManyAttempts(userId: string): boolean {
  const row = enterAttempts.get(userId);
  if (!row || Date.now() - row.since > ENTER_WINDOW_MS) return false;
  return row.count >= ENTER_MAX_ATTEMPTS;
}

function recordFailedAttempt(userId: string): void {
  const row = enterAttempts.get(userId);
  if (!row || Date.now() - row.since > ENTER_WINDOW_MS) {
    enterAttempts.set(userId, { count: 1, since: Date.now() });
  } else {
    row.count += 1;
  }
}

async function handleEnter(auth: PanelStaffAuthSuccess, body: Record<string, unknown>): Promise<NextResponse> {
  const loaded = await loadScope(auth);
  if ('error' in loaded) return loaded.error;
  const { scope, impersonating } = loaded;

  if (impersonating) {
    return NextResponse.json(
      { success: false, error: 'Como administrador, entre na conta directamente em Hospedagem → Contas.' },
      { status: 400 },
    );
  }
  if (scope.level !== 'premium') {
    return NextResponse.json(
      { success: false, error: 'Só no plano Premium se entra nas contas dos domínios com credenciais.' },
      { status: 400 },
    );
  }

  const username = String(body.username || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (!username || !password) {
    return NextResponse.json({ success: false, error: 'Indique o utilizador e a password da conta.' }, { status: 400 });
  }
  if (!scope.linked.some((row) => row.username === username)) {
    return NextResponse.json({ success: false, error: 'Esta conta não está ligada à sua.' }, { status: 403 });
  }
  if (tooManyAttempts(auth.user.id)) {
    return NextResponse.json(
      { success: false, error: 'Demasiadas tentativas. Aguarde 15 minutos e tente de novo.' },
      { status: 429 },
    );
  }

  const { checkUserPassword } = await import('@/lib/hestia-adapter');
  const check = await checkUserPassword(username, password);
  if (!check.ok) {
    recordFailedAttempt(auth.user.id);
    return NextResponse.json({ success: false, error: 'Utilizador ou password errados.' }, { status: 401 });
  }

  enterAttempts.delete(auth.user.id);
  const saved = await setEnteredLinkedAccount(auth.user.id, username);
  if (!saved) {
    return NextResponse.json(
      { success: false, error: 'O servidor não conseguiu guardar a entrada nesta conta.' },
      { status: 500 },
    );
  }
  return NextResponse.json({ success: true, entered: username });
}

// ── Criar domínio com conta própria ──────────────────────────────────────────

const RESERVED_USERNAMES = new Set([
  'admin', 'root', 'vdadmin', 'hestia', 'hestiaweb', 'www', 'www-data', 'mail', 'ftp', 'mysql',
  'postgres', 'nobody', 'backup', 'daemon', 'bin', 'sys', 'sync', 'user', 'default', 'system',
]);

async function pickFreeUsername(domain: string, skip: Set<string>): Promise<string | null> {
  const base = sanitizeDaUsername(domain.split('.')[0] || domain).slice(0, 16) || 'dominio';
  const { listUsers } = await import('@/lib/hestia-adapter');
  const hestiaUsers = new Set((await listUsers()).map((u) => u.username.toLowerCase()));
  hestiaUsers.add((process.env.HESTIA_USER || 'vdadmin').trim().toLowerCase());
  const sb = getDaSyncAdmin();
  const candidates = [base, ...Array.from({ length: 8 }, (_, i) => `${base}${i + 2}`)];
  for (const candidate of candidates) {
    if (skip.has(candidate) || RESERVED_USERNAMES.has(candidate) || hestiaUsers.has(candidate)) continue;
    if (sb) {
      const { data } = await sb.from('panel_users').select('username').eq('username', candidate).maybeSingle();
      if (data) continue;
    }
    return candidate;
  }
  return null;
}

function generateAccountPassword(): string {
  // Letras, números e um símbolo — o Hestia aceita, e fica fácil de copiar.
  return `${randomBytes(12).toString('base64url').slice(0, 14)}#${randomBytes(2).toString('hex')}`;
}

async function handleCreate(auth: PanelStaffAuthSuccess, body: Record<string, unknown>): Promise<NextResponse> {
  const loaded = await loadScope(auth);
  if ('error' in loaded) return loaded.error;
  const { scope } = loaded;

  const domain = String(body.domain || '').trim().toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
  if (!HOSTING_DOMAIN_REGEX.test(domain)) {
    return NextResponse.json({ success: false, error: 'Domínio inválido (ex.: exemplo.com).' }, { status: 400 });
  }

  const allowed = await checkNewLinkedAccount(scope, domain);
  if (!allowed.ok) return NextResponse.json({ success: false, error: allowed.error }, { status: 403 });

  const sb = getDaSyncAdmin();
  const { data: mainRow } = sb
    ? await sb.from('panel_users').select('email').eq('username', scope.main).maybeSingle()
    : { data: null };
  const email = String(mainRow?.email || auth.user.email || '').trim().toLowerCase();
  if (!email.includes('@')) {
    return NextResponse.json({ success: false, error: 'A conta principal não tem email de contacto.' }, { status: 400 });
  }

  const { createAccount } = await import('@/lib/hestia-adapter');
  const password = generateAccountPassword();
  let username: string | null = null;
  const tried = new Set<string>();
  // Até 3 nomes: se outro pedido ou uma conta de sistema já usar o nome, tenta o seguinte.
  for (let attempt = 0; attempt < 3 && !username; attempt++) {
    const candidate = await pickFreeUsername(domain, tried);
    if (!candidate) break;
    tried.add(candidate);
    const created = await createAccount({
      username: candidate,
      password,
      email,
      domain,
      packageName: LINKED_DOMAIN_ACCOUNT_PACKAGE,
      requireNewUser: true,
    });
    if (created.ok) {
      username = candidate;
    } else if (!created.userExists) {
      return NextResponse.json(
        { success: false, error: created.error || 'O servidor recusou criar a conta.' },
        { status: 502 },
      );
    }
  }
  if (!username) {
    return NextResponse.json(
      { success: false, error: 'Não foi possível encontrar um nome livre para a conta deste domínio.' },
      { status: 409 },
    );
  }

  await upsertMirrorUser({
    username,
    email,
    acl: 'user',
    parent_username: scope.main,
    package_name: LINKED_DOMAIN_ACCOUNT_PACKAGE,
    hosting_provider: 'hestia',
  });
  await upsertMirrorSite({ domain, owner: username, admin_email: email, package: LINKED_DOMAIN_ACCOUNT_PACKAGE });
  invalidateLinkedAccountsCache(scope.main);
  const { invalidateHestiaDomainCache } = await import('@/lib/hosting-resolver');
  invalidateHestiaDomainCache();
  const { scheduleHestiaSync } = await import('@/lib/hestia-sync-engine');
  scheduleHestiaSync(2000);

  // A password só é mostrada agora — no Premium é a chave para entrar nesta conta.
  return NextResponse.json({ success: true, account: { username, password, domain } });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminResellerOrManager();
  if ('error' in auth) return auth.error;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido.' }, { status: 400 });
  }

  const action = String(body.action || '');
  if (action === 'enter') return handleEnter(auth, body);
  if (action === 'create') return handleCreate(auth, body);
  if (action === 'leave') {
    await clearEnteredLinkedAccount();
    return NextResponse.json({ success: true });
  }
  return NextResponse.json({ success: false, error: 'Acção inválida.' }, { status: 400 });
}
