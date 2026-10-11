'use client';

/**
 * Carregamento do painel, como no DirectAdmin (pedido do Silva, 10/10/2026):
 *  - uma linha fina no topo, na cor do tema, enquanto o painel fala com o servidor (sem rodinhas dentro das páginas);
 *  - a página nova só substitui a anterior quando já tem os dados (ver `EsperaPagina` e `VisualHostApp`);
 *  - memória do que cada página já leu: ao voltar, aparece logo e atualiza-se por trás.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

// ---------- Linha do topo: conta os pedidos ao site em curso ----------
let emCurso = 0;
const ouvintesAtividade = new Set<(n: number) => void>();
const avisar = () => ouvintesAtividade.forEach((f) => f(emCurso));
export const atividadeComeca = () => {
  emCurso++;
  avisar();
  let feito = false;
  return () => {
    if (feito) return;
    feito = true;
    emCurso = Math.max(0, emCurso - 1);
    avisar();
  };
};

/** Pedidos em segundo plano (atualizações automáticas) não mexem na linha do topo */
export const FUNDO = { 'x-vh-fundo': '1' };

/** Conta todos os pedidos do painel a `/api/…` (também os das páginas do site embutidas). Instala-se uma vez. */
export function instalarContador() {
  if (typeof window === 'undefined') return;
  const w = window as typeof window & { __vhFetch?: typeof fetch };
  if (w.__vhFetch) return;
  const original = window.fetch.bind(window);
  w.__vhFetch = original;
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const cab = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
    if (!/^(\/|https?:\/\/[^/]*\/)api\//.test(url.replace(location.origin, '')) || cab.has('x-vh-fundo')) return original(input, init);
    const fim = atividadeComeca();
    return original(input, init).finally(fim);
  };
}

/** Linha de carregamento no topo: uma barra discreta (4 px, esbatida nas pontas) que atravessa de um lado ao outro,
 *  sai por completo e volta (pedido do Silva a 11/10); visível enquanto houver pedidos; não aparece em pedidos de menos
 *  de 80 ms */
export function BarraTopo() {
  const [vis, setVis] = useState(false);
  const t = useRef<{ atraso?: ReturnType<typeof setTimeout>; fim?: ReturnType<typeof setTimeout>; desde: number }>({ desde: 0 });
  useEffect(() => {
    const muda = (n: number) => {
      if (n > 0) {
        clearTimeout(t.current.fim);
        t.current.fim = undefined;
        if (t.current.atraso || t.current.desde) return;
        t.current.atraso = setTimeout(() => {
          t.current.atraso = undefined;
          t.current.desde = Date.now();
          setVis(true);
        }, 80);
      } else {
        if (t.current.atraso) {
          clearTimeout(t.current.atraso);
          t.current.atraso = undefined;
          return;
        }
        if (!t.current.desde) return;
        // fica pelo menos 0,9 s, para não piscar
        const falta = Math.max(0, 900 - (Date.now() - t.current.desde));
        t.current.fim = setTimeout(() => {
          t.current.desde = 0;
          t.current.fim = undefined;
          setVis(false);
        }, falta);
      }
    };
    ouvintesAtividade.add(muda);
    if (emCurso) muda(emCurso);
    const tm = t.current;
    return () => {
      ouvintesAtividade.delete(muda);
      clearTimeout(tm.atraso);
      clearTimeout(tm.fim);
    };
  }, []);
  return <div className={'vh-barra-topo' + (vis ? ' on' : '')} role="progressbar" aria-hidden={!vis} />;
}

// ---------- Memória das leituras ----------
const memoria = new Map<string, unknown>();
const aLer = new Map<string, Promise<unknown>>();
const ouvintes = new Map<string, Set<(v: unknown) => void>>();

/** Lê um endereço da API (um só pedido de cada vez por endereço) e guarda a resposta */
export function lerUrl<T>(url: string, opcoes: { fundo?: boolean } = {}): Promise<T> {
  let p = aLer.get(url);
  if (!p) {
    p = fetch(url, { cache: 'no-store', headers: opcoes.fundo ? FUNDO : undefined })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error((j as { erro?: string }).erro || 'Erro a ler o servidor');
        memoria.set(url, j);
        ouvintes.get(url)?.forEach((f) => f(j));
        return j;
      })
      .finally(() => aLer.delete(url));
    aLer.set(url, p);
  }
  return p as Promise<T>;
}

export const naMemoria = <T,>(url: string) => memoria.get(url) as T | undefined;

/** Esquece leituras guardadas (todas, ou as que começam por `prefixo`) — ao sair ou depois de uma alteração */
export function esquecerMemoria(prefixo = '') {
  for (const k of [...memoria.keys()]) if (k.startsWith(prefixo)) memoria.delete(k);
}

// ---------- Página a abrir ----------
/** Cada leitura sem nada em memória avisa a página que ainda não está pronta (`comecar` devolve o "acabou") */
export interface Espera {
  comecar: () => () => void;
}
export const EsperaPagina = createContext<Espera | null>(null);

/** Leitura de uma página: mostra logo o que está em memória e atualiza por trás. `null` = não ler. */
export function useGet<T>(url: string | null, opcoes: { fundo?: boolean } = {}) {
  const espera = useContext(EsperaPagina);
  const [dados, setDados] = useState<T | null>(() => (url ? ((memoria.get(url) as T) ?? null) : null));
  const [erro, setErro] = useState('');
  const fundo = !!opcoes.fundo;
  // `ler()` normal; `ler(true)` em segundo plano (sem a linha do topo). Como botão, recebe o clique: conta como normal.
  const ler = useCallback(
    async (emFundo?: unknown) => {
      if (!url) return;
      setErro('');
      const fim = !memoria.has(url) && espera ? espera.comecar() : null;
      try {
        setDados(await lerUrl<T>(url, { fundo: emFundo === true || fundo }));
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Erro a ler o servidor');
      } finally {
        fim?.();
      }
    },
    [url, espera, fundo],
  );
  useEffect(() => {
    if (!url) return;
    setDados((memoria.get(url) as T) ?? null);
    const s = ouvintes.get(url) || new Set();
    const f = (v: unknown) => setDados(v as T);
    s.add(f);
    ouvintes.set(url, s);
    ler();
    return () => {
      s.delete(f);
    };
  }, [url, ler]);
  return { dados, erro, ler };
}
