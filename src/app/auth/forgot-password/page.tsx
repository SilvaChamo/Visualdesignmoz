'use client'
// Recuperar senha no mesmo modelo do login (pedido do Silva, 14/10/2026): imagem | formulário num cartão, com os
// botões do tema e da língua no canto.
import React, { useState } from 'react'
import { MailCheck } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { LoginDividido } from '@/components/auth/LoginDividido'
import { CampoFlutuante, botaoCls, ligacaoCls, subtituloCls, tituloCls, formularioCls } from '@/components/auth/campos'
import { authErrorBoxClass, authHintBoxClass } from '@/components/auth/auth-styles'

export default function ForgotPasswordPage() {
  const { t } = useI18n()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const ct = res.headers.get('content-type') || ''
      const data = ct.includes('application/json') ? await res.json().catch(() => ({})) : {}
      if (!res.ok) throw new Error(String(data?.error || ''))
      setEnviado(true)
    } catch (err: unknown) {
      const msg = err instanceof Error && err.message && err.message !== '{}' ? err.message : ''
      setError(msg || t('rec.error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <LoginDividido>
      {enviado ? (
        <div className="text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/25 dark:text-emerald-400">
            <MailCheck className="h-7 w-7" strokeWidth={1.75} aria-hidden />
          </div>
          <h1 className={tituloCls}>{t('rec.sentTitle')}</h1>
          <p className={subtituloCls}>
            {t('rec.sentText')} <span className="font-semibold text-zinc-900 dark:text-zinc-100">{email}</span>
          </p>
          <div className={`mt-5 text-left ${authHintBoxClass}`}>{t('rec.sentHint')}</div>
          <div className="mt-6 flex items-center justify-between gap-4">
            <button type="button" onClick={() => setEnviado(false)} className={ligacaoCls}>
              {t('rec.resend')}
            </button>
            <a href="/login" className={ligacaoCls}>
              {t('rec.back')}
            </a>
          </div>
        </div>
      ) : (
        <>
          <h1 className={tituloCls}>{t('rec.title')}</h1>
          <p className={subtituloCls}>{t('rec.subtitle')}</p>

          {error && <div className={`mt-6 ${authErrorBoxClass}`}>{error}</div>}

          <form onSubmit={handleSubmit} className={formularioCls}>
            <CampoFlutuante
              id="rec-email"
              rotulo={t('rec.email')}
              dica="email@dominio.com"
              type="email"
              autoComplete="email"
              obrigatorio
              value={email}
              onChange={setEmail}
            />
            <button type="submit" disabled={loading} className={botaoCls}>
              {loading ? t('rec.sending') : t('rec.send')}
            </button>
            <p className="text-center text-[clamp(12px,0.95vw,13px)] text-zinc-500 dark:text-zinc-400">{t('rec.hint')}</p>
            <div className="text-center">
              <a href="/login" className={ligacaoCls}>
                {t('rec.back')}
              </a>
            </div>
          </form>
        </>
      )}
    </LoginDividido>
  )
}
