'use client';

// Peças das páginas de gestão: formulário em linhas, limites com "Ilimitado", palavra-passe,
// separadores e tabela com pesquisa/colunas/seleção/ações em massa (como nas listas do DirectAdmin).
import { useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { BarraPagina, FaixaAbas, PesquisaPagina, useVH } from '../context';
import type { Campo, Lim, Unit } from './dados';

// ---------- Formulário ----------
export function Frm({ title, desc, right, children, foot, className }: { title?: string; desc?: string; right?: ReactNode; children: ReactNode; foot?: ReactNode; className?: string }) {
  const { t } = useVH();
  return (
    <div className={className ? `frm ${className}` : 'frm'}>
      {title && (
        <div className="frm-head">
          <div>
            <h3>{t(title)}</h3>
            {desc && <p>{t(desc)}</p>}
          </div>
          {right}
        </div>
      )}
      {children}
      {foot && <div className="frm-foot">{foot}</div>}
    </div>
  );
}

export function Row({ label, hint, children, tag }: { label: string; hint?: string; children: ReactNode; tag?: string }) {
  const { t } = useVH();
  return (
    <div className="frm-row">
      <div className="frm-lb">
        {t(label)}
        {tag && <span className="frm-tag">{tag}</span>}
        {hint && <small>{t(hint)}</small>}
      </div>
      <div className="frm-ctl">{children}</div>
    </div>
  );
}

export function Check({ checked, onChange, label, muted, disabled, title }: { checked: boolean; onChange: (v: boolean) => void; label: string; muted?: boolean; disabled?: boolean; title?: string }) {
  const { t } = useVH();
  return (
    <label className={'chk' + (muted || disabled ? ' mut' : '')} title={title}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      {t(label)}
    </label>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  // dentro de uma <label> (lista de funcionalidades) o clique chega à caixa pela label; sozinho, muda-se aqui
  return (
    <span
      className="sw"
      onClick={(e) => {
        if ((e.target as HTMLElement).tagName !== 'INPUT' && !e.currentTarget.closest('label')) onChange(!checked);
      }}
    >
      <input type="checkbox" role="switch" aria-label={label} checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span />
    </span>
  );
}

export const novaSenha = () => {
  const az = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const r = (n: number) => Array.from(crypto.getRandomValues(new Uint32Array(n)), (x) => az[x % az.length]).join('');
  return r(6) + '!' + r(5) + '#' + r(3);
};

/** Palavra-passe: gerar · campo · mostrar (como no DirectAdmin) */
export function Senha({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useVH();
  const [show, setShow] = useState(false);
  return (
    <div className="igrp">
      <button type="button" className="ib" title={t('Gerar palavra-passe')} onClick={() => { onChange(novaSenha()); setShow(true); }}>
        <i className="fa-solid fa-dice" />
      </button>
      <input type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} autoComplete="new-password" />
      <button type="button" className="ib" title={t(show ? 'Esconder' : 'Mostrar')} onClick={() => setShow(!show)}>
        <i className={'fa-solid ' + (show ? 'fa-eye-slash' : 'fa-eye')} />
      </button>
    </div>
  );
}

/** Um limite: valor (+ unidade) e "Ilimitado" */
export function LimInput({ c, value, onChange }: { c: Campo; value: Lim; onChange: (l: Lim) => void }) {
  return (
    <>
      <div className="igrp">
        <input value={value.unl ? '' : value.v} placeholder={value.unl ? '∞' : c.ph || '0'} disabled={value.unl} inputMode={c.ph ? 'text' : 'numeric'} onChange={(e) => onChange({ ...value, v: e.target.value })} />
        {c.unit && (
          <select value={value.unit || 'MB'} disabled={value.unl} onChange={(e) => onChange({ ...value, unit: e.target.value as Unit })}>
            <option>MB</option>
            <option>GB</option>
            <option>TB</option>
          </select>
        )}
      </div>
      <Check checked={value.unl} onChange={(unl) => onChange({ ...value, unl })} label="Ilimitado" muted />
    </>
  );
}

/** Lista de limites (cada um numa linha) */
export function Limites({ campos, lim, set }: { campos: Campo[]; lim: Record<string, Lim>; set: (k: string, l: Lim) => void }) {
  return (
    <>
      {campos.map((c) => (
        <Row key={c.k} label={c.t} hint={c.help}>
          <LimInput c={c} value={lim[c.k] || { v: '', unl: true }} onChange={(l) => set(c.k, l)} />
        </Row>
      ))}
    </>
  );
}

/** Funcionalidades ligar/desligar, em grelha */
export function Funcionalidades({ campos, feats, set }: { campos: Campo[]; feats: Record<string, boolean>; set: (k: string, v: boolean) => void }) {
  const { t } = useVH();
  return (
    <div className="feats">
      {campos.map((c) => (
        <label key={c.k}>
          <span>
            {t(c.t)}
            {c.vh && <span className="frm-tag">VisualHost</span>}
            {c.help && <small>{t(c.help)}</small>}
          </span>
          <Switch checked={!!feats[c.k]} onChange={(v) => set(c.k, v)} label={c.t} />
        </label>
      ))}
    </div>
  );
}

// ---------- Separadores ----------
/** No topo da página ficam numa barra de ponta a ponta do cartão principal (como em Domínios); `sub` = separadores
 *  dentro de um separador (só sublinhados, para não haver duas barras seguidas) */
export function Tabs<K extends string>({ tabs, on, onChange, sub }: { tabs: [K, string, string?][]; on: K; onChange: (k: K) => void; sub?: boolean }) {
  const { t } = useVH();
  const faixa = useContext(FaixaAbas);
  const abas = (
    <div className={'ptabs' + (sub ? ' sub' : '')} role="tablist">
      {tabs.map(([k, label, fa]) => (
        <button key={k} role="tab" aria-selected={on === k} className={on === k ? 'on' : ''} onClick={() => onChange(k)}>
          {fa && <i className={'fa-solid ' + fa} />}
          {t(label)}
        </button>
      ))}
    </div>
  );
  if (sub || !faixa) return abas;
  // a faixa dos separadores guarda à direita o lugar do botão "Ações" — ver FaixaAbas. No telemóvel os separadores
  // passam a uma caixa de escolha (pedido do Silva, 13/10/2026: com muitos separadores não se viam os outros)
  return (
    <div className="ptabs-faixa">
      {abas}
      <label className="ptabs-sel">
        <select value={on} onChange={(e) => onChange(e.target.value as K)} aria-label={t('Separador')}>
          {tabs.map(([k, label]) => (
            <option key={k} value={k}>
              {t(label)}
            </option>
          ))}
        </select>
        <i className="fa-solid fa-chevron-down" />
      </label>
      <div className="ptabs-dir" ref={faixa.set} />
    </div>
  );
}

// ---------- Tabela ----------
const lerPrefTabela = (k: string, def: string) => {
  try {
    return (typeof localStorage !== 'undefined' && localStorage.getItem(k)) || def;
  } catch {
    return def;
  }
};
export interface Col<T> {
  k: string;
  t: string;
  cell: (row: T) => ReactNode;
  /** valor para ordenar ao clicar no título */
  sort?: (row: T) => string | number;
  /** marcada como escondida, mas hoje não é aplicada (a coluna aparece); para começar escondida usa-se `oculta` */
  hidden?: boolean;
  /** começa escondida (quem quiser liga-a no "Colunas"; a escolha fica guardada neste navegador) */
  oculta?: boolean;
  right?: boolean;
  /** sai nos ecrãs de computador/portátil até esta largura, para a tabela caber sem barra de deslocar (pedido do Silva,
   *  13/10/2026: colunas apertadas a 1440 e 1280); no telemóvel, em blocos, volta a aparecer */
  ate?: 1600 | 1300 | 1050;
}
export interface Bulk {
  t: string;
  fa: string;
  run: (keys: string[]) => void;
  /** não precisa de linhas escolhidas (ex.: "Adicionar subdomínio", "Marcar todas como lidas"): está sempre ativa no
   *  menu "Ações" — regra do Silva (13/10/2026): todos os botões da página vão para dentro do "Ações" */
  sempre?: boolean;
  /** opção inativa por agora (ex.: "Marcar todas como lidas" sem mensagens por ler) */
  inativo?: boolean;
}

const lerCols = (id: string): string[] | null => {
  try {
    const v = localStorage.getItem('vh-cols-' + id);
    return v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
};

export function DataTable<T>({
  id,
  rows,
  cols,
  rowKey,
  rowSort,
  search,
  bulk = [],
  actions,
  empty = 'Não há nada para mostrar',
  rowClass,
  cabecalho,
  barra2,
  onRecarregar,
  porPagina: porPaginaPedido,
  rodape,
  inicioBarra2,
  fimBarra,
  semCols: semColsPedido,
  semRecarregar = true,
  semBusca = true,
  acoesFixas = false,
  acoesDiretas = false,
  comSelecao = false,
  onSelChange,
  umaLinha = false,
  barraFora = false,
  empilhar = true,
  acoesNaColuna = false,
  colunasNoCabecalho = false,
}: {
  id: string;
  rows: T[];
  cols: Col<T>[];
  rowKey: (r: T) => string;
  rowSort?: (a: T, b: T) => number;
  search?: (r: T) => string;
  bulk?: Bulk[];
  actions?: (r: T) => ReactNode;
  empty?: string;
  rowClass?: (r: T) => string;
  /** à esquerda da linha da pesquisa (ex.: separadores, filtros) */
  cabecalho?: ReactNode;
  /** segunda linha por cima da tabela (ex.: domínio, nameservers, botões); começa pelo menu "Ações" */
  barra2?: ReactNode;
  /** o que "Atualizar" faz (sem isto, só avisa) */
  onRecarregar?: () => void;
  porPagina?: number;
  /** no fundo do cartão da tabela, à esquerda (ex.: botão Adicionar) */
  rodape?: ReactNode;
  /** encostado à esquerda da segunda linha, antes do menu "Ações" (ex.: botão Adicionar) */
  inicioBarra2?: ReactNode;
  /** no fim da primeira linha, à direita (ex.: botão Adicionar por cima das setas das páginas) */
  fimBarra?: ReactNode;
  semCols?: boolean;
  semRecarregar?: boolean;
  semBusca?: boolean;
  /** à esquerda, "Colunas" e "Ações" sempre à vista (Ações inativo sem linhas escolhidas); a pesquisa com 1/4 da largura
   *  do cartão, à direita (pedido do Silva para as contas do Admin) */
  acoesFixas?: boolean;
  /** mostra os botões de ação diretamente sem dropdown */
  acoesDiretas?: boolean;
  /** ativa a coluna de checkboxes de seleção nas linhas e cabeçalho */
  comSelecao?: boolean;
  /** Regra do Silva (13/10/2026): o "Ações" na faixa dos separadores, à direita, com todas as ações da página lá
   *  dentro; sem pesquisa nem botões por cima do cartão; paginação só no fundo do cartão. */
  umaLinha?: boolean;
  /** com umaLinha: a linha vai para a faixa por cima do cartão principal (modelo do Silva: fora da faixa dos
   *  separadores que abre o cartão, como em Domínios) */
  barraFora?: boolean;
  /** no telemóvel cada linha passa a um bloco numa só coluna: a caixa e a primeira coluna em cima, o resto por baixo
   *  com o nome de cada coluna (pedido do Silva, 13/10/2026 — lista de IPs da Força bruta). Com 'botoes-em-baixo', os
   *  botões da linha vão para o fundo do bloco, a toda a largura, divididos por igual (DNS). Com 'tablet', também no
   *  tablet ao alto (769–1000), onde a tabela não cabe ao lado do menu (Força bruta). Ligado por defeito em todas as
   *  tabelas (Silva, 14/10/2026: nada pode passar dos limites no telemóvel, a partir de 320 px) */
  empilhar?: boolean | 'botoes-em-baixo' | 'tablet';
  /** o "Ações" no lugar do título da 1.ª coluna mesmo com separadores (Força bruta — modelo do Silva, 13/10/2026) */
  acoesNaColuna?: boolean;
  /** o botão "Colunas" no cabeçalho da tabela, depois da última coluna, em vez de numa barra por cima do cartão
   *  (modelo do Silva, 14/10/2026 — listas de contas) */
  colunasNoCabecalho?: boolean;
  /** notifica chaves das linhas selecionadas */
  onSelChange?: (keys: string[]) => void;
}) {
  // Preferências → Tabelas (neste navegador): linhas por página e botão Colunas, quando a página não escolhe
  const porPagina = porPaginaPedido ?? (Number(lerPrefTabela('vh-linhas', '20')) || 20);
  const semCols = semColsPedido ?? lerPrefTabela('vh-colunas', '0') !== '1';
  const { t, toast } = useVH();
  const faixaFora = useContext(BarraPagina);
  const faixaAbas = useContext(FaixaAbas);
  const pesqPagina = useContext(PesquisaPagina);
  const [q, setQ] = useState('');
  // linha escolhida na lupa da barra de cima: fica realçada uns segundos
  const [realce, setRealce] = useState<string | null>(null);
  const tabelaRef = useRef<HTMLDivElement>(null);
  const [pag, setPag] = useState(1);
  const [acoesOpen, setAcoesOpen] = useState(false);
  // "Ações" no título da 1.ª coluna: o menu abre em posição fixa (calculada do botão) para a tabela, que pode
  // deslizar, não o cortar quando tem poucas linhas — como o menu "⋯" das linhas
  const [acoesPos, setAcoesPos] = useState<{ top: number; left: number } | null>(null);
  const acoesRef = useRef<HTMLDivElement>(null);
  const [vis, setVis] = useState<string[]>(() => cols.filter((c) => !c.oculta).map((c) => c.k));
  const [colsOpen, setColsOpen] = useState(false);
  const [sel, setSel] = useState<string[]>([]);
  const [sort, setSort] = useState<{ k: string; dir: 1 | -1 } | null>(null);
  const colsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = lerCols(id);
    if (saved) setVis(saved.filter((k) => cols.some((c) => c.k === k)));
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!acoesOpen) return;
    const close = (e: MouseEvent) => !acoesRef.current?.contains(e.target as Node) && setAcoesOpen(false);
    const sair = () => setAcoesOpen(false);
    document.addEventListener('mousedown', close);
    if (acoesPos) {
      window.addEventListener('scroll', sair, true);
      window.addEventListener('resize', sair);
    }
    return () => {
      document.removeEventListener('mousedown', close);
      window.removeEventListener('scroll', sair, true);
      window.removeEventListener('resize', sair);
    };
  }, [acoesOpen, acoesPos]);
  useEffect(() => setPag(1), [q, rows.length]);
  useEffect(() => {
    if (!colsOpen) return;
    const close = (e: MouseEvent) => !colsRef.current?.contains(e.target as Node) && setColsOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [colsOpen]);

  const toggleCol = (k: string) => {
    const next = vis.includes(k) ? vis.filter((x) => x !== k) : cols.filter((c) => vis.includes(c.k) || c.k === k).map((c) => c.k);
    setVis(next);
    try {
      localStorage.setItem('vh-cols-' + id, JSON.stringify(next));
    } catch {}
  };

  const shown = useMemo(() => {
    const qq = q.trim().toLowerCase();
    let r = qq && search ? rows.filter((x) => search(x).toLowerCase().includes(qq)) : rows;
    const sc = sort && cols.find((c) => c.k === sort.k);
    if (sort && sc?.sort) r = [...r].sort((a, b) => {
      const rowOrder = rowSort?.(a, b) || 0;
      return rowOrder || (sc.sort!(a) > sc.sort!(b) ? 1 : sc.sort!(a) < sc.sort!(b) ? -1 : 0) * sort.dir;
    });
    return r;
  }, [rows, q, search, sort, cols, rowSort]);
  const keys = shown.map(rowKey);
  const selKeys = sel.filter((k) => keys.includes(k));
  const all = keys.length > 0 && selKeys.length === keys.length;
  const vcols = cols.filter((c) => vis.includes(c.k));
  // caixas de seleção só quando alguma ação precisa de linhas escolhidas (as `sempre` não precisam)
  const temSelecao = bulk.some((b) => !b.sempre) || comSelecao;
  // "Ações" só onde há caixas de seleção (regra do Silva, 13/10/2026: as ações aplicam-se ao que se escolhe). Com
  // separadores fica à direita da faixa deles; sem separadores aparece no lugar do título da 1.ª coluna quando se
  // assinala uma caixa (ex.: "Conta" nas contas de e-mail) e o título volta quando já nada está escolhido.
  const comAcoes = temSelecao && bulk.length > 0;
  const acoesNoCabecalho = umaLinha && barraFora && comAcoes && (acoesNaColuna || !faixaAbas?.el) && !cabecalho;
  const acoesNoTitulo = acoesNoCabecalho && (selKeys.length > 0 || bulk.some((b) => b.sempre));
  const colAcoes = !!actions;
  // coluna do fim: os botões de cada linha e, com colunasNoCabecalho, o "Colunas" no título dela
  const colFim = colAcoes || (colunasNoCabecalho && !semCols);
  const span = vcols.length + (temSelecao ? 1 : 0) + (colFim ? 1 : 0);

  const paginas = Math.max(1, Math.ceil(shown.length / porPagina));
  const atual = Math.min(pag, paginas);
  const pagina = shown.slice((atual - 1) * porPagina, atual * porPagina);

  // Lupa da barra de cima (pedido do Silva): as linhas desta tabela entram na pesquisa da página aberta; escolher uma
  // limpa o filtro, vai à página da tabela onde ela está, mostra-a e realça-a
  const vivo = useRef({ rows, search, rowKey, porPagina, sortRows: (r: T[]) => r });
  vivo.current = {
    rows,
    search,
    rowKey,
    porPagina,
    sortRows: (r: T[]) => {
      const sc = sort && cols.find((c) => c.k === sort.k);
      return sort && sc?.sort ? [...r].sort((a, b) => (sc.sort!(a) > sc.sort!(b) ? 1 : sc.sort!(a) < sc.sort!(b) ? -1 : 0) * sort.dir) : r;
    },
  };
  useEffect(() => {
    if (!pesqPagina) return;
    const irPara = (k: string) => {
      const v = vivo.current;
      const idx = v.sortRows(v.rows).findIndex((r) => v.rowKey(r) === k);
      setQ('');
      if (idx >= 0) setPag(Math.floor(idx / v.porPagina) + 1);
      setRealce(k);
      setTimeout(() => {
        const tr = tabelaRef.current?.querySelector<HTMLElement>('tr[data-k="' + CSS.escape(k) + '"]');
        tr?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, 80);
      setTimeout(() => setRealce((x) => (x === k ? null : x)), 2600);
    };
    return pesqPagina.registar(id, () => {
      const v = vivo.current;
      if (!v.search) return []; // sem texto de pesquisa a tabela não entra (as chaves sozinhas não dizem nada)
      return v.rows.map((r) => {
        const k = v.rowKey(r);
        return { k: id + ':' + k, txt: v.search!(r), ir: () => irPara(k) };
      });
    });
  }, [pesqPagina, id]);

  const selKeysStr = selKeys.join(',');
  useEffect(() => {
    onSelChange?.(selKeys);
    // sem nada escolhido o "Ações" do título da 1.ª coluna sai: o menu não fica aberto para a próxima vez
    if (!selKeys.length) setAcoesOpen(false);
  }, [selKeysStr]); // eslint-disable-line react-hooks/exhaustive-deps

  // Menu "Ações": tudo o que se faz na página (regra do Silva, 13/10/2026 — nenhum botão por cima do cartão). As opções
  // que precisam de linhas escolhidas ficam inativas enquanto nenhuma caixa estiver assinalada; as outras (`sempre`)
  // estão sempre disponíveis e vêm primeiro.
  const menuAcoes = (sempre: boolean) => {
    if (!bulk.length || (!sempre && !selKeys.length)) return null;
    if (acoesDiretas && bulk.length === 1 && !bulk[0].sempre) {
      const b = bulk[0];
      return (
        <button
          className="btn r sm dt-btn-direto"
          disabled={!selKeys.length}
          onClick={() => {
            b.run(selKeys);
            setSel([]);
          }}
          title={t(b.t)}
        >
          <i className={'fa-solid ' + b.fa} />
          {t(b.t)}
          {selKeys.length > 0 && <span className="n">{selKeys.length}</span>}
        </button>
      );
    }
    const livres = bulk.filter((b) => b.sempre);
    const comSel = bulk.filter((b) => !b.sempre);
    const opcao = (b: Bulk) => (
      <button
        key={b.t}
        disabled={b.inativo || (!b.sempre && !selKeys.length)}
        onClick={() => {
          setAcoesOpen(false);
          if (b.sempre) return b.run(selKeys);
          b.run(selKeys);
          setSel([]);
        }}
      >
        <i className={'fa-solid ' + b.fa} />
        {t(b.t)}
      </button>
    );
    return (
      <div className="dt-cols dt-acoes" ref={acoesRef}>
        <button
          className="btn g sm"
          onClick={(e) => {
            if (!acoesOpen && acoesNoTitulo) {
              const r = e.currentTarget.getBoundingClientRect();
              const altura = bulk.length * 34 + 20;
              setAcoesPos({ top: window.innerHeight - r.bottom < altura + 12 && r.top > altura + 12 ? r.top - altura - 6 : r.bottom + 6, left: r.left });
            } else if (!acoesOpen) setAcoesPos(null);
            setAcoesOpen(!acoesOpen);
          }}
        >
          {selKeys.length > 0 && <span className="n">{selKeys.length}</span>}
          {t('Ações')} <i className="fa-solid fa-caret-down" />
        </button>
        {acoesOpen && (
          <div
            className="menu"
            style={acoesPos ? { position: 'fixed', top: acoesPos.top, left: acoesPos.left, right: 'auto' } : undefined}
            // no telemóvel o menu, aberto a partir do botão, passava da borda direita do ecrã: encosta-se a ela
            ref={(m) => {
              if (!m || !acoesPos) return;
              const r = m.getBoundingClientRect();
              if (r.right > window.innerWidth - 8) m.style.left = Math.max(8, window.innerWidth - 8 - r.width) + 'px';
            }}
          >
            {livres.map(opcao)}
            {livres.length > 0 && comSel.length > 0 && <div className="menu-sep" />}
            {comSel.map(opcao)}
          </div>
        )}
      </div>
    );
  };

  // Setas e "Página x de y" (sem o "1–20 de 67"): só no fundo do cartão, quando há mais de uma página (regra do Silva,
  // 13/10/2026 — nunca na faixa dos separadores nem por cima da tabela)
  const paginador = (
    <div className="dt-pag">
      <button className="btn g sm" disabled={atual === 1} onClick={() => setPag(1)} aria-label={t('Primeira página')}>
        «
      </button>
      <button className="btn g sm" disabled={atual === 1} onClick={() => setPag(atual - 1)} aria-label={t('Página anterior')}>
        ‹
      </button>
      <span>
        {t('Página')} {atual} {t('de')} {paginas}
      </span>
      <button className="btn g sm" disabled={atual === paginas} onClick={() => setPag(atual + 1)} aria-label={t('Página seguinte')}>
        ›
      </button>
      <button className="btn g sm" disabled={atual === paginas} onClick={() => setPag(paginas)} aria-label={t('Última página')}>
        »
      </button>
    </div>
  );

  // Pesquisa e botão "Colunas" (escolher as colunas que se veem)
  const pesquisa = search && !semBusca && (
    <div className="search dt-pesq">
      <i className="fa-solid fa-magnifying-glass" />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Pesquisar')} aria-label={t('Pesquisar')} />
      {q && <i className="fa-solid fa-xmark limpar" onClick={() => setQ('')} />}
    </div>
  );
  const colunas = !semCols && (
    <div className={'dt-cols' + (colunasNoCabecalho ? ' dt-cols-cab' : '')} ref={colsRef}>
      <button className={'btn g sm' + (colunasNoCabecalho ? ' iconbtn' : '')} title={t('Colunas')} aria-label={t('Colunas')} onClick={() => setColsOpen(!colsOpen)}>
        <i className="fa-solid fa-table-columns" />
        {!colunasNoCabecalho && t('Colunas')}
      </button>
      {colsOpen && (
        <div className="menu">
          {cols.map((c) => (
            <label key={c.k}>
              <input type="checkbox" checked={vis.includes(c.k)} onChange={() => toggleCol(c.k)} />
              {t(c.t)}
            </label>
          ))}
        </div>
      )}
    </div>
  );

  const recarregar = !semRecarregar && (
    <button className="btn g sm iconbtn" title={t('Atualizar')} onClick={() => (onRecarregar ? onRecarregar() : toast('Tabela atualizada'))}>
      <i className="fa-solid fa-rotate" />
    </button>
  );

  return (
    <>
      {umaLinha ? (
        (() => {
          // Regra do Silva (13/10/2026): na faixa dos separadores (cabeçalho do cartão principal) fica só o "Ações",
          // sempre à vista e à direita, com tudo o que se faz na página lá dentro (`bulk`; as opções sem linhas
          // escolhidas usam `sempre`). Nunca pesquisa, paginação nem outros botões por cima do cartão: a paginação
          // fica no fundo do cartão.
          const naFaixa = comAcoes && barraFora && faixaAbas?.el && !cabecalho && !acoesNaColuna;
          const naBarra = colunasNoCabecalho ? null : colunas;
          const outros = !!(inicioBarra2 || barra2 || naBarra || recarregar || fimBarra);
          const linha =
            outros || cabecalho || (!naFaixa && !acoesNoCabecalho && comAcoes) ? (
              <div className={'dt-bar dt-uma-linha' + (cabecalho ? ' com-cab' : '') + (barraFora ? ' dt-fora' : '')}>
                {cabecalho}
                <span className="sp" />
                {inicioBarra2}
                {barra2}
                {naBarra}
                {recarregar}
                {fimBarra}
                {!naFaixa && !acoesNoCabecalho && comAcoes && menuAcoes(true)}
              </div>
            ) : null;
          return (
            <>
              {linha && (barraFora && faixaFora ? createPortal(linha, faixaFora) : linha)}
              {naFaixa &&
                createPortal(
                  menuAcoes(true),
                  faixaAbas.el!,
                )}
            </>
          );
        })()
      ) : (
      <div className={'dt-bar' + (cabecalho ? ' com-cab' : '') + (acoesFixas ? ' dt-fixas' : '')}>
        {acoesFixas && colunas}
        {acoesFixas && !barra2 && menuAcoes(true)}
        {cabecalho}
        <span className="sp" />
        {pesquisa}
        {!acoesFixas && colunas}
        {recarregar}
        {fimBarra}
        {/* "Ações" sempre à vista e sempre o último à direita (regra do Silva, 13/10/2026) */}
        {!acoesFixas && !barra2 && comAcoes && menuAcoes(true)}
      </div>
      )}
      {barra2 && !umaLinha && (
        <div className="dt-bar dt-barra2">
          {inicioBarra2}
          {menuAcoes(true)}
          {barra2}
        </div>
      )}
      <div className={'tbl dt' + (empilhar ? ' dt-empilhar' : '') + (empilhar === 'botoes-em-baixo' ? ' dt-empilhar-baixo' : '') + (empilhar === 'tablet' ? ' dt-empilhar-tablet' : '')} ref={tabelaRef}>
        <table>
          <thead>
            <tr>
              {temSelecao && (
                <th className="ck" data-t={t('Selecionar tudo')}>
                  <input type="checkbox" aria-label={t('Selecionar tudo')} checked={all} disabled={!keys.length} onChange={() => setSel(all ? [] : keys)} />
                </th>
              )}
              {vcols.map((c, i) =>
                acoesNoTitulo && i === 0 ? (
                  <th key={c.k} className="dt-th-acoes">
                    {menuAcoes(true)}
                  </th>
                ) : (
                  <th
                    key={c.k}
                    className={[c.sort ? 'srt' : '', c.ate ? 'dt-ate-' + c.ate : ''].filter(Boolean).join(' ') || undefined}
                    style={c.right ? { textAlign: 'right' } : undefined}
                    onClick={c.sort ? () => setSort(sort?.k === c.k ? { k: c.k, dir: sort.dir === 1 ? -1 : 1 } : { k: c.k, dir: 1 }) : undefined}
                  >
                    {t(c.t)}
                    {sort?.k === c.k && <i className={'fa-solid si ' + (sort.dir === 1 ? 'fa-arrow-up' : 'fa-arrow-down')} />}
                  </th>
                ),
              )}
              {colunasNoCabecalho && colunas ? <th className="dt-th-cols">{colunas}</th> : colFim && <th />}
            </tr>
          </thead>
          <tbody>
            {pagina.length ? (
              pagina.map((r) => {
                const k = rowKey(r);
                const on = selKeys.includes(k);
                return (
                  <tr key={k} data-k={k} className={(on ? 'sel ' : '') + (realce === k ? 'dt-realce ' : '') + (rowClass ? rowClass(r) : '')}>
                    {temSelecao && (
                      <td className="ck">
                        <input type="checkbox" aria-label={t('Selecionar')} checked={on} onChange={() => setSel(on ? sel.filter((x) => x !== k) : [...sel, k])} />
                      </td>
                    )}
                    {vcols.map((c) => (
                      <td key={c.k} data-t={t(c.t)} className={c.ate ? 'dt-ate-' + c.ate : undefined} style={c.right ? { textAlign: 'right' } : undefined}>
                        {c.cell(r)}
                      </td>
                    ))}
                    {colFim && <td className="dt-acoes-linha" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{actions ? actions(r) : null}</td>}
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={span} className="empty">
                  {t(q ? 'Nada encontrado' : empty)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {(rodape || paginas > 1) && (
          <div className="dt-fundo">
            {rodape}
            {paginas > 1 && (
              <>
                <span className="sp" />
                {paginador}
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
