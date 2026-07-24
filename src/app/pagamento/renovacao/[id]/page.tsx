'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { 
  Calendar, 
  Globe, 
  Server, 
  CreditCard,
  Smartphone,
  Wallet,
  CheckCircle,
  AlertTriangle,
  Loader2,
  ArrowLeft
} from 'lucide-react'
import Link from 'next/link'

interface Renewal {
  id: string
  domain_name: string
  expiration_date: string
  renewal_price: number
  currency: string
  type: 'domain' | 'hosting'
  status: string
}

interface PaymentMethod {
  id: string
  type: 'mpesa' | 'cartao' | 'paypal'
  provider: string
  account_number: string
  account_name: string
  is_default: boolean
}

export default function PagamentoRenovacaoPage() {
  const params = useParams()
  const renewalId = params.id as string
  
  const [renewal, setRenewal] = useState<Renewal | null>(null)
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [selectedMethod, setSelectedMethod] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadData()
  }, [renewalId])

  const loadData = async () => {
    try {
      // Carregar renovação
      const res = await fetch(`/api/renewals/${renewalId}`)
      const data = await res.json()
      if (data.success) {
        setRenewal(data.renewal)
      }

      // Carregar métodos de pagamento
      const methodsRes = await fetch('/api/payments')
      const methodsData = await methodsRes.json()
      if (methodsData.success) {
        setPaymentMethods(methodsData.methods)
        const defaultMethod = methodsData.methods.find((m: PaymentMethod) => m.is_default)
        if (defaultMethod) {
          setSelectedMethod(defaultMethod.id)
        }
      }
    } catch (error) {
      console.error('Erro:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePayment = async () => {
    if (!selectedMethod || !renewal) return

    setProcessing(true)
    setError('')

    try {
      const res = await fetch('/api/payments/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          renewal_id: renewalId,
          renewal_type: renewal.type,
          payment_method_id: selectedMethod,
          amount: renewal.renewal_price
        })
      })

      const data = await res.json()

      if (data.success) {
        setSuccess(true)
      } else {
        setError(data.message || 'Erro ao processar pagamento')
      }
    } catch (err) {
      setError('Erro ao processar pagamento')
    } finally {
      setProcessing(false)
    }
  }

  const getMethodIcon = (type: string) => {
    switch (type) {
      case 'mpesa': return <Smartphone className="w-5 h-5" />
      case 'cartao': return <CreditCard className="w-5 h-5" />
      case 'paypal': return <Wallet className="w-5 h-5" />
      default: return <CreditCard className="w-5 h-5" />
    }
  }

  const getMethodLabel = (type: string) => {
    switch (type) {
      case 'mpesa': return 'M-Pesa'
      case 'cartao': return 'Cartão de Crédito'
      case 'paypal': return 'PayPal'
      default: return type
    }
  }

  const getDaysRemaining = (expirationDate: string) => {
    const exp = new Date(expirationDate)
    const today = new Date()
    const diff = exp.getTime() - today.getTime()
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-red-600" />
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Pagamento Confirmado!</h1>
          <p className="text-gray-600 mb-6">
            Sua renovação foi processada com sucesso. Você receberá um email de confirmação em breve.
          </p>
          <Link 
            href="/cliente" 
            className="inline-flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar ao Painel
          </Link>
        </div>
      </div>
    )
  }

  if (!renewal) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Renovação não encontrada</h1>
          <p className="text-gray-600 mb-6">
            O link de pagamento pode ter expirado ou ser inválido.
          </p>
          <Link 
            href="/cliente" 
            className="inline-flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar ao Painel
          </Link>
        </div>
      </div>
    )
  }

  const days = getDaysRemaining(renewal.expiration_date)

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Pagamento de Renovação</h1>
          <p className="text-gray-600 mt-1">VisualDesign - Gestão de Serviços</p>
        </div>

        {/* Resumo */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            {renewal.type === 'domain' ? (
              <Globe className="w-6 h-6 text-red-600" />
            ) : (
              <Server className="w-6 h-6 text-red-600" />
            )}
            <div>
              <h2 className="font-semibold text-gray-900">{renewal.domain_name}</h2>
              <p className="text-sm text-gray-500">
                {renewal.type === 'domain' ? 'Renovação de Domínio' : 'Renovação de Hospedagem'}
              </p>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Data de Expiração:</span>
              <span className="font-medium">
                {new Date(renewal.expiration_date).toLocaleDateString('pt-BR')}
                <span className={`ml-2 ${days <= 7 ? 'text-red-600' : days <= 30 ? 'text-amber-600' : 'text-gray-500'}`}>
                  ({days} dias)
                </span>
              </span>
            </div>
            <div className="flex justify-between text-lg font-bold pt-2">
              <span className="text-gray-900">Total a Pagar:</span>
              <span className="text-red-600">
                {renewal.renewal_price?.toLocaleString('pt-MZ', { style: 'currency', currency: renewal.currency || 'MZN' })}
              </span>
            </div>
          </div>
        </div>

        {/* Métodos de Pagamento */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Método de Pagamento
          </h3>

          {paymentMethods.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-gray-600 mb-4">Nenhum método de pagamento cadastrado</p>
              <Link
                href="/pagamento/metodos"
                className="text-red-600 hover:text-red-700 font-medium"
              >
                Adicionar cartão →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {paymentMethods.map((method) => (
                <label
                  key={method.id}
                  className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                    selectedMethod === method.id 
                      ? 'border-red-600 bg-red-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="payment_method"
                    value={method.id}
                    checked={selectedMethod === method.id}
                    onChange={() => setSelectedMethod(method.id)}
                    className="w-4 h-4 text-red-600 border-gray-300 focus:ring-red-500"
                  />
                  <div className="ml-3 flex items-center gap-3 flex-1">
                    {getMethodIcon(method.type)}
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">
                        {getMethodLabel(method.type)}
                        {method.is_default && (
                          <span className="ml-2 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">
                            Padrão
                          </span>
                        )}
                      </p>
                      <p className="text-sm text-gray-500">
                        {method.account_number}
                        {method.account_name && ` - ${method.account_name}`}
                      </p>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Erro */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {/* Botão Pagar */}
        <button
          onClick={handlePayment}
          disabled={processing || !selectedMethod || paymentMethods.length === 0}
          className="w-full py-4 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {processing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Processando...
            </>
          ) : (
            <>
              <Wallet className="w-5 h-5" />
              Pagar {renewal.renewal_price?.toLocaleString('pt-MZ', { style: 'currency', currency: renewal.currency || 'MZN' })}
            </>
          )}
        </button>

        {/* Footer */}
        <div className="text-center mt-6">
          <Link href="/cliente" className="text-gray-500 hover:text-gray-700 text-sm flex items-center justify-center gap-1">
            <ArrowLeft className="w-4 h-4" />
            Voltar ao painel do cliente
          </Link>
          <p className="text-gray-400 text-xs mt-4">
            Pagamento processado de forma segura
          </p>
        </div>
      </div>
    </div>
  )
}
