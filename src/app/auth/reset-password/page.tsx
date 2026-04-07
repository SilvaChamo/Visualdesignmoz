'use client'
import React, { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

export default function ResetPasswordPage() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'

    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    const [password, setPassword] = useState('')
    const [confirmar, setConfirmar] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [sucesso, setSucesso] = useState(false)
    const [error, setError] = useState('')
    const router = useRouter()

    useEffect(() => {
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) {
                console.warn('ResetPasswordPage: No active session found. Redirecting to login.')
                setError('Sessão expirada ou inválida. Por favor, solicita um novo link de recuperação.')
                // Facultativo: redirecionar após 3s
                // setTimeout(() => router.push('/auth/login'), 3000)
            }
        }
        checkSession()
    }, [supabase, router])

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
        console.log('ResetPasswordPage: Starting password update...')

        try {
            // Garantir que temos sessão antes de tentar o update
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) {
                throw new Error('Sessão inválida. Por favor, utiliza o link enviado por email novamente.')
            }

            const { data, error: updateError } = await supabase.auth.updateUser({
                password: password
            })

            if (updateError) {
                console.error('ResetPasswordPage: Update failed:', updateError)
                throw updateError
            }

            console.log('ResetPasswordPage: Success! Password updated for:', data.user?.email)
            setSucesso(true)

            // Logout para forçar novo login com a nova password (opcional mas seguro)
            await supabase.auth.signOut()

            setTimeout(() => {
                router.push('/auth/login?reset=success')
            }, 3000)
        } catch (err: any) {
            console.error('ResetPasswordPage: Catch block:', err)
            setError(err.message || 'Erro ao atualizar a password. Tenta novamente.')
        } finally {
            console.log('ResetPasswordPage: Process finished.')
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 relative overflow-hidden">
            {/* Background Gradient */}
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

            {/* Logo */}
            <div className="flex flex-col items-center mb-6 z-10">
                <a href="/" className="block transform transition-transform duration-300 hover:scale-110">
                    <img
                        src="/assets/logotipoII.png"
                        alt="Portal Digitale"
                        className="h-32 object-contain"
                    />
                </a>
            </div>

            <div
                className="w-full max-w-md rounded-2xl p-10 z-10"
                style={{
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    backdropFilter: 'blur(24px)',
                    WebkitBackdropFilter: 'blur(24px)',
                }}
            >
                {sucesso ? (
                    <div className="text-center py-8">
                        <div className="text-5xl mb-5">🎉</div>
                        <p className="text-white font-bold text-xl mb-3">Password Atualizada!</p>
                        <p className="text-gray-400 text-sm">A sua password foi alterada com sucesso. A redirecionar para o login...</p>
                    </div>
                ) : (
                    <>
                        <h1 className="text-white text-xl font-bold mb-1 text-center font-bold">Nova Password</h1>
                        <p className="text-gray-500 text-xs mb-8 text-center">Define a tua nova palavra-passe de acesso</p>

                        {error && (
                            <div className="mb-4 p-3 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm">{error}</div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Nova Password</label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full px-4 py-3 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-red-600 transition-all duration-200 pr-12"
                                        style={{
                                            background: 'rgba(0,0,0,0.4)',
                                            border: '1px solid rgba(127, 0, 0, 0.4)',
                                            color: 'white',
                                        }}
                                        placeholder="••••••••"
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
                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Confirmar Password</label>
                                <div className="relative">
                                    <input
                                        type={showConfirmPassword ? 'text' : 'password'}
                                        value={confirmar}
                                        onChange={(e) => setConfirmar(e.target.value)}
                                        className="w-full px-4 py-3 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-red-600 transition-all duration-200 pr-12"
                                        style={{
                                            background: 'rgba(0,0,0,0.4)',
                                            border: '1px solid rgba(127, 0, 0, 0.4)',
                                            color: 'white',
                                        }}
                                        placeholder="••••••••"
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
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3 bg-red-700 hover:bg-red-600 disabled:bg-red-900 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all duration-200 shadow-lg shadow-red-900/20 uppercase tracking-widest"
                            >
                                {loading ? 'A ATUALIZAR...' : 'ATUALIZAR PASSWORD'}
                            </button>
                        </form>
                    </>
                )}
            </div>

            {/* Footer Line */}
            <div
                className="fixed bottom-0 left-0 right-0 z-50"
                style={{ height: '3px', background: 'linear-gradient(90deg, #7f0000, #cc0000, #7f0000)' }}
            />
        </div>
    )
}
