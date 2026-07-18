'use client'

import { useEffect, useMemo, useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'
import { CreditCard, CheckCircle, AlertTriangle, Loader2, Star } from 'lucide-react'
import Link from 'next/link'

type SavedMethod = {
  id: string
  type: string
  provider: string
  account_number: string
  account_name: string
  is_default: boolean
}

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null

function AddCardForm({ onSaved }: { onSaved: () => void }) {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements || submitting) return
    setSubmitting(true)
    setError('')

    try {
      const { error: confirmError, setupIntent } = await stripe.confirmSetup({
        elements,
        redirect: 'if_required',
        confirmParams: {
          return_url: `${window.location.origin}/pagamento/metodos`,
        },
      })

      if (confirmError) {
        throw new Error(confirmError.message || 'Não foi possível validar o cartão.')
      }
      if (!setupIntent || setupIntent.status !== 'succeeded') {
        throw new Error('O cartão não foi confirmado.')
      }

      const res = await fetch('/api/payments/confirm-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setup_intent_id: setupIntent.id }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Não foi possível guardar o cartão.')
      }

      onSaved()
    } catch (err: any) {
      setError(err.message || 'Erro ao guardar o cartão.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}
      <button
        type="submit"
        disabled={!stripe || submitting}
        className="w-full py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {submitting ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" /> A guardar cartão...
          </>
        ) : (
          <>
            <CreditCard className="w-5 h-5" /> Guardar cartão
          </>
        )}
      </button>
    </form>
  )
}

export default function MetodosPagamentoPage() {
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [methods, setMethods] = useState<SavedMethod[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [savedMessage, setSavedMessage] = useState('')

  const loadMethods = async () => {
    const res = await fetch('/api/payments')
    const data = await res.json()
    if (data.success) setMethods(data.methods)
  }

  const startSetup = async () => {
    setError('')
    setClientSecret(null)
    try {
      const res = await fetch('/api/payments/setup-intent', { method: 'POST' })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Não foi possível iniciar o registo do cartão.')
      }
      setClientSecret(data.clientSecret)
    } catch (err: any) {
      setError(err.message || 'Erro ao contactar a Stripe.')
    }
  }

  useEffect(() => {
    (async () => {
      await loadMethods()
      setLoading(false)
    })()
  }, [])

  const handleSaved = async () => {
    setClientSecret(null)
    setSavedMessage('Cartão guardado com sucesso.')
    await loadMethods()
  }

  const options = useMemo(
    () => (clientSecret ? { clientSecret } : undefined),
    [clientSecret],
  )

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 pt-32">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Métodos de Pagamento</h1>
          <p className="text-gray-600 mt-1">Cartões guardados para renovações automáticas</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-8 h-8 animate-spin text-red-600" />
          </div>
        ) : (
          <>
            {methods.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6 space-y-3">
                <h3 className="font-semibold text-gray-900 mb-2">Cartões guardados</h3>
                {methods.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between p-3 border border-gray-100 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <CreditCard className="w-5 h-5 text-gray-500" />
                      <div>
                        <p className="font-medium text-gray-900 text-sm">
                          {m.provider} {m.account_number}
                        </p>
                        <p className="text-xs text-gray-500">{m.account_name}</p>
                      </div>
                    </div>
                    {m.is_default && (
                      <span className="flex items-center gap-1 text-xs font-bold text-amber-600">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" /> Principal
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {savedMessage && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <p className="text-green-700 text-sm">{savedMessage}</p>
              </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5" /> Adicionar novo cartão
              </h3>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}

              {!stripePromise ? (
                <p className="text-sm text-gray-500">Pagamento por cartão ainda não está configurado.</p>
              ) : clientSecret && options ? (
                <Elements stripe={stripePromise} options={options}>
                  <AddCardForm onSaved={handleSaved} />
                </Elements>
              ) : (
                <button
                  onClick={startSetup}
                  className="w-full py-3 bg-slate-900 text-white rounded-xl font-semibold hover:bg-black transition-colors"
                >
                  Adicionar cartão
                </button>
              )}
            </div>

            <div className="text-center mt-6">
              <Link href="/client" className="text-gray-500 hover:text-gray-700 text-sm">
                Voltar ao painel do cliente
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
