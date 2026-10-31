/**
 * O domínio de uma hospedagem vai para a Cloudflare sozinho (Silva, 31/10/2026: «ao criar a conta com domínio, o domínio devia ir
 * para a Cloudflare automaticamente, tal como na compra do domínio»).
 *
 * Quando se COMPRA o domínio (`autoProvisionPurchasedDomain`) já se criava a zona, se apontavam os nameservers e se punha o DNS de
 * e-mail. Quando se criava só a conta de hospedagem com um domínio, o sistema apenas escrevia os registos A se a zona já existisse
 * («Sem zona Cloudflare para este domínio») e nunca a criava, por isso o site não abria e o certificado SSL não saía. Agora, ao
 * criar a conta ou ao juntar um domínio:
 *  1. cria a zona na Cloudflare, se ainda não existir (idempotente);
 *  2. aponta o domínio e o `www` ao servidor (registo A, sem proxy);
 *  3. põe o DNS de e-mail (SPF, DKIM, DMARC, MX);
 *  4. muda os nameservers no registador SÓ quando o domínio é da nossa conta do registador e ainda está nos nameservers de
 *     estacionamento dele (não há DNS de ninguém para estragar); com o DNS noutro sítio (Google, Vercel, outro registador) não toca
 *     e devolve o aviso com os nameservers que o cliente tem de pôr.
 * Nunca para `visualdesignmoz.com`, `basededadosagro.com` nem os subdomínios internos, nem para sites que estão na Vercel.
 */
import { Resolver } from 'dns/promises';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createCloudflareZone, findCloudflareZoneForHost, pointDomainToServerIp } from '@/lib/cloudflare-dns';
import { dynadotAPI } from '@/lib/dynadot-adapter';
import { runEmailDnsAutomation } from '@/lib/domain-email-auth';
import { alojamentoVercel } from '@/lib/hospedagem-dns';
import { getServerHost } from '@/lib/server-config';
import { ehNsNosso } from '@/lib/visualdesign-dns';

const NUNCA = new Set(['visualdesignmoz.com', 'basededadosagro.com']);

/** Domínio principal da zona (sub.exemplo.co.mz → exemplo.co.mz) */
function zonaDe(d: string): string {
  const p = d.split('.');
  const curto = p.length > 2 && ['co', 'com', 'org', 'net', 'gov', 'edu', 'ac'].includes(p[p.length - 2]);
  return p.slice(curto ? -3 : -2).join('.');
}

async function nameserversPublicos(zona: string): Promise<string[]> {
  try {
    const r = new Resolver({ timeout: 2500, tries: 1 });
    r.setServers(['1.1.1.1', '8.8.8.8']);
    return (await r.resolveNs(zona)).map((x) => x.toLowerCase().replace(/\.$/, ''));
  } catch {
    return [];
  }
}

export type PassoDns = { passo: string; ok: boolean; detalhe?: string };
export type ResultadoDnsHospedagem = {
  ok: boolean;
  passos: PassoDns[];
  /** O domínio tem o DNS noutro sítio: o cliente tem de mudar os nameservers para estes (nada se fez sozinho) */
  nameserversPorMudar?: string[];
};

/** Quem tem este domínio (ou o domínio principal dele) nos nossos registos: compras de domínio e hospedagens. */
async function donosDoDominio(sb: SupabaseClient, nomes: string[]): Promise<Set<string>> {
  const donos = new Set<string>();
  for (const tabela of ['domain_renewals', 'hosting_renewals']) {
    const { data } = await sb.from(tabela).select('user_id').in('domain_name', nomes);
    for (const l of (data || []) as { user_id: string | null }[]) if (l.user_id) donos.add(l.user_id);
  }
  return donos;
}

/**
 * `quem` = a pessoa que está a criar a conta ou a juntar o domínio. Com ela, só se mexe no DNS de um domínio que é dela ou que ninguém
 * tem nos nossos registos (um domínio de outro cliente nunca se toca), e os nameservers só mudam se o domínio foi COMPRADO por ela
 * através do sistema. Sem `quem` (quem chama já verificou o domínio) não se mudam nameservers.
 */
