'use client';

// Menu "Sistema e ficheiros" do painel Utilizador (como no DirectAdmin: System Info & Files), ligado ao servidor
// por /api/vhost/sistema: Gestor de ficheiros (+ editor), Terminal, Módulos Perl, Informação do sistema,
// Estatísticas, Resumo do site e registos, Uso de recursos.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { useVH, type VH } from '../context';
import type { ScreenFn } from '../screens';
import { Stat } from '../ui';
import { DataTable, Switch, Tabs } from './componentes';
import { Confirmar } from './pacotes';

const url = (me: string, ver: string, extra: Record<string, string> = {}) => '/api/vhost/sistema?' + new URLSearchParams({ conta: me, ver, ...extra }).toString();

function useLer<T>(ver: string, extra: Record<string, string> = {}, ativo = true) {
  const { me } = useVH();
  const u = url(me, ver, extra);
  const [dados, setDados] = useState<T | null>(null);
  const [erro, setErro] = useState('');
  const ler = useCallback(async () => {
    if (!ativo) return;
    setErro('');
    try {
      const r = await fetch(u, { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.erro || 'Erro a ler o servidor');
      setDados(j as T);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro a ler o servidor');
    }
  }, [u, ativo]);
  useEffect(() => {
    setDados(null);
    ler();
  }, [ler]);
  return { dados, erro, ler };
}

async function noServidor(vh: VH, corpo: Record<string, unknown>, ok: string): Promise<Record<string, unknown> | null> {
  vh.toast('A alterar no servidor…');
  try {
    const r = await fetch('/api/vhost/sistema', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conta: vh.me, ...corpo }) });
    const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    if (!r.ok) {
      vh.toast(String(j.erro || 'A alteração falhou'));
      return null;
    }
    if (ok) vh.toast(ok);
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

const tam = (b: number) => (b >= 1073741824 ? (b / 1073741824).toFixed(2).replace('.', ',') + ' GB' : b >= 1048576 ? (b / 1048576).toFixed(1).replace('.', ',') + ' MB' : b >= 1024 ? Math.round(b / 1024) + ' KB' : b + ' B');
const mb = (n: number) => (n >= 1024 ? (n / 1024).toFixed(2).replace('.', ',') + ' GB' : n + ' MB');
const pct = (v: number, max: number) => (max > 0 ? Math.min(100, Math.round((v / max) * 100)) : 0);

function siteAtual(vh: VH): string {
  const sites = vh.a.domains.filter((x) => !x.soEmail).map((x) => x.name); // o primeiro é o principal da conta
  return vh.s.dominio && sites.includes(vh.s.dominio) ? vh.s.dominio : sites[0] || '';
}

// ---------- Gestor de ficheiros ----------
type Item = { nome: string; pasta: boolean; atalho: boolean; tam: number; data: string; perm: string };
const juntar = (...p: string[]) => p.filter(Boolean).join('/').replace(/\/+/g, '/').replace(/^\/|\/$/g, '');
const ARQUIVO = /\.(zip|tar|tar\.gz|tgz)$/i;
const TEXTO = /\.(php|html?|css|js|mjs|json|txt|md|xml|svg|csv|ini|conf|htaccess|env|yml|yaml|sql|py|pl|sh|log|tsx?|jsx?|twig|tpl|vue)$|^\.(htaccess|user\.ini|env)$/i;
const icone = (x: Item) => (x.pasta ? 'fa-folder' : ARQUIVO.test(x.nome) ? 'fa-file-zipper' : /\.(png|jpe?g|gif|webp|svg|ico)$/i.test(x.nome) ? 'fa-file-image' : /\.(php|js|css|html?|py|sh|json)$/i.test(x.nome) ? 'fa-file-code' : /\.pdf$/i.test(x.nome) ? 'fa-file-pdf' : 'fa-file');

function NomeModal({ titulo, rotulo, inicial, botao, onOk }: { titulo: string; rotulo: string; inicial?: string; botao: string; onOk: (v: string) => void }) {
  const { t, closeM } = useVH();
  const [v, setV] = useState(inicial || '');
  return (
    <>
      <h3>{t(titulo)}</h3>
      <div className="f">
        <label>{t(rotulo)}</label>
        <input value={v} onChange={(e) => setV(e.target.value)} autoFocus onKeyDown={(e) => e.key === 'Enter' && v.trim() && (closeM(), onOk(v.trim()))} />
      </div>
      <div className="mfoot">
        <button className="btn g" onClick={closeM}>
          {t('Cancelar')}
        </button>
        <button className="btn r" disabled={!v.trim()} onClick={() => (closeM(), onOk(v.trim()))}>
          {t(botao)}
        </button>
      </div>
    </>
  );
}

