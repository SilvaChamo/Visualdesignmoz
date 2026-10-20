import { NextRequest, NextResponse } from 'next/server';
import { X509Certificate } from 'node:crypto';
import { Resolver } from 'node:dns/promises';
import { requirePanelBootstrapAccess } from '@/lib/panel-api-auth';
import { executeServerCommand } from '@/lib/server-ssh-exec';
import { hestiaCall } from '@/lib/hestia-client';
import * as hestia from '@/lib/hestia-adapter';
import { createCloudflareZone, deleteCloudflareDnsRecord, deleteHostARecord, findCloudflareZoneId, listCloudflareDnsRecords, updateCloudflareDnsRecord, upsertCloudflareRecord, type CloudflareRecordInput } from '@/lib/cloudflare-dns';
import { provisionEmailAuthForDomain } from '@/lib/domain-email-auth';
import { dynadotAPI } from '@/lib/dynadot-adapter';
import { getServerHost } from '@/lib/server-config';
import { esquecerLeitura, lerServidor, type LeituraServidor } from '@/lib/vhost-servidor';
import { lerRegisto, montarDados } from '@/lib/vhost-dados';
import { instalarWebmail } from '@/lib/vhost-passar';
import { limparSslPendente, marcarSslPendente } from '@/lib/vhost-ssl-pendente';

export const dynamic = 'force-dynamic';
// o pedido do SSL ao ssl-le espera pelo DNS e pelo Let's Encrypt
export const maxDuration = 120;

/**
 * /api/vhost/dominio — Gestão de domínios do painel VisualHost (Hestia + Cloudflare).
 * GET  ?conta=&d=  detalhe de um domínio: redirecionamento, SSL forçado, certificado (nunca a chave), DNS
 *                  (zona do Hestia ou da Cloudflare), regras PHP (.user.ini) e regras do VisualHost no .htaccess.
 * POST { acao, conta, dominio, … }  alterações (domínios, subdomínios, apontadores, SSL, FTP, bases de dados,
 *                  DNS, redirecionamentos, hotlink, PHP). Só nas contas que a sessão pode ver.
 */

