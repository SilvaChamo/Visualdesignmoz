'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { DashTab, St } from './state';
import type { Lang } from './i18n';
import type { Account, Level } from './types';
import type { Db } from './paginas/dados';
import type { CustomComponents } from './theme';

/** O que os ecrãs precisam do painel (na maquete eram o objeto S e as funções globais). */
export interface VH {
  s: St;
  /** traduz um texto conhecido quando o idioma é inglês */
  t: (text: string) => string;
  me: string;
  a: Account;
  allowed: Level[];
  /** com `id` (página do menu) também conta o que o plano esconde (Admin › Acessos por plano) */
  hasFeat: (f?: string, id?: string) => boolean;
  nav: (path: string) => void;
  go: (id: string) => void;
  setLevel: (l: Level) => void;
  toast: (msg: string) => void;
  openM: (content: ReactNode) => void;
  closeM: () => void;
  /** só para dados do painel; mudar contas do servidor aqui é recusado (usar paginas/acoes.ts) */
  updateAcc: (fn: (acc: Record<string, Account>) => void) => void;
  /** muda as contas e os dados das páginas de gestão ao mesmo tempo (cópia, depois grava) */
  updateDb: (fn: (db: Db, acc: Record<string, Account>) => void) => void;
  /** volta a ler os dados do servidor (depois de uma alteração) */
  recarregar: (fresco?: boolean) => Promise<void>;
  enterAs: (u: string) => void;
  backToMine: () => void;
  setDashTab: (t: DashTab) => void;
  setNotes: (on: boolean) => void;
  setLang: (l: Lang) => void;
  toggleTheme: () => void;
  /** escolhe o tema de cores (as cores mudadas à mão nesse tema voltam com ele) */
  setColorPreset: (presetId: string, customPrimary?: string) => void;
  /** guarda as cores mudadas à mão no tema atual (null = repor as do tema) */
  saveThemeColors: (c: CustomComponents | null) => void;
  /** mostra no painel as cores a ser editadas, sem guardar */
  previewThemeColors: (c: CustomComponents | null) => void;
  setRadius: (r: string) => void;
  /** escolhe o domínio no seletor da faixa de navegação */
  setDominio: (d: string, aviso?: boolean) => void;
  /** Admin › Acessos por plano: depois de gravar no servidor, o painel passa logo a usar os novos */
  setAcessos: (a: Record<string, string[]>) => void;
  setBrand: (b: { name: string; logo: string }) => void;
  openSearch: () => void;
  logout: () => void;
}

export const VHContext = createContext<VH | null>(null);

/** Faixa por cima do cartão principal de cada página (modelo do Silva, 13/10/2026): a pesquisa (à esquerda) e os
 *  botões de ações (à direita) ficam aqui, fora da faixa dos separadores que abre o cartão. Ver DataTable `barraFora`. */
export const BarraPagina = createContext<HTMLElement | null>(null);

/** Lado direito da faixa dos separadores que abre o cartão (regra do Silva, 13/10/2026): o botão "Ações" fica aqui,
 *  sempre à direita, e ao lado dele só um segundo "+ Adicionar…" quando a barra de cima já tem o principal. Os
 *  separadores (`Tabs`) dão o lugar; as tabelas (`DataTable` com `barraFora`) põem lá os botões. */
export const FaixaAbas = createContext<{ el: HTMLElement | null; set: (el: HTMLElement | null) => void } | null>(null);

/** Linha de cima do cartão principal (Silva, 20/10/2026): a indicação do domínio ("Domínio: x · muda-se no seletor…") à
 *  esquerda e, à direita, o botão da página (o que estava na barra de cima) ou, nas páginas sem botão mas com caixas de
 *  seleção, o "Ações". Páginas sem nenhum dos dois não têm esta linha. O cartão dá o lugar (`el`); `temBotao` diz se a
 *  página já traz o seu botão; `dominios`/`dominioUrl` são os do seletor, para a indicação mostrar o mesmo domínio. */
export const TopoCartao = createContext<{
  el: HTMLElement | null;
  /** os separadores (`Tabs`) põem o lugar logo por baixo da faixa deles */
  setTabs: (el: HTMLElement | null) => void;
  temBotao: boolean;
  /** a página põe ela própria o seu botão na linha (corpo da página): as tabelas deixam o "Ações" onde estava */
  setOcupado: (v: boolean) => void;
  dominios?: 'sites';
  dominioUrl?: { d: string; ir: (novo: string) => string };
} | null>(null);

/** Um resultado da lupa da barra de cima (pesquisa na página aberta) */
export type ItemPesquisa = { k: string; txt: string; sub?: string; fa?: string; c?: string; ir: () => void };
/** Lupa da barra de cima (pedido do Silva, 13/10/2026): procura na página aberta — cada tabela (DataTable) regista aqui
 *  as suas linhas; devolve a função que tira o registo. */
export const PesquisaPagina = createContext<{ registar: (id: string, fonte: () => ItemPesquisa[]) => () => void } | null>(null);

export function useVH(): VH {
  const vh = useContext(VHContext);
  if (!vh) throw new Error('useVH fora do VisualHostApp');
  return vh;
}

/** Pesquisa posta pela tabela da página na linha por baixo do título do cartão, à esquerda (Silva, 22/10/2026: DNS, como Domínios).
 *  A tabela (`DataTable pesqCabecalho`) liga-a e filtra pelo texto; a linha do cartão (NoTopoCartao `modelo`) desenha a caixa. */
export const ConsultaPagina = createContext<{ q: string; setQ: (v: string) => void; ativo: boolean; ativar: (v: boolean) => void } | null>(null);
