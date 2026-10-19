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
const TEMA = /^[a-z0-9_-]{1,40}$/i;
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
  const [acessos, temas] = await Promise.all([ler(), lerTemas()]);
  return NextResponse.json({ acessos, temas });
}

export async function POST(req: NextRequest) {
  const auth = await requirePanelBootstrapAccess();
  if ('error' in auth) return NextResponse.json({ erro: 'Inicie sessão.' }, { status: 401 });
  if (auth.user.role !== 'admin') return NextResponse.json({ erro: 'Só o administrador muda os acessos dos planos.' }, { status: 403 });
  const c = (await req.json().catch(() => ({}))) as { acessos?: unknown; temas?: unknown };
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