const DOM = /^(?=.{3,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;
const CONTA = /^[a-z0-9][a-z0-9_.-]{0,31}$/;
const MARCA_HT = ['# VisualHost: inicio (não editar à mão)', '# VisualHost: fim'];
const MARCA_INI = ['; VisualHost: inicio (não editar à mão)', '; VisualHost: fim'];
const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64');
const q = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

type Sessao = { userId: string; email: string; role: string };

async function sessao(): Promise<{ s: Sessao } | { erro: NextResponse }> {
  const auth = await requirePanelBootstrapAccess();
  if ('error' in auth) return { erro: NextResponse.json({ erro: 'Inicie sessão no site.' }, { status: auth.error.status }) };
  return { s: { userId: auth.user.id, email: auth.user.email || '', role: auth.user.role } };
}

/** A conta tem de estar entre as que a sessão vê, e o domínio tem de ser dessa conta */
async function verificar(s: Sessao, conta: string, d: string, srv: LeituraServidor): Promise<string | null> {
  if (!CONTA.test(conta) || !DOM.test(d)) return 'Conta ou domínio inválido.';
  const dados = montarDados(srv, await lerRegisto(), s);
  if (!dados.contas[conta]) return 'Conta fora do seu painel.';
  // também os domínios só com a zona DNS (contas do plano VD-Dominio: quem comprou só o domínio)
  if (!srv.web[conta]?.[d] && !srv.mail[conta]?.[d] && !srv.dns[conta]?.[d]) return 'Esse domínio não é desta conta.';
  return null;
}

/** Pede o certificado por trás, sem fazer esperar quem criou o subdomínio: o painel mostra-o logo na lista com "A processar
 *  SSL…" (sslPendente) e tenta aos `pausa` ms, 20 s, 1 min e 3 min (o DNS novo pode demorar a chegar ao Let's Encrypt). */
function emitirSslPorTras(conta: string, dominio: string, pausa: number): void {
  marcarSslPendente(dominio, conta);
  void (async () => {
    try {
      for (const espera of [pausa, 20_000, 60_000, 180_000]) {
        await new Promise((r) => setTimeout(r, espera));
        const r = await hestia.issueLetsEncrypt(conta, dominio).catch(() => ({ ok: false }));
        esquecerLeitura();
        if (r.ok) return;
      }
    } finally {
      limparSslPendente(dominio);
      esquecerLeitura();
    }
  })();
}

/** O subdomínio só abre (e o Let's Encrypt só passa) se tiver registo no DNS. Sem ele, cria o A na Cloudflare e espera
 *  uns segundos pela resposta pública. Devolve o erro, ou null se já existia ou foi criado. Domínios (não subdomínios)
 *  ficam como estão: o DNS deles é do registador. */
async function garantirDnsSubdominio(d: string, pausaMs = 6000): Promise<string | null> {
  if (zonaDe(d) === d) return null;
  const resolver = new Resolver();
  resolver.setServers(['1.1.1.1', '8.8.8.8']);
  const existe = await resolver.resolve4(d).then((r) => r.length > 0, () => false);
  if (existe) return null;
  const { pointHostingHostToServer } = await import('@/lib/hosting-site-dns');
  const dns = await pointHostingHostToServer(d).catch((e: unknown) => ({ ok: false, error: e instanceof Error ? e.message : 'erro' }));
  if (!dns.ok) return dns.error || 'erro';
  await new Promise((r) => setTimeout(r, pausaMs));
  return null;
}

/** Domínio principal da zona (sub.exemplo.co.mz → exemplo.co.mz), para procurar a zona na Cloudflare */
const zonaDe = (d: string) => {
  const p = d.split('.');
  const curto = p.length > 2 && ['co', 'com', 'org', 'net', 'gov', 'edu', 'ac'].includes(p[p.length - 2]);
  return p.slice(curto ? -3 : -2).join('.');
};

// Memória curta: o id da zona na Cloudflare quase nunca muda; os nameservers públicos também não.
const zonasCf = new Map<string, { at: number; id: Promise<string | null> }>();
function zonaCf(zona: string): Promise<string | null> {
  const m = zonasCf.get(zona);
  if (m && Date.now() - m.at < 10 * 60_000) return m.id;
  const id = findCloudflareZoneId(zona);
  zonasCf.set(zona, { at: Date.now(), id });
  id.then((x) => !x && zonasCf.delete(zona)).catch(() => zonasCf.delete(zona));
  return id;
}
const nsGuardados = new Map<string, { at: number; ns: string[] }>();
async function nameservers(zona: string): Promise<string[]> {
  const m = nsGuardados.get(zona);
  if (m && Date.now() - m.at < 5 * 60_000) return m.ns;
  try {
    const r = new Resolver({ timeout: 2500, tries: 1 });
    r.setServers(['1.1.1.1', '8.8.8.8']);
    const ns = (await r.resolveNs(zona)).map((x) => x.toLowerCase().replace(/\.$/, '')).filter((x) => /^[a-z0-9.-]+$/.test(x)).sort().slice(0, 6);
    nsGuardados.set(zona, { at: Date.now(), ns });
    return ns;
  } catch {
    return m?.ns || [];
  }
}
const usaNameserversCloudflare = (ns: string[]) =>
  ns.length > 0 && ns.every((name) => /^[a-z0-9-]+\.ns\.cloudflare\.com$/.test(name));

async function alojamentoVercelPublico(dominio: string): Promise<boolean | null> {
  const resolver = new Resolver({ timeout: 2500, tries: 1 });
  resolver.setServers(['1.1.1.1', '8.8.8.8']);
  const nomes = [dominio, `www.${dominio}`];
  const respostas = await Promise.all(
    nomes.map((nome) => Promise.allSettled([resolver.resolveCname(nome), resolver.resolve4(nome)])),
  );
  const valores = respostas.flatMap((resposta) => resposta.flatMap((resultado) => resultado.status === 'fulfilled' ? resultado.value : []));
  if (valores.some((valor) => typeof valor === 'string' && valor.toLowerCase().includes('vercel'))) return true;
  if (
    valores.some((valor) => typeof valor === 'string' && /^(76\.76\.21\.|66\.33\.60\.)/.test(valor))
  ) return true;
  return respostas.some((resposta) => resposta.some((resultado) => resultado.status === 'fulfilled')) ? false : null;
}

type DnsDominio = { fonte: 'hestia' | 'cloudflare' | 'nenhuma'; zona: string; cloudflareAutoritativa?: boolean; registos: { id: string; nome: string; tipo: string; valor: string; ttl: number; prio?: string; proxied?: boolean }[] };

/** Registos da zona na Cloudflare. Com zona na Cloudflare é ela que manda (o DNS público dos sites está lá): o painel lê
 *  e muda lá, mesmo que o servidor também tenha a zona — essa é só a cópia que ns1..ns4 servem (Silva, 16/10/2026: "o
 *  Contabo serve para trocar DNS e refletir-se na Cloudflare") */
async function dnsCloudflare(d: string): Promise<DnsDominio> {
  const zona = zonaDe(d);
  const zid = await zonaCf(zona);
  if (!zid) return { fonte: 'nenhuma', zona: '', registos: [] };
  const regs = await listCloudflareDnsRecords(zid, zona);
  return {
    fonte: 'cloudflare',
    zona,
    registos: regs.map((x) => ({ id: x.id, nome: x.name, tipo: x.type, valor: x.content, ttl: x.ttl, prio: x.priority != null ? String(x.priority) : undefined, proxied: x.proxied })),
  };
}

/** Tipos de registo que o painel muda na Cloudflare (os outros veem-se, mas mudam-se lá) */
const NA_CLOUDFLARE = ['A', 'AAAA', 'CNAME', 'TXT', 'MX'];

type ItemRelatorio = { nome: string; estado: 'novo' | 'certo' | 'falhou' | 'pendente'; detalhe?: string };

/** Confere no DNS público se o e-mail do domínio está autenticado (o que o Gmail exige: SPF ou DKIM). Devolve os
 *  problemas que ainda se vêem — o DNS novo pode demorar uns minutos a chegar a todos os resolvedores. */
async function conferirEmailDns(d: string, ip: string): Promise<string[]> {
  const r = new Resolver({ timeout: 3000, tries: 1 });
  r.setServers(['1.1.1.1', '8.8.8.8']);
  const txt = async (nome: string) => (await r.resolveTxt(nome).catch(() => [] as string[][])).map((x) => x.join(''));
  const [raiz, dmarc, dkim, mx] = await Promise.all([txt(d), txt('_dmarc.' + d), txt('mail._domainkey.' + d), r.resolveMx(d).catch(() => [])]);
  const problemas: string[] = [];
  const spf = raiz.filter((x) => /^v=spf1\b/i.test(x));
  if (!spf.length) problemas.push('SPF em falta');
  else if (spf.length > 1) problemas.push('há mais de um SPF');
  else if (!spf[0].includes('ip4:' + ip)) problemas.push('o SPF não inclui o IP do servidor (' + ip + ')');
  if (!dkim.some((x) => /^v=DKIM1/i.test(x))) problemas.push('DKIM do servidor (mail._domainkey) em falta');
  if (!dmarc.some((x) => /^v=DMARC1/i.test(x))) problemas.push('DMARC em falta');
  if (!mx.length) problemas.push('MX em falta');
  return problemas;
}

/** DKIM do servidor de e-mail (Exim): é com esta chave (selector "mail") que o servidor assina o que envia. Cria a chave
 *  se ainda não existir e devolve o valor TXT para publicar. Sem isto o Gmail recusa ("DKIM = did not pass"). */
async function dkimDoServidor(conta: string, d: string): Promise<string | null> {
  const ficheiro = `/usr/local/hestia/data/users/${conta}/mail/${d}.pub`;
  const ler = async () => {
    const out = await executeServerCommand(`cat ${q(ficheiro)} 2>/dev/null`, { timeoutMs: 15_000 }).catch(() => '');
    const chave = out.split('\n').filter((l) => l && !l.startsWith('-----')).join('').replace(/\s+/g, '');
    return /^[A-Za-z0-9+/=]{100,}$/.test(chave) ? chave : null;
  };
  let chave = await ler();
  if (!chave) {
    await hestiaCall('v-add-mail-domain-dkim', [conta, d]).catch(() => null);
    chave = await ler();
  }
  return chave ? `v=DKIM1; k=rsa; p=${chave}` : null;
}

/** "Reprocessar DNS" (Gerir domínio, Silva 16/10/2026; na lista de Domínios, 20/10/2026): repõe na Cloudflare os
 *  registos-base de um domínio alojado aqui, para os domínios com registos em falta ficarem ligados como os outros.
 *  Cria a zona se faltar; o site (@ e www, ou o subdomínio) aponta para este servidor, a não ser que esteja noutro
 *  sítio (ex.: Vercel); o e-mail (MX, SPF, DKIM da Brevo e do servidor, DMARC, mail/webmail) se estiver aqui. Serve
 *  também os domínios registados fora da Dynadot: a zona e os registos fazem-se na Cloudflare e, se os nameservers
 *  públicos não forem os dela, muda-os na Dynadot (quando o domínio está lá) ou diz quais pôr no registador. No fim
 *  confere o DNS público. O que já está certo fica como está, com o proxy que tinha. */
async function reprocessarDns(conta: string, d: string, srv: LeituraServidor) {
  const zona = zonaDe(d);
  // O que o painel mostra no cartão do relatório: verde = posto agora ("novo") ou já estava certo ("certo");
  // vermelho = falhou; laranja = ainda não se vê no DNS público ("pendente")
  const itens: ItemRelatorio[] = [];
  const z = await createCloudflareZone(zona);
  if (!z.ok) return NextResponse.json({ erro: 'Não foi possível criar a zona na Cloudflare: ' + z.error }, { status: 502 });
  const zid = z.zoneId;
  if (!z.alreadyExisted) {
    zonasCf.delete(zona);
    itens.push({ nome: 'Zona na Cloudflare', estado: 'novo', detalhe: 'criada' });
  }
  const w = srv.web[conta]?.[d];
  if (w && (await alojamentoVercelPublico(d)) !== true) {
    const ip = (w.IP || getServerHost()).trim();
    const atuais = await listCloudflareDnsRecords(zid, zona);
    for (const nome of d === zona ? ['@', 'www'] : [d.slice(0, -(zona.length + 1))]) {
      const rotulo = 'A ' + (nome === '@' ? zona : nome);
      const doNome = atuais.filter((x) => x.name === nome && ['A', 'AAAA', 'CNAME'].includes(x.type));
      // já aponta para aqui, ou é um CNAME (ex.: www → o domínio): fica como está
      if (doNome.some((x) => (x.type === 'A' && x.content === ip) || x.type === 'CNAME')) {
        itens.push({ nome: rotulo, estado: 'certo' });
        continue;
      }
      const a = doNome.find((x) => x.type === 'A');
      const x = a
        ? await updateCloudflareDnsRecord(zid, a.id, zona, { type: 'A', name: nome, content: ip })
        : await upsertCloudflareRecord(zid, zona, { type: 'A', name: nome, content: ip, proxied: false });
      itens.push({ nome: rotulo, estado: x.ok ? 'novo' : 'falhou', detalhe: x.ok ? '→ ' + ip : x.error || 'erro' });
    }
  }
  const temEmail = !!srv.mail[conta]?.[d];
  if (temEmail) {
    const e = await provisionEmailAuthForDomain(d, { rapido: true });
    for (const x of e.records) itens.push({ nome: `${x.type} ${x.name}`, estado: !x.ok ? 'falhou' : x.action === 'skipped' ? 'certo' : 'novo', detalhe: x.error });
    if (!e.brevoOk && e.brevoError) itens.push({ nome: 'DKIM (Brevo)', estado: 'falhou', detalhe: e.brevoError });
    const dkim = await dkimDoServidor(conta, d);
    if (!dkim) itens.push({ nome: 'DKIM do servidor', estado: 'falhou', detalhe: 'não foi possível criar a chave' });
    else {
      // uma só chave por nome: se já havia outra (chave antiga), troca-se em vez de ficar com duas
      const nome = 'mail._domainkey' + (d === zona ? '' : '.' + d.slice(0, -(zona.length + 1)));
      const antiga = (await listCloudflareDnsRecords(zid, zona)).find((x) => x.type === 'TXT' && x.name === nome);
      const x =
        antiga && antiga.content === dkim
          ? { ok: true, action: 'skipped' as string | undefined, error: undefined as string | undefined }
          : antiga
            ? { ...(await updateCloudflareDnsRecord(zid, antiga.id, zona, { type: 'TXT', name: nome, content: dkim })), action: 'updated' as string | undefined }
            : await upsertCloudflareRecord(zid, zona, { type: 'TXT', name: nome, content: dkim, ttl: 3600 });
      itens.push({ nome: 'DKIM do servidor', estado: !x.ok ? 'falhou' : x.action === 'skipped' ? 'certo' : 'novo', detalhe: x.error });
    }
  }
  // O DNS só vale se o registador apontar para quem o serve: Cloudflare, ou os ns do próprio servidor (que copiam a
  // Cloudflare). Só se mudam sozinhos os nameservers de um domínio na Dynadot que ainda está nos nameservers de
  // estacionamento dela (não tem DNS de ninguém para estragar); com DNS noutro sítio (Google, Vercel, outro registador…)
  // o painel não toca — diz o que fazer.
  const ns = await nameservers(zona);
  const nossos = ns.length > 0 && ns.every((x) => /^ns[1-9]\./.test(x));
  if (d === zona) {
    if (usaNameserversCloudflare(ns) || nossos) itens.push({ nome: 'Nameservers', estado: 'certo', detalhe: ns.join(', ') });
    else {
      const parqueados = ns.length === 0 || ns.every((x) => /dynadot|dyna-ns/.test(x));
      if (parqueados && z.nameServers.length >= 2 && (await dynadotAPI.getDomainDetails(zona)).success) {
        const x = await dynadotAPI.setNameservers(zona, z.nameServers);
        if (x.success) {
          nsGuardados.delete(zona);
          itens.push({ nome: 'Nameservers', estado: 'novo', detalhe: 'mudados na Dynadot para ' + x.hosts.join(', ') });
        } else itens.push({ nome: 'Nameservers', estado: 'falhou', detalhe: 'Dynadot: ' + x.error });
      } else {
        itens.push({
          nome: 'Nameservers',
          estado: 'falhou',
          detalhe:
            'O DNS está em ' + (ns.join(', ') || 'nameservers desconhecidos') + ', não na Cloudflare — mude os nameservers no registador' +
            (z.nameServers.length ? ' para ' + z.nameServers.join(', ') : '') +
            ' (ou ponha lá o SPF: v=spf1 include:spf.brevo.com ip4:' + getServerHost() + ' ~all)',
        });
      }
    }
  }
  espelharNoServidor(zona);
  // conferência no DNS público: o que ainda não chegou aparece a laranja (costuma propagar em minutos)
  if (temEmail) {
    for (const p of await conferirEmailDns(d, getServerHost())) itens.push({ nome: p, estado: 'pendente', detalhe: 'ainda não se vê no DNS público — pode demorar uns minutos a propagar' });
  }
  const novos = itens.filter((i) => i.estado === 'novo').length;
  const falhas = itens.filter((i) => i.estado === 'falhou').length;
  const pendentes = itens.filter((i) => i.estado === 'pendente').length;
  const aviso =
    'DNS reprocessado: ' + (novos ? novos + ' registo(s) posto(s) agora' : 'os registos já estavam certos') + (falhas ? '; ' + falhas + ' falharam' : '') + (pendentes ? '; ' + pendentes + ' a propagar' : '') + '.';
  return NextResponse.json({ ok: true, aviso, relatorio: itens });
}

/** Depois de uma alteração na Cloudflare, a zona do servidor (ns1..ns4) acompanha logo — o cron faz o mesmo de 10 em 10
 *  minutos (deploy/vd-dns-sync.py). Não se espera por isto: se o script ainda não estiver instalado, não faz nada. */
function espelharNoServidor(zona: string) {
  if (!DOM.test(zona)) return;
  void executeServerCommand(`[ -x /usr/local/bin/vd-dns-sync ] && (/usr/local/bin/vd-dns-sync --dominio ${q(zona)} >/dev/null 2>&1 &) ; true`, { timeoutMs: 15_000 }).catch(() => null);
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
/** Linhas do bloco do VisualHost num ficheiro (.htaccess / .user.ini) */
const bloco = (txt: string, marca: string[]) => {
  const i = txt.indexOf(marca[0]);
  const j = txt.indexOf(marca[1]);
  return i >= 0 && j > i ? txt.slice(i + marca[0].length, j).split('\n').map((x) => x.trim()).filter(Boolean) : [];
};

// Qualquer falha inesperada volta com o motivo (antes o Next devolvia uma página de erro e o painel só mostrava
// "Erro a ler o servidor", sem se saber porquê — Silva, 15/10/2026)
export async function GET(req: NextRequest) {
  try {
    return await lerDominio(req);
  } catch (e) {
    console.error('[vhost/dominio GET]', e);
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ erro: 'Não foi possível ler o domínio no servidor: ' + msg.slice(0, 200) }, { status: 500 });
  }
}

async function lerDominio(req: NextRequest) {
  const r = await sessao();
  if ('erro' in r) return r.erro;
  const conta = req.nextUrl.searchParams.get('conta') || '';
  const d = (req.nextUrl.searchParams.get('d') || '').toLowerCase();
  // ?so=dns: a página de DNS só precisa dos registos e dos nameservers
  const soDns = req.nextUrl.searchParams.get('so') === 'dns';
  const verCertificado = req.nextUrl.searchParams.get('certificado') === '1';
  const verHistoricoSsl = req.nextUrl.searchParams.get('historicoSsl') === '1';
  const srv = await lerServidor();
  const e = await verificar(r.s, conta, d, srv);
  if (e) return NextResponse.json({ erro: e }, { status: 403 });
  const w = srv.web[conta]?.[d];
  const raiz = (w?.DOCUMENT_ROOT || `/home/${conta}/web/${d}/public_html/`).replace(/\/+$/, '');
  if (!/^\/home\/[a-z0-9_.-]+\/web\/[a-z0-9.-]+\/public_html$/.test(raiz)) return NextResponse.json({ erro: 'Pasta do site inesperada.' }, { status: 500 });
  const temZona = !!srv.dns[conta]?.[d];
  const H = '/usr/local/hestia/bin';
  const site = w && !soDns;
  const subdominios = w && !soDns ? Object.keys(srv.web[conta] || {}).filter((nome) => DOM.test(nome) && nome.endsWith('.' + d)) : [];
  const linhas = [
    site ? `echo @@WEB; ${H}/v-list-web-domain ${conta} ${d} json` : '',
    site ? `echo @@SSL; ${H}/v-list-web-domain-ssl ${conta} ${d} json 2>/dev/null` : '',
    site ? `echo @@INI; cat ${q(raiz + '/.user.ini')} 2>/dev/null` : '',
    site ? `echo @@HT; cat ${q(raiz + '/.htaccess')} 2>/dev/null` : '',
    // a versão do PHP que o servidor usa quando o site está no modelo "padrão" (só leitura)
    site ? `echo @@PHPVER; php -r 'echo PHP_MAJOR_VERSION . "." . PHP_MINOR_VERSION;' 2>/dev/null; echo` : '',
    temZona ? `echo @@DNS; ${H}/v-list-dns-records ${conta} ${d} json` : '',
    ...(site ? subdominios.map((nome, i) => `echo @@SUBSSL${i}; ${H}/v-list-web-domain-ssl ${conta} ${nome} json 2>/dev/null`) : []),
  ].filter(Boolean);
  // ao mesmo tempo: o servidor (só se houver algo a ler lá), a Cloudflare e os nameservers públicos
  const [out, dnsCf, ns, siteVercel, subdominiosVercel] = await Promise.all([
    linhas.length ? executeServerCommand([...linhas, 'echo @@FIM'].join('; '), { timeoutMs: 30_000 }) : Promise.resolve(''),
    dnsCloudflare(d),
    nameservers(zonaDe(d)),
    alojamentoVercelPublico(d),
    Promise.all(subdominios.map((nome) => alojamentoVercelPublico(nome))),
  ]);
  const sec = secoes(out);

  // a Cloudflare primeiro (é o DNS público); a zona do servidor só quando o domínio não está na Cloudflare
  let dns: DnsDominio = dnsCf;
  if (dns.fonte === 'cloudflare') dns = { ...dns, cloudflareAutoritativa: usaNameserversCloudflare(ns) };
  if (dns.fonte !== 'cloudflare' && temZona) {
    const regs = json<Record<string, Record<string, string>>>(sec.get('DNS'), {});
    dns = { fonte: 'hestia', zona: d, registos: Object.entries(regs).map(([id, x]) => ({ id, nome: x.RECORD || '@', tipo: (x.TYPE || '').toUpperCase(), valor: x.VALUE || '', ttl: Number(x.TTL) || 14400, prio: x.PRIORITY || undefined })) };
  }
  if (soDns) return NextResponse.json({ dns, ns, siteVercel }, { headers: { 'Cache-Control': 'no-store' } });

  const web = (Object.values(json<Record<string, Record<string, string>>>(sec.get('WEB'), {}))[0] || {}) as Record<string, string>;
  const ssl = (Object.values(json<Record<string, Record<string, string>>>(sec.get('SSL'), {}))[0] || {}) as Record<string, string>;
  const dadosSubdominios = subdominios.map((nome, i) => {
    const certificado = (Object.values(json<Record<string, Record<string, string>>>(sec.get(`SUBSSL${i}`), {}))[0] || {}) as Record<string, string>;
    const dominioWeb = srv.web[conta]?.[nome] || {};
    return {
      nome,
      aliases: String(dominioWeb.ALIAS || '').split(',').map((alias) => alias.trim().toLowerCase()).filter(Boolean),
      sslAtivo: (certificado.SSL || dominioWeb.SSL || 'no').toLowerCase() === 'yes',
      renovacaoAutomatica: (certificado.LETSENCRYPT || dominioWeb.LETSENCRYPT || 'no').toLowerCase() === 'yes',
      temEmail: !!srv.mail[conta]?.[nome],
      emailSsl: (srv.mail[conta]?.[nome]?.SSL || 'no').toLowerCase() === 'yes',
      siteVercel: subdominiosVercel[i],
      certificado: certificado.SUBJECT || certificado.NOT_AFTER
        ? {
            para: certificado.SUBJECT || '',
            nomes: String(certificado.ALIASES || '').split(/[ ,]+/).filter(Boolean),
            desde: certificado.NOT_BEFORE || '',
            ate: certificado.NOT_AFTER || '',
            emissor: certificado.ISSUER || '',
          }
        : null,
    };
  });
  if (verCertificado) {
    if (!w || (web.SSL || 'no').toLowerCase() !== 'yes') {
      return NextResponse.json({ erro: 'Este domínio não tem certificado SSL instalado.' }, { status: 404 });
    }
    const crtPath = `/home/${conta}/conf/web/${d}/ssl/${d}.crt`;
    const caPath = `/home/${conta}/conf/web/${d}/ssl/${d}.ca`;
    const ficheiros = secoes(
      await executeServerCommand(
        `[ -s ${q(crtPath)} ] || { echo @@ERRO; exit 0; }; openssl x509 -in ${q(crtPath)} -noout >/dev/null 2>&1 || { echo @@ERRO; exit 0; }; ` +
          `echo @@CERT; cat ${q(crtPath)}; echo; echo @@CADEIA; [ ! -s ${q(caPath)} ] || cat ${q(caPath)}`,
        { timeoutMs: 20_000 },
      ),
    );
    const pem = ficheiros.get('CERT')?.trim() || '';
    if (!pem) return NextResponse.json({ erro: 'O certificado instalado não pôde ser lido.' }, { status: 404 });
    try {
      const certificado = new X509Certificate(pem);
      const nomes = (certificado.subjectAltName || '')
        .split(/,\s*/)
        .map((nome) => nome.replace(/^DNS:/, '').trim())
        .filter((nome) => nome && !nome.includes(':'));
      return NextResponse.json(
        {
          certificado: pem,
          cadeia: ficheiros.get('CADEIA')?.trim() || '',
          emissor: certificado.issuer,
          sujeito: certificado.subject,
          nomes,
          desde: certificado.validFrom,
          ate: certificado.validTo,
          impressaoDigital: certificado.fingerprint256,
          tipoChave: certificado.publicKey.asymmetricKeyType || '',
        },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    } catch {
      return NextResponse.json({ erro: 'O certificado instalado não é válido.' }, { status: 500 });
    }
  }
  if (verHistoricoSsl) {
    if (!w) return NextResponse.json({ erro: 'Este domínio não tem site.' }, { status: 404 });
    const out = await executeServerCommand(
      `grep -F -- ${q(d)} /var/log/hestia/system.log 2>/dev/null | ` +
        `grep -E 'v-(add|delete|change)-(letsencrypt-domain|web-domain-ssl(cert)?)([[:space:]]|$)' | tail -n 50 || true`,
      { timeoutMs: 20_000 },
    );
    const historico = out
      .split('\n')
      .map((linha) => {
        const m = linha.match(/^(\S+\s+\S+)\s+(v-[a-z0-9-]+)\s+(.*)$/);
        if (!m) return null;
        const [, data, comando] = m;
        const acoes: Record<string, string> = {
          'v-add-letsencrypt-domain': 'Pedido de emissão SSL',
          'v-delete-letsencrypt-domain': 'Remoção de certificado SSL',
          'v-add-web-domain-ssl': 'Instalação de certificado',
          'v-change-web-domain-sslcert': 'Substituição de certificado',
          'v-delete-web-domain-ssl': 'Remoção de certificado',
        };
        const acao = acoes[comando];
        return acao ? { data, comando, acao } : null;
      })
      .filter((item): item is { data: string; comando: string; acao: string } => item !== null)
      .reverse();
    return NextResponse.json({ historico }, { headers: { 'Cache-Control': 'no-store' } });
  }
  return NextResponse.json(
    {
      redirecionamento: web.REDIRECT ? { url: web.REDIRECT, codigo: web.REDIRECT_CODE || '301' } : null,
      sslForcado: (web.SSL_FORCE || 'no') === 'yes',
      sslAtivo: (web.SSL || 'no').toLowerCase() === 'yes',
      renovacaoAutomatica: (web.LETSENCRYPT || 'no').toLowerCase() === 'yes',
      hsts: (web.SSL_HSTS || 'no') === 'yes',
      modelo: web.TPL || '',
      backend: web.BACKEND || '',
      certificado: ssl.SUBJECT || ssl.NOT_AFTER ? { para: ssl.SUBJECT || '', nomes: (ssl.ALIASES || '').split(/[ ,]+/).filter(Boolean), desde: ssl.NOT_BEFORE || '', ate: ssl.NOT_AFTER || '', emissor: ssl.ISSUER || '' } : null,
      dns,
      ns,
      siteVercel,
      subdominios: dadosSubdominios,
      phpPadrao: /^\d+\.\d+$/.test((sec.get('PHPVER') || '').trim()) ? (sec.get('PHPVER') || '').trim() : '',
      php: bloco(sec.get('INI') || '', MARCA_INI).map((l) => {
        const [k, ...v] = l.split('=');
        return { k: k.trim(), v: v.join('=').trim() };
      }),
      htaccess: bloco(sec.get('HT') || '', MARCA_HT),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

type Corpo = {
  acao: string;
  conta: string;
  dominio: string;
  [k: string]: unknown;
};

/** Reescreve o bloco do VisualHost num ficheiro do site (cria o ficheiro se faltar), com o dono da conta */
async function escreverBloco(conta: string, ficheiro: string, marca: string[], linhas: string[]) {
  // Lido e escrito como o dono da conta, nunca root + chown: a pasta é do cliente e uma ligação simbólica lá posta
  // faria o root ler ou mudar o dono de um ficheiro do sistema
  const atual = await executeServerCommand(`sudo -u ${conta} cat -- ${q(ficheiro)} 2>/dev/null`, { timeoutMs: 20_000 });
  const i = atual.indexOf(marca[0]);
  const j = atual.indexOf(marca[1]);
  const fora = i >= 0 && j > i ? atual.slice(0, i) + atual.slice(j + marca[1].length) : atual;
  const novo = (linhas.length ? [marca[0], ...linhas, marca[1], ''].join('\n') : '') + fora.replace(/^\n+/, '');
  await executeServerCommand(`echo ${b64(novo)} | base64 -d | sudo -u ${conta} sh -c 'cat > "$1.vhost-tmp" && mv -f -- "$1.vhost-tmp" "$1"' _ ${q(ficheiro)}`, { timeoutMs: 20_000 });
}

const linhaLimpa = (v: unknown) => String(v ?? '').replace(/[\r\n]/g, ' ').trim();

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
  let srv = await lerServidor();
  if (c.acao === 'dominio-apagar') srv = await lerServidor(true);
  // `esquecer`: a alteração muda a lista de contas/domínios (os registos de DNS não mudam)
  const resposta = async (p: Promise<{ ok: boolean; error?: string }> | { ok: boolean; error?: string }, esquecer = true) => {
    const x = await p;
    if ((x.ok || c.acao === 'dominio-apagar') && esquecer) esquecerLeitura();
    return NextResponse.json(x.ok ? { ok: true } : { erro: x.error || 'O servidor recusou.' }, { status: x.ok ? 200 : 400 });
  };
  const call = async (cmd: string, args: string[]) => {
    const x = await hestiaCall(cmd, args);
    return { ok: x.ok, error: x.error };
  };

  // Criar domínio: a conta tem de ser visível; o domínio ainda não existe
  if (c.acao === 'dominio-criar' || c.acao === 'subdominio-criar') {
    if (!CONTA.test(conta)) return NextResponse.json({ erro: 'Conta inválida.' }, { status: 400 });
    const dados = montarDados(srv, await lerRegisto(), r.s);
    if (!dados.contas[conta]) return NextResponse.json({ erro: 'Conta fora do seu painel.' }, { status: 403 });
    const novo = c.acao === 'subdominio-criar' ? `${linhaLimpa(c.sub).toLowerCase()}.${d}` : d;
    if (!DOM.test(novo)) return NextResponse.json({ erro: 'Nome inválido. Sem maiúsculas, www ou http://.' }, { status: 400 });
    if (c.acao === 'subdominio-criar' && !srv.web[conta]?.[d]) return NextResponse.json({ erro: 'O domínio principal não é desta conta.' }, { status: 403 });
    for (const [u, w] of Object.entries(srv.web)) if (w[novo]) return NextResponse.json({ erro: 'Esse domínio já existe no servidor' + (u === conta ? ' nesta conta.' : '.') }, { status: 400 });
    // só o site no Hestia (sem mexer no DNS da Cloudflare); certificado se pedido
    // o subdomínio já aparece na lista (A processar SSL…) enquanto o servidor o cria
    if (c.acao === 'subdominio-criar' && c.ssl) marcarSslPendente(novo, conta);
    const x = await call('v-add-web-domain', [conta, novo]);
    if (!x.ok && c.acao === 'subdominio-criar') limparSslPendente(novo);
    // Endereço "atrás" também marcado (pedido do Silva, 13/10/2026): o subdomínio "loja" passa a usar a pasta
    // public_html/loja do domínio principal, por isso abre em loja.dominio.com e em dominio.com/loja. Só "à frente":
    // fica com pasta própria, em separado (o normal do Hestia).
    if (x.ok && c.acao === 'subdominio-criar' && c.pasta) {
      const sub = linhaLimpa(c.sub).toLowerCase();
      const pasta = `/home/${conta}/web/${d}/public_html/${sub}`;
      await hestiaCall('v-add-fs-directory', [conta, pasta]).catch(() => null); // se já existir, fica como está
      const y = await call('v-change-web-domain-docroot', [conta, novo, d, '/' + sub]);
      if (!y.ok) {
        esquecerLeitura();
        return NextResponse.json({ erro: 'O subdomínio foi criado, mas ficou com pasta própria: o servidor não aceitou usar ' + d + '/' + sub + ' (' + (y.error || 'erro') + ').' }, { status: 502 });
      }
    }
    // Subdomínio: o A na zona do domínio pai (sem ele o endereço não abre e o Let's Encrypt falha — "DNS record … doesn't
    // exist") e o certificado por trás: o pedido responde já e a lista mostra o subdomínio com "A processar SSL…" (Silva,
    // 20/10/2026).
    let aviso = '';
    if (x.ok && c.acao === 'subdominio-criar') {
      const falhaDns = await garantirDnsSubdominio(novo, 0);
      if (falhaDns) aviso = 'Subdomínio ' + novo + ' criado, mas o endereço ainda não abre: o DNS não foi criado (' + falhaDns + '). Crie o registo A em DNS.';
      else if (c.ssl) {
        aviso = 'Subdomínio ' + novo + ' criado. A processar o certificado SSL…';
        emitirSslPorTras(conta, novo, 6000);
      }
    } else if (x.ok && c.ssl) {
      hestia.issueLetsEncrypt(conta, novo).catch(() => null); // com o reload do nginx (o certificado vale logo)
    }
    // webmail em https://<domínio>/webmail (antes ficava por pôr à mão em cada domínio novo)
    if (x.ok && !(await instalarWebmail(conta, novo))) {
      esquecerLeitura();
      return NextResponse.json({ erro: 'O domínio foi criado, mas a regra do webmail não foi posta (o nginx recusou).' }, { status: 502 });
    }
    if (x.ok && aviso) {
      esquecerLeitura();
      return NextResponse.json({ ok: true, aviso });
    }
    return resposta(x);
  }

  if (c.acao === 'dominio-apagar') {
    if (!CONTA.test(conta) || !DOM.test(d)) return NextResponse.json({ erro: 'Conta ou domínio inválido.' }, { status: 400 });
    const dados = montarDados(srv, await lerRegisto(), r.s);
    if (!dados.contas[conta]) return NextResponse.json({ erro: 'Conta fora do seu painel.' }, { status: 403 });
    if (!srv.web[conta]?.[d] && !srv.mail[conta]?.[d]) {
      esquecerLeitura();
      return NextResponse.json({ erro: 'Este domínio já não existe no servidor. A lista foi actualizada.' }, { status: 409 });
    }
  }

  // Eliminar o site de uma conta de vez, sem deixar nada (Silva, 20/10/2026, "Sites das contas"): o site com os ficheiros, o
  // certificado e as contas FTP, o domínio de e-mail com todas as caixas, a zona DNS do Hestia e o A do endereço (e do www)
  // na Cloudflare. Só o administrador. Ficam de fora: as bases de dados da conta, a zona da Cloudflare de um domínio principal
  // e o registo do domínio (esses não são do site).
  if (c.acao === 'dominio-eliminar-tudo') {
    if (r.s.role !== 'admin') return NextResponse.json({ erro: 'Só o administrador elimina sites de outras contas.' }, { status: 403 });
    if (!CONTA.test(conta) || !DOM.test(d)) return NextResponse.json({ erro: 'Conta ou domínio inválido.' }, { status: 400 });
    // o próprio painel e o site de produção nunca se eliminam daqui
    const protegidos = new Set(['visualdesignmoz.com', 'www.visualdesignmoz.com', 'host.visualdesignmoz.com', String(getServerHost() || '').toLowerCase()]);
    if (protegidos.has(d)) return NextResponse.json({ erro: d + ' é do próprio painel e do site da Visual Design: não se elimina daqui.' }, { status: 403 });
    const temWeb = !!srv.web[conta]?.[d];
    const temMail = !!srv.mail[conta]?.[d];
    const temDns = !!srv.dns[conta]?.[d];
    if (!temWeb && !temMail && !temDns) {
      esquecerLeitura();
      return NextResponse.json({ erro: 'Este site já não existe no servidor. A lista foi actualizada.' }, { status: 409 });
    }
    const feitos: string[] = [];
    const falhas: string[] = [];
    const passo = async (nome: string, p: Promise<{ ok: boolean; error?: string }>) => {
      const x = await p.catch((err: unknown) => ({ ok: false, error: err instanceof Error ? err.message : 'erro' }));
      (x.ok ? feitos : falhas).push(x.ok ? nome : nome + ' (' + (x.error || 'erro') + ')');
    };
    if (temWeb) await passo('site e ficheiros', call('v-delete-web-domain', [conta, d]));
    if (temMail) await passo('e-mail e caixas', call('v-delete-mail-domain', [conta, d]));
    if (temDns) await passo('zona DNS', call('v-delete-dns-domain', [conta, d]));
    await passo('DNS da Cloudflare', deleteHostARecord(d));
    await passo('DNS do www', deleteHostARecord('www.' + d));
    esquecerLeitura();
    if (falhas.length) return NextResponse.json({ erro: 'Não ficou tudo eliminado. Feito: ' + (feitos.join(', ') || 'nada') + '. Falhou: ' + falhas.join('; ') + '.' }, { status: 502 });
    return NextResponse.json({ ok: true });
  }

  const e = await verificar(r.s, conta, d, srv);
  if (e) return NextResponse.json({ erro: e }, { status: 403 });

  // Só o endereço "atrás" (dominio.com/loja): uma pasta no site principal, sem subdomínio (pedido do Silva, 13/10/2026).
  // A pasta leva um ficheiro escondido (.vhost-subpasta) que a marca como criada pelo painel: é por ele que a lista de
  // Subdomínios a mostra com o endereço, e só essas se apagam daqui (Silva, 20/10/2026).
  if (c.acao === 'subpasta-criar' || c.acao === 'subpasta-apagar') {
    const sub = linhaLimpa(c.sub).toLowerCase();
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(sub)) return NextResponse.json({ erro: 'Nome inválido: letras, números e hífen.' }, { status: 400 });
    if (!srv.web[conta]?.[d]) return NextResponse.json({ erro: 'Este domínio não tem site.' }, { status: 400 });
    const pasta = `/home/${conta}/web/${d}/public_html/${sub}`;
    const marca = pasta + '/.vhost-subpasta';
    if (c.acao === 'subpasta-criar') {
      if (['wp-admin', 'wp-content', 'wp-includes', 'cgi-bin'].includes(sub)) return NextResponse.json({ erro: 'Esse nome é de uma pasta do site.' }, { status: 400 });
      // uma pasta vazia que já existe (criada pelo painel antes de haver marca) adopta-se: só leva a marca
      const existe = await executeServerCommand(
        `if [ ! -e ${q(pasta)} ]; then echo NAO; elif [ -d ${q(pasta)} ] && [ -z "$(ls -A ${q(pasta)})" ]; then echo VAZIA; else echo SIM; fi`,
        { timeoutMs: 20_000 },
      ).catch(() => 'ERRO');
      if (/SIM/.test(existe)) return NextResponse.json({ erro: 'Já existe uma pasta ' + sub + ' neste site, com ficheiros dentro.' }, { status: 400 });
      if (!/NAO|VAZIA/.test(existe)) return NextResponse.json({ erro: 'Não foi possível confirmar o servidor. Nada foi criado.' }, { status: 502 });
      if (/NAO/.test(existe)) {
        const x = await call('v-add-fs-directory', [conta, pasta]);
        if (!x.ok) return resposta(x);
      }
      return resposta(call('v-add-fs-file', [conta, marca]));
    }
    const marcada = await executeServerCommand(`[ -f ${q(marca)} ] && echo SIM || echo NAO`, { timeoutMs: 20_000 }).catch(() => 'ERRO');
    if (!/SIM/.test(marcada)) return NextResponse.json({ erro: 'Esta pasta não foi criada pelo painel: não se apaga daqui.' }, { status: 403 });
    return resposta(call('v-delete-fs-directory', [conta, pasta]));
  }
  const w = srv.web[conta]?.[d];
  const raiz = (w?.DOCUMENT_ROOT || `/home/${conta}/web/${d}/public_html/`).replace(/\/+$/, '');

  switch (c.acao) {
    case 'dominio-nome': {
      if (!w) return NextResponse.json({ erro: 'Só se muda o nome de domínios com site.' }, { status: 400 });
      const novo = linhaLimpa(c.novo).toLowerCase().replace(/^www\./, '');
      if (!DOM.test(novo)) return NextResponse.json({ erro: 'Nome novo inválido.' }, { status: 400 });
      for (const ws of Object.values(srv.web)) if (ws[novo]) return NextResponse.json({ erro: 'Esse domínio já existe no servidor.' }, { status: 400 });
      return resposta(call('v-change-web-domain-name', [conta, d, novo, 'yes']));
    }
    case 'ssl-proprio': {
      // certificado próprio colado no painel: ficheiros <domínio>.crt/.key/.ca numa pasta temporária, depois o Hestia
      if (!w) return NextResponse.json({ erro: 'Este domínio não tem site.' }, { status: 400 });
      const crt = String(c.crt || '').trim();
      const key = String(c.key || '').trim();
      const ca = String(c.ca || '').trim();
      if (!/^-----BEGIN CERTIFICATE-----[\s\S]+-----END CERTIFICATE-----$/.test(crt) || !/^-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]+-----END [A-Z ]*PRIVATE KEY-----$/.test(key)) return NextResponse.json({ erro: 'Cole o certificado e a chave privada completos (com as linhas BEGIN/END).' }, { status: 400 });
      const dir = `/tmp/vhost-ssl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const fich = [`${d}.crt`, crt, `${d}.key`, key, ...(ca ? [`${d}.ca`, ca] : [])];
      const escrever = [];
      for (let i = 0; i < fich.length; i += 2) escrever.push(`echo ${b64(fich[i + 1] + '\n')} | base64 -d > ${q(dir + '/' + fich[i])}`);
      await executeServerCommand(`umask 077 && mkdir -p ${q(dir)} && ${escrever.join(' && ')}`, { timeoutMs: 20_000 });
      const temSsl = (w.SSL || 'no').toLowerCase() === 'yes';
      const x = await call(temSsl ? 'v-change-web-domain-sslcert' : 'v-add-web-domain-ssl', [conta, d, dir, ...(temSsl ? [] : ['same']), 'yes']);
      await executeServerCommand(`rm -rf ${q(dir)}`, { timeoutMs: 20_000 }).catch(() => '');
      return resposta(x);
    }
    case 'dominio-apagar':
      return resposta(call(w ? 'v-delete-web-domain' : 'v-delete-mail-domain', [conta, d]));
    case 'dominio-suspender':
      return resposta(call('v-suspend-web-domain', [conta, d]));
    case 'dominio-reativar':
      return resposta(call('v-unsuspend-web-domain', [conta, d]));
    case 'alias-criar': {
      const a = linhaLimpa(c.alias).toLowerCase().replace(/^www\./, '');
      if (!DOM.test(a)) return NextResponse.json({ erro: 'Apontador inválido.' }, { status: 400 });
      return resposta(call('v-add-web-domain-alias', [conta, d, a]));
    }
    case 'alias-apagar':
      return resposta(call('v-delete-web-domain-alias', [conta, d, linhaLimpa(c.alias).toLowerCase()]));
    case 'ssl-le': {
      // Como no DirectAdmin: o domínio vai sempre; dos apontadores (www.…, etc.) só os que vierem marcados.
      // Sem `nomes` (pedido antigo) o Hestia decide como antes.
      if (!w) return NextResponse.json({ erro: 'Este domínio não tem site.' }, { status: 400 });
      // subdomínio sem registo no DNS (criado antes de o painel o pôr): cria-o primeiro, senão o Let's Encrypt recusa
      const falhaDns = await garantirDnsSubdominio(d);
      if (falhaDns) return NextResponse.json({ erro: 'O subdomínio não tem DNS e o painel não o conseguiu criar (' + falhaDns + '). Crie o registo A em DNS.' }, { status: 400 });
      if (!Array.isArray(c.nomes)) {
        marcarSslPendente(d, conta);
        try {
          return await resposta(hestia.issueLetsEncrypt(conta, d));
        } finally {
          limparSslPendente(d);
        }
      }
      const existentes = String(w.ALIAS || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
      const nomes = [...new Set((c.nomes as unknown[]).map((x) => linhaLimpa(x).toLowerCase()))].filter((x) => x && x !== d);
      const fora = nomes.find((x) => !existentes.includes(x));
      if (fora) return NextResponse.json({ erro: fora + ' não é apontador deste domínio.' }, { status: 400 });
      return resposta(hestia.issueLetsEncrypt(conta, d, nomes));
    }
    case 'ssl-mail-le': {
      if (!w) return NextResponse.json({ erro: 'Este domínio não tem site.' }, { status: 400 });
      const m = srv.mail[conta]?.[d];
      if (!m) return NextResponse.json({ erro: 'O e-mail deste domínio não está alojado neste servidor.' }, { status: 400 });
      // Já tem o certificado grátis (renova-se sozinho): pedir outro falhava no Let's Encrypt ("finalize bad status
      // 403") e o painel mostrava erro com o SSL do e-mail a funcionar (Silva, 15/10/2026). Só se pede outro com `forcar`.
      if ((m.SSL || 'no').toLowerCase() === 'yes' && (m.LETSENCRYPT || 'no').toLowerCase() === 'yes' && !c.forcar)
        return NextResponse.json({ ok: true, aviso: 'O e-mail e o webmail de ' + d + ' já têm SSL válido (renova-se sozinho).' });
      return resposta(hestia.issueMailLetsEncrypt(conta, d));
    }
    case 'ssl-apagar': {
      // Cancelar o certificado: o Let's Encrypt sai com a renovação automática; um certificado próprio sai só ele
      if (!w) return NextResponse.json({ erro: 'Este domínio não tem site.' }, { status: 400 });
      if ((w.SSL || 'no').toLowerCase() !== 'yes') return NextResponse.json({ erro: 'Este domínio não tem certificado.' }, { status: 400 });
      const le = (w.LETSENCRYPT || 'no').toLowerCase() === 'yes';
      return resposta(call(le ? 'v-delete-letsencrypt-domain' : 'v-delete-web-domain-ssl', [conta, d, 'yes']));
    }
    case 'ssl-forcar':
      return resposta(call(c.ligar ? 'v-add-web-domain-ssl-force' : 'v-delete-web-domain-ssl-force', [conta, d]));
    case 'ftp-criar': {
      const user = linhaLimpa(c.user).toLowerCase();
      const pasta = linhaLimpa(c.pasta).replace(/^\/+|\/+$/g, '');
      if (!/^[a-z0-9_]{1,24}$/.test(user)) return NextResponse.json({ erro: 'Nome da conta FTP: letras, números e _.' }, { status: 400 });
      if (pasta.includes('..')) return NextResponse.json({ erro: 'Pasta inválida.' }, { status: 400 });
      if (String(c.senha || '').length < 8) return NextResponse.json({ erro: 'A palavra-passe precisa de pelo menos 8 caracteres.' }, { status: 400 });
      return resposta(hestia.addFtpAccount(conta, d, user, String(c.senha), pasta || undefined));
    }
    case 'ftp-apagar':
      return resposta(hestia.deleteFtpAccount(conta, d, linhaLimpa(c.user)));
    case 'ftp-senha':
      if (String(c.senha || '').length < 8) return NextResponse.json({ erro: 'A palavra-passe precisa de pelo menos 8 caracteres.' }, { status: 400 });
      return resposta(hestia.changeFtpPassword(conta, d, linhaLimpa(c.user), String(c.senha)));
    case 'bd-criar': {
      if (String(c.senha || '').length < 8) return NextResponse.json({ erro: 'A palavra-passe precisa de pelo menos 8 caracteres.' }, { status: 400 });
      const x = await hestia.createDatabase({ username: conta, dbNameSuffix: linhaLimpa(c.nome), dbUserSuffix: linhaLimpa(c.user || c.nome), password: String(c.senha) });
      return resposta(x);
    }
    case 'bd-apagar':
      return resposta(hestia.deleteDatabase(conta, linhaLimpa(c.nome)));
    case 'bd-senha':
      if (String(c.senha || '').length < 8) return NextResponse.json({ erro: 'A palavra-passe precisa de pelo menos 8 caracteres.' }, { status: 400 });
      return resposta(hestia.changeDatabasePassword(conta, linhaLimpa(c.nome), String(c.senha)));
    // DNS: com zona na Cloudflare, muda-se lá (é o DNS público) e a zona do servidor acompanha; sem ela, no servidor
    case 'dns-criar': {
      const tipo = linhaLimpa(c.tipo).toUpperCase();
      const nome = linhaLimpa(c.nome) || '@';
      const valor = linhaLimpa(c.valor);
      const ttl = Number(c.ttl) || 3600;
      if (!['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV', 'CAA'].includes(tipo) || !valor) return NextResponse.json({ erro: 'Tipo ou valor do registo inválido.' }, { status: 400 });
      const zona = zonaDe(d);
      const zid = await zonaCf(zona);
      if (!zid) {
        if (srv.dns[conta]?.[d]) return resposta(hestia.addDnsRecord(conta, d, nome, tipo, valor, ttl, linhaLimpa(c.prio) || undefined), false);
        return NextResponse.json({ erro: 'O DNS deste domínio não está nem no servidor nem na Cloudflare.' }, { status: 400 });
      }
      if (!NA_CLOUDFLARE.includes(tipo)) return NextResponse.json({ erro: 'Na Cloudflare, por agora só A, AAAA, CNAME, TXT e MX.' }, { status: 400 });
      const x = await upsertCloudflareRecord(zid, zona, { type: tipo as CloudflareRecordInput['type'], name: nome, content: valor, ttl, priority: Number(c.prio) || undefined, proxied: c.proxied === true });
      if (x.ok) espelharNoServidor(zona);
      return resposta({ ok: x.ok, error: x.error }, false);
    }
    case 'dns-editar': {
      const id = linhaLimpa(c.id);
      const tipo = linhaLimpa(c.tipo).toUpperCase();
      const nome = linhaLimpa(c.nome) || '@';
      const valor = linhaLimpa(c.valor);
      const ttl = Number(c.ttl) || 3600;
      if (!id || !valor) return NextResponse.json({ erro: 'Registo inválido.' }, { status: 400 });
      const zona = zonaDe(d);
      const zid = await zonaCf(zona);
      if (!zid) {
        if (srv.dns[conta]?.[d]) return resposta(call('v-change-dns-record', [conta, d, id, nome, tipo, valor, linhaLimpa(c.prio), 'yes', String(ttl)]), false);
        return NextResponse.json({ erro: 'Zona não encontrada.' }, { status: 400 });
      }
      if (!NA_CLOUDFLARE.includes(tipo)) return NextResponse.json({ erro: 'Este tipo de registo muda-se na Cloudflare.' }, { status: 400 });
      // o proxy (nuvem laranja) fica como estava, a não ser que o pedido o mude
      const x = await updateCloudflareDnsRecord(zid, id, zona, { type: tipo as CloudflareRecordInput['type'], name: nome, content: valor, ttl, priority: Number(c.prio) || undefined, proxied: typeof c.proxied === 'boolean' ? c.proxied : undefined });
      if (x.ok) espelharNoServidor(zona);
      return resposta(x, false);
    }
    case 'dns-apagar': {
      const id = linhaLimpa(c.id);
      const zona = zonaDe(d);
      const zid = await zonaCf(zona);
      if (!zid) return srv.dns[conta]?.[d] ? resposta(hestia.deleteDnsRecord(conta, d, id), false) : NextResponse.json({ erro: 'Zona não encontrada.' }, { status: 400 });
      const x = await deleteCloudflareDnsRecord(zid, id);
      if (x.ok) espelharNoServidor(zona);
      return resposta(x, false);
    }
    case 'dns-proxy': {
      const id = linhaLimpa(c.id);
      const tipo = linhaLimpa(c.tipo).toUpperCase();
      const nome = linhaLimpa(c.nome) || '@';
      const valor = linhaLimpa(c.valor);
      if (!id || !valor || typeof c.proxied !== 'boolean') return NextResponse.json({ erro: 'Registo inválido.' }, { status: 400 });
      if (!['A', 'AAAA', 'CNAME'].includes(tipo)) return NextResponse.json({ erro: 'Só os registos A, AAAA e CNAME podem ter proxy.' }, { status: 400 });
      const zona = zonaDe(d);
      const zid = await zonaCf(zona);
      if (!zid) return NextResponse.json({ erro: 'O DNS deste domínio não está na Cloudflare.' }, { status: 400 });
      if (!usaNameserversCloudflare(await nameservers(zona))) {
        return NextResponse.json({ erro: 'O domínio não está a usar nameservers da Cloudflare.' }, { status: 409 });
      }
      return resposta(updateCloudflareDnsRecord(zid, id, zona, { type: tipo as CloudflareRecordInput['type'], name: nome, content: valor, ttl: c.proxied ? 1 : Number(c.ttl) || 1, proxied: c.proxied }), false);
    }
    case 'dns-reprocessar':
      return reprocessarDns(conta, d, srv);
    case 'redir-dominio': {
      const url = linhaLimpa(c.url);
      if (!/^https?:\/\/\S+$/.test(url)) return NextResponse.json({ erro: 'Destino inválido (https://…).' }, { status: 400 });
      return resposta(call('v-add-web-domain-redirect', [conta, d, url, ['301', '302'].includes(String(c.codigo)) ? String(c.codigo) : '301', 'yes']));
    }
    case 'redir-dominio-tirar':
      return resposta(call('v-delete-web-domain-redirect', [conta, d, 'yes']));
    case 'htaccess': {
      // regras do VisualHost no .htaccess: redirecionamentos por caminho e proteção hotlink (sites com Apache)
      if (!w) return NextResponse.json({ erro: 'Este domínio não tem site.' }, { status: 400 });
      const linhas = (Array.isArray(c.linhas) ? c.linhas : []).map(linhaLimpa).filter(Boolean);
      if (linhas.some((l) => !/^(Redirect (301|302) \/\S* https?:\/\/\S+|RewriteEngine On|RewriteCond .+|RewriteRule .+|# .*)$/.test(l))) return NextResponse.json({ erro: 'Regra inválida.' }, { status: 400 });
      await escreverBloco(conta, raiz + '/.htaccess', MARCA_HT, linhas);
      return NextResponse.json({ ok: true });
    }
    case 'php-versao':
      return resposta(hestia.changeWebDomainPhp(conta, d, linhaLimpa(c.versao)));
    case 'php-ini': {
      if (!w) return NextResponse.json({ erro: 'Este domínio não tem site.' }, { status: 400 });
      const pares = (Array.isArray(c.regras) ? c.regras : []) as { k: string; v: string }[];
      const linhas = pares.map((p) => `${linhaLimpa(p.k)} = ${linhaLimpa(p.v)}`);
      if (pares.some((p) => !/^[a-z0-9_.]{2,60}$/.test(linhaLimpa(p.k)) || /[;\n]/.test(String(p.v)))) return NextResponse.json({ erro: 'Diretiva PHP inválida.' }, { status: 400 });
      await escreverBloco(conta, raiz + '/.user.ini', MARCA_INI, linhas);
      return NextResponse.json({ ok: true });
    }
    default:
      return NextResponse.json({ erro: 'Ação desconhecida.' }, { status: 400 });
  }
}
