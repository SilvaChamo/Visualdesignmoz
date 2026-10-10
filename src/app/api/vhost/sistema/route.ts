import { NextRequest, NextResponse } from 'next/server';
import { Readable } from 'stream';
import { requirePanelBootstrapAccess } from '@/lib/panel-api-auth';
import { executeServerCommand, streamServerFile, uploadFileViaSsh } from '@/lib/server-ssh-exec';
import { hestiaCall } from '@/lib/hestia-client';
import { lerServidor, type LeituraServidor } from '@/lib/vhost-servidor';
import { lerRegisto, montarDados } from '@/lib/vhost-dados';
import { FM_PY } from '@/lib/vhost-ficheiros-py';

export const dynamic = 'force-dynamic';

/**
 * /api/vhost/sistema — Menu "Sistema e ficheiros" do painel VisualHost.
 * GET  ?conta=&ver=ficheiros&caminho=   lista uma pasta da conta (sempre como o utilizador da conta)
 * GET  ?conta=&ver=ler&caminho=         texto de um ficheiro (até 2 MB) para o editor
 * GET  ?conta=&ver=descarregar&caminho= descarrega um ficheiro (aos poucos)
 * GET  ?conta=&ver=info | perl | estatisticas | recursos | logs&d=&tipo=acesso|erros&linhas=
 * POST JSON { acao: fm-…, terminal, awstats } ou multipart (carregar ficheiros)
 * O gestor de ficheiros corre com `sudo -u <conta>` e só aceita caminhos dentro de /home/<conta>.
 */

