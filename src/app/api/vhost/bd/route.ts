import { NextRequest, NextResponse } from 'next/server';
import { requirePanelBootstrapAccess } from '@/lib/panel-api-auth';
import { executeServerCommand } from '@/lib/server-ssh-exec';
import * as hestia from '@/lib/hestia-adapter';
import * as acl from '@/lib/hestia-mysql-acl';
import { esquecerLeitura, lerServidor, type LeituraServidor } from '@/lib/vhost-servidor';
import { lerRegisto, montarDados } from '@/lib/vhost-dados';

export const dynamic = 'force-dynamic';

/**
 * /api/vhost/bd — bases de dados e utilizadores MySQL de uma conta (painel VisualHost → Bases de dados).
 * GET  ?conta=           utilizadores (com as bases a que têm acesso), tamanho e nº de tabelas de cada base,
 *                         versão e modo do MySQL
 * GET  ?conta=&exportar=bd   descarrega a base de dados (.sql.gz)
 * POST { acao, conta, … }    utilizadores (criar, apagar, senha, dar/tirar acesso), verificar/reparar/otimizar
 * POST multipart (acao=importar, conta, bd, limpar, ficheiro)   importa um .sql / .sql.gz
 * Usa as funções do site (hestia-mysql-acl / hestia-adapter); só nas contas que a sessão pode ver.
 */
const CONTA = /^[a-z0-9][a-z0-9_.-]{0,31}$/;
const IDENT = /^[A-Za-z0-9_]{1,64}$/;

async function autorizar(conta: string): Promise<NextResponse | null> {
  const auth = await requirePanelBootstrapAccess();
  if ('error' in auth) return NextResponse.json({ erro: 'Inicie sessão no site.' }, { status: auth.error.status });
  if (!CONTA.test(conta)) return NextResponse.json({ erro: 'Conta inválida.' }, { status: 400 });
  const srv = await lerServidor();
  const dados = montarDados(srv, await lerRegisto(), { userId: auth.user.id, email: auth.user.email || '', role: auth.user.role });
  if (!dados.contas[conta]) return NextResponse.json({ erro: 'Conta fora do seu painel.' }, { status: 403 });
  return null;
}
/** Dono de um nome MySQL: a conta mais específica cujo prefixo "conta_" o nome tem (uma conta "ab" nunca é dona
 *  dos nomes de uma conta "ab_c"). */
function donoDe(nome: string, contas: string[]): string {
  let dono = '';
  for (const c of contas) if (nome.startsWith(c + '_') && c.length > dono.length) dono = c;
  return dono;
}
/** Base de dados da conta: tem de estar na lista real da conta no servidor (v-list-databases) */
const bdDaConta = (srv: LeituraServidor, conta: string, nome: string) => IDENT.test(nome) && Object.prototype.hasOwnProperty.call(srv.db[conta] || {}, nome);
/** Utilizador MySQL da conta: utilizador principal de uma base da conta, ou com o prefixo da conta sem que outra
 *  conta mais específica o reclame */
const userDaConta = (srv: LeituraServidor, conta: string, nome: string) =>
  IDENT.test(nome) && (Object.values(srv.db[conta] || {}).some((b) => b.DBUSER === nome) || donoDe(nome, Object.keys(srv.users)) === conta);

/** Utilizadores MySQL da conta e as bases a que cada um tem acesso, mais os "Server Details" do DirectAdmin
 *  (versão, modo SQL, ligação) — uma só consulta, só leitura */
async function utilizadores(conta: string, srv: LeituraServidor) {
  const like = conta.replace(/_/g, '\\_') + '\\_%';
  const sql = `SELECT 'X', VERSION(), CONCAT(@@GLOBAL.sql_mode, '|', IFNULL(@@socket, '')); SELECT 'U', User, Host FROM mysql.user WHERE User LIKE '${like}'; SELECT 'D', User, Db FROM mysql.db WHERE User LIKE '${like}';`;
  const out = await executeServerCommand(`echo ${Buffer.from(sql).toString('base64')} | base64 -d | mysql --batch --raw --skip-column-names`, { timeoutMs: 20_000 });
  const mapa = new Map<string, { dbuser: string; hosts: string[]; bases: string[] }>();
  const mysql = { versao: '', modo: [] as string[], socket: '' };
  for (const l of out.split('\n')) {
    const [t, u, x] = l.split('\t');
    if (t === 'X') {
      const [modo, socket] = (x || '').split('|');
      Object.assign(mysql, { versao: u || '', modo: modo.split(',').filter(Boolean), socket: socket || '' });
      continue;
    }
    if (!u || !x || u.startsWith('pma_vd_') || !userDaConta(srv, conta, u)) continue;
    const e = mapa.get(u) || { dbuser: u, hosts: [], bases: [] };
    if (t === 'U' && !e.hosts.includes(x)) e.hosts.push(x);
    if (t === 'D') {
      const db = x.replace(/\\_/g, '_');
      if (bdDaConta(srv, conta, db) && !e.bases.includes(db)) e.bases.push(db);
    }
    mapa.set(u, e);
  }
  return { lista: [...mapa.values()].sort((a, b) => a.dbuser.localeCompare(b.dbuser)), mysql };
}

