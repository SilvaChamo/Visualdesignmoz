'use client';

// Menu Avançado do painel Utilizador (páginas copiadas do DirectAdmin, ligadas ao Hestia por /api/vhost/avancado):
// Handlers e MIME, Cópias de segurança, Tarefas cron, Chaves de login, Pastas protegidas, Chaves SSH,
// Firewall de aplicação (ModSecurity), Git, WordPress e Antivírus. O Catch-all está em paginas/email.tsx.
import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useVH, type VH } from '../context';
import type { ScreenFn } from '../screens';
import { Check, DataTable, novaSenha, Senha, Switch, Tabs } from './componentes';
import { Confirmar } from './pacotes';
import { PluginsWp, type OpPluginWp } from './wp-plugins';
import { OpcoesWordPress, type OpcoesWp } from './wp-opcoes';
import { BOCADO, CampoEnvio, idEnvio, tam as tamTxt, type Envio } from './sistema';
import { useGet } from '../carga';
import { EN } from '../generated/data';
import { NoTopoCartao } from '../ui';
import dynamic from 'next/dynamic';
import { dataDe, dataPt } from '../datas';

/** Editor de blocos do WordPress (Gutenberg), carregado só quando se abre uma página para editar */
const EditorBlocos = dynamic(() => import('./gutenberg'), { ssr: false, loading: () => <div className="gb-espera" /> });

// ---------- Peças comuns ----------
const url = (me: string, ver: string, extra: Record<string, string> = {}) => '/api/vhost/avancado?' + new URLSearchParams({ conta: me, ver, ...extra }).toString();

/** Lê um endereço da API (memória comum do painel: aparece logo ao voltar e atualiza-se por trás) */
function useLer<T>(ver: string, extra: Record<string, string> = {}, ativo = true) {
  const { me } = useVH();
  return useGet<T>(ativo ? url(me, ver, extra) : null);
}

async function noServidor(vh: VH, corpo: Record<string, unknown>, ok: string, recarregar = false): Promise<Record<string, unknown> | null> {
  vh.toast('A alterar no servidor…');
  try {
    const r = await fetch('/api/vhost/avancado', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conta: vh.me, ...corpo }) });
    const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    if (!r.ok) {
      vh.toast(String(j.erro || 'A alteração falhou'));
      return null;
    }
    if (recarregar) vh.recarregar(true);
    vh.toast(ok);
    return j;
  } catch {
    vh.toast('Sem ligação ao site. Nada foi alterado.');
    return null;
  }
}

export function Carregando({ erro, ler }: { erro: string; ler: () => void }) {
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

export function Sec({ titulo, desc, numeros, extra, children }: { titulo: string; desc?: string; numeros?: [string, string][]; extra?: ReactNode; children: ReactNode }) {
  const { t } = useVH();
  return (
    <section className="da-sec">
      <div className="seccao-h">
        <div>
          <h3>{t(titulo)}</h3>
          {desc && <p>{t(desc)}</p>}
        </div>
        {(numeros || extra) && (
          <div className="numeros">
            {numeros?.map(([k, v]) => (
              <span key={k}>
                {t(k)} <b>{v}</b>
              </span>
            ))}
            {extra}
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

/** Domínio do seletor, só entre os sites da conta */
function siteAtual(vh: VH): string {
  const sites = vh.a.domains.filter((x) => !x.soEmail && !x.soDominio).map((x) => x.name); // o primeiro é o principal da conta
  return vh.s.dominio && sites.includes(vh.s.dominio) ? vh.s.dominio : sites[0] || '';
}

function SemSite() {
  const { t, nav } = useVH();
  return (
    <div className="card empty">
      <p>{t('Esta conta ainda não tem nenhum site.')}</p>
      <button className="btn r" onClick={() => nav('/utilizador/dominios/novo')}>
        <i className="fa-solid fa-plus" />
        {t('Adicionar domínio')}
      </button>
    </div>
  );
}

/** Texto mostrado uma só vez (chave secreta, chave privada): copiar e descarregar */
function SegredoModal({ titulo, aviso, valores, ficheiro }: { titulo: string; aviso: string; valores: [string, string][]; ficheiro?: [string, string] }) {
  const { t, closeM, toast } = useVH();
  return (
    <>
      <h3>{t(titulo)}</h3>
      <p style={{ color: 'var(--muted)', marginBottom: 10 }}>{t(aviso)}</p>
      {valores.map(([k, v]) => (
        <div className="f" key={k}>
          <label>{t(k)}</label>
          {v.includes('\n') ? <textarea readOnly rows={7} value={v} onFocus={(e) => e.target.select()} /> : <input readOnly value={v} onFocus={(e) => e.target.select()} />}
        </div>
      ))}
      <div className="mfoot">
        <button
          className="btn g"
          onClick={() => {
            navigator.clipboard?.writeText(valores.map(([, v]) => v).join('\n'));
            toast('Copiado');
          }}
        >
          <i className="fa-solid fa-copy" />
          {t('Copiar')}
        </button>
        {ficheiro && (
          <button
            className="btn g"
            onClick={() => {
              const a = document.createElement('a');
              a.href = URL.createObjectURL(new Blob([ficheiro[1]], { type: 'text/plain' }));
              a.download = ficheiro[0];
              a.click();
            }}
          >
            <i className="fa-solid fa-download" />
            {t('Descarregar')}
          </button>
        )}
        <button className="btn r" onClick={closeM}>
          {t('Fechar')}
        </button>
      </div>
    </>
  );
}

// ---------- Handlers do Apache e tipos MIME ----------
type Tipo = { nome: string; ext: string };
const SISTEMA_HANDLERS: Tipo[] = [
  { nome: 'application/x-httpd-php', ext: 'php' },
  { nome: 'cgi-script', ext: 'cgi' },
  { nome: 'cgi-script', ext: 'pl' },
  { nome: 'server-parsed', ext: 'shtml' },
  { nome: 'type-map', ext: 'var' },
];
const SISTEMA_MIME: Tipo[] = [
  { nome: 'text/html', ext: 'html' },
  { nome: 'text/css', ext: 'css' },
  { nome: 'application/javascript', ext: 'js' },
  { nome: 'application/json', ext: 'json' },
  { nome: 'image/svg+xml', ext: 'svg' },
  { nome: 'image/webp', ext: 'webp' },
  { nome: 'font/woff2', ext: 'woff2' },
  { nome: 'application/pdf', ext: 'pdf' },
  { nome: 'application/zip', ext: 'zip' },
  { nome: 'video/mp4', ext: 'mp4' },
];

function ListaTipos({ d, qual, aba, dados, ler }: { d: string; qual: 'handlers' | 'mime'; aba: 'meus' | 'sistema'; dados: { handlers: Tipo[]; mime: Tipo[] }; ler: () => void }) {
  const vh = useVH();
  const { t, openM } = vh;
  const setAba = (k: 'meus' | 'sistema') => vh.nav('/utilizador/handlers' + (qual === 'mime' ? '/mime' : '') + (k === 'sistema' ? '/sistema' : ''));
  const [f, setF] = useState({ nome: '', ext: '' });
  const meus = dados[qual];
  const guardar = async (lista: Tipo[], msg: string) => {
    const corpo = { acao: 'tipos-guardar', dominio: d, handlers: qual === 'handlers' ? lista : dados.handlers, mime: qual === 'mime' ? lista : dados.mime };
    if (await noServidor(vh, corpo, msg)) {
      ler();
      return true;
    }
    return false;
  };
  const rotulo = qual === 'handlers' ? 'Handler' : 'Tipo MIME';
  const agrupar = (l: Tipo[]) => Object.entries(l.reduce<Record<string, string[]>>((m, x) => ({ ...m, [x.nome]: [...(m[x.nome] || []), x.ext] }), {})).map(([nome, exts]) => ({ nome, exts }));
  return (
    <>
      <Tabs
        sub
        tabs={[
          ['meus', qual === 'handlers' ? 'Handlers definidos por si' : 'Tipos MIME definidos por si'],
          ['sistema', qual === 'handlers' ? 'Handlers do sistema' : 'Tipos MIME do sistema'],
        ]}
        on={aba}
        onChange={setAba}
      />
      <DataTable
        id={'tipos-' + qual + '-' + aba}
        rows={agrupar(aba === 'meus' ? meus : qual === 'handlers' ? SISTEMA_HANDLERS : SISTEMA_MIME)}
        rowKey={(r) => r.nome}
        empty={aba === 'meus' ? (qual === 'handlers' ? 'Não há handlers definidos' : 'Não há tipos MIME definidos') : 'Nada para mostrar'}
        cols={[
          { k: 'nome', t: rotulo, cell: (r) => <b>{r.nome}</b> },
          { k: 'ext', t: 'Extensões', cell: (r) => r.exts.map((x) => '.' + x).join(' ') },
        ]}
        actions={
          aba === 'meus'
            ? (r) => (
                <button
                  className="btn sm btn-rm"
                  onClick={() => openM(<Confirmar titulo={'Apagar ' + r.nome + '?'} texto={'Deixa de valer para ' + r.exts.map((x) => '.' + x).join(', ') + ' em ' + d + '.'} ok="Apagar" onOk={() => guardar(meus.filter((x) => x.nome !== r.nome), 'Apagado')} />)}
                >
                  <i className="fa-solid fa-trash-can" />
                  {t('Apagar')}
                </button>
              )
            : undefined
        }
      />
      {aba === 'meus' && (
        <Sec titulo={qual === 'handlers' ? 'Criar handler' : 'Juntar tipo MIME'}>
          <div className="em-datas">
            <Campo label={rotulo} id={'tp-nome-' + qual} hint={qual === 'handlers' ? 'O identificador do handler no Apache. Use o mesmo para juntar outra extensão.' : 'O tipo MIME (ex.: application/x-font-ttf). Use o mesmo para juntar outra extensão.'}>
              <input id={'tp-nome-' + qual} value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value.trim() })} placeholder={qual === 'handlers' ? 'ex.: application/x-httpd-php' : 'ex.: application/x-font-ttf'} />
            </Campo>
            <Campo label="Extensão" id={'tp-ext-' + qual} hint="Uma extensão de ficheiro, sem o ponto.">
              <input id={'tp-ext-' + qual} value={f.ext} onChange={(e) => setF({ ...f, ext: e.target.value.trim().replace(/^\./, '').toLowerCase() })} placeholder="ex.: ttf" />
            </Campo>
          </div>
          <div className="da-fim">
            <span className="em-nota" style={{ margin: 0 }}>
              {t('Fica no .htaccess do site, num bloco próprio do VisualHost.')}
            </span>
            <button
              className="btn r"
              disabled={!f.nome || !f.ext}
              onClick={async () => {
                if (meus.some((x) => x.nome === f.nome && x.ext === f.ext)) return vh.toast('Já existe');
                if (await guardar([...meus, f], rotulo + ' guardado')) setF({ nome: '', ext: '' });
              }}
            >
              <i className="fa-solid fa-circle-plus" />
              {t(qual === 'handlers' ? 'Criar handler' : 'Juntar tipo MIME')}
            </button>
          </div>
        </Sec>
      )}
    </>
  );
}

function HandlersMime({ aba, sub }: { aba: 'handlers' | 'mime'; sub: 'meus' | 'sistema' }) {
  const vh = useVH();
  const d = siteAtual(vh);
  const setAba = (k: 'handlers' | 'mime') => vh.nav('/utilizador/handlers' + (k === 'mime' ? '/mime' : ''));
  const { dados, erro, ler } = useLer<{ handlers: Tipo[]; mime: Tipo[] }>('tipos', { d }, !!d);
  if (!d) return <SemSite />;
  if (!dados) return <Carregando erro={erro} ler={ler} />;
  return (
    <>
      <Tabs
        tabs={[
          ['handlers', 'Handlers do Apache', 'fa-gears'],
          ['mime', 'Tipos MIME', 'fa-file-code'],
        ]}
        on={aba}
        onChange={setAba}
      />
      <ListaTipos key={aba} d={d} qual={aba} aba={sub} dados={dados} ler={ler} />
    </>
  );
}
export const handlersPagina: ScreenFn = (vh) => {
  const [a, b] = vh.s.sub;
  const aba = a === 'mime' ? 'mime' : 'handlers';
  const sub = (a === 'sistema' || b === 'sistema') ? 'sistema' : 'meus';
  const crumbs: { t: string; path?: string }[] = [{ t: 'Handlers e MIME', path: '/utilizador/handlers' }];
  if (aba === 'mime') crumbs.push({ t: 'Tipos MIME', path: '/utilizador/handlers/mime' });
  if (sub === 'sistema') crumbs.push({ t: aba === 'mime' ? 'Tipos MIME do sistema' : 'Handlers do sistema' });
  return { title: 'Handlers e MIME', crumbs: crumbs.length > 1 ? crumbs.map((c, i) => (i === crumbs.length - 1 ? { t: c.t } : c)) : undefined, dominios: 'sites', body: <HandlersMime aba={aba} sub={sub} /> };
};

// ---------- Cópias de segurança ----------
type Copia = { f: string; tamanhoMb: number; data: string; web: string; dns: string; mail: string; db: string; cron: string; udir: string; duracao: number };
type Agenda = { id: number; freq: 'diaria' | 'semanal' | 'mensal'; hora: number; min: number; dia: number; pausada: boolean };
type InfoBackups = { agendas: Agenda[]; limite: number; naFila: boolean; podeCarregar?: boolean; exclusoes: Record<string, string>; copias: Copia[]; sites: string[]; emails: string[]; dns: string[]; bds: string[] };
const mbTxt = (n: number) => (n >= 1024 ? (n / 1024).toFixed(2).replace('.', ',') + ' GB' : n + ' MB');

// Textos novos da página de Cópias de segurança, já em inglês
{
  const novas: Record<string, string> = {
    'Guardar escolhas': 'Save choices',
    'Carregar cópia': 'Upload backup',
    'Para restaurar de um ficheiro do computador, carregue a cópia aqui.': 'To restore from a file on your computer, upload the backup here.',
    'Carregar cópia de segurança': 'Upload a backup',
    'Carregar cópia do computador': 'Upload a backup from your computer',
    'Procura no computador o ficheiro .tar de uma cópia descarregada, carrega-o e restaura-o.': 'Browse your computer for the .tar file of a downloaded backup, upload it and restore it.',
    'Escolha no computador o ficheiro .tar de uma cópia que descarregou. Depois de carregada, aparece na lista e pode restaurá-la.': 'Choose on your computer the .tar file of a backup you downloaded. Once uploaded, it appears in the list and you can restore it.',
    'Arraste a cópia para aqui': 'Drag the backup here',
    'Escolha um ficheiro .tar (uma cópia de segurança descarregada).': 'Choose a .tar file (a downloaded backup).',
    'O ficheiro está vazio.': 'The file is empty.',
    'Cópia carregada: escolha como a restaurar': 'Backup uploaded: choose how to restore it',
    'Marque pelo menos uma parte para a cópia.': 'Tick at least one part for the backup.',
    'A guardar…': 'Saving…',
    'Espere que as escolhas fiquem guardadas.': 'Wait for your choices to be saved.',
    'Escolhas guardadas': 'Choices saved',
    'Sites': 'Sites',
    'Outras pastas da conta': 'Other account folders',
    'A cópia corre em segundo plano; pode fechar o painel.': 'The backup runs in the background; you can close the panel.',
    'Ou deixe de fora só alguns itens (vale para as cópias seguintes, também as agendadas)': 'Or leave out only some items (applies to the next backups, scheduled ones too)',
    'Vai junto com a parte E-mail': 'Included with the Email part',
    'Cópias agendadas': 'Scheduled backups',
    'As cópias que correm sozinhas, na hora escolhida': 'The backups that run by themselves, at the chosen time',
    'O agendamento usa as escolhas da página "Criar cópia".': 'The schedule uses the choices on the "Create backup" page.',
    'Modificar agendamento': 'Edit schedule',
    'agendamentos': 'schedules',
    'Restaurar': 'Restore',
    'Ainda não há nenhuma cópia agendada.': 'There is no scheduled backup yet.',
    'E-mail (com respostas automáticas e definições)': 'Email (with auto-responders and settings)',
    'Em pausa': 'Paused',
    'Em pausa: não corre': 'Paused: does not run',
    'Próxima execução': 'Next run',
    'Última cópia': 'Last backup',
    'O que entra': 'What goes in',
    'Executar agora': 'Run now',
    'Modificar': 'Edit',
    'Pôr em pausa': 'Pause',
    'Reativar': 'Resume',
    'Eliminar': 'Delete',
    'Eliminar o agendamento?': 'Delete the schedule?',
    'A cópia deixa de correr sozinha. As cópias já guardadas ficam.': 'The backup stops running by itself. The backups already saved stay.',
    'Agendamento em pausa': 'Schedule paused',
    'Agendamento reativado': 'Schedule resumed',
    'Armazenamento de cópias do servidor': 'Server backup storage',
    'Tudo (sites, e-mail com respostas automáticas e definições, bases de dados, zonas DNS, tarefas cron e outras pastas)': 'Everything (sites, email with auto-responders and settings, databases, DNS zones, cron jobs and other folders)',
    'Definições de e-mail': 'Email settings',
    'Respostas automáticas': 'Auto-responders',
    'Restauro geral': 'Full restore',
    'Restauro específico': 'Specific restore',
    'Restaurar a cópia de': 'Restore the backup of',
    'Vai repor TUDO o que está nesta cópia: sites, e-mail, bases de dados, DNS, tarefas cron e pastas. O que existe agora é substituído.': 'This will restore EVERYTHING in this backup: sites, email, databases, DNS, cron jobs and folders. What exists now is replaced.',
    'Restaurar a cópia geral': 'Restore the full backup',
    'Restaurar o que escolhi': 'Restore what I chose',
    'Só volta o que marcar abaixo; tudo o resto fica como está. O que for restaurado substitui o que existe agora.': 'Only what you tick below comes back; everything else stays as it is. What is restored replaces what exists now.',
    'Escolha se quer repor tudo o que está na cópia ou só uma parte.': 'Choose whether to restore everything in the backup or only a part.',
    'Cópia geral': 'Full backup',
    'Parcial / específico': 'Partial / specific',
    'Repõe tudo o que está na cópia (sites, e-mail, bases de dados, DNS, cron e pastas). O que existe agora é substituído.': 'Restores everything in the backup (sites, email, databases, DNS, cron and folders). What exists now is replaced.',
    'Escolhe só o que repor (por exemplo, um site ou uma base de dados). Tudo o resto fica como está.': 'Choose only what to restore (for example, one site or one database). Everything else stays as it is.',
    'Restaurar a cópia geral?': 'Restore the full backup?',
    'Repõe tudo o que está na cópia de {0}: sites, e-mail, bases de dados, DNS, tarefas cron e pastas. O que existe agora é substituído.': 'Restores everything in the backup of {0}: sites, email, databases, DNS, cron jobs and folders. What exists now is replaced.',
    'Restaurar tudo': 'Restore everything',
    'Agendar backup': 'Schedule backup',
    'Agendar cópia de segurança': 'Schedule a backup',
    'Agendar': 'Schedule',
    'Agendada': 'Scheduled',
    'Cópia agendada': 'Backup scheduled',
    'Remover agendamento': 'Remove schedule',
    'Agendamento removido': 'Schedule removed',
    'A cópia corre sozinha na hora escolhida, com o que está marcado na página (o que entra e o que fica de fora).': 'The backup runs by itself at the chosen time, with what is ticked on the page (what goes in and what is left out).',
    'Quando': 'When',
    'Onde': 'Where',
    'Dia da semana': 'Day of the week',
    'Dia do mês': 'Day of the month',
    'Hora': 'Time',
    'Todos os dias': 'Every day',
    'Todas as semanas': 'Every week',
    'Todos os meses': 'Every month',
    'Até ao dia 28, para valer em todos os meses.': 'Up to day 28, so it applies to every month.',
    'No armazenamento de cópias do servidor (as mais antigas saem quando se passa o número que o pacote guarda).': 'In the server backup storage (the oldest ones go when the number the package keeps is exceeded).',
    'Todos os dias às': 'Every day at',
    'No dia': 'On day',
    'de cada mês às': 'of each month at',
    'às': 'at',
    'Atualizar o WordPress para a versão': 'Update WordPress to version',
  };
  for (const [pt, en] of Object.entries(novas)) if (!(pt in EN)) EN[pt] = en;
}

const PARTES_COPIA: [string, string][] = [
  ['WEB', 'Sites'],
  ['DNS', 'Zonas DNS'],
  ['MAIL', 'E-mail'],
  ['DB', 'Bases de dados'],
  ['CRON', 'Tarefas cron'],
  ['USER', 'Outras pastas da conta'],
];

/** O que entra na cópia (Silva, 21/10/2026): a grelha com as partes da conta — marcada entra, desmarcada fica toda de fora ("*" = a parte
 *  toda); as exclusões por item que já existam no servidor mantêm-se. Silva, 23/10/2026: grava logo ao marcar, sem botão, e sem bloquear —
 *  pode-se continuar a marcar enquanto grava; cada gravação leva o que está marcado nesse momento (a última escolha ganha). */
function Exclusoes({ info, aoMudar }: { info: InfoBackups; aoMudar: (porGuardar: boolean) => void }) {
  const vh = useVH();
  const { t } = vh;
  const partes = PARTES_COPIA.map(([k]) => k);
  const doServidor = () => Object.fromEntries(partes.map((k) => [k, new Set((info.exclusoes[k] || '').split(',').filter(Boolean))])) as Record<string, Set<string>>;
  const serie = (v: Record<string, Set<string>>) => partes.map((k) => [...(v[k] || [])].sort().join(',')).join('|');
  const [x, setX] = useState<Record<string, Set<string>>>(doServidor);
  const atual = useRef(x); // o que está marcado agora (sem esperar pelo próximo desenho)
  const guardado = useRef(serie(x)); // o que o servidor já tem
  const aCorrer = useRef(false);
  const [gravado, setGravado] = useState(guardado.current);
  const [feito, setFeito] = useState(false);
  const entra = (v: Record<string, Set<string>>, k: string) => !(v[k] || new Set()).has('*');
  const nenhuma = partes.every((k) => !entra(x, k));
  const porGuardar = serie(x) !== gravado;
  useEffect(() => aoMudar(porGuardar), [porGuardar]); // eslint-disable-line react-hooks/exhaustive-deps
  const gravar = async () => {
    if (aCorrer.current) return; // já está a gravar: o ciclo apanha a escolha mais recente quando acabar esta
    aCorrer.current = true;
    try {
      for (;;) {
        const v = atual.current;
        if (serie(v) === guardado.current || partes.every((k) => !entra(v, k))) break;
        const exclusoes = Object.fromEntries(partes.map((k) => [k, [...(v[k] || [])].join(',')]));
        try {
          const r = await fetch('/api/vhost/avancado', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conta: vh.me, acao: 'backup-exclusoes', exclusoes }) });
          if (!r.ok) {
            const j = (await r.json().catch(() => ({}))) as { erro?: string };
            throw new Error(j.erro || 'A alteração falhou');
          }
        } catch (er) {
          vh.toast(er instanceof Error && er.message !== 'Failed to fetch' ? er.message : 'Sem ligação ao site. Nada foi alterado.');
          // volta ao que o servidor tem
          const volta = Object.fromEntries(partes.map((k) => [k, new Set(guardado.current.split('|')[partes.indexOf(k)].split(',').filter(Boolean))])) as Record<string, Set<string>>;
          atual.current = volta;
          setX(volta);
          return;
        }
        guardado.current = serie(v);
        setGravado(guardado.current);
      }
      setFeito(serie(atual.current) === guardado.current);
    } finally {
      aCorrer.current = false;
    }
  };
  const mudar = (k: string, on: boolean) => {
    const antes = new Set(doServidor()[k]);
    antes.delete('*');
    const novo = { ...atual.current, [k]: on ? antes : new Set(['*']) };
    atual.current = novo;
    setX(novo);
    setFeito(false);
    void gravar();
  };
  return (
    <>
      <div className="bk-grelha">
        {PARTES_COPIA.map(([k, l]) => (
          <Check key={k} checked={entra(x, k)} onChange={(on) => mudar(k, on)} label={l} />
        ))}
      </div>
      <div className="bk-guardar" aria-live="polite">
        {nenhuma ? <small>{t('Marque pelo menos uma parte para a cópia.')}</small> : porGuardar ? <small>{t('A guardar…')}</small> : feito ? <small>{t('Escolhas guardadas')}</small> : null}
      </div>
    </>
  );
}

