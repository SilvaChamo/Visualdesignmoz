/**
 * VisualHost — junta a leitura do servidor (Hestia) com o registo do site (Supabase) no formato do painel.
 *
 * - Papéis: conta com ROLE=admin no Hestia → Administrador; login com papel "reseller" → Revendedor;
 *   o resto é Profissional (tem sites) ou Cliente (só e-mail/domínio). Igual aos papéis do site.
 * - Quem criou cada conta: panel_users.parent_username (o revendedor); sem isso, o administrador.
 * - O que cada um vê: administrador → tudo; revendedor → a sua conta e as dos seus clientes;
 *   restantes → só a sua conta.
 */
import { CONTA_PROVISORIA } from '@/lib/conta-provisoria';
import { pendentesDaConta, sslPendente } from '@/lib/vhost-ssl-pendente';
import type { Account, BaseDados, Domain, Mailbox, Role } from '@/components/vhost/types';
import { ACME, IDIOMAS, RECURSOS, TEMAS, type InfoConta, type Lim, type PacoteUtilizador } from '@/components/vhost/paginas/dados';
import { mbTexto, type DadosServidor, type Servidor, type ZonaDns } from '@/components/vhost/servidor';
import type { LeituraServidor } from '@/lib/vhost-servidor';
import { getDaSyncAdmin } from '@/lib/da-sync-schema';
import { buyerRoleForPackage } from '@/lib/user-roles';
import type { CompraPendente } from '@/lib/vhost-compra-pendente';

type Linha = Record<string, string>;

export type RegistoSite = {
  /** panel_users: conta → revendedor que a criou, login ligado, data */
  contas: Map<string, { parent: string | null; authUserId: string | null; criada: string | null; dominio?: string }>;
  /** profiles por user_id e por conta do servidor (da_username) */
  perfis: Map<string, { userId: string; role: string; name: string; email: string; conta: string; dominio?: string; empresa?: string }>;
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
      // os limites que o Hestia tem e o formulário do DirectAdmin não mostrava
      maildomains: lim(p.MAIL_DOMAINS),
      dnsdomains: lim(p.DNS_DOMAINS),
      dnsrecords: lim(p.DNS_RECORDS),
      cronjobs: lim(p.CRON_JOBS),
      backups: { v: String(num(p.BACKUPS)), unl: false },
      ratelimit: { v: String(num(p.RATE_LIMIT) || 200), unl: false },
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
      swap: ilimitado(p.SWAP_LIMIT) ? livre() : { v: p.SWAP_LIMIT, unl: false },
      cpuperiod: ilimitado(p.CPU_QUOTA_PERIOD) ? livre() : { v: p.CPU_QUOTA_PERIOD, unl: false },
    },
    hestia: Object.fromEntries(
      ['SHELL', 'NS', 'BACKUPS_INCREMENTAL', 'WEB_TEMPLATE', 'PROXY_TEMPLATE', 'BACKEND_TEMPLATE', 'DNS_TEMPLATE'].map((k) => [k, p[k] || '']),
    ),
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

export { CONTA_PROVISORIA };

/** `compra`: o que a sessão comprou e ainda espera (confirmação ou criação da conta). Só serve a quem não tem conta no
 *  servidor: dá-lhe uma conta provisória com o pacote pago, para ver já o painel certo, com as configurações fechadas. */