function PermModal({ inicial, onOk }: { inicial: string; onOk: (m: string) => void }) {
  const { t, closeM } = useVH();
  const [m, setM] = useState(inicial.slice(-3));
  const bits = (i: number) => Number(m[i] || 0);
  const mudar = (i: number, b: number) => setM(m.split('').map((x, j) => (j === i ? String(Number(x) ^ b) : x)).join(''));
  return (
    <>
      <h3>{t('Permissões')}</h3>
      <table className="fm-perm">
        <thead>
          <tr>
            <th />
            <th>{t('Ler')}</th>
            <th>{t('Escrever')}</th>
            <th>{t('Executar')}</th>
          </tr>
        </thead>
        <tbody>
          {['Dono', 'Grupo', 'Todos'].map((g, i) => (
            <tr key={g}>
              <td>{t(g)}</td>
              {[4, 2, 1].map((b) => (
                <td key={b}>
                  <input type="checkbox" checked={!!(bits(i) & b)} onChange={() => mudar(i, b)} aria-label={t(g) + ' ' + b} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="f" style={{ marginTop: 12 }}>
        <label>{t('Em número')}</label>
        <input value={m} maxLength={3} onChange={(e) => /^[0-7]{0,3}$/.test(e.target.value) && setM(e.target.value)} />
      </div>
      <div className="mfoot">
        <button className="btn g" onClick={closeM}>
          {t('Cancelar')}
        </button>
        <button className="btn r" disabled={m.length !== 3} onClick={() => (closeM(), onOk(m))}>
          {t('Guardar')}
        </button>
      </div>
    </>
  );
}

function Ficheiros({ caminho }: { caminho: string }) {
  const vh = useVH();
  const { t, nav, openM, me } = vh;
  const { dados, erro, ler } = useLer<{ caminho: string; itens: Item[] }>('ficheiros', { caminho });
  const [area, setArea] = useState<{ op: 'copiar' | 'mover'; caminhos: string[] } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);
  const ir = (c: string) => nav('/utilizador/ficheiros' + (c ? '/' + c.split('/').map(encodeURIComponent).join('/') : ''));
  const fazer = async (corpo: Record<string, unknown>, msg: string) => (await noServidor(vh, corpo, msg)) && ler();
  const partes = caminho ? caminho.split('/') : [];
  const carregar = async (fs: FileList | null) => {
    if (!fs || !fs.length) return;
    setEnviando(true);
    vh.toast('A carregar ' + fs.length + ' ficheiro(s)…');
    const fd = new FormData();
    fd.set('conta', me);
    fd.set('pasta', caminho);
    for (const f of Array.from(fs)) fd.append('ficheiros', f);
    try {
      const r = await fetch('/api/vhost/sistema', { method: 'POST', body: fd });
      const j = await r.json().catch(() => ({}));
      vh.toast(r.ok ? 'Ficheiro(s) carregado(s)' : j.erro || 'O carregamento falhou');
    } catch {
      vh.toast('Sem ligação ao site.');
    }
    setEnviando(false);
    ler();
  };
  const apagar = (ns: string[]) => openM(<Confirmar titulo="Apagar?" texto={'Vai apagar ' + ns.join(', ') + (ns.some((n) => dados?.itens.find((x) => x.nome === n)?.pasta) ? ' (as pastas com tudo o que têm dentro)' : '') + '. Não se pode desfazer.'} ok="Apagar" onOk={() => fazer({ acao: 'fm-apagar', caminhos: ns.map((n) => juntar(caminho, n)) }, 'Apagado')} />);
  return (
    <>
      <div className="fm-bar">
        <nav className="fm-caminho" aria-label={t('Pasta')}>
          <a onClick={() => ir('')}>
            <i className="fa-solid fa-house" /> /home/{me}
          </a>
          {partes.map((p, i) => (
            <span key={i}>
              <i className="fa-solid fa-chevron-right" />
              <a onClick={() => ir(partes.slice(0, i + 1).join('/'))}>{p}</a>
            </span>
          ))}
        </nav>
        <span className="sp" />
        {area && (
          <button className="btn sm btn-ed" onClick={async () => { const op = area.op; setArea(null); await fazer({ acao: op === 'copiar' ? 'fm-copiar' : 'fm-mover', caminhos: area.caminhos, destino: caminho }, op === 'copiar' ? 'Copiado' : 'Movido'); }}>
            <i className="fa-solid fa-paste" />
            {t(area.op === 'copiar' ? 'Colar cópia aqui' : 'Mover para aqui')} ({area.caminhos.length})
          </button>
        )}
        {area && (
          <button className="btn sm g" onClick={() => setArea(null)}>
            {t('Cancelar')}
          </button>
        )}
        <button className="btn sm g" onClick={() => openM(<NomeModal titulo="Nova pasta" rotulo="Nome da pasta" botao="Criar" onOk={(n) => fazer({ acao: 'fm-pasta', pasta: caminho, nome: n }, 'Pasta criada')} />)}>
          <i className="fa-solid fa-folder-plus" />
          {t('Nova pasta')}
        </button>
        <button className="btn sm g" onClick={() => openM(<NomeModal titulo="Novo ficheiro" rotulo="Nome do ficheiro" botao="Criar" onOk={async (n) => (await noServidor(vh, { acao: 'fm-guardar', pasta: caminho, nome: n, texto: '', novo: true }, 'Ficheiro criado')) && (TEXTO.test(n) ? nav('/utilizador/ficheiros/_editar/' + juntar(caminho, n).split('/').map(encodeURIComponent).join('/')) : ler())} />)}>
          <i className="fa-solid fa-file-circle-plus" />
          {t('Novo ficheiro')}
        </button>
        <button className="btn sm r" disabled={enviando} onClick={() => entrada.current?.click()}>
          <i className={'fa-solid ' + (enviando ? 'fa-circle-notch fa-spin' : 'fa-upload')} />
          {t('Carregar ficheiros')}
        </button>
        <input ref={entrada} type="file" multiple hidden onChange={(e) => { carregar(e.target.files); e.target.value = ''; }} />
      </div>
      {!dados ? (
        <Carregando erro={erro} ler={ler} />
      ) : (
        <DataTable
          id="ficheiros"
          rows={[...(caminho ? [{ nome: '..', pasta: true, atalho: false, tam: 0, data: '', perm: '' }] : []), ...dados.itens]}
          rowKey={(r) => r.nome}
          onRecarregar={ler}
          porPagina={100}
          empty="Pasta vazia"
          cols={[
            {
              k: 'nome',
              t: 'Nome',
              sort: (r) => (r.pasta ? '0' : '1') + r.nome.toLowerCase(),
              cell: (r) =>
                r.nome === '..' ? (
                  <a className="lk fm-nome" onClick={() => ir(partes.slice(0, -1).join('/'))}>
                    <i className="fa-solid fa-turn-up" /> ..
                  </a>
                ) : (
                  <a className={'fm-nome' + (r.pasta || TEXTO.test(r.nome) ? ' lk' : '')} onClick={() => (r.pasta ? ir(juntar(caminho, r.nome)) : TEXTO.test(r.nome) ? nav('/utilizador/ficheiros/_editar/' + juntar(caminho, r.nome).split('/').map(encodeURIComponent).join('/')) : undefined)}>
                    <i className={'fa-solid ' + icone(r) + (r.pasta ? ' pasta' : '')} /> {r.nome}
                    {r.atalho && <small> ↪</small>}
                  </a>
                ),
            },
            { k: 'tam', t: 'Tamanho', sort: (r) => r.tam, cell: (r) => (r.nome === '..' || r.pasta ? '—' : tam(r.tam)) },
            { k: 'data', t: 'Alterado', sort: (r) => r.data, cell: (r) => r.data || '' },
            { k: 'perm', t: 'Permissões', cell: (r) => (r.perm ? <code>{r.perm}</code> : '') },
          ]}
          actions={(r) =>
            r.nome === '..' ? null : (
              <span className="dns-acoes">
                {!r.pasta && TEXTO.test(r.nome) && (
                  <button className="btn sm btn-ed" onClick={() => nav('/utilizador/ficheiros/_editar/' + juntar(caminho, r.nome).split('/').map(encodeURIComponent).join('/'))}>
                    {t('Editar')}
                  </button>
                )}
                {!r.pasta && (
                  <a className="btn sm g iconbtn" href={url(me, 'descarregar', { caminho: juntar(caminho, r.nome) })} title={t('Descarregar')} aria-label={t('Descarregar')}>
                    <i className="fa-solid fa-download" />
                  </a>
                )}
                {!r.pasta && ARQUIVO.test(r.nome) && (
                  <button className="btn sm g" onClick={() => fazer({ acao: 'fm-extrair', caminho: juntar(caminho, r.nome), destino: caminho }, 'Extraído')}>
                    {t('Extrair')}
                  </button>
                )}
                <button className="btn sm g iconbtn" title={t('Mudar o nome')} aria-label={t('Mudar o nome')} onClick={() => openM(<NomeModal titulo="Mudar o nome" rotulo="Nome novo" inicial={r.nome} botao="Guardar" onOk={(n) => fazer({ acao: 'fm-renomear', caminho: juntar(caminho, r.nome), nome: n }, 'Nome mudado')} />)}>
                  <i className="fa-solid fa-i-cursor" />
                </button>
                <button className="btn sm g iconbtn" title={t('Permissões')} aria-label={t('Permissões')} onClick={() => openM(<PermModal inicial={r.perm} onOk={(m) => fazer({ acao: 'fm-permissoes', caminhos: [juntar(caminho, r.nome)], modo: m }, 'Permissões mudadas')} />)}>
                  <i className="fa-solid fa-lock" />
                </button>
                <button className="btn sm btn-rm iconbtn" title={t('Apagar')} aria-label={t('Apagar')} onClick={() => apagar([r.nome])}>
                  <i className="fa-solid fa-trash-can" />
                </button>
              </span>
            )
          }
          bulk={[
            { t: 'Copiar', fa: 'fa-copy', run: (k) => (setArea({ op: 'copiar', caminhos: k.filter((n) => n !== '..').map((n) => juntar(caminho, n)) }), vh.toast('Abra a pasta de destino e carregue em "Colar cópia aqui"')) },
            { t: 'Mover', fa: 'fa-up-down-left-right', run: (k) => (setArea({ op: 'mover', caminhos: k.filter((n) => n !== '..').map((n) => juntar(caminho, n)) }), vh.toast('Abra a pasta de destino e carregue em "Mover para aqui"')) },
            { t: 'Comprimir', fa: 'fa-file-zipper', run: (k) => openM(<NomeModal titulo="Comprimir" rotulo="Nome do arquivo (.zip ou .tar.gz)" inicial="arquivo.zip" botao="Comprimir" onOk={(n) => fazer({ acao: 'fm-comprimir', pasta: caminho, nome: n, caminhos: k.filter((x) => x !== '..').map((x) => juntar(caminho, x)) }, 'Arquivo criado')} />) },
            { t: 'Permissões', fa: 'fa-lock', run: (k) => openM(<PermModal inicial="644" onOk={(m) => fazer({ acao: 'fm-permissoes', caminhos: k.filter((x) => x !== '..').map((x) => juntar(caminho, x)), modo: m }, 'Permissões mudadas')} />) },
            { t: 'Apagar', fa: 'fa-trash', run: (k) => apagar(k.filter((x) => x !== '..')) },
          ]}
        />
      )}
    </>
  );
}

function Editor({ caminho }: { caminho: string }) {
  const vh = useVH();
  const { t, nav } = vh;
  const { dados, erro, ler } = useLer<{ caminho: string; texto: string }>('ler', { caminho });
  const [texto, setTexto] = useState<string | null>(null);
  const pasta = caminho.split('/').slice(0, -1).join('/');
  const nome = caminho.split('/').pop() || '';
  const voltar = () => nav('/utilizador/ficheiros' + (pasta ? '/' + pasta.split('/').map(encodeURIComponent).join('/') : ''));
  if (!dados) return <Carregando erro={erro} ler={ler} />;
  const v = texto ?? dados.texto;
  const mudou = texto !== null && texto !== dados.texto;
  const guardar = async () => {
    if (await noServidor(vh, { acao: 'fm-guardar', pasta, nome, texto: v }, 'Guardado')) {
      setTexto(null);
      ler();
    }
  };
  return (
    <>
      <div className="fm-bar">
        <code className="fm-ficheiro">/home/{vh.me}/{caminho}</code>
        <span className="sp" />
        {mudou && <span className="tag w">{t('Por guardar')}</span>}
        <button className="btn sm g" onClick={voltar}>
          <i className="fa-solid fa-arrow-left" />
          {t('Voltar')}
        </button>
        <button className="btn sm r" disabled={!mudou} onClick={guardar}>
          <i className="fa-solid fa-floppy-disk" />
          {t('Guardar')}
        </button>
      </div>
      <textarea
        className="fm-editor"
        spellCheck={false}
        value={v}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            if (mudou) guardar();
          }
          if (e.key === 'Tab') {
            e.preventDefault();
            const el = e.currentTarget;
            const i = el.selectionStart;
            setTexto(v.slice(0, i) + '  ' + v.slice(el.selectionEnd));
            requestAnimationFrame(() => el.setSelectionRange(i + 2, i + 2));
          }
        }}
      />
      <p className="em-nota">{t('Ctrl+S (ou ⌘S) guarda. O ficheiro fica com o utilizador da conta como dono.')}</p>
    </>
  );
}

// O gestor de ficheiros do site da VisualDesign (pedido do Silva: mais simples, com seletor de domínio).
// O site só o abre a administradores e revendedores; para as outras contas fica o gestor acima (mesmas funções).
const FileManagerSection = dynamic(() => import('@/app/dashboard/HostingSections').then((m) => m.FileManagerSection), {
  ssr: false,
  loading: () => (
    <div className="espera-nota">
      <i className="fa-solid fa-circle-notch fa-spin" /> A abrir o gestor de ficheiros…
    </div>
  ),
});
function GestorDoSite() {
  const vh = useVH();
  const sites = vh.a.domains.filter((x) => !x.soEmail).map((x) => ({ domain: x.name, owner: vh.me }));
  return (
    <div className="vh-fm-site">
      <FileManagerSection domain={siteAtual(vh)} sites={sites as never} isActive loggedInOwner={vh.me} />
    </div>
  );
}
/** Quem entrou no painel é administrador ou revendedor (é o que o gestor do site aceita) */
const entrouComoGestor = (vh: VH) => ['admin', 'revenda'].includes(vh.s.acc[vh.s.login]?.role || '');

export const ficheirosPagina: ScreenFn = (vh) => {
  const sub = vh.s.sub;
  if (entrouComoGestor(vh)) return { title: 'Gestor de ficheiros', body: <GestorDoSite /> };
  const base = { t: 'Gestor de ficheiros', path: '/utilizador/ficheiros' };
  if (sub[0] === '_editar') {
    const c = sub.slice(1).join('/');
    return { title: 'Editar ficheiro', desc: c.split('/').pop(), crumbs: [base, { t: 'Editar' }], body: <Editor key={c} caminho={c} /> };
  }
  const c = sub.join('/');
  return { title: 'Gestor de ficheiros', crumbs: c ? [base, { t: c.split('/').pop() || c }] : undefined, body: <Ficheiros key={c} caminho={c} /> };
};

// ---------- Terminal (comandos não interativos, com o utilizador da conta) ----------
type Linha = { cmd: string; pasta: string; saida: string; codigo: number };
function Terminal() {
  const vh = useVH();
  const { t, me } = vh;
  const [hist, setHist] = useState<Linha[]>([]);
  const [cmd, setCmd] = useState('');
  const [pasta, setPasta] = useState('');
  const [a, setA] = useState(false);
  const [i, setI] = useState(-1);
  const fim = useRef<HTMLDivElement>(null);
  useEffect(() => {
    fim.current?.scrollIntoView({ block: 'end' });
  }, [hist]);
  const correr = async () => {
    const c = cmd.trim();
    if (!c) return;
    if (c === 'clear') return setHist([]), setCmd('');
    setA(true);
    setCmd('');
    setI(-1);
    try {
      const r = await fetch('/api/vhost/sistema', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conta: me, acao: 'terminal', comando: c, pasta }) });
      const j = await r.json();
      if (!r.ok) setHist((h) => [...h, { cmd: c, pasta, saida: j.erro || 'Falhou', codigo: 1 }]);
      else {
        setHist((h) => [...h, { cmd: c, pasta, saida: j.saida, codigo: j.codigo }]);
        setPasta(j.pasta ?? pasta);
      }
    } catch {
      setHist((h) => [...h, { cmd: c, pasta, saida: 'Sem ligação ao site.', codigo: 1 }]);
    }
    setA(false);
  };
  const cmds = hist.map((h) => h.cmd);
  return (
    <>
      <div className="note">{t('Cada comando corre no servidor com o utilizador da conta, como numa ligação SSH, até 60 segundos. Programas que pedem respostas (editores, top…) não funcionam aqui; use SSH para isso.')}</div>
      <div className="term" onClick={() => document.getElementById('term-in')?.focus()}>
        {hist.map((h, k) => (
          <div key={k}>
            <div className="term-cmd">
              <span className="term-ps">
                {me}:~/{h.pasta}$
              </span>{' '}
              {h.cmd}
            </div>
            {h.saida && <pre className={h.codigo ? 'term-err' : ''}>{h.saida}</pre>}
          </div>
        ))}
        <div className="term-cmd" ref={fim}>
          <span className="term-ps">
            {me}:~/{pasta}$
          </span>
          <input
            id="term-in"
            value={cmd}
            disabled={a}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setCmd(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') correr();
              if (e.key === 'ArrowUp' && cmds.length) {
                const n = i < 0 ? cmds.length - 1 : Math.max(0, i - 1);
                setI(n);
                setCmd(cmds[n]);
              }
              if (e.key === 'ArrowDown' && i >= 0) {
                const n = i + 1;
                setI(n >= cmds.length ? -1 : n);
                setCmd(n >= cmds.length ? '' : cmds[n]);
              }
            }}
            aria-label={t('Comando')}
            autoFocus
          />
          {a && <i className="fa-solid fa-circle-notch fa-spin" />}
        </div>
      </div>
    </>
  );
}
export const terminalPagina: ScreenFn = () => ({ title: 'Terminal', body: <Terminal /> });

