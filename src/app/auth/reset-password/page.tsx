'use client'
// Nova palavra-passe (página aberta pelo link do e-mail de recuperação) no mesmo modelo do login (pedido do Silva,
// 14/10/2026): imagem | formulário num cartão, olho nos campos e a barra de força da senha como no registo.
import React, { useState, useEffect } from 'react'
import { CircleCheck } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase-client'
import { useI18n } from '@/lib/i18n'
import { LoginDividido } from '@/components/auth/LoginDividido'
import { CampoFlutuante, ForcaSenha, OlhoSenha, botaoCls, ligacaoCls, subtituloCls, tituloCls } from '@/components/auth/campos'
import { authErrorBoxClass } from '@/components/auth/auth-styles'

export default function ResetPasswordPage() {
  const { t } = useI18n()
  const [password, setPassword] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [semSessao, setSemSessao] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) setSemSessao(true)
    }
    checkSession()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmar) {
      setError(t('nova.mismatch'))
      return
    }
    if (password.length < 6) {
      setError(t('nova.short'))
      return
    }

    setLoading(true)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) {
        setSemSessao(true)
        return
      }

      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError

      setSucesso(true)
      await supabase.auth.signOut()
      setTimeout(() => router.push('/auth/login?reset=success'), 3000)
    } catch (err: unknown) {
      setError((err as Error).message || t('nova.error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <LoginDividido>
      {sucesso ? (
        <div className="text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/25 dark:text-emerald-400">
            <CircleCheck className="h-7 w-7" strokeWidth={1.75} aria-hidden />
          </div>
          <h1 className={tituloCls}>{t('nova.doneTitle')}</h1>
          <p className={subtituloCls}>{t('nova.doneText')}</p>
        </div>
      ) : (
        <>
          <h1 className={tituloCls}>{t('nova.title')}</h1>
          <p className={subtituloCls}>{t('nova.subtitle')}</p>

          {semSessao && (
            <div className={`mt-6 ${authErrorBoxClass}`}>
              {t('nova.noSession')}{' '}
              <a href="/auth/forgot-password" className="font-semibold underline">
                {t('nova.newLink')}
              </a>
            </div>
          )}
          {error && <div className={`mt-6 ${authErrorBoxClass}`}>{error}</div>}

          <form onSubmit={handleSubmit} className="mt-[clamp(20px,2.2vw,32px)] space-y-[clamp(14px,1.4vw,20px)]">
            <CampoFlutuante
              id="nova-senha"
              rotulo={t('nova.password')}
              dica="••••••••"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              minLength={6}
              obrigatorio
              value={password}
              onChange={setPassword}
            >
              <OlhoSenha ver={showPassword} onClick={() => setShowPassword(!showPassword)} />
            </CampoFlutuante>
            <CampoFlutuante
              id="nova-confirmar"
              rotulo={t('nova.confirm')}
              dica="••••••••"
              type={showConfirmPassword ? 'text' : 'password'}
              autoComplete="new-password"
              minLength={6}
              obrigatorio
              value={confirmar}
              onChange={setConfirmar}
            >
              <OlhoSenha ver={showConfirmPassword} onClick={() => setShowConfirmPassword(!showConfirmPassword)} />
            </CampoFlutuante>
            <ForcaSenha senha={password} />
            <button type="submit" disabled={loading} className={botaoCls}>
              {loading ? t('nova.saving') : t('nova.save')}
            </button>
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
