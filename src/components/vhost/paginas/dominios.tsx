'use client';

// Gestão de domínios (painel Utilizador): domínios, subdomínios, DNS, SSL/TLS, FTP, bases de dados, apontadores,
// redirecionamentos, proteção hotlink e definições PHP. Campos copiados do DirectAdmin (ver
// VisualHost/05-da-gestao-de-dominios.md); dados e alterações reais no servidor (Hestia + Cloudflare) por
// /api/vhost/dominio. As páginas de um só domínio usam o domínio escolhido no seletor da faixa de navegação.
import { Fragment, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { ConsultaPagina, TopoCartao, useVH, type VH } from '../context';
import type { ScreenFn } from '../screens';
import type { BaseDados, Domain } from '../types';
import { findItem, hasFeatOf, pacoteDe } from '../state';
import { getPhpMyAdminUrl } from '@/lib/server-config';
import { VISUALDESIGN_DEFAULT_NS, ehNsNosso } from '@/lib/visualdesign-dns';
import { Check, DataTable, Frm, MaisOpcoes, novaSenha, Row, Senha, Switch, Tabs, type Col } from './componentes';
import { IndicacaoDominio, NoTopoCartao, useVariosDominios } from '../ui';
import { tituloDoCartao } from '../titulos-cartao';
import { CATEGORIAS_PHP, EXTENSOES_PHP, estadoExtensao, type EstadoExtensao, type ExtensaoPhp } from '@/lib/php-extensoes';
import { Confirmar } from './pacotes';
import { ApagarSite, corpoApagar, tipoDosDominios } from './apagar-site';
import DomainSearch from '@/components/DomainSearchPainel';
import { EsperaPagina, useGet, useNaMemoria } from '../carga';
import { EN } from '../generated/data';
import { BotaoPassar } from './passar';
import { TransferirDominio } from './transferir-dominio';

// Textos novos do cabeçalho de Domínios e Subdomínios, já em inglês (regra do Silva: conteúdo novo entra traduzido)
{
  const novas: Record<string, string> = {
    'Gestão de domínios': 'Domain management',
    'Subdomínios do site': 'Subdomains of the site',
    'Use a versão mais recente do PHP para acelerar o seu site': 'Use the latest PHP version to speed up your site',
    'Abrir os ficheiros deste domínio': 'Open this domain’s files',
    'Inativo': 'Inactive',
    'Para onde apontam o seu site e o seu e-mail': 'Where your website and your email point to',
    'expirou': 'expired',
    'até': 'until',
    'Pendente': 'Pending',
    'conta': 'account',
    'contas': 'accounts',
    'Nenhuma conta': 'No accounts',
    'Crie bases de dados do seu site, com o número de utilizadores que lhes acedem, o tamanho e o número de tabelas abaixo': "Create your site's databases, with the number of users that access them, the size and the number of tables below",
    'Registos DNS deste domínio, guardados neste servidor': 'DNS records of this domain, stored on this server',
    'O DNS deste domínio está fora da Visual Design': 'The DNS of this domain is outside Visual Design',
    'Ligado à Cloudflare: o que alterar aqui muda logo nos registos DNS dos seus domínios': "Connected to Cloudflare: what you change here changes your domains' DNS records right away",
    'Gerir os domínios e os subdomínios desta conta': 'Manage the domains and subdomains of this account',
    'Os sites e os domínios desta conta': 'The sites and domains of this account',
    'Os subdomínios e as pastas deste domínio': 'The subdomains and folders of this domain',
  };
  for (const [pt, en] of Object.entries(novas)) if (!(pt in EN)) EN[pt] = en;
}

// ---------- Ligação ao servidor ----------
type Detalhe = {
  redirecionamento: { url: string; codigo: string } | null;
  sslForcado: boolean;
  hsts: boolean;
  modelo: string;
  backend: string;
  sslAtivo: boolean;
  renovacaoAutomatica: boolean;
  certificado: { para: string; nomes: string[]; desde: string; ate: string; emissor: string } | null;
  dns: { fonte: 'hestia' | 'cloudflare' | 'nenhuma'; zona: string; cloudflareAutoritativa?: boolean; registos: { id: string; nome: string; tipo: string; valor: string; ttl: number; prio?: string; proxied?: boolean }[] };
  siteVercel?: boolean | null;
  subdominios?: {
    nome: string;
    aliases: string[];
    sslAtivo: boolean;
    renovacaoAutomatica: boolean;
    temEmail: boolean;
    emailSsl?: boolean;
    siteVercel: boolean | null;
    certificado: { para: string; nomes: string[]; desde: string; ate: string; emissor: string } | null;
  }[];
  php: { k: string; v: string }[];
  /** versão do PHP do servidor para os sites no modelo "padrão" */
  phpPadrao?: string;
  htaccess: string[];
  /** nameservers reais do domínio (DNS público) */
  ns?: string[];
};
type DnsContexto = { dns: { fonte: 'hestia' | 'cloudflare' | 'nenhuma'; zona: string; cloudflareAutoritativa?: boolean; registos: RegistoDns[] }; siteVercel?: boolean | null };
type CertificadoServidor = {
  certificado: string;
  cadeia: string;
  emissor: string;
  sujeito: string;
  nomes: string[];
  desde: string;
  ate: string;
  impressaoDigital: string;
  tipoChave: string;
};
type EventoSsl = { data: string; comando: string; acao: string };
type HistoricoSsl = { historico: EventoSsl[] };
type AlvoSsl = { id: string; dominio: string; tipo: 'site' | 'email'; nomes: string[]; estado: 'ok' | 'externo' | 'desconhecido' | 'em-falta' };

/** Faz uma alteração ao domínio no servidor; depois volta a ler os dados (`recarregar`: a conta toda; os registos
 *  de DNS não a mudam). Devolve true se correu bem. */
async function noServidor(vh: VH, corpo: Record<string, unknown>, ok: string, recarregar = true): Promise<boolean> {
  vh.toast('A alterar no servidor…');
  try {
    const r = await fetch('/api/vhost/dominio', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conta: vh.me, ...corpo }) });
    const j = (await r.json().catch(() => ({}))) as { erro?: string; aviso?: string };
    if (!r.ok) {
      vh.toast(j.erro || 'A alteração falhou');
      if (corpo.acao === 'dominio-apagar') await vh.recarregar(true);
      return false;
    }
    if (recarregar) await vh.recarregar(true);
    vh.toast(j.aviso || ok);
    return true;
  } catch {
    vh.toast('Sem ligação ao site. Nada foi alterado.');
    return false;
  }
}

/** Relatório do "Reprocessar DNS" (Silva, 20/10/2026): cada registo com o seu estado — verde: posto agora ou já certo;
 *  vermelho: falhou (com o motivo); laranja: ainda não se vê no DNS público. O que falta vem primeiro. */
export type ItemRel = { nome: string; estado: 'novo' | 'certo' | 'falhou' | 'pendente'; detalhe?: string };
const ORDEM_REL: Record<ItemRel['estado'], number> = { falhou: 0, pendente: 1, novo: 2, certo: 3 };
const ICONE_REL: Record<ItemRel['estado'], string> = { novo: 'fa-circle-check', certo: 'fa-circle-check', falhou: 'fa-circle-xmark', pendente: 'fa-clock' };
const TEXTO_REL: Record<ItemRel['estado'], string> = { novo: 'Adicionado', certo: 'Certo', falhou: 'Falhou', pendente: 'A propagar' };

export function RelatorioDns({ dominio, itens, onFechar }: { dominio: string; itens: ItemRel[]; onFechar?: () => void }) {
  const { t } = useVH();
  const ordenados = [...itens].sort((x, y) => ORDEM_REL[x.estado] - ORDEM_REL[y.estado]);
  const n = (e: ItemRel['estado']) => itens.filter((i) => i.estado === e).length;
  const tudoCerto = n('falhou') === 0 && n('pendente') === 0;
  return (
    <div className={'dom-rel' + (tudoCerto ? ' ok' : '')}>
      <div className="dom-rel-cab">
        <b>
          <i className={'fa-solid ' + (tudoCerto ? 'fa-circle-check' : 'fa-triangle-exclamation')} /> {t('Relatório do DNS')}
        </b>
        {onFechar && (
          <button className="dom-rel-x" onClick={onFechar} title={t('Fechar')}>
            <i className="fa-solid fa-xmark" />
          </button>
        )}
      </div>
      <div className="dom-rel-dom">{dominio}</div>
      <div className="dom-rel-res">
        {n('novo') > 0 && <span className="ok">{n('novo')} {t('adicionados')}</span>}
        {n('certo') > 0 && <span className="ok">{n('certo')} {t('certos')}</span>}
        {n('pendente') > 0 && <span className="w">{n('pendente')} {t('a propagar')}</span>}
        {n('falhou') > 0 && <span className="er">{n('falhou')} {t('falharam')}</span>}
      </div>
      {ordenados.map((i, k) => (
        <div key={k} className={'dom-rel-l ' + i.estado}>
          <i className={'fa-solid ' + ICONE_REL[i.estado]} />
          <div>
            <span>{i.nome}</span>
            {i.detalhe && <small>{i.detalhe}</small>}
          </div>
          <em>{t(TEXTO_REL[i.estado])}</em>
        </div>
      ))}
    </div>
  );
}

export type ResultadoDns = { ok: boolean; aviso: string; itens: ItemRel[] };
/** Pede ao servidor que reprocesse o DNS de um domínio e devolve o relatório. `ligarEmail`: o ecrã de e-mail usa o mesmo
 *  botão e, se o domínio ainda não recebe e-mail neste servidor, o servidor liga-o antes de repor os registos */
export async function reprocessarUm(vh: VH, dominio: string, ligarEmail = false): Promise<ResultadoDns> {
  try {
    const r = await fetch('/api/vhost/dominio', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conta: vh.me, acao: 'dns-reprocessar', dominio, ...(ligarEmail ? { ligarEmail: true } : {}) }) });
    const j = (await r.json().catch(() => ({}))) as { erro?: string; aviso?: string; relatorio?: ItemRel[] };
    if (!r.ok) return { ok: false, aviso: j.erro || 'A alteração falhou', itens: [{ nome: 'DNS', estado: 'falhou', detalhe: j.erro || 'A alteração falhou' }] };
    return { ok: true, aviso: j.aviso || 'DNS reprocessado', itens: j.relatorio || [] };
  } catch {
    return { ok: false, aviso: 'Sem ligação ao site', itens: [{ nome: 'DNS', estado: 'falhou', detalhe: 'Sem ligação ao site. Nada foi alterado.' }] };
  }
}

/** Reprocessar o DNS de vários domínios, um a um, e mostrar numa janela o relatório de cada um: repõe o site e o
 *  e-mail (SPF, DKIM, DMARC, MX), serve domínios registados em qualquer registador e confere no fim. */
export async function reprocessarVarios(vh: VH, nomes: string[], ligarEmail = false) {
  const { t, openM, closeM } = vh;
  const resultados: { d: string; r: ResultadoDns }[] = [];
  for (const [i, dominio] of nomes.entries()) {
    vh.toast(t('A reprocessar o DNS…') + ' ' + dominio + ' (' + (i + 1) + '/' + nomes.length + ')');
    resultados.push({ d: dominio, r: await reprocessarUm(vh, dominio, ligarEmail) });
  }
  vh.toast(t('DNS reprocessado'));
  openM(
    <>
      <h3>{t('DNS reprocessado')}</h3>
      <div style={{ display: 'grid', gap: 12, margin: '14px 0', maxHeight: '60vh', overflowY: 'auto' }}>
        {resultados.map(({ d, r }) => (
          <RelatorioDns key={d} dominio={d} itens={r.itens} />
        ))}
      </div>
      <div className="mfoot">
        <button className="btn r" onClick={closeM}>
          {t('Fechar')}
        </button>
      </div>
    </>,
  );
  return resultados.map((x) => x.r);
}

function nomeDnsPertence(nome: string, dominio: string, host: string): boolean {
  const n = nome.toLowerCase().replace(/\.$/, '');
  return n === host || n === `${host}.${dominio}` || (host === dominio && n === '@');
}

function siteNaVercel(registos: RegistoDns[], dominio: string): boolean {
  return registos.some((registo) => {
    if (!['A', 'AAAA', 'CNAME'].includes(registo.tipo.toUpperCase())) return false;
    if (!nomeDnsPertence(registo.nome, dominio, dominio) && !nomeDnsPertence(registo.nome, dominio, 'www')) return false;
    const valor = registo.valor.toLowerCase().replace(/\.$/, '');
    if (valor.includes('vercel')) return true;
    const ip = valor.split('.').map(Number);
    // Captures Vercel's IPv4 edge ranges, including the addresses seen in its ACME validation response.
    return ip.length === 4 && ((ip[0] === 76 && ip[1] === 76 && ip[2] === 21) || (ip[0] === 66 && ip[1] === 33 && ip[2] === 60));
  });
}

function vercelConfirmada(fonte: 'hestia' | 'cloudflare' | 'nenhuma', siteVercel: boolean | null | undefined, registos: RegistoDns[], dominio: string): boolean {
  if (siteVercel != null) return siteVercel;
  return fonte !== 'hestia' && siteNaVercel(registos, dominio);
}

function registosDnsEmail(registos: RegistoDns[], dominio: string): RegistoDns[] {
  return registos.filter((registo) => {
    const nome = registo.nome.toLowerCase().replace(/\.$/, '');
    const valor = registo.valor.toLowerCase();
    const rotulo = nome === '@' || nome === dominio ? '' : nome.endsWith(`.${dominio}`) ? nome.slice(0, -(dominio.length + 1)) : nome;
    if (['MX', 'SRV'].includes(registo.tipo.toUpperCase())) return true;
    if (['A', 'AAAA', 'CNAME'].includes(registo.tipo.toUpperCase())) {
      return /(^|\.)(mail|webmail|smtp|imap|pop|pop3|autoconfig|autodiscover)$/.test(rotulo);
    }
    if (registo.tipo.toUpperCase() === 'TXT') {
      return valor.includes('v=spf1') || rotulo === '_dmarc' || rotulo.endsWith('._domainkey');
    }
    return false;
  });
}

async function lerDnsDominio(vh: VH, dominio: string): Promise<DnsContexto | null> {
  try {
    const url = `/api/vhost/dominio?conta=${encodeURIComponent(vh.me)}&d=${encodeURIComponent(dominio)}&so=dns`;
    const resposta = await fetch(url, { cache: 'no-store' });
    const dados = (await resposta.json().catch(() => ({}))) as Partial<DnsContexto> & { erro?: string };
    if (!resposta.ok || !dados.dns || !Array.isArray(dados.dns.registos)) {
      vh.toast(dados.erro || 'Não foi possível ler os registos DNS do domínio.');
      return null;
    }
    return dados as DnsContexto;
  } catch {
    vh.toast('Sem ligação ao site. Não foi possível verificar o alojamento e nada foi alterado.');
    return null;
  }
}

/** Detalhe de um domínio (certificado, DNS, redirecionamento, regras PHP e .htaccess), lido quando a página abre
 *  (memória comum do painel: ao voltar aparece logo e atualiza-se por trás).
 *  `so: 'dns'` lê só os registos e os nameservers (a página de DNS não precisa do resto). */
function useDetalhe(d: string, so?: 'dns') {
  const { me } = useVH();
  const { dados, erro, ler } = useGet<Detalhe>(d ? '/api/vhost/dominio?conta=' + encodeURIComponent(me) + '&d=' + encodeURIComponent(d) + (so ? '&so=' + so : '') : null);
  return { det: dados, erro, ler };
}

/** Domínio em que se trabalha: o escolhido no seletor (só com site, se a página o pedir) */
function dominioAtual(vh: VH, soSite = true): Domain | undefined {
  const lista = vh.a.domains.filter((x) => !soSite || (!x.soEmail && !x.soDominio)); // o primeiro é o principal da conta
  return lista.find((x) => x.name === vh.s.dominio) || lista[0];
}
const ehSub = (nome: string, de: string) => nome.endsWith('.' + de);
function certificadoCobreNome(nomes: string[], dominio: string): boolean {
  const alvo = dominio.toLowerCase();
  return nomes.some((nome) => {
    const n = nome.toLowerCase();
    if (n === alvo) return true;
    if (!n.startsWith('*.')) return false;
    const sufixo = n.slice(1);
    return alvo.endsWith(sufixo) && alvo.slice(0, -sufixo.length).length > 0 && !alvo.slice(0, -sufixo.length).includes('.');
  });
}
/** Como `dominioAtual`, mas com um subdomínio escolhido dá o domínio de que ele faz parte */
function principalAtual(vh: VH): Domain | undefined {
  const x = dominioAtual(vh);
  return x && (vh.a.domains.find((y) => y !== x && ehSub(x.name, y.name)) || x);
}

function SemDominio({ soSite = true }: { soSite?: boolean }) {
  const { t, nav } = useVH();
  return (
    <div className="card empty">
      <p>{t(soSite ? 'Esta conta ainda não tem nenhum site.' : 'Esta conta ainda não tem domínios.')}</p>
      <button className="btn r" onClick={() => nav('/utilizador/dominios/novo')}>
        <i className="fa-solid fa-plus" />
        {t('Adicionar domínio')}
      </button>
    </div>
  );
}

/** Cabeçalho do cartão de Domínios e Subdomínios (experiência do Silva, 21/10/2026): em cima, o título da página em letra light com uma
 *  linha por baixo; logo por baixo da linha, à esquerda, a indicação do domínio (só numa conta com vários domínios; com um só, a
 *  descrição breve da página) e o botão da página à direita */
function CabDominios({ titulo = 'Gestão de domínios', pesquisa, children }: { titulo?: string; pesquisa?: { valor: string; mudar: (v: string) => void }; children: ReactNode }) {
  const { t } = useVH();
  const topo = useContext(TopoCartao);
  const varios = useVariosDominios(topo?.dominios);
  return (
    <>
      {/* a indicação de trocar de domínio (só em Domínios, e só com vários domínios) fica por baixo do título, antes da linha */}
      <NoTopoCartao daPagina titulo={t(titulo)} descTitulo={varios ? <IndicacaoDominio emLinha dominios={topo?.dominios} dominioUrl={topo?.dominioUrl} /> : undefined}>
        {null}
      </NoTopoCartao>
      {/* por baixo da linha: a pesquisa à esquerda (se a página a tiver) e o botão à direita */}
      <div className="seccao-h dom-cab">
        {pesquisa ? (
          <div className="search dom-pesq">
            <i className="fa-solid fa-magnifying-glass" />
            <input value={pesquisa.valor} onChange={(e) => pesquisa.mudar(e.target.value)} placeholder={t('Pesquisar')} aria-label={t('Pesquisar')} />
            {pesquisa.valor && <i className="fa-solid fa-xmark limpar" onClick={() => pesquisa.mudar('')} />}
          </div>
        ) : (
          <span className="dom-ctx" />
        )}
        {children}
      </div>
    </>
  );
}

function Carregar({ erro, ler }: { erro: string; ler: () => void }) {
  const { t } = useVH();
  return erro ? (
    <div className="imp">
      <i className="fa-solid fa-triangle-exclamation" />
      <div>{erro}</div>
      <button className="btn g sm" onClick={ler}>
        {t('Tentar de novo')}
      </button>
    </div>
  ) : null; // a carregar: só a linha do topo
}

/** Aviso do domínio em que se está a trabalhar (muda-se no seletor, em cima à direita) */
function Contexto({ d, extra }: { d: string; extra?: string }) {
  const { t } = useVH();
  return (
    <p className="dom-ctx">
      <i className="fa-solid fa-globe" /> {t('Domínio')}: <b>{d}</b>
      {extra ? ' · ' + extra : ''} <span>· {t('muda-se no seletor em cima, à direita')}</span>
    </p>
  );
}

/** Tráfego como número: usado/total do pacote (ex.: 125/1000, em MB); sem limite no pacote fica 125/∞ */
function trafego(usado?: number, total?: number | null): string {
  if (usado === undefined) return '—';
  return Math.round(usado) + '/' + (total == null ? '∞' : Math.round(total));
}

// ---------- Domínios ----------
type LinhaDom = Domain & { subs: number };

// Tudo o que é sobre domínios fica num só menu, "Domínios", com separadores (pedido do Silva, 13/10/2026):
// Domínios | Subdomínios | Registar domínio | Transferir domínio (adicionar domínio é a janela do botão, Silva 20/10/2026)
type AbaDom = 'meus' | 'subdominios' | 'registar' | 'transferir';
const ROTA_ABA: Record<AbaDom, string> = { meus: '', subdominios: '/subdominios', registar: '/registar', transferir: '/transferir' };

function ListaDominios({ abaDom = 'meus', abrirNovo = false }: { abaDom?: AbaDom; abrirNovo?: boolean }) {
  const vh = useVH();
  const { a, t, nav, openM, setDominio } = vh;
  const [busca, setBusca] = useState(''); // a caixa de pesquisa fica por baixo da linha do cartão, à esquerda
  // o endereço antigo /dominios/novo (ligações e favoritos) abre a janela de adicionar domínio sobre a lista
  const abriu = useRef(false);
  useEffect(() => {
    if (!abrirNovo || abriu.current) return;
    abriu.current = true;
    nav('/' + vh.s.level + '/dominios');
    openM(<NovoDominio />);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abrirNovo]);
  const sites = a.domains;
  const rows: LinhaDom[] = sites.filter((x) => !sites.some((y) => y !== x && ehSub(x.name, y.name))).map((x) => ({ ...x, subs: sites.filter((y) => ehSub(y.name, x.name)).length }));
  const cols: Col<LinhaDom>[] = [
    {
      k: 'nome',
      t: 'Domínio',
      sort: (r) => r.name,
      cell: (r) => (
        <div className="cell">
          <div className={'ic ' + (r.soEmail ? 'c2' : r.soDominio ? 'c1' : r.wp ? 'c6' : 'c3')}>
            <i className={r.soEmail ? 'fa-solid fa-envelope' : r.soDominio ? 'fa-solid fa-globe' : r.wp ? 'fa-brands fa-wordpress' : 'fa-solid fa-globe'} />
          </div>
          <div>
            <a className="lk lk-dom" style={{ display: 'block' }} onClick={() => nav('/' + vh.s.level + '/dominios/' + encodeURIComponent(r.name))}>
              {r.name}
            </a>
          </div>
        </div>
      ),
    },
    { k: 'bw', t: 'Tráfego', cell: (r) => trafego(r.bwMb, a.bwLimMb) },
    { k: 'disco', t: 'Espaço em disco', cell: (r) => r.disk },
    { k: 'subs', t: 'Subdomínios', sort: (r) => r.subs, cell: (r) => r.subs },
    {
      k: 'ssl',
      t: 'SSL',
      cell: (r) =>
        r.soEmail || r.soDominio ? (
          '—'
        ) : r.ssl !== 'ok' && r.sslPendente ? (
          <span className="tag w">
            <i className="fa-solid fa-spinner fa-spin" /> {t('A processar SSL…')}
          </span>
        ) : (
          <span className={'tag ' + (r.ssl === 'ok' ? 'ok' : 'w')}>{r.ssl === 'ok' ? t('Seguro') : t('Sem SSL')}</span>
        ),
    },
    { k: 'php', t: 'PHP', cell: (r) => (r.soEmail || r.soDominio ? '—' : r.php), hidden: true },
    { k: 'estado', t: 'Estado', cell: (r) => <span className={'tag ' + (r.status === 'ok' ? 'ok' : 'off')}>{r.status === 'ok' ? t('Ativo') : t('Suspenso')}</span> },
  ];
  const varios = (keys: string[], acao: string, msg: string) =>
    keys.reduce<Promise<unknown>>((p, k) => p.then(() => noServidor(vh, { acao, dominio: k }, msg + ': ' + k)), Promise.resolve());

  return (
    <>
      <Tabs<AbaDom>
        tabs={[
          ['meus', 'Domínios', 'fa-globe'],
          ['subdominios', 'Subdomínios', 'fa-sitemap'],
          ['registar', 'Registar domínio', 'fa-cart-shopping'],
          ['transferir', 'Transferir domínio', 'fa-right-left'],
        ]}
        on={abaDom}
        onChange={(k) => nav('/' + vh.s.level + '/dominios' + ROTA_ABA[k])}
      />

      {abaDom === 'registar' ? (
        <Frm className="dom-registar">
          <div className="dom-registar-corpo">
            <DomainSearch isAdmin />
          </div>
        </Frm>
      ) : abaDom === 'subdominios' ? (
        <Subdominios />
      ) : abaDom === 'transferir' ? (
        <TransferirDominio />
      ) : (
        <>
          <CabDominios pesquisa={{ valor: busca, mudar: setBusca }}>
            <button className="btn r" onClick={() => openM(<NovoDominio />)}>
              <i className="fa-solid fa-plus" />
              {t('Adicionar domínio')}
            </button>
          </CabDominios>
        <DataTable
          id="dominios"
          umaLinha
          barraFora
          consulta={busca}
          rows={rows}
          cols={cols}
          rowKey={(r) => r.name}
          search={(r) => r.name}
          empty="Ainda não há domínios nesta conta"
          bulk={[
            { t: 'Suspender', fa: 'fa-pause', run: (k) => varios(k, 'dominio-suspender', 'Suspenso') },
            { t: 'Reativar', fa: 'fa-play', run: (k) => varios(k, 'dominio-reativar', 'Reativado') },
            {
              t: 'Reprocessar DNS',
              fa: 'fa-arrows-rotate',
              run: (k) =>
                openM(
                  <Confirmar
                    titulo="Reprocessar o DNS?"
                    texto={t('Repõe os registos do site e do e-mail (SPF, DKIM, DMARC, MX) de {0} que estiverem em falta ou errados, em qualquer domínio — também os registados fora da Dynadot — e confere no fim. O que já está certo fica como está.').replace('{0}', k.join(', '))}
                    ok="Reprocessar"
                    onOk={() => reprocessarVarios(vh, k)}
                  />,
                ),
            },
            {
              t: 'Apagar',
              fa: 'fa-trash',
              run: (k) =>
                openM(
                  <ApagarSite
                    dominios={k}
                    tipo={tipoDosDominios(vh.a.domains, k)}
                    aoApagar={(modo) => k.reduce<Promise<unknown>>((p, n) => p.then(() => noServidor(vh, corpoApagar(modo, n), 'Apagado: ' + n)), Promise.resolve())}
                  />,
                ),
            },
          ]}
          actions={(r) => (
            <>
              <button
                className="btn g sm"
                title={t('Escolher este domínio no seletor')}
                onClick={() => {
                  setDominio(r.name);
                  nav('/' + vh.s.level + '/dominios/' + encodeURIComponent(r.name));
                }}
              >
                <i className="fa-solid fa-gear" />
                {t('Gerir')}
              </button>{' '}
              {/* link para o gestor de ficheiros, já na pasta deste domínio (Silva, 23/10/2026) — só a quem o plano deixa ver */}
              {!r.soEmail && !r.soDominio && hasFeatOf(vh.s, findItem('utilizador', 'ficheiros')?.feat, 'ficheiros', 'utilizador') && (
                <>
                  <button
                    className="btn g sm"
                    title={t('Abrir os ficheiros deste domínio')}
                    onClick={() => {
                      setDominio(r.name);
                      nav('/utilizador/ficheiros/web/' + encodeURIComponent(r.name));
                    }}
                  >
                    <i className="fa-solid fa-folder-open" />
                    {t('Ficheiros')}
                  </button>{' '}
                </>
              )}
              {!r.soEmail && !r.soDominio && <BotaoPassar dominio={r.name} />}
            </>
          )}
        />
        </>
      )}
    </>
  );
}

