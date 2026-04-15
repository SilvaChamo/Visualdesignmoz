'use client'

import { useState, useEffect, useRef } from 'react'
import { 
  Mail, Inbox, Send, FileText, Trash2, Archive, Star, Filter, 
  RefreshCw, ChevronLeft, ChevronDown, Plus, ExternalLink,
  Loader2, AlertCircle, CheckCircle2, Search, Settings,
  LogOut, FolderOpen, MoreVertical, Download, Reply, ReplyAll, Forward, Pencil, Image as ImageIcon, X
} from 'lucide-react'
import { EmailWebmailSection } from './EmailWebmailSection'
import { AddEmailAccountModal } from '@/components/AddEmailAccountModal'

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
  onBack?: () => void
  // Props para adicionar conta
  mostrarAdicionarConta?: boolean
  setMostrarAdicionarConta?: (value: boolean) => void
  modalAdicionarPasso?: 'escolher' | 'webmail' | 'google' | 'hotmail'
  setModalAdicionarPasso?: (value: 'escolher' | 'webmail' | 'google' | 'hotmail') => void
  // Prop para usar API do CyberPanel (modo admin)
  useCyberPanelAPI?: boolean
  emailOrigem?: string
  onComposeStateChange?: (isActive: boolean) => void
  isAdmin?: boolean
}

