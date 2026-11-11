import { NextRequest, NextResponse } from 'next/server';
import { requirePanelBootstrapAccess } from '@/lib/panel-api-auth';
import { executeServerCommand } from '@/lib/server-ssh-exec';
import { lerServidor } from '@/lib/vhost-servidor';
import { lerRegisto, montarDados } from '@/lib/vhost-dados';
import { CAIXA_PY } from '@/lib/vhostmail/servidor';

export const dynamic = 'force-dynamic';

/**
 * /api/vhost/vhostmail/caixa — o VhostMail a ler e a mexer na caixa de correio REAL da conta que está aberta.
 * POST { end: 'caixa@dominio', acao, … }   pastas | lista | ler | original | marcar | mover | apagar | criarPasta | enviar | rascunho
 * GET  ?end=&pasta=&uid=&i=                 descarrega um anexo
 * Só vê a caixa quem tem esse domínio de e-mail no seu painel (a mesma regra do menu E-mail); o resto (ler, mover,
 * enviar…) corre no servidor com o doveadm/exim, sem palavra-passe da caixa (programa em src/lib/vhostmail/servidor.ts).
 */

const EMAIL = /^[a-z0-9]([a-z0-9._+-]{0,62}[a-z0-9])?@([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
const PASTA = /^[^\u0000-\u001f"\\]{1,100}$/;
const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64');
const JSON_MAX = 8 * 1024 * 1024;
/** o comando que vai por SSH tem um limite (~128 KB): acima disto, os argumentos seguem em pedaços para um ficheiro temporário */
const PEDACO = 90_000;
const SO_LEITURA = new Set(['pastas', 'lista', 'ler', 'original']);
const ACOES = new Set(['pastas', 'lista', 'ler', 'original', 'marcar', 'mover', 'apagar', 'criarPasta', 'enviar', 'rascunho']);

type Sessao = { userId: string; email: string; role: string };

async function sessao(): Promise<{ s: Sessao } | { erro: NextResponse }> {
  const auth = await requirePanelBootstrapAccess();
  if ('error' in auth) return { erro: NextResponse.json({ erro: 'Inicie sessão no painel.' }, { status: auth.error.status }) };
  return { s: { userId: auth.user.id, email: auth.user.email || '', role: auth.user.role } };
}

/** A caixa tem de existir no servidor, numa conta que a sessão vê. O resultado guarda-se 10 minutos por sessão e caixa
 *  (cada clique do VhostMail faz um pedido; o registo do painel não precisa de ser lido de cada vez) */
const acessos = new Map<string, number>();
async function podeVer(s: Sessao, end: string): Promise<boolean> {
  if (!EMAIL.test(end)) return false;
  const chave = s.userId + '|' + end;
  if ((acessos.get(chave) || 0) > Date.now()) return true;
  const [utilizador, dominio] = end.toLowerCase().split('@');
  const srv = await lerServidor();
  const dados = montarDados(srv, await lerRegisto(), s);
  const sim = Object.keys(dados.contas).some((conta) => !!srv.mailAcc[conta]?.[dominio]?.[utilizador]);
  if (sim) {
    acessos.set(chave, Date.now() + 10 * 60_000);
    if (acessos.size > 500) for (const [k, ate] of acessos) if (ate < Date.now()) acessos.delete(k);
  }
  return sim;
}

async function correr(args: Record<string, unknown>): Promise<{ ok: boolean; r?: Record<string, unknown>; erro?: string }> {
  const a64 = b64(JSON.stringify(args));
  const prog = `python3 -c "$(echo ${b64(CAIXA_PY)} | base64 -d)"`;
  let out = '';
  if (a64.length <= PEDACO) {
    out = await executeServerCommand(`echo ${a64} | base64 -d | ${prog}`, { timeoutMs: 60_000 });
  } else {
    const f = `/var/tmp/vhm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.b64`;
    try {
      for (let i = 0; i < a64.length; i += PEDACO) {
        await executeServerCommand(`umask 077; printf %s ${a64.slice(i, i + PEDACO)} ${i === 0 ? '>' : '>>'} ${f}`, { timeoutMs: 60_000 });
      }
      out = await executeServerCommand(`base64 -d < ${f} | ${prog}`, { timeoutMs: 120_000 });
    } finally {
      await executeServerCommand(`rm -f ${f}`, { timeoutMs: 20_000 }).catch(() => '');
    }
  }
  const linha = out.split('\n').find((l) => l.startsWith('@@JSON'));
  if (!linha) return { ok: false, erro: 'O servidor não respondeu.' };
  try {
    return JSON.parse(linha.slice(6));
  } catch {
    return { ok: false, erro: 'Resposta inválida do servidor.' };
  }
}

const semCache = { headers: { 'Cache-Control': 'no-store' } };

export async function POST(req: NextRequest) {
  const r = await sessao();
  if ('erro' in r) return r.erro;
  if (Number(req.headers.get('content-length') || 0) > JSON_MAX) return NextResponse.json({ erro: 'Mensagem demasiado grande.' }, { status: 413 });
  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ erro: 'Pedido inválido.' }, { status: 400 });
  }
  const end = String(b.end || '').trim().toLowerCase();
  const acao = String(b.acao || '');
  if (!ACOES.has(acao)) return NextResponse.json({ erro: 'Acção desconhecida.' }, { status: 400 });
  try {
    if (!(await podeVer(r.s, end))) return NextResponse.json({ erro: 'Essa caixa não é desta conta.' }, { status: 403 });
  } catch {
    return NextResponse.json({ erro: 'O painel está ocupado. Tente outra vez dentro de instantes.' }, { status: 503 });
  }

  // só se passa ao servidor o que cada acção usa, validado
  const args: Record<string, unknown> = { acao, user: end };
  const pasta = (k: string) => {
    const v = String(b[k] ?? '');
    if (!PASTA.test(v)) throw new Error('Nome de pasta inválido.');
    return v;
  };
  const lista = (k: string) => (Array.isArray(b[k]) ? (b[k] as unknown[]).map((x) => Number(x)).filter((x) => Number.isInteger(x) && x > 0) : []);
  const flags = (k: string) => (Array.isArray(b[k]) ? (b[k] as unknown[]).map(String).filter((x) => ['Seen', 'Flagged', 'Answered', 'Deleted', 'Draft'].includes(x)) : []);
  try {
    if (acao === 'lista') {
      args.pasta = pasta('pasta');
      args.max = Math.min(300, Math.max(20, Number(b.max) || 150));
    } else if (acao === 'ler' || acao === 'original') {
      args.pasta = pasta('pasta');
      args.uid = lista('uids')[0] || Number(b.uid);
      if (!Number.isInteger(args.uid) || (args.uid as number) < 1) throw new Error('Mensagem inválida.');
      if (b.naoLida) args.naoLida = true;
    } else if (acao === 'marcar') {
      args.pasta = pasta('pasta');
      args.uids = lista('uids');
      args.juntar = flags('juntar');
      args.tirar = flags('tirar');
    } else if (acao === 'mover') {
      args.pasta = pasta('pasta');
      args.destino = pasta('destino');
      args.uids = lista('uids');
    } else if (acao === 'apagar') {
      args.pasta = pasta('pasta');
      args.uids = lista('uids');
    } else if (acao === 'criarPasta') {
      args.nome = pasta('nome');
    } else if (acao === 'enviar' || acao === 'rascunho') {
      const m = (b.msg || {}) as Record<string, unknown>;
      const texto = (k: string, max: number) => String(m[k] ?? '').slice(0, max);
      const anexos = Array.isArray(m.anexos) ? (m.anexos as Record<string, unknown>[]).slice(0, 10) : [];
      args.msg = {
        nome: texto('nome', 100),
        para: texto('para', 2000),
        cc: texto('cc', 2000),
        cco: texto('cco', 2000),
        assunto: texto('assunto', 500),
        texto: texto('texto', 2_000_000),
        html: texto('html', 2_000_000),
        responde: texto('responde', 500),
        referencias: texto('referencias', 2000),
        anexos: anexos.map((a) => ({ nome: String(a.nome || 'anexo').slice(0, 200), tipo: String(a.tipo || 'application/octet-stream').slice(0, 100), b64: String(a.b64 || '').replace(/[^A-Za-z0-9+/=]/g, '') })),
      };
      if (acao === 'enviar' && !String(m.para || '').trim()) throw new Error('Adicione pelo menos um destinatário.');
      if (b.pastaEnviados) args.pastaEnviados = pasta('pastaEnviados');
      if (b.pastaRascunhos) args.pastaRascunhos = pasta('pastaRascunhos');
      const velho = b.apagarRascunho as { pasta?: string; uid?: number } | undefined;
      if (velho && PASTA.test(String(velho.pasta)) && Number.isInteger(velho.uid)) args.apagarRascunho = { pasta: velho.pasta, uid: velho.uid };
    }
  } catch (e) {
    return NextResponse.json({ erro: (e as Error).message }, { status: 400 });
  }
  try {
    const x = await correr(args);
    if (!x.ok) return NextResponse.json({ erro: x.erro || 'Não foi possível concluir.' }, { status: 502, ...semCache });
    return NextResponse.json(x.r || {}, semCache);
  } catch {
    // o detalhe técnico fica no servidor; ao utilizador diz-se só o que pode fazer
    return NextResponse.json({ erro: SO_LEITURA.has(acao) ? 'Não foi possível ler a caixa agora. Tente outra vez.' : 'Não foi possível concluir. Tente outra vez.' }, { status: 502, ...semCache });
  }
}

export async function GET(req: NextRequest) {
  const r = await sessao();
  if ('erro' in r) return r.erro;
  const sp = req.nextUrl.searchParams;
  const end = (sp.get('end') || '').trim().toLowerCase();
  const pasta = sp.get('pasta') || '';
  const uid = Number(sp.get('uid'));
  const i = Number(sp.get('i'));
  if (!PASTA.test(pasta) || !Number.isInteger(uid) || uid < 1 || !Number.isInteger(i) || i < 0) return NextResponse.json({ erro: 'Pedido inválido.' }, { status: 400 });
  try {
    if (!(await podeVer(r.s, end))) return NextResponse.json({ erro: 'Essa caixa não é desta conta.' }, { status: 403 });
    const x = await correr({ acao: 'anexo', user: end, pasta, uid, i });
    if (!x.ok || !x.r) return NextResponse.json({ erro: 'Anexo não encontrado.' }, { status: 404 });
    const nome = String(x.r.nome || 'anexo').replace(/[^\w.\- ()]/g, '_');
    return new NextResponse(Buffer.from(String(x.r.b64 || ''), 'base64'), {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${nome}"`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return NextResponse.json({ erro: 'Não foi possível descarregar o anexo.' }, { status: 502 });
  }
}
