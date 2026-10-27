import { NextRequest, NextResponse } from 'next/server';
import dns from 'dns/promises';
import net from 'net';
import { Client } from 'ssh2';
import { requirePanelBootstrapAccess } from '@/lib/panel-api-auth';
import { getDaSyncAdmin } from '@/lib/da-sync-schema';
import { clientesDaRevenda } from '@/lib/vhost-revenda';
import { executeServerCommand } from '@/lib/server-ssh-exec';
import { ADMIN_PY } from '@/lib/vhost-admin-py';
import { VHOST_DIR } from '@/lib/vhost-email-scripts';

export const dynamic = 'force-dynamic';

/**
 * /api/vhost/revenda — o que o menu Admin do revendedor lê e muda no servidor (Silva, 26/10/2026), sempre só na conta dele e nas dos
 * clientes que criou (panel_users.parent_username; ver src/lib/vhost-revenda.ts). Usa o mesmo script do servidor do Admin
 * (src/lib/vhost-admin-py.ts) mas só estas operações — tudo o resto continua em /api/vhost/admin-servidor, só do administrador.
 * GET  ?ver=ips           → os IPs partilhados e os que o servidor lhe atribuiu
 * GET  ?ver=security-txt  → o security.txt de cada domínio dos clientes
 * GET  ?ver=importar      → { autorizado }: o administrador deixou esta revenda importar contas do cPanel?
 * POST { acao: 'ns-conta', contas, ns }   → mudar os nameservers de contas suas
 * POST { acao: 'cpanel-contas', host, porta, utilizador, senha }   → as contas de um servidor cPanel remoto (só leitura; só com a
 *      importação autorizada pelo administrador). A palavra-passe fica só na memória deste pedido: nunca se guarda nem se regista.
 * Só o administrador:
 * GET  ?ver=importar-autorizacoes                      → { autorizadas: { [conta]: data } }
 * POST { acao: 'importar-autorizar', conta, ligado }   → liga ou desliga a importação do cPanel de uma revenda
 *      (Silva, 27/10/2026: «um interruptor que permite importar, e depois desligar»; está tudo desligado até ser preciso)
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

const FICHEIRO_IMPORTAR = `${VHOST_DIR}/importar-revenda.json`;
/** Corre no servidor (python3): muda uma conta no ficheiro das revendas autorizadas e devolve o ficheiro como ficou */
const GRAVAR_AUTORIZACAO_PY = String.raw`
import json, os, sys, base64
arg = json.loads(base64.b64decode(sys.argv[1]).decode())
d = '/usr/local/vhost'
f = d + '/importar-revenda.json'
os.makedirs(d, exist_ok=True)
try: os.chmod(d, 0o700)
except Exception: pass
try:
    cur = json.load(open(f))
    if not isinstance(cur, dict): cur = {}
except Exception:
    cur = {}
if arg['ligado']: cur[arg['conta']] = arg['quando']
else: cur.pop(arg['conta'], None)
tmp = f + '.tmp'
with open(tmp, 'w') as h: json.dump(cur, h)
os.chmod(tmp, 0o600)
os.replace(tmp, f)
print(json.dumps({'ok': True, 'autorizadas': json.load(open(f))}))
`;
const CONTA_RE = /^[a-z0-9][a-z0-9_.-]{0,31}$/;

/** Revendedores a quem o administrador deixou importar do cPanel (conta → quando); guardado no servidor, como as outras definições do painel */
async function lerAutorizadas(): Promise<Record<string, string>> {
  const out = await executeServerCommand(`cat ${FICHEIRO_IMPORTAR} 2>/dev/null`, { timeoutMs: 20_000 }).catch(() => '');
  try {
    const j = out.trim() ? (JSON.parse(out) as Record<string, unknown>) : {};
    return Object.fromEntries(Object.entries(j).filter(([k, v]) => CONTA_RE.test(k) && typeof v === 'string')) as Record<string, string>;
  } catch {
    return {};
  }
}

