/**
 * Avisos de e-mail novo com o VhostMail fechado (Web Push; Silva, 18/11/2026).
 * - Subscrições (uma por navegador/aparelho e caixa), chaves VAPID e o «último UID visto» de cada caixa guardam-se no servidor, em
 *   /usr/local/vhost/push-*.json (como as outras definições do painel).
 * - Um vigia no próprio site (de minuto a minuto, só em produção) pergunta a cada caixa com subscrições qual é o próximo UID da
 *   entrada; se subiu, lê as mensagens novas e envia o aviso (remetente e assunto) a cada aparelho.
 */
import { executeServerCommand } from '@/lib/server-ssh-exec';
import { VHOST_DIR } from '@/lib/vhost-email-scripts';
import { CAIXA_PY } from '@/lib/vhostmail/servidor';
import { enviarPush, novasChavesVapid, type ChavesVapid } from '@/lib/web-push';

const F_VAPID = `${VHOST_DIR}/push-vapid.json`;
const F_SUBS = `${VHOST_DIR}/push-subs.json`;
const F_ESTADO = `${VHOST_DIR}/push-estado.json`;
const SUJEITO = process.env.VAPID_SUBJECT?.trim() || 'https://visualdesignmoz.com';
const MAX_POR_CAIXA = 10;

export type SubGuardada = { endpoint: string; p256dh: string; auth: string; ua: string; em: string };
type Subs = Record<string, SubGuardada[]>;
type Estado = Record<string, { proximo: number }>;

const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64');

type Executor = (comando: string, opcoes?: { timeoutMs?: number }) => Promise<string>;
let executar: Executor = executeServerCommand;
/** Só para testes: troca o executor de comandos no servidor por um falso */
export function _executorParaTestes(f: Executor): void {
  executar = f;
}

async function lerJson<T>(f: string, vazio: T): Promise<T> {
  const out = await executar(`cat ${f} 2>/dev/null`, { timeoutMs: 20_000 }).catch(() => '');
  try {
    return out.trim() ? (JSON.parse(out) as T) : vazio;
  } catch {
    return vazio;
  }
}
async function gravarJson(f: string, v: unknown): Promise<void> {
  await executar(`mkdir -p ${VHOST_DIR} && umask 077 && echo ${b64(JSON.stringify(v))} | base64 -d > ${f}.tmp && mv ${f}.tmp ${f}`, { timeoutMs: 20_000 });
}

/** Um de cada vez: as alterações aos ficheiros lêem e gravam, e dois pedidos juntos perderiam um deles */
let fila: Promise<unknown> = Promise.resolve();
const emFila = <T>(fn: () => Promise<T>): Promise<T> => {
  const r = fila.then(fn, fn);
  fila = r.catch(() => {});
  return r;
};

let chavesVapid: ChavesVapid | null = null;
export function chaves(): Promise<ChavesVapid> {
  return emFila(async () => {
    if (chavesVapid) return chavesVapid;
    const lidas = await lerJson<Partial<ChavesVapid>>(F_VAPID, {});
    if (lidas.publicKey && lidas.privateKey) return (chavesVapid = { publicKey: lidas.publicKey, privateKey: lidas.privateKey });
    const novas = novasChavesVapid();
    await gravarJson(F_VAPID, novas);
    return (chavesVapid = novas);
  });
}
export const chavePublica = async () => (await chaves()).publicKey;

export const guardarSubscricao = (end: string, s: { endpoint: string; p256dh: string; auth: string }, ua: string) =>
  emFila(async () => {
    const subs = await lerJson<Subs>(F_SUBS, {});
    const lista = (subs[end] || []).filter((x) => x.endpoint !== s.endpoint);
    lista.push({ ...s, ua: ua.slice(0, 160), em: new Date().toISOString() });
    // no máximo MAX_POR_CAIXA aparelhos por caixa: ficam os mais recentes
    subs[end] = lista.slice(-MAX_POR_CAIXA);
    await gravarJson(F_SUBS, subs);
  });

export const removerSubscricao = (end: string, endpoint: string) =>
  emFila(async () => {
    const subs = await lerJson<Subs>(F_SUBS, {});
    if (!subs[end]) return;
    subs[end] = subs[end].filter((x) => x.endpoint !== endpoint);
    if (!subs[end].length) delete subs[end];
    await gravarJson(F_SUBS, subs);
  });

