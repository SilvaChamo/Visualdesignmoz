/**
 * Onde está alojado o site de um domínio, visto pelo DNS público (Silva, 26/10/2026): o painel não pede certificado SSL aqui a um site que
 * está na Vercel — a Vercel emite o seu, e o Let's Encrypt daqui nem consegue validar (o domínio não aponta para este servidor).
 *
 * Vê-se de duas maneiras: pelos nameservers (um domínio delegado à Vercel usa ns1/ns2.vercel-dns.com) e pelo que o domínio e o www
 * apontam (CNAME para …vercel-dns.com, ou os IPs da Vercel 76.76.21.x e 66.33.60.x). Os domínios da Osher, da aamihe e da provisualcorporate
 * usam nameservers da Cloudflare: nesses o que se vê é o registo do site, não os nameservers.
 */
import { Resolver } from 'dns/promises';

/** Domínio principal da zona (sub.exemplo.co.mz → exemplo.co.mz) */
export const zonaDoDominio = (d: string) => {
  const p = d.split('.');
  const curto = p.length > 2 && ['co', 'com', 'org', 'net', 'gov', 'edu', 'ac'].includes(p[p.length - 2]);
  return p.slice(curto ? -3 : -2).join('.');
};

/** true = o site está na Vercel; false = não está; null = o DNS não respondeu (na dúvida, não se bloqueia nada) */
export async function alojamentoVercel(dominio: string): Promise<boolean | null> {
  const resolver = new Resolver({ timeout: 2500, tries: 1 });
  resolver.setServers(['1.1.1.1', '8.8.8.8']);
  const nomes = [dominio, `www.${dominio}`];
  const [ns, ...respostas] = await Promise.all([
    resolver.resolveNs(zonaDoDominio(dominio)).catch(() => [] as string[]),
    ...nomes.map((nome) => Promise.allSettled([resolver.resolveCname(nome), resolver.resolve4(nome)])),
  ]);
  if (ns.some((n) => /vercel-dns\.com\.?$/i.test(n))) return true;
  const valores = respostas.flatMap((resposta) => resposta.flatMap((resultado) => (resultado.status === 'fulfilled' ? resultado.value : [])));
  if (valores.some((v) => typeof v === 'string' && v.toLowerCase().includes('vercel'))) return true;
  if (valores.some((v) => typeof v === 'string' && /^(76\.76\.21\.|66\.33\.60\.)/.test(v))) return true;
  return respostas.some((resposta) => resposta.some((r) => r.status === 'fulfilled')) ? false : null;
}