function RestaurarEscolhas({ c, onFeito }: { c: Copia; onFeito: () => void }) {
  const vh = useVH();
  const { t } = vh;
  const partes: [string, string, string][] = [
    ['web', 'Sites', c.web],
    ['dns', 'Zonas DNS', c.dns],
    ['mail', 'E-mail', c.mail],
    ['db', 'Bases de dados', c.db],
    ['cron', 'Tarefas cron', c.cron],
    ['udir', 'Outras pastas da conta', c.udir],
  ];
  const lista = (v: string) => (v ? v.split(',').filter(Boolean) : []);
  // sites, zonas DNS, domínios de e-mail e bases de dados escolhem-se um a um; as outras partes voltam inteiras. Tudo começa desmarcado: a
  // pessoa marca à mão o que quer repor (Silva, 21/10/2026)
  const porItem = new Set(['web', 'dns', 'mail', 'db']);
  const [itens, setItens] = useState<Record<string, string[]>>({});
  const [inteiras, setInteiras] = useState<Record<string, boolean>>({});
  // cada parte começa fechada e abre-se ao marcar a sua caixa, com tudo o que tem marcado para se tirar o que não se quer (Silva, 21/10/2026)
  const [abertas, setAbertas] = useState<Record<string, boolean>>({});
  const escolhidos = (k: string, v: string) => (itens[k] || []).filter((x) => lista(v).includes(x));
  const alternar = (k: string, x: string, on: boolean) => setItens({ ...itens, [k]: on ? [...(itens[k] || []), x] : (itens[k] || []).filter((y) => y !== x) });
  // a caixa da parte: abre a parte com todos os itens marcados, ou fecha-a e limpa-os
  const alternarParte = (k: string, v: string, on: boolean) => {
    if (!porItem.has(k)) return setInteiras({ ...inteiras, [k]: on });
    setAbertas({ ...abertas, [k]: on });
    setItens({ ...itens, [k]: on ? lista(v) : [] });
  };
  const parteMarcada = (k: string, v: string) => (porItem.has(k) ? !!abertas[k] || (lista(v).length === 1 && escolhidos(k, v).length === 1) : !!inteiras[k]);
  // o valor que o servidor recebe: "*" (tudo), a lista escolhida ou "no" (não restaurar)
  const valorDe = (k: string, v: string) => {
    if (!porItem.has(k)) return inteiras[k] && v ? '*' : 'no';
    const esc = escolhidos(k, v);
    return esc.length === 0 ? 'no' : esc.length === lista(v).length ? '*' : esc.join(',');
  };
  const algum = partes.some(([k, , v]) => valorDe(k, v) !== 'no');
  return (
    <>
      {partes.map(([k, l, v]) => (
        <div key={k} className="bk-rest-linha">
          <Check checked={parteMarcada(k, v)} onChange={(on) => alternarParte(k, v, on)} label={l} muted={!v} disabled={!v} />
          {porItem.has(k) && lista(v).length > 1 ? (
            abertas[k] && (
            <div className="av-parte-itens">
              {lista(v).map((x) => (
                <Check key={x} checked={(itens[k] || []).includes(x)} onChange={(on) => alternar(k, x, on)} label={x} />
              ))}
            </div>
            )
          ) : (
            <small>{v ? lista(v).slice(0, 6).join(', ') + (lista(v).length > 6 ? '…' : '') : t('nada nesta cópia')}</small>
          )}
        </div>
      ))}
      <div className="bk-rest-acoes">
        <button
          className="btn r"
          disabled={!algum}
          onClick={async () => {
            const corpo: Record<string, unknown> = { acao: 'backup-restaurar', f: c.f };
            for (const [k, , v] of partes) corpo[k] = valorDe(k, v);
            if (await noServidor(vh, corpo, 'Restauro marcado: começa dentro de momentos')) onFeito();
          }}
        >
          <i className="fa-solid fa-clock-rotate-left" />
          {t('Restaurar o que escolhi')}
        </button>
      </div>
    </>
  );
}

const DIAS_SEMANA = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const dois = (n: number) => String(n).padStart(2, '0');
/** "Todos os dias às 03:00", "Às segundas-feiras às 03:00", "No dia 5 de cada mês às 03:00" */
function textoAgenda(a: Agenda, t: (x: string) => string): string {
  const h = dois(a.hora) + ':' + dois(a.min);
  if (a.freq === 'semanal') return t('Todas as semanas') + ' (' + t(DIAS_SEMANA[a.dia] || '') + ') ' + t('às') + ' ' + h;
  if (a.freq === 'mensal') return t('No dia') + ' ' + a.dia + ' ' + t('de cada mês às') + ' ' + h;
  return t('Todos os dias às') + ' ' + h;
}

/** Próxima vez que a cópia agendada corre */
function proximaExecucao(a: Agenda): Date {
  const agora = new Date();
  const d = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), a.hora, a.min, 0, 0);
  if (a.freq === 'diaria') {
    if (d <= agora) d.setDate(d.getDate() + 1);
  } else if (a.freq === 'semanal') {
    d.setDate(d.getDate() + ((a.dia - d.getDay() + 7) % 7));
    if (d <= agora) d.setDate(d.getDate() + 7);
  } else {
    d.setDate(a.dia);
    if (d <= agora) {
      d.setMonth(d.getMonth() + 1);
      d.setDate(a.dia);
    }
  }
  return d;
}
const dataHora = (d: Date) => dataDe(d);

/** O cartão da cópia agendada (como o do agendamento do DirectAdmin): quando, para quem, para onde e o que entra, com executar agora, modificar,
 *  pausar e eliminar */
