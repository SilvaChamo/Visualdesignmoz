'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, Eye, EyeOff, X } from 'lucide-react'
import { panelBtnPrimary, panelBtnSecondary, panelField } from '@/lib/panel-ui'

export const PANEL_USERS_PAGE_SIZES = [10, 25, 50, 100]

/** Números de página a mostrar: primeira, última e as vizinhas da actual. */
function pageNumbers(current: number, total: number): (number | 'gap')[] {
  const wanted = new Set([1, total, current - 1, current, current + 1])
  const pages = [...wanted].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b)
  const out: (number | 'gap')[] = []
  pages.forEach((n, i) => {
    if (i > 0 && n - pages[i - 1] > 1) out.push('gap')
    out.push(n)
  })
  return out
}

const pagerBtn =
  'inline-flex h-9 min-w-9 items-center justify-center rounded border border-gray-200 bg-white px-2 text-sm text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-default disabled:text-gray-300 disabled:hover:bg-white dark:border-zinc-700 dark:bg-transparent dark:text-zinc-300 dark:hover:bg-zinc-800 dark:disabled:text-zinc-600'

/** Rodapé da lista: intervalo "1-10 de 15", itens por página e paginação. */
export function PanelUsersPager({
  total,
  page,
  pageSize,
  onPage,
  onPageSize,
}: {
  total: number
  page: number
  pageSize: number
  onPage: (page: number) => void
  onPageSize: (size: number) => void
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const current = Math.min(page, totalPages)
  const from = total === 0 ? 0 : (current - 1) * pageSize + 1
  const to = Math.min(current * pageSize, total)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600 dark:text-zinc-400">
      <div className="flex items-center gap-2">
        <span>
          {from}-{to} de {total}
        </span>
        <select
          value={pageSize}
          onChange={(e) => onPageSize(Number(e.target.value))}
          aria-label="Contas por página"
          className="h-8 rounded border border-transparent bg-transparent px-1 text-sm hover:border-gray-300 focus:border-gray-300 focus:outline-none dark:hover:border-zinc-700"
        >
          {PANEL_USERS_PAGE_SIZES.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
      <nav className="flex items-center gap-1.5" aria-label="Paginação">
        <button type="button" className={pagerBtn} aria-label="Página anterior" disabled={current <= 1} onClick={() => onPage(current - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </button>
        {pageNumbers(current, totalPages).map((n, i) =>
          n === 'gap' ? (
            <span key={`gap-${i}`} className="px-1 text-gray-400">
              …
            </span>
          ) : (
            <button
              key={n}
              type="button"
              aria-label={`Página ${n}`}
              aria-current={n === current ? 'page' : undefined}
              onClick={() => onPage(n)}
              className={
                n === current
                  ? 'inline-flex h-9 min-w-9 items-center justify-center rounded border border-red-300 bg-red-600/10 px-2 text-sm font-bold text-red-600 dark:border-red-900 dark:text-red-400'
                  : pagerBtn
              }
            >
              {n}
            </button>
          ),
        )}
        <button type="button" className={pagerBtn} aria-label="Página seguinte" disabled={current >= totalPages} onClick={() => onPage(current + 1)}>
          <ChevronRight className="h-4 w-4" />
        </button>
      </nav>
    </div>
  )
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return createPortal(
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="font-panel relative w-full max-w-md rounded-xl border border-gray-200 bg-white p-5 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h3 className="text-sm font-bold text-gray-900 dark:text-zinc-100">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Fechar" className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}

/** Enviar mensagem por e-mail às contas seleccionadas. */
export function PanelUserMessageModal({
  recipients,
  busy,
  error,
  onSend,
  onClose,
}: {
  recipients: string[]
  busy: boolean
  error: string
  onSend: (subject: string, message: string) => void
  onClose: () => void
}) {
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const label =
    recipients.length === 1 ? recipients[0] : `${recipients.length} contas seleccionadas`

  return (
    <ModalShell title="Enviar mensagem" onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          onSend(subject.trim(), message.trim())
        }}
      >
        <p className="text-xs text-gray-500 dark:text-zinc-400">Para: {label}</p>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Assunto"
          className={`${panelField} w-full`}
          autoFocus
          required
        />
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Mensagem…"
          rows={6}
          required
          className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-red-500 focus:outline-none dark:border-zinc-700 dark:bg-transparent dark:text-zinc-100"
        />
        {error ? <p className="text-xs font-medium text-red-600">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={panelBtnSecondary}>
            Cancelar
          </button>
          <button type="submit" disabled={busy || !subject.trim() || !message.trim()} className={panelBtnPrimary}>
            {busy ? 'A enviar…' : 'Enviar'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

/** Alterar a senha de uma conta do painel. */
export function PanelUserPasswordModal({
  email,
  busy,
  error,
  onSave,
  onClose,
}: {
  email: string
  busy: boolean
  error: string
  onSave: (password: string) => void
  onClose: () => void
}) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const mismatch = confirm.length > 0 && password !== confirm
  const invalid = password.length < 6 || password !== confirm

  return (
    <ModalShell title={`Alterar senha — ${email}`} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (!invalid) onSave(password)
        }}
      >
        <div className="relative">
          <input
            type={show ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Nova senha (mínimo 6 caracteres)"
            autoComplete="new-password"
            className={`${panelField} w-full pr-10`}
            autoFocus
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-red-600"
          >
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <input
          type={show ? 'text' : 'password'}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Confirmar nova senha"
          autoComplete="new-password"
          className={`${panelField} w-full`}
        />
        {mismatch ? <p className="text-xs font-medium text-red-600">As senhas não coincidem.</p> : null}
        {error ? <p className="text-xs font-medium text-red-600">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={panelBtnSecondary}>
            Cancelar
          </button>
          <button type="submit" disabled={busy || invalid} className={panelBtnPrimary}>
            {busy ? 'A guardar…' : 'Guardar'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}
