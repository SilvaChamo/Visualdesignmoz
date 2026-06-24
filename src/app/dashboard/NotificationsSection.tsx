'use client'

import { useState, useEffect } from 'react'
import { 
  Bell, 
  Send, 
  Users, 
  AlertTriangle, 
  CheckCircle, 
  Info,
  X,
  Trash2,
  RefreshCw,
  Mail,
  MessageSquare,
  Palette,
  ArrowRight
} from 'lucide-react'
import { panelTabList, panelTabBtn } from '@/lib/panel-ui'

interface Notification {
  id: string
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  category: string
  read: boolean
  user_id: string
  created_at: string
  email_sent: boolean
}

export function NotificationsSection() {
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [type, setType] = useState<'info' | 'success' | 'warning' | 'error'>('info')
  const [category, setCategory] = useState('general')
  const [sendEmail, setSendEmail] = useState(false)
  const [sendToAll, setSendToAll] = useState(true)
  const [userEmail, setUserEmail] = useState('')
  const [link, setLink] = useState('')
  const [linkText, setLinkText] = useState('')
  
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [stats, setStats] = useState({ total: 0, unread: 0, emailSent: 0 })
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [activeTab, setActiveTab] = useState<'renewal-templates' | 'send' | 'list'>('renewal-templates')

  // Redirecionar automaticamente para o editor de templates
  useEffect(() => {
    if (activeTab === 'renewal-templates') {
      const isAdmin = window.location.pathname.includes('/dashboard')
      window.location.href = isAdmin ? '/dashboard?section=renewals' : '/revendedor?section=renewals'
    }
  }, [activeTab])

  const fetchNotifications = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/notifications/admin')
      const data = await res.json()
      
      if (data.success) {
        setNotifications(data.notifications)
        setStats(data.stats)
      }
    } catch (error) {
      console.error('Erro ao buscar notificações:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'list') {
      fetchNotifications()
    }
  }, [activeTab])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSending(true)

    try {
      const payload: any = {
        title,
        message,
        type,
        category,
        sendEmail,
        sendToAll,
        link: link || undefined,
        linkText: linkText || undefined
      }

      if (!sendToAll && userEmail) {
        // Buscar user ID pelo email
        const resUser = await fetch(`/api/users/search?email=${encodeURIComponent(userEmail)}`)
        const userData = await resUser.json()
        
        if (!userData.user) {
          alert('Usuário não encontrado')
          setSending(false)
          return
        }
        
        payload.userId = userData.user.id
      }

      const res = await fetch('/api/notifications/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()

      if (data.success) {
        alert(`✅ Notificação enviada com sucesso!\n${sendToAll ? `Enviado para ${data.count} usuários` : 'Enviado para 1 usuário'}`)
        
        // Limpar formulário
        setTitle('')
        setMessage('')
        setUserEmail('')
        setLink('')
        setLinkText('')
        setSendEmail(false)
      } else {
        alert('❌ Erro: ' + data.error)
      }
    } catch (error) {
      console.error('Erro ao enviar:', error)
      alert('❌ Erro ao enviar notificação')
    } finally {
      setSending(false)
    }
  }

  const deleteNotification = async (id: string) => {
    if (!confirm('Tem certeza que deseja deletar esta notificação?')) return

    try {
      const res = await fetch('/api/notifications/admin', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      })

      if (res.ok) {
        setNotifications(prev => prev.filter(n => n.id !== id))
        alert('✅ Notificação deletada')
      }
    } catch (error) {
      console.error('Erro ao deletar:', error)
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-500" />
      case 'error': return <X className="w-4 h-4 text-red-500" />
      default: return <Info className="w-4 h-4 text-blue-500" />
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'success': return 'bg-green-100 text-green-800 border-green-200'
      case 'warning': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'error': return 'bg-red-100 text-red-800 border-red-200'
      default: return 'bg-blue-100 text-blue-800 border-blue-200'
    }
  }

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className={panelTabList}>
        <button
          onClick={() => setActiveTab('renewal-templates')}
          className={`${panelTabBtn} flex items-center gap-2 ${
            activeTab === 'renewal-templates' 
              ? 'border-b-red-500 text-red-600' 
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          <Palette className="w-4 h-4" />
          Templates Renovação
        </button>
        <button
          onClick={() => setActiveTab('send')}
          className={`${panelTabBtn} flex items-center gap-2 ${
            activeTab === 'send' 
              ? 'border-b-gray-700 text-gray-900' 
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          <Send className="w-4 h-4" />
          Enviar Notificação
        </button>
        <button
          onClick={() => setActiveTab('list')}
          className={`${panelTabBtn} flex items-center gap-2 ${
            activeTab === 'list' 
              ? 'border-b-gray-700 text-gray-900' 
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          <Bell className="w-4 h-4" />
          Histórico
          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
            {stats.total}
          </span>
        </button>
      </div>

      {/* Tab: Enviar */}
      {activeTab === 'send' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Send className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Enviar Notificação</h3>
              <p className="text-sm text-gray-500">Envie notificações para clientes específicos ou para todos</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Destinatário */}
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-3">Destinatário</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={sendToAll}
                    onChange={() => setSendToAll(true)}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-sm text-gray-700">Todos os clientes</span>
                  <Users className="w-4 h-4 text-gray-400" />
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={!sendToAll}
                    onChange={() => setSendToAll(false)}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-sm text-gray-700">Cliente específico</span>
                </label>
              </div>

              {!sendToAll && (
                <div className="mt-3">
                  <input
                    type="email"
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    placeholder="email@cliente.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    required={!sendToAll}
                  />
                </div>
              )}
            </div>

            {/* Título e Mensagem */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Manutenção Programada"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mensagem</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Descreva a notificação..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                required
              />
            </div>

            {/* Tipo e Categoria */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="info">ℹ️ Informativo</option>
                  <option value="success">✅ Sucesso</option>
                  <option value="warning">⚠️ Aviso</option>
                  <option value="error">❌ Erro</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="general">Geral</option>
                  <option value="email">Email</option>
                  <option value="domain">Domínio</option>
                  <option value="payment">Pagamento</option>
                  <option value="support">Suporte</option>
                  <option value="system">Sistema</option>
                </select>
              </div>
            </div>

            {/* Link opcional */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Link (opcional)</label>
                <input
                  type="url"
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Texto do Link</label>
                <input
                  type="text"
                  value={linkText}
                  onChange={(e) => setLinkText(e.target.value)}
                  placeholder="Ver detalhes"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>

            {/* Opções */}
            <div className="flex items-center gap-2 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
              <input
                type="checkbox"
                id="sendEmail"
                checked={sendEmail}
                onChange={(e) => setSendEmail(e.target.checked)}
                className="w-4 h-4 text-yellow-600"
              />
              <label htmlFor="sendEmail" className="flex items-center gap-2 text-sm text-yellow-800 cursor-pointer">
                <Mail className="w-4 h-4" />
                Também enviar por email (quando o sistema de email estiver funcionando)
              </label>
            </div>

            {/* Preview */}
            {title && message && (
              <div className={`p-4 rounded-lg border ${getTypeColor(type)}`}>
                <div className="flex items-start gap-3">
                  {getTypeIcon(type)}
                  <div>
                    <p className="font-medium">{title}</p>
                    <p className="text-sm mt-1 opacity-90">{message}</p>
                    {link && (
                      <p className="text-sm mt-2 underline">{linkText || 'Ver mais'}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Botão Enviar */}
            <button
              type="submit"
              disabled={sending || !title || !message}
              className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {sending ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  {sendToAll ? 'Enviar para Todos' : 'Enviar Notificação'}
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* Tab: Templates Renovação */}
      {activeTab === 'renewal-templates' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Palette className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Templates de Renovação</h3>
                <p className="text-sm text-gray-500">Edite as notificações automáticas de renovação de domínios e hospedagem</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-6 border border-purple-200">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-white rounded-xl shadow-sm">
                <Palette className="w-8 h-8 text-purple-600" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900 mb-1">Editor Completo de Templates</h4>
                <p className="text-sm text-gray-600 mb-3">
                  Acesse o editor visual para personalizar as 8 notificações automáticas de renovação. 
                  Edite títulos, mensagens, cores, emails e veja preview ao vivo.
                </p>
                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">60 dias</span>
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">45 dias</span>
                  <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded">30 dias</span>
                  <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded">15 dias</span>
                  <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded">7 dias</span>
                  <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded">3 dias</span>
                  <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded">1 dia</span>
                  <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">Confirmação</span>
                </div>
              </div>
              <button
                onClick={() => {
                  const isAdmin = window.location.pathname.includes('/dashboard')
                  window.location.href = isAdmin ? '/dashboard?section=renewals' : '/revendedor?section=renewals'
                }}
                className="px-6 py-3 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 flex items-center gap-2 shadow-lg shadow-purple-200 transition-all hover:shadow-xl"
              >
                Abrir Editor
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <h5 className="font-medium text-gray-700 mb-2 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                Variáveis Dinâmicas
              </h5>
              <p className="text-xs text-gray-500">
                Use {'{{clientName}}'}, {'{{serviceName}}'}, {'{{expirationDate}}'} e outras variáveis que são substituídas automaticamente.
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <h5 className="font-medium text-gray-700 mb-2 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                Preview ao Vivo
              </h5>
              <p className="text-xs text-gray-500">
                Veja como a notificação aparecerá para o cliente enquanto edita.
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <h5 className="font-medium text-gray-700 mb-2 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                8 Templates
              </h5>
              <p className="text-xs text-gray-500">
                Configure mensagens para 60, 45, 30, 15, 7, 3, 1 dias e confirmação.
              </p>
            </div>
          </div>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-700">
              <strong>💡 Dica:</strong> O editor completo está localizado na seção <strong>"Renovações"</strong> do menu lateral. 
              Clique no botão acima ou navegue pelo menu para acessar todas as funcionalidades.
            </p>
          </div>
        </div>
      )}

      {/* Tab: Listar */}
      {activeTab === 'list' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Bell className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Histórico de Notificações</h3>
                <p className="text-sm text-gray-500">Total: {stats.total} | Não lidas: {stats.unread} | Emails: {stats.emailSent}</p>
              </div>
            </div>
            <button
              onClick={fetchNotifications}
              disabled={loading}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {notifications.length === 0 ? (
            <div className="text-center py-12">
              <Bell className="w-16 h-16 text-gray-200 mx-auto mb-4" />
              <p className="text-gray-500">Nenhuma notificação enviada ainda</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 rounded-lg border ${getTypeColor(notification.type)} ${
                    notification.read ? 'opacity-75' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1">
                      {getTypeIcon(notification.type)}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{notification.title}</p>
                          <span className="px-2 py-0.5 bg-white/50 text-xs rounded">
                            {notification.category}
                          </span>
                          {notification.email_sent && (
                            <Mail className="w-3 h-3 text-gray-400" />
                          )}
                        </div>
                        <p className="text-sm mt-1 opacity-90">{notification.message}</p>
                        <p className="text-xs mt-2 opacity-70">
                          {new Date(notification.created_at).toLocaleString('pt-PT')}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteNotification(notification.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Deletar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
