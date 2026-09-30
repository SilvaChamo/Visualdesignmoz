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
  Eye,
  Search,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { panelTabList, panelTabBtn, panelCard, panelBtnPrimary, panelBtnSecondary, panelField } from '@/lib/panel-ui'
import { Spinner } from '@/components/ui/spinner'
import { buildSimpleNotificationEmailHtml } from '@/lib/renewal-templates'
import { NotificationRichEditor } from './NotificationRichEditor'

/** Extrai texto simples de HTML — usado para o título automático, o texto
 * guardado na base de dados (mostrado tal qual, sem HTML, no sino de
 * notificações do cliente) e a validação de campo vazio. */
function htmlToPlainText(html: string): string {
  if (typeof window === 'undefined') return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  const container = document.createElement('div')
  container.innerHTML = html
  return (container.textContent || '').replace(/\s+/g, ' ').trim()
}

function deriveTitle(plainText: string): string {
  if (!plainText) return 'Notificação'
  return plainText.length > 60 ? `${plainText.slice(0, 57)}...` : plainText
}

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

type NotificationsTab = 'send' | 'list'

export function NotificationsSection({
  defaultTab = 'list',
  filterCategory,
}: { defaultTab?: NotificationsTab; filterCategory?: string } = {}) {
  const [messageHtml, setMessageHtml] = useState('')
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
  const [activeTab, setActiveTab] = useState<NotificationsTab>(defaultTab)
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [modalNotification, setModalNotification] = useState<Notification | null>(null)
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 20

  const fetchNotifications = async () => {
    setLoading(true)
    try {
      const url = filterCategory
        ? `/api/notifications/admin?category=${encodeURIComponent(filterCategory)}`
        : '/api/notifications/admin'
      const res = await fetch(url)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, filterCategory])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const plainText = htmlToPlainText(messageHtml)
    if (!plainText) return
    const title = deriveTitle(plainText)

    const recipientDesc = sendToAll ? 'TODOS os clientes' : userEmail || 'o utilizador indicado'
    if (!confirm(`Confirma o envio desta notificação para ${recipientDesc}?`)) return

    setSending(true)

    try {
      const payload: any = {
        title,
        message: plainText,
        messageHtml,
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
        const emailSummary = sendEmail
          ? (sendToAll
              ? `\n📧 Emails: ${data.emailsSent} enviados${data.emailsFailed ? `, ${data.emailsFailed} falharam` : ''}`
              : `\n📧 Email: ${data.emailSent ? 'enviado' : `falhou (${data.emailError || 'erro desconhecido'})`}`)
          : ''
        alert(`✅ Notificação enviada com sucesso!\n${sendToAll ? `Enviado para ${data.count} usuários` : 'Enviado para 1 usuário'}${emailSummary}`)

        // Limpar formulário
        setMessageHtml('')
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

  const markAsRead = async (id: string) => {
    const target = notifications.find(n => n.id === id)
    if (!target || target.read) return

    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)))
    setStats(prev => ({ ...prev, unread: Math.max(0, prev.unread - 1) }))

    try {
      await fetch('/api/notifications/admin', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      })
      // Avisa a sidebar (contador do sino) para actualizar já, em vez de
      // esperar pelo próximo poll de 30s dela — sem isto o balão fica a
      // mostrar notificações já lidas como se estivessem pendentes.
      window.dispatchEvent(new Event('notifications:server-updated'))
    } catch (error) {
      console.error('Erro ao marcar como lida:', error)
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

  const filteredNotifications = notifications.filter((n) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return n.title.toLowerCase().includes(q) || n.message.toLowerCase().includes(q)
  })
  const totalPages = Math.max(1, Math.ceil(filteredNotifications.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageStart = (currentPage - 1) * PAGE_SIZE
  const pageNotifications = filteredNotifications.slice(pageStart, pageStart + PAGE_SIZE)
  const allOnPageSelected = pageNotifications.length > 0 && pageNotifications.every((n) => selectedIds.has(n.id))

  const toggleSelectAllOnPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allOnPageSelected) pageNotifications.forEach((n) => next.delete(n.id))
      else pageNotifications.forEach((n) => next.add(n.id))
      return next
    })
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const bulkMarkAsRead = async () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    await Promise.all(ids.map((id) => markAsRead(id)))
    setSelectedIds(new Set())
  }

  const bulkDelete = async () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    if (!confirm(`Tem a certeza que quer eliminar ${ids.length} notificaç${ids.length > 1 ? 'ões' : 'ão'}?`)) return
    try {
      await Promise.all(
        ids.map((id) =>
          fetch('/api/notifications/admin', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id }),
          }),
        ),
      )
      setNotifications((prev) => prev.filter((n) => !selectedIds.has(n.id)))
      setSelectedIds(new Set())
    } catch (error) {
      console.error('Erro ao eliminar em massa:', error)
    }
  }

  const openNotification = (notification: Notification) => {
    setModalNotification(notification)
    markAsRead(notification.id)
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

  /** Cor de fundo por tipo nas linhas da tabela (mesma paleta de getTypeColor,
   * só que mais suave — a versão cheia era pensada para um cartão isolado,
   * não para uma linha ao lado de outras). Lidas ficam esbatidas. */
  const getRowTint = (type: string, read: boolean) => {
    const opacity = read ? '/40' : ''
    switch (type) {
      case 'success': return `bg-green-50${opacity} dark:bg-green-900/10`
      case 'warning': return `bg-yellow-50${opacity} dark:bg-yellow-900/10`
      case 'error': return `bg-red-50${opacity} dark:bg-red-900/10`
      default: return `bg-blue-50${opacity} dark:bg-blue-900/10`
    }
  }

  const previewPlainText = htmlToPlainText(messageHtml)
  const previewTitle = deriveTitle(previewPlainText)
  const previewClientName =
    !sendToAll && userEmail.trim()
      ? (userEmail.includes('@') ? userEmail.split('@')[0] : userEmail.trim())
      : 'Cliente'

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className={panelTabList}>
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
      </div>

      {/* Tab: Enviar */}
      {activeTab === 'send' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

            {/* Mensagem — mesmo editor completo (formatação, cores, links) dos
                Templates de Renovação, sem o campo de Título separado: o título
                mostrado no sino de notificações é gerado automaticamente a
                partir do texto escrito aqui. */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mensagem</label>
              <NotificationRichEditor value={messageHtml} onChange={setMessageHtml} />
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
                Também enviar por email
              </label>
            </div>

            {/* Preview */}
            {previewPlainText && (
              <div className={`p-4 rounded-lg border ${getTypeColor(type)}`}>
                <div className="flex items-start gap-3">
                  {getTypeIcon(type)}
                  <div>
                    <p className="font-medium">{previewTitle}</p>
                    <p className="text-sm mt-1 opacity-90">{previewPlainText}</p>
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
              disabled={sending || !previewPlainText}
              className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {sending ? (
                <>
                  <Spinner className="w-5 h-5" />
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

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h4 className="font-medium text-gray-900 flex items-center gap-2 mb-4">
            <Eye className="w-5 h-5" />
            Preview ao Vivo
          </h4>
          <div className="border border-gray-200 rounded overflow-hidden">
            <div
              dangerouslySetInnerHTML={{
                __html: buildSimpleNotificationEmailHtml({
                  clientName: previewClientName,
                  title: previewPlainText ? previewTitle : '',
                  message: previewPlainText || 'A mensagem que escreveres aqui aparece assim no email.',
                  messageHtml: messageHtml || undefined,
                  link: link || undefined,
                  linkText: linkText || undefined,
                  type,
                }),
              }}
            />
          </div>
        </div>
        </div>
      )}

      {/* Tab: Listar — mesma disposição da página "Messages" do servidor
          (DirectAdmin): tabela simples com caixas de selecção, Assunto e
          Data, pesquisa e acções em massa no topo, popup ao clicar. */}
      {activeTab === 'list' && (
        <div className={`${panelCard} p-4 sm:p-6`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-zinc-100">Notificações</h3>
            <button
              onClick={fetchNotifications}
              disabled={loading}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-zinc-400 dark:hover:bg-zinc-800 rounded-lg transition-colors"
              title="Actualizar"
            >
              {loading ? <Spinner className="w-5 h-5" /> : <RefreshCw className="w-5 h-5" />}
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                placeholder="Pesquisar notificações..."
                className={`${panelField} w-full pl-9`}
              />
            </div>
            <div className="flex items-center gap-2 sm:ml-auto">
              <button
                onClick={bulkMarkAsRead}
                disabled={selectedIds.size === 0}
                className={panelBtnSecondary}
              >
                Marcar como lida
              </button>
              <button
                onClick={bulkDelete}
                disabled={selectedIds.size === 0}
                className={panelBtnPrimary}
              >
                Eliminar
              </button>
            </div>
          </div>

          {notifications.length === 0 ? (
            <div className="text-center py-12">
              <Bell className="w-16 h-16 text-gray-200 dark:text-zinc-700 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-zinc-400">Nenhuma notificação enviada ainda</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto border border-gray-200 dark:border-zinc-700 rounded-lg">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800/60 text-left text-gray-500 dark:text-zinc-400">
                      <th className="w-10 px-4 py-2.5">
                        <input
                          type="checkbox"
                          checked={allOnPageSelected}
                          onChange={toggleSelectAllOnPage}
                          className="w-4 h-4 rounded border-gray-300 dark:border-zinc-600"
                        />
                      </th>
                      <th className="px-2 py-2.5 font-medium">Assunto</th>
                      <th className="w-44 px-4 py-2.5 font-medium text-right">Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageNotifications.map((notification) => (
                      <tr
                        key={notification.id}
                        onClick={() => openNotification(notification)}
                        className={`border-b last:border-b-0 border-gray-100 dark:border-zinc-800 cursor-pointer hover:brightness-95 dark:hover:brightness-125 ${getRowTint(notification.type, notification.read)}`}
                      >
                        <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(notification.id)}
                            onChange={() => toggleSelect(notification.id)}
                            className="w-4 h-4 rounded border-gray-300 dark:border-zinc-600"
                          />
                        </td>
                        <td className="px-2 py-2.5">
                          <span className="inline-flex items-center gap-2">
                            {getTypeIcon(notification.type)}
                            {!notification.read && <span className="w-1.5 h-1.5 rounded-full bg-red-600 shrink-0" title="Não lida" />}
                            <span className={`text-gray-800 dark:text-zinc-200 ${notification.read ? '' : 'font-semibold'}`}>
                              {notification.title}
                            </span>
                            {notification.email_sent && <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-500 dark:text-zinc-400 whitespace-nowrap">
                          {new Date(notification.created_at).toLocaleString('pt-PT')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between mt-3 text-sm text-gray-500 dark:text-zinc-400">
                <span>
                  {filteredNotifications.length === 0
                    ? '0 notificações'
                    : `${pageStart + 1}-${Math.min(pageStart + PAGE_SIZE, filteredNotifications.length)} de ${filteredNotifications.length} notificações`}
                </span>
                {totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage <= 1}
                      className="p-1.5 rounded border border-gray-200 dark:border-zinc-700 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-zinc-800"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="px-2">{currentPage} / {totalPages}</span>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage >= totalPages}
                      className="p-1.5 rounded border border-gray-200 dark:border-zinc-700 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-zinc-800"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Popup com a mensagem completa — mesmo fundo (bg-black/50, sem
          desfocagem) usado nos outros popups do painel. Cresce com o
          conteúdo em vez de forçar barra de deslize interna. */}
      {modalNotification && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setModalNotification(null)} />
          <div className={`${panelCard} relative w-full max-w-2xl max-h-[85vh] overflow-y-auto`}>
            <div className="flex items-start justify-between gap-4 p-5 border-b border-gray-200 dark:border-zinc-700">
              <div className="flex items-start gap-3">
                {getTypeIcon(modalNotification.type)}
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-zinc-100">{modalNotification.title}</h4>
                  <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
                    {new Date(modalNotification.created_at).toLocaleString('pt-PT')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModalNotification(null)}
                className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5">
              <p className="text-sm text-gray-800 dark:text-zinc-200 whitespace-pre-wrap break-words select-text">
                {modalNotification.message}
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200 dark:border-zinc-700">
              <button
                onClick={() => { deleteNotification(modalNotification.id); setModalNotification(null) }}
                className={panelBtnPrimary}
              >
                <Trash2 className="w-4 h-4" />
                Eliminar
              </button>
              <button onClick={() => setModalNotification(null)} className={panelBtnSecondary}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
