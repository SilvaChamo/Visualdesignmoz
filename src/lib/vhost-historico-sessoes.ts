/**
 * Histórico por sessões (Contas ligadas › Histórico — pedido do Silva, 25/10/2026): cada linha é uma sessão de uma pessoa, no painel ou
 * no WordPress de um site, e ao abri-la vê-se tudo o que aconteceu, hora a hora, com o resultado de cada acção (OK, bloqueado, erro).
 *
 * Duas origens, juntas na mesma lista:
 *   - o painel: os cliques e secções guardados em `vhost_activity_history` (7 dias), agrupados por pessoa — uma pausa de mais de
 *     30 min começa outra sessão;
 *   - o WordPress: as sessões lidas dos registos do servidor (`vhost-actividade-servidor.ts`), com os bloqueios do ModSecurity.
 * Ao abrir uma sessão do painel juntam-se-lhe as acções do WordPress da mesma conta nessa altura (e ao contrário), para se ver a
 * história inteira: "clicou em Editar no WordPress → tentou guardar o CSS → bloqueado pela regra 932105".
 *
 * "Limpar histórico" apaga as linhas do painel e guarda uma marca (`vhost_history_limpeza`): o que vem dos registos do servidor
 * não se pode apagar, por isso esconde-se tudo o que for anterior à marca.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { lerRegisto } from '@/lib/vhost-dados';
import { sessoesWordPress, type LinhaActividade, type SessaoWordPress } from '@/lib/vhost-actividade-servidor';
import { listarPresencas } from '@/lib/vhost-presenca';

const TABELA = 'vhost_activity_history';
const LIMPEZA = 'vhost_history_limpeza';
const RETENCAO_MS = 7 * 24 * 60 * 60_000;
const PAUSA_MS = 30 * 60_000;
const PAGINA = 1000;
const MAX_LINHAS_PAINEL = 30_000;

export type SessaoHistorico = {
  id: string;
  origem: 'painel' | 'wordpress';
  inicio: number;
  fim: number;
  /** id do login da pessoa ('' quando o site WordPress não tem nenhuma pessoa do painel ligada à conta) */
  uid: string;
  pessoa: string;
  email: string;
  conta: string;
  aVer: string;
  onde: string;
  acoes: number;
  bloqueios: number;
  erros: number;
  ip: string;
  aparelho: string;
};

export type PessoaHistorico = { chave: string; nome: string; conta: string };

type EventoPainel = {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  account_name: string;
  viewing_account: string;
  event_type: 'section' | 'click';
  section: string;
  action: string;
  duration_seconds: number | null;
  created_at: string;
  ip?: string;
  aparelho?: string;
};

const COLUNAS_BASE = 'id,user_id,user_email,user_name,account_name,viewing_account,event_type,section,action,duration_seconds,created_at';
let semColunasIp = false;

type Limpezas = { todas: number; porConta: Map<string, number> };

async function lerLimpezas(sb: SupabaseClient): Promise<Limpezas> {
  const vazio: Limpezas = { todas: 0, porConta: new Map() };
  const { data, error } = await sb.from(LIMPEZA).select('escopo,limpo_em');
  if (error) {
    // a tabela só existe depois de o deploy correr a migração; até lá não há marcas
    if (!/does not exist|schema cache|relation/i.test(error.message)) console.warn('[vhost/historico] Não foi possível ler as limpezas:', error.message);
    return vazio;
  }
  for (const l of data || []) {
    const t = new Date(String(l.limpo_em)).getTime();
    if (l.escopo === 'todas') vazio.todas = t;
    else if (String(l.escopo).startsWith('conta:')) vazio.porConta.set(String(l.escopo).slice(6), t);
  }
  return vazio;
}

export async function registarLimpeza(sb: SupabaseClient, escopo: 'todas' | `conta:${string}`): Promise<void> {
  const { error } = await sb.from(LIMPEZA).upsert({ escopo, limpo_em: new Date().toISOString() });
  if (error && !/does not exist|schema cache|relation/i.test(error.message)) console.warn('[vhost/historico] Não foi possível guardar a limpeza:', error.message);
}

const marcaDe = (l: Limpezas, conta: string) => Math.max(l.todas, l.porConta.get(conta) || 0);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function lerEventos(sb: SupabaseClient, filtro: (q: any) => any, ascendente: boolean, maximo: number): Promise<EventoPainel[]> {
  const desde = new Date(Date.now() - RETENCAO_MS).toISOString();
  const todas: EventoPainel[] = [];
  for (let inicio = 0; inicio < maximo; inicio += PAGINA) {
    const colunas = semColunasIp ? COLUNAS_BASE : COLUNAS_BASE + ',ip,aparelho';
    const q = filtro(sb.from(TABELA).select(colunas).gte('created_at', desde)).order('created_at', { ascending: ascendente }).range(inicio, inicio + PAGINA - 1);
    const { data, error } = await q;
    if (error) {
      if (!semColunasIp && /\b(ip|aparelho)\b/.test(error.message)) {
        semColunasIp = true;
        return lerEventos(sb, filtro, ascendente, maximo);
      }
      throw new Error(error.message);
    }
    const linhas = (data || []) as unknown as EventoPainel[];
    todas.push(...linhas);
    if (linhas.length < PAGINA) break;
  }
  return todas;
}

