'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Mail, ArrowLeft, RefreshCw, Inbox, Send, Trash2, AlertCircle } from 'lucide-react'

interface EmailMessage {
  id: string
  subject: string
  from: string
  to: string
  date: string
  body: string
  folder: string
}

export default function EmailInboxPage() {
  const params = useParams()
  const router = useRouter()
  const email = decodeURIComponent(params.email as string)
  
  const [messages, setMessages] = useState<EmailMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedFolder, setSelectedFolder] = useState('INBOX')
  const [folders, setFolders] = useState<string[]>(['INBOX', 'Sent', 'Trash'])

  const loadEmails = async () => {
    setLoading(true)
    setError('')
    
    try {
      const res = await fetch(`/api/read-emails?email=${encodeURIComponent(email)}&folder=${selectedFolder}`)
      const data = await res.json()
      
      if (data.success) {
        setMessages(data.emails || [])
        if (data.folders) {
          setFolders(data.folders)
        }
      } else {
        setError(data.error || 'Erro ao carregar emails')
      }
    } catch (err) {
      setError('Erro ao conectar ao servidor')
    }
    
    setLoading(false)
  }

  useEffect(() => {
    if (email) {
      loadEmails()
    }
  }, [email, selectedFolder])

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/admin?page=webmail')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Voltar</span>
          </button>
          
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-3">
              <Mail className="w-6 h-6 text-red-600" />
              Caixa de Entrada: {email}
            </h1>
          </div>
          
          <button
            onClick={loadEmails}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>
      </div>

      <div className="flex h-[calc(100vh-80px)]">
        {/* Sidebar - Folders */}
        <div className="w-64 bg-white border-r border-gray-200 p-4">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Pastas</h2>
          <div className="space-y-1">
            {folders.map(folder => (
              <button
                key={folder}
                onClick={() => setSelectedFolder(folder)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                  selectedFolder === folder 
                    ? 'bg-red-50 text-red-700' 
                    : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                {folder === 'INBOX' && <Inbox className="w-4 h-4" />}
                {folder === 'Sent' && <Send className="w-4 h-4" />}
                {folder === 'Trash' && <Trash2 className="w-4 h-4" />}
                {!['INBOX', 'Sent', 'Trash'].includes(folder) && <Mail className="w-4 h-4" />}
                <span className="text-sm font-medium">
                  {folder === 'INBOX' ? 'Caixa de Entrada' : 
                   folder === 'Sent' ? 'Enviados' : 
                   folder === 'Trash' ? 'Lixo' : folder}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Email List */}
        <div className="flex-1 p-6 overflow-auto">
          {error && (
            <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="bg-white border border-gray-200 rounded-lg p-4 animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12">
              <Mail className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Nenhum email encontrado nesta pasta</p>
            </div>
          ) : (
            <div className="space-y-2">
              {messages.map((msg) => (
                <div 
                  key={msg.id} 
                  className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-1">{msg.subject}</h3>
                      <p className="text-sm text-gray-500 mb-2">
                        De: <span className="text-gray-700">{msg.from}</span>
                      </p>
                      <p className="text-xs text-gray-400">{new Date(msg.date).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-sm text-gray-600 line-clamp-2">{msg.body}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