export function WebmailSection({ 
  sites, 
  userEmail, 
  onBack,
  mostrarAdicionarConta,
  setMostrarAdicionarConta,
  modalAdicionarPasso,
  setModalAdicionarPasso,
  useCyberPanelAPI = false,
  emailOrigem,
  onComposeStateChange,
  isAdmin = false
}: WebmailSectionProps) {
  // Estados principais
  const [accounts, setAccounts] = useState<EmailAccount[]>([])
  const [selectedAccount, setSelectedAccount] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const hasLoadedAccounts = useRef(false)
  const [activeFolder, setActiveFolder] = useState('INBOX')
  const [emails, setEmails] = useState<any[]>([])
  const [loadingEmails, setLoadingEmails] = useState(false)
  const [selectedEmail, setSelectedEmail] = useState<any>(null)
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set())
  const [showCompose, setShowCompose] = useState(false)
  const [iframeLoading, setIframeLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'list' | 'iframe'>('list')
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')

  // Estado para criação de e-mail no servidor
  const [showCreateEmailModal, setShowCreateEmailModal] = useState(false)
  const [creatingEmail, setCreatingEmail] = useState(false)
  const [createEmailError, setCreateEmailError] = useState('')
  const [createEmailSuccess, setCreateEmailSuccess] = useState('')
  const [createEmailForm, setCreateEmailForm] = useState({
    user: '',
    password: '',
    domain: '',
    quota: '500'
  })

  // Debounce para pesquisa
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Estado para compose avançado (EmailWebmailSection)
  const [showAdvancedCompose, setShowAdvancedCompose] = useState(false)
  
  // Estados para assinaturas - sistema completo copiado do EmailWebmailSection
  const [assinatura, setAssinatura] = useState('')
  const [mostrarConfigAssinatura, setMostrarConfigAssinatura] = useState(false)
  const [mostrarEditarAssinatura, setMostrarEditarAssinatura] = useState(false)
  const [modoEscuroAssinatura, setModoEscuroAssinatura] = useState(true) // Padrão: modo escuro
  const assinaturaEditorRef = useRef<HTMLDivElement>(null)
  // Estrutura de assinaturas: { [email: string]: { assinaturas: Array, assinaturaAtiva: number, assinaturaPadrao: string } }
  const STORAGE_KEY = 'webmail_assinaturas_v2'

  const [assinaturasPorEmail, setAssinaturasPorEmail] = useState<Record<string, any>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        try {
          return JSON.parse(saved)
        } catch (e) {
          console.error('Erro ao carregar assinaturas:', e)
        }
      }
    }
    return {}
  })
  // Ref para acessar valor atual sem causar re-render
  const assinaturasPorEmailRef = useRef(assinaturasPorEmail)
  useEffect(() => {
    assinaturasPorEmailRef.current = assinaturasPorEmail
  }, [assinaturasPorEmail])

  // Assinaturas da conta atual - inicia vazio, carrega do localStorage por email
  const [assinaturas, setAssinaturas] = useState<{ nome: string, activa: boolean, texto: string, imagemUrl: string }[]>([])
  const [assinaturaAtiva, setAssinaturaAtiva] = useState(0)
  
  // Estado para compose
  const [composeData, setComposeData] = useState({
    to: '',
    subject: '',
    body: ''
  })

  // Domínios permitidos no painel admin
  const ALLOWED_DOMAINS = ['visualdesigne.com', 'anap.co.mz', 'entrecampos.co.mz']

  // Credenciais padrão (mesmas do EmailWebmailSection)
  const CREDENCIAIS_PADRAO: Record<string, string> = {
    'silva.chamo@visualdesigne.com': 'Meckito#1977?*',
    'duduchamatavele@visualdesigne.com': 'Dudu#2425?*',
    'geral@visualdesigne.com': 'Ge.Vd#2425?*',
    'admin@visualdesigne.com': 'Ad.Vd#2425?*',
    'info@visualdesigne.com': 'Informação!#2020?*',
    'suporte@visualdesigne.com': 'SupaEmail#2026?*',
    'noreply@visualdesigne.com': 'VisualDesign#2026',
    'eventos@oshercollective.com': 'xqqh[bLr5!&9jMv{',
    'oshercollective@gmail.com': 'gce7G)S-1FfUX)-b',
    'osher@oshercollective.com': 'gce7G)S-1FfUX)-b',
    'admin@oshetcollective.com': 'v(E1mUy7P~Yeh?G5',
    'academic@oshercollective.com': 'eS3J)tCCCoVhtHTt',
  }

  // Carregar contas apenas uma vez na montagem do componente
  useEffect(() => {
    if ((sites.length > 0 || userEmail) && !hasLoadedAccounts.current) {
      hasLoadedAccounts.current = true
      loadEmailAccounts()
    }
  }, [sites, userEmail])

  // Notificar parent quando estado do compose muda (para admin)
  useEffect(() => {
    if (onComposeStateChange) {
      onComposeStateChange(showAdvancedCompose)
    }
  }, [showAdvancedCompose, onComposeStateChange])

  // Carregar emails quando mudar conta ou pasta
  useEffect(() => {
    if (selectedAccount && viewMode === 'list') {
      loadEmails()
    }
  }, [selectedAccount, activeFolder, debouncedSearchQuery])

  // SINCRONIZAÇÃO: Carregar assinaturas quando email muda
  useEffect(() => {
    if (selectedAccount && assinaturasPorEmail[selectedAccount]) {
      const config = assinaturasPorEmail[selectedAccount]
      setAssinaturas(config.assinaturas || [])
      setAssinaturaAtiva(config.assinaturaAtiva || 0)
    } else {
      setAssinaturas([])
      setAssinaturaAtiva(0)
    }
  }, [selectedAccount])

  // SINCRONIZAÇÃO: Salvar assinaturas no localStorage quando mudam
  useEffect(() => {
    if (selectedAccount && typeof window !== 'undefined') {
      const config = { assinaturas, assinaturaAtiva, assinaturaPadrao: assinatura }
      const novoEstado = { ...assinaturasPorEmailRef.current, [selectedAccount]: config }
      assinaturasPorEmailRef.current = novoEstado
      setAssinaturasPorEmail(novoEstado)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(novoEstado))
    }
  }, [assinaturas, assinaturaAtiva, assinatura])

  const loadEmailAccounts = async () => {
    setLoading(true)
    try {
      const allAccounts: EmailAccount[] = []

      // 1. Buscar do Supabase (endpoint principal)
      const fetchSupabase = async () => {
        try {
          const res = await fetch('/api/email-contas')
          const data = await res.json()
          if (data.success && data.contas) {
            return data.contas.map((c: any) => ({
              email: c.email,
              name: c.nome_conta || c.email.split('@')[0],
              domain: c.email.split('@')[1],
              password: c.password_smtp || CREDENCIAIS_PADRAO[c.email],
              tipo: c.tipo_conta || 'webmail'
            }))
          }
        } catch (e) {
          console.error('Erro ao buscar do Supabase:', e)
        }
        return []
      }

      // 2. Buscar do CyberPanel para cada site em paralelo
      const fetchContactsPromises = (sites || []).map(async (site: any) => {
        try {
          const res = await fetch(`/api/get-all-contacts?domain=${encodeURIComponent(site.domain)}&includeSupabase=true`)
          const data = await res.json()
          if (data.success && data.emails) {
            return data.emails.map((email: string) => ({
              email: email,
              name: email.split('@')[0],
              domain: site.domain,
              password: CREDENCIAIS_PADRAO[email],
              tipo: 'webmail'
            }))
          }
        } catch (e) {
          console.error(`Erro ao buscar contactos de ${site.domain}:`, e)
        }
        return []
      })

      // Executar todas as promessas em paralelo
      const results = await Promise.all([fetchSupabase(), ...fetchContactsPromises])
      
      // Consolidar resultados
      results.flat().forEach(acc => {
        if (!allAccounts.find(a => a.email === acc.email)) {
          allAccounts.push(acc)
        }
      })

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

      // 🚫 FILTRO: Apenas domínios permitidos se for ADMIN (remove clientes do painel de controle vd)
      const filteredAccounts = isAdmin 
        ? allAccounts.filter(acc => {
            const domain = acc.email.split('@')[1]
            return ALLOWED_DOMAINS.includes(domain)
          })
        : allAccounts // 🚀 CLIENTE: Vê todos os seus domínios

      setAccounts(filteredAccounts)
      
      // Selecionar a conta por defeito (silva.chamo > conta do usuário > primeira da lista)
      if (filteredAccounts.length > 0) {
        const silvaAccount = filteredAccounts.find(a => a.email === 'silva.chamo@visualdesigne.com')
        const userAccount = filteredAccounts.find(a => a.email === userEmail)
        setSelectedAccount(silvaAccount?.email || userAccount?.email || filteredAccounts[0].email)
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
          limit: 50,
          search: debouncedSearchQuery
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

  const handleCreateServerEmail = async () => {
    if (!createEmailForm.user || !createEmailForm.password || !createEmailForm.domain) {
      setCreateEmailError('Por favor, preencha todos os campos.')
      return
    }

    setCreatingEmail(true)
    setCreateEmailError('')
    setCreateEmailSuccess('')

    try {
      const res = await fetch('/api/cyberpanel-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domainName: createEmailForm.domain,
          userName: createEmailForm.user,
          password: createEmailForm.password,
          quota: createEmailForm.quota || 500
        })
      })

      const data = await res.json()
      if (data.success) {
        setCreateEmailSuccess('Conta de e-mail criada com sucesso!')
        
        // Sincronizar com o banco de dados via API
        await fetch('/api/email-contas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: `${createEmailForm.user}@${createEmailForm.domain}`,
            password: createEmailForm.password,
            nome: createEmailForm.user,
            tipo: 'webmail'
          })
        })

        setTimeout(() => {
          setShowCreateEmailModal(false)
          setCreateEmailSuccess('')
          setCreateEmailForm({ user: '', password: '', domain: '', quota: '500' })
          window.location.reload()
        }, 1500)
      } else {
        setCreateEmailError(data.error || 'Erro ao criar conta de e-mail.')
      }
    } catch (error: any) {
      setCreateEmailError('Erro técnico: ' + error.message)
    } finally {
      setCreatingEmail(false)
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
    if (!account) {
      alert('Erro: Conta de email não selecionada')
      return
    }

    // Verificar se temos senha para esta conta
    const password = account.password || CREDENCIAIS_PADRAO[account.email]
    if (!password) {
      alert(`Erro: Senha não configurada para ${account.email}.\n\nConfigure a senha em "Configurações" ou adicione-a ao sistema.`)
      console.error('❌ Senha não encontrada para:', account.email)
      console.log('💡 Contas com senha configurada:', Object.keys(CREDENCIAIS_PADRAO))
      return
    }

    console.log('📧 Enviando email de:', account.email)
    console.log('📧 Para:', composeData.to)

    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: account.email,
          fromPassword: password,
          to: composeData.to,
          subject: composeData.subject,
          html: composeData.body.replace(/\n/g, '<br>')
        })
      })

      const data = await res.json()
      console.log('📧 Resposta da API:', data)

      if (data.success) {
        setShowCompose(false)
        setComposeData({ to: '', subject: '', body: '' })
        alert('✅ Email enviado com sucesso!')
        loadEmails()
      } else {
        alert('Erro ao enviar: ' + (data.error || data.details || 'Erro desconhecido'))
      }
    } catch (error) {
      console.error('❌ Erro ao enviar:', error)
      alert('Erro ao enviar email. Verifique o console para mais detalhes.')
    }
  }

  // 🗑️ Apagar email
  const handleDeleteEmail = async (emailId?: string) => {
    if (!emailId) return
    
    const account = accounts.find(a => a.email === selectedAccount)
    if (!account) {
      alert('Selecione uma conta primeiro')
      return
    }

    const password = account.password || CREDENCIAIS_PADRAO[account.email]
    if (!password) {
      alert('Senha não disponível para esta conta')
      return
    }

    try {
      const res = await fetch('/api/delete-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: account.email,
          password: password,
          emailId: emailId,
          folder: activeFolder
        })
      })
      
      const data = await res.json()
      if (data.success) {
        // Atualizar lista local
        setEmails(prev => prev.filter(e => e.id !== emailId && e.uid !== emailId))
        setSelectedEmail(null)
      } else {
        alert('Erro ao apagar: ' + (data.error || 'Erro desconhecido'))
      }
    } catch (error) {
      console.error('Erro ao apagar email:', error)
      alert('Erro ao apagar email')
    }
  }

  // 📦 Arquivar email
  const handleArchiveEmail = async (emailId?: string) => {
    if (!emailId) return
    
    const account = accounts.find(a => a.email === selectedAccount)
    if (!account) {
      alert('Selecione uma conta primeiro')
      return
    }

    const password = account.password || CREDENCIAIS_PADRAO[account.email]
    if (!password) {
      alert('Senha não disponível para esta conta')
      return
    }

    try {
      const res = await fetch('/api/archive-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: account.email,
          password: password,
          emailId: emailId,
          fromFolder: activeFolder,
          toFolder: 'Archive'
        })
      })
      
      const data = await res.json()
      if (data.success) {
        // Atualizar lista local
        setEmails(prev => prev.filter(e => e.id !== emailId && e.uid !== emailId))
        if (selectedEmail?.id === emailId) {
          setSelectedEmail(null)
        }
      } else {
        alert('Erro ao arquivar: ' + (data.error || 'Erro desconhecido'))
      }
    } catch (error) {
      console.error('Erro ao arquivar email:', error)
      alert('Erro ao arquivar email')
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
      <div className="flex flex-col bg-gray-50 h-[calc(100vh-120px)]">
        {/* Header Skeleton */}
        <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            {/* Botão Voltar skeleton */}
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-gray-200 rounded-full animate-pulse" />
              <div className="h-4 w-12 bg-gray-200 rounded animate-pulse" />
            </div>
            <div className="h-6 w-px bg-gray-300" />
            {/* Título Webmail skeleton */}
            <div className="h-6 w-20 bg-gray-200 rounded animate-pulse" />
          </div>
          {/* Selector de Conta skeleton */}
          <div className="flex items-center gap-2">
            <div className="h-4 w-12 bg-gray-200 rounded animate-pulse" />
            <div className="h-8 w-48 bg-gray-200 rounded-lg animate-pulse" />
          </div>
          {/* Botões direita skeleton */}
          <div className="flex items-center gap-2">
            <div className="h-8 w-24 bg-gray-200 rounded-lg animate-pulse" />
            <div className="h-8 w-32 bg-gray-200 rounded-lg animate-pulse" />
          </div>
        </div>

        {/* Content Skeleton - Layout 3 colunas (Sidebar | Lista | Preview) */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar Skeleton */}
          <div className="w-64 bg-white border-r border-gray-200 flex flex-col shrink-0">
            {/* Botão Nova Mensagem skeleton */}
            <div className="p-4">
              <div className="h-10 w-full bg-gray-200 rounded-lg animate-pulse" />
            </div>
            {/* Lista de Folders skeleton */}
            <div className="flex-1 px-3 space-y-2">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-lg">
                  <div className="w-5 h-5 bg-gray-200 rounded animate-pulse" />
                  <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
                  <div className="ml-auto h-4 w-6 bg-gray-200 rounded animate-pulse" />
                </div>
              ))}
            </div>
            {/* Botão Atualizar skeleton */}
            <div className="p-3 border-t border-gray-200">
              <div className="h-9 w-full bg-gray-200 rounded-lg animate-pulse" />
            </div>
          </div>

          {/* Lista de Emails Skeleton */}
          <div className="flex-1 bg-white flex flex-col min-w-0">
            {/* Barra de ferramentas skeleton */}
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-5 w-5 bg-gray-200 rounded animate-pulse" />
                <div className="h-5 w-32 bg-gray-200 rounded animate-pulse" />
              </div>
              <div className="flex items-center gap-2">
                <div className="h-8 w-24 bg-gray-200 rounded-lg animate-pulse" />
                <div className="h-8 w-24 bg-gray-200 rounded-lg animate-pulse" />
              </div>
            </div>
            {/* Lista skeleton com detalhes */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg border-b border-gray-100 hover:bg-gray-50">
                  <div className="w-5 h-5 bg-gray-200 rounded animate-pulse mt-0.5 flex-shrink-0" />
                  <div className="w-8 h-8 bg-gray-300 rounded-full animate-pulse flex-shrink-0" />
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="h-3.5 w-32 bg-gray-200 rounded animate-pulse" />
                      <div className="h-2.5 w-10 bg-gray-150 rounded animate-pulse" />
                    </div>
                    <div className="h-3 w-full bg-gray-150 rounded animate-pulse" />
                    <div className="h-2.5 w-4/5 bg-gray-100 rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Painel de Preview Skeleton */}
          <div className="w-[45%] bg-white border-l border-gray-200 flex flex-col shrink-0">
            {/* Header do email skeleton */}
            <div className="p-4 border-b border-gray-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="h-5 w-48 bg-gray-200 rounded animate-pulse" />
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 bg-gray-200 rounded-full animate-pulse" />
                  <div className="h-8 w-8 bg-gray-200 rounded-full animate-pulse" />
                  <div className="h-8 w-8 bg-gray-200 rounded-full animate-pulse" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-gray-300 rounded-full animate-pulse flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-32 bg-gray-200 rounded animate-pulse" />
                  <div className="h-2.5 w-48 bg-gray-150 rounded animate-pulse" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-16 bg-gray-150 rounded animate-pulse" />
                <div className="h-2.5 w-40 bg-gray-100 rounded animate-pulse" />
              </div>
            </div>
            {/* Corpo do email skeleton */}
            <div className="flex-1 p-4 space-y-2.5 overflow-y-auto">
              <div className="h-3 w-full bg-gray-150 rounded animate-pulse" />
              <div className="h-3 w-[95%] bg-gray-150 rounded animate-pulse" />
              <div className="h-3 w-[90%] bg-gray-150 rounded animate-pulse" />
              <div className="h-3 w-full bg-gray-150 rounded animate-pulse" />
              <div className="h-3 w-[88%] bg-gray-150 rounded animate-pulse" />
              <div className="h-3 w-[92%] bg-gray-150 rounded animate-pulse" />
              <div className="mt-4 space-y-2.5">
                <div className="h-3 w-full bg-gray-150 rounded animate-pulse" />
                <div className="h-3 w-[85%] bg-gray-150 rounded animate-pulse" />
                <div className="h-20 w-full bg-gray-200 rounded animate-pulse" />
              </div>
<div className="mt-4 space-y-2.5">
                <div className="h-3 w-[80%] bg-gray-150 rounded animate-pulse" />
                <div className="h-3 w-full bg-gray-150 rounded animate-pulse" />
                <div className="h-3 w-[92%] bg-gray-150 rounded animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex flex-col bg-gray-50 ${showAdvancedCompose ? 'h-screen' : 'h-[calc(100vh-120px)]'}`}>
      {!showAdvancedCompose && (
        <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            {onBack && (
              <button
                onClick={onBack}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Voltar
              </button>
            )}
            <div className="w-px h-5 bg-gray-200" />
            <span className="text-base font-bold text-gray-900">Webmail</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Conta:</span>
              <select
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
                disabled={accounts.length === 0}
                className="px-3 py-1.5 bg-white border border-gray-300 rounded-md text-sm font-medium focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none disabled:bg-gray-50 disabled:text-gray-400"
              >
                {accounts.length > 0 ? (
                  accounts.map(acc => (
                    <option key={acc.email} value={acc.email}>
                      {acc.name} ({acc.email})
                    </option>
                  ))
                ) : (
                  <option value="">Nenhuma conta disponível</option>
                )}
              </select>
            </div>

            <button
              onClick={openSnappyMailAutoLogin}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Abrir Webmail Completo
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {!showAdvancedCompose && (
          <div className="bg-white border-r border-gray-200 flex flex-col shrink-0 w-56">
            <div className="p-4 border-b border-gray-100">
              <button
                onClick={() => setShowAdvancedCompose(true)}
                disabled={accounts.length === 0}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-md transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-5 h-5" />
                Nova Mensagem
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-2">
              {folders.map(folder => {
                const Icon = folder.icon
                const isActive = activeFolder === folder.id
                const count = (accounts.length > 0 && folder.id === 'INBOX') 
                  ? emails.filter(e => !e.read).length 
                  : 0

                return (
                  <button
                    key={folder.id}
                    disabled={accounts.length === 0}
                    onClick={() => {
                      setActiveFolder(folder.id)
                      setSelectedEmail(null)
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                      isActive 
                        ? 'bg-red-50 text-red-700 font-medium border-r-2 border-r-red-600' 
                        : 'text-gray-700 hover:bg-gray-50'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
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
            
            {accounts.length > 0 && (
              <div className="p-3 border-t border-gray-100">
                <button
                  onClick={loadEmails}
                  disabled={loadingEmails}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs text-gray-500 hover:text-red-600 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingEmails ? 'animate-spin' : ''}`} />
                  Atualizar Pasta
                </button>
              </div>
            )}
          </div>
        )}

        <div className="flex-1 flex flex-col overflow-hidden">
          {accounts.length === 0 ? (
            <div className="flex-1 flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <Mail className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-gray-900 mb-2">Nenhuma conta encontrada</h3>
                <p className="text-gray-500 mb-6 px-6 max-w-md mx-auto">
                  Não existem contas de email configuradas para os domínios deste painel.
                </p>
                <button
                  onClick={onBack}
                  className="px-6 py-2 bg-red-600 text-white rounded-md font-bold hover:bg-red-700 transition-all shadow-md"
                >
                  Voltar ao Painel
                </button>
              </div>
            </div>
          ) : showAdvancedCompose ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              <EmailWebmailSection
                sites={sites}
                defaultCompose={true}
                emailOrigem={selectedAccount || undefined}
                onCloseCompose={() => setShowAdvancedCompose(false)}
                onComposeStateChange={(isActive) => {
                  if (!isActive && showAdvancedCompose) setShowAdvancedCompose(false)
                }}
                hideSidebar={true}
                externalAssinaturas={assinaturas}
                externalAssinaturaAtiva={assinaturaAtiva}
                externalSetAssinaturas={setAssinaturas}
                externalSetAssinaturaAtiva={setAssinaturaAtiva}
                externalAssinaturasPorEmailRef={assinaturasPorEmailRef}
                externalModoEscuro={modoEscuroAssinatura}
                isAdmin={isAdmin}
              />
            </div>
          ) : viewMode === 'iframe' ? (
            <div className="flex-1 relative">
              {iframeLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
                  <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-red-600 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">A carregar Webmail...</p>
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
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="px-4 py-2 border-b border-gray-100 flex items-center gap-3 bg-white shrink-0">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedEmails.size === emails.length && emails.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedEmails(new Set(emails.map(email => email.id || email.uid)))
                      } else {
                        setSelectedEmails(new Set())
                      }
                    }}
                    className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                  />
                  <span className="text-sm font-bold text-gray-900 whitespace-nowrap">
                    {folders.find(f => f.id === activeFolder)?.name}
                  </span>
                  {selectedEmails.size > 0 && (
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded whitespace-nowrap">
                      {selectedEmails.size} selecionado(s)
                    </span>
                  )}
                  {loadingEmails && <Loader2 className="w-3.5 h-3.5 animate-spin text-red-600" />}
                </div>

                <div className="w-px h-4 bg-gray-200" />

                <div className="flex items-center gap-1.5">
                  <button 
                    onClick={loadEmails} 
                    className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    title="Atualizar"
                  >
                    <RefreshCw className={`w-4 h-4 ${loadingEmails ? 'animate-spin' : ''}`} />
                  </button>
                  <button 
                    className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                    title="Filtrar"
                  >
                    <Filter className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex-1" />

                <div className="relative w-64">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Pesquisar..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-md text-xs focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (selectedAccount && assinaturasPorEmailRef.current[selectedAccount]) {
                        const config = assinaturasPorEmailRef.current[selectedAccount]
                        setAssinaturas(config.assinaturas || [])
                        setAssinaturaAtiva(config.assinaturaAtiva || 0)
                      } else if (selectedAccount) {
                        setAssinaturas([])
                        setAssinaturaAtiva(0)
                      }
                      setMostrarConfigAssinatura(true)
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 text-gray-600 hover:text-red-500 hover:border-red-500 rounded-md text-xs font-medium transition-colors"
                  >
                    Assinatura
                  </button>
                  <button
                    onClick={() => {
                      if (selectedAccount && selectedAccount.includes('@')) {
                        const domain = selectedAccount.split('@')[1]
                        setCreateEmailForm(prev => ({ ...prev, domain }))
                      } else if (sites.length > 0) {
                        setCreateEmailForm(prev => ({ ...prev, domain: sites[0].domain }))
                      }
                      setShowCreateEmailModal(true)
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-500 hover:bg-gray-600 text-white rounded-md text-xs font-medium transition-colors shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Nova Conta
                  </button>
                </div>

                {(selectedEmail || selectedEmails.size > 0) && (
                  <div className="ml-auto flex items-center gap-1 bg-gray-50 px-2 py-1 rounded-md border border-gray-200">
                    {selectedEmail && (
                      <>
                        <button onClick={() => setShowAdvancedCompose(true)} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Responder">
                          <Reply className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setShowAdvancedCompose(true)} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Responder a todos">
                          <ReplyAll className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setShowAdvancedCompose(true)} className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors" title="Reencaminhar">
                          <Forward className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                    <button 
                      onClick={() => {
                        if (selectedEmails.size > 0) {
                          selectedEmails.forEach(id => handleArchiveEmail(id))
                          setSelectedEmails(new Set())
                        } else if (selectedEmail) {
                          handleArchiveEmail(selectedEmail.id)
                        }
                      }} 
                      className="p-1.5 text-gray-500 hover:text-yellow-600 hover:bg-yellow-50 rounded transition-colors" 
                      title="Arquivar"
                    >
                      <Archive className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={() => {
                        if (selectedEmails.size > 0) {
                          selectedEmails.forEach(id => handleDeleteEmail(id))
                          setSelectedEmails(new Set())
                        } else if (selectedEmail) {
                          handleDeleteEmail(selectedEmail.id)
                        }
                      }} 
                      className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors" 
                      title="Apagar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
              
              <div className="flex-1 flex overflow-hidden">
                <div className={`w-80 border-r border-gray-100 flex flex-col bg-white shrink-0 ${selectedEmail ? 'hidden md:flex' : 'flex'}`}>
                  <div className="flex-1 overflow-y-auto">
                    {loadingEmails ? (
                      <div className="space-y-px">
                        {[1, 2, 3, 4, 5].map(i => (
                          <div key={i} className="p-4 space-y-2 animate-pulse">
                            <div className="h-4 bg-gray-100 rounded w-1/2" />
                            <div className="h-3 bg-gray-50 rounded w-3/4" />
                          </div>
                        ))}
                      </div>
                    ) : emails.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center p-8 text-center text-gray-400">
                        <Mail className="w-12 h-12 mb-3 opacity-20" />
                        <p className="text-sm">Nenhum email nesta pasta</p>
                      </div>
                    ) : (
                      emails.map(email => (
                        <button
                          key={email.id || email.uid}
                          onClick={() => setSelectedEmail(email)}
                          className={`w-full p-4 text-left border-b border-gray-50 transition-colors hover:bg-gray-50 ${
                            selectedEmail?.id === email.id ? 'bg-red-50/50 border-l-2 border-l-red-600' : ''
                          }`}
                        >
                          <div className="flex justify-between items-start mb-1">
                            <span className={`text-sm truncate ${!email.read ? 'font-bold text-gray-900' : 'text-gray-600'}`}>
                              {email.from}
                            </span>
                            <span className="text-[10px] text-gray-400 whitespace-nowrap ml-2">
                              {new Date(email.date).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                          <p className={`text-xs truncate mb-1 ${!email.read ? 'font-semibold text-gray-800' : 'text-gray-500'}`}>
                            {email.subject}
                          </p>
                          <p className="text-[11px] text-gray-400 line-clamp-2">
                            {email.snippet}
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                </div>

                {selectedEmail ? (
                  <div className="flex-1 flex flex-col min-w-0 bg-white">
                    <div className="p-6 border-b border-gray-100">
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-gray-900">{selectedEmail.subject}</h2>
                        <div className="flex items-center gap-2">
                          <button onClick={() => setShowAdvancedCompose(true)} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Responder">
                            <Reply className="w-4 h-4" />
                          </button>
                          <button onClick={() => setShowAdvancedCompose(true)} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Responder a todos">
                            <ReplyAll className="w-4 h-4" />
                          </button>
                          <button onClick={() => setShowAdvancedCompose(true)} className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors" title="Reencaminhar">
                            <Forward className="w-4 h-4" />
                          </button>
                          <div className="w-px h-4 bg-gray-300 mx-1" />
                          <button onClick={() => handleDeleteEmail(selectedEmail?.id)} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Apagar">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center text-white font-bold">
                            {selectedEmail.from?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-900">{selectedEmail.from}</p>
                            <p className="text-xs text-gray-500">para {selectedAccount}</p>
                          </div>
                        </div>
                        <span className="text-xs text-gray-400">
                          {new Date(selectedEmail.date).toLocaleString('pt-BR')}
                        </span>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6">
                      <div 
                        className="prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: selectedEmail.body || selectedEmail.snippet || '' }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-gray-50/20">
                    <Mail className="w-16 h-16 mb-4 opacity-10" />
                    <p className="text-sm">Selecione uma mensagem para ler</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {showCompose && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-bold text-gray-900">Nova Mensagem</h3>
              <button onClick={() => setShowCompose(false)} className="text-gray-400 hover:text-gray-600">✕</button>
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

      {/* Modal de Criação de E-mail (Servidor) */}
      {showCreateEmailModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowCreateEmailModal(false)} />
          <div className="relative bg-white border border-gray-200 rounded-md w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-600 rounded-md flex items-center justify-center shadow-lg shadow-red-500/20">
                  <Mail className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-gray-900">Novo E-mail</h2>
                  <span className="text-[11px] text-gray-500 font-mono italic">Criar conta no servidor</span>
                </div>
              </div>
              <button 
                onClick={() => setShowCreateEmailModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 transition-colors text-gray-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Domínio</label>
                <select
                  value={createEmailForm.domain}
                  onChange={e => setCreateEmailForm({ ...createEmailForm, domain: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-md px-4 py-2.5 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all"
                >
                  <option value="">Selecione o domínio...</option>
                  {sites.map(s => (
                    <option key={s.domain} value={s.domain}>{s.domain}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Utilizador (prefixo)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={createEmailForm.user}
                    onChange={e => setCreateEmailForm({ ...createEmailForm, user: e.target.value })}
                    placeholder="ex: comercial"
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-md px-4 py-2.5 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all"
                  />
                  {createEmailForm.domain && <span className="text-gray-400 text-xs font-medium">@{createEmailForm.domain}</span>}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Palavra-passe</label>
                <input
                  type="password"
                  value={createEmailForm.password}
                  onChange={e => setCreateEmailForm({ ...createEmailForm, password: e.target.value })}
                  placeholder="••••••••••••"
                  className="w-full bg-gray-50 border border-gray-200 rounded-md px-4 py-2.5 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all"
                />
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Quota (MB)</label>
                  <select
                    value={createEmailForm.quota}
                    onChange={e => setCreateEmailForm({ ...createEmailForm, quota: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-md px-4 py-2.5 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all"
                  >
                    <option value="500">500 MB</option>
                    <option value="1000">1 GB</option>
                    <option value="2000">2 GB</option>
                    <option value="5000">5 GB</option>
                    <option value="unlimited">Ilimitado</option>
                  </select>
                </div>
              </div>

              {createEmailError && (
                <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-600 text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {createEmailError}
                </div>
              )}

              {createEmailSuccess && (
                <div className="p-3 rounded-md bg-green-50 border border-green-200 text-green-600 text-xs font-medium flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  {createEmailSuccess}
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
              <button 
                onClick={() => setShowCreateEmailModal(false)}
                className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-700 transition-colors"
                disabled={creatingEmail}
              >
                Cancelar
              </button>
              <button 
                onClick={handleCreateServerEmail}
                disabled={creatingEmail || !createEmailForm.user || !createEmailForm.password || !createEmailForm.domain}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-xs font-bold transition-all shadow-sm disabled:opacity-50 flex items-center gap-2"
              >
                {creatingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {creatingEmail ? 'A criar...' : 'Criar E-mail'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Adicionar Conta de Email */}
      {mostrarAdicionarConta && (
        <AddEmailAccountModal
          isOpen={mostrarAdicionarConta}
          onClose={() => {
            setMostrarAdicionarConta?.(false)
            setModalAdicionarPasso?.('escolher')
          }}
          onAccountAdded={(account) => {
            // Adicionar a conta recém-criada à lista
            if (account) {
              const newAccount: EmailAccount = {
                email: account.email,
                name: account.nome || account.email.split('@')[0],
                domain: account.email.split('@')[1] || '',
                password: account.password,
                tipo: account.tipo === 'outlook' ? 'hotmail' : account.tipo
              }
              setAccounts(prev => [...prev, newAccount])
              setSelectedAccount(account.email)
            }
            setMostrarAdicionarConta?.(false)
            setModalAdicionarPasso?.('escolher')
          }}
        />
      )}

      {/* MODAL: Gerenciar Assinaturas - Estilo dark igual ao EmailWebmailSection */}
      {mostrarConfigAssinatura && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className={`${modoEscuroAssinatura ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200'} border rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto`}>
            {/* Header */}
            <div className={`flex items-center justify-between px-6 py-4 border-b ${modoEscuroAssinatura ? 'border-slate-700' : 'border-gray-200'}`}>
              <h3 className={`text-lg font-semibold ${modoEscuroAssinatura ? 'text-white' : 'text-gray-900'}`}>Assinaturas</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setModoEscuroAssinatura(!modoEscuroAssinatura)}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    modoEscuroAssinatura 
                      ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30' 
                      : 'bg-slate-700 text-white hover:bg-slate-600'
                  }`}
                >
                  {modoEscuroAssinatura ? '☀️ Claro' : '🌙 Escuro'}
                </button>
                <button
                  onClick={() => setMostrarConfigAssinatura(false)}
                  className={`p-2 rounded-lg transition-colors ${modoEscuroAssinatura ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Seção: Editar Assinatura */}
              <div>
                <h4 className={`text-sm font-semibold mb-3 ${modoEscuroAssinatura ? 'text-slate-300' : 'text-gray-700'}`}>Editar assinatura:</h4>
                <div className={`rounded-lg border ${modoEscuroAssinatura ? 'border-slate-700 bg-slate-800' : 'border-gray-200 bg-gray-50'} overflow-hidden`}>
                  {/* Lista de assinaturas com preview */}
                  <div className="grid grid-cols-3 gap-0">
                    {/* Coluna 1: Lista */}
                    <div className={`border-r ${modoEscuroAssinatura ? 'border-slate-700' : 'border-gray-200'}`}>
                      <div className={`px-3 py-2 text-sm font-medium border-b ${modoEscuroAssinatura ? 'text-slate-300 border-slate-700 bg-slate-800' : 'text-gray-700 border-gray-200 bg-gray-100'}`}>
                        Nome da assinatura
                      </div>
                      <div className="max-h-[200px] overflow-y-auto">
                        {assinaturas.length === 0 ? (
                          <div className={`p-4 text-center text-sm ${modoEscuroAssinatura ? 'text-slate-500' : 'text-gray-500'}`}>
                            <p>Nenhuma assinatura</p>
                            <p className="text-xs mt-1">Clique em + para adicionar</p>
                          </div>
                        ) : (
                          assinaturas.map((sig, index) => (
                            <button
                              key={index}
                              onClick={() => setAssinaturaAtiva(index)}
                              className={`w-full px-3 py-2.5 text-left text-sm transition-colors ${
                                assinaturaAtiva === index
                                  ? (modoEscuroAssinatura ? 'bg-slate-700 text-white' : 'bg-blue-50 text-blue-700')
                                  : (modoEscuroAssinatura ? 'text-slate-400 hover:bg-slate-700/50' : 'text-gray-700 hover:bg-gray-100')
                              }`}
                            >
                              {sig.nome || `Assinatura ${index + 1}`}
                            </button>
                          ))
                        )}
                      </div>
                      {/* Botões + e - */}
                      <div className={`flex items-center gap-2 p-2 border-t ${modoEscuroAssinatura ? 'border-slate-700' : 'border-gray-200'}`}>
                        <button
                          onClick={() => {
                            const novaAssinatura = { nome: `Nova Assinatura ${assinaturas.length + 1}`, activa: true, texto: '', imagemUrl: '' }
                            setAssinaturas([...assinaturas, novaAssinatura])
                            setAssinaturaAtiva(assinaturas.length)
                            setMostrarEditarAssinatura(true)
                            setMostrarConfigAssinatura(false)
                          }}
                          className={`p-1.5 rounded transition-colors ${modoEscuroAssinatura ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (assinaturas.length > 0 && assinaturaAtiva < assinaturas.length) {
                              const novasAssinaturas = assinaturas.filter((_, i) => i !== assinaturaAtiva)
                              setAssinaturas(novasAssinaturas)
                              setAssinaturaAtiva(Math.max(0, assinaturaAtiva - 1))
                            }
                          }}
                          disabled={assinaturas.length === 0}
                          className={`p-1.5 rounded transition-colors ${
                            assinaturas.length === 0 
                              ? 'opacity-50 cursor-not-allowed ' + (modoEscuroAssinatura ? 'bg-slate-800 text-slate-600' : 'bg-gray-100 text-gray-400')
                              : (modoEscuroAssinatura ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-gray-200 text-gray-600 hover:bg-gray-300')
                          }`}
                        >
                          <span className="text-lg leading-none">−</span>
                        </button>
                        <div className="flex-1"></div>
                        <button
                          onClick={() => {
                            if (assinaturas.length > 0) {
                              setMostrarEditarAssinatura(true)
                              setMostrarConfigAssinatura(false)
                            }
                          }}
                          disabled={assinaturas.length === 0}
                          className={`px-3 py-1.5 text-sm rounded transition-colors ${
                            assinaturas.length === 0
                              ? 'opacity-50 cursor-not-allowed ' + (modoEscuroAssinatura ? 'bg-slate-800 text-slate-500' : 'bg-gray-100 text-gray-400')
                              : (modoEscuroAssinatura ? 'bg-slate-700 text-white hover:bg-slate-600 border border-slate-600' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300')
                          }`}
                        >
                          Editar
                        </button>
                      </div>
                    </div>
                    
                    {/* Coluna 2-3: Preview */}
                    <div className="col-span-2 p-4">
                      <div className={`text-sm font-medium mb-2 ${modoEscuroAssinatura ? 'text-slate-400' : 'text-gray-500'}`}>Pré-visualização da Assinatura</div>
                      <div className={`h-[150px] rounded border ${modoEscuroAssinatura ? 'bg-white border-slate-600' : 'bg-white border-gray-300'} p-3 overflow-auto`}>
                        {assinaturas[assinaturaAtiva]?.imagemUrl ? (
                          <img 
                            src={assinaturas[assinaturaAtiva].imagemUrl} 
                            alt="Assinatura" 
                            className="max-w-full max-h-[120px] object-contain"
                          />
                        ) : assinaturas[assinaturaAtiva]?.texto ? (
                          <div 
                            className="text-sm text-gray-800"
                            dangerouslySetInnerHTML={{ __html: assinaturas[assinaturaAtiva].texto }}
                          />
                        ) : (
                          <p className={`text-sm ${modoEscuroAssinatura ? 'text-slate-500' : 'text-gray-400'} italic`}>
                            Nenhuma assinatura selecionada
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Seção: Selecionar assinatura predefinida */}
              <div>
                <h4 className={`text-sm font-semibold mb-3 ${modoEscuroAssinatura ? 'text-slate-300' : 'text-gray-700'}`}>Selecionar assinatura predefinida:</h4>
                <div className={`rounded-lg border ${modoEscuroAssinatura ? 'border-slate-700 bg-slate-800' : 'border-gray-200 bg-gray-50'} p-4 space-y-3`}>
                  <div className="grid grid-cols-[100px_1fr] items-center gap-3">
                    <label className={`text-sm ${modoEscuroAssinatura ? 'text-slate-400' : 'text-gray-600'}`}>Conta:</label>
                    <select 
                      value={selectedAccount || ''}
                      onChange={(e) => setSelectedAccount(e.target.value)}
                      className={`px-3 py-2 rounded-lg text-sm border ${
                        modoEscuroAssinatura 
                          ? 'bg-slate-700 border-slate-600 text-white' 
                          : 'bg-white border-gray-300 text-gray-900'
                      }`}
                    >
                      {accounts.map(acc => (
                        <option key={acc.email} value={acc.email}>{acc.email}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-[100px_1fr] items-center gap-3">
                    <label className={`text-sm ${modoEscuroAssinatura ? 'text-slate-400' : 'text-gray-600'}`}>Novas mensagens:</label>
                    <select 
                      className={`px-3 py-2 rounded-lg text-sm border ${
                        modoEscuroAssinatura 
                          ? 'bg-slate-700 border-slate-600 text-white' 
                          : 'bg-white border-gray-300 text-gray-900'
                      }`}
                    >
                      <option>Nenhuma</option>
                      {assinaturas.map((sig, idx) => (
                        <option key={idx} value={idx}>{sig.nome || `Assinatura ${idx + 1}`}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-[100px_1fr] items-center gap-3">
                    <label className={`text-sm ${modoEscuroAssinatura ? 'text-slate-400' : 'text-gray-600'}`}>Respostas/reenv.:</label>
                    <select 
                      className={`px-3 py-2 rounded-lg text-sm border ${
                        modoEscuroAssinatura 
                          ? 'bg-slate-700 border-slate-600 text-white' 
                          : 'bg-white border-gray-300 text-gray-900'
                      }`}
                    >
                      <option>Nenhuma</option>
                      {assinaturas.map((sig, idx) => (
                        <option key={idx} value={idx}>{sig.nome || `Assinatura ${idx + 1}`}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className={`flex items-center justify-end gap-3 px-6 py-4 border-t ${modoEscuroAssinatura ? 'border-slate-700 bg-slate-800' : 'border-gray-200 bg-gray-50'} rounded-b-xl`}>
              <button
                onClick={() => setMostrarConfigAssinatura(false)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  modoEscuroAssinatura 
                    ? 'text-slate-300 hover:bg-slate-700' 
                    : 'text-gray-600 hover:bg-gray-200'
                }`}
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  const emailAtual = selectedAccount || accounts[0]?.email
                  if (emailAtual) {
                    const config = { assinaturas, assinaturaAtiva, assinaturaPadrao: assinatura }
                    const novoEstado = { ...assinaturasPorEmailRef.current, [emailAtual]: config }
                    assinaturasPorEmailRef.current = novoEstado
                    setAssinaturasPorEmail(novoEstado)
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(novoEstado))
                  }
                  setMostrarConfigAssinatura(false)
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Editar/Criar Assinatura - Estilo dark com editor igual ao EmailWebmailSection */}
      {mostrarEditarAssinatura && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60]">
          <div className={`rounded-xl shadow-2xl w-full max-w-4xl mx-4 h-[85vh] flex flex-col overflow-hidden border transition-colors ${modoEscuroAssinatura ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200'}`}>
            {/* Header macOS style */}
            <div className={`px-5 py-2 flex items-center justify-between border-b transition-colors ${modoEscuroAssinatura ? 'bg-slate-900 border-slate-800' : 'bg-gray-50 border-gray-200'}`}>
              <div className="flex items-center gap-2 shrink-0">
                <div className="w-3 h-3 rounded-full bg-red-500 cursor-pointer" onClick={() => { setMostrarEditarAssinatura(false); setMostrarConfigAssinatura(true) }} />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
              </div>
              <div className="flex-1 text-center">
                <span className={`text-sm font-medium ${modoEscuroAssinatura ? 'text-white' : 'text-gray-900'}`}>Editar Assinatura</span>
              </div>
              <div className="w-16"></div>
            </div>

            {/* Nome da assinatura */}
            <div className={`flex items-center gap-3 border-b px-5 py-2 transition-colors ${modoEscuroAssinatura ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-200'}`}>
              <span className={`text-sm shrink-0 ${modoEscuroAssinatura ? 'text-slate-300' : 'text-gray-500'}`}>Nome da Assinatura:</span>
              <input
                key={`assinatura-nome-${assinaturaAtiva}`}
                defaultValue={assinaturas[assinaturaAtiva]?.nome || ''}
                onBlur={e => {
                  const novoNome = e.target.value
                  setAssinaturas(prev => prev.map((a, i) => i === assinaturaAtiva ? { ...a, nome: novoNome } : a))
                }}
                className={`flex-1 border text-sm px-3 py-1.5 rounded outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400 ${modoEscuroAssinatura ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`} />
            </div>

            {/* Toolbar - largura total */}
            <div className={`flex items-center gap-1 flex-wrap border-b px-5 py-2 transition-colors ${modoEscuroAssinatura ? 'bg-slate-900 border-slate-800' : 'bg-gray-50 border-gray-200'}`}>
              <select 
                onChange={(e) => { if (assinaturaEditorRef.current) { assinaturaEditorRef.current.focus(); document.execCommand('fontName', false, e.target.value) } }}
                className={`text-xs px-2 py-1.5 rounded outline-none ${modoEscuroAssinatura ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-gray-200 text-gray-900'}`}>
                <option>Calibri</option><option>Arial</option><option>Times New Roman</option>
              </select>
              <select 
                onChange={(e) => { if (assinaturaEditorRef.current) { assinaturaEditorRef.current.focus(); document.execCommand('fontSize', false, e.target.value) } }}
                className={`text-xs px-2 py-1.5 rounded w-14 outline-none ${modoEscuroAssinatura ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-gray-200 text-gray-900'}`}>
                <option>11</option><option>12</option><option>14</option><option>16</option>
              </select>
              <div className={`w-px h-5 mx-1 ${modoEscuroAssinatura ? 'bg-slate-700' : 'bg-gray-300'}`} />
              <button 
                onClick={() => { if (assinaturaEditorRef.current) { assinaturaEditorRef.current.focus(); document.execCommand('bold') } }}
                title="Negrito" 
                className={`text-xs px-3 py-1.5 rounded border transition-colors font-bold ${modoEscuroAssinatura ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}>N</button>
              <button 
                onClick={() => { if (assinaturaEditorRef.current) { assinaturaEditorRef.current.focus(); document.execCommand('italic') } }}
                title="Itálico" 
                className={`text-xs px-3 py-1.5 rounded border transition-colors italic ${modoEscuroAssinatura ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}>I</button>
              <button 
                onClick={() => { if (assinaturaEditorRef.current) { assinaturaEditorRef.current.focus(); document.execCommand('underline') } }}
                title="Sublinhado" 
                className={`text-xs px-3 py-1.5 rounded border transition-colors underline ${modoEscuroAssinatura ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}>S</button>
              <button 
                onClick={() => { if (assinaturaEditorRef.current) { assinaturaEditorRef.current.focus(); document.execCommand('strikeThrough') } }}
                title="Riscado" 
                className={`text-xs px-3 py-1.5 rounded border transition-colors line-through ${modoEscuroAssinatura ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}>ab</button>
              <div className={`w-px h-5 mx-1 ${modoEscuroAssinatura ? 'bg-slate-700' : 'bg-gray-300'}`} />
              <button 
                onClick={() => {
                  const url = prompt('URL do link:')
                  if (url && assinaturaEditorRef.current) {
                    assinaturaEditorRef.current.focus()
                    document.execCommand('createLink', false, url)
                  }
                }}
                title="Ligação" 
                className={`text-xs px-2 py-1.5 rounded border transition-colors ${modoEscuroAssinatura ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}>🔗 Ligação</button>
              <div className="flex-1" />
              <button 
                onClick={() => setModoEscuroAssinatura(!modoEscuroAssinatura)}
                title={modoEscuroAssinatura ? "Modo Claro" : "Modo Escuro"}
                className={`text-xs px-2 py-1.5 rounded border transition-colors ${modoEscuroAssinatura ? 'bg-yellow-500 border-yellow-600 text-white hover:bg-yellow-600' : 'bg-gray-700 border-gray-600 text-white hover:bg-gray-600'}`}>{modoEscuroAssinatura ? '☀️ Claro' : '🌙 Escuro'}</button>
            </div>

            {/* Área de edição - fundo branco SEMPRE */}
            <div className="flex-1 flex flex-col bg-white overflow-hidden">
              <div
                ref={assinaturaEditorRef}
                contentEditable
                dangerouslySetInnerHTML={{ __html: assinaturas[assinaturaAtiva]?.texto || '<div><br></div>' }}
                onFocus={(e) => {
                  const div = e.target as HTMLDivElement
                  if (!div.innerHTML || div.innerHTML === '<br>') {
                    div.innerHTML = '<div><br></div>'
                  }
                  const range = document.createRange()
                  const sel = window.getSelection()
                  if (div.lastChild) {
                    range.selectNodeContents(div.lastChild)
                    range.collapse(false)
                    sel?.removeAllRanges()
                    sel?.addRange(range)
                  }
                }}
                onInput={(e) => {
                  const texto = (e.target as HTMLDivElement).innerHTML
                  setAssinaturas(prev => prev.map((a, i) => i === assinaturaAtiva ? { ...a, texto } : a))
                }}
                className="flex-1 p-6 text-sm text-gray-800 outline-none overflow-y-auto text-left"
                style={{ backgroundColor: '#ffffff', direction: 'ltr', unicodeBidi: 'normal' }} />

              {/* Imagem da assinatura */}
              {assinaturas[assinaturaAtiva]?.imagemUrl && (
                <div className="px-6 py-3 border-t border-gray-200 bg-white">
                  <img src={assinaturas[assinaturaAtiva].imagemUrl} alt="Assinatura" className="max-h-32 object-contain" />
                </div>
              )}

              {/* Upload / URL imagem */}
              <div className={`border-t px-5 py-3 flex items-center gap-3 flex-wrap transition-colors ${modoEscuroAssinatura ? 'bg-slate-900 border-slate-800' : 'bg-gray-50 border-gray-200'}`}>
                <span className={`text-xs font-medium ${modoEscuroAssinatura ? 'text-slate-400' : 'text-gray-600'}`}>Imagem da assinatura:</span>
                <label className={`text-xs px-3 py-1.5 rounded cursor-pointer transition-colors ${modoEscuroAssinatura ? 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700' : 'bg-gray-800 text-white hover:bg-gray-700'}`}>
                  Escolher ficheiro
                  <input type="file" accept="image/*" className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0]
                      if (file) {
                        const reader = new FileReader()
                        reader.onload = ev => {
                          const imagemUrl = ev.target?.result as string
                          setAssinaturas(prev => prev.map((a, i) => i === assinaturaAtiva ? { ...a, imagemUrl } : a))
                        }
                        reader.readAsDataURL(file)
                      }
                    }} />
                </label>
                <span className={`text-xs ${modoEscuroAssinatura ? 'text-slate-500' : 'text-gray-400'}`}>ou URL:</span>
                <input
                  placeholder="https://url-da-imagem.png"
                  defaultValue={assinaturas[assinaturaAtiva]?.imagemUrl || ''}
                  onBlur={e => {
                    const url = e.target.value
                    setAssinaturas(prev => prev.map((a, i) => i === assinaturaAtiva ? { ...a, imagemUrl: url } : a))
                  }}
                  className={`flex-1 min-w-40 text-xs rounded px-2 py-1.5 outline-none ${modoEscuroAssinatura ? 'bg-slate-800 border-slate-700 text-slate-200 border' : 'bg-white border-gray-300 border'}`} />
                {assinaturas[assinaturaAtiva]?.imagemUrl && (
                  <button onClick={() => setAssinaturas(prev => prev.map((a, i) => i === assinaturaAtiva ? { ...a, imagemUrl: '' } : a))}
                    className="text-xs text-red-500 hover:text-red-700 font-bold">✕ Remover</button>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className={`border-t px-5 py-3 flex justify-end gap-3 transition-colors ${modoEscuroAssinatura ? 'bg-slate-900 border-slate-800' : 'bg-gray-50 border-gray-200'}`}>
              <button onClick={() => {
                const emailAtual = selectedAccount || accounts[0]?.email
                if (emailAtual) {
                  const config = { assinaturas, assinaturaAtiva, assinaturaPadrao: assinatura }
                  const novoEstado = { ...assinaturasPorEmailRef.current, [emailAtual]: config }
                  assinaturasPorEmailRef.current = novoEstado
                  localStorage.setItem(STORAGE_KEY, JSON.stringify(novoEstado))
                }
                setAssinatura(assinaturas[assinaturaAtiva]?.texto || '')
                setMostrarEditarAssinatura(false)
                setMostrarConfigAssinatura(true)
              }}
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg text-sm font-bold transition-colors shadow-sm">Guardar</button>
              <button onClick={() => { setMostrarEditarAssinatura(false); setMostrarConfigAssinatura(true) }}
                className={`px-6 py-2 rounded-lg text-sm font-bold transition-colors ${modoEscuroAssinatura ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
