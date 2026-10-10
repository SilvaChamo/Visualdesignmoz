'use client';

// Menu Avançado do painel Utilizador (páginas copiadas do DirectAdmin, ligadas ao Hestia por /api/vhost/avancado):
// Handlers e MIME, Cópias de segurança, Tarefas cron, Chaves de login, Pastas protegidas, Chaves SSH,
// Firewall de aplicação (ModSecurity), Git, WordPress e Antivírus. O Catch-all está em paginas/email.tsx.
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useVH, type VH } from '../context';
import type { ScreenFn } from '../screens';
import { Check, DataTable, Senha, Switch, Tabs } from './componentes';
import { Confirmar } from './pacotes';

// ---------- Peças comuns ----------
const url = (me: string, ver: string, extra: Record<string, string> = {}) => '/api/vhost/avancado?' + new URLSearchParams({ conta: me, ver, ...extra }).toString();

/** Lê um endereço da API (com o que já foi lido guardado: aparece logo ao voltar) */
const lidos = new Map<string, unknown>();
function useLer<T>(ver: string, extra: Record<string, string> = {}, ativo = true) {
  const { me } = useVH();
  const u = url(me, ver, extra);
  const [dados, setDados] = useState<T | null>(() => (lidos.get(u) as T) || null);
  const [erro, setErro] = useState('');
  const ler = useCallback(async () => {
    if (!ativo) return;
    setErro('');
    try {
      const r = await fetch(u, { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.erro || 'Erro a ler o servidor');
      lidos.set(u, j);
      setDados(j as T);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro a ler o servidor');
    }
  }, [u, ativo]);
  useEffect(() => {
    setDados((lidos.get(u) as T) || null);
    ler();
  }, [ler, u]);
  return { dados, erro, ler };
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
  ) : (
    <div className="espera-nota">
      <i className="fa-solid fa-circle-notch fa-spin" /> {t('A ler o servidor…')}
    </div>
  );
}

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

/** Domínio do seletor, só entre os sites da conta */
function siteAtual(vh: VH): string {
  const sites = vh.a.domains.filter((x) => !x.soEmail).map((x) => x.name); // o primeiro é o principal da conta
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
  return { title: 'Handlers e MIME', crumbs: crumbs.length > 1 ? crumbs.map((c, i) => (i === crumbs.length - 1 ? { t: c.t } : c)) : undefined, body: <HandlersMime aba={aba} sub={sub} /> };
};

// ---------- Cópias de segurança ----------
type Copia = { f: string; tamanhoMb: number; data: string; web: string; dns: string; mail: string; db: string; cron: string; udir: string; duracao: number };
type InfoBackups = { limite: number; naFila: boolean; exclusoes: Record<string, string>; copias: Copia[]; sites: string[]; emails: string[]; dns: string[]; bds: string[] };
const mbTxt = (n: number) => (n >= 1024 ? (n / 1024).toFixed(2).replace('.', ',') + ' GB' : n + ' MB');

function Exclusoes({ info, ler }: { info: InfoBackups; ler: () => void }) {
  const vh = useVH();
  const { t } = vh;
  const inicial = () => Object.fromEntries(Object.entries(info.exclusoes).map(([k, v]) => [k, new Set(v.split(',').filter(Boolean))]));
  const [x, setX] = useState<Record<string, Set<string>>>(inicial);
  const grupos: [string, string, string[]][] = [
    ['WEB', 'Sites (ficheiros)', info.sites],
    ['MAIL', 'E-mail (mensagens)', info.emails],
    ['DB', 'Bases de dados', info.bds],
    ['DNS', 'Zonas DNS', info.dns],
  ];
  const marcar = (k: string, v: string, on: boolean) => {
    const s = new Set(x[k] || []);
    if (on) s.add(v);
    else s.delete(v);
    setX({ ...x, [k]: s });
  };
  return (
    <Sec titulo="O que fica de fora" desc="Marque o que não quer nas cópias desta conta (vale para as cópias seguintes, também as automáticas).">
      <div className="av-excl">
        {grupos.map(([k, titulo, itens]) =>
          itens.length ? (
            <div key={k}>
              <h4>{t(titulo)}</h4>
              {itens.map((v) => (
                <Check key={v} checked={(x[k] || new Set()).has(v) || (x[k] || new Set()).has('*')} onChange={(on) => marcar(k, v, on)} label={v} />
              ))}
            </div>
          ) : null,
        )}
        <div>
          <h4>{t('Outros')}</h4>
          <Check checked={(x.CRON || new Set()).has('*')} onChange={(on) => setX({ ...x, CRON: new Set(on ? ['*'] : []) })} label="Tarefas cron" />
        </div>
      </div>
      <div className="da-fim">
        <span />
        <button
          className="btn g"
          onClick={async () => {
            const exclusoes = Object.fromEntries(['WEB', 'DNS', 'MAIL', 'DB', 'CRON', 'USER'].map((k) => [k, [...(x[k] || [])].join(',')]));
            if (await noServidor(vh, { acao: 'backup-exclusoes', exclusoes }, 'Exclusões guardadas')) ler();
          }}
        >
          <i className="fa-solid fa-floppy-disk" />
          {t('Guardar exclusões')}
        </button>
      </div>
    </Sec>
  );
}

