/**
 * VisualHost — junta a leitura do servidor (Hestia) com o registo do site (Supabase) no formato do painel.
 *
 * - Papéis: conta com ROLE=admin no Hestia → Administrador; login com papel "reseller" → Revendedor;
 *   o resto é Profissional (tem sites) ou Cliente (só e-mail/domínio). Igual aos papéis do site.
 * - Quem criou cada conta: panel_users.parent_username (o revendedor); sem isso, o administrador.
 * - O que cada um vê: administrador → tudo; revendedor → a sua conta e as dos seus clientes;
 *   restantes → só a sua conta.
 */
import type { Account, BaseDados, Domain, Mailbox, Role } from '@/components/vhost/types';
import { ACME, IDIOMAS, RECURSOS, TEMAS, type InfoConta, type Lim, type PacoteUtilizador } from '@/components/vhost/paginas/dados';
import { mbTexto, type DadosServidor, type Servidor, type ZonaDns } from '@/components/vhost/servidor';
import type { LeituraServidor } from '@/lib/vhost-servidor';
import { getDaSyncAdmin } from '@/lib/da-sync-schema';

type Linha = Record<string, string>;

export type RegistoSite = {
  /** panel_users: conta → revendedor que a criou, login ligado, data */
  contas: Map<string, { parent: string | null; authUserId: string | null; criada: string | null }>;
  /** profiles por user_id e por conta do servidor (da_username) */
  perfis: Map<string, { userId: string; role: string; name: string; email: string; conta: string }>;
  /** pacote de revenda (essencial/expandido) por user_id */
  revendas: Map<string, string>;
};

export type Sessao = { userId: string; email: string; role: string };

const ilimitado = (v?: string) => !v || v.toLowerCase() === 'unlimited';
const num = (v?: string) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const limMb = (v?: string): number | null => (ilimitado(v) ? null : num(v));
const semShell = (sh?: string) => !sh || /nologin|false/i.test(sh);

/** Limite do painel a partir de um valor do Hestia (MB ou contagem) */
function lim(v: string | undefined, unidade?: 'mb'): Lim {
  if (ilimitado(v)) return { v: '', unl: true, ...(unidade ? { unit: 'GB' as const } : {}) };
  const n = num(v);
  if (unidade === 'mb') return n >= 1024 && n % 1024 === 0 ? { v: String(n / 1024), unl: false, unit: 'GB' } : { v: String(n), unl: false, unit: 'MB' };
  return { v: String(n), unl: false };
}
const livre = (): Lim => ({ v: '', unl: true });
const tem = (v?: string) => ilimitado(v) || num(v) > 0;

/** Pacote do Hestia no formato das páginas (limites, funcionalidades e recursos) */
/** Pacotes sem Mailmarketing: os de só e-mail e o básico (pedido do Silva, 10/10) */
const semMailmarketing = (nome: string) => /email|e-mail|b[aá]sico|basic/i.test(nome);

export function pacoteDoHestia(p: Linha, nome = ''): PacoteUtilizador {
  const web = tem(p.WEB_DOMAINS);
  const mail = tem(p.MAIL_DOMAINS) || tem(p.MAIL_ACCOUNTS);
  const shell = !semShell(p.SHELL);
  return {
    lim: {
      bw: lim(p.BANDWIDTH, 'mb'),
      disk: lim(p.DISK_QUOTA, 'mb'),
      inode: livre(),
      domains: lim(p.WEB_DOMAINS),
      subdomains: livre(),
      emails: lim(p.MAIL_ACCOUNTS),
      forwarders: livre(),
      lists: livre(),
      autoresponders: livre(),
      mysql: lim(p.DATABASES),
      pointers: lim(p.WEB_ALIASES),
      ftp: web ? livre() : { v: '0', unl: false },
      daily: livre(),
    },
    feats: {
      aftp: false,
      cgi: false,
      git: shell,
      wordpress: web && tem(p.DATABASES),
      clamav: mail,
      php: web,
      spam: mail,
      catchall: mail,
      ssl: web || mail,
      ssh: shell,
      cron: tem(p.CRON_JOBS),
      redis: false,
      sysinfo: true,
      loginkeys: true,
      dns: tem(p.DNS_DOMAINS),
      web,
      mailmarketing: web && mail && !semMailmarketing(nome),
      suspendlimit: true,
      securitytxt: false,
      jail: /jail/i.test(p.SHELL || ''),
    },
    tema: TEMAS[0],
    idioma: IDIOMAS[0],
    acme: ACME[0],
    rec: {
      ...Object.fromEntries(RECURSOS.map((c) => [c.k, livre()])),
      cpu: ilimitado(p.CPU_QUOTA) ? livre() : { v: p.CPU_QUOTA, unl: false },
      memmax: ilimitado(p.MEMORY_LIMIT) ? livre() : { v: p.MEMORY_LIMIT, unl: false },
    },
  };
}

