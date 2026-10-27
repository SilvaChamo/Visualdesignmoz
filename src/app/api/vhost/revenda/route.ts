import { NextRequest, NextResponse } from 'next/server';
import { requirePanelBootstrapAccess } from '@/lib/panel-api-auth';
import { getDaSyncAdmin } from '@/lib/da-sync-schema';
import { clientesDaRevenda } from '@/lib/vhost-revenda';
import { executeServerCommand } from '@/lib/server-ssh-exec';
import { ADMIN_PY } from '@/lib/vhost-admin-py';

export const dynamic = 'force-dynamic';

/**
 * /api/vhost/revenda — o que o menu Admin do revendedor lê e muda no servidor (Silva, 26/10/2026), sempre só na conta dele e nas dos
 * clientes que criou (panel_users.parent_username; ver src/lib/vhost-revenda.ts). Usa o mesmo script do servidor do Admin
 * (src/lib/vhost-admin-py.ts) mas só estas operações — tudo o resto continua em /api/vhost/admin-servidor, só do administrador.
 * GET  ?ver=ips           → os IPs partilhados e os que o servidor lhe atribuiu
 * GET  ?ver=security-txt  → o security.txt de cada domínio dos clientes
 * POST { acao: 'ns-conta', contas, ns }   → mudar os nameservers de contas suas
 */
const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64');
const HOST = /^(?=.{3,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
const CONTA = /^[a-z0-9][a-z0-9_.-]{0,31}$/;

async function noServidorAdmin(arg: Record<string, unknown>, timeoutMs = 120_000): Promise<Record<string, unknown> | null> {
  const out = await executeServerCommand(`python3 -c "$(echo ${b64(ADMIN_PY)} | base64 -d)" ${b64(JSON.stringify(arg))} 2>&1`, { timeoutMs });
  const l = out.split('\n').reverse().find((x) => x.trim().startsWith('{'));
  try {
    return l ? (JSON.parse(l) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Só o revendedor; devolve a conta dele e as dos clientes que criou */
async function soRevendedor() {
  const auth = await requirePanelBootstrapAccess();
  if ('error' in auth) return { erro: NextResponse.json({ erro: 'Inicie sessão no site.' }, { status: 401 }) };
  if (auth.user.role !== 'reseller') return { erro: NextResponse.json({ erro: 'Só o revendedor vê esta página.' }, { status: 403 }) };
  const sb = getDaSyncAdmin();
  if (!sb) return { erro: NextResponse.json({ erro: 'Registo do site indisponível.' }, { status: 503 }) };
  const meus = await clientesDaRevenda(sb, auth.user.id);
  if (!meus.eu) return { erro: NextResponse.json({ erro: 'A sua conta do site ainda não está ligada a uma conta do servidor.' }, { status: 403 }) };
  return { eu: meus.eu, contas: new Set([meus.eu, ...meus.contas]) };
}

export async function GET(req: NextRequest) {
  const q = await soRevendedor();
  if ('erro' in q) return q.erro;
  const ver = req.nextUrl.searchParams.get('ver') || '';
  const sem = { headers: { 'Cache-Control': 'no-store' } };
  try {
    if (ver === 'ips') {
      const r = await noServidorAdmin({ ver: 'ips' });
      if (!r) return NextResponse.json({ erro: 'O servidor não respondeu.' }, { status: 502 });
      type Ip = { ip: string; dono: string; estado: string; nome: string; nat: string; interface: string; mascara: string; contas: number; dominios: number };
      const ips = ((r.ips as Ip[]) || [])
        .filter((i) => i.estado === 'shared' || String(i.dono).toLowerCase() === q.eu)
        // os números de contas e sites contam o servidor inteiro: só se mostram nos IPs que são da revenda
        .map((i) => (String(i.dono).toLowerCase() === q.eu ? i : { ip: i.ip, dono: '', estado: i.estado, nome: i.nome, nat: i.nat, interface: i.interface, mascara: i.mascara, contas: 0, dominios: 0 }));
      return NextResponse.json({ ips }, sem);
    }
    if (ver === 'security-txt') {
      const r = await noServidorAdmin({ ver: 'security-txt' });
      if (!r) return NextResponse.json({ erro: 'O servidor não respondeu.' }, { status: 502 });
      const dominios = ((r.dominios as { conta: string; dominio: string; texto: string }[]) || []).filter((d) => q.contas.has(String(d.conta).toLowerCase()));
      return NextResponse.json({ dominios }, sem);
    }
  } catch {
    return NextResponse.json({ erro: 'Sem ligação ao servidor.' }, { status: 502 });
  }
  return NextResponse.json({ erro: 'Página desconhecida.' }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const q = await soRevendedor();
  if ('erro' in q) return q.erro;
  const c = (await req.json().catch(() => ({}))) as { acao?: unknown; contas?: unknown; ns?: unknown };
  if (c.acao !== 'ns-conta') return NextResponse.json({ erro: 'Ação desconhecida.' }, { status: 400 });
  const contas = [...new Set((Array.isArray(c.contas) ? c.contas : []).map((x) => String(x).toLowerCase()))].slice(0, 500);
  const ns = (Array.isArray(c.ns) ? c.ns : []).map((x) => String(x).trim().toLowerCase()).filter(Boolean);
  if (!contas.length) return NextResponse.json({ erro: 'Escolha as contas.' }, { status: 400 });
  // só a conta do revendedor e as dos clientes que criou
  if (!contas.every((u) => CONTA.test(u) && q.contas.has(u))) return NextResponse.json({ erro: 'Só pode mudar os nameservers das suas contas.' }, { status: 403 });
  if (ns.length < 2 || ns.length > 8 || !ns.every((x) => HOST.test(x))) return NextResponse.json({ erro: 'Escreva pelo menos dois servidores de nomes válidos.' }, { status: 400 });
  try {
    const r = await noServidorAdmin({ acao: 'ns-conta', contas, ns }, 180_000);
    if (!r) return NextResponse.json({ erro: 'O servidor não respondeu.' }, { status: 502 });
    return r.ok === false ? NextResponse.json({ erro: String(r.erro || 'Não foi possível.') }, { status: 400 }) : NextResponse.json(r);
  } catch {
    return NextResponse.json({ erro: 'Sem ligação ao servidor.' }, { status: 502 });
  }
}
