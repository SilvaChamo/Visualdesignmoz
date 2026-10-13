'use client'
import React, { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { LoginDividido } from '@/components/auth/LoginDividido'
import { CampoFlutuante, CampoTelefone, EscolhaFlutuante, ForcaSenha, OlhoSenha, botaoCls, botaoClaroCls, ligacaoCls, subtituloCls, tituloCls, formularioCls } from '@/components/auth/campos'
import { authErrorBoxClass } from '@/components/auth/auth-styles'
import { Turnstile } from '@/components/auth/Turnstile'
import { useI18n } from '@/lib/i18n'

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
  const { lang } = useI18n()
  // "não sou um robô" (Turnstile): o resultado só vale uma vez — depois de uma tentativa falhada a caixa volta a pedir
  const [robo, setRobo] = useState('')
  const [roboVez, setRoboVez] = useState(0)

  // 1.º passo: o e-mail já tem conta? (pedido do Silva, 13/10/2026 — por causa das contas repetidas, verifica-se logo
  // aqui e só depois se passa ao 2.º passo; o registo final volta a verificar)
  const [verificando, setVerificando] = useState(false)
  const goToStep2 = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password !== confirmar) {
      setError('As palavras-passe não coincidem.')
      return
    }
    if (password.length < 6) {
      setError('A palavra-passe deve ter no mínimo 6 caracteres.')
      return
    }
    setVerificando(true)
    try {
      const r = await fetch('/api/auth/email-livre', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const j = (await r.json().catch(() => ({}))) as { livre?: boolean; erro?: string }
      if (j.livre === false) {
        setError(j.erro || 'Este e-mail não pode ser usado.')
        return
      }
    } catch {
      // sem ligação: deixa seguir, o registo final volta a verificar
    } finally {
      setVerificando(false)
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
    if (!robo) {
      setError('Confirme que não é um robô (a caixa de verificação por cima do botão).')
      return
    }
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
          turnstile: robo,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao criar conta.')
      }
      setSucesso(true)
    } catch (err: unknown) {
      setError((err as Error).message || 'Erro ao criar conta.')
      setRobo('')
      setRoboVez((n) => n + 1)
    } finally {
      setLoading(false)
    }
  }

  // as bolas dos 3 passos ligadas por uma linha (a cor marca até onde já se foi)
  const passos = (
    <div className="mt-6 flex w-full items-center">
      {Array.from({ length: TOTAL_STEPS * 2 - 1 }).map((_, i) => {
        const n = i / 2 + 1
        if (i % 2 === 0)
          return (
            <div
              key={i}
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                n <= step ? 'bg-red-600 text-white' : 'bg-zinc-200 text-zinc-500 dark:bg-[#272a34] dark:text-zinc-400'
              }`}
            >
              {n}
            </div>
          )
        return <div key={i} className={`h-0.5 flex-1 ${i / 2 < step - 1 ? 'bg-red-600' : 'bg-zinc-200 dark:bg-[#393e4d]'}`} />
      })}
    </div>
  )
  const passoTitulo = (txt: string) => <p className="text-center text-sm font-medium text-zinc-600 dark:text-zinc-400 lg:text-left">{txt}</p>
  const formCls = formularioCls

  // Registo no mesmo modelo do login (pedido do Silva, 13/10/2026): foto à esquerda, formulário à direita, os mesmos
  // campos com a etiqueta que sobe ao clicar e os mesmos botões
  return (
    <LoginDividido>
      {sucesso ? (
        <div className="py-6 text-center">
          <p className="mb-4 text-4xl">📧</p>
          <h1 className={`${tituloCls}`}>Conta criada</h1>
          <p className={`${subtituloCls}`}>Pode entrar agora com:</p>
          <p className="mt-2 break-all font-semibold text-red-600 dark:text-red-400">{email}</p>
          <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">A conta começa como visitante — após a primeira compra passa a cliente.</p>
          <a href={loginLink} className={`mt-6 ${botaoCls}`}>
            Ir para entrar →
          </a>
        </div>
      ) : (
        <>
          <h1 className={tituloCls}>Criar conta</h1>
          <p className={subtituloCls}>Aceda à plataforma VisualDesign</p>
          {passos}

          {error && <div className={`mt-5 ${authErrorBoxClass}`}>{error}</div>}

          {step === 1 && (
            <form onSubmit={goToStep2} className={formCls}>
              {passoTitulo('E-mail e palavra-passe')}
              <CampoFlutuante id="reg-email" rotulo="E-mail" dica="email@exemplo.com" type="email" autoComplete="email" obrigatorio value={email} onChange={setEmail} />
              <div className="grid grid-cols-2 gap-3">
                <CampoFlutuante
                  id="reg-senha"
                  rotulo="Palavra-passe"
                  dica="Mín. 6"
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
                  id="reg-confirmar"
                  rotulo="Confirmar"
                  dica="Repetir"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  minLength={6}
                  obrigatorio
                  value={confirmar}
                  onChange={setConfirmar}
                >
                  <OlhoSenha ver={showConfirmPassword} onClick={() => setShowConfirmPassword(!showConfirmPassword)} />
                </CampoFlutuante>
              </div>
              <ForcaSenha senha={password} />
              <button type="submit" disabled={verificando} className={botaoCls}>
                {verificando ? 'A verificar o e-mail…' : 'Continuar →'}
              </button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={goToStep3} className={formCls}>
              {passoTitulo('Dados pessoais')}
              <CampoFlutuante id="reg-nome" rotulo="Nome completo" dica="O seu nome" autoComplete="name" obrigatorio value={nome} onChange={setNome} />
              <CampoTelefone id="reg-telefone" rotulo="Telefone" dica="84 000 0000" obrigatorio value={telefone} onChange={setTelefone} />
              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(1)} className={botaoClaroCls}>
                  ← Voltar
                </button>
                <button type="submit" className={botaoCls}>
                  Continuar →
                </button>
              </div>
            </form>
          )}

          {step === 3 && (
            <form onSubmit={handleSubmit} className={formCls}>
              {passoTitulo('Dados da empresa (opcional)')}
              <CampoFlutuante id="reg-empresa" rotulo="Nome da empresa" dica="Nome da empresa" autoComplete="organization" value={empresa} onChange={setEmpresa} />
              <CampoFlutuante id="reg-endereco" rotulo="Endereço" dica="Av., rua, número" autoComplete="street-address" value={endereco} onChange={setEndereco} />
              <div className="grid grid-cols-2 gap-3">
                <EscolhaFlutuante id="reg-provincia" rotulo="Província" value={provincia} onChange={setProvincia} opcoes={PROVINCIAS_MOCAMBIQUE} vazio="Seleccione" />
                <CampoFlutuante id="reg-pais" rotulo="País" dica="País" autoComplete="country-name" value={pais} onChange={setPais} />
              </div>
              <CampoFlutuante id="reg-email-empresa" rotulo="E-mail da empresa" dica="geral@empresa.com" type="email" value={emailEmpresa} onChange={setEmailEmpresa} />
              <CampoTelefone id="reg-contactos" rotulo="Contactos" dica="21 000 000" value={contacto} onChange={setContacto} />
              <Turnstile key={roboVez} onToken={setRobo} lang={lang} />
              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(2)} className={botaoClaroCls}>
                  ← Voltar
                </button>
                <button type="submit" disabled={loading} className={botaoCls}>
                  {loading ? 'A criar…' : 'Registar'}
                </button>
              </div>
            </form>
          )}

          <p className="mt-6 text-center text-[clamp(12.5px,0.92vw,13.5px)] text-zinc-600 dark:text-zinc-400">
            Já tem conta?{' '}
            <a href={loginLink} className={ligacaoCls}>
              Entrar
            </a>
          </p>
        </>
      )}
    </LoginDividido>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<LoginDividido>{null}</LoginDividido>}>
      <RegisterPageInner />
    </Suspense>
  )
}
