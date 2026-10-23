'use client';

// Menu E-mail do painel Utilizador (páginas copiadas do DirectAdmin, ligadas ao Hestia por /api/vhost/email):
// Contas de e-mail (+ nova, uso), Reencaminhamentos (+ novo, a partir de texto), Respostas automáticas, Mensagens
// de férias, Filtros anti-spam, Listas de correio, Registos MX, Rastreio de e-mail e Migração de e-mail; nos
// Extras, Webmail (Roundcube) e Mailmarketing (a plataforma do site). Tudo usa o domínio escolhido no seletor.
import { useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { useVH, type VH, TopoCartao } from '../context';
import type { ScreenFn } from '../screens';
import { DESC, MENU } from '../generated/data';
import { pacoteDe } from '../state';
import { EMAIL_PLANS, emailPlanByProductName } from '@/lib/email-plans';
import { Stat } from '../ui';
import { Check, DataTable, MaisOpcoes, novaSenha, Senha, Switch, Tabs } from './componentes';
import { Confirmar } from './pacotes';
import { AO_ABRIR, EsperaPagina, FUNDO, useGet, useNaMemoria } from '../carga';
import { corUso } from '../cor-uso';

// ---------- Menu: Mailmarketing nos Extras, a seguir ao Webmail (sem mexer nos ficheiros gerados da maquete) ----------
{
  const extras = MENU.utilizador.find(([g]) => g === 'Extras');
  if (extras && !extras[1].some((it) => it.id === 'mailmarketing')) {
    const i = extras[1].findIndex((it) => it.id === 'webmail');
    extras[1].splice(i + 1, 0, {
      id: 'mailmarketing',
      fa: 'fa-bullhorn',
      t: 'Mailmarketing',
      c: 'c1',
      da: '—',
      f: ['Campanhas e newsletters', 'Contactos e listas', 'Histórico de envios'],
      hx: { s: 'app', cmd: '', n: 'A plataforma de mailmarketing do site da VisualDesign' },
      feat: 'mailmarketing',
    });
  }
  DESC['utilizador/mailmarketing'] = ['Campanhas, newsletters e contactos', 'Campaigns, newsletters and contacts'];
}

// ---------- Dados ----------
type Caixa = { nome: string; usadoMb: number; quotaMb: number; limiteHora: number; enviadosHoje: number; fwd: string[]; soReencaminha: boolean; alias: string[]; resposta: boolean; suspensa: boolean; criada: string };
type Ferias = { acc: string; de: string; ate: string; msg: string; ativa: boolean };
type InfoEmail = {
  temMail: boolean;
  dominio: { antispam: boolean; antivirus: boolean; dkim: boolean; rejeitarSpam: boolean; catchall: string; webmail: string; limiteHora: number; suspenso: boolean } | null;
  caixas: Caixa[];
  listas: string[];
  ferias: Ferias[];
  bloqueios: string[];
  regraBloqueios: boolean;
};

// O que já foi lido de cada domínio aparece logo ao voltar e atualiza-se por trás; pedidos iguais ao mesmo tempo juntam-se
const lidos = new Map<string, InfoEmail>();
const aLer = new Map<string, Promise<InfoEmail>>();
const ouvintes = new Map<string, Set<(x: InfoEmail) => void>>();

function lerEmail(me: string, d: string, fundo = false): Promise<InfoEmail> {
  const k = me + '|' + d;
  let p = aLer.get(k);
  if (!p) {
    p = fetch('/api/vhost/email?conta=' + encodeURIComponent(me) + '&d=' + encodeURIComponent(d), { cache: 'no-store', headers: fundo ? FUNDO : undefined })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.erro || 'Erro a ler o e-mail');
        lidos.set(k, j as InfoEmail);
        ouvintes.get(k)?.forEach((f) => f(j as InfoEmail));
        return j as InfoEmail;
      })
      .finally(() => aLer.delete(k));
    aLer.set(k, p);
  }
  return p;
}

/** Domínio em que se trabalha: o escolhido no seletor (todos os domínios da conta, também os só de e-mail) */
function dominioEmail(vh: VH): string {
  const doms = vh.a.domains.map((x) => x.name); // o primeiro é o principal da conta
  return vh.s.dominio && doms.includes(vh.s.dominio) ? vh.s.dominio : doms[0] || '';
}

function useEmail() {
  const vh = useVH();
  const espera = useContext(EsperaPagina);
  const d = dominioEmail(vh);
  const k = vh.me + '|' + d;
  const [info, setInfo] = useState<InfoEmail | null>(() => lidos.get(k) || null);
  const [erro, setErro] = useState('');
  // Como no useGet: a leitura automática ao abrir, já em memória, atualiza por trás sem a linha do topo.
  const ler = useCallback(async (emFundo?: unknown) => {
    if (!d) return;
    setErro('');
    // sem nada em memória, a página nova espera por esta leitura antes de aparecer
    const emMemoria = lidos.has(vh.me + '|' + d);
    const fim = !emMemoria && espera ? espera.comecar() : null;
    try {
      setInfo(await lerEmail(vh.me, d, emFundo === true || (emFundo === AO_ABRIR && emMemoria)));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro a ler o e-mail');
    } finally {
      fim?.();
    }
  }, [vh.me, d, espera]);
  useEffect(() => {
    setInfo(lidos.get(k) || null);
    const s = ouvintes.get(k) || new Set();
    s.add(setInfo);
    ouvintes.set(k, s);
    ler(AO_ABRIR);
    return () => {
      s.delete(setInfo);
    };
  }, [k, ler]);
  return { d, info, erro, ler };
}