export function montarDados(srv: LeituraServidor, reg: RegistoSite, sessao: Sessao, compra?: CompraPendente | null): DadosServidor {
  const apiUser = (process.env.HESTIA_USER || 'vdadmin').trim();
  const nomes = Object.keys(srv.users);
  const adminConta =
    nomes.find((u) => u === apiUser) || nomes.find((u) => (srv.users[u].ROLE || '').toLowerCase() === 'admin') || nomes[0] || '';

  // Conta do servidor de quem tem sessão iniciada
  const perfil = reg.perfis.get(sessao.userId);
  let me = (perfil?.conta || '').toLowerCase();
  if (!me || !srv.users[me]) me = [...reg.contas].find(([, r]) => r.authUserId === sessao.userId)?.[0] || '';
  // Sem conta própria ligada, só uma sessão de administrador fica com a conta de administração do servidor. Antes
  // qualquer sessão caía aqui: um cliente sem conta ligada (ex.: só domínio ou só e-mail) via — e, pelas rotas que
  // autorizam com esta lista (domínio, e-mail, bd, avançado, sistema), alterava — a conta vdadmin, e tinha o Admin.
  if (!me || !srv.users[me]) me = sessao.role === 'admin' ? adminConta || nomes[0] || 'vdadmin' : '';

  const contas: Record<string, Account> = {};
  const info: Record<string, InfoConta> = {};
  for (const u of nomes) {
    const x = srv.users[u];
    const r = reg.contas.get(u);
    const p = (r?.authUserId && reg.perfis.get(r.authUserId)) || [...reg.perfis.values()].find((pf) => pf.conta === u);
    const web = srv.web[u] || {};
    // Cliente ou Profissional pelo plano (pedido do Silva, 12/10): VD-Host-Pro/Business/Enterprise → Profissional;
    // VD-Host-Basico e planos de e-mail → Cliente. Antes bastava a conta ter um site, e todo o plano Básico caía em
    // Profissional. Pacotes fora dos planos seguem o papel do perfil; "manager" é sempre Profissional.
    const doPlano = buyerRoleForPackage(x.PACKAGE);
    let role: Role =
      (x.ROLE || '').toLowerCase() === 'admin' || u === apiUser || p?.role === 'admin'
        ? 'admin'
        : p?.role === 'reseller'
          ? 'revenda'
          : p?.role === 'manager' || (doPlano ? doPlano === 'profissional' : p?.role === 'profissional')
            ? 'profissional'
            : 'cliente';
    if (u === me && sessao.role === 'admin') role = 'admin';
    if (u === me && sessao.role === 'reseller') role = 'revenda';

    const wp = new Set(srv.wp[u] || []);
    const domains: Domain[] = Object.entries(web).map(([d, w]) => ({
      name: d,
      ssl: (w.SSL || 'no').toLowerCase() === 'yes' ? 'ok' : 'w',
      ...((w.SSL || 'no').toLowerCase() !== 'yes' && sslPendente(d) ? { sslPendente: true } : {}),
      php: php(w.BACKEND),
      disk: mbTexto(num(w.U_DISK)),
      status: (w.SUSPENDED || 'no').toLowerCase() === 'yes' ? 'w' : 'ok',
      ...(wp.has(d) ? { wp: true } : {}),
      bw: mbTexto(num(w.U_BANDWIDTH)),
      bwMb: num(w.U_BANDWIDTH),
      aliases: lista(w.ALIAS),
      docroot: w.DOCUMENT_ROOT || `/home/${u}/web/${d}/public_html/`,
      ftp: lista(w.FTP_USER).map((f, i) => ({ user: f, path: lista(w.FTP_PATH)[i] || '' })),
      le: (w.LETSENCRYPT || 'no').toLowerCase() === 'yes',
      temEmail: Boolean(srv.mail[u]?.[d]),
      emailSsl: (srv.mail[u]?.[d]?.SSL || 'no').toLowerCase() === 'yes',
    }));
    // domínios que o painel está a criar agora (ainda não lidos do servidor): aparecem já, com "A processar SSL…"
    for (const d of pendentesDaConta(u))
      if (!web[d]) domains.push({ name: d, ssl: 'w', php: '—', disk: '0 MB', status: 'ok', bw: '0 MB', bwMb: 0, docroot: `/home/${u}/web/${d}/public_html/`, sslPendente: true });
    // domínios só de e-mail (sem site)
    for (const [d, m] of Object.entries(srv.mail[u] || {}))
      if (!web[d]) domains.push({ name: d, ssl: (m.SSL || 'no').toLowerCase() === 'yes' ? 'ok' : 'w', php: '—', disk: mbTexto(num(m.U_DISK)), status: (m.SUSPENDED || 'no').toLowerCase() === 'yes' ? 'w' : 'ok', soEmail: true });
    // domínios só com a zona DNS (sem site nem e-mail): quem comprou só o domínio (plano VD-Dominio, Silva 17/10/2026)
    for (const [d, z] of Object.entries(srv.dns[u] || {}))
      if (!web[d] && !srv.mail[u]?.[d]) domains.push({ name: d, ssl: 'w', php: '—', disk: '—', status: (z.SUSPENDED || 'no').toLowerCase() === 'yes' ? 'w' : 'ok', soDominio: true });
    // Domínio principal (o usado para criar a conta) à cabeça — é o que o painel escolhe à partida em todas as páginas.
    // Vem do registo do site (da_domain, gravado quando a conta foi criada); sem ele, o mais antigo no Hestia (data e
    // hora de criação) e, em empate, o que tem o nome da conta.
    const registado = r?.dominio || p?.dominio || '';
    const criado = (d: string) => {
      const w = web[d] || srv.mail[u]?.[d];
      return w?.DATE ? w.DATE + ' ' + (w.TIME || '') : '~';
    };
    // Sem registo: o domínio do próprio site (na conta da VisualDesign), senão o mais antigo que não seja subdomínio de
    // outro da conta (teste.visualdesignmoz.com nunca é o principal) — Silva, 15/10/2026: "sempre o site principal da conta".
    const nomes = domains.map((x) => x.name);
    let doSite = '';
    try {
      doSite = new URL(process.env.NEXT_PUBLIC_SITE_URL || '').hostname.replace(/^www\./, '');
    } catch {}
    const principal = nomes.includes(registado)
      ? registado
      : nomes.includes(doSite)
        ? doSite
        : nomes
            .filter((n) => !nomes.some((o) => o !== n && n.endsWith('.' + o)))
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
      ...(p?.empresa ? { empresa: p.empresa } : {}),
      role,
      creator: r?.parent && srv.users[r.parent] ? r.parent : u === adminConta ? u : adminConta,
      pkg: revenda ? (revenda === 'expandido' ? 'Revenda Expandido' : 'Revenda Essencial') : x.PACKAGE || '',
      hpkg: x.PACKAGE || '',
      ...(srv.subpastas?.[u]?.length ? { subpastas: srv.subpastas[u] } : {}),
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

  // Comprou e ainda não tem conta no servidor: conta provisória com o pacote pago (nunca para a equipa)
  // O administrador que compra um plano vê o painel dele (o painel abre-o como «entrar como», com «Voltar ao painel de administração»), sem
  // deixar de ser administrador: a conta provisória nunca é a sua principal, nem a equipa pode agir por ela.
  const compraDeAdmin = Boolean(compra) && sessao.role === 'admin';
  if (compra && (compraDeAdmin || ((!me || !contas[me]) && sessao.role !== 'reseller' && sessao.role !== 'manager'))) {
    const perfilCompra = reg.perfis.get(sessao.userId);
    const papel: Role = buyerRoleForPackage(compra.pacote) === 'profissional' ? 'profissional' : 'cliente';
    const dominiosCompra: Domain[] = compra.dominios.map((d) => ({
      name: d,
      ssl: 'w',
      php: '—',
      disk: '0 MB',
      status: 'ok',
      ...(compra.tipo === 'dominio' ? { soDominio: true } : compra.tipo === 'email' ? { soEmail: true } : {}),
    }));
    if (!compraDeAdmin) me = CONTA_PROVISORIA;
    contas[CONTA_PROVISORIA] = {
      name: (perfilCompra?.name || sessao.email.split('@')[0] || '').trim(),
      email: perfilCompra?.email || sessao.email,
      ...(perfilCompra?.empresa ? { empresa: perfilCompra.empresa } : {}),
      role: papel,
      creator: adminConta,
      pkg: compra.pacote,
      hpkg: compra.pacote,
      state: 'ok',
      disk: '0 MB',
      discoMb: 0,
      discoLimMb: null,
      bwMb: 0,
      bwLimMb: null,
      ns: [],
      domains: dominiosCompra,
      dbs: [],
      mails: [],
      aguarda: { motivo: compra.aguarda, plano: compra.plano },
    };
    info[CONTA_PROVISORIA] = { bw: '0 MB', ip: '', dbs: 0, criada: '—' };
  }

  // O que esta sessão pode ver
  const minha = contas[me];
  let visiveis: string[];
  if (sessao.role === 'admin') visiveis = compraDeAdmin ? [...nomes, CONTA_PROVISORIA] : nomes;
  else if (minha?.role === 'revenda') visiveis = nomes.filter((u) => u === me || contas[u].creator === me);
  else if (me) {
    // a sua conta e as contas de hospedagem adicionais da mesma pessoa (cada hospedagem comprada tem a sua conta)
    const adicionais = nomes.filter((u) => u !== me && reg.contas.get(u)?.authUserId === sessao.userId);
    for (const u of adicionais) contas[u].propria = true;
    visiveis = [me, ...adicionais];
  } else visiveis = [];
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
      discoFisicoGb: gb(rc.discoFisico || 0),
      cpuPct: rc.cpuPct ?? -1,
      servicos: Object.entries(srv.servicos).map(([nome, s]) => ({ nome, ativo: (s.STATE || '').toLowerCase() === 'running' })),
      nSites: Object.values(srv.web).reduce((n, w) => n + Object.keys(w).length, 0),
      nContas: nomes.length,
    };
  }

  // pacotes: administrador vê todos; os outros só os das contas que vêem (o revendedor, mais os Pro-…)
  const usados = new Set(visiveis.map((u) => contas[u].hpkg));
  const pacotes = Object.fromEntries(
    Object.entries(srv.packages)
      // o revendedor recebe também os pacotes Pro-… (Pro-Basico, Pro-Premium, Pro-Business): são os que pode dar aos clientes
      .filter(([n]) => n !== 'system' && (sessao.role === 'admin' || usados.has(n) || (sessao.role === 'reseller' && /^pro-/i.test(n))))
      .map(([n, p]) => [n, pacoteDoHestia(p, n)]),
  );

  // quem entrou (perfil do site): nome, e-mail e empresa para o cabeçalho e o rodapé do painel
  const pessoa = { nome: (perfil?.name || minha?.name || '').trim(), email: perfil?.email || sessao.email || minha?.email || '', empresa: perfil?.empresa || '' };
  return { me, pessoa, contas: filtra(contas), pacotes, info: filtra(info), dns, servidor, php: srv.php, lidoEm: srv.lidoEm };
}