function CartaoAgenda({ a, dados, ler }: { a: Agenda; dados: InfoBackups; ler: () => void }) {
  const vh = useVH();
  const { t, openM, me } = vh;
  const entra = PARTES_COPIA.filter(([k]) => !(dados.exclusoes[k] || '').split(',').includes('*')).map(([k, l]) => (k === 'MAIL' ? t('E-mail (com respostas automáticas e definições)') : t(l)));
  const ultima = dados.copias[0]?.data;
  const gravar = (pausada: boolean) => noServidor(vh, { acao: 'backup-agendar', id: a.id, freq: a.freq, hora: a.hora, min: a.min, dia: a.dia, pausada }, pausada ? 'Agendamento em pausa' : 'Agendamento reativado');
  return (
    <div className={'bk-agenda' + (a.pausada ? ' pausada' : '')}>
      <div className="bk-agenda-tit">
        <i className="fa-regular fa-clock" />
        <div>
          <h3>{textoAgenda(a, t)}</h3>
          <small>{t('O agendamento usa as escolhas da página "Criar cópia".')}</small>
        </div>
        {a.pausada && <span className="tag w">{t('Em pausa')}</span>}
      </div>
      <div className="bk-agenda-grelha">
        <div className="bk-agenda-cruz">
          <div>
            <i className="fa-solid fa-user" />
            <span>
              <small>{t('Conta')}</small>
              <b>{me}</b>
            </span>
          </div>
          <div>
            <i className="fa-regular fa-calendar" />
            <span>
              <small>{t('Próxima execução')}</small>
              <b>{a.pausada ? t('Em pausa: não corre') : dataHora(proximaExecucao(a))}</b>
            </span>
          </div>
          <div>
            <i className="fa-solid fa-hard-drive" />
            <span>
              <small>{t('Destino')}</small>
              <b>{t('Armazenamento de cópias do servidor')}</b>
            </span>
          </div>
          <div>
            <i className="fa-solid fa-clock-rotate-left" />
            <span>
              <small>{t('Última cópia')}</small>
              <b>{ultima || '—'}</b>
            </span>
          </div>
        </div>
        <div className="bk-agenda-col bk-agenda-entra">
          <div>
            <i className="fa-solid fa-list-check" />
            <span>
              <small>{t('O que entra')}</small>
              {entra.length ? (
                <ul>
                  {entra.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              ) : (
                <b>—</b>
              )}
            </span>
          </div>
        </div>
      </div>
      <div className="bk-agenda-acoes">
        <button className="btn g" disabled={dados.naFila} onClick={async () => (await noServidor(vh, { acao: 'backup-criar' }, 'Cópia marcada: começa dentro de momentos')) && ler()}>
          <i className="fa-solid fa-rotate" />
          {t('Executar agora')}
        </button>
        <button className="btn g" onClick={() => openM(<AgendarModal atual={a} onFeito={ler} />)}>
          <i className="fa-solid fa-pen" />
          {t('Modificar')}
        </button>
        <button className="btn g" onClick={async () => (await gravar(!a.pausada)) && ler()}>
          <i className={'fa-solid ' + (a.pausada ? 'fa-play' : 'fa-pause')} />
          {t(a.pausada ? 'Reativar' : 'Pôr em pausa')}
        </button>
        <span className="sp" />
        <button
          className="btn g bk-eliminar"
          onClick={() => openM(<Confirmar titulo="Eliminar o agendamento?" texto="A cópia deixa de correr sozinha. As cópias já guardadas ficam." ok="Eliminar" onOk={async () => (await noServidor(vh, { acao: 'backup-agenda-apagar', id: a.id }, 'Agendamento removido')) && ler()} />)}
        >
          <i className="fa-solid fa-trash-can" />
          {t('Eliminar')}
        </button>
      </div>
    </div>
  );
}

/** Cópia agendada (modelo do agendamento de cópias do DirectAdmin: Quando · Onde · O quê). Aqui o "Onde" é sempre o armazenamento de cópias do
 *  servidor e o "O quê" são as escolhas da página (o que entra e o que fica de fora). */
function AgendarModal({ atual, onFeito }: { atual: Agenda | null; onFeito: () => void }) {
  const vh = useVH();
  const { t, closeM } = vh;
  const [freq, setFreq] = useState<Agenda['freq']>(atual?.freq || 'diaria');
  const [hora, setHora] = useState(atual?.hora ?? 3);
  const [min, setMin] = useState(atual?.min ?? 0);
  const [dia, setDia] = useState(atual ? atual.dia : 0);
  const mudarFreq = (f: Agenda['freq']) => {
    setFreq(f);
    setDia(f === 'mensal' ? 1 : 0);
  };
  return (
    <>
      <h3>{t(atual ? 'Modificar agendamento' : 'Agendar cópia de segurança')}</h3>
      <p style={{ color: 'var(--muted)', marginBottom: 12, lineHeight: 1.5 }}>
        {t('A cópia corre sozinha na hora escolhida, com o que está marcado na página (o que entra e o que fica de fora).')}
      </p>
      <Campo label="Quando">
        <select className="sel" value={freq} onChange={(e) => mudarFreq(e.target.value as Agenda['freq'])}>
          <option value="diaria">{t('Todos os dias')}</option>
          <option value="semanal">{t('Todas as semanas')}</option>
          <option value="mensal">{t('Todos os meses')}</option>
        </select>
      </Campo>
      {freq === 'semanal' && (
        <Campo label="Dia da semana">
          <select className="sel" value={dia} onChange={(e) => setDia(Number(e.target.value))}>
            {DIAS_SEMANA.map((d, i) => (
              <option key={d} value={i}>
                {t(d)}
              </option>
            ))}
          </select>
        </Campo>
      )}
      {freq === 'mensal' && (
        <Campo label="Dia do mês" hint="Até ao dia 28, para valer em todos os meses.">
          <select className="sel" value={dia} onChange={(e) => setDia(Number(e.target.value))}>
            {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </Campo>
      )}
      <Campo label="Hora">
        <select
          className="sel"
          value={hora * 60 + min}
          onChange={(e) => {
            const v = Number(e.target.value);
            setHora(Math.floor(v / 60));
            setMin(v % 60);
          }}
        >
          {Array.from({ length: 96 }, (_, i) => i * 15).map((v) => (
            <option key={v} value={v}>
              {dois(Math.floor(v / 60)) + ':' + dois(v % 60)}
            </option>
          ))}
        </select>
      </Campo>
      <Campo label="Onde">
        <span>{t('No armazenamento de cópias do servidor (as mais antigas saem quando se passa o número que o pacote guarda).')}</span>
      </Campo>
      <div className="mfoot">
        <button className="btn g" onClick={closeM}>
          {t('Cancelar')}
        </button>
        <button
          className="btn r"
          onClick={async () => {
            closeM();
            if (await noServidor(vh, { acao: 'backup-agendar', id: atual?.id, freq, hora, min, dia, pausada: atual?.pausada === true }, 'Cópia agendada')) onFeito();
          }}
        >
          <i className="fa-solid fa-calendar-check" />
          {t('Agendar')}
        </button>
      </div>
    </>
  );
}

/** Carregar uma cópia de segurança do computador (Silva, 23/10/2026): um ficheiro .tar feito com "Descarregar" (ou de outro servidor). Vai aos
 *  bocados de 16 MB; ao chegar, entra na lista de cópias e abre-se o painel de restauro dela. Só o administrador (o servidor também o exige). */
function CarregarCopiaModal({ onFeito }: { onFeito: (f: string) => void }) {
  const vh = useVH();
  const { t, closeM, me } = vh;
  const [e, setE] = useState<Envio | null>(null);
  const [arrasto, setArrasto] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);
  const xhr = useRef<XMLHttpRequest | null>(null);
  const fechado = useRef(false);
  useEffect(() => {
    fechado.current = false;
    return () => {
      fechado.current = true;
      xhr.current?.abort();
    };
  }, []);
  const bocado = (env: Envio, ini: number, fim: number) =>
    new Promise<string>((ok, ko) => {
      const x = new XMLHttpRequest();
      xhr.current = x;
      x.upload.onprogress = (ev) => {
        env.feito = Math.min(env.f.size, ini + ev.loaded);
        if (!fechado.current) setE({ ...env });
      };
      x.onload = () => {
        let j: { ok?: boolean; erro?: string; f?: string } = {};
        try {
          j = JSON.parse(x.responseText);
        } catch {}
        if (x.status === 200 && j.ok) ok(j.f || '');
        else ko(new Error(j.erro || 'O envio falhou'));
      };
      x.onerror = () => ko(new Error('Sem ligação ao site.'));
      x.onabort = () => ko(new Error('cancelado'));
      x.open('POST', '/api/vhost/avancado');
      x.setRequestHeader('Content-Type', 'application/octet-stream');
      x.setRequestHeader('x-vh-bk', env.id);
      x.setRequestHeader('x-vh-conta', me);
      x.setRequestHeader('x-vh-inicio', String(ini));
      x.setRequestHeader('x-vh-total', String(env.f.size));
      if (fim >= env.f.size) {
        x.setRequestHeader('x-vh-fim', '1');
        x.setRequestHeader('x-vh-nome', encodeURIComponent(env.f.name));
      }
      x.send(env.f.slice(ini, fim));
    });
  const enviar = async (f: File | undefined) => {
    if (!f || (e && e.estado === 'envio')) return;
    if (!/\.tar$/i.test(f.name)) return setE({ id: '', f, feito: 0, estado: 'erro', erro: t('Escolha um ficheiro .tar (uma cópia de segurança descarregada).') });
    if (f.size === 0) return setE({ id: '', f, feito: 0, estado: 'erro', erro: t('O ficheiro está vazio.') });
    const env: Envio = { id: idEnvio(), f, feito: 0, estado: 'envio' };
    setE({ ...env });
    try {
      let nome = '';
      for (let ini = 0; ini < f.size; ini += BOCADO) nome = await bocado(env, ini, Math.min(f.size, ini + BOCADO));
      env.estado = 'ok';
      env.feito = f.size;
      if (fechado.current) return;
      setE({ ...env });
      closeM();
      vh.toast(t('Cópia carregada: escolha como a restaurar'));
      onFeito(nome);
    } catch (er) {
      const m = er instanceof Error ? er.message : 'O envio falhou';
      env.estado = m === 'cancelado' ? 'cancelado' : 'erro';
      env.erro = m;
      if (!fechado.current) setE({ ...env });
    }
  };
  const aEnviar = e?.estado === 'envio';
  return (
    <div className="fmda-up">
      <h3>{t('Carregar cópia de segurança')}</h3>
      <p className="fmda-up-para">{t('Escolha no computador o ficheiro .tar de uma cópia que descarregou. Depois de carregada, aparece na lista e pode restaurá-la.')}</p>
      <div
        className={'fmda-up-zona' + (arrasto ? ' on' : '')}
        onClick={() => !aEnviar && entrada.current?.click()}
        onDragOver={(ev) => {
          ev.preventDefault();
          setArrasto(true);
        }}
        onDragLeave={() => setArrasto(false)}
        onDrop={(ev) => {
          ev.preventDefault();
          setArrasto(false);
          void enviar(ev.dataTransfer.files[0]);
        }}
      >
        <i className="fa-solid fa-cloud-arrow-up" />
        <b>{t('Arraste a cópia para aqui')}</b>
        <span>
          {t('ou')} <u>{t('escolha no computador')}</u>
        </span>
      </div>
      <input
        ref={entrada}
        type="file"
        accept=".tar,application/x-tar"
        hidden
        onChange={(ev) => {
          void enviar(ev.target.files?.[0]);
          ev.target.value = '';
        }}
      />
      {e && (
        <ul className="fmda-up-lista">
          <li className={'est-' + e.estado}>
            <i className="fa-solid fa-box-archive" />
            <div className="fmda-up-info">
              <div className="fmda-up-linha">
                <b title={e.f.name}>{e.f.name}</b>
                <span>{tamTxt(e.f.size)}</span>
              </div>
              <CampoEnvio p={e.f.size ? Math.round((e.feito / e.f.size) * 100) : 0} estado={e.estado} erro={e.erro} />
            </div>
          </li>
        </ul>
      )}
      <div className="mfoot">
        <button className={'btn ' + (aEnviar ? 'g' : 'r')} onClick={closeM}>
          {t(aEnviar ? 'Cancelar e fechar' : 'Fechar')}
        </button>
      </div>
    </div>
  );
}

type ModoRestauro = 'escolher' | 'geral' | 'parcial';
/** Painel que desliza para baixo, por baixo da cópia (Silva, 21/10/2026): primeiro as duas maneiras de restaurar, lado a lado — a cópia geral, que
 *  repõe tudo, ou a parcial, em que se escolhe o que repor. A parcial mostra as escolhas no mesmo sítio; a geral, o botão de restaurar a cópia geral. */
function PainelRestaurar({ c, modo, setModo, fechar, onFeito, onCarregar }: { c: Copia; modo: ModoRestauro; setModo: (m: ModoRestauro) => void; fechar: () => void; onFeito: () => void; onCarregar?: () => void }) {
  const vh = useVH();
  const { t, openM } = vh;
  const feito = () => {
    fechar();
    onFeito();
  };
  const tudo = async () => {
    const corpo: Record<string, unknown> = { acao: 'backup-restaurar', f: c.f };
    for (const [k, v] of [['web', c.web], ['dns', c.dns], ['mail', c.mail], ['db', c.db], ['cron', c.cron], ['udir', c.udir]]) corpo[k] = v ? '*' : 'no';
    if (await noServidor(vh, corpo, 'Restauro marcado: começa dentro de momentos')) feito();
  };
  const descricao =
    modo === 'geral'
      ? t('Vai repor TUDO o que está nesta cópia: sites, e-mail, bases de dados, DNS, tarefas cron e pastas. O que existe agora é substituído.')
      : modo === 'parcial'
        ? t('Só volta o que marcar abaixo; tudo o resto fica como está. O que for restaurado substitui o que existe agora.')
        : t('Escolha se quer repor tudo o que está na cópia ou só uma parte.');
  return (
    <div className="bk-rest-painel">
      <div className="bk-rest-cab">
        <div className="bk-rest-tit">
          <b>
            {t('Restaurar a cópia de')} {dataPt(c.data)} · {mbTxt(c.tamanhoMb)}
          </b>
          <small>{descricao}</small>
        </div>
        <div className="bk-rest-dir">
          {modo === 'geral' && (
            <button
              className="btn r"
              onClick={() => openM(<Confirmar titulo="Restaurar a cópia geral?" texto={'Tudo o que está na cópia de ' + c.data + ' volta e substitui o que existe agora.'} ok="Restaurar" onOk={tudo} />)}
            >
              <i className="fa-solid fa-clock-rotate-left" />
              {t('Restaurar a cópia geral')}
            </button>
          )}
          <button className="btn g sm iconbtn" title={t('Fechar')} aria-label={t('Fechar')} onClick={fechar}>
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
      </div>
      {modo === 'escolher' && (
        <div className="bk-rest-corpo so-vertical">
          <div className={'bk-rest-opcoes' + (onCarregar ? ' tres' : '')}>
            <button onClick={() => setModo('geral')}>
              <i className="fa-solid fa-boxes-stacked" />
              <span>
                <b>{t('Restauro geral')}</b>
                <small>{t('Repõe tudo o que está na cópia (sites, e-mail, bases de dados, DNS, cron e pastas). O que existe agora é substituído.')}</small>
              </span>
            </button>
            <button onClick={() => setModo('parcial')}>
              <i className="fa-solid fa-list-check" />
              <span>
                <b>{t('Restauro específico')}</b>
                <small>{t('Escolhe só o que repor (por exemplo, um site ou uma base de dados). Tudo o resto fica como está.')}</small>
              </span>
            </button>
            {onCarregar && (
              <button onClick={onCarregar}>
                <i className="fa-solid fa-cloud-arrow-up" />
                <span>
                  <b>{t('Carregar cópia do computador')}</b>
                  <small>{t('Procura no computador o ficheiro .tar de uma cópia descarregada, carrega-o e restaura-o.')}</small>
                </span>
              </button>
            )}
          </div>
        </div>
      )}
      {modo === 'parcial' && (
        <div className="bk-rest-corpo sem-recuo">
          <RestaurarEscolhas c={c} onFeito={feito} />
        </div>
      )}
    </div>
  );
}

function Backups({ aba }: { aba: 'criar' | 'agendadas' }) {
  const vh = useVH();
  const { t, openM, me } = vh;
  const setAba = (k: 'criar' | 'agendadas') => vh.nav('/utilizador/backups' + (k === 'agendadas' ? '/agendadas' : ''));
  const { dados, erro, ler } = useLer<InfoBackups>('backups');
  const [aberta, setAberta] = useState<{ f: string; modo: ModoRestauro } | null>(null);
  const [porGuardar, setPorGuardar] = useState(false);
  // carregar uma cópia do computador: ao chegar, entra na lista e abre-se já o painel de restauro dela
  const carregar = () =>
    openM(
      <CarregarCopiaModal
        onFeito={(f) => {
          ler();
          if (f) setAberta({ f, modo: 'escolher' });
        }}
      />,
    );
  if (!dados) return <Carregando erro={erro} ler={ler} />;
  const tabela = () => (
    <DataTable
      id="backups-c"
      rows={dados.copias}
      rowKey={(r) => r.f}
      onRecarregar={ler}
      linhaExtra={(r) => (aberta?.f === r.f ? <PainelRestaurar c={r} modo={aberta.modo} setModo={(modo) => setAberta({ f: r.f, modo })} fechar={() => setAberta(null)} onFeito={ler} onCarregar={dados.podeCarregar ? carregar : undefined} /> : null)}
      empty="Ainda não há cópias de segurança"
      cols={[
        { k: 'data', t: 'Data', sort: (r) => r.data, cell: (r) => <b>{dataPt(r.data)}</b> },
        { k: 'tam', t: 'Tamanho', sort: (r) => r.tamanhoMb, cell: (r) => mbTxt(r.tamanhoMb) },
        { k: 'cont', t: 'Conteúdo', cell: (r) => <span style={{ whiteSpace: 'normal' }}>{[r.web && 'sites', r.mail && 'e-mail', r.db && 'bases de dados', r.dns && 'DNS', r.cron && 'cron'].filter(Boolean).join(', ') || '—'}</span> },
        { k: 'dur', t: 'Duração', cell: (r) => (r.duracao ? r.duracao + ' min' : '—'), hidden: true },
      ]}
      actions={(r) => (
        <span className="dns-acoes">
          <button className={'btn sm btn-ed' + (aberta?.f === r.f ? ' on' : '')} aria-expanded={aberta?.f === r.f} onClick={() => setAberta(aberta?.f === r.f ? null : { f: r.f, modo: 'escolher' })}>
            <i className="fa-solid fa-clock-rotate-left" />
            {t('Restaurar')}
            <i className={'fa-solid ' + (aberta?.f === r.f ? 'fa-caret-up' : 'fa-caret-down')} style={{ marginLeft: 4 }} />
          </button>
          <a className="btn sm btn-ed" href={url(me, 'descarregar', { f: r.f })}>
            <i className="fa-solid fa-download" />
            {t('Descarregar')}
          </a>
          <button className="btn sm btn-rm" onClick={() => openM(<Confirmar titulo="Apagar cópia?" texto={'Vai apagar a cópia de ' + dataPt(r.data) + ' (' + mbTxt(r.tamanhoMb) + ').'} ok="Apagar" onOk={async () => (await noServidor(vh, { acao: 'backup-apagar', f: r.f }, 'Cópia apagada')) && ler()} />)}>
            <i className="fa-solid fa-trash-can" />
            {t('Apagar')}
          </button>
        </span>
      )}
    />
  );
  return (
    <>
      <Tabs
        tabs={[
          ['criar', 'Cópias de segurança', 'fa-box-archive'],
          ['agendadas', 'Cópias agendadas', 'fa-calendar-days'],
        ]}
        on={aba}
        onChange={setAba}
      />
      {aba === 'criar' ? (
        <>
          {/* Modelo novo (Silva, 21/10/2026): em cima da linha, o título em letra light e a descrição (a nota e as cópias guardadas); por baixo,
              à esquerda, as escolhas do que entra na cópia e, à direita, os botões */}
          <NoTopoCartao
            daPagina
            titulo={t('Cópia de segurança completa')}
            descTitulo={
              <>
                {t('A cópia corre em segundo plano; pode fechar o painel.')}
                {dados.agendas.length > 0 && (
                  <>
                    {' '}
                    · {t('Agendada')}: {dados.agendas.length === 1 ? textoAgenda(dados.agendas[0], t) : dados.agendas.length + ' ' + t('agendamentos')}
                  </>
                )}
              </>
            }
          >
            {null}
          </NoTopoCartao>
          {/* o que está por baixo da linha alinha com o título e o ícone do separador (Silva, 21/10/2026) */}
          <div className="bk-recuo">
            {dados.naFila && (
              <div className="note">
                <i className="fa-solid fa-hourglass-half" /> {t('Há uma cópia ou um restauro na fila: o servidor trata dele dentro de momentos.')}
              </div>
            )}
            <div className="bk-corpo">
              <div className="bk-topo">
                <p className="bk-escolhas-t">
                {t('Cópias guardadas')} <b>{dados.copias.length + ' / ' + (dados.limite || '—')}</b>
              </p>
                <div className="bk-btns">
                  <button className="btn r" disabled={dados.naFila || porGuardar} title={porGuardar ? t('Espere que as escolhas fiquem guardadas.') : undefined} onClick={async () => (await noServidor(vh, { acao: 'backup-criar' }, 'Cópia marcada: começa dentro de momentos')) && ler()}>
                    <i className="fa-solid fa-box-archive" />
                    {t('Fazer cópia agora')}
                  </button>
                  <button className="btn g" onClick={() => openM(<AgendarModal atual={null} onFeito={() => vh.nav('/utilizador/backups/agendadas')} />)}>
                    <i className="fa-solid fa-calendar-days" />
                    {t('Agendar backup')}
                  </button>
                </div>
              </div>
              <Exclusoes info={dados} aoMudar={setPorGuardar} />
            </div>
            {tabela()}
            {/* sem nenhuma cópia não há botão Restaurar: só neste caso a opção de carregar aparece cá fora (Silva, 23/10/2026) */}
            {dados.podeCarregar && dados.copias.length === 0 && (
              <div className="note">
                <i className="fa-solid fa-cloud-arrow-up" /> {t('Para restaurar de um ficheiro do computador, carregue a cópia aqui.')}{' '}
                <button className="btn g sm" onClick={carregar}>
                  {t('Carregar cópia')}
                </button>
              </div>
            )}
          </div>
        </>
      ) : aba === 'agendadas' ? (
        <>
          <NoTopoCartao daPagina titulo={t('Cópias agendadas')} descTitulo={t('As cópias que correm sozinhas, na hora escolhida')}>
            {null}
          </NoTopoCartao>
          <div className="bk-recuo">
            <div className="bk-topo">
              <span />
              <div className="bk-btns">
                <button className="btn r" onClick={() => openM(<AgendarModal atual={null} onFeito={ler} />)}>
                  <i className="fa-solid fa-calendar-plus" />
                  {t('Agendar')}
                </button>
              </div>
            </div>
            {dados.agendas.length ? (
              dados.agendas.map((a) => <CartaoAgenda key={a.id} a={a} dados={dados} ler={ler} />)
            ) : (
              <div className="card empty">
                <p>{t('Ainda não há nenhuma cópia agendada.')}</p>
              </div>
            )}
          </div>
        </>
      ) : null}
    </>
  );
}
export const backupsPagina: ScreenFn = (vh) => {
  const sub = vh.s.sub[0];
  // o restauro faz-se na lista do primeiro separador; o endereço antigo /restaurar abre-o
  const aba = sub === 'agendadas' ? 'agendadas' : 'criar';
  return { title: 'Cópias de segurança', crumbs: aba === 'agendadas' ? [{ t: 'Cópias de segurança', path: '/utilizador/backups' }, { t: 'Cópias agendadas' }] : undefined, body: <Backups aba={aba} /> };
};

// ---------- Tarefas cron ----------
type Tarefa = { id: string; min: string; hora: string; dia: string; mes: string; semana: string; cmd: string; suspensa: boolean };
const PRESETS: [string, string[]][] = [
  ['A cada minuto', ['*', '*', '*', '*', '*']],
  ['A cada 5 minutos', ['*/5', '*', '*', '*', '*']],
  ['A cada 15 minutos', ['*/15', '*', '*', '*', '*']],
  ['A cada hora', ['0', '*', '*', '*', '*']],
  ['Todos os dias à meia-noite', ['0', '0', '*', '*', '*']],
  ['Todos os dias às 3h', ['0', '3', '*', '*', '*']],
  ['Todas as semanas (domingo)', ['0', '0', '*', '*', '0']],
  ['Todos os meses (dia 1)', ['0', '0', '1', '*', '*']],
];
const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
function explicar(c: string[]): string {
  const [mi, ho, di, me, se] = c;
  const parte = (v: string, um: string, todos: string) => (v === '*' ? todos : v.startsWith('*/') ? 'a cada ' + v.slice(2) + ' ' + um : um + ' ' + v);
  if (c.every((x) => x === '*')) return 'A cada minuto';
  const hora = mi !== '*' && ho !== '*' && /^\d+$/.test(mi) && /^\d+$/.test(ho) ? 'às ' + ho.padStart(2, '0') + ':' + mi.padStart(2, '0') : [parte(mi, 'minuto', 'a cada minuto'), parte(ho, 'hora', 'de todas as horas')].join(', ');
  const dia = di === '*' && se === '*' ? 'todos os dias' : [di !== '*' ? 'no dia ' + di : '', se !== '*' ? (/^\d$/.test(se) ? 'à ' + DIAS[Number(se)] : 'dias da semana ' + se) : ''].filter(Boolean).join(' e ');
  return [hora, dia, me !== '*' ? 'no mês ' + me : ''].filter(Boolean).join(', ');
}

function CronLista() {
  const vh = useVH();
  const { t, openM, nav } = vh;
  const { dados, erro, ler } = useLer<{ relatorios: boolean; email: string; tarefas: Tarefa[] }>('cron');
  if (!dados) return <Carregando erro={erro} ler={ler} />;
  const apagar = (ids: string[]) => openM(<Confirmar titulo="Apagar tarefas?" texto={ids.length + ' tarefa(s) deixam de correr.'} ok="Apagar" onOk={async () => (await noServidor(vh, { acao: 'cron-apagar', ids }, 'Tarefa(s) apagada(s)')) && ler()} />);
  return (
    <>
      <DataTable
        id="cron"
        rows={dados.tarefas}
        rowKey={(r) => r.id}
        onRecarregar={ler}
        empty="Não há tarefas cron"
        rowClass={(r) => (r.suspensa ? 'off' : '')}
        barra2={
          <label className="av-sw">
            <Switch checked={dados.relatorios} onChange={async (v) => (await noServidor(vh, { acao: 'cron-relatorios', ligar: v }, v ? 'Os resultados vão por e-mail' : 'Sem e-mail dos resultados')) && ler()} label="Enviar os resultados por e-mail" />
            {t('Enviar os resultados por e-mail')} {dados.email && <small>({dados.email})</small>}
          </label>
        }
        cols={[
          { k: 'min', t: 'Minuto', cell: (r) => <code>{r.min}</code> },
          { k: 'hora', t: 'Hora', cell: (r) => <code>{r.hora}</code> },
          { k: 'dia', t: 'Dia do mês', cell: (r) => <code>{r.dia}</code> },
          { k: 'mes', t: 'Mês', cell: (r) => <code>{r.mes}</code> },
          { k: 'semana', t: 'Dia da semana', cell: (r) => <code>{r.semana}</code> },
          { k: 'cmd', t: 'Comando', cell: (r) => <span className="av-cmd" title={explicar([r.min, r.hora, r.dia, r.mes, r.semana])}>{r.cmd}</span> },
        ]}
        actions={(r) => (
          <span className="dns-acoes">
            <button className="btn sm btn-ed" onClick={() => nav('/utilizador/cron/' + r.id)}>
              <i className="fa-solid fa-pen-to-square" />
              {t('Editar')}
            </button>
            <button className="btn sm btn-rm" onClick={() => apagar([r.id])}>
              <i className="fa-solid fa-trash-can" />
              {t('Apagar')}
            </button>
          </span>
        )}
        bulk={[
          { t: 'Suspender', fa: 'fa-pause', run: async (k) => (await noServidor(vh, { acao: 'cron-suspender', ids: k }, 'Suspensa(s)')) && ler() },
          { t: 'Reativar', fa: 'fa-play', run: async (k) => (await noServidor(vh, { acao: 'cron-reativar', ids: k }, 'Reativada(s)')) && ler() },
          { t: 'Apagar', fa: 'fa-trash', run: (k) => apagar(k) },
        ]}
      />
    </>
  );
}

function CronForm({ id }: { id?: string }) {
  const vh = useVH();
  const { t, nav, me } = vh;
  const { dados } = useLer<{ tarefas: Tarefa[] }>('cron');
  const atual = id ? dados?.tarefas.find((x) => x.id === id) : undefined;
  const [f, setF] = useState<{ c: string[]; cmd: string } | null>(null);
  const v = f || (atual ? { c: [atual.min, atual.hora, atual.dia, atual.mes, atual.semana], cmd: atual.cmd } : { c: ['0', '*', '*', '*', '*'], cmd: '' });
  const d = siteAtual(vh) || 'exemplo.com';
  if (id && !dados) return <Carregando erro="" ler={() => null} />;
  if (id && !atual) return <div className="card empty">{t('Esta tarefa não existe')}</div>;
  const nomes = ['Minuto', 'Hora', 'Dia do mês', 'Mês', 'Dia da semana'];
  return (
    <Sec titulo={id ? 'Editar tarefa cron' : 'Criar tarefa cron'} desc="Um comando que o servidor corre sozinho no horário escolhido, com o utilizador da conta.">
      <Campo label="Horário pronto" id="cron-preset">
        <select id="cron-preset" className="em-sel" value="" onChange={(e) => e.target.value && setF({ ...v, c: PRESETS[Number(e.target.value)][1] })}>
          <option value="">{t('Escolher…')}</option>
          {PRESETS.map(([n], i) => (
            <option key={n} value={i}>
              {t(n)}
            </option>
          ))}
        </select>
      </Campo>
      <div className="av-cron">
        {nomes.map((n, i) => (
          <Campo key={n} label={n} id={'cron-' + i}>
            <input id={'cron-' + i} value={v.c[i]} onChange={(e) => setF({ ...v, c: v.c.map((x, j) => (j === i ? e.target.value.trim() : x)) })} />
          </Campo>
        ))}
      </div>
      <p className="av-explica">
        <i className="fa-regular fa-clock" /> {t('Vai correr:')} <b>{explicar(v.c)}</b>
      </p>
      <Campo label="Comando" id="cron-cmd">
        <input id="cron-cmd" value={v.cmd} onChange={(e) => setF({ ...v, cmd: e.target.value })} placeholder={`php /home/${me}/web/${d}/public_html/script.php`} />
      </Campo>
      <div className="da-fim">
        <span />
        <button
          className="btn r"
          disabled={!v.cmd.trim()}
          onClick={async () => {
            if (v.c.some((x) => !/^[0-9*/,-]{1,40}$/.test(x))) return vh.toast('Horário inválido: use números, *, vírgulas, hífens e /');
            const [min, hora, dia, mes, semana] = v.c;
            if (await noServidor(vh, { acao: id ? 'cron-editar' : 'cron-criar', id, min, hora, dia, mes, semana, cmd: v.cmd }, id ? 'Tarefa guardada' : 'Tarefa criada')) nav('/utilizador/cron');
          }}
        >
          <i className="fa-solid fa-floppy-disk" />
          {t(id ? 'Guardar' : 'Criar')}
        </button>
      </div>
      <div className="note av-ajuda">
        <b>{t('Como escrever o horário')}</b>
        <ul>
          <li>{t('Números ou * (todos). Vários valores com vírgulas: 1,2,3.')}</li>
          <li>{t('Intervalos com hífen: 5-7. A cada N com */N: */2 = a cada 2.')}</li>
          <li>{t('Exemplos de comandos:')} <code>php /home/{me}/web/{d}/public_html/script.php</code> · <code>curl --silent https://{d}/cron.php &gt; /dev/null</code></li>
        </ul>
      </div>
    </Sec>
  );
}

export const cronPagina: ScreenFn = (vh) => {
  const [a] = vh.s.sub;
  const base = { t: 'Tarefas cron', path: '/utilizador/cron' };
  if (a === 'nova') return { title: 'Criar tarefa cron', crumbs: [base, { t: 'Criar' }], body: <CronForm /> };
  if (a) return { title: 'Editar tarefa cron', crumbs: [base, { t: 'Editar' }], body: <CronForm key={a} id={a} /> };
  return {
    title: 'Tarefas cron',
    actions: (
      <button className="btn r" onClick={() => vh.nav('/utilizador/cron/nova')}>
        <i className="fa-solid fa-plus" />
        {vh.t('Criar tarefa cron')}
      </button>
    ),
    body: <CronLista />,
  };
};

// ---------- Chaves de login (chaves de acesso à API do Hestia) ----------
type Chave = { id: string; permissoes: string; comentario: string; data: string };
const PERMISSOES: [string, string][] = [
  ['v-list-web-domains', 'Ver os sites'],
  ['v-list-mail-domains', 'Ver os domínios de e-mail'],
  ['v-list-mail-accounts', 'Ver as contas de e-mail'],
  ['v-add-mail-account', 'Criar contas de e-mail'],
  ['v-change-mail-account-password', 'Mudar senhas de e-mail'],
  ['v-list-databases', 'Ver as bases de dados'],
  ['v-list-dns-records', 'Ver os registos DNS'],
  ['v-add-dns-record', 'Criar registos DNS'],
  ['v-list-cron-jobs', 'Ver as tarefas cron'],
  ['v-list-user-backups', 'Ver as cópias de segurança'],
  ['v-schedule-user-backup', 'Fazer cópias de segurança'],
  ['v-list-user-stats', 'Ver as estatísticas'],
];

function ChavesLista() {
  const vh = useVH();
  const { t, openM } = vh;
  const { dados, erro, ler } = useLer<{ chaves: Chave[] }>('chaves');
  if (!dados) return <Carregando erro={erro} ler={ler} />;
  const apagar = (ids: string[]) => openM(<Confirmar titulo="Apagar chaves?" texto={'Os programas que usam ' + ids.join(', ') + ' deixam de ter acesso.'} ok="Apagar" onOk={async () => (await noServidor(vh, { acao: 'chave-apagar', ids }, 'Chave(s) apagada(s)')) && ler()} />);
  return (
    <>
      <div className="note">{t('Uma chave de login dá a um programa (ou a outra pessoa) acesso só às funções escolhidas, sem a sua palavra-passe. O segredo só é mostrado quando a chave é criada.')}</div>
      <DataTable
        id="chaves"
        rows={dados.chaves}
        rowKey={(r) => r.id}
        onRecarregar={ler}
        empty="Não há chaves de login"
        cols={[
          { k: 'id', t: 'Chave', cell: (r) => <code>{r.id}</code> },
          { k: 'com', t: 'Nome', cell: (r) => r.comentario || '—' },
          { k: 'perm', t: 'Pode', cell: (r) => <span style={{ whiteSpace: 'normal' }}>{r.permissoes ? r.permissoes.split(',').map((p) => PERMISSOES.find((x) => x[0] === p.trim())?.[1] || p.trim()).join(', ') : t('Tudo')}</span> },
          { k: 'data', t: 'Criada', cell: (r) => dataPt(r.data) },
        ]}
        actions={(r) => (
          <button className="btn sm btn-rm" onClick={() => apagar([r.id])}>
            <i className="fa-solid fa-trash-can" />
            {t('Apagar')}
          </button>
        )}
        bulk={[{ t: 'Apagar', fa: 'fa-trash', run: (k) => apagar(k) }]}
      />
    </>
  );
}

function ChaveNova() {
  const vh = useVH();
  const { t, nav, openM } = vh;
  const [nome, setNome] = useState('');
  const [perm, setPerm] = useState<string[]>(['v-list-web-domains']);
  const admin = vh.a.role === 'admin';
  const [tudo, setTudo] = useState(false);
  return (
    <Sec titulo="Criar chave de login" desc="Escolha o nome e o que a chave pode fazer.">
      <Campo label="Nome" id="ch-nome" hint="Para se lembrar para que serve (ex.: site da loja)">
        <input id="ch-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
      </Campo>
      <h4 className="em-sub">{t('Pode')}</h4>
      {admin && <Check checked={tudo} onChange={setTudo} label="Tudo (só administradores)" />}
      <div className="privs" style={{ marginTop: 8 }}>
        {PERMISSOES.map(([k, l]) => (
          <Check key={k} checked={tudo || perm.includes(k)} muted={tudo} onChange={(on) => !tudo && setPerm(on ? [...perm, k] : perm.filter((x) => x !== k))} label={l} />
        ))}
      </div>
      <div className="da-fim">
        <span />
        <button
          className="btn r"
          disabled={!tudo && !perm.length}
          onClick={async () => {
            const j = await noServidor(vh, { acao: 'chave-criar', comentario: nome, permissoes: tudo ? [] : perm }, 'Chave criada');
            if (j) {
              nav('/utilizador/chaves-login');
              openM(<SegredoModal titulo="Chave criada" aviso="Guarde o segredo agora: não volta a ser mostrado." valores={[['Chave', String(j.id || '')], ['Segredo', String(j.segredo || '')]]} />);
            }
          }}
        >
          <i className="fa-solid fa-key" />
          {t('Criar chave')}
        </button>
      </div>
    </Sec>
  );
}

export const chavesPagina: ScreenFn = (vh) => {
  const [a] = vh.s.sub;
  const base = { t: 'Chaves de login', path: '/utilizador/chaves-login' };
  if (a === 'nova') return { title: 'Criar chave de login', crumbs: [base, { t: 'Criar' }], body: <ChaveNova /> };
  return {
    title: 'Chaves de login',
    actions: (
      <button className="btn r" onClick={() => vh.nav('/utilizador/chaves-login/nova')}>
        <i className="fa-solid fa-plus" />
        {vh.t('Criar chave')}
      </button>
    ),
    body: <ChavesLista />,
  };
};

// ---------- Chaves SSH ----------
function ColarChaveModal({ onFeito }: { onFeito: () => void }) {
  const vh = useVH();
  const { t, closeM } = vh;
  const [k, setK] = useState('');
  return (
    <>
      <h3>{t('Colar chave pública')}</h3>
      <div className="f">
        <label>{t('Chave pública')}</label>
        <textarea rows={5} value={k} onChange={(e) => setK(e.target.value)} placeholder="ssh-ed25519 AAAA… nome@computador" />
      </div>
      <div className="mfoot">
        <button className="btn g" onClick={closeM}>
          {t('Cancelar')}
        </button>
        <button
          className="btn r"
          disabled={!k.trim()}
          onClick={async () => {
            closeM();
            if (await noServidor(vh, { acao: 'ssh-juntar', chave: k.trim() }, 'Chave autorizada')) onFeito();
          }}
        >
          {t('Autorizar')}
        </button>
      </div>
    </>
  );
}

function CriarChaveModal({ onFeito }: { onFeito: () => void }) {
  const vh = useVH();
  const { t, closeM, openM } = vh;
  const [c, setC] = useState('');
  return (
    <>
      <h3>{t('Criar chave SSH')}</h3>
      <p style={{ color: 'var(--muted)', marginBottom: 10 }}>{t('É criado um par de chaves; a pública fica autorizada nesta conta e a privada é mostrada uma só vez.')}</p>
      <div className="f">
        <label>{t('Comentário')}</label>
        <input value={c} onChange={(e) => setC(e.target.value)} placeholder="ex.: portatil-silva" />
      </div>
      <div className="mfoot">
        <button className="btn g" onClick={closeM}>
          {t('Cancelar')}
        </button>
        <button
          className="btn r"
          onClick={async () => {
            closeM();
            const j = await noServidor(vh, { acao: 'ssh-criar', comentario: c }, 'Chave criada');
            if (j) {
              onFeito();
              openM(<SegredoModal titulo="Chave SSH criada" aviso="Guarde a chave privada agora: não fica guardada no servidor." valores={[['Chave privada', String(j.privada || '')], ['Chave pública', String(j.publica || '')]]} ficheiro={['id_ed25519', String(j.privada || '')]} />);
            }
          }}
        >
          {t('Criar')}
        </button>
      </div>
    </>
  );
}

function Ssh() {
  const vh = useVH();
  const { t, openM } = vh;
  const { dados, erro, ler } = useLer<{ shell: string; admin: boolean; chaves: { id: string; chave: string }[] }>('ssh');
  if (!dados) return <Carregando erro={erro} ler={ler} />;
  const ligado = dados.shell !== 'nologin';
  const apagar = (ids: string[]) => openM(<Confirmar titulo="Apagar chaves?" texto="Quem usa estas chaves deixa de poder entrar por SSH." ok="Apagar" onOk={async () => (await noServidor(vh, { acao: 'ssh-apagar', ids }, 'Chave(s) apagada(s)')) && ler()} />);
  const tipo = (k: string) => k.split(' ')[0].replace('ssh-', '').replace('ecdsa-sha2-', 'ecdsa ');
  return (
    <>
      <div className="em-opcoes" style={{ marginBottom: 18 }}>
        <div>
          <span>
            {t('Acesso SSH da conta')}: <b>{t(ligado ? 'ligado' : 'desligado')}</b> {ligado && <code>{dados.shell}</code>}
          </span>
          {dados.admin ? (
            <Switch checked={ligado} onChange={async (v) => (await noServidor(vh, { acao: 'ssh-shell', shell: v ? 'bash' : 'nologin' }, v ? 'Acesso SSH ligado' : 'Acesso SSH desligado', true)) && ler()} label="Acesso SSH" />
          ) : (
            <small style={{ color: 'var(--muted)' }}>{t(ligado ? '' : 'O acesso SSH depende do pacote; peça ao administrador.')}</small>
          )}
        </div>
      </div>
      <DataTable
        id="ssh"
        rows={dados.chaves}
        rowKey={(r) => r.id}
        onRecarregar={ler}
        empty="Não há chaves autorizadas"
        cols={[
          { k: 'id', t: 'Nome', cell: (r) => <b>{r.chave.split(' ').slice(2).join(' ') || r.id}</b> },
          { k: 'tipo', t: 'Tipo', cell: (r) => tipo(r.chave) },
          { k: 'k', t: 'Chave', cell: (r) => <code title={r.chave}>{r.chave.split(' ')[1]?.slice(0, 18)}…{r.chave.split(' ')[1]?.slice(-12)}</code> },
        ]}
        actions={(r) => (
          <button className="btn sm btn-rm" onClick={() => apagar([r.id])}>
            <i className="fa-solid fa-trash-can" />
            {t('Apagar')}
          </button>
        )}
        bulk={[{ t: 'Apagar', fa: 'fa-trash', run: (k) => apagar(k) }]}
      />
    </>
  );
}
export const sshPagina: ScreenFn = (vh) => ({
  title: 'Chaves SSH',
  actions: <AcoesSsh />,
  body: <Ssh />,
});
function AcoesSsh() {
  const { t, openM } = useVH();
  const { ler } = useLer('ssh');
  return (
    <>
      <button className="btn g sec-m" onClick={() => openM(<ColarChaveModal onFeito={ler} />)}>
        <i className="fa-solid fa-paste" />
        {t('Colar chave')}
      </button>
      <button className="btn r" onClick={() => openM(<CriarChaveModal onFeito={ler} />)}>
        <i className="fa-solid fa-plus" />
        {t('Criar chave')}
      </button>
    </>
  );
}

// ---------- Pastas protegidas ----------
type Pasta = { id: string; d: string; pasta: string; nome: string; users: string[] };

function PastaModal({ d, p, onFeito }: { d: string; p?: Pasta; onFeito: () => void }) {
  const vh = useVH();
  const { t, closeM } = vh;
  const [f, setF] = useState({ pasta: '', nome: 'Área protegida', user: '', senha: '' });
  return (
    <>
      <h3>{t(p ? 'Juntar utilizador' : 'Proteger pasta')}</h3>
      <p style={{ color: 'var(--muted)', marginBottom: 10 }}>{p ? d + '/' + p.pasta : d}</p>
      {!p && (
        <>
          <div className="f">
            <label>{t('Pasta (dentro do site)')}</label>
            <span className="igrp">
              <span className="ib" style={{ cursor: 'default' }}>
                {d}/
              </span>
              <input value={f.pasta} onChange={(e) => setF({ ...f, pasta: e.target.value.trim() })} placeholder="privado" />
            </span>
          </div>
          <div className="f">
            <label>{t('Nome da área (aparece no pedido de senha)')}</label>
            <input value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} />
          </div>
        </>
      )}
      <div className="f">
        <label>{t('Utilizador')}</label>
        <input value={f.user} onChange={(e) => setF({ ...f, user: e.target.value.trim() })} autoComplete="off" />
      </div>
      <div className="f">
        <label>{t('Palavra-passe')}</label>
        <Senha value={f.senha} onChange={(v) => setF({ ...f, senha: v })} />
      </div>
      <div className="mfoot">
        <button className="btn g" onClick={closeM}>
          {t('Cancelar')}
        </button>
        <button
          className="btn r"
          disabled={(!p && !f.pasta) || !f.user || !f.senha}
          onClick={async () => {
            closeM();
            if (await noServidor(vh, p ? { acao: 'protegida-utilizador', dominio: d, id: p.id, user: f.user, senha: f.senha } : { acao: 'protegida-criar', dominio: d, ...f }, p ? 'Utilizador juntado' : 'Pasta protegida')) onFeito();
          }}
        >
          {t(p ? 'Juntar' : 'Proteger')}
        </button>
      </div>
    </>
  );
}

