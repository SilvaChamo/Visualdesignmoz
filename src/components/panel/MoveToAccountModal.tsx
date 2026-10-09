'use client';

import { useEffect, useState } from 'react';

/**
 * "Mover para outra conta" — o mesmo popup do "Mover domínio" da lista de
 * domínios do admin (HostingSections → transferOwnerModal), com a mesma
 * lista de contas (GET /api/admin/domains/transfer-owner). Quem chama decide
 * o que é movido (onMove recebe o email da conta de destino).
 */
export function MoveToAccountModal({
  title,
  subject,
  note,
  excludeEmail,
  onClose,
  onMove,
}: {
  title: string;
  /** O que vai ser movido (ex.: "concordia.co.mz — Email Básico"). */
  subject: string;
  note?: string;
  /** Conta actual — não aparece na lista. */
  excludeEmail?: string | null;
  onClose: () => void;
  onMove: (targetEmail: string) => Promise<void>;
}) {
  const [accounts, setAccounts] = useState<{ id: string; email: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [targetEmail, setTargetEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/domains/transfer-owner', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => { if (data.success) setAccounts(data.accounts || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const exclude = (excludeEmail || '').toLowerCase();

  const handleMove = async () => {
    if (!targetEmail) return;
    setSaving(true);
    setError('');
    try {
      await onMove(targetEmail);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Não foi possível mover.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-lg border border-gray-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="mb-1 text-sm font-bold text-gray-900 dark:text-zinc-100">{title}</h3>
        <p className="mb-2 text-xs text-gray-500 dark:text-zinc-400">
          <span className="font-mono">{subject}</span> passa a pertencer à conta escolhida abaixo.
        </p>
        {note && (
          <p className="mb-4 rounded bg-amber-50 px-2.5 py-2 text-[11px] leading-relaxed text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            {note}
          </p>
        )}
        <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-gray-400">Conta de destino</label>
        <select
          value={targetEmail}
          onChange={(e) => setTargetEmail(e.target.value)}
          disabled={loading}
          className="mb-4 w-full rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        >
          <option value="">{loading ? 'A carregar contas…' : 'Escolher conta…'}</option>
          {accounts
            .filter((a) => a.email.toLowerCase() !== exclude)
            .map((a) => (
              <option key={a.id} value={a.email}>{a.email}</option>
            ))}
        </select>
        {error && <p className="mb-3 text-xs text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm font-semibold text-gray-500 hover:text-gray-700 dark:text-zinc-400"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void handleMove()}
            disabled={saving || !targetEmail}
            className="rounded bg-red-600 px-3 py-1.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {saving ? 'A mover...' : 'Mover'}
          </button>
        </div>
      </div>
    </div>
  );
}