/** Registo do site: que revendedor criou cada conta, que login está ligado, papéis e pacotes de revenda */
// Memória curta do registo: cada página do painel pedia-o de novo ao Supabase (meio segundo a um segundo).
const REGISTO_MS = 15_000;
let registo: { at: number; reg: Promise<RegistoSite> } | null = null;
/** O último registo lido, para a página do painel não esperar pelo Supabase (lê o seguinte por trás). Diz quem vê que
 *  contas, por isso esquece-se em cada alteração (esquecerRegisto) e não serve depois de meia hora. */
let registoLido: { at: number; reg: RegistoSite } | null = null;
const REGISTO_PAGINA_MS = 30 * 60_000;

/** Esquece o registo guardado (depois de criar ou apagar contas). */
export function esquecerRegisto(): void {
  registo = null;
  registoLido = null;
}

export function lerRegisto(): Promise<RegistoSite> {
  if (registo && Date.now() - registo.at < REGISTO_MS) return registo.reg;
  const reg = lerRegistoAgora();
  const lido = { at: Date.now(), reg };
  registo = lido;
  reg.then(
    (r) => {
      if (registo === lido) registoLido = { at: lido.at, reg: r };
    },
    () => {
      if (registo === lido) registo = null;
    },
  );
  return reg;
}

