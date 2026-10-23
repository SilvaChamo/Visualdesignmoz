import { NextRequest, NextResponse } from 'next/server';
import { requirePanelBootstrapAccess } from '@/lib/panel-api-auth';
import { executeServerCommand } from '@/lib/server-ssh-exec';
import { lerServidor, type LeituraServidor } from '@/lib/vhost-servidor';
import { lerRegisto, montarDados } from '@/lib/vhost-dados';
import { EXTENSOES_PHP } from '@/lib/php-extensoes';

export const dynamic = 'force-dynamic';
export const maxDuration = 200;

/**
 * /api/vhost/php-extensoes — Definições PHP › Extensões, POR CONTA (Silva, 23/10/2026): cada conta tem as suas extensões.
 * Quem faz o trabalho é o /usr/local/sbin/vd-php-conta (deploy/php-conta/vd-php-conta), que dá à conta um PHP-FPM só dela quando ela escolhe extensões.
 * GET  ?conta=&d=&versao=8.3   estado da conta: dedicado, ativas, disponiveis (os pacotes instalados), essenciais
 * POST { acao: aplicar, conta, dominio, versao, modulos: [...] }   a conta passa a ter estes módulos (qualquer conta do painel, só a sua)
 *      { acao: repor, conta, dominio }                             a conta volta ao PHP do servidor
 *      { acao: instalar, conta, dominio, versao, ext }             SÓ administradores: instala no servidor o pacote de uma extensão que ainda não existe
 *                                                                  (fica desligada para todos; cada conta liga-a se quiser)
 */