// ---------- Módulos Perl ----------
function Perl() {
  const { dados, erro, ler } = useLer<{ modulos: { nome: string; versao: string }[]; base: number }>('perl');
  if (!dados) return <Carregando erro={erro} ler={ler} />;
  return (
    <Sec titulo="Módulos Perl instalados" desc="Os módulos Perl que os seus programas podem usar neste servidor (além dos que já vêm com o Perl)." numeros={[['Instalados', String(dados.modulos.length)], ['Do próprio Perl', String(dados.base)]]}>
      <DataTable
        id="perl"
        rows={dados.modulos}
        rowKey={(r) => r.nome}
        search={(r) => r.nome}
        onRecarregar={ler}
        porPagina={50}
        empty="Sem módulos extra"
        cols={[
          { k: 'n', t: 'Módulo', sort: (r) => r.nome, cell: (r) => <code>{r.nome}</code> },
          { k: 'v', t: 'Versão', cell: (r) => r.versao || '—' },
        ]}
      />
    </Sec>
  );
}
export const perlPagina: ScreenFn = () => ({ title: 'Módulos Perl', body: <Perl /> });

// ---------- Informação do sistema ----------
type Info = { sistema: Record<string, string | number>; software: { nome: string; versao: string }[]; php: string[] };
function InfoSistema() {
  const { t } = useVH();
  const { dados, erro, ler } = useLer<Info>('info');
  if (!dados) return <Carregando erro={erro} ler={ler} />;
  const s = dados.sistema;
  return (
    <>
      <Sec titulo="Servidor">
        <div className="da-grelha">
          <div className="da-lin n2">
            <div className="da-cel">
              <i className="fa-solid fa-server" />
              <div>
                <small>{t('Nome do servidor')}</small>
                <span>{s.nome || '—'}</span>
              </div>
            </div>
            <div className="da-cel">
              <i className="fa-brands fa-linux" />
              <div>
                <small>{t('Sistema operativo')}</small>
                <span>
                  {s.so} {s.arquitetura ? '(' + s.arquitetura + ')' : ''}
                </span>
              </div>
            </div>
          </div>
          <div className="da-lin n3">
            <div className="da-cel">
              <i className="fa-solid fa-microchip" />
              <div>
                <small>{t('Processador')}</small>
                <span>
                  {s.cpu} · {s.nucleos} {t('núcleos')}
                </span>
              </div>
            </div>
            <div className="da-cel">
              <i className="fa-solid fa-memory" />
              <div>
                <small>{t('Memória')}</small>
                <span>{mb(Number(s.memoriaMb))}</span>
              </div>
            </div>
            <div className="da-cel">
              <i className="fa-regular fa-clock" />
              <div>
                <small>{t('Ligado há')}</small>
                <span>{s.ligado ? Math.round(Number(s.ligado) / 1440) + ' ' + t('dias') : '—'}</span>
              </div>
            </div>
          </div>
          <div className="da-lin n2">
            <div className="da-cel">
              <i className="fa-solid fa-gauge" />
              <div>
                <small>{t('Carga')}</small>
                <span>{s.carga || '—'}</span>
              </div>
            </div>
            <div className="da-cel">
              <i className="fa-solid fa-cubes" />
              <div>
                <small>{t('Painel do servidor')}</small>
                <span>Hestia {s.hestia}</span>
              </div>
            </div>
          </div>
        </div>
      </Sec>
      <Sec titulo="Programas instalados" desc="Versões dos programas que servem os seus sites, e-mail e bases de dados.">
        <div className="da-lista">
          {dados.software.map((x) => (
            <div key={x.nome}>
              <span>{x.nome}</span>
              <span>
                <code>{x.versao}</code>
              </span>
            </div>
          ))}
          {dados.php.length > 0 && (
            <div>
              <span>{t('Versões de PHP disponíveis')}</span>
              <span>
                {dados.php.map((v) => (
                  <code key={v}>{v}</code>
                ))}
              </span>
            </div>
          )}
        </div>
      </Sec>
    </>
  );
}
export const infoSistemaPagina: ScreenFn = () => ({ title: 'Informação do sistema', body: <InfoSistema /> });