type GrupoPainel = { uid: string; nome: string; email: string; conta: string; aVer: string; inicio: number; fim: number; acoes: number; ip: string; aparelho: string };

function agruparPainel(eventos: EventoPainel[]): GrupoPainel[] {
  const porPessoa = new Map<string, EventoPainel[]>();
  for (const e of eventos) {
    const l = porPessoa.get(e.user_id) || [];
    l.push(e);
    porPessoa.set(e.user_id, l);
  }
  const grupos: GrupoPainel[] = [];
  for (const [uid, lista] of porPessoa) {
    lista.sort((a, b) => a.created_at.localeCompare(b.created_at));
    let atual: GrupoPainel | null = null;
    for (const e of lista) {
      const t = new Date(e.created_at).getTime();
      if (!atual || t - atual.fim > PAUSA_MS) {
        atual = { uid, nome: e.user_name || '', email: e.user_email || '', conta: e.account_name || '', aVer: e.viewing_account || '', inicio: t, fim: t, acoes: 0, ip: '', aparelho: '' };
        grupos.push(atual);
      }
      atual.fim = t;
      if (e.event_type === 'click') atual.acoes += 1;
      if (e.viewing_account) atual.aVer = e.viewing_account;
      if (e.ip) atual.ip = e.ip;
      if (e.aparelho) atual.aparelho = e.aparelho;
      if (e.user_name) atual.nome = e.user_name;
    }
  }
  return grupos;
}

type PerfilPorConta = Map<string, { uid: string; nome: string; email: string }>;

async function pessoasPorConta(): Promise<PerfilPorConta> {
  const mapa: PerfilPorConta = new Map();
  try {
    const reg = await lerRegisto();
    for (const p of reg.perfis.values()) {
      if (!p.conta || mapa.has(p.conta)) continue;
      mapa.set(p.conta, { uid: p.userId, nome: p.name || '', email: p.email || '' });
    }
  } catch {
    /* sem o registo, as sessões do WordPress ficam só com o nome da conta */
  }
  return mapa;
}

function sessaoDeWordPress(s: SessaoWordPress, pessoas: PerfilPorConta): SessaoHistorico {
  const p = pessoas.get(s.conta);
  return {
    id: s.id,
    origem: 'wordpress',
    inicio: s.desde,
    fim: s.ultimo,
    uid: p?.uid || '',
    pessoa: p?.nome || p?.email || s.conta,
    email: p?.email || '',
    conta: s.conta,
    aVer: '',
    onde: `WordPress · ${s.dominio}`,
    acoes: s.acoes,
    bloqueios: s.bloqueios,
    erros: s.erros,
    ip: s.ip,
    aparelho: s.aparelho,
  };
}

export type ListaSessoes = {
  sessoes: SessaoHistorico[];
  pessoas: PessoaHistorico[];
  /** o servidor não respondeu: só se vê o painel */
  semServidor: boolean;
};

export async function listarSessoes(sb: SupabaseClient, filtro: string): Promise<ListaSessoes> {
  const [eventos, limpezas, wp, pessoas] = await Promise.all([lerEventos(sb, (q) => q, false, MAX_LINHAS_PAINEL), lerLimpezas(sb), sessoesWordPress(), pessoasPorConta()]);
  // blocos do painel: bloqueios e erros de cada sessão vêm do WordPress da mesma conta, na mesma altura (ver detalhe)
  const doPainel: SessaoHistorico[] = agruparPainel(eventos).map((g) => ({
    id: `p|${g.uid}|${g.inicio}`,
    origem: 'painel',
    inicio: g.inicio,
    fim: g.fim,
    uid: g.uid,
    pessoa: g.nome || g.email,
    email: g.email,
    conta: g.conta,
    aVer: g.aVer,
    onde: 'Painel',
    acoes: g.acoes,
    bloqueios: 0,
    erros: 0,
    ip: g.ip,
    aparelho: g.aparelho,
  }));
  const doWordPress = (wp || []).filter((s) => s.ultimo > marcaDe(limpezas, s.conta)).map((s) => sessaoDeWordPress(s, pessoas));
  // bloqueios/erros do WordPress durante cada sessão do painel (mesma conta, no período da sessão)
  for (const sp of doPainel) {
    const conta = sp.aVer || sp.conta;
    for (const s of wp || []) {
      if (s.conta !== conta || s.ultimo < sp.inicio - 2 * 60_000 || s.desde > sp.fim + 20 * 60_000) continue;
      sp.bloqueios += s.bloqueios;
      sp.erros += s.erros;
    }
  }
  // sessões do painel anteriores à gravação do IP: o IP de quem ainda está ligado vem da presença em memória
  const presencas = listarPresencas();
  for (const sp of doPainel) {
    if (sp.ip) continue;
    const p = presencas.find((x) => x.uid === sp.uid && x.ultimo >= sp.inicio && x.ip);
    if (p) {
      sp.ip = p.ip;
      sp.aparelho ||= p.aparelho;
    }
  }
  // o mais recente em cima: pela última actividade (uma sessão ainda aberta fica no topo)
  const todas = [...doPainel, ...doWordPress].sort((a, b) => b.fim - a.fim);

  const mapa = new Map<string, PessoaHistorico>();
  for (const s of todas) {
    const chave = s.uid || `conta:${s.conta}`;
    if (!mapa.has(chave)) mapa.set(chave, { chave, nome: s.pessoa || s.conta, conta: s.conta });
  }
  const sessoes = filtro
    ? todas.filter((s) => (filtro.startsWith('conta:') ? s.conta === filtro.slice(6) : s.uid === filtro))
    : todas;
  return { sessoes: sessoes.slice(0, 400), pessoas: [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome)), semServidor: wp === null };
}

