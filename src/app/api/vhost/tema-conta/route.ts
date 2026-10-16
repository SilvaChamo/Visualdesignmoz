import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { donoDaConta } from '@/lib/vhost-conta-cliente';
import { requirePanelBootstrapAccess } from '@/lib/panel-api-auth';
import { executeServerCommand } from '@/lib/server-ssh-exec';
import { VHOST_DIR } from '@/lib/vhost-email-scripts';

export const dynamic = 'force-dynamic';

type TemaConta = {
  theme: 'light' | 'dark';
  colorPreset: string;
  customPrimary: string;
  themeOver: Record<string, Record<string, string>>;
  radius: string;
  brand: { name: string; logo: string };
};

const HEX = /^#[0-9a-f]{6}$/i;
const PRESET = /^[a-z0-9_-]{1,40}$/i;
const CORES = ['primary', 'safe', 'danger', 'warning', 'railBg', 'railInk', 'botoes'];
const b64 = (value: string) => Buffer.from(value, 'utf8').toString('base64');
const quote = (value: string) => `'${value.replace(/'/g, "'\\''")}'`;

function lerTema(valor: unknown): TemaConta | null {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return null;
  const v = valor as Record<string, unknown>;
  if (v.theme !== 'light' && v.theme !== 'dark') return null;
  if (typeof v.colorPreset !== 'string' || !PRESET.test(v.colorPreset)) return null;
  if (typeof v.customPrimary !== 'string' || (v.customPrimary && !HEX.test(v.customPrimary))) return null;
  if (typeof v.radius !== 'string' || !/^\d{1,2}px$/.test(v.radius)) return null;
  if (!v.brand || typeof v.brand !== 'object' || Array.isArray(v.brand)) return null;
  const brand = v.brand as Record<string, unknown>;
  if (typeof brand.name !== 'string' || brand.name.length > 120) return null;
  if (typeof brand.logo !== 'string' || brand.logo.length > 300_000) return null;

  const themeOver: TemaConta['themeOver'] = {};
  if (v.themeOver && typeof v.themeOver === 'object' && !Array.isArray(v.themeOver)) {
    for (const [preset, values] of Object.entries(v.themeOver as Record<string, unknown>)) {
      if (!PRESET.test(preset) || !values || typeof values !== 'object' || Array.isArray(values)) continue;
      const cores = Object.fromEntries(
        Object.entries(values as Record<string, unknown>).filter(
          ([key, color]) => CORES.includes(key) && typeof color === 'string' && HEX.test(color),
        ),
      ) as Record<string, string>;
      if (Object.keys(cores).length) themeOver[preset] = cores;
    }
  }

  return {
    theme: v.theme,
    colorPreset: v.colorPreset,
    customPrimary: v.customPrimary.toUpperCase(),
    themeOver,
    radius: v.radius,
    brand: { name: brand.name, logo: brand.logo },
  };
}

async function contaAlvo(conta: string | null) {
  const auth = await requirePanelBootstrapAccess();
  if ('error' in auth) return { erro: auth.error };

  let chave = 'uid-' + auth.user.id;
  if (conta) {
    if (auth.user.role !== 'admin' && auth.user.role !== 'reseller') {
      return { erro: NextResponse.json({ erro: 'Sem permissão para esta conta.' }, { status: 403 }) };
    }
    const dono = await donoDaConta(conta);
    if ('erro' in dono) return { erro: dono.erro };
    chave = dono.uid ? 'uid-' + dono.uid : 'conta-' + dono.conta;
  }

  const diretorio = `${VHOST_DIR}/temas-conta`;
  return { ficheiro: `${diretorio}/${chave}.json`, diretorio };
}

export async function GET(req: NextRequest) {
  const conta = req.nextUrl.searchParams.get('conta');
  const alvo = await contaAlvo(conta);
  if ('erro' in alvo) return alvo.erro;

  try {
    const guardado = await executeServerCommand(
      `if [ -f ${quote(alvo.ficheiro)} ]; then cat ${quote(alvo.ficheiro)}; fi`,
      { timeoutMs: 20_000 },
    );
    if (!guardado.trim()) {
      return NextResponse.json({ preferencias: null }, { headers: { 'Cache-Control': 'no-store' } });
    }
    let dados: unknown;
    try {
      dados = JSON.parse(guardado);
    } catch {
      console.error('[vhost/tema-conta] O ficheiro de preferências não contém JSON válido.');
      return NextResponse.json({ erro: 'As preferências de tema guardadas estão inválidas.' }, { status: 500 });
    }
    const preferencias = lerTema(dados);
    if (!preferencias) {
      return NextResponse.json({ erro: 'As preferências de tema guardadas estão inválidas.' }, { status: 500 });
    }
    return NextResponse.json({ preferencias }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (erro) {
    console.error('[vhost/tema-conta] Não foi possível ler as preferências da conta.', erro);
    return NextResponse.json({ erro: 'Não foi possível ler as preferências da conta.' }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ erro: 'Pedido inválido.' }, { status: 400 });
  }
  if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) {
    return NextResponse.json({ erro: 'Pedido inválido.' }, { status: 400 });
  }
  const c = corpo as Record<string, unknown>;
  if (c.conta !== undefined && typeof c.conta !== 'string') {
    return NextResponse.json({ erro: 'Conta inválida.' }, { status: 400 });
  }
  const preferencias = lerTema(c.preferencias);
  if (!preferencias) {
    return NextResponse.json({ erro: 'Preferências de tema inválidas.' }, { status: 400 });
  }
  const conta = typeof c.conta === 'string' ? c.conta : null;
  const alvo = await contaAlvo(conta);
  if ('erro' in alvo) return alvo.erro;

  try {
    const ficheiroTemp = alvo.ficheiro + '.' + randomUUID() + '.tmp';
    await executeServerCommand(
      `mkdir -p ${quote(alvo.diretorio)} && chmod 700 ${quote(alvo.diretorio)} && printf '%s' '${b64(JSON.stringify(preferencias))}' | base64 -d > ${quote(ficheiroTemp)} && chmod 600 ${quote(ficheiroTemp)} && mv ${quote(ficheiroTemp)} ${quote(alvo.ficheiro)}`,
      { timeoutMs: 20_000 },
    );
  } catch (erro) {
    console.error('[vhost/tema-conta] Não foi possível guardar as preferências.', erro);
    return NextResponse.json({ erro: 'Não foi possível guardar as preferências da conta.' }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}
