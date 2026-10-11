'use client';

// Menu "Sistema e ficheiros" do painel Utilizador (como no DirectAdmin: System Info & Files), ligado ao servidor
// por /api/vhost/sistema: Gestor de ficheiros (+ editor), Terminal, Módulos Perl, Informação do sistema,
// Estatísticas, Resumo do site e registos, Uso de recursos.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useVH, type VH } from '../context';
import type { ScreenFn } from '../screens';
import { Stat } from '../ui';
import { DataTable, Switch, Tabs } from './componentes';
import { Confirmar } from './pacotes';
import { lerUrl, naMemoria, useGet } from '../carga';
import { LOGO } from '../state';
import { lerPref } from './suporte';

const url = (me: string, ver: string, extra: Record<string, string> = {}) => '/api/vhost/sistema?' + new URLSearchParams({ conta: me, ver, ...extra }).toString();

/** Lê um endereço da API (memória comum do painel: aparece logo ao voltar e atualiza-se por trás) */
function useLer<T>(ver: string, extra: Record<string, string> = {}, ativo = true, fundo = false) {
  const { me } = useVH();
  return useGet<T>(ativo ? url(me, ver, extra) : null, { fundo });
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
  ) : null; // a carregar: só a linha do topo
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
type Item = { nome: string; pasta: boolean; atalho: boolean; tam: number; data: string; perm: string; dono?: string; grupo?: string; rel?: string };
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
        <input value={v} onChange={(e) => setV(e.target.value)} autoFocus onFocus={(e) => e.target.select()} onKeyDown={(e) => e.key === 'Enter' && v.trim() && (closeM(), onOk(v.trim()))} />
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

// ---------- Gestor de ficheiros — igual ao do DirectAdmin (VisualHost/06-da-gestor-de-ficheiros.md) ----------
// Página inteira (sem o menu do painel): barra de cima com Nova pasta · Novo ficheiro · Carregar · Pesquisar ·
// Tamanhos das pastas · Voltar ao painel; árvore de pastas à esquerda (Os meus ficheiros … Reciclagem); caminho;
// barra "Selecionados: n / total" com as ações; tabela Nome · Tamanho · Permissões · Última alteração · UID/GID;
// botão direito com as mesmas ações. Clique seleciona, duplo clique abre.
const encC = (c: string) => c.split('/').filter(Boolean).map(encodeURIComponent).join('/');
const rotaFm = (c: string) => '/utilizador/ficheiros' + (c ? '/' + encC(c) : '');
const rotaEditar = (c: string) => '/utilizador/ficheiros/_editar/' + encC(c);
/** drwxr-xr-x a partir do número (644) e do tipo */
const permTexto = (x: Item) => {
  const m = x.perm.slice(-3);
  const r = m
    .split('')
    .map((d) => {
      const n = Number(d);
      return (n & 4 ? 'r' : '-') + (n & 2 ? 'w' : '-') + (n & 1 ? 'x' : '-');
    })
    .join('');
  return (x.atalho ? 'l' : x.pasta ? 'd' : '-') + r;
};
/** "2026-10-07 11:31" → "07/10/2026, 11:31" (como no DA) */
const dataDa = (d: string) => (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(d) ? (lerPref('vh-data', 'dmy') === 'ymd' ? d.slice(0, 16) : `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}, ${d.slice(11, 16)}`) : d);
const tipoFicheiro = (n: string) => {
  const e = (n.match(/\.([a-z0-9]+)$/i) || [])[1]?.toLowerCase() || '';
  if (/^(zip|tar|gz|tgz|rar|7z)$/.test(e)) return ['fa-file-zipper', 'c-arq', e.toUpperCase()];
  if (/^(png|jpe?g|gif|webp|svg|ico|bmp)$/.test(e)) return ['fa-file-image', 'c-img', e.toUpperCase()];
  if (/^(html?|php|js|mjs|css|json|xml|py|sh|ts|tsx|jsx|vue|twig|tpl)$/.test(e)) return ['fa-file-code', 'c-cod', e.toUpperCase()];
  if (e === 'pdf') return ['fa-file-pdf', 'c-pdf', 'PDF'];
  if (/^(txt|md|log|csv|ini|conf|sql|yml|yaml|env|htaccess)$/.test(e)) return ['fa-file-lines', 'c-txt', e.toUpperCase()];
  return ['fa-file', 'c-txt', ''];
};