/** Faz uma alteração no e-mail; devolve a resposta (ou null se falhou) e volta a ler o domínio */
async function noEmail(vh: VH, d: string, corpo: Record<string, unknown>, ok: string, recarregar = false): Promise<Record<string, unknown> | null> {
  vh.toast('A alterar no servidor…');
  try {
    const r = await fetch('/api/vhost/email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conta: vh.me, dominio: d, ...corpo }) });
    const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    if (!r.ok) {
      vh.toast(vh.t(String(j.erro || 'A alteração falhou')));
      return null;
    }
    lerEmail(vh.me, d).catch(() => null);
    if (recarregar) vh.recarregar(true);
    vh.toast(ok);
    return j;
  } catch {
    vh.toast('Sem ligação ao site. Nada foi alterado.');
    return null;
  }
}

const mb = (n: number) => (n >= 1024 ? (n / 1024).toFixed(2).replace('.', ',') + ' GB' : n.toLocaleString('pt-PT') + ' MB');
const pct = (v: number, max: number) => (max > 0 ? Math.min(100, Math.round((v / max) * 100)) : 0);
function quotaMbInserida(valor: string): number | null | undefined {
  const s = valor.trim().toLowerCase().replace(',', '.');
  if (!s) return null;
  const m = s.match(/^(\d+(?:\.\d+)?|\.\d+)\s*(mb|gb)?$/);
  if (!m) return undefined;
  const n = Number(m[1]) * (m[2] === 'gb' ? 1024 : 1);
  return Number.isSafeInteger(Math.round(n)) && n > 0 && n <= 9_999_999 ? Math.round(n) : undefined;
}
const quotaEditavel = (n: number) => (n >= 1024 && n % 1024 === 0 ? n / 1024 + ' GB' : n + ' MB');
/** Webmail: com uma caixa, o painel entra já nela sem palavra-passe (bilhete de uso único, rota /api/vhost/email);
 *  sem caixa, o ecrã de entrada do Roundcube */
const webmailUrl = (conta: string, d: string, acc?: string) => '/api/vhost/email?conta=' + encodeURIComponent(conta) + '&d=' + encodeURIComponent(d) + '&webmail=' + encodeURIComponent(acc || '_');
/** Endereço do webmail para quem o escreve à mão, como no DA: https://<domínio>/webmail */
const webmailEndereco = (d: string) => 'https://' + d + '/webmail';
const caixasNormais = (info: InfoEmail) => info.caixas.filter((c) => !c.soReencaminha && !info.listas.includes(c.nome));

function Carregando({ erro, ler }: { erro: string; ler: () => void }) {
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

/** O domínio ainda não tem e-mail neste servidor: liga-se aqui (v-add-mail-domain) */
function SemEmail({ d }: { d: string }) {
  const vh = useVH();
  const { t } = vh;
  if (!d)
    return (
      <div className="card empty">
        <p>{t('Esta conta ainda não tem domínios.')}</p>
      </div>
    );
  return (
    <div className="card empty">
      <p>
        {t('O domínio')} <b>{d}</b> {t('ainda não recebe e-mail neste servidor.')}
      </p>
      <button className="btn r" onClick={() => noEmail(vh, d, { acao: 'dominio-ligar' }, 'E-mail ligado em ' + d, true)}>
        <i className="fa-solid fa-envelope-circle-check" />
        {t('Ligar o e-mail neste domínio')}
      </button>
    </div>
  );
}

/** Página que precisa do e-mail do domínio: mostra a espera, o "ligar e-mail" ou o conteúdo */
function ComEmail({ children }: { children: (x: { d: string; info: InfoEmail; ler: () => void }) => ReactNode }) {
  const { d, info, erro, ler } = useEmail();
  if (!info) return <Carregando erro={erro} ler={ler} />;
  if (!info.temMail) return <SemEmail d={d} />;
  return <>{children({ d, info, ler })}</>;
}

/** Descrição da barra de cima das listas do e-mail (modelo da página Domínios: um título e, por baixo, uma descrição
 *  pequena com os números — ex.: "Reencaminhar e-mails para outros endereços | 2 reencaminhamentos"). Usa o que a página
 *  já leu do servidor (não faz outro pedido). */
function DescEmail({ texto, conta }: { texto: string; conta?: (info: InfoEmail) => [number, string, string] }) {
  const vh = useVH();
  const k = vh.me + '|' + dominioEmail(vh);
  const [info, setInfo] = useState<InfoEmail | null>(() => lidos.get(k) || null);
  useEffect(() => {
    setInfo(lidos.get(k) || null);
    const s = ouvintes.get(k) || new Set();
    s.add(setInfo);
    ouvintes.set(k, s);
    return () => {
      s.delete(setInfo);
    };
  }, [k]);
  const n = conta && info?.temMail ? conta(info) : null;
  return (
    <>
      {vh.t(texto)}
      {n && (
        <>
          <span className="pdesc-sep">|</span>
          {n[0]} {vh.t(n[0] === 1 ? n[1] : n[2])}
        </>
      )}
    </>
  );
}

/** Secção como nas páginas do DirectAdmin (título, descrição, números à direita) */
function Sec({ titulo, desc, numeros, children }: { titulo: string; desc?: string; numeros?: [string, string][]; children: ReactNode }) {
  const { t } = useVH();
  return (
    <section className="da-sec">
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
      {children}
    </section>
  );
}

function Campo({ label, hint, children, id }: { label: string; hint?: string; children: ReactNode; id?: string }) {
  const { t } = useVH();
  return (
    <div className="da-campo">
      <label htmlFor={id}>{t(label)}</label>
      {children}
      {hint && <small>{t(hint)}</small>}
    </div>
  );
}

function Endereco({ id, value, onChange, d, placeholder }: { id?: string; value: string; onChange: (v: string) => void; d: string; placeholder?: string }) {
  return (
    <span className="igrp">
      <input id={id} value={value} onChange={(e) => onChange(e.target.value.toLowerCase().replace(/\s/g, ''))} placeholder={placeholder} />
      <span className="ib" style={{ cursor: 'default' }}>
        @{d}
      </span>
    </span>
  );
}

// ---------- Contas de e-mail ----------
/** Ficheiro de configuração para Mail do iPhone, iPad e Mac (IMAP 993 + SMTP 465, entrada e saída com a mesma senha) */
function configApple(acc: string, d: string) {
  const u = () => crypto.randomUUID().toUpperCase();
  const end = acc + '@' + d;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>PayloadContent</key><array><dict>
<key>EmailAccountDescription</key><string>${end}</string>
<key>EmailAccountName</key><string>${end}</string>
<key>EmailAccountType</key><string>EmailTypeIMAP</string>
<key>EmailAddress</key><string>${end}</string>
<key>IncomingMailServerAuthentication</key><string>EmailAuthPassword</string>
<key>IncomingMailServerHostName</key><string>mail.${d}</string>
<key>IncomingMailServerPortNumber</key><integer>993</integer>
<key>IncomingMailServerUseSSL</key><true/>
<key>IncomingMailServerUsername</key><string>${end}</string>
<key>OutgoingMailServerAuthentication</key><string>EmailAuthPassword</string>
<key>OutgoingMailServerHostName</key><string>mail.${d}</string>
<key>OutgoingMailServerPortNumber</key><integer>465</integer>
<key>OutgoingMailServerUseSSL</key><true/>
<key>OutgoingMailServerUsername</key><string>${end}</string>
<key>OutgoingPasswordSameAsIncomingPassword</key><true/>
<key>PayloadDisplayName</key><string>${end}</string>
<key>PayloadIdentifier</key><string>com.visualhost.mail.${u()}</string>
<key>PayloadType</key><string>com.apple.mail.managed</string>
<key>PayloadUUID</key><string>${u()}</string>
<key>PayloadVersion</key><integer>1</integer>
</dict></array>
<key>PayloadDisplayName</key><string>E-mail ${end}</string>
<key>PayloadIdentifier</key><string>com.visualhost.${u()}</string>
<key>PayloadType</key><string>Configuration</string>
<key>PayloadUUID</key><string>${u()}</string>
<key>PayloadVersion</key><integer>1</integer>
</dict></plist>`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([xml], { type: 'application/x-apple-aspen-config' }));
  a.download = end + '.mobileconfig';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

async function baixarCredenciaisOutlook(vh: VH, acc: string, d: string, palavraPasse?: string) {
  const email = acc + '@' + d;
  try {
    let senha = palavraPasse;
    if (!senha) {
      const resposta = await fetch('/api/email-senha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const dados = (await resposta.json()) as { senha?: unknown; error?: string };
      if (!resposta.ok || typeof dados.senha !== 'string' || !dados.senha) {
        throw new Error(dados.error || 'Não foi possível obter a palavra-passe desta caixa.');
      }
      senha = dados.senha;
    }

    const conteudo = [
      'CREDENCIAIS PARA CONFIGURAR O OUTLOOK',
      '',
      `Endereço de e-mail: ${email}`,
      `Nome de utilizador: ${email}`,
      `Palavra-passe: ${senha}`,
      '',
      'CORREIO DE ENTRADA (IMAP)',
      `Servidor: mail.${d}`,
      'Porta: 993',
      'Segurança: SSL/TLS',
      'Autenticação: palavra-passe',
      '',
      'CORREIO DE SAÍDA (SMTP)',
      `Servidor: mail.${d}`,
      'Porta: 465',
      'Segurança: SSL/TLS',
      'Alternativa: porta 587 com STARTTLS',
      'Autenticação: palavra-passe; usar o mesmo nome de utilizador e palavra-passe do IMAP',
      '',
      `Webmail: ${webmailEndereco(d)}`,
      '',
      'Este ficheiro contém uma palavra-passe. Guarde-o em local seguro e apague-o quando terminar a configuração.',
      '',
    ].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([conteudo], { type: 'text/plain;charset=utf-8' }));
    a.download = 'credenciais-outlook-' + email + '.txt';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  } catch (erro) {
    vh.toast(erro instanceof Error ? erro.message : 'Não foi possível descarregar as credenciais.');
  }
}

/** Dados para configurar o programa de e-mail (mostrados depois de criar a conta; a senha não volta a aparecer) */
function DadosConta({ acc, d, senha }: { acc: string; d: string; senha?: string }) {
  const vh = useVH();
  const { t, closeM } = vh;
  const l: [string, string][] = [
    ['Endereço', acc + '@' + d],
    ...(senha ? ([['Palavra-passe', senha]] as [string, string][]) : []),
    ['Servidor de entrada (IMAP)', 'mail.' + d + ' · 993 (SSL)'],
    ['Servidor de saída (SMTP)', 'mail.' + d + ' · 465 (SSL) ou 587 (STARTTLS)'],
    ['Utilizador', acc + '@' + d],
    ['Webmail', webmailEndereco(d)],
  ];
  return (
    <>
      <h3>{t(senha ? 'Conta criada' : 'Configurar o e-mail')}</h3>
      {senha && <p style={{ color: 'var(--muted)', marginBottom: 10 }}>{t('Guarde estes dados: a palavra-passe não volta a ser mostrada.')}</p>}
      {l.map(([k, v]) => (
        <div className="f" key={k}>
          <label>{t(k)}</label>
          <input readOnly value={v} onFocus={(e) => e.target.select()} />
        </div>
      ))}
      <div className="mfoot">
        <button className="btn g" onClick={() => void baixarCredenciaisOutlook(vh, acc, d, senha)}>
          <i className="fa-brands fa-windows" />
          {t('Credenciais Outlook')}
        </button>
        <button className="btn g" onClick={() => configApple(acc, d)}>
          <i className="fa-brands fa-apple" />
          {t('Configuração Apple')}
        </button>
        <button className="btn r" onClick={closeM}>
          {t('Fechar')}
        </button>
      </div>
    </>
  );
}

function SenhaModal({ d, acc }: { d: string; acc: string }) {
  const vh = useVH();
  const { t, closeM } = vh;
  const [s, setS] = useState('');
  return (
    <>
      <h3>{t('Mudar palavra-passe')}</h3>
      <p style={{ color: 'var(--muted)', marginBottom: 10 }}>
        {acc}@{d}
      </p>
      <div className="f">
        <label>{t('Nova palavra-passe')}</label>
        <Senha value={s} onChange={setS} />
      </div>
      <div className="mfoot">
        <button className="btn g" onClick={closeM}>
          {t('Cancelar')}
        </button>
        <button
          className="btn r"
          disabled={!s}
          onClick={async () => {
            if (s.length < 8) return vh.toast('A palavra-passe precisa de pelo menos 8 caracteres');
            closeM();
            await noEmail(vh, d, { acao: 'conta-senha', user: acc, senha: s }, 'Palavra-passe de ' + acc + '@' + d + ' mudada');
          }}
        >
          {t('Guardar')}
        </button>
      </div>
    </>
  );
}

/** Quota (MB) e limite de envios por hora, cada um com "Sem limite" (o Max do DirectAdmin) */
function Limites({ quota, setQuota, limite, setLimite }: { quota: string; setQuota: (v: string) => void; limite: string; setLimite: (v: string) => void }) {
  const { t } = useVH();
  return (
    <>
      <Campo label="Quota da caixa (MB ou GB)" hint={quota === '' ? 'Sem limite de espaço' : undefined}>
        <span className="da-max">
          <input inputMode="text" value={quota} placeholder={t('sem limite')} onChange={(e) => setQuota(e.target.value)} />
          <Check checked={quota === ''} onChange={(v) => setQuota(v ? '' : '1 GB')} label="Sem limite" />
        </span>
      </Campo>
      <Campo label="Limite de envios por hora" hint="O servidor conta os envios por hora (o DirectAdmin contava por dia)">
        <span className="da-max">
          <input inputMode="numeric" value={limite} placeholder={t('o do domínio')} onChange={(e) => setLimite(e.target.value.replace(/\D/g, ''))} />
          <Check checked={limite === ''} onChange={(v) => setLimite(v ? '' : '200')} label="Sem limite próprio" />
        </span>
      </Campo>
    </>
  );
}

function LimitesModal({ d, c }: { d: string; c: Caixa }) {
  const vh = useVH();
  const { t, closeM } = vh;
  const [quota, setQuota] = useState(c.quotaMb ? quotaEditavel(c.quotaMb) : '');
  const [limite, setLimite] = useState(c.limiteHora ? String(c.limiteHora) : '');
  return (
    <>
      <h3>{t('Mudar limites')}</h3>
      <p style={{ color: 'var(--muted)', marginBottom: 10 }}>
        {c.nome}@{d} · {t('usa')} {mb(c.usadoMb)}
      </p>
      <Limites quota={quota} setQuota={setQuota} limite={limite} setLimite={setLimite} />
      <div className="mfoot">
        <button className="btn g" onClick={closeM}>
          {t('Cancelar')}
        </button>
        <button
          className="btn r"
          onClick={async () => {
            const quotaMb = quotaMbInserida(quota);
            if (quotaMb === undefined) return vh.toast(vh.t('Indique a quota em MB ou GB, por exemplo 500 MB ou 2 GB.'));
            closeM();
            await noEmail(vh, d, { acao: 'conta-limites', user: c.nome, quota: quotaMb === null ? 'unlimited' : String(quotaMb), limite }, 'Limites de ' + c.nome + ' guardados', true);
          }}
        >
          {t('Guardar')}
        </button>
      </div>
    </>
  );
}

function PurgarModal({ d, users }: { d: string; users: string[] }) {
  const vh = useVH();
  const { t, closeM } = vh;
  const [pasta, setPasta] = useState('lixo');
  const [dias, setDias] = useState('30');
  return (
    <>
      <h3>{t('Purgar mensagens')}</h3>
      <p style={{ color: 'var(--muted)', marginBottom: 10, lineHeight: 1.5 }}>
        {t('Apaga mensagens de')} {users.length} {t('conta(s)')}: {users.join(', ')}. {t('Não se pode desfazer.')}
      </p>
      <div className="f">
        <label>{t('Pasta')}</label>
        <select value={pasta} onChange={(e) => setPasta(e.target.value)}>
          <option value="lixo">{t('Lixo')}</option>
          <option value="spam">{t('Spam')}</option>
          <option value="entrada">{t('Caixa de entrada')}</option>
          <option value="enviadas">{t('Enviadas')}</option>
          <option value="todas">{t('Todas as pastas')}</option>
        </select>
      </div>
      <div className="f">
        <label>{t('Só as mensagens com mais de (dias)')}</label>
        <input inputMode="numeric" value={dias} onChange={(e) => setDias(e.target.value.replace(/\D/g, ''))} placeholder="0 = todas" />
      </div>
      <div className="mfoot">
        <button className="btn g" onClick={closeM}>
          {t('Cancelar')}
        </button>
        <button
          className="btn r"
          onClick={async () => {
            closeM();
            await noEmail(vh, d, { acao: 'contas-purgar', users, pasta, dias: Number(dias) || 0 }, 'Mensagens apagadas', true);
          }}
        >
          {t('Purgar')}
        </button>
      </div>
    </>
  );
}

function ContasLista() {
  const vh = useVH();
  const { t, openM, nav } = vh;
  const { d, info } = useEmail();
  // esta lista não leva a linha de cima do cartão (indicação do domínio): com o lugar "ocupado", o "Opções" fica no título da 1.ª coluna
  const topo = useContext(TopoCartao);
  const marcarOcupado = topo?.setOcupado;
  useEffect(() => {
    if (!marcarOcupado) return;
    marcarOcupado(true);
    return () => marcarOcupado(false);
  }, [marcarOcupado]);
  const [q, setQ] = useState('');
  const [quotaEdit, setQuotaEdit] = useState<{ user: string; value: string } | null>(null);
  const [aGuardarQuota, setAGuardarQuota] = useState(false);
  if (!info) return null;
  const todasRows = caixasNormais(info);
  const rows = q.trim() ? todasRows.filter((r) => r.nome.toLowerCase().includes(q.trim().toLowerCase())) : todasRows;
  const usado = todasRows.reduce((n, c) => n + c.usadoMb, 0);
  const enviados = todasRows.reduce((n, c) => n + c.enviadosHoje, 0);
  const cheias = todasRows.filter((c) => c.quotaMb > 0 && c.usadoMb / c.quotaMb > 0.8).length;
  const lim = pacoteDe(vh.s, vh.me)?.lim.emails;
  const planoEmail = [vh.a.hpkg, vh.a.pkg]
    .map((nome) => EMAIL_PLANS.find((p) => p.hestiaPackage.toLowerCase() === String(nome || '').toLowerCase()) || emailPlanByProductName(nome))
    .find((p) => p !== undefined);
  const max = planoEmail ? planoEmail.accounts : !lim || lim.unl ? null : Number(lim.v) || null;
  const totalContas = vh.a.mails.length;
  const diferencaContas = max === null ? null : max - totalContas;
  const detalheContas = max === null
    ? 'Sem limite de contas no plano'
    : diferencaContas !== null && diferencaContas < 0
      ? `${max} contas no plano · limite ultrapassado por ${Math.abs(diferencaContas)}`
      : `${max} contas no plano · ${diferencaContas ?? 0} restantes`;
  const limitePlanoMb = planoEmail ? planoEmail.storageGb * 1024 : null;
  const quotaMaximaMb = limitePlanoMb === null ? null : Math.max(0, limitePlanoMb - vh.a.mails
    .filter((mail) => !quotaEdit || mail.user !== quotaEdit.user || mail.dom !== d)
    .reduce((soma, mail) => soma + Math.max(1, Math.ceil(mail.used / 0.8)), 0));
  const guardarQuota = async () => {
    if (!quotaEdit || aGuardarQuota) return;
    const quotaMb = quotaMbInserida(quotaEdit.value);
    if (quotaMb === undefined) {
      vh.toast(vh.t('Indique a quota em MB ou GB, por exemplo 500 MB ou 2 GB.'));
      return;
    }
    setAGuardarQuota(true);
    try {
      const resultado = await noEmail(
        vh,
        d,
        { acao: 'conta-quota', user: quotaEdit.user, quota: quotaMb === null ? 'unlimited' : String(quotaMb) },
        'Quota de ' + quotaEdit.user + ' guardada',
      );
      if (resultado) setQuotaEdit(null);
    } finally {
      setAGuardarQuota(false);
    }
  };
  const apagar = (us: string[]) =>
    openM(<Confirmar titulo="Apagar contas de e-mail?" texto={'Vai apagar ' + us.join(', ') + ' e todas as mensagens. Não se pode desfazer.'} ok="Apagar" onOk={() => noEmail(vh, d, { acao: 'contas-apagar', users: us }, 'Conta(s) apagada(s)', true)} />);
  return (
    <>
      {/* Estatísticas em cima, como nas outras páginas com tabela */}
      <div className="stats">
        <Stat
          title="Contas"
          v={totalContas}
          m={detalheContas}
          p={max === null ? 0 : pct(totalContas, max)}
        />
        <Stat title="Espaço usado" uso v={mb(usado)} m="em todas as caixas" p={pct(usado, rows.reduce((n, c) => n + c.quotaMb, 0))} />
        <Stat title="Envios hoje" v={enviados} m="mensagens enviadas" p={0} />
        <Stat title="Caixas quase cheias" v={cheias} m="acima de 80%" p={cheias * 20} cor={cheias === 0 ? corUso(0) : cheias < 3 ? corUso(70) : corUso(100)} />
      </div>
      {/* Card secundário: pesquisa + botões + lista de e-mails */}
      <div className="card em-lista-card">
        {/* Barra: pesquisa à esquerda, botões à direita */}
        <div className="em-acoes-topo">
          <div className="search dt-pesq em-pesq">
            <i className="fa-solid fa-magnifying-glass" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Pesquisar')} aria-label={t('Pesquisar')} />
            {q && <i className="fa-solid fa-xmark limpar" onClick={() => setQ('')} />}
          </div>
          <span className="sp" />
          <div className="em-acoes-botoes">
            <button className="btn g" onClick={() => nav('/utilizador/email/uso')}>
              <i className="fa-solid fa-chart-pie" />
              {t('Uso de e-mail')}
            </button>
            <button className="btn r" onClick={() => nav('/utilizador/email/nova')}>
              <i className="fa-solid fa-plus" />
              {t('Criar conta')}
            </button>
          </div>
        </div>
        <DataTable
        id="email-contas"
        umaLinha
        barraFora
        empilhar
        rows={rows}
        rowKey={(r) => r.nome}
        onRecarregar={() => void lerEmail(vh.me, d)}
        empty="Este domínio ainda não tem contas de e-mail"
        rowClass={(r) => (r.suspensa ? 'off' : '')}
        cols={[
          {
            k: 'conta',
            t: 'Conta',
            sort: (r) => r.nome,
            cell: (r) => (
              <div className="cell">
                <div className="ic c2">
                  <i className="fa-solid fa-envelope" />
                </div>
                <div>
                  <b>{r.nome + '@' + d}</b>
                  <span className="em-conta-sub">
                    {r.suspensa ? t('Suspensa') + ' · ' : ''}
                    {r.fwd.length ? ' · ' + t('reencaminha') : ''}
                    {r.resposta ? ' · ' + t('resposta automática') : ''}
                  </span>
                </div>
              </div>
            ),
          },
          {
            k: 'quota',
            t: 'Quota',
            center: true,
            sort: (r) => r.quotaMb,
            cell: (r) =>
              quotaEdit?.user === r.nome ? (
                <input
                  autoFocus
                  aria-label={t('Quota')}
                  className="em-quota-input"
                  disabled={aGuardarQuota}
                  inputMode="text"
                  maxLength={20}
                  value={quotaEdit.value}
                  placeholder={t('ex.: 2 GB ou 500 MB')}
                  title={quotaMaximaMb === null ? undefined : `${t('Máximo possível para esta caixa')}: ${quotaMaximaMb} MB / ${planoEmail?.storageGb ?? ''} GB`}
                  onChange={(e) => setQuotaEdit({ ...quotaEdit, value: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void guardarQuota();
                    } else if (e.key === 'Escape') {
                      setQuotaEdit(null);
                    }
                  }}
                />
              ) : (
                <button
                  type="button"
                  className="em-quota-editar"
                  aria-label={t('Quota') + ': ' + (r.quotaMb ? mb(r.quotaMb) : t('sem limite'))}
                  onClick={() => setQuotaEdit({ user: r.nome, value: r.quotaMb ? quotaEditavel(r.quotaMb) : '' })}
                >
                  {r.quotaMb ? mb(r.quotaMb) : t('sem limite')}
                </button>
              ),
          },
          {
            k: 'uso',
            t: 'Uso da caixa',
            sort: (r) => r.usadoMb,
            cell: (r) => {
              const p = pct(r.usadoMb, r.quotaMb);
              return (
                <div className="em-uso">
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12.5, color: 'var(--muted)', marginBottom: 5 }}>
                    <span>{r.quotaMb > 0 ? mb(r.usadoMb) + ' / ' + mb(r.quotaMb) : mb(r.usadoMb) + ' · ' + t('sem limite')}</span>
                    {r.quotaMb > 0 && <b style={{ color: p > 80 ? 'var(--red)' : 'var(--ink)' }}>{p}%</b>}
                  </div>
                  <div className="bar">
                    <span style={{ width: p + '%', background: corUso(p) }} />
                  </div>
                </div>
              );
            },
          },
          {
            k: 'env',
            t: 'Enviados',
            right: true,
            sort: (r) => r.enviadosHoje,
            cell: (r) => (
              <span className="em-env">
                {r.enviadosHoje}
                {r.limiteHora ? (
                  <>
                    {' / ' + r.limiteHora}
                    <small>{t('por hora')}</small>
                  </>
                ) : (
                  <small> / {t('Sem limite')}</small>
                )}
              </span>
            ),
          },
          {
            k: 'log',
            t: 'Registo SMTP',
            right: true,
            cell: (r) => (
              <span className="em-log">
                <a className="lk" onClick={() => nav('/utilizador/rastreio/entrada/' + encodeURIComponent(r.nome + '@' + d))}>
                  {t('Entrada')}
                </a>{' '}
                ⇄{' '}
                <a className="lk" onClick={() => nav('/utilizador/rastreio/saida/' + encodeURIComponent(r.nome + '@' + d))}>
                  {t('Saída')}
                </a>
              </span>
            ),
          },
        ]}
        actions={(r) => (
          <span className="dns-acoes">
            <a className="btn g sm iconbtn" href={webmailUrl(vh.me, d, r.nome)} target="_blank" rel="noreferrer" title={t('Abrir webmail')} aria-label={t('Abrir webmail')}>
              <i className="fa-solid fa-inbox" />
            </a>
            <MaisOpcoes
              itens={[
                ['fa-key', 'Mudar palavra-passe', () => openM(<SenhaModal d={d} acc={r.nome} />)],
                ['fa-sliders', 'Mudar limites', () => openM(<LimitesModal d={d} c={r} />)],
                ['fa-gear', 'Configurar o e-mail', () => openM(<DadosConta acc={r.nome} d={d} />)],
                ['fa-file-lines', 'Descarregar credenciais para Outlook', () => void baixarCredenciaisOutlook(vh, r.nome, d)],
                ['fa-download', 'Descarregar configuração Apple (iPhone, iPad, Mac)', () => configApple(r.nome, d)],
                ['fa-right-to-bracket', 'Registo SMTP de entrada', () => nav('/utilizador/rastreio/entrada/' + encodeURIComponent(r.nome + '@' + d))],
                ['fa-right-from-bracket', 'Registo SMTP de saída', () => nav('/utilizador/rastreio/saida/' + encodeURIComponent(r.nome + '@' + d))],
                ['fa-trash', 'Apagar', () => apagar([r.nome]), true],
              ]}
            />
          </span>
        )}
        bulk={[
          { t: 'Suspender', fa: 'fa-pause', run: (k) => noEmail(vh, d, { acao: 'contas-suspender', users: k }, 'Conta(s) suspensa(s)', true) },
          { t: 'Reativar', fa: 'fa-play', run: (k) => noEmail(vh, d, { acao: 'contas-reativar', users: k }, 'Conta(s) reativada(s)', true) },
          { t: 'Apagar', fa: 'fa-trash', run: (k) => apagar(k) },
          { t: 'Purgar', fa: 'fa-broom', run: (k) => openM(<PurgarModal d={d} users={k} />) },
        ]}
      />
      </div>
    </>
  );
}

function ContaNova() {
  const vh = useVH();
  const { t, nav, openM } = vh;
  const [f, setF] = useState({ user: '', senha: '', quota: '1 GB', limite: '' });
  return (
    <ComEmail>
      {({ d }) => (
        <Sec titulo="Criar conta de e-mail" desc="A conta fica com a caixa de correio, a quota e o limite de envios escolhidos.">
          <Campo label="Nome da conta" id="em-user">
            <Endereco id="em-user" value={f.user} onChange={(v) => setF({ ...f, user: v })} d={d} placeholder="ex.: geral" />
          </Campo>
          <Campo label="Palavra-passe">
            <Senha value={f.senha} onChange={(v) => setF({ ...f, senha: v })} />
          </Campo>
          <Limites quota={f.quota} setQuota={(v) => setF({ ...f, quota: v })} limite={f.limite} setLimite={(v) => setF({ ...f, limite: v })} />
          <div className="da-fim">
            <span />
            <button
              className="btn r"
              onClick={async () => {
                if (!/^[a-z0-9]([a-z0-9._-]{0,62}[a-z0-9])?$/.test(f.user)) return vh.toast('Nome: letras minúsculas, números, ponto, hífen ou _');
                const senha = f.senha || novaSenha();
                if (senha.length < 8) return vh.toast('A palavra-passe precisa de pelo menos 8 caracteres');
                const quotaMb = quotaMbInserida(f.quota);
                if (quotaMb === undefined) return vh.toast(vh.t('Indique a quota em MB ou GB, por exemplo 500 MB ou 2 GB.'));
                if (await noEmail(vh, d, { acao: 'conta-criar', user: f.user, senha, quota: quotaMb === null ? 'unlimited' : String(quotaMb), limite: f.limite }, 'Conta ' + f.user + '@' + d + ' criada', true)) {
                  nav('/utilizador/email');
                  openM(<DadosConta acc={f.user} d={d} senha={senha} />);
                }
              }}
            >
              <i className="fa-solid fa-circle-plus" />
              {t('Criar conta')}
            </button>
          </div>
        </Sec>
      )}
    </ComEmail>
  );
}

function UsoEmail() {
  const { t } = useVH();
  return (
    <ComEmail>
      {({ d, info, ler }) => {
        const rows = [...caixasNormais(info)].sort((a, b) => b.usadoMb - a.usadoMb);
        const total = rows.reduce((n, c) => n + c.usadoMb, 0);
        return (
          <>
            <div className="stats">
              <Stat title="Uso total" v={mb(total)} m={'em ' + rows.length + ' caixas'} p={0} />
              <Stat title="Caixa maior" v={rows[0] ? mb(rows[0].usadoMb) : '—'} m={rows[0] ? rows[0].nome + '@' + d : ''} p={rows[0] ? pct(rows[0].usadoMb, total) : 0} />
            </div>
            <DataTable
              id="email-uso"
              rows={rows}
              rowKey={(r) => r.nome}
              onRecarregar={ler}
              empty="Este domínio ainda não tem contas de e-mail"
              cols={[
                { k: 'conta', t: 'Conta', sort: (r) => r.nome, cell: (r) => <b>{r.nome + '@' + d}</b> },
                { k: 'uso', t: 'Espaço usado', sort: (r) => r.usadoMb, cell: (r) => mb(r.usadoMb) },
                { k: 'quota', t: 'Quota', cell: (r) => (r.quotaMb ? mb(r.quotaMb) : t('sem limite')) },
                {
                  k: 'parte',
                  t: 'Parte do total',
                  cell: (r) => (
                    <div style={{ minWidth: 160 }}>
                      <div className="bar">
                        <span style={{ width: pct(r.usadoMb, total) + '%' }} />
                      </div>
                    </div>
                  ),
                },
              ]}
            />
          </>
        );
      }}
    </ComEmail>
  );
}

export const emailPagina: ScreenFn = (vh) => {
  const [a] = vh.s.sub;
  const base = { t: 'E-mails', path: '/utilizador/email' };
  if (a === 'nova') return { title: 'Criar conta de e-mail', crumbs: [base, { t: 'Criar conta' }], body: <ContaNova /> };
  if (a === 'uso') return { title: 'Uso de e-mail', crumbs: [base, { t: 'Uso de e-mail' }], body: <UsoEmail /> };
  // estatísticas e botões integrados no cartão principal; a lista estica para toda a largura
  return { title: 'E-mails', body: <ContasLista /> };
};

// ---------- Reencaminhamentos ----------
function EditarFwdModal({ d, c }: { d: string; c: Caixa }) {
  const vh = useVH();
  const { t, closeM } = vh;
  const [txt, setTxt] = useState(c.fwd.join('\n'));
  return (
    <>
      <h3>{t('Editar reencaminhamento')}</h3>
      <p style={{ color: 'var(--muted)', marginBottom: 10 }}>
        {c.nome}@{d}
      </p>
      <div className="f">
        <label>{t('Destinos (um por linha)')}</label>
        <textarea rows={5} value={txt} onChange={(e) => setTxt(e.target.value)} />
      </div>
      <div className="mfoot">
        <button className="btn g" onClick={closeM}>
          {t('Cancelar')}
        </button>
        <button
          className="btn r"
          onClick={async () => {
            closeM();
            await noEmail(vh, d, { acao: 'fwd-editar', nome: c.nome, destinos: txt.split(/[\s,;]+/).filter(Boolean) }, 'Reencaminhamento guardado');
          }}
        >
          {t('Guardar')}
        </button>
      </div>
    </>
  );
}

function ReencaminhamentosLista() {
  const vh = useVH();
  const { t, openM } = vh;
  return (
    <ComEmail>
      {({ d, info, ler }) => {
        const rows = info.caixas.filter((c) => c.fwd.length && !info.listas.includes(c.nome));
        const apagar = (ns: string[]) =>
          openM(
            <Confirmar
              titulo="Apagar reencaminhamentos?"
              texto={'Deixa de reencaminhar ' + ns.map((n) => n + '@' + d).join(', ') + '. As caixas que só serviam para reencaminhar e estão vazias são apagadas; as outras ficam como caixas normais.'}
              ok="Apagar"
              onOk={() => noEmail(vh, d, { acao: 'fwd-apagar', nomes: ns }, 'Reencaminhamento(s) apagado(s)', true)}
            />,
          );
        // modelo global: a tabela abre o cartão; o "Ações" aparece no lugar do título da 1.ª coluna ao assinalar uma caixa
        return (
          <DataTable
            id="email-fwd"
            umaLinha
            barraFora
            empilhar="botoes-em-baixo"
            rows={rows}
            rowKey={(r) => r.nome}
            search={(r) => r.nome + ' ' + r.fwd.join(' ')}
            onRecarregar={ler}
            empty="Este domínio ainda não tem reencaminhamentos"
            cols={[
              { k: 'nome', t: 'Reencaminhamento', sort: (r) => r.nome, cell: (r) => <b>{r.nome + '@' + d}</b> },
              { k: 'dest', t: 'Destinos', cell: (r) => <span style={{ whiteSpace: 'normal', wordBreak: 'break-all' }}>{r.fwd.join(', ')}</span> },
              { k: 'copia', t: 'Cópia na caixa', cell: (r) => <span className={'tag ' + (r.soReencaminha ? 'off' : 'ok')}>{t(r.soReencaminha ? 'Não' : 'Sim')}</span> },
            ]}
            actions={(r) => (
              <span className="dns-acoes">
                <button className="btn sm btn-ed" onClick={() => openM(<EditarFwdModal d={d} c={r} />)}>
                  <i className="fa-solid fa-pen-to-square" />
                  {t('Editar')}
                </button>
                <button className="btn sm btn-rm" onClick={() => apagar([r.nome])}>
                  <i className="fa-solid fa-trash-can" />
                  {t('Apagar')}
                </button>
              </span>
            )}
            bulk={[{ t: 'Apagar', fa: 'fa-trash', run: (k) => apagar(k) }]}
          />
        );
      }}
    </ComEmail>
  );
}

/** Formulário do DA (Request Form): vários nomes e vários destinos, com pré-visualização do que vai ser criado */
function FwdNovo() {
  const vh = useVH();
  const { t, nav } = vh;
  const [nome, setNome] = useState('');
  const [nomes, setNomes] = useState<string[]>([]);
  const [dest, setDest] = useState('');
  const [dests, setDests] = useState<string[]>([]);
  const [copia, setCopia] = useState(false);
  const juntar = (v: string, l: string[], set: (x: string[]) => void, limpar: () => void, ok: (x: string) => boolean, aviso: string) => {
    const x = v.trim().toLowerCase();
    if (!x) return;
    if (!ok(x)) return vh.toast(aviso);
    if (!l.includes(x)) set([...l, x]);
    limpar();
  };
  return (
    <ComEmail>
      {({ d, info }) => {
        const todosNomes = nomes.length ? nomes : nome ? [nome] : [];
        const todosDests = dests.length ? dests : dest.includes('@') ? [dest.trim().toLowerCase()] : [];
        const existentes = todosNomes.filter((n) => info.caixas.some((c) => c.nome === n));
        return (
          <Sec titulo="Criar reencaminhamentos" desc="Indique um ou mais endereços que vão reencaminhar o e-mail para os destinos indicados.">
            <Campo label="Nome do novo reencaminhamento" id="fwd-nome">
              <span className="da-max">
                <Endereco id="fwd-nome" value={nome} onChange={setNome} d={d} placeholder="ex.: vendas" />
                <button className="btn g" onClick={() => juntar(nome, nomes, setNomes, () => setNome(''), (x) => /^[a-z0-9]([a-z0-9._-]{0,62}[a-z0-9])?$/.test(x), 'Nome inválido')}>
                  <i className="fa-solid fa-plus" />
                  {t('Adicionar')}
                </button>
              </span>
            </Campo>
            <Campo label="Adicionar destino" id="fwd-dest">
              <span className="da-max">
                <input id="fwd-dest" value={dest} onChange={(e) => setDest(e.target.value)} placeholder="nome@exemplo.com" />
                <button className="btn g" onClick={() => juntar(dest, dests, setDests, () => setDest(''), (x) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(x), 'Destino inválido')}>
                  <i className="fa-solid fa-plus" />
                  {t('Adicionar')}
                </button>
              </span>
            </Campo>
            {existentes.length > 0 && <Check checked={copia} onChange={setCopia} label="Guardar também uma cópia nas caixas que já existem" />}
            <h4 className="em-sub">{t('Pré-visualização')}</h4>
            <p className="em-nota">{t('O que vai ser criado ao carregar em Criar')}</p>
            <div className="da-caixa">
              <table className="da-tbl">
                <thead>
                  <tr>
                    <th>{t('Reencaminhamentos')}</th>
                    <th>{t('Destinos')}</th>
                  </tr>
                </thead>
                <tbody>
                  {todosNomes.length && todosDests.length ? (
                    <tr>
                      <td className="nome">
                        {todosNomes.map((n) => (
                          <span key={n} className="em-chip">
                            {n}@{d}
                            {nomes.includes(n) && <i className="fa-solid fa-xmark" onClick={() => setNomes(nomes.filter((x) => x !== n))} />}
                          </span>
                        ))}
                      </td>
                      <td className="nome">
                        {todosDests.map((x) => (
                          <span key={x} className="em-chip">
                            {x}
                            {dests.includes(x) && <i className="fa-solid fa-xmark" onClick={() => setDests(dests.filter((y) => y !== x))} />}
                          </span>
                        ))}
                      </td>
                    </tr>
                  ) : (
                    <tr>
                      <td colSpan={2} className="empty">
                        {t('Ainda não dá para criar: falta um nome e um destino')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="da-fim">
              <span />
              <button
                className="btn r"
                disabled={!todosNomes.length || !todosDests.length}
                onClick={async () => {
                  if (await noEmail(vh, d, { acao: 'fwd-criar', nomes: todosNomes, destinos: todosDests, copia }, 'Reencaminhamento(s) criado(s)', true)) nav('/utilizador/reencaminhamentos');
                }}
              >
                <i className="fa-solid fa-circle-plus" />
                {t('Criar')}
              </button>
            </div>
          </Sec>
        );
      }}
    </ComEmail>
  );
}

/** "Create forwarders from raw data": uma linha por reencaminhamento, "nome: destino1, destino2" */
function FwdTexto() {
  const vh = useVH();
  const { t, nav } = vh;
  const [txt, setTxt] = useState('');
  const linhas = txt
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [n, ...r] = l.split(':');
      return { nome: n.trim().toLowerCase().replace(/@.*$/, ''), dest: r.join(':').split(/[\s,;]+/).map((x) => x.trim().toLowerCase()).filter(Boolean) };
    });
  const validas = linhas.filter((l) => /^[a-z0-9]([a-z0-9._-]{0,62}[a-z0-9])?$/.test(l.nome) && l.dest.length && l.dest.every((x) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(x)));
  return (
    <ComEmail>
      {({ d }) => (
        <Sec titulo="Criar reencaminhamentos a partir de texto" desc="Uma linha por reencaminhamento: nome, dois pontos e os destinos separados por vírgulas.">
          <Campo label="Texto" hint={'Exemplo: vendas: ana@exemplo.com, rui@exemplo.com'}>
            <textarea className="em-txt" rows={8} value={txt} onChange={(e) => setTxt(e.target.value)} placeholder={'vendas: ana@exemplo.com, rui@exemplo.com\ninfo: geral@' + d} />
          </Campo>
          <div className="da-caixa">
            <table className="da-tbl">
              <thead>
                <tr>
                  <th>{t('Reencaminhamento')}</th>
                  <th>{t('Destinos')}</th>
                  <th>{t('Estado')}</th>
                </tr>
              </thead>
              <tbody>
                {linhas.length ? (
                  linhas.map((l, i) => (
                    <tr key={i}>
                      <td className="nome">{l.nome ? l.nome + '@' + d : '—'}</td>
                      <td className="nome">{l.dest.join(', ') || '—'}</td>
                      <td>{validas.includes(l) ? <span className="tag ok">{t('Pronto')}</span> : <span className="tag w">{t('Linha inválida')}</span>}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="empty">
                      {t('Escreva as linhas acima')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="da-fim">
            <span />
            <button
              className="btn r"
              disabled={!validas.length || validas.length !== linhas.length}
              onClick={async () => {
                let ok = 0;
                for (const l of validas) if (await noEmail(vh, d, { acao: 'fwd-criar', nomes: [l.nome], destinos: l.dest }, 'Reencaminhamento ' + l.nome + ' criado')) ok++;
                vh.recarregar(true);
                if (ok === validas.length) nav('/utilizador/reencaminhamentos');
              }}
            >
              <i className="fa-solid fa-circle-plus" />
              {t('Criar')} {validas.length || ''}
            </button>
          </div>
        </Sec>
      )}
    </ComEmail>
  );
}

export const reencaminhamentosPagina: ScreenFn = (vh) => {
  const [a] = vh.s.sub;
  const base = { t: 'Reencaminhamentos', path: '/utilizador/reencaminhamentos' };
  if (a === 'novo') return { title: 'Criar reencaminhamentos', crumbs: [base, { t: 'Criar' }], body: <FwdNovo /> };
  if (a === 'texto') return { title: 'Criar a partir de texto', crumbs: [base, { t: 'A partir de texto' }], body: <FwdTexto /> };
  return {
    title: 'Reencaminhamentos',
    descEl: <DescEmail texto="Reencaminhar e-mails para outros endereços" conta={(i) => [i.caixas.filter((c) => c.fwd.length && !i.listas.includes(c.nome)).length, 'reencaminhamento', 'reencaminhamentos']} />,
    actions: (
      <>
        <button className="btn g sec-m" onClick={() => vh.nav('/utilizador/reencaminhamentos/texto')}>
          <i className="fa-solid fa-align-left" />
          {vh.t('Criar a partir de texto')}
        </button>
        <button className="btn r" onClick={() => vh.nav('/utilizador/reencaminhamentos/novo')}>
          <i className="fa-solid fa-plus" />
          {vh.t('Criar reencaminhamento')}
        </button>
      </>
    ),
    body: <ReencaminhamentosLista />,
  };
};

// ---------- Respostas automáticas ----------
const NOTA_RESPOSTA = 'O servidor responde com o assunto "Autoreply: " seguido do assunto original, em texto simples, a cada mensagem recebida.';

function RespostasLista() {
  const vh = useVH();
  const { t, openM, nav } = vh;
  return (
    <ComEmail>
      {({ d, info, ler }) => {
        const ferias = new Set(info.ferias.map((f) => f.acc));
        const rows = info.caixas.filter((c) => c.resposta && !ferias.has(c.nome));
        const apagar = (us: string[]) =>
          openM(<Confirmar titulo="Apagar respostas automáticas?" texto={'As contas ' + us.join(', ') + ' deixam de responder sozinhas.'} ok="Apagar" onOk={() => noEmail(vh, d, { acao: 'resposta-apagar', users: us }, 'Resposta(s) apagada(s)', true)} />);
        return (
          <DataTable
            id="email-respostas"
            umaLinha
            barraFora
            empilhar="botoes-em-baixo"
            rows={rows}
            rowKey={(r) => r.nome}
            onRecarregar={ler}
            empty="Nenhuma conta deste domínio responde sozinha"
            cols={[{ k: 'conta', t: 'Conta', sort: (r) => r.nome, cell: (r) => <b>{r.nome + '@' + d}</b> }]}
            actions={(r) => (
              <span className="dns-acoes">
                <button className="btn sm btn-ed" onClick={() => nav('/utilizador/respostas/' + encodeURIComponent(r.nome))}>
                  <i className="fa-solid fa-pen-to-square" />
                  {t('Editar')}
                </button>
                <button className="btn sm btn-rm" onClick={() => apagar([r.nome])}>
                  <i className="fa-solid fa-trash-can" />
                  {t('Apagar')}
                </button>
              </span>
            )}
            bulk={[{ t: 'Apagar', fa: 'fa-trash', run: (k) => apagar(k) }]}
          />
        );
      }}
    </ComEmail>
  );
}

function RespostaForm({ acc }: { acc?: string }) {
  const vh = useVH();
  const { t, nav } = vh;
  const { d } = useEmail();
  const [user, setUser] = useState(acc || '');
  const [msg, setMsg] = useState('');
  const [lido, setLido] = useState(!acc);
  useEffect(() => {
    if (!acc || !d) return;
    fetch('/api/vhost/email?conta=' + encodeURIComponent(vh.me) + '&d=' + encodeURIComponent(d) + '&resposta=' + encodeURIComponent(acc), { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => setMsg(String(j.mensagem || '')))
      .catch(() => null)
      .finally(() => setLido(true));
  }, [acc, d, vh.me]);
  return (
    <ComEmail>
      {({ info }) => {
        const ferias = new Set(info.ferias.map((f) => f.acc));
        const livres = caixasNormais(info).filter((c) => (acc ? c.nome === acc : !c.resposta && !ferias.has(c.nome)));
        return (
          <section className="da-sec">
            <p className="da-nota">{t(NOTA_RESPOSTA)}</p>
            <Campo label="Conta que responde" id="resp-conta">
              <select id="resp-conta" className="em-sel" value={user} disabled={!!acc} onChange={(e) => setUser(e.target.value)}>
                {!acc && <option value="">{t('Escolher conta…')}</option>}
                {livres.map((c) => (
                  <option key={c.nome} value={c.nome}>
                    {c.nome}@{d}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo label="Mensagem" id="resp-msg">
              <textarea id="resp-msg" className="em-txt" rows={8} value={msg} disabled={!lido} onChange={(e) => setMsg(e.target.value)} placeholder={t('Obrigado pela sua mensagem. Respondemos logo que possível.')} />
            </Campo>
            <div className="da-fim">
              <span />
              <button
                className="btn r"
                disabled={!user || !msg.trim()}
                onClick={async () => {
                  if (await noEmail(vh, d, { acao: 'resposta-guardar', user, mensagem: msg }, 'Resposta automática guardada', true)) nav('/utilizador/respostas');
                }}
              >
                <i className="fa-solid fa-floppy-disk" />
                {t('Guardar')}
              </button>
            </div>
          </section>
        );
      }}
    </ComEmail>
  );
}

export const respostasPagina: ScreenFn = (vh) => {
  const [a] = vh.s.sub;
  const base = { t: 'Respostas automáticas', path: '/utilizador/respostas' };
  if (a === 'nova') return { title: 'Criar resposta automática', crumbs: [base, { t: 'Criar' }], body: <RespostaForm /> };
  if (a) return { title: 'Editar resposta automática', crumbs: [base, { t: a }], body: <RespostaForm key={a} acc={a} /> };
  return {
    title: 'Respostas automáticas',
    descEl: (
      <DescEmail
        texto="Contas que respondem sozinhas a quem lhes escreve"
        conta={(i) => {
          const ferias = new Set(i.ferias.map((f) => f.acc));
          return [i.caixas.filter((c) => c.resposta && !ferias.has(c.nome)).length, 'resposta automática', 'respostas automáticas'];
        }}
      />
    ),
    actions: (
      <button className="btn r" onClick={() => vh.nav('/utilizador/respostas/nova')}>
        <i className="fa-solid fa-plus" />
        {vh.t('Criar resposta automática')}
      </button>
    ),
    body: <RespostasLista />,
  };
};

// ---------- Mensagens de férias ----------
const dataPt = (v: string) => (v ? v.replace('T', ' ').replace(/^(\d{4})-(\d\d)-(\d\d)/, '$3/$2/$1') : '—');

function FeriasLista() {
  const vh = useVH();
  const { t, openM, nav } = vh;
  return (
    <ComEmail>
      {({ d, info, ler }) => {
        const apagar = (us: string[]) =>
          openM(<Confirmar titulo="Apagar mensagens de férias?" texto={'As contas ' + us.join(', ') + ' deixam de ter mensagem de férias.'} ok="Apagar" onOk={() => noEmail(vh, d, { acao: 'ferias-apagar', users: us }, 'Mensagem(ns) apagada(s)', true)} />);
        return (
          <DataTable
            id="email-ferias"
            umaLinha
            barraFora
            empilhar="botoes-em-baixo"
            rows={info.ferias}
            rowKey={(r) => r.acc}
            onRecarregar={ler}
            empty="Nenhuma mensagem de férias marcada neste domínio"
            cols={[
              { k: 'conta', t: 'Conta', sort: (r) => r.acc, cell: (r) => <b>{r.acc + '@' + d}</b> },
              { k: 'de', t: 'De', sort: (r) => r.de, cell: (r) => dataPt(r.de) },
              { k: 'ate', t: 'Até', sort: (r) => r.ate, cell: (r) => dataPt(r.ate) },
              { k: 'estado', t: 'Estado', cell: (r) => <span className={'tag ' + (r.ativa ? 'ok' : 'off')}>{t(r.ativa ? 'Ligada agora' : 'Marcada')}</span> },
            ]}
            actions={(r) => (
              <span className="dns-acoes">
                <button className="btn sm btn-ed" onClick={() => nav('/utilizador/ferias/' + encodeURIComponent(r.acc))}>
                  <i className="fa-solid fa-pen-to-square" />
                  {t('Editar')}
                </button>
                <button className="btn sm btn-rm" onClick={() => apagar([r.acc])}>
                  <i className="fa-solid fa-trash-can" />
                  {t('Apagar')}
                </button>
              </span>
            )}
            bulk={[{ t: 'Apagar', fa: 'fa-trash', run: (k) => apagar(k) }]}
          />
        );
      }}
    </ComEmail>
  );
}

function FeriasForm({ acc }: { acc?: string }) {
  const vh = useVH();
  const { t, nav } = vh;
  const hoje = new Date();
  const iso = (x: Date) => new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const [f, setF] = useState<{ user: string; de: string; ate: string; msg: string } | null>(null);
  return (
    <ComEmail>
      {({ d, info }) => {
        const existente = acc ? info.ferias.find((x) => x.acc === acc) : undefined;
        const v = f || { user: acc || '', de: existente?.de || iso(hoje), ate: existente?.ate || iso(new Date(hoje.getTime() + 7 * 86400000)), msg: existente?.msg || '' };
        const set = (x: Partial<typeof v>) => setF({ ...v, ...x });
        const ocupadas = new Set(info.ferias.map((x) => x.acc));
        const livres = caixasNormais(info).filter((c) => (acc ? c.nome === acc : !ocupadas.has(c.nome) && !c.resposta));
        return (
          <section className="da-sec">
            <p className="da-nota">{t('Esta mensagem é enviada a quem escrever para a conta durante as datas escolhidas.')}</p>
            <Campo label="Conta" id="fer-conta" hint={acc ? undefined : 'Só aparecem as contas sem resposta automática'}>
              <select id="fer-conta" className="em-sel" value={v.user} disabled={!!acc} onChange={(e) => set({ user: e.target.value })}>
                {!acc && <option value="">{t('Escolher conta…')}</option>}
                {livres.map((c) => (
                  <option key={c.nome} value={c.nome}>
                    {c.nome}@{d}
                  </option>
                ))}
              </select>
            </Campo>
            <div className="em-datas">
              <Campo label="De" id="fer-de">
                <input id="fer-de" type="datetime-local" value={v.de} onChange={(e) => set({ de: e.target.value })} />
              </Campo>
              <Campo label="Até" id="fer-ate">
                <input id="fer-ate" type="datetime-local" value={v.ate} onChange={(e) => set({ ate: e.target.value })} />
              </Campo>
            </div>
            <Campo label="Mensagem de férias" id="fer-msg" hint={NOTA_RESPOSTA}>
              <textarea id="fer-msg" className="em-txt" rows={8} value={v.msg} onChange={(e) => set({ msg: e.target.value })} placeholder={t('Estou de férias até … Para assuntos urgentes, escreva para …')} />
            </Campo>
            <div className="da-fim">
              <span />
              <button
                className="btn r"
                disabled={!v.user || !v.msg.trim() || !v.de || !v.ate}
                onClick={async () => {
                  if (v.ate <= v.de) return vh.toast('O fim tem de ser depois do início');
                  if (await noEmail(vh, d, { acao: 'ferias-guardar', user: v.user, de: v.de, ate: v.ate, mensagem: v.msg }, 'Mensagem de férias guardada', true)) nav('/utilizador/ferias');
                }}
              >
                <i className="fa-solid fa-floppy-disk" />
                {t(acc ? 'Guardar' : 'Criar')}
              </button>
            </div>
          </section>
        );
      }}
    </ComEmail>
  );
}

export const feriasPagina: ScreenFn = (vh) => {
  const [a] = vh.s.sub;
  const base = { t: 'Mensagens de férias', path: '/utilizador/ferias' };
  if (a === 'nova') return { title: 'Criar mensagem de férias', crumbs: [base, { t: 'Criar' }], body: <FeriasForm /> };
  if (a) return { title: 'Editar mensagem de férias', crumbs: [base, { t: a }], body: <FeriasForm key={a} acc={a} /> };
  return {
    title: 'Mensagens de férias',
    descEl: <DescEmail texto="Respostas que se ligam e desligam sozinhas nas datas escolhidas" conta={(i) => [i.ferias.length, 'mensagem marcada', 'mensagens marcadas']} />,
    actions: (
      <button className="btn r" onClick={() => vh.nav('/utilizador/ferias/nova')}>
        <i className="fa-solid fa-plus" />
        {vh.t('Marcar mensagem de férias')}
      </button>
    ),
    body: <FeriasLista />,
  };
};

// ---------- Filtros anti-spam ----------
// Modelo global (Silva, 14/10/2026): duas partes = dois separadores (Bloqueios | Opções) a abrir o cartão; o "Bloquear"
// que estava numa linha por cima da tabela passa ao botão principal da barra de cima, com uma janela
function BloquearModal({ d }: { d: string }) {
  const vh = useVH();
  const { t, closeM } = vh;
  const [tipo, setTipo] = useState('email');
  const [valor, setValor] = useState('');
  return (
    <>
      <h3>{t('Bloquear remetente')}</h3>
      <p style={{ color: 'var(--muted)', marginBottom: 10 }}>
        {t('O domínio')} {d} {t('deixa de aceitar e-mail deste remetente.')}
      </p>
      <div className="f">
        <label>{t('Bloquear por')}</label>
        <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="email">{t('Endereço de e-mail')}</option>
          <option value="dominio">{t('Domínio inteiro')}</option>
        </select>
      </div>
      <div className="f">
        <label>{t(tipo === 'email' ? 'Endereço' : 'Domínio')}</label>
        <span className="igrp">
          <span className="ib" style={{ cursor: 'default' }}>
            <i className={'fa-solid ' + (tipo === 'email' ? 'fa-envelope' : 'fa-globe')} />
          </span>
          <input autoFocus value={valor} onChange={(e) => setValor(e.target.value)} placeholder={tipo === 'email' ? 'nome@exemplo.com' : 'exemplo.com'} />
        </span>
      </div>
      <div className="mfoot">
        <button className="btn g" onClick={closeM}>
          {t('Cancelar')}
        </button>
        <button
          className="btn r"
          disabled={!valor.trim()}
          onClick={async () => {
            const v = valor.trim().toLowerCase();
            closeM();
            await noEmail(vh, d, { acao: 'bloqueio-juntar', tipo, valores: [v] }, 'Bloqueado');
          }}
        >
          <i className="fa-solid fa-ban" />
          {t('Bloquear')}
        </button>
      </div>
    </>
  );
}

function NovoBloqueio() {
  const vh = useVH();
  const d = dominioEmail(vh);
  return (
    <button className="btn r" disabled={!d} onClick={() => vh.openM(<BloquearModal d={d} />)}>
      <i className="fa-solid fa-ban" />
      {vh.t('Bloquear remetente')}
    </button>
  );
}

type AbaSpam = 'bloqueios' | 'opcoes';
function Spam({ aba }: { aba: AbaSpam }) {
  const vh = useVH();
  const { t, openM } = vh;
  return (
    <ComEmail>
      {({ d, info, ler }) => {
        const dom = info.dominio!;
        const rows = info.bloqueios.map((b) => ({ v: b, tipo: b.startsWith('@') ? 'Domínio' : 'E-mail' }));
        const tirar = (vs: string[]) => openM(<Confirmar titulo="Tirar bloqueios?" texto={'Volta a aceitar e-mail de ' + vs.join(', ') + '.'} ok="Tirar" onOk={() => noEmail(vh, d, { acao: 'bloqueio-tirar', valores: vs }, 'Bloqueio(s) tirado(s)')} />);
        const admin = vh.a.role === 'admin';
        return (
          <>
            <Tabs<AbaSpam>
              tabs={[
                ['bloqueios', 'Bloqueios', 'fa-ban'],
                ['opcoes', 'Opções', 'fa-shield-halved'],
              ]}
              on={aba}
              onChange={(k) => vh.nav('/utilizador/spam' + (k === 'opcoes' ? '/opcoes' : ''))}
            />
            {aba === 'bloqueios' && (
              <>
                {!info.regraBloqueios && (
                  <div className="note em-aviso">
                    <i className="fa-solid fa-circle-info" /> {t('A regra que aplica estes bloqueios ainda não está ligada no servidor de e-mail; os bloqueios ficam guardados e passam a valer quando for ligada.')}{' '}
                    {admin ? (
                      <button
                        className="btn sm btn-ed"
                        onClick={() =>
                          openM(
                            <Confirmar
                              titulo="Ligar a regra de bloqueios?"
                              texto="Acrescenta uma regra à configuração do servidor de e-mail (exim), com cópia da atual; se o exim não a aceitar, a configuração anterior é reposta. Vale para todos os domínios do servidor."
                              ok="Ligar"
                              onOk={() => noEmail(vh, d, { acao: 'bloqueios-ativar' }, 'Regra de bloqueios ligada')}
                            />,
                          )
                        }
                      >
                        {t('Ligar no servidor')}
                      </button>
                    ) : (
                      t('Peça ao administrador para a ligar.')
                    )}
                  </div>
                )}
                <DataTable
                  id="email-bloqueios"
                  umaLinha
                  barraFora
                  empilhar
                  rows={rows}
                  rowKey={(r) => r.v}
                  onRecarregar={ler}
                  empty="Este domínio não tem remetentes bloqueados"
                  cols={[
                    { k: 'tipo', t: 'Bloquear por', cell: (r) => t(r.tipo) },
                    { k: 'v', t: 'Valor', sort: (r) => r.v, cell: (r) => <b>{r.v.startsWith('@') ? r.v.slice(1) : r.v}</b> },
                  ]}
                  actions={(r) => (
                    <button className="btn sm btn-rm" onClick={() => tirar([r.v])}>
                      <i className="fa-solid fa-trash-can" />
                      {t('Tirar')}
                    </button>
                  )}
                  bulk={[{ t: 'Tirar', fa: 'fa-trash', run: (k) => tirar(k) }]}
                />
              </>
            )}
            {aba === 'opcoes' && (
              <div className="em-opcoes">
                <div>
                  <span>{t('Filtro anti-spam (SpamAssassin)')}</span>
                  <Switch checked={dom.antispam} onChange={(v) => noEmail(vh, d, { acao: 'antispam', ligar: v }, v ? 'Anti-spam ligado' : 'Anti-spam desligado')} label="Anti-spam" />
                </div>
                <div>
                  <span>{t('Ação para mensagens com spam')}</span>
                  <span className="em-radio">
                    <label>
                      <input type="radio" checked={dom.rejeitarSpam} disabled={!dom.antispam} onChange={() => noEmail(vh, d, { acao: 'rejeitar-spam', ligar: true }, 'O spam passa a ser recusado')} /> {t('Recusar o e-mail')}
                    </label>
                    <label>
                      <input type="radio" checked={!dom.rejeitarSpam} disabled={!dom.antispam} onChange={() => noEmail(vh, d, { acao: 'rejeitar-spam', ligar: false }, 'O spam passa a ser marcado e entregue')} /> {t('Marcar como spam e entregar')}
                    </label>
                  </span>
                </div>
                <div>
                  <span>{t('Antivírus (ClamAV)')}</span>
                  <Switch checked={dom.antivirus} onChange={(v) => noEmail(vh, d, { acao: 'antivirus', ligar: v }, v ? 'Antivírus ligado' : 'Antivírus desligado')} label="Antivírus" />
                </div>
              </div>
            )}
          </>
        );
      }}
    </ComEmail>
  );
}
export const spamPagina: ScreenFn = (vh) => {
  const aba: AbaSpam = vh.s.sub[0] === 'opcoes' ? 'opcoes' : 'bloqueios';
  return {
    title: 'Filtros anti-spam',
    descEl: <DescEmail texto="Remetentes bloqueados e proteção do domínio pelo SpamAssassin e pelo ClamAV" conta={(i) => [i.bloqueios.length, 'remetente bloqueado', 'remetentes bloqueados']} />,
    crumbs: aba === 'opcoes' ? [{ t: 'Filtros anti-spam', path: '/utilizador/spam' }, { t: 'Opções' }] : undefined,
    actions: <NovoBloqueio />,
    body: <Spam aba={aba} />,
  };
};

// ---------- Listas de correio ----------
function ListasLista() {
  const vh = useVH();
  const { t, openM, nav } = vh;
  return (
    <ComEmail>
      {({ d, info, ler }) => {
        const rows = info.listas.map((n) => ({ nome: n, subs: info.caixas.find((c) => c.nome === n)?.fwd.length || 0 }));
        const apagar = (ns: string[]) => openM(<Confirmar titulo="Apagar listas?" texto={'Vai apagar ' + ns.map((n) => n + '@' + d).join(', ') + ' e a lista de subscritores.'} ok="Apagar" onOk={() => noEmail(vh, d, { acao: 'lista-apagar', nomes: ns }, 'Lista(s) apagada(s)', true)} />);
        return (
          <DataTable
            id="email-listas"
            umaLinha
            barraFora
            empilhar="botoes-em-baixo"
            rows={rows}
            rowKey={(r) => r.nome}
            onRecarregar={ler}
            empty="Este domínio ainda não tem listas de correio"
            cols={[
              { k: 'nome', t: 'Lista de correio', sort: (r) => r.nome, cell: (r) => <a className="lk" onClick={() => nav('/utilizador/listas/' + encodeURIComponent(r.nome))}>{r.nome + '@' + d}</a> },
              { k: 'subs', t: 'Subscritores', sort: (r) => r.subs, cell: (r) => r.subs },
            ]}
            actions={(r) => (
              <span className="dns-acoes">
                <button className="btn sm btn-ed" onClick={() => nav('/utilizador/listas/' + encodeURIComponent(r.nome))}>
                  {t('Gerir')}
                </button>
                <button className="btn sm btn-rm" onClick={() => apagar([r.nome])}>
                  {t('Apagar')}
                </button>
              </span>
            )}
            bulk={[{ t: 'Apagar', fa: 'fa-trash', run: (k) => apagar(k) }]}
          />
        );
      }}
    </ComEmail>
  );
}

const enderecos = (txt: string) => txt.split(/[\s,;]+/).map((x) => x.trim().toLowerCase()).filter(Boolean);
const enderecoOk = (x: string) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(x);

function ListaNova() {
  const vh = useVH();
  const { t, nav } = vh;
  const [nome, setNome] = useState('');
  const [subs, setSubs] = useState('');
  return (
    <ComEmail>
      {({ d }) => (
        <Sec titulo="Criar lista de correio" desc="A lista fica com o endereço escolhido e envia uma cópia de cada mensagem a todos os subscritores.">
          <Campo label="Nome da lista" id="lst-nome">
            <Endereco id="lst-nome" value={nome} onChange={setNome} d={d} placeholder="ex.: clientes" />
          </Campo>
          <Campo label="Subscritores" id="lst-subs" hint="Um endereço por linha (ou separados por vírgulas)">
            <textarea id="lst-subs" className="em-txt" rows={6} value={subs} onChange={(e) => setSubs(e.target.value)} />
          </Campo>
          <div className="da-fim">
            <span />
            <button
              className="btn r"
              disabled={!nome || !enderecos(subs).length}
              onClick={async () => {
                const l = enderecos(subs);
                if (l.some((x) => !enderecoOk(x))) return vh.toast('Há endereços inválidos');
                if (await noEmail(vh, d, { acao: 'lista-criar', nome, subscritores: l }, 'Lista ' + nome + '@' + d + ' criada', true)) nav('/utilizador/listas/' + encodeURIComponent(nome));
              }}
            >
              <i className="fa-solid fa-circle-plus" />
              {t('Criar lista')}
            </button>
          </div>
        </Sec>
      )}
    </ComEmail>
  );
}

function ListaGerir({ nome }: { nome: string }) {
  const vh = useVH();
  const { t, openM } = vh;
  const [novos, setNovos] = useState('');
  return (
    <ComEmail>
      {({ d, info, ler }) => {
        if (!info.listas.includes(nome)) return <div className="card empty">{t('Esta lista não existe neste domínio')}</div>;
        const subs = (info.caixas.find((c) => c.nome === nome)?.fwd || []).map((e) => ({ e }));
        const tirar = (es: string[]) => openM(<Confirmar titulo="Tirar subscritores?" texto={es.join(', ') + ' deixam de receber a lista.'} ok="Tirar" onOk={() => noEmail(vh, d, { acao: 'lista-subscritores', nome, tirar: es }, 'Subscritor(es) tirado(s)')} />);
        return (
          <>
            <Sec titulo="Subscritores" desc={'Endereços que recebem o que é enviado para ' + nome + '@' + d + '.'} numeros={[['Subscritores', String(subs.length)]]}>
              <DataTable
                id="email-lista-subs"
                rows={subs}
                rowKey={(r) => r.e}
                search={(r) => r.e}
                onRecarregar={ler}
                empty="Sem subscritores"
                cols={[{ k: 'e', t: 'Endereço', sort: (r) => r.e, cell: (r) => <b>{r.e}</b> }]}
                actions={(r) => (
                  <button className="btn sm btn-rm" disabled={subs.length < 2} title={subs.length < 2 ? t('A lista tem de ficar com pelo menos um subscritor') : ''} onClick={() => tirar([r.e])}>
                    {t('Tirar')}
                  </button>
                )}
                bulk={[{ t: 'Tirar', fa: 'fa-user-minus', run: (k) => tirar(k) }]}
              />
            </Sec>
            <Sec titulo="Juntar subscritores">
              <Campo label="Endereços" id="lst-novos" hint="Um por linha (ou separados por vírgulas)">
                <textarea id="lst-novos" className="em-txt" rows={4} value={novos} onChange={(e) => setNovos(e.target.value)} />
              </Campo>
              <div className="da-fim">
                <span />
                <button
                  className="btn r"
                  disabled={!enderecos(novos).length}
                  onClick={async () => {
                    const l = enderecos(novos);
                    if (l.some((x) => !enderecoOk(x))) return vh.toast('Há endereços inválidos');
                    if (await noEmail(vh, d, { acao: 'lista-subscritores', nome, juntar: l }, l.length + ' subscritor(es) juntado(s)')) setNovos('');
                  }}
                >
                  <i className="fa-solid fa-user-plus" />
                  {t('Juntar')}
                </button>
              </div>
            </Sec>
          </>
        );
      }}
    </ComEmail>
  );
}

export const listasPagina: ScreenFn = (vh) => {
  const [a] = vh.s.sub;
  const base = { t: 'Listas de correio', path: '/utilizador/listas' };
  if (a === 'nova') return { title: 'Criar lista de correio', crumbs: [base, { t: 'Criar' }], body: <ListaNova /> };
  if (a) return { title: 'Gerir lista de correio', desc: a + '@' + dominioEmail(vh), crumbs: [base, { t: a }], body: <ListaGerir key={a} nome={a} /> };
  return {
    title: 'Listas de correio',
    descEl: <DescEmail texto="Uma mensagem para a lista chega a todos os subscritores" conta={(i) => [i.listas.length, 'lista', 'listas']} />,
    actions: (
      <button className="btn r" onClick={() => vh.nav('/utilizador/listas/nova')}>
        <i className="fa-solid fa-plus" />
        {vh.t('Criar lista de correio')}
      </button>
    ),
    body: <ListasLista />,
  };
};

// ---------- Registos MX (os registos do DNS do domínio: zona no servidor ou na Cloudflare) ----------
type Registo = { id: string; nome: string; tipo: string; valor: string; ttl: number; prio?: string };
const MODELOS_MX: Record<string, { t: string; mx: (d: string) => [string, string][] }> = {
  local: { t: 'Este servidor', mx: (d) => [['10', 'mail.' + d]] },
  google: { t: 'Google Workspace', mx: () => [['1', 'smtp.google.com']] },
  microsoft: { t: 'Microsoft 365', mx: (d) => [['0', d.replace(/\./g, '-') + '.mail.protection.outlook.com']] },
  zoho: { t: 'Zoho Mail', mx: () => [['10', 'mx.zoho.eu'], ['20', 'mx2.zoho.eu'], ['50', 'mx3.zoho.eu']] },
};

async function noDns(vh: VH, corpo: Record<string, unknown>): Promise<boolean> {
  try {
    const r = await fetch('/api/vhost/dominio', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conta: vh.me, ...corpo }) });
    const j = (await r.json().catch(() => ({}))) as { erro?: string };
    if (!r.ok) vh.toast(j.erro || 'A alteração falhou');
    return r.ok;
  } catch {
    vh.toast('Sem ligação ao site. Nada foi alterado.');
    return false;
  }
}

function MxModal({ d, r, onFeito }: { d: string; r?: Registo; onFeito: () => void }) {
  const vh = useVH();
  const { t, closeM } = vh;
  const [f, setF] = useState({ nome: r?.nome || '@', prio: r?.prio || '10', valor: (r?.valor || '').replace(/\.$/, ''), ttl: String(r ? (r.ttl === 1 ? 3600 : r.ttl) : 3600) });
  return (
    <>
      <h3>{t(r ? 'Editar registo MX' : 'Adicionar registo MX')}</h3>
      <div className="f">
        <label>{t('Nome')}</label>
        <input value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} placeholder={'@ = ' + d} />
      </div>
      <div className="f">
        <label>{t('Prioridade')}</label>
        <input inputMode="numeric" value={f.prio} onChange={(e) => setF({ ...f, prio: e.target.value.replace(/\D/g, '') })} />
      </div>
      <div className="f">
        <label>{t('Destino')}</label>
        <input value={f.valor} onChange={(e) => setF({ ...f, valor: e.target.value.trim() })} placeholder={'mail.' + d} autoFocus />
      </div>
      <div className="f">
        <label>TTL ({t('segundos')})</label>
        <input inputMode="numeric" value={f.ttl} onChange={(e) => setF({ ...f, ttl: e.target.value.replace(/\D/g, '') })} />
      </div>
      <div className="mfoot">
        <button className="btn g" onClick={closeM}>
          {t('Cancelar')}
        </button>
        <button
          className="btn r"
          onClick={async () => {
            if (!f.valor) return vh.toast('Escreva o destino');
            closeM();
            vh.toast('A alterar no servidor…');
            if (await noDns(vh, { acao: r ? 'dns-editar' : 'dns-criar', dominio: d, ...(r ? { id: r.id } : {}), tipo: 'MX', nome: f.nome, prio: f.prio, valor: f.valor, ttl: f.ttl })) {
              vh.toast(r ? 'Registo MX alterado' : 'Registo MX adicionado');
              onFeito();
            }
          }}
        >
          {t(r ? 'Guardar' : 'Adicionar')}
        </button>
      </div>
    </>
  );
}

function Mx() {
  const vh = useVH();
  const { t, openM } = vh;
  const d = dominioEmail(vh);
  const { info } = useEmail();
  const [modelo, setModelo] = useState('');
  // useGet: a página só aparece quando o DNS chega (como as outras), e ao voltar aparece logo e atualiza por trás
  const { dados, erro, ler } = useGet<{ dns: { fonte: string; zona: string; registos: Registo[] } }>(
    d ? urlDnsEmail(vh.me, d) : null,
  );
  const dns = dados?.dns ?? null;
  if (!d) return <SemEmail d="" />;
  if (!dns) return <Carregando erro={erro} ler={ler} />;
  if (dns.fonte === 'nenhuma') return <div className="note">{t('O DNS deste domínio não está neste servidor nem na Cloudflare da VisualDesign: os registos MX mudam-se onde o domínio foi registado.')}</div>;
  const rows = dns.registos.filter((r) => r.tipo === 'MX');
  const apagar = (ids: string[]) =>
    openM(
      <Confirmar
        titulo="Remover registos MX?"
        texto="Sem registos MX certos, o domínio deixa de receber e-mail."
        ok="Remover"
        onOk={async () => {
          vh.toast('A alterar no servidor…');
          for (const id of ids) await noDns(vh, { acao: 'dns-apagar', dominio: d, id });
          vh.toast('Registo(s) removido(s)');
          ler();
        }}
      />,
    );
  const aplicarModelo = () => {
    const m = MODELOS_MX[modelo];
    if (!m) return;
    openM(
      <Confirmar
        titulo={'Usar o modelo ' + m.t + '?'}
        texto={'Os registos MX atuais de ' + d + ' são trocados por: ' + m.mx(d).map(([p, v]) => p + ' ' + v).join(', ') + '.'}
        ok="Aplicar"
        onOk={async () => {
          vh.toast('A alterar no servidor…');
          for (const r of rows) await noDns(vh, { acao: 'dns-apagar', dominio: d, id: r.id });
          for (const [prio, valor] of m.mx(d)) await noDns(vh, { acao: 'dns-criar', dominio: d, tipo: 'MX', nome: '@', prio, valor, ttl: '3600' });
          vh.toast('Modelo ' + m.t + ' aplicado');
          ler();
        }}
      />,
    );
  };
  const local = rows.some((r) => r.valor.replace(/\.$/, '') === 'mail.' + d);
  return (
    <>
      {/* modelo da página de domínio (Silva, 13/10/2026): sem separadores, o "Ações" fica na linha dos títulos das
          colunas; "+ Adicionar registo" na barra de cima; nenhum botão por cima da tabela */}
      <DataTable
        id="email-mx"
        umaLinha
        barraFora
        empilhar="botoes-em-baixo"
        rows={rows}
        rowKey={(r) => r.id}
        empty="Este domínio não tem registos MX"
        cols={[
          { k: 'nome', t: 'Nome', cell: (r) => <b>{r.nome === '@' ? dns.zona : r.nome}</b> },
          { k: 'ttl', t: 'TTL', cell: (r) => (r.ttl === 1 ? 'auto' : r.ttl) },
          { k: 'tipo', t: 'Tipo', cell: () => <span className="dns-tipo t-MX">MX</span> },
          { k: 'valor', t: 'Valor', cell: (r) => (r.prio || '-') + ' ' + r.valor },
        ]}
        actions={(r) => (
          <span className="dns-acoes">
            <button className="btn sm btn-ed" onClick={() => openM(<MxModal d={d} r={r} onFeito={ler} />)}>
              <i className="fa-solid fa-pen-to-square" />
              {t('Editar')}
            </button>
            <button className="btn sm btn-rm" onClick={() => apagar([r.id])}>
              <i className="fa-solid fa-trash-can" />
              {t('Remover')}
            </button>
          </span>
        )}
        bulk={[{ t: 'Remover', fa: 'fa-trash', run: (k) => apagar(k) }]}
      />
      <p className="em-nota">* {t('Mudar os registos MX pode deixar todas as contas de e-mail sem receber mensagens.')}</p>
      <Sec titulo="Opções">
        <div className="em-opcoes">
          <div>
            <span>{t('Este servidor trata do e-mail deste domínio')}</span>
            {info?.temMail ? (
              <span className={'tag ' + (local ? 'ok' : 'w')}>{t(local ? 'Sim — o MX aponta para este servidor' : 'O e-mail está ligado aqui, mas o MX aponta para outro sítio')}</span>
            ) : (
              <button className="btn sm btn-ed" onClick={() => noEmail(vh, d, { acao: 'dominio-ligar' }, 'E-mail ligado em ' + d, true)}>
                {t('Ligar o e-mail neste servidor')}
              </button>
            )}
          </div>
          <div>
            <span>{t('Modelo de MX')}</span>
            <span className="em-bloq" style={{ margin: 0 }}>
              <select className="em-sel" value={modelo} onChange={(e) => setModelo(e.target.value)} aria-label={t('Modelo de MX')}>
                <option value="">{t('Escolher…')}</option>
                {Object.entries(MODELOS_MX).map(([k, m]) => (
                  <option key={k} value={k}>
                    {m.t}
                  </option>
                ))}
              </select>
              <button className="btn r" disabled={!modelo} onClick={aplicarModelo}>
                {t('Guardar')}
              </button>
            </span>
          </div>
        </div>
      </Sec>
    </>
  );
}
/** Leitura do DNS do domínio de e-mail (a mesma da página: memória comum) */
const urlDnsEmail = (me: string, d: string) => '/api/vhost/dominio?conta=' + encodeURIComponent(me) + '&d=' + encodeURIComponent(d) + '&so=dns';
/** "+ Adicionar registo" na barra de cima (o "+ Adicionar…" principal fica lá quando está livre) */
function NovoMx() {
  const vh = useVH();
  const d = dominioEmail(vh);
  const { dados, ler } = useGet<{ dns: { fonte: string } }>(d ? urlDnsEmail(vh.me, d) : null);
  if (!d || !dados || dados.dns.fonte === 'nenhuma') return null;
  return (
    <button className="btn r" onClick={() => vh.openM(<MxModal d={d} onFeito={ler} />)}>
      <i className="fa-solid fa-plus" />
      {vh.t('Adicionar registo')}
    </button>
  );
}
/** Descrição da barra de cima: "Definir para onde vai o e-mail do domínio | DNS na Cloudflare" */
function DescMx() {
  const vh = useVH();
  const d = dominioEmail(vh);
  const dados = useNaMemoria<{ dns: { fonte: string } }>(d ? urlDnsEmail(vh.me, d) : '');
  const f = dados?.dns.fonte;
  return (
    <>
      {vh.t('Definir para onde vai o e-mail do domínio')}
      {f && f !== 'nenhuma' && (
        <>
          <span className="pdesc-sep">|</span>
          {vh.t(f === 'cloudflare' ? 'DNS na Cloudflare' : 'DNS neste servidor')}
        </>
      )}
    </>
  );
}
export const mxPagina: ScreenFn = () => ({ title: 'Registos MX', descEl: <DescMx />, actions: <NovoMx />, body: <Mx /> });

// ---------- Rastreio de e-mail ----------
type Msg = { id: string; data: string; de: string; para: string[]; estado: string; tam: number; dir: string; motivo: string };
const ESTADOS: Record<string, [string, string]> = { entregue: ['Entregue', 'ok'], adiada: ['Adiada', 'w'], falhou: ['Falhou', 'bad'], recebida: ['Recebida', 'off'] };

function Rastreio() {
  const vh = useVH();
  const { t } = vh;
  const d = dominioEmail(vh);
  const [dirInicial, endInicial] = vh.s.sub;
  const hoje = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState({ de: new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10), ate: hoje, end: endInicial || '', estado: '', dir: ['entrada', 'saida'].includes(dirInicial) ? dirInicial : '', max: '100' });
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  const [a, setA] = useState(false);
  // O servidor só deixa ler os registos do exim: "apagar do histórico" tira as mensagens desta lista, neste navegador, sem tocar nos registos
  const chaveOcultas = 'vh-rastreio-ocultas:' + d;
  const [ocultas, setOcultas] = useState<string[]>([]);
  useEffect(() => {
    try {
      setOcultas(JSON.parse(localStorage.getItem(chaveOcultas) || '[]'));
    } catch {
      setOcultas([]);
    }
  }, [chaveOcultas]);
  const guardarOcultas = (n: string[]) => {
    setOcultas(n);
    try {
      localStorage.setItem(chaveOcultas, JSON.stringify(n));
    } catch {}
  };
  const procurar = useCallback(
    async (x = f) => {
      if (!d) return;
      setA(true);
      try {
        const q = new URLSearchParams({ conta: vh.me, d, rastreio: '1', ...x });
        const r = await fetch('/api/vhost/email?' + q.toString(), { cache: 'no-store' });
        const j = await r.json();
        if (!r.ok) throw new Error(j.erro);
        setMsgs(j.mensagens);
      } catch (e) {
        vh.toast(e instanceof Error && e.message ? e.message : 'Não foi possível ler os registos');
      } finally {
        setA(false);
      }
    },
    [d, f, vh],
  );
  const espera = useContext(EsperaPagina);
  useEffect(() => {
    // a primeira procura conta como leitura da página: a página só aparece com os resultados
    const fim = espera ? espera.comecar() : null;
    procurar().finally(() => fim?.());
  }, [d]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <p className="em-nota em-nota-linha em-rastreio" style={{ marginTop: 0 }}>
        {t('Filtrar os registos do servidor de e-mail por datas e, se quiser, por endereço, estado de entrega e direção.')}
      </p>
      <div className="em-filtros em-rastreio">
        <label>
          {t('De')}
          <input type="date" value={f.de} max={f.ate} onChange={(e) => setF({ ...f, de: e.target.value })} />
        </label>
        <label>
          {t('Até')}
          <input type="date" value={f.ate} min={f.de} max={hoje} onChange={(e) => setF({ ...f, ate: e.target.value })} />
        </label>
        <label>
          {t('Endereço')}
          <input value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} placeholder={'nome@' + d} />
        </label>
        <label>
          {t('Estado')}
          <select value={f.estado} onChange={(e) => setF({ ...f, estado: e.target.value })}>
            <option value="">{t('Todos')}</option>
            {Object.entries(ESTADOS).map(([k, [l]]) => (
              <option key={k} value={k}>
                {t(l)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('Mostrar')}
          <select value={f.dir} onChange={(e) => setF({ ...f, dir: e.target.value })}>
            <option value="">{t('Entrada e saída')}</option>
            <option value="entrada">{t('Só entrada')}</option>
            <option value="saida">{t('Só saída')}</option>
          </select>
        </label>
        <button className="btn r" disabled={a} onClick={() => procurar()} title={t('Pesquisar')} aria-label={t('Pesquisar')}>
          <i className="fa-solid fa-magnifying-glass" />
          {t('Pesquisar')}
        </button>
      </div>
      <DataTable
        id="email-rastreio"
        acoesNoFim
        rows={(msgs || []).filter((m) => !ocultas.includes(m.id))}
        rowKey={(r) => r.id}
        onRecarregar={() => procurar()}
        empty={msgs ? 'Nenhuma mensagem nestas condições' : 'A ler os registos…'}
        bulk={[
          { t: 'Mostrar o histórico escondido', fa: 'fa-eye', sempre: true, inativo: !ocultas.length, run: () => guardarOcultas([]) },
          {
            t: 'Limpar o histórico',
            fa: 'fa-broom',
            sempre: true,
            inativo: !(msgs || []).some((m) => !ocultas.includes(m.id)),
            run: () =>
              vh.openM(<Confirmar titulo="Limpar o histórico?" texto="As mensagens desta lista deixam de aparecer neste navegador. Os registos do servidor não são apagados e podem voltar a mostrar-se." ok="Limpar" onOk={() => guardarOcultas([...new Set([...ocultas, ...(msgs || []).map((m) => m.id)])])} />),
          },
          {
            t: 'Apagar do histórico',
            fa: 'fa-trash',
            run: (k) => guardarOcultas([...new Set([...ocultas, ...k])]),
          },
        ]}
        cols={[
          { k: 'dir', t: 'Direção', cell: (r) => <span title={t(r.dir === 'saida' ? 'Saída' : 'Entrada')}><i className={'fa-solid ' + (r.dir === 'saida' ? 'fa-arrow-up-right-from-square' : 'fa-arrow-down')} style={{ color: 'var(--muted)' }} /> {t(r.dir === 'saida' ? 'Saída' : 'Entrada')}</span> },
          { k: 'estado', t: 'Estado', cell: (r) => <span className={'tag ' + (ESTADOS[r.estado]?.[1] || 'off')} title={r.motivo || ''}>{t(ESTADOS[r.estado]?.[0] || r.estado)}</span> },
          { k: 'de', t: 'De', cell: (r) => r.de || '<>' },
          { k: 'para', t: 'Para', cell: (r) => r.para.join(', ') || '—' },
          { k: 'tam', t: 'Tamanho', cell: (r) => (r.tam ? (r.tam > 1048576 ? (r.tam / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(r.tam / 1024)) + ' KB') : '—') },
          { k: 'data', t: 'Data', sort: (r) => r.data, cell: (r) => dataPt(r.data.replace(' ', 'T')) },
        ]}
      />
      <p className="em-nota">{t('O servidor não regista o assunto das mensagens. Passe o rato sobre o estado para ver o motivo de uma mensagem adiada ou falhada.')}</p>
    </>
  );
}
export const rastreioPagina: ScreenFn = (vh) => {
  const [dir, end] = vh.s.sub;
  return {
    title: 'Rastreio de e-mail',
    crumbs: dir && end ? [{ t: 'E-mails', path: '/utilizador/email' }, { t: 'Rastreio de e-mail', path: '/utilizador/rastreio' }, { t: (dir === 'saida' ? 'Saída' : 'Entrada') + ' · ' + end }] : undefined,
    body: <Rastreio key={dir + '|' + end} />,
  };
};

// ---------- Migração de e-mail (IMAP → IMAP, em segundo plano no servidor) ----------
type Mig = { id: string; tipo: string; origem: string; destino: string; servidorOrigem: string; servidorDestino: string; inicio: string; fim?: string; estado: string; pastas: number; copiadas: number; existentes: number; total: number; erro: string; avisos: string[] };

function Migracoes() {
  const vh = useVH();
  const { t, openM } = vh;
  const d = dominioEmail(vh);
  const [lista, setLista] = useState<Mig[] | null>(null);
  const auto = true; // a lista atualiza-se sozinha a cada 15 s
  const ler = useCallback(async (fundo?: unknown) => {
    if (!d) return;
    try {
      const r = await fetch('/api/vhost/email?conta=' + encodeURIComponent(vh.me) + '&d=' + encodeURIComponent(d) + '&migracoes=1', { cache: 'no-store', headers: fundo === true ? FUNDO : undefined });
      const j = await r.json();
      if (r.ok) setLista(j.migracoes);
    } catch {}
  }, [d, vh.me]);
  const espera = useContext(EsperaPagina);
  useEffect(() => {
    // a primeira leitura conta para a página só aparecer com a lista
    const fim = espera ? espera.comecar() : null;
    ler().finally(() => fim?.());
  }, [ler]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!auto) return;
    const i = setInterval(() => ler(true), 15000); // em segundo plano: sem a linha do topo
    return () => clearInterval(i);
  }, [auto, ler]);
  const corEstado = (e: string) => (e === 'terminada' ? 'ok' : e === 'falhou' || e === 'interrompida' ? 'bad' : e === 'parada' ? 'off' : 'w');
  return (
    <>
      {/* sem caixas de seleção não há "Ações" (Silva, 13/10/2026): só os botões de começar uma migração, na barra de
          cima; a lista atualiza-se sozinha a cada 15 s */}
      <DataTable
        id="email-migracoes"
        empilhar
        rows={lista || []}
        rowKey={(r) => r.id}
        empty={lista ? 'Nenhuma migração' : 'A ler…'}
        cols={[
          { k: 'destino', t: 'E-mail de destino', cell: (r) => <b>{r.destino}</b> },
          { k: 'origem', t: 'E-mail de origem', cell: (r) => r.origem },
          { k: 'sd', t: 'Servidor de destino', cell: (r) => t(r.servidorDestino) },
          { k: 'so', t: 'Servidor de origem', cell: (r) => t(r.servidorOrigem) },
          { k: 'inicio', t: 'Começou', sort: (r) => r.id, cell: (r) => r.inicio },
          {
            k: 'estado',
            t: 'Estado',
            cell: (r) => (
              <span title={[r.erro, ...(r.avisos || [])].filter(Boolean).join(' · ')}>
                <span className={'tag ' + corEstado(r.estado)}>{t(r.estado)}</span>
                <small style={{ color: 'var(--muted)', display: 'block', marginTop: 3, whiteSpace: 'normal', minWidth: 140 }}>
                  {r.copiadas}/{r.total} {t('mensagens')}
                  {r.existentes ? ' · ' + r.existentes + ' ' + t('já lá estavam') : ''}
                </small>
              </span>
            ),
          },
        ]}
        actions={(r) =>
          /^a (copiar|ligar)$/.test(r.estado) ? (
            <button className="btn sm btn-rm" onClick={() => openM(<Confirmar titulo="Parar a migração?" texto="O que já foi copiado fica copiado. Pode começar de novo mais tarde: as mensagens repetidas não são copiadas outra vez." ok="Parar" onOk={() => noEmail(vh, d, { acao: 'migracao-parar', id: r.id }, 'Migração parada').then(ler)} />)}>
              {t('Parar')}
            </button>
          ) : (
            <button className="btn sm g" onClick={() => noEmail(vh, d, { acao: 'migracao-apagar', id: r.id }, 'Registo apagado').then(ler)}>
              {t('Apagar registo')}
            </button>
          )
        }
      />
      <p className="em-nota">{t('Esta página mostra as migrações de caixas de correio começadas aqui. Uma migração nova começa-se nos botões em cima; a lista atualiza-se sozinha e a migração corre no servidor mesmo que feche o painel.')}</p>
    </>
  );
}

function MigracaoForm({ tipo }: { tipo: 'importar' | 'exportar' }) {
  const vh = useVH();
  const { t, nav } = vh;
  const [f, setF] = useState({ host: '', user: '', senha: '', local: '', senhaLocal: '', inseguro: false });
  const set = (x: Partial<typeof f>) => setF({ ...f, ...x });
  return (
    <ComEmail>
      {({ d, info }) => {
        const contas = caixasNormais(info);
        const fora = (
          <>
            <Campo label="Servidor" id="mig-host" hint="ex.: mail.exemplo.com (IMAP, porta 993 ou 143)">
              <input id="mig-host" value={f.host} onChange={(e) => set({ host: e.target.value.trim() })} placeholder="mail.exemplo.com" />
            </Campo>
            <Campo label="Utilizador" id="mig-user">
              <input id="mig-user" value={f.user} onChange={(e) => set({ user: e.target.value.trim() })} placeholder="nome@exemplo.com" autoComplete="off" />
            </Campo>
            <Campo label="Palavra-passe" id="mig-senha">
              <input id="mig-senha" type="password" value={f.senha} onChange={(e) => set({ senha: e.target.value })} autoComplete="new-password" />
            </Campo>
            <Check checked={f.inseguro} onChange={(v) => set({ inseguro: v })} label="Aceitar o certificado do outro servidor mesmo que não seja válido" />
          </>
        );
        const aqui = (
          <>
            <Campo label="Conta" id="mig-local">
              <select id="mig-local" className="em-sel" value={f.local} onChange={(e) => set({ local: e.target.value })}>
                <option value="">{t('Escolher conta…')}</option>
                {contas.map((c) => (
                  <option key={c.nome} value={c.nome}>
                    {c.nome}@{d}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo label="Palavra-passe da conta" id="mig-senha-local">
              <input id="mig-senha-local" type="password" value={f.senhaLocal} onChange={(e) => set({ senhaLocal: e.target.value })} autoComplete="new-password" />
            </Campo>
          </>
        );
        return (
          <>
            <Sec titulo="Origem" desc={tipo === 'importar' ? 'A caixa de correio no outro servidor, de onde vêm as mensagens.' : 'A conta deste servidor que vai ser copiada.'}>
              {tipo === 'importar' ? fora : aqui}
            </Sec>
            <Sec titulo="Destino" desc={tipo === 'importar' ? 'A conta deste servidor que recebe as mensagens.' : 'A caixa de correio no outro servidor, para onde vão as mensagens.'}>
              {tipo === 'importar' ? aqui : fora}
              <div className="da-fim">
                <span className="em-nota" style={{ margin: 0 }}>
                  {t('As palavras-passe só servem para esta cópia e não ficam guardadas.')}
                </span>
                <button
                  className="btn r"
                  disabled={!f.host || !f.user || !f.senha || !f.local || !f.senhaLocal}
                  onClick={async () => {
                    if (await noEmail(vh, d, { acao: 'migracao-iniciar', tipo, ...f }, 'Migração começada')) nav('/utilizador/imapsync');
                  }}
                >
                  <i className="fa-solid fa-play" />
                  {t('Começar a migração')}
                </button>
              </div>
            </Sec>
          </>
        );
      }}
    </ComEmail>
  );
}

export const migracaoPagina: ScreenFn = (vh) => {
  const [a] = vh.s.sub;
  const base = { t: 'Migração de e-mail', path: '/utilizador/imapsync' };
  if (a === 'importar') return { title: 'Importar e-mails', crumbs: [base, { t: 'Importar' }], body: <MigracaoForm tipo="importar" /> };
  if (a === 'exportar') return { title: 'Exportar e-mails', crumbs: [base, { t: 'Exportar' }], body: <MigracaoForm tipo="exportar" /> };
  return {
    title: 'Migração de e-mail',
    actions: (
      <>
        <button className="btn g sec-m" onClick={() => vh.nav('/utilizador/imapsync/exportar')}>
          <i className="fa-solid fa-upload" />
          {vh.t('Exportar e-mails')}
        </button>
        <button className="btn r" onClick={() => vh.nav('/utilizador/imapsync/importar')}>
          <i className="fa-solid fa-download" />
          {vh.t('Importar e-mails')}
        </button>
      </>
    ),
    body: <Migracoes />,
  };
};

// ---------- Avançado: Catch-all (e-mail enviado para endereços que não existem) ----------
function CatchAll() {
  const vh = useVH();
  const { t } = vh;
  const [esc, setEsc] = useState<{ modo: string; dest: string } | null>(null);
  return (
    <ComEmail>
      {({ d, info }) => {
        const atual = info.dominio?.catchall && !/^(no|:fail:|:blackhole:)?$/i.test(info.dominio.catchall) ? info.dominio.catchall : '';
        const v = esc || { modo: atual ? 'endereco' : 'desligado', dest: atual };
        return (
          <Sec titulo="Catch-all" desc="O que acontece ao e-mail enviado para um endereço deste domínio que não existe.">
            <div className="em-catch">
              <label className={v.modo === 'desligado' ? 'on' : ''}>
                <input type="radio" checked={v.modo === 'desligado'} onChange={() => setEsc({ ...v, modo: 'desligado' })} />
                <span>
                  <b>{t('Desligado')}</b> <span className="tag ok">{t('recomendado')}</span>
                  <small>{t('O remetente recebe um aviso de que o endereço não existe. Usar o catch-all aumenta o trabalho do servidor e atrai spam.')}</small>
                </span>
              </label>
              <label className="mut">
                <input type="radio" disabled />
                <span>
                  <b>{t('Apagar todo o e-mail para endereços inexistentes')}</b>
                  <small>{t('O servidor de e-mail deste painel não tem esta opção (seria aceitar spam para o deitar fora); deixe desligado.')}</small>
                </span>
              </label>
              <label className={v.modo === 'endereco' ? 'on' : ''}>
                <input type="radio" checked={v.modo === 'endereco'} onChange={() => setEsc({ ...v, modo: 'endereco' })} />
                <span>
                  <b>{t('Enviar para um endereço')}</b>
                  <small>{t('Todo o e-mail para endereços que não existem vai para esta caixa.')}</small>
                  <input value={v.dest} disabled={v.modo !== 'endereco'} onChange={(e) => setEsc({ ...v, dest: e.target.value.trim() })} placeholder={'geral@' + d} aria-label={t('Endereço')} />
                </span>
              </label>
            </div>
            <div className="da-fim">
              <span />
              <button
                className="btn r"
                onClick={async () => {
                  if (v.modo === 'endereco' && !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v.dest)) return vh.toast('Escreva um endereço de e-mail completo');
                  if (await noEmail(vh, d, { acao: 'catchall', destino: v.modo === 'endereco' ? v.dest : '' }, v.modo === 'endereco' ? 'Catch-all para ' + v.dest : 'Catch-all desligado', true)) setEsc(null);
                }}
              >
                <i className="fa-solid fa-floppy-disk" />
                {t('Guardar')}
              </button>
            </div>
          </Sec>
        );
      }}
    </ComEmail>
  );
}
export const catchAllPagina: ScreenFn = () => ({ title: 'Catch-all', body: <CatchAll /> });

// ---------- Extras: Webmail (Roundcube) ----------
function Webmail() {
  const { t, me } = useVH();
  return (
    <ComEmail>
      {({ d, info }) => {
        const rows = caixasNormais(info);
        return (
          <>
            <div className="note">
              {t('Carregue em Abrir ao lado de uma conta: o Roundcube abre noutra janela já dentro da caixa, sem pedir a palavra-passe.')}
              {!info.dominio?.webmail && ' ' + t('O webmail está desligado neste domínio.')}
            </div>
            <DataTable
              id="webmail"
              rows={rows}
              rowKey={(r) => r.nome}
              empty="Este domínio ainda não tem contas de e-mail"
              cols={[
                { k: 'conta', t: 'Conta', sort: (r) => r.nome, cell: (r) => <b>{r.nome + '@' + d}</b> },
                { k: 'uso', t: 'Uso da caixa', cell: (r) => mb(r.usadoMb) + (r.quotaMb ? ' / ' + mb(r.quotaMb) : '') },
              ]}
              actions={(r) => (
                <a className="btn g sm" href={webmailUrl(me, d, r.nome)} target="_blank" rel="noreferrer">
                  <i className="fa-solid fa-inbox" />
                  {t('Abrir')}
                </a>
              )}
            />
          </>
        );
      }}
    </ComEmail>
  );
}
export const webmailPagina: ScreenFn = (vh) => ({
  title: 'Webmail',
  actions: (
    <a className="btn r" href={webmailUrl(vh.me, dominioEmail(vh))} target="_blank" rel="noreferrer">
      <i className="fa-solid fa-inbox" />
      {vh.t('Abrir webmail')}
    </a>
  ),
  body: <Webmail />,
});

// ---------- Extras: Mailmarketing (a plataforma do site da VisualDesign, com os domínios desta conta) ----------
const MailMarketingSection = dynamic(() => import('@/components/dashboard/MailMarketingSection').then((m) => m.MailMarketingSection), {
  ssr: false,
  loading: () => null, // a abrir: só a linha do topo
});

// separadores do Mailmarketing ↔ endereço (/utilizador/mailmarketing, /contactos, /historico), para o caminho no topo seguir o clique
const ABAS_MM: [string, string, string, string][] = [
  ['comp', '', 'Editor de mensagem', 'fa-pen-to-square'],
  ['subs', 'contactos', 'Contactos', 'fa-address-book'],
  ['camp', 'historico', 'Histórico', 'fa-clock-rotate-left'],
];
function Mailmarketing({ aba }: { aba: string }) {
  const vh = useVH();
  const sites = vh.a.domains.filter((x) => !x.soEmail && !x.soDominio).map((x) => ({ domain: x.name }));
  const ir = (k: string) => vh.nav('/utilizador/mailmarketing' + ((ABAS_MM.find((x) => x[0] === k) || ABAS_MM[0])[1] ? '/' + (ABAS_MM.find((x) => x[0] === k) || ABAS_MM[0])[1] : ''));
  return (
    <>
      <Tabs tabs={ABAS_MM.map(([k, , l, fa]) => [k, l, fa] as [string, string, string])} on={aba} onChange={ir} />
      <div className="vh-mailmarketing">
        <MailMarketingSection sites={sites} currentUserEmail={vh.a.email} activeTab={aba} onTabChange={ir} isAdminAccount={vh.a.role === 'admin'} />
      </div>
    </>
  );
}
export const mailmarketingPagina: ScreenFn = (vh) => {
  const a = ABAS_MM.find((x) => x[1] && x[1] === vh.s.sub[0]);
  return {
    title: 'Mailmarketing',
    crumbs: a ? [{ t: 'Mailmarketing', path: '/utilizador/mailmarketing' }, { t: a[2] }] : undefined,
    body: <Mailmarketing aba={a ? a[0] : 'comp'} />,
  };
};