function Protegidas() {
  const vh = useVH();
  const { t, openM } = vh;
  const { dados, erro, ler } = useLer<{ sites: string[]; pastas: Pasta[] }>('protegidas');
  if (!dados) return <Carregando erro={erro} ler={ler} />;
  if (!dados.sites.length) return <SemSite />;
  // como no DA: as pastas do domínio do seletor
  const d0 = siteAtual(vh);
  return (
    <>
      <div className="note">{t('O navegador pede utilizador e palavra-passe antes de mostrar o que está na pasta (também imagens e outros ficheiros).')}</div>
      {(dados.sites.includes(d0) ? [d0] : dados.sites).map((d) => {
        const minhas = dados.pastas.filter((p) => p.d === d);
        return (
          <section key={d} className="av-dom">
            <div className="av-dom-h">
              <b>
                <i className="fa-solid fa-globe" /> {d}
              </b>
              <button className="btn sm btn-ed" onClick={() => openM(<PastaModal d={d} onFeito={ler} />)}>
                <i className="fa-solid fa-plus" />
                {t('Proteger pasta')}
              </button>
            </div>
            {minhas.length ? (
              <table className="da-tbl">
                <thead>
                  <tr>
                    <th>{t('Pasta')}</th>
                    <th>{t('Nome da área')}</th>
                    <th>{t('Utilizadores')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {minhas.map((p) => (
                    <tr key={p.id}>
                      <td className="nome">
                        <code>/{p.pasta}/</code>
                      </td>
                      <td>{p.nome}</td>
                      <td className="nome">
                        {p.users.map((u) => (
                          <span key={u} className="em-chip">
                            {u}
                            {p.users.length > 1 && <i className="fa-solid fa-xmark" title={t('Tirar')} onClick={() => noServidor(vh, { acao: 'protegida-tirar-utilizador', dominio: d, id: p.id, user: u }, 'Utilizador tirado').then((j) => j && ler())} />}
                          </span>
                        ))}
                      </td>
                      <td className="acoes">
                        <span className="dns-acoes">
                          <button className="btn sm btn-ed" onClick={() => openM(<PastaModal d={d} p={p} onFeito={ler} />)}>
                            {t('Juntar utilizador')}
                          </button>
                          <button className="btn sm btn-rm" onClick={() => openM(<Confirmar titulo="Tirar a proteção?" texto={d + '/' + p.pasta + ' passa a abrir sem senha.'} ok="Tirar" onOk={async () => (await noServidor(vh, { acao: 'protegida-apagar', dominio: d, id: p.id }, 'Proteção tirada')) && ler()} />)}>
                            {t('Apagar')}
                          </button>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="em-nota" style={{ margin: '4px 0 0' }}>
                {t('Nenhuma pasta protegida neste domínio')}
              </p>
            )}
          </section>
        );
      })}
    </>
  );
}
export const protegidasPagina: ScreenFn = () => ({ title: 'Pastas protegidas', dominios: 'sites', body: <Protegidas /> });

// ---------- Firewall de aplicação (ModSecurity) ----------
type Evento = { data: string; ip: string; regra: string; msg: string; uri: string; bloqueado: boolean };
function ModSec() {
  const vh = useVH();
  const { t } = vh;
  const d = siteAtual(vh);
  const { dados, erro, ler } = useLer<{ ativo: boolean; eventos: Evento[] }>('modsec', { d }, !!d);
  if (!d) return <SemSite />;
  if (!dados) return <Carregando erro={erro} ler={ler} />;
  return (
    <>
      <div className="em-opcoes" style={{ marginBottom: 14 }}>
        <div>
          <span>{t('Firewall de aplicação (ModSecurity) no servidor')}</span>
          <span className={'tag ' + (dados.ativo ? 'ok' : 'w')}>{t(dados.ativo ? 'Ativo' : 'Desligado')}</span>
        </div>
      </div>
      <Sec titulo="Pedidos travados" desc={'Os pedidos a ' + d + ' que a firewall marcou ou travou nos últimos registos do site.'} numeros={[['Eventos', String(dados.eventos.length)]]}>
        <DataTable
          id="modsec"
          rows={dados.eventos.map((e, i) => ({ ...e, k: String(i) }))}
          rowKey={(r) => r.k}
          onRecarregar={ler}
          empty="Nenhum pedido travado nos registos recentes"
          cols={[
            { k: 'data', t: 'Data', cell: (r) => r.data.replace(/\.\d+/, '') },
            { k: 'ip', t: 'Endereço IP', cell: (r) => <code>{r.ip}</code> },
            { k: 'acao', t: 'Ação', cell: (r) => <span className={'tag ' + (r.bloqueado ? 'bad' : 'w')}>{t(r.bloqueado ? 'Travado' : 'Marcado')}</span> },
            { k: 'regra', t: 'Regra', cell: (r) => r.regra },
            { k: 'msg', t: 'Motivo', cell: (r) => <span style={{ whiteSpace: 'normal' }}>{r.msg}</span> },
            { k: 'uri', t: 'Endereço pedido', cell: (r) => <span style={{ wordBreak: 'break-all' }}>{r.uri}</span> },
          ]}
        />
      </Sec>
    </>
  );
}
export const modsecPagina: ScreenFn = () => ({ title: 'Firewall de aplicação', dominios: 'sites', body: <ModSec /> });

// ---------- Git ----------
type Repo = { nome: string; d: string; remoto: string; ramo: string; publicar: boolean; destino: string; criado: string; clone: string; ultimo: string };
function GitLista() {
  const vh = useVH();
  const { t, openM } = vh;
  const { dados, erro, ler } = useLer<{ sites: string[]; shell: string; repos: Repo[] }>('git');
  if (!dados) return <Carregando erro={erro} ler={ler} />;
  return (
    <>
      {dados.shell === 'nologin' && <div className="note">{t('Para enviar (push) para estes repositórios é preciso o acesso SSH da conta ligado (Chaves SSH).')}</div>}
      <DataTable
        id="git"
        rows={dados.repos}
        rowKey={(r) => r.nome}
        onRecarregar={ler}
        empty="Não há repositórios"
        cols={[
          { k: 'nome', t: 'Nome', cell: (r) => <b>{r.nome}</b> },
          { k: 'd', t: 'Domínio', cell: (r) => r.d },
          { k: 'clone', t: 'Endereço para clonar', cell: (r) => <code className="av-cmd" title={r.clone} onClick={() => { navigator.clipboard?.writeText(r.clone); vh.toast('Endereço copiado'); }}>{r.clone}</code> },
          { k: 'pub', t: 'Publicação', cell: (r) => (r.publicar ? <span className="tag ok">{r.ramo + ' → ' + (r.destino || 'public_html')}</span> : <span className="tag off">{t('Não publica')}</span>) },
          { k: 'ult', t: 'Último envio', cell: (r) => (r.ultimo ? <span title={r.ultimo.split('|')[2]}>{r.ultimo.split('|')[1]}</span> : '—') },
          { k: 'remoto', t: 'Remoto', cell: (r) => r.remoto || '—', hidden: true },
        ]}
        actions={(r) => (
          <span className="dns-acoes">
            {r.remoto && (
              <button className="btn sm btn-ed" onClick={async () => (await noServidor(vh, { acao: 'git-sincronizar', nome: r.nome }, 'Sincronizado com o remoto')) && ler()}>
                <i className="fa-solid fa-rotate" />
                {t('Sincronizar')}
              </button>
            )}
            <button className="btn sm btn-rm" onClick={() => openM(<Confirmar titulo="Apagar repositório?" texto={'Apaga o repositório ' + r.nome + ' do servidor (os ficheiros já publicados no site ficam).'} ok="Apagar" onOk={async () => (await noServidor(vh, { acao: 'git-apagar', nome: r.nome }, 'Repositório apagado')) && ler()} />)}>
              <i className="fa-solid fa-trash-can" />
              {t('Apagar')}
            </button>
          </span>
        )}
      />
    </>
  );
}

function GitNovo() {
  const vh = useVH();
  const { t, nav } = vh;
  const [f, setF] = useState({ d: siteAtual(vh), nome: '', remoto: '', ramo: 'main', chave: '', publicar: false, destino: '' });
  const sites = vh.a.domains.filter((x) => !x.soEmail && !x.soDominio).map((x) => x.name);
  return (
    <Sec titulo="Criar repositório" desc="Um repositório Git no servidor. Se só o for usar aqui, basta o nome; o remoto serve para sincronizar com outro repositório (ex.: GitHub).">
      <Campo label="Domínio" id="git-d">
        <select id="git-d" className="em-sel" value={f.d} onChange={(e) => setF({ ...f, d: e.target.value })}>
          {sites.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </Campo>
      <Campo label="Nome" id="git-nome">
        <input id="git-nome" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value.toLowerCase().replace(/\s/g, '') })} placeholder="ex.: site" />
      </Campo>
      <Campo label="Remoto" id="git-remoto" hint="Opcional. Para sincronizar com um repositório de fora.">
        <input id="git-remoto" value={f.remoto} onChange={(e) => setF({ ...f, remoto: e.target.value.trim() })} placeholder="https://github.com/conta/site.git" />
      </Campo>
      <Campo label="Ramo" id="git-ramo">
        <input id="git-ramo" value={f.ramo} onChange={(e) => setF({ ...f, ramo: e.target.value.trim() })} />
      </Campo>
      <Campo label="Chave privada" id="git-chave" hint="Opcional. Para repositórios remotos privados (chave de implementação).">
        <textarea id="git-chave" className="em-txt" rows={4} value={f.chave} onChange={(e) => setF({ ...f, chave: e.target.value })} placeholder="-----BEGIN OPENSSH PRIVATE KEY-----" />
      </Campo>
      <Check checked={f.publicar} onChange={(v) => setF({ ...f, publicar: v })} label="Publicar no site a cada envio deste ramo (substitui os ficheiros)" />
      {f.publicar && (
        <Campo label="Pasta do site onde publicar" id="git-dest" hint="Vazio = a pasta principal do site (public_html)">
          <input id="git-dest" value={f.destino} onChange={(e) => setF({ ...f, destino: e.target.value.trim() })} placeholder="ex.: app" />
        </Campo>
      )}
      <div className="da-fim">
        <span />
        <button
          className="btn r"
          disabled={!f.nome || !f.d}
          onClick={async () => {
            if (await noServidor(vh, { acao: 'git-criar', dominio: f.d, ...f }, 'Repositório criado')) nav('/utilizador/git');
          }}
        >
          <i className="fa-solid fa-circle-plus" />
          {t('Criar repositório')}
        </button>
      </div>
    </Sec>
  );
}

export const gitPagina: ScreenFn = (vh) => {
  const [a] = vh.s.sub;
  if (a === 'novo') return { title: 'Criar repositório', crumbs: [{ t: 'Git', path: '/utilizador/git' }, { t: 'Criar' }], body: <GitNovo /> };
  return {
    title: 'Git',
    actions: (
      <button className="btn r" onClick={() => vh.nav('/utilizador/git/novo')}>
        <i className="fa-solid fa-plus" />
        {vh.t('Criar repositório')}
      </button>
    ),
    body: <GitLista />,
  };
};

// ---------- WordPress ----------
type Wp = { d: string; pasta: string; versao: string; titulo: string; url: string; auto: string; tema: string };
type Plugin = { name: string; title?: string; status: string; version: string; update: string | null; update_version?: string };
type WpUser = { ID?: number; user_login: string; display_name?: string; user_email?: string; roles?: string; user_registered?: string };
/** "2025-02-05 17:54:10" → "05/02/2025, 17:54" (como no DA) */
const dataWp = (d?: string) => (d ? dataPt(d) : '—');
const AUTO: Record<string, string> = { true: 'Todas', minor: 'Só de segurança', false: 'Desligada' };

/** Abre o painel do WordPress já com sessão. A janela abre-se logo no clique (depois de esperar pelo servidor o
 *  navegador bloqueava-a) e recebe o endereço quando ele chega; se falhar, fecha-se e aparece o motivo. */
async function entrarWp(vh: VH, d: string, user?: string, postId?: number, editor: 'wordpress' | 'elementor' = 'wordpress') {
  const w = window.open('about:blank', '_blank');
  const j = await noServidor(vh, { acao: 'wp-entrar', dominio: d, ...(user ? { user } : {}), ...(postId ? { postId } : {}), editor }, editor === 'elementor' ? 'A abrir o Elementor…' : 'A abrir o painel do WordPress…');
  if (j?.url && w) {
    w.opener = null;
    w.location.href = String(j.url);
  } else if (j?.url) window.location.href = String(j.url);
  else w?.close();
}

/** Linha fina por baixo de um botão que pisca uma vez ao clicar e desaparece (resposta ao clique, sem roda): devolve se está a
 *  piscar e o que se chama no clique. A linha desenha-se com `.pisca` em paginas.css. */
function usePisca(): [boolean, () => void] {
  const [pisca, setPisca] = useState(false);
  const fim = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(fim.current), []);
  const piscar = useCallback(() => {
    window.clearTimeout(fim.current);
    setPisca(true);
    fim.current = window.setTimeout(() => setPisca(false), 700);
  }, []);
  return [pisca, piscar];
}

/** Botões da linha de cima do Gerir WordPress: "Abrir o site" e "Painel do WordPress" */
function BotoesSiteWp({ d }: { d: string }) {
  const vh = useVH();
  const [piscaSite, piscarSite] = usePisca();
  const [piscaPainel, piscarPainel] = usePisca();
  return (
    <>
      <a className={'btn g sec-m' + (piscaSite ? ' pisca' : '')} href={'https://' + d} target="_blank" rel="noreferrer" onClick={piscarSite}>
        <i className="fa-solid fa-arrow-up-right-from-square" />
        {vh.t('Abrir o site')}
      </a>
      <button
        className={'btn r' + (piscaPainel ? ' pisca' : '')}
        onClick={() => {
          piscarPainel();
          entrarWp(vh, d);
        }}
      >
        <i className="fa-brands fa-wordpress" />
        {vh.t('Painel do WordPress')}
      </button>
    </>
  );
}

/** Menu "⋯" de uma linha (como no DirectAdmin): opções só com ícone e título; fecha ao clicar fora ou Esc. No computador abre ao
 *  lado do ícone (para a esquerda); só no telemóvel abre por baixo */
function MenuPontos({ itens }: { itens: { fa: string; t: string; perigo?: boolean; run: () => void }[] }) {
  const { t } = useVH();
  // posição fixa (calculada do botão): a tabela, que pode deslizar, não corta o menu
  const [pos, setPos] = useState<{ top: number; right: number; aoLado: boolean; ic: { left: number; right: number; top: number; bottom: number } } | null>(null);
  const caixa = useRef<HTMLSpanElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [pisca, piscar] = usePisca();
  const aberto = !!pos;
  const setAberto = (v: boolean) => {
    const r = caixa.current?.getBoundingClientRect();
    if (!v || !r) return setPos(null);
    // computador e tablet (acima de 768 px): ao lado do ícone, à esquerda dele; telemóvel: por baixo, dentro do ecrã
    const aoLado = window.innerWidth > 768;
    const ic = { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
    setPos(aoLado ? { top: r.top, right: Math.max(8, window.innerWidth - r.left + 6), aoLado, ic } : { top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right), aoLado, ic });
  };
  // o menu nunca sai do ecrã: ao lado do ícone fica centrado com ele na vertical (e sobe ou desce o que for preciso para caber); no
  // telemóvel fica à direita do ícone, passa para a esquerda dele se sair do ecrã, e vai por cima se não cabe por baixo
  useLayoutEffect(() => {
    const el = menu.current;
    if (!pos || !el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    let { top, right } = pos;
    if (pos.aoLado) {
      top = Math.min(Math.round((pos.ic.top + pos.ic.bottom) / 2 - h / 2), window.innerHeight - h - 8);
    } else {
      let left = pos.ic.right - w;
      if (left < 8) left = Math.min(pos.ic.left, window.innerWidth - w - 8);
      right = window.innerWidth - Math.max(8, left) - w;
      if (pos.ic.bottom + 6 + h > window.innerHeight - 8 && pos.ic.top - 6 - h >= 8) top = pos.ic.top - 6 - h;
    }
    top = Math.max(8, top);
    if (top !== pos.top || right !== pos.right) setPos({ ...pos, top, right });
  }, [pos]);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => !caixa.current?.contains(e.target as Node) && setPos(null);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setPos(null);
    const fechar = () => setPos(null);
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', esc);
    window.addEventListener('scroll', fechar);
    window.addEventListener('resize', fechar);
    return () => {
      document.removeEventListener('mousedown', fora);
      document.removeEventListener('keydown', esc);
      window.removeEventListener('scroll', fechar);
      window.removeEventListener('resize', fechar);
    };
  }, [aberto]);
  return (
    <span className="wp-pontos" ref={caixa}>
      <button
        className={'wp-pontos-btn' + (aberto ? ' on' : '') + (pisca ? ' pisca' : '')}
        onClick={() => {
          piscar();
          setAberto(!aberto);
        }}
        title={t('Mais opções')}
        aria-label={t('Mais opções')}
        aria-expanded={aberto}
      >
        <i className="fa-solid fa-ellipsis" />
      </button>
      {pos && (
        <div className="wp-menu" role="menu" ref={menu} style={{ top: pos.top, right: pos.right }}>
          {itens.map((x) => (
            <button
              key={x.t}
              role="menuitem"
              className={x.perigo ? 'perigo' : ''}
              onClick={() => {
                setAberto(false);
                x.run();
              }}
            >
              <i className={'fa-solid ' + x.fa} />
              <b>{t(x.t)}</b>
            </button>
          ))}
        </div>
      )}
    </span>
  );
}