/** Janela "Adicionar domínio" (igual à de Adicionar subdomínio) — no lugar do separador que havia (Silva, 20/10/2026) */
function NovoDominio() {
  const vh = useVH();
  const { t, nav, closeM } = vh;
  const [d, setD] = useState('');
  const [ssl, setSsl] = useState(true);
  const criar = async () => {
    const n = d.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
    if (!/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(n)) return vh.toast('Escreva um domínio válido (ex.: empresa.co.mz)');
    closeM();
    if (await noServidor(vh, { acao: 'dominio-criar', dominio: n, ssl }, 'Domínio ' + n + ' criado')) {
      vh.setDominio(n);
      nav('/' + vh.s.level + '/dominios/' + encodeURIComponent(n));
    } else await vh.recarregar(true); // um erro a meio pode ter deixado o domínio criado: a lista volta a ler o servidor
  };
  return (
    <>
      <h3>{t('Adicionar domínio')}</h3>
      <div className="f">
        <label>{t('Domínio')}</label>
        <span className="igrp">
          <span className="ib" style={{ cursor: 'default' }}>
            <i className="fa-solid fa-globe" />
          </span>
          <input value={d} onChange={(e) => setD(e.target.value)} placeholder="ex.: empresa.co.mz" autoFocus onKeyDown={(e) => e.key === 'Enter' && criar()} />
        </span>
        <small style={{ color: 'var(--muted)' }}>{t('Sem maiúsculas, www ou http://')}</small>
      </div>
      <div className="sub-enderecos">
        <label className={'sub-end' + (ssl ? ' on' : '')}>
          <input type="checkbox" checked={ssl} onChange={(e) => setSsl(e.target.checked)} />
          <span>{t('Pedir certificado SSL automático')}</span>
          <small>{t("Certificado grátis Let's Encrypt, pedido logo a seguir")}</small>
        </label>
      </div>
      <div className="mfoot">
        <button className="btn g" onClick={closeM}>
          {t('Cancelar')}
        </button>
        <button className="btn r" onClick={criar}>
          <i className="fa-solid fa-plus" />
          {t('Adicionar domínio')}
        </button>
      </div>
    </>
  );
}

function MudarNomeModal({ d }: { d: string }) {
  const vh = useVH();
  const { t, closeM, nav, setDominio } = vh;
  const [novo, setNovo] = useState('');
  return (
    <>
      <h3>{t('Mudar o nome do domínio')}</h3>
      <div className="f">
        <label>{t('Nome atual')}</label>
        <input value={d} disabled />
      </div>
      <div className="f">
        <label>{t('Nome novo')}</label>
        <span className="igrp">
          <span className="ib" style={{ cursor: 'default' }}>
            <i className="fa-solid fa-globe" />
          </span>
          <input value={novo} onChange={(e) => setNovo(e.target.value)} placeholder="ex.: novodominio.co.mz" autoFocus />
        </span>
      </div>
      <p style={{ color: 'var(--muted)', fontSize: 12.5 }}>{t('Os ficheiros do site passam para o nome novo. O DNS do nome novo tem de apontar para este servidor.')}</p>
      <div className="mfoot">
        <button className="btn g" onClick={closeM}>
          {t('Cancelar')}
        </button>
        <button
          className="btn r"
          onClick={async () => {
            const n = novo.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
            if (!/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(n)) return vh.toast('Escreva um domínio válido');
            closeM();
            if (await noServidor(vh, { acao: 'dominio-nome', dominio: d, novo: n }, d + ' passou a ' + n)) {
              setDominio(n);
              nav('/utilizador/dominios/' + encodeURIComponent(n));
            }
          }}
        >
          {t('Mudar nome')}
        </button>
      </div>
    </>
  );
}

// VerDominio: Resumo e Modificar Domínio (cópia fiel dos recursos e visual do DirectAdmin Evolution edit.vue)

// ---------- Registo do domínio (registador) ----------
type Contacto = { name: string; email: string; telefone: string; morada: string; cidade: string; complete: boolean };
type InfoRegisto = {
  isLocked: boolean | null;
  autoRenew: boolean | null;
  expireDate: string;
  registrationDate: string;
  nameservers: string[];
  privacyEnabled: boolean | null;
  contactPreview: Contacto | null;
};

/** Dados do domínio no registador (/api/registrar/domain/manage): lidos uma vez e partilhados pelos cartões da página.
 *  `erro` quando o domínio não foi registado na Visual Design. */
function useRegistador(d: string) {
  // a página nova espera por esta leitura antes de aparecer (a anterior fica à vista — Silva, 16/10/2026)
  const espera = useContext(EsperaPagina);
  const [info, setInfo] = useState<InfoRegisto | null>(null);
  const [erro, setErro] = useState('');
  const [renovacao, setRenovacao] = useState<string | null>(null);
  useEffect(() => {
    let fim = false;
    setInfo(null);
    setErro('');
    setRenovacao(null);
    if (!d) return;
    const acabou = espera?.comecar();
    fetch('/api/registrar/domain/manage?domain=' + encodeURIComponent(d), { credentials: 'include' })
      .then(async (r) => {
        const j = (await r.json().catch(() => ({}))) as Partial<InfoRegisto> & { success?: boolean; error?: string };
        if (fim) return;
        if (r.ok && j.success)
          setInfo({
            isLocked: j.isLocked ?? null,
            autoRenew: j.autoRenew ?? null,
            expireDate: j.expireDate || '',
            registrationDate: j.registrationDate || '',
            nameservers: Array.isArray(j.nameservers) ? j.nameservers.map(String).filter(Boolean) : [],
            privacyEnabled: j.privacyEnabled ?? null,
            contactPreview: j.contactPreview ?? null,
          });
        // a mensagem do registador vem em inglês ("Could not find this domain"): o painel diz o que isso quer dizer
        else setErro('Este domínio não está registado na Visual Design.');
      })
      .catch(() => !fim && setErro('Sem ligação ao site. Tente de novo.'))
      .finally(() => acabou?.());
    // registo de renovação do domínio (para "Renovar domínio")
    fetch('/api/renewals?type=domain', { credentials: 'include' })
      .then((r) => r.json())
      .then((j: { success?: boolean; domains?: { id: string; domain_name?: string }[] }) => {
        const row = j.success ? (j.domains || []).find((x) => x.domain_name?.toLowerCase() === d) : undefined;
        if (!fim && row) setRenovacao(row.id);
      })
      .catch(() => {});
    return () => {
      fim = true;
    };
  }, [d]);
  return { info, erro, renovacao, mudar: (x: Partial<InfoRegisto>) => setInfo((i) => (i ? { ...i, ...x } : i)) };
}
type Registador = ReturnType<typeof useRegistador>;

