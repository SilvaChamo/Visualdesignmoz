import { NextRequest, NextResponse } from 'next/server';
import { Readable } from 'stream';
import { requirePanelBootstrapAccess } from '@/lib/panel-api-auth';
import { executeServerCommand, streamServerFile } from '@/lib/server-ssh-exec';
import { hestiaCall } from '@/lib/hestia-client';
import * as hestia from '@/lib/hestia-adapter';
import { generateWpAutoLoginToken, installWordPressSite, listWpPlugins, listWpUsers, toggleWpPlugin, updateAllWpPlugins, updateWpPlugin } from '@/lib/wp-cli-server';
import { esquecerLeitura, lerServidor, type LeituraServidor } from '@/lib/vhost-servidor';
import { lerRegisto, montarDados } from '@/lib/vhost-dados';
import { VHOST_DIR } from '@/lib/vhost-email-scripts';

export const dynamic = 'force-dynamic';

/**
 * /api/vhost/avancado — Menu Avançado do painel VisualHost (Hestia + Apache por trás do Nginx).
 * GET  ?conta=&ver=cron|backups|chaves|ssh|protegidas|git|wordpress|clamav   (e &d= para handlers, modsec, wp)
 * GET  ?conta=&ver=descarregar&f=<cópia>   descarrega uma cópia de segurança (aos poucos)
 * POST { acao, conta, … }   alterações; só nas contas que a sessão pode ver
 * O que o Hestia não guarda (pastas protegidas, repositórios Git, análises do antivírus) fica em /usr/local/vhost/<conta>/.
 */