// ---------- Servidor cPanel remoto (só leitura das contas) ----------
const HOST_DNS = /^(?=.{3,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
/** Endereços que não são da Internet pública: o servidor nunca liga a eles a pedido de um utilizador */
function ipPrivado(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  const v = ip.toLowerCase();
  return v === '::' || v === '::1' || v.startsWith('::ffff:') || /^f[cd]/.test(v) || /^fe[89ab]/.test(v);
}
/** O endereço público a que se liga (resolvido aqui, para não mudar entre a verificação e a ligação); null = recusado */
async function enderecoPublico(host: string): Promise<string | null> {
  if (net.isIP(host)) return ipPrivado(host) ? null : host;
  if (!HOST_DNS.test(host)) return null;
  const r = await dns.lookup(host, { all: true }).catch(() => []);
  return r.length && !r.some((x) => ipPrivado(x.address)) ? r[0].address : null;
}
function contasDoCpanel(texto: string): { conta: string; dominio: string }[] {
  // /etc/trueuserdomains: uma linha "dominio: utilizador" por conta
  return texto
    .split('\n')
    .map((l) => l.match(/^\s*([a-z0-9.-]+):\s*([a-z0-9_]+)\s*$/i))
    .filter((m): m is RegExpMatchArray => !!m)
    .map((m) => ({ conta: m[2].toLowerCase(), dominio: m[1].toLowerCase() }))
    .sort((x, y) => x.conta.localeCompare(y.conta));
}
function lerContasCpanel(ip: string, porta: number, utilizador: string, senha: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const c = new Client();
    let fim = false;
    const acabar = (f: () => void) => {
      if (fim) return;
      fim = true;
      clearTimeout(limite);
      try {
        c.end();
      } catch {}
      f();
    };
    const limite = setTimeout(() => acabar(() => reject(new Error('tempo'))), 30_000);
    c.on('ready', () => {
      c.exec('cat /etc/trueuserdomains 2>/dev/null', (err, stream) => {
        if (err) return acabar(() => reject(err));
        let out = '';
        stream.on('data', (d: Buffer) => {
          if (out.length < 500_000) out += d.toString('utf8');
        });
        stream.on('close', () => acabar(() => resolve(out)));
      });
    });
    c.on('error', (e) => acabar(() => reject(e)));
    c.connect({ host: ip, port: porta, username: utilizador, password: senha, readyTimeout: 15_000, tryKeyboard: false });
  });
}
/** No máximo 5 tentativas por revendedor em 10 minutos (não serve para experimentar palavras-passe de servidores de fora) */
const tentativas = new Map<string, number[]>();
function demasiadas(eu: string): boolean {
  const agora = Date.now();
  const l = (tentativas.get(eu) || []).filter((t) => agora - t < 10 * 60_000);
  if (l.length >= 5) {
    tentativas.set(eu, l);
    return true;
  }
  tentativas.set(eu, [...l, agora]);
  return false;
}

