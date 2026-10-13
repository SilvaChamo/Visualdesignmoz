/**
 * Avisos de força bruta nas Mensagens do painel, como o DirectAdmin fazia (pedido do Silva, 13/10/2026): o Hetzner
 * mandava uma mensagem ao administrador sempre que bloqueava IPs por tentativas falhadas; no Contabo quem bloqueia é
 * o fail2ban do Hestia. Isto lê os bloqueios actuais (v-list-firewall-ban), compara com os já avisados e cria UMA
 * mensagem por corrida para cada administrador com os IPs novos. Corre pelo /api/cron/forca-bruta.
 */
import { promises as fs } from 'fs';
import net from 'net';
import path from 'path';
import { hestiaCallJson } from '@/lib/hestia-client';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

type Bloqueio = { ip: string; cadeia: string; quando: string };

/** O que cada bloqueio do Hestia fecha (cadeia do fail2ban → serviço) */
const SERVICO: Record<string, string> = {
  SSH: 'SSH (acesso ao servidor)',
  MAIL: 'E-mail',
  HESTIA: 'Painel Hestia',
  FTP: 'FTP',
  WEB: 'Site / phpMyAdmin',
  DB: 'Base de dados',
  DNS: 'DNS',
  RECIDIVE: 'Todos os serviços (reincidente)',
};
/** O mesmo, curto, para o assunto da mensagem */
const SERVICO_CURTO: Record<string, string> = { SSH: 'SSH', MAIL: 'e-mail', HESTIA: 'Hestia', FTP: 'FTP', WEB: 'site', DB: 'base de dados', DNS: 'DNS', RECIDIVE: 'todos os serviços' };

// fora da pasta da app: o deploy (rsync --delete) apagava-o e cada deploy voltava a avisar tudo; só guarda os
// bloqueios já avisados
const ESTADO = process.env.FORCA_BRUTA_ESTADO || '/var/lib/visualdesign/forca-bruta-avisados.json';
// lista oficial das redes de Moçambique (AFRINIC), escrita no servidor a 13/10/2026
const LISTA_MZ = '/etc/fail2ban/ip-mocambique.txt';

const chave = (b: Bloqueio) => `${b.ip}|${b.cadeia}|${b.quando}`;

async function lerBloqueios(): Promise<Bloqueio[] | null> {
  const r = await hestiaCallJson<Record<string, { IP?: string; CHAIN?: string; TIME?: string; DATE?: string }>>('v-list-firewall-ban');
  if (!r.ok) return null;
  return Object.entries(r.data || {})
    .map(([k, v]) => ({ ip: String(v?.IP || k), cadeia: String(v?.CHAIN || '').toUpperCase(), quando: `${v?.DATE || ''} ${v?.TIME || ''}`.trim() }))
    .filter((b) => net.isIP(b.ip));
}

async function redesMocambique(): Promise<net.BlockList | null> {
  try {
    const lista = new net.BlockList();
    for (const l of (await fs.readFile(LISTA_MZ, 'utf8')).split('\n')) {
      const [rede, pre] = l.trim().split('/');
      const tipo = net.isIP(rede) === 6 ? 'ipv6' : 'ipv4';
      if (net.isIP(rede) && pre) lista.addSubnet(rede, Number(pre), tipo);
    }
    return lista;
  } catch {
    return null;
  }
}

/** "2026-10-13 07:31:47" → "13/10/2026 07:31" */
function dataPt(quando: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/.exec(quando);
  return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}` : quando;
}

export function textoAviso(novos: Bloqueio[], mz: net.BlockList | null, primeiraVez: boolean) {
  const servicos = [...new Set(novos.map((b) => SERVICO_CURTO[b.cadeia] || b.cadeia))];
  const n = novos.length;
  const title = primeiraVez
    ? `Força bruta: ${n} IP${n === 1 ? '' : 's'} bloqueado${n === 1 ? '' : 's'} neste momento`
    : `Força bruta: ${n} IP${n === 1 ? '' : 's'} bloqueado${n === 1 ? '' : 's'} — ${servicos.slice(0, 3).join(', ')}${servicos.length > 3 ? '…' : ''}`;
  const linhas = [...novos]
    .sort((a, b) => b.quando.localeCompare(a.quando))
    .map((b) => {
      const deMz = mz?.check(b.ip, net.isIP(b.ip) === 6 ? 'ipv6' : 'ipv4') ? ' (Moçambique)' : '';
      return `• ${b.ip}${deMz} — ${SERVICO[b.cadeia] || b.cadeia} — ${dataPt(b.quando)}`;
    });
  const message = [
    primeiraVez
      ? 'Primeira leitura dos bloqueios do servidor. A partir de agora chega uma mensagem sempre que o servidor bloquear IPs novos.'
      : 'O servidor bloqueou estes endereços por tentativas de entrada falhadas:',
    '',
    ...linhas,
    '',
    'Cada bloqueio fecha só o serviço indicado, durante 10 minutos. Quem é bloqueado 5 vezes no mesmo dia fica bloqueado em todos os serviços durante 10 dias — menos os IPs de Moçambique, que nunca perdem o acesso ao site, ao painel e ao login.',
  ].join('\n');
  return { title, message };
}

export type ResultadoForcaBruta = { ok: boolean; erro?: string; bloqueados?: number; novos?: number; avisados?: number; primeiraVez?: boolean };

export async function avisarForcaBruta(): Promise<ResultadoForcaBruta> {
  const bloqueios = await lerBloqueios();
  if (!bloqueios) return { ok: false, erro: 'Não foi possível ler os bloqueios do Hestia' };

  let vistos: string[] | null = null;
  try {
    vistos = (JSON.parse(await fs.readFile(ESTADO, 'utf8')) as { vistos?: string[] }).vistos || [];
  } catch {
    vistos = null; // primeira vez: sem registo
  }
  const primeiraVez = vistos === null;
  const jaVistos = new Set(vistos || []);
  const novos = bloqueios.filter((b) => !jaVistos.has(chave(b)));

  let avisados = 0;
  if (novos.length) {
    const sb = getSupabaseAdmin();
    if (!sb) return { ok: false, erro: 'Supabase indisponível' };
    // user_id das notificações aponta para auth.users (ver error-log.ts): é o profiles.user_id
    const { data: admins, error } = await sb.from('profiles').select('user_id').eq('role', 'admin');
    if (error) return { ok: false, erro: 'Não foi possível ler os administradores' };
    const ids = [...new Set((admins || []).map((a) => a.user_id).filter(Boolean))];
    const { title, message } = textoAviso(novos, await redesMocambique(), primeiraVez);
    if (ids.length) {
      const { error: e2 } = await sb.from('notifications').insert(ids.map((user_id) => ({ user_id, title, message, type: 'warning', category: 'system' })));
      if (e2) return { ok: false, erro: 'Não foi possível gravar a mensagem' };
      avisados = ids.length;
    }
  }

  // só os bloqueios que ainda existem (o registo não cresce para sempre)
  await fs.mkdir(path.dirname(ESTADO), { recursive: true });
  await fs.writeFile(ESTADO, JSON.stringify({ vistos: bloqueios.map(chave), lidoEm: new Date().toISOString() }));
  return { ok: true, bloqueados: bloqueios.length, novos: novos.length, avisados, primeiraVez };
}