/** "Manage Auto-Update" do DA */
function WpAutoModal({ d, atual, depois }: { d: string; atual: string; depois: () => void }) {
  const vh = useVH();
  const { t, closeM } = vh;
  const [v, setV] = useState(atual || 'minor');
  return (
    <>
      <h3>{t('Gerir a atualização automática')}</h3>
      <p style={{ lineHeight: 1.5 }}>{t('Escolha quando o WordPress de')} <b>{d}</b> {t('se atualiza sozinho.')}</p>
      <div className="wp-opcoes">
        {(
          [
            ['false', 'Nunca', 'O WordPress só se atualiza quando carregar em Atualizar.'],
            ['minor', 'Só versões de segurança', 'Recomendado: correções (ex.: 6.6.1 → 6.6.2), sem mudanças grandes.'],
            ['true', 'Todas as versões', 'Também as versões novas (ex.: 6.6 → 6.7).'],
          ] as [string, string, string][]
        ).map(([k, l, e]) => (
          <label key={k} className={v === k ? 'on' : ''}>
            <input type="radio" name="wp-auto" checked={v === k} onChange={() => setV(k)} />
            <span>
              <b>{t(l)}</b>
              <small>{t(e)}</small>
            </span>
          </label>
        ))}
      </div>
      <div className="mfoot">
        <button className="btn g" onClick={closeM}>
          {t('Cancelar')}
        </button>
        <button
          className="btn r"
          onClick={async () => {
            closeM();
            if (await noServidor(vh, { acao: 'wp-nucleo', dominio: d, op: 'auto', valor: v }, 'Atualização automática guardada')) depois();
          }}
        >
          {t('Guardar')}
        </button>
      </div>
    </>
  );
}

