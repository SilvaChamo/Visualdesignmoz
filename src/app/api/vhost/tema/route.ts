import { NextRequest, NextResponse } from 'next/server';
import { requirePanelBootstrapAccess } from '@/lib/panel-api-auth';
import { executeServerCommand } from '@/lib/server-ssh-exec';
import { VHOST_DIR } from '@/lib/vhost-email-scripts';

export const dynamic = 'force-dynamic';

/**
 * /api/vhost/tema — cores do site inteiro, escolhidas pelo administrador no Personalizar do painel (pedido do Silva a
 * 11/10: "ao mudar aqui, todo o site deve tomar as configurações"). Guardadas no servidor em VHOST_DIR/tema-site.json.
 * GET  (público)        { tema: { preset, customPrimary, over, radius, vars } | null }  — vars: variáveis CSS do site
 * POST (só admin)       { preset, customPrimary, over, radius, vars }  ·  { limpar: true } volta às cores de origem
 */
type Tema = { preset: string; customPrimary?: string; over?: Record<string, string>; radius?: string; vars: Record<string, string> };
const FICHEIRO = `${VHOST_DIR}/tema-site.json`;
const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64');
const HEX = /^#[0-9a-f]{6}$/i;
const COMPONENTES = ['primary', 'safe', 'danger', 'warning', 'railBg', 'railInk', 'botoes'];
// só as variáveis do vermelho do site (Tailwind) e a cor de destaque podem ser mudadas
const VAR = /^--(color-red-(50|[1-9]00|950)|panel-accent)$/;

let guardado: { tema: Tema | null; ate: number } | null = null;

async function ler(): Promise<Tema | null> {
  if (guardado && guardado.ate > Date.now()) return guardado.tema;
  const out = await executeServerCommand(`cat ${FICHEIRO} 2>/dev/null`, { timeoutMs: 20_000 }).catch(() => '');
  let tema: Tema | null = null;
  try {
    tema = out.trim() ? (JSON.parse(out) as Tema) : null;
  } catch {}
  guardado = { tema, ate: Date.now() + 60_000 };
  return tema;
}

export async function GET() {
  return NextResponse.json({ tema: await ler() }, { headers: { 'Cache-Control': 'public, max-age=30' } });
}

export async function POST(req: NextRequest) {
  const auth = await requirePanelBootstrapAccess();
  if ('error' in auth) return NextResponse.json({ erro: 'Inicie sessão.' }, { status: 401 });
  if (auth.user.role !== 'admin') return NextResponse.json({ erro: 'Só o administrador muda as cores do site.' }, { status: 403 });
  const c = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (c.limpar) {
    await executeServerCommand(`rm -f ${FICHEIRO}`, { timeoutMs: 20_000 });
    guardado = { tema: null, ate: Date.now() + 60_000 };
    return NextResponse.json({ ok: true });
  }
  const preset = String(c.preset || '');
  if (!/^[a-z0-9_-]{1,40}$/i.test(preset)) return NextResponse.json({ erro: 'Tema inválido.' }, { status: 400 });
  const tema: Tema = { preset, vars: {} };
  if (typeof c.customPrimary === 'string' && HEX.test(c.customPrimary)) tema.customPrimary = c.customPrimary.toUpperCase();
  if (typeof c.radius === 'string' && /^\d{1,2}px$/.test(c.radius)) tema.radius = c.radius;
  if (c.over && typeof c.over === 'object') {
    tema.over = Object.fromEntries(Object.entries(c.over as Record<string, unknown>).filter(([k, v]) => COMPONENTES.includes(k) && typeof v === 'string' && HEX.test(v)) as [string, string][]);
  }
  if (c.vars && typeof c.vars === 'object') {
    tema.vars = Object.fromEntries(Object.entries(c.vars as Record<string, unknown>).filter(([k, v]) => VAR.test(k) && typeof v === 'string' && HEX.test(v)) as [string, string][]);
  }
  await executeServerCommand(`mkdir -p ${VHOST_DIR} && chmod 700 ${VHOST_DIR} && echo ${b64(JSON.stringify(tema))} | base64 -d > ${FICHEIRO}.tmp && chmod 600 ${FICHEIRO}.tmp && mv ${FICHEIRO}.tmp ${FICHEIRO}`, { timeoutMs: 20_000 });
  guardado = { tema, ate: Date.now() + 60_000 };
  return NextResponse.json({ ok: true });
}