function IconeFicheiro({ x }: { x: Item }) {
  if (x.pasta) return <i className="fa-solid fa-folder fmda-ic-pasta" />;
  const [fa, cor, rotulo] = tipoFicheiro(x.nome);
  return (
    <span className={'fmda-ic ' + cor}>
      <i className={'fa-solid ' + fa} />
      {rotulo && <b>{rotulo.slice(0, 4)}</b>}
    </span>
  );
}

/** Ramo da árvore de pastas: as subpastas de `c` (quem decide se está aberto é RamoFilhos; as pastas do caminho
 *  atual abrem sozinhas, as outras pela seta) */
function Ramo({ c, nivel, atual, ir }: { c: string; nivel: number; atual: string; ir: (c: string) => void }) {
  const { me } = useVH();
  const [pastas, setPastas] = useState<Item[] | null>(() => naMemoria<{ itens: Item[] }>(url(me, 'ficheiros', { caminho: c }))?.itens.filter((x) => x.pasta) || null);
  useEffect(() => {
    lerUrl<{ itens: Item[] }>(url(me, 'ficheiros', { caminho: c }), { fundo: true })
      .then((j) => setPastas(j.itens.filter((x) => x.pasta)))
      .catch(() => setPastas([]));
  }, [c, me]);
  if (!pastas) return null;
  return (
    <ul className="fmda-ramo">
      {pastas.map((x) => {
        const cc = juntar(c, x.nome);
        return (
          <li key={cc}>
            <div className={'fmda-no' + (atual === cc ? ' on' : '')} style={{ paddingLeft: 14 + nivel * 14 }} onClick={() => ir(cc)}>
              <RamoSeta c={cc} atual={atual} />
              <i className="fa-solid fa-folder" />
              <span>{x.nome}</span>
              {x.atalho && <i className="fa-solid fa-link fmda-lig" />}
            </div>
            <RamoFilhos c={cc} nivel={nivel + 1} atual={atual} ir={ir} />
          </li>
        );
      })}
    </ul>
  );
}
// seta e filhos partilham o estado "aberto" através de um pequeno registo por caminho
const abertosFm = new Set<string>();
const ouvintesFm = new Set<() => void>();
function RamoSeta({ c, atual }: { c: string; atual: string }) {
  const [, f] = useState(0);
  useEffect(() => {
    const g = () => f((x) => x + 1);
    ouvintesFm.add(g);
    return () => void ouvintesFm.delete(g);
  }, []);
  const aberto = abertosFm.has(c) || atual === c || atual.startsWith(c + '/');
  return (
    <button
      className="fmda-seta"
      onClick={(e) => {
        e.stopPropagation();
        if (aberto) abertosFm.delete(c);
        else abertosFm.add(c);
        if (aberto && (atual === c || atual.startsWith(c + '/'))) abertosFm.add('!' + c);
        else abertosFm.delete('!' + c);
        ouvintesFm.forEach((g) => g());
      }}
      aria-label="abrir"
    >
      <i className={'fa-solid ' + (aberto && !abertosFm.has('!' + c) ? 'fa-chevron-down' : 'fa-chevron-right')} />
    </button>
  );
}
function RamoFilhos({ c, nivel, atual, ir }: { c: string; nivel: number; atual: string; ir: (c: string) => void }) {
  const [, f] = useState(0);
  useEffect(() => {
    const g = () => f((x) => x + 1);
    ouvintesFm.add(g);
    return () => void ouvintesFm.delete(g);
  }, []);
  const aberto = (abertosFm.has(c) || atual === c || atual.startsWith(c + '/')) && !abertosFm.has('!' + c);
  return aberto ? <Ramo c={c} nivel={nivel} atual={atual} ir={ir} /> : null;
}

/** Copiar/Mover para… (pasta de destino, a partir da pasta da conta) */
function DestinoModal({ titulo, inicial, botao, onOk }: { titulo: string; inicial: string; botao: string; onOk: (d: string) => void }) {
  const { t, closeM, me } = useVH();
  const [v, setV] = useState(inicial);
  return (
    <>
      <h3>{t(titulo)}</h3>
      <div className="f">
        <label>{t('Pasta de destino')}</label>
        <div className="fmda-dest">
          <span>/home/{me}/</span>
          <input value={v} onChange={(e) => setV(e.target.value.replace(/^\/+/, ''))} autoFocus onFocus={(e) => e.target.select()} onKeyDown={(e) => e.key === 'Enter' && (closeM(), onOk(v))} />
        </div>
      </div>
      <div className="mfoot">
        <button className="btn g" onClick={closeM}>
          {t('Cancelar')}
        </button>
        <button className="btn r" onClick={() => (closeM(), onOk(v))}>
          {t(botao)}
        </button>
      </div>
    </>
  );
}