/** "Delete WordPress" do DA */
function WpApagarModal({ d, depois }: { d: string; depois: () => void }) {
  const vh = useVH();
  const { t, closeM } = vh;
  const [comBd, setComBd] = useState(true);
  return (
    <>
      <h3>{t('Apagar o WordPress?')}</h3>
      <p style={{ lineHeight: 1.5 }}>
        {t('Vai apagar os ficheiros do WordPress de')} <b>{d}</b> {t('(wp-admin, wp-includes, wp-content e os ficheiros wp-*.php). Os outros ficheiros da pasta ficam.')}
      </p>
      <label className="chk" style={{ margin: '10px 0 4px' }}>
        <input type="checkbox" checked={comBd} onChange={(e) => setComBd(e.target.checked)} />
        <span>{t('Apagar também a base de dados do WordPress')}</span>
      </label>
      <div className="mfoot">
        <button className="btn g" onClick={closeM}>
          {t('Cancelar')}
        </button>
        <button
          className="btn r"
          onClick={async () => {
            closeM();
            if (await noServidor(vh, { acao: 'wp-apagar', dominio: d, comBd }, 'WordPress apagado', true)) depois();
          }}
        >
          {t('Apagar')}
        </button>
      </div>
    </>
  );
}

/** Pasta com quebras possíveis só depois de cada "/" (no telemóvel passa à linha de baixo inteira, sem partir a meio
 *  de uma palavra como "public_htm|l") */
const comBarras = (p: string) =>
  p.split('/').map((x, i) => (
    <Fragment key={i}>
      {i > 0 && '/'}
      {i > 0 && <wbr />}
      {x}
    </Fragment>
  ));

/** Gestor de WordPress — igual ao "WordPress Manager" do DirectAdmin (instalações com o menu ⋯ e locais sem
 *  WordPress); o botão "Gerir" (plugins, atualizações, utilizadores) é um acrescento do painel */
