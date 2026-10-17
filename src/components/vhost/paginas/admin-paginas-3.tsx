'use client';

// Páginas do menu Admin que faltavam — 3.ª parte (Silva, 16/10/2026): Estatísticas do servidor (gráficos do sysstat),
// Editor de ficheiros do sistema e Tickets de todos os clientes. Mesmas regras de layout das outras partes
// (admin-paginas.tsx e admin-paginas-2.tsx).
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { useVH, type VH } from '../context';
import type { ScreenFn } from '../screens';
import { esquecerMemoria, useGet, useNaMemoria } from '../carga';
import { Stat } from '../ui';
import { DataTable, Tabs } from './componentes';
import { Confirmar } from './pacotes';
import { Carregando, Sec } from './avancado';
import { ROTA, num, pedir } from './admin-paginas';

type Trab = { aCorrer: boolean; registo: string[] };

// ======================= Estatísticas do servidor =======================
type Est = {
  dia: string;
  nucleos: number;
  cpu: { t: string; user: number; sistema: number; espera: number }[];
  carga: { t: string; l1: number; l5: number; l15: number }[];
  memoria: { t: string; pct: number }[];
  rede: { t: string; rx: number; tx: number }[];
  interface: string;
  existe: boolean;
  sysstat: boolean;
  trabalho: Trab;
};
const estUrl = (dia: number) => ROTA + '?ver=estatisticas&dia=' + dia;
const kbs = (v: number) => (v >= 1024 ? num(v / 1024, 1) + ' MB/s' : num(v, v < 10 ? 1 : 0) + ' kB/s');

/** Escala "redonda" do eixo: o topo e o passo (0 / 25 / 50 / 75 / 100, 0 / 2 / 4 / 6…) */
function escala(max: number) {
  const m = max > 0 ? max : 1;
  const bruto = m / 4;
  const mag = 10 ** Math.floor(Math.log10(bruto));
  const n = bruto / mag;
  const passo = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
  return { topo: Math.ceil(m / passo) * passo, passo };
}

type Serie = { nome: string; cor: 1 | 2 | 3; v: number[] };
/**
 * Gráfico de linhas no tempo (SVG). Método da skill de visualização: linhas de 2 px, área a 10 % só com uma série,
 * grelha em linhas finas, legenda com duas ou mais séries, e uma linha vertical que segue o ponteiro (ou as setas do
 * teclado) com os valores de todas as séries nesse instante. As cores são as --viz-1…3 (paginas.css), validadas
 * para o fundo claro e o escuro do painel.
 */
