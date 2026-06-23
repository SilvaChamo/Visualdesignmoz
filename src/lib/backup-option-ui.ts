/** Checkbox compacto para opções de backup — 4 colunas, altura mínima. */
export const backupOptionGrid = 'grid grid-cols-2 gap-1.5 sm:grid-cols-4'

export const backupOptionChip = [
  'flex min-h-0 cursor-pointer items-center gap-1.5 rounded border px-2 py-1.5 text-sm transition-colors',
  'border-gray-200 bg-transparent text-zinc-800 dark:border-zinc-700 dark:text-zinc-200',
  'hover:border-gray-300 dark:hover:border-zinc-600',
].join(' ')

/** Destaque suave — mesma família de contorno padrão do painel */
export const backupOptionChipActive =
  'border-gray-300 bg-gray-50/40 dark:border-zinc-600 dark:bg-zinc-800/30'

/** Modo de domínio: checkboxes horizontais */
export const backupDomainModeRow = 'flex flex-wrap items-center gap-5'

export const backupDomainModeLabel =
  'flex cursor-pointer items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300'

/** Lista de domínios: fundo suave a toda a largura do cartão (margem negativa no wrapper) */
export const backupDomainCurtainWrap = '-mx-6'

export const backupDomainSection =
  'border-y border-gray-200 bg-gray-100 py-3 dark:border-zinc-700 dark:bg-zinc-800/50'

export const backupDomainGrid = 'grid grid-cols-2 gap-x-4 gap-y-1.5 px-6 sm:grid-cols-4'

/** Cortina — desliza para baixo ao seleccionar domínios */
export const backupDomainCurtain =
  'grid transition-[grid-template-rows] duration-300 ease-out'

export const backupDomainCurtainOpen = 'grid-rows-[1fr]'

export const backupDomainCurtainClosed = 'grid-rows-[0fr]'

export const backupDomainItem =
  'flex min-h-0 cursor-pointer items-center gap-2 py-1 text-sm text-zinc-800 dark:text-zinc-200'

export const backupDomainItemStatic =
  'flex min-h-0 items-center gap-2 py-1 text-sm text-zinc-600 dark:text-zinc-400'