export type DetalheSessao = {
  sessao: SessaoHistorico;
  linhas: LinhaActividade[];
  semServidor: boolean;
};

function linhasDoPainel(eventos: EventoPainel[]): LinhaActividade[] {
  return eventos.map((e) => ({
    t: new Date(e.created_at).getTime(),
    n: 1,
    acao: e.action || (e.event_type === 'click' ? 'Clique' : 'Secção'),
    onde: 'Painel',
    origem: 'painel' as const,
    estado: 'info' as const,
    resultado: 'Registado',
    detalhe: e.duration_seconds != null ? `Tempo na secção: ${e.duration_seconds} segundos` : undefined,
    ip: e.ip || '',
    aparelho: e.aparelho || '',
    conta: e.viewing_account || e.account_name || '',
    secao: e.section,
  }));
}

export async function detalheSessao(sb: SupabaseClient, id: string): Promise<DetalheSessao | null> {
  const [limpezas, wp, pessoas] = await Promise.all([lerLimpezas(sb), sessoesWordPress(), pessoasPorConta()]);
  const partes = id.split('|');

  if (partes[0] === 'p' && partes.length === 3) {
    const uid = partes[1];
    const inicio = Number(partes[2]);
    if (!uid || !Number.isFinite(inicio)) return null;
    // as acções desta pessoa a partir do início, até à primeira pausa de mais de 30 min
    const eventos = await lerEventos(sb, (q) => q.eq('user_id', uid).gte('created_at', new Date(inicio).toISOString()), true, 5000);
    const sessaoEventos: EventoPainel[] = [];
    let ultimo = inicio;
    for (const e of eventos) {
      const t = new Date(e.created_at).getTime();
      if (t - ultimo > PAUSA_MS) break;
      sessaoEventos.push(e);
      ultimo = t;
    }
    if (!sessaoEventos.length) return null;
    const g = agruparPainel(sessaoEventos)[0];
    const conta = g.aVer || g.conta;
    const doServidor = (wp || []).filter((s) => s.conta === conta && s.ultimo >= inicio - 2 * 60_000 && s.desde <= ultimo + 20 * 60_000);
    const marca = marcaDe(limpezas, conta);
    const linhas = [...linhasDoPainel(sessaoEventos), ...doServidor.flatMap((s) => s.linhas.filter((l) => l.t > marca))].sort((a, b) => a.t - b.t);
    const sessao: SessaoHistorico = {
      id,
      origem: 'painel',
      inicio,
      fim: ultimo,
      uid,
      pessoa: g.nome || g.email,
      email: g.email,
      conta: g.conta,
      aVer: g.aVer,
      onde: 'Painel',
      acoes: g.acoes,
      bloqueios: doServidor.reduce((s, x) => s + x.bloqueios, 0),
      erros: doServidor.reduce((s, x) => s + x.erros, 0),
      ip: g.ip,
      aparelho: g.aparelho,
    };
    return { sessao, linhas, semServidor: wp === null };
  }

  if (partes[0] === 'w') {
    const s = (wp || []).find((x) => x.id === id);
    if (!s) return null;
    const marca = marcaDe(limpezas, s.conta);
    // os cliques no painel da mesma conta, na mesma altura, contam a história (ex.: "Editar no WordPress")
    const eventos = await lerEventos(sb, (q) => q.eq('account_name', s.conta).gte('created_at', new Date(s.desde - 10 * 60_000).toISOString()).lte('created_at', new Date(s.ultimo + 2 * 60_000).toISOString()), true, 3000).catch(() => []);
    const linhas = [...linhasDoPainel(eventos).filter((l) => l.t > marca), ...s.linhas.filter((l) => l.t > marca)].sort((a, b) => a.t - b.t);
    return { sessao: sessaoDeWordPress(s, pessoas), linhas, semServidor: false };
  }
  return null;
}