// ---------- Estatísticas ----------
type Mes = { mes: string; discoMb: number; discoWeb: number; discoMail: number; discoBd: number; trafegoMb: number; sites: number; emails: number; bds: number };
const mesPt = (m: string) => {
  const [a, mm] = m.split('-');
  return ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][Number(mm) - 1] + ' ' + a;
};
function Estatisticas() {
  const vh = useVH();
  const { t } = vh;
  const { dados, erro, ler } = useLer<{ meses: Mes[]; sites: { d: string; stats: string }[] }>('estatisticas');
  if (!dados) return <Carregando erro={erro} ler={ler} />;
  const max = Math.max(1, ...dados.meses.map((m) => m.trafegoMb));
  return (
    <>
      <Sec titulo="Uso por mês" desc="Espaço e tráfego da conta em cada mês.">
        <div className="st-graf">
          {[...dados.meses].reverse().map((m) => (
            <div key={m.mes} title={mb(m.trafegoMb)}>
              <span style={{ height: Math.max(3, pct(m.trafegoMb, max)) + '%' }} />
              <small>{mesPt(m.mes)}</small>
            </div>
          ))}
        </div>
        <DataTable
          id="estatisticas"
          rows={dados.meses}
          rowKey={(r) => r.mes}
          onRecarregar={ler}
          empty="Ainda sem estatísticas"
          cols={[
            { k: 'mes', t: 'Mês', cell: (r) => <b>{mesPt(r.mes)}</b> },
            { k: 'tr', t: 'Tráfego', cell: (r) => mb(r.trafegoMb) },
            { k: 'd', t: 'Espaço', cell: (r) => mb(r.discoMb) },
            { k: 'w', t: 'Sites', cell: (r) => mb(r.discoWeb) },
            { k: 'm', t: 'E-mail', cell: (r) => mb(r.discoMail) },
            { k: 'b', t: 'Bases de dados', cell: (r) => mb(r.discoBd) },
            { k: 'n', t: 'Domínios · contas · bases', cell: (r) => r.sites + ' · ' + r.emails + ' · ' + r.bds, hidden: true },
          ]}
        />
      </Sec>
      <Sec titulo="Estatísticas de visitas (AWStats)" desc="Relatórios de visitas de cada site, atualizados todos os dias. Abrem em https://<domínio>/vstats/.">
        <DataTable
          id="awstats"
          rows={dados.sites}
          rowKey={(r) => r.d}
          empty="Esta conta ainda não tem sites"
          cols={[
            { k: 'd', t: 'Site', cell: (r) => <b>{r.d}</b> },
            { k: 's', t: 'AWStats', cell: (r) => <Switch checked={!!r.stats} onChange={async (v) => (await noServidor(vh, { acao: 'awstats', dominio: r.d, ligar: v }, v ? 'Estatísticas ligadas (a primeira leitura sai amanhã)' : 'Estatísticas desligadas')) && ler()} label="AWStats" /> },
          ]}
          actions={(r) =>
            r.stats ? (
              <a className="btn sm btn-ed" href={'https://' + r.d + '/vstats/'} target="_blank" rel="noreferrer">
                <i className="fa-solid fa-chart-line" />
                {t('Ver')}
              </a>
            ) : null
          }
        />
      </Sec>
    </>
  );
}
export const estatisticasPagina: ScreenFn = () => ({ title: 'Estatísticas', body: <Estatisticas /> });

