'use client';

import { useEffect, useRef, useState } from 'react';
import { Send, MessageSquare, Paperclip, X, FileText, Layers, Check, Download } from 'lucide-react';
import { panelField, panelBtnPrimary, panelBtnSecondary } from '@/lib/panel-ui';
import { Spinner } from '@/components/ui/spinner';

type Message = {
  id: string;
  sender_role: 'client' | 'admin';
  message: string | null;
  attachment_url: string | null;
  attachment_name: string | null;
  attachment_type: 'image' | 'pdf' | null;
  created_at: string;
};

type LayoutStatus = 'pending' | 'approved' | 'rejected' | 'changes_requested';

type Layout = {
  id: string;
  fase: number;
  descricao: string;
  file_name: string;
  file_url: string;
  file_size_bytes: number | null;
  status: LayoutStatus;
  client_feedback: string | null;
  created_at: string;
};

// Ficheiros enviados antes desta conversa unificada existir (aba "Anexos",
// já removida) — só leitura, para não desaparecerem do histórico.
type LegacyAttachment = {
  id: string;
  uploaded_by_role: 'client' | 'admin';
  file_name: string;
  file_url: string;
  file_size_bytes: number | null;
  created_at: string;
};

type ThreadItem =
  | { kind: 'message'; at: string; data: Message }
  | { kind: 'layout'; at: string; data: Layout }
  | { kind: 'legacy'; at: string; data: LegacyAttachment };

