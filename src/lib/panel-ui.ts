/** Altura única para botões e campos do painel. */
export const panelControlHeight = 'h-[38px]';

/** Topo da shell: logo 44px + padding vertical 32px — sidebar e cabeçalho alinhados. */
export const panelShellHeaderHeight = 'h-[76px]';
export const panelShellHeaderHeightLg = 'lg:h-[76px]';

/** Botões e campos alinhados com DNS Central (rounded, altura fixa). */
export const panelBtn =
  `inline-flex items-center justify-center gap-1.5 px-4 rounded text-sm font-medium shrink-0 transition-colors disabled:opacity-50 ${panelControlHeight}`;

/** Escuro: estilo Vercel — transparente, borda neutra, hover só texto vermelho. */
const panelBtnDark =
  'dark:border-zinc-700 dark:bg-transparent dark:text-zinc-300 dark:hover:bg-transparent dark:hover:text-red-400';

/** Tema claro: fundo transparente com a cor. */
export const panelBtnPrimary =
  `${panelBtn} border border-red-300 bg-red-600/10 text-red-600 hover:bg-red-600/15 ${panelBtnDark}`;

export const panelBtnSecondary =
  `${panelBtn} border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 ${panelBtnDark}`;

export const panelField =
  `${panelControlHeight} px-3 rounded border border-gray-300 text-sm bg-white text-gray-900 focus:outline-none focus:border-red-500 dark:border-zinc-700 dark:bg-transparent dark:text-zinc-100`;

/** Cartões do painel — mesmo arredondamento do dashboard (`rounded-xl`). */
export const panelCard =
  'rounded-xl border border-gray-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900';

/** Grelha de ferramentas do dashboard — 2 colunas em mobile, mais em ecrãs grandes. */
export const panelDashboardGrid =
  'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4';

/** Variante compacta (ícones pequenos no dashboard tipo cPanel). */
export const panelDashboardGridCompact =
  'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-3';

/** Cartão de ferramenta do dashboard — contorno suave visível em fundo branco. */
export const panelDashboardToolCard =
  'relative group flex flex-col items-center justify-center p-3 md:p-5 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300 transition-all cursor-pointer h-full min-h-[96px] md:min-h-[130px] dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600';

/** Cartão compacto de ferramenta (dashboard cPanel). */
export const panelDashboardToolCardCompact =
  'dashboard-tool flex flex-col items-center gap-2 p-3 rounded-lg border border-gray-200 bg-white transition-all group text-center hover:bg-gray-50 hover:border-gray-300 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600 dark:hover:bg-zinc-800/50';

/** Lista de tabs — sem padding horizontal; espaçamento 20px; cada tab com sublinhado próprio. */
export const panelTabList = 'flex flex-wrap items-end gap-5';

/** Botão de tab — sublinhado activo à largura do texto (sem padding horizontal). */
export const panelTabBtn =
  'py-2.5 text-sm font-medium border-b-2 border-transparent transition-colors whitespace-nowrap';

/** Rótulo dos cartões de ferramenta no dashboard. */
export const panelDashboardToolLabel =
  'text-sm font-medium leading-tight text-gray-600 dark:text-zinc-400 group-hover:dark:text-red-400';

/** Padding das secções do dashboard em mobile vs desktop. */
export const panelSectionPadding = 'p-4 md:p-6';

/**
 * Cartão de secção — listagens e configurações do painel.
 * Arredondamento `rounded` (alinhado a Contas, Hospedagem, permissões).
 */
export const panelSectionCard =
  'rounded border border-gray-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900';

/** Grupo acordeão (permissões, submenus configuráveis). */
export const panelMenuGroupCard =
  'overflow-hidden rounded border border-gray-200 bg-white dark:border-zinc-700 dark:bg-zinc-900';

export const panelMenuGroupHeader =
  'flex items-center justify-between gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-800/50';

export const panelMenuGroupBody =
  'space-y-0.5 bg-white px-2 py-2 dark:bg-zinc-900';

/** Linha de opção dentro de um grupo (toggle, sub-item). */
export const panelMenuSubRow =
  'flex items-center justify-between gap-3 rounded px-3 py-2 hover:bg-gray-50 dark:hover:bg-zinc-800/30';

/** Ícone em cabeçalho de secção (escudo, etc.). */
export const panelSectionIconBadge =
  'flex h-10 w-10 items-center justify-center rounded border border-red-200 bg-red-50 text-red-600 dark:border-red-900/40 dark:bg-red-950/30';

/** Tab activa / inactiva — usar com `panelTabBtn`. */
export const panelTabBtnActive =
  'z-10 border-b-red-600 text-red-600 dark:border-b-red-500 dark:text-red-400';

export const panelTabBtnInactive =
  'border-transparent text-gray-500 hover:text-gray-700 dark:text-zinc-400 dark:hover:text-zinc-200';

/** Lista de tabs com linha inferior full-width. */
export const panelTabBar = 'w-full border-b border-gray-200 dark:border-zinc-800';

/** Grelha interna — 1 coluna no mobile, multi-coluna no desktop. */
export const panelMobileCardGrid = 'grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3';

/** Detalhe dentro de card — alinhado à esquerda. */
export const panelInnerDetailCard =
  'rounded-lg border border-gray-200 bg-gray-50 p-3 text-left min-h-[4.75rem] box-border dark:border-zinc-700 dark:bg-zinc-800/50';

/** Card de lista — coluna vertical à esquerda no mobile. */
export const panelMobileStackCard =
  'flex flex-col items-stretch gap-3 rounded-lg border border-gray-200 bg-white p-4 text-left shadow-sm dark:border-zinc-700 dark:bg-zinc-900 md:flex-row md:items-center';

/** Stack vertical mobile (toolbar, filtros, acções). */
export const panelMobileStack = 'flex flex-col items-stretch gap-3 md:flex-row md:items-center md:gap-4';

/** Linha de botões — coluna à esquerda no mobile. */
export const panelMobileActions =
  'flex flex-col items-stretch gap-2 w-full md:flex-row md:flex-wrap md:items-center md:gap-2 md:w-auto';