/** Só o administrador */
async function soAdmin() {
  const auth = await requirePanelBootstrapAccess();
  if ('error' in auth) return { erro: NextResponse.json({ erro: 'Inicie sessão no site.' }, { status: 401 }) };
  if (auth.user.role !== 'admin') return { erro: NextResponse.json({ erro: 'Só o administrador do servidor pode fazer isto.' }, { status: 403 }) };
  return { ok: true as const };
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
  const ver = req.nextUrl.searchParams.get('ver') || '';
  const sem = { headers: { 'Cache-Control': 'no-store' } };
  if (ver === 'importar-autorizacoes') {
    const a = await soAdmin();
    if ('erro' in a) return a.erro;
    return NextResponse.json({ autorizadas: await lerAutorizadas() }, sem);
  }
  const q = await soRevendedor();
  if ('erro' in q) return q.erro;
  try {
    if (ver === 'importar') return NextResponse.json({ autorizado: !!(await lerAutorizadas())[q.eu] }, sem);
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
  const c = (await req.json().catch(() => ({}))) as { acao?: unknown; contas?: unknown; ns?: unknown; conta?: unknown; ligado?: unknown; host?: unknown; porta?: unknown; utilizador?: unknown; senha?: unknown };
  if (c.acao === 'importar-autorizar') {
    const a = await soAdmin();
    if ('erro' in a) return a.erro;
    const conta = String(c.conta || '').toLowerCase();
    if (!CONTA_RE.test(conta) || typeof c.ligado !== 'boolean') return NextResponse.json({ erro: 'Pedido inválido.' }, { status: 400 });
    const aut = await lerAutorizadas();
    if (c.ligado) aut[conta] = new Date().toISOString();
    else delete aut[conta];
    // um só pedido ao servidor: lê o ficheiro, muda a conta e grava (ficheiro novo + troca), e devolve o que ficou gravado. Por SSH cada pedido
    // leva segundos; só se diz que ficou feito se o servidor devolver o ficheiro com a alteração, e se falhar diz-se porquê.
    const arg = { conta, ligado: c.ligado, quando: new Date().toISOString() };
    let saida = '';
    try {
      saida = await executeServerCommand(`python3 -c "$(echo ${b64(GRAVAR_AUTORIZACAO_PY)} | base64 -d)" ${b64(JSON.stringify(arg))} 2>&1`, { timeoutMs: 30_000 });
    } catch {
      return NextResponse.json({ erro: 'Sem ligação ao servidor. Nada foi alterado.' }, { status: 502 });
    }
    const linha = saida.split('\n').reverse().find((x) => x.trim().startsWith('{'));
    let gravado: { ok?: boolean; autorizadas?: Record<string, string> } | null = null;
    try {
      gravado = linha ? JSON.parse(linha) : null;
    } catch {}
    if (!gravado?.ok || (typeof gravado.autorizadas?.[conta] === 'string') !== c.ligado) {
      const motivo = saida.trim().split('\n').filter(Boolean).pop() || 'sem resposta';
      return NextResponse.json({ erro: 'O servidor não confirmou a gravação (' + motivo.slice(0, 160) + '). Nada foi alterado; tente de novo.' }, { status: 502 });
    }
    return NextResponse.json({ ok: true, autorizadas: gravado.autorizadas });
  }
  const q = await soRevendedor();
  if ('erro' in q) return q.erro;
  if (c.acao === 'cpanel-contas') {
    if (!(await lerAutorizadas())[q.eu]) return NextResponse.json({ erro: 'A importação do cPanel está desativada na sua revenda. Peça ao administrador para a ativar.' }, { status: 403 });
    const host = String(c.host || '').trim().toLowerCase();
    const porta = Number(c.porta);
    const utilizador = String(c.utilizador || '').trim();
    const senha = typeof c.senha === 'string' ? c.senha : '';
    if (!host || !senha || !/^[a-z0-9_.-]{1,32}$/i.test(utilizador) || !Number.isInteger(porta) || porta < 1 || porta > 65535 || senha.length > 256) {
      return NextResponse.json({ erro: 'Preencha o servidor, a porta, o utilizador e a palavra-passe.' }, { status: 400 });
    }
    if (demasiadas(q.eu)) return NextResponse.json({ erro: 'Muitas tentativas. Espere alguns minutos.' }, { status: 429 });
    const ip = await enderecoPublico(host);
    if (!ip) return NextResponse.json({ erro: 'O endereço do servidor não é válido ou não é público.' }, { status: 400 });
    try {
      const texto = await lerContasCpanel(ip, porta, utilizador, senha);
      const contas = contasDoCpanel(texto);
      if (!contas.length) return NextResponse.json({ erro: 'Não encontrei contas neste servidor: não parece um cPanel ou o utilizador não é o root.' }, { status: 422 });
      return NextResponse.json({ contas });
    } catch (e) {
      const m = e instanceof Error ? e.message : '';
      const recusada = /authentication|all configured authentication methods failed/i.test(m);
      return NextResponse.json({ erro: recusada ? 'O servidor recusou o utilizador ou a palavra-passe.' : 'Não foi possível ligar ao servidor (endereço, porta ou firewall).' }, { status: recusada ? 401 : 502 });
    }
  }
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
