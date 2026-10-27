'use client'
// Recuperar senha no mesmo modelo do login (pedido do Silva, 14/10/2026): imagem | formulário num cartão, com os
// botões do tema e da língua no canto.
import Link from 'next/link'
import React, { useState } from 'react'
import { MailCheck } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { CampoFlutuante, botaoCls, ligacaoCls, subtituloCls, tituloCls, formularioCls } from '@/components/auth/campos'
import { authErrorBoxClass, authHintBoxClass } from '@/components/auth/auth-styles'
import { Turnstile } from '@/components/auth/Turnstile'

export default function ForgotPasswordPage() {
  const { t, lang } = useI18n()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState('')
  // "não sou um robô" (Turnstile da Cloudflare), como no registo: o resultado vale uma vez e ~5 minutos; depois de cada
  // tentativa (ou ao reenviar) a caixa volta a aparecer com um resultado novo
  const [robo, setRobo] = useState('')
  const [roboEm, setRoboEm] = useState(0)
  const [roboVez, setRoboVez] = useState(0)
  const aoRobo = (token: string) => {
    setRobo(token)
    setRoboEm(token ? Date.now() : 0)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!robo || Date.now() - roboEm > 280_000) {
      setError(t('rec.robot'))
      setRobo('')
      setRoboVez((v) => v + 1)
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, turnstile: robo }),
      })
      const ct = res.headers.get('content-type') || ''
      const data = ct.includes('application/json') ? await res.json().catch(() => ({})) : {}
      if (!res.ok) throw new Error(String(data?.error || ''))
      setEnviado(true)
    } catch (err: unknown) {
      setRobo('')
      setRoboVez((v) => v + 1)
      const msg = err instanceof Error && err.message && err.message !== '{}' ? err.message : ''
      setError(msg || t('rec.error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
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
            <button type="button" onClick={() => { setRobo(''); setRoboVez((v) => v + 1); setEnviado(false) }} className={ligacaoCls}>
              {t('rec.resend')}
            </button>
            <Link href="/login" className={ligacaoCls}>
              {t('rec.back')}
            </Link>
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
            <Turnstile key={'rec-' + roboVez} onToken={aoRobo} lang={lang} />
            <button type="submit" disabled={loading || !robo} className={botaoCls}>
              {loading ? t('rec.sending') : t('rec.send')}
            </button>
            <p className="text-center text-[clamp(12px,0.95vw,13px)] text-zinc-500 dark:text-zinc-400">{t('rec.hint')}</p>
            <div className="text-center">
              <Link href="/login" className={ligacaoCls}>
                {t('rec.back')}
              </Link>
            </div>
          </form>
        </>
      )}
    </>
  )
}