/** Arquivar (zip ou tar.gz), como "Archive" no DA */
function ArquivarModal({ inicial, onOk }: { inicial: string; onOk: (nome: string) => void }) {
  const { t, closeM } = useVH();
  const [n, setN] = useState(inicial);
  const [f, setF] = useState<'zip' | 'tar.gz'>('zip');
  const final = n.replace(/\.(zip|tar\.gz|tgz)$/i, '') + '.' + f;
  return (
    <>
      <h3>{t('Arquivar')}</h3>
      <div className="f">
        <label>{t('Nome do arquivo')}</label>
        <input value={n} onChange={(e) => setN(e.target.value)} autoFocus onFocus={(e) => e.target.select()} />
      </div>
      <div className="f">
        <label>{t('Formato')}</label>
        <select className="inp" value={f} onChange={(e) => setF(e.target.value as 'zip' | 'tar.gz')}>
          <option value="zip">.zip</option>
          <option value="tar.gz">.tar.gz</option>
        </select>
      </div>
      <div className="mfoot">
        <button className="btn g" onClick={closeM}>
          {t('Cancelar')}
        </button>
        <button className="btn r" disabled={!n.trim()} onClick={() => (closeM(), onOk(final))}>
          {t('Arquivar')}
        </button>
      </div>
    </>
  );
}

type AcaoFm = { k: string; fa: string; t: string; ativo: boolean; run: () => void; perigo?: boolean };

/** Moldura de página inteira do gestor (barra de cima do DA na cor do tema) */
function MolduraFm({ botoes, children }: { botoes: ReactNode; children: ReactNode }) {
  const vh = useVH();
  const { t, nav, s } = vh;
  return (
    <div className="fmda">
      <header className="fmda-top">
        <div className="fmda-logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={s.brand.logo || LOGO} alt="" />
          <span>
            <b>{s.brand.name.trim() || 'VisualHost'}</b>
            <small>{t('painel de alojamento')}</small>
          </span>
        </div>
        {botoes}
        <span className="sp" />
        <button className="fmda-tb fmda-voltar" onClick={() => nav('/utilizador')}>
          <i className="fa-solid fa-arrow-right-from-bracket fa-flip-horizontal" />
          <span>{t('Voltar ao painel')}</span>
        </button>
      </header>
      {children}
    </div>
  );
}