const DOM = /^(?=.{3,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;
const CONTA = /^[a-z0-9][a-z0-9_.-]{0,31}$/;
const CRON = /^[0-9*/,-]{1,40}$/;
const H = '/usr/local/hestia/bin';
const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64');
const q = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;
const linha = (v: unknown) => String(v ?? '').replace(/[\r\n]/g, ' ').trim();
const MARCA_TIPOS = ['# VisualHost tipos: inicio (não editar à mão)', '# VisualHost tipos: fim'];

type Sessao = { userId: string; email: string; role: string };
type Protegida = { id: string; d: string; pasta: string; nome: string; users: string[] };
type Repo = { nome: string; d: string; remoto: string; ramo: string; publicar: boolean; destino: string; criado: string };
type Extra = { protegidas?: Protegida[]; git?: Repo[] };

async function sessao(): Promise<{ s: Sessao } | { erro: NextResponse }> {
  const auth = await requirePanelBootstrapAccess();
  if ('error' in auth) return { erro: NextResponse.json({ erro: 'Inicie sessão no site.' }, { status: auth.error.status }) };
  return { s: { userId: auth.user.id, email: auth.user.email || '', role: auth.user.role } };
}

/** A conta tem de estar entre as que a sessão vê; o domínio (se houver) tem de ser um site dela */
async function verificar(s: Sessao, conta: string, d: string | null, srv: LeituraServidor): Promise<string | null> {
  if (!CONTA.test(conta)) return 'Conta inválida.';
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
const lista = (v: unknown) => (Array.isArray(v) ? v : String(v ?? '').split(/[\s,;]+/)).map((x) => linha(x)).filter(Boolean);
const raizSite = (srv: LeituraServidor, conta: string, d: string) => (srv.web[conta]?.[d]?.DOCUMENT_ROOT || `/home/${conta}/web/${d}/public_html/`).replace(/\/+$/, '');

const ficheiroExtra = (conta: string) => `${VHOST_DIR}/${conta}/avancado.json`;
async function lerExtra(conta: string): Promise<Extra> {
  return json<Extra>(await executeServerCommand(`cat ${q(ficheiroExtra(conta))} 2>/dev/null`, { timeoutMs: 20_000 }), {});
}
async function gravarExtra(conta: string, x: Extra) {
  const f = ficheiroExtra(conta);
  await executeServerCommand(`mkdir -p ${VHOST_DIR}/${conta} && chmod 700 ${VHOST_DIR} ${VHOST_DIR}/${conta} && echo ${b64(JSON.stringify(x))} | base64 -d > ${q(f + '.tmp')} && chmod 600 ${q(f + '.tmp')} && mv ${q(f + '.tmp')} ${q(f)}`, { timeoutMs: 20_000 });
}

/** Reescreve um bloco marcado num ficheiro do site (cria-o se faltar), com o dono da conta */
async function escreverBloco(conta: string, ficheiro: string, marca: string[], linhas: string[]) {
  const atual = await executeServerCommand(`cat ${q(ficheiro)} 2>/dev/null`, { timeoutMs: 20_000 });
  const i = atual.indexOf(marca[0]);
  const j = atual.indexOf(marca[1]);
  const fora = i >= 0 && j > i ? atual.slice(0, i) + atual.slice(j + marca[1].length) : atual;
  const novo = (linhas.length ? [marca[0], ...linhas, marca[1], ''].join('\n') : '') + fora.replace(/^\n+/, '');
  await executeServerCommand(`echo ${b64(novo)} | base64 -d > ${q(ficheiro + '.vhost-tmp')} && chown ${conta}:${conta} ${q(ficheiro + '.vhost-tmp')} && mv ${q(ficheiro + '.vhost-tmp')} ${q(ficheiro)}`, { timeoutMs: 20_000 });
}
const bloco = (txt: string, marca: string[]) => {
  const i = txt.indexOf(marca[0]);
  const j = txt.indexOf(marca[1]);
  return i >= 0 && j > i ? txt.slice(i + marca[0].length, j).split('\n').map((x) => x.trim()).filter(Boolean) : [];
};

/** Regras do nginx para as pastas protegidas de um domínio (antes do Apache, para os ficheiros estáticos também pedirem a senha) */
async function aplicarProtegidas(conta: string, d: string, todas: Protegida[]) {
  const dir = `/home/${conta}/conf/web/${d}`;
  const minhas = todas.filter((p) => p.d === d);
  const conf = await executeServerCommand(`grep -h -m1 proxy_pass ${dir}/nginx.conf; echo @@; grep -h -m1 proxy_pass ${dir}/nginx.ssl.conf 2>/dev/null`, { timeoutMs: 20_000 });
  const [http, https] = conf.split('@@').map((x) => (x.match(/proxy_pass\s+(https?:\/\/[0-9.:a-f[\]]+);/) || [])[1] || '');
  if (!http) throw new Error('Não encontrei a configuração do nginx deste domínio.');
  const regra = (alvo: string) =>
    minhas
      .map((p) => [`location ^~ /${p.pasta}/ {`, `    auth_basic ${JSON.stringify(p.nome.replace(/[";\\]/g, ''))};`, `    auth_basic_user_file ${dir}/vhost-auth-${p.id};`, `    proxy_pass ${alvo};`, '}'].join('\n'))
      .join('\n');
  const cmds = [
    minhas.length ? `echo ${b64('# VisualHost: pastas protegidas (gerido pelo painel)\n' + regra(http) + '\n')} | base64 -d > ${dir}/nginx.conf_vhost_protegidas` : `rm -f ${dir}/nginx.conf_vhost_protegidas`,
    https && minhas.length ? `echo ${b64('# VisualHost: pastas protegidas (gerido pelo painel)\n' + regra(https) + '\n')} | base64 -d > ${dir}/nginx.ssl.conf_vhost_protegidas` : `rm -f ${dir}/nginx.ssl.conf_vhost_protegidas`,
  ];
  const out = await executeServerCommand(
    `cp -p ${dir}/nginx.conf_vhost_protegidas /tmp/vhost-np-$$ 2>/dev/null; cp -p ${dir}/nginx.ssl.conf_vhost_protegidas /tmp/vhost-nps-$$ 2>/dev/null; ${cmds.join('; ')}; ` +
      `if nginx -t >/dev/null 2>&1; then systemctl reload nginx && echo OK; else rm -f ${dir}/nginx.conf_vhost_protegidas ${dir}/nginx.ssl.conf_vhost_protegidas; cp -p /tmp/vhost-np-$$ ${dir}/nginx.conf_vhost_protegidas 2>/dev/null; cp -p /tmp/vhost-nps-$$ ${dir}/nginx.ssl.conf_vhost_protegidas 2>/dev/null; echo RECUSADO; fi; rm -f /tmp/vhost-np-$$ /tmp/vhost-nps-$$`,
    { timeoutMs: 40_000 },
  );
  if (!/OK/.test(out)) throw new Error('O nginx recusou a regra; nada foi mudado.');
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
  const user = srv.users[conta] || {};

  switch (ver) {
    case 'cron': {
      const jobs = json<Record<string, Record<string, string>>>(await executeServerCommand(`${H}/v-list-cron-jobs ${conta} json`, { timeoutMs: 20_000 }), {});
      return ok({ relatorios: (user.CRON_REPORTS || '') === 'yes', email: user.CONTACT || '', tarefas: Object.entries(jobs).map(([id, j]) => ({ id, min: j.MIN, hora: j.HOUR, dia: j.DAY, mes: j.MONTH, semana: j.WDAY, cmd: j.CMD, suspensa: j.SUSPENDED === 'yes' })) });
    }
    case 'backups': {
      const out = await executeServerCommand(`echo @@B; ${H}/v-list-user-backups ${conta} json; echo @@X; ${H}/v-list-user-backup-exclusions ${conta} json; echo @@Q; grep -c " ${conta} " /usr/local/hestia/data/queue/backup.pipe 2>/dev/null; grep -c "v-backup-user ${conta}\\b\\|v-restore-user ${conta}\\b" /usr/local/hestia/data/queue/*.pipe 2>/dev/null | awk -F: '{s+=$2} END{print s+0}'`, { timeoutMs: 30_000 });
      const sec = new Map<string, string>();
      let cur = '';
      for (const l of out.split('\n')) if (l.startsWith('@@')) sec.set((cur = l.slice(2)), '');
      else if (cur) sec.set(cur, sec.get(cur) + l + '\n');
      const b = json<Record<string, Record<string, string>>>(sec.get('B'), {});
      const x = json<Record<string, Record<string, string>>>(sec.get('X'), {});
      const excl = Object.fromEntries(['WEB', 'DNS', 'MAIL', 'DB', 'CRON', 'USER'].map((k) => [k, Object.keys(x[k] || {}).join(',')]));
      return ok({
        limite: Number(srv.packages[user.PACKAGE || '']?.BACKUPS) || 0,
        naFila: Number((sec.get('Q') || '').trim().split('\n').pop()) > 0,
        exclusoes: excl,
        copias: Object.entries(b).map(([f, c]) => ({ f, tamanhoMb: Number(c.SIZE) || 0, data: (c.DATE || '') + ' ' + (c.TIME || ''), web: c.WEB || '', dns: c.DNS || '', mail: c.MAIL || '', db: c.DB || '', cron: c.CRON || '', udir: c.UDIR || '', duracao: Number(c.RUNTIME) || 0 })),
        sites: Object.keys(srv.web[conta] || {}),
        emails: Object.keys(srv.mail[conta] || {}),
        dns: Object.keys(srv.dns[conta] || {}),
        bds: Object.keys(srv.db[conta] || {}),
      });
    }
    case 'descarregar': {
      const f = sp.get('f') || '';
      if (!new RegExp(`^${conta.replace(/\./g, '\\.')}\\.[0-9_-]+\\.tar$`).test(f)) return NextResponse.json({ erro: 'Cópia inválida.' }, { status: 400 });
      const lst = json<Record<string, unknown>>(await executeServerCommand(`${H}/v-list-user-backups ${conta} json`, { timeoutMs: 20_000 }), {});
      if (!lst[f]) return NextResponse.json({ erro: 'Cópia inexistente.' }, { status: 404 });
      const fluxo = streamServerFile('/backup/' + f);
      return new NextResponse(Readable.toWeb(fluxo) as ReadableStream, { headers: { 'Content-Type': 'application/x-tar', 'Content-Disposition': `attachment; filename="${f}"`, 'Cache-Control': 'no-store' } });
    }
    case 'chaves': {
      const k = json<Record<string, Record<string, string>>>(await executeServerCommand(`${H}/v-list-access-keys ${conta} json 2>/dev/null`, { timeoutMs: 20_000 }), {});
      return ok({ chaves: Object.entries(k).map(([id, x]) => ({ id, permissoes: x.PERMISSIONS || '', comentario: x.COMMENT || '', data: (x.DATE || '') + ' ' + (x.TIME || '') })) });
    }
    case 'ssh': {
      const k = json<Record<string, Record<string, string>>>(await executeServerCommand(`${H}/v-list-user-ssh-key ${conta} json 2>/dev/null`, { timeoutMs: 20_000 }), {});
      return ok({ shell: user.SHELL || 'nologin', admin: r.s.role === 'admin', chaves: Object.values(k).map((x) => ({ id: x.ID, chave: x.KEY })) });
    }
    case 'protegidas': {
      const ex = await lerExtra(conta);
      return ok({ sites: Object.keys(srv.web[conta] || {}), pastas: (ex.protegidas || []).map(({ id, d, pasta, nome, users }) => ({ id, d, pasta, nome, users })) });
    }
    case 'tipos': {
      if (!d) return NextResponse.json({ erro: 'Escolha o domínio.' }, { status: 400 });
      const ht = await executeServerCommand(`cat ${q(raizSite(srv, conta, d) + '/.htaccess')} 2>/dev/null`, { timeoutMs: 20_000 });
      const linhas = bloco(ht, MARCA_TIPOS).map((l) => l.match(/^(AddHandler|AddType)\s+(\S+)\s+\.(\S+)$/)).filter((x): x is RegExpMatchArray => !!x);
      return ok({ handlers: linhas.filter((x) => x[1] === 'AddHandler').map((x) => ({ nome: x[2], ext: x[3] })), mime: linhas.filter((x) => x[1] === 'AddType').map((x) => ({ nome: x[2], ext: x[3] })) });
    }
    case 'modsec': {
      if (!d) return NextResponse.json({ erro: 'Escolha o domínio.' }, { status: 400 });
      const out = await executeServerCommand(
        `apache2ctl -M 2>/dev/null | grep -c security2; echo @@; tail -n 4000 /var/log/apache2/domains/${d}.error.log 2>/dev/null | grep 'ModSecurity' | tail -n 200`,
        { timeoutMs: 30_000 },
      );
      const [estado, log] = out.split('@@');
      const campo = (l: string, k: string) => (l.match(new RegExp(`\\[${k} "([^"]*)"\\]`)) || [])[1] || '';
      const eventos = (log || '')
        .split('\n')
        .filter(Boolean)
        .map((l) => ({ data: (l.match(/^\[([^\]]+)\]/) || [])[1] || '', ip: (l.match(/\[client ([0-9a-f.:]+)/) || [])[1] || '', regra: campo(l, 'id'), msg: campo(l, 'msg'), uri: campo(l, 'uri'), bloqueado: /Access denied/i.test(l) }))
        .reverse();
      return ok({ ativo: Number(estado.trim()) > 0, eventos });
    }
    case 'git': {
      const ex = await lerExtra(conta);
      const repos = ex.git || [];
      const out = repos.length ? await executeServerCommand(repos.map((g) => `echo "@@${g.nome}"; sudo -u ${conta} git --git-dir=/home/${conta}/git/${g.nome}.git log -1 --format='%h|%cd|%s' --date=format:'%d/%m/%Y %H:%M' ${q(g.ramo)} 2>/dev/null`).join('; '), { timeoutMs: 30_000 }) : '';
      const ult = new Map<string, string>();
      let cur = '';
      for (const l of out.split('\n')) if (l.startsWith('@@')) cur = l.slice(2);
      else if (cur && l.includes('|')) ult.set(cur, l);
      const host = process.env.HESTIA_HOST || 'servidor';
      return ok({ sites: Object.keys(srv.web[conta] || {}), shell: user.SHELL || 'nologin', repos: repos.map((g) => ({ ...g, clone: `ssh://${conta}@${host}/home/${conta}/git/${g.nome}.git`, ultimo: ult.get(g.nome) || '' })) });
    }
    case 'wordpress': {
      const sites = Object.keys(srv.web[conta] || {});
      const out = await executeServerCommand(
        sites.map((s) => `p=${q(raizSite(srv, conta, s))}; if [ -f "$p/wp-config.php" ]; then echo "@@${s}"; sudo -u ${conta} /usr/local/bin/wp --path="$p" --skip-plugins --skip-themes eval 'echo get_bloginfo("version")."|".get_option("blogname")."|".get_option("siteurl")."|".(defined("WP_AUTO_UPDATE_CORE")?var_export(WP_AUTO_UPDATE_CORE,true):"minor")."|".get_option("template");' 2>/dev/null; echo; fi`).join('; ') || 'true',
        { timeoutMs: 60_000 },
      );
      const wp: Record<string, { versao: string; titulo: string; url: string; auto: string; tema: string }> = {};
      let cur = '';
      for (const l of out.split('\n')) {
        if (l.startsWith('@@')) wp[(cur = l.slice(2))] = { versao: '', titulo: '', url: '', auto: '', tema: '' };
        else if (cur && l.includes('|')) {
          const [versao, titulo, url, auto, tema] = l.split('|');
          wp[cur] = { versao, titulo, url, auto: auto.replace(/'/g, ''), tema };
        }
      }
      return ok({ instalados: Object.entries(wp).map(([s, x]) => ({ d: s, pasta: raizSite(srv, conta, s).replace(`/home/${conta}/`, ''), ...x })), livres: sites.filter((s) => !wp[s]).map((s) => ({ d: s, pasta: raizSite(srv, conta, s).replace(`/home/${conta}/`, '') })) });
    }
    case 'wp': {
      if (!d) return NextResponse.json({ erro: 'Escolha o domínio.' }, { status: 400 });
      try {
        const [plugins, users] = await Promise.all([listWpPlugins(d), listWpUsers(d)]);
        return ok({ plugins, users });
      } catch (x) {
        return NextResponse.json({ erro: x instanceof Error ? x.message : 'WordPress não encontrado.' }, { status: 400 });
      }
    }
    case 'clamav': {
      const out = await executeServerCommand(
        `echo @@A; pgrep -a -f "clamdscan.*/home/${conta}(/| |$)" 2>/dev/null; echo @@R; for f in ${VHOST_DIR}/${conta}/clamav/*.json; do [ -f "$f" ] && { cat "$f"; echo; }; done 2>/dev/null`,
        { timeoutMs: 20_000 },
      );
      const [, ativos = '', rel = ''] = out.split(/@@[AR]\n?/);
      return ok({
        ativos: ativos.split('\n').filter((l) => /clamdscan/.test(l)).map((l) => ({ pid: l.split(' ')[0], caminho: (l.match(/(\/home\/\S+)/) || [])[1] || '' })),
        relatorios: rel
          .split('\n')
          .map((l) => json<Record<string, unknown> | null>(l, null))
          .filter(Boolean)
          .sort((a, b) => String(b!.id).localeCompare(String(a!.id))),
      });
    }
  }
  return NextResponse.json({ erro: 'Pedido desconhecido.' }, { status: 400 });
}

type Corpo = { acao: string; conta: string; dominio?: string; [k: string]: unknown };

export async function POST(req: NextRequest) {
  const r = await sessao();
  if ('erro' in r) return r.erro;
  let c: Corpo;
  try {
    c = (await req.json()) as Corpo;
  } catch {
    return NextResponse.json({ erro: 'Pedido inválido.' }, { status: 400 });
  }
  const conta = String(c.conta || '');
  const d = c.dominio ? String(c.dominio).toLowerCase() : null;
  const srv = await lerServidor();
  const e = await verificar(r.s, conta, d, srv);
  if (e) return NextResponse.json({ erro: e }, { status: 403 });
  const recusa = (erro: string, status = 400) => NextResponse.json({ erro }, { status });
  const call = async (cmd: string, args: string[]) => {
    const x = await hestiaCall(cmd, args);
    return { ok: x.ok, error: x.error, output: x.output };
  };
  const resposta = (x: { ok: boolean; error?: string }, esquecer = false, mais: Record<string, unknown> = {}) => {
    if (x.ok && esquecer) esquecerLeitura();
    return NextResponse.json(x.ok ? { ok: true, ...mais } : { erro: x.error || 'O servidor recusou.' }, { status: x.ok ? 200 : 400 });
  };
  const seguidos = async (cmds: [string, string[]][]) => {
    for (const [cmd, args] of cmds) {
      const x = await call(cmd, args);
      if (!x.ok) return x;
    }
    return { ok: true };
  };

  switch (c.acao) {
    // ---------- Tarefas cron ----------
    case 'cron-criar':
    case 'cron-editar': {
      const campos = ['min', 'hora', 'dia', 'mes', 'semana'].map((k) => linha(c[k]));
      if (campos.some((x) => !CRON.test(x))) return recusa('Horário inválido: use números, *, vírgulas, hífens e /.');
      const cmd = String(c.cmd || '').replace(/[\r\n]/g, ' ').trim();
      if (!cmd || cmd.length > 1000) return recusa('Escreva o comando (até 1000 caracteres).');
      if (c.acao === 'cron-criar') return resposta(await call('v-add-cron-job', [conta, ...campos, cmd]));
      const id = linha(c.id);
      if (!/^\d+$/.test(id)) return recusa('Tarefa inválida.');
      return resposta(await call('v-change-cron-job', [conta, id, ...campos, cmd]));
    }
    case 'cron-apagar':
    case 'cron-suspender':
    case 'cron-reativar': {
      const ids = lista(c.ids).filter((x) => /^\d+$/.test(x));
      if (!ids.length) return recusa('Escolha pelo menos uma tarefa.');
      const cmd = c.acao === 'cron-apagar' ? 'v-delete-cron-job' : c.acao === 'cron-suspender' ? 'v-suspend-cron-job' : 'v-unsuspend-cron-job';
      return resposta(await seguidos(ids.map((id) => [cmd, [conta, id]])));
    }
    case 'cron-relatorios':
      return resposta(await call(c.ligar ? 'v-add-cron-reports' : 'v-delete-cron-reports', [conta]), true);

    // ---------- Cópias de segurança ----------
    case 'backup-criar':
      return resposta(await call('v-schedule-user-backup', [conta]));
    case 'backup-apagar': {
      const f = linha(c.f);
      if (!new RegExp(`^${conta.replace(/\./g, '\\.')}\\.[0-9_-]+\\.tar$`).test(f)) return recusa('Cópia inválida.');
      return resposta(await call('v-delete-user-backup', [conta, f]));
    }
    case 'backup-restaurar': {
      const f = linha(c.f);
      if (!new RegExp(`^${conta.replace(/\./g, '\\.')}\\.[0-9_-]+\\.tar$`).test(f)) return recusa('Cópia inválida.');
      // cada parte: "*" (tudo), lista separada por vírgulas, ou "no" (não restaurar)
      const parte = (v: unknown) => {
        const s = linha(v);
        return s === '*' || s === 'no' || /^[a-z0-9_.,-]{1,2000}$/i.test(s) ? s : null;
      };
      const ps = ['web', 'dns', 'mail', 'db', 'cron', 'udir'].map((k) => parte(c[k] ?? '*'));
      if (ps.some((x) => x === null)) return recusa('Seleção inválida.');
      return resposta(await call('v-schedule-user-restore', [conta, f, ...(ps as string[])]));
    }
    case 'backup-exclusoes': {
      const ok = (s: string) => s === '' || s === '*' || /^[a-z0-9_.,:*/-]{1,2000}$/i.test(s);
      const x = Object.fromEntries(['WEB', 'DNS', 'MAIL', 'DB', 'CRON', 'USER'].map((k) => [k, linha((c.exclusoes as Record<string, unknown> | undefined)?.[k]).replace(/'/g, '')]));
      if (Object.values(x).some((v) => !ok(v) || v.includes('..'))) return recusa('Exclusões inválidas.');
      if (x.CRON && x.CRON !== '*') return recusa('As tarefas cron só se excluem todas (*).');
      const txt = Object.entries(x).map(([k, v]) => `${k}='${v}'`).join('\n') + '\n';
      const out = await executeServerCommand(`f=$(mktemp) && echo ${b64(txt)} | base64 -d > $f && ${H}/v-update-user-backup-exclusions ${conta} $f; echo "@@$?"; rm -f $f`, { timeoutMs: 30_000 });
      return resposta({ ok: /@@0\s*$/.test(out), error: out.replace(/@@\d+\s*$/, '').trim() });
    }

    // ---------- Chaves de login (chaves de acesso do Hestia) ----------
    case 'chave-criar': {
      const comentario = linha(c.comentario).replace(/[^\p{L}\p{N} ._-]/gu, '').slice(0, 60);
      const perms = lista(c.permissoes).filter((p) => /^v-[a-z0-9-]{2,60}$/.test(p));
      if (r.s.role !== 'admin' && !perms.length) return recusa('Escolha pelo menos uma permissão.');
      const x = await call('v-add-access-key', [conta, perms.join(','), comentario || 'VisualHost', 'json']);
      if (!x.ok) return resposta(x);
      const k = json<Record<string, Record<string, string>>>(x.output, {});
      const v = Object.values(k)[0] || json<Record<string, string>>(x.output, {});
      return resposta({ ok: true }, false, { id: v.ACCESS_KEY_ID || Object.keys(k)[0] || '', segredo: v.SECRET_ACCESS_KEY || '' });
    }
    case 'chave-apagar': {
      const ids = lista(c.ids).filter((x) => /^[A-Za-z0-9]{10,40}$/.test(x));
      if (!ids.length) return recusa('Escolha pelo menos uma chave.');
      return resposta(await seguidos(ids.map((id) => ['v-delete-access-key', [id]])));
    }

    // ---------- Chaves SSH ----------
    case 'ssh-juntar': {
      const k = String(c.chave || '').trim();
      if (!/^(ssh-(rsa|ed25519|dss)|ecdsa-sha2-nistp(256|384|521)|sk-(ssh-ed25519|ecdsa-sha2-nistp256)@openssh\.com) [A-Za-z0-9+/=]{40,}( [^\r\n]{0,200})?$/.test(k)) return recusa('Chave pública inválida (ex.: ssh-ed25519 AAAA… comentário).');
      return resposta(await call('v-add-user-ssh-key', [conta, k]));
    }
    case 'ssh-criar': {
      // gera o par no servidor, junta a pública e devolve a privada uma só vez (não fica guardada)
      const comentario = (linha(c.comentario) || conta + '@visualhost').replace(/[^A-Za-z0-9@._-]/g, '').slice(0, 60);
      const out = await executeServerCommand(`t=$(mktemp -d) && ssh-keygen -q -t ed25519 -N '' -C ${q(comentario)} -f $t/k >/dev/null && echo @@PUB && cat $t/k.pub && echo @@PRIV && cat $t/k; rm -rf $t`, { timeoutMs: 30_000 });
      const pub = (out.split('@@PUB')[1] || '').split('@@PRIV')[0].trim();
      const priv = (out.split('@@PRIV')[1] || '').trim();
      if (!pub || !priv.includes('PRIVATE KEY')) return recusa('Não foi possível gerar a chave.');
      const x = await call('v-add-user-ssh-key', [conta, pub]);
      return resposta(x, false, x.ok ? { privada: priv, publica: pub } : {});
    }
    case 'ssh-apagar': {
      const ids = lista(c.ids).filter((x) => /^[A-Za-z0-9+/=@._:-]{1,200}$/.test(x));
      if (!ids.length) return recusa('Escolha pelo menos uma chave.');
      return resposta(await seguidos(ids.map((id) => ['v-delete-user-ssh-key', [conta, id]])));
    }
    case 'ssh-shell': {
      if (r.s.role !== 'admin') return recusa('Só o administrador muda o acesso SSH.', 403);
      const sh = ['bash', 'sh', 'nologin'].includes(String(c.shell)) ? String(c.shell) : '';
      if (!sh) return recusa('Shell inválida.');
      return resposta(await call('v-change-user-shell', [conta, sh]), true);
    }

    // ---------- Pastas protegidas (senha pedida pelo nginx) ----------
    case 'protegida-criar':
    case 'protegida-utilizador':
    case 'protegida-tirar-utilizador':
    case 'protegida-apagar': {
      if (!d) return recusa('Escolha o domínio.');
      const ex = await lerExtra(conta);
      const todas = ex.protegidas || [];
      const dir = `/home/${conta}/conf/web/${d}`;
      const user = linha(c.user);
      const senha = String(c.senha || '');
      const novaLinha = async () => {
        if (!/^[A-Za-z0-9._-]{1,32}$/.test(user)) throw new Error('Utilizador inválido: letras, números, ponto, hífen ou _.');
        if (senha.length < 6 || /[\r\n]/.test(senha)) throw new Error('A palavra-passe precisa de pelo menos 6 caracteres.');
        // a senha vai pelo stdin do htpasswd (nunca na linha de comandos)
        const l = (await executeServerCommand(`echo ${b64(senha)} | base64 -d | htpasswd -niB ${q(user)}`, { timeoutMs: 20_000 })).trim();
        if (!l.startsWith(user + ':$2')) throw new Error('Não foi possível gerar a senha.');
        return l;
      };
      const gravarSenhas = async (p: Protegida, juntar?: string, tirar?: string) => {
        const f = `${dir}/vhost-auth-${p.id}`;
        const atual = (await executeServerCommand(`cat ${f} 2>/dev/null`, { timeoutMs: 20_000 })).split('\n').map((l) => l.trim()).filter((l) => l.includes(':'));
        const fica = atual.filter((l) => l.split(':')[0] !== (juntar ? juntar.split(':')[0] : tirar));
        if (juntar) fica.push(juntar);
        await executeServerCommand(`echo ${b64(fica.join('\n') + '\n')} | base64 -d > ${f} && chmod 644 ${f} && chgrp ${conta} ${f}`, { timeoutMs: 20_000 });
        p.users = fica.map((l) => l.split(':')[0]);
      };
      try {
        if (c.acao === 'protegida-criar') {
          const pasta = linha(c.pasta).replace(/^\/+|\/+$/g, '');
          if (!/^[A-Za-z0-9._ /-]{1,200}$/.test(pasta) || pasta.split('/').some((s) => !s || s === '.' || s === '..')) return recusa('Pasta inválida (ex.: privado ou area/clientes).');
          if (todas.some((p) => p.d === d && p.pasta === pasta)) return recusa('Essa pasta já está protegida.');
          const p: Protegida = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), d, pasta, nome: linha(c.nome).replace(/[";\\]/g, '').slice(0, 60) || 'Área protegida', users: [] };
          await gravarSenhas(p, await novaLinha());
          ex.protegidas = [...todas, p];
          await aplicarProtegidas(conta, d, ex.protegidas);
          await gravarExtra(conta, ex);
          return resposta({ ok: true });
        }
        const p = todas.find((x) => x.id === linha(c.id) && x.d === d);
        if (!p) return recusa('Pasta protegida inexistente.');
        if (c.acao === 'protegida-utilizador') await gravarSenhas(p, await novaLinha());
        else if (c.acao === 'protegida-tirar-utilizador') {
          if (p.users.length < 2) return recusa('Tem de ficar pelo menos um utilizador; para tirar a proteção apague a pasta protegida.');
          await gravarSenhas(p, undefined, user);
        } else {
          ex.protegidas = todas.filter((x) => x !== p);
          await aplicarProtegidas(conta, d, ex.protegidas);
          await executeServerCommand(`rm -f ${dir}/vhost-auth-${p.id}`, { timeoutMs: 20_000 });
        }
        await gravarExtra(conta, ex);
        return resposta({ ok: true });
      } catch (x) {
        return recusa(x instanceof Error ? x.message : 'A alteração falhou.');
      }
    }

    // ---------- Handlers do Apache e tipos MIME (bloco próprio no .htaccess do site) ----------
    case 'tipos-guardar': {
      if (!d) return recusa('Escolha o domínio.');
      const linhas: string[] = [];
      for (const [tipo, l] of [
        ['AddHandler', c.handlers],
        ['AddType', c.mime],
      ] as const) {
        for (const x of (Array.isArray(l) ? l : []) as { nome?: string; ext?: string }[]) {
          const nome = linha(x.nome);
          const ext = linha(x.ext).replace(/^\./, '').toLowerCase();
          const nomeOk = tipo === 'AddType' ? /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i.test(nome) : /^[a-z0-9._+-]{1,64}$/i.test(nome);
          if (!nomeOk || !/^[a-z0-9]{1,15}$/.test(ext)) return recusa(`${tipo === 'AddType' ? 'Tipo MIME' : 'Handler'} ou extensão inválida: ${nome} .${ext}`);
          linhas.push(`${tipo} ${nome} .${ext}`);
        }
      }
      await escreverBloco(conta, raizSite(srv, conta, d) + '/.htaccess', MARCA_TIPOS, [...new Set(linhas)]);
      return resposta({ ok: true });
    }

    // ---------- Git (repositórios no servidor, com publicação opcional no site) ----------
    case 'git-criar': {
      if (!d) return recusa('Escolha o domínio.');
      const nome = linha(c.nome).toLowerCase();
      if (!/^[a-z0-9][a-z0-9._-]{0,40}$/.test(nome) || nome.endsWith('.git')) return recusa('Nome inválido (letras minúsculas, números, ponto, hífen, _).');
      const remoto = linha(c.remoto);
      if (remoto && !/^(https:\/\/[A-Za-z0-9._~:/?#@!$&()*+,;=%-]{4,300}|git@[A-Za-z0-9.-]+:[A-Za-z0-9._/-]{1,200})$/.test(remoto)) return recusa('Endereço remoto inválido (https://… ou git@servidor:conta/repo.git).');
      const ramo = linha(c.ramo) || 'main';
      if (!/^[A-Za-z0-9._/-]{1,60}$/.test(ramo) || ramo.includes('..')) return recusa('Ramo inválido.');
      const destino = linha(c.destino).replace(/^\/+|\/+$/g, '');
      if (destino && (!/^[A-Za-z0-9._/-]{1,200}$/.test(destino) || destino.split('/').some((s) => s === '..'))) return recusa('Pasta de publicação inválida.');
      const ex = await lerExtra(conta);
      if ((ex.git || []).some((g) => g.nome === nome)) return recusa('Já existe um repositório com esse nome.');
      const chave = String(c.chave || '').trim();
      if (chave && !/^-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]+-----END [A-Z ]*PRIVATE KEY-----$/.test(chave)) return recusa('Chave privada inválida.');
      const repo = `/home/${conta}/git/${nome}.git`;
      const alvo = `${raizSite(srv, conta, d)}${destino ? '/' + destino : ''}`;
      const sshCmd = chave ? `ssh -i /home/${conta}/.ssh/vhost-git-${nome} -o StrictHostKeyChecking=accept-new` : '';
      const hook = `#!/bin/bash\n# VisualHost: publica o ramo ${ramo} em ${alvo} a cada push (não editar à mão)\nwhile read old new ref; do\n  [ "$ref" = "refs/heads/${ramo}" ] && mkdir -p ${q(alvo)} && git --work-tree=${q(alvo)} --git-dir=${q(repo)} checkout -f ${q(ramo)}\ndone\n`;
      const passos = [
        `sudo -u ${conta} mkdir -p /home/${conta}/git`,
        `sudo -u ${conta} git init -q --bare -b ${q(ramo)} ${q(repo)}`,
        chave ? `sudo -u ${conta} mkdir -p /home/${conta}/.ssh && echo ${b64(chave + '\n')} | base64 -d > /home/${conta}/.ssh/vhost-git-${nome} && chown ${conta}:${conta} /home/${conta}/.ssh/vhost-git-${nome} && chmod 600 /home/${conta}/.ssh/vhost-git-${nome}` : '',
        remoto ? `sudo -u ${conta} git --git-dir=${q(repo)} remote add origin ${q(remoto)}` : '',
        c.publicar ? `echo ${b64(hook)} | base64 -d > ${q(repo + '/hooks/post-receive')} && chown ${conta}:${conta} ${q(repo + '/hooks/post-receive')} && chmod 755 ${q(repo + '/hooks/post-receive')}` : '',
        sshCmd ? `sudo -u ${conta} git --git-dir=${q(repo)} config core.sshCommand ${q(sshCmd)}` : '',
      ].filter(Boolean);
      const out = await executeServerCommand(`set -e; ${passos.join('; ')}; echo FEITO`, { timeoutMs: 60_000 });
      if (!/FEITO/.test(out)) return recusa('Não foi possível criar o repositório: ' + out.slice(0, 200));
      ex.git = [...(ex.git || []), { nome, d, remoto, ramo, publicar: !!c.publicar, destino, criado: new Date().toISOString().slice(0, 16).replace('T', ' ') }];
      await gravarExtra(conta, ex);
      return resposta({ ok: true });
    }
    case 'git-sincronizar': {
      const ex = await lerExtra(conta);
      const g = (ex.git || []).find((x) => x.nome === linha(c.nome));
      if (!g) return recusa('Repositório inexistente.');
      if (!g.remoto) return recusa('Este repositório não tem endereço remoto.');
      const repo = `/home/${conta}/git/${g.nome}.git`;
      const alvo = `${raizSite(srv, conta, g.d)}${g.destino ? '/' + g.destino : ''}`;
      const out = await executeServerCommand(
        `cd /home/${conta} && sudo -u ${conta} git --git-dir=${q(repo)} fetch -q origin ${q(g.ramo + ':' + g.ramo)} 2>&1 && ${g.publicar ? `sudo -u ${conta} mkdir -p ${q(alvo)} && sudo -u ${conta} git --work-tree=${q(alvo)} --git-dir=${q(repo)} checkout -f ${q(g.ramo)} 2>&1 && ` : ''}echo FEITO`,
        { timeoutMs: 180_000 },
      );
      return resposta(/FEITO/.test(out) ? { ok: true } : { ok: false, error: 'A sincronização falhou: ' + out.slice(0, 300) });
    }
    case 'git-apagar': {
      const ex = await lerExtra(conta);
      const g = (ex.git || []).find((x) => x.nome === linha(c.nome));
      if (!g) return recusa('Repositório inexistente.');
      await executeServerCommand(`rm -rf ${q(`/home/${conta}/git/${g.nome}.git`)} /home/${conta}/.ssh/vhost-git-${g.nome}`, { timeoutMs: 30_000 });
      ex.git = (ex.git || []).filter((x) => x !== g);
      await gravarExtra(conta, ex);
      return resposta({ ok: true });
    }

    // ---------- WordPress ----------
    case 'wp-instalar': {
      if (!d) return recusa('Escolha o domínio.');
      const titulo = linha(c.titulo).slice(0, 120) || d;
      const user = linha(c.user);
      const email = linha(c.email);
      const senha = String(c.senha || '');
      if (!/^[A-Za-z0-9._@-]{3,60}$/.test(user)) return recusa('Utilizador inválido.');
      if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) return recusa('E-mail inválido.');
      if (senha.length < 8 || /[\r\n]/.test(senha)) return recusa('A palavra-passe precisa de pelo menos 8 caracteres.');
      const sufixo = 'wp' + Math.random().toString(36).slice(2, 7);
      const dbSenha = Array.from(crypto.getRandomValues(new Uint32Array(20)), (x) => 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'[x % 55]).join('');
      const bd = await hestia.createDatabase({ username: conta, dbNameSuffix: sufixo, dbUserSuffix: sufixo, password: dbSenha });
      if (!bd.ok) return recusa('Não foi possível criar a base de dados: ' + (bd.error || ''));
      const x = await installWordPressSite({ domain: d, siteTitle: titulo, adminUser: user, adminPassword: senha, adminEmail: email, dbName: `${conta}_${sufixo}`, dbUser: `${conta}_${sufixo}`, dbPassword: dbSenha });
      if (!x.ok) await hestia.deleteDatabase(conta, `${conta}_${sufixo}`).catch(() => null);
      return resposta({ ok: x.ok, error: x.output }, true);
    }
    case 'wp-entrar': {
      if (!d) return recusa('Escolha o domínio.');
      const x = await generateWpAutoLoginToken(d);
      return resposta({ ok: x.success, error: x.error }, false, { url: x.url });
    }
    case 'wp-plugin': {
      if (!d) return recusa('Escolha o domínio.');
      const p = linha(c.plugin);
      const op = String(c.op);
      const x = op === 'atualizar-todos' ? await updateAllWpPlugins(d) : op === 'atualizar' ? await updateWpPlugin(d, p) : await toggleWpPlugin(d, p, op === 'ativar');
      return resposta({ ok: x.ok, error: x.output });
    }
    case 'wp-nucleo': {
      if (!d) return recusa('Escolha o domínio.');
      const raiz = raizSite(srv, conta, d);
      const op = String(c.op);
      const args =
        op === 'atualizar'
          ? 'core update && sudo -u ' + conta + ` /usr/local/bin/wp --path=${q(raiz)} core update-db`
          : op === 'auto'
            ? `config set WP_AUTO_UPDATE_CORE ${c.valor === 'true' ? 'true' : c.valor === 'false' ? 'false' : "'minor'"} --raw`
            : '';
      if (!args) return recusa('Operação inválida.');
      const out = await executeServerCommand(`sudo -u ${conta} /usr/local/bin/wp --path=${q(raiz)} ${args} 2>&1`, { timeoutMs: 180_000 });
      const falhou = /error:|fatal/i.test(out) && !/success/i.test(out);
      return resposta({ ok: !falhou, error: out.slice(0, 300) });
    }

    // ---------- Antivírus (ClamAV): análise em segundo plano, relatório guardado ----------
    case 'clamav-analisar': {
      const alvo = String(c.alvo);
      const rel = linha(c.caminho).replace(/^\/+|\/+$/g, '');
      if (alvo === 'outro' && (!rel || !/^[A-Za-z0-9._ /-]{1,200}$/.test(rel) || rel.split('/').some((s) => s === '..'))) return recusa('Caminho inválido (dentro da sua pasta, ex.: web/exemplo.com/public_html).');
      const caminho = ({ casa: `/home/${conta}`, sites: `/home/${conta}/web`, mail: `/home/${conta}/mail`, outro: `/home/${conta}/${rel}` } as Record<string, string>)[alvo];
      if (!caminho) return recusa('Escolha o que analisar.');
      const id = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
      const P = `${VHOST_DIR}/${conta}/clamav`;
      // relatório: caminho, data, ficheiros infetados (linha "ficheiro: Assinatura FOUND"), estado
      const script = `mkdir -p ${P} && chmod 700 ${VHOST_DIR}/${conta} ${P} && (nohup bash -c ${q(
        `t=$(date '+%Y-%m-%d %H:%M'); echo '{"id":"${id}","caminho":"${caminho}","inicio":"'"$t"'","estado":"a analisar","infetados":[]}' > ${P}/${id}.json; ` +
          `clamdscan --fdpass --multiscan --infected --no-summary ${q(caminho)} > ${P}/${id}.log 2>&1; code=$?; ` +
          `python3 -c 'import json,sys; l=[x.rsplit(": ",1) for x in open(sys.argv[1]).read().splitlines() if x.endswith(" FOUND")]; e=json.load(open(sys.argv[2])); e["infetados"]=[{"ficheiro":a,"ameaca":b[:-6]} for a,b in l][:500]; e["estado"]="terminada" if int(sys.argv[3]) in (0,1) else "erro"; e["fim"]=__import__("time").strftime("%Y-%m-%d %H:%M"); json.dump(e,open(sys.argv[2],"w"))' ${P}/${id}.log ${P}/${id}.json $code; rm -f ${P}/${id}.log`,
      )} >/dev/null 2>&1 &); echo ok`;
      await executeServerCommand(script, { timeoutMs: 20_000 });
      return resposta({ ok: true }, false, { id });
    }
    case 'clamav-apagar': {
      const ids = lista(c.ids).filter((x) => /^\d{14}$/.test(x));
      if (!ids.length) return recusa('Escolha pelo menos um relatório.');
      await executeServerCommand(ids.map((id) => `rm -f ${VHOST_DIR}/${conta}/clamav/${id}.json`).join('; '), { timeoutMs: 20_000 });
      return resposta({ ok: true });
    }
  }
  return recusa('Ação desconhecida.');
}
