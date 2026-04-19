'use client'

import { useState } from 'react'
import { CreditCard, Smartphone, Wallet, X, Loader2, Check } from 'lucide-react'

interface PaymentMethodFormProps {
  onClose: () => void
  onSuccess: () => void
}

export default function PaymentMethodForm({ onClose, onSuccess }: PaymentMethodFormProps) {
  const [type, setType] = useState<'mpesa' | 'cartao' | 'paypal'>('mpesa')
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    provider: '',
    account_number: '',
    account_name: '',
    is_default: false
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          provider: formData.provider || getDefaultProvider(),
          account_number: formData.account_number,
          account_name: formData.account_name,
          is_default: formData.is_default
        })
      })

      if (res.ok) {
        onSuccess()
      } else {
        alert('Erro ao adicionar método de pagamento')
      }
    } catch (error) {
      console.error('Erro:', error)
      alert('Erro ao processar')
    } finally {
      setLoading(false)
    }
  }

  const getDefaultProvider = () => {
    switch (type) {
      case 'mpesa': return 'Vodacom'
      case 'cartao': return 'Visa/Mastercard'
      case 'paypal': return 'PayPal'
      default: return ''
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold">Adicionar Método de Pagamento</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tipo de Pagamento */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <button
            type="button"
            onClick={() => setType('mpesa')}
            className={`flex flex-col items-center p-4 rounded-xl border-2 transition-colors ${
              type === 'mpesa' ? 'border-red-600 bg-red-50' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <Smartphone className={`w-6 h-6 mb-2 ${type === 'mpesa' ? 'text-red-600' : 'text-gray-500'}`} />
            <span className="text-sm font-medium">M-Pesa</span>
          </button>

          <button
            type="button"
            onClick={() => setType('cartao')}
            className={`flex flex-col items-center p-4 rounded-xl border-2 transition-colors ${
              type === 'cartao' ? 'border-red-600 bg-red-50' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <CreditCard className={`w-6 h-6 mb-2 ${type === 'cartao' ? 'text-red-600' : 'text-gray-500'}`} />
            <span className="text-sm font-medium">Cartão</span>
          </button>

          <button
            type="button"
            onClick={() => setType('paypal')}
            className={`flex flex-col items-center p-4 rounded-xl border-2 transition-colors ${
              type === 'paypal' ? 'border-red-600 bg-red-50' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <Wallet className={`w-6 h-6 mb-2 ${type === 'paypal' ? 'text-red-600' : 'text-gray-500'}`} />
            <span className="text-sm font-medium">PayPal</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {type === 'mpesa' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Número M-Pesa
                </label>
                <input
                  type="tel"
                  required
                  placeholder="84/85/86 XXXXXXX"
                  value={formData.account_number}
                  onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
                <p className="text-xs text-gray-500 mt-1">Formato: 84XXXXXXX ou 85XXXXXXX</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome da Conta
                </label>
                <input
                  type="text"
                  required
                  placeholder="Nome como aparece no M-Pesa"
                  value={formData.account_name}
                  onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>
            </>
          )}

          {type === 'cartao' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Número do Cartão
                </label>
                <input
                  type="text"
                  required
                  placeholder="0000 0000 0000 0000"
                  maxLength={19}
                  value={formData.account_number}
                  onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Validade
                  </label>
                  <input
                    type="text"
                    placeholder="MM/AA"
                    maxLength={5}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    CVV
                  </label>
                  <input
                    type="text"
                    placeholder="123"
                    maxLength={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome no Cartão
                </label>
                <input
                  type="text"
                  required
                  placeholder="NOME COMPLETO"
                  value={formData.account_name}
                  onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>
            </>
          )}

          {type === 'paypal' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email PayPal
              </label>
              <input
                type="email"
                required
                placeholder="seu@email.com"
                value={formData.account_number}
                onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
            </div>
          )}

          <label className="flex items-center gap-2 py-2">
            <input
              type="checkbox"
              checked={formData.is_default}
              onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
              className="w-4 h-4 text-red-600 rounded border-gray-300 focus:ring-red-500"
            />
            <span className="text-sm text-gray-700">Definir como método padrão</span>
          </label>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Salvar
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