export async function prepararDnsDaHospedagem(dominio: string, quem?: { sb: SupabaseClient; userId: string }): Promise<ResultadoDnsHospedagem> {
  const d = dominio.trim().toLowerCase().replace(/\.$/, '');
  const passos: PassoDns[] = [];
  if (!d.includes('.') || NUNCA.has(d) || d.endsWith('.visualdesignmoz.com')) {
    return { ok: true, passos: [{ passo: 'DNS', ok: true, detalhe: 'domínio interno: não se mexe' }] };
  }
  if ((await alojamentoVercel(d).catch(() => null)) === true) {
    return { ok: true, passos: [{ passo: 'DNS', ok: true, detalhe: 'o site está na Vercel: o DNS é de lá' }] };
  }

  // 0) de quem é o domínio? Nunca se mexe no de outra pessoa
  let meuPorCompra = false;
  if (quem) {
    const donos = await donosDoDominio(quem.sb, Array.from(new Set([d, zonaDe(d)])));
    if (donos.size > 0 && !donos.has(quem.userId)) {
      return { ok: false, passos: [{ passo: 'DNS', ok: false, detalhe: 'este domínio pertence a outra conta: não se mexe no DNS dele' }] };
    }
    const { data: compra } = await quem.sb.from('domain_renewals').select('id').eq('user_id', quem.userId).in('domain_name', [d, zonaDe(d)]).limit(1);
    meuPorCompra = Boolean(compra?.length);
  }

  // 1) a zona: a que já cobre este nome (um subdomínio vive na zona do domínio principal) ou uma nova
  const existente = await findCloudflareZoneForHost(d);
  const zona = existente?.zoneName ?? zonaDe(d);
  // Numa compra com domínio novo (registar), a automação da compra do domínio cria a mesma zona ao mesmo tempo: se a criação falhar
  // porque a outra acabou de a criar, espera um pouco e volta a perguntar (a criação é idempotente).
  let z = await createCloudflareZone(zona);
  for (let i = 0; i < 3 && !z.ok; i++) {
    await new Promise((r) => setTimeout(r, 8000));
    z = await createCloudflareZone(zona);
  }
  if (!z.ok) {
    passos.push({ passo: 'Zona DNS', ok: false, detalhe: z.error });
    return { ok: false, passos };
  }
  passos.push({ passo: 'Zona DNS', ok: true, detalhe: z.alreadyExisted ? 'já existia' : 'criada' });

  // 2) o domínio (e o www) apontados ao servidor
  const a = await pointDomainToServerIp(d, getServerHost());
  passos.push({ passo: 'Registos A', ok: a.ok, detalhe: a.error });

  // 3) DNS de e-mail (a automação espera pela zona, que já existe)
  try {
    runEmailDnsAutomation(d);
    passos.push({ passo: 'DNS de e-mail', ok: true, detalhe: 'pedido' });
  } catch (e) {
    passos.push({ passo: 'DNS de e-mail', ok: false, detalhe: e instanceof Error ? e.message : 'falhou' });
  }

  // 4) nameservers (só no domínio principal da zona)
  let porMudar: string[] | undefined;
  if (d === zona) {
    const ns = await nameserversPublicos(zona);
    const jaServe = ns.length > 0 && (ns.every((n) => /^[a-z0-9-]+\.ns\.cloudflare\.com$/.test(n)) || ns.every((n) => ehNsNosso(n)));
    if (jaServe) {
      passos.push({ passo: 'Nameservers', ok: true, detalhe: 'já apontam para o servidor' });
    } else {
      const parqueados = ns.length === 0 || ns.every((n) => /dynadot|dyna-ns/.test(n));
      const nossoNoRegistador = meuPorCompra && parqueados && z.nameServers.length >= 2 && (await dynadotAPI.getDomainDetails(zona)).success;
      if (nossoNoRegistador) {
        const r = await dynadotAPI.setNameservers(zona, z.nameServers);
        passos.push({ passo: 'Nameservers', ok: r.success, detalhe: r.success ? 'mudados no registador' : r.error });
      } else {
        porMudar = z.nameServers;
        passos.push({ passo: 'Nameservers', ok: false, detalhe: 'o DNS está noutro sítio: o cliente tem de mudar os nameservers no registador' });
      }
    }
  }
  return { ok: passos.every((p) => p.ok), passos, ...(porMudar?.length ? { nameserversPorMudar: porMudar } : {}) };
}
