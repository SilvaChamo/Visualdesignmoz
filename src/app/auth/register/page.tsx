'use client'
import React, { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { AuthPageShell } from '@/components/auth/AuthPageShell'
import { Spinner } from '@/components/ui/spinner'
import {
  authCardClass,
  authErrorBoxClass,
  authInputClass,
  authLabelClass,
  authLinkClass,
  authMutedTextClass,
  authPrimaryBtnClass,
} from '@/components/auth/auth-styles'

const TOTAL_STEPS = 3

const PROVINCIAS_MOCAMBIQUE = [
  'Cidade de Maputo',
  'Maputo Província',
  'Gaza',
  'Inhambane',
  'Sofala',
  'Manica',
  'Tete',
  'Zambézia',
  'Nampula',
  'Cabo Delgado',
  'Niassa',
]

function RegisterPageInner() {
  const searchParams = useSearchParams()
  const redirectParam = searchParams.get('redirect') || searchParams.get('next')
  const loginLink = redirectParam
    ? `/auth/login?redirect=${encodeURIComponent(redirectParam)}`
    : '/auth/login'

  const [step, setStep] = useState<1 | 2 | 3>(1)

  // Passo 1 — email e senha
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Passo 2 — dados pessoais
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')

  // Passo 3 — dados da empresa
  const [empresa, setEmpresa] = useState('')
  const [endereco, setEndereco] = useState('')
  const [provincia, setProvincia] = useState('')
  const [pais, setPais] = useState('Moçambique')
  const [emailEmpresa, setEmailEmpresa] = useState('')
  const [contacto, setContacto] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sucesso, setSucesso] = useState(false)

  const goToStep2 = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password !== confirmar) {
      setError('As passwords não coincidem.')
      return
    }
    if (password.length < 6) {
      setError('A password deve ter no mínimo 6 caracteres.')
      return
    }
    setStep(2)
  }

  const goToStep3 = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!nome.trim() || !telefone.trim()) {
      setError('Preencha o nome e o telefone.')
      return
    }
    setStep(3)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          nome,
          telefone,
          empresa,
          endereco,
          provincia,
          pais,
          emailEmpresa,
          contacto,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao criar conta.')
      }
      setSucesso(true)
    } catch (err: unknown) {
      setError((err as Error).message || 'Erro ao criar conta.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthPageShell wide>
      <div className={authCardClass}>
        {sucesso ? (
          <div className="py-6 text-center">
            <p className="text-4xl mb-4">📧</p>
            <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-2">Conta criada</p>
            <p className={`text-sm ${authMutedTextClass} mb-2`}>Pode entrar agora com:</p>
            <p className={`font-semibold break-all ${authLinkClass}`}>{email}</p>
            <p className={`mt-4 text-xs ${authMutedTextClass}`}>
              A conta começa como visitante — após a primeira compra passa a cliente.
            </p>
            <a href={loginLink} className={`mt-6 inline-block ${authPrimaryBtnClass} px-6`}>
              Ir para entrar →
            </a>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                Criar conta
              </h1>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Aceda à plataforma VisualDesign
              </p>
            </div>

            <div className="mb-6 flex w-full items-center">
              {Array.from({ length: TOTAL_STEPS * 2 - 1 }).map((_, i) => {
                const isCircle = i % 2 === 0
                const n = i / 2 + 1
                if (isCircle) {
                  return (
                    <div
                      key={i}
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                        n <= step
                          ? 'bg-red-600 text-white'
                          : 'bg-zinc-200 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400'
                      }`}
                    >
                      {n}
                    </div>
                  )
                }
                return (
                  <div
                    key={i}
                    className={`h-0.5 flex-1 ${i / 2 < step - 1 ? 'bg-red-600' : 'bg-zinc-200 dark:bg-zinc-700'}`}
                  />
                )
              })}
            </div>

            {error && <div className={authErrorBoxClass}>{error}</div>}

            {step === 1 && (
              <form onSubmit={goToStep2} className="space-y-4">
                <p className={`text-sm font-medium ${authMutedTextClass}`}>Email e password</p>
                <div>
                  <label className={authLabelClass}>Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={authInputClass}
                    placeholder="email@exemplo.com"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={authLabelClass}>Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={`${authInputClass} pr-10`}
                        placeholder="Mín. 6"
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500"
                      >
                        {showPassword ? 'Ocultar' : 'Ver'}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className={authLabelClass}>Confirmar</label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmar}
                        onChange={(e) => setConfirmar(e.target.value)}
                        className={`${authInputClass} pr-10`}
                        placeholder="Repetir"
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500"
                      >
                        {showConfirmPassword ? 'Ocultar' : 'Ver'}
                      </button>
                    </div>
                  </div>
                </div>

                <button type="submit" className={`w-full ${authPrimaryBtnClass}`}>
                  Continuar →
                </button>
              </form>
            )}

            {step === 2 && (
              <form onSubmit={goToStep3} className="space-y-4">
                <p className={`text-sm font-medium ${authMutedTextClass}`}>Dados pessoais</p>
                <div>
                  <label className={authLabelClass}>Nome completo</label>
                  <input
                    type="text"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    className={authInputClass}
                    placeholder="O seu nome"
                    required
                  />
                </div>
                <div>
                  <label className={authLabelClass}>Telefone</label>
                  <input
                    type="tel"
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    className={authInputClass}
                    placeholder="+258 8..."
                    required
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="w-full rounded-lg border border-zinc-300 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    ← Voltar
                  </button>
                  <button type="submit" className={`w-full ${authPrimaryBtnClass}`}>
                    Continuar →
                  </button>
                </div>
              </form>
            )}

            {step === 3 && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <p className={`text-sm font-medium ${authMutedTextClass}`}>Dados da empresa (opcional)</p>
                <div>
                  <label className={authLabelClass}>Nome da empresa</label>
                  <input
                    type="text"
                    value={empresa}
                    onChange={(e) => setEmpresa(e.target.value)}
                    className={authInputClass}
                    placeholder="Nome da empresa"
                  />
                </div>
                <div>
                  <label className={authLabelClass}>Endereço</label>
                  <input
                    type="text"
                    value={endereco}
                    onChange={(e) => setEndereco(e.target.value)}
                    className={authInputClass}
                    placeholder="Av., rua, número"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={authLabelClass}>Província</label>
                    <select
                      value={provincia}
                      onChange={(e) => setProvincia(e.target.value)}
                      className={authInputClass}
                    >
                      <option value="">Seleccione</option>
                      {PROVINCIAS_MOCAMBIQUE.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={authLabelClass}>País</label>
                    <input
                      type="text"
                      value={pais}
                      onChange={(e) => setPais(e.target.value)}
                      className={authInputClass}
                      placeholder="País"
                    />
                  </div>
                </div>
                <div>
                  <label className={authLabelClass}>Email da empresa</label>
                  <input
                    type="email"
                    value={emailEmpresa}
                    onChange={(e) => setEmailEmpresa(e.target.value)}
                    className={authInputClass}
                    placeholder="geral@empresa.com"
                  />
                </div>
                <div>
                  <label className={authLabelClass}>Contactos</label>
                  <input
                    type="tel"
                    value={contacto}
                    onChange={(e) => setContacto(e.target.value)}
                    className={authInputClass}
                    placeholder="+258 8... / +258 2..."
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="w-full rounded-lg border border-zinc-300 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    ← Voltar
                  </button>
                  <button type="submit" disabled={loading} className={`w-full ${authPrimaryBtnClass}`}>
                    {loading ? 'A criar...' : 'Registar'}
                  </button>
                </div>
              </form>
            )}

            <p className={`mt-6 text-center ${authMutedTextClass}`}>
              Já tem conta?{' '}
              <a href={loginLink} className={authLinkClass}>Entrar</a>
            </p>
          </>
        )}
      </div>
    </AuthPageShell>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <AuthPageShell>
        <div className="flex items-center justify-center gap-2 p-8">
          <Spinner />
          <p className="text-zinc-500 font-medium">A carregar...</p>
        </div>
      </AuthPageShell>
    }>
      <RegisterPageInner />
    </Suspense>
  )
}