function RestaurarModal({ c, onFeito }: { c: Copia; onFeito: () => void }) {
  const vh = useVH();
  const { t, closeM } = vh;
  const partes: [string, string, string][] = [
    ['web', 'Sites', c.web],
    ['dns', 'Zonas DNS', c.dns],
    ['mail', 'E-mail', c.mail],
    ['db', 'Bases de dados', c.db],
    ['cron', 'Tarefas cron', c.cron],
    ['udir', 'Outras pastas da conta', c.udir],
  ];
  const [sel, setSel] = useState<Record<string, boolean>>(() => Object.fromEntries(partes.map(([k, , v]) => [k, !!v])));
  return (
    <>
      <h3>{t('Restaurar cópia')}</h3>
      <p style={{ color: 'var(--muted)', marginBottom: 10, lineHeight: 1.5 }}>
        {c.data} · {mbTxt(c.tamanhoMb)}. {t('O que for escolhido volta a ficar como estava nesta cópia (o que existe agora é substituído).')}
      </p>
      {partes.map(([k, l, v]) => (
        <div key={k} className="av-parte">
          <Check checked={!!sel[k]} onChange={(on) => setSel({ ...sel, [k]: on })} label={l} muted={!v} />
          <small>{v ? v.split(',').slice(0, 6).join(', ') + (v.split(',').length > 6 ? '…' : '') : t('nada nesta cópia')}</small>
        </div>
      ))}
      <div className="mfoot">
        <button className="btn g" onClick={closeM}>
          {t('Cancelar')}
        </button>
        <button
          className="btn r"
          disabled={!Object.values(sel).some(Boolean)}
          onClick={async () => {
            closeM();
            const corpo: Record<string, unknown> = { acao: 'backup-restaurar', f: c.f };
            for (const [k] of partes) corpo[k] = sel[k] ? '*' : 'no';
            if (await noServidor(vh, corpo, 'Restauro marcado: começa dentro de momentos')) onFeito();
          }}
        >
          <i className="fa-solid fa-clock-rotate-left" />
          {t('Restaurar')}
        </button>
      </div>
    </>
  );
}