// ---------- Resumo do site e registos ----------
function Logs({ tipo }: { tipo: 'acesso' | 'erros' }) {
  const vh = useVH();
  const { t } = vh;
  const d = siteAtual(vh);
  const setTipo = (k: 'acesso' | 'erros') => vh.nav('/utilizador/logs-site' + (k === 'erros' ? '/erros' : ''));
  const [linhas, setLinhas] = useState('100');
  const [filtro, setFiltro] = useState('');
  const { dados, erro, ler } = useLer<{ linhas: string[] }>('logs', { d, tipo, linhas }, !!d);
  if (!d) return <div className="card empty">{t('Esta conta ainda não tem nenhum site.')}</div>;
  const mostrar = (dados?.linhas || []).filter((l) => !filtro || l.toLowerCase().includes(filtro.toLowerCase()));
  return (
    <>
      <Tabs
        tabs={[
          ['acesso', 'Registo de acessos', 'fa-file-lines'],
          ['erros', 'Registo de erros', 'fa-triangle-exclamation'],
        ]}
        on={tipo}
        onChange={setTipo}
      />
      <div className="fm-bar">
        <span className="em-nota" style={{ margin: 0 }}>
          {d} · {t(tipo === 'acesso' ? 'cada pedido feito ao site (IP, data, página, código de resposta)' : 'erros do servidor web e do PHP')}
        </span>
        <span className="sp" />
        <input className="em-sel" value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder={t('Filtrar')} aria-label={t('Filtrar')} />
        <select className="em-sel" value={linhas} onChange={(e) => setLinhas(e.target.value)} aria-label={t('Linhas')}>
          {['50', '100', '250', '500', '1000'].map((n) => (
            <option key={n} value={n}>
              {n} {t('linhas')}
            </option>
          ))}
        </select>
        <button className="btn sm g iconbtn" onClick={ler} title={t('Atualizar')} aria-label={t('Atualizar')}>
          <i className="fa-solid fa-rotate" />
        </button>
      </div>
      {!dados ? <Carregando erro={erro} ler={ler} /> : <pre className="log-txt">{mostrar.length ? mostrar.join('\n') : t('Sem linhas para mostrar')}</pre>}
    </>
  );
}
export const logsPagina: ScreenFn = (vh) => {
  const e = vh.s.sub[0] === 'erros';
  return { title: 'Resumo do site e registos', crumbs: e ? [{ t: 'Resumo do site e registos', path: '/utilizador/logs-site' }, { t: 'Registo de erros' }] : undefined, body: <Logs tipo={e ? 'erros' : 'acesso'} /> };
};

