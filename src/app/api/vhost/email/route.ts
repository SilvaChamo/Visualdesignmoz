import { NextRequest, NextResponse } from 'next/server';
import { requirePanelBootstrapAccess } from '@/lib/panel-api-auth';
import { executeServerCommand } from '@/lib/server-ssh-exec';
import { hestiaCall } from '@/lib/hestia-client';
import { esquecerLeitura, lerServidor, type LeituraServidor } from '@/lib/vhost-servidor';
import { lerRegisto, montarDados } from '@/lib/vhost-dados';
import { COPIAR_PY, FERIAS_PY, RASTREIO_PY, VHOST_DIR } from '@/lib/vhost-email-scripts';

export const dynamic = 'force-dynamic';

/**
 * /api/vhost/email — Menu E-mail do painel VisualHost (Hestia: exim + dovecot).
 * GET  ?conta=&d=                    domínio de e-mail (anti-spam, antivírus, DKIM…), contas (uso, limite por hora,
 *                                    reencaminhamentos, resposta automática), envios de hoje, listas, férias, bloqueios
 * GET  ?conta=&d=&resposta=<conta>   texto da resposta automática de uma caixa
 * GET  ?conta=&d=&rastreio=1&de=&ate=&end=&estado=&dir=&max=   percurso dos e-mails do domínio (registos do exim)
 * GET  ?conta=&d=&migracoes=1        migrações de caixas (importar/exportar) deste domínio e o seu estado
 * POST { acao, conta, dominio, … }   alterações (só nas contas que a sessão pode ver)
 * O que o Hestia não guarda (listas de correio, férias, bloqueios) fica em /usr/local/vhost/email/<conta>.json.
 */