const dataPt = (d?: string, t?: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` + (t ? ', ' + t.slice(0, 5) : '') : '—';
};
const php = (backend?: string) => (/(\d+)_(\d+)/.exec(backend || '') || []).slice(1, 3).join('.') || 'padrão';
const lista = (v?: string) => (v || '').split(',').map((x) => x.trim()).filter(Boolean);

function uptimeTxt(min: number): string {
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  return d ? `${d} dia${d === 1 ? '' : 's'}, ${h} h` : `${h} h ${Math.round(min % 60)} min`;
}

export function montarDados(srv: LeituraServidor, reg: RegistoSite, sessao: Sessao): DadosServidor {
  const apiUser = (process.env.HESTIA_USER || 'vdadmin').trim();
  const nomes = Object.keys(srv.users);
  const adminConta =
    nomes.find((u) => u === apiUser) || nomes.find((u) => (srv.users[u].ROLE || '').toLowerCase() === 'admin') || nomes[0] || '';

  // Conta do servidor de quem tem sessão iniciada
  const perfil = reg.perfis.get(sessao.userId);
  let me = (perfil?.conta || '').toLowerCase();
  if (!me || !srv.users[me]) me = [...reg.contas].find(([, r]) => r.authUserId === sessao.userId)?.[0] || '';
  if ((!me || !srv.users[me]) && sessao.role === 'admin') me = adminConta;

  const contas: Record<string, Account> = {};
  const info: Record<string, InfoConta> = {};
  for (const u of nomes) {
    const x = srv.users[u];
    const r = reg.contas.get(u);
    const p = (r?.authUserId && reg.perfis.get(r.authUserId)) || [...reg.perfis.values()].find((pf) => pf.conta === u);
    const web = srv.web[u] || {};
    const temSites = Object.keys(web).length > 0;
    let role: Role =
      (x.ROLE || '').toLowerCase() === 'admin' || u === apiUser || p?.role === 'admin'
        ? 'admin'
        : p?.role === 'reseller'
          ? 'revenda'
          : temSites || p?.role === 'profissional'
            ? 'profissional'
            : 'cliente';
    if (u === me && sessao.role === 'admin') role = 'admin';
    if (u === me && sessao.role === 'reseller') role = 'revenda';

    const wp = new Set(srv.wp[u] || []);
    const domains: Domain[] = Object.entries(web).map(([d, w]) => ({
      name: d,
      ssl: (w.SSL || 'no').toLowerCase() === 'yes' ? 'ok' : 'w',
      php: php(w.BACKEND),
      disk: mbTexto(num(w.U_DISK)),
      status: (w.SUSPENDED || 'no').toLowerCase() === 'yes' ? 'w' : 'ok',
      ...(wp.has(d) ? { wp: true } : {}),
      bw: mbTexto(num(w.U_BANDWIDTH)),
      aliases: lista(w.ALIAS),
      docroot: w.DOCUMENT_ROOT || `/home/${u}/web/${d}/public_html/`,
      ftp: lista(w.FTP_USER).map((f, i) => ({ user: f, path: lista(w.FTP_PATH)[i] || '' })),
      le: (w.LETSENCRYPT || 'no').toLowerCase() === 'yes',
    }));
    // domínios só de e-mail (sem site)
    for (const [d, m] of Object.entries(srv.mail[u] || {}))
      if (!web[d]) domains.push({ name: d, ssl: (m.SSL || 'no').toLowerCase() === 'yes' ? 'ok' : 'w', php: '—', disk: mbTexto(num(m.U_DISK)), status: (m.SUSPENDED || 'no').toLowerCase() === 'yes' ? 'w' : 'ok', soEmail: true });
    // Domínio principal (o usado para criar a conta) à cabeça — é o que o painel escolhe à partida em todas as páginas.
    // O Hestia não o guarda: é o mais antigo (data e hora de criação); em empate, o que tem o nome da conta.
    const criado = (d: string) => {
      const w = web[d] || srv.mail[u]?.[d];
      return w?.DATE ? w.DATE + ' ' + (w.TIME || '') : '~';
    };
    const principal = domains
      .map((x) => x.name)
      .sort((d1, d2) => criado(d1).localeCompare(criado(d2)) || Number(!d1.includes(u)) - Number(!d2.includes(u)))[0];
    if (principal) domains.sort((d1, d2) => Number(d2.name === principal) - Number(d1.name === principal));
    const dbs: BaseDados[] = Object.entries(srv.db[u] || {}).map(([nome, b]) => ({ nome, user: b.DBUSER || '', tipo: b.TYPE || 'mysql', charset: b.CHARSET || '', disco: mbTexto(num(b.U_DISK)), suspensa: (b.SUSPENDED || 'no').toLowerCase() === 'yes', criada: dataPt(b.DATE) }));

    const mails: Mailbox[] = [];
    for (const [d, contasMail] of Object.entries(srv.mailAcc[u] || {}))
      for (const [nome, m] of Object.entries(contasMail)) mails.push({ user: nome, dom: d, used: num(m.U_DISK), quota: ilimitado(m.QUOTA) ? 0 : num(m.QUOTA), sent: 0, criada: dataPt(m.DATE) });

    const revenda = role === 'revenda' && p ? reg.revendas.get(p.userId) || 'essencial' : '';
    const nome = (p?.name || x.NAME || [x.FNAME, x.LNAME].filter(Boolean).join(' ') || u).trim();
    contas[u] = {
      name: nome,
      email: p?.email || x.CONTACT || '',
      role,
      creator: r?.parent && srv.users[r.parent] ? r.parent : u === adminConta ? u : adminConta,
      pkg: revenda ? (revenda === 'expandido' ? 'Revenda Expandido' : 'Revenda Essencial') : x.PACKAGE || '',
      hpkg: x.PACKAGE || '',
      state: (x.SUSPENDED || 'no').toLowerCase() === 'yes' ? 'off' : 'ok',
      disk: mbTexto(num(x.U_DISK)),
      discoMb: num(x.U_DISK),
      discoLimMb: limMb(x.DISK_QUOTA),
      bwMb: num(x.U_BANDWIDTH),
      bwLimMb: limMb(x.BANDWIDTH),
      ns: (x.NS || '').split(',').filter(Boolean),
      domains,
      dbs,
      mails,
    };
    const ipConta = Object.values(web)[0]?.IP || Object.keys(srv.ips)[0] || '';
    info[u] = { bw: mbTexto(num(x.U_BANDWIDTH)), ip: ipConta, dbs: num(x.U_DATABASES), criada: r?.criada ? dataPt(r.criada.slice(0, 10)) : dataPt(x.DATE, x.TIME) };
  }

  // O que esta sessão pode ver
  const minha = contas[me];
  let visiveis: string[];
  if (sessao.role === 'admin') visiveis = nomes;
  else if (minha?.role === 'revenda') visiveis = nomes.filter((u) => u === me || contas[u].creator === me);
  else visiveis = me ? [me] : [];
  const ver = new Set(visiveis);
  const filtra = <T,>(o: Record<string, T>) => Object.fromEntries(Object.entries(o).filter(([k]) => ver.has(k)));

  const dns: ZonaDns[] = [];
  for (const u of visiveis)
    for (const [zona, z] of Object.entries(srv.dns[u] || {}))
      dns.push({ zona, dono: u, registos: num(z.RECORDS), dnssec: (z.DNSSEC || 'no').toLowerCase() === 'yes', suspensa: (z.SUSPENDED || 'no').toLowerCase() === 'yes', criada: dataPt(z.DATE) });

  let servidor: Servidor | null = null;
  if (sessao.role === 'admin') {
    const rc = srv.recursos;
    const gb = (b: number) => Math.round((b / 1024 ** 3) * 10) / 10;
    servidor = {
      hostname: srv.sysinfo.HOSTNAME || '',
      so: [srv.sysinfo.OS, srv.sysinfo.VERSION].filter(Boolean).join(' '),
      hestia: srv.sysinfo.HESTIA || '',
      ligadoHa: uptimeTxt(num(srv.sysinfo.UPTIME)),
      ips: Object.keys(srv.ips),
      cpus: rc.cpus,
      carga: rc.carga,
      memPct: rc.memTotal ? Math.round(((rc.memTotal - rc.memLivre) / rc.memTotal) * 1000) / 10 : 0,
      memTotalGb: gb(rc.memTotal),
      discoUsadoGb: gb(rc.discoUsado),
      discoTotalGb: gb(rc.discoTotal),
      servicos: Object.entries(srv.servicos).map(([nome, s]) => ({ nome, ativo: (s.STATE || '').toLowerCase() === 'running' })),
      nSites: Object.values(srv.web).reduce((n, w) => n + Object.keys(w).length, 0),
      nContas: nomes.length,
    };
  }

  // pacotes: administrador vê todos; os outros só os das contas que vêem
  const usados = new Set(visiveis.map((u) => contas[u].hpkg));
  const pacotes = Object.fromEntries(
    Object.entries(srv.packages)
      .filter(([n]) => n !== 'system' && (sessao.role === 'admin' || usados.has(n)))
      .map(([n, p]) => [n, pacoteDoHestia(p, n)]),
  );

  return { me, contas: filtra(contas), pacotes, info: filtra(info), dns, servidor, php: srv.php, lidoEm: srv.lidoEm };
}

/** Registo do site: que revendedor criou cada conta, que login está ligado, papéis e pacotes de revenda */
// Memória curta do registo: cada página do painel pedia-o de novo ao Supabase (meio segundo a um segundo).
const REGISTO_MS = 15_000;
let registo: { at: number; reg: Promise<RegistoSite> } | null = null;

/** Esquece o registo guardado (depois de criar ou apagar contas). */
export function esquecerRegisto(): void {
  registo = null;
}

export function lerRegisto(): Promise<RegistoSite> {
  if (registo && Date.now() - registo.at < REGISTO_MS) return registo.reg;
  const reg = lerRegistoAgora();
  registo = { at: Date.now(), reg };
  reg.catch(() => {
    if (registo?.reg === reg) registo = null;
  });
  return reg;
}

async function lerRegistoAgora(): Promise<RegistoSite> {
  const reg: RegistoSite = { contas: new Map(), perfis: new Map(), revendas: new Map() };
  const sb = getDaSyncAdmin();
  if (!sb) return reg;
  const [contas, perfis, revendas] = await Promise.all([
    sb.from('panel_users').select('username, parent_username, auth_user_id, created_at'),
    sb.from('profiles').select('user_id, role, name, email, da_username'),
    sb.from('panel_auth_accounts').select('user_id, reseller_tier'),
  ]);
  for (const r of contas.data || []) {
    const u = String(r.username || '').trim().toLowerCase();
    if (u) reg.contas.set(u, { parent: r.parent_username ? String(r.parent_username).toLowerCase() : null, authUserId: r.auth_user_id ? String(r.auth_user_id) : null, criada: r.created_at ? String(r.created_at) : null });
  }
  for (const p of perfis.data || []) {
    if (!p.user_id) continue;
    reg.perfis.set(String(p.user_id), { userId: String(p.user_id), role: String(p.role || ''), name: String(p.name || ''), email: String(p.email || ''), conta: String(p.da_username || '').trim().toLowerCase() });
  }
  for (const r of revendas.data || []) if (r.user_id && r.reseller_tier) reg.revendas.set(String(r.user_id), String(r.reseller_tier).toLowerCase());
  return reg;
}
