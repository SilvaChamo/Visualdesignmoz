'use client'
import React, { useState } from 'react'
import { useAuth } from '../../../components/auth/AuthProvider'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState('')
  const { resetPassword } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await resetPassword(email)
      setEnviado(true)
    } catch (err: any) {
      setError(err.message || 'Erro ao enviar email.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 relative overflow-hidden">

      {/* Gradiente Sincronizado */}
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

      {/* Logo Aumentado */}
      <div className="flex flex-col items-center mb-6 z-10 transition-all duration-300">
        <img
          src="/assets/logotipoII.png"
          alt="VisualDesigne"
          className="h-32 object-contain"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
      </div>

      {/* Formulário Glassmorphism */}
      <div
        className="w-full max-w-md rounded-2xl p-8 z-10"
        style={{
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.12)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
        }}
      >
        {enviado ? (
          <div className="text-center py-6">
            {/* Ícone de sucesso animado */}
            <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center">
              <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>

            <h2 className="text-green-400 font-bold text-lg mb-2">Email Enviado com Sucesso!</h2>
            <p className="text-gray-300 text-sm">
              Enviámos um link de recuperação para<br />
              <span className="text-white font-bold">{email}</span>
            </p>

            {/* Instrução Simples */}
            <div className="mt-5 space-y-3 text-left">
              <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                <p className="text-gray-300 text-sm flex items-start gap-3">
                  <span className="text-xl">📧</span>
                  <span>Verifica a tua caixa de entrada (e a pasta de spam) e clica no link para criar uma nova password.</span>
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col items-center gap-3">
              <button
                onClick={() => setEnviado(false)}
                className="text-red-400 hover:text-red-300 transition text-xs font-semibold uppercase tracking-wider"
              >
                Reenviar Email
              </button>
              <a
                href="/auth/login"
                className="text-white/60 hover:text-white transition text-sm font-medium"
              >
                ← Voltar ao Login
              </a>
            </div>
          </div>
        ) : (
          <>
            <h1 className="text-white text-xl font-bold mb-1 text-center">Recuperar Password</h1>
            <p className="text-gray-500 text-xs mb-8 text-center">Enviaremos um link seguro para redefinir a tua palavra-passe</p>

            {error && (
              <div className="mb-4 p-3 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm">{error}</div>
            )}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">E-mail</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-red-600 transition-all duration-200"
                  style={{
                    background: 'rgba(0,0,0,0.4)',
                    border: '1px solid rgba(127, 0, 0, 0.4)',
                    color: 'white',
                  }}
                  placeholder="email@visualdesigne.com"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-red-700 hover:bg-red-600 disabled:bg-red-900 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all duration-200 shadow-lg shadow-red-900/20 uppercase tracking-widest text-sm"
              >
                {loading ? 'A enviar...' : 'Enviar Link de Recuperação'}
              </button>
            </form>

            <div className="mt-6 p-3 bg-white/5 border border-white/10 rounded-lg">
              <p className="text-gray-500 text-xs text-center">
                🔐 O link será enviado para o email associado à tua conta. Por razões de segurança, não indicamos se o email existe no sistema.
              </p>
            </div>

            <p className="text-center mt-6">
              <a href="/auth/login" className="text-white/50 hover:text-white transition text-sm font-medium">← Voltar ao Login</a>
            </p>
          </>
        )}
      </div>

      {/* Linha vermelha no rodapé */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50"
        style={{ height: '3px', background: 'linear-gradient(90deg, #7f0000, #cc0000, #7f0000)' }}
      />
    </div>
  )
}