/** Para a página do painel: o último registo lido (e o seguinte a ler por trás), ou espera pela leitura se não houver */
export function lerRegistoParaPagina(): Promise<RegistoSite> {
  if (!registoLido || Date.now() - registoLido.at > REGISTO_PAGINA_MS) return lerRegisto();
  const ultimo = registoLido.reg;
  lerRegisto().catch(() => {});
  return Promise.resolve(ultimo);
}

async function lerRegistoAgora(): Promise<RegistoSite> {
  const reg: RegistoSite = { contas: new Map(), perfis: new Map(), revendas: new Map() };
  const sb = getDaSyncAdmin();
  if (!sb) {
    if (process.env.NODE_ENV !== 'development') {
      throw new Error('Supabase indisponível para ler o registo do VisualHost.');
    }
    reg.contas.set('vdadmin', { parent: null, authUserId: null, criada: new Date().toISOString() });
    reg.contas.set('silvachamo', { parent: null, authUserId: null, criada: new Date().toISOString() });
    return reg;
  }
  try {
    const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Supabase timeout')), 5000));
    const [contas, perfis, revendas] = await Promise.race([
      Promise.all([
        sb.from('panel_users').select('username, parent_username, auth_user_id, created_at, da_domain'),
        sb.from('profiles').select('user_id, role, name, email, da_username, da_domain, empresa'),
        sb.from('panel_auth_accounts').select('user_id, reseller_tier'),
      ]),
      timeoutPromise,
    ]);
    const queryError = contas.error || perfis.error || revendas.error;
    if (queryError) throw queryError;
    for (const r of contas.data || []) {
      const u = String(r.username || '').trim().toLowerCase();
      if (u) reg.contas.set(u, { parent: r.parent_username ? String(r.parent_username).toLowerCase() : null, authUserId: r.auth_user_id ? String(r.auth_user_id) : null, criada: r.created_at ? String(r.created_at) : null, dominio: r.da_domain ? String(r.da_domain).trim().toLowerCase() : undefined });
    }
    for (const p of perfis.data || []) {
      if (!p.user_id) continue;
      reg.perfis.set(String(p.user_id), { userId: String(p.user_id), role: String(p.role || ''), name: String(p.name || ''), email: String(p.email || ''), conta: String(p.da_username || '').trim().toLowerCase(), dominio: p.da_domain ? String(p.da_domain).trim().toLowerCase() : undefined, empresa: p.empresa ? String(p.empresa).trim() : undefined });
    }
    for (const r of revendas.data || []) if (r.user_id && r.reseller_tier) reg.revendas.set(String(r.user_id), String(r.reseller_tier).toLowerCase());
  } catch (err) {
    // nunca contas inventadas no lugar das reais (pedido do Silva, 13/10/2026)
    console.error('[vhost-dados] Não foi possível ler o registo do VisualHost:', err);
    throw err;
  }
  return reg;
}