/** Resumo de uma base (como o "Overview" do DirectAdmin): charset, collation, tamanho e contagens */
async function resumoBd(bd: string) {
  const q = (s: string) => `'${s}'`;
  const sql = [
    `SELECT 'S', DEFAULT_CHARACTER_SET_NAME, DEFAULT_COLLATION_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=${q(bd)}`,
    `SELECT 'T', COUNT(*), IFNULL(SUM(DATA_LENGTH+INDEX_LENGTH),0) FROM information_schema.TABLES WHERE TABLE_SCHEMA=${q(bd)} AND TABLE_TYPE='BASE TABLE'`,
    `SELECT 'V', COUNT(*), 0 FROM information_schema.VIEWS WHERE TABLE_SCHEMA=${q(bd)}`,
    `SELECT 'E', COUNT(*), 0 FROM information_schema.EVENTS WHERE EVENT_SCHEMA=${q(bd)}`,
    `SELECT 'G', COUNT(*), 0 FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=${q(bd)}`,
    `SELECT 'R', COUNT(*), 0 FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA=${q(bd)}`,
  ].join('; ') + ';';
  const out = await executeServerCommand(`echo ${Buffer.from(sql).toString('base64')} | base64 -d | mysql --batch --raw --skip-column-names`, { timeoutMs: 20_000 });
  const v: Record<string, string[]> = {};
  for (const l of out.split('\n')) {
    const [k, a, b] = l.split('\t');
    if (k && a !== undefined) v[k] = [a, b];
  }
  const n = (k: string, i = 0) => Number(v[k]?.[i]) || 0;
  return { charset: v.S?.[0] || '', collation: v.S?.[1] || '', bytes: n('T', 1), tabelas: n('T'), views: n('V'), eventos: n('E'), triggers: n('G'), rotinas: n('R') };
}

