'use client'

import { useState, useEffect, useRef } from 'react'
import { 
  Mail, Inbox, Send, FileText, Trash2, Archive, Star, Filter, 
  RefreshCw, ChevronLeft, ChevronDown, Plus, ExternalLink,
  Loader2, AlertCircle, CheckCircle2, Search, Settings,
  LogOut, FolderOpen, MoreVertical, Download, Reply, ReplyAll, Forward, Pencil, Image as ImageIcon, X,
  AlertTriangle, Activity
} from 'lucide-react'
import Link from 'next/link'
import { EmailWebmailSection } from './EmailWebmailSection'
import { AddEmailAccountModal } from '@/components/AddEmailAccountModal'

// Interface para contas de email
interface EmailAccount {
  email: string
  name: string
  domain: string
  password?: string
  tipo: 'webmail' | 'google' | 'hotmail' | 'imported'
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
  const [allAccounts, setAllAccounts] = useState<EmailAccount[]>([])
  const [selectedAccount, setSelectedAccount] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const hasLoadedAccounts = useRef(false)
  const [activeFolder, setActiveFolder] = useState('INBOX')
  const [emails, setEmails] = useState<any[]>([])
  const [folderCounts, setFolderCounts] = useState<Record<string, number>>({ INBOX: 0, Sent: 0, Drafts: 0, Trash: 0, Junk: 0, Archive: 0 })
  const [loadingEmails, setLoadingEmails] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [selectedEmail, setSelectedEmail] = useState<any>(null)
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set())
  const [showCompose, setShowCompose] = useState(false)
  const [showImportGmail, setShowImportGmail] = useState(false)
  const [showPasswordHelp, setShowPasswordHelp] = useState(false)
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

  // Estados para diagnóstico IMAP
  const [showDiagnostico, setShowDiagnostico] = useState(false)
  const [diagnosticoResult, setDiagnosticoResult] = useState<any>(null)
  const [diagnosticoLoading, setDiagnosticoLoading] = useState(false)
  const assinaturaEditorRef = useRef<HTMLDivElement>(null)
  const loadEmailsAbortControllerRef = useRef<AbortController | null>(null)
  const loadCountsAbortControllerRef = useRef<AbortController | null>(null)

  // 🔒 Cache de credenciais válidas (evitar alertas de senha frequentes)
  const [validCredentials, setValidCredentials] = useState<Record<string, { password: string; expiresAt: number }>>({})
  const CREDENTIAL_CACHE_DURATION = 60 * 60 * 1000 // 1 hora
  
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
    'silva.chamo@visualdesigne.com': 'Meckito#77?*',
    'duduchamatavele@visualdesigne.com': 'Dudu#2425?*',
    'geral@visualdesigne.com': 'Ge.Vd#2425?*',
    'admin@visualdesigne.com': 'Ad.Vd#2425?*',
    'info@visualdesigne.com': 'Informação!#2020?*',
    'suporte@visualdesigne.com': 'SupaEmail#2026?*',
    'noreply@visualdesigne.com': 'VisualDesign#2026',
  }

  // 🎨 Função para gerar cor do avatar baseada na letra inicial
  const getAvatarColor = (letter: string): string => {
    const colors = [
      'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500', 
      'bg-lime-500', 'bg-green-500', 'bg-emerald-500', 'bg-teal-500',
      'bg-cyan-500', 'bg-sky-500', 'bg-blue-500', 'bg-indigo-500',
      'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500', 'bg-pink-500',
      'bg-rose-500', 'bg-slate-500', 'bg-gray-500', 'bg-zinc-500'
    ]
    if (!letter) return 'bg-gray-400'
    const code = letter.charCodeAt(0)
    return colors[code % colors.length]
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

  // ⚡ CACHE LOCAL - DESATIVADO TEMPORARIAMENTE (Problema de mistura de dados)
  // const getCacheKey = (account: string, folder: string) => `webmail_${account}_${folder}`
  // const getCachedData = (account: string, folder: string) => { ... }
  // const setCachedData = (account: string, folder: string, emails: any[], counts: any) => { ... }
  const setCachedData = (_a?: string, _f?: string, _e?: any[], _c?: any) => {} // Função vazia para compatibilidade
  const getCachedData = () => null // Sempre retorna null

  // Carregar emails quando mudar conta ou pasta
  useEffect(() => {
    if (selectedAccount && viewMode === 'list') {
      // 🔄 Sempre buscar dados frescos do servidor (cache desativado)
      loadEmails()
    }
  }, [selectedAccount, activeFolder, debouncedSearchQuery])

  // 🆕 Buscar corpo completo do email quando selecionado
  useEffect(() => {
    if (selectedAccount && selectedEmail && !selectedEmail.corpo) {
      const carregarCorpo = async () => {
        try {
          const account = accounts.find(a => a.email === selectedAccount)
          const password = account?.password || CREDENCIAIS_PADRAO[selectedAccount]
          
          if (!password) {
            console.error('Senha não disponível para:', selectedAccount)
            return
          }

          const res = await fetch('/api/read-email-detail', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: selectedAccount,
              password: password,
              emailId: selectedEmail.id || selectedEmail.uid,
              folder: activeFolder
            })
          })
          
          const data = await res.json()
          if (data.success) {
            setSelectedEmail((prev: any) => ({ 
              ...prev, 
              corpo: data.corpo, 
              anexos: data.anexos 
            }))
          } else {
            console.error('Erro ao carregar corpo:', data.error)
          }
        } catch (e) {
          console.error('Erro ao carregar corpo do email:', e)
        }
      }
      carregarCorpo()
    }
  }, [selectedEmail?.id, selectedEmail?.uid, selectedAccount, activeFolder])

  // 🔧 CORREÇÃO ÚNICA: Permissões do SnappyMail (executa apenas 1x na sessão)
  useEffect(() => {
    // Limpar flag para forçar nova execução após atualização do código
    sessionStorage.removeItem('snappymail_permissions_fixed')
    
    const fixed = sessionStorage.getItem('snappymail_permissions_fixed')
    if (fixed) return
    
    console.log('[WebmailSection] Corrigindo permissões SnappyMail...')
    fetch('/api/server-exec', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'fixSnappyMailPermissions' })
    })
    .then(r => r.json())
    .then(d => {
      if (d.success) {
        console.log('[WebmailSection] Permissões corrigidas:', d.output)
        sessionStorage.setItem('snappymail_permissions_fixed', 'true')
      } else {
        console.error('[WebmailSection] Falha:', d.error)
      }
    })
    .catch(e => console.error('[WebmailSection] Erro:', e))
  }, [])

  // SINCRONIZAÇÃO: Carregar assinaturas e LIMPAR estados quando email muda
  useEffect(() => {
    // Limpar estados para evitar "flashing" de dados da conta anterior
    setEmails([])
    setFolderCounts({ INBOX: 0, Sent: 0, Drafts: 0, Trash: 0, Junk: 0, Archive: 0 })
    setSelectedEmail(null)
    setSelectedEmails(new Set())
    
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

      // 🚀 SEM FILTRO RESTRITIVO: Admin deve poder ver todas as contas sincronizadas
      const filteredAccounts = allAccounts

      setAllAccounts(allAccounts)
      setAccounts(filteredAccounts)
      
      // 4. Carregar contas importadas manualmente (ex: Gmail) do localStorage
      const IMPORTED_KEY = 'webmail_imported_accounts_v1'
      try {
        const savedImported = localStorage.getItem(IMPORTED_KEY)
        if (savedImported) {
          const importedList: EmailAccount[] = JSON.parse(savedImported)
          importedList.forEach(acc => {
            if (!filteredAccounts.find(a => a.email === acc.email)) {
              filteredAccounts.push(acc)
              allAccounts.push(acc)
            }
          })
          // Re-aplicar após mesclar importadas
          setAllAccounts([...allAccounts])
          setAccounts([...filteredAccounts])
        }
      } catch (e) {
        console.error('Erro ao carregar contas importadas:', e)
      }
      
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
    // Cancelar pedido anterior se houver
    if (loadEmailsAbortControllerRef.current) {
      loadEmailsAbortControllerRef.current.abort()
    }

    const controller = new AbortController()
    loadEmailsAbortControllerRef.current = controller

    setLoadingEmails(true)
    // 🧹 Limpar e-mails imediatamente para evitar que e-mails da pasta anterior fiquem no ecrã
    setEmails([])

    try {
      const account = accounts.find(a => a.email === selectedAccount)
      if (!account) return

      // 🔒 Verificar cache de credenciais válidas
      const cached = validCredentials[account.email]
      const password = cached && Date.now() < cached.expiresAt
        ? cached.password
        : (account.password || CREDENCIAIS_PADRAO[account.email])

      if (!password) {
        console.log('Sem senha para conta:', account.email)
        return
      }

      console.log(`📧 [WebmailSection] Carregando e-mails e contagens para: ${activeFolder}`)
      const res = await fetch('/api/read-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: account.email,
          password: password,
          folders: [activeFolder],
          limit: 50,
          search: debouncedSearchQuery,
          includeTotals: true // UNIFICAÇÃO: Pedir contagens na mesma ligação
        }),
        signal: controller.signal
      })

      const data = await res.json()

      console.log(`📊 [FRONT] Recebido de API para ${activeFolder}:`, data.folderTotals)

      if (data.success) {
        const newEmails = data.emails || []
        const newCounts = data.folderTotals || {}
        setEmails(newEmails)
        // 🔄 Atualizar TODAS as contagens de pastas de uma vez (não só a ativa)
        if (data.folderTotals && Object.keys(newCounts).length > 0) {
          setFolderCounts(prev => {
            const updated = { ...prev, ...newCounts }
            console.log(`📊 [FRONT] folderCounts atualizado:`, updated)
            return updated
          })
        }
        // ⚡ Guardar no cache para carregamento instantâneo
        setCachedData(selectedAccount, activeFolder, newEmails, newCounts)

        // 🔒 Credenciais funcionaram - adicionar ao cache
        if (!cached || Date.now() >= cached.expiresAt) {
          setValidCredentials(prev => ({
            ...prev,
            [account.email]: { password, expiresAt: Date.now() + CREDENTIAL_CACHE_DURATION }
          }))
        }
      } else {
        console.error('📧 [WebmailSection] Erro da API:', data.error)
        // ❌ Credenciais falharam - remover do cache
        if (data.error?.includes('senha') || data.error?.includes('password') || data.error?.includes('auth')) {
          setValidCredentials(prev => {
            const updated = { ...prev }
            delete updated[account.email]
            return updated
          })
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('📧 [WebmailSection] Pedido cancelado (novo disparado).')
      } else {
        console.error('Erro ao carregar emails:', error)
      }
    } finally {
      // 🛡️ Só remover o loading se este foi o último pedido a ser disparado
      if (loadEmailsAbortControllerRef.current === controller) {
        setLoadingEmails(false)
        loadEmailsAbortControllerRef.current = null
      }
    }
  }

  // 🔄 Função para recarregar contagens de TODAS as pastas
  const refreshAllFolderCounts = async () => {
    const account = accounts.find(a => a.email === selectedAccount)
    if (!account) return

    const password = account.password || CREDENCIAIS_PADRAO[account.email]
    if (!password) return

    try {
      const res = await fetch('/api/read-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: account.email,
          password: password,
          folders: ['INBOX', 'Sent', 'Drafts', 'Trash', 'Junk', 'Archive'],
          limit: 1,
          includeTotals: true
        })
      })

      const data = await res.json()
      if (data.success && data.folderTotals) {
        setFolderCounts(data.folderTotals)
        // Cache desativado - não atualizar
      }
    } catch (e) {
      console.error('Erro ao atualizar contagens:', e)
    }
  }

  const handleSyncCyberPanel = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/admin/sync-cyberpanel-users', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        alert(`Sincronização concluída!\nEmails encontrados: ${data.results?.emailsFound}\nNovos usuários: ${data.results?.usersCreated}`)
        loadEmailAccounts() // Recarregar lista
      } else {
        alert('Erro na sincronização: ' + (data.error || 'Erro desconhecido'))
      }
    } catch (e: any) {
      alert('Erro técnico: ' + e.message)
    } finally {
      setSyncing(false)
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
    return 'https://109.199.104.22:8090/snappymail/'
  }

  const runDiagnostico = async () => {
    setDiagnosticoLoading(true)
    setDiagnosticoResult(null)

    const account = accounts.find(a => a.email === selectedAccount)
    if (!account) {
      setDiagnosticoResult({ error: 'Selecione uma conta de email primeiro' })
      setDiagnosticoLoading(false)
      return
    }

    const password = account.password || CREDENCIAIS_PADRAO[account.email]
    if (!password) {
      setDiagnosticoResult({ error: 'Senha não disponível para esta conta' })
      setDiagnosticoLoading(false)
      return
    }

    console.log(`📧 [DIAGNÓSTICO] Testando conexão para ${account.email}`)

    try {
      const res = await fetch('/api/debug-imap-folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: account.email,
          password: password
        })
      })
      const data = await res.json()

      if (!data.success) {
        // Erro de autenticação
        if (data.error?.includes('auth') || data.error?.includes('password') || data.error?.includes('login')) {
          console.error(`📧 [DIAGNÓSTICO] Erro de autenticação para ${account.email}:`, data.error)
          setDiagnosticoResult({
            error: 'Erro de autenticação IMAP',
            details: data.details || data.error,
            suggestion: 'A senha configurada pode estar incorreta. Verifique no CyberPanel.',
            email: account.email,
            passwordPreview: password.substring(0, 3) + '***' + password.substring(password.length - 2)
          })
        } else {
          setDiagnosticoResult(data)
        }
      } else {
        setDiagnosticoResult(data)
      }
    } catch (e) {
      setDiagnosticoResult({ error: 'Falha ao executar diagnóstico' })
    }
    setDiagnosticoLoading(false)
  }

  const openSnappyMailAutoLogin = async () => {
    const account = accounts.find(a => a.email === selectedAccount)
    if (!account) {
      // Sem conta selecionada, abrir SnappyMail normal
      window.open(getSnappyMailUrl(), '_blank')
      return
    }

    const password = account.password || CREDENCIAIS_PADRAO[account.email]
    if (!password) {
      console.warn('[SnappyMail SSO] Senha não disponível para:', account.email)
      window.open(getSnappyMailUrl(), '_blank')
      return
    }

    try {
      // Criar token SSO via API
      const res = await fetch('/api/snappymail-sso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: account.email,
          password: password
        })
      })

      const data = await res.json()

      if (data.success && data.ssoUrl) {
        console.log('[SnappyMail SSO] Login automático para:', account.email)
        window.open(data.ssoUrl, '_blank')
      } else {
        // Fallback: abrir sem SSO
        console.warn('[SnappyMail SSO] Falha no SSO, usando fallback')
        window.open(getSnappyMailUrl(), '_blank')
      }
    } catch (error) {
      console.error('[SnappyMail SSO] Erro:', error)
      window.open(getSnappyMailUrl(), '_blank')
    }
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
          toFolder: 'INBOX.Archive'
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
    { id: 'Junk', name: 'Spam', icon: AlertTriangle },  // ← ID 'Junk' para coincidir com API
    { id: 'Trash', name: 'Lixo', icon: Trash2 },
  ]

  if (loading) {
    return (
      <div className="flex flex-col bg-gray-50 h-[calc(100vh-80px)]">
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
            <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
          </div>
          {/* Botões direita skeleton */}
          <div className="flex items-center gap-2">
            <div className="h-8 w-24 bg-gray-200 rounded animate-pulse" />
            <div className="h-8 w-32 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>

        {/* Content Skeleton - Layout 2 colunas (Sidebar | Lista/Conteúdo único) */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar Skeleton */}
          <div className="w-56 bg-white border-r border-gray-200 flex flex-col shrink-0">
            {/* Botão Nova Mensagem skeleton */}
            <div className="p-4">
              <div className="h-10 w-full bg-gray-200 rounded animate-pulse" />
            </div>
            {/* Lista de Folders skeleton */}
            <div className="flex-1 px-3 space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded">
                  <div className="w-5 h-5 bg-gray-200 rounded animate-pulse" />
                  <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
                  <div className="ml-auto h-4 w-6 bg-gray-200 rounded animate-pulse" />
                </div>
              ))}
            </div>
            {/* Botão Atualizar skeleton */}
            <div className="p-3 border-t border-gray-200">
              <div className="h-9 w-full bg-gray-200 rounded animate-pulse" />
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
                <div className="h-8 w-24 bg-gray-200 rounded animate-pulse" />
                <div className="h-8 w-24 bg-gray-200 rounded animate-pulse" />
              </div>
            </div>
            {/* Lista skeleton com detalhes */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded border-b border-gray-100 hover:bg-gray-50">
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

          {/* Skeleton do Conteúdo Único (sem painel lateral - layout alterna entre lista e conteúdo) */}
          <div className="flex-1 bg-white flex flex-col min-w-0">
            {/* Barra de ferramentas skeleton */}
            <div className="px-4 py-2 border-b border-gray-100 flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 bg-gray-200 rounded animate-pulse" />
                <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
              </div>
              <div className="h-8 w-48 bg-gray-200 rounded animate-pulse ml-auto" />
            </div>
            {/* Lista de emails skeleton */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded border-b border-gray-100">
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
            {/* Paginação skeleton */}
            <div className="px-4 py-2 border-t border-gray-100 flex items-center justify-between">
              <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 bg-gray-200 rounded animate-pulse" />
                <div className="h-8 w-8 bg-gray-200 rounded animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex flex-col bg-gray-50 ${showAdvancedCompose ? 'h-screen' : 'h-[calc(100vh-80px)]'}`}>
      {!showAdvancedCompose && (
        <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            {onBack && (
              <button
                onClick={onBack}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-300 text-gray-500 hover:bg-gray-100 hover:text-gray-700 hover:border-gray-400 rounded text-sm font-medium transition-all duration-200"
              >
                <ChevronLeft className="w-4 h-4" />
                Sair
              </button>
            )}
            {onBack && <div className="w-px h-5 bg-gray-200" />}
            <div className="flex items-center gap-2">
              <select
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
                disabled={accounts.length === 0}
                className="px-3 py-1.5 bg-white border border-gray-300 rounded text-sm font-medium focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none disabled:bg-gray-50 disabled:text-gray-400"
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

              {isAdmin && (
                <button
                  onClick={handleSyncCyberPanel}
                  disabled={syncing}
                  className={`p-1.5 rounded border border-gray-300 bg-white hover:bg-gray-50 transition-all ${syncing ? 'animate-spin text-red-600' : 'text-gray-500'}`}
                  title="Sincronizar com CyberPanel"
                >
                  <RefreshCw size={14} />
                </button>
              )}
              
              {/* Botão Importar Conta ao lado do seletor */}
              <button
                onClick={() => setShowImportGmail(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-300 text-blue-600 hover:bg-blue-100 hover:text-blue-700 hover:border-blue-400 rounded text-sm font-medium transition-all duration-200"
                title="Importar conta de Email"
              >
                {/* Ícone Google com cores oficiais */}
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Importar conta
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">

            <button
              onClick={openSnappyMailAutoLogin}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-300 text-blue-600 hover:bg-blue-100 hover:text-blue-700 hover:border-blue-400 rounded text-sm font-medium transition-all duration-200"
              title="Abrir Webmail Completo"
            >
              <ExternalLink className="w-4 h-4" />
              <span className="hidden sm:inline">Abrir Webmail Completo</span>
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
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-300 text-green-600 hover:bg-green-100 hover:text-green-700 hover:border-green-400 rounded text-sm font-medium transition-all duration-200"
            >
              <Plus className="w-4 h-4" />
              Nova Conta
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
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-50 border border-red-300 text-red-600 hover:bg-red-100 hover:text-red-700 hover:border-red-400 text-sm font-bold rounded transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-5 h-5" />
                Nova Mensagem
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-2">
              {folders.map(folder => {
                const Icon = folder.icon
                const isActive = activeFolder === folder.id
                // Usar contagem real da pasta, não da pasta ativa
                const count = folderCounts[folder.id] || 0

                return (
                  <button
                    key={folder.id}
                    disabled={accounts.length === 0}
                    onClick={() => {
                      setActiveFolder(folder.id)
                      setSelectedEmail(null)
                      // ⚡ Carregamento imediato sem delay
                      setTimeout(() => loadEmails(), 0)
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-1.5 text-sm transition-colors ${
                      isActive
                        ? 'bg-red-50 text-red-700 font-medium border-r-2 border-r-red-600'
                        : 'text-gray-700 hover:bg-gray-50'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-red-600' : 'text-gray-500'}`} />
                    <span className="flex-1 text-left">{folder.name}</span>
                    {count > 0 && (
                      <span className="bg-red-600 text-white text-xs px-2 py-0.5 rounded-full font-medium min-w-[20px] text-center">
                        {count}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            

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
                  className="px-6 py-2 bg-red-600 text-white rounded font-bold hover:bg-red-700 transition-all shadow-md"
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
                    className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Atualizar"
                  >
                    <RefreshCw className={`w-4 h-4 ${loadingEmails ? 'animate-spin' : ''}`} />
                  </button>
                  <button 
                    className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                    title="Filtrar"
                  >
                    <Filter className="w-4 h-4" />
                  </button>
                </div>

                {(selectedEmail || selectedEmails.size > 0) && (
                  <div className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded border border-gray-200">
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

                <div className="flex-1" />

                <div className="relative w-80">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Pesquisar..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded text-xs focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all"
                  />
                </div>

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
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-300 text-red-600 hover:bg-red-100 hover:text-red-700 hover:border-red-400 rounded text-xs font-medium transition-all duration-200"
                >
                  Assinatura
                </button>
              </div>
              
              <div className="flex-1 flex overflow-hidden">
                {/* Lista de emails - escondida quando um email está selecionado */}
                <div className={`w-full border-r border-gray-100 flex flex-col bg-white shrink-0 ${selectedEmail ? 'hidden' : 'flex'}`}>
                  <div className="flex-1 overflow-y-auto">
                    {loadingEmails ? (
                      <div className="space-y-px">
                        {[...Array(8)].map((_, i) => (
                          <div key={i} className="p-4 border-b border-gray-50">
                            <div className="h-4 bg-gray-100 rounded w-3/4 mb-2 animate-pulse" />
                            <div className="h-3 bg-gray-100 rounded w-1/2 animate-pulse" />
                          </div>
                        ))}
                      </div>
                    ) : emails.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8">
                        <Mail className="w-12 h-12 mb-3 opacity-20" />
                        <p className="text-sm text-center">Nenhuma mensagem</p>
                      </div>
                    ) : (
                      emails.map(email => (
                        <div
                          key={email.id || email.uid}
                          className={`w-full p-3 text-left border-b border-gray-50 transition-colors hover:bg-gray-50 flex items-start gap-3 group cursor-pointer ${
                            selectedEmail?.id === email.id ? 'bg-red-50/50 border-l-2 border-l-red-600' : ''
                          } ${!email.lido ? 'bg-blue-50/30' : ''}`}
                          onClick={() => {
                            // Se email não lido, marcar como lido e decrementar contagem
                            if (!email.lido) {
                              setEmails(prev => prev.map(e => 
                                (e.id === email.id || e.uid === email.uid) ? { ...e, lido: true } : e
                              ))
                              setFolderCounts(prev => ({
                                ...prev,
                                [activeFolder]: Math.max(0, (prev[activeFolder] || 0) - 1)
                              }))
                            }
                            setSelectedEmail(email)
                            // 🔄 Atualizar contagens de todas as pastas após abrir email
                            setTimeout(() => refreshAllFolderCounts(), 500)
                          }}
                        >
                          {/* Checkbox */}
                          <input
                            type="checkbox"
                            checked={selectedEmails.has(email.id || email.uid)}
                            onClick={(ev) => ev.stopPropagation()}
                            onChange={(ev) => {
                              ev.stopPropagation()
                              const emailId = email.id || email.uid
                              if (ev.target.checked) {
                                setSelectedEmails(prev => new Set([...prev, emailId]))
                              } else {
                                setSelectedEmails(prev => {
                                  const newSet = new Set(prev)
                                  newSet.delete(emailId)
                                  return newSet
                                })
                              }
                            }}
                            className="w-4 h-4 cursor-pointer mt-1"
                          />
                          
                          {/* Avatar com cor dinâmica */}
                          <div className={`w-8 h-8 ${getAvatarColor(email.de?.charAt(0))} rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0`}>
                            {email.de?.charAt(0).toUpperCase()}
                          </div>
                          
                          {/* Informação do email */}
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start mb-0.5">
                              <span className={`text-sm truncate text-gray-700`}>
                                {activeFolder === 'Sent' ? `Para: ${email.para || email.de || 'Desconhecido'}` : email.de}
                              </span>
                              <span className="text-[10px] text-gray-400 whitespace-nowrap ml-2">
                                {email.data ? new Date(email.data).toLocaleDateString('pt-BR') : ''}
                              </span>
                            </div>
                            <p className={`text-xs truncate text-gray-500`}>
                              {email.assunto}
                            </p>
                            <p className="text-[11px] text-gray-400 line-clamp-1 mt-0.5">
                              {email.preview}
                            </p>
                          </div>
                          
                          {/* Ações ao passar mouse */}
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                            <button
                              onClick={(ev) => { ev.stopPropagation(); handleArchiveEmail(email.id || email.uid); }}
                              className="p-1.5 rounded hover:bg-orange-100 text-orange-600 transition-colors"
                              title="Arquivar"
                            >
                              <Archive className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(ev) => { ev.stopPropagation(); handleDeleteEmail(email.id || email.uid); }}
                              className="p-1.5 rounded hover:bg-red-100 text-red-600 transition-colors"
                              title="Excluir"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Conteúdo do email - ocupa tela inteira quando selecionado */}
                {selectedEmail ? (
                  <div className="flex-1 flex flex-col w-full bg-white">
                    <div className="p-6 border-b border-gray-100">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          {/* Botão Voltar para lista */}
                          <button 
                            onClick={() => setSelectedEmail(null)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Voltar para lista"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            <span className="text-sm font-medium">Voltar</span>
                          </button>
                          <h2 className="text-xl font-bold text-gray-900">{selectedEmail.assunto}</h2>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => setShowAdvancedCompose(true)} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Responder">
                            <Reply className="w-4 h-4" />
                          </button>
                          <button onClick={() => setShowAdvancedCompose(true)} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Encaminhar">
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
                          <div className={`w-10 h-10 ${getAvatarColor(selectedEmail.de?.charAt(0))} rounded-full flex items-center justify-center text-white font-bold`}>
                            {selectedEmail.de?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-900">{selectedEmail.de}</p>
                            <p className="text-xs text-gray-500">para {selectedAccount}</p>
                          </div>
                        </div>
                        <span className="text-xs text-gray-400">
                          {selectedEmail.data ? new Date(selectedEmail.data).toLocaleString('pt-BR') : ''}
                        </span>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6">
                      {selectedEmail.corpo ? (
                        <div 
                          className="prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{ __html: selectedEmail.corpo }}
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-gray-400">
                          <Loader2 className="w-6 h-6 animate-spin mr-2" />
                          <span className="text-sm">Carregando conteúdo...</span>
                        </div>
                      )}
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
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
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
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-red-500 focus:border-red-500"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  placeholder="email@exemplo.com"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assunto</label>
                <input
                  type="text"
                  value={composeData.subject}
                  onChange={(e) => setComposeData({ ...composeData, subject: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  placeholder="Assunto do email"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mensagem</label>
                <textarea
                  value={composeData.body}
                  onChange={(e) => setComposeData({ ...composeData, body: e.target.value })}
                  rows={8}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
                  placeholder="Escreva sua mensagem..."
                />
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowCompose(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={sendEmail}
                disabled={!composeData.to || !composeData.subject}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
          <div className="relative bg-white border border-gray-200 rounded w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-600 rounded flex items-center justify-center shadow-lg shadow-red-500/20">
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
                  className="w-full bg-gray-50 border border-gray-200 rounded px-4 py-2.5 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all"
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
                    className="flex-1 bg-gray-50 border border-gray-200 rounded px-4 py-2.5 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all"
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
                  className="w-full bg-gray-50 border border-gray-200 rounded px-4 py-2.5 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all"
                />
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Quota (MB)</label>
                  <select
                    value={createEmailForm.quota}
                    onChange={e => setCreateEmailForm({ ...createEmailForm, quota: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded px-4 py-2.5 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all"
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
                <div className="p-3 rounded bg-red-50 border border-red-200 text-red-600 text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {createEmailError}
                </div>
              )}

              {createEmailSuccess && (
                <div className="p-3 rounded bg-green-50 border border-green-200 text-green-600 text-xs font-medium flex items-center gap-2">
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
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-xs font-bold transition-all shadow-sm disabled:opacity-50 flex items-center gap-2"
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
          <div className={`${modoEscuroAssinatura ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200'} border rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto`}>
            {/* Header */}
            <div className={`flex items-center justify-between px-6 py-4 border-b ${modoEscuroAssinatura ? 'border-slate-700' : 'border-gray-200'}`}>
              <h3 className={`text-lg font-semibold ${modoEscuroAssinatura ? 'text-white' : 'text-gray-900'}`}>Assinaturas</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setModoEscuroAssinatura(!modoEscuroAssinatura)}
                  className={`px-3 py-1.5 text-sm rounded transition-colors ${
                    modoEscuroAssinatura 
                      ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30' 
                      : 'bg-slate-700 text-white hover:bg-slate-600'
                  }`}
                >
                  {modoEscuroAssinatura ? '☀️ Claro' : '🌙 Escuro'}
                </button>
                <button
                  onClick={() => setMostrarConfigAssinatura(false)}
                  className={`p-2 rounded transition-colors ${modoEscuroAssinatura ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
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
                <div className={`rounded border ${modoEscuroAssinatura ? 'border-slate-700 bg-slate-800' : 'border-gray-200 bg-gray-50'} overflow-hidden`}>
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
                <div className={`rounded border ${modoEscuroAssinatura ? 'border-slate-700 bg-slate-800' : 'border-gray-200 bg-gray-50'} p-4 space-y-3`}>
                  <div className="grid grid-cols-[100px_1fr] items-center gap-3">
                    <label className={`text-sm ${modoEscuroAssinatura ? 'text-slate-400' : 'text-gray-600'}`}>Conta:</label>
                    <select 
                      value={selectedAccount || ''}
                      onChange={(e) => setSelectedAccount(e.target.value)}
                      className={`px-3 py-2 rounded text-sm border ${
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
                      className={`px-3 py-2 rounded text-sm border ${
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
                      className={`px-3 py-2 rounded text-sm border ${
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
                className={`px-4 py-2 rounded font-medium transition-colors ${
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
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-medium transition-colors"
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
          <div className={`rounded-lg shadow-2xl w-full max-w-4xl mx-4 h-[85vh] flex flex-col overflow-hidden border transition-colors ${modoEscuroAssinatura ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200'}`}>
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
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded text-sm font-bold transition-colors shadow-sm">Guardar</button>
              <button onClick={() => { setMostrarEditarAssinatura(false); setMostrarConfigAssinatura(true) }}
                className={`px-6 py-2 rounded text-sm font-bold transition-colors ${modoEscuroAssinatura ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal de Importação de Email */}
      {showImportGmail && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center">
          <div className="bg-white rounded shadow-xl w-full max-w-md mx-4 overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                {/* Ícone Google com cores reais */}
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Importar Conta de Email
              </h3>
              <button
                onClick={() => setShowImportGmail(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              {/* Banner com link para instruções */}
              <div className="bg-blue-50 border border-blue-200 rounded p-3">
                <p className="text-sm text-blue-700">
                  💡 <strong>Dica:</strong> Para Gmail, precisa de uma <strong>Senha de App</strong>.
                </p>
                <button 
                  onClick={() => setShowPasswordHelp(!showPasswordHelp)}
                  className="text-xs text-blue-600 hover:text-blue-800 underline mt-1 inline-flex items-center gap-1"
                >
                  Como obter a Senha de App
                  <svg className={`w-3 h-3 transition-transform ${showPasswordHelp ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {/* Painel deslizante com instruções */}
                <div className={`overflow-hidden transition-all duration-300 ${showPasswordHelp ? 'max-h-96 mt-3' : 'max-h-0'}`}>
                  <div className="bg-white border border-blue-200 rounded p-3 text-sm">
                    <h4 className="font-semibold text-blue-800 mb-2">Como obter a Senha de App:</h4>
                    <ol className="space-y-2 text-gray-700 text-xs">
                      <li className="flex gap-2">
                        <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium shrink-0">1</span>
                        <span>Acesse <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium">myaccount.google.com/apppasswords</a></span>
                      </li>
                      <li className="flex gap-2">
                        <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium shrink-0">2</span>
                        <span>Faça login na sua conta Google</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium shrink-0">3</span>
                        <span>Em "Selecionar app", escolha "Email"</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium shrink-0">4</span>
                        <span>Em "Selecionar dispositivo", escolha "Outro"</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium shrink-0">5</span>
                        <span>Digite um nome (ex: "VisualDesign")</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium shrink-0">6</span>
                        <span>Clique em "Gerar" e copie a senha de 16 caracteres</span>
                      </li>
                    </ol>
                    <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-yellow-800 text-xs">
                      ⚠️ A senha de app só é visível uma vez. Guarde-a com segurança!
                    </div>
                  </div>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  id="gmailSourceEmail"
                  placeholder="seu.email@gmail.com (ou qualquer outro)"
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
                <input
                  type="password"
                  id="gmailSourcePassword"
                  placeholder="Senha de App (Gmail) ou senha normal"
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Gmail: Use Senha de App. E-mail Corporativo: Use sua senha normal.
                </p>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setShowImportGmail(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  const sourceEmail = (document.getElementById('gmailSourceEmail') as HTMLInputElement)?.value?.trim()
                  const sourcePassword = (document.getElementById('gmailSourcePassword') as HTMLInputElement)?.value
                  
                  if (!sourceEmail || !sourcePassword) {
                    alert('Preencha o email e a senha')
                    return
                  }

                  const domain = sourceEmail.split('@')[1] || 'unknown'
                  const btn = document.getElementById('btnImportarConta') as HTMLButtonElement
                  if (btn) { btn.disabled = true; btn.textContent = 'A verificar...' }

                  // Testar ligação IMAP antes de guardar
                  try {
                    const testRes = await fetch('/api/read-emails', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        email: sourceEmail,
                        password: sourcePassword,
                        folders: ['INBOX'],
                        limit: 1
                      })
                    })
                    const testData = await testRes.json()

                    if (!testData.success) {
                      alert(`❌ Não foi possível ligar à conta:\n${testData.error || 'Credenciais inválidas'}\n\nPara Gmail use uma Senha de App de 16 caracteres.`)
                      if (btn) { btn.disabled = false; btn.textContent = 'Importar Conta' }
                      return
                    }
                  } catch (e) {
                    alert('❌ Erro ao verificar a conta. Tente novamente.')
                    if (btn) { btn.disabled = false; btn.textContent = 'Importar Conta' }
                    return
                  }
                  
                  const importedAccount: EmailAccount = {
                    email: sourceEmail,
                    name: sourceEmail.split('@')[0],
                    domain: domain,
                    password: sourcePassword,
                    tipo: 'imported'
                  }
                  
                  // Guardar no localStorage para persistir entre recarregamentos
                  const IMPORTED_KEY = 'webmail_imported_accounts_v1'
                  try {
                    const saved = localStorage.getItem(IMPORTED_KEY)
                    const list: EmailAccount[] = saved ? JSON.parse(saved) : []
                    // Substituir se já existir, senão adicionar
                    const idx = list.findIndex(a => a.email === sourceEmail)
                    if (idx >= 0) list[idx] = importedAccount
                    else list.push(importedAccount)
                    localStorage.setItem(IMPORTED_KEY, JSON.stringify(list))
                  } catch (e) {
                    console.error('Erro ao guardar conta importada:', e)
                  }

                  // Adicionar à lista de contas em memória
                  setAccounts(prev => prev.find(a => a.email === sourceEmail) ? prev : [...prev, importedAccount])
                  setAllAccounts(prev => prev.find(a => a.email === sourceEmail) ? prev : [...prev, importedAccount])
                  setSelectedAccount(sourceEmail)
                  
                  alert(`✅ Conta ${sourceEmail} importada e ligada com sucesso!`)
                  setShowImportGmail(false)
                }}
                id="btnImportarConta"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition-colors disabled:opacity-50"
              >
                Importar Conta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Diagnóstico IMAP */}
      {showDiagnostico && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center">
          <div className="bg-white rounded shadow-xl w-full max-w-4xl mx-4 overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Activity className="w-5 h-5 text-cyan-600" />
                Diagnóstico IMAP - {selectedAccount}
              </h3>
              <button
                onClick={() => setShowDiagnostico(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              {diagnosticoLoading && (
                <div className="flex items-center justify-center gap-2 py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-cyan-600" />
                  <span className="text-gray-600">Verificando pastas IMAP...</span>
                </div>
              )}
              
              {diagnosticoResult && (
                <>
                  {diagnosticoResult.error ? (
                    <div className="bg-red-50 border border-red-200 rounded p-4">
                      <p className="text-red-800 font-medium">Erro</p>
                      <p className="text-red-600 text-sm mt-1">{diagnosticoResult.error}</p>
                    </div>
                  ) : (
                    <>
                      {diagnosticoResult.success && (
                        <div className="space-y-4">
                          <p className="text-sm text-gray-600">
                            Total de pastas encontradas: <span className="font-semibold text-gray-900">{diagnosticoResult.allFolders?.length}</span>
                          </p>
                          
                          {/* Pastas Comuns */}
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-3">Status das Pastas Padrão:</h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              {Object.entries(diagnosticoResult.commonFolders || {}).map(([name, status]: [string, any]) => (
                                <div
                                  key={name}
                                  className={`p-3 rounded border ${
                                    status.exists
                                      ? 'bg-green-50 border-green-200'
                                      : 'bg-red-50 border-red-200'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className={`font-medium text-sm ${status.exists ? 'text-green-800' : 'text-red-800'}`}>
                                      {name}
                                    </span>
                                    {status.exists ? (
                                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                                    ) : (
                                      <AlertCircle className="w-4 h-4 text-red-600" />
                                    )}
                                  </div>
                                  {status.exists && (
                                    <p className="text-xs text-green-600 mt-1">
                                      {status.total} emails
                                    </p>
                                  )}
                                  {!status.exists && (
                                    <p className="text-xs text-red-500 mt-1">
                                      Não existe
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                          
                          {/* Todas as Pastas */}
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-3">Todas as Pastas no Servidor:</h4>
                            <div className="bg-gray-900 rounded p-4 overflow-auto max-h-60">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="text-gray-400 border-b border-gray-700">
                                    <th className="text-left py-2 px-3">Caminho</th>
                                    <th className="text-left py-2 px-3">Flags</th>
                                    <th className="text-left py-2 px-3">Uso Especial</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {diagnosticoResult.allFolders?.map((folder: any, idx: number) => (
                                    <tr key={idx} className="text-gray-300 border-b border-gray-800">
                                      <td className="py-2 px-3 font-mono text-cyan-400">{folder.path}</td>
                                      <td className="py-2 px-3">{folder.flags?.join(', ') || '-'}</td>
                                      <td className="py-2 px-3">{folder.specialUse || '-'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
              
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowDiagnostico(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Fechar
                </button>
                <button
                  onClick={runDiagnostico}
                  disabled={diagnosticoLoading}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-400 text-white rounded font-medium transition-colors flex items-center gap-2"
                >
                  {diagnosticoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  {diagnosticoLoading ? 'Verificando...' : 'Verificar Novamente'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
