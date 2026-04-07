'use client'
import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../../components/auth/AuthProvider'

export default function RegisterPage() {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingGoogle, setLoadingGoogle] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState('')
  const [sucesso, setSucesso] = useState(false)
  const { signUp } = useAuth()
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
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
    setLoading(true)
    try {
      await signUp(email, password, nome)
      setSucesso(true)
    } catch (err: unknown) {
      setError((err as Error).message || 'Erro ao criar conta.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = () => {
    setLoadingGoogle(true)
    setError('')
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
    window.location.href = `${supabaseUrl}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(window.location.origin + '/auth/callback')}`
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 relative overflow-hidden">

      {/* Gradiente Aumentado */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          style={{
            position: 'absolute',
            top: '-15%',
            left: '-15%',
            width: '65%',
            height: '65%',
            background: 'radial-gradient(ellipse at top left, rgba(180,0,0,0.65) 0%, rgba(120,0,0,0.4) 45%, transparent 75%)',
            filter: 'blur(45px)',
          }}
        />
      </div>

      {/* Logo Aumentado e Menos Espaço */}
      <div className="flex flex-col items-center mb-6 z-10 transition-all duration-300">
        <a href="/" className="block transform transition-transform duration-300 hover:scale-110">
          <img
            src="/assets/logotipoII.png"
            alt="Portal Digitale"
            className="h-32 object-contain"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        </a>
      </div>

      {/* Formulário com glassmorphism (opacidade 0.08) */}
      <div
        className="w-full max-w-md rounded-2xl p-8 z-10"
        style={{
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.12)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
        }}
      >
        {sucesso ? (
          <div className="text-center py-8">
            <div className="text-5xl mb-5">📧</div>
            <p className="text-white font-bold text-xl mb-3">Confirma o teu email!</p>
            <p className="text-gray-300 text-sm leading-relaxed mb-2">Enviámos um email de confirmação para:</p>
            <p className="text-red-400 font-bold text-sm mb-4 break-all">{email}</p>
            <p className="text-gray-400 text-xs leading-relaxed mb-6">
              Abre o teu email, clica no link de confirmação e depois volta aqui para entrar na tua conta.
            </p>
            <div className="p-3 bg-white/5 border border-white/10 rounded-lg text-gray-500 text-xs">
              Não recebeste? Verifica a pasta de spam ou tenta registar novamente.
            </div>
            <a href="/auth/login" className="inline-block mt-6 text-red-400 hover:text-red-300 transition text-sm font-semibold">
              ← Voltar ao Login
            </a>
          </div>
        ) : (
          <>
            <h1 className="text-white text-xl font-bold mb-1 text-center">Criar Conta</h1>
            <p className="text-gray-500 text-xs mb-6 text-center">Acede à plataforma your-domain.com</p>

            {error && (
              <div className="mb-4 p-3 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm">{error}</div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Nome Completo</label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-red-600 transition-all duration-200"
                  style={{
                    background: 'rgba(0,0,0,0.4)',
                    border: '1px solid rgba(127, 0, 0, 0.4)',
                    color: 'white',
                  }}
                  placeholder="O teu nome"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-red-600 transition-all duration-200"
                  style={{
                    background: 'rgba(0,0,0,0.4)',
                    border: '1px solid rgba(127, 0, 0, 0.4)',
                    color: 'white',
                  }}
                  placeholder="email@exemplo.com"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-red-600 transition-all duration-200 pr-10"
                      style={{
                        background: 'rgba(0,0,0,0.4)',
                        border: '1px solid rgba(127, 0, 0, 0.4)',
                        color: 'white',
                      }}
                      placeholder="Mínimo 6"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition text-sm"
                    >
                      {showPassword ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Confirmar</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmar}
                      onChange={(e) => setConfirmar(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-red-600 transition-all duration-200 pr-10"
                      style={{
                        background: 'rgba(0,0,0,0.4)',
                        border: '1px solid rgba(127, 0, 0, 0.4)',
                        color: 'white',
                      }}
                      placeholder="Repete"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition text-sm"
                    >
                      {showConfirmPassword ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-red-700 hover:bg-red-600 disabled:bg-red-900 disabled:cursor-not-allowed text-white font-extrabold rounded-lg transition-all duration-200 shadow-lg shadow-red-900/20 uppercase tracking-widest"
                >
                  {loading ? 'A CRIAR...' : 'REGISTAR'}
                </button>
              </div>
            </form>
            <p className="text-center text-white/50 text-sm mt-6">
              Já tens conta?{' '}
              <a href="/auth/login" className="text-white hover:text-red-400 transition font-semibold uppercase tracking-wider">ENTRAR</a>
            </p>
          </>
        )}
      </div>

      <div
        className="fixed bottom-0 left-0 right-0 z-50"
        style={{ height: '3px', background: 'linear-gradient(90deg, #7f0000, #cc0000, #7f0000)' }}
      />
    </div >
  )
}
