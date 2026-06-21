'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Mail, ArrowLeft, RefreshCw, Inbox, Send, Trash2, AlertCircle, FileText, Archive, AlertTriangle } from 'lucide-react'

interface EmailMessage {
  id: string
  subject: string
  from: string
  to: string
  date: string
  data?: string  // Campo alternativo da API
  body: string
  folder: string
}

// Função para traduzir nomes de pastas
const getFolderDisplayName = (folderPath: string): string => {
  const displayNames: Record<string, string> = {
    'INBOX': 'Caixa de Entrada',
    'INBOX.Sent': 'Enviados',
    'Sent': 'Enviados',
    'Sent Items': 'Enviados',
    'INBOX.Trash': 'Lixo',
    'Trash': 'Lixo',
    'Deleted Items': 'Lixo',
    'INBOX.Drafts': 'Rascunhos',
    'Drafts': 'Rascunhos',
    'INBOX.Archive': 'Arquivo',
    'Archive': 'Arquivo',
    'INBOX.Junk': 'Spam',
    'Junk': 'Spam',
    'INBOX.Spam': 'Spam',
    'Spam': 'Spam',
  }
  return displayNames[folderPath] || folderPath
}

export default function EmailInboxPage() {
  const params = useParams()
  const router = useRouter()
  const email = decodeURIComponent(params.email as string)
  
  const [messages, setMessages] = useState<EmailMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedFolder, setSelectedFolder] = useState('INBOX')
  const [folders, setFolders] = useState<string[]>([])
  const [folderUnreadCounts, setFolderUnreadCounts] = useState<Record<string, number>>({})

  const loadEmails = async () => {
    setLoading(true)
    setError('')
    
    try {
      // O backend agora resolve a senha automaticamente se for admin
      const res = await fetch('/api/read-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: email, 
          folder: selectedFolder,
          limit: 30 // 🚀 CORREÇÃO: Limite adicionado para evitar overflow
        })
      })
      const data = await res.json()
      
      console.log('📧 [Admin Email] Resposta API:', { 
        success: data.success, 
        emailCount: data.emails?.length || 0,
        firstEmail: data.emails?.[0] 
      })
      
      if (data.success) {
        // 🚀 CORREÇÃO: Mapear campos da API para o formato do componente
        const mappedEmails = (data.emails || []).map((email: any) => ({
          ...email,
          from: email.from || email.de || '',  // API usa 'de'
          subject: email.subject || email.assunto || '(sem assunto)',  // API usa 'assunto'
          date: email.date || email.data || new Date().toISOString(),  // API usa 'data'
          body: email.body || email.preview || email.conteudo || ''
        }))
        console.log('📧 [Admin Email] Emails mapeados:', mappedEmails.length)
        setMessages(mappedEmails)
        if (data.folders && Array.isArray(data.folders)) {
          setFolders(data.folders)
          console.log('📁 [Admin] Pastas carregadas:', data.folders)
        }
        if (data.folderTotals) {
          setFolderUnreadCounts(data.folderTotals)
          console.log('📊 [Admin] Contagens:', data.folderTotals)
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
            onClick={() => router.push('/dashboard?page=webmail')}
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
            {folders.length === 0 ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-8 bg-gray-200 rounded animate-pulse" />
                ))}
              </div>
            ) : (
              folders.map(folder => (
                <button
                  key={folder}
                  onClick={() => setSelectedFolder(folder)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                    selectedFolder === folder 
                      ? 'bg-red-50 text-red-700' 
                      : 'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  {/* Ícone baseado na pasta */}
                  {(folder === 'INBOX' || folder.toLowerCase() === 'inbox') && <Inbox className="w-4 h-4 flex-shrink-0" />}
                  {(folder === 'Sent' || folder === 'INBOX.Sent' || folder === 'Sent Items' || folder.toLowerCase().includes('sent')) && <Send className="w-4 h-4 flex-shrink-0" />}
                  {(folder === 'Trash' || folder === 'INBOX.Trash' || folder === 'Deleted Items' || folder.toLowerCase().includes('trash') || folder.toLowerCase().includes('lixo')) && <Trash2 className="w-4 h-4 flex-shrink-0" />}
                  {(folder === 'Drafts' || folder === 'INBOX.Drafts' || folder.toLowerCase().includes('draft') || folder.toLowerCase().includes('rascunho')) && <FileText className="w-4 h-4 flex-shrink-0" />}
                  {(folder === 'Archive' || folder === 'INBOX.Archive' || folder.toLowerCase().includes('archive') || folder.toLowerCase().includes('arquivo')) && <Archive className="w-4 h-4 flex-shrink-0" />}
                  {(folder === 'Junk' || folder === 'INBOX.Junk' || folder === 'Spam' || folder === 'INBOX.Spam' || folder.toLowerCase().includes('junk') || folder.toLowerCase().includes('spam')) && <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
                  {!['INBOX', 'Sent', 'INBOX.Sent', 'Sent Items', 'Trash', 'INBOX.Trash', 'Deleted Items', 'Drafts', 'INBOX.Drafts', 'Archive', 'INBOX.Archive', 'Junk', 'INBOX.Junk', 'Spam', 'INBOX.Spam'].includes(folder) && 
                   ![folder].some(f => f.toLowerCase().includes('sent') || f.toLowerCase().includes('trash') || f.toLowerCase().includes('draft') || f.toLowerCase().includes('archive') || f.toLowerCase().includes('spam') || f.toLowerCase().includes('junk')) && 
                   <Mail className="w-4 h-4 flex-shrink-0" />}
                  
                  {/* Nome traduzido */}
                  <span className="text-sm font-medium flex-1 truncate">
                    {getFolderDisplayName(folder)}
                  </span>
                  
                  {/* Badge de não lidos */}
                  {(folderUnreadCounts[folder] || folderUnreadCounts[folder.replace('INBOX.', '')] || 0) > 0 && (
                    <span className="ml-auto bg-red-500 text-white text-xs px-2 py-0.5 rounded-full flex-shrink-0">
                      {folderUnreadCounts[folder] || folderUnreadCounts[folder.replace('INBOX.', '')] || 0}
                    </span>
                  )}
                </button>
              ))
            )}
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
                      <p className="text-xs text-gray-400">
                        {(() => {
                          try {
                            const dateStr = msg.date || msg.data
                            if (!dateStr) return 'Data desconhecida'
                            const date = new Date(dateStr)
                            if (isNaN(date.getTime())) return 'Data inválida'
                            return date.toLocaleString('pt-PT')
                          } catch {
                            return 'Data indisponível'
                          }
                        })()}
                      </p>
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
