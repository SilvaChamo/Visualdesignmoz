/** Altura única para botões e campos do painel. */
export const panelControlHeight = 'h-[38px]';

/** Botões e campos alinhados com DNS Central (rounded, altura fixa). */
export const panelBtn =
  `inline-flex items-center justify-center gap-1.5 px-4 rounded text-sm font-medium shrink-0 transition-colors disabled:opacity-50 ${panelControlHeight}`;

/** Tema claro: fundo transparente com a cor; escuro: transparente + hover vermelho. */
export const panelBtnPrimary =
  `${panelBtn} border border-red-300 bg-red-600/10 text-red-600 hover:bg-red-600/15 dark:border-red-500/40 dark:bg-red-600/10 dark:text-red-400 dark:hover:bg-red-600/15 dark:hover:text-red-300`;

export const panelBtnSecondary =
  `${panelBtn} border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-red-400`;

export const panelField =
  `${panelControlHeight} px-3 rounded border border-gray-300 text-sm bg-white text-gray-900 focus:outline-none focus:border-red-500`;