// ---------- Uso de recursos ----------
type Recursos = { disco: Record<string, number>; trafego: Record<string, number>; agora: Record<string, number>; limites: Record<string, string> };
function UsoRecursos() {
  const { t } = useVH();
  const { dados, erro, ler } = useLer<Recursos>('recursos');
  useEffect(() => {
    const i = setInterval(ler, 15000);
    return () => clearInterval(i);
  }, [ler]);
  if (!dados) return <Carregando erro={erro} ler={ler} />;
  const { disco: d, trafego: tr, agora: a } = dados;
  return (
    <>
      <div className="stats">
        <Stat title="Espaço" v={mb(d.usadoMb)} m={d.limiteMb ? '/ ' + mb(d.limiteMb) : '/ ∞'} p={pct(d.usadoMb, d.limiteMb)} />
        <Stat title="Tráfego este mês" v={mb(tr.usadoMb)} m={tr.limiteMb ? '/ ' + mb(tr.limiteMb) : '/ ∞'} p={pct(tr.usadoMb, tr.limiteMb)} />
        <Stat title="Processador agora" v={a.cpu.toFixed(1).replace('.', ',') + '%'} m={'de ' + a.nucleos * 100 + '%'} p={pct(a.cpu, a.nucleos * 100)} />
        <Stat title="Memória agora" v={mb(a.memoriaMb)} m={a.processos + ' processos'} p={pct(a.memoriaMb, a.memoriaTotalMb)} />
      </div>
      <Sec titulo="Onde está o espaço">
        <div className="da-lista">
          {[
            ['Sites', d.web],
            ['E-mail', d.mail],
            ['Bases de dados', d.bd],
            ['Outras pastas', d.outros],
          ].map(([k, v]) => (
            <div key={k as string}>
              <span>{t(k as string)}</span>
              <span>
                <span className="bar" style={{ width: 160, display: 'inline-block', marginRight: 10 }}>
                  <span style={{ width: pct(v as number, d.usadoMb) + '%' }} />
                </span>
                {mb(v as number)}
              </span>
            </div>
          ))}
        </div>
      </Sec>
      <p className="em-nota">{t('O processador e a memória são lidos agora (todos os processos da conta) e atualizam-se de 15 em 15 segundos.')}</p>
    </>
  );
}
export const recursosPagina: ScreenFn = () => ({ title: 'Uso de recursos', body: <UsoRecursos /> });
