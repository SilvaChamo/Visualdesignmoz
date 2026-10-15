'use client';

// Gestão de domínios (painel Utilizador): domínios, subdomínios, DNS, SSL/TLS, FTP, bases de dados, apontadores,
// redirecionamentos, proteção hotlink e definições PHP. Campos copiados do DirectAdmin (ver
// VisualHost/05-da-gestao-de-dominios.md); dados e alterações reais no servidor (Hestia + Cloudflare) por
// /api/vhost/dominio. As páginas de um só domínio usam o domínio escolhido no seletor da faixa de navegação.
import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { useVH, type VH } from '../context';
import type { ScreenFn } from '../screens';
import type { BaseDados, Domain } from '../types';
import { pacoteDe } from '../state';
import { getPhpMyAdminUrl } from '@/lib/server-config';
import { VISUALDESIGN_DEFAULT_NS } from '@/lib/visualdesign-dns';
import { Check, DataTable, Frm, novaSenha, Row, Senha, Switch, Tabs, type Col } from './componentes';
import { Confirmar } from './pacotes';
import DomainSearch from '@/components/DomainSearchPainel';
import { useGet } from '../carga';
import { BotaoPassar } from './passar';
import { TransferirDominio } from './transferir-dominio';

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
  dns: { fonte: 'hestia' | 'cloudflare' | 'nenhuma'; zona: string; registos: { id: string; nome: string; tipo: string; valor: string; ttl: number; prio?: string }[] };
  php: { k: string; v: string }[];
  htaccess: string[];
  /** nameservers reais do domínio (DNS público) */
  ns?: string[];
};
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

/** Faz uma alteração ao domínio no servidor; depois volta a ler os dados (`recarregar`: a conta toda; os registos
 *  de DNS não a mudam). Devolve true se correu bem. */