function Ficheiros({ caminho, lixo = false }: { caminho: string; lixo?: boolean }) {
  const vh = useVH();
  const { t, nav, openM, me } = vh;
  const { dados, erro, ler } = useLer<{ caminho: string; itens: Item[] }>('ficheiros', { caminho }, !lixo);
  const lixoD = useLer<{ itens: { id: string; nome: string; orig: string; data: string; pasta: boolean; tam: number }[] }>('lixo', {}, lixo);
  const [sel, setSel] = useState<string[]>([]);
  const [ultimo, setUltimo] = useState('');
  const [tamanhos, setTamanhos] = useState<Record<string, number> | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [pesquisa, setPesquisa] = useState<{ q: string; itens: Item[] | null } | null>(null);
  const entrada = useRef<HTMLInputElement>(null);
  // Preferências → Gestor de ficheiros: mostrar (ou não) os ficheiros que começam por ponto
  const itens = (dados?.itens || []).filter((x) => lerPref('vh-fm-ocultos', '1') === '1' || !x.nome.startsWith('.'));
  const ir = (c: string) => nav(rotaFm(c));
  const partes = caminho ? caminho.split('/') : [];
  const fazer = async (corpo: Record<string, unknown>, msg: string) => {
    if (await noServidor(vh, corpo, msg)) {
      setSel([]);
      setTamanhos(null);
      ler();
      if (lixo) lixoD.ler();
    }
  };
  useEffect(() => {
    if (!menu) return;
    const fechar = () => setMenu(null);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(null);
    document.addEventListener('click', fechar);
    document.addEventListener('keydown', esc);
    window.addEventListener('scroll', fechar, true);
    return () => {
      document.removeEventListener('click', fechar);
      document.removeEventListener('keydown', esc);
      window.removeEventListener('scroll', fechar, true);
    };
  }, [menu]);
  const escolhidos = itens.filter((x) => sel.includes(x.nome));
  const um = escolhidos.length === 1 ? escolhidos[0] : null;
  const caminhos = () => escolhidos.map((x) => juntar(caminho, x.nome));
  const abrir = (x: Item) => (x.pasta ? ir(juntar(caminho, x.nome)) : TEXTO.test(x.nome) ? nav(rotaEditar(juntar(caminho, x.nome))) : window.location.assign(url(me, 'descarregar', { caminho: juntar(caminho, x.nome) })));
  const carregar = async (fs: FileList | null) => {
    if (!fs || !fs.length) return;
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
    ler();
  };
  const novaPasta = () => openM(<NomeModal titulo="Criar pasta" rotulo="Nome da pasta" inicial={t('Nova pasta')} botao="Criar" onOk={(n) => fazer({ acao: 'fm-pasta', pasta: caminho, nome: n }, 'Pasta criada')} />);
  const novoFicheiro = () =>
    openM(<NomeModal titulo="Criar ficheiro" rotulo="Nome do ficheiro" botao="Criar" onOk={async (n) => (await noServidor(vh, { acao: 'fm-guardar', pasta: caminho, nome: n, texto: '', novo: true }, 'Ficheiro criado')) && (TEXTO.test(n) ? nav(rotaEditar(juntar(caminho, n))) : ler())} />);
  const apagar = () => {
    const ns = escolhidos.map((x) => x.nome);
    openM(<Confirmar titulo="Mover para a reciclagem?" texto={ns.join(', ') + ' — ' + t('vai para a Reciclagem; pode restaurá-lo de lá.')} ok="Remover" onOk={() => fazer({ acao: 'fm-apagar', caminhos: caminhos() }, 'Movido para a reciclagem')} />);
  };
  const acoes: AcaoFm[] = [
    um?.pasta
      ? { k: 'abrir', fa: 'fa-folder-open', t: 'Abrir', ativo: true, run: () => abrir(um) }
      : { k: 'editar', fa: 'fa-pen-to-square', t: 'Editar', ativo: !!um && TEXTO.test(um.nome), run: () => um && nav(rotaEditar(juntar(caminho, um.nome))) },
    { k: 'copiar', fa: 'fa-copy', t: 'Copiar', ativo: escolhidos.length > 0, run: () => openM(<DestinoModal titulo="Copiar para" inicial={caminho} botao="Copiar" onOk={(d) => fazer({ acao: 'fm-copiar', caminhos: caminhos(), destino: d }, 'Copiado')} />) },
    { k: 'duplicar', fa: 'fa-clone', t: 'Duplicar', ativo: escolhidos.length > 0, run: () => fazer({ acao: 'fm-duplicar', caminhos: caminhos() }, 'Duplicado') },
    { k: 'mover', fa: 'fa-arrow-right-to-bracket', t: 'Mover', ativo: escolhidos.length > 0, run: () => openM(<DestinoModal titulo="Mover para" inicial={caminho} botao="Mover" onOk={(d) => fazer({ acao: 'fm-mover', caminhos: caminhos(), destino: d }, 'Movido')} />) },
    { k: 'descarregar', fa: 'fa-download', t: 'Descarregar', ativo: !!um && !um.pasta, run: () => um && window.location.assign(url(me, 'descarregar', { caminho: juntar(caminho, um.nome) })) },
    { k: 'arquivar', fa: 'fa-box-archive', t: 'Arquivar', ativo: escolhidos.length > 0, run: () => openM(<ArquivarModal inicial={um ? um.nome.replace(/\.[^.]+$/, '') || um.nome : 'arquivo'} onOk={(n) => fazer({ acao: 'fm-comprimir', pasta: caminho, nome: n, caminhos: caminhos() }, 'Arquivo criado')} />) },
    { k: 'nome', fa: 'fa-pen', t: 'Mudar nome', ativo: !!um, run: () => um && openM(<NomeModal titulo="Mudar nome" rotulo="Nome novo" inicial={um.nome} botao="Guardar" onOk={(n) => fazer({ acao: 'fm-renomear', caminho: juntar(caminho, um.nome), nome: n }, 'Nome mudado')} />) },
  ];
  const mais: AcaoFm[] = [
    ...(um && !um.pasta && ARQUIVO.test(um.nome) ? [{ k: 'extrair', fa: 'fa-box-open', t: 'Extrair aqui', ativo: true, run: () => fazer({ acao: 'fm-extrair', caminho: juntar(caminho, um.nome), destino: caminho }, 'Extraído') }] : []),
    { k: 'perm', fa: 'fa-gear', t: 'Permissões', ativo: escolhidos.length > 0, run: () => openM(<PermModal inicial={um?.perm || '644'} onOk={(m) => fazer({ acao: 'fm-permissoes', caminhos: caminhos(), modo: m }, 'Permissões mudadas')} />) },
    { k: 'remover', fa: 'fa-trash-can', t: 'Remover', ativo: escolhidos.length > 0, perigo: true, run: apagar },
  ];
  const [maisAberto, setMaisAberto] = useState(false);
  useEffect(() => {
    if (!maisAberto) return;
    const f = () => setMaisAberto(false);
    document.addEventListener('click', f);
    return () => document.removeEventListener('click', f);
  }, [maisAberto]);
  const clicar = (e: React.MouseEvent, x: Item) => {
    if (e.shiftKey && ultimo) {
      const a = itens.findIndex((y) => y.nome === ultimo);
      const b = itens.findIndex((y) => y.nome === x.nome);
      setSel(itens.slice(Math.min(a, b), Math.max(a, b) + 1).map((y) => y.nome));
    } else if (e.metaKey || e.ctrlKey) setSel(sel.includes(x.nome) ? sel.filter((n) => n !== x.nome) : [...sel, x.nome]);
    else setSel([x.nome]);
    setUltimo(x.nome);
  };
  const procurar = async (q: string) => {
    setPesquisa({ q, itens: null });
    try {
      const j = await lerUrl<{ itens: Item[] }>(url(me, 'pesquisar', { caminho, q }));
      setPesquisa({ q, itens: j.itens });
    } catch (e) {
      vh.toast(e instanceof Error ? e.message : 'A pesquisa falhou');
      setPesquisa({ q, itens: [] });
    }
  };
  const botoes = (
    <nav className="fmda-tbs">
      <button className="fmda-tb" disabled={lixo} onClick={novaPasta}>
        <i className="fa-solid fa-folder-plus" />
        <span>{t('Nova pasta')}</span>
      </button>
      <button className="fmda-tb" disabled={lixo} onClick={novoFicheiro}>
        <i className="fa-solid fa-file-circle-plus" />
        <span>{t('Novo ficheiro')}</span>
      </button>
      <button className="fmda-tb" disabled={lixo} onClick={() => entrada.current?.click()}>
        <i className="fa-solid fa-cloud-arrow-up" />
        <span>{t('Carregar')}</span>
      </button>
      <input ref={entrada} type="file" multiple hidden onChange={(e) => { carregar(e.target.files); e.target.value = ''; }} />
      <span className="fmda-sep" />
      <button className="fmda-tb" disabled={lixo} onClick={() => setPesquisa({ q: '', itens: [] })}>
        <i className="fa-solid fa-magnifying-glass" />
        <span>{t('Pesquisar')}</span>
      </button>
      <span className="sp" />
      <button
        className="fmda-tb"
        disabled={lixo}
        onClick={async () => {
          try {
            setTamanhos((await lerUrl<{ tamanhos: Record<string, number> }>(url(me, 'tamanhos', { caminho }))).tamanhos);
          } catch (e) {
            vh.toast(e instanceof Error ? e.message : 'Não foi possível calcular');
          }
        }}
      >
        <i className="fa-solid fa-arrows-rotate" />
        <span>{t('Tamanhos das pastas')}</span>
      </button>
      <span className="fmda-sep" />
    </nav>
  );
  const arvore = (
    <aside className="fmda-arvore">
      <div className={'fmda-raiz' + (!lixo && !caminho ? ' on' : '')} onClick={() => ir('')}>
        <i className="fa-solid fa-house" />
        <span>{t('Os meus ficheiros')}</span>
      </div>
      <Ramo c="" nivel={1} atual={lixo ? '\u0000' : caminho} ir={ir} />
      <div className={'fmda-raiz fmda-lixo' + (lixo ? ' on' : '')} onClick={() => nav('/utilizador/ficheiros/_lixo')}>
        <i className="fa-solid fa-trash-can" />
        <span>{t('Reciclagem')}</span>
      </div>
    </aside>
  );
  if (lixo) {
    const l = lixoD.dados?.itens || [];
    const sl = l.filter((x) => sel.includes(x.id));
    return (
      <MolduraFm botoes={botoes}>
        <div className="fmda-corpo">
          {arvore}
          <section className="fmda-main">
            <div className="fmda-caminho">
              <i className="fa-solid fa-trash-can" />
              <i className="fa-solid fa-chevron-right" />
              <b>{t('Reciclagem')}</b>
            </div>
            <div className="fmda-acoes">
              <span className="fmda-cont">
                {t('Selecionados')}: {sl.length} / {l.length}
              </span>
              <button className="fmda-ac" disabled={!sl.length} onClick={() => fazer({ acao: 'fm-restaurar', ids: sl.map((x) => x.id) }, 'Restaurado')}>
                <i className="fa-solid fa-rotate-left" />
                {t('Restaurar')}
              </button>
              <button className="fmda-ac" disabled={!sl.length} onClick={() => openM(<Confirmar titulo="Apagar para sempre?" texto={sl.map((x) => x.nome).join(', ') + ' — não se pode desfazer.'} ok="Apagar" onOk={() => fazer({ acao: 'fm-esvaziar', ids: sl.map((x) => x.id) }, 'Apagado')} />)}>
                <i className="fa-solid fa-trash-can" />
                {t('Apagar para sempre')}
              </button>
              <button className="fmda-ac" disabled={!l.length} onClick={() => openM(<Confirmar titulo="Esvaziar a reciclagem?" texto="Tudo o que está na reciclagem é apagado para sempre." ok="Esvaziar" onOk={() => fazer({ acao: 'fm-esvaziar' }, 'Reciclagem vazia')} />)}>
                <i className="fa-solid fa-broom" />
                {t('Esvaziar a reciclagem')}
              </button>
            </div>
            {!lixoD.dados ? (
              <Carregando erro={lixoD.erro} ler={lixoD.ler} />
            ) : (
              <table className="fmda-tab">
                <thead>
                  <tr>
                    <th className="fmda-chk">
                      <input type="checkbox" checked={!!l.length && sl.length === l.length} onChange={(e) => setSel(e.target.checked ? l.map((x) => x.id) : [])} aria-label={t('Selecionar tudo')} />
                    </th>
                    <th className="fmda-icc" />
                    <th>{t('Nome')}</th>
                    <th>{t('Sítio original')}</th>
                    <th>{t('Apagado em')}</th>
                  </tr>
                </thead>
                <tbody>
                  {l.map((x) => (
                    <tr key={x.id} className={sel.includes(x.id) ? 'on' : ''} onClick={() => setSel(sel.includes(x.id) ? sel.filter((y) => y !== x.id) : [...sel, x.id])}>
                      <td className="fmda-chk">
                        <input type="checkbox" checked={sel.includes(x.id)} readOnly aria-label={x.nome} />
                      </td>
                      <td className="fmda-icc">
                        <IconeFicheiro x={{ nome: x.nome, pasta: x.pasta, atalho: false, tam: x.tam, data: x.data, perm: '' }} />
                      </td>
                      <td>{x.nome}</td>
                      <td>/home/{me}/{x.orig}</td>
                      <td>{dataDa(x.data)}</td>
                    </tr>
                  ))}
                  {!l.length && (
                    <tr className="fmda-vazio">
                      <td colSpan={5}>{t('A reciclagem está vazia.')}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </section>
        </div>
      </MolduraFm>
    );
  }
  return (
    <MolduraFm botoes={botoes}>
      <div className="fmda-corpo">
        {arvore}
        <section
          className="fmda-main"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            carregar(e.dataTransfer.files);
          }}
        >
          <div className="fmda-caminho">
            <a onClick={() => ir('')} aria-label={t('Os meus ficheiros')}>
              <i className="fa-solid fa-house" />
            </a>
            {partes.map((p, i) => (
              <span key={i}>
                <i className="fa-solid fa-chevron-right" />
                <a className={i === partes.length - 1 ? 'on' : ''} onClick={() => ir(partes.slice(0, i + 1).join('/'))}>
                  {p}
                </a>
              </span>
            ))}
          </div>
          <div className="fmda-acoes">
            <span className="fmda-cont">
              {t('Selecionados')}: {escolhidos.length} / {itens.length}
            </span>
            {acoes.map((a) => (
              <button key={a.k} className="fmda-ac" disabled={!a.ativo} onClick={a.run}>
                <i className={'fa-solid ' + a.fa} />
                {t(a.t)}
              </button>
            ))}
            <span className="fmda-mais">
              <button
                className="fmda-ac"
                disabled={!escolhidos.length}
                onClick={(e) => {
                  e.stopPropagation();
                  setMaisAberto(!maisAberto);
                }}
              >
                <i className="fa-solid fa-ellipsis-vertical" />
                {t('Mais')}
              </button>
              {maisAberto && (
                <div className="fmda-menu fmda-menu-mais">
                  {mais.map((a) => (
                    <button key={a.k} className={a.perigo ? 'perigo' : ''} disabled={!a.ativo} onClick={a.run}>
                      <i className={'fa-solid ' + a.fa} />
                      {t(a.t)}
                    </button>
                  ))}
                </div>
              )}
            </span>
          </div>
          {pesquisa && (
            <div className="fmda-pesq">
              <div className="fmda-pesq-cx">
                <i className="fa-solid fa-magnifying-glass" />
                <input autoFocus placeholder={t('Escreva o que procura…')} defaultValue={pesquisa.q} onKeyDown={(e) => e.key === 'Enter' && procurar((e.target as HTMLInputElement).value)} />
                <button className="fmda-pesq-fechar" onClick={() => setPesquisa(null)}>
                  <i className="fa-solid fa-xmark" />
                  {t('Fechar')}
                </button>
              </div>
              {pesquisa.q && (
                <div className="fmda-pesq-res">
                  {!pesquisa.itens ? null : pesquisa.itens.length ? (
                    pesquisa.itens.map((x) => (
                      <a
                        key={x.rel}
                        onClick={() => {
                          const pai = (x.rel || '').split('/').slice(0, -1).join('/');
                          setPesquisa(null);
                          x.pasta ? ir(x.rel || '') : ir(pai);
                        }}
                      >
                        <IconeFicheiro x={x} /> <span>/home/{me}/{x.rel}</span>
                      </a>
                    ))
                  ) : (
                    <p>{t('Nada encontrado.')}</p>
                  )}
                </div>
              )}
            </div>
          )}
          {!dados ? (
            <Carregando erro={erro} ler={ler} />
          ) : (
            <table className="fmda-tab">
              <thead>
                <tr>
                  <th className="fmda-chk">
                    <input type="checkbox" checked={!!itens.length && escolhidos.length === itens.length} ref={(el) => { if (el) el.indeterminate = escolhidos.length > 0 && escolhidos.length < itens.length; }} onChange={(e) => setSel(e.target.checked ? itens.map((x) => x.nome) : [])} aria-label={t('Selecionar tudo')} />
                  </th>
                  <th className="fmda-icc" />
                  <th>{t('Nome')}</th>
                  <th>{t('Tamanho')}</th>
                  <th>{t('Permissões')}</th>
                  <th>{t('Última alteração')}</th>
                  <th>UID/GID</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((x) => (
                  <tr
                    key={x.nome}
                    className={sel.includes(x.nome) ? 'on' : ''}
                    onClick={(e) => clicar(e, x)}
                    onDoubleClick={() => abrir(x)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      if (!sel.includes(x.nome)) setSel([x.nome]);
                      setMenu({ x: Math.min(e.clientX, window.innerWidth - 230), y: Math.min(e.clientY, window.innerHeight - 380) });
                    }}
                  >
                    <td className="fmda-chk" onClick={(e) => { e.stopPropagation(); setSel(sel.includes(x.nome) ? sel.filter((n) => n !== x.nome) : [...sel, x.nome]); setUltimo(x.nome); }}>
                      <input type="checkbox" checked={sel.includes(x.nome)} readOnly aria-label={x.nome} />
                    </td>
                    <td className="fmda-icc">
                      <IconeFicheiro x={x} />
                    </td>
                    <td className="fmda-nome">
                      {x.nome}
                      {x.atalho && <i className="fa-solid fa-link fmda-lig" />}
                    </td>
                    <td>{x.pasta ? (tamanhos && tamanhos[x.nome] != null ? (tamanhos[x.nome] < 0 ? '…' : tam(tamanhos[x.nome])) : '') : tam(x.tam)}</td>
                    <td className="fmda-mono">{permTexto(x)}</td>
                    <td>{dataDa(x.data)}</td>
                    <td>{(x.dono || me) + '/' + (x.grupo || me)}</td>
                  </tr>
                ))}
                {!itens.length && (
                  <tr className="fmda-vazio">
                    <td colSpan={7}>{t('Esta pasta está vazia. Arraste ficheiros para aqui para os carregar.')}</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
          {menu && (
            <div className="fmda-menu" style={{ left: menu.x, top: menu.y }} onClick={(e) => e.stopPropagation()}>
              {[...acoes, ...mais].map((a) => (
                <button
                  key={a.k}
                  className={a.perigo ? 'perigo' : ''}
                  disabled={!a.ativo}
                  onClick={() => {
                    setMenu(null);
                    a.run();
                  }}
                >
                  <i className={'fa-solid ' + a.fa} />
                  {t(a.t)}
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </MolduraFm>
  );
}

function Editor({ caminho }: { caminho: string }) {
  const vh = useVH();
  const { t, nav } = vh;
  const { dados, erro, ler } = useLer<{ caminho: string; texto: string }>('ler', { caminho });
  const [texto, setTexto] = useState<string | null>(null);
  const pasta = caminho.split('/').slice(0, -1).join('/');
  const nome = caminho.split('/').pop() || '';
  const voltar = () => nav(rotaFm(pasta));
  const v = texto ?? dados?.texto ?? '';
  const mudou = !!dados && texto !== null && texto !== dados.texto;
  const guardar = async () => {
    if (await noServidor(vh, { acao: 'fm-guardar', pasta, nome, texto: v }, 'Guardado')) {
      setTexto(null);
      ler();
    }
  };
  return (
    <MolduraFm
      botoes={
        <nav className="fmda-tbs">
          <button className="fmda-tb" disabled={!mudou} onClick={guardar}>
            <i className="fa-solid fa-floppy-disk" />
            <span>{t('Guardar')}</span>
          </button>
          <button className="fmda-tb" onClick={voltar}>
            <i className="fa-solid fa-xmark" />
            <span>{t('Fechar')}</span>
          </button>
          <span className="fmda-sep" />
        </nav>
      }
    >
      <div className="fmda-ed">
        <div className="fmda-caminho">
          <a onClick={() => nav(rotaFm(''))} aria-label={t('Os meus ficheiros')}>
            <i className="fa-solid fa-house" />
          </a>
          {caminho.split('/').map((p, i, l) => (
            <span key={i}>
              <i className="fa-solid fa-chevron-right" />
              <a className={i === l.length - 1 ? 'on' : ''} onClick={() => i < l.length - 1 && nav(rotaFm(l.slice(0, i + 1).join('/')))}>
                {p}
              </a>
            </span>
          ))}
          <span className="sp" />
          {mudou && <span className="tag w">{t('Por guardar')}</span>}
        </div>
        {!dados ? (
          <Carregando erro={erro} ler={ler} />
        ) : (
          <textarea
            className="fmda-texto"
            style={{ fontSize: Number(lerPref('vh-fm-letra', '13')) || 13 }}
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
        )}
        <p className="fmda-nota">{t('Ctrl+S (ou ⌘S) guarda. O ficheiro fica com o utilizador da conta como dono.')}</p>
      </div>
    </MolduraFm>
  );
}

export const ficheirosPagina: ScreenFn = (vh) => {
  const sub = vh.s.sub;
  const base = { t: 'Gestor de ficheiros', path: '/utilizador/ficheiros' };
  if (sub[0] === '_editar') {
    const c = sub.slice(1).join('/');
    return { title: 'Editar ficheiro', desc: c.split('/').pop(), crumbs: [base, { t: 'Editar' }], body: <Editor key={c} caminho={c} /> };
  }
  if (sub[0] === '_lixo') return { title: 'Reciclagem', crumbs: [base, { t: 'Reciclagem' }], body: <Ficheiros key="_lixo" caminho="" lixo /> };
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
    const i = setInterval(() => ler(true), 15000); // em segundo plano: sem a linha do topo
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
