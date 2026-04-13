'use client'

import { useState, useEffect } from 'react'
import { X, Mail, ArrowLeft, Monitor } from 'lucide-react'
import { detectDomainConfig } from '@/lib/email-autoconfig'

interface AddEmailAccountModalProps {
  isOpen: boolean
  onClose: () => void
  onAccountAdded: (account: {
    email: string
    nome: string
    tipo: 'webmail' | 'google' | 'outlook'
    password?: string
    servidor?: string
    porta?: string
    smtp?: string
    smtpPorta?: string
  }) => void
  clienteId?: string
}

export function AddEmailAccountModal({ isOpen, onClose, onAccountAdded, clienteId }: AddEmailAccountModalProps) {
  const [step, setStep] = useState<'escolher' | 'google' | 'outlook' | 'webmail'>('escolher')
  const [loading, setLoading] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    password: '',
    servidor: '',
    porta: '993',
    smtp: '',
    smtpPorta: '587',
    assinatura: ''
  })

  // Reset quando abre
  useEffect(() => {
    if (isOpen) {
      setStep('escolher')
      setFormData({
        nome: '',
        email: '',
        password: '',
        servidor: '',
        porta: '993',
        smtp: '',
        smtpPorta: '587',
        assinatura: ''
      })
      setShowAdvanced(false)
    }
  }, [isOpen])

  // Auto-detect config quando email muda
  useEffect(() => {
    if (formData.email && formData.email.includes('@')) {
      const config = detectDomainConfig(formData.email)
      if (config) {
        setFormData(prev => ({
          ...prev,
          servidor: config.imap,
          porta: config.ports.imap.toString(),
          smtp: config.smtp,
          smtpPorta: config.ports.smtp.toString()
        }))
      }
    }
  }, [formData.email])

  const handleSubmitWebmail = async () => {
    if (!formData.email || !formData.password) return
    
    setLoading(true)
    try {
      // 🔄 Usar PUT para sincronizar conta existente (do CyberPanel) no Supabase
      const res = await fetch('/api/email-contas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          nome: formData.nome,
          tipo: 'webmail',
          cliente_id: clienteId
        })
      })
      
      const data = await res.json()
      if (data.success) {
        onAccountAdded({
          email: formData.email,
          nome: formData.nome || formData.email.split('@')[0],
          tipo: 'webmail',
          password: formData.password,
          servidor: formData.servidor,
          porta: formData.porta,
          smtp: formData.smtp,
          smtpPorta: formData.smtpPorta
        })
        onClose()
      } else {
        alert('Erro ao sincronizar conta: ' + (data.error || 'Erro desconhecido'))
      }
    } catch (error: any) {
      alert('Erro ao sincronizar conta: ' + error.message)
    }
    setLoading(false)
  }

  const handleGoogleAuth = () => {
    // TODO: Implementar OAuth Google
    alert('Autenticação Google será implementada em breve!')
  }

  const handleOutlookAuth = () => {
    // TODO: Implementar OAuth Microsoft
    alert('Autenticação Microsoft será implementada em breve!')
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">
            {step === 'escolher' && 'Adicionar Conta de Email'}
            {step === 'google' && 'Adicionar Conta Gmail'}
            {step === 'outlook' && 'Adicionar Conta Outlook'}
            {step === 'webmail' && 'Sincronizar Email Executivo'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* PASSO 1: ESCOLHER TIPO */}
          {step === 'escolher' && (
            <div className="space-y-4">
              <p className="text-gray-600 text-sm mb-6">
                Escolha o tipo de conta de email que deseja adicionar:
              </p>
              
              {/* Gmail */}
              <button
                onClick={() => setStep('google')}
                className="w-full flex items-center gap-4 p-4 border-2 border-gray-200 rounded-xl hover:border-red-300 hover:bg-red-50/50 transition-all group"
              >
                <div className="w-12 h-12 bg-white rounded-lg shadow-sm flex items-center justify-center">
                  <svg className="w-8 h-8" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                </div>
                <div className="flex-1 text-left">
                  <h3 className="font-bold text-gray-900 group-hover:text-red-600 transition-colors">Google / Gmail</h3>
                  <p className="text-sm text-gray-500">Adicionar conta Gmail ou Google Workspace</p>
                </div>
                <ArrowLeft className="w-5 h-5 text-gray-400 rotate-180" />
              </button>

              {/* Outlook */}
              <button
                onClick={() => setStep('outlook')}
                className="w-full flex items-center gap-4 p-4 border-2 border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50/50 transition-all group"
              >
                <div className="w-12 h-12 bg-[#0078D4] rounded-lg flex items-center justify-center">
                  <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M21.17 3.25Q21.5 3.25 21.76 3.5 22 3.74 22 4.08V19.92Q22 20.26 21.76 20.5 21.5 20.75 21.17 20.75H7.83Q7.5 20.75 7.24 20.5 7 20.26 7 19.92V17H2.83Q2.5 17 2.24 16.76 2 16.5 2 16.17V7.83Q2 7.5 2.24 7.24 2.5 7 2.83 7H7V4.08Q7 3.74 7.24 3.5 7.5 3.25 7.83 3.25M7 13.06L8.18 15.28H9.97L8 12.06L9.93 8.89H8.22L7.13 10.9L7.09 10.96L7.06 11.03Q6.8 10.5 6.5 9.96 6.25 9.5 5.97 9L4 5H5.78L7.5 8.35L9.24 5H11L9.07 8.61 9.06 8.66 9.03 8.71L8.94 8.88 8.78 9.17 8.56 9.59C8.41 9.88 8.25 10.16 8.09 10.45 8.06 10.5 8.03 10.56 8 10.61L7 12.39V13.06M13.88 19.5V17H8.25V19.5H13.88M20.75 19.5V17H15.13V19.5H20.75M20.75 15.75V13.25H15.13V15.75H20.75M20.75 11.5V9H15.13V11.5H20.75M20.75 7.25V4.75H15.13V7.25H20.75Z"/>
                  </svg>
                </div>
                <div className="flex-1 text-left">
                  <h3 className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">Microsoft / Outlook</h3>
                  <p className="text-sm text-gray-500">Adicionar conta Outlook, Hotmail ou Office 365</p>
                </div>
                <ArrowLeft className="w-5 h-5 text-gray-400 rotate-180" />
              </button>

              {/* Webmail/Executivo */}
              <button
                onClick={() => setStep('webmail')}
                className="w-full flex items-center gap-4 p-4 border-2 border-gray-200 rounded-xl hover:border-green-300 hover:bg-green-50/50 transition-all group"
              >
                <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center">
                  <Mail className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 text-left">
                  <h3 className="font-bold text-gray-900 group-hover:text-green-600 transition-colors">Email Executivo (IMAP/POP3)</h3>
                  <p className="text-sm text-gray-500">Adicionar qualquer conta de email com servidor próprio</p>
                </div>
                <ArrowLeft className="w-5 h-5 text-gray-400 rotate-180" />
              </button>
            </div>
          )}

          {/* PASSO 2: GOOGLE */}
          {step === 'google' && (
            <div className="space-y-4">
              <button
                onClick={() => setStep('escolher')}
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar
              </button>
              
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Autenticação Google</h3>
                <p className="text-gray-600 text-sm mb-6">
                  Clique no botão abaixo para autorizar o acesso à sua conta Gmail.
                </p>
                <button
                  onClick={handleGoogleAuth}
                  className="w-full bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-bold transition-colors"
                >
                  Autorizar com Google
                </button>
              </div>
            </div>
          )}

          {/* PASSO 3: OUTLOOK */}
          {step === 'outlook' && (
            <div className="space-y-4">
              <button
                onClick={() => setStep('escolher')}
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar
              </button>
              
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-[#0078D4]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M21.17 3.25Q21.5 3.25 21.76 3.5 22 3.74 22 4.08V19.92Q22 20.26 21.76 20.5 21.5 20.75 21.17 20.75H7.83Q7.5 20.75 7.24 20.5 7 20.26 7 19.92V17H2.83Q2.5 17 2.24 16.76 2 16.5 2 16.17V7.83Q2 7.5 2.24 7.24 2.5 7 2.83 7H7V4.08Q7 3.74 7.24 3.5 7.5 3.25 7.83 3.25M7 13.06L8.18 15.28H9.97L8 12.06L9.93 8.89H8.22L7.13 10.9L7.09 10.96L7.06 11.03Q6.8 10.5 6.5 9.96 6.25 9.5 5.97 9L4 5H5.78L7.5 8.35L9.24 5H11L9.07 8.61 9.06 8.66 9.03 8.71L8.94 8.88 8.78 9.17 8.56 9.59C8.41 9.88 8.25 10.16 8.09 10.45 8.06 10.5 8.03 10.56 8 10.61L7 12.39V13.06M13.88 19.5V17H8.25V19.5H13.88M20.75 19.5V17H15.13V19.5H20.75M20.75 15.75V13.25H15.13V15.75H20.75M20.75 11.5V9H15.13V11.5H20.75M20.75 7.25V4.75H15.13V7.25H20.75Z"/>
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Autenticação Microsoft</h3>
                <p className="text-gray-600 text-sm mb-6">
                  Clique no botão abaixo para autorizar o acesso à sua conta Outlook.
                </p>
                <button
                  onClick={handleOutlookAuth}
                  className="w-full bg-[#0078D4] hover:bg-[#006CBD] text-white px-6 py-3 rounded-xl font-bold transition-colors"
                >
                  Autorizar com Microsoft
                </button>
              </div>
            </div>
          )}

          {/* PASSO 4: WEBMAIL/EXECUTIVO */}
          {step === 'webmail' && (
            <div className="space-y-4">
              <button
                onClick={() => setStep('escolher')}
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar
              </button>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
                  <input
                    type="text"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    placeholder="Seu nome"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="seu@email.com"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Palavra-passe *</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="••••••••"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>

                {/* Configurações Avançadas */}
                <div className="pt-2">
                  <button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
                  >
                    {showAdvanced ? 'Ocultar' : 'Mostrar'} configurações avançadas
                  </button>
                  
                  {showAdvanced && (
                    <div className="mt-3 p-4 bg-gray-50 rounded-xl border border-gray-200 grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Servidor IMAP</label>
                        <input
                          type="text"
                          value={formData.servidor}
                          onChange={(e) => setFormData({ ...formData, servidor: e.target.value })}
                          className="w-full bg-white border border-gray-200 text-gray-700 text-xs px-3 py-2 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Porta IMAP</label>
                        <input
                          type="text"
                          value={formData.porta}
                          onChange={(e) => setFormData({ ...formData, porta: e.target.value })}
                          className="w-full bg-white border border-gray-200 text-gray-700 text-xs px-3 py-2 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Servidor SMTP</label>
                        <input
                          type="text"
                          value={formData.smtp}
                          onChange={(e) => setFormData({ ...formData, smtp: e.target.value })}
                          className="w-full bg-white border border-gray-200 text-gray-700 text-xs px-3 py-2 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Porta SMTP</label>
                        <input
                          type="text"
                          value={formData.smtpPorta}
                          onChange={(e) => setFormData({ ...formData, smtpPorta: e.target.value })}
                          className="w-full bg-white border border-gray-200 text-gray-700 text-xs px-3 py-2 rounded-lg"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-blue-50 border-l-4 border-blue-400 rounded-lg p-3 mt-4">
                  <p className="text-xs text-blue-700 font-bold mb-1 uppercase">Suporte VisualDesigne:</p>
                  <p className="text-xs text-blue-600">
                    Detectamos automaticamente as configurações de domínio. Preencha o email e palavra-passe.
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-between pt-4">
                <button
                  onClick={() => setStep('escolher')}
                  className="px-5 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-bold transition-colors"
                >
                  Anterior
                </button>
                <button
                  onClick={handleSubmitWebmail}
                  disabled={!formData.email || !formData.password || loading}
                  className="px-5 py-2 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-bold flex items-center gap-2 transition-all"
                >
                  {loading ? '⏳ A sincronizar...' : 'Adicionar e Sincronizar'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
