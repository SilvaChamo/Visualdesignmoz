'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RefreshCw, Search, Send, LayoutTemplate, X, MoreVertical, Plus, Eye, EyeOff, RotateCcw, Check, Merge } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { RichTextEditor } from '@/components/RichTextEditor';
import { EmailTemplates } from '@/components/admin/EmailTemplates';
import { useAdminSectionChrome } from '@/components/admin/AdminSectionChrome';
import { panelField, panelBtnPrimary, panelBtnSecondary } from '@/lib/panel-ui';
import { Spinner } from '@/components/ui/spinner';

interface EncomendaCliente {
  userId: string;
  email: string;
  responsavel: string;
  empresa: string;
  encomendas: number;
  firstCreatedAt: string;
  lastCreatedAt: string;
}

// Divide um nome completo em Nome/Apelido (primeira palavra vs. resto) —
// mesma heurística usada no modal de edição em HostingSections.tsx.
function splitName(fullName: string): { nome: string; apelido: string } {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { nome: '', apelido: '' };
  if (parts.length === 1) return { nome: parts[0], apelido: '' };
  return { nome: parts[0], apelido: parts.slice(1).join(' ') };
}

export function EncomendasClientesSection({ isActive }: { isActive: boolean }) {
  const [clientes, setClientes] = useState<EncomendaCliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showComposer, setShowComposer] = useState(false);
  const [openMenu, setOpenMenu] = useState<{ userId: string; rect: DOMRect } | null>(null);
  const [accountModal, setAccountModal] = useState<{ mode: 'create' | 'edit'; cliente: EncomendaCliente | null } | null>(null);
  const [mergeModal, setMergeModal] = useState<[EncomendaCliente, EncomendaCliente] | null>(null);

  const { setChrome } = useAdminSectionChrome();
  useEffect(() => {
    if (!isActive) return;
    setChrome({ description: 'Contas de clientes que já submeteram encomendas — seleccione para enviar mailmarketing.' });
    return () => setChrome(null);
  }, [isActive, setChrome]);

  const fetchClientes = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/cotacoes/clientes');
      const data = await res.json();
      if (data.success) setClientes(data.clientes);
      else toast.error(data.error || 'Erro ao carregar clientes');
    } catch {
      toast.error('Erro ao carregar clientes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (isActive) fetchClientes(); }, [isActive]);

  const filtered = clientes.filter((c) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      c.email?.toLowerCase().includes(term) ||
      c.responsavel?.toLowerCase().includes(term) ||
      c.empresa?.toLowerCase().includes(term)
    );
  });

  const allSelected = filtered.length > 0 && filtered.every((c) => selectedIds.includes(c.userId));
  const toggleSelectAll = () => {
    setSelectedIds((prev) =>
      allSelected ? prev.filter((id) => !filtered.some((c) => c.userId === id)) : [...new Set([...prev, ...filtered.map((c) => c.userId)])],
    );
  };
  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const selectedEmails = clientes.filter((c) => selectedIds.includes(c.userId)).map((c) => c.email).filter(Boolean);

  const handleAccountSaved = (cliente: EncomendaCliente, mode: 'create' | 'edit') => {
    setClientes((prev) => {
      if (mode === 'create') return [cliente, ...prev];
      return prev.map((c) => (c.userId === cliente.userId ? { ...c, ...cliente } : c));
    });
    setAccountModal(null);
  };

  const handleDelete = async (cliente: EncomendaCliente) => {
    const aviso = cliente.encomendas > 0
      ? `Eliminar a conta de "${cliente.responsavel || cliente.email}"? Isto elimina também as ${cliente.encomendas} encomenda(s) associada(s). Esta acção é irreversível.`
      : `Eliminar a conta de "${cliente.responsavel || cliente.email}"? Esta acção é irreversível.`;
    if (!window.confirm(aviso)) return;

    try {
      const res = await fetch(`/api/admin/cotacoes/clientes?userId=${encodeURIComponent(cliente.userId)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Erro ao eliminar conta');
      toast.success('Conta eliminada.');
      setClientes((prev) => prev.filter((c) => c.userId !== cliente.userId));
      setSelectedIds((prev) => prev.filter((id) => id !== cliente.userId));
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao eliminar conta');
    }
  };

  const handleMerge = async (keep: EncomendaCliente, merge: EncomendaCliente) => {
    try {
      const res = await fetch('/api/admin/cotacoes/clientes/fundir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keepUserId: keep.userId, mergeUserId: merge.userId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Erro ao fundir contas');
      toast.success('Contas fundidas.');
      setMergeModal(null);
      setSelectedIds([]);
      fetchClientes();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao fundir contas');
    }
  };

  const handleEntrar = async (cliente: EncomendaCliente) => {
    try {
      const res = await fetch('/api/admin/cotacoes/clientes/entrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: cliente.userId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Erro ao entrar na conta');
      window.location.href = '/encomendas';
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao entrar na conta');
    }
  };

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Pesquisar por nome, empresa ou email..."
            className="pl-9 h-9"
          />
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.length === 2 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const [a, b] = clientes.filter((c) => selectedIds.includes(c.userId));
                if (a && b) setMergeModal([a, b]);
              }}
              className="h-9 border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-900/50 dark:text-amber-400 dark:hover:bg-amber-950/30 rounded-md"
            >
              <Merge className="w-4 h-4 mr-2" />
              Fundir contas
            </Button>
          )}
          {selectedIds.length > 0 && (
            <Button
              size="sm"
              onClick={() => setShowComposer(true)}
              className="h-9 bg-black hover:bg-red-600 text-white rounded-md"
            >
              <Send className="w-4 h-4 mr-2" />
              Enviar campanha ({selectedIds.length})
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => setAccountModal({ mode: 'create', cliente: null })}
            className="h-9 bg-black hover:bg-red-600 text-white rounded-md"
          >
            <Plus className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Adicionar conta</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchClientes()}
            className="h-9 w-9 p-0 border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 rounded-md"
            title="Actualizar"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="border border-gray-200 dark:border-zinc-800 rounded-md bg-white dark:bg-zinc-900 overflow-hidden shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50/80 dark:bg-zinc-800/60 border-b border-gray-200 dark:border-zinc-800">
            <tr>
              <th className="px-5 py-2.5 w-8">
                <Checkbox checked={allSelected} onCheckedChange={toggleSelectAll} aria-label="Seleccionar todos" />
              </th>
              <th className="px-5 py-2.5 font-medium text-gray-500 dark:text-zinc-400">Cliente</th>
              <th className="px-5 py-2.5 font-medium text-gray-500 dark:text-zinc-400">Email</th>
              <th className="px-5 py-2.5 font-medium text-gray-500 dark:text-zinc-400">Encomendas</th>
              <th className="px-5 py-2.5 font-medium text-gray-500 dark:text-zinc-400">Última encomenda</th>
              <th className="px-5 py-2.5 w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
            {loading && (
              <tr>
                <td colSpan={6} className="px-5 py-6 text-center text-sm text-gray-400 dark:text-zinc-500">
                  <span className="inline-flex items-center justify-center gap-2"><Spinner /> A carregar...</span>
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-6 text-center text-sm text-gray-400 dark:text-zinc-500">Nenhum cliente encontrado.</td>
              </tr>
            )}
            {!loading && filtered.map((c) => (
              <tr key={c.userId} className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/40 transition-colors border-b border-gray-100 dark:border-zinc-800 last:border-0">
                <td className="px-5 py-2.5">
                  <Checkbox checked={selectedIds.includes(c.userId)} onCheckedChange={() => toggleSelectOne(c.userId)} aria-label={`Seleccionar ${c.email}`} />
                </td>
                <td className="px-5 py-2.5 font-medium text-gray-900 dark:text-white">
                  {c.responsavel || c.empresa || '—'}
                  {c.empresa && c.responsavel && <span className="block text-xs text-gray-400 dark:text-zinc-500 font-normal">{c.empresa}</span>}
                </td>
                <td className="px-5 py-2.5 text-gray-700 dark:text-zinc-300">{c.email}</td>
                <td className="px-5 py-2.5">
                  <span className="px-2.5 py-1 bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 rounded-full text-xs font-medium">
                    {c.encomendas} {c.encomendas === 1 ? 'encomenda' : 'encomendas'}
                  </span>
                </td>
                <td className="px-5 py-2.5 text-gray-500 dark:text-zinc-400">
                  {c.encomendas > 0 ? new Date(c.lastCreatedAt).toLocaleDateString('pt-PT') : '—'}
                </td>
                <td className="px-5 py-2.5 text-right">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const rect = e.currentTarget.getBoundingClientRect();
                      setOpenMenu((prev) => (prev?.userId === c.userId ? null : { userId: c.userId, rect }));
                    }}
                    className="inline-flex rounded border border-gray-200 p-1.5 text-zinc-600 transition-colors hover:border-red-300 hover:text-red-600 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-red-800 dark:hover:bg-transparent dark:hover:text-red-400"
                    aria-label="Mais opções"
                  >
                    <MoreVertical size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {openMenu && (() => {
        const c = filtered.find((x) => x.userId === openMenu.userId);
        if (!c) return null;
        return (
          <RowActionsMenu
            anchorRect={openMenu.rect}
            items={[
              { id: 'edit', label: 'Editar' },
              { id: 'delete', label: 'Eliminar', danger: true },
              { id: 'entrar', label: 'Entrar' },
            ]}
            onAction={(action) => {
              if (action === 'edit') setAccountModal({ mode: 'edit', cliente: c });
              else if (action === 'delete') handleDelete(c);
              else if (action === 'entrar') handleEntrar(c);
            }}
            onClose={() => setOpenMenu(null)}
          />
        );
      })()}

      {accountModal && (
        <AccountFormModal
          mode={accountModal.mode}
          cliente={accountModal.cliente}
          onClose={() => setAccountModal(null)}
          onSaved={handleAccountSaved}
        />
      )}

      {showComposer && (
        <CampaignComposerModal
          recipients={selectedEmails}
          onClose={() => setShowComposer(false)}
        />
      )}

      {mergeModal && (
        <MergeAccountsModal
          accounts={mergeModal}
          onClose={() => setMergeModal(null)}
          onConfirm={handleMerge}
        />
      )}
    </div>
  );
}

// Duas contas duplicadas da mesma pessoa — o admin escolhe qual fica; a
// outra é eliminada e as suas encomendas passam para a que ficou.
function MergeAccountsModal({
  accounts,
  onClose,
  onConfirm,
}: {
  accounts: [EncomendaCliente, EncomendaCliente];
  onClose: () => void;
  onConfirm: (keep: EncomendaCliente, merge: EncomendaCliente) => void;
}) {
  const [keepId, setKeepId] = useState(accounts[0].userId);
  const [confirming, setConfirming] = useState(false);
  const keep = accounts.find((c) => c.userId === keepId)!;
  const merge = accounts.find((c) => c.userId !== keepId)!;

  return createPortal(
    <div className="fixed inset-0 bg-gray-900/40 dark:bg-black/60 z-[100] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl border border-gray-200 dark:border-zinc-800 w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-zinc-800">
          <h2 className="text-base font-bold text-gray-800 dark:text-white">Fundir contas duplicadas</h2>
          <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">Escolha qual conta fica — a outra é eliminada e as suas encomendas passam para a que ficar.</p>
        </div>

        <div className="p-6 space-y-2">
          {accounts.map((c) => (
            <button
              key={c.userId}
              type="button"
              onClick={() => setKeepId(c.userId)}
              className={`w-full text-left flex items-center gap-3 p-3 rounded-lg border transition-all ${
                keepId === c.userId
                  ? 'border-teal-400 bg-teal-50/50 dark:bg-teal-950/10 dark:border-teal-900/50'
                  : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300'
              }`}
            >
              <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${keepId === c.userId ? 'border-teal-500' : 'border-zinc-300'}`}>
                {keepId === c.userId && <div className="w-2 h-2 rounded-full bg-teal-500" />}
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm text-gray-900 dark:text-white truncate">{c.responsavel || c.email}</p>
                <p className="text-xs text-gray-500 dark:text-zinc-400 truncate">{c.email} · {c.encomendas} encomenda{c.encomendas === 1 ? '' : 's'}</p>
              </div>
              {keepId === c.userId && <span className="ml-auto shrink-0 text-[10px] font-bold text-teal-600 dark:text-teal-400 uppercase">Fica</span>}
            </button>
          ))}
        </div>

        <div className="px-6 py-4 bg-gray-50 dark:bg-zinc-800/50 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className={panelBtnSecondary} disabled={confirming}>Cancelar</button>
          <button
            type="button"
            onClick={async () => { setConfirming(true); await onConfirm(keep, merge); setConfirming(false); }}
            disabled={confirming}
            className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 py-2 rounded-md text-sm transition-colors disabled:opacity-60"
          >
            {confirming ? <Spinner className="w-3.5 h-3.5" /> : <Merge className="w-3.5 h-3.5" />}
            Fundir — eliminar "{merge.responsavel || merge.email}"
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