function WordPressLista() {
  const vh = useVH();
  const { t, nav, openM } = vh;
  const { dados, erro, ler } = useLer<{ instalados: Wp[]; livres: { d: string; pasta: string }[] }>('wordpress');
  if (!dados) return <Carregando erro={erro} ler={ler} />;
  const enc = encodeURIComponent;
  return (
    <>
      <Sec
        titulo="Instalações do WordPress"
        desc="Lista das instâncias do WordPress instaladas. Pode ver os utilizadores do WordPress, mudar a atualização automática e a configuração da base de dados, apagar a instância do WordPress, abrir o site ou o painel do WordPress."
      >
        <DataTable
          id="wp"
          rows={dados.instalados}
          rowKey={(r) => r.d}
          empty="Não há WordPress instalados"
          cols={[
            { k: 'd', t: 'Domínio', cell: (r) => <a className="lk lk-dom" href={r.url || 'https://' + r.d} target="_blank" rel="noreferrer">{r.d}</a> },
            { k: 'pasta', t: 'Pasta', cell: (r) => <a className="lk wp-pasta" onClick={() => nav('/utilizador/ficheiros/' + r.pasta.split('/').map(enc).join('/'))}>{r.pasta}</a> },
            { k: 'v', t: 'Versão', cell: (r) => (r.versao ? <span className="wp-versao">{r.versao}</span> : '—') },
            { k: 'titulo', t: 'Título', cell: (r) => r.titulo || '—' },
            { k: 'auto', t: 'Atualização automática', cell: (r) => <span className={'tag ' + (r.auto === 'false' ? 'off' : 'ok')}>{t(AUTO[r.auto] || 'Só de segurança')}</span> },
          ]}
          actions={(r) => (
            <span className="dns-acoes">
              <MenuPontos
                itens={[
                  { fa: 'fa-gear', t: 'Gerir', run: () => nav('/utilizador/wordpress/' + enc(r.d)) },
                  { fa: 'fa-window-maximize', t: 'Abrir o painel do WordPress', run: () => entrarWp(vh, r.d) },
                  { fa: 'fa-users', t: 'Abrir a lista de utilizadores', run: () => nav('/utilizador/wordpress/' + enc(r.d) + '/utilizadores') },
                  { fa: 'fa-arrows-rotate', t: 'Gerir a atualização automática', run: () => openM(<WpAutoModal d={r.d} atual={r.auto} depois={ler} />) },
                  { fa: 'fa-database', t: 'Gerir a configuração da base de dados', run: () => nav('/utilizador/wordpress/' + enc(r.d) + '/base-de-dados') },
                  { fa: 'fa-trash-can', t: 'Apagar o WordPress', perigo: true, run: () => openM(<WpApagarModal d={r.d} depois={ler} />) },
                ]}
              />
            </span>
          )}
        />
      </Sec>
      <Sec titulo="Locais sem WordPress" desc="Lista dos locais prontos para instalar o WordPress.">
        {dados.livres.length ? (
          <DataTable
            id="wp-livres"
            rows={dados.livres}
            rowKey={(r) => r.d}
            cols={[
              { k: 'd', t: 'Domínio', cell: (r) => <b>{r.d}</b> },
              { k: 'pasta', t: 'Pasta', cell: (r) => <code className="wp-pasta">{r.pasta}</code> },
            ]}
            actions={(r) => (
              <button className="btn sm btn-ed" onClick={() => nav('/utilizador/wordpress/instalar/' + enc(r.d))}>
                <i className="fa-solid fa-download" />
                {t('Instalar')}
              </button>
            )}
          />
        ) : (
          <div className="tbl wp-vazio">
            <table>
              <thead>
                <tr>
                  <th>{t('Domínio')}</th>
                  <th>{t('Pasta')}</th>
                  <th style={{ textAlign: 'right' }}>{t('Acção')}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={3}>
                    <i className="fa-solid fa-triangle-exclamation" /> {t('Não foram encontrados locais possíveis para instalar o WordPress…')}
                    <button className="wp-recarregar" onClick={() => ler()} title={t('Procurar de novo')} aria-label={t('Procurar de novo')}>
                      <i className="fa-solid fa-arrows-rotate" />
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Sec>
    </>
  );
}

/** "Open Users List" do DA: utilizadores do WordPress e mudar a palavra-passe */
/** "Open Users List" do DA: tabela com "Entrar" em cada utilizador e, por baixo, "Mudar palavra-passe" */
function WpUtilizadores({ d }: { d: string }) {
  const vh = useVH();
  const { t } = vh;
  const { dados, erro, ler } = useLer<{ plugins: Plugin[]; users: WpUser[] }>('wp', { d });
  const [user, setUser] = useState('');
  const [senha, setSenha] = useState('');
  if (!dados) return <Carregando erro={erro} ler={ler} />;
  const mudar = async () => {
    if (await noServidor(vh, { acao: 'wp-senha', dominio: d, user, senha }, 'Palavra-passe mudada')) setSenha('');
  };
  return (
    <>
      <DataTable
        id="wp-users-da"
        rows={dados.users}
        rowKey={(r) => r.user_login}
        empty="Sem utilizadores"
        cols={[
          { k: 'n', t: 'Nome', sort: (r) => r.display_name || '', cell: (r) => r.display_name || '—' },
          { k: 'e', t: 'E-mail', cell: (r) => r.user_email || '—' },
          { k: 'l', t: 'Login', sort: (r) => r.user_login, cell: (r) => r.user_login },
          { k: 'g', t: 'Registado', sort: (r) => r.user_registered || '', cell: (r) => dataWp(r.user_registered) },
          { k: 'r', t: 'Papéis', cell: (r) => r.roles || '—' },
        ]}
        actions={(r) => (
          <button className="btn sm g" onClick={() => entrarWp(vh, d, r.user_login)} title={t('Entrar no WordPress como') + ' ' + r.user_login}>
            {t('Entrar')}
          </button>
        )}
      />
      <section className="wp-senha">
        <h3>{t('Mudar palavra-passe')}</h3>
        <p>{t('Pode mudar a palavra-passe de um utilizador escolhendo-o na lista abaixo e escrevendo a palavra-passe nova.')}</p>
        <label htmlFor="wp-senha-user">{t('Nome')}</label>
        <select id="wp-senha-user" className="inp" value={user} onChange={(e) => setUser(e.target.value)}>
          <option value="" />
          {dados.users.map((u) => (
            <option key={u.user_login} value={u.user_login}>
              {u.display_name && u.display_name !== u.user_login ? u.display_name + ' (' + u.user_login + ')' : u.user_login}
            </option>
          ))}
        </select>
        <label>{t('Nova palavra-passe')}</label>
        <Senha value={senha} onChange={setSenha} />
        <div className="wp-senha-pe">
          <button className="btn r" disabled={!user || senha.length < 8} onClick={mudar} title={senha && senha.length < 8 ? t('Pelo menos 8 caracteres') : undefined}>
            {t('Mudar')}
          </button>
        </div>
      </section>
    </>
  );
}

/** "Manage Database Configurations" do DA */
function WpBaseDados({ d }: { d: string }) {
  const vh = useVH();
  const { t, openM } = vh;
  const { dados, erro, ler } = useLer<{ nome: string; user: string; host: string; prefixo: string; daConta: boolean }>('wpbd', { d });
  if (!dados) return <Carregando erro={erro} ler={ler} />;
  const mudar = () =>
    openM(
      <Confirmar
        titulo="Mudar a palavra-passe da base de dados?"
        texto={'É criada uma palavra-passe nova para ' + (dados.user || 'o utilizador da base') + ', aplicada no MySQL e no wp-config.php. O site continua a funcionar.'}
        ok="Mudar"
        onOk={async () => {
          const j = await noServidor(vh, { acao: 'wp-bd-senha', dominio: d }, 'Palavra-passe da base de dados mudada');
          if (j?.senha) openM(<WpBdSenhaModal user={String(j.user || dados.user)} senha={String(j.senha)} />);
        }}
      />,
    );
  return (
    <Sec titulo="Configuração da base de dados" desc="Ligação deste WordPress ao MySQL (do ficheiro wp-config.php).">
      <div className="da-grelha">
        <div className="da-lin n2">
          {(
            [
              ['fa-database', 'Base de dados', dados.nome],
              ['fa-user', 'Utilizador', dados.user],
              ['fa-server', 'Servidor', dados.host],
              ['fa-table', 'Prefixo das tabelas', dados.prefixo],
            ] as [string, string, string][]
          ).map(([fa, l, v]) => (
            <div className="da-cel" key={l}>
              <i className={'fa-solid ' + fa} />
              <div>
                <small>{t(l)}</small>
                <span>{v || '—'}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="em-opcoes">
        <div>
          <span>{t('Palavra-passe da base de dados')}</span>
          {dados.daConta ? (
            <button className="btn sm btn-ed" onClick={mudar}>
              <i className="fa-solid fa-key" />
              {t('Mudar palavra-passe')}
            </button>
          ) : (
            <small style={{ color: 'var(--muted)' }}>{t('A base de dados não é desta conta: muda-se onde foi criada.')}</small>
          )}
        </div>
      </div>
    </Sec>
  );
}

function WpBdSenhaModal({ user, senha }: { user: string; senha: string }) {
  const { t, closeM, toast } = useVH();
  return (
    <>
      <h3>{t('Palavra-passe nova da base de dados')}</h3>
      <p style={{ lineHeight: 1.5 }}>{t('Já está no MySQL e no wp-config.php. Guarde-a se precisar dela noutro sítio — não volta a ser mostrada.')}</p>
      <div className="f">
        <label>{t('Utilizador')}</label>
        <input readOnly value={user} />
      </div>
      <div className="f">
        <label>{t('Palavra-passe')}</label>
        <input readOnly value={senha} onFocus={(e) => e.target.select()} />
      </div>
      <div className="mfoot">
        <button
          className="btn g"
          onClick={() => {
            navigator.clipboard?.writeText(senha).then(() => toast('Copiada'));
          }}
        >
          <i className="fa-solid fa-copy" />
          {t('Copiar')}
        </button>
        <button className="btn r" onClick={closeM}>
          {t('Fechar')}
        </button>
      </div>
    </>
  );
}

/** Instalar o WordPress — os campos do "Criar instalação WordPress" do DA (Silva, 16/10/2026): à vista só a pasta e o
 *  título; o "Modo avançado" abre o administrador, a base de dados (nova ou uma da conta) e o prefixo das tabelas. Sem o
 *  modo avançado, o administrador é a conta, com o e-mail dela e uma palavra-passe gerada (mostrada no fim). */
function WpInstalar({ d }: { d: string }) {
  const vh = useVH();
  const { t, nav, openM } = vh;
  const dom = vh.a.domains.find((x) => x.name === d);
  const raiz = (dom?.docroot || `/home/${vh.me}/web/${d}/public_html`).replace(`/home/${vh.me}/`, '').replace(/\/+$/, '') + '/';
  const [f, setF] = useState(() => ({ pasta: '', titulo: '', email: vh.a.email || '', user: vh.me, senha: novaSenha(), bd: '', bdSenha: '', prefixo: 'wp_' }));
  const [avancado, setAvancado] = useState(false);
  const [verBd, setVerBd] = useState(false);
  const [a, setA] = useState(false);
  const bds = vh.a.dbs || [];
  const bd = bds.find((x) => x.nome === f.bd);
  const emailOk = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(f.email);
  const pronto = !a && /^[A-Za-z0-9._@-]{3,60}$/.test(f.user) && f.senha.length >= 8 && emailOk && /^[A-Za-z0-9_]{1,20}$/.test(f.prefixo) && (!bd || !!f.bdSenha);
  const instalar = async () => {
    setA(true);
    const pasta = f.pasta.trim().replace(/^\/+|\/+$/g, '');
    const ok = await noServidor(vh, { acao: 'wp-instalar', dominio: d, titulo: f.titulo, user: f.user, senha: f.senha, email: f.email, pasta, prefixo: f.prefixo, ...(bd ? { bd: bd.nome, bdUser: bd.user, bdSenha: f.bdSenha } : {}) }, 'WordPress instalado em ' + d + (pasta ? '/' + pasta : ''), true);
    setA(false);
    if (!ok) return;
    // a palavra-passe gerada só se vê aqui (sem o modo avançado, quem instala não a escreveu)
    openM(<WpCredenciais url={'https://' + d + (pasta ? '/' + pasta : '') + '/wp-admin'} user={f.user} senha={f.senha} />);
    nav(pasta ? '/utilizador/wordpress' : '/utilizador/wordpress/' + encodeURIComponent(d));
  };
  return (
    <Sec titulo={'Instalar o WordPress em ' + d} desc="É criada uma base de dados nova e o WordPress fica pronto a usar (com ligações permanentes bonitas). Se a pasta já tiver ficheiros, ficam lá.">
      <Campo label="Diretório" hint="Local onde o WordPress será instalado (vazio = a raiz do site)" id="wp-pasta">
        <div className="igrp wp-pasta">
          <span className="da-sufixo">{raiz}</span>
          <input id="wp-pasta" value={f.pasta} onChange={(e) => setF({ ...f, pasta: e.target.value.replace(/[^A-Za-z0-9._/-]/g, '') })} placeholder={t('ex.: blog')} />
        </div>
      </Campo>
      <Campo label="Título" hint="Nome da instalação do WordPress" id="wp-titulo">
        <input id="wp-titulo" value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} placeholder={d} />
      </Campo>
      {avancado && (
        <>
          <Campo label="E-mail do administrador" hint="Endereço de e-mail usado para entrar no painel do WordPress e receber as notificações" id="wp-email">
            <input id="wp-email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value.trim() })} />
          </Campo>
          <Campo label="Nome da conta administrativa" hint="Nome de utilizador usado para entrar no painel do WordPress" id="wp-user">
            <input id="wp-user" value={f.user} onChange={(e) => setF({ ...f, user: e.target.value.trim() })} autoComplete="off" />
          </Campo>
          <Campo label="Palavra-passe do administrador" hint="Palavra-passe usada para entrar no painel do WordPress (pelo menos 8 caracteres)">
            <Senha value={f.senha} onChange={(v) => setF({ ...f, senha: v })} />
          </Campo>
          <Campo label="Nome da base de dados" hint="Uma base de dados nova, criada para este WordPress, ou uma da conta" id="wp-bd">
            <select id="wp-bd" value={f.bd} onChange={(e) => setF({ ...f, bd: e.target.value, bdSenha: '' })}>
              <option value="">{t('Criar uma nova (automático)')}</option>
              {bds.map((b) => (
                <option key={b.nome} value={b.nome}>
                  {b.nome}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Utilizador da base de dados" id="wp-bd-user">
            <select id="wp-bd-user" value={bd?.user || ''} disabled={!bd} onChange={() => {}}>
              {bd ? <option value={bd.user}>{bd.user}</option> : <option value="">{t('Criado com a base de dados nova')}</option>}
            </select>
          </Campo>
          <Campo label="Palavra-passe da base de dados" hint={bd ? 'A palavra-passe do utilizador da base de dados escolhida' : 'Gerada automaticamente com a base de dados nova'}>
            <div className="igrp">
              <input type={verBd ? 'text' : 'password'} value={f.bdSenha} disabled={!bd} onChange={(e) => setF({ ...f, bdSenha: e.target.value })} autoComplete="new-password" placeholder={bd ? '' : t('Gerada automaticamente')} />
              <button type="button" className="ib" disabled={!bd} title={t(verBd ? 'Esconder' : 'Mostrar')} onClick={() => setVerBd(!verBd)}>
                <i className={'fa-solid ' + (verBd ? 'fa-eye-slash' : 'fa-eye')} />
              </button>
            </div>
          </Campo>
          <Campo label="Prefixo das tabelas" hint="Letras, números e _ — outro prefixo deixa ter mais de um WordPress na mesma base de dados" id="wp-prefixo">
            <input id="wp-prefixo" value={f.prefixo} onChange={(e) => setF({ ...f, prefixo: e.target.value.replace(/[^A-Za-z0-9_]/g, '') })} />
          </Campo>
        </>
      )}
      <div className="da-fim">
        <button type="button" className="wp-avancado" onClick={() => setAvancado(!avancado)} aria-expanded={avancado}>
          <i className={'fa-solid ' + (avancado ? 'fa-chevron-up' : 'fa-chevron-down')} />
          {t('Modo avançado')}
        </button>
        <button className="btn r" disabled={!pronto} onClick={instalar}>
          <i className="fa-solid fa-circle-plus" />
          {t(a ? 'A instalar… (pode levar um minuto)' : 'Criar')}
        </button>
      </div>
    </Sec>
  );
}

/** Depois de instalar: o endereço do painel do WordPress, o utilizador e a palavra-passe (com copiar) */
function WpCredenciais({ url, user, senha }: { url: string; user: string; senha: string }) {
  const { t, closeM, toast } = useVH();
  return (
    <>
      <h3>{t('WordPress instalado')}</h3>
      <p style={{ lineHeight: 1.5 }}>{t('Guarde estes dados para entrar no painel do WordPress. A palavra-passe não volta a ser mostrada (pode sempre entrar pelo botão "Painel do WordPress").')}</p>
      <div className="f">
        <label>{t('Endereço')}</label>
        <input readOnly value={url} onFocus={(e) => e.target.select()} />
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
        <button className="btn g" onClick={() => navigator.clipboard?.writeText(senha).then(() => toast('Copiada'))}>
          <i className="fa-solid fa-copy" />
          {t('Copiar a palavra-passe')}
        </button>
        <button className="btn r" onClick={closeM}>
          {t('Fechar')}
        </button>
      </div>
    </>
  );
}

function WpGerir({ d }: { d: string }) {
  const vh = useVH();
  const { t } = vh;
  const lista = useLer<{ instalados: Wp[] }>('wordpress');
  const { dados, erro, ler } = useLer<{ plugins: Plugin[]; users: WpUser[]; nucleo?: { disponivel: boolean; versao: string } | null }>('wp', { d });
  const wp = lista.dados?.instalados.find((x) => x.d === d);
  return (
    <>
      <Sec titulo="Resumo">
        <div className="da-grelha">
          <div className="da-lin n3">
            <div className="da-cel">
              <i className="fa-brands fa-wordpress" />
              <div>
                <small>{t('Versão')}</small>
                <span>{wp?.versao || '…'}</span>
              </div>
            </div>
            <div className="da-cel">
              <i className="fa-solid fa-heading" />
              <div>
                <small>{t('Título')}</small>
                <span>{wp?.titulo || '…'}</span>
              </div>
            </div>
            <div className="da-cel">
              <i className="fa-solid fa-palette" />
              <div>
                <small>{t('Tema')}</small>
                <span>{wp?.tema || '…'}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="em-opcoes">
          <div>
            <span>{t('Atualização automática do WordPress')}</span>
            <select className="em-sel" value={wp?.auto || 'minor'} onChange={async (e) => (await noServidor(vh, { acao: 'wp-nucleo', dominio: d, op: 'auto', valor: e.target.value }, 'Guardado')) && lista.ler()}>
              {Object.entries(AUTO).map(([k, v]) => (
                <option key={k} value={k}>
                  {t(v)}
                </option>
              ))}
            </select>
          </div>
          {/* só há botão quando existe uma versão nova do WordPress; depois de atualizar, lê-se outra vez e o botão desaparece (Silva, 22/10/2026) */}
          {dados?.nucleo?.disponivel && (
            <div>
              <span>{dados.nucleo.versao ? t('Atualizar o WordPress para a versão') + ' ' + dados.nucleo.versao : t('Atualizar o WordPress para a última versão')}</span>
              <button
                className="btn sm btn-ed"
                onClick={async () => {
                  if (await noServidor(vh, { acao: 'wp-nucleo', dominio: d, op: 'atualizar' }, 'WordPress atualizado')) {
                    await Promise.all([lista.ler(), ler()]);
                  }
                }}
              >
                <i className="fa-solid fa-arrows-rotate" />
                {t('Atualizar')}
              </button>
            </div>
          )}
          <WpOpcoes d={d} />
        </div>
      </Sec>
    </>
  );
}

/** Separador «Plugins» do Gerir WordPress (Silva, 31/10/2026): a lista de plugins, que saiu do separador «Gestão» */
function WpPlugins({ d }: { d: string }) {
  const vh = useVH();
  const { dados, erro, ler } = useLer<{ plugins: Plugin[] }>('wp', { d });
  // acções dos plugins (um ou vários de uma vez, como as «Acções por lote» do WordPress) e envio de cada .zip (Adicionar plugin)
  const plugins = async (op: OpPluginWp, nomes: string[]) => {
    if (!(await noServidor(vh, { acao: 'wp-plugin', dominio: d, op, plugins: nomes }, 'Feito'))) return false;
    await ler();
    return true;
  };
  const atualizarTodos = async () => {
    if (!(await noServidor(vh, { acao: 'wp-plugin', dominio: d, op: 'atualizar-todos' }, 'Feito'))) return false;
    await ler();
    return true;
  };
  const enviarPlugin = async (ficheiro: File): Promise<string | null> => {
    const fd = new FormData();
    fd.append('conta', vh.me);
    fd.append('dominio', d);
    fd.append('activar', '0'); // como no WordPress: instala; activa-se depois na lista
    fd.append('ficheiro', ficheiro);
    try {
      const r = await fetch('/api/vhost/avancado', { method: 'POST', body: fd });
      const j = (await r.json().catch(() => ({}))) as { erro?: string };
      return r.ok ? null : String(j.erro || 'A instalação falhou');
    } catch {
      return 'Sem ligação ao site. Nada foi alterado.';
    }
  };
  if (!dados) return <Carregando erro={erro} ler={ler} />;
  return <PluginsWp plugins={dados.plugins} executar={plugins} atualizarTodos={atualizarTodos} enviar={enviarPlugin} recarregar={ler} />;
}

/** Linhas das opções do WordPress por baixo do selector da atualização automática (ícone do site, página principal da home e ligações permanentes) */
function WpOpcoes({ d }: { d: string }) {
  const vh = useVH();
  const { dados, ler } = useLer<OpcoesWp>('wpopcoes', { d });
  if (!dados) return null; // a carregar: as linhas aparecem quando chegar a leitura
  return <OpcoesWordPress d={d} dados={dados} recarregar={ler} guardar={async (corpo, ok) => !!(await noServidor(vh, { ...corpo, dominio: d }, ok))} />;
}

/** Separadores do Gerir WordPress (como os dos Domínios): Gestão (atualização do WordPress e opções) · Plugins · Utilizadores · Páginas */
type AbaWp = 'gestao' | 'plugins' | 'utilizadores' | 'paginas';
function WpAbas({ d, aba }: { d: string; aba: AbaWp }) {
  const { nav } = useVH();
  return (
    <Tabs<AbaWp>
      tabs={[
        ['gestao', 'Gestão', 'fa-gauge-high'],
        ['plugins', 'Plugins', 'fa-plug'],
        ['utilizadores', 'Utilizadores', 'fa-users'],
        ['paginas', 'Páginas', 'fa-file-lines'],
      ]}
      on={aba}
      onChange={(k) => nav('/utilizador/wordpress/' + encodeURIComponent(d) + (k === 'gestao' ? '' : '/' + k))}
    />
  );
}

type PaginaWp = { ID: number; post_title: string; post_status: string; post_modified: string; post_name: string; url?: string; elementor?: boolean; modelo?: string };
const ESTADO_PG: Record<string, string> = { publish: 'Publicada', draft: 'Rascunho', pending: 'Pendente', private: 'Privada', future: 'Agendada' };

/** Separador "Páginas": as páginas do site; "Editar" abre o editor de blocos do WordPress dentro do painel */
function WpPaginas({ d }: { d: string }) {
  const vh = useVH();
  const { t, nav } = vh;
  const { dados, erro, ler } = useLer<{ paginas: PaginaWp[] }>('wppaginas', { d });
  // a página com a edição rápida aberta (a seta de cada linha, como a «Edição rápida» do WordPress)
  const [aberta, setAberta] = useState<number | null>(null);
  if (!dados) return <Carregando erro={erro} ler={ler} />;
  const enc = encodeURIComponent;
  return (
    <Sec titulo="Páginas" desc="As páginas deste site. Edite-as aqui com o editor de blocos do WordPress, sem entrar no WordPress." numeros={[['Páginas', String(dados.paginas.length)]]}>
      <DataTable
        id="wp-paginas"
        rows={dados.paginas}
        rowKey={(r) => String(r.ID)}
        search={(r) => r.post_title}
        onRecarregar={ler}
        empty="Este site ainda não tem páginas"
        cols={[
          {
            k: 't',
            t: 'Título',
            sort: (r) => r.post_title,
            cell: (r) => (
              <span className="wp-pg-tit">
                <button className={'wp-pg-chev' + (aberta === r.ID ? ' on' : '')} aria-expanded={aberta === r.ID} title={t('Edição rápida')} aria-label={t('Edição rápida')} onClick={() => setAberta(aberta === r.ID ? null : r.ID)}>
                  <i className={'fa-solid ' + (aberta === r.ID ? 'fa-chevron-up' : 'fa-chevron-down')} />
                </button>
                <b>{r.post_title || t('(sem título)')}</b>
                {r.elementor && <span className="tag off">Elementor</span>}
              </span>
            ),
          },
          { k: 'e', t: 'Estado', cell: (r) => <span className={'tag ' + (r.post_status === 'publish' ? 'ok' : 'off')}>{t(ESTADO_PG[r.post_status] || r.post_status)}</span> },
          { k: 'm', t: 'Última alteração', sort: (r) => r.post_modified, cell: (r) => dataWp(r.post_modified) },
        ]}
        linhaExtra={(r) => (aberta === r.ID ? <EdicaoRapidaPagina key={r.ID} d={d} r={r} fechar={() => setAberta(null)} depois={() => ler(true)} /> : null)}
        actions={(r) => (
          <MenuPontos
            itens={[
              { fa: 'fa-sliders', t: 'Edição rápida', run: () => setAberta(aberta === r.ID ? null : r.ID) },
              { fa: 'fa-pen', t: 'Editar no WordPress', run: () => entrarWp(vh, d, undefined, r.ID) },
              // só as páginas feitas com o Elementor têm esta opção (o editor de blocos estragava-as)
              ...(r.elementor ? [{ fa: 'fa-pen-to-square', t: 'Editar com Elementor', run: () => entrarWp(vh, d, undefined, r.ID, 'elementor') }] : []),
              { fa: 'fa-i-cursor', t: 'Mudar nome', run: () => vh.openM(<NomePaginaModal inicial={r.post_title} onOk={async (titulo) => { if (await noServidor(vh, { acao: 'wp-pagina-renomear', dominio: d, id: r.ID, titulo }, 'Página renomeada')) ler(); }} />) },
              { fa: 'fa-arrow-up-right-from-square', t: 'Ver a página online', run: () => r.url && window.open(r.url, '_blank', 'noopener,noreferrer') },
            ]}
          />
        )}
      />
    </Sec>
  );
}

/** Modelos de uma página feita com o Elementor (o seletor «Modelo» da edição rápida do WordPress) */
const MODELOS_ELEMENTOR: [string, string][] = [
  ['default', 'Predefinição do tema'],
  ['elementor_canvas', 'Elementor Canvas'],
  ['elementor_header_footer', 'Elementor largura total'],
];
const ESTADOS_EDITAVEIS: [string, string][] = [
  ['publish', 'Publicada'],
  ['draft', 'Rascunho'],
  ['pending', 'Pendente'],
  ['private', 'Privada'],
];

/** Linha que se abre pela seta de cada página (como a «Edição rápida» do WordPress): título, endereço (slug), estado e, nas páginas feitas com o
 *  Elementor, o modelo (largura total, Canvas…). Guarda pelo WP-CLI; mudar o endereço muda o link da página. */
function EdicaoRapidaPagina({ d, r, fechar, depois }: { d: string; r: PaginaWp; fechar: () => void; depois: () => void }) {
  const vh = useVH();
  const { t } = vh;
  const [titulo, setTitulo] = useState(r.post_title || '');
  const [slug, setSlug] = useState(r.post_name || '');
  // «Agendada» não se muda daqui (deixa-se como está)
  const editavel = ESTADOS_EDITAVEIS.some(([k]) => k === r.post_status);
  const [estado, setEstado] = useState(editavel ? r.post_status : '');
  const [modelo, setModelo] = useState(MODELOS_ELEMENTOR.some(([k]) => k === r.modelo) ? (r.modelo as string) : 'default');
  const slugOk = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
  const mudou = titulo !== (r.post_title || '') || slug !== (r.post_name || '') || (editavel && estado !== r.post_status) || (r.elementor && modelo !== (MODELOS_ELEMENTOR.some(([k]) => k === r.modelo) ? r.modelo : 'default'));
  const guardar = async () => {
    const ok = await noServidor(vh, { acao: 'wp-pagina-editar', dominio: d, id: r.ID, titulo, slug, estado: editavel ? estado : '', modelo: r.elementor ? modelo : '' }, 'Página actualizada');
    if (ok) {
      depois();
      fechar();
    }
  };
  return (
    <div className="wp-edicao">
      <div className="wp-edicao-grelha">
        <div className="f">
          <label>{t('Título')}</label>
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={300} />
        </div>
        <div className="f">
          <label>{t('Endereço (slug)')}</label>
          <input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))} maxLength={190} aria-invalid={!slugOk} />
          {!slugOk && <small className="wp-edicao-aviso">{t('Só letras minúsculas, números e hífenes (ex.: sobre-nos).')}</small>}
        </div>
        <div className="f">
          <label>{t('Estado')}</label>
          {editavel ? (
            <select value={estado} onChange={(e) => setEstado(e.target.value)}>
              {ESTADOS_EDITAVEIS.map(([k, n]) => (
                <option key={k} value={k}>
                  {t(n)}
                </option>
              ))}
            </select>
          ) : (
            <select value="" disabled>
              <option value="">{t(ESTADO_PG[r.post_status] || r.post_status)}</option>
            </select>
          )}
        </div>
        {r.elementor && (
          <div className="f">
            <label>{t('Modelo')}</label>
            <select value={modelo} onChange={(e) => setModelo(e.target.value)}>
              {MODELOS_ELEMENTOR.map(([k, n]) => (
                <option key={k} value={k}>
                  {t(n)}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      <p className="wp-edicao-nota">{t('Mudar o endereço muda o link da página: os links antigos deixam de funcionar.')}</p>
      <div className="wp-edicao-botoes">
        <button className="btn r" disabled={!mudou || !titulo.trim() || !slugOk} onClick={guardar}>
          {t('Actualizar')}
        </button>
        <button className="btn g" onClick={fechar}>
          {t('Cancelar')}
        </button>
      </div>
    </div>
  );
}

/** "Mudar nome" de uma página do WordPress: só o título (o conteúdo e o endereço ficam como estão) */
function NomePaginaModal({ inicial, onOk }: { inicial: string; onOk: (titulo: string) => void }) {
  const { t, closeM } = useVH();
  const [v, setV] = useState(inicial || '');
  const ok = () => v.trim() && (closeM(), onOk(v.trim()));
  return (
    <>
      <h3>{t('Mudar nome da página')}</h3>
      <div className="f">
        <label>{t('Nome')}</label>
        <input value={v} onChange={(e) => setV(e.target.value)} autoFocus onFocus={(e) => e.target.select()} onKeyDown={(e) => e.key === 'Enter' && ok()} maxLength={300} />
      </div>
      <div className="mfoot">
        <button className="btn g" onClick={closeM}>
          {t('Cancelar')}
        </button>
        <button className="btn r" disabled={!v.trim()} onClick={ok}>
          {t('Guardar')}
        </button>
      </div>
    </>
  );
}

/** Editar uma página com o editor de blocos (Gutenberg) dentro do painel; guarda pelo WP-CLI */
function WpEditarPagina({ d, id }: { d: string; id: number }) {
  const vh = useVH();
  const { t, nav } = vh;
  const { dados, erro, ler } = useLer<{ id: number; titulo: string; estado: string; conteudo: string; url?: string }>('wppagina', { d, id: String(id) });
  // as traduções do editor que o site tem (site em português → editor em português)
  const idioma = useLer<{ lingua: string; mensagens: Record<string, unknown> }>('wpidioma', { d });
  const [titulo, setTitulo] = useState<string | null>(null);
  const conteudo = useRef<string | null>(null);
  const [mudou, setMudou] = useState(false);
  if (!dados || (!idioma.dados && !idioma.erro)) return <Carregando erro={erro} ler={ler} />;
  const guardar = async () => {
    if (await noServidor(vh, { acao: 'wp-pagina-guardar', dominio: d, id, titulo: titulo ?? dados.titulo, conteudo: conteudo.current ?? dados.conteudo }, 'Página guardada')) {
      setMudou(false);
      ler(true);
    }
  };
  return (
    <div
      className="gb-pagina"
      onKeyDownCapture={(e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
          e.preventDefault();
          if (mudou) guardar();
        }
      }}
    >
      <div className="gb-barra">
        <button className="btn g" onClick={() => nav('/utilizador/wordpress/' + encodeURIComponent(d) + '/paginas')}>
          <i className="fa-solid fa-arrow-left" />
          {t('Páginas')}
        </button>
        <span className="sp" />
        {mudou && <span className="tag w">{t('Por guardar')}</span>}
        {dados.url && (
          <a className="btn g" href={dados.url} target="_blank" rel="noreferrer">
            <i className="fa-solid fa-arrow-up-right-from-square" />
            {t('Ver a página')}
          </a>
        )}
        <button className="btn r" disabled={!mudou} onClick={guardar}>
          <i className="fa-solid fa-floppy-disk" />
          {t('Guardar')}
        </button>
      </div>
      <input
        className="gb-titulo"
        value={titulo ?? dados.titulo}
        placeholder={t('Título da página')}
        onChange={(e) => {
          setTitulo(e.target.value);
          setMudou(true);
        }}
      />
      <EditorBlocos
        inicial={dados.conteudo}
        traducoes={idioma.dados?.mensagens}
        onChange={(html: string) => {
          conteudo.current = html;
          setMudou(true);
        }}
      />
    </div>
  );
}

export const wordpressPagina: ScreenFn = (vh) => {
  const [a, b] = vh.s.sub;
  const base = { t: 'WordPress', path: '/utilizador/wordpress' };
  // o seletor de domínio abre a mesma página no domínio escolhido (sem WordPress nele: a lista)
  const noDominio = (resto: string) => ({
    dominios: 'sites' as const,
    dominioUrl: { d: a, ir: (n: string) => (vh.a.domains.find((x) => x.name === n)?.wp ? '/utilizador/wordpress/' + encodeURIComponent(n) + resto : '/utilizador/wordpress') },
  });
  if (a === 'instalar' && b) return { title: 'Instalar o WordPress', crumbs: [base, { t: 'Instalar' }], dominios: 'sites', dominioUrl: { d: b, ir: (n) => '/utilizador/wordpress/instalar/' + encodeURIComponent(n) }, body: <WpInstalar key={b} d={b} /> };
  const sitePainel = <BotoesSiteWp d={a} />;
  const naPagina = { t: a, path: '/utilizador/wordpress/' + encodeURIComponent(a) };
  if (a && b === 'paginas' && vh.s.sub[2])
    return {
      title: 'Editar página',
      desc: a,
      crumbs: [base, naPagina, { t: 'Páginas', path: '/utilizador/wordpress/' + encodeURIComponent(a) + '/paginas' }, { t: 'Editar' }],
      ...noDominio('/paginas'),
      body: <WpEditarPagina key={a + '/' + vh.s.sub[2]} d={a} id={Number(vh.s.sub[2])} />,
    };
  if (a && (b === 'utilizadores' || b === 'paginas' || b === 'plugins'))
    return {
      title: 'Gerir WordPress',
      desc: a,
      crumbs: [base, naPagina, { t: b === 'paginas' ? 'Páginas' : b === 'plugins' ? 'Plugins' : 'Utilizadores' }],
      ...noDominio('/' + b),
      actions: sitePainel,
      body: (
        <>
          <WpAbas d={a} aba={b} />
          {b === 'paginas' ? <WpPaginas key={a} d={a} /> : b === 'plugins' ? <WpPlugins key={a} d={a} /> : <WpUtilizadores key={a} d={a} />}
        </>
      ),
    };
  if (a && b === 'base-de-dados') return { title: 'Configuração da base de dados', desc: a, crumbs: [base, { t: a, path: '/utilizador/wordpress/' + encodeURIComponent(a) }, { t: 'Base de dados' }], ...noDominio('/base-de-dados'), body: <WpBaseDados key={a} d={a} /> };
  if (a)
    return {
      title: 'Gerir WordPress',
      desc: a,
      crumbs: [base, { t: a }],
      ...noDominio(''),
      actions: sitePainel,
      body: (
        <>
          <WpAbas d={a} aba="gestao" />
          <WpGerir key={a} d={a} />
        </>
      ),
    };
  // só "WordPress" (Silva, 14/10/2026: "Gestor de WordPress" ocupava a faixa e chocava com um domínio comprido)
  return { title: 'WordPress', body: <WordPressLista /> };
};

// ---------- Antivírus (ClamAV) ----------
type Relatorio = { id: string; caminho: string; inicio: string; fim?: string; estado: string; infetados: { ficheiro: string; ameaca: string }[] };
function RelatorioModal({ r }: { r: Relatorio }) {
  const { t, closeM } = useVH();
  return (
    <>
      <h3>{t('Relatório da análise')}</h3>
      <p style={{ color: 'var(--muted)', marginBottom: 10 }}>
        <code>{r.caminho}</code> · {r.inicio}
        {r.fim ? ' → ' + r.fim : ''}
      </p>
      {r.infetados.length ? (
        <div className="tbl mini" style={{ margin: 0, maxHeight: 320, overflow: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>{t('Ficheiro')}</th>
                <th>{t('Ameaça')}</th>
              </tr>
            </thead>
            <tbody>
              {r.infetados.map((x) => (
                <tr key={x.ficheiro}>
                  <td style={{ whiteSpace: 'normal', wordBreak: 'break-all' }}>{x.ficheiro}</td>
                  <td>
                    <span className="tag bad">{x.ameaca}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>
          <span className="tag ok">{t('Nada encontrado')}</span>
        </p>
      )}
      <div className="mfoot">
        <button className="btn r" onClick={closeM}>
          {t('Fechar')}
        </button>
      </div>
    </>
  );
}

function ClamAv({ aba }: { aba: 'ativas' | 'relatorios' }) {
  const vh = useVH();
  const { t, openM, me } = vh;
  const setAba = (k: 'ativas' | 'relatorios') => vh.nav('/utilizador/clamav' + (k === 'relatorios' ? '/relatorios' : ''));
  const [outro, setOutro] = useState('');
  const { dados, erro, ler } = useLer<{ ativos: { pid: string; caminho: string }[]; relatorios: Relatorio[] }>('clamav');
  const aCorrer = !!dados && (dados.ativos.length > 0 || dados.relatorios.some((r) => r.estado === 'a analisar'));
  useEffect(() => {
    if (!aCorrer) return;
    const i = setInterval(() => ler(true), 8000); // em segundo plano: sem a linha do topo
    return () => clearInterval(i);
  }, [aCorrer, ler]);
  if (!dados) return <Carregando erro={erro} ler={ler} />;
  const analisar = async (alvo: string, caminho = '') => (await noServidor(vh, { acao: 'clamav-analisar', alvo, caminho }, 'Análise começada')) && (ler(), setAba('ativas'));
  const alvos: [string, string, string, string][] = [
    ['casa', 'fa-house', 'Pasta da conta', 'Analisar tudo em /home/' + me],
    ['sites', 'fa-globe', 'Sites', 'Analisar a pasta dos sites'],
    ['mail', 'fa-envelope', 'E-mail', 'Analisar as caixas de correio'],
  ];
  return (
    <>
      <Tabs
        tabs={[
          ['ativas', 'Análises a correr', 'fa-shield-virus'],
          ['relatorios', 'Relatórios', 'fa-file-lines'],
        ]}
        on={aba}
        onChange={setAba}
      />
      {aba === 'ativas' ? (
        <>
          <Sec titulo="Análises a correr" desc="Análises do ClamAV que estão a decorrer nesta conta.">
            <DataTable
              id="clamav-ativas"
              rows={dados.relatorios.filter((r) => r.estado === 'a analisar')}
              rowKey={(r) => r.id}
              onRecarregar={ler}
              empty="O ClamAV não está a analisar nada neste momento"
              cols={[
                { k: 'c', t: 'Caminho', cell: (r) => <code>{r.caminho}</code> },
                { k: 'i', t: 'Começou', cell: (r) => r.inicio },
                { k: 'e', t: 'Estado', cell: () => <span className="tag w"><i className="fa-solid fa-hourglass-half" /> {t('a analisar')}</span> },
              ]}
            />
          </Sec>
          <Sec titulo="Analisar" desc="Procurar vírus e outros ficheiros maliciosos.">
            <div className="av-alvos">
              {alvos.map(([k, fa, l, desc]) => (
                <button key={k} className="av-alvo" onClick={() => analisar(k)}>
                  <i className={'fa-solid ' + fa} />
                  <b>{t(l)}</b>
                  <small>{t(desc)}</small>
                </button>
              ))}
              <div className="av-alvo outro">
                <i className="fa-solid fa-folder-tree" />
                <b>{t('Outro caminho')}</b>
                <span className="igrp">
                  <span className="ib" style={{ cursor: 'default' }}>
                    /home/{me}/
                  </span>
                  <input value={outro} onChange={(e) => setOutro(e.target.value.trim())} placeholder="web/exemplo.com/public_html" aria-label={t('Caminho')} />
                </span>
                <button className="btn r sm" disabled={!outro} onClick={() => analisar('outro', outro)}>
                  {t('Analisar caminho')}
                </button>
              </div>
            </div>
          </Sec>
        </>
      ) : (
        <Sec titulo="Relatórios" desc="Resultado das análises feitas nesta conta.">
          <DataTable
            id="clamav-relatorios"
            rows={dados.relatorios.filter((r) => r.estado !== 'a analisar')}
            rowKey={(r) => r.id}
            onRecarregar={ler}
            empty="Ainda não há relatórios"
            cols={[
              { k: 'i', t: 'Data', sort: (r) => r.id, cell: (r) => r.inicio },
              { k: 'c', t: 'Caminho', cell: (r) => <code>{r.caminho}</code> },
              { k: 'n', t: 'Resultado', cell: (r) => (r.estado === 'erro' ? <span className="tag w">{t('Erro na análise')}</span> : r.infetados.length ? <span className="tag bad">{r.infetados.length + ' ' + t('ficheiro(s) infetado(s)')}</span> : <span className="tag ok">{t('Nada encontrado')}</span>) },
            ]}
            actions={(r) => (
              <span className="dns-acoes">
                <button className="btn sm btn-ed" onClick={() => openM(<RelatorioModal r={r} />)}>
                  {t('Ver')}
                </button>
                <button className="btn sm btn-rm" onClick={async () => (await noServidor(vh, { acao: 'clamav-apagar', ids: [r.id] }, 'Relatório apagado')) && ler()}>
                  {t('Apagar')}
                </button>
              </span>
            )}
            bulk={[{ t: 'Apagar', fa: 'fa-trash', run: async (k) => (await noServidor(vh, { acao: 'clamav-apagar', ids: k }, 'Relatório(s) apagado(s)')) && ler() }]}
          />
        </Sec>
      )}
    </>
  );
}
export const clamavPagina: ScreenFn = (vh) => {
  const r = vh.s.sub[0] === 'relatorios';
  return { title: 'Antivírus', crumbs: r ? [{ t: 'Antivírus', path: '/utilizador/clamav' }, { t: 'Relatórios' }] : undefined, body: <ClamAv aba={r ? 'relatorios' : 'ativas'} /> };
};