function Backups({ aba }: { aba: 'criar' | 'restaurar' }) {
  const vh = useVH();
  const { t, openM, me } = vh;
  const setAba = (k: 'criar' | 'restaurar') => vh.nav('/utilizador/backups' + (k === 'restaurar' ? '/restaurar' : ''));
  const { dados, erro, ler } = useLer<InfoBackups>('backups');
  if (!dados) return <Carregando erro={erro} ler={ler} />;
  const tabela = (restaurar: boolean) => (
    <DataTable
      id={'backups-' + (restaurar ? 'r' : 'c')}
      rows={dados.copias}
      rowKey={(r) => r.f}
      onRecarregar={ler}
      empty="Ainda não há cópias de segurança"
      cols={[
        { k: 'data', t: 'Data', sort: (r) => r.data, cell: (r) => <b>{r.data}</b> },
        { k: 'tam', t: 'Tamanho', sort: (r) => r.tamanhoMb, cell: (r) => mbTxt(r.tamanhoMb) },
        { k: 'cont', t: 'Conteúdo', cell: (r) => <span style={{ whiteSpace: 'normal' }}>{[r.web && 'sites', r.mail && 'e-mail', r.db && 'bases de dados', r.dns && 'DNS', r.cron && 'cron'].filter(Boolean).join(', ') || '—'}</span> },
        { k: 'dur', t: 'Duração', cell: (r) => (r.duracao ? r.duracao + ' min' : '—'), hidden: true },
      ]}
      actions={(r) => (
        <span className="dns-acoes">
          {restaurar ? (
            <button className="btn sm btn-ed" onClick={() => openM(<RestaurarModal c={r} onFeito={ler} />)}>
              <i className="fa-solid fa-clock-rotate-left" />
              {t('Restaurar')}
            </button>
          ) : (
            <>
              <a className="btn sm btn-ed" href={url(me, 'descarregar', { f: r.f })}>
                <i className="fa-solid fa-download" />
                {t('Descarregar')}
              </a>
              <button className="btn sm btn-rm" onClick={() => openM(<Confirmar titulo="Apagar cópia?" texto={'Vai apagar a cópia de ' + r.data + ' (' + mbTxt(r.tamanhoMb) + ').'} ok="Apagar" onOk={async () => (await noServidor(vh, { acao: 'backup-apagar', f: r.f }, 'Cópia apagada')) && ler()} />)}>
                <i className="fa-solid fa-trash-can" />
                {t('Apagar')}
              </button>
            </>
          )}
        </span>
      )}
    />
  );
  return (
    <>
      <Tabs
        tabs={[
          ['criar', 'Criar cópia', 'fa-box-archive'],
          ['restaurar', 'Restaurar cópia', 'fa-clock-rotate-left'],
        ]}
        on={aba}
        onChange={setAba}
      />
      {aba === 'criar' ? (
        <>
          <Sec titulo="Cópia de segurança completa" desc="Sites, e-mail, bases de dados, zonas DNS, tarefas cron e as outras pastas da conta, num só ficheiro. As cópias mais antigas saem quando se passa o número que o pacote guarda." numeros={[['Cópias guardadas', dados.copias.length + ' / ' + (dados.limite || '—')]]}>
            {dados.naFila && (
              <div className="note">
                <i className="fa-solid fa-hourglass-half" /> {t('Há uma cópia ou um restauro na fila: o servidor trata dele dentro de momentos.')}
              </div>
            )}
            <div className="da-fim" style={{ marginTop: 0, marginBottom: 14 }}>
              <span className="em-nota" style={{ margin: 0 }}>
                {t('A cópia corre em segundo plano; pode fechar o painel.')}
              </span>
              <button className="btn r" disabled={dados.naFila} onClick={async () => (await noServidor(vh, { acao: 'backup-criar' }, 'Cópia marcada: começa dentro de momentos')) && ler()}>
                <i className="fa-solid fa-box-archive" />
                {t('Fazer cópia agora')}
              </button>
            </div>
            {tabela(false)}
          </Sec>
          <Exclusoes info={dados} ler={ler} />
        </>
      ) : (
        <Sec titulo="Restaurar" desc="Escolha a cópia e, a seguir, o que quer repor.">
          {tabela(true)}
        </Sec>
      )}
    </>
  );
}
export const backupsPagina: ScreenFn = (vh) => {
  const r = vh.s.sub[0] === 'restaurar';
  return { title: 'Cópias de segurança', crumbs: r ? [{ t: 'Cópias de segurança', path: '/utilizador/backups' }, { t: 'Restaurar cópia' }] : undefined, body: <Backups aba={r ? 'restaurar' : 'criar'} /> };
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
          { k: 'data', t: 'Criada', cell: (r) => r.data },
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
  return (
    <>
      <div className="note">{t('O navegador pede utilizador e palavra-passe antes de mostrar o que está na pasta (também imagens e outros ficheiros).')}</div>
      {dados.sites.map((d) => {
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
export const protegidasPagina: ScreenFn = () => ({ title: 'Pastas protegidas', body: <Protegidas /> });

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
export const modsecPagina: ScreenFn = () => ({ title: 'Firewall de aplicação', body: <ModSec /> });

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
  const sites = vh.a.domains.filter((x) => !x.soEmail).map((x) => x.name);
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
type WpUser = { ID?: number; user_login: string; display_name?: string; user_email?: string; roles?: string };
const AUTO: Record<string, string> = { true: 'Todas', minor: 'Só de segurança', false: 'Desligada' };

async function entrarWp(vh: VH, d: string) {
  const j = await noServidor(vh, { acao: 'wp-entrar', dominio: d }, 'A abrir o painel do WordPress…');
  if (j?.url) window.open(String(j.url), '_blank', 'noopener');
}

function WordPressLista() {
  const vh = useVH();
  const { t, nav } = vh;
  const { dados, erro, ler } = useLer<{ instalados: Wp[]; livres: { d: string; pasta: string }[] }>('wordpress');
  if (!dados) return <Carregando erro={erro} ler={ler} />;
  return (
    <>
      <Sec titulo="Instalações do WordPress" desc="Os WordPress desta conta: ver utilizadores e plugins, atualizar, mudar a atualização automática, abrir o site ou o painel.">
        <DataTable
          id="wp"
          rows={dados.instalados}
          rowKey={(r) => r.d}
          onRecarregar={ler}
          empty="Não há WordPress instalados"
          cols={[
            { k: 'd', t: 'Domínio', cell: (r) => <a className="lk" onClick={() => nav('/utilizador/wordpress/' + encodeURIComponent(r.d))}>{r.d}</a> },
            { k: 'pasta', t: 'Pasta', cell: (r) => <code>{r.pasta}</code> },
            { k: 'v', t: 'Versão', cell: (r) => r.versao || '—' },
            { k: 'titulo', t: 'Título', cell: (r) => r.titulo || '—' },
            { k: 'auto', t: 'Atualização automática', cell: (r) => t(AUTO[r.auto] || r.auto || '—') },
            { k: 'tema', t: 'Tema', cell: (r) => r.tema || '—' },
          ]}
          actions={(r) => (
            <span className="dns-acoes">
              <a className="btn g sm iconbtn" href={r.url || 'https://' + r.d} target="_blank" rel="noreferrer" title={t('Abrir o site')} aria-label={t('Abrir o site')}>
                <i className="fa-solid fa-arrow-up-right-from-square" />
              </a>
              <button className="btn sm btn-ed" onClick={() => entrarWp(vh, r.d)}>
                <i className="fa-brands fa-wordpress" />
                {t('Painel')}
              </button>
              <button className="btn sm g" onClick={() => nav('/utilizador/wordpress/' + encodeURIComponent(r.d))}>
                {t('Gerir')}
              </button>
            </span>
          )}
        />
      </Sec>
      <Sec titulo="Locais sem WordPress" desc="Sites desta conta onde se pode instalar o WordPress.">
        <DataTable
          id="wp-livres"
          rows={dados.livres}
          rowKey={(r) => r.d}
          empty="Todos os sites já têm WordPress"
          cols={[
            { k: 'd', t: 'Domínio', cell: (r) => <b>{r.d}</b> },
            { k: 'pasta', t: 'Pasta', cell: (r) => <code>{r.pasta}</code> },
          ]}
          actions={(r) => (
            <button className="btn sm btn-ed" onClick={() => nav('/utilizador/wordpress/instalar/' + encodeURIComponent(r.d))}>
              <i className="fa-solid fa-download" />
              {t('Instalar')}
            </button>
          )}
        />
      </Sec>
    </>
  );
}

function WpInstalar({ d }: { d: string }) {
  const vh = useVH();
  const { t, nav } = vh;
  const [f, setF] = useState({ titulo: '', user: 'admin', senha: '', email: vh.a.email || '' });
  const [a, setA] = useState(false);
  return (
    <Sec titulo={'Instalar o WordPress em ' + d} desc="É criada uma base de dados nova e o WordPress fica pronto a usar (com ligações permanentes bonitas). Se a pasta já tiver ficheiros, ficam lá.">
      <Campo label="Título do site" id="wp-titulo">
        <input id="wp-titulo" value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} placeholder={d} />
      </Campo>
      <Campo label="Utilizador administrador" id="wp-user">
        <input id="wp-user" value={f.user} onChange={(e) => setF({ ...f, user: e.target.value.trim() })} />
      </Campo>
      <Campo label="Palavra-passe">
        <Senha value={f.senha} onChange={(v) => setF({ ...f, senha: v })} />
      </Campo>
      <Campo label="E-mail do administrador" id="wp-email">
        <input id="wp-email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value.trim() })} />
      </Campo>
      <div className="da-fim">
        <span />
        <button
          className="btn r"
          disabled={a || !f.user || f.senha.length < 8 || !f.email}
          onClick={async () => {
            setA(true);
            const j = await noServidor(vh, { acao: 'wp-instalar', dominio: d, ...f }, 'WordPress instalado em ' + d, true);
            setA(false);
            if (j) nav('/utilizador/wordpress/' + encodeURIComponent(d));
          }}
        >
          <i className={'fa-solid ' + (a ? 'fa-circle-notch fa-spin' : 'fa-download')} />
          {t(a ? 'A instalar… (pode levar um minuto)' : 'Instalar')}
        </button>
      </div>
    </Sec>
  );
}

function WpGerir({ d }: { d: string }) {
  const vh = useVH();
  const { t } = vh;
  const lista = useLer<{ instalados: Wp[] }>('wordpress');
  const { dados, erro, ler } = useLer<{ plugins: Plugin[]; users: WpUser[] }>('wp', { d });
  const wp = lista.dados?.instalados.find((x) => x.d === d);
  const plug = async (op: string, plugin = '') => (await noServidor(vh, { acao: 'wp-plugin', dominio: d, op, plugin }, 'Feito')) && ler();
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
          <div>
            <span>{t('Atualizar o WordPress para a última versão')}</span>
            <button className="btn sm btn-ed" onClick={async () => (await noServidor(vh, { acao: 'wp-nucleo', dominio: d, op: 'atualizar' }, 'WordPress atualizado')) && lista.ler()}>
              <i className="fa-solid fa-arrows-rotate" />
              {t('Atualizar')}
            </button>
          </div>
        </div>
      </Sec>
      {!dados ? (
        <Carregando erro={erro} ler={ler} />
      ) : (
        <>
          <Sec titulo="Plugins" numeros={[['Plugins', String(dados.plugins.length)], ['Com atualização', String(dados.plugins.filter((p) => p.update === 'available').length)]]}>
            <DataTable
              id="wp-plugins"
              rows={dados.plugins}
              rowKey={(r) => r.name}
              onRecarregar={ler}
              empty="Sem plugins"
              barra2={
                dados.plugins.some((p) => p.update === 'available') ? (
                  <button className="btn sm btn-ed" onClick={() => plug('atualizar-todos')}>
                    <i className="fa-solid fa-arrows-rotate" />
                    {t('Atualizar todos')}
                  </button>
                ) : undefined
              }
              cols={[
                { k: 'n', t: 'Plugin', cell: (r) => <b>{r.title || r.name}</b> },
                { k: 'v', t: 'Versão', cell: (r) => r.version + (r.update === 'available' ? ' → ' + (r.update_version || '') : '') },
                { k: 's', t: 'Estado', cell: (r) => <span className={'tag ' + (r.status === 'active' ? 'ok' : 'off')}>{t(r.status === 'active' ? 'Ativo' : 'Inativo')}</span> },
              ]}
              actions={(r) => (
                <span className="dns-acoes">
                  {r.update === 'available' && (
                    <button className="btn sm btn-ed" onClick={() => plug('atualizar', r.name)}>
                      {t('Atualizar')}
                    </button>
                  )}
                  <button className="btn sm g" onClick={() => plug(r.status === 'active' ? 'desativar' : 'ativar', r.name)}>
                    {t(r.status === 'active' ? 'Desativar' : 'Ativar')}
                  </button>
                </span>
              )}
            />
          </Sec>
          <Sec titulo="Utilizadores do WordPress" numeros={[['Utilizadores', String(dados.users.length)]]}>
            <DataTable
              id="wp-users"
              rows={dados.users}
              rowKey={(r) => r.user_login}
              empty="Sem utilizadores"
              cols={[
                { k: 'l', t: 'Utilizador', cell: (r) => <b>{r.user_login}</b> },
                { k: 'n', t: 'Nome', cell: (r) => r.display_name || '—' },
                { k: 'e', t: 'E-mail', cell: (r) => r.user_email || '—' },
                { k: 'r', t: 'Papel', cell: (r) => r.roles || '—' },
              ]}
            />
          </Sec>
        </>
      )}
    </>
  );
}

export const wordpressPagina: ScreenFn = (vh) => {
  const [a, b] = vh.s.sub;
  const base = { t: 'WordPress', path: '/utilizador/wordpress' };
  if (a === 'instalar' && b) return { title: 'Instalar o WordPress', crumbs: [base, { t: 'Instalar' }], body: <WpInstalar key={b} d={b} /> };
  if (a)
    return {
      title: 'Gerir WordPress',
      desc: a,
      crumbs: [base, { t: a }],
      actions: (
        <>
          <a className="btn g sec-m" href={'https://' + a} target="_blank" rel="noreferrer">
            <i className="fa-solid fa-arrow-up-right-from-square" />
            {vh.t('Abrir o site')}
          </a>
          <button className="btn r" onClick={() => entrarWp(vh, a)}>
            <i className="fa-brands fa-wordpress" />
            {vh.t('Painel do WordPress')}
          </button>
        </>
      ),
      body: <WpGerir key={a} d={a} />,
    };
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
    const i = setInterval(ler, 8000);
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
                { k: 'e', t: 'Estado', cell: () => <span className="tag w"><i className="fa-solid fa-circle-notch fa-spin" /> {t('a analisar')}</span> },
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