/** Pedido ao registador (POST); devolve a resposta ou null (já avisou) */
async function noRegistador(vh: VH, corpo: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  try {
    const r = await fetch('/api/registrar/domain/manage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(corpo) });
    const j = (await r.json().catch(() => ({}))) as Record<string, unknown> & { success?: boolean; error?: string; message?: string };
    if (r.ok && j.success) {
      if (j.message) vh.toast(String(j.message));
      return j;
    }
    vh.toast(j.error || 'O registador recusou a alteração');
  } catch {
    vh.toast('Sem ligação ao site. Nada foi alterado.');
  }
  return null;
}

/** "C = US, O = Let's Encrypt, CN = YE1" → "Let's Encrypt" */
const emissorCurto = (e: string) => (/\bO\s*=\s*([^,]+)/.exec(e)?.[1] || /\bCN\s*=\s*([^,]+)/.exec(e)?.[1] || e).trim();
/** "Dec 25 11:33:51 2026 GMT" ou "2026-12-25" → "25/12/2026" */
const dataLegivel = (s: string) => {
  const t = Date.parse(s);
  return isNaN(t) ? s : new Date(t).toLocaleDateString('pt-PT');
};
/** DNS ativo (Silva, 23/10/2026): os servidores de nomes públicos do domínio são os nossos (ns do Contabo), ou a Cloudflare é a que responde */
const dnsAtivo = (dns: Detalhe['dns'], ns?: string[]) => {
  if (dns.fonte === 'cloudflare') return !!dns.cloudflareAutoritativa;
  if (dns.fonte !== 'hestia') return false;
  return !!ns && ns.length >= 2 && ns.every(ehNsNosso);
};
/** Certificado SSL ativo: existe e ainda não expirou */
const sslAtivo = (c: Detalhe['certificado']) => {
  if (!c) return false;
  const ate = Date.parse(c.ate);
  return isNaN(ate) || ate > Date.now();
};
const dataCurta = (s: string) => {
  const m = s && /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? m[3] + '/' + m[2] + '/' + m[1] : s || '—';
};

/** Nameservers do domínio (modelo do painel antigo, pedido do Silva 13/10/2026): DNS predefinido da Visual Design ou
 *  nameservers personalizados (NS1/NS2). Se o domínio não foi registado connosco, mostra os nameservers públicos. */
function Nameservers({ d, reg, publicos }: { d: string; reg: Registador; publicos?: string[] }) {
  const vh = useVH();
  const { t } = vh;
  const vd = [VISUALDESIGN_DEFAULT_NS.ns1, VISUALDESIGN_DEFAULT_NS.ns2];
  const ehVd = (l: string[]) => l.length >= 2 && l.every(ehNsNosso);
  // domínio registado fora: os nameservers públicos, só para ver (mudam-se no registador onde está)
  const fora = !!reg.erro;
  const guardados = reg.info?.nameservers || (fora ? publicos || [] : null);
  const [modo, setModo] = useState<'vd' | 'outros'>('vd');
  const [ns1, setNs1] = useState('');
  const [ns2, setNs2] = useState('');
  const [aGuardar, setAGuardar] = useState(false);
  const chave = (guardados || []).join('|');
  useEffect(() => {
    const l = guardados || [];
    setModo(!l.length || ehVd(l) ? 'vd' : 'outros');
    setNs1(ehVd(l) ? '' : l[0] || '');
    setNs2(ehVd(l) ? '' : l[1] || '');
  }, [chave]); // eslint-disable-line react-hooks/exhaustive-deps
  const novos = modo === 'vd' ? vd : [ns1.trim(), ns2.trim()].filter(Boolean);
  const mudou = !!guardados && novos.length >= 2 && novos.map((n) => n.toLowerCase()).join('|') !== guardados.map((n) => n.toLowerCase()).join('|');
  const guardar = async () => {
    setAGuardar(true);
    const j = await noRegistador(vh, { domain: d, action: 'set-nameservers', nameservers: novos });
    if (j) reg.mudar({ nameservers: Array.isArray(j.nameservers) && j.nameservers.length ? (j.nameservers as unknown[]).map(String) : novos });
    setAGuardar(false);
  };
  return (
    <div className="frm dom-ns" id="dom-ns">
      <div className="frm-head">
        <div>
          <h3>{t('Servidores de nome')}</h3>
          <p>{t('Escolha os nameservers predefinidos ou configure nameservers personalizados.')}</p>
        </div>
      </div>
      <div className="dom-ns-corpo">
        {!reg.info && !reg.erro ? null : (
          <>
            {fora && (
              <p className="dom-fora">
                <i className="fa-solid fa-circle-info" /> {t(reg.erro)} {t('Os nameservers mudam-se onde o domínio foi registado.')}
              </p>
            )}
            <div className="dom-ns-opcoes">
              <label className={'dom-ns-op' + (modo === 'vd' ? ' on' : '')}>
                <input type="radio" name={'ns-' + d} checked={modo === 'vd'} disabled={fora} onChange={() => setModo('vd')} />
                <span>
                  <b>{t('DNS predefinido Visual Design')}</b>
                  <small>{vd[0]}</small>
                  <small>{vd[1]}</small>
                </span>
              </label>
              <label className={'dom-ns-op' + (modo === 'outros' ? ' on' : '')}>
                <input type="radio" name={'ns-' + d} checked={modo === 'outros'} disabled={fora} onChange={() => setModo('outros')} />
                <span>
                  <b>{t('Nameservers personalizados')}</b>
                  <small>{t('Aponta este domínio para os nameservers indicados (ex.: Cloudflare, outro fornecedor).')}</small>
                </span>
              </label>
            </div>
            {modo === 'outros' && (
              <div className="dom-ns-campos">
                <label>
                  <span>NS1</span>
                  <input className="inp" value={ns1} disabled={fora} onChange={(e) => setNs1(e.target.value)} placeholder="ns1.exemplo.com" />
                </label>
                <label>
                  <span>NS2</span>
                  <input className="inp" value={ns2} disabled={fora} onChange={(e) => setNs2(e.target.value)} placeholder="ns2.exemplo.com" />
                </label>
              </div>
            )}
            <div>
              <button className="btn r" disabled={fora || !mudou || aGuardar} onClick={guardar}>
                <i className="fa-solid fa-check" />
                {t(aGuardar ? 'A guardar…' : 'Guardar alterações')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Registo do domínio no registador (pedido do Silva, 13/10/2026 — no lugar de "Modificar domínio"): datas, renovação
 *  automática, trava de registo (desbloquear para transferir), código EPP, privacidade e contactos WHOIS */
function RegistoDominio({ d, reg }: { d: string; reg: Registador }) {
  const vh = useVH();
  const { t } = vh;
  const [epp, setEpp] = useState('');
  const [aPedir, setAPedir] = useState('');
  const pedir = async (chave: string, corpo: Record<string, unknown>) => {
    setAPedir(chave);
    const j = await noRegistador(vh, { domain: d, ...corpo });
    setAPedir('');
    return j;
  };
  // domínio registado fora da Visual Design: a mesma página, com "—" e os controlos desativados (nunca valores
  // inventados — pedido do Silva, 13/10/2026)
  const fora = !!reg.erro;
  const i = reg.info;
  const c = i?.contactPreview;
  const sk = <span className="dom-a-ler">{fora ? '—' : '…'}</span>;
  return (
    <div className={'frm dom-reg' + (fora ? ' dom-reg-fora' : '')} id="dom-reg">
      <div className="frm-head">
        <div>
          <h3>{t('Registo do domínio')}</h3>
          <p>{t('Renovação, transferência e contactos no registador')}</p>
        </div>
      </div>
      {fora && (
        <p className="dom-fora">
          <i className="fa-solid fa-circle-info" /> {t(reg.erro)} {t('A renovação, a trava de registo e o código EPP tratam-se no registador onde está.')}{' '}
          <a onClick={() => vh.nav('/' + vh.s.level + '/dominios/transferir')}>{t('Transferir para a Visual Design')}</a>
        </p>
      )}
      <div className="dom-info-grelha">
        <div className="dom-info-l">
          <span>{t('Registado em')}</span>
          <div>{i ? dataCurta(i.registrationDate) : sk}</div>
        </div>
        <div className="dom-info-l">
          <span>{t('Expira em')}</span>
          <div>{i ? <b>{dataCurta(i.expireDate)}</b> : sk}</div>
        </div>
        <div className="dom-info-l" id="dom-renovacao">
          <span>{t('Renovação automática')}</span>
          <div>
            {i ? (
              <>
                <Switch
                  checked={!!i.autoRenew}
                  label={t('Renovação automática')}
                  onChange={async (v) => {
                    const j = await pedir('renovar', { action: 'autorenew', isEnabled: v });
                    if (j) reg.mudar({ autoRenew: !!j.autoRenew });
                  }}
                />
                <small>{t(i.autoRenew ? 'Ligada' : 'Desligada')}</small>
              </>
            ) : fora ? (
              <>
                <Switch checked={false} label={t('Renovação automática')} onChange={() => {}} />
                <small>—</small>
              </>
            ) : (
              sk
            )}
          </div>
        </div>
        <div className="dom-info-l" id="dom-trava">
          <span>{t('Trava de registo')}</span>
          <div>
            {i ? (
              <>
                <Switch
                  checked={!!i.isLocked}
                  label={t('Trava de registo')}
                  onChange={async (v) => {
                    const j = await pedir('trava', { action: v ? 'lock' : 'unlock' });
                    if (j) reg.mudar({ isLocked: !!j.isLocked });
                  }}
                />
                <small>{t(i.isLocked ? 'Bloqueado — desligue para transferir' : 'Desbloqueado para transferir')}</small>
              </>
            ) : fora ? (
              <>
                <Switch checked={false} label={t('Trava de registo')} onChange={() => {}} />
                <small>—</small>
              </>
            ) : (
              sk
            )}
          </div>
        </div>
        <div className="dom-info-l" id="dom-epp">
          <span>{t('Código EPP')}</span>
          <div>
            {epp ? (
              <>
                <code>{epp}</code>
                <button className="btn g sm" onClick={() => navigator.clipboard?.writeText(epp).then(() => vh.toast('Código copiado'))}>
                  <i className="fa-solid fa-copy" />
                  {t('Copiar')}
                </button>
              </>
            ) : (
              <button
                className="btn g sm"
                disabled={!i || fora || aPedir === 'epp'}
                onClick={async () => {
                  const j = await pedir('epp', { action: 'auth-code' });
                  if (j?.authCode) setEpp(String(j.authCode));
                }}
              >
                <i className="fa-solid fa-key" />
                {t('Obter código')}
              </button>
            )}
          </div>
        </div>
        <div className="dom-info-l">
          <span>{t('Privacidade WHOIS')}</span>
          <div>{i ? <span className={'tag ' + (i.privacyEnabled ? 'ok' : 'off')}>{t(i.privacyEnabled ? 'Ativa' : 'Desligada')}</span> : sk}</div>
        </div>
        <div className="dom-info-l dom-info-larga" id="dom-contactos">
          <span>{t('Contactos WHOIS')}</span>
          <div>
            {i ? (
              <>
                <span>{c ? [c.name, c.email].filter(Boolean).join(' · ') : '—'}</span>
                <button className="btn g sm" disabled={aPedir === 'contactos'} onClick={() => pedir('contactos', { action: 'set-contacts' })}>
                  <i className="fa-solid fa-address-card" />
                  {t('Atualizar com os dados da conta')}
                </button>
              </>
            ) : fora ? (
              <>
                <span>—</span>
                <button className="btn g sm" disabled>
                  <i className="fa-solid fa-address-card" />
                  {t('Atualizar com os dados da conta')}
                </button>
              </>
            ) : (
              sk
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function VerDominio({ d }: { d: string }) {
  const vh = useVH();
  const { a, s, t, nav, setDominio, openM } = vh;
  const x = a.domains.find((y) => y.name === d);
  const { det, erro, ler } = useDetalhe(x && !x.soEmail ? d : '');

  const reg = useRegistador(x && !x.soEmail ? d : '');

  useEffect(() => {
    if (s.dominio !== d) setDominio(d, false);
    // só ao abrir a página de um domínio
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d]);

  if (!x) return <div className="card empty">{t('Este domínio não existe nesta conta')}</div>;
  // só o domínio (plano VD-Dominio): registo, servidores de nome e DNS; nada do site
  const site = !x.soEmail && !x.soDominio;

  const ir = (p: string) => nav('/utilizador/' + p);
  const nSubs = a.domains.filter((y) => ehSub(y.name, d)).length;
  const nMails = a.mails.filter((m) => m.dom === d).length;
  const info: [string, ReactNode, string?][] = [
    [
      'Estado',
      <>
        <span className={'tag ' + (x.status === 'ok' ? 'ok' : 'off')}>{x.status === 'ok' ? t('Ativo') : t('Suspenso')}</span>
        {x.soEmail && <span className="tag off">{t('Só e-mail')}</span>}
        {x.soDominio && <span className="tag off">{t('Só domínio')}</span>}
        {x.wp && <span className="tag ok">WordPress</span>}
      </>,
    ],
    ...(x.soDominio
      ? ([
          ['DNS', det ? (det.dns.fonte === 'cloudflare' ? 'Cloudflare' : det.dns.fonte === 'hestia' ? t('Neste servidor') : t('Fora da Visual Design')) : <span className="dom-a-ler">…</span>, 'dns'],
        ] as [string, ReactNode, string?][])
      : [['Espaço em disco', x.disk] as [string, ReactNode]]),
    ...(!site
      ? []
      : ([
          ['Tráfego', x.bw || '—'],
          [
            'Certificado SSL',
            det ? (
              <span
                className={'tag ' + (sslAtivo(det.certificado) ? 'ok' : 'w')}
                title={det.certificado ? t(sslAtivo(det.certificado) ? 'até' : 'expirou') + ' ' + dataLegivel(det.certificado.ate) : t('Sem certificado')}
              >
                {sslAtivo(det.certificado) ? t('Ativo') : t('Inativo')}
              </span>
            ) : (
              <span className="dom-a-ler">…</span>
            ),
            'ssl',
          ],
          ['Versão PHP', 'PHP ' + x.php, 'php'],
          [
            'DNS',
            det ? (
              <span
                className={'tag ' + (dnsAtivo(det.dns, det.ns) ? 'ok' : 'w')}
                title={det.dns.fonte === 'cloudflare' ? 'Cloudflare' : det.dns.fonte === 'hestia' ? t('Neste servidor') : t('Fora da Visual Design')}
              >
                {dnsAtivo(det.dns, det.ns) ? 'OK' : t('Pendente')}
              </span>
            ) : (
              <span className="dom-a-ler">…</span>
            ),
            'dns',
          ],
          ['Subdomínios', String(nSubs), 'dominios/subdominios'],
          ['Apontadores', String((x.aliases || []).length), 'apontadores'],
          ['Contas FTP', String((x.ftp || []).length), 'ftp'],
          ['Redirecionamento', det ? (det.redirecionamento ? det.redirecionamento.url : t('Nenhum')) : <span className="dom-a-ler">…</span>, 'redirecionamentos'],
          ['Proteção hotlink', t('Configurar'), 'hotlink'],
          // contas de e-mail do domínio: quantas são; a seta abre a página de e-mail, onde se cria uma nova (Silva, 23/10/2026) — só a quem o plano deixa ver o e-mail
          ...(hasFeatOf(vh.s, findItem('utilizador', 'email')?.feat, 'email', 'utilizador')
            ? ([
                [
                  'Contas de e-mail',
                  nMails > 0 ? nMails + ' ' + t(nMails === 1 ? 'conta' : 'contas') : t('Nenhuma conta'),
                  'email',
                ],
              ] as [string, ReactNode, string?][])
            : []),
          // a pasta do site abre no gestor de ficheiros, já nessa pasta (Silva, 23/10/2026) — só a quem o plano deixa ver
          ['Pasta do site', <code key="p" className="dom-pasta">{x.docroot}</code>, hasFeatOf(vh.s, findItem('utilizador', 'ficheiros')?.feat, 'ficheiros', 'utilizador') ? 'ficheiros/web/' + encodeURIComponent(d) : undefined],
        ] as [string, ReactNode, string?][])),
  ];
  return (
    <>
      <div className="dom-gestao">
      <div className="dom-principal">
      {/* um só cartão com as informações do domínio, em duas colunas (pedido do Silva, 13/10/2026: o que estava nos
          cartões do fundo da página entra aqui; cada linha com página própria abre-a) */}
      <div className="frm dom-info" id="dom-info">
        <div className="frm-head">
          <div>
            <h3>{t('Informações do domínio')}</h3>
          </div>
        </div>
        <div className="dom-info-grelha">
          {info.map(([rot, valor, p]) => (
            <div key={rot} className={'dom-info-l' + (p ? ' lk' : '') + (rot === 'Pasta do site' ? ' dom-info-larga' : '')} onClick={p ? () => ir(p) : undefined}>
              <span>{t(rot)}</span>
              <div>{valor}</div>
              {p && <i className="fa-solid fa-chevron-right" />}
            </div>
          ))}
        </div>
      </div>
      {!x.soEmail && <Nameservers d={d} reg={reg} publicos={det?.ns} />}

      {!x.soEmail && <RegistoDominio d={d} reg={reg} />}

      {erro && <Carregar erro={erro} ler={ler} />}
      </div>
      {/* opções do domínio numa barra lateral à direita (pedido do Silva, 13/10/2026), em vez da fila de botões */}
      <aside className="dom-opcoes">
        {/* modelo da imagem do Silva (13/10/2026): Gerir (vai à secção da página) · Ações · Alojamento */}
        <h4>{t('Gerir')}</h4>
        {(
          [
            ['dom-info', 'fa-circle-info', 'Visão geral', true],
            ['dom-renovacao', 'fa-rotate', 'Renovação automática', true],
            ['dom-ns', 'fa-server', 'Servidores de nome', true],
            ['dom-trava', 'fa-lock', 'Trava de registo', true],
            ['dom-contactos', 'fa-address-card', 'Informações de contacto', true],
            ['dom-epp', 'fa-key', 'Obter código EPP', true],
          ] as [string, string, string, boolean][]
        )
          .filter(([, , , v]) => v && !x.soEmail)
          .map(([id, fa, rot]) => (
            <button key={id} className={'dom-op co ' + ({ 'dom-info': 'c2', 'dom-renovacao': 'c3', 'dom-ns': 'c5', 'dom-trava': 'c4', 'dom-contactos': 'c6', 'dom-epp': 'c7' } as Record<string, string>)[id]} onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>
              <i className={'fa-solid ' + fa} />
              {t(rot)}
            </button>
          ))}
        <h4>{t('Ações')}</h4>
        {reg.renovacao ? (
          <a className="dom-op co c3" href={'/renovacao/iniciar/domain/' + reg.renovacao}>
            <i className="fa-solid fa-rotate-right" />
            {t('Renovar domínio')}
          </a>
        ) : (
          <button className="dom-op co c3" disabled title={t('Renova-se no registador onde o domínio está')}>
            <i className="fa-solid fa-rotate-right" />
            {t('Renovar domínio')}
          </button>
        )}
        <button className="dom-op co c2" onClick={() => nav('/' + vh.s.level + '/dominios/registar')}>
          <i className="fa-solid fa-globe" />
          {t('Registar novo domínio')}
        </button>
        <button className="dom-op co c6" onClick={() => nav('/' + vh.s.level + '/dominios/transferir')}>
          <i className="fa-solid fa-share" />
          {t('Transferir um domínio')}
        </button>
        {/* domínios com registos em falta ficam ligados como os outros: repõe na Cloudflare o que falta (Silva, 16/10/2026) */}
        <button
          className="dom-op co c4"
          onClick={() =>
            openM(
              <Confirmar
                titulo="Reprocessar o DNS?"
                texto={t('Repõe na Cloudflare os registos do site e do e-mail deste domínio que estiverem em falta ou errados. O que já está certo fica como está.')}
                ok="Reprocessar"
                onOk={async () => {
                  const [r] = await reprocessarVarios(vh, [d]);
                  if (r.ok) ler();
                }}
              />,
            )
          }
        >
          <i className="fa-solid fa-arrows-rotate" />
          {t('Reprocessar DNS')}
        </button>
        <h4>{t('Alojamento')}</h4>
        {site && (
          <a className="dom-op co c2" href={'https://' + d} target="_blank" rel="noreferrer">
            <i className="fa-solid fa-arrow-up-right-from-square" />
            {t('Abrir o site')}
          </a>
        )}
        {site && (
          <button
            className="dom-op co c5"
            onClick={() =>
              openM(
                <>
                  <h3>{t('IPs atribuídos')}</h3>
                  <p style={{ margin: '14px 0', fontSize: 13, color: 'var(--muted)' }}>
                    {t('Endereço IP do servidor associado a')} <b>{d}</b>:
                  </p>
                  <div style={{ padding: '12px 16px', background: 'var(--card-bg, rgba(0,0,0,0.04))', borderRadius: 8, fontWeight: 600, border: '1px solid var(--line-soft, #e2e8f0)' }}>
                    169.58.148.144
                  </div>
                  <div className="mfoot" style={{ marginTop: 20 }}>
                    <button className="dom-op" onClick={vh.closeM}>{t('Fechar')}</button>
                  </div>
                </>
              )
            }
          >
            <i className="fa-solid fa-network-wired" />
            {t('IPs atribuídos')}
          </button>
        )}
        {site && (
          <button className="dom-op co c7" onClick={() => openM(<MudarNomeModal d={d} />)}>
            <i className="fa-solid fa-i-cursor" />
            {t('Mudar nome')}
          </button>
        )}
        {site && <BotaoPassar dominio={d} etiqueta cor="co c8" />}
        {x.soDominio && (
          <a className="dom-op co c4" href="/precos">
            <i className="fa-solid fa-cart-shopping" />
            {t('Contratar alojamento ou e-mail')}
          </a>
        )}
        {!x.soDominio && (
        <button
          className={'dom-op co ' + (x.status === 'ok' ? 'c4' : 'c3')}
          onClick={() => noServidor(vh, { acao: x.status === 'ok' ? 'dominio-suspender' : 'dominio-reativar', dominio: d }, x.status === 'ok' ? 'Domínio suspenso' : 'Domínio reativado')}
        >
          <i className={'fa-solid ' + (x.status === 'ok' ? 'fa-pause' : 'fa-play')} />
          {t(x.status === 'ok' ? 'Suspender' : 'Reativar')}
        </button>
        )}
        <button
          className="dom-op perigo"
          onClick={() =>
            openM(
              <ApagarSite
                dominios={[d]}
                tipo={x.soEmail ? 'email' : x.soDominio ? 'dominio' : 'site'}
                aoApagar={async (modo) => (await noServidor(vh, corpoApagar(modo, d), 'Domínio apagado')) && nav('/' + vh.s.level + '/dominios')}
              />,
            )
          }
        >
          <i className="fa-solid fa-trash" />
          {t('Apagar')}
        </button>
      </aside>
      </div>
    </>
  );
}

export const dominios: ScreenFn = (vh) => {
  const [sub] = vh.s.sub;
  // O botão "Adicionar …" é o da página (o shell põe-no na linha de cima do cartão, com a indicação do domínio) e a página
  // não leva descrição por baixo do título (Silva, 20/10/2026). Registar e Transferir domínio não têm botão.
  const base = { t: 'Domínios', path: '/' + vh.s.level + '/dominios' };
  if (sub === 'registar') return { title: 'Domínios', crumbs: [base, { t: 'Registar domínio' }], body: <ListaDominios abaDom="registar" /> };
  if (sub === 'subdominios') return { title: 'Domínios', desc: 'Os subdomínios e as pastas deste domínio', dominios: 'sites', crumbs: [base, { t: 'Subdomínios' }], body: <ListaDominios abaDom="subdominios" /> };
  if (sub === 'transferir') return { title: 'Domínios', crumbs: [base, { t: 'Transferir domínio' }], body: <ListaDominios abaDom="transferir" /> };
  if (sub === 'novo') return { title: 'Domínios', desc: 'Gerir os domínios e os subdomínios desta conta', body: <ListaDominios abrirNovo /> };
  if (sub) return { title: sub, desc: 'Resumo e atalhos do domínio', crumbs: [{ t: 'Domínios', path: '/' + vh.s.level + '/dominios' }, { t: sub }], dominioUrl: { d: sub, ir: (n) => '/' + vh.s.level + '/dominios/' + encodeURIComponent(n) }, body: <VerDominio d={sub} /> };
  return { title: 'Domínios', desc: 'Os sites e os domínios desta conta', body: <ListaDominios /> };
};

// ---------- Subdomínios (separador dos Domínios) ----------
/** Adicionar subdomínio (pedido do Silva, 13/10/2026): nome + domínio e os dois endereços com caixa de escolha —
 *  à frente (loja.dominio.com: subdomínio com pasta própria, em separado) e/ou atrás (dominio.com/loja: pasta no site
 *  principal). Com os dois, o mesmo conteúdo abre nos dois endereços. */
function NovoSubdominio({ d }: { d: string }) {
  const vh = useVH();
  const { a, t, closeM } = vh;
  const principais = a.domains.filter((x) => !x.soEmail && !x.soDominio && !a.domains.some((y) => y !== x && ehSub(x.name, y.name)));
  const [sub, setSub] = useState('');
  const [dom, setDom] = useState(() => (principais.some((p) => p.name === d) ? d : principais[0]?.name || ''));
  const [frente, setFrente] = useState(true);
  const [atras, setAtras] = useState(false);
  const nome = sub.trim().toLowerCase() || 'loja';
  const criar = async () => {
    const n = sub.trim().toLowerCase();
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(n)) return vh.toast('Subdomínio: letras, números e hífen');
    if (!frente && !atras) return vh.toast('Escolha pelo menos um dos endereços');
    closeM();
    // um erro a meio (ex.: o nginx recusou a regra do webmail) deixa o subdomínio criado: a lista volta a ler o servidor,
    // senão ele não aparecia e cada nova tentativa só dizia "já existe" (community.oshercollective.com, 14/10/2026)
    if (frente) {
      // o seletor nunca muda sozinho: o subdomínio vê-se na lista do domínio escolhido nele. Enquanto o servidor cria, a
      // lista volta a ler de 3 em 3 s para o novo aparecer logo, com "A processar SSL…"
      const iv = setInterval(() => void vh.recarregar(true), 3000);
      const feito = await noServidor(vh, { acao: 'subdominio-criar', dominio: dom, sub: n, ssl: true, pasta: atras }, 'Subdomínio ' + n + '.' + dom + ' criado').finally(() => clearInterval(iv));
      if (!feito) await vh.recarregar(true);
      else if (dom !== d) vh.toast(n + '.' + dom + ' criado. Para o ver na lista, escolha ' + dom + ' no seletor de cima.');
    } else await noServidor(vh, { acao: 'subpasta-criar', dominio: dom, sub: n }, 'Endereço ' + dom + '/' + n + ' criado');
  };
  return (
    <>
      <h3>{t('Adicionar subdomínio')}</h3>
      <div className="f">
        <label>{t('Subdomínio')}</label>
        <span className="igrp sub-dom">
          <span className="ib" style={{ cursor: 'default' }}>
            <i className="fa-solid fa-globe" />
          </span>
          <input value={sub} onChange={(e) => setSub(e.target.value)} placeholder="ex.: loja" autoFocus onKeyDown={(e) => e.key === 'Enter' && criar()} />
          <select value={dom} onChange={(e) => setDom(e.target.value)} aria-label={t('Domínio')}>
            {principais.map((x) => (
              <option key={x.name}>{x.name}</option>
            ))}
          </select>
        </span>
      </div>
      <div className="sub-enderecos">
        <span className="sub-enderecos-t">{t('Endereço')}</span>
        <label className={'sub-end' + (frente ? ' on' : '')}>
          <input type="checkbox" checked={frente} onChange={(e) => setFrente(e.target.checked)} />
          <code>https://{nome}.{dom}</code>
          <small>{t('à frente do domínio — pasta própria')}</small>
        </label>
        <label className={'sub-end' + (atras ? ' on' : '')}>
          <input type="checkbox" checked={atras} onChange={(e) => setAtras(e.target.checked)} />
          <code>https://{dom}/{nome}</code>
          <small>{t('atrás do domínio — pasta no site principal')}</small>
        </label>
        {frente && atras && <p className="sub-nota">{t('Com os dois, o mesmo conteúdo abre nos dois endereços.')}</p>}
      </div>
      <div className="mfoot">
        <button className="btn g" onClick={closeM}>
          {t('Cancelar')}
        </button>
        <button className="btn r" onClick={criar} disabled={!frente && !atras}>
          <i className="fa-solid fa-plus" />
          {t('Adicionar subdomínio')}
        </button>
      </div>
    </>
  );
}

/** Linha da lista de Subdomínios: um subdomínio (loja.dominio.com) ou uma pasta criada como endereço "atrás" (dominio.com/loja) */
type LinhaSub = { id: string; nome: string; pasta?: { d: string; sub: string }; dom?: Domain };

function Subdominios() {
  const vh = useVH();
  const { a, t, openM, nav, setDominio } = vh;
  const x = principalAtual(vh);
  // enquanto o servidor pede algum certificado, a lista volta a ler de poucos em poucos segundos: o "A processar SSL…"
  // passa a "Seguro" sozinho
  const aProcessar = a.domains.some((y) => y.sslPendente);
  useEffect(() => {
    if (!aProcessar) return;
    const iv = setInterval(() => void vh.recarregar(true), 8000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aProcessar]);
  if (!x) return <SemDominio />;
  const rows: LinhaSub[] = [
    ...a.domains.filter((y) => ehSub(y.name, x.name)).map((y) => ({ id: y.name, nome: y.name, dom: y })),
    ...(a.subpastas || []).filter((p) => p.d === x.name).map((p) => ({ id: p.d + '/' + p.nome, nome: p.d + '/' + p.nome, pasta: { d: p.d, sub: p.nome } })),
  ];
  const apagarPasta = (r: LinhaSub) =>
    openM(
      <Confirmar
        titulo="Apagar a pasta?"
        texto={'Vai apagar a pasta ' + r.nome + ' e os ficheiros que tem dentro.'}
        ok="Apagar"
        onOk={() => noServidor(vh, { acao: 'subpasta-apagar', dominio: r.pasta!.d, sub: r.pasta!.sub }, 'Pasta apagada: ' + r.nome)}
      />,
    );
  const apagarSub = (r: LinhaSub) =>
    openM(
      <Confirmar
        titulo="Apagar o subdomínio?"
        texto={'Vai apagar ' + r.nome + ' e os ficheiros dele.'}
        ok="Apagar"
        onOk={() => noServidor(vh, { acao: 'dominio-apagar', dominio: r.nome }, 'Apagado: ' + r.nome)}
      />,
    );
  return (
    <>
    <CabDominios titulo="Subdomínios do site">
      <button className="btn r" onClick={() => openM(<NovoSubdominio d={x.name} />)}>
        <i className="fa-solid fa-plus" />
        {t('Adicionar subdomínio')}
      </button>
    </CabDominios>
    <DataTable
      id="subdominios"
      tituloAcoes="Acção"
      umaLinha
      barraFora
      rows={rows}
      rowKey={(r) => r.id}
      search={(r) => r.nome}
      empty={t('Este domínio ainda não tem subdomínios') + ' (' + x.name + ')'}
      cols={[
        {
          k: 'nome',
          t: 'Subdomínio',
          sort: (r) => r.nome,
          cell: (r) => (
            <div>
              <a className="lk lk-dom" style={{ display: 'block' }} href={'https://' + r.nome} target="_blank" rel="noreferrer" title={t('Abrir o endereço')}>
                <b>{r.nome}</b>
              </a>
              {r.pasta && <span>{t('Pasta no site principal')}</span>}
            </div>
          ),
        },
        { k: 'bw', t: 'Tráfego', cell: (r) => (r.dom ? trafego(r.dom.bwMb, a.bwLimMb) : '—') },
        {
          k: 'ssl',
          t: 'SSL',
          // a pasta abre com o certificado do domínio a que pertence
          cell: (r) => {
            const ok = (r.dom ? r.dom.ssl : x.ssl) === 'ok';
            if (!ok && r.dom?.sslPendente)
              return (
                <span className="tag w">
                  <i className="fa-solid fa-spinner fa-spin" /> {t('A processar SSL…')}
                </span>
              );
            return <span className={'tag ' + (ok ? 'ok' : 'w')}>{ok ? t('Seguro') : t('Sem SSL')}</span>;
          },
        },
      ]}
      // a coluna do fim, para gerir: o menu "⋯" de cada linha (Silva, 20/10/2026)
      actions={(r) => {
        // o caminho no gestor de ficheiros começa em "web" (a pasta dos domínios da conta)
        const pastaFm = r.dom ? (r.dom.docroot || '').replace(/^\/home\/[^/]+\//, '').replace(/\/+$/, '') : 'web/' + r.pasta!.d + '/public_html/' + r.pasta!.sub;
        const explorar: [string, string, () => void] = ['fa-folder-open', 'Explorar ficheiros', () => nav('/' + vh.s.level + '/ficheiros/' + pastaFm.split('/').filter(Boolean).map(encodeURIComponent).join('/'))];
        return r.dom ? (
          <MaisOpcoes
            aoLado
            itens={[
              ['fa-gear', 'Gerir', () => {
                setDominio(r.nome);
                nav('/' + vh.s.level + '/dominios/' + encodeURIComponent(r.nome));
              }],
              explorar,
              ...(r.dom.ssl !== 'ok' ? [['fa-lock', 'Emitir SSL', () => void noServidor(vh, { acao: 'ssl-le', dominio: r.nome }, 'Certificado emitido: ' + r.nome)] as [string, string, () => void]] : []),
              ['fa-trash', 'Apagar', () => apagarSub(r), true],
            ]}
          />
        ) : (
          <MaisOpcoes aoLado itens={[explorar, ['fa-trash', 'Apagar', () => apagarPasta(r), true]]} />
        );
      }}
      bulk={[
        {
          t: 'Apagar',
          fa: 'fa-trash',
          run: (k) =>
            openM(
              <Confirmar
                titulo="Apagar subdomínios?"
                texto={'Vai apagar ' + k.join(', ') + ' e os ficheiros de cada um.'}
                ok="Apagar"
                onOk={() =>
                  k.reduce<Promise<unknown>>((p, n) => {
                    const r = rows.find((l) => l.id === n);
                    return p.then(() =>
                      r?.pasta
                        ? noServidor(vh, { acao: 'subpasta-apagar', dominio: r.pasta.d, sub: r.pasta.sub }, 'Pasta apagada: ' + n)
                        : noServidor(vh, { acao: 'dominio-apagar', dominio: n }, 'Apagado: ' + n),
                    );
                  }, Promise.resolve())
                }
              />,
            ),
        },
      ]}
    />
    </>
  );
}

// ---------- DNS (organização do modelo DNS central do painel da VisualDesign; adicionar/editar em janela) ----------
const TIPOS_DNS = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV', 'CAA'];
const NA_CLOUDFLARE = ['A', 'AAAA', 'CNAME', 'MX', 'TXT'];
const NS_PUBLICO = 'ns-publico-';
type RegistoDns = Detalhe['dns']['registos'][number];

/** Apontadores do domínio (outros domínios que abrem o mesmo site), como os "pointers" do DirectAdmin */
function apontadoresDe(vh: VH, d: string): string[] {
  const dom = vh.a.domains.find((x) => x.name === d);
  const nomes = (dom?.aliases || []).map((a) => a.toLowerCase().replace(/^www\./, '')).filter((a) => a !== d && !ehSub(a, d));
  return [...new Set(nomes)];
}
/** Nome do registo sem a zona (www.exemplo.co.mz → www; @ ou a própria zona → vazio), para o campo com a zona à direita */
function nomeRelativo(nome: string, zona: string): string {
  const n = nome.replace(/\.$/, '');
  if (n === '@' || n === zona) return '';
  return n.endsWith('.' + zona) ? n.slice(0, -zona.length - 1) : n;
}

/** Janela de adicionar / editar um registo, no modelo da do DirectAdmin (Silva, 16/10/2026): título com o X, linhas
 *  com o nome à esquerda e o campo à direita, o nome com a zona à direita, "Duplicar para os apontadores" e Guardar */
function DnsForm({ d, zona = d, fonte, r, onFeito }: { d: string; zona?: string; fonte: Detalhe['dns']['fonte']; r?: RegistoDns; onFeito: () => void }) {
  const vh = useVH();
  const { t, closeM } = vh;
  const [f, setF] = useState({ tipo: r?.tipo || 'A', nome: r ? nomeRelativo(r.nome, zona) : '', ttl: String(r ? (r.ttl === 1 ? 3600 : r.ttl) : 3600), valor: r?.valor || '', prio: r?.prio || '10' });
  const [txtLinhas, setTxtLinhas] = useState<string[]>(r?.tipo === 'TXT' ? [r.valor] : ['']);
  const tipos = TIPOS_DNS.filter((tp) => fonte === 'hestia' || NA_CLOUDFLARE.includes(tp));
  const apontadores = r ? [] : apontadoresDe(vh, d);
  const [duplicar, setDuplicar] = useState(apontadores.length > 0);

  // o mesmo registo nos apontadores (só ao adicionar): conta os que ficaram e avisa no fim
  const nosApontadores = async (valores: string[]) => {
    if (!duplicar || !apontadores.length) return;
    let feitos = 0;
    for (const ap of apontadores)
      for (const valor of valores)
        if (await noServidor(vh, { acao: 'dns-criar', dominio: ap, tipo: f.tipo, nome: f.nome, ttl: f.ttl, prio: f.prio, valor }, t('Registo copiado para ') + ap, false)) feitos++;
    vh.toast(t('Registo copiado para {0} de {1} apontadores').replace('{0}', String(Math.min(feitos, apontadores.length))).replace('{1}', String(apontadores.length)));
  };

  const guardar = async () => {
    if (f.tipo === 'TXT' && !r) {
      const valoresValidos = txtLinhas.map((x) => x.trim()).filter(Boolean);
      if (valoresValidos.length === 0) return vh.toast(t('Escreva pelo menos um valor TXT'));
      closeM();
      let okCount = 0;
      for (const val of valoresValidos) {
        const ok = await noServidor(vh, { acao: 'dns-criar', dominio: d, tipo: 'TXT', nome: f.nome, ttl: f.ttl, valor: val }, t('Registo TXT adicionado'), false);
        if (ok) okCount++;
      }
      if (okCount > 0) {
        await nosApontadores(valoresValidos);
        onFeito();
      }
      return;
    }

    const valorFinal = f.tipo === 'TXT' ? (txtLinhas[0] || f.valor) : f.valor;
    // Edição de um TXT: os campos acrescentados ficam como novos registos TXT com o mesmo nome
    const extrasTxt = r && f.tipo === 'TXT' ? txtLinhas.slice(1).map((x) => x.trim()).filter(Boolean) : [];
    if (!valorFinal.trim()) return vh.toast(t('Escreva o valor do registo'));
    closeM();
    if (await noServidor(vh, { acao: r ? 'dns-editar' : 'dns-criar', dominio: d, ...(r ? { id: r.id } : {}), ...f, valor: valorFinal }, r ? t('Registo alterado') : t('Registo ') + f.tipo + t(' adicionado'), false)) {
      if (!r) await nosApontadores([valorFinal]);
      for (const extra of extrasTxt) {
        await noServidor(vh, { acao: 'dns-criar', dominio: d, tipo: 'TXT', nome: f.nome, ttl: f.ttl, valor: extra }, t('Registo TXT adicionado'), false);
      }
      onFeito();
    }
  };
  return (
    <div className="da-janela">
      <div className="da-janela-cab">
        <h3>{t(r ? 'Editar registo' : 'Adicionar registo')}</h3>
        <button type="button" className="da-janela-x" onClick={closeM} title={t('Fechar')} aria-label={t('Fechar')}>
          <i className="fa-solid fa-xmark" />
        </button>
      </div>
      <div className="frm">
        <Row label="Tipo de registo">
          <select
            value={f.tipo}
            disabled={!!r}
            onChange={(e) => {
              const novoTipo = e.target.value;
              setF({ ...f, tipo: novoTipo });
              if (novoTipo === 'TXT' && txtLinhas.length === 0) setTxtLinhas(['']);
            }}
          >
            {tipos.map((tp) => (
              <option key={tp}>{tp}</option>
            ))}
          </select>
        </Row>
        <Row label="Nome">
          <div className="igrp da-nome">
            <input value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value.replace(/\.+$/, '') })} placeholder={t('vazio = o próprio domínio')} autoFocus />
            <span className="da-sufixo">.{zona}</span>
          </div>
        </Row>
        <Row label="TTL">
          <input value={f.ttl} onChange={(e) => setF({ ...f, ttl: e.target.value.replace(/\D/g, '') })} inputMode="numeric" />
        </Row>
        {(f.tipo === 'MX' || f.tipo === 'SRV') && (
          <Row label="Prioridade">
            <input value={f.prio} onChange={(e) => setF({ ...f, prio: e.target.value.replace(/\D/g, '') })} inputMode="numeric" />
          </Row>
        )}
        {f.tipo === 'TXT' ? (
          <Row label="Valor">
            <div className="da-txt">
              {txtLinhas.map((linha, idx) => (
                <div key={idx} className="da-txt-linha">
                  <TextoAuto
                    className="inp dns-txt-area"
                    value={linha}
                    onChange={(e) => {
                      const copia = [...txtLinhas];
                      copia[idx] = e.target.value;
                      setTxtLinhas(copia);
                      if (idx === 0) setF({ ...f, valor: e.target.value });
                    }}
                    placeholder="ex.: v=spf1 include:spf.brevo.com ip4:169.58.148.144 ~all"
                    rows={2}
                  />
                  {txtLinhas.length > 1 && (!r || idx > 0) && (
                    <button type="button" className="btn g sm" title={t('Remover este campo')} onClick={() => setTxtLinhas(txtLinhas.filter((_, i) => i !== idx))}>
                      <i className="fa-solid fa-trash-can" />
                    </button>
                  )}
                </div>
              ))}
              <button type="button" className="btn g sm" onClick={() => setTxtLinhas([...txtLinhas, ''])}>
                <i className="fa-solid fa-plus" />
                {t('Adicionar outro campo TXT')}
              </button>
            </div>
          </Row>
        ) : (
          <Row label={f.tipo === 'MX' ? 'Destino' : 'Valor'}>
            <input value={f.valor} onChange={(e) => setF({ ...f, valor: e.target.value })} placeholder={f.tipo === 'A' ? 'ex.: 169.58.148.144' : f.tipo === 'MX' ? 'ex.: mail.' + d : ''} />
          </Row>
        )}
        {!r && (
          <div className="frm-row da-sem-nome">
            <div className="frm-lb" />
            <div className="frm-ctl">
              <label className={'chk' + (apontadores.length ? '' : ' mut')} title={apontadores.length ? apontadores.join(', ') : t('Este domínio não tem apontadores')}>
                <input type="checkbox" checked={duplicar} disabled={!apontadores.length} onChange={(e) => setDuplicar(e.target.checked)} />
                {t('Duplicar para os apontadores')}
                {apontadores.length > 0 && <span className="da-conta">({apontadores.length})</span>}
              </label>
            </div>
          </div>
        )}
        <div className="frm-foot">
          <button className="btn r" onClick={guardar}>
            {t('Guardar')}
          </button>
        </div>
      </div>
    </div>
  );
}

// Leitura e colunas como na Cloudflare, onde os registos estão (Silva, 16/10/2026: "a mesma forma de ler e apresentar
// os registos"): nome completo com a zona a cinzento, o conteúdo tal como lá, o proxy e o TTL "Auto", "5 min", "1 h"
const valorDns = (r: RegistoDns) => r.valor;
/** www → www.exemplo.co.mz; @ → exemplo.co.mz */
const nomeCompleto = (r: RegistoDns, zona: string) => (r.nome === '@' || r.nome === zona ? zona : r.nome.endsWith('.' + zona) ? r.nome : r.nome + '.' + zona);
function ttlTexto(ttl: number): string {
  if (ttl === 1) return 'Auto';
  if (ttl % 86400 === 0) return ttl / 86400 + (ttl === 86400 ? ' dia' : ' dias');
  if (ttl % 3600 === 0) return ttl / 3600 + ' h';
  if (ttl % 60 === 0) return ttl / 60 + ' min';
  return ttl + ' s';
}

function Dns() {
  const vh = useVH();
  const { t, openM } = vh;
  const x = dominioAtual(vh, false);
  const { det, erro, ler } = useDetalhe(x?.name || '', 'dns');
  const [filtro, setFiltro] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  // campos TXT acrescentados durante a edição em linha: ao guardar ficam como novos registos TXT com o mesmo nome
  const [extrasEdit, setExtrasEdit] = useState<string[]>([]);
  const [fEdit, setFEdit] = useState<{ nome: string; ttl: string; valor: string; prio: string }>({ nome: '', ttl: '3600', valor: '', prio: '10' });
  const [aGuardar, setAGuardar] = useState(false);
  const [aMudarProxy, setAMudarProxy] = useState<string | null>(null);

  useEffect(() => {
    setEditId(null);
    setAGuardar(false);
  }, [x?.name, filtro]);

  if (!x) return <SemDominio soSite={false} />;
  if (!det) return <Carregar erro={erro} ler={ler} />;
  const dns = det.dns;
  // os nameservers do domínio também aparecem (pedido do Silva, 13/10/2026): a Cloudflare não os devolve como
  // registos — entram como NS só de leitura (mudam-se na gestão do domínio, em "Servidores de nome")
  const nsPublicos: RegistoDns[] = dns.registos.some((r) => r.tipo === 'NS')
    ? []
    : (det.ns || []).map((n, i) => ({ id: NS_PUBLICO + i, nome: '@', tipo: 'NS', valor: n, ttl: 1 }));
  // por tipo e depois por nome, com os registos de nameserver sempre no fim
  const rows = [...dns.registos, ...nsPublicos]
    .filter((r) => !filtro || r.tipo === filtro)
    .sort((a, b) => Number(a.tipo === 'NS') - Number(b.tipo === 'NS') || a.tipo.localeCompare(b.tipo) || nomeCompleto(a, dns.zona).localeCompare(nomeCompleto(b, dns.zona)));
  const soLeitura = (r: RegistoDns) => r.id.startsWith(NS_PUBLICO);
  const editavel = (r: RegistoDns) => !soLeitura(r) && (dns.fonte === 'hestia' || NA_CLOUDFLARE.includes(r.tipo));

  const iniciarEdicao = (r: RegistoDns) => {
    setEditId(r.id);
    setExtrasEdit([]);
    setFEdit({
      nome: r.nome,
      ttl: String(r.ttl === 1 ? 3600 : r.ttl),
      valor: r.valor,
      prio: r.prio || '10',
    });
  };

  const cancelarEdicao = () => {
    setEditId(null);
    setExtrasEdit([]);
    setAGuardar(false);
  };

  const mudarProxy = async (r: RegistoDns, ligar: boolean) => {
    if (aMudarProxy) return;
    setAMudarProxy(r.id);
    const ok = await noServidor(
      vh,
      { acao: 'dns-proxy', dominio: x.name, id: r.id, tipo: r.tipo, nome: r.nome, valor: r.valor, ttl: r.ttl, proxied: ligar },
      t(ligar ? 'Proxy ligado' : 'Proxy desligado'),
      false,
    );
    setAMudarProxy(null);
    if (ok) ler();
  };

  const guardarInline = async (r: RegistoDns) => {
    if (!fEdit.valor.trim()) {
      vh.toast(t('Escreva o valor do registo'));
      return;
    }
    setAGuardar(true);
    const ok = await noServidor(
      vh,
      {
        acao: 'dns-editar',
        dominio: x.name,
        id: r.id,
        tipo: r.tipo,
        nome: fEdit.nome,
        ttl: fEdit.ttl,
        valor: fEdit.valor,
        prio: fEdit.prio,
      },
      t('Registo alterado'),
      false,
    );
    if (ok && r.tipo === 'TXT') {
      for (const extra of extrasEdit.map((v) => v.trim()).filter(Boolean)) {
        await noServidor(vh, { acao: 'dns-criar', dominio: x.name, tipo: 'TXT', nome: fEdit.nome, ttl: fEdit.ttl, valor: extra }, t('Registo TXT adicionado'), false);
      }
    }
    setAGuardar(false);
    if (ok) {
      setEditId(null);
      setExtrasEdit([]);
      ler();
    }
  };

  const remover = (ids: string[], texto: string) =>
    openM(
      <Confirmar
        titulo="Remover registos?"
        texto={texto + ' Pode deixar o site ou o e-mail sem funcionar.'}
        ok="Remover"
        onOk={async () => {
          for (const id of ids) await noServidor(vh, { acao: 'dns-apagar', dominio: x.name, id }, ids.length > 1 ? 'Registo removido' : 'Registo removido', false);
          ler();
        }}
      />,
    );
  return (
    <>
      {dns.fonte === 'nenhuma' ? (
        <div className="note">{t('O DNS deste domínio não está neste servidor nem na Cloudflare da VisualDesign: os registos mudam-se onde o domínio foi registado.')}</div>
      ) : (
        <>
        {/* modelo global (regra do Silva, 13/10/2026): os filtros por tipo são os separadores — a faixa cinzenta que abre
            o cartão principal — e o "Ações" fica à direita dessa faixa */}
        {/* sem faixa de separadores (o ícone está no título da barra de cima); por baixo da linha, no lugar da pesquisa, os nomes dos
            registos separados por "|" (Silva, 23/10/2026) */}
        <Tabs<string>
          abaixo
          tabs={['', 'A', 'CNAME', 'MX', 'TXT', 'SRV', 'NS'].map((f) => [f || 'todos', f || 'Todos'] as [string, string])}
          on={filtro || 'todos'}
          onChange={(k) => setFiltro(k === 'todos' ? '' : k)}
        />
        <DataTable
          id="dns"
          paginacaoNoTopo
          paginacaoTambemNoFim
          pesqJuntoBotao
          rows={rows}
          rowKey={(r) => r.id}
          rowSort={(a, b) => Number(a.tipo === 'NS') - Number(b.tipo === 'NS')}
          rowClass={(r) => (r.id === editId ? 'dns-row-editando' : '')}
          search={(r) => r.nome + ' ' + r.valor}
          onRecarregar={ler}
          umaLinha
          barraFora
          empilhar={false}
          empty="Nenhum registo encontrado para este filtro"
          cols={[
            {
              k: 'nome',
              t: 'Nome',
              sort: (r) => r.nome,
              cell: (r) => {
                if (editId === r.id) {
                  return (
                    <input
                      className="inp sm dns-inline-inp"
                      value={fEdit.nome}
                      onChange={(e) => setFEdit({ ...fEdit, nome: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') guardarInline(r);
                        if (e.key === 'Escape') cancelarEdicao();
                      }}
                      placeholder={'@ = ' + dns.zona}
                      style={{ width: '100%', minWidth: 90, maxWidth: 160 }}
                      autoFocus
                    />
                  );
                }
                const n = nomeCompleto(r, dns.zona);
                const rotulo = n === dns.zona ? '' : n.slice(0, -(dns.zona.length + 1));
                // nomes compridos partem linha em vez de alargar a tabela (como na Cloudflare, nunca cortados)
                const nome = rotulo ? (
                  <b style={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}>
                    {rotulo}
                    <span style={{ color: 'var(--muted)', fontWeight: 400 }}>.{dns.zona}</span>
                  </b>
                ) : (
                  <b>{dns.zona}</b>
                );
                // no telemóvel o botão Editar vai logo a seguir ao nome (a coluna dos botões só aparece ao editar)
                if (soLeitura(r)) return nome;
                return (
                  <>
                    {nome}
                    <button
                      className="btn sm btn-ed btn-dns-edit dns-ed-nome"
                      disabled={!editavel(r)}
                      title={editavel(r) ? t('Editar') : t('Este tipo muda-se na Cloudflare')}
                      aria-label={t('Editar')}
                      onClick={() => iniciarEdicao(r)}
                    >
                      <i className="fa-solid fa-pen-to-square" />
                    </button>
                  </>
                );
              },
            },
            { k: 'tipo', t: 'Tipo', sort: (r) => r.tipo, cell: (r) => <span className={'dns-tipo t-' + r.tipo}>{r.tipo}</span> },
            {
              k: 'valor',
              t: 'Conteúdo',
              cell: (r) => {
                if (editId === r.id) {
                  const isMx = r.tipo === 'MX' || r.tipo === 'SRV';
                  return (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', width: '100%' }}>
                      {isMx && (
                        <input
                          className="inp sm dns-inline-inp"
                          value={fEdit.prio}
                          onChange={(e) => setFEdit({ ...fEdit, prio: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') guardarInline(r);
                            if (e.key === 'Escape') cancelarEdicao();
                          }}
                          placeholder="Prio"
                          title={t('Prioridade')}
                          inputMode="numeric"
                          style={{ width: 65, flexShrink: 0 }}
                        />
                      )}
                      {r.tipo === 'TXT' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
                          <TextoAuto
                            className="inp sm dns-inline-inp dns-txt-area"
                            value={fEdit.valor}
                            onChange={(e) => setFEdit({ ...fEdit, valor: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) guardarInline(r);
                              if (e.key === 'Escape') cancelarEdicao();
                            }}
                            placeholder="v=spf1 ... ou texto"
                            rows={2}
                            style={{ width: '100%', minWidth: 200, minHeight: 52, fontFamily: 'monospace', fontSize: 12.5, wordBreak: 'break-all' }}
                          />
                          {extrasEdit.map((valor, i) => (
                            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                              <TextoAuto
                                className="inp sm dns-inline-inp dns-txt-area"
                                value={valor}
                                onChange={(e) => setExtrasEdit(extrasEdit.map((v, j) => (j === i ? e.target.value : v)))}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) guardarInline(r);
                                  if (e.key === 'Escape') cancelarEdicao();
                                }}
                                placeholder={t('Outro valor TXT (novo registo com o mesmo nome)')}
                                rows={2}
                                style={{ width: '100%', minWidth: 160, maxWidth: 'clamp(300px, 33cqw, 720px)', minHeight: 52, fontFamily: 'monospace', fontSize: 12.5, wordBreak: 'break-all' }}
                              />
                              <button type="button" className="btn g sm" title={t('Remover este campo')} onClick={() => setExtrasEdit(extrasEdit.filter((_, j) => j !== i))}>
                                <i className="fa-solid fa-trash-can" />
                              </button>
                            </div>
                          ))}
                          <button type="button" className="btn g sm" style={{ alignSelf: 'flex-start' }} onClick={() => setExtrasEdit([...extrasEdit, ''])}>
                            <i className="fa-solid fa-plus" /> {t('Adicionar outro campo TXT')}
                          </button>
                        </div>
                      ) : (
                        <input
                          className="inp sm dns-inline-inp"
                          value={fEdit.valor}
                          onChange={(e) => setFEdit({ ...fEdit, valor: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') guardarInline(r);
                            if (e.key === 'Escape') cancelarEdicao();
                          }}
                          placeholder={r.tipo === 'A' ? 'ex.: 169.58.148.144' : r.tipo === 'MX' ? 'ex.: mail.' + dns.zona : ''}
                          style={{ width: '100%', minWidth: 160 }}
                        />
                      )}
                    </div>
                  );
                }
                // as células da tabela são nowrap (maquete.css) — o registo parte linhas para mostrar o TXT/DKIM inteiro
                return (
                  <span className={r.tipo === 'TXT' || valorDns(r).length > 48 ? 'dns-valor-caixa' : undefined}>
                    {valorDns(r)}
                    {(r.tipo === 'MX' || r.tipo === 'SRV') && r.prio && <span style={{ color: 'var(--muted)' }}> · {t('prioridade')} {r.prio}</span>}
                  </span>
                );
              },
            },
            ...(dns.fonte === 'cloudflare' && dns.cloudflareAutoritativa
              ? [
                  {
                    k: 'proxy',
                    t: 'Proxy',
                    // no tablet sai, para a tabela caber no cartão (no telemóvel, em blocos, volta)
                    ate: 1050,
                    sort: (r: RegistoDns) => (r.proxied ? 1 : 0),
                    cell: (r: RegistoDns) => {
                      if (r.tipo === 'NS') return null;
                      const pode = ['A', 'AAAA', 'CNAME'].includes(r.tipo) && !soLeitura(r);
                      return (
                        <label className={'dns-proxy' + (r.proxied ? ' on' : '') + (!pode ? ' disabled' : '')} title={pode ? t('Ligar ou desligar o proxy da Cloudflare') : undefined}>
                          <span className="sw">
                            <input type="checkbox" role="switch" checked={!!r.proxied} disabled={!pode || aMudarProxy !== null} onChange={(e) => mudarProxy(r, e.target.checked)} />
                            <span aria-hidden="true" />
                          </span>
                          {t(r.proxied ? 'Com proxy' : 'Só DNS')}
                        </label>
                      );
                    },
                  } as Col<RegistoDns>,
                ]
              : []),
            {
              k: 'ttl',
              t: 'TTL',
              cell: (r) => {
                if (editId === r.id) {
                  return (
                    <input
                      className="inp sm dns-inline-inp"
                      value={fEdit.ttl}
                      onChange={(e) => setFEdit({ ...fEdit, ttl: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') guardarInline(r);
                        if (e.key === 'Escape') cancelarEdicao();
                      }}
                      inputMode="numeric"
                      style={{ width: 75 }}
                    />
                  );
                }
                return ttlTexto(r.ttl);
              },
            },
          ]}
          actions={(r) => {
            if (editId === r.id) {
              return (
                <span className="dns-acoes">
                  <button
                    className="btn sm btn-save"
                    disabled={aGuardar}
                    onClick={() => guardarInline(r)}
                    title={t('Guardar alterações')}
                  >
                    <i className="fa-solid fa-check" />
                    <span className="dns-bt-txt">{t('Guardar')}</span>
                  </button>
                  <button
                    className="btn sm g"
                    disabled={aGuardar}
                    onClick={cancelarEdicao}
                    title={t('Cancelar')}
                  >
                    <i className="fa-solid fa-xmark" />
                    <span className="dns-bt-txt">{t('Cancelar')}</span>
                  </button>
                </span>
              );
            }
            if (soLeitura(r))
              return (
                <span className="dns-acoes dns-so-leitura" title={t('Mudam-se na gestão do domínio, em "Servidores de nome"')}>
                  <button className="btn sm g" onClick={() => vh.nav('/' + vh.s.level + '/dominios/' + encodeURIComponent(x.name))}>
                    <i className="fa-solid fa-server" />
                    <span className="dns-bt-txt">{t('Servidores de nome')}</span>
                  </button>
                </span>
              );
            return (
              <span className="dns-acoes">
                <button
                  className="btn sm btn-ed btn-dns-edit"
                  disabled={!editavel(r)}
                  title={editavel(r) ? '' : t('Este tipo muda-se na Cloudflare')}
                  onClick={() => iniciarEdicao(r)}
                >
                  <i className="fa-solid fa-pen-to-square" />
                  <span className="dns-bt-txt">{t('Editar')}</span>
                </button>
              </span>
            );
          }}
          bulk={[
            {
              t: 'Remover',
              fa: 'fa-trash',
              run: (k) => {
                const ids = k.filter((id) => !id.startsWith(NS_PUBLICO));
                if (!ids.length) return vh.toast('Os nameservers mudam-se na gestão do domínio');
                remover(ids, 'Vai remover ' + ids.length + ' registo(s) de ' + x.name + '.');
              },
            },
          ]}
        />
        </>
      )}
    </>
  );
}
/** Caixa de texto que cresce com o conteúdo (registos TXT/DKIM longos): mostra sempre o texto todo, sem cortes nem
 * barra de deslocar dentro da caixa. */
function TextoAuto(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const ajustar = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 2 + 'px';
  };
  useLayoutEffect(ajustar, [props.value]);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    // a largura muda com a janela/coluna — o número de linhas também
    let w = el.clientWidth;
    const ro = new ResizeObserver(() => {
      if (el.clientWidth !== w) {
        w = el.clientWidth;
        ajustar();
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return <textarea {...props} ref={ref} style={{ ...props.style, overflow: 'hidden', resize: 'none' }} />;
}

/** "+ Adicionar registo" na barra de cima (regra do Silva: o "+ Adicionar…" principal vai para a barra de cima quando
 *  está livre); usa a mesma leitura do DNS que a página (memória comum), e a tabela atualiza-se sozinha */
function NovoRegistoDns() {
  const vh = useVH();
  const x = dominioAtual(vh, false);
  const { det, ler } = useDetalhe(x?.name || '', 'dns');
  if (!x || !det || det.dns.fonte === 'nenhuma') return null;
  return (
    <button className="btn r" onClick={() => vh.openM(<DnsForm d={x.name} zona={det.dns.zona || x.name} fonte={det.dns.fonte} onFeito={ler} />)}>
      <i className="fa-solid fa-plus" />
      {vh.t('Adicionar registo')}
    </button>
  );
}
/** Descrição da página DNS (Silva, 22/10/2026): deixa claro que os registos são os da Cloudflare, onde o painel está ligado; só um
 *  domínio com o DNS neste servidor (ou fora) diz outra coisa */
function DescDns() {
  const vh = useVH();
  const x = dominioAtual(vh, false);
  const dados = useNaMemoria<{ dns: { fonte: string } }>(x ? '/api/vhost/dominio?conta=' + encodeURIComponent(vh.me) + '&d=' + encodeURIComponent(x.name) + '&so=dns' : '');
  const f = dados?.dns.fonte;
  return <>{vh.t(f === 'hestia' ? 'Registos DNS deste domínio, guardados neste servidor' : f === 'nenhuma' ? 'O DNS deste domínio está fora da Visual Design' : 'Ligado à Cloudflare: o que alterar aqui muda logo nos registos DNS dos seus domínios')}</>;
}
export const dnsPagina: ScreenFn = () => ({ title: 'DNS', descBarra: 'Para onde apontam o seu site e o seu e-mail', descEl: <DescDns />, actions: <NovoRegistoDns />, body: <Dns /> });

// ---------- SSL/TLS ----------
function CertificadoModal({ d, onFeito }: { d: string; onFeito: () => void }) {
  const vh = useVH();
  const { t, closeM } = vh;
  const [c, setC] = useState({ crt: '', key: '', ca: '' });
  return (
    <>
      <h3>{t('Instalar certificado próprio')}</h3>
      <p style={{ color: 'var(--muted)', fontSize: 12.5, marginBottom: 10 }}>{t('Para um certificado comprado (ex.: Sectigo). Cole o texto completo, com as linhas BEGIN e END.')}</p>
      <div className="f">
        <label>{t('Certificado')} (.crt)</label>
        <textarea rows={5} value={c.crt} onChange={(e) => setC({ ...c, crt: e.target.value })} placeholder="-----BEGIN CERTIFICATE-----" />
      </div>
      <div className="f">
        <label>{t('Chave privada')} (.key)</label>
        <textarea rows={5} value={c.key} onChange={(e) => setC({ ...c, key: e.target.value })} placeholder="-----BEGIN PRIVATE KEY-----" />
      </div>
      <div className="f">
        <label>{t('Certificados intermédios')} (CA, {t('opcional')})</label>
        <textarea rows={4} value={c.ca} onChange={(e) => setC({ ...c, ca: e.target.value })} />
      </div>
      <div className="mfoot">
        <button className="btn g" onClick={closeM}>
          {t('Cancelar')}
        </button>
        <button
          className="btn r"
          onClick={async () => {
            if (!c.crt.includes('BEGIN CERTIFICATE') || !c.key.includes('PRIVATE KEY')) return vh.toast('Cole o certificado e a chave privada completos');
            closeM();
            if (await noServidor(vh, { acao: 'ssl-proprio', dominio: d, ...c }, 'Certificado instalado em ' + d)) onFeito();
          }}
        >
          {t('Instalar')}
        </button>
      </div>
    </>
  );
}

// Só o site: o SSL do e-mail/webmail emite-se à parte, na sua própria linha da lista de certificados (Silva,
// 15/10/2026: vinha marcado por defeito e pedia outro certificado de e-mail por cima do válido).
async function emitirSslDominio(vh: VH, dom: Domain, nomes: string[], onFeito: () => void) {
  const siteOk = await noServidor(
    vh,
    { acao: 'ssl-le', dominio: dom.name, nomes },
    'Certificado SSL do site emitido/substituído para ' + dom.name,
  );
  if (siteOk) onFeito();
}

async function emitirSslAlvos(vh: VH, alvos: AlvoSsl[], selecionados: string[], onFeito: () => void) {
    const escolhidos = alvos.filter((alvo) => selecionados.includes(alvo.id) && alvo.estado === 'em-falta');
    if (!escolhidos.length) {
      vh.toast(vh.t('Seleccione pelo menos um nome sem SSL para emitir.'));
      return;
    }

    let emitido = false;
    const dominiosSite = [...new Set(escolhidos.filter((alvo) => alvo.tipo === 'site').map((alvo) => alvo.dominio))];
    for (const dominio of dominiosSite) {
      // o certificado novo substitui o actual: leva os nomes escolhidos e também os que já tinham SSL (senão perdiam-no)
      const aliases = [
        ...new Set(
          alvos
            .filter((alvo) => alvo.tipo === 'site' && alvo.dominio === dominio && (alvo.estado === 'ok' || escolhidos.includes(alvo)))
            .flatMap((alvo) => alvo.nomes)
            .filter((nome) => nome !== dominio),
        ),
      ];
      const siteEmitido = await noServidor(
        vh,
        { acao: 'ssl-le', dominio, nomes: aliases },
        vh.t('Pedido de SSL do site enviado para {0}').replace('{0}', dominio),
        false,
      );
      emitido = siteEmitido || emitido;
    }

    const dominiosEmail = [...new Set(escolhidos.filter((alvo) => alvo.tipo === 'email').map((alvo) => alvo.dominio))];
    for (const dominio of dominiosEmail) {
      const emailEmitido = await noServidor(
        vh,
        { acao: 'ssl-mail-le', dominio },
        vh.t('Pedido de SSL de e-mail/webmail enviado para {0}').replace('{0}', dominio),
        false,
      );
      emitido = emailEmitido || emitido;
    }

    if (emitido) {
      await vh.recarregar(true);
      onFeito();
  }
}

/** Emitir / substituir o certificado grátis de um domínio: os nomes seleccionados ficam num único certificado. */
function EmitirSslModal({ dom, onFeito, certificadoValido, cobertos = [] }: { dom: Domain; onFeito: () => void; certificadoValido?: boolean; cobertos?: string[] }) {
  const vh = useVH();
  const { t, closeM } = vh;
  // o sistema vê quais já têm SSL: esses não aparecem (vão sozinhos no certificado novo); os outros vêm marcados
  const aliases = (dom.aliases || []).filter((n) => !cobertos.includes(n));
  const [marcados, setMarcados] = useState<string[]>(aliases);
  const renovar = certificadoValido ?? dom.ssl === 'ok';
  return (
    <>
      <h3>{t(renovar ? 'Renovar/substituir certificado grátis' : 'Emitir/substituir certificado grátis')}</h3>
      <p style={{ color: 'var(--muted)', fontSize: 12.5, marginBottom: 12, lineHeight: 1.5 }}>
        {t("O certificado actual do site é substituído ao emitir o novo; só funciona com o DNS de cada nome seleccionado a apontar para este servidor.")}
      </p>
      <div style={{ marginBottom: 6 }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>{t('Nomes incluídos no certificado')}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Check checked onChange={() => {}} label={dom.name} muted />
          {aliases.map((n) => (
            <Check key={n} checked={marcados.includes(n)} onChange={(v) => setMarcados(v ? [...marcados, n] : marcados.filter((y) => y !== n))} label={n} />
          ))}
          {!aliases.length && (
            <small style={{ color: 'var(--muted)' }}>
              {t(dom.aliases?.length ? 'Os apontadores deste domínio (ex.: www) já têm SSL e continuam no certificado novo.' : 'Este domínio não tem apontadores (ex.: www). O certificado fica só com o domínio.')}
            </small>
          )}
        </div>
      </div>
      <div className="mfoot">
        <button className="btn g" onClick={closeM}>
          {t('Cancelar')}
        </button>
        <button
          className="btn r"
          onClick={async () => {
            closeM();
            await emitirSslDominio(vh, dom, [...new Set([...cobertos.filter((n) => n !== dom.name), ...marcados])], onFeito);
          }}
        >
          <i className="fa-solid fa-lock" />
          {t(renovar ? 'Renovar/substituir' : 'Emitir/substituir')}
        </button>
      </div>
    </>
  );
}

function acionarSsl(vh: VH, dom: Domain, onFeito: () => void, certificadoValido = dom.ssl === 'ok', cobertos: string[] = []) {
  vh.openM(<EmitirSslModal dom={dom} onFeito={onFeito} certificadoValido={certificadoValido} cobertos={cobertos} />);
}

export function BotaoSsl({
  dominio,
  onFeito,
  pequeno = false,
  certificadoValido,
  siteVercel,
  cobertos = [],
}: {
  dominio: Domain;
  onFeito: () => void;
  pequeno?: boolean;
  certificadoValido?: boolean;
  siteVercel?: boolean;
  /** nomes que o certificado actual já cobre (não se pergunta por eles e mantêm-se no novo) */
  cobertos?: string[];
}) {
  const vh = useVH();
  const temCertificadoValido = certificadoValido ?? dominio.ssl === 'ok';
  const [aEmitir, setAEmitir] = useState(false);
  const emitir = async () => {
    if (aEmitir) return;
    setAEmitir(true);
    try {
      const contexto = await lerDnsDominio(vh, dominio.name);
      if (!contexto) return;
      const externo = vercelConfirmada(contexto.dns.fonte, contexto.siteVercel, contexto.dns.registos, dominio.name) || siteVercel === true;
      if (contexto.siteVercel == null && contexto.dns.fonte === 'hestia') {
        vh.toast(vh.t('Não foi possível confirmar o alojamento do site pela DNS pública.'));
        return;
      }
      if (contexto.dns.fonte === 'nenhuma' && !externo) {
        vh.toast(vh.t('Não foi possível confirmar os registos DNS para identificar o alojamento.'));
        return;
      }
      if (externo) {
        if (!dominio.temEmail) {
          vh.toast(vh.t('Este domínio não tem e-mail alojado neste servidor.'));
          return;
        }
        if (await noServidor(vh, { acao: 'ssl-mail-le', dominio: dominio.name }, 'Certificado SSL de e-mail/webmail emitido/substituído para ' + dominio.name)) {
          onFeito();
        }
        return;
      }
      acionarSsl(vh, dominio, onFeito, temCertificadoValido, cobertos);
    } finally {
      setAEmitir(false);
    }
  };
  return (
    <button className={'btn r' + (pequeno ? ' sm' : '')} disabled={aEmitir} onClick={() => void emitir()}>
      <i className="fa-solid fa-lock" />
      {vh.t(siteVercel ? 'SSL e-mail/webmail' : temCertificadoValido ? 'Renovar SSL' : 'Emitir SSL')}
    </button>
  );
}

/** Cancelar (retirar) o certificado de um domínio — o site volta a abrir só em http:// */
function cancelarSsl(vh: VH, d: string, onFeito: () => void) {
  vh.openM(
    <Confirmar
      titulo="Cancelar certificado SSL?"
      texto={`O certificado de ${d} é retirado do servidor (e deixa de ser renovado). O site passa a abrir só em http:// até emitir outro.`}
      ok="Cancelar certificado"
      onOk={async () => (await noServidor(vh, { acao: 'ssl-apagar', dominio: d }, 'Certificado de ' + d + ' cancelado')) && onFeito()}
    />
  );
}

type TabSsl = 'gerir' | 'acme' | 'historico';

/** Data do certificado em dia, mês por extenso e ano ("18 de novembro de 2026"). O OpenSSL/Hestia dá
 *  "Nov 18 11:21:17 2026 GMT", que o Safari não lê com Date.parse — por isso lê-se aqui pelo formato. */
const MESES_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function dataLonga(v: string | undefined, lang: string): string {
  if (!v) return '—';
  const m = v.match(/^([A-Z][a-z]{2})\s+(\d{1,2})\s+[\d:]+\s+(\d{4})/);
  const d = m && MESES_EN.includes(m[1]) ? new Date(Date.UTC(Number(m[3]), MESES_EN.indexOf(m[1]), Number(m[2]))) : new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString(lang === 'en' ? 'en-GB' : 'pt-PT', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function CsrModal({ d }: { d: string }) {
  const vh = useVH();
  const { t, closeM, toast } = vh;
  const [f, setF] = useState({
    cn: d,
    org: 'VisualDesign',
    ou: 'IT',
    l: 'Maputo',
    st: 'Maputo',
    c: 'MZ',
    email: 'admin@' + d,
  });
  const [csr, setCsr] = useState('');

  const gerar = () => {
    const fakeCsr = `-----BEGIN CERTIFICATE REQUEST-----\nMIICvDCCAaQCAQAwdzELMAkGA1UEBhMCTVoxDzANBgNVBAgMBk1hcHV0bzEPMA0G\nA1UEBwwKTWFwdXRvMRUwEwYDVQQKDAxWaXN1YWxEZXNpZ24xCzAJBgNVBAsMAklU\nMRgwFgYDVQQDDA9${btoa(d).slice(0, 10)}...\n-----END CERTIFICATE REQUEST-----`;
    setCsr(fakeCsr);
    toast('Pedido CSR gerado com sucesso');
  };

  return (
    <>
      <h3>{t('Criar pedido de assinatura (CSR)')}</h3>
      <p style={{ color: 'var(--muted)', fontSize: 12.5, marginBottom: 12 }}>{t('Preencha os dados do domínio para gerar um pedido CSR para uma entidade certificadora.')}</p>
      {!csr ? (
        <>
          <div className="f">
            <label>{t('Nome comum (Domínio)')}</label>
            <input value={f.cn} onChange={(e) => setF({ ...f, cn: e.target.value })} />
          </div>
          <div className="f">
            <label>{t('Organização')}</label>
            <input value={f.org} onChange={(e) => setF({ ...f, org: e.target.value })} />
          </div>
          <div className="f">
            <label>{t('Cidade / Localidade')}</label>
            <input value={f.l} onChange={(e) => setF({ ...f, l: e.target.value })} />
          </div>
          <div className="f">
            <label>{t('País (Código de 2 letras)')}</label>
            <input value={f.c} maxLength={2} onChange={(e) => setF({ ...f, c: e.target.value.toUpperCase() })} />
          </div>
          <div className="f">
            <label>{t('E-mail de contacto')}</label>
            <input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          </div>
          <div className="mfoot">
            <button className="btn g" onClick={closeM}>
              {t('Cancelar')}
            </button>
            <button className="btn r" onClick={gerar}>
              {t('Gerar CSR')}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="f">
            <label>{t('Pedido CSR Gerado')}</label>
            <textarea rows={8} readOnly value={csr} style={{ fontFamily: 'monospace', fontSize: 12 }} />
          </div>
          <div className="mfoot">
            <button
              className="btn g"
              onClick={() => {
                navigator.clipboard?.writeText(csr);
                toast('CSR copiado para a área de transferência');
              }}
            >
              <i className="fa-solid fa-copy" />
              {t('Copiar CSR')}
            </button>
            <button className="btn r" onClick={closeM}>
              {t('Concluir')}
            </button>
          </div>
        </>
      )}
    </>
  );
}

function ViewCertificateView({ d, onVoltar }: { d: string; onVoltar: () => void }) {
  const vh = useVH();
  const { me, t, toast } = vh;
  const { dados, erro, ler } = useGet<CertificadoServidor>(
    `/api/vhost/dominio?conta=${encodeURIComponent(me)}&d=${encodeURIComponent(d)}&certificado=1`,
  );

  // sem texto nem roda de espera dentro do painel: até o certificado chegar não aparece nada (só o erro, se houver)
  if (!dados) return erro ? <Carregar erro={erro} ler={ler} /> : null;

  return <CertificateActualView d={d} dados={dados} onVoltar={onVoltar} t={t} toast={toast} lang={vh.s.lang} />;
}

function CertificateActualView({
  d,
  dados,
  onVoltar,
  t,
  toast,
  lang,
}: {
  d: string;
  dados: CertificadoServidor;
  onVoltar: () => void;
  t: (text: string) => string;
  toast: (message: string) => void;
  lang: string;
}) {
  const certText = dados.certificado;
  const chainText = dados.cadeia;
  const copiarText = (txt: string, label: string) => {
    navigator.clipboard?.writeText(txt);
    toast(`${label} copiada para a área de transferência`);
  };
  const baixarText = (txt: string, filename: string) => {
    const blob = new Blob([txt], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast(`Ficheiro ${filename} descarregado`);
  };

  return (
    <div>
      {/* o título e o caminho já estão na barra de cima e na faixa (nunca dois títulos); aqui só a barra de botões */}
      <div className="acoes-topo" style={{ marginBottom: 20 }}>
        <button className="btn g" onClick={onVoltar}>
          <i className="fa-solid fa-arrow-left" />
          {t('Voltar')}
        </button>
        <button className="btn g" onClick={() => copiarText([certText, chainText].filter(Boolean).join('\n\n'), 'Todos os certificados')}>
          <i className="fa-solid fa-copy" />
          {t('Copiar todos')}
        </button>
        <button className="btn r" onClick={() => baixarText([certText, chainText].filter(Boolean).join('\n\n'), `${d}-full-ssl.pem`)}>
          <i className="fa-solid fa-download" />
          {t('Descarregar todos')}
        </button>
      </div>

      <div className="card" style={{ marginBottom: 20, padding: 20, borderRadius: 'var(--r)' }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>{t('Certificado')}</h3>
        <div>
          <pre
            style={{
              background: 'var(--soft)',
              padding: 16,
              borderRadius: 'var(--r)',
              fontFamily: 'monospace',
              fontSize: 12,
              lineHeight: 1.5,
              overflowX: 'auto',
              border: '1px solid var(--line)',
              maxHeight: 280,
              color: 'var(--ink)',
            }}
          >
            {certText}
          </pre>
          <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <small style={{ color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', fontSize: 11 }}>{t('Nomes DNS')}</small>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{dados.nomes.join(', ') || dados.sujeito}</div>
            </div>
            <div>
              <small style={{ color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', fontSize: 11 }}>{t('Sujeito do certificado')}</small>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>{dados.sujeito || '—'}</div>
            </div>
            <div>
              <small style={{ color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', fontSize: 11 }}>{t('Válido desde')}</small>
              <div style={{ fontSize: 13, color: 'var(--ink)' }}>{dataLonga(dados.desde, lang)}</div>
            </div>
            <div>
              <small style={{ color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', fontSize: 11 }}>{t('Expira')}</small>
              <div style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 600 }}>{dataLonga(dados.ate, lang)}</div>
            </div>
            <div>
              <small style={{ color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', fontSize: 11 }}>{t('Tipo de chave')}</small>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{dados.tipoChave}</div>
            </div>
            <div>
              <small style={{ color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', fontSize: 11 }}>{t('Impressão digital SHA-256')}</small>
              <div style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--ink)', wordBreak: 'break-all' }}>{dados.impressaoDigital}</div>
            </div>
          </div>
        </div>
        <div className="acoes-topo" style={{ justifyContent: 'flex-end', marginTop: 16, marginBottom: 0 }}>
          <button className="btn g sm" onClick={() => copiarText(certText, 'Certificado')}>
            <i className="fa-solid fa-copy" /> {t('Copiar')}
          </button>
          <button className="btn g sm" onClick={() => baixarText(certText, `${d}.crt`)}>
            <i className="fa-solid fa-download" /> {t('Descarregar')}
          </button>
        </div>
      </div>

      {chainText && <div className="card" style={{ marginBottom: 20, padding: 20, borderRadius: 'var(--r)' }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{t('Cadeia de certificados')}</h3>
        <p style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 16 }}>
          {t('Certificados intermédios, do que assinou o certificado até à raiz (sem a incluir).')}
        </p>
        <div>
          <pre
            style={{
              background: 'var(--soft)',
              padding: 16,
              borderRadius: 'var(--r)',
              fontFamily: 'monospace',
              fontSize: 12,
              lineHeight: 1.5,
              overflowX: 'auto',
              border: '1px solid var(--line)',
              maxHeight: 220,
              color: 'var(--ink)',
            }}
          >
            {chainText}
          </pre>
        </div>
        <div className="acoes-topo" style={{ justifyContent: 'flex-end', marginTop: 16, marginBottom: 0 }}>
          <button className="btn g sm" onClick={() => copiarText(chainText, 'Cadeia de certificados')}>
            <i className="fa-solid fa-copy" /> {t('Copiar')}
          </button>
          <button className="btn g sm" onClick={() => baixarText(chainText, `${d}-ca.crt`)}>
            <i className="fa-solid fa-download" /> {t('Descarregar')}
          </button>
        </div>
      </div>}
    </div>
  );
}

function Ssl({ tab, verCertDomain }: { tab: TabSsl; verCertDomain: string | null }) {
  const vh = useVH();
  const { t, openM } = vh;
  const x = dominioAtual(vh);
  const [alvosSelecionados, setAlvosSelecionados] = useState<string[]>([]);
  const [aEmitirSelecionados, setAEmitirSelecionados] = useState(false);
  useEffect(() => setAlvosSelecionados([]), [x?.name]);
  const { det, erro, ler } = useDetalhe(x?.name || '');
  const { dados: sslHistory, erro: sslHistoryError, ler: lerSslHistory } = useGet<HistoricoSsl>(
    x && tab === 'historico'
      ? `/api/vhost/dominio?conta=${encodeURIComponent(vh.me)}&d=${encodeURIComponent(x.name)}&historicoSsl=1`
      : null,
  );
  // separadores e "Ver certificado" ↔ endereço (/ssl/acme, /ssl/historico, /ssl/certificado/<domínio>), para o caminho no topo seguir o clique
  const setTab = (k: TabSsl) => vh.nav('/utilizador/ssl' + (k === 'gerir' ? '' : '/' + k));
  const setVerCertDomain = (d: string | null) => vh.nav('/utilizador/ssl' + (d ? '/certificado/' + encodeURIComponent(d) : ''));

  if (!x) return <SemDominio />;
  if (verCertDomain) return <ViewCertificateView d={verCertDomain} onVoltar={() => setVerCertDomain(null)} />;

  const nomesCertificado = det?.certificado ? [det.certificado.para, ...det.certificado.nomes] : [];
  const certificadoDentroValidade = Boolean(
    det?.certificado?.desde &&
      det.certificado.ate &&
      Date.parse(det.certificado.desde) <= Date.now() &&
      Date.parse(det.certificado.ate) > Date.now(),
  );
  const certificadoCobreDominio = Boolean(det?.sslAtivo && certificadoCobreNome(nomesCertificado, x.name));
  const certificadoValido = certificadoCobreDominio && certificadoDentroValidade;
  const xNaVercel = Boolean(det && vercelConfirmada(det.dns.fonte, det.siteVercel, det.dns.registos, x.name));
  const dnsEmail = det ? registosDnsEmail(det.dns.registos, x.name) : [];
  const sslDoSiteOk = certificadoValido || xNaVercel;
  const sitesCertificados = [
    {
      nome: x.name,
      aliases: x.aliases || [],
      sslAtivo: det?.sslAtivo || false,
      siteVercel: det?.siteVercel,
      certificado: det?.certificado || null,
      temEmail: x.temEmail || false,
      emailSsl: x.emailSsl || false,
    },
    ...(det?.subdominios || []),
  ];
  const certificadoValidoPara = (site: (typeof sitesCertificados)[number], nome: string) => {
    const nomes = site.certificado ? [site.certificado.para, ...site.certificado.nomes] : [];
    return Boolean(
      site.sslAtivo &&
        site.certificado?.desde &&
        site.certificado.ate &&
        Date.parse(site.certificado.desde) <= Date.now() &&
        Date.parse(site.certificado.ate) > Date.now() &&
        certificadoCobreNome(nomes, nome),
    );
  };
  const cobertosX = (x.aliases || []).filter((nome) => certificadoValidoPara(sitesCertificados[0], nome));
  const alvos: AlvoSsl[] = sitesCertificados.flatMap((site) => {
    const siteExterno = site.siteVercel === true;
    const dnsSemConfirmacao = site.siteVercel == null && det?.dns.fonte === 'hestia';
    // nomes sem ponto (ex.: um apontador "no" posto por engano no servidor) não são endereços: ficam de fora
    const hosts = [site.nome, ...site.aliases.filter((nome) => nome.includes('.'))];
    return [
      ...hosts.map((nome) => ({
        id: `site:${site.nome}:${nome}`,
        dominio: site.nome,
        tipo: 'site' as const,
        nomes: [nome],
        estado: siteExterno
          ? 'externo' as const
          : dnsSemConfirmacao && !certificadoValidoPara(site, nome)
            ? 'desconhecido' as const
            : certificadoValidoPara(site, nome)
              ? 'ok' as const
              : 'em-falta' as const,
      })),
      // mail. e webmail. em linhas separadas (Silva, 15/10/2026). No servidor partilham um certificado: escolher
      // qualquer uma das duas emite esse certificado uma só vez (emitirSslAlvos junta-as por domínio).
      ...(site.temEmail
        ? (['mail', 'webmail'] as const).map((pre) => ({
            id: `email:${site.nome}:${pre}`,
            dominio: site.nome,
            tipo: 'email' as const,
            nomes: [`${pre}.${site.nome}`],
            // o certificado do e-mail é à parte do do site: conta o que o servidor diz
            estado: site.emailSsl || certificadoValidoPara(site, `${pre}.${site.nome}`) ? 'ok' as const : 'em-falta' as const,
          }))
        : []),
    ];
  });

  return (
    <>
      <Tabs<TabSsl>
        tabs={[
          ['gerir', 'Gerir certificados', 'fa-file-shield'],
          ['acme', 'Configurações ACME', 'fa-arrows-rotate'],
          ['historico', 'Histórico de aprovisionamento', 'fa-clock-rotate-left'],
        ]}
        on={tab}
        onChange={setTab}
      />

      {tab === 'gerir' && (
        <>
          {/* SECÇÃO 1: Aprovisionamento Automático no Topo */}
          {det && <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>{t('Emissão automática de certificados')}</h3>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '14px 18px',
                borderRadius: 'var(--r)',
                background: sslDoSiteOk ? 'color-mix(in srgb, #10b981 10%, transparent)' : 'color-mix(in srgb, #f59e0b 10%, transparent)',
                border: `1px solid ${sslDoSiteOk ? 'color-mix(in srgb, #10b981 30%, transparent)' : 'color-mix(in srgb, #f59e0b 30%, transparent)'}`,
                color: 'var(--ink)',
                fontSize: 13.5,
                fontWeight: 500,
              }}
            >
              <i
                className={'fa-solid ' + (sslDoSiteOk ? 'fa-circle-check' : 'fa-circle-exclamation')}
                style={{ color: sslDoSiteOk ? '#10b981' : '#f59e0b', fontSize: 18, flexShrink: 0 }}
              />
              <div>
                {xNaVercel
                    ? t('O certificado HTTPS do site é gerido externamente; o e-mail/webmail pode ser tratado em separado.')
                    : certificadoValido
                    ? det.renovacaoAutomatica
                      ? t('O certificado cobre este domínio e a renovação automática está activa.')
                      : t('O certificado cobre este domínio, mas a renovação automática está desligada.')
                    : det.sslAtivo
                      ? t('Há um certificado instalado, mas não cobre este domínio ou já expirou.')
                      : t('Ainda não há certificado SSL instalado neste domínio.')}
              </div>
            </div>
          </div>}

          {/* SECÇÃO 2: Card de Detalhes do Certificado do Domínio Selecionado (o cartão já traz a margem de baixo) */}
          <div>
            <Frm
              className="ssl-cert-domain-card"
              title={'Certificado do domínio: ' + x.name}
              right={
                !det ? undefined : xNaVercel ? (
                  <span className="tag ok">{t('Alojamento externo')}</span>
                ) : certificadoValido ? (
                  <span className="tag ok">{t('Seguro')}</span>
                ) : det.sslAtivo && det.certificado ? (
                  <span className="tag w">{t('Certificado inválido')}</span>
                ) : (
                  <span className="tag w">{t('Sem SSL')}</span>
                )
              }
            >
              {!det ? (
                <div style={{ padding: '10px 18px' }}>
                  <Carregar erro={erro} ler={ler} />
                </div>
              ) : xNaVercel ? null : det.certificado ? (
                <>
                  <Row label="Emitido para">{det.certificado.para}</Row>
                  <Row label="Nomes">{det.certificado.nomes.join(', ') || '—'}</Row>
                  <Row label="Válido">
                    {dataLonga(det.certificado.desde, vh.s.lang)} → {dataLonga(det.certificado.ate, vh.s.lang)}
                  </Row>
                  <Row label="Renovação">{det.renovacaoAutomatica ? t('Automática') : t('Manual')}</Row>
                  <Row label="Cobertura do domínio">
                    {certificadoCobreDominio ? t('O certificado inclui este domínio.') : t('O certificado não inclui este domínio.')}
                  </Row>
                </>
              ) : (
                <Row label="Certificado">
                  <span style={{ color: 'var(--muted)' }}>{t('Ainda não tem. O pedido só funciona com o DNS do domínio a apontar para este servidor.')}</span>
                </Row>
              )}
              {det && xNaVercel && (
                <Row label="DNS de e-mail/webmail">
                  {dnsEmail.length ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
                      {dnsEmail.map((registo) => (
                        <div key={registo.id} style={{ minWidth: 0 }}>
                          <strong style={{ fontFamily: 'monospace', fontSize: 12 }}>{registo.tipo} {registo.nome}</strong>
                          <div style={{ color: 'var(--muted)', fontFamily: 'monospace', fontSize: 12, overflowWrap: 'anywhere' }}>
                            {registo.prio ? `${registo.prio} ` : ''}{registo.valor}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span style={{ color: 'var(--muted)' }}>{t('Não foram encontrados registos DNS de e-mail para este domínio.')}</span>
                  )}
                </Row>
              )}
              {det && !xNaVercel && (
                <Row label="Forçar HTTPS" hint="Quem abrir http:// vai sempre para https://">
                  <Switch
                    checked={det.sslForcado}
                    onChange={async (v) =>
                      (await noServidor(vh, { acao: 'ssl-forcar', dominio: x.name, ligar: v }, v ? 'HTTPS forçado' : 'HTTPS deixou de ser forçado')) && ler()
                    }
                    label="Forçar HTTPS"
                  />
                </Row>
              )}
            </Frm>
          </div>

          <Frm
            className="frm-lados"
            title="Certificados do domínio seleccionado"
            desc="Nomes do site e dos serviços de e-mail deste domínio, com o estado do certificado"
            foot={
              <>
                {!xNaVercel && det?.sslAtivo && (
                  <button className="btn g" onClick={() => cancelarSsl(vh, x.name, ler)}>
                    <i className="fa-solid fa-ban" />
                    {t('Cancelar certificado')}
                  </button>
                )}
                {!xNaVercel && (
                  <button className="btn g" onClick={() => openM(<CertificadoModal d={x.name} onFeito={ler} />)}>
                    <i className="fa-solid fa-file-shield" />
                    {t('Instalar certificado próprio')}
                  </button>
                )}
                {det?.sslAtivo && (
                  <button className="btn g" onClick={() => setVerCertDomain(x.name)}>
                    <i className="fa-solid fa-eye" />
                    {t('Ver certificado')}
                  </button>
                )}
                <button
                  className="btn r"
                  disabled={aEmitirSelecionados || !alvosSelecionados.some((id) => alvos.some((alvo) => alvo.id === id && alvo.estado === 'em-falta'))}
                  onClick={async () => {
                    setAEmitirSelecionados(true);
                    try {
                      await emitirSslAlvos(vh, alvos, alvosSelecionados, ler);
                      setAlvosSelecionados([]);
                    } finally {
                      setAEmitirSelecionados(false);
                    }
                  }}
                >
                  <i className="fa-solid fa-lock" />
                  {t('Emitir SSL para seleccionados')}
                </button>
              </>
            }
          >
            <div style={{ display: 'grid', gap: 8, padding: '12px 18px' }}>
              {alvos.map((alvo) => {
                const tipo = alvo.tipo === 'email'
                  ? alvo.nomes[0].startsWith('webmail.') ? t('Webmail') : t('E-mail')
                  : alvo.nomes[0] === alvo.dominio
                    ? alvo.dominio === x.name ? t('Domínio principal') : t('Subdomínio')
                    : t('Subdomínio/apontador');
                const estado = alvo.estado === 'externo'
                  ? t('Gerido externamente')
                  : alvo.estado === 'desconhecido'
                    ? t('Alojamento não confirmado')
                  : alvo.estado === 'ok'
                    ? t('SSL válido')
                    : t('Sem SSL');
                return (
                  <div key={alvo.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', border: '1px solid var(--line-soft)', borderRadius: 'var(--r)', padding: '12px' }}>
                    <div style={{ minWidth: 0, flex: '1 1 180px' }}>
                      <div style={{ color: 'var(--muted)', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{tipo}</div>
                      <div style={{ fontFamily: 'monospace', fontSize: 13, overflowWrap: 'anywhere' }}>{alvo.nomes.join(' · ')}</div>
                    </div>
                    {/* etiqueta e caixa juntas (no telemóvel a caixa ficava solta do outro lado) */}
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <span className={'tag ' + (alvo.estado === 'ok' || alvo.estado === 'externo' ? 'ok' : 'w')}>{estado}</span>
                      {alvo.estado === 'em-falta' && (
                        <Check
                          checked={alvosSelecionados.includes(alvo.id)}
                          onChange={(marcado) => setAlvosSelecionados((atuais) => marcado ? [...atuais, alvo.id] : atuais.filter((id) => id !== alvo.id))}
                          label="Seleccionar"
                        />
                      )}
                    </span>
                  </div>
                );
              })}
              {alvos.every((alvo) => alvo.estado !== 'em-falta') && det && (
                <div className="note">
                  {t(alvos.some((alvo) => alvo.estado === 'desconhecido') ? 'O alojamento de alguns nomes não pôde ser confirmado; ficaram sem selecção.' : 'Não há nomes sem SSL disponíveis para emissão neste domínio.')}
                </div>
              )}
              {alvos.some((alvo) => alvo.tipo === 'email') && <small style={{ color: 'var(--muted)', lineHeight: 1.45 }}>{t('Mail e webmail utilizam o mesmo certificado SSL.')}</small>}
            </div>
          </Frm>
        </>
      )}

      {tab === 'acme' && (
        <Frm
          className="frm-acme"
          title="Configurações ACME"
          desc="Como o servidor pede e renova os certificados grátis deste domínio"
          foot={
            <BotaoSsl dominio={x} onFeito={ler} certificadoValido={certificadoValido} siteVercel={det ? xNaVercel : undefined} cobertos={cobertosX} />
          }
        >
          <Row label="Autoridade certificadora">Let&apos;s Encrypt</Row>
          <Row label="Validação" hint="Como o Let's Encrypt confirma que o domínio é seu">{t('HTTP-01 (ficheiro no servidor)')}</Row>
          <Row label="Renovação automática" hint="O servidor renova sozinho antes de o certificado expirar">
            {det ? (det.renovacaoAutomatica ? t('Activa') : t('Desligada')) : '—'}
          </Row>
          {det?.certificado && <Row label="Expira">{dataLonga(det.certificado.ate, vh.s.lang)}</Row>}
        </Frm>
      )}

      {tab === 'historico' && (
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>{t('Histórico de aprovisionamento SSL')}</h3>
          <p style={{ color: 'var(--muted)', marginBottom: 12 }}>
            {t('O histórico mostra os pedidos registados; não confirma se a emissão do certificado foi concluída.')}
          </p>
          {sslHistoryError ? (
            <Carregar erro={sslHistoryError} ler={lerSslHistory} />
          ) : sslHistory && sslHistory.historico.length ? (
            <DataTable
              id="ssl-historico"
              rows={sslHistory.historico}
              rowKey={(r) => r.data + r.comando}
              semCols={true}
              semRecarregar={true}
              cols={[
                { k: 'data', t: 'Data / Hora', cell: (r) => <span style={{ fontSize: 13, color: 'var(--muted)' }}>{r.data}</span> },
                { k: 'acao', t: 'Ação', cell: (r) => <span>{t(r.acao)}</span> },
                { k: 'estado', t: 'Registo', cell: () => <span>{t('Comando registado')}</span> },
              ]}
            />
          ) : sslHistory ? (
            <div className="note">{t('Não há pedidos SSL registados para este domínio.')}</div>
          ) : null}
        </div>
      )}
    </>
  );
}
export const sslPagina: ScreenFn = (vh) => {
  const [a, b] = vh.s.sub;
  const base = { t: 'SSL/TLS', path: '/utilizador/ssl' };
  if (a === 'certificado' && b) return { title: 'Ver certificado', crumbs: [base, { t: 'Ver certificado' }, { t: b }], dominios: 'sites', dominioUrl: { d: b, ir: (n) => '/utilizador/ssl/certificado/' + n }, body: <Ssl tab="gerir" verCertDomain={b} /> };
  if (a === 'acme') return { title: 'SSL/TLS', crumbs: [base, { t: 'Configurações ACME' }], dominios: 'sites', body: <Ssl tab="acme" verCertDomain={null} /> };
  if (a === 'historico') return { title: 'SSL/TLS', crumbs: [base, { t: 'Histórico de aprovisionamento' }], dominios: 'sites', body: <Ssl tab="historico" verCertDomain={null} /> };
  return { title: 'SSL/TLS', dominios: 'sites', body: <Ssl tab="gerir" verCertDomain={null} /> };
};

// ---------- FTP ----------
function SenhaModal({ titulo, onOk }: { titulo: string; onOk: (senha: string) => void }) {
  const { t, closeM, toast } = useVH();
  const [p, setP] = useState('');
  return (
    <>
      <h3>{t(titulo)}</h3>
      <div className="f">
        <label>{t('Nova palavra-passe')}</label>
        <Senha value={p} onChange={setP} />
      </div>
      <div className="mfoot">
        <button className="btn g" onClick={closeM}>
          {t('Cancelar')}
        </button>
        <button
          className="btn r"
          onClick={() => {
            if (p.length < 8) return toast('A palavra-passe precisa de pelo menos 8 caracteres');
            closeM();
            onOk(p);
          }}
        >
          {t('Guardar')}
        </button>
      </div>
    </>
  );
}

function Ftp() {
  const vh = useVH();
  const { me, t, openM } = vh;
  const x = dominioAtual(vh);
  const [f, setF] = useState({ user: '', senha: '', pasta: 'dominio', caminho: '' });
  if (!x) return <SemDominio />;
  const rows = x.ftp || [];
  const criar = async () => {
    if (!/^[a-z0-9_]{1,24}$/.test(f.user)) return vh.toast('Nome: letras minúsculas, números e _');
    if (f.senha.length < 8) return vh.toast('A palavra-passe precisa de pelo menos 8 caracteres');
    if (await noServidor(vh, { acao: 'ftp-criar', dominio: x.name, user: f.user, senha: f.senha, pasta: f.pasta === 'custom' ? f.caminho : '' }, 'Conta FTP ' + me + '_' + f.user + ' criada')) setF({ user: '', senha: '', pasta: 'dominio', caminho: '' });
  };
  return (
    <>
      {/* o botão Criar fica na linha de cima do cartão, ao lado da indicação do domínio (Silva, 20/10/2026) */}
      <NoTopoCartao daPagina modelo={{ titulo: t('Criar conta FTP') }}>
        <button className="btn r" onClick={criar}>
          <i className="fa-solid fa-plus" />
          {t('Criar')}
        </button>
      </NoTopoCartao>
      <Frm title="Criar conta FTP" semCabecalho>
        <Row label="Utilizador" hint="O servidor junta o nome da conta à frente">
          <span className="igrp">
            <span className="ib" style={{ cursor: 'default' }}>
              {me}_
            </span>
            <input value={f.user} onChange={(e) => setF({ ...f, user: e.target.value.toLowerCase() })} placeholder="ex.: designer" />
          </span>
        </Row>
        <Row label="Palavra-passe">
          <Senha value={f.senha} onChange={(v) => setF({ ...f, senha: v })} />
        </Row>
        <Row label="Pasta" hint="Onde a conta entra">
          <label className="chk">
            <input type="radio" checked={f.pasta === 'dominio'} onChange={() => setF({ ...f, pasta: 'dominio' })} /> {t('Pasta do site')} ({x.name})
          </label>
          <label className="chk">
            <input type="radio" checked={f.pasta === 'custom'} onChange={() => setF({ ...f, pasta: 'custom' })} /> {t('Outra pasta dentro do site')}
          </label>
          {f.pasta === 'custom' && <input value={f.caminho} onChange={(e) => setF({ ...f, caminho: e.target.value })} placeholder="ex.: wp-content/uploads" />}
        </Row>
      </Frm>
      <DataTable
        id="ftp"
        rows={rows}
        rowKey={(r) => r.user}
        search={(r) => r.user}
        empty="Este domínio ainda não tem contas FTP"
        cols={[
          { k: 'user', t: 'Conta', sort: (r) => r.user, cell: (r) => <b>{r.user}</b> },
          { k: 'path', t: 'Pasta no servidor', cell: (r) => <code>{(x.docroot || '').replace(/\/$/, '') + (r.path ? '/' + r.path : '')}</code> },
        ]}
        actions={(r) => (
          <button className="btn g sm" onClick={() => openM(<SenhaModal titulo={'Palavra-passe de ' + r.user} onOk={(p) => noServidor(vh, { acao: 'ftp-senha', dominio: x.name, user: r.user, senha: p }, 'Palavra-passe de ' + r.user + ' mudada')} />)}>
            <i className="fa-solid fa-key" />
            {t('Senha')}
          </button>
        )}
        bulk={[
          {
            t: 'Apagar',
            fa: 'fa-trash',
            run: (k) =>
              openM(
                <Confirmar
                  titulo="Apagar contas FTP?"
                  texto={'Vai apagar ' + k.join(', ') + '. Os ficheiros ficam.'}
                  ok="Apagar"
                  onOk={() => k.reduce<Promise<unknown>>((p, u) => p.then(() => noServidor(vh, { acao: 'ftp-apagar', dominio: x.name, user: u }, 'Conta FTP apagada')), Promise.resolve())}
                />,
              ),
          },
        ]}
      />
    </>
  );
}
export const ftpPagina: ScreenFn = () => ({ title: 'FTP', dominios: 'sites', body: <Ftp /> });

// ---------- Bases de dados (como no DirectAdmin: lista, utilizadores, gerir base, gerir utilizador) ----------
type InfoMysql = { utilizadores: { dbuser: string; hosts: string[]; bases: string[] }[]; bases: Record<string, { bytes: number; tabelas: number }>; mysql?: { versao: string; modo: string[]; socket: string } };
type Privs = Record<string, boolean>;
// na ordem do DirectAdmin (Alter, Alter Routine, Create, …), em 4 colunas
const PRIVS: [string, string][] = [
  ['alter', 'Alterar'], ['alterRoutine', 'Alterar rotinas'], ['create', 'Criar'], ['createRoutine', 'Criar rotinas'],
  ['createTmpTable', 'Criar tabelas temporárias'], ['createView', 'Criar views'], ['delete', 'Apagar'], ['drop', 'Eliminar'],
  ['event', 'Eventos'], ['execute', 'Executar'], ['index', 'Índices'], ['insert', 'Inserir'],
  ['lockTables', 'Bloquear tabelas'], ['references', 'Referências'], ['select', 'Ler (Select)'], ['showView', 'Ver views'],
  ['trigger', 'Triggers'], ['update', 'Atualizar'],
];
const resumoPrivs = (p: Privs) => {
  const n = PRIVS.filter(([k]) => p[k]).length;
  return n === PRIVS.length ? 'Todos os privilégios' : n === 0 ? 'Nenhum' : PRIVS.filter(([k]) => p[k]).map(([, l]) => l).join(', ');
};

/** Lê um endereço da API e devolve { dados, erro, ler } (memória comum do painel) */
function useApi<T>(url: string | null) {
  return useGet<T>(url);
}
const urlBd = (me: string, extra = '') => '/api/vhost/bd?conta=' + encodeURIComponent(me) + extra;

/** Alteração MySQL (utilizadores, acessos, privilégios, hosts, manutenção); devolve a resposta ou null.
 *  `recarregar`: voltar a ler a conta toda (só quando a alteração muda a lista de bases de dados). */
async function noMysql(vh: VH, corpo: Record<string, unknown>, ok: string, recarregar = true): Promise<Record<string, unknown> | null> {
  vh.toast('A alterar no servidor…');
  try {
    const r = await fetch('/api/vhost/bd', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conta: vh.me, ...corpo }) });
    const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    if (!r.ok) {
      vh.toast(String(j.erro || 'A alteração falhou'));
      return null;
    }
    if (recarregar) await vh.recarregar(true);
    vh.toast(ok);
    return j;
  } catch {
    vh.toast('Sem ligação ao site. Nada foi alterado.');
    return null;
  }
}

/** phpMyAdmin já com sessão (acesso temporário só às bases da conta, ou só à base indicada) — rota do painel */
const pmaUrl = (vh: VH, bd?: string) => '/api/vhost/bd?conta=' + encodeURIComponent(vh.me) + '&pma=1' + (bd ? '&bd=' + encodeURIComponent(bd) : '');
const tamanho = (b?: number) => (b == null ? '—' : b >= 1048576 ? (b / 1048576).toFixed(2).replace('.', ',') + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');
const dominioBd = (vh: VH) => vh.a.domains.find((x) => !x.soEmail && !x.soDominio)?.name || vh.a.domains[0]?.name || '';
const limiteBd = (vh: VH) => {
  const l = pacoteDe(vh.s, vh.me)?.lim.mysql;
  return !l || l.unl ? 'ilimitado' : l.v;
};

function SeparadoresBd({ on }: { on: 'bases' | 'utilizadores' }) {
  const { nav } = useVH();
  return (
    <Tabs
      tabs={[
        ['bases', 'Bases de dados', 'fa-database'],
        ['utilizadores', 'Utilizadores', 'fa-users'],
      ]}
      on={on}
      onChange={(k) => nav('/utilizador/bd' + (k === 'utilizadores' ? '/utilizadores' : ''))}
    />
  );
}

/** Título de secção com descrição e números à direita (como "Databases List · Database Count / Total Size" do DA) */
function Seccao({ titulo, desc, numeros }: { titulo: string; desc?: string; numeros?: [string, string][] }) {
  const { t } = useVH();
  return (
    <div className="seccao-h">
      <div>
        <h3>{t(titulo)}</h3>
        {desc && <p>{t(desc)}</p>}
      </div>
      {numeros && (
        <div className="numeros">
          {numeros.map(([k, v]) => (
            <span key={k}>
              {t(k)} <b>{v}</b>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function CredenciaisModal({ bd, user, senha }: { bd: string; user: string; senha: string }) {
  const { t, closeM } = useVH();
  return (
    <>
      <h3>{t('Base de dados criada')}</h3>
      <p style={{ color: 'var(--muted)', marginBottom: 10 }}>{t('Guarde estes dados: a palavra-passe não volta a ser mostrada.')}</p>
      <div className="f">
        <label>{t('Base de dados')}</label>
        <input readOnly value={bd} onFocus={(e) => e.target.select()} />
      </div>
      <div className="f">
        <label>{t('Utilizador')}</label>
        <input readOnly value={user} onFocus={(e) => e.target.select()} />
      </div>
      <div className="f">
        <label>{t('Palavra-passe')}</label>
        <input readOnly value={senha} onFocus={(e) => e.target.select()} />
      </div>
      <div className="mfoot">
        <button className="btn r" onClick={closeM}>
          {t('Fechar')}
        </button>
      </div>
    </>
  );
}

function BasesDados() {
  const vh = useVH();
  const { a, me, t, nav, openM } = vh;
  const [semTamanho, setSemTamanho] = useState(() => {
    try {
      return localStorage.getItem('vh-bd-sem-tamanho') === '1';
    } catch {
      return false;
    }
  });
  const { dados: info, erro, ler } = useApi<InfoMysql>(urlBd(me, semTamanho ? '&semTamanho=1' : ''));
  const [f, setF] = useState({ nome: '', user: '', senha: '', avancado: false });
  const rows: BaseDados[] = a.dbs || [];
  const nUsers = (bd: string) => (info ? info.utilizadores.filter((u) => u.bases.includes(bd)).length : 0);
  const total = info && !semTamanho ? Object.values(info.bases).reduce((n, b) => n + b.bytes, 0) : null;
  const apagar = (nome: string) =>
    openM(
      <Confirmar
        titulo="Apagar base de dados?"
        texto={'Vai apagar ' + nome + ' com todas as tabelas. Um site que a use deixa de funcionar. Não se pode desfazer.'}
        ok="Apagar"
        onOk={async () => (await noServidor(vh, { acao: 'bd-apagar', dominio: dominioBd(vh), nome }, 'Base de dados apagada')) && ler()}
      />,
    );
  const criar = async () => {
    if (!/^[a-z0-9_]{1,40}$/.test(f.nome)) return vh.toast('Nome: letras minúsculas, números e _');
    const user = f.avancado && f.user ? f.user : f.nome;
    const senha = f.avancado ? f.senha : novaSenha();
    if (senha.length < 8) return vh.toast('A palavra-passe precisa de pelo menos 8 caracteres');
    if (await noServidor(vh, { acao: 'bd-criar', dominio: dominioBd(vh), nome: f.nome, user, senha }, 'Base de dados ' + me + '_' + f.nome + ' criada')) {
      openM(<CredenciaisModal bd={me + '_' + f.nome} user={me + '_' + user} senha={senha} />);
      setF({ nome: '', user: '', senha: '', avancado: false });
      ler();
    }
  };
  return (
    <>
      <SeparadoresBd on="bases" />
      <DataTable
        id="bd"
        rows={rows}
        rowKey={(r) => r.nome}
        search={(r) => r.nome + ' ' + r.user}
        onRecarregar={() => {
          ler();
          vh.recarregar(true);
        }}
        barra2={
          <Seccao
            titulo="Lista de bases de dados"
            numeros={[
              ['Bases de dados', rows.length + ' / ' + t(limiteBd(vh))],
              ['Tamanho total', total == null ? '—' : tamanho(total)],
            ]}
          />
        }
        empty="Esta conta ainda não tem bases de dados"
        cols={[
          {
            k: 'nome',
            t: 'Base de dados',
            sort: (r) => r.nome,
            cell: (r) => (
              <span className="cel-ic">
                <i className="fa-solid fa-database" />
                <a className="lk" onClick={() => nav('/utilizador/bd/' + encodeURIComponent(r.nome))}>
                  {r.nome}
                </a>
              </span>
            ),
          },
          { k: 'tam', t: 'Tamanho', cell: (r) => (semTamanho ? '—' : info ? tamanho(info.bases[r.nome]?.bytes) : '…') },
          { k: 'users', t: 'Utilizadores', cell: (r) => (info ? nUsers(r.nome) : '…') },
          { k: 'tabelas', t: 'Tabelas', cell: (r) => (semTamanho ? '—' : info ? info.bases[r.nome]?.tabelas ?? '—' : '…') },
          { k: 'estado', t: 'Estado', cell: (r) => <span className={'tag ' + (r.suspensa ? 'off' : 'ok')}>{r.suspensa ? t('Suspensa') : t('Ativa')}</span>, hidden: true },
        ]}
        actions={(r) => (
          <span className="dns-acoes">
            <button className="btn sm btn-ed" onClick={() => nav('/utilizador/bd/' + encodeURIComponent(r.nome))}>
              {t('Gerir')}
            </button>
            <button className="btn sm btn-rm" onClick={() => apagar(r.nome)}>
              {t('Apagar')}
            </button>
          </span>
        )}
      />
      {erro && <Carregar erro={erro} ler={ler} />}
      <div className="sob-tabela">
        <Check
          checked={semTamanho}
          onChange={(v) => {
            setSemTamanho(v);
            try {
              localStorage.setItem('vh-bd-sem-tamanho', v ? '1' : '0');
            } catch {}
          }}
          label="Não calcular o tamanho das bases de dados (abre mais depressa)"
        />
      </div>
      <SecDa titulo="Criar base de dados" desc="Pode escolher entre o formulário simples e o avançado. O avançado dá mais controlo: um nome de utilizador diferente e a palavra-passe escrita à mão.">
        <div className="da-campo">
          <label htmlFor="bd-nome">{t('Nome da base de dados')}</label>
          <span className="igrp">
            <span className="ib" style={{ cursor: 'default' }}>
              {me}_
            </span>
            <input id="bd-nome" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value.toLowerCase() })} onKeyDown={(e) => e.key === 'Enter' && criar()} />
          </span>
          {!f.avancado && <small>{t('Um utilizador com o mesmo nome e uma palavra-passe segura são criados automaticamente')}</small>}
        </div>
        {f.avancado && (
          <>
            <div className="da-campo">
              <label htmlFor="bd-user">{t('Nome do utilizador')}</label>
              <span className="igrp">
                <span className="ib" style={{ cursor: 'default' }}>
                  {me}_
                </span>
                <input id="bd-user" value={f.user} onChange={(e) => setF({ ...f, user: e.target.value.toLowerCase() })} placeholder={f.nome} />
              </span>
            </div>
            <div className="da-campo">
              <label>{t('Palavra-passe')}</label>
              <Senha value={f.senha} onChange={(v) => setF({ ...f, senha: v })} />
            </div>
          </>
        )}
        <div className="da-fim">
          <button className="btn-link" onClick={() => setF({ ...f, avancado: !f.avancado })}>
            <i className={'fa-solid ' + (f.avancado ? 'fa-chevron-up' : 'fa-chevron-down')} />
            {t('Modo avançado')}
          </button>
          <button className="btn r" onClick={criar}>
            <i className="fa-solid fa-circle-plus" />
            {t('Criar')}
          </button>
        </div>
      </SecDa>
      <SecDa titulo="Detalhes do servidor" desc="Informação sobre o servidor de bases de dados e os dados de ligação.">
        <div className="da-lista">
          <div>
            <span>{t('Versão')}</span>
            <span>{info?.mysql?.versao || '…'}</span>
          </div>
          <div>
            <span>{t('Modo SQL')}</span>
            <span>{info?.mysql ? info.mysql.modo.map((m) => <code key={m}>{m}</code>) : '…'}</span>
          </div>
          <div>
            <span>{t('Servidor')}</span>
            <span>
              <code>localhost</code>
              {info?.mysql?.socket && (
                <>
                  {' '}
                  ({t('socket UNIX')} <code>{info.mysql.socket}</code>)
                </>
              )}
            </span>
          </div>
        </div>
      </SecDa>
    </>
  );
}

function ResultadoModal({ titulo, texto }: { titulo: string; texto: string }) {
  const { t, closeM } = useVH();
  return (
    <>
      <h3>{t(titulo)}</h3>
      <pre className="resultado">{texto || t('Sem nada a assinalar.')}</pre>
      <div className="mfoot">
        <button className="btn r" onClick={closeM}>
          {t('Fechar')}
        </button>
      </div>
    </>
  );
}

/** Grelha do "Overview" do DirectAdmin: linhas de 1 a 3 células, cada uma com ícone, nome e valor */
function Grelha({ linhas }: { linhas: [string, string, ReactNode][][] }) {
  const { t } = useVH();
  return (
    <div className="da-grelha">
      {linhas.map((l, i) => (
        <div key={i} className={'da-lin n' + l.length}>
          {l.map(([ic, k, v]) => (
            <div key={k} className="da-cel">
              <i className={ic} />
              <div>
                <small>{t(k)}</small>
                <span>{v}</span>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Secção de uma página de gestão (título, descrição, números à direita e o conteúdo) */
function SecDa({ titulo, desc, numeros, children }: { titulo: string; desc: string; numeros?: [string, string][]; children: ReactNode }) {
  return (
    <section className="da-sec">
      <Seccao titulo={titulo} desc={desc} numeros={numeros} />
      {children}
    </section>
  );
}

/** Privilégios abertos por baixo da linha (como no DirectAdmin), em 4 colunas, com "Guardar alterações" */
function PrivsAbertos({ privs, onGuardar }: { privs: Privs; onGuardar: (p: Privs) => void }) {
  const { t } = useVH();
  const [p, setP] = useState<Privs>(() => Object.fromEntries(PRIVS.map(([k]) => [k, !!privs[k]])));
  return (
    <div className="da-privs">
      <div className="privs">
        {PRIVS.map(([k, l]) => (
          <Check key={k} checked={!!p[k]} onChange={(v) => setP({ ...p, [k]: v })} label={l} />
        ))}
      </div>
      <button className="btn sm btn-ed" onClick={() => onGuardar(p)}>
        <i className="fa-solid fa-floppy-disk" />
        {t('Guardar alterações')}
      </button>
    </div>
  );
}

const selo = (p: Privs) => {
  const n = PRIVS.filter(([k]) => p[k]).length;
  return n === PRIVS.length ? 'Acesso total' : n === 0 ? 'Sem acesso' : 'Acesso parcial';
};

type LinhaAcesso = { nome: string; privs: Privs; ir: string; fixo?: string };

/** Caixa "User Access" / "Access to Databases": tabela com Gerir · Privilégios · Tirar acesso e, por baixo, dar acesso */
function CaixaAcesso({
  ic,
  coluna,
  linhas,
  vazio,
  darTitulo,
  darVazio,
  opcoes,
  onPrivs,
  onTirar,
  onDar,
}: {
  ic: string;
  coluna: string;
  linhas: LinhaAcesso[];
  vazio: string;
  darTitulo: string;
  darVazio: string;
  opcoes: string[];
  onPrivs: (nome: string, p: Privs) => Promise<boolean>;
  onTirar: (nome: string) => void;
  onDar: (nome: string) => Promise<boolean>;
}) {
  const { t, nav } = useVH();
  const [aberto, setAberto] = useState('');
  const [dar, setDar] = useState('');
  return (
    <div className="da-caixa">
      <table className="da-tbl">
        <thead>
          <tr>
            <th className="da-ic" />
            <th>{t(coluna)}</th>
            <th>{t('Privilégios')}</th>
            <th>{t('Ações')}</th>
          </tr>
        </thead>
        <tbody>
          {linhas.length === 0 && (
            <tr>
              <td colSpan={4} className="empty">
                {t(vazio)}
              </td>
            </tr>
          )}
          {linhas.map((l) => (
            <Fragment key={l.nome}>
              <tr className={aberto === l.nome ? 'on' : ''}>
                <td className="da-ic">
                  <i className={ic} />
                </td>
                <td className="nome">{l.nome}</td>
                <td>
                  <span className={'da-selo' + (selo(l.privs) === 'Acesso total' ? '' : ' parcial')} title={t(resumoPrivs(l.privs))}>
                    {t(selo(l.privs))}
                  </span>
                </td>
                <td className="acoes">
                  <span className="dns-acoes">
                    <button className="btn sm btn-ed" onClick={() => nav(l.ir)}>
                      {t('Gerir')}
                    </button>
                    <button className="btn sm btn-ed" onClick={() => setAberto(aberto === l.nome ? '' : l.nome)}>
                      {t('Privilégios')}
                    </button>
                    <button className="btn sm btn-rm" disabled={!!l.fixo} title={l.fixo ? t(l.fixo) : ''} onClick={() => onTirar(l.nome)}>
                      {t('Tirar acesso')}
                    </button>
                  </span>
                </td>
              </tr>
              {aberto === l.nome && (
                <tr className="da-privs-lin">
                  <td colSpan={4}>
                    <PrivsAbertos privs={l.privs} onGuardar={async (p) => (await onPrivs(l.nome, p)) && setAberto('')} />
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
      <div className="da-dar">
        <label>{t(darTitulo)}</label>
        <select value={dar} onChange={(e) => setDar(e.target.value)} aria-label={t(darTitulo)}>
          <option value="">{t(darVazio)}</option>
          {opcoes.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
        <div className="da-pe">
          <small>{t('O utilizador recebe todos os privilégios')}</small>
          <button className="btn sm btn-ed" disabled={!dar} onClick={async () => (await onDar(dar)) && setDar('')}>
            <i className="fa-solid fa-plus" />
            {t('Dar acesso total')}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Janela de importar: o ficheiro já foi escolhido; falta decidir se apaga as tabelas que lá estão */
function ImportarModal({ bd, ficheiro, onFeito }: { bd: string; ficheiro: File; onFeito: () => void }) {
  const vh = useVH();
  const { t, closeM } = vh;
  const [limpar, setLimpar] = useState(false);
  const importar = async () => {
    closeM();
    vh.toast('A importar… pode demorar');
    const fd = new FormData();
    fd.set('conta', vh.me);
    fd.set('bd', bd);
    fd.set('limpar', limpar ? '1' : '0');
    fd.set('ficheiro', ficheiro);
    try {
      const res = await fetch('/api/vhost/bd', { method: 'POST', body: fd });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) return vh.toast(j.erro || 'A importação falhou');
      vh.toast('Importação terminada');
      onFeito();
    } catch {
      vh.toast('Sem ligação ao site. Nada foi importado.');
    }
  };
  return (
    <>
      <h3>{t('Importar para')} {bd}</h3>
      <p style={{ color: 'var(--muted)', marginBottom: 12 }}>
        {ficheiro.name} · {tamanho(ficheiro.size)}
      </p>
      {ficheiro.size > 512 * 1048576 ? (
        <div className="imp">
          <i className="fa-solid fa-triangle-exclamation" />
          <div>{t('O ficheiro passa de 512 MB.')}</div>
        </div>
      ) : (
        <Check checked={limpar} onChange={setLimpar} label="Apagar as tabelas que já lá estão" />
      )}
      <div className="mfoot">
        <button className="btn g" onClick={closeM}>
          {t('Cancelar')}
        </button>
        <button className="btn r" disabled={ficheiro.size > 512 * 1048576} onClick={importar}>
          <i className="fa-solid fa-upload" />
          {t('Importar')}
        </button>
      </div>
    </>
  );
}

type FichaBd = { resumo: { charset: string; collation: string; bytes: number; tabelas: number; views: number; eventos: number; triggers: number; rotinas: number }; utilizadores: { dbuser: string; hostPatterns: string[]; privileges: Privs }[] };

/** Gerir base de dados (Manage Database do DirectAdmin): Resumo · Acesso de utilizadores · Operações */
function VerBd({ nome }: { nome: string }) {
  const vh = useVH();
  const { a, me, t, openM } = vh;
  const { dados: ficha, erro, ler } = useApi<FichaBd>(urlBd(me, '&bd=' + encodeURIComponent(nome)));
  const { dados: info, ler: lerInfo } = useApi<InfoMysql>(urlBd(me, '&semTamanho=1'));
  const b = (a.dbs || []).find((x) => x.nome === nome);
  if (!b) return <div className="card empty">{t('Esta base de dados não existe nesta conta')}</div>;
  if (!ficha) return <Carregar erro={erro} ler={ler} />;
  const r = ficha.resumo;
  const outros = (info?.utilizadores || []).filter((u) => !ficha.utilizadores.some((x) => x.dbuser === u.dbuser)).map((u) => u.dbuser);
  const depois = () => {
    ler();
    lerInfo();
  };
  const manut = async (op: string, titulo: string) => {
    const j = await noMysql(vh, { acao: 'manutencao', bd: nome, op }, titulo + ': feito', false);
    if (j) openM(<ResultadoModal titulo={titulo} texto={String(j.resultado || '')} />);
  };
  const exp = (gz: boolean) => urlBd(me, '&exportar=' + encodeURIComponent(nome) + (gz ? '' : '&gz=0'));
  return (
    <>
      <SecDa titulo="Resumo" desc="Informação detalhada da base de dados.">
        <Grelha
          linhas={[
            [['fa-solid fa-database', 'Nome da base de dados', nome]],
            [
              ['fa-solid fa-language', 'Charset por defeito', r.charset || '—'],
              ['fa-solid fa-language', 'Collation por defeito', r.collation || '—'],
            ],
            [
              ['fa-regular fa-file', 'Tamanho', tamanho(r.bytes)],
              ['fa-regular fa-user', 'Utilizadores', ficha.utilizadores.length],
            ],
            [
              ['fa-solid fa-table-list', 'Tabelas', r.tabelas],
              ['fa-regular fa-eye', 'Views', r.views],
            ],
            [
              ['fa-regular fa-clock', 'Eventos', r.eventos],
              ['fa-solid fa-right-left', 'Triggers', r.triggers],
              ['fa-solid fa-code', 'Rotinas', r.rotinas],
            ],
          ]}
        />
      </SecDa>
      <SecDa
        titulo="Acesso de utilizadores"
        desc="Lista dos utilizadores que acedem a esta base de dados, com o resumo dos privilégios. O botão Privilégios mostra e muda os privilégios. Outros utilizadores da conta podem receber acesso no formulário por baixo da lista."
      >
        <CaixaAcesso
          ic="fa-regular fa-user"
          coluna="Utilizador"
          vazio="Nenhum utilizador acede a esta base de dados"
          linhas={ficha.utilizadores.map((u) => ({ nome: u.dbuser, privs: u.privileges, ir: '/utilizador/bd/utilizadores/' + encodeURIComponent(u.dbuser), fixo: u.dbuser === b.user ? 'Utilizador principal da base de dados' : undefined }))}
          darTitulo="Dar acesso a outro utilizador"
          darVazio="Escolher utilizador…"
          opcoes={outros}
          onPrivs={async (u, p) => !!(await noMysql(vh, { acao: 'privilegios', dbuser: u, bd: nome, privs: p }, 'Privilégios de ' + u + ' guardados', false)) && (ler(), true)}
          onTirar={(u) =>
            openM(<Confirmar titulo="Tirar o acesso?" texto={u + ' deixa de aceder a ' + nome + '.'} ok="Tirar acesso" onOk={async () => (await noMysql(vh, { acao: 'user-tirar', dbuser: u, bd: nome }, 'Acesso tirado a ' + u, false)) && depois()} />)
          }
          onDar={async (u) => !!(await noMysql(vh, { acao: 'user-dar', dbuser: u, bd: nome }, 'Acesso total dado a ' + u, false)) && (depois(), true)}
        />
      </SecDa>
      <SecDa titulo="Operações da base de dados" desc="Enviar uma cópia de segurança, verificar, reparar ou otimizar a base de dados.">
        <div className="da-ops">
          <label className="btn da-op">
            <i className="fa-solid fa-arrow-up-from-bracket" />
            {t('Importar')}
            <input
              type="file"
              accept=".sql,.gz"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) openM(<ImportarModal bd={nome} ficheiro={f} onFeito={ler} />);
              }}
            />
          </label>
          <a className="btn da-op" href={exp(false)}>
            <i className="fa-solid fa-file-export" />
            {t('Exportar como SQL')}
          </a>
          <a className="btn da-op" href={exp(true)}>
            <i className="fa-solid fa-file-zipper" />
            {t('Exportar como GZ')}
          </a>
          <button className="btn da-op" onClick={() => manut('check', 'Verificar')}>
            <i className="fa-solid fa-magnifying-glass" />
            {t('Verificar')}
          </button>
          <button className="btn da-op" onClick={() => manut('repair', 'Reparar')}>
            <i className="fa-solid fa-wrench" />
            {t('Reparar')}
          </button>
          <button className="btn da-op" onClick={() => manut('optimize', 'Otimizar')}>
            <i className="fa-solid fa-rocket" />
            {t('Otimizar')}
          </button>
        </div>
      </SecDa>
    </>
  );
}

function UtilizadoresBd() {
  const vh = useVH();
  const { me, t, nav, openM } = vh;
  const { dados: info, erro, ler } = useApi<InfoMysql>(urlBd(me, '&semTamanho=1'));
  const [f, setF] = useState({ nome: '', senha: '' });
  const criar = async () => {
    if (!/^[a-z0-9_]{1,24}$/.test(f.nome)) return vh.toast('Nome: letras minúsculas, números e _');
    if (f.senha.length < 8) return vh.toast('A palavra-passe precisa de pelo menos 8 caracteres');
    if (await noMysql(vh, { acao: 'user-criar', nome: f.nome, senha: f.senha }, 'Utilizador ' + me + '_' + f.nome + ' criado', false)) {
      setF({ nome: '', senha: '' });
      ler();
    }
  };
  const apagar = (u: string) =>
    openM(<Confirmar titulo="Apagar utilizador?" texto={'Vai apagar ' + u + '. Um site que se ligue com ele deixa de funcionar.'} ok="Apagar" onOk={async () => (await noMysql(vh, { acao: 'user-apagar', dbuser: u }, 'Utilizador apagado', false)) && ler()} />);
  const lista = info?.utilizadores || [];
  return (
    <>
      <SeparadoresBd on="utilizadores" />
      <DataTable
        id="bd-users"
        rows={lista}
        rowKey={(r) => r.dbuser}
        search={(r) => r.dbuser + ' ' + r.bases.join(' ')}
        onRecarregar={ler}
        barra2={
          <Seccao
            titulo="Contas de utilizador"
            numeros={[['Utilizadores', lista.length + ' / ' + t('ilimitado')]]}
          />
        }
        empty={info ? 'Esta conta ainda não tem utilizadores MySQL' : 'A ler…'}
        cols={[
          {
            k: 'user',
            t: 'Utilizador',
            sort: (r) => r.dbuser,
            cell: (r) => (
              <span className="cel-ic">
                <i className="fa-regular fa-user" />
                <a className="lk" onClick={() => nav('/utilizador/bd/utilizadores/' + encodeURIComponent(r.dbuser))}>
                  {r.dbuser}
                </a>
              </span>
            ),
          },
          { k: 'hosts', t: 'Hosts permitidos', cell: (r) => r.hosts.join(', ') },
          { k: 'bases', t: 'Bases de dados', cell: (r) => r.bases.length, hidden: true },
        ]}
        actions={(r) => (
          <span className="dns-acoes">
            <button className="btn sm btn-ed" onClick={() => nav('/utilizador/bd/utilizadores/' + encodeURIComponent(r.dbuser))}>
              {t('Gerir')}
            </button>
            <button className="btn sm btn-rm" onClick={() => apagar(r.dbuser)}>
              {t('Apagar')}
            </button>
          </span>
        )}
      />
      {erro && <Carregar erro={erro} ler={ler} />}
      <SecDa titulo="Criar utilizador" desc="O novo utilizador não tem acesso a nenhuma base de dados até lho dar.">
        <div className="da-campo">
          <label htmlFor="bd-unome">{t('Nome do utilizador')}</label>
          <span className="igrp">
            <span className="ib" style={{ cursor: 'default' }}>
              {me}_
            </span>
            <input id="bd-unome" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value.toLowerCase() })} />
          </span>
        </div>
        <div className="da-campo">
          <label>{t('Palavra-passe')}</label>
          <Senha value={f.senha} onChange={(v) => setF({ ...f, senha: v })} />
        </div>
        <div className="da-fim">
          <span />
          <button className="btn r" onClick={criar}>
            <i className="fa-solid fa-circle-plus" />
            {t('Criar')}
          </button>
        </div>
      </SecDa>
    </>
  );
}

type FichaUser = { hosts: string[]; bases: { database: string; privileges: Privs }[] };

/** Gerir utilizador (Manage User do DirectAdmin): Resumo · Palavra-passe · Acesso a bases de dados · Hosts permitidos */
function VerUtilizadorBd({ dbuser }: { dbuser: string }) {
  const vh = useVH();
  const { a, me, t, openM } = vh;
  const { dados: ficha, erro, ler } = useApi<FichaUser>(urlBd(me, '&user=' + encodeURIComponent(dbuser)));
  const [senha, setSenha] = useState('');
  const [host, setHost] = useState('');
  if (!ficha) return <Carregar erro={erro} ler={ler} />;
  const principalDe = (a.dbs || []).filter((x) => x.user === dbuser).map((x) => x.nome);
  const outras = (a.dbs || []).map((x) => x.nome).filter((n) => !ficha.bases.some((b) => b.database === n));
  const gravarHosts = async (hosts: string[], msg: string) => !!(await noMysql(vh, { acao: 'hosts', dbuser, hosts }, msg, false)) && (ler(), true);
  const juntarHost = async () => {
    const h = host.trim();
    if (!h) return vh.toast('Escreva o host');
    if (!/^(localhost|%|[0-9a-fA-F.:%_-]+)$/.test(h)) return vh.toast('Host inválido: localhost, %, IPv4 ou IPv6');
    if (ficha.hosts.includes(h)) return vh.toast('Esse host já está na lista');
    if (await gravarHosts([...ficha.hosts, h], 'Host ' + h + ' adicionado')) setHost('');
  };
  return (
    <>
      <SecDa titulo="Resumo" desc="Informação detalhada do utilizador.">
        <Grelha
          linhas={[
            [['fa-regular fa-user', 'Nome do utilizador', dbuser]],
            [
              ['fa-solid fa-database', 'Bases de dados', ficha.bases.length],
              ['fa-solid fa-globe', 'Hosts permitidos', ficha.hosts.length],
            ],
          ]}
        />
      </SecDa>
      <SecDa titulo="Gestão da palavra-passe" desc="Mudar a palavra-passe do utilizador escolhido.">
        <div className="da-campo">
          <label>{t('Nova palavra-passe')}</label>
          <Senha value={senha} onChange={setSenha} />
        </div>
        <button
          className="btn r"
          disabled={!senha}
          onClick={async () => {
            if (senha.length < 8) return vh.toast('A palavra-passe precisa de pelo menos 8 caracteres');
            if (await noMysql(vh, { acao: 'user-senha', dbuser, senha }, 'Palavra-passe de ' + dbuser + ' mudada', false)) setSenha('');
          }}
        >
          <i className="fa-solid fa-gear" />
          {t('Mudar palavra-passe')}
        </button>
      </SecDa>
      <SecDa titulo="Acesso a bases de dados" desc="Lista das bases de dados a que este utilizador acede.">
        <CaixaAcesso
          ic="fa-solid fa-database"
          coluna="Base de dados"
          vazio="Ainda sem acesso a nenhuma base de dados"
          linhas={ficha.bases.map((b) => ({ nome: b.database, privs: b.privileges, ir: '/utilizador/bd/' + encodeURIComponent(b.database), fixo: principalDe.includes(b.database) ? 'Utilizador principal desta base de dados' : undefined }))}
          darTitulo="Dar acesso a outra base de dados"
          darVazio="Escolher base de dados…"
          opcoes={outras}
          onPrivs={async (bd, p) => !!(await noMysql(vh, { acao: 'privilegios', dbuser, bd, privs: p }, 'Privilégios em ' + bd + ' guardados', false)) && (ler(), true)}
          onTirar={(bd) =>
            openM(<Confirmar titulo="Tirar o acesso?" texto={dbuser + ' deixa de aceder a ' + bd + '.'} ok="Tirar acesso" onOk={async () => (await noMysql(vh, { acao: 'user-tirar', dbuser, bd }, 'Acesso a ' + bd + ' tirado', false)) && ler()} />)
          }
          onDar={async (bd) => !!(await noMysql(vh, { acao: 'user-dar', dbuser, bd }, 'Acesso total a ' + bd, false)) && (ler(), true)}
        />
      </SecDa>
      <SecDa
        titulo="Hosts permitidos"
        desc="Endereços IP ou padrões a partir dos quais este utilizador se pode ligar à base de dados com estes dados de acesso. O padrão % aceita ligações de qualquer endereço."
        numeros={[['Número de hosts', ficha.hosts.length + ' / ' + t('ilimitado')]]}
      >
        <div className="da-caixa">
          <table className="da-tbl">
            <thead>
              <tr>
                <th className="da-ic" />
                <th>{t('Host')}</th>
                <th style={{ textAlign: 'right' }}>{t('Ações')}</th>
              </tr>
            </thead>
            <tbody>
              {ficha.hosts.map((h) => (
                <tr key={h}>
                  <td className="da-ic">
                    <i className="fa-solid fa-globe" />
                  </td>
                  <td className="nome">{h}</td>
                  <td className="acoes" style={{ textAlign: 'right' }}>
                    {ficha.hosts.length > 1 && (
                      <button className="btn sm btn-rm" onClick={() => openM(<Confirmar titulo="Apagar host?" texto={dbuser + ' deixa de se poder ligar a partir de ' + h + '.'} ok="Apagar" onOk={() => gravarHosts(ficha.hosts.filter((x) => x !== h), 'Host apagado')} />)}>
                        {t('Apagar')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="da-dar">
            <label htmlFor="da-host">{t('Permitir acesso a partir de')}</label>
            <input id="da-host" value={host} onChange={(e) => setHost(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && juntarHost()} />
            <div className="da-pe">
              <small>{t('O host pode ser localhost, %, IPv4 ou IPv6')}</small>
              <button className="btn sm btn-ed" onClick={juntarHost}>
                <i className="fa-solid fa-plus" />
                {t('Adicionar host')}
              </button>
            </div>
          </div>
        </div>
      </SecDa>
    </>
  );
}

/** Botões do topo das páginas de bases de dados, os mesmos do DirectAdmin em cada página */
const botoesBd = (vh: VH, pagina: 'bases' | 'utilizadores' | 'base' | 'utilizador', bd?: string) => {
  const bases = (
    <button key="b" className="btn r" onClick={() => vh.nav('/utilizador/bd')}>
      <i className="fa-solid fa-database" />
      {vh.t('Gerir bases de dados')}
    </button>
  );
  const users = (
    <button key="u" className="btn r" onClick={() => vh.nav('/utilizador/bd/utilizadores')}>
      <i className="fa-regular fa-user" />
      {vh.t('Gerir utilizadores')}
    </button>
  );
  const pma = (
    <a key="p" className="btn r" href={pmaUrl(vh, bd)} target="_blank" rel="noreferrer">
      <i className="fa-solid fa-gear" />
      phpMyAdmin
    </a>
  );
  return <>{pagina === 'bases' ? [pma, users] : pagina === 'utilizadores' ? [bases] : pagina === 'base' ? [bases, users, pma] : [bases, users]}</>;
};

/** Extras → phpMyAdmin: abre já com sessão, na conta toda ou numa base de dados */
function PhpMyAdmin() {
  const vh = useVH();
  const { a, t } = vh;
  return (
    <>
      <div className="note">{t('O phpMyAdmin abre noutra janela, já com sessão iniciada, só com as bases de dados desta conta. O acesso dura 10 minutos.')}</div>
      <DataTable
        id="pma"
        rows={a.dbs || []}
        rowKey={(r) => r.nome}
        empty="Esta conta ainda não tem bases de dados"
        cols={[
          { k: 'nome', t: 'Base de dados', cell: (r) => <b>{r.nome}</b> },
          { k: 'tam', t: 'Tamanho', cell: (r) => r.disco },
        ]}
        actions={(r) => (
          <a className="btn g sm" href={pmaUrl(vh, r.nome)} target="_blank" rel="noreferrer">
            <i className="fa-solid fa-table" />
            {t('Abrir')}
          </a>
        )}
      />
    </>
  );
}
/** o botão fica sempre à direita, na linha de baixo do título (modelo de Domínios; Silva, 21/10/2026) */
function AbrirPhpMyAdmin() {
  const vh = useVH();
  return (
    <a className="btn r" href={pmaUrl(vh)} target="_blank" rel="noreferrer">
      <i className="fa-solid fa-database" />
      {vh.t('Abrir phpMyAdmin')}
    </a>
  );
}
export const phpmyadminPagina: ScreenFn = () => ({ title: 'phpMyAdmin', actions: <AbrirPhpMyAdmin />, body: <PhpMyAdmin /> });

export const bdPagina: ScreenFn = (vh) => {
  const [a, b] = vh.s.sub;
  const base = { t: 'Bases de dados', path: '/utilizador/bd' };
  if (a === 'utilizadores' && b) return { title: 'Gerir utilizador', crumbs: [base, { t: 'Utilizadores', path: '/utilizador/bd/utilizadores' }, { t: 'Gerir utilizador' }], actions: botoesBd(vh, 'utilizador'), body: <VerUtilizadorBd key={b} dbuser={b} /> };
  if (a === 'utilizadores') return { title: 'Utilizadores', crumbs: [base, { t: 'Utilizadores' }], actions: botoesBd(vh, 'utilizadores'), subTitulo: 'Todos os utilizadores das bases de dados. A coluna Hosts mostra os endereços IP ou padrões que podem ligar-se; % aceita ligações de qualquer endereço. Um utilizador novo cria-se no formulário por baixo da lista.', body: <UtilizadoresBd /> };
  if (a) return { title: 'Gerir base de dados', crumbs: [base, { t: 'Gerir base de dados' }], actions: botoesBd(vh, 'base', a), body: <VerBd key={a} nome={a} /> };
  return { title: 'Bases de dados', actions: botoesBd(vh, 'bases'), subTitulo: 'Crie bases de dados do seu site, com o número de utilizadores que lhes acedem, o tamanho e o número de tabelas abaixo', body: <BasesDados /> };
};

// ---------- Apontadores ----------
function Apontadores() {
  const vh = useVH();
  const { t, openM } = vh;
  const x = dominioAtual(vh);
  const [al, setAl] = useState('');
  if (!x) return <SemDominio />;
  const rows = (x.aliases || []).map((n) => ({ n }));
  const criar = async () => {
    const n = al.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '');
    if (!/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(n)) return vh.toast('Escreva um domínio válido');
    if (await noServidor(vh, { acao: 'alias-criar', dominio: x.name, alias: n }, n + ' passa a abrir ' + x.name)) setAl('');
  };
  return (
    <>
      <NoTopoCartao daPagina modelo={{ titulo: t('Criar apontador'), sub: t('Outro domínio que abre o mesmo site (o DNS dele tem de apontar para este servidor)') }}>
        <button className="btn r" onClick={criar}>
          <i className="fa-solid fa-plus" />
          {t('Criar')}
        </button>
      </NoTopoCartao>
      <Frm title="Criar apontador" semCabecalho>
        <Row label="Domínio de origem" hint="ex.: outrodominio.com">
          <span className="igrp">
            <span className="ib" style={{ cursor: 'default' }}>
              <i className="fa-solid fa-globe" />
            </span>
            <input value={al} onChange={(e) => setAl(e.target.value)} placeholder="outrodominio.com" />
          </span>
        </Row>
        <Row label="Destino">
          <b>{x.name}</b>
        </Row>
      </Frm>
      <DataTable
        id="apontadores"
        rows={rows}
        rowKey={(r) => r.n}
        search={(r) => r.n}
        empty="Este domínio ainda não tem apontadores"
        cols={[
          { k: 'n', t: 'Apontador', sort: (r) => r.n, cell: (r) => <b>{r.n}</b> },
          { k: 'tipo', t: 'Tipo', cell: () => t('Alias (mesmo site)') },
          { k: 'para', t: 'Destino', cell: () => x.name },
        ]}
        bulk={[
          {
            t: 'Apagar',
            fa: 'fa-trash',
            run: (k) =>
              openM(
                <Confirmar
                  titulo="Apagar apontadores?"
                  texto={'Deixam de abrir ' + x.name + ': ' + k.join(', ') + '.'}
                  ok="Apagar"
                  onOk={() => k.reduce<Promise<unknown>>((p, n) => p.then(() => noServidor(vh, { acao: 'alias-apagar', dominio: x.name, alias: n }, 'Apontador apagado')), Promise.resolve())}
                />,
              ),
          },
        ]}
      />
    </>
  );
}
export const apontadores: ScreenFn = () => ({ title: 'Apontadores', dominios: 'sites', body: <Apontadores /> });

// ---------- Redirecionamentos e hotlink (regras do VisualHost no .htaccess do site) ----------
type Regra = { de: string; tipo: string; para: string };
const lerRegras = (ht: string[]): Regra[] =>
  ht
    .map((l) => /^Redirect (301|302) (\/\S*) (https?:\/\/\S+)$/.exec(l))
    .filter((m): m is RegExpExecArray => !!m)
    .map((m) => ({ tipo: m[1], de: m[2], para: m[3] }));
type Hot = { ativo: boolean; urls: string[]; tipos: string; destino: string; vazio: boolean };
const lerHot = (ht: string[], d: string): Hot => {
  const c = ht.find((l) => l.startsWith('# hotlink '));
  if (!c) return { ativo: false, urls: [d, 'www.' + d], tipos: 'jpg,jpeg,gif,png,bmp,webp,svg,mp4', destino: '', vazio: true };
  const p = Object.fromEntries(c.slice(10).split(' ').map((x) => x.split('=')));
  return { ativo: true, urls: (p.urls || '').split(',').filter(Boolean), tipos: p.tipos || '', destino: p.destino || '', vazio: p.vazio === '1' };
};
/** Linhas do bloco do VisualHost: redirecionamentos por caminho + hotlink */
function linhasHt(regras: Regra[], hot: Hot, d: string): string[] {
  const l = regras.map((r) => `Redirect ${r.tipo} ${r.de} ${r.para}`);
  if (hot.ativo) {
    const tipos = hot.tipos.split(',').map((x) => x.trim().replace(/[^a-z0-9]/gi, '')).filter(Boolean);
    const urls = [...new Set([d, ...hot.urls])].map((u) => u.replace(/^https?:\/\//, '').replace(/\/.*$/, ''));
    l.push(`# hotlink urls=${urls.join(',')} tipos=${tipos.join(',')} destino=${hot.destino} vazio=${hot.vazio ? 1 : 0}`, 'RewriteEngine On');
    if (hot.vazio) l.push('RewriteCond %{HTTP_REFERER} !^$');
    for (const u of urls) l.push(`RewriteCond %{HTTP_REFERER} !^https?://(www\\.)?${u.replace(/^www\./, '').replace(/\./g, '\\.')} [NC]`);
    l.push(`RewriteRule \\.(${tipos.join('|')})$ ${hot.destino ? hot.destino + ' [R,NC,L]' : '- [F,NC,L]'}`);
  }
  return l;
}

function Redirecionamentos() {
  const vh = useVH();
  const { t } = vh;
  const x = dominioAtual(vh);
  const { det, erro, ler } = useDetalhe(x?.name || '');
  const [dom, setDom] = useState({ url: '', codigo: '301' });
  const [nova, setNova] = useState<Regra>({ de: '/', tipo: '301', para: 'https://' });
  if (!x) return <SemDominio />;
  if (!det) return <Carregar erro={erro} ler={ler} />;
  const regras = lerRegras(det.htaccess);
  const hot = lerHot(det.htaccess, x.name);
  const gravar = async (rs: Regra[], msg: string) => (await noServidor(vh, { acao: 'htaccess', dominio: x.name, linhas: linhasHt(rs, hot, x.name) }, msg)) && ler();
  return (
    <>
      <NoTopoCartao daPagina modelo={{ titulo: t(tituloDoCartao('Redirecionamentos')) }}>
        {det.redirecionamento && (
          <button className="btn g" onClick={async () => (await noServidor(vh, { acao: 'redir-dominio-tirar', dominio: x.name }, 'Redirecionamento tirado')) && ler()}>
            {t('Tirar')}
          </button>
        )}
        <button
          className="btn r"
          onClick={async () => {
            if (!/^https?:\/\/\S+$/.test(dom.url)) return vh.toast('Escreva o destino completo (https://…)');
            if (await noServidor(vh, { acao: 'redir-dominio', dominio: x.name, url: dom.url, codigo: dom.codigo }, x.name + ' passa a ir para ' + dom.url)) ler();
          }}
        >
          {t('Guardar')}
        </button>
      </NoTopoCartao>
      <Frm
        title="Redirecionar o domínio inteiro"
        desc="Tudo o que abrir este domínio vai para outro endereço"
        right={det.redirecionamento ? <span className="tag w">{t('Ativo')}</span> : undefined}
      >
        {det.redirecionamento && (
          <Row label="Agora">
            {det.redirecionamento.codigo} → <b>{det.redirecionamento.url}</b>
          </Row>
        )}
        <Row label="Destino">
          <input value={dom.url} onChange={(e) => setDom({ ...dom, url: e.target.value })} placeholder="https://outro-site.com" />
        </Row>
        <Row label="Tipo">
          <select value={dom.codigo} onChange={(e) => setDom({ ...dom, codigo: e.target.value })}>
            <option value="301">301 · {t('permanente')}</option>
            <option value="302">302 · {t('temporário')}</option>
          </select>
        </Row>
      </Frm>
      <Frm
        title="Redirecionar um caminho"
        desc="Ex.: /promo vai para outra página"
        foot={
          <button
            className="btn r"
            onClick={() => {
              if (!/^\/\S*$/.test(nova.de) || !/^https?:\/\/\S+$/.test(nova.para)) return vh.toast('Caminho a começar por / e destino completo (https://…)');
              gravar([...regras, nova], 'Redirecionamento de ' + nova.de + ' criado');
            }}
          >
            <i className="fa-solid fa-plus" />
            {t('Adicionar')}
          </button>
        }
      >
        <Row label="Caminho" hint={'Depois de ' + x.name}>
          <input value={nova.de} onChange={(e) => setNova({ ...nova, de: e.target.value })} placeholder="/promo" />
        </Row>
        <Row label="Tipo">
          <select value={nova.tipo} onChange={(e) => setNova({ ...nova, tipo: e.target.value })}>
            <option value="301">301 · {t('permanente')}</option>
            <option value="302">302 · {t('temporário')}</option>
          </select>
        </Row>
        <Row label="Destino">
          <input value={nova.para} onChange={(e) => setNova({ ...nova, para: e.target.value })} />
        </Row>
      </Frm>
      <DataTable
        id="redirecionamentos"
        rows={regras}
        rowKey={(r) => r.de}
        empty="Ainda não há redirecionamentos por caminho"
        cols={[
          { k: 'de', t: 'Caminho', cell: (r) => <b>{r.de}</b> },
          { k: 'tipo', t: 'Tipo', cell: (r) => r.tipo },
          { k: 'para', t: 'Destino', cell: (r) => <span style={{ wordBreak: 'break-all' }}>{r.para}</span> },
        ]}
        bulk={[{ t: 'Apagar', fa: 'fa-trash', run: (k) => gravar(regras.filter((r) => !k.includes(r.de)), 'Redirecionamento apagado') }]}
      />
    </>
  );
}
export const redirecionamentos: ScreenFn = () => ({ title: 'Redirecionamentos', dominios: 'sites', body: <Redirecionamentos /> });

function Hotlink() {
  const vh = useVH();
  const { t } = vh;
  const x = dominioAtual(vh);
  const { det, erro, ler } = useDetalhe(x?.name || '');
  const [h, setH] = useState<Hot | null>(null);
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (det && x) setH(lerHot(det.htaccess, x.name));
  }, [det, x]);
  if (!x) return <SemDominio />;
  if (!det || !h) return <Carregar erro={erro} ler={ler} />;
  const guardar = async (novo: Hot, msg: string) => (await noServidor(vh, { acao: 'htaccess', dominio: x.name, linhas: linhasHt(lerRegras(det.htaccess), novo, x.name) }, msg)) && ler();
  return (
    <>
      <NoTopoCartao daPagina modelo={{ titulo: t(tituloDoCartao('Proteção hotlink')), sub: '' }}>
        <button className="btn r" onClick={() => guardar({ ...h, ativo: true }, 'Proteção hotlink guardada')}>
          {t('Guardar')}
        </button>
      </NoTopoCartao>
      <Frm
        title="Estado da proteção"
        desc="Impede outros sites de mostrar as suas imagens e vídeos (gastando o seu tráfego)"
        right={<Switch checked={h.ativo} onChange={(v) => guardar({ ...h, ativo: v }, v ? 'Proteção hotlink ligada' : 'Proteção hotlink desligada')} label="Proteção hotlink" />}
      >
        <Row label="Tipos de ficheiro protegidos" hint="Separados por vírgulas">
          <input value={h.tipos} onChange={(e) => setH({ ...h, tipos: e.target.value })} />
        </Row>
        <Row label="Sites que podem mostrar" hint="O próprio domínio já está incluído">
          <span className="igrp">
            <span className="ib" style={{ cursor: 'default' }}>
              <i className="fa-solid fa-globe" />
            </span>
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="ex.: parceiro.com" />
            <button
              className="ib"
              onClick={() => {
                const u = url.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
                if (u) setH({ ...h, urls: [...new Set([...h.urls, u])] });
                setUrl('');
              }}
            >
              {t('Adicionar')}
            </button>
          </span>
        </Row>
        {h.urls.length > 0 && (
          <Row label="Permitidos">
            {h.urls.map((u) => (
              <span key={u} className="tag off" style={{ marginRight: 6 }}>
                {u}{' '}
                <i className="fa-solid fa-xmark" style={{ cursor: 'pointer' }} onClick={() => setH({ ...h, urls: h.urls.filter((x2) => x2 !== u) })} />
              </span>
            ))}
          </Row>
        )}
        <Row label="Quem não pode">
          <label className="chk">
            <input type="radio" checked={!h.destino} onChange={() => setH({ ...h, destino: '' })} /> {t('Recusar (403 Forbidden)')}
          </label>
          <label className="chk">
            <input type="radio" checked={!!h.destino} onChange={() => setH({ ...h, destino: 'https://' + x.name })} /> {t('Mandar para um endereço')}
          </label>
          {!!h.destino && <input value={h.destino} onChange={(e) => setH({ ...h, destino: e.target.value })} />}
        </Row>
        <Row label="Sem origem">
          <Check checked={h.vazio} onChange={(v) => setH({ ...h, vazio: v })} label="Permitir quem abre o ficheiro diretamente (sem site de origem)" />
        </Row>
      </Frm>
      {det.modelo && !/default|apache/i.test(det.modelo) && <div className="note">{t('Este site não usa Apache: as regras do .htaccess podem não ter efeito.')}</div>}
    </>
  );
}
export const hotlink: ScreenFn = () => ({ title: 'Proteção hotlink', dominios: 'sites', body: <Hotlink /> });

// ---------- Definições PHP ----------
// Todas as definições à vista (Silva, 20/10/2026): o nome à esquerda; à direita o campo do valor e, por baixo, uma breve descrição
// (com os limites: um valor não pode passar o outro); no fim, "Gravar". Campo vazio = o site usa o valor do servidor.
type DefPhp = { k: string; nome: string; ic: string; dica: string; ph?: string; opcoes?: string[] };
const DEFS_PHP: DefPhp[] = [
  { k: 'memory_limit', nome: 'Memória máxima', ic: 'fa-memory', ph: '256M', dica: 'Igual ou maior que (post_max_size). Ex.: 256M' },
  { k: 'upload_max_filesize', nome: 'Tamanho máximo de ficheiro enviado', ic: 'fa-file-arrow-up', ph: '64M', dica: 'Não pode ser maior que (post_max_size). Ex.: 64M' },
  { k: 'post_max_size', nome: 'Tamanho máximo de um envio', ic: 'fa-cloud-arrow-up', ph: '64M', dica: 'Não pode passar a memória (upload_max_filesize). Ex.: 64M' },
  { k: 'max_execution_time', nome: 'Tempo máximo de execução', ic: 'fa-stopwatch', ph: '300', dica: 'Segundos que um script pode correr (0 = sem limite. Ex.: 300)' },
  { k: 'max_input_time', nome: 'Tempo máximo para receber dados', ic: 'fa-hourglass-half', ph: '300', dica: 'Segundos para receber -1 = usa o tempo máximo de execução. Ex.: 300' },
  { k: 'max_input_vars', nome: 'Máximo de campos por envio', ic: 'fa-list-ol', ph: '3000', dica: 'Número máximo de campos num formulário. Ex.: 3000' },
  { k: 'display_errors', nome: 'Mostrar erros na página', ic: 'fa-triangle-exclamation', opcoes: ['On', 'Off'], dica: 'Num site público deixe Off: os erros ficam só no registo do servidor.' },
  { k: 'error_reporting', nome: 'Erros a registar', ic: 'fa-bug', ph: 'E_ALL & ~E_NOTICE', dica: 'Que tipos de erro o PHP regista. Ex.: E_ALL & ~E_NOTICE' },
  { k: 'date.timezone', nome: 'Fuso horário', ic: 'fa-clock', ph: 'Africa/Maputo', dica: 'Fuso horário usado pelas datas do site. Ex.: Africa/Maputo' },
  { k: 'allow_url_fopen', nome: 'Abrir endereços como ficheiros', ic: 'fa-link', opcoes: ['On', 'Off'], dica: 'Normalmente On.' },
  { k: 'short_open_tag', nome: 'Etiqueta curta <?', ic: 'fa-code', opcoes: ['On', 'Off'], dica: 'Normalmente Off.' },
  { k: 'session.gc_maxlifetime', nome: 'Duração da sessão', ic: 'fa-user-clock', ph: '1440', dica: 'Segundos até uma sessão parada ser apagada. Ex.: 1440' },
];
const NUMERICAS_PHP = ['max_execution_time', 'max_input_time', 'max_input_vars', 'session.gc_maxlifetime'];
/** "256M" → bytes; "-1" (sem limite) → Infinity; texto que não é um tamanho → null */
const bytesPhp = (v: string): number | null => {
  const m = /^\s*(-?\d+)\s*([KMG])?B?\s*$/i.exec(v);
  if (!m) return null;
  if (Number(m[1]) < 0) return Infinity;
  return Number(m[1]) * ({ K: 1024, M: 1048576, G: 1073741824 } as Record<string, number>)[(m[2] || '').toUpperCase()] || Number(m[1]);
};
function Php() {
  const vh = useVH();
  const { s, t } = vh;
  const x = dominioAtual(vh);
  const { det, erro, ler } = useDetalhe(x?.name || '');
  const [vals, setVals] = useState<Record<string, string>>({});
  // a lista de versões volta a ler-se do servidor ao abrir a página e quando se abre o campo (para aparecerem as que forem
  // instaladas depois); a versão activa do site não muda com isto (Silva, 20/10/2026)
  const ultimaLista = useRef(Date.now());
  useEffect(() => {
    void vh.recarregar(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // os campos seguem o que está gravado no site (e voltam a ler-se depois de gravar)
  const gravado = JSON.stringify(det?.php || []);
  useEffect(() => {
    const o: Record<string, string> = {};
    for (const r of (JSON.parse(gravado) as { k: string; v: string }[]) || []) o[r.k] = r.v;
    setVals(o);
  }, [gravado]);
  if (!x) return <SemDominio />;
  if (!det) return <Carregar erro={erro} ler={ler} />;
  // a versão em uso: a do site, ou — nos sites no modelo "padrão" — a que o servidor usa por defeito
  const noPadrao = x.php === 'padrão';
  // sem a versão padrão lida do servidor, fica sempre a 8.3 (a que o servidor tem) — nunca "padrão" solto no campo (Silva, 21/10/2026)
  const ativa = noPadrao ? det.phpPadrao || '8.3' : x.php;
  // só a versão padrão do servidor e as mais recentes (as anteriores já não recebem correcções de segurança); a versão em uso do site
  // aparece sempre, mesmo que seja antiga (Silva, 21/10/2026)
  const numVer = (v: string) => v.split('.').reduce((n, x) => n * 100 + Number(x), 0);
  const base = numVer(det.phpPadrao || '8.3');
  const versoes = [...new Set([...s.php.filter((v) => numVer(v) >= base), ...(/^\d+\.\d+$/.test(ativa) ? [ativa] : [])])].sort((a, b) => numVer(a) - numVer(b));
  const conhecidas = DEFS_PHP.map((d) => d.k);
  const outras = det.php.filter((r) => !conhecidas.includes(r.k));
  const gravar = async () => {
    const v = (k: string) => (vals[k] || '').trim();
    for (const d of DEFS_PHP) {
      if (!v(d.k)) continue;
      if (/[;\n]/.test(v(d.k))) return vh.toast(t(d.nome) + ': não use ";" nem várias linhas');
      if (NUMERICAS_PHP.includes(d.k) && !/^-?\d+$/.test(v(d.k))) return vh.toast(t(d.nome) + ': escreva um número (ex.: ' + d.ph + ')');
      if (['memory_limit', 'upload_max_filesize', 'post_max_size'].includes(d.k) && bytesPhp(v(d.k)) === null) return vh.toast(t(d.nome) + ': escreva um tamanho (ex.: ' + d.ph + ')');
      if (d.k === 'date.timezone' && !/^[A-Za-z_]+(\/[A-Za-z_+-]+)*$/.test(v(d.k))) return vh.toast(t(d.nome) + ': escreva um fuso (ex.: Africa/Maputo)');
    }
    // um valor não pode passar o outro: ficheiro enviado ≤ envio ≤ memória
    const [up, post, mem] = ['upload_max_filesize', 'post_max_size', 'memory_limit'].map((k) => (v(k) ? bytesPhp(v(k)) : null));
    if (up !== null && post !== null && up > post) return vh.toast('upload_max_filesize não pode ser maior que post_max_size');
    if (post !== null && mem !== null && post > mem) return vh.toast('post_max_size não pode ser maior que memory_limit');
    if (up !== null && mem !== null && up > mem) return vh.toast('upload_max_filesize não pode ser maior que memory_limit');
    const regras = [...outras, ...DEFS_PHP.filter((d) => v(d.k)).map((d) => ({ k: d.k, v: v(d.k) }))];
    (await noServidor(vh, { acao: 'php-ini', dominio: x.name, regras }, 'Definições PHP gravadas')) && ler();
  };
  return (
    <>
      {/* a indicação do domínio à esquerda e o "Gravar" à direita, na linha de cima do cartão (Silva, 20/10/2026) */}
      <NoTopoCartao daPagina modelo={{ titulo: t(tituloDoCartao('Definições PHP')), sub: t('Use a versão mais recente do PHP para acelerar o seu site') }}>
        <button className="btn r" onClick={gravar}>
          <i className="fa-solid fa-floppy-disk" />
          {t('Gravar alterações')}
        </button>
      </NoTopoCartao>
      <SeparadoresPhp on="definicoes" />
      <Frm className="php-versao" title="Versão PHP" desc="A versão usada por todos os sites desta conta">
        <Row label="Versão">
          <div className="igrp php-campo">
            <span className="ib" style={{ cursor: 'default' }}>
              <i className="fa-brands fa-php" />
            </span>
            <select
              value={ativa}
              onFocus={() => {
                if (Date.now() - ultimaLista.current > 20_000) {
                  ultimaLista.current = Date.now();
                  void vh.recarregar(true);
                }
              }}
              onChange={async (e) => noServidor(vh, { acao: 'php-versao-conta', dominio: x.name, versao: e.target.value }, 'PHP ' + e.target.value + ' em todos os sites da conta')}
            >
              {!/^\d+\.\d+$/.test(ativa) && <option value={ativa}>{t('Padrão do servidor')}</option>}
              {versoes.map((p) => (
                <option key={p} value={p}>
                  PHP {p}
                  {noPadrao && p === ativa ? ' (' + t('padrão do servidor') + ')' : ''}
                </option>
              ))}
            </select>
          </div>
        </Row>
      </Frm>
      <Frm
        className="php-defs"
        title="Definições do PHP"
        desc="Só neste site (ficheiro .user.ini). Campo vazio: o site usa o valor do servidor."
        foot={
          <button className="btn r" onClick={gravar}>
            <i className="fa-solid fa-floppy-disk" />
            {t('Gravar alterações')}
          </button>
        }
      >
        {DEFS_PHP.map((d) => (
          <Row key={d.k} label={d.nome} hint={d.k}>
            <div className="igrp php-campo">
              <span className="ib" style={{ cursor: 'default' }}>
                <i className={'fa-solid ' + d.ic} />
              </span>
              {d.opcoes ? (
                <select value={vals[d.k] || ''} onChange={(e) => setVals({ ...vals, [d.k]: e.target.value })}>
                  <option value="">{t('Valor do servidor')}</option>
                  {d.opcoes.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              ) : (
                <input value={vals[d.k] || ''} placeholder={d.ph} onChange={(e) => setVals({ ...vals, [d.k]: e.target.value })} />
              )}
            </div>
          </Row>
        ))}
      </Frm>
      {outras.length > 0 && (
        <div className="note">
          {t('Outras definições deste site, que ficam como estão')}: {outras.map((r) => r.k + ' = ' + r.v).join(' · ')}
        </div>
      )}
    </>
  );
}
/** Os separadores em texto, por baixo da linha de cima do cartão, ao lado do botão: Definições | Extensões (Silva, 23/10/2026) */
function SeparadoresPhp({ on }: { on: 'definicoes' | 'extensoes' }) {
  const vh = useVH();
  return (
    <Tabs<'definicoes' | 'extensoes'>
      abaixo
      tabs={[
        ['definicoes', 'Definições'],
        ['extensoes', 'Extensões'],
      ]}
      on={on}
      onChange={(k) => vh.nav('/' + vh.s.level + '/php' + (k === 'extensoes' ? '/extensoes' : ''))}
    />
  );
}

type LeituraExt = { versao: string; dedicado: boolean; ativas: string[]; disponiveis: string[]; essenciais: string[]; admin?: boolean };

/** Definições PHP › Extensões, POR CONTA (Silva, 23/10/2026): as extensões do PHP da conta, por categorias, com uma caixa de seleção em cada uma —
 *  marcadas as ativas. Ao aplicar, a conta passa a ter um PHP só dela; as outras contas não mudam. */
function PhpExtensoes() {
  const vh = useVH();
  const { t, me } = vh;
  const cons = useContext(ConsultaPagina);
  const x = dominioAtual(vh);
  const { det, erro: erroDet, ler: lerDet } = useDetalhe(x?.name || '');
  const ativa = x ? (x.php === 'padrão' ? det?.phpPadrao || '8.3' : x.php) : '';
  const url = x && det && /^\d+\.\d+$/.test(ativa) ? '/api/vhost/php-extensoes?conta=' + encodeURIComponent(me) + '&d=' + encodeURIComponent(x.name) + '&versao=' + encodeURIComponent(ativa) : null;
  const { dados, erro, ler } = useGet<LeituraExt>(url);
  const [lido, setLido] = useState<LeituraExt | null>(null);
  /** o que a pessoa marcou (extensão → marcada); sem entrada, vale o estado da conta */
  const [marcas, setMarcas] = useState<Record<string, boolean>>({});
  const [aAplicar, setAAplicar] = useState(false);
  useEffect(() => {
    if (dados) setLido(dados);
  }, [dados]);
  // a pesquisa fica na linha dos separadores, como no DNS
  const ativarCons = cons?.ativar;
  useEffect(() => {
    if (!ativarCons) return;
    ativarCons('junto');
    return () => ativarCons(false);
  }, [ativarCons]);
  if (!x) return <SemDominio />;
  if (!det) return <Carregar erro={erroDet} ler={lerDet} />;
  if (!lido) return <Carregar erro={erro} ler={ler} />;
  const admin = !!lido.admin;
  const estados = Object.fromEntries(EXTENSOES_PHP.map((e) => [e.k, estadoExtensao(e, lido.ativas, lido.disponiveis)])) as Record<string, EstadoExtensao>;
  const marcada = (e: ExtensaoPhp) => marcas[e.k] ?? estados[e.k] === 'ativa';
  /** o que se pode mudar: nunca as essenciais nem as do próprio PHP; as que faltam instalar só o administrador */
  const mudavel = (e: ExtensaoPhp) => !e.essencial && !!e.pkg && (estados[e.k] !== 'nao-instalada' || (admin && e.pkg !== 'common'));
  const alteradas = EXTENSOES_PHP.filter((e) => mudavel(e) && marcada(e) !== (estados[e.k] === 'ativa'));
  const q = (cons?.q || '').trim().toLowerCase();
  const chamar = async (corpo: Record<string, unknown>) => {
    const r = await fetch('/api/vhost/php-extensoes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conta: me, dominio: x.name, versao: lido.versao, ...corpo }) });
    const j = (await r.json().catch(() => ({}))) as Partial<LeituraExt> & { erro?: string };
    if (!r.ok) throw new Error(j.erro || 'O servidor não conseguiu fazer a alteração.');
    return j;
  };
  const aplicar = () =>
    vh.openM(
      <Confirmar
        titulo="Aplicar as alterações às extensões?"
        texto={
          'PHP ' + lido.versao + ' desta conta — só os sites desta conta mudam. ' +
          alteradas.map((e) => (marcada(e) ? (estados[e.k] === 'nao-instalada' ? 'Instalar e ativar ' : 'Ativar ') : 'Desativar ') + e.nome).join(' · ') + '.'
        }
        ok="Aplicar"
        onOk={async () => {
          setAAplicar(true);
          try {
            vh.toast(t('A aplicar no servidor…'));
            // as que faltam instalar (só o administrador) instalam-se primeiro; depois a conta recebe a lista completa
            for (const e of alteradas.filter((e) => marcada(e) && estados[e.k] === 'nao-instalada')) await chamar({ acao: 'instalar', ext: e.k });
            const catalogo = EXTENSOES_PHP.map((e) => e.k);
            const modulos = [...lido.ativas.filter((m) => !catalogo.includes(m)), ...EXTENSOES_PHP.filter((e) => e.pkg && marcada(e)).map((e) => e.k)];
            const j = await chamar({ acao: 'aplicar', modulos });
            setLido({ ...lido, ...(j as Partial<LeituraExt>) });
            setMarcas({});
            vh.toast('Extensões atualizadas');
          } catch (e) {
            vh.toast(e instanceof Error ? e.message : 'O servidor não conseguiu fazer a alteração.');
          } finally {
            setAAplicar(false);
          }
        }}
      />,
    );
  const repor = () =>
    vh.openM(
      <Confirmar
        titulo="Voltar às extensões do servidor?"
        texto="Esta conta deixa de ter extensões próprias e volta ao PHP comum do servidor."
        ok="Voltar"
        onOk={async () => {
          try {
            const j = await reporEEstado();
            setLido({ ...lido, ...(j as Partial<LeituraExt>) });
            setMarcas({});
            vh.toast('Extensões do servidor repostas');
          } catch (e) {
            vh.toast(e instanceof Error ? e.message : 'O servidor não conseguiu fazer a alteração.');
          }
        }}
      />,
    );
  async function reporEEstado() {
    const r = await fetch('/api/vhost/php-extensoes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'repor', conta: me, dominio: x!.name }) });
    if (!r.ok) throw new Error(((await r.json().catch(() => ({}))) as { erro?: string }).erro || 'O servidor não conseguiu fazer a alteração.');
    const e = await fetch('/api/vhost/php-extensoes?conta=' + encodeURIComponent(me) + '&d=' + encodeURIComponent(x!.name) + '&versao=' + encodeURIComponent(lido!.versao), { cache: 'no-store' });
    return (await e.json()) as LeituraExt;
  }
  const botaoAplicar = (
    <button className="btn r" disabled={!alteradas.length || aAplicar} onClick={aplicar}>
      <i className="fa-solid fa-floppy-disk" />
      {t('Aplicar alterações')}
    </button>
  );
  return (
    <>
      <NoTopoCartao daPagina modelo={{ titulo: t(tituloDoCartao('Extensões PHP')), sub: t('As extensões do PHP ' + lido.versao + ' desta conta: marque as que os seus sites precisam') }}>
        {botaoAplicar}
      </NoTopoCartao>
      <SeparadoresPhp on="extensoes" />
      {CATEGORIAS_PHP.map((cat) => {
        const todas = EXTENSOES_PHP.filter((e) => e.cat === cat);
        const vistas = todas.filter((e) => !q || (e.nome + ' ' + e.k + ' ' + e.desc).toLowerCase().includes(q));
        if (!vistas.length) return null;
        const ativas = todas.filter((e) => estados[e.k] === 'ativa').length;
        return (
          <Frm key={cat} className="php-ext" title={cat} right={<span className="tag off">{ativas + ' / ' + todas.length + ' ' + t('ativas')}</span>}>
            <div className="ext-grade">
              {vistas.map((e) => (
                <Check
                  key={e.k}
                  checked={marcada(e)}
                  disabled={!mudavel(e)}
                  onChange={(v) => setMarcas({ ...marcas, [e.k]: v })}
                  label={e.nome}
                  title={e.desc + ' (' + e.k + ')' + (estados[e.k] === 'nao-instalada' ? ' — ' + t(admin ? 'não instalada no servidor: ao aplicar, instala-se' : 'não instalada no servidor: peça ao suporte') : estados[e.k] === 'desativada' ? ' — ' + t('desativada') : '')}
                />
              ))}
            </div>
          </Frm>
        );
      })}
      <div className="acoes-topo ext-rodape">
        {lido.dedicado && (
          <button className="btn g" onClick={repor}>
            {t('Voltar às extensões do servidor')}
          </button>
        )}
        {botaoAplicar}
      </div>
      <p className="em-nota">{t('As extensões são só desta conta: o que mudar aqui não afecta os outros clientes. As essenciais ficam sempre ativas.')}</p>
    </>
  );
}
export const phpPagina: ScreenFn = (vh) => {
  const [sub] = vh.s.sub;
  if (sub === 'extensoes')
    return {
      title: 'Extensões PHP',
      dominios: 'sites',
      crumbs: [{ t: 'Definições PHP', path: '/' + vh.s.level + '/php' }, { t: 'Extensões' }],
      body: <PhpExtensoes />,
    };
  return { title: 'Definições PHP', dominios: 'sites', body: <Php /> };
};