const DOM = /^(?=.{3,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;
const CONTA = /^[a-z0-9][a-z0-9_.-]{0,31}$/;
const H = '/usr/local/hestia/bin';
const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64');
const q = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;
const ADMINS_DO_SERVIDOR = new Set(['admin', 'root']);

type Sessao = { userId: string; email: string; role: string };

async function sessao(): Promise<{ s: Sessao } | { erro: NextResponse }> {
  const auth = await requirePanelBootstrapAccess();
  if ('error' in auth) return { erro: NextResponse.json({ erro: 'Inicie sessão no site.' }, { status: auth.error.status }) };
  return { s: { userId: auth.user.id, email: auth.user.email || '', role: auth.user.role } };
}

async function verificar(s: Sessao, conta: string, d: string | null, srv: LeituraServidor): Promise<string | null> {
  if (!CONTA.test(conta) || ADMINS_DO_SERVIDOR.has(conta)) return 'Conta inválida.';
  if (!srv.users[conta]) return 'Conta inexistente no servidor.';
  const dados = montarDados(srv, await lerRegisto(), s);
  if (!dados.contas[conta]) return 'Conta fora do seu painel.';
  if (d !== null && (!DOM.test(d) || !srv.web[conta]?.[d])) return 'Esse site não é desta conta.';
  return null;
}

const json = <T,>(t: string | undefined, vazio: T): T => {
  try {
    return t && t.trim() ? (JSON.parse(t) as T) : vazio;
  } catch {
    return vazio;
  }
};

/** Corre o gestor de ficheiros como o utilizador da conta e devolve a resposta (ou { erro }) */
async function fm(conta: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const out = await executeServerCommand(`sudo -u ${conta} -H python3 -c "$(echo ${b64(FM_PY)} | base64 -d)" ${b64(JSON.stringify({ conta, ...args }))} 2>&1`, { timeoutMs: 120_000 });
  const l = out.split('\n').reverse().find((x) => x.trim().startsWith('{'));
  return json<Record<string, unknown>>(l, { erro: out.slice(0, 200) || 'Sem resposta do servidor.' });
}

export async function GET(req: NextRequest) {
  const r = await sessao();
  if ('erro' in r) return r.erro;
  const sp = req.nextUrl.searchParams;
  const conta = sp.get('conta') || '';
  const ver = sp.get('ver') || '';
  const d = sp.get('d') ? (sp.get('d') || '').toLowerCase() : null;
  const srv = await lerServidor();
  const e = await verificar(r.s, conta, d, srv);
  if (e) return NextResponse.json({ erro: e }, { status: 403 });
  const ok = (x: unknown) => NextResponse.json(x, { headers: { 'Cache-Control': 'no-store' } });
  const falha = (x: Record<string, unknown>) => NextResponse.json(x, { status: 400 });

  switch (ver) {
    case 'ficheiros': {
      const x = await fm(conta, { op: 'listar', caminho: sp.get('caminho') || '' });
      return x.erro ? falha(x) : ok(x);
    }
    case 'ler': {
      const x = await fm(conta, { op: 'ler', caminho: sp.get('caminho') || '' });
      return x.erro ? falha(x) : ok(x);
    }
    case 'descarregar': {
      const x = await fm(conta, { op: 'confirmar', caminho: sp.get('caminho') || '' });
      if (x.erro || typeof x.real !== 'string' || !x.real.startsWith(`/home/${conta}/`)) return falha(x.erro ? x : { erro: 'Ficheiro inválido.' });
      const nome = x.real.split('/').pop() || 'ficheiro';
      return new NextResponse(Readable.toWeb(streamServerFile(x.real, conta)) as ReadableStream, {
        headers: { 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(nome)}`, 'Content-Length': String(x.tam), 'Cache-Control': 'no-store' },
      });
    }
    case 'info': {
      const out = await executeServerCommand(
        [
          `echo @@SYS; ${H}/v-list-sys-info json`,
          'echo @@V',
          `printf 'PHP|%s\\n' "$(php -r 'echo PHP_VERSION;' 2>/dev/null)"`,
          `printf 'MariaDB|%s\\n' "$(mariadb --version 2>/dev/null | grep -o '[0-9]*\\.[0-9]*\\.[0-9]*-MariaDB' | head -1)"`,
          `printf 'Nginx|%s\\n' "$(nginx -v 2>&1 | grep -o '[0-9.]*$')"`,
          `printf 'Apache|%s\\n' "$(apache2 -v 2>/dev/null | grep -o 'Apache/[0-9.]*' | cut -d/ -f2)"`,
          `printf 'Exim|%s\\n' "$(exim4 -bV 2>/dev/null | head -1 | grep -o '[0-9][0-9.]*' | head -1)"`,
          `printf 'Dovecot|%s\\n' "$(dovecot --version 2>/dev/null | cut -d' ' -f1)"`,
          `printf 'Python|%s\\n' "$(python3 --version 2>&1 | cut -d' ' -f2)"`,
          `printf 'Perl|%s\\n' "$(perl -e 'print $^V' 2>/dev/null | tr -d v)"`,
          `printf 'Git|%s\\n' "$(git --version 2>/dev/null | cut -d' ' -f3)"`,
          `printf 'WP-CLI|%s\\n' "$(wp --version --allow-root 2>/dev/null | cut -d' ' -f2)"`,
          `printf 'ClamAV|%s\\n' "$(clamdscan --version 2>/dev/null | cut -d/ -f1 | cut -d' ' -f2)"`,
          `printf 'Node.js|%s\\n' "$(node --version 2>/dev/null | tr -d v)"`,
          `echo @@PHP; ls /etc/php 2>/dev/null | tr '\\n' ' '`,
          `echo @@CPU; grep -m1 'model name' /proc/cpuinfo | cut -d: -f2; nproc; free -m | awk '/Mem:/{print $2}'`,
        ].join('; '),
        { timeoutMs: 40_000 },
      );
      const sec = new Map<string, string>();
      let cur = '';
      for (const l of out.split('\n')) if (l.startsWith('@@')) sec.set((cur = l.slice(2).trim()), '');
      else if (cur) sec.set(cur, sec.get(cur) + l + '\n');
      const sys = (Object.values(json<Record<string, Record<string, string>>>(sec.get('SYS'), {}))[0] || {}) as Record<string, string>;
      const [cpu = '', nucleos = '', mem = ''] = (sec.get('CPU') || '').split('\n').map((x) => x.trim());
      return ok({
        sistema: { nome: sys.HOSTNAME || '', so: [sys.OS, sys.VERSION].filter(Boolean).join(' '), arquitetura: sys.ARCH || '', hestia: sys.HESTIA || '', ligado: sys.UPTIME || '', carga: sys.LOADAVERAGE || '', cpu, nucleos, memoriaMb: Number(mem) || 0 },
        software: (sec.get('V') || '').split('\n').map((l) => l.split('|')).filter((x) => x.length === 2 && x[1].trim()).map(([nome, versao]) => ({ nome, versao: versao.trim() })),
        php: (sec.get('PHP') || '').trim().split(/\s+/).filter((x) => /^\d/.test(x)),
      });
    }
    case 'perl': {
      const out = await executeServerCommand(`perl -MExtUtils::Installed -e 'my $i=ExtUtils::Installed->new; for my $m ($i->modules) { my $v = eval { $i->version($m) } // ""; print "$m|$v\\n" }' 2>/dev/null; echo @@CORE; perl -MModule::CoreList -e 'print scalar(keys %{$Module::CoreList::version{$]}})' 2>/dev/null`, { timeoutMs: 60_000 });
      const [mods, core] = out.split('@@CORE');
      return ok({ modulos: mods.split('\n').map((l) => l.split('|')).filter((x) => x.length === 2 && x[0]).map(([nome, versao]) => ({ nome, versao })), base: Number((core || '').trim()) || 0 });
    }
    case 'estatisticas': {
      const out = await executeServerCommand(`${H}/v-list-user-stats ${conta} json`, { timeoutMs: 30_000 });
      const m = json<Record<string, Record<string, string>>>(out, {});
      const sites = Object.entries(srv.web[conta] || {}).map(([s, w]) => ({ d: s, stats: w.STATS || '' }));
      return ok({
        meses: Object.entries(m).map(([mes, x]) => ({ mes, discoMb: Number(x.U_DISK) || 0, discoWeb: Number(x.U_DISK_WEB) || 0, discoMail: Number(x.U_DISK_MAIL) || 0, discoBd: Number(x.U_DISK_DB) || 0, trafegoMb: Number(x.U_BANDWIDTH) || 0, sites: Number(x.U_WEB_DOMAINS) || 0, emails: Number(x.U_MAIL_ACCOUNTS) || 0, bds: Number(x.U_DATABASES) || 0, pacote: x.PACKAGE || '' })).sort((a, b) => b.mes.localeCompare(a.mes)),
        sites,
      });
    }
    case 'recursos': {
      const u = srv.users[conta] || {};
      const out = await executeServerCommand(`ps -u ${conta} -o pcpu=,rss= 2>/dev/null | awk '{c+=$1; m+=$2; n++} END{printf "%.1f|%d|%d", c, m/1024, n}'`, { timeoutMs: 20_000 });
      const [cpu, memMb, procs] = out.trim().split('|');
      const num = (v?: string) => (/unlimited/i.test(v || '') ? 0 : Number(v) || 0);
      return ok({
        disco: { usadoMb: num(u.U_DISK), limiteMb: num(u.DISK_QUOTA), web: num(u.U_DISK_WEB), mail: num(u.U_DISK_MAIL), bd: num(u.U_DISK_DB), outros: num(u.U_DISK_DIRS) },
        trafego: { usadoMb: num(u.U_BANDWIDTH), limiteMb: num(u.BANDWIDTH) },
        agora: { cpu: Number(cpu) || 0, memoriaMb: Number(memMb) || 0, processos: Number(procs) || 0, nucleos: srv.recursos.cpus, memoriaTotalMb: srv.recursos.memTotal },
        limites: { cpu: u.CPU_QUOTA || '', memoria: u.MEMORY_LIMIT || '' },
      });
    }
    case 'logs': {
      if (!d) return falha({ erro: 'Escolha o domínio.' });
      const linhas = Math.min(1000, Math.max(20, Number(sp.get('linhas')) || 100));
      const erros = sp.get('tipo') === 'erros';
      const out = await executeServerCommand(`${H}/${erros ? 'v-list-web-domain-errorlog' : 'v-list-web-domain-accesslog'} ${conta} ${d} ${linhas} 2>&1`, { timeoutMs: 30_000 });
      return ok({ linhas: out.split('\n').filter((l) => l.trim()) });
    }
  }
  return falha({ erro: 'Pedido desconhecido.' });
}

export async function POST(req: NextRequest) {
  const r = await sessao();
  if ('erro' in r) return r.erro;
  const srv = await lerServidor();

  // carregar ficheiros (formulário com os ficheiros)
  if ((req.headers.get('content-type') || '').includes('multipart/form-data')) {
    const f = await req.formData();
    const conta = String(f.get('conta') || '');
    const e = await verificar(r.s, conta, null, srv);
    if (e) return NextResponse.json({ erro: e }, { status: 403 });
    const pasta = String(f.get('pasta') || '');
    const ficheiros = f.getAll('ficheiros').filter((x): x is File => x instanceof File);
    if (!ficheiros.length) return NextResponse.json({ erro: 'Escolha os ficheiros.' }, { status: 400 });
    if (ficheiros.some((x) => x.size > 256 * 1024 * 1024)) return NextResponse.json({ erro: 'Cada ficheiro pode ter até 256 MB.' }, { status: 400 });
    const falhas: string[] = [];
    for (const fi of ficheiros) {
      const tmp = `/tmp/vhost-up-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
      await uploadFileViaSsh(tmp, Buffer.from(await fi.arrayBuffer()));
      await executeServerCommand(`chown ${conta}:${conta} ${tmp} && chmod 600 ${tmp}`, { timeoutMs: 20_000 });
      const x = await fm(conta, { op: 'colocar', pasta, nome: fi.name, tmp });
      if (x.erro) {
        falhas.push(fi.name + ': ' + x.erro);
        await executeServerCommand(`rm -f ${tmp}`, { timeoutMs: 20_000 });
      }
    }
    return falhas.length ? NextResponse.json({ erro: falhas.join(' · ') }, { status: 400 }) : NextResponse.json({ ok: true });
  }

  let c: Record<string, unknown>;
  try {
    c = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ erro: 'Pedido inválido.' }, { status: 400 });
  }
  const conta = String(c.conta || '');
  const d = c.dominio ? String(c.dominio).toLowerCase() : null;
  const e = await verificar(r.s, conta, d, srv);
  if (e) return NextResponse.json({ erro: e }, { status: 403 });
  const recusa = (erro: string, status = 400) => NextResponse.json({ erro }, { status });
  const acao = String(c.acao || '');

  // gestor de ficheiros: as operações passam diretamente ao programa (que valida tudo como o utilizador)
  const ops: Record<string, string> = { 'fm-guardar': 'guardar', 'fm-pasta': 'pasta', 'fm-renomear': 'renomear', 'fm-copiar': 'copiar', 'fm-mover': 'mover', 'fm-apagar': 'apagar', 'fm-permissoes': 'permissoes', 'fm-comprimir': 'comprimir', 'fm-extrair': 'extrair' };
  if (ops[acao]) {
    const permitido = ['pasta', 'nome', 'caminho', 'caminhos', 'destino', 'modo', 'novo'];
    const args: Record<string, unknown> = Object.fromEntries(Object.entries(c).filter(([k]) => permitido.includes(k)));
    if (acao === 'fm-guardar') args.texto64 = Buffer.from(String(c.texto ?? ''), 'utf8').toString('base64');
    if (acao === 'fm-guardar' && String(c.texto ?? '').length > 2 * 1024 * 1024) return recusa('O texto passa de 2 MB.');
    const x = await fm(conta, { op: ops[acao], ...args });
    return x.erro ? recusa(String(x.erro)) : NextResponse.json({ ok: true });
  }

  switch (acao) {
    case 'terminal': {
      // comando não interativo, com o utilizador da conta, na pasta escolhida (como numa ligação SSH)
      const shell = srv.users[conta]?.SHELL || 'nologin';
      if (/nologin|false/.test(shell)) return recusa('O acesso SSH desta conta está desligado; peça ao administrador para o ligar (Chaves SSH).', 403);
      const cmd = String(c.comando || '').trim();
      if (!cmd || cmd.length > 2000) return recusa('Escreva o comando.');
      const pasta = String(c.pasta || '').replace(/^\/+/, '');
      if (pasta.split('/').some((s) => s === '..')) return recusa('Pasta inválida.');
      const script = `cd ${q(`/home/${conta}/${pasta}`)} 2>/dev/null || cd ~; ${cmd}\necho "@@FIM:$?:$(pwd)"`;
      const out = await executeServerCommand(`sudo -u ${conta} -H timeout 60 bash -lc "$(echo ${b64(script)} | base64 -d)" 2>&1 | tail -c 200000`, { timeoutMs: 75_000 });
      const m = out.match(/@@FIM:(\d+):(.*)$/m);
      const pwd = m ? m[2].trim() : '';
      return NextResponse.json({ saida: out.replace(/@@FIM:.*$/m, '').replace(/\s+$/, ''), codigo: m ? Number(m[1]) : 124, pasta: pwd.startsWith(`/home/${conta}`) ? pwd.slice(`/home/${conta}`.length).replace(/^\//, '') : '' });
    }
    case 'awstats': {
      if (!d) return recusa('Escolha o domínio.');
      const x = await hestiaCall(c.ligar ? 'v-add-web-domain-stats' : 'v-delete-web-domain-stats', c.ligar ? [conta, d, 'awstats'] : [conta, d]);
      return x.ok ? NextResponse.json({ ok: true }) : recusa(x.error || 'O servidor recusou.');
    }
  }
  return recusa('Ação desconhecida.');
}
