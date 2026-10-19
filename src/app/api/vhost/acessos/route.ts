import { NextRequest, NextResponse } from 'next/server';
import { requirePanelBootstrapAccess } from '@/lib/panel-api-auth';
import { executeServerCommand } from '@/lib/server-ssh-exec';
import { VHOST_DIR } from '@/lib/vhost-email-scripts';

export const dynamic = 'force-dynamic';

/**
 * /api/vhost/acessos — Admin › Acessos por plano (pedido do Silva, 15/10/2026): para cada pacote, as páginas da Gestão
 * (barra lateral) que os clientes desse plano não vêem. Guardado no servidor em VHOST_DIR/acessos-planos.json, como as
 * cores do site (/api/vhost/tema).
 * GET  (sessão do painel)  { acessos: { [pacote]: string[] }, temas: { [pacote]: tema } }
 * POST (só admin)          { acessos?: { [pacote]: string[] }, temas?: { [pacote]: tema } } — temas junta-se ao que há
 * Tema do plano (Admin › Pacotes › Tema): o tema do painel das contas desse plano que ainda não escolheram outro.
 */
type Acessos = Record<string, string[]>;
const FICHEIRO = `${VHOST_DIR}/acessos-planos.json`;
const FICHEIRO_TEMAS = `${VHOST_DIR}/temas-planos.json`;
const FICHEIRO_EXTRAS = `${VHOST_DIR}/extras-planos.json`;
const TEMA = /^[a-z0-9_-]{1,40}$/i;
const CHAVE = /^[a-z0-9_]{1,30}$/;
type LimExtra = { v: string; unl: boolean; unit?: 'MB' | 'GB' | 'TB' };
type Extras = Record<string, { lim: Record<string, LimExtra>; feats: Record<string, boolean>; rec: Record<string, LimExtra>; idioma?: string; acme?: string }>;
let extrasGuardados: { extras: Extras; ate: number } | null = null;
function limparLims(v: unknown): Record<string, LimExtra> {
  const r: Record<string, LimExtra> = {};
  if (!v || typeof v !== 'object') return r;
  for (const [k, l] of Object.entries(v as Record<string, unknown>)) {
    const x = l as { v?: unknown; unl?: unknown; unit?: unknown };
    if (!CHAVE.test(k) || !x || typeof x.v !== 'string' || x.v.length > 20 || typeof x.unl !== 'boolean') continue;
    r[k] = { v: x.v, unl: x.unl, ...(x.unit === 'MB' || x.unit === 'GB' || x.unit === 'TB' ? { unit: x.unit } : {}) };
  }
  return r;
}
function limparExtras(v: unknown): Extras {
  const r: Extras = {};
  if (!v || typeof v !== 'object') return r;
  for (const [p, e] of Object.entries(v as Record<string, unknown>)) {
    const x = e as { lim?: unknown; feats?: unknown; rec?: unknown; idioma?: unknown; acme?: unknown };
    if (!NOME.test(p) || !x || typeof x !== 'object') continue;
    const feats: Record<string, boolean> = {};
    if (x.feats && typeof x.feats === 'object')
      for (const [k, b] of Object.entries(x.feats as Record<string, unknown>)) if (CHAVE.test(k) && typeof b === 'boolean') feats[k] = b;
    const texto = (t: unknown) => (typeof t === 'string' && /^[\p{L}0-9 '.()-]{1,40}$/u.test(t) ? t : undefined);
    r[p] = { lim: limparLims(x.lim), feats, rec: limparLims(x.rec), ...(texto(x.idioma) ? { idioma: texto(x.idioma) } : {}), ...(texto(x.acme) ? { acme: texto(x.acme) } : {}) };
  }
  return r;
}
async function lerExtras(): Promise<Extras> {
  if (extrasGuardados && extrasGuardados.ate > Date.now()) return extrasGuardados.extras;
  const out = await executeServerCommand(`cat ${FICHEIRO_EXTRAS} 2>/dev/null`, { timeoutMs: 20_000 }).catch(() => '');
  let extras: Extras = {};
  try {
    extras = out.trim() ? limparExtras(JSON.parse(out)) : {};
  } catch {}
  extrasGuardados = { extras, ate: Date.now() + 60_000 };
  return extras;
}
let temasGuardados: { temas: Record<string, string>; ate: number } | null = null;
async function lerTemas(): Promise<Record<string, string>> {
  if (temasGuardados && temasGuardados.ate > Date.now()) return temasGuardados.temas;
  const out = await executeServerCommand(`cat ${FICHEIRO_TEMAS} 2>/dev/null`, { timeoutMs: 20_000 }).catch(() => '');
  let temas: Record<string, string> = {};
  try {
    temas = out.trim() ? limparTemas(JSON.parse(out)) : {};
  } catch {}
  temasGuardados = { temas, ate: Date.now() + 60_000 };
  return temas;
}
function limparTemas(v: unknown): Record<string, string> {
  if (!v || typeof v !== 'object') return {};
  return Object.fromEntries(Object.entries(v as Record<string, unknown>).filter(([p, t]) => NOME.test(p) && typeof t === 'string' && TEMA.test(t))) as Record<string, string>;
}
const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64');
const NOME = /^[A-Za-z0-9_.-]{1,60}$/;
const ID = /^[a-z0-9-]{1,40}$/;

let guardado: { acessos: Acessos; ate: number } | null = null;

async function ler(): Promise<Acessos> {
  if (guardado && guardado.ate > Date.now()) return guardado.acessos;
  const out = await executeServerCommand(`cat ${FICHEIRO} 2>/dev/null`, { timeoutMs: 20_000 }).catch(() => '');
  let acessos: Acessos = {};
  try {
    acessos = out.trim() ? limpar(JSON.parse(out)) : {};
  } catch {}
  guardado = { acessos, ate: Date.now() + 60_000 };
  return acessos;
}

function limpar(v: unknown): Acessos {
  if (!v || typeof v !== 'object') return {};
  const r: Acessos = {};
  for (const [p, ids] of Object.entries(v as Record<string, unknown>)) {
    if (!NOME.test(p) || !Array.isArray(ids)) continue;
    const lista = [...new Set(ids.map(String).filter((id) => ID.test(id)))];
    if (lista.length) r[p] = lista;
  }
  return r;
}

export async function GET() {
  const auth = await requirePanelBootstrapAccess();
  if ('error' in auth) return NextResponse.json({ erro: 'Inicie sessão.' }, { status: 401 });
  const [acessos, temas, extras] = await Promise.all([ler(), lerTemas(), lerExtras()]);
  return NextResponse.json({ acessos, temas, extras });
}

export async function POST(req: NextRequest) {
  const auth = await requirePanelBootstrapAccess();
  if ('error' in auth) return NextResponse.json({ erro: 'Inicie sessão.' }, { status: 401 });
  if (auth.user.role !== 'admin') return NextResponse.json({ erro: 'Só o administrador muda os acessos dos planos.' }, { status: 403 });
  const c = (await req.json().catch(() => ({}))) as { acessos?: unknown; temas?: unknown; extras?: unknown };
  if (c.extras !== undefined) {
    const extras = { ...(await lerExtras()), ...limparExtras(c.extras) };
    await executeServerCommand(
      `mkdir -p ${VHOST_DIR} && chmod 700 ${VHOST_DIR} && echo ${b64(JSON.stringify(extras))} | base64 -d > ${FICHEIRO_EXTRAS}.tmp && chmod 600 ${FICHEIRO_EXTRAS}.tmp && mv ${FICHEIRO_EXTRAS}.tmp ${FICHEIRO_EXTRAS}`,
      { timeoutMs: 20_000 },
    );
    extrasGuardados = { extras, ate: Date.now() + 60_000 };
    if (c.temas === undefined && c.acessos === undefined) return NextResponse.json({ ok: true, extras });
  }
  if (c.temas !== undefined) {
    const temas = { ...(await lerTemas()), ...limparTemas(c.temas) };
    await executeServerCommand(
      `mkdir -p ${VHOST_DIR} && chmod 700 ${VHOST_DIR} && echo ${b64(JSON.stringify(temas))} | base64 -d > ${FICHEIRO_TEMAS}.tmp && chmod 600 ${FICHEIRO_TEMAS}.tmp && mv ${FICHEIRO_TEMAS}.tmp ${FICHEIRO_TEMAS}`,
      { timeoutMs: 20_000 },
    );
    temasGuardados = { temas, ate: Date.now() + 60_000 };
    if (c.acessos === undefined) return NextResponse.json({ ok: true, temas });
  }
  const acessos = limpar(c.acessos);
  await executeServerCommand(
    `mkdir -p ${VHOST_DIR} && chmod 700 ${VHOST_DIR} && echo ${b64(JSON.stringify(acessos))} | base64 -d > ${FICHEIRO}.tmp && chmod 600 ${FICHEIRO}.tmp && mv ${FICHEIRO}.tmp ${FICHEIRO}`,
    { timeoutMs: 20_000 },
  );
  guardado = { acessos, ate: Date.now() + 60_000 };
  return NextResponse.json({ ok: true, acessos });
}