function Grafico({ titulo, horas, series, fmt, max, linhaRef }: { titulo: string; horas: string[]; series: Serie[]; fmt: (v: number) => string; max?: number; linhaRef?: { v: number; texto: string } }) {
  const { t } = useVH();
  const caixa = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(560);
  const [i, setI] = useState<number | null>(null);
  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.max(240, Math.round(el.clientWidth))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const [dw, setDw] = useState(150);
  const n = horas.length;
  const H = 190;
  const maior = Math.max(0, ...series.flatMap((s) => s.v), linhaRef ? linhaRef.v : 0);
  const { topo, passo } = escala(max ?? maior * 1.08);
  const ticks: number[] = [];
  for (let v = 0; v <= topo + passo / 1000; v += passo) ticks.push(v);
  // a margem da esquerda cabe o rótulo mais comprido do eixo (ex.: "2,5 MB/s")
  const m = { t: 10, r: 12, b: 24, l: Math.max(30, Math.round(Math.max(...ticks.map((v) => fmt(v).length)) * 6.4) + 10) };
  const iw = w - m.l - m.r;
  const ih = H - m.t - m.b;
  const x = (k: number) => m.l + (n > 1 ? (k / (n - 1)) * iw : iw / 2);
  const y = (v: number) => m.t + ih - (Math.min(v, topo) / topo) * ih;
  // horas no eixo de baixo: de 3 em 3 horas (6 em 6 em ecrãs estreitos)
  const cada = w < 420 ? 6 : 3;
  const marcas: number[] = [];
  let ultimaHora = -1;
  horas.forEach((h, k) => {
    const hh = Number(h.slice(0, 2));
    if (hh !== ultimaHora && hh % cada === 0) marcas.push(k);
    ultimaHora = hh;
  });
  const caminho = (v: number[]) => v.map((val, k) => (k ? 'L' : 'M') + x(k).toFixed(1) + ',' + y(val).toFixed(1)).join('');
  const mover = (e: PointerEvent<SVGRectElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const k = Math.round(((e.clientX - r.left) / r.width) * (n - 1));
    setI(Math.max(0, Math.min(n - 1, k)));
  };
  const teclas = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    setI((atual) => Math.max(0, Math.min(n - 1, (atual ?? n - 1) + (e.key === 'ArrowLeft' ? -1 : 1))));
  };
  const xi = i !== null ? x(i) : 0;
  return (
    <div className="ad-graf">
      <div className="ad-graf-cab">
        <h4>{t(titulo)}</h4>
        {series.length > 1 && (
          <span className="ad-legenda">
            {series.map((s) => (
              <span key={s.nome}>
                <i style={{ background: `var(--viz-${s.cor})` }} />
                {t(s.nome)}
              </span>
            ))}
          </span>
        )}
      </div>
      <div className="ad-graf-area" ref={caixa}>
        {n ? (
          <svg width={w} height={H} role="img" aria-label={t(titulo)} tabIndex={0} onKeyDown={teclas} onFocus={() => setI((a) => a ?? n - 1)} onBlur={() => setI(null)}>
            {ticks.map((v) => (
              <g key={v}>
                <line className="ad-grelha" x1={m.l} x2={w - m.r} y1={y(v)} y2={y(v)} />
                <text className="ad-eixo" x={m.l - 6} y={y(v) + 4} textAnchor="end">
                  {fmt(v)}
                </text>
              </g>
            ))}
            {marcas.map((k) => (
              <text key={k} className="ad-eixo" x={x(k)} y={H - 6} textAnchor="middle">
                {horas[k].slice(0, 2) + ':00'}
              </text>
            ))}
            {linhaRef && linhaRef.v <= topo && (
              <g>
                <line className="ad-ref" x1={m.l} x2={w - m.r} y1={y(linhaRef.v)} y2={y(linhaRef.v)} />
                <text className="ad-eixo" x={w - m.r} y={y(linhaRef.v) - 5} textAnchor="end">
                  {linhaRef.texto}
                </text>
              </g>
            )}
            {series.length === 1 && n > 1 && <path d={caminho(series[0].v) + `L${x(n - 1)},${y(0)}L${x(0)},${y(0)}Z`} style={{ fill: `var(--viz-${series[0].cor})` }} className="ad-area" />}
            {series.map((s) => (
              <path key={s.nome} d={caminho(s.v)} className="ad-linha" style={{ stroke: `var(--viz-${s.cor})` }} />
            ))}
            {i !== null && (
              <g>
                <line className="ad-cruz" x1={xi} x2={xi} y1={m.t} y2={m.t + ih} />
                {series.map((s) => (
                  <circle key={s.nome} cx={xi} cy={y(s.v[i])} r={4} className="ad-ponto" style={{ fill: `var(--viz-${s.cor})` }} />
                ))}
              </g>
            )}
            <rect x={m.l} y={m.t} width={iw} height={ih} fill="transparent" onPointerMove={mover} onPointerDown={mover} onPointerLeave={() => setI(null)} />
          </svg>
        ) : (
          <div className="ad-graf-vazio">{t('Sem dados neste dia')}</div>
        )}
        {i !== null && n > 0 && (
          <div
            className="ad-dica"
            ref={(el) => {
              if (el && Math.abs(el.offsetWidth - dw) > 1) setDw(el.offsetWidth);
            }}
            // ao lado da linha vertical, do lado onde couber (sem a tapar)
            style={{ left: xi + 12 + dw <= w ? xi + 12 : xi - 12 - dw >= 0 ? xi - 12 - dw : Math.max(0, w - dw) }}
          >
            <small>{horas[i]}</small>
            {series.map((s) => (
              <span key={s.nome}>
                <i style={{ background: `var(--viz-${s.cor})` }} />
                <b>{fmt(s.v[i])}</b> {t(s.nome)}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const DIAS = ['Hoje', 'Ontem', 'Há 2 dias', 'Há 3 dias', 'Há 4 dias', 'Há 5 dias', 'Há 6 dias'];
type AbaE = 'graficos' | 'tabela';
function EstatisticasServidor() {
  const vh = useVH();
  const { t } = vh;
  const [dia, setDia] = useState(0);
  const [aba, setAba] = useState<AbaE>('graficos');
  const { dados, erro, ler } = useGet<Est>(estUrl(dia));
  // ao mudar de dia, o dia anterior fica à vista (mais claro) até chegar o novo — nunca a página vazia
  const ultimo = useRef<Est | null>(null);
  if (dados) ultimo.current = dados;
  const d = dados || ultimo.current;
  const aCorrer = !!d?.trabalho.aCorrer;
  useEffect(() => {
    if (!aCorrer) return;
    const id = setInterval(() => void ler(true), 4000);
    return () => clearInterval(id);
  }, [aCorrer, ler]);
  if (!d) return <Carregando erro={erro} ler={ler} />;
  if (!d.sysstat)
    return (
      <div className="card empty">
        <p>{t(aCorrer ? 'A instalar o sysstat… os gráficos começam a encher nos próximos 10 minutos.' : 'Este servidor ainda não guarda as estatísticas (o sysstat não está instalado). Ligue-as no botão da barra de cima.')}</p>
      </div>
    );
  const cpuTot = d.cpu.map((c) => c.user + c.sistema + c.espera);
  const media = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0);
  const iCarga = d.carga.reduce((b, c, k) => (c.l1 > (d.carga[b]?.l1 ?? -1) ? k : b), 0);
  const memMax = Math.max(0, ...d.memoria.map((x) => x.pct));
  const redeTot = d.rede.map((r) => r.rx + r.tx);
  const iRede = redeTot.reduce((b, v, k) => (v > redeTot[b] ? k : b), 0);
  const linhas = d.cpu.map((c, k) => ({
    t: c.t,
    cpu: cpuTot[k],
    carga: d.carga.find((x) => x.t === c.t)?.l1,
    mem: d.memoria.find((x) => x.t === c.t)?.pct,
    rx: d.rede.find((x) => x.t === c.t)?.rx,
    tx: d.rede.find((x) => x.t === c.t)?.tx,
  }));
  const pct = (v: number) => num(v, v < 10 && v % 1 ? 1 : 0) + ' %';
  return (
    <div className={dados ? '' : 'ad-a-ler'}>
      <Tabs<AbaE>
        on={aba}
        onChange={setAba}
        tabs={[
          ['graficos', 'Gráficos', 'fa-chart-line'],
          ['tabela', 'Tabela', 'fa-table'],
        ]}
      />
      <div className="ad-procura">
        <select value={dia} onChange={(e) => setDia(Number(e.target.value))} aria-label={t('Dia')}>
          {DIAS.map((l, k) => (
            <option key={k} value={k}>
              {t(l)}
            </option>
          ))}
        </select>
        <span className="pm-desc">
          {d.dia}
          {d.interface ? ' · ' + t('rede') + ' ' + d.interface : ''} · {d.nucleos} {t('núcleos')}
        </span>
      </div>
      {!d.existe ? (
        <div className="card empty">{t('Não há estatísticas guardadas deste dia.')}</div>
      ) : aba === 'graficos' ? (
        <>
          <div className="stats ad-stats-dentro">
            <Stat title="CPU em média" v={pct(media(cpuTot))} m="" p={media(cpuTot)} />
            <Stat title="Carga mais alta" v={num(d.carga[iCarga]?.l1 || 0, 2)} m={d.carga[iCarga] ? t('às') + ' ' + d.carga[iCarga].t : ''} p={((d.carga[iCarga]?.l1 || 0) / d.nucleos) * 100} />
            <Stat title="Memória mais alta" v={pct(memMax)} m="" p={memMax} />
            <Stat title="Rede no pico" v={kbs(redeTot[iRede] || 0)} m={d.rede[iRede] ? t('às') + ' ' + d.rede[iRede].t : ''} p={0} />
          </div>
          <div className="ad-grafs">
            <Grafico
              titulo="Processador (CPU)"
              horas={d.cpu.map((c) => c.t)}
              fmt={(v) => num(v, v && v < 10 && v % 1 ? 1 : 0) + '%'}
              series={[
                { nome: 'Programas', cor: 1, v: d.cpu.map((c) => c.user) },
                { nome: 'Sistema', cor: 2, v: d.cpu.map((c) => c.sistema) },
                { nome: 'Espera do disco', cor: 3, v: d.cpu.map((c) => c.espera) },
              ]}
            />
            <Grafico
              titulo="Carga do servidor"
              horas={d.carga.map((c) => c.t)}
              fmt={(v) => num(v, v && v < 10 && v % 1 ? 1 : 0)}
              linhaRef={{ v: d.nucleos, texto: d.nucleos + ' ' + t('núcleos') }}
              series={[
                { nome: '1 minuto', cor: 1, v: d.carga.map((c) => c.l1) },
                { nome: '15 minutos', cor: 2, v: d.carga.map((c) => c.l15) },
              ]}
            />
            <Grafico titulo="Memória usada" horas={d.memoria.map((c) => c.t)} max={100} fmt={(v) => num(v) + '%'} series={[{ nome: 'Memória', cor: 1, v: d.memoria.map((c) => c.pct) }]} />
            <Grafico
              titulo="Rede"
              horas={d.rede.map((c) => c.t)}
              fmt={kbs}
              series={[
                { nome: 'Recebido', cor: 1, v: d.rede.map((c) => c.rx) },
                { nome: 'Enviado', cor: 2, v: d.rede.map((c) => c.tx) },
              ]}
            />
          </div>
        </>
      ) : (
        <DataTable
          id="ad-est"
          empilhar="tablet"
          rows={linhas}
          rowKey={(r) => r.t}
          empty="Sem dados neste dia"
          cols={[
            { k: 't', t: 'Hora', sort: (r) => r.t, cell: (r) => r.t },
            { k: 'c', t: 'CPU', right: true, sort: (r) => r.cpu, cell: (r) => pct(r.cpu) },
            { k: 'l', t: 'Carga', right: true, sort: (r) => r.carga ?? 0, cell: (r) => (r.carga !== undefined ? num(r.carga, 2) : '—') },
            { k: 'm', t: 'Memória', right: true, sort: (r) => r.mem ?? 0, cell: (r) => (r.mem !== undefined ? pct(r.mem) : '—') },
            { k: 'r', t: 'Recebido', right: true, sort: (r) => r.rx ?? 0, cell: (r) => (r.rx !== undefined ? kbs(r.rx) : '—') },
            { k: 'e', t: 'Enviado', right: true, sort: (r) => r.tx ?? 0, cell: (r) => (r.tx !== undefined ? kbs(r.tx) : '—') },
          ]}
        />
      )}
    </div>
  );
}
function BotaoSysstat() {
  const vh = useVH();
  const d = useNaMemoria<Est>(estUrl(0));
  if (!d || d.sysstat || d.trabalho.aCorrer) return null;
  return (
    <button
      className="btn r"
      onClick={() =>
        vh.openM(
          <Confirmar
            titulo="Ligar as estatísticas?"
            texto={vh.t('Instala o sysstat, que guarda a cada 10 minutos o uso do processador, da memória e da rede (ocupa poucos MB).')}
            ok="Ligar"
            onOk={async () => {
              if (await pedir(vh, { acao: 'sysstat-ligar' }, 'A instalar…')) esquecerMemoria(estUrl(0));
            }}
          />,
        )
      }
    >
      <i className="fa-solid fa-chart-line" />
      {vh.t('Ligar as estatísticas')}
    </button>
  );
}
export const estatisticasAdminPagina: ScreenFn = () => ({
  title: 'Estatísticas do servidor',
  desc: 'Processador, carga, memória e rede ao longo do dia',
  actions: <BotaoSysstat />,
  body: <EstatisticasServidor />,
});

// ======================= Editor de ficheiros do sistema =======================
type Ficheiro = { id: string; nome: string; caminho: string; existe: boolean; tamanho: number; mtime: string; teste: string; recarga: string };
type Aberto = Ficheiro & { texto: string; grande?: boolean; copias: { nome: string; tamanho: number; data: string }[] };
const ED_URL = ROTA + '?ver=editor';
const edLer = (id: string) => ROTA + '?ver=editor-ler&ficheiro=' + encodeURIComponent(id);
const tam = (b: number) => (b >= 1024 ? num(b / 1024, 1) + ' KB' : b + ' B');
type AbaX = 'editar' | 'copias';
async function gravar(vh: VH, corpo: Record<string, unknown>): Promise<{ ok: boolean; erro?: string; aviso?: string }> {
  vh.toast('A gravar no servidor…');
  try {
    const r = await fetch(ROTA, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
    const j = (await r.json().catch(() => ({}))) as { erro?: string; aviso?: string };
    if (!r.ok) return { ok: false, erro: j.erro || 'Não foi possível gravar.' };
    vh.toast(j.aviso || 'Gravado');
    return { ok: true, aviso: j.aviso };
  } catch {
    return { ok: false, erro: 'Sem ligação ao site. Nada foi gravado.' };
  }
}
function EditorSistema() {
  const vh = useVH();
  const { t } = vh;
  const [aba, setAba] = useState<AbaX>('editar');
  const lista = useGet<{ ficheiros: Ficheiro[] }>(ED_URL);
  const existentes = lista.dados?.ficheiros.filter((f) => f.existe) || [];
  const [id, setId] = useState('');
  const atual = id && existentes.some((f) => f.id === id) ? id : existentes[0]?.id || '';
  const { dados, erro, ler } = useGet<Aberto>(atual ? edLer(atual) : null);
  const [txt, setTxt] = useState<string | null>(null);
  const [falha, setFalha] = useState('');
  const [aGravar, setAGravar] = useState(false);
  // ao abrir outro ficheiro (ou a versão nova depois de gravar) o texto volta ao do servidor
  const versao = dados ? dados.id + '@' + dados.mtime : '';
  useEffect(() => {
    setTxt(null);
    setFalha('');
  }, [versao]);
  if (!lista.dados) return <Carregando erro={lista.erro} ler={lista.ler} />;
  if (!existentes.length) return <div className="card empty">{t('Nenhum dos ficheiros de configuração conhecidos existe neste servidor.')}</div>;
  const texto = txt ?? dados?.texto ?? '';
  const mudou = !!dados && txt !== null && txt !== dados.texto;
  const escolher = (novo: string) => {
    if (!mudou) return setId(novo);
    vh.openM(<Confirmar titulo="Sair sem gravar?" texto={t('As alterações a') + ' ' + dados?.caminho + ' ' + t('perdem-se.')} ok="Sair sem gravar" onOk={() => setId(novo)} />);
  };
  const guardar = async () => {
    if (!dados) return;
    setAGravar(true);
    const r = await gravar(vh, { acao: 'editor-gravar', ficheiro: dados.id, texto, mtime: dados.mtime });
    setAGravar(false);
    setFalha(r.ok ? '' : r.erro || '');
    if (r.ok) {
      esquecerMemoria(ED_URL);
      void ler(true);
    }
  };
  const restaurar = (k: string[]) => {
    if (!dados) return;
    if (k.length !== 1) return vh.toast('Escolha só uma cópia');
    const c = dados.copias.find((x) => x.nome === k[0]);
    vh.openM(
      <Confirmar
        titulo="Restaurar esta cópia?"
        texto={dados.caminho + ' ← ' + (c?.data || k[0]) + '. ' + t('O ficheiro de agora também fica guardado como cópia.')}
        ok="Restaurar"
        onOk={async () => {
          const r = await gravar(vh, { acao: 'editor-restaurar', ficheiro: dados.id, copia: k[0] });
          if (!r.ok) vh.toast(r.erro || 'Não foi possível restaurar.');
          else void ler(true);
        }}
      />,
    );
  };
  return (
    <>
      <Tabs<AbaX>
        on={aba}
        onChange={setAba}
        tabs={[
          ['editar', 'Editar', 'fa-file-pen'],
          ['copias', 'Cópias anteriores', 'fa-clock-rotate-left'],
        ]}
      />
      <div className="ad-procura">
        <select value={atual} onChange={(e) => escolher(e.target.value)} aria-label={t('Ficheiro')}>
          {existentes.map((f) => (
            <option key={f.id} value={f.id}>
              {t(f.nome)}
            </option>
          ))}
        </select>
        {dados && (
          <span className="pm-desc">
            <code>{dados.caminho}</code> · {tam(dados.tamanho)}
          </span>
        )}
      </div>
      {!dados ? (
        <Carregando erro={erro} ler={ler} />
      ) : aba === 'copias' ? (
        <DataTable
          id="ad-ed-copias"
          umaLinha
          barraFora
          rows={dados.copias}
          rowKey={(r) => r.nome}
          empty="Ainda não há cópias deste ficheiro"
          cols={[
            { k: 'd', t: 'Gravada em', sort: (r) => r.data, cell: (r) => <b>{r.data}</b> },
            { k: 't', t: 'Tamanho', right: true, sort: (r) => r.tamanho, cell: (r) => tam(r.tamanho) },
          ]}
          acoesNaColuna
          bulk={[{ t: 'Restaurar', fa: 'fa-clock-rotate-left', run: restaurar }]}
        />
      ) : dados.grande ? (
        <div className="card empty">{t('Este ficheiro tem mais de 1 MB; edite-o pelo terminal.')}</div>
      ) : (
        <>
          <textarea className="ad-editor" value={texto} onChange={(e) => setTxt(e.target.value)} spellCheck={false} wrap="off" aria-label={dados.caminho} />
          {falha && (
            <div className="imp ad-falha">
              <i className="fa-solid fa-triangle-exclamation" />
              <div>{falha}</div>
            </div>
          )}
          <p className="pm-desc ad-ed-nota">
            {t('Antes de gravar fica uma cópia (as 10 últimas).')}{' '}
            {dados.teste && (
              <>
                {t('Verifica-se com')} <code>{dados.teste}</code>
                {dados.recarga ? (
                  <>
                    {' '}
                    {t('e aplica-se com')} <code>{dados.recarga}</code>
                  </>
                ) : null}
                .{' '}
              </>
            )}
            {!dados.teste && dados.recarga && (
              <>
                {t('Aplica-se com')} <code>{dados.recarga}</code>.{' '}
              </>
            )}
            {t('Se a verificação falhar, o ficheiro volta ao que estava.')}
          </p>
          <div className="frm-foot ad-ed-foot">
            <button className="btn r" disabled={!mudou || aGravar} onClick={guardar}>
              <i className="fa-solid fa-floppy-disk" />
              {t('Guardar')}
            </button>
            <button className="btn g" disabled={!mudou || aGravar} onClick={() => setTxt(null)}>
              {t('Desfazer as alterações')}
            </button>
          </div>
        </>
      )}
    </>
  );
}
export const editorSistemaPagina: ScreenFn = () => ({ title: 'Editor de ficheiros do sistema', desc: 'Configurações do servidor, com cópia antes de gravar', body: <EditorSistema /> });

// ======================= Tickets (todos os clientes) =======================
const TK = '/api/vhost/suporte-admin';
type PedidoA = { id: string; cliente_id: string; cliente: string; email: string; assunto: string; descricao?: string; categoria: string; prioridade: string; status: string; created_at: string; updated_at: string };
type RespostaA = { id: string; resposta: string; respondente: string | null; created_at: string };
const CATS: Record<string, string> = { geral: 'Geral', tecnico: 'Técnico', dominios: 'Domínios', email: 'E-mail', faturacao: 'Faturação' };
const PRIOS: Record<string, [string, string]> = { baixa: ['Baixa', 'off'], normal: ['Normal', 'ok'], alta: ['Alta', 'w'], urgente: ['Urgente', 'bad'] };
const ESTADOS: Record<string, [string, string]> = { open: ['Por responder', 'bad'], in_progress: ['Em tratamento', 'w'], waiting_client: ['À espera do cliente', 'ok'], answered: ['Respondido', 'ok'], resolved: ['Resolvido', 'off'], closed: ['Fechado', 'off'] };
const estado = (s: string) => ESTADOS[s] || [s || 'Por responder', 'bad'];
const dataCurta = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}, ${p(d.getHours())}:${p(d.getMinutes())}`;
};
async function tkPedir(vh: VH, corpo: Record<string, unknown>, ok: string): Promise<Record<string, unknown> | null> {
  try {
    const r = await fetch(TK, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
    const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    if (!r.ok) {
      vh.toast(String(j.erro || 'Não foi possível'));
      return null;
    }
    esquecerMemoria(TK);
    vh.toast(ok);
    return j;
  } catch {
    vh.toast('Sem ligação ao site.');
    return null;
  }
}
type AbaT = 'responder' | 'espera' | 'fechados' | 'todos';
const NA_ABA: Record<AbaT, (s: string) => boolean> = {
  responder: (s) => s === 'open' || s === 'in_progress' || !s,
  espera: (s) => s === 'waiting_client' || s === 'answered',
  fechados: (s) => s === 'closed' || s === 'resolved',
  todos: () => true,
};
function TicketsAdmin() {
  const vh = useVH();
  const { t, nav } = vh;
  const [aba, setAba] = useState<AbaT>('responder');
  const { dados, erro, ler } = useGet<{ pedidos: PedidoA[] }>(TK);
  if (!dados) return <Carregando erro={erro} ler={ler} />;
  const linhas = dados.pedidos.filter((p) => NA_ABA[aba](p.status));
  const mudar = (ids: string[], est: string, msg: string) => void tkPedir(vh, { acao: 'estado', ids, estado: est }, msg).then((j) => j && ler(true));
  return (
    <>
      <Tabs<AbaT>
        on={aba}
        onChange={setAba}
        tabs={[
          ['responder', 'Por responder', 'fa-inbox'],
          ['espera', 'À espera do cliente', 'fa-hourglass-half'],
          ['fechados', 'Fechados', 'fa-circle-check'],
          ['todos', 'Todos', 'fa-list'],
        ]}
      />
      <DataTable
        id="ad-tickets"
        umaLinha
        barraFora
        empilhar="tablet"
        rows={linhas}
        rowKey={(r) => r.id}
        search={(r) => r.assunto + ' ' + r.cliente + ' ' + r.email}
        empty="Nenhum pedido"
        cols={[
          { k: 'a', t: 'Pedido', sort: (r) => r.assunto, cell: (r) => (
            <span className="pm-proc">
              <a className="lk" onClick={() => nav('/admin/tickets/' + r.id)}>
                {r.assunto}
              </a>
              <small>{r.cliente || r.email || t('Cliente sem nome')}</small>
            </span>
          ) },
          { k: 'c', t: 'Categoria', ate: 1300, cell: (r) => t(CATS[r.categoria] || r.categoria) },
          { k: 'p', t: 'Prioridade', sort: (r) => ['baixa', 'normal', 'alta', 'urgente'].indexOf(r.prioridade), cell: (r) => <span className={'tag ' + (PRIOS[r.prioridade]?.[1] || 'ok')}>{t(PRIOS[r.prioridade]?.[0] || r.prioridade)}</span> },
          { k: 's', t: 'Estado', sort: (r) => r.status, cell: (r) => <span className={'tag ' + estado(r.status)[1]}>{t(estado(r.status)[0])}</span> },
          { k: 'u', t: 'Atualizado', sort: (r) => r.updated_at || r.created_at, cell: (r) => dataCurta(r.updated_at || r.created_at) },
        ]}
        acoesNaColuna
        bulk={[
          { t: 'Em tratamento', fa: 'fa-person-digging', run: (k) => mudar(k, 'in_progress', 'Pedidos em tratamento') },
          { t: 'Fechar', fa: 'fa-circle-check', run: (k) => mudar(k, 'closed', 'Pedidos fechados') },
          { t: 'Reabrir', fa: 'fa-rotate-left', run: (k) => mudar(k, 'open', 'Pedidos reabertos') },
          { t: 'Apagar', fa: 'fa-trash-can', run: (k) => vh.openM(<Confirmar titulo="Apagar os pedidos?" texto={k.length + ' ' + t(k.length === 1 ? 'pedido, com as respostas.' : 'pedidos, com as respostas.')} ok="Apagar" onOk={async () => (await tkPedir(vh, { acao: 'apagar', ids: k }, 'Pedidos apagados')) && ler(true)} />) },
        ]}
      />
    </>
  );
}
function VerTicket({ id }: { id: string }) {
  const vh = useVH();
  const { t } = vh;
  const url = TK + '?id=' + encodeURIComponent(id);
  const { dados, erro, ler } = useGet<{ pedido: PedidoA; respostas: RespostaA[] }>(url);
  const [txt, setTxt] = useState('');
  if (!dados) return <Carregando erro={erro} ler={ler} />;
  const p = dados.pedido;
  const fechado = p.status === 'closed' || p.status === 'resolved';
  const depois = () => {
    esquecerMemoria(url);
    void ler(true);
  };
  return (
    <>
      <div className="da-grelha">
        <div className="da-lin n3">
          {(
            [
              ['fa-tag', 'Categoria', t(CATS[p.categoria] || p.categoria)],
              ['fa-signal', 'Prioridade', t(PRIOS[p.prioridade]?.[0] || p.prioridade)],
              ['fa-circle-info', 'Estado', t(estado(p.status)[0])],
            ] as [string, string, string][]
          ).map(([fa, l, v]) => (
            <div className="da-cel" key={l}>
              <i className={'fa-solid ' + fa} />
              <div>
                <small>{t(l)}</small>
                <span>{v}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="tk-fio">
        <div className="tk-msg cliente">
          <div className="tk-cab">
            <b>{p.cliente || p.email || t('Cliente')}</b> · {dataCurta(p.created_at)}
          </div>
          <div className="tk-txt">{p.descricao}</div>
        </div>
        {dados.respostas.map((r) => (
          <div key={r.id} className={'tk-msg ' + (r.respondente === 'cliente' || r.respondente === 'client' ? 'cliente' : 'equipa')}>
            <div className="tk-cab">
              <b>{r.respondente === 'cliente' || r.respondente === 'client' ? p.cliente || t('Cliente') : t('Equipa de suporte')}</b> · {dataCurta(r.created_at)}
            </div>
            <div className="tk-txt">{r.resposta}</div>
          </div>
        ))}
      </div>
      <div className="frm">
        <div className="field">
          <label>{t('Responder ao cliente')}</label>
          <textarea className="inp em-txt" rows={5} value={txt} maxLength={8000} onChange={(e) => setTxt(e.target.value)} placeholder={p.email ? t('Vai também por e-mail para') + ' ' + p.email : ''} />
        </div>
        <div className="mfoot" style={{ justifyContent: 'flex-start' }}>
          <button
            className="btn r"
            disabled={txt.trim().length < 2}
            onClick={async () => {
              const j = await tkPedir(vh, { acao: 'responder', id, texto: txt }, 'Resposta enviada');
              if (j) {
                if (j.email === false && p.email) vh.toast('Resposta guardada, mas o e-mail ao cliente não saiu');
                setTxt('');
                depois();
              }
            }}
          >
            <i className="fa-solid fa-reply" />
            {t('Enviar resposta')}
          </button>
          {fechado ? (
            <button className="btn g" onClick={async () => (await tkPedir(vh, { acao: 'estado', ids: [id], estado: 'open' }, 'Pedido reaberto')) && depois()}>
              {t('Reabrir pedido')}
            </button>
          ) : (
            <button className="btn g" onClick={() => vh.openM(<Confirmar titulo="Fechar o pedido?" texto={p.assunto} ok="Fechar pedido" onOk={async () => (await tkPedir(vh, { acao: 'estado', ids: [id], estado: 'closed' }, 'Pedido fechado')) && depois()} />)}>
              {t('Fechar pedido')}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
function NovoTicket() {
  const vh = useVH();
  const { t, nav } = vh;
  const { dados, erro, ler } = useGet<{ clientes: { id: string; name: string | null; email: string | null }[] }>(TK + '?clientes=1');
  const [f, setF] = useState({ cliente: '', assunto: '', categoria: 'tecnico', prioridade: 'normal', descricao: '' });
  const [aEnviar, setAEnviar] = useState(false);
  if (!dados) return <Carregando erro={erro} ler={ler} />;
  return (
    <Sec titulo="Abrir pedido em nome de um cliente" desc="O cliente vê o pedido no painel dele, em Suporte e ajuda → Suporte, e pode responder lá.">
      <div className="frm">
        <div className="field">
          <label>{t('Cliente')}</label>
          <select className="inp" value={f.cliente} onChange={(e) => setF({ ...f, cliente: e.target.value })}>
            <option value="">{t('Escolha o cliente')}</option>
            {dados.clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {(c.name || c.email || c.id) + (c.name && c.email ? ' — ' + c.email : '')}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>{t('Assunto')}</label>
          <input className="inp" value={f.assunto} maxLength={160} onChange={(e) => setF({ ...f, assunto: e.target.value })} />
        </div>
        <div className="row">
          <div className="field">
            <label>{t('Categoria')}</label>
            <select className="inp" value={f.categoria} onChange={(e) => setF({ ...f, categoria: e.target.value })}>
              {Object.entries(CATS).map(([k, v]) => (
                <option key={k} value={k}>
                  {t(v)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>{t('Prioridade')}</label>
            <select className="inp" value={f.prioridade} onChange={(e) => setF({ ...f, prioridade: e.target.value })}>
              {Object.entries(PRIOS).map(([k, [v]]) => (
                <option key={k} value={k}>
                  {t(v)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field">
          <label>{t('Descrição')}</label>
          <textarea className="inp em-txt" rows={8} value={f.descricao} maxLength={8000} onChange={(e) => setF({ ...f, descricao: e.target.value })} />
        </div>
        <div className="mfoot" style={{ justifyContent: 'flex-start' }}>
          <button
            className="btn r"
            disabled={aEnviar || !f.cliente || f.assunto.trim().length < 3 || f.descricao.trim().length < 10}
            onClick={async () => {
              setAEnviar(true);
              const j = await tkPedir(vh, { acao: 'criar', ...f }, 'Pedido criado');
              setAEnviar(false);
              if (j?.id) nav('/admin/tickets/' + j.id);
            }}
          >
            <i className="fa-solid fa-paper-plane" />
            {t('Criar pedido')}
          </button>
        </div>
      </div>
    </Sec>
  );
}
function ResumoTickets() {
  const { t } = useVH();
  const d = useNaMemoria<{ pedidos: PedidoA[] }>(TK);
  const por = d?.pedidos.filter((p) => NA_ABA.responder(p.status)).length;
  return (
    <>
      {t('Pedidos de suporte de todos os clientes')}
      {d && (
        <>
          <span className="pdesc-sep">|</span>
          {por} {t('por responder')}
        </>
      )}
    </>
  );
}
function ClienteDoTicket({ id }: { id: string }) {
  const { t } = useVH();
  const d = useNaMemoria<{ pedido: PedidoA }>(TK + '?id=' + encodeURIComponent(id));
  return <>{d ? (d.pedido.cliente || d.pedido.email) + (d.pedido.cliente && d.pedido.email ? ' | ' + d.pedido.email : '') : t('Pedido de suporte')}</>;
}
export const ticketsAdminPagina: ScreenFn = (vh) => {
  const [a] = vh.s.sub;
  const base = { t: 'Tickets', path: '/admin/tickets' };
  if (a === 'novo') return { title: 'Novo pedido', crumbs: [base, { t: 'Novo pedido' }], desc: 'Em nome de um cliente', body: <NovoTicket /> };
  if (a) return { title: 'Pedido de suporte', crumbs: [base, { t: 'Pedido' }], descEl: <ClienteDoTicket id={a} />, body: <VerTicket key={a} id={a} /> };
  return {
    title: 'Tickets',
    desc: 'Pedidos de suporte de todos os clientes',
    descEl: <ResumoTickets />,
    actions: (
      <button className="btn r" onClick={() => vh.nav('/admin/tickets/novo')}>
        <i className="fa-solid fa-plus" />
        {vh.t('Novo pedido')}
      </button>
    ),
    body: <TicketsAdmin />,
  };
};