export async function GET(req: NextRequest) {
  const conta = req.nextUrl.searchParams.get('conta') || '';
  const negado = await autorizar(conta);
  if (negado) return negado;
  const sp = req.nextUrl.searchParams;
  const exportar = sp.get('exportar') || '';
  if (exportar) {
    if (!bdDaConta(await lerServidor(), conta, exportar)) return NextResponse.json({ erro: 'Base de dados fora da conta.' }, { status: 403 });
    const gz = sp.get('gz') !== '0';
    const r = await hestia.exportDatabaseBytes(exportar, gz);
    if (!r.ok || !r.bytes) return NextResponse.json({ erro: r.error || 'Não foi possível exportar.' }, { status: 500 });
    return new NextResponse(new Uint8Array(r.bytes), {
      headers: { 'Content-Type': gz ? 'application/gzip' : 'application/sql', 'Content-Disposition': `attachment; filename="${exportar}-${new Date().toISOString().slice(0, 10)}.sql${gz ? '.gz' : ''}"`, 'Cache-Control': 'no-store' },
    });
  }
  try {
    const srv = await lerServidor();
    // ficha de uma base: resumo + utilizadores com acesso e privilégios
    const bd = sp.get('bd') || '';
    if (bd) {
      if (!bdDaConta(srv, conta, bd)) return NextResponse.json({ erro: 'Base de dados fora da conta.' }, { status: 403 });
      const [resumo, users] = await Promise.all([resumoBd(bd), acl.listDatabaseUsersFromMysql(conta, bd)]);
      return NextResponse.json({ resumo, utilizadores: users.filter((u) => userDaConta(srv, conta, u.dbuser)) }, { headers: { 'Cache-Control': 'no-store' } });
    }
    // ficha de um utilizador: hosts + bases com acesso e privilégios
    const user = sp.get('user') || '';
    if (user) {
      if (!userDaConta(srv, conta, user)) return NextResponse.json({ erro: 'Utilizador fora da conta.' }, { status: 403 });
      const [todos, bases] = await Promise.all([utilizadores(conta, srv), acl.listUserDatabasesFromMysql(conta, user)]);
      return NextResponse.json({ hosts: todos.lista.find((u) => u.dbuser === user)?.hosts || [], bases: bases.filter((b) => bdDaConta(srv, conta, b.database)) }, { headers: { 'Cache-Control': 'no-store' } });
    }
    const bases = Object.keys(srv.db[conta] || {});
    const semTamanho = sp.get('semTamanho') === '1';
    const [users, stats] = await Promise.all([utilizadores(conta, srv), bases.length && !semTamanho ? acl.listMysqlSchemaStats(bases) : Promise.resolve(new Map<string, { sizeBytes: number; tableCount: number }>())]);
    return NextResponse.json({ utilizadores: users.lista, mysql: users.mysql, bases: Object.fromEntries([...stats].map(([k, v]) => [k, { bytes: v.sizeBytes, tabelas: v.tableCount }])) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return NextResponse.json({ erro: e instanceof Error ? e.message : 'Erro a ler o MySQL.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // importação: formulário com o ficheiro
  if ((req.headers.get('content-type') || '').includes('multipart/form-data')) {
    const f = await req.formData();
    const conta = String(f.get('conta') || '');
    const negado = await autorizar(conta);
    if (negado) return negado;
    const bd = String(f.get('bd') || '');
    const ficheiro = f.get('ficheiro');
    if (!bdDaConta(await lerServidor(), conta, bd) || !(ficheiro instanceof File)) return NextResponse.json({ erro: 'Escolha a base de dados e o ficheiro.' }, { status: 400 });
    if (ficheiro.size > 512 * 1024 * 1024) return NextResponse.json({ erro: 'Ficheiro maior que 512 MB.' }, { status: 400 });
    const r = await hestia.importDatabaseFile(bd, Buffer.from(await ficheiro.arrayBuffer()), f.get('limpar') === '1', ficheiro.name);
    return NextResponse.json(r.ok ? { ok: true } : { erro: r.error || 'A importação falhou.' }, { status: r.ok ? 200 : 400 });
  }

  let c: Record<string, string> & { privs?: Record<string, boolean>; hosts?: string[] };
  try {
    c = (await req.json()) as typeof c;
  } catch {
    return NextResponse.json({ erro: 'Pedido inválido.' }, { status: 400 });
  }
  const conta = String(c.conta || '');
  const negado = await autorizar(conta);
  if (negado) return negado;
  const senhaOk = () => String(c.senha || '').length >= 8;
  const srv = await lerServidor();
  const feito = (extra: Record<string, unknown> = {}) => {
    esquecerLeitura();
    return NextResponse.json({ ok: true, ...extra });
  };
  try {
    switch (c.acao) {
      case 'user-criar':
        if (!/^[a-z0-9_]{1,24}$/.test(String(c.nome || ''))) return NextResponse.json({ erro: 'Nome: letras minúsculas, números e _.' }, { status: 400 });
        if (!senhaOk()) return NextResponse.json({ erro: 'A palavra-passe precisa de pelo menos 8 caracteres.' }, { status: 400 });
        if (donoDe(conta + '_' + String(c.nome), Object.keys(srv.users)) !== conta) return NextResponse.json({ erro: 'Esse nome pertence a outra conta. Escolha outro.' }, { status: 400 });
        return feito(await acl.createMysqlUser(conta, String(c.nome), String(c.senha)));
      case 'user-apagar':
        if (!userDaConta(srv, conta, c.dbuser)) return NextResponse.json({ erro: 'Utilizador fora da conta.' }, { status: 403 });
        await acl.dropMysqlUser(conta, c.dbuser);
        return feito();
      case 'user-senha':
        if (!userDaConta(srv, conta, c.dbuser)) return NextResponse.json({ erro: 'Utilizador fora da conta.' }, { status: 403 });
        if (!senhaOk()) return NextResponse.json({ erro: 'A palavra-passe precisa de pelo menos 8 caracteres.' }, { status: 400 });
        return feito(await acl.changeMysqlUserPassword(conta, c.dbuser, String(c.senha)));
      case 'user-dar':
      case 'user-tirar':
        if (!userDaConta(srv, conta, c.dbuser) || !bdDaConta(srv, conta, c.bd)) return NextResponse.json({ erro: 'Fora da conta.' }, { status: 403 });
        if (c.acao === 'user-dar') await acl.grantDatabaseAccess(conta, c.dbuser, c.bd);
        else await acl.revokeDatabaseAccess(conta, c.dbuser, c.bd);
        return feito();
      case 'privilegios':
        if (!userDaConta(srv, conta, c.dbuser) || !bdDaConta(srv, conta, c.bd) || typeof c.privs !== 'object') return NextResponse.json({ erro: 'Pedido inválido.' }, { status: 400 });
        await acl.changeDatabasePrivileges(conta, c.dbuser, c.bd, Object.fromEntries(Object.entries(c.privs).map(([k, v]) => [k, !!v])));
        return feito();
      case 'hosts': {
        const hosts = (Array.isArray(c.hosts) ? c.hosts : []).map((h) => String(h).trim()).filter(Boolean);
        if (!userDaConta(srv, conta, c.dbuser) || !hosts.length) return NextResponse.json({ erro: 'O utilizador precisa de pelo menos um host (ex.: localhost).' }, { status: 400 });
        await acl.changeMysqlUserHosts(conta, c.dbuser, hosts);
        return feito();
      }
      case 'manutencao': {
        if (!bdDaConta(srv, conta, c.bd) || !['check', 'repair', 'optimize'].includes(c.op)) return NextResponse.json({ erro: 'Pedido inválido.' }, { status: 400 });
        const r = await hestia.maintainDatabase(c.bd, c.op as 'check' | 'repair' | 'optimize');
        return r.ok ? NextResponse.json({ ok: true, resultado: (r.data || '').slice(0, 4000) }) : NextResponse.json({ erro: r.error || 'Falhou.' }, { status: 400 });
      }
      default:
        return NextResponse.json({ erro: 'Ação desconhecida.' }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ erro: e instanceof Error ? e.message : 'O MySQL recusou.' }, { status: 400 });
  }
}