const LAYOUT_STATUS_LABELS: Record<LayoutStatus, { label: string; color: string }> = {
  pending: { label: 'Aguarda aprovação', color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/30' },
  approved: { label: 'Aprovado', color: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/30 dark:text-teal-400 dark:border-teal-900/30' },
  changes_requested: { label: 'Correcções pedidas', color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/30' },
  rejected: { label: 'Rejeitado', color: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900/30' },
};

const POLL_INTERVAL_MS = 8000;
const ACCEPTED_TYPES = 'application/pdf,image/jpeg,image/png';

function formatBytes(bytes: number | null): string {
  if (!bytes) return '';
  const units = ['B', 'KB', 'MB'];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v < 10 && i > 0 ? v.toFixed(1) : Math.round(v)} ${units[i]}`;
}

function isImageFile(name: string): boolean {
  return /\.(jpe?g|png)$/i.test(name);
}

export function QuotationMessagesThread({
  quotationId,
  viewerRole,
  onSent,
}: {
  quotationId: string;
  viewerRole: 'client' | 'admin';
  onSent?: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [layouts, setLayouts] = useState<Layout[]>([]);
  const [legacyAttachments, setLegacyAttachments] = useState<LegacyAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [lightbox, setLightbox] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Admin: em vez de um anexo comum, pode enviar o ficheiro como um novo
  // "Layout" (fase nova, com descrição, sujeito a aprovação do cliente).
  const [layoutMode, setLayoutMode] = useState(false);
  const [layoutDescricao, setLayoutDescricao] = useState('');
  const layoutFileInputRef = useRef<HTMLInputElement>(null);

  // Decisão do cliente sobre um layout pendente (aprovar / corrigir / rejeitar)
  const [decidingLayoutId, setDecidingLayoutId] = useState<string | null>(null);
  const [feedbackFor, setFeedbackFor] = useState<{ layoutId: string; kind: 'rejected' | 'changes_requested' } | null>(null);
  const [feedbackText, setFeedbackText] = useState('');

  const fetchAll = async () => {
    try {
      const [msgRes, layoutRes, anexosRes] = await Promise.all([
        fetch(`/api/cotacoes/${quotationId}/mensagens`),
        fetch(`/api/cotacoes/${quotationId}/layouts`),
        fetch(`/api/cotacoes/${quotationId}/anexos`),
      ]);
      const msgData = await msgRes.json();
      const layoutData = await layoutRes.json();
      const anexosData = await anexosRes.json();
      if (msgData.success) setMessages(msgData.mensagens);
      if (layoutData.success) setLayouts(layoutData.layouts);
      if (anexosData.success) setLegacyAttachments(anexosData.anexos);
    } catch {
      /* silencioso — próximo poll tenta de novo */
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchAll().finally(() => setLoading(false));
    const interval = setInterval(fetchAll, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quotationId]);

  const items: ThreadItem[] = [
    ...messages.map((m) => ({ kind: 'message' as const, at: m.created_at, data: m })),
    ...layouts.map((l) => ({ kind: 'layout' as const, at: l.created_at, data: l })),
    ...legacyAttachments.map((a) => ({ kind: 'legacy' as const, at: a.created_at, data: a })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [items.length]);

  const handlePickFile = (file: File | null) => {
    if (!file) return;
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) {
      setError('Só são aceites ficheiros PDF, JPEG ou PNG.');
      return;
    }
    setError('');
    setPendingFile(file);
  };

  const handleSend = async () => {
    const text = draft.trim();
    if ((!text && !pendingFile) || sending) return;
    setSending(true);
    setError('');
    try {
      let res: Response;
      if (pendingFile) {
        const formData = new FormData();
        if (text) formData.append('message', text);
        formData.append('file', pendingFile);
        res = await fetch(`/api/cotacoes/${quotationId}/mensagens`, { method: 'POST', body: formData });
      } else {
        res = await fetch(`/api/cotacoes/${quotationId}/mensagens`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text }),
        });
      }
      const data = await res.json();
      if (res.ok && data.success) {
        setMessages((prev) => [...prev, data.mensagem]);
        setDraft('');
        setPendingFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        onSent?.();
      } else {
        setError(data.error || 'Não foi possível enviar.');
      }
    } catch {
      setError('Não foi possível enviar. Tente novamente.');
    } finally {
      setSending(false);
    }
  };

  const handleSendLayout = async (file: File | null) => {
    if (!file || !layoutDescricao.trim() || sending) return;
    setSending(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('descricao', layoutDescricao.trim());
      if (draft.trim()) formData.append('mensagem', draft.trim());
      const res = await fetch(`/api/cotacoes/${quotationId}/layouts`, { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Falha no envio.');
      setLayouts((prev) => [...prev, data.layout]);
      if (draft.trim()) fetchAll(); // a mensagem associada já foi criada no servidor
      setLayoutDescricao('');
      setDraft('');
      setLayoutMode(false);
      if (layoutFileInputRef.current) layoutFileInputRef.current.value = '';
      onSent?.();
    } catch (err: any) {
      setError(err.message || 'Não foi possível enviar o layout.');
    } finally {
      setSending(false);
    }
  };

  const handleLayoutDecision = async (layoutId: string, status: 'approved' | 'rejected' | 'changes_requested', feedback?: string) => {
    if (decidingLayoutId) return;
    if ((status === 'rejected' || status === 'changes_requested') && !feedback?.trim()) {
      setError('Descreva o que precisa de ser corrigido.');
      return;
    }
    setDecidingLayoutId(layoutId);
    setError('');
    try {
      const res = await fetch(`/api/cotacoes/${quotationId}/layouts/${layoutId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, feedback: feedback?.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Não foi possível registar a sua decisão.');
      setLayouts((prev) => prev.map((l) => (l.id === layoutId ? data.layout : l)));
      setFeedbackFor(null);
      setFeedbackText('');
      onSent?.();
    } catch (err: any) {
      setError(err.message || 'Não foi possível registar a sua decisão.');
    } finally {
      setDecidingLayoutId(null);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-[320px]">
      <div className="flex-1 overflow-y-auto space-y-3 p-1">
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-gray-400 dark:text-zinc-500"><Spinner /> A carregar conversa...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-zinc-500 flex items-center gap-1.5">
            <MessageSquare className="w-4 h-4" />
            Ainda sem mensagens — escreva à equipa sobre esta encomenda.
          </p>
        ) : (
          items.map((item) => {
            if (item.kind === 'message') {
              const m = item.data;
              const isOwn = m.sender_role === viewerRole;
              return (
                <div key={`m-${m.id}`} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                      isOwn ? 'bg-red-600 text-white' : 'bg-gray-100 dark:bg-zinc-800 text-gray-800 dark:text-zinc-200'
                    }`}
                  >
                    {m.attachment_url && (
                      m.attachment_type === 'image' ? (
                        <button
                          type="button"
                          onClick={() => setLightbox(m.attachment_url)}
                          className="block mb-1.5 overflow-hidden rounded"
                        >
                          <img src={m.attachment_url} alt={m.attachment_name || 'Anexo'} className="max-h-52 w-auto rounded" />
                        </button>
                      ) : (
                        <a
                          href={m.attachment_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`mb-1.5 flex items-center gap-2 rounded p-2 ${isOwn ? 'bg-red-700/50' : 'bg-white dark:bg-zinc-900'}`}
                        >
                          <FileText className="w-5 h-5 shrink-0" />
                          <span className="truncate text-xs font-medium">{m.attachment_name}</span>
                          <Download className="w-3.5 h-3.5 shrink-0 ml-auto" />
                        </a>
                      )
                    )}
                    {m.message && <p className="whitespace-pre-line">{m.message}</p>}
                    <p className={`text-[10px] mt-1 ${isOwn ? 'text-red-100' : 'text-gray-400 dark:text-zinc-500'}`}>
                      {m.sender_role === 'client' ? 'Cliente' : 'Equipa'} · {new Date(m.created_at).toLocaleString('pt-PT')}
                    </p>
                  </div>
                </div>
              );
            }

            if (item.kind === 'legacy') {
              const a = item.data;
              const isOwn = a.uploaded_by_role === viewerRole;
              const isImage = isImageFile(a.file_name);
              return (
                <div key={`a-${a.id}`} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${isOwn ? 'bg-red-600 text-white' : 'bg-gray-100 dark:bg-zinc-800 text-gray-800 dark:text-zinc-200'}`}>
                    {isImage ? (
                      <button type="button" onClick={() => setLightbox(a.file_url)} className="block mb-1.5 overflow-hidden rounded">
                        <img src={a.file_url} alt={a.file_name} className="max-h-52 w-auto rounded" />
                      </button>
                    ) : (
                      <a
                        href={a.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center gap-2 rounded p-2 ${isOwn ? 'bg-red-700/50' : 'bg-white dark:bg-zinc-900'}`}
                      >
                        <FileText className="w-5 h-5 shrink-0" />
                        <span className="truncate text-xs font-medium">{a.file_name}</span>
                        <Download className="w-3.5 h-3.5 shrink-0 ml-auto" />
                      </a>
                    )}
                    <p className={`text-[10px] mt-1 ${isOwn ? 'text-red-100' : 'text-gray-400 dark:text-zinc-500'}`}>
                      {a.uploaded_by_role === 'client' ? 'Cliente' : 'Equipa'} · {new Date(a.created_at).toLocaleString('pt-PT')}
                    </p>
                  </div>
                </div>
              );
            }

            const l = item.data;
            const isImage = isImageFile(l.file_name);
            return (
              <div key={`l-${l.id}`} className="flex justify-start">
                <div className="max-w-[85%] w-full sm:w-auto rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="w-6 h-6 rounded-full bg-red-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                      {l.fase}
                    </span>
                    <p className="text-xs font-bold uppercase text-gray-400 dark:text-zinc-500">Fase {l.fase} — Layout</p>
                  </div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white mb-2">{l.descricao}</p>

                  {isImage ? (
                    <button type="button" onClick={() => setLightbox(l.file_url)} className="block mb-2 overflow-hidden rounded">
                      <img src={l.file_url} alt={l.descricao} className="max-h-52 w-auto rounded" />
                    </button>
                  ) : (
                    <a
                      href={l.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mb-2 flex items-center gap-2 rounded p-2 bg-gray-50 dark:bg-zinc-800"
                    >
                      <Layers className="w-5 h-5 shrink-0 text-red-500" />
                      <span className="truncate text-xs font-medium text-gray-700 dark:text-zinc-300">{l.file_name}</span>
                      {l.file_size_bytes ? <span className="text-[10px] text-gray-400 shrink-0">{formatBytes(l.file_size_bytes)}</span> : null}
                      <Download className="w-3.5 h-3.5 shrink-0 ml-auto text-gray-400" />
                    </a>
                  )}

                  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${LAYOUT_STATUS_LABELS[l.status].color}`}>
                    {LAYOUT_STATUS_LABELS[l.status].label}
                  </span>

                  {l.status !== 'pending' && l.client_feedback && (
                    <p className="mt-2 text-xs text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/30 rounded-md p-2">
                      <span className="font-bold">Correcções pedidas:</span> {l.client_feedback}
                    </p>
                  )}

                  {viewerRole === 'client' && l.status === 'pending' && (
                    <div className="mt-2 space-y-2">
                      {feedbackFor?.layoutId === l.id ? (
                        <div className="space-y-2">
                          <textarea
                            value={feedbackText}
                            onChange={(e) => setFeedbackText(e.target.value)}
                            placeholder="Descreva o que precisa de ser corrigido..."
                            rows={2}
                            className={`${panelField} w-full h-auto py-2`}
                            disabled={decidingLayoutId === l.id}
                          />
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              className={panelBtnSecondary}
                              onClick={() => { setFeedbackFor(null); setFeedbackText(''); setError(''); }}
                              disabled={decidingLayoutId === l.id}
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              className="inline-flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-bold px-3 py-1.5 rounded-md text-xs transition-colors disabled:opacity-60"
                              onClick={() => handleLayoutDecision(l.id, feedbackFor.kind, feedbackText)}
                              disabled={decidingLayoutId === l.id || !feedbackText.trim()}
                            >
                              {decidingLayoutId === l.id ? <Spinner className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                              Confirmar {feedbackFor.kind === 'rejected' ? 'rejeição' : 'pedido de correcção'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white font-bold px-3 py-1.5 rounded-md text-xs transition-colors disabled:opacity-60"
                            onClick={() => handleLayoutDecision(l.id, 'approved')}
                            disabled={decidingLayoutId === l.id}
                          >
                            {decidingLayoutId === l.id ? <Spinner className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                            Aprovar
                          </button>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold px-3 py-1.5 rounded-md text-xs transition-colors disabled:opacity-60"
                            onClick={() => { setFeedbackFor({ layoutId: l.id, kind: 'changes_requested' }); setError(''); }}
                            disabled={decidingLayoutId === l.id}
                          >
                            Corrigir
                          </button>
                          <button
                            type="button"
                            className={panelBtnSecondary}
                            onClick={() => { setFeedbackFor({ layoutId: l.id, kind: 'rejected' }); setError(''); }}
                            disabled={decidingLayoutId === l.id}
                          >
                            <X className="w-3.5 h-3.5" />
                            Rejeitar
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {error && <p className="text-xs text-red-600 dark:text-red-400 mt-2">{error}</p>}

      {layoutMode && viewerRole === 'admin' ? (
        <div className="mt-2 pt-3 border-t border-gray-100 dark:border-zinc-800 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase text-gray-500 dark:text-zinc-400">Enviar novo layout (fase)</p>
            <button type="button" onClick={() => setLayoutMode(false)} className="text-gray-400 hover:text-gray-600" title="Cancelar">
              <X className="w-4 h-4" />
            </button>
          </div>
          <input
            type="text"
            value={layoutDescricao}
            onChange={(e) => setLayoutDescricao(e.target.value)}
            placeholder="Descrição da fase (ex: Rascunho inicial)"
            className={`${panelField} w-full`}
            disabled={sending}
          />
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Mensagem para o cliente (opcional)"
            rows={2}
            className={`${panelField} w-full h-auto py-2 resize-none`}
            disabled={sending}
          />
          <input
            type="file"
            ref={layoutFileInputRef}
            accept={ACCEPTED_TYPES}
            className="hidden"
            onChange={(e) => handleSendLayout(e.target.files?.[0] || null)}
            disabled={sending}
          />
          <button
            type="button"
            className={`${panelBtnPrimary} w-full justify-center`}
            onClick={() => layoutFileInputRef.current?.click()}
            disabled={sending || !layoutDescricao.trim()}
          >
            {sending ? <Spinner className="w-4 h-4" /> : <Paperclip className="w-4 h-4" />}
            Escolher ficheiro e enviar
          </button>
        </div>
      ) : (
        <div className="flex items-end gap-2 pt-3 mt-2 border-t border-gray-100 dark:border-zinc-800">
          <input
            type="file"
            ref={fileInputRef}
            accept={ACCEPTED_TYPES}
            className="hidden"
            onChange={(e) => handlePickFile(e.target.files?.[0] || null)}
          />
          <button
            type="button"
            title="Anexar PDF, JPEG ou PNG"
            className="shrink-0 h-[38px] w-[38px] flex items-center justify-center rounded border border-gray-300 bg-white text-gray-500 hover:bg-gray-100 hover:text-red-600 transition-colors disabled:opacity-50 dark:border-zinc-700 dark:bg-transparent dark:text-zinc-400 dark:hover:text-red-400"
            onClick={() => fileInputRef.current?.click()}
            disabled={sending}
          >
            <Paperclip className="w-4 h-4" />
          </button>
          {viewerRole === 'admin' && (
            <button
              type="button"
              title="Enviar como novo layout (fase)"
              className="shrink-0 h-[38px] w-[38px] flex items-center justify-center rounded border border-gray-300 bg-white text-gray-500 hover:bg-gray-100 hover:text-red-600 transition-colors disabled:opacity-50 dark:border-zinc-700 dark:bg-transparent dark:text-zinc-400 dark:hover:text-red-400"
              onClick={() => setLayoutMode(true)}
              disabled={sending}
            >
              <Layers className="w-4 h-4" />
            </button>
          )}
          <div className="flex-1 min-w-0">
            {pendingFile && (
              <div className="flex items-center gap-2 mb-1.5 text-xs text-gray-600 dark:text-zinc-400 bg-gray-50 dark:bg-zinc-800 rounded px-2 py-1">
                <Paperclip className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate flex-1">{pendingFile.name}</span>
                <button type="button" onClick={() => { setPendingFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="shrink-0 text-gray-400 hover:text-red-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Escreva uma mensagem..."
              className={`${panelField} w-full`}
              disabled={sending}
            />
          </div>
          <button type="button" className={panelBtnPrimary} onClick={handleSend} disabled={sending || (!draft.trim() && !pendingFile)}>
            {sending ? <Spinner className="w-4 h-4" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      )}

      {lightbox && (
        <div
          className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 text-white/80 hover:text-white"
            onClick={() => setLightbox(null)}
          >
            <X className="w-7 h-7" />
          </button>
          <img src={lightbox} alt="Imagem" className="max-w-full max-h-full rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