const DOM = /^(?=.{3,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;
const CONTA = /^[a-z0-9][a-z0-9_.-]{0,31}$/;
const CAIXA = /^[a-z0-9]([a-z0-9._-]{0,62}[a-z0-9])?$/;
const EMAIL = /^[^\s@,;:"'<>()]+@([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
const HOST = /^[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?$/i;
const H = '/usr/local/hestia/bin';
const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64');
const q = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;
const linha = (v: unknown) => String(v ?? '').replace(/[\r\n]/g, ' ').trim();
const MARCA_EXIM = '# VisualHost: bloqueios por domínio';

type Sessao = { userId: string; email: string; role: string };
type Extra = { listas?: Record<string, string[]>; ferias?: { d: string; acc: string; de: string; ate: string; msg: string; ativa?: boolean }[] };

async function sessao(): Promise<{ s: Sessao } | { erro: NextResponse }> {
  const auth = await requirePanelBootstrapAccess();
  if ('error' in auth) return { erro: NextResponse.json({ erro: 'Inicie sessão no site.' }, { status: auth.error.status }) };
  return { s: { userId: auth.user.id, email: auth.user.email || '', role: auth.user.role } };
}

/** A conta tem de estar entre as que a sessão vê, e o domínio tem de ser dela (site ou e-mail) */
async function verificar(s: Sessao, conta: string, d: string, srv: LeituraServidor): Promise<string | null> {
  if (!CONTA.test(conta) || !DOM.test(d)) return 'Conta ou domínio inválido.';
  const dados = montarDados(srv, await lerRegisto(), s);
  if (!dados.contas[conta]) return 'Conta fora do seu painel.';
  if (!srv.web[conta]?.[d] && !srv.mail[conta]?.[d]) return 'Esse domínio não é desta conta.';
  return null;
}

function secoes(out: string): Map<string, string> {
  const m = new Map<string, string>();
  let cur = '';
  for (const l of out.split('\n')) {
    if (l.startsWith('@@')) {
      cur = l.slice(2).trim();
      m.set(cur, '');
    } else if (cur) m.set(cur, m.get(cur) + l + '\n');
  }
  return m;
}
const json = <T,>(t: string | undefined, vazio: T): T => {
  try {
    return t && t.trim() ? (JSON.parse(t) as T) : vazio;
  } catch {
    return vazio;
  }
};

const ficheiroExtra = (conta: string) => `${VHOST_DIR}/email/${conta}.json`;
async function lerExtra(conta: string): Promise<Extra> {
  return json<Extra>(await executeServerCommand(`cat ${q(ficheiroExtra(conta))} 2>/dev/null`, { timeoutMs: 20_000 }), {});
}
async function gravarExtra(conta: string, x: Extra) {
  const f = ficheiroExtra(conta);
  await executeServerCommand(`mkdir -p ${VHOST_DIR}/email && chmod 700 ${VHOST_DIR} ${VHOST_DIR}/email && echo ${b64(JSON.stringify(x))} | base64 -d > ${q(f + '.tmp')} && chmod 600 ${q(f + '.tmp')} && mv ${q(f + '.tmp')} ${q(f)}`, { timeoutMs: 20_000 });
}

/** Garante o programa das férias e a linha do cron (de 15 em 15 min), e corre-o já uma vez */
async function correrFerias() {
  const cron = `*/15 * * * * root /usr/bin/python3 ${VHOST_DIR}/ferias.py >/dev/null 2>&1\n`;
  return executeServerCommand(
    `mkdir -p ${VHOST_DIR} && echo ${b64(FERIAS_PY)} | base64 -d > ${VHOST_DIR}/ferias.py && chmod 700 ${VHOST_DIR}/ferias.py && echo ${b64(cron)} | base64 -d > /etc/cron.d/vhost-ferias && chmod 644 /etc/cron.d/vhost-ferias && /usr/bin/python3 ${VHOST_DIR}/ferias.py; echo ok`,
    { timeoutMs: 40_000 },
  );
}

export async function GET(req: NextRequest) {
  const r = await sessao();
  if ('erro' in r) return r.erro;
  const sp = req.nextUrl.searchParams;
  const conta = sp.get('conta') || '';
  const d = (sp.get('d') || '').toLowerCase();
  const srv = await lerServidor();
  const e = await verificar(r.s, conta, d, srv);
  if (e) return NextResponse.json({ erro: e }, { status: 403 });
  const semCache = { headers: { 'Cache-Control': 'no-store' } };

  // texto da resposta automática de uma caixa
  const resp = sp.get('resposta');
  if (resp) {
    if (!CAIXA.test(resp)) return NextResponse.json({ erro: 'Caixa inválida.' }, { status: 400 });
    const out = await executeServerCommand(`${H}/v-list-mail-account-autoreply ${conta} ${d} ${resp} json 2>/dev/null`, { timeoutMs: 20_000 });
    const x = json<Record<string, { MSG?: string }>>(out, {});
    return NextResponse.json({ mensagem: Object.values(x)[0]?.MSG || '' }, semCache);
  }

  // rastreio: só leitura dos registos do exim, só mensagens deste domínio
  if (sp.get('rastreio')) {
    const hoje = new Date().toISOString().slice(0, 10);
    const data = (v: string | null, def: string) => (v && /^\d{4}-\d\d-\d\d$/.test(v) ? v : def);
    const args = {
      d,
      de: data(sp.get('de'), hoje),
      ate: data(sp.get('ate'), hoje),
      end: (sp.get('end') || '').toLowerCase().replace(/[^a-z0-9@._+-]/g, '').slice(0, 120),
      estado: ['entregue', 'adiada', 'falhou', 'recebida'].includes(sp.get('estado') || '') ? sp.get('estado') : '',
      dir: ['entrada', 'saida'].includes(sp.get('dir') || '') ? sp.get('dir') : '',
      max: Math.min(500, Math.max(10, Number(sp.get('max')) || 100)),
    };
    const out = await executeServerCommand(`echo ${b64(RASTREIO_PY)} | base64 -d > /tmp/vhost-rastreio.py && python3 /tmp/vhost-rastreio.py ${q(JSON.stringify(args))}; rm -f /tmp/vhost-rastreio.py`, { timeoutMs: 60_000 });
    return NextResponse.json({ mensagens: json<unknown[]>(out.split('\n').find((l) => l.startsWith('[')), []) }, semCache);
  }

  // migrações deste domínio (os acessos nunca são guardados: o ficheiro .cfg apaga-se ao começar)
  if (sp.get('migracoes')) {
    const out = await executeServerCommand(`for f in ${VHOST_DIR}/imapsync/${conta}/*.json; do [ -f "$f" ] && { cat "$f"; echo; }; done 2>/dev/null`, { timeoutMs: 20_000 });
    type Mig = { id: string; origem: string; destino: string; pid?: number; estado: string };
    const lista = out
      .split('\n')
      .map((l) => json<Mig | null>(l, null))
      .filter((m): m is Mig => !!m && (m.origem.endsWith('@' + d) || m.destino.endsWith('@' + d)));
    // as que dizem "a copiar" mas cujo processo já não existe: ficaram a meio
    const vivos = lista.filter((m) => m.pid && /^a (copiar|ligar)$/.test(m.estado));
    if (vivos.length) {
      const ps = await executeServerCommand(`for p in ${vivos.map((m) => Number(m.pid)).join(' ')}; do kill -0 $p 2>/dev/null && echo $p; done`, { timeoutMs: 20_000 });
      const vivosPs = new Set(ps.split('\n').map((x) => x.trim()));
      for (const m of vivos) if (!vivosPs.has(String(m.pid))) m.estado = 'interrompida';
    }
    return NextResponse.json({ migracoes: lista.sort((a, b) => b.id.localeCompare(a.id)) }, semCache);
  }

  // domínio de e-mail + caixas + envios de hoje + o que o VisualHost guarda
  const temMail = !!srv.mail[conta]?.[d];
  const hoje = new Date().toISOString().slice(0, 10);
  const out = await executeServerCommand(
    [
      temMail ? `echo @@DOM; ${H}/v-list-mail-domain ${conta} ${d} json` : '',
      temMail ? `echo @@ACC; ${H}/v-list-mail-accounts ${conta} ${d} json` : '',
      temMail ? `echo @@LIM; cat /etc/exim4/domains/${d}/limits 2>/dev/null` : '',
      temMail ? `echo @@BLK; cat /etc/exim4/domains/${d}/vhost_block 2>/dev/null` : '',
      temMail ? `echo @@ENV; grep -h '^${hoje} ' /var/log/exim4/mainlog 2>/dev/null | grep ' <= ' | grep -o 'A=dovecot_[a-z]*:[^ ]*@${d.replace(/\./g, '\\.')}' | cut -d: -f2 | sort | uniq -c` : '',
      `echo @@EXIM; grep -c ${q(MARCA_EXIM)} /etc/exim4/exim4.conf.template 2>/dev/null`,
      `echo @@EXTRA; cat ${q(ficheiroExtra(conta))} 2>/dev/null`,
      'echo @@FIM',
    ]
      .filter(Boolean)
      .join('; '),
    { timeoutMs: 30_000 },
  );
  const sec = secoes(out);
  const dom = (Object.values(json<Record<string, Record<string, string>>>(sec.get('DOM'), {}))[0] || {}) as Record<string, string>;
  const limites = new Map((sec.get('LIM') || '').split('\n').map((l) => l.trim().split(':')).filter((x) => x.length === 2).map(([a, b]) => [a, b]));
  const enviados = new Map((sec.get('ENV') || '').split('\n').map((l) => l.trim().match(/^(\d+)\s+([^@\s]+)@/)).filter((x): x is RegExpMatchArray => !!x).map((x) => [x[2].toLowerCase(), Number(x[1])]));
  const extra = json<Extra>(sec.get('EXTRA'), {});
  const sim = (v?: string) => (v || '').toLowerCase() === 'yes';
  const caixas = Object.entries(json<Record<string, Record<string, string>>>(sec.get('ACC'), {})).map(([nome, x]) => ({
    nome,
    usadoMb: Number(x.U_DISK) || 0,
    quotaMb: /unlimited/i.test(x.QUOTA || '') ? 0 : Number(x.QUOTA) || 0,
    limiteHora: Number(limites.get(nome)) || 0,
    enviadosHoje: enviados.get(nome) || 0,
    fwd: (x.FWD || '').split(',').map((s) => s.trim()).filter(Boolean),
    soReencaminha: sim(x.FWD_ONLY),
    alias: (x.ALIAS || '').split(',').map((s) => s.trim()).filter(Boolean),
    resposta: sim(x.AUTOREPLY),
    suspensa: sim(x.SUSPENDED),
    criada: x.DATE || '',
  }));
  return NextResponse.json(
    {
      temMail,
      dominio: temMail
        ? { antispam: sim(dom.ANTISPAM), antivirus: sim(dom.ANTIVIRUS), dkim: sim(dom.DKIM), rejeitarSpam: sim(dom.REJECT), catchall: dom.CATCHALL || '', webmail: dom.WEBMAIL || '', limiteHora: Number(dom.RATE_LIMIT) || 0, suspenso: sim(dom.SUSPENDED) }
        : null,
      caixas,
      listas: extra.listas?.[d] || [],
      ferias: (extra.ferias || []).filter((f) => f.d === d).map(({ acc, de, ate, msg, ativa }) => ({ acc, de, ate, msg, ativa: !!ativa })),
      bloqueios: (sec.get('BLK') || '').split('\n').map((l) => l.trim()).filter(Boolean),
      regraBloqueios: Number((sec.get('EXIM') || '').trim()) > 0,
    },
    semCache,
  );
}

type Corpo = { acao: string; conta: string; dominio: string; [k: string]: unknown };

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
  const d = String(c.dominio || '').toLowerCase();
  const srv = await lerServidor();
  const e = await verificar(r.s, conta, d, srv);
  if (e) return NextResponse.json({ erro: e }, { status: 403 });
  const recusa = (erro: string, status = 400) => NextResponse.json({ erro }, { status });
  const call = async (cmd: string, args: string[]) => {
    const x = await hestiaCall(cmd, args);
    return { ok: x.ok, error: x.error };
  };
  // `esquecer`: a alteração muda o que a leitura geral do servidor mostra (caixas, uso, domínios)
  const resposta = (x: { ok: boolean; error?: string }, esquecer = true, mais: Record<string, unknown> = {}) => {
    if (x.ok && esquecer) esquecerLeitura();
    return NextResponse.json(x.ok ? { ok: true, ...mais } : { erro: x.error || 'O servidor recusou.' }, { status: x.ok ? 200 : 400 });
  };
  /** Corre vários comandos do Hestia por ordem; pára no primeiro que falhe */
  const seguidos = async (cmds: [string, string[]][]) => {
    for (const [cmd, args] of cmds) {
      const x = await call(cmd, args);
      if (!x.ok) return x;
    }
    return { ok: true };
  };
  const temMail = !!srv.mail[conta]?.[d];
  const caixas = srv.mailAcc[conta]?.[d] || {};
  const caixa = (v: unknown) => {
    const n = linha(v).toLowerCase();
    return CAIXA.test(n) ? n : '';
  };
  const lista = (v: unknown) => (Array.isArray(v) ? v : String(v ?? '').split(/[\s,;]+/)).map((x) => linha(x).toLowerCase()).filter(Boolean);
  const senhaOk = (v: unknown) => String(v ?? '').length >= 8 && !/[\r\n]/.test(String(v));
  const quota = (v: unknown) => (v === 'unlimited' || v === 0 || v === '0' || v === '' || v == null ? 'unlimited' : /^\d{1,7}$/.test(String(v)) ? String(v) : null);
  const limite = (v: unknown) => (v === '' || v == null || v === 0 || v === '0' ? null : /^\d{1,6}$/.test(String(v)) ? String(v) : 'x');

  if (c.acao === 'dominio-ligar') {
    if (temMail) return recusa('Este domínio já tem e-mail neste servidor.');
    return resposta(await call('v-add-mail-domain', [conta, d]));
  }
  if (!temMail) return recusa('Este domínio ainda não tem e-mail neste servidor.');

  switch (c.acao) {
    // ---------- Contas ----------
    case 'conta-criar': {
      const u = caixa(c.user);
      if (!u) return recusa('Nome da conta inválido: letras minúsculas, números, ponto, hífen ou _.');
      if (caixas[u]) return recusa('Essa conta já existe.');
      if (!senhaOk(c.senha)) return recusa('A palavra-passe precisa de pelo menos 8 caracteres.');
      const qt = quota(c.quota);
      const lim = limite(c.limite);
      if (!qt || lim === 'x') return recusa('Quota ou limite inválido.');
      const x = await call('v-add-mail-account', [conta, d, u, String(c.senha), qt]);
      if (x.ok && lim) await call('v-change-mail-account-rate-limit', [conta, d, u, lim]);
      return resposta(x);
    }
    case 'conta-senha': {
      const u = caixa(c.user);
      if (!caixas[u]) return recusa('Conta inexistente.');
      if (!senhaOk(c.senha)) return recusa('A palavra-passe precisa de pelo menos 8 caracteres.');
      return resposta(await call('v-change-mail-account-password', [conta, d, u, String(c.senha)]), false);
    }
    case 'conta-limites': {
      const u = caixa(c.user);
      if (!caixas[u]) return recusa('Conta inexistente.');
      const qt = quota(c.quota);
      const lim = limite(c.limite);
      if (!qt || lim === 'x') return recusa('Quota ou limite inválido.');
      return resposta(await seguidos([['v-change-mail-account-quota', [conta, d, u, qt]], ['v-change-mail-account-rate-limit', [conta, d, u, lim || 'unlimited']]]));
    }
    case 'contas-suspender':
    case 'contas-reativar':
    case 'contas-apagar': {
      const us = lista(c.users).filter((u) => caixas[u]);
      if (!us.length) return recusa('Escolha pelo menos uma conta.');
      const cmd = c.acao === 'contas-suspender' ? 'v-suspend-mail-account' : c.acao === 'contas-reativar' ? 'v-unsuspend-mail-account' : 'v-delete-mail-account';
      return resposta(await seguidos(us.map((u) => [cmd, [conta, d, u]])));
    }
    case 'contas-purgar': {
      // apaga mensagens (todas ou só as mais antigas que N dias) numa pasta; depois atualiza o uso
      const us = lista(c.users).filter((u) => caixas[u]);
      if (!us.length) return recusa('Escolha pelo menos uma conta.');
      const pasta = ({ todas: '*', entrada: 'INBOX', lixo: 'Trash', spam: 'Junk', enviadas: 'Sent' } as Record<string, string>)[String(c.pasta)];
      const dias = Number(c.dias) || 0;
      if (!pasta || dias < 0 || dias > 3650) return recusa('Pasta ou número de dias inválido.');
      const filtro = dias ? `savedbefore ${Math.floor(dias)}d` : 'all';
      await executeServerCommand(us.map((u) => `doveadm expunge -u ${q(u + '@' + d)} mailbox ${q(pasta)} ${filtro}`).join('; ') + `; ${H}/v-update-mail-domain-disk ${conta} ${d}; echo ok`, { timeoutMs: 120_000 });
      return resposta({ ok: true });
    }
    case 'dkim': {
      const ligar = !!c.ligar;
      return resposta(await call(ligar ? 'v-add-mail-domain-dkim' : 'v-delete-mail-domain-dkim', [conta, d]));
    }

    // ---------- Reencaminhamentos (no Hestia: caixa com destinos e, se for só isso, "só reencaminhar") ----------
    case 'fwd-criar': {
      const nomes = lista(c.nomes).map((n) => n.replace(/@.*$/, ''));
      const dest = lista(c.destinos);
      if (!nomes.length || nomes.some((n) => !CAIXA.test(n))) return recusa('Nome do reencaminhamento inválido.');
      if (!dest.length || dest.some((x) => !EMAIL.test(x))) return recusa('Destino inválido: escreva endereços de e-mail completos.');
      if (dest.some((x) => nomes.some((n) => x === n + '@' + d))) return recusa('Um reencaminhamento não pode enviar para si próprio.');
      const cmds: [string, string[]][] = [];
      for (const n of nomes) {
        const existe = caixas[n];
        // nome novo: caixa só para reencaminhar; conta que já existe: guarda cópia se pedido ("copia")
        if (!existe) cmds.push(['v-add-mail-account', [conta, d, n, senhaAleatoria(), '1']]);
        for (const x of dest) if (!existe || !(existe.FWD || '').split(',').includes(x)) cmds.push(['v-add-mail-account-forward', [conta, d, n, x]]);
        if (!existe || (!c.copia && existe.FWD_ONLY !== 'yes')) cmds.push(['v-add-mail-account-fwd-only', [conta, d, n]]);
      }
      return resposta(await seguidos(cmds));
    }
    case 'fwd-editar': {
      const n = caixa(c.nome);
      const atual = caixas[n];
      if (!atual) return recusa('Reencaminhamento inexistente.');
      const dest = lista(c.destinos);
      if (!dest.length || dest.some((x) => !EMAIL.test(x))) return recusa('Destino inválido.');
      const antes = (atual.FWD || '').split(',').map((x) => x.trim()).filter(Boolean);
      const cmds: [string, string[]][] = [
        ...dest.filter((x) => !antes.includes(x)).map((x): [string, string[]] => ['v-add-mail-account-forward', [conta, d, n, x]]),
        ...antes.filter((x) => !dest.includes(x)).map((x): [string, string[]] => ['v-delete-mail-account-forward', [conta, d, n, x]]),
      ];
      return resposta(await seguidos(cmds));
    }
    case 'fwd-apagar': {
      // tira os destinos; se a caixa só servia para reencaminhar e está vazia, apaga-a também
      const ns = lista(c.nomes).filter((n) => caixas[n]);
      if (!ns.length) return recusa('Escolha pelo menos um reencaminhamento.');
      const cmds: [string, string[]][] = [];
      for (const n of ns) {
        const x = caixas[n];
        if (x.FWD_ONLY === 'yes' && !(Number(x.U_DISK) > 0)) cmds.push(['v-delete-mail-account', [conta, d, n]]);
        else {
          for (const f of (x.FWD || '').split(',').map((s) => s.trim()).filter(Boolean)) cmds.push(['v-delete-mail-account-forward', [conta, d, n, f]]);
          if (x.FWD_ONLY === 'yes') cmds.push(['v-delete-mail-account-fwd-only', [conta, d, n]]);
        }
      }
      return resposta(await seguidos(cmds));
    }

    // ---------- Respostas automáticas ----------
    case 'resposta-guardar': {
      const u = caixa(c.user);
      if (!caixas[u]) return recusa('Escolha uma conta que exista.');
      const msg = String(c.mensagem || '').replace(/\r/g, '').trim();
      if (!msg || msg.length > 5000) return recusa('Escreva a mensagem (até 5000 caracteres).');
      const ex = await lerExtra(conta);
      if ((ex.ferias || []).some((f) => f.d === d && f.acc === u)) return recusa('Esta conta tem uma mensagem de férias marcada; apague-a primeiro.');
      return resposta(await call('v-add-mail-account-autoreply', [conta, d, u, msg]));
    }
    case 'resposta-apagar': {
      const us = lista(c.users).filter((u) => caixas[u]);
      if (!us.length) return recusa('Escolha pelo menos uma resposta.');
      return resposta(await seguidos(us.map((u) => ['v-delete-mail-account-autoreply', [conta, d, u]])));
    }

    // ---------- Mensagens de férias (a resposta automática ligada e desligada nas datas) ----------
    case 'ferias-guardar': {
      const u = caixa(c.user);
      if (!caixas[u]) return recusa('Escolha uma conta que exista.');
      const de = linha(c.de);
      const ate = linha(c.ate);
      const dt = /^\d{4}-\d\d-\d\dT\d\d:\d\d$/;
      if (!dt.test(de) || !dt.test(ate) || ate <= de) return recusa('Datas inválidas: o fim tem de ser depois do início.');
      const msg = String(c.mensagem || '').replace(/\r/g, '').trim();
      if (!msg || msg.length > 5000) return recusa('Escreva a mensagem (até 5000 caracteres).');
      const ex = await lerExtra(conta);
      const outras = (ex.ferias || []).filter((f) => !(f.d === d && f.acc === u));
      const antiga = (ex.ferias || []).find((f) => f.d === d && f.acc === u);
      if (!antiga && caixas[u].AUTOREPLY === 'yes') return recusa('Esta conta já tem uma resposta automática; apague-a primeiro.');
      ex.ferias = [...outras, { d, acc: u, de, ate, msg, ativa: false }];
      await gravarExtra(conta, ex);
      // se a anterior já estava ligada, desliga-se para o programa voltar a ligar com o texto novo
      if (antiga?.ativa) await call('v-delete-mail-account-autoreply', [conta, d, u]);
      await correrFerias();
      return resposta({ ok: true });
    }
    case 'ferias-apagar': {
      const us = lista(c.users);
      const ex = await lerExtra(conta);
      const sai = (ex.ferias || []).filter((f) => f.d === d && us.includes(f.acc));
      if (!sai.length) return recusa('Escolha pelo menos uma mensagem.');
      ex.ferias = (ex.ferias || []).filter((f) => !sai.includes(f));
      await gravarExtra(conta, ex);
      for (const f of sai) if (f.ativa) await call('v-delete-mail-account-autoreply', [conta, d, f.acc]);
      return resposta({ ok: true });
    }

    // ---------- Catch-all (e-mail para endereços que não existem) ----------
    case 'catchall': {
      const destino = linha(c.destino).toLowerCase();
      if (destino && !EMAIL.test(destino)) return recusa('Endereço inválido.');
      if (!destino) {
        const x = await call('v-delete-mail-domain-catchall', [conta, d]);
        return resposta(x.ok || /exist|found/i.test(x.error || '') ? { ok: true } : x);
      }
      const x = await call(srv.mail[conta]?.[d]?.CATCHALL && !/^(no|)$/i.test(srv.mail[conta][d].CATCHALL) ? 'v-change-mail-domain-catchall' : 'v-add-mail-domain-catchall', [conta, d, destino]);
      if (!x.ok && /exist/i.test(x.error || '')) return resposta(await call('v-change-mail-domain-catchall', [conta, d, destino]));
      return resposta(x);
    }

    // ---------- Filtros anti-spam ----------
    case 'antispam':
      return resposta(await call(c.ligar ? 'v-add-mail-domain-antispam' : 'v-delete-mail-domain-antispam', [conta, d]));
    case 'antivirus':
      return resposta(await call(c.ligar ? 'v-add-mail-domain-antivirus' : 'v-delete-mail-domain-antivirus', [conta, d]));
    case 'rejeitar-spam':
      return resposta(await call(c.ligar ? 'v-add-mail-domain-reject' : 'v-delete-mail-domain-reject', [conta, d]));
    case 'bloqueio-juntar':
    case 'bloqueio-tirar': {
      // ficheiro lido pela regra do exim: "endereço@exemplo.com" ou "@exemplo.com" (domínio inteiro)
      const v = lista(c.valores).map((x) => (c.tipo === 'dominio' && !x.startsWith('@') ? '@' + x : x));
      if (!v.length || v.some((x) => !(EMAIL.test(x) || (/^@/.test(x) && DOM.test(x.slice(1)))))) return recusa('Escreva um endereço (nome@exemplo.com) ou um domínio (exemplo.com).');
      const f = `/etc/exim4/domains/${d}/vhost_block`;
      const atual = (await executeServerCommand(`cat ${f} 2>/dev/null`, { timeoutMs: 20_000 })).split('\n').map((l) => l.trim()).filter(Boolean);
      const novo = c.acao === 'bloqueio-juntar' ? [...new Set([...atual, ...v])] : atual.filter((x) => !v.includes(x));
      await executeServerCommand(`echo ${b64(novo.join('\n') + (novo.length ? '\n' : ''))} | base64 -d > ${f}.tmp && chown Debian-exim:mail ${f}.tmp && chmod 640 ${f}.tmp && mv ${f}.tmp ${f}`, { timeoutMs: 20_000 });
      return resposta({ ok: true }, false);
    }
    case 'bloqueios-ativar': {
      // só o administrador: acrescenta a regra ao exim (com cópia), confirma que o exim a aceita e reinicia; se não aceitar, repõe
      if (r.s.role !== 'admin') return recusa('Só o administrador do servidor pode ativar esta regra.', 403);
      const regra = [
        `  ${MARCA_EXIM} (/etc/exim4/domains/<domínio>/vhost_block, gerido pelo painel)`,
        '  deny    message       = Rejected by recipient filter',
        '          condition     = ${if exists{/etc/exim4/domains/$domain/vhost_block}}',
        '          condition     = ${lookup{${lc:$sender_address}}lsearch{/etc/exim4/domains/$domain/vhost_block}{yes}{${lookup{@${lc:$sender_address_domain}}lsearch{/etc/exim4/domains/$domain/vhost_block}{yes}{no}}}}',
        '',
      ].join('\n');
      const T = '/etc/exim4/exim4.conf.template';
      const out = await executeServerCommand(
        `set -e; grep -q ${q(MARCA_EXIM)} ${T} && { echo JA; exit 0; }; cp -p ${T} ${T}.vhost-antes-$(date +%Y%m%d%H%M%S); ` +
          `echo ${b64(regra)} | base64 -d > /tmp/vhost-regra; ` +
          `awk 'BEGIN{f=0} {print} /^acl_check_rcpt:/{a=1} a==1 && /accept +hosts += +:/ && f==0 {while((getline l < "/tmp/vhost-regra")>0) print l; f=1; a=0}' ${T} > ${T}.novo; ` +
          `grep -q ${q(MARCA_EXIM)} ${T}.novo || { rm -f ${T}.novo /tmp/vhost-regra; echo SEM_SITIO; exit 0; }; ` +
          `cp ${T} ${T}.bak-vhost; mv ${T}.novo ${T}; rm -f /tmp/vhost-regra; ` +
          `if update-exim4.conf >/dev/null 2>&1 && exim4 -bV >/dev/null 2>&1; then systemctl restart exim4 && echo FEITO; else mv ${T}.bak-vhost ${T}; update-exim4.conf >/dev/null 2>&1; echo RECUSADA; fi; rm -f ${T}.bak-vhost`,
        { timeoutMs: 90_000 },
      );
      if (/JA|FEITO/.test(out)) return resposta({ ok: true }, false);
      return recusa(/SEM_SITIO/.test(out) ? 'Não encontrei o sítio da regra na configuração do exim; nada foi mudado.' : 'O exim recusou a regra; a configuração anterior foi reposta.', 500);
    }

    // ---------- Listas de correio (uma caixa "só reencaminhar" para todos os subscritores) ----------
    case 'lista-criar': {
      const n = caixa(c.nome);
      const subs = lista(c.subscritores);
      if (!n) return recusa('Nome da lista inválido.');
      if (caixas[n]) return recusa('Já existe uma conta ou reencaminhamento com esse nome.');
      if (!subs.length || subs.some((x) => !EMAIL.test(x))) return recusa('Indique pelo menos um subscritor (endereço completo).');
      const x = await seguidos([['v-add-mail-account', [conta, d, n, senhaAleatoria(), '1']], ...subs.map((s): [string, string[]] => ['v-add-mail-account-forward', [conta, d, n, s]]), ['v-add-mail-account-fwd-only', [conta, d, n]]]);
      if (x.ok) {
        const ex = await lerExtra(conta);
        ex.listas = { ...(ex.listas || {}), [d]: [...new Set([...(ex.listas?.[d] || []), n])] };
        await gravarExtra(conta, ex);
      }
      return resposta(x);
    }
    case 'lista-subscritores': {
      const n = caixa(c.nome);
      const ex = await lerExtra(conta);
      if (!caixas[n] || !(ex.listas?.[d] || []).includes(n)) return recusa('Lista inexistente.');
      const juntar = lista(c.juntar);
      const tirar = lista(c.tirar);
      if (juntar.some((x) => !EMAIL.test(x))) return recusa('Há endereços inválidos.');
      const antes = (caixas[n].FWD || '').split(',').map((x) => x.trim()).filter(Boolean);
      if (antes.filter((x) => !tirar.includes(x)).length + juntar.filter((x) => !antes.includes(x)).length === 0) return recusa('A lista tem de ficar com pelo menos um subscritor.');
      return resposta(
        await seguidos([
          ...juntar.filter((x) => !antes.includes(x)).map((x): [string, string[]] => ['v-add-mail-account-forward', [conta, d, n, x]]),
          ...tirar.filter((x) => antes.includes(x)).map((x): [string, string[]] => ['v-delete-mail-account-forward', [conta, d, n, x]]),
        ]),
      );
    }
    case 'lista-apagar': {
      const ns = lista(c.nomes);
      const ex = await lerExtra(conta);
      const minhas = (ex.listas?.[d] || []).filter((n) => ns.includes(n));
      if (!minhas.length) return recusa('Escolha pelo menos uma lista.');
      const x = await seguidos(minhas.filter((n) => caixas[n]).map((n) => ['v-delete-mail-account', [conta, d, n]]));
      if (x.ok) {
        ex.listas = { ...(ex.listas || {}), [d]: (ex.listas?.[d] || []).filter((n) => !minhas.includes(n)) };
        await gravarExtra(conta, ex);
      }
      return resposta(x);
    }

    // ---------- Migração de e-mail (IMAP → IMAP, em segundo plano) ----------
    case 'migracao-iniciar': {
      const tipo = c.tipo === 'exportar' ? 'exportar' : 'importar';
      const local = caixa(c.local);
      const host = linha(c.host).toLowerCase();
      const user = linha(c.user);
      if (!caixas[local]) return recusa('Escolha uma conta deste domínio.');
      if (!HOST.test(host) || /^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) return recusa('Servidor inválido (ex.: mail.exemplo.com).');
      if (!user || user.length > 200 || /\s/.test(user)) return recusa('Utilizador do outro servidor inválido.');
      if (!c.senha || !c.senhaLocal || /[\r\n]/.test(String(c.senha) + String(c.senhaLocal))) return recusa('Escreva as duas palavras-passe.');
      const id = new Date().toISOString().replace(/\D/g, '').slice(0, 14) + '-' + Math.random().toString(36).slice(2, 6);
      const fora = { host, user, senha: String(c.senha), inseguro: !!c.inseguro };
      const aqui = { host: '127.0.0.1', user: local + '@' + d, senha: String(c.senhaLocal), local: true };
      const cfg = {
        id,
        tipo,
        origem: tipo === 'importar' ? user : local + '@' + d,
        destino: tipo === 'importar' ? local + '@' + d : user,
        servidorOrigem: tipo === 'importar' ? host : 'este servidor',
        servidorDestino: tipo === 'importar' ? 'este servidor' : host,
        o: tipo === 'importar' ? fora : aqui,
        d: tipo === 'importar' ? aqui : fora,
      };
      const P = `${VHOST_DIR}/imapsync`;
      const f = `${P}/${conta}/${id}.cfg`;
      await executeServerCommand(
        `mkdir -p ${P}/${conta} && chmod 700 ${VHOST_DIR} ${P} ${P}/${conta} && echo ${b64(COPIAR_PY)} | base64 -d > ${P}/copiar.py && chmod 700 ${P}/copiar.py && ` +
          `(umask 077; echo ${b64(JSON.stringify(cfg))} | base64 -d > ${f}) && (nohup python3 ${P}/copiar.py ${f} >/dev/null 2>&1 &) ; echo ok`,
        { timeoutMs: 30_000 },
      );
      return resposta({ ok: true }, false, { id });
    }
    case 'migracao-parar': {
      const id = linha(c.id);
      if (!/^\d{14}-[a-z0-9]{4}$/.test(id)) return recusa('Migração inválida.');
      const f = `${VHOST_DIR}/imapsync/${conta}/${id}.json`;
      await executeServerCommand(
        `p=$(python3 -c "import json,sys; print(json.load(open('${f}')).get('pid',''))" 2>/dev/null); [ -n "$p" ] && grep -q copiar.py /proc/$p/cmdline 2>/dev/null && kill $p; ` +
          `python3 -c "import json; f='${f}'; e=json.load(open(f)); e['estado']='parada'; json.dump(e, open(f,'w'))" 2>/dev/null; echo ok`,
        { timeoutMs: 20_000 },
      );
      return resposta({ ok: true }, false);
    }
    case 'migracao-apagar': {
      const id = linha(c.id);
      if (!/^\d{14}-[a-z0-9]{4}$/.test(id)) return recusa('Migração inválida.');
      await executeServerCommand(`rm -f ${VHOST_DIR}/imapsync/${conta}/${id}.json`, { timeoutMs: 20_000 });
      return resposta({ ok: true }, false);
    }
  }
  return recusa('Ação desconhecida.');
}

/** Palavra-passe para as caixas que só servem para reencaminhar (ninguém entra nelas) */
function senhaAleatoria() {
  const az = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(crypto.getRandomValues(new Uint32Array(24)), (x) => az[x % az.length]).join('') + '#9';
}
