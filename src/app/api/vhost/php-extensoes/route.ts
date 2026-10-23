import { NextRequest, NextResponse } from 'next/server';
import { requirePanelBootstrapAccess } from '@/lib/panel-api-auth';
import { executeServerCommand } from '@/lib/server-ssh-exec';
import { esquecerLeitura, lerServidor, type LeituraServidor } from '@/lib/vhost-servidor';
import { lerRegisto, montarDados } from '@/lib/vhost-dados';
import { EXTENSOES_PHP } from '@/lib/php-extensoes';

export const dynamic = 'force-dynamic';
export const maxDuration = 200;

/**
 * /api/vhost/php-extensoes — Definições PHP › Extensões (Silva, 23/10/2026).
 * GET  ?conta=&d=&versao=8.3   as extensões carregadas (`php -m`) e os pacotes php8.3-* instalados no servidor (só leitura).
 * POST { acao: ativar | desativar | instalar, conta, dominio, versao, ext }   SÓ administradores: mexe no PHP do servidor, por isso vale para
 *      todos os sites que usam essa versão (phpenmod/phpdismod/apt-get + reload do php-fpm). Só extensões do catálogo, nunca as essenciais.
 */

const DOM = /^(?=.{3,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;
const CONTA = /^[a-z0-9][a-z0-9_.-]{0,31}$/;
const VERSAO = /^[5-9]\.\d$/;

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

/** Módulos carregados e pacotes instalados da versão pedida */
async function ler(versao: string): Promise<{ carregadas: string[]; pacotes: string[] }> {
  const cmd = `v=${versao}; (php$v -m 2>/dev/null || true); echo '@@PKG'; (dpkg-query -W -f='\${Package}\\n' "php$v-*" 2>/dev/null || true)`;
  const out = await executeServerCommand(cmd, { fast: true, timeoutMs: 20_000 });
  const [mods, pks = ''] = out.split('@@PKG');
  const linhas = (t: string) => t.split('\n').map((l) => l.trim()).filter(Boolean);
  return {
    carregadas: linhas(mods).filter((l) => !l.startsWith('[')).map((l) => l.toLowerCase()),
    pacotes: linhas(pks),
  };
}

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
    const { carregadas, pacotes } = await ler(versao);
    return NextResponse.json({ versao, carregadas, pacotes, admin: a.s.role === 'admin' });
  } catch (e) {
    console.error('[vhost/php-extensoes]', e);
    return NextResponse.json({ erro: 'Não foi possível ler as extensões do servidor.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const a = await sessao();
  if ('erro' in a) return a.erro;
  if (a.s.role !== 'admin') return NextResponse.json({ erro: 'Só o administrador pode mudar as extensões do servidor.' }, { status: 403 });
  const c = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const acao = String(c.acao || '');
  const versao = String(c.versao || '');
  const e = EXTENSOES_PHP.find((x) => x.k === String(c.ext || ''));
  if (!['ativar', 'desativar', 'instalar'].includes(acao) || !VERSAO.test(versao) || !e) return NextResponse.json({ erro: 'Pedido inválido.' }, { status: 400 });
  const srv = await lerServidor();
  const erro = await verificar(a.s, String(c.conta || ''), String(c.dominio || ''), srv);
  if (erro) return NextResponse.json({ erro }, { status: 403 });
  if (acao === 'desativar' && e.essencial) return NextResponse.json({ erro: 'Esta extensão é essencial: sem ela os sites deixam de funcionar.' }, { status: 400 });
  if (acao === 'instalar' && (!e.pkg || e.pkg === 'common')) return NextResponse.json({ erro: 'Esta extensão já vem com o PHP.' }, { status: 400 });
  const recarregar = `systemctl reload php${versao}-fpm`;
  const comando =
    acao === 'ativar'
      ? `phpenmod -v ${versao} ${e.k} && ${recarregar}`
      : acao === 'desativar'
        ? `phpdismod -v ${versao} ${e.k} && ${recarregar}`
        : `DEBIAN_FRONTEND=noninteractive apt-get install -y php${versao}-${e.pkg} && ${recarregar}`;
  try {
    await executeServerCommand(comando, { timeoutMs: acao === 'instalar' ? 170_000 : 30_000 });
    esquecerLeitura();
    const { carregadas, pacotes } = await ler(versao);
    return NextResponse.json({ ok: true, versao, carregadas, pacotes });
  } catch (err) {
    console.error('[vhost/php-extensoes]', err);
    return NextResponse.json({ erro: 'O servidor não conseguiu fazer a alteração.' }, { status: 500 });
  }
}
