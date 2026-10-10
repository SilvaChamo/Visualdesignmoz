'use client';

// Peças das páginas de gestão: formulário em linhas, limites com "Ilimitado", palavra-passe,
// separadores e tabela com pesquisa/colunas/seleção/ações em massa (como nas listas do DirectAdmin).
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useVH } from '../context';
import type { Campo, Lim, Unit } from './dados';

// ---------- Formulário ----------
export function Frm({ title, desc, right, children, foot }: { title?: string; desc?: string; right?: ReactNode; children: ReactNode; foot?: ReactNode }) {
  const { t } = useVH();
  return (
    <div className="frm">
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

export function Check({ checked, onChange, label, muted }: { checked: boolean; onChange: (v: boolean) => void; label: string; muted?: boolean }) {
  const { t } = useVH();
  return (
    <label className={'chk' + (muted ? ' mut' : '')}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
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
  return (
    <div className={'ptabs' + (sub ? ' sub' : '')} role="tablist">
      {tabs.map(([k, label, fa]) => (
        <button key={k} role="tab" aria-selected={on === k} className={on === k ? 'on' : ''} onClick={() => onChange(k)}>
          {fa && <i className={'fa-solid ' + fa} />}
          {t(label)}
        </button>
      ))}
    </div>
  );
}

// ---------- Tabela ----------
export interface Col<T> {
  k: string;
  t: string;
  cell: (row: T) => ReactNode;
  /** valor para ordenar ao clicar no título */
  sort?: (row: T) => string | number;
  /** escondida por defeito (pode ser ligada em "Colunas") */
  hidden?: boolean;
  right?: boolean;
}
export interface Bulk {
  t: string;
  fa: string;
  run: (keys: string[]) => void;
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
  search,
  bulk = [],
  actions,
  empty = 'Não há nada para mostrar',
  rowClass,
  cabecalho,
  barra2,
  onRecarregar,
  porPagina = 20,
  paginasNaBarra2 = false,
  rodape,
  inicioBarra2,
  fimBarra,
  semCols = true,
  semRecarregar = true,
  semBusca = true,
}: {
  id: string;
  rows: T[];
  cols: Col<T>[];
  rowKey: (r: T) => string;
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
  /** setas e "Página x de y" à direita da segunda linha (a do seletor), sempre visíveis (inativas se só houver uma página) */
  paginasNaBarra2?: boolean;
  /** no fundo do cartão da tabela, à esquerda (ex.: botão Adicionar) */
  rodape?: ReactNode;
  /** encostado à esquerda da segunda linha, antes do menu "Ações" (ex.: botão Adicionar) */
  inicioBarra2?: ReactNode;
  /** no fim da primeira linha, à direita (ex.: botão Adicionar por cima das setas das páginas) */
  fimBarra?: ReactNode;
  semCols?: boolean;
  semRecarregar?: boolean;
  semBusca?: boolean;
}) {
  const { t, toast } = useVH();
  const [q, setQ] = useState('');
  const [pag, setPag] = useState(1);
  const [acoesOpen, setAcoesOpen] = useState(false);
  const acoesRef = useRef<HTMLDivElement>(null);
  const [vis, setVis] = useState<string[]>(() => cols.map((c) => c.k));
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
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [acoesOpen]);
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
    if (sort && sc?.sort) r = [...r].sort((a, b) => (sc.sort!(a) > sc.sort!(b) ? 1 : sc.sort!(a) < sc.sort!(b) ? -1 : 0) * sort.dir);
    return r;
  }, [rows, q, search, sort, cols]);
  const keys = shown.map(rowKey);
  const selKeys = sel.filter((k) => keys.includes(k));
  const all = keys.length > 0 && selKeys.length === keys.length;
  const vcols = cols.filter((c) => vis.includes(c.k));
  const span = vcols.length + (bulk.length ? 1 : 0) + (actions ? 1 : 0);

  const paginas = Math.max(1, Math.ceil(shown.length / porPagina));
  const atual = Math.min(pag, paginas);
  const pagina = shown.slice((atual - 1) * porPagina, atual * porPagina);

  // Menu "Ações" (o que se faz às linhas escolhidas)
  const menuAcoes = (sempre: boolean) =>
    bulk.length > 0 && (sempre || selKeys.length > 0) ? (
      <div className="dt-cols dt-acoes" ref={acoesRef}>
        <button className="btn g sm" disabled={!selKeys.length} onClick={() => setAcoesOpen(!acoesOpen)}>
          {selKeys.length > 0 && <span className="n">{selKeys.length}</span>}
          {t('Ações')} <i className="fa-solid fa-caret-down" />
        </button>
        {acoesOpen && (
          <div className="menu">
            {bulk.map((b) => (
              <button
                key={b.t}
                onClick={() => {
                  setAcoesOpen(false);
                  b.run(selKeys);
                  setSel([]);
                }}
              >
                <i className={'fa-solid ' + b.fa} />
                {t(b.t)}
              </button>
            ))}
          </div>
        )}
      </div>
    ) : null;

  // Setas e "Página x de y"
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
      <small>
        {shown.length ? (atual - 1) * porPagina + 1 : 0}–{Math.min(atual * porPagina, shown.length)} {t('de')} {shown.length}
      </small>
    </div>
  );

  return (
    <>
      <div className={'dt-bar' + (cabecalho ? ' com-cab' : '')}>
        {cabecalho}
        <span className="sp" />
        {!barra2 && menuAcoes(false)}
        {search && !semBusca && (
          <div className="search dt-pesq">
            <i className="fa-solid fa-magnifying-glass" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Pesquisar')} aria-label={t('Pesquisar')} />
            {q && <i className="fa-solid fa-xmark limpar" onClick={() => setQ('')} />}
          </div>
        )}
        {!semCols && (
          <div className="dt-cols" ref={colsRef}>
            <button className="btn g sm" onClick={() => setColsOpen(!colsOpen)}>
              <i className="fa-solid fa-table-columns" />
              {t('Colunas')}
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
        )}
        {!semRecarregar && (
          <button className="btn g sm iconbtn" title={t('Atualizar')} onClick={() => (onRecarregar ? onRecarregar() : toast('Tabela atualizada'))}>
            <i className="fa-solid fa-rotate" />
          </button>
        )}
        {!paginasNaBarra2 && paginas > 1 && paginador}
        {fimBarra}
      </div>
      {barra2 && (
        <div className="dt-bar dt-barra2">
          {inicioBarra2}
          {menuAcoes(true)}
          {barra2}
          {paginasNaBarra2 && (
            <>
              <span className="sp" />
              {paginador}
            </>
          )}
        </div>
      )}
      <div className="tbl dt">
        <table>
          <thead>
            <tr>
              {bulk.length > 0 && (
                <th className="ck">
                  <input type="checkbox" aria-label={t('Selecionar tudo')} checked={all} disabled={!keys.length} onChange={() => setSel(all ? [] : keys)} />
                </th>
              )}
              {vcols.map((c) => (
                <th
                  key={c.k}
                  className={c.sort ? 'srt' : undefined}
                  style={c.right ? { textAlign: 'right' } : undefined}
                  onClick={c.sort ? () => setSort(sort?.k === c.k ? { k: c.k, dir: sort.dir === 1 ? -1 : 1 } : { k: c.k, dir: 1 }) : undefined}
                >
                  {t(c.t)}
                  {sort?.k === c.k && <i className={'fa-solid si ' + (sort.dir === 1 ? 'fa-arrow-up' : 'fa-arrow-down')} />}
                </th>
              ))}
              {actions && <th></th>}
            </tr>
          </thead>
          <tbody>
            {pagina.length ? (
              pagina.map((r) => {
                const k = rowKey(r);
                const on = selKeys.includes(k);
                return (
                  <tr key={k} className={(on ? 'sel ' : '') + (rowClass ? rowClass(r) : '')}>
                    {bulk.length > 0 && (
                      <td className="ck">
                        <input type="checkbox" aria-label={t('Selecionar')} checked={on} onChange={() => setSel(on ? sel.filter((x) => x !== k) : [...sel, k])} />
                      </td>
                    )}
                    {vcols.map((c) => (
                      <td key={c.k} style={c.right ? { textAlign: 'right' } : undefined}>
                        {c.cell(r)}
                      </td>
                    ))}
                    {actions && <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{actions(r)}</td>}
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
        {rodape && <div className="dt-fundo">{rodape}</div>}
      </div>
    </>
  );
}
