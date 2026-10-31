/**
 * Certificado SSL automático (Silva, 31/10/2026: «ao comprar uma hospedagem e adicionar domínio o sistema emita SSL automaticamente,
 * sem precisar de o fazer manualmente»).
 *
 * Duas camadas:
 *  1. IMEDIATA — `agendarSslImediato`, chamada no instante em que se cria a conta, o site ou o domínio: vigia o DNS de 10 em 10 s (a
 *     partir dos 3 min, de 30 em 30 s, até 20 min) e pede o certificado logo que o domínio resolve; o Let's Encrypt só valida quando o
 *     domínio já aponta para o servidor, por isso mais cedo seria falhar. No máximo 5 pedidos recusados (o Let's Encrypt aceita 5 por hora).
 *  2. REDE DE SEGURANÇA — `emitirSslEmFalta`, de 30 em 30 minutos (pelo cron `dns-retry`, que já existe): apanha o que ficou para trás
 *     (DNS que demorou horas, reinício do site a meio) e pede o certificado a todo o site que ainda não o tem e cujo domínio já resolve. Nunca mexe nos sites que já têm certificado, nos suspensos, nos que estão na Vercel (ver issueLetsEncrypt),
 * nem em `visualdesignmoz.com` e `basededadosagro.com`.
 *
 * Limites para não sobrecarregar o servidor nem esgotar os limites do Let's Encrypt: no máximo 3 pedidos por varrimento, um de cada vez;
 * depois de uma falha espera 1 h, 2 h, 4 h… (no máximo 24 h) e, passadas 10 falhas, só volta a tentar ao fim de 7 dias.
 */
import { promises as dns } from 'dns';
import { issueLetsEncrypt, listUsers, listWebDomains } from '@/lib/hestia-adapter';
import { limparSslPendente, marcarSslPendente } from '@/lib/vhost-ssl-pendente';

const NUNCA = new Set(['visualdesignmoz.com', 'basededadosagro.com']);
const MAX_POR_VARRIMENTO = 3;
const HORA = 3_600_000;

type Estado = { falhas: number; proxima: number };
const g = globalThis as typeof globalThis & { __sslAutomatico?: Map<string, Estado> };
const estados = (g.__sslAutomatico ??= new Map<string, Estado>());

/** Domínios internos do sistema: nunca se mexe no certificado por aqui */
function interno(d: string): boolean {
  return NUNCA.has(d) || d.endsWith('.visualdesignmoz.com') || d.startsWith('mail.') || d.startsWith('webmail.');
}

// Resolvedores públicos: o do servidor guarda respostas negativas e escondia o registo novo durante minutos
const publico = new dns.Resolver({ timeout: 3000, tries: 1 });
publico.setServers(['1.1.1.1', '8.8.8.8']);
async function resolve(d: string): Promise<boolean> {
  try {
    return (await publico.resolve4(d)).length > 0;
  } catch {
    return false;
  }
}
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

const emCurso = new Set<string>();
/**
 * Pede o certificado assim que o domínio resolver, sem fazer esperar quem o criou (corre por trás). Chamar no instante em que se cria a
 * conta, o site ou o domínio. Repetir a chamada para o mesmo domínio não faz nada enquanto o primeiro vigia. Se passar dos 20 min sem
 * conseguir, fica para o varrimento de 30 em 30 minutos (`emitirSslEmFalta`).
 */
export function agendarSslImediato(conta: string, dominio: string): void {
  const d = dominio.trim().toLowerCase().replace(/\.$/, '');
  if (!conta || !d || interno(d) || emCurso.has(d)) return;
  emCurso.add(d);
  marcarSslPendente(d, conta);
  void (async () => {
    try {
      const inicio = Date.now();
      let recusados = 0;
      let ultimo = 0;
      while (Date.now() - inicio < 20 * 60_000 && recusados < 5) {
        if (await resolve(d)) {
          // entre dois pedidos recusados, pelo menos 60 s
          if (Date.now() - ultimo >= 60_000) {
            ultimo = Date.now();
            const r = await issueLetsEncrypt(conta, d).catch(() => ({ ok: false }));
            if (r.ok) return;
            recusados += 1;
          }
        }
        await dormir(Date.now() - inicio < 3 * 60_000 ? 10_000 : 30_000);
      }
    } catch {
      /* a rede de segurança trata do resto */
    } finally {
      emCurso.delete(d);
      limparSslPendente(d);
    }
  })();
}

export type ResultadoSsl = { verificados: number; semCertificado: number; emitidos: string[]; falharam: string[]; adiados: number };

export async function emitirSslEmFalta(): Promise<ResultadoSsl> {
  const r: ResultadoSsl = { verificados: 0, semCertificado: 0, emitidos: [], falharam: [], adiados: 0 };
  const apiUser = (process.env.HESTIA_USER || 'vdadmin').trim();
  const contas = [apiUser, ...(await listUsers()).filter((u) => !u.suspended).map((u) => u.username)];

  const fila: { conta: string; dominio: string }[] = [];
  for (const conta of contas) {
    let sites;
    try {
      sites = await listWebDomains(conta);
    } catch {
      continue; // uma conta que não respondeu não pára as outras
    }
    for (const s of sites) {
      r.verificados += 1;
      const d = s.domain.toLowerCase();
      if (s.sslEnabled || s.suspended || interno(d)) continue;
      r.semCertificado += 1;
      fila.push({ conta, dominio: d });
    }
  }

  let pedidos = 0;
  for (const { conta, dominio } of fila) {
    if (pedidos >= MAX_POR_VARRIMENTO) {
      r.adiados += 1;
      continue;
    }
    const est = estados.get(dominio);
    if (est && est.proxima > Date.now()) {
      r.adiados += 1;
      continue;
    }
    if (!(await resolve(dominio))) {
      r.adiados += 1; // o DNS ainda não aponta a lado nenhum: o Let's Encrypt não conseguiria validar
      continue;
    }
    pedidos += 1;
    marcarSslPendente(dominio, conta);
    try {
      const ssl = await issueLetsEncrypt(conta, dominio);
      if (ssl.ok) {
        estados.delete(dominio);
        r.emitidos.push(dominio);
        if (ssl.skipped) estados.set(dominio, { falhas: 0, proxima: Date.now() + 24 * HORA }); // na Vercel: não volta a perguntar já
      } else {
        throw new Error(ssl.error || 'o servidor recusou o pedido');
      }
    } catch {
      const falhas = (est?.falhas ?? 0) + 1;
      const espera = falhas >= 10 ? 7 * 24 * HORA : Math.min(2 ** (falhas - 1) * HORA, 24 * HORA);
      estados.set(dominio, { falhas, proxima: Date.now() + espera });
      r.falharam.push(dominio);
    } finally {
      limparSslPendente(dominio);
    }
  }
  return r;
}