/** Envia um aviso a todos os aparelhos da caixa; apaga os que o serviço de notificações diz que já não existem */
export async function avisar(end: string, conteudo: object): Promise<{ enviados: number; falhas: number }> {
  const subs = (await lerJson<Subs>(F_SUBS, {}))[end] || [];
  if (!subs.length) return { enviados: 0, falhas: 0 };
  const k = await chaves();
  let enviados = 0;
  let falhas = 0;
  for (const s of subs) {
    const r = await enviarPush(s, conteudo, k, SUJEITO);
    if (r.ok) enviados++;
    else {
      falhas++;
      if (r.gone) await removerSubscricao(end, s.endpoint).catch(() => {});
      else console.warn('[vhost-push] aviso não enviado:', r.estado, r.erro || '');
    }
  }
  return { enviados, falhas };
}

/** Corre o programa da caixa no servidor (o mesmo do VhostMail) */
async function correrCaixa(args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const out = await executar(`echo ${b64(JSON.stringify(args))} | base64 -d | python3 -c "$(echo ${b64(CAIXA_PY)} | base64 -d)"`, { timeoutMs: 60_000 });
  const linha = out.split('\n').find((l) => l.startsWith('@@JSON'));
  if (!linha) throw new Error('O servidor não respondeu.');
  const j = JSON.parse(linha.slice(6)) as { ok: boolean; r?: Record<string, unknown>; erro?: string };
  if (!j.ok) throw new Error(j.erro || 'erro');
  return j.r || {};
}

type MsgLista = { uid: number; de?: string; end?: string; assunto?: string; lida?: boolean };

/** O texto do aviso: uma mensagem → remetente e assunto; várias → quantas são e os primeiros assuntos */
export function conteudoDoAviso(end: string, novas: MsgLista[]) {
  const url = '/api/vhost/vhostmail?app=1&conta=' + encodeURIComponent(end);
  if (novas.length === 1) return { title: (novas[0].de || novas[0].end || 'VhostMail').slice(0, 80), body: (novas[0].assunto || '(sem assunto)').slice(0, 140), url, tag: 'vhostmail-novo' };
  return {
    title: `${novas.length} novos e-mails`,
    body: novas
      .slice(0, 3)
      .map((m) => (m.assunto || '(sem assunto)').slice(0, 50))
      .join(' · '),
    url,
    tag: 'vhostmail-novo',
  };
}

let aCorrer = false;
/** Uma volta do vigia: para cada caixa com aparelhos subscritos, vê se chegou correio novo à entrada e avisa */
export async function vigiarCaixas(): Promise<{ caixas: number; avisos: number }> {
  if (aCorrer) return { caixas: 0, avisos: 0 };
  aCorrer = true;
  let caixas = 0;
  let avisos = 0;
  try {
    const subs = await lerJson<Subs>(F_SUBS, {});
    const fins = Object.keys(subs).filter((e) => subs[e]?.length);
    if (!fins.length) return { caixas: 0, avisos: 0 };
    const estado = await lerJson<Estado>(F_ESTADO, {});
    let mudou = false;
    for (const end of fins) {
      caixas++;
      try {
        const r = (await correrCaixa({ acao: 'pastas', user: end })) as { pastas?: { n: string; proximo?: number }[] };
        const proximo = Number(r.pastas?.find((p) => p.n === 'INBOX')?.proximo) || 0;
        if (!proximo) continue;
        const antes = estado[end]?.proximo;
        if (!antes) {
          // primeira vez que se vê esta caixa: só se regista (o que já lá estava não é «novo»)
          estado[end] = { proximo };
          mudou = true;
        } else if (proximo > antes) {
          const l = (await correrCaixa({ acao: 'lista', user: end, pasta: 'INBOX', max: 30 })) as { mensagens?: MsgLista[] };
          const novas = (l.mensagens || []).filter((m) => m.uid >= antes && !m.lida);
          estado[end] = { proximo };
          mudou = true;
          if (novas.length) {
            const a = await avisar(end, conteudoDoAviso(end, novas));
            avisos += a.enviados;
          }
        } else if (proximo < antes) {
          estado[end] = { proximo };
          mudou = true;
        }
      } catch (e) {
        console.warn('[vhost-push] caixa', end, e instanceof Error ? e.message : e);
      }
    }
    // caixas que já não têm aparelhos saem do estado
    for (const e of Object.keys(estado)) {
      if (fins.includes(e)) continue;
      delete estado[e];
      mudou = true;
    }
    if (mudou) await gravarJson(F_ESTADO, estado);
  } finally {
    aCorrer = false;
  }
  return { caixas, avisos };
}

let vigia: ReturnType<typeof setInterval> | null = null;
/** Põe o vigia a correr de minuto a minuto (uma só vez por processo) */
export function iniciarVigia(): void {
  if (vigia) return;
  vigia = setInterval(() => {
    vigiarCaixas().catch((e) => console.warn('[vhost-push] vigia:', e instanceof Error ? e.message : e));
  }, 60_000);
  vigia.unref?.();
}