const DOM = /^(?=.{3,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;
const CONTA = /^[a-z0-9][a-z0-9_.-]{0,31}$/;
const VERSAO = /^[5-9]\.\d$/;
const MODULO = /^[a-z0-9_]{2,30}$/;
const SCRIPT = '/usr/local/sbin/vd-php-conta';

type Sessao = { userId: string; email: string; role: string };

async function sessao(): Promise<{ s: Sessao } | { erro: NextResponse }> {
  const auth = await requirePanelBootstrapAccess();
  if ('error' in auth) return { erro: NextResponse.json({ erro: 'Inicie sessão no site.' }, { status: auth.error.status }) };
  return { s: { userId: auth.user.id, email: auth.user.email || '', role: auth.user.role } };
}

/** A conta tem de estar entre as que a sessão vê e o domínio tem de ser dessa conta */
async function verificar(s: Sessao, conta: string, d: string, srv: LeituraServidor): Promise<string | null> {
  if (!CONTA.test(conta) || !DOM.test(d)) return 'Conta ou domínio inválido.';
  const dados = montarDados(srv, await lerRegisto(), s);
  if (!dados.contas[conta]) return 'Conta fora do seu painel.';
  if (!srv.web[conta]?.[d]) return 'Esse site não é desta conta.';
  return null;
}

type Estado = { dedicado: boolean; ativas: string[]; disponiveis: string[]; essenciais: string[] };
const lista = (v: string | undefined) => (v || '').split(',').map((x) => x.trim()).filter(Boolean);

/** Corre o vd-php-conta; se ainda não estiver instalado no servidor, devolve SEM_SCRIPT */
async function script(args: string, timeoutMs: number): Promise<string> {
  const out = await executeServerCommand(`test -x ${SCRIPT} || { echo SEM_SCRIPT; exit 0; }; ${SCRIPT} ${args}`, { timeoutMs });
  if (out.includes('SEM_SCRIPT')) throw new Error('SEM_SCRIPT');
  return out;
}

/** Lê o estado de uma conta numa versão do PHP, pelo vd-php-conta */
async function estado(conta: string, versao: string): Promise<Estado> {
  const out = await script(`estado '${conta}' '${versao}'`, 30_000);
  const v: Record<string, string> = {};
  for (const l of out.split('\n')) {
    const i = l.indexOf('=');
    if (i > 0) v[l.slice(0, i).trim()] = l.slice(i + 1).trim();
  }
  return { dedicado: v.dedicado === 'sim', ativas: lista(v.ativas), disponiveis: lista(v.disponiveis), essenciais: lista(v.essenciais) };
}

const FALTA_SCRIPT = 'As extensões por conta ainda não estão instaladas neste servidor (instalam-se na próxima publicação).';

export async function GET(req: NextRequest) {
  const a = await sessao();
  if ('erro' in a) return a.erro;
  const sp = req.nextUrl.searchParams;
  const conta = sp.get('conta') || '';
  const d = sp.get('d') || '';
  const versao = sp.get('versao') || '';
  if (!VERSAO.test(versao)) return NextResponse.json({ erro: 'Versão do PHP inválida.' }, { status: 400 });
  const srv = await lerServidor();
  const erro = await verificar(a.s, conta, d, srv);
  if (erro) return NextResponse.json({ erro }, { status: 403 });
  try {
    return NextResponse.json({ versao, ...(await estado(conta, versao)), admin: a.s.role === 'admin' });
  } catch (e) {
    if (e instanceof Error && e.message === 'SEM_SCRIPT') return NextResponse.json({ erro: FALTA_SCRIPT }, { status: 503 });
    console.error('[vhost/php-extensoes]', e);
    return NextResponse.json({ erro: 'Não foi possível ler as extensões do servidor.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const a = await sessao();
  if ('erro' in a) return a.erro;
  const c = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const acao = String(c.acao || '');
  const conta = String(c.conta || '');
  const versao = String(c.versao || '');
  if (!['aplicar', 'repor', 'instalar'].includes(acao)) return NextResponse.json({ erro: 'Pedido inválido.' }, { status: 400 });
  const srv = await lerServidor();
  const erro = await verificar(a.s, conta, String(c.dominio || ''), srv);
  if (erro) return NextResponse.json({ erro }, { status: 403 });
  try {
    if (acao === 'repor') {
      await script(`repor '${conta}'`, 60_000);
    } else if (!VERSAO.test(versao)) {
      return NextResponse.json({ erro: 'Versão do PHP inválida.' }, { status: 400 });
    } else if (acao === 'aplicar') {
      const modulos = (Array.isArray(c.modulos) ? c.modulos : []).map(String).filter((m) => MODULO.test(m));
      await script(`aplicar '${conta}' '${modulos.join(',')}'`, 90_000);
    } else {
      if (a.s.role !== 'admin') return NextResponse.json({ erro: 'Só o administrador pode instalar extensões no servidor.' }, { status: 403 });
      const e = EXTENSOES_PHP.find((x) => x.k === String(c.ext || ''));
      if (!e || !e.pkg || e.pkg === 'common') return NextResponse.json({ erro: 'Esta extensão não se instala por pacote.' }, { status: 400 });
      // instala o pacote e desliga logo no PHP do servidor o que ele trouxe (o pacote liga-se sozinho): as outras contas ficam como estavam
      const lm = `ls /etc/php/${versao}/mods-available | sed 's/\\.ini$//'`;
      const cmd = [
        `antes=$(${lm})`,
        `DEBIAN_FRONTEND=noninteractive apt-get install -y php${versao}-${e.pkg}`,
        `for m in $(${lm}); do echo "$antes" | grep -qx "$m" || phpdismod -v ${versao} "$m"; done`,
        `systemctl reload php${versao}-fpm`,
      ].join(' && ');
      await executeServerCommand(cmd, { timeoutMs: 170_000 });
    }
    return NextResponse.json({ ok: true, versao, ...(VERSAO.test(versao) ? await estado(conta, versao) : {}) });
  } catch (err) {
    if (err instanceof Error && err.message === 'SEM_SCRIPT') return NextResponse.json({ erro: FALTA_SCRIPT }, { status: 503 });
    console.error('[vhost/php-extensoes]', err);
    return NextResponse.json({ erro: 'O servidor não conseguiu fazer a alteração.' }, { status: 500 });
  }
}
