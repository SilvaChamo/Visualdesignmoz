// Traduções e cores de badge para o status de uma encomenda (quotation_requests),
// partilhado entre o painel do cliente (/encomendas) e o admin.
export const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  // 'pending' normalmente significa que já pode pagar (preço já fixo) — só
  // itens Sob Consulta é que realmente esperam contacto da equipa antes de
  // haver algo para pagar (ver PENDING_SOB_CONSULTA abaixo).
  pending: { label: 'Aguarda pagamento', color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/30' },
  payment_selected: { label: 'Pagamento em confirmação', color: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/30' },
  approved: { label: 'Em produção', color: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/30 dark:text-teal-400 dark:border-teal-900/30' },
  // Pronta para levantamento — falta o cliente pagar o remanescente (25%).
  delivered: { label: 'Concluída', color: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-900/30' },
  rejected: { label: 'Não aprovada', color: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900/30' },
  // Estado final — remanescente já confirmado, nada fica por fazer.
  done: { label: 'Entregue', color: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-900/30' },
  cancelled: { label: 'Cancelada', color: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700' },
};

const PENDING_SOB_CONSULTA = { label: 'Aguarda contacto', color: STATUS_LABELS.pending.color };

export function statusMeta(status: string, sobConsulta = false) {
  if (status === 'pending' && sobConsulta) return PENDING_SOB_CONSULTA;
  return STATUS_LABELS[status] || { label: status, color: 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700' };
}

/**
 * Estado agregado de uma encomenda (todas as linhas do mesmo batch_id) —
 * usado para a mostrar como "uma coisa só" nas listas, apesar de cada linha
 * ter o seu próprio estado real. Cancelled/rejected nunca bloqueiam a
 * conclusão: só contam os itens ainda activos.
 *
 * Ordem (do mais avançado para o menos): done ("Entregue" — remanescente já
 * pago, nada por fazer) > delivered ("Concluída" — pronta, falta o
 * remanescente nalgum item) > approved (em produção) > payment_selected
 * (pago) > rejected > pending.
 */
export function computeBatchStatus(items: { status: string }[]): string {
  if (items.length === 0) return 'pending';
  if (items.every((i) => i.status === 'cancelled')) return 'cancelled';

  const active = items.filter((i) => i.status !== 'cancelled');
  if (active.length > 0 && active.every((i) => i.status === 'done')) return 'done';
  if (active.length > 0 && active.every((i) => i.status === 'done' || i.status === 'delivered')) return 'delivered';
  if (active.some((i) => i.status === 'approved')) return 'approved';
  if (active.some((i) => i.status === 'payment_selected')) return 'payment_selected';
  if (active.some((i) => i.status === 'rejected')) return 'rejected';
  return 'pending';
}

/** Atalho de estado do menu admin em que uma encomenda deve aparecer. */
export type StatusBucket = 'pending' | 'approved' | 'delivered' | 'rejected' | 'cancelled' | 'done';

// 'rejected' (a equipa recusou a negociação) e 'cancelled' (o cliente
// desistiu) são coisas diferentes — antes ficavam juntas no mesmo balde
// "Canceladas", confundindo quem precisa de acompanhar rejeições. Agora cada
// uma tem o seu próprio menu na barra lateral.
const BUCKET_ALIAS: Record<string, StatusBucket> = {
  pending: 'pending',
  payment_selected: 'pending',
  approved: 'approved',
  delivered: 'delivered',
  rejected: 'rejected',
  cancelled: 'cancelled',
  done: 'done',
};

export function statusBucket(status: string): StatusBucket {
  return BUCKET_ALIAS[status] || 'pending';
}
