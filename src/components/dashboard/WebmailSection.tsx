'use client'

import { useState, useEffect, useRef } from 'react'
import { 
  Mail, Inbox, Send, FileText, Trash2, Archive, Star, 
  RefreshCw, ChevronLeft, ChevronDown, Plus, ExternalLink,
  Loader2, AlertCircle, CheckCircle2, Search, Settings,
  LogOut, FolderOpen, MoreVertical, Download, Reply, Forward
} from 'lucide-react'
import { EmailWebmailSection } from './EmailWebmailSection'

// Interface para contas de email
interface EmailAccount {
  email: string
  name: string
  domain: string
  password?: string
  tipo: 'webmail' | 'google' | 'hotmail'
}

interface WebmailSectionProps {
  sites: any[]
  userEmail: string | null
  onBack: () => void
}

export function WebmailSection({ sites, userEmail, onBack }: WebmailSectionProps) {
  // Estados principais
  const [accounts, setAccounts] = useState<EmailAccount[]>([])
  const [selectedAccount, setSelectedAccount] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [activeFolder, setActiveFolder] = useState('INBOX')
  const [emails, setEmails] = useState<any[]>([])
  const [loadingEmails, setLoadingEmails] = useState(false)
  const [selectedEmail, setSelectedEmail] = useState<any>(null)
  const [showCompose, setShowCompose] = useState(false)
  const [iframeLoading, setIframeLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'list' | 'iframe'>('list')
  
  // Estado para compose avançado (EmailWebmailSection)
  const [showAdvancedCompose, setShowAdvancedCompose] = useState(false)
  
  // Estado para compose
  const [composeData, setComposeData] = useState({
    to: '',
    subject: '',
    body: ''
  })

  // Credenciais padrão (mesmas do EmailWebmailSection)
  const CREDENCIAIS_PADRAO: Record<string, string> = {
    'silva.chamo@visualdesigne.com': 'Meckito#1977?*',
    'geral@visualdesigne.com': 'Ge.Vd#2425?*',
    'admin@visualdesigne.com': 'EmailAdmin#2425',
    'info@visualdesigne.com': 'Informação!#2020?*',
    'suporte@visualdesigne.com': 'SupaEmail#2026?*',
    'noreply@visualdesigne.com': 'VisualDesign#2026',
    'eventos@oshercollective.com': 'xqqh[bLr5!&9jMv{',
    'oshercollective@gmail.com': 'gce7G)S-1FfUX)-b',
    'osher@oshercollective.com': 'gce7G)S-1FfUX)-b',
    'admin@oshetcollective.com': 'v(E1mUy7P~Yeh?G5',
    'academic@oshercollective.com': 'eS3J)tCCCoVhtHTt',
  }

  // Carregar contas de email ao montar
  useEffect(() => {
    loadEmailAccounts()
  }, [sites, userEmail])

  // Carregar emails quando mudar conta ou pasta
  useEffect(() => {
    if (selectedAccount && viewMode === 'list') {
      loadEmails()
    }
  }, [selectedAccount, activeFolder])

  const loadEmailAccounts = async () => {
    setLoading(true)
    try {
      const allAccounts: EmailAccount[] = []

      // 1. Buscar do Supabase
      try {
        const res = await fetch('/api/email-contas')
        const data = await res.json()
        if (data.success && data.contas) {
          data.contas.forEach((c: any) => {
            allAccounts.push({
              email: c.email,
              name: c.nome_conta || c.email.split('@')[0],
              domain: c.email.split('@')[1],
              password: c.password_smtp || CREDENCIAIS_PADRAO[c.email],
              tipo: c.tipo_conta || 'webmail'
            })
          })
        }
      } catch (e) {
        console.log('Erro ao buscar do Supabase:', e)
      }

      // 2. Buscar do CyberPanel para cada site
      for (const site of sites || []) {
        try {
          const res = await fetch(`/api/cyberpanel-list-emails?domain=${encodeURIComponent(site.domain)}`)
          const data = await res.json()
          if (data.success && data.emails) {
            data.emails.forEach((e: any) => {
              if (!allAccounts.find(a => a.email === e.email)) {
                allAccounts.push({
                  email: e.email,
                  name: e.user || e.email.split('@')[0],
                  domain: site.domain,
                  password: CREDENCIAIS_PADRAO[e.email],
                  tipo: 'webmail'
                })
              }
            })
          }
        } catch (e) {
          console.log(`Erro ao buscar emails de ${site.domain}:`, e)
        }
      }

      // 3. Adicionar email do usuário logado se não estiver na lista
      if (userEmail && !allAccounts.find(a => a.email === userEmail)) {
        const domain = userEmail.split('@')[1]
        allAccounts.push({
          email: userEmail,
          name: userEmail.split('@')[0],
          domain: domain,
          password: CREDENCIAIS_PADRAO[userEmail],
          tipo: 'webmail'
        })
      }

      setAccounts(allAccounts)
      
      // Selecionar primeira conta ou conta do usuário
      if (allAccounts.length > 0) {
        const userAccount = allAccounts.find(a => a.email === userEmail)
        setSelectedAccount(userAccount?.email || allAccounts[0].email)
      }
    } catch (error) {
      console.error('Erro ao carregar contas:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadEmails = async () => {
    setLoadingEmails(true)
    try {
      const account = accounts.find(a => a.email === selectedAccount)
      if (!account) return

      const password = account.password || CREDENCIAIS_PADRAO[account.email]
      if (!password) {
        console.log('Sem senha para conta:', account.email)
        return
      }

      const res = await fetch('/api/read-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: account.email,
          password: password,
          folders: [activeFolder],
          limit: 50
        })
      })

      const data = await res.json()
      if (data.success) {
        setEmails(data.emails || [])
      }
    } catch (error) {
      console.error('Erro ao carregar emails:', error)
    } finally {
      setLoadingEmails(false)
    }
  }

  const getSnappyMailUrl = () => {
    return 'https://109.199.104.22:8090/snappymail/index.php'
  }

  const openSnappyMailAutoLogin = () => {
    const account = accounts.find(a => a.email === selectedAccount)
    if (!account) {
      window.open(getSnappyMailUrl(), '_blank')
      return
    }

    const password = account.password || CREDENCIAIS_PADRAO[account.email]
    if (!password) {
      window.open(getSnappyMailUrl(), '_blank')
      return
    }

    // Criar formulário de auto-login
    const form = document.createElement('form')
    form.method = 'POST'
    form.action = getSnappyMailUrl()
    form.target = '_blank'
    form.style.display = 'none'

    const emailInput = document.createElement('input')
    emailInput.type = 'hidden'
    emailInput.name = 'Email'
    emailInput.value = account.email
    form.appendChild(emailInput)

    const passInput = document.createElement('input')
    passInput.type = 'hidden'
    passInput.name = 'Password'
    passInput.value = password
    form.appendChild(passInput)

    const actionInput = document.createElement('input')
    actionInput.type = 'hidden'
    actionInput.name = 'Action'
    actionInput.value = 'Login'
    form.appendChild(actionInput)

    document.body.appendChild(form)
    form.submit()
    document.body.removeChild(form)
  }

  const sendEmail = async () => {
    if (!composeData.to || !composeData.subject) return

    const account = accounts.find(a => a.email === selectedAccount)
    if (!account) return

    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: account.email,
          fromPassword: account.password || CREDENCIAIS_PADRAO[account.email],
          to: composeData.to,
          subject: composeData.subject,
          html: composeData.body.replace(/\n/g, '<br>')
        })
      })

      const data = await res.json()
      if (data.success) {
        setShowCompose(false)
        setComposeData({ to: '', subject: '', body: '' })
        loadEmails()
      } else {
        alert('Erro ao enviar: ' + data.error)
      }
    } catch (error) {
      alert('Erro ao enviar email')
    }
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    
    if (days === 0) {
      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    } else if (days === 1) {
      return 'Ontem'
    } else if (days < 7) {
      return date.toLocaleDateString('pt-BR', { weekday: 'short' })
    } else {
      return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    }
  }

  const folders = [
    { id: 'INBOX', name: 'Caixa de Entrada', icon: Inbox },
    { id: 'Sent', name: 'Enviados', icon: Send },
    { id: 'Drafts', name: 'Rascunhos', icon: FileText },
    { id: 'Archive', name: 'Arquivo', icon: Archive },
    { id: 'Trash', name: 'Lixo', icon: Trash2 },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-red-600" />
          <p className="text-gray-500 text-sm">A carregar contas de email...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="font-medium">Voltar</span>
          </button>
          
          <div className="h-6 w-px bg-gray-300" />
          
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-red-600" />
            <h2 className="font-bold text-gray-900">Webmail</h2>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Selector de Conta */}
          {accounts.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Conta:</span>
              <select
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
                className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
              >
                {accounts.map(acc => (
                  <option key={acc.email} value={acc.email}>
                    {acc.name} ({acc.email})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Toggle View Mode */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'list' 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Lista
            </button>
            <button
              onClick={() => setViewMode('iframe')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'iframe' 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              SnappyMail
            </button>
          </div>

          {/* Abrir SnappyMail Externo */}
          <button
            onClick={openSnappyMailAutoLogin}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Abrir Webmail Completo
          </button>
        </div>
      </div>

      {/* Content */}
      {accounts.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Mail className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-gray-900 mb-2">Nenhuma conta de email encontrada</h3>
            <p className="text-gray-500 mb-4">Não existem contas de email configuradas para os seus domínios.</p>
            <button
              onClick={onBack}
              className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
            >
              Voltar ao Email
            </button>
          </div>
        </div>
      ) : viewMode === 'iframe' ? (
        /* Modo iframe - SnappyMail integrado */
        <div className="flex-1 relative">
          {iframeLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin text-red-600 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">A carregar SnappyMail...</p>
              </div>
            </div>
          )}
          <iframe
            src={getSnappyMailUrl()}
            className="w-full h-full border-0"
            onLoad={() => setIframeLoading(false)}
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
          />
        </div>
      ) : (
        /* Modo lista - Interface própria */
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar - Folders */}
          <div className="w-56 bg-white border-r border-gray-200 flex flex-col shrink-0">
            {/* Nova Mensagem */}
            <div className="p-3">
              <button
                onClick={() => setShowAdvancedCompose(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Nova Mensagem
              </button>
            </div>

            {/* Folders */}
            <div className="flex-1 overflow-y-auto py-2">
              {folders.map(folder => {
                const Icon = folder.icon
                const isActive = activeFolder === folder.id
                const count = folder.id === 'INBOX' ? emails.filter(e => !e.read).length : 0

                return (
                  <button
                    key={folder.id}
                    onClick={() => {
                      setActiveFolder(folder.id)
                      setSelectedEmail(null)
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                      isActive 
                        ? 'bg-red-50 text-red-700 font-medium border-r-2 border-r-red-600' 
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-red-600' : 'text-gray-500'}`} />
                    <span className="flex-1 text-left">{folder.name}</span>
                    {count > 0 && (
                      <span className="bg-red-600 text-white text-xs px-2 py-0.5 rounded-full font-medium">
                        {count}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Refresh */}
            <div className="p-3 border-t border-gray-200">
              <button
                onClick={loadEmails}
                disabled={loadingEmails}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loadingEmails ? 'animate-spin' : ''}`} />
                {loadingEmails ? 'A atualizar...' : 'Atualizar'}
              </button>
            </div>
          </div>

          {/* Email List / Composer */}
          <div className="flex-1 flex flex-col min-w-0 bg-white relative">
            {/* Composer Avançado - Inline */}
            {showAdvancedCompose ? (
              <div className="flex-1 flex flex-col overflow-hidden">
                <EmailWebmailSection
                  sites={sites}
                  defaultCompose={true}
                  emailOrigem={selectedAccount || undefined}
                  onCloseCompose={() => setShowAdvancedCompose(false)}
                  onComposeStateChange={(isActive) => {
                    if (!isActive) setShowAdvancedCompose(false)
                  }}
                  hideSidebar={true}
                />
              </div>
            ) : selectedEmail ? (
              /* Email Detail View */
              <div className="flex-1 flex flex-col">
                {/* Email Header */}
                <div className="px-6 py-4 border-b border-gray-200">
                  <div className="flex items-start justify-between mb-4">
                    <button
                      onClick={() => setSelectedEmail(null)}
                      className="flex items-center gap-1 text-gray-500 hover:text-gray-900 text-sm"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Voltar
                    </button>
                    <div className="flex items-center gap-2">
                      <button className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
                        <Reply className="w-4 h-4" />
                      </button>
                      <button className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
                        <Forward className="w-4 h-4" />
                      </button>
                      <button className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <h2 className="text-xl font-bold text-gray-900 mb-3">{selectedEmail.subject}</h2>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                        {selectedEmail.from?.charAt(0).toUpperCase() || '?'}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{selectedEmail.from}</p>
                        <p className="text-sm text-gray-500">para {selectedAccount}</p>
                      </div>
                    </div>
                    <span className="text-sm text-gray-500">
                      {new Date(selectedEmail.date).toLocaleString('pt-BR')}
                    </span>
                  </div>
                </div>

                {/* Email Body */}
                <div className="flex-1 overflow-y-auto p-6">
                  <div 
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: selectedEmail.body || selectedEmail.snippet || '<p class="text-gray-400 italic">Sem conteúdo</p>' }}
                  />
                </div>
              </div>
            ) : (
              /* Email List View */
              <>
                {/* Toolbar */}
                <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-gray-900">
                      {folders.find(f => f.id === activeFolder)?.name}
                    </h3>
                    {loadingEmails && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Pesquisar emails..."
                        className="pl-9 pr-4 py-1.5 bg-gray-100 border-0 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:bg-white transition-all w-64"
                      />
                    </div>
                  </div>
                </div>

                {/* Email List */}
                <div className="flex-1 overflow-y-auto">
                  {loadingEmails ? (
                    <div className="flex items-center justify-center h-64">
                      <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                    </div>
                  ) : emails.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                      <Mail className="w-12 h-12 mb-3 opacity-30" />
                      <p>Caixa vazia</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {emails.map((email, idx) => (
                        <div
                          key={email.id || idx}
                          onClick={() => setSelectedEmail(email)}
                          className={`px-4 py-3 cursor-pointer transition-colors hover:bg-gray-50 ${
                            !email.read ? 'bg-red-50/30' : ''
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation()
                                // Toggle star
                              }}
                              className="mt-0.5 text-gray-300 hover:text-yellow-400 transition-colors"
                            >
                              <Star className={`w-4 h-4 ${email.starred ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                            </button>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-0.5">
                                <span className={`font-medium truncate ${!email.read ? 'text-gray-900' : 'text-gray-600'}`}>
                                  {email.from}
                                </span>
                                <span className="text-xs text-gray-400 shrink-0">
                                  {formatDate(email.date)}
                                </span>
                              </div>
                              <p className={`text-sm truncate ${!email.read ? 'font-medium text-gray-900' : 'text-gray-600'}`}>
                                {email.subject}
                              </p>
                              <p className="text-sm text-gray-500 truncate">
                                {email.snippet}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Compose Modal Simples (fallback) */}
      {showCompose && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-bold text-gray-900">Nova Mensagem</h3>
              <button 
                onClick={() => setShowCompose(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">De</label>
                <select
                  value={selectedAccount}
                  onChange={(e) => setSelectedAccount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                >
                  {accounts.map(acc => (
                    <option key={acc.email} value={acc.email}>{acc.email}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Para</label>
                <input
                  type="email"
                  value={composeData.to}
                  onChange={(e) => setComposeData({ ...composeData, to: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  placeholder="email@exemplo.com"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assunto</label>
                <input
                  type="text"
                  value={composeData.subject}
                  onChange={(e) => setComposeData({ ...composeData, subject: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  placeholder="Assunto do email"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mensagem</label>
                <textarea
                  value={composeData.body}
                  onChange={(e) => setComposeData({ ...composeData, body: e.target.value })}
                  rows={8}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
                  placeholder="Escreva sua mensagem..."
                />
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowCompose(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={sendEmail}
                disabled={!composeData.to || !composeData.subject}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Enviar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
