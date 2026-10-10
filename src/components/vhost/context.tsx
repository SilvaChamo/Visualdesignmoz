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
  hasFeat: (f?: string) => boolean;
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
  setDominio: (d: string) => void;
  setBrand: (b: { name: string; logo: string }) => void;
  openSearch: () => void;
  logout: () => void;
}

export const VHContext = createContext<VH | null>(null);

export function useVH(): VH {
  const vh = useContext(VHContext);
  if (!vh) throw new Error('useVH fora do VisualHostApp');
  return vh;
}