interface RowActionItem {
  id: string;
  label: string;
  danger?: boolean;
}

// Menu de acções por linha (3 pontinhos) — mesma configuração usada nas
// outras listas de contas do painel (ex.: ClientesDaSection), mas ao lado
// do botão (não por baixo) e centrado verticalmente com ele.
function RowActionsMenu({
  anchorRect,
  items,
  onAction,
  onClose,
}: {
  anchorRect: DOMRect;
  items: RowActionItem[];
  onAction: (id: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const menuW = 168;
  const estimatedH = items.length * 30 + 4;

  let top = anchorRect.top + anchorRect.height / 2 - estimatedH / 2;
  if (typeof window !== 'undefined') {
    top = Math.min(Math.max(8, top), window.innerHeight - estimatedH - 8);
  }

  let left = anchorRect.left - menuW;
  if (typeof window !== 'undefined' && left < 8) {
    left = anchorRect.right;
  }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onScroll = () => onClose();
    document.addEventListener('mousedown', handler);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('mousedown', handler);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      style={{ position: 'fixed', top, left, zIndex: 9999 }}
      className="font-panel w-max rounded border border-zinc-200 bg-white py-0.5 text-xs shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => { onAction(item.id); onClose(); }}
          className={`block w-full whitespace-nowrap text-left px-[15px] py-1.5 transition-colors hover:text-red-600 dark:hover:bg-transparent dark:hover:text-red-400 ${
            item.danger ? 'text-red-600 dark:text-red-400' : 'text-zinc-700 dark:text-zinc-200'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>,
    document.body,
  );
}

// Formulário vertical partilhado por "Adicionar conta" e "Editar conta":
// Nome | Apelido lado a lado, depois Email, Papel e Password, cada um a
// ocupar a largura total.
function AccountFormModal({
  mode,
  cliente,
  onClose,
  onSaved,
}: {
  mode: 'create' | 'edit';
  cliente: EncomendaCliente | null;
  onClose: () => void;
  onSaved: (cliente: EncomendaCliente, mode: 'create' | 'edit') => void;
}) {
  const initial = splitName(cliente?.responsavel || '');
  const [nome, setNome] = useState(initial.nome);
  const [apelido, setApelido] = useState(initial.apelido);
  const [email, setEmail] = useState(cliente?.email || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
    let p = '';
    for (let i = 0; i < 14; i++) p += chars.charAt(Math.floor(Math.random() * chars.length));
    setPassword(p);
    setShowPassword(true);
  };

  const handleSave = async () => {
    setError('');
    if (!email.trim() || !email.includes('@')) { setError('Email inválido.'); return; }
    if (mode === 'create' && password.length < 6) { setError('Password obrigatória (mínimo 6 caracteres).'); return; }
    if (password && password.length > 0 && password.length < 6) { setError('Password deve ter pelo menos 6 caracteres.'); return; }

    setSaving(true);
    try {
      if (mode === 'create') {
        const res = await fetch('/api/admin/cotacoes/clientes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nome, apelido, email, password }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Erro ao criar conta');
        toast.success('Conta criada.');
        onSaved(data.cliente, 'create');
      } else if (cliente) {
        const res = await fetch('/api/admin/cotacoes/clientes', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: cliente.userId, nome, apelido, email, password: password || undefined }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Erro ao editar conta');
        toast.success('Conta actualizada.');
        onSaved({ ...cliente, email, responsavel: `${nome} ${apelido}`.trim() }, 'edit');
      }
    } catch (err: any) {
      setError(err?.message || 'Erro ao guardar conta');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-gray-900/40 dark:bg-black/60 z-[100] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl border border-gray-200 dark:border-zinc-800 w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-zinc-800 flex items-center justify-between bg-gray-50 dark:bg-zinc-800/60">
          <h2 className="text-base font-bold text-gray-800 dark:text-white">
            {mode === 'create' ? 'Adicionar conta' : 'Editar conta'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-zinc-800 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Nome</label>
              <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="João" className={`w-full ${panelField}`} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Apelido</label>
              <input value={apelido} onChange={(e) => setApelido(e.target.value)} placeholder="Silva" className={`w-full ${panelField}`} />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="exemplo@email.com" className={`w-full ${panelField}`} />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Password</label>
            <div className="relative flex items-center gap-2">
              <button
                type="button"
                onClick={generatePassword}
                className="px-3 py-2 bg-transparent border border-green-500 text-green-600 dark:text-green-500 hover:bg-green-50 dark:hover:bg-zinc-800 rounded text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" /> Gerar
              </button>
              <div className="relative flex-1">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'edit' ? 'Alterar password...' : 'Definir password...'}
                  className={`w-full ${panelField} pr-9`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  title="Ver password"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {mode === 'edit' && (
              <p className="text-[9px] text-gray-400 mt-1 italic">Vazio = manter a password actual.</p>
            )}
          </div>

          {error && (
            <div className="px-4 py-2.5 rounded text-sm font-medium border bg-red-50 text-red-700 border-red-200">{error}</div>
          )}
        </div>

        <div className="px-6 py-4 bg-gray-50 dark:bg-zinc-800/50 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className={panelBtnSecondary}>Cancelar</button>
          <button type="button" onClick={handleSave} disabled={saving} className={panelBtnPrimary}>
            {saving ? <Spinner className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
            {mode === 'create' ? 'Criar conta' : 'Guardar alterações'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function CampaignComposerModal({ recipients, onClose }: { recipients: string[]; onClose: () => void }) {
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!subject.trim()) { toast.error('Escreva o assunto do email.'); return; }
    if (!content.trim()) { toast.error('Escreva o conteúdo da mensagem.'); return; }
    if (recipients.length === 0) { toast.error('Nenhum destinatário seleccionado.'); return; }

    setSending(true);
    try {
      const res = await fetch('/api/mailmarketing-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: recipients,
          subject,
          content,
          domain: 'visualdesignmoz.com',
          senderName: 'VisualDesign',
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error || 'Erro ao enviar campanha');
        return;
      }
      toast.success(`Campanha enfileirada para ${recipients.length} destinatário(s).`);
      onClose();
    } catch {
      toast.error('Erro ao enviar campanha');
    } finally {
      setSending(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-gray-900/40 dark:bg-black/60 z-[100] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl border border-gray-200 dark:border-zinc-800 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-zinc-800 flex items-center justify-between bg-gray-50 dark:bg-zinc-800/60">
          <div>
            <h2 className="text-base font-bold text-gray-800 dark:text-white">Enviar campanha</h2>
            <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">{recipients.length} destinatário(s) seleccionado(s)</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-zinc-800 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto space-y-4">
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Assunto do email" className="h-10" />

          <Button variant="outline" size="sm" onClick={() => setShowTemplates(true)} className="h-9">
            <LayoutTemplate className="w-4 h-4 mr-2" />
            Escolher template
          </Button>

          <RichTextEditor value={content} onChange={setContent} placeholder="Escreva o corpo do seu email aqui..." className="min-h-[350px]" />
        </div>

        <div className="px-6 py-4 border-t border-gray-200 dark:border-zinc-800 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={sending}>Cancelar</Button>
          <Button onClick={handleSend} disabled={sending} className="bg-black hover:bg-red-600 text-white">
            <Send className="w-4 h-4 mr-2" />
            {sending ? 'A enviar...' : 'Enviar'}
          </Button>
        </div>
      </div>

      {showTemplates && (
        <EmailTemplates
          onSelect={(html) => setContent(html)}
          onClose={() => setShowTemplates(false)}
          isAdminAccount
        />
      )}
    </div>,
    document.body,
  );
}