async function noServidor(vh: VH, corpo: Record<string, unknown>, ok: string, recarregar = true): Promise<boolean> {
  vh.toast('A alterar no servidor…');
  try {
    const r = await fetch('/api/vhost/dominio', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conta: vh.me, ...corpo }) });
    const j = (await r.json().catch(() => ({}))) as { erro?: string };
    if (!r.ok) {
      vh.toast(j.erro || 'A alteração falhou');
      return false;
    }
    if (recarregar) await vh.recarregar(true);
    vh.toast(ok);
    return true;
  } catch {
    vh.toast('Sem ligação ao site. Nada foi alterado.');
    return false;
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
  const lista = vh.a.domains.filter((x) => !soSite || !x.soEmail); // o primeiro é o principal da conta
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

// ---------- Domínios ----------
type LinhaDom = Domain & { subs: number };

// Tudo o que é sobre domínios fica num só menu, "Domínios", com separadores (pedido do Silva, 13/10/2026):
// Domínios | Subdomínios | Registar domínio | Transferir domínio (a transferência vem do painel antigo da VisualDesign)
type AbaDom = 'meus' | 'subdominios' | 'registar' | 'transferir';
const ROTA_ABA: Record<AbaDom, string> = { meus: '', subdominios: '/subdominios', registar: '/registar', transferir: '/transferir' };

function ListaDominios({ abaDom = 'meus' }: { abaDom?: AbaDom }) {
  const vh = useVH();
  const { a, t, nav, openM, setDominio } = vh;
  const sites = a.domains;
  const rows: LinhaDom[] = sites.filter((x) => !sites.some((y) => y !== x && ehSub(x.name, y.name))).map((x) => ({ ...x, subs: sites.filter((y) => ehSub(y.name, x.name)).length }));
  const cols: Col<LinhaDom>[] = [
    {
      k: 'nome',
      t: 'Domínio',
      sort: (r) => r.name,
      cell: (r) => (
        <div className="cell">
          <div className={'ic ' + (r.soEmail ? 'c2' : r.wp ? 'c6' : 'c3')}>
            <i className={r.soEmail ? 'fa-solid fa-envelope' : r.wp ? 'fa-brands fa-wordpress' : 'fa-solid fa-globe'} />
          </div>
          <div>
            <a className="lk lk-dom" style={{ display: 'block' }} onClick={() => nav('/' + vh.s.level + '/dominios/' + encodeURIComponent(r.name))}>
              {r.name}
            </a>
            <span>{r.soEmail ? t('Só e-mail') : r.wp ? 'WordPress' : t('Site')}</span>
          </div>
        </div>
      ),
    },
    { k: 'bw', t: 'Tráfego', cell: (r) => r.bw || '—' },
    { k: 'disco', t: 'Espaço em disco', cell: (r) => r.disk },
    { k: 'subs', t: 'Subdomínios', sort: (r) => r.subs, cell: (r) => r.subs },
    { k: 'ssl', t: 'SSL', cell: (r) => (r.soEmail ? '—' : <span className={'tag ' + (r.ssl === 'ok' ? 'ok' : 'w')}>{r.ssl === 'ok' ? t('Seguro') : t('Sem SSL')}</span>) },
    { k: 'php', t: 'PHP', cell: (r) => (r.soEmail ? '—' : r.php), hidden: true },
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
        <div className="dom-registar">
          <DomainSearch isAdmin />
        </div>
      ) : abaDom === 'subdominios' ? (
        <Subdominios />
      ) : abaDom === 'transferir' ? (
        <TransferirDominio />
      ) : (
        <DataTable
          id="dominios"
          umaLinha
          barraFora
          rows={rows}
          cols={cols}
          rowKey={(r) => r.name}
          search={(r) => r.name}
          empty="Ainda não há domínios nesta conta"
          bulk={[
            { t: 'Suspender', fa: 'fa-pause', run: (k) => varios(k, 'dominio-suspender', 'Suspenso') },
            { t: 'Reativar', fa: 'fa-play', run: (k) => varios(k, 'dominio-reativar', 'Reativado') },
            {
              t: 'Apagar',
              fa: 'fa-trash',
              run: (k) =>
                openM(
                  <Confirmar
                    titulo="Apagar domínios?"
                    texto={'Vai apagar do servidor ' + k.join(', ') + ', com os ficheiros do site. As contas de e-mail do domínio ficam.'}
                    ok="Apagar"
                    onOk={() => varios(k, 'dominio-apagar', 'Apagado')}
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
              {!r.soEmail && <BotaoPassar dominio={r.name} />}
            </>
          )}
        />
      )}
    </>
  );
}

function NovoDominio() {
  const vh = useVH();
  const { t, nav } = vh;
  const [d, setD] = useState('');
  const [ssl, setSsl] = useState(true);
  const criar = async () => {
    const n = d.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
    if (!/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(n)) return vh.toast('Escreva um domínio válido (ex.: empresa.co.mz)');
    if (await noServidor(vh, { acao: 'dominio-criar', dominio: n, ssl }, 'Domínio ' + n + ' criado')) {
      vh.setDominio(n);
      nav('/' + vh.s.level + '/dominios/' + encodeURIComponent(n));
    } else await vh.recarregar(true); // um erro a meio pode ter deixado o domínio criado: a lista volta a ler o servidor
  };
  return (
    <Frm
      title="Criar domínio"
      desc="O site fica no servidor; o DNS do domínio tem de apontar para cá para o site abrir"
      foot={
        <>
          <button className="btn g" onClick={() => nav('/' + vh.s.level + '/dominios')}>
            {t('Cancelar')}
          </button>
          <button className="btn r" onClick={criar}>
            <i className="fa-solid fa-plus" />
            {t('Criar')}
          </button>
        </>
      }
    >
      <Row label="Domínio" hint="Sem maiúsculas, www ou http://">
        <input value={d} onChange={(e) => setD(e.target.value)} placeholder="ex.: empresa.co.mz" autoFocus />
      </Row>
      <Row label="SSL seguro" hint="Certificado grátis Let's Encrypt, pedido logo a seguir">
        <Check checked={ssl} onChange={setSsl} label="Pedir certificado SSL automático" />
      </Row>
    </Frm>
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
        <input value={novo} onChange={(e) => setNovo(e.target.value)} placeholder="ex.: novodominio.co.mz" autoFocus />
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
  const [info, setInfo] = useState<InfoRegisto | null>(null);
  const [erro, setErro] = useState('');
  const [renovacao, setRenovacao] = useState<string | null>(null);
  useEffect(() => {
    let fim = false;
    setInfo(null);
    setErro('');
    setRenovacao(null);
    if (!d) return;
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
      .catch(() => !fim && setErro('Sem ligação ao site. Tente de novo.'));
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
  const ehVd = (l: string[]) => l.length >= 2 && l.every((n) => vd.includes(n.toLowerCase().replace(/\.$/, '')));
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
                <i className={aGuardar ? 'fa-solid fa-spinner fa-spin' : 'fa-solid fa-check'} />
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
                <i className={aPedir === 'epp' ? 'fa-solid fa-spinner fa-spin' : 'fa-solid fa-key'} />
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
                  <i className={aPedir === 'contactos' ? 'fa-solid fa-spinner fa-spin' : 'fa-solid fa-address-card'} />
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

  const ir = (p: string) => nav('/utilizador/' + p);
  const nSubs = a.domains.filter((y) => ehSub(y.name, d)).length;
  const info: [string, ReactNode, string?][] = [
    [
      'Estado',
      <>
        <span className={'tag ' + (x.status === 'ok' ? 'ok' : 'off')}>{x.status === 'ok' ? t('Ativo') : t('Suspenso')}</span>
        {x.soEmail && <span className="tag off">{t('Só e-mail')}</span>}
        {x.wp && <span className="tag ok">WordPress</span>}
      </>,
    ],
    ['Espaço em disco', x.disk],
    ...(x.soEmail
      ? []
      : ([
          ['Tráfego', x.bw || '—'],
          [
            'Certificado SSL',
            det?.certificado ? (
              <>
                {det.certificado.emissor ? emissorCurto(det.certificado.emissor) : t('Certificado')} · {t('válido até')} {dataLegivel(det.certificado.ate)}
              </>
            ) : det ? (
              <span className="tag w">{t('Sem certificado')}</span>
            ) : (
              <span className="dom-a-ler">…</span>
            ),
            'ssl',
          ],
          ['Versão PHP', 'PHP ' + x.php, 'php'],
          ['DNS', det ? (det.dns.fonte === 'cloudflare' ? 'Cloudflare' : det.dns.fonte === 'hestia' ? t('Neste servidor') : t('Fora da Visual Design')) : <span className="dom-a-ler">…</span>, 'dns'],
          ['Subdomínios', String(nSubs), 'dominios/subdominios'],
          ['Apontadores', String((x.aliases || []).length), 'apontadores'],
          ['Contas FTP', String((x.ftp || []).length), 'ftp'],
          ['Redirecionamento', det ? (det.redirecionamento ? det.redirecionamento.url : t('Nenhum')) : <span className="dom-a-ler">…</span>, 'redirecionamentos'],
          ['Proteção hotlink', t('Configurar'), 'hotlink'],
          ['Pasta do site', <code key="p">{x.docroot}</code>],
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
            <div key={rot} className={'dom-info-l' + (p ? ' lk' : '')} onClick={p ? () => ir(p) : undefined}>
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
            <button key={id} className="dom-op" onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>
              <i className={'fa-solid ' + fa} />
              {t(rot)}
            </button>
          ))}
        <h4>{t('Ações')}</h4>
        {reg.renovacao ? (
          <a className="dom-op" href={'/renovacao/iniciar/domain/' + reg.renovacao}>
            <i className="fa-solid fa-rotate-right" />
            {t('Renovar domínio')}
          </a>
        ) : (
          <button className="dom-op" disabled title={t('Renova-se no registador onde o domínio está')}>
            <i className="fa-solid fa-rotate-right" />
            {t('Renovar domínio')}
          </button>
        )}
        <button className="dom-op" onClick={() => nav('/' + vh.s.level + '/dominios/registar')}>
          <i className="fa-solid fa-globe" />
          {t('Registar novo domínio')}
        </button>
        <button className="dom-op" onClick={() => nav('/' + vh.s.level + '/dominios/transferir')}>
          <i className="fa-solid fa-share" />
          {t('Transferir um domínio')}
        </button>
        <h4>{t('Alojamento')}</h4>
        {!x.soEmail && (
          <a className="dom-op" href={'https://' + d} target="_blank" rel="noreferrer">
            <i className="fa-solid fa-arrow-up-right-from-square" />
            {t('Abrir o site')}
          </a>
        )}
        {!x.soEmail && (
          <button
            className="dom-op"
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
        {!x.soEmail && (
          <button className="dom-op" onClick={() => openM(<MudarNomeModal d={d} />)}>
            <i className="fa-solid fa-i-cursor" />
            {t('Mudar nome')}
          </button>
        )}
        {!x.soEmail && <BotaoPassar dominio={d} etiqueta />}
        <button
          className="dom-op"
          onClick={() => noServidor(vh, { acao: x.status === 'ok' ? 'dominio-suspender' : 'dominio-reativar', dominio: d }, x.status === 'ok' ? 'Domínio suspenso' : 'Domínio reativado')}
        >
          <i className={'fa-solid ' + (x.status === 'ok' ? 'fa-pause' : 'fa-play')} />
          {t(x.status === 'ok' ? 'Suspender' : 'Reativar')}
        </button>
        <button
          className="dom-op"
          onClick={() =>
            openM(
              <Confirmar
                titulo="Apagar domínio?"
                texto={'Vai apagar ' + d + ' do servidor, com os ficheiros do site. Não se pode desfazer.'}
                ok="Apagar"
                onOk={async () => (await noServidor(vh, { acao: 'dominio-apagar', dominio: d }, 'Domínio apagado')) && nav('/' + vh.s.level + '/dominios')}
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
  const novoBtn = (
    <button className="btn r" onClick={() => vh.nav('/' + vh.s.level + '/dominios/novo')}>
      <i className="fa-solid fa-plus" />
      {vh.t('Adicionar domínio')}
    </button>
  );
  // no separador Subdomínios o botão da barra de cima é o do subdomínio (o Silva clicava no "Adicionar domínio", o único
  // à vista, e a página saltava para Adicionar domínio)
  const novoSub = (
    <button className="btn r" onClick={() => vh.openM(<NovoSubdominio d={principalAtual(vh)?.name || ''} />)}>
      <i className="fa-solid fa-plus" />
      {vh.t('Adicionar subdomínio')}
    </button>
  );
  const base = { t: 'Domínios', path: '/' + vh.s.level + '/dominios' };
  if (sub === 'registar') return { title: 'Domínios', actions: novoBtn, crumbs: [base, { t: 'Registar domínio' }], body: <ListaDominios abaDom="registar" /> };
  if (sub === 'subdominios') return { title: 'Domínios', actions: novoSub, dominios: 'sites', crumbs: [base, { t: 'Subdomínios' }], body: <ListaDominios abaDom="subdominios" /> };
  if (sub === 'transferir') return { title: 'Domínios', actions: novoBtn, crumbs: [base, { t: 'Transferir domínio' }], body: <ListaDominios abaDom="transferir" /> };
  if (sub === 'novo') return { title: 'Adicionar domínio', crumbs: [{ t: 'Domínios', path: '/' + vh.s.level + '/dominios' }, { t: 'Adicionar domínio' }], body: <NovoDominio /> };
  if (sub) return { title: sub, desc: 'Resumo e atalhos do domínio', crumbs: [{ t: 'Domínios', path: '/' + vh.s.level + '/dominios' }, { t: sub }], dominioUrl: { d: sub, ir: (n) => '/' + vh.s.level + '/dominios/' + n }, body: <VerDominio d={sub} /> };
  return { title: 'Domínios', actions: novoBtn, body: <ListaDominios /> };
};

// ---------- Subdomínios (separador dos Domínios) ----------
/** Adicionar subdomínio (pedido do Silva, 13/10/2026): nome + domínio e os dois endereços com caixa de escolha —
 *  à frente (loja.dominio.com: subdomínio com pasta própria, em separado) e/ou atrás (dominio.com/loja: pasta no site
 *  principal). Com os dois, o mesmo conteúdo abre nos dois endereços. */
function NovoSubdominio({ d }: { d: string }) {
  const vh = useVH();
  const { a, t, closeM } = vh;
  const principais = a.domains.filter((x) => !x.soEmail && !a.domains.some((y) => y !== x && ehSub(x.name, y.name)));
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
      if (!(await noServidor(vh, { acao: 'subdominio-criar', dominio: dom, sub: n, ssl: true, pasta: atras }, 'Subdomínio ' + n + '.' + dom + ' criado'))) await vh.recarregar(true);
    } else await noServidor(vh, { acao: 'subpasta-criar', dominio: dom, sub: n }, 'Endereço ' + dom + '/' + n + ' criado');
  };
  return (
    <>
      <h3>{t('Adicionar subdomínio')}</h3>
      <div className="f">
        <label>{t('Subdomínio')}</label>
        <span className="igrp sub-dom">
          <input value={sub} onChange={(e) => setSub(e.target.value)} placeholder="ex.: loja" autoFocus onKeyDown={(e) => e.key === 'Enter' && criar()} />
          <span className="ib" style={{ cursor: 'default' }}>
            .
          </span>
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

function Subdominios() {
  const vh = useVH();
  const { a, t, openM } = vh;
  const x = principalAtual(vh);
  if (!x) return <SemDominio />;
  const rows = a.domains.filter((y) => ehSub(y.name, x.name));
  return (
    <DataTable
      id="subdominios"
      umaLinha
      barraFora
      rows={rows}
      rowKey={(r) => r.name}
      search={(r) => r.name}
      empty={t('Este domínio ainda não tem subdomínios') + ' (' + x.name + ')'}
      cols={[
        { k: 'nome', t: 'Subdomínio', sort: (r) => r.name, cell: (r) => <b>{r.name}</b> },
        { k: 'bw', t: 'Tráfego', cell: (r) => r.bw || '—' },
        { k: 'raiz', t: 'Pasta', cell: (r) => <code>{r.docroot}</code> },
        { k: 'ssl', t: 'SSL', cell: (r) => <span className={'tag ' + (r.ssl === 'ok' ? 'ok' : 'w')}>{r.ssl === 'ok' ? t('Seguro') : t('Sem SSL')}</span> },
      ]}
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
                onOk={() => k.reduce<Promise<unknown>>((p, n) => p.then(() => noServidor(vh, { acao: 'dominio-apagar', dominio: n }, 'Apagado: ' + n)), Promise.resolve())}
              />,
            ),
        },
      ]}
    />
  );
}

// ---------- DNS (organização do modelo DNS central do painel da VisualDesign; adicionar/editar em janela) ----------
const TIPOS_DNS = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV', 'CAA'];
const NA_CLOUDFLARE = ['A', 'AAAA', 'CNAME', 'MX', 'TXT'];
const NS_PUBLICO = 'ns-publico-';
type RegistoDns = Detalhe['dns']['registos'][number];

/** Janela de adicionar / editar um registo (os mesmos campos do DirectAdmin) */
function DnsForm({ d, fonte, r, onFeito }: { d: string; fonte: Detalhe['dns']['fonte']; r?: RegistoDns; onFeito: () => void }) {
  const vh = useVH();
  const { t, closeM } = vh;
  const [f, setF] = useState({ tipo: r?.tipo || 'A', nome: r?.nome || '', ttl: String(r ? (r.ttl === 1 ? 3600 : r.ttl) : 3600), valor: r?.valor || '', prio: r?.prio || '10' });
  const [txtLinhas, setTxtLinhas] = useState<string[]>(r?.tipo === 'TXT' ? [r.valor] : ['']);
  const tipos = TIPOS_DNS.filter((tp) => fonte === 'hestia' || NA_CLOUDFLARE.includes(tp));

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
      if (okCount > 0) onFeito();
      return;
    }

    const valorFinal = f.tipo === 'TXT' ? (txtLinhas[0] || f.valor) : f.valor;
    if (!valorFinal.trim()) return vh.toast(t('Escreva o valor do registo'));
    closeM();
    if (await noServidor(vh, { acao: r ? 'dns-editar' : 'dns-criar', dominio: d, ...(r ? { id: r.id } : {}), ...f, valor: valorFinal }, r ? t('Registo alterado') : t('Registo ') + f.tipo + t(' adicionado'), false)) onFeito();
  };
  return (
    <>
      <h3>{t(r ? 'Editar registo' : 'Adicionar registo')}</h3>
      <div className="f">
        <label>{t('Tipo')}</label>
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
      </div>
      <div className="f">
        <label>{t('Nome')}</label>
        <input value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} placeholder={'@ = ' + d} />
      </div>
      <div className="f">
        <label>TTL ({t('segundos')})</label>
        <input value={f.ttl} onChange={(e) => setF({ ...f, ttl: e.target.value })} inputMode="numeric" />
      </div>
      {(f.tipo === 'MX' || f.tipo === 'SRV') && (
        <div className="f">
          <label>{t('Prioridade')}</label>
          <input value={f.prio} onChange={(e) => setF({ ...f, prio: e.target.value })} inputMode="numeric" />
        </div>
      )}
      {f.tipo === 'TXT' ? (
        <div className="f">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <label style={{ margin: 0 }}>{t('Valor TXT')}</label>
            {!r && (
              <button
                type="button"
                className="btn g sm"
                style={{ fontSize: 12, padding: '2px 8px', height: 'auto' }}
                onClick={() => setTxtLinhas([...txtLinhas, ''])}
              >
                <i className="fa-solid fa-plus" style={{ marginRight: 4 }} />
                {t('Adicionar outro campo TXT')}
              </button>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {txtLinhas.map((linha, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
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
                  style={{ width: '100%', minHeight: 68, fontFamily: 'monospace', fontSize: 13, wordBreak: 'break-all' }}
                  autoFocus={idx === 0}
                />
                {!r && txtLinhas.length > 1 && (
                  <button
                    type="button"
                    className="btn g sm"
                    style={{ padding: '6px 8px', color: 'var(--red)', marginTop: 2 }}
                    title={t('Remover este campo')}
                    onClick={() => setTxtLinhas(txtLinhas.filter((_, i) => i !== idx))}
                  >
                    <i className="fa-solid fa-trash-can" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="f">
          <label>{t(f.tipo === 'MX' ? 'Destino' : 'Valor')}</label>
          <input value={f.valor} onChange={(e) => setF({ ...f, valor: e.target.value })} placeholder={f.tipo === 'A' ? 'ex.: 169.58.148.144' : f.tipo === 'MX' ? 'ex.: mail.' + d : ''} autoFocus />
        </div>
      )}
      <div className="mfoot">
        <button className="btn g" onClick={closeM}>
          {t('Cancelar')}
        </button>
        <button className="btn r" onClick={guardar}>
          {t(r ? 'Guardar' : 'Adicionar')}
        </button>
      </div>
    </>
  );
}

const valorDns = (r: RegistoDns) => (r.tipo === 'MX' ? `Prioridade: ${r.prio || '-'} / Destino: ${r.valor || '-'}` : r.valor);

function Dns() {
  const vh = useVH();
  const { t, openM } = vh;
  const x = dominioAtual(vh, false);
  const { det, erro, ler } = useDetalhe(x?.name || '', 'dns');
  const [filtro, setFiltro] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [fEdit, setFEdit] = useState<{ nome: string; ttl: string; valor: string; prio: string }>({ nome: '', ttl: '3600', valor: '', prio: '10' });
  const [aGuardar, setAGuardar] = useState(false);

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
  const rows = [...dns.registos, ...nsPublicos].filter((r) => !filtro || r.tipo === filtro);
  const soLeitura = (r: RegistoDns) => r.id.startsWith(NS_PUBLICO);
  const editavel = (r: RegistoDns) => !soLeitura(r) && (dns.fonte === 'hestia' || NA_CLOUDFLARE.includes(r.tipo));

  const iniciarEdicao = (r: RegistoDns) => {
    setEditId(r.id);
    setFEdit({
      nome: r.nome,
      ttl: String(r.ttl === 1 ? 3600 : r.ttl),
      valor: r.valor,
      prio: r.prio || '10',
    });
  };

  const cancelarEdicao = () => {
    setEditId(null);
    setAGuardar(false);
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
    setAGuardar(false);
    if (ok) {
      setEditId(null);
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
        <Tabs<string>
          tabs={['', 'A', 'CNAME', 'MX', 'TXT', 'SRV', 'NS'].map((f) => [f || 'todos', f || 'Todos'] as [string, string])}
          on={filtro || 'todos'}
          onChange={(k) => setFiltro(k === 'todos' ? '' : k)}
        />
        <DataTable
          id="dns"
          rows={rows}
          rowKey={(r) => r.id}
          rowClass={(r) => (r.id === editId ? 'dns-row-editando' : '')}
          search={(r) => r.nome + ' ' + r.valor}
          onRecarregar={ler}
          umaLinha
          barraFora
          empilhar="botoes-em-baixo"
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
                return <b>{r.nome === '@' ? dns.zona : r.nome}</b>;
              },
            },
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
                return r.ttl === 1 ? 'auto' : r.ttl;
              },
            },
            { k: 'tipo', t: 'Tipo', sort: (r) => r.tipo, cell: (r) => <span className={'dns-tipo t-' + r.tipo}>{r.tipo}</span> },
            {
              k: 'valor',
              t: 'Registo',
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
                return <span style={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{valorDns(r)}</span>;
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
                    {t('Guardar')}
                  </button>
                  <button
                    className="btn sm g"
                    disabled={aGuardar}
                    onClick={cancelarEdicao}
                    title={t('Cancelar')}
                  >
                    <i className="fa-solid fa-xmark" />
                    {t('Cancelar')}
                  </button>
                </span>
              );
            }
            if (soLeitura(r))
              return (
                <span className="dns-acoes dns-so-leitura" title={t('Mudam-se na gestão do domínio, em "Servidores de nome"')}>
                  <button className="btn sm g" onClick={() => vh.nav('/' + vh.s.level + '/dominios/' + encodeURIComponent(x.name))}>
                    <i className="fa-solid fa-server" />
                    {t('Servidores de nome')}
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
                  {t('Editar')}
                </button>
                <button
                  className="btn sm btn-rm"
                  onClick={() => remover([r.id], 'Vai remover o registo ' + r.tipo + ' ' + (r.nome === '@' ? dns.zona : r.nome) + '.')}
                >
                  <i className="fa-solid fa-trash-can" />
                  {t('Remover')}
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
    <button className="btn r" onClick={() => vh.openM(<DnsForm d={x.name} fonte={det.dns.fonte} onFeito={ler} />)}>
      <i className="fa-solid fa-plus" />
      {vh.t('Adicionar registo')}
    </button>
  );
}
export const dnsPagina: ScreenFn = () => ({ title: 'DNS', actions: <NovoRegistoDns />, body: <Dns /> });

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

/** Emitir / substituir o certificado grátis de um domínio: os nomes seleccionados ficam num único certificado. */
function EmitirSslModal({ dom, onFeito }: { dom: Domain; onFeito: () => void }) {
  const vh = useVH();
  const { t, closeM } = vh;
  const aliases = dom.aliases || [];
  const [marcados, setMarcados] = useState<string[]>([]);
  const [incluirEmail, setIncluirEmail] = useState(true);
  const renovar = dom.ssl === 'ok' && dom.le;
  return (
    <>
      <h3>{t(renovar ? 'Renovar/substituir certificado grátis' : 'Emitir/substituir certificado grátis')}</h3>
      <p style={{ color: 'var(--muted)', fontSize: 12.5, marginBottom: 12, lineHeight: 1.5 }}>
        {t("O Hestia substitui o certificado actual do site ao emitir o novo; não precisa de o apagar. Só funciona com o DNS de cada nome seleccionado a apontar para este servidor — desmarque os que ainda não apontam.")}
      </p>
      <div style={{ marginBottom: 6 }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>{t('Nomes incluídos no certificado')}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Check checked onChange={() => {}} label={dom.name} muted />
          {aliases.map((n) => (
            <Check key={n} checked={marcados.includes(n)} onChange={(v) => setMarcados(v ? [...marcados, n] : marcados.filter((y) => y !== n))} label={n} />
          ))}
          {!aliases.length && <small style={{ color: 'var(--muted)' }}>{t('Este domínio não tem apontadores (ex.: www). O certificado fica só com o domínio.')}</small>}
        </div>
      </div>
      <div style={{ borderTop: '1px solid var(--line)', marginTop: 14, paddingTop: 12 }}>
        <Check
          checked={incluirEmail}
          onChange={setIncluirEmail}
          label="Também emitir/substituir SSL do e-mail e webmail configurado no servidor"
        />
        <small style={{ display: 'block', color: 'var(--muted)', margin: '6px 0 0 26px', lineHeight: 1.45 }}>
          {t('O Hestia substitui o certificado actual do serviço de e-mail/webmail. O DNS do mail e do endereço webmail configurado tem de apontar para este servidor.')}
        </small>
      </div>
      <div className="mfoot">
        <button className="btn g" onClick={closeM}>
          {t('Cancelar')}
        </button>
        <button
          className="btn r"
          onClick={async () => {
            closeM();
            if (!(await noServidor(vh, { acao: 'ssl-le', dominio: dom.name, nomes: marcados }, "Certificado SSL do site emitido/substituído para " + dom.name))) return;
            if (incluirEmail && !(await noServidor(vh, { acao: 'ssl-mail-le', dominio: dom.name }, "Certificado SSL de e-mail/webmail emitido/substituído para " + dom.name))) {
              onFeito();
              return;
            }
            onFeito();
          }}
        >
          <i className="fa-solid fa-lock" />
          {t(renovar ? 'Renovar/substituir' : 'Emitir/substituir')}
        </button>
      </div>
    </>
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

  if (!dados) {
    return (
      <div>
        {erro ? <Carregar erro={erro} ler={ler} /> : <p>{t('A carregar certificado do servidor…')}</p>}
        <button className="btn g sm" onClick={onVoltar}>{t('Voltar')}</button>
      </div>
    );
  }

  return <CertificateActualView d={d} dados={dados} onVoltar={onVoltar} t={t} toast={toast} />;
}

function CertificateActualView({
  d,
  dados,
  onVoltar,
  t,
  toast,
}: {
  d: string;
  dados: CertificadoServidor;
  onVoltar: () => void;
  t: (text: string) => string;
  toast: (message: string) => void;
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600, marginBottom: 4 }}>
            {t('SSL/TLS')} &gt; {t('View Certificate')} &gt; {d}
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)' }}>{t('View Certificate')}</h2>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn g" onClick={onVoltar}>
            <i className="fa-solid fa-arrow-left" />
            {t('Voltar')}
          </button>
          <button className="btn g" onClick={() => copiarText([certText, chainText].filter(Boolean).join('\n\n'), 'Todos os certificados')}>
            <i className="fa-solid fa-copy" />
            {t('Copy all certificates')}
          </button>
          <button className="btn r" onClick={() => baixarText([certText, chainText].filter(Boolean).join('\n\n'), `${d}-full-ssl.pem`)}>
            <i className="fa-solid fa-download" />
            {t('DOWNLOAD ALL CERTIFICATES')}
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20, padding: 20, borderRadius: 'var(--r)' }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>{t('Certificate')}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 20 }}>
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
              <small style={{ color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', fontSize: 11 }}>{t('Emissor')}</small>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{dados.emissor}</div>
            </div>
            <div>
              <small style={{ color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', fontSize: 11 }}>{t('Válido desde')}</small>
              <div style={{ fontSize: 13, color: 'var(--ink)' }}>{new Date(dados.desde).toLocaleString('pt-MZ')}</div>
            </div>
            <div>
              <small style={{ color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', fontSize: 11 }}>{t('Expira')}</small>
              <div style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 600 }}>{new Date(dados.ate).toLocaleString('pt-MZ')}</div>
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
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button className="btn g sm" onClick={() => copiarText(certText, 'Certificado')}>
            <i className="fa-solid fa-copy" /> {t('Copy')}
          </button>
          <button className="btn g sm" onClick={() => baixarText(certText, `${d}.crt`)}>
            <i className="fa-solid fa-download" /> {t('Download')}
          </button>
        </div>
      </div>

      {chainText && <div className="card" style={{ marginBottom: 20, padding: 20, borderRadius: 'var(--r)' }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{t('Certificate chain')}</h3>
        <p style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 16 }}>
          {t('Intermediate certificates, ordered from the one that signed the certificate up to (but not including) the root.')}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 20 }}>
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
          <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <small style={{ color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', fontSize: 11 }}>{t('Emissor')}</small>
              <div style={{ fontSize: 13, color: 'var(--ink)' }}>{dados.emissor}</div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button className="btn g sm" onClick={() => copiarText(chainText, 'Cadeia de certificados')}>
            <i className="fa-solid fa-copy" /> {t('Copy')}
          </button>
          <button className="btn g sm" onClick={() => baixarText(chainText, `${d}-ca.crt`)}>
            <i className="fa-solid fa-download" /> {t('Download')}
          </button>
        </div>
      </div>}
    </div>
  );
}

function Ssl({ tab, verCertDomain }: { tab: TabSsl; verCertDomain: string | null }) {
  const vh = useVH();
  const { a, t, setDominio, openM } = vh;
  const x = dominioAtual(vh);
  const { det, erro, ler } = useDetalhe(x?.name || '');
  const { dados: sslHistory, erro: sslHistoryError, ler: lerSslHistory } = useGet<HistoricoSsl>(
    x && tab === 'historico'
      ? `/api/vhost/dominio?conta=${encodeURIComponent(vh.me)}&d=${encodeURIComponent(x.name)}&historicoSsl=1`
      : null,
  );
  // separadores e "Ver certificado" ↔ endereço (/ssl/acme, /ssl/historico, /ssl/certificado/<domínio>), para o caminho no topo seguir o clique
  const setTab = (k: TabSsl) => vh.nav('/utilizador/ssl' + (k === 'gerir' ? '' : '/' + k));
  const setVerCertDomain = (d: string | null) => vh.nav('/utilizador/ssl' + (d ? '/certificado/' + encodeURIComponent(d) : ''));
  const [menuRow, setMenuRow] = useState<string | null>(null);
  // o menu "⋯" fica por cima de tudo (position: fixed), para a tabela (overflow) não o cortar na última linha;
  // abre para cima quando não há espaço por baixo
  const [menuPos, setMenuPos] = useState<{ top?: number; bottom?: number; right: number }>({ right: 0 });

  useEffect(() => {
    if (!menuRow) return;
    const close = (e: MouseEvent) => {
      const el = e.target as Element | null;
      if (!el?.closest('.ssl-pop-menu') && !el?.closest('.iconbtn')) setMenuRow(null);
    };
    const fechar = () => setMenuRow(null);
    document.addEventListener('mousedown', close);
    window.addEventListener('scroll', fechar, true);
    window.addEventListener('resize', fechar);
    return () => {
      document.removeEventListener('mousedown', close);
      window.removeEventListener('scroll', fechar, true);
      window.removeEventListener('resize', fechar);
    };
  }, [menuRow]);

  if (!x) return <SemDominio />;
  if (verCertDomain) return <ViewCertificateView d={verCertDomain} onVoltar={() => setVerCertDomain(null)} />;

  const sites = a.domains.filter((y) => !y.soEmail);
  const nomesCertificado = det?.certificado ? [det.certificado.para, ...det.certificado.nomes] : [];
  const certificadoCobreDominio = Boolean(det?.sslAtivo && certificadoCobreNome(nomesCertificado, x.name));
  const certificadoValido = Boolean(
    certificadoCobreDominio &&
      det?.certificado?.desde &&
      det.certificado.ate &&
      Date.parse(det.certificado.desde) <= Date.now() &&
      Date.parse(det.certificado.ate) > Date.now(),
  );

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
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>{t('Automatic certificate provisioning')}</h3>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '14px 18px',
                borderRadius: 'var(--r)',
                background: certificadoValido ? 'color-mix(in srgb, #10b981 10%, transparent)' : 'color-mix(in srgb, #f59e0b 10%, transparent)',
                border: `1px solid ${certificadoValido ? 'color-mix(in srgb, #10b981 30%, transparent)' : 'color-mix(in srgb, #f59e0b 30%, transparent)'}`,
                color: 'var(--ink)',
                fontSize: 13.5,
                fontWeight: 500,
              }}
            >
              <i
                className={'fa-solid ' + (certificadoValido ? 'fa-circle-check' : 'fa-circle-exclamation')}
                style={{ color: certificadoValido ? '#10b981' : '#f59e0b', fontSize: 18, flexShrink: 0 }}
              />
              <div>
                {!det
                  ? t('A ler o certificado activo no servidor…')
                  : certificadoValido
                    ? det.renovacaoAutomatica
                      ? t('O certificado cobre este domínio e a renovação automática do Hestia está activa.')
                      : t('O certificado cobre este domínio, mas a renovação automática do Hestia está desligada.')
                    : det.sslAtivo
                      ? t('Há um certificado instalado, mas não cobre este domínio ou já expirou.')
                      : t('Ainda não há certificado SSL instalado neste domínio.')}
              </div>
            </div>
          </div>

          {/* SECÇÃO 2: Card de Detalhes do Certificado do Domínio Selecionado */}
          <div style={{ marginBottom: 24 }}>
            <Frm
              title={'Certificado do domínio: ' + x.name}
              right={certificadoValido ? <span className="tag ok">{t('Seguro')}</span> : <span className="tag w">{t('Certificado inválido')}</span>}
              foot={
                <>
                  {det?.sslAtivo && (
                    <button className="btn g" onClick={() => cancelarSsl(vh, x.name, ler)}>
                      <i className="fa-solid fa-ban" />
                      {t('Cancelar certificado')}
                    </button>
                  )}
                  <button className="btn g" onClick={() => openM(<CertificadoModal d={x.name} onFeito={ler} />)}>
                    <i className="fa-solid fa-file-shield" />
                    {t('Instalar certificado próprio')}
                  </button>
                  <button className="btn r" onClick={() => openM(<EmitirSslModal dom={x} onFeito={ler} />)}>
                    <i className="fa-solid fa-lock" />
                    {t(det?.renovacaoAutomatica ? 'Renovar/substituir SSL' : 'Emitir/substituir SSL')}
                  </button>
                </>
              }
            >
              {!det ? (
                <div style={{ padding: '10px 18px' }}>
                  <Carregar erro={erro} ler={ler} />
                </div>
              ) : det.certificado ? (
                <>
                  <Row label="Emitido para">{det.certificado.para}</Row>
                  <Row label="Nomes">{det.certificado.nomes.join(', ') || '—'}</Row>
                  <Row label="Válido">
                    {det.certificado.desde} → {det.certificado.ate}
                  </Row>
                  <Row label="Emissor">{det.certificado.emissor || '—'}</Row>
                  <Row label="Renovação">{det.renovacaoAutomatica ? t("Automática (Let's Encrypt)") : t('Manual')}</Row>
                  <Row label="Cobertura do domínio">
                    {certificadoCobreDominio ? t('O certificado inclui este domínio.') : t('O certificado não inclui este domínio.')}
                  </Row>
                </>
              ) : (
                <Row label="Certificado">
                  <span style={{ color: 'var(--muted)' }}>{t('Ainda não tem. O pedido só funciona com o DNS do domínio a apontar para este servidor.')}</span>
                </Row>
              )}
              {det && (
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

          {/* SECÇÃO 3: Lista de Certificados no Fundo */}
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>{t('Certificate list')}</h3>
            <DataTable
              id="ssl"
              rows={sites}
              rowKey={(r) => r.name}
              semCols={true}
              semRecarregar={true}
              cols={[
                {
                  k: 'nome',
                  t: 'Certificate',
                  sort: (r) => r.name,
                  cell: (r) => (
                    <div>
                      <b style={{ color: 'var(--ink)' }}>{r.name}</b>
                    </div>
                  ),
                },
                {
                  k: 'dns',
                  t: 'Apontadores do domínio',
                  cell: (r) => (
                    <span style={{ fontSize: 13, color: 'var(--muted)', fontFamily: 'monospace' }}>
                      {[r.name, ...(r.aliases || [])].join(', ')}
                    </span>
                  ),
                },
                {
                  k: 'validade',
                  t: 'TLS no Hestia',
                  cell: (r) => (
                    <span className={'tag ' + (r.ssl === 'ok' ? 'ok' : 'w')} style={{ gap: 4 }}>
                      <i className={'fa-solid ' + (r.ssl === 'ok' ? 'fa-check' : 'fa-triangle-exclamation')} />
                      {r.ssl === 'ok' ? t('Instalado no Hestia') : t('Não instalado')}
                    </span>
                  ),
                },
                {
                  k: 'modo',
                  t: 'Renovação automática',
                  cell: (r) => (
                    <span style={{ color: r.ssl !== 'ok' ? 'var(--muted)' : r.le ? '#10b981' : 'var(--ink)', fontWeight: 600 }}>
                      {r.ssl !== 'ok' ? '—' : r.le ? t('Activa') : t('Desligada')}
                    </span>
                  ),
                },
              ]}
              actions={(r) => (
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center', position: 'relative' }}>
                  <button className="btn r sm" onClick={() => openM(<EmitirSslModal dom={r} onFeito={ler} />)}>
                    <i className="fa-solid fa-lock" />
                    {t('Emitir/substituir SSL')}
                  </button>
                  {r.ssl === 'ok' && (
                    <button className="btn g sm" onClick={() => cancelarSsl(vh, r.name, ler)} title={t('Cancelar certificado')}>
                      <i className="fa-solid fa-ban" />
                      {t('Cancelar')}
                    </button>
                  )}
                  <button
                    className="btn g sm"
                    disabled={r.ssl !== 'ok'}
                    onClick={() => {
                      if (r.name !== x.name) setDominio(r.name);
                      setVerCertDomain(r.name);
                    }}
                  >
                    {t('View')}
                  </button>
                  <div className="dt-mais" style={{ position: 'relative' }}>
                    <button
                      className="btn g sm iconbtn"
                      onClick={(e) => {
                        const b = e.currentTarget.getBoundingClientRect();
                        const right = window.innerWidth - b.right;
                        setMenuPos(window.innerHeight - b.bottom < 110 ? { bottom: window.innerHeight - b.top + 6, right } : { top: b.bottom + 6, right });
                        setMenuRow(menuRow === r.name ? null : r.name);
                      }}
                      title={t('Mais opções')}
                    >
                      <i className="fa-solid fa-ellipsis" />
                                          </button>
                    {menuRow === r.name && (
                      <div className="ssl-pop-menu" style={{ position: 'fixed', ...menuPos }}>
                        <button
                          onClick={() => {
                            setMenuRow(null);
                            openM(<CsrModal d={r.name} />);
                          }}
                        >
                          <i className="fa-solid fa-file-pen" />
                          {t('Create signing request')}
                        </button>
                        <button
                          onClick={() => {
                            setMenuRow(null);
                            openM(<CertificadoModal d={r.name} onFeito={ler} />);
                          }}
                        >
                          <i className="fa-solid fa-arrows-rotate" />
                          {t('Replace')}
                        </button>

                      </div>
                    )}
                  </div>
                </div>
              )}
            />
          </div>
        </>
      )}

      {tab === 'acme' && (
        <Frm
          title="ACME gerido pelo Hestia"
          foot={
            <button className="btn r" onClick={() => openM(<EmitirSslModal dom={x} onFeito={ler} />)}>
              <i className="fa-solid fa-lock" />
              {t('Emitir/substituir SSL')}
            </button>
          }
        >
          <p style={{ padding: '14px 18px', color: 'var(--muted)' }}>
            {t('O provedor ACME, o método de validação e a renovação são geridos pelo Hestia. O botão emite ou substitui o certificado deste domínio; não precisa de apagar o certificado actual.')}
          </p>
          <Row label="Estado no Hestia">{det?.renovacaoAutomatica ? t('Renovação automática activa') : t('Renovação automática não activa')}</Row>
        </Frm>
      )}

      {tab === 'historico' && (
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>{t('Histórico de aprovisionamento SSL')}</h3>
          <p style={{ color: 'var(--muted)', marginBottom: 12 }}>
            {t('O registo do Hestia mostra os comandos pedidos; não confirma se a emissão do certificado foi concluída.')}
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
                { k: 'comando', t: 'Comando Hestia', cell: (r) => <code>{r.comando}</code> },
                { k: 'estado', t: 'Registo', cell: () => <span>{t('Comando registado')}</span> },
              ]}
            />
          ) : sslHistory ? (
            <div className="note">{t('O Hestia não tem comandos SSL registados para este domínio.')}</div>
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
      <Contexto d={x.name} />
      <Frm
        title="Criar conta FTP"
        foot={
          <button className="btn r" onClick={criar}>
            <i className="fa-solid fa-plus" />
            {t('Criar')}
          </button>
        }
      >
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
const dominioBd = (vh: VH) => vh.a.domains.find((x) => !x.soEmail)?.name || vh.a.domains[0]?.name || '';
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
function Seccao({ titulo, desc, numeros }: { titulo: string; desc: string; numeros?: [string, string][] }) {
  const { t } = useVH();
  return (
    <div className="seccao-h">
      <div>
        <h3>{t(titulo)}</h3>
        <p>{t(desc)}</p>
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
            desc="Todas as bases de dados da conta, com o número de utilizadores que lhes acedem, o tamanho e o número de tabelas. Uma base nova cria-se no formulário por baixo da lista."
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
            desc="Todos os utilizadores das bases de dados. A coluna Hosts mostra os endereços IP ou padrões que podem ligar-se; % aceita ligações de qualquer endereço. Um utilizador novo cria-se no formulário por baixo da lista."
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
      <div className="acoes-topo" style={{ justifyContent: 'flex-start' }}>
        <a className="btn r" href={pmaUrl(vh)} target="_blank" rel="noreferrer">
          <i className="fa-solid fa-database" />
          {t('Abrir phpMyAdmin')}
        </a>
      </div>
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
export const phpmyadminPagina: ScreenFn = () => ({ title: 'phpMyAdmin', body: <PhpMyAdmin /> });

export const bdPagina: ScreenFn = (vh) => {
  const [a, b] = vh.s.sub;
  const base = { t: 'Bases de dados', path: '/utilizador/bd' };
  if (a === 'utilizadores' && b) return { title: 'Gerir utilizador', crumbs: [base, { t: 'Utilizadores', path: '/utilizador/bd/utilizadores' }, { t: 'Gerir utilizador' }], actions: botoesBd(vh, 'utilizador'), body: <VerUtilizadorBd key={b} dbuser={b} /> };
  if (a === 'utilizadores') return { title: 'Utilizadores', crumbs: [base, { t: 'Utilizadores' }], actions: botoesBd(vh, 'utilizadores'), body: <UtilizadoresBd /> };
  if (a) return { title: 'Gerir base de dados', crumbs: [base, { t: 'Gerir base de dados' }], actions: botoesBd(vh, 'base', a), body: <VerBd key={a} nome={a} /> };
  return { title: 'Bases de dados', actions: botoesBd(vh, 'bases'), body: <BasesDados /> };
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
      <Contexto d={x.name} />
      <Frm
        title="Criar apontador"
        desc="Outro domínio que abre o mesmo site (o DNS dele tem de apontar para este servidor)"
        foot={
          <button className="btn r" onClick={criar}>
            <i className="fa-solid fa-plus" />
            {t('Criar')}
          </button>
        }
      >
        <Row label="Domínio de origem" hint="ex.: outrodominio.com">
          <input value={al} onChange={(e) => setAl(e.target.value)} placeholder="outrodominio.com" />
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
      <Contexto d={x.name} />
      <Frm
        title="Redirecionar o domínio inteiro"
        desc="Tudo o que abrir este domínio vai para outro endereço"
        right={det.redirecionamento ? <span className="tag w">{t('Ativo')}</span> : undefined}
        foot={
          <>
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
          </>
        }
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
          <select value={dom.codigo} onChange={(e) => setDom({ ...dom, codigo: e.target.value })} style={{ maxWidth: 320 }}>
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
          <select value={nova.tipo} onChange={(e) => setNova({ ...nova, tipo: e.target.value })} style={{ maxWidth: 320 }}>
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
      <Contexto d={x.name} />
      <Frm
        title="Proteção hotlink"
        desc="Impede outros sites de mostrar as suas imagens e vídeos (gastando o seu tráfego)"
        right={<Switch checked={h.ativo} onChange={(v) => guardar({ ...h, ativo: v }, v ? 'Proteção hotlink ligada' : 'Proteção hotlink desligada')} label="Proteção hotlink" />}
        foot={
          <button className="btn r" onClick={() => guardar({ ...h, ativo: true }, 'Proteção hotlink guardada')}>
            {t('Guardar')}
          </button>
        }
      >
        <Row label="Tipos de ficheiro protegidos" hint="Separados por vírgulas">
          <input value={h.tipos} onChange={(e) => setH({ ...h, tipos: e.target.value })} />
        </Row>
        <Row label="Sites que podem mostrar" hint="O próprio domínio já está incluído">
          <span className="igrp">
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
const DIRETIVAS = ['memory_limit', 'upload_max_filesize', 'post_max_size', 'max_execution_time', 'max_input_time', 'max_input_vars', 'display_errors', 'error_reporting', 'date.timezone', 'allow_url_fopen', 'short_open_tag', 'session.gc_maxlifetime'];
function Php() {
  const vh = useVH();
  const { s, t } = vh;
  const x = dominioAtual(vh);
  const { det, erro, ler } = useDetalhe(x?.name || '');
  const [k, setK] = useState(DIRETIVAS[0]);
  const [v, setV] = useState('');
  if (!x) return <SemDominio />;
  if (!det) return <Carregar erro={erro} ler={ler} />;
  const regras = det.php;
  const gravar = async (rs: { k: string; v: string }[], msg: string) => (await noServidor(vh, { acao: 'php-ini', dominio: x.name, regras: rs }, msg)) && ler();
  return (
    <>
      <Contexto d={x.name} />
      <Frm title="Versão PHP" desc="A versão usada por este site">
        <Row label="Versão">
          <select
            value={x.php}
            onChange={async (e) => noServidor(vh, { acao: 'php-versao', dominio: x.name, versao: e.target.value }, 'PHP ' + e.target.value + ' em ' + x.name)}
            style={{ maxWidth: 220 }}
          >
            {!s.php.includes(x.php) && <option value={x.php}>{x.php}</option>}
            {s.php.map((p) => (
              <option key={p} value={p}>
                PHP {p}
              </option>
            ))}
          </select>
        </Row>
      </Frm>
      <Frm
        title="Alterar uma definição"
        desc="Fica só neste site (ficheiro .user.ini)"
        foot={
          <button
            className="btn r"
            onClick={() => {
              if (!v.trim()) return vh.toast('Escreva o valor');
              gravar([...regras.filter((r) => r.k !== k), { k, v: v.trim() }], k + ' = ' + v.trim());
              setV('');
            }}
          >
            <i className="fa-solid fa-plus" />
            {t('Adicionar')}
          </button>
        }
      >
        <Row label="Definição">
          <select value={k} onChange={(e) => setK(e.target.value)} style={{ maxWidth: 320 }}>
            {DIRETIVAS.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </Row>
        <Row label="Valor" hint="ex.: 256M, 300, On, Africa/Maputo">
          <input value={v} onChange={(e) => setV(e.target.value)} />
        </Row>
      </Frm>
      <DataTable
        id="php"
        rows={regras}
        rowKey={(r) => r.k}
        empty="Sem alterações: o site usa os valores do servidor"
        cols={[
          { k: 'k', t: 'Definição', cell: (r) => <code>{r.k}</code> },
          { k: 'v', t: 'Valor', cell: (r) => <b>{r.v}</b> },
        ]}
        bulk={[{ t: 'Apagar', fa: 'fa-trash', run: (ks) => gravar(regras.filter((r) => !ks.includes(r.k)), 'Definição apagada') }]}
      />
    </>
  );
}
export const phpPagina: ScreenFn = () => ({ title: 'Definições PHP', dominios: 'sites', body: <Php /> });
