'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import {
  Users, Search, Server as ServerIcon, Settings, Target, HelpCircle,
  Menu, Bell, ChevronDown, Check, CreditCard, ChevronDown as ChevronDownIcon,
  Search as SearchIcon, Paperclip as PaperclipIcon, Check as CheckIcon,
  MoreVertical as MoreVerticalIcon, Star as StarIcon, Reply as ReplyIcon,
  CornerUpRight as CornerUpRightIcon, Trash as TrashIcon, Download as DownloadIcon,
  Plus, Plus as PlusIcon, LayoutGrid, Palette, Type, MousePointer, Box,
  Trash2 as Trash2Icon, RefreshCw as RefreshCwIcon, LogOut as LogOutIcon, X, Upload,
  Edit2, Pause, Play, Trash2, RefreshCw, LogOut, Package, Server, Lock, LockOpen, Edit, Power, FolderOpen, FileText, Archive, AlertCircle, Globe as GlobeIcon, ChevronRight as ChevronRightIcon, Image as ImageIcon
} from 'lucide-react'
import { detectDomainConfig } from '@/lib/email-autoconfig'
import { AddEmailAccountModal } from '@/components/AddEmailAccountModal'
const CORES_PALETA = [
  '#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#ffffff',
  '#ff0000', '#ff4500', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff',
  '#9900ff', '#ff00ff', '#e6b8a2', '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3',
  '#c9daf8', '#cfe2f3', '#d9d2e9', '#ead1dc', '#cc0000', '#e69138', '#f1c232', '#6aa84f',
  '#45818e', '#3c78d8', '#3d85c6', '#674ea7', '#a64d79', '#85200c', '#783f04', '#7f6000',
]



export function EmailWebmailSection({
  mostrarAdicionarConta: propMostrarAdicionarConta,
  setMostrarAdicionarConta: propSetMostrarAdicionarConta,
  modalAdicionarPasso: propModalAdicionarPasso,
  setModalAdicionarPasso: propSetModalAdicionarPasso,
  emailOrigem: propEmailOrigem,
  sites = [],
  defaultCompose = false,
  onCloseCompose,
  onComposeStateChange,
  hideSidebar = false,
  // Props para assinaturas externas (quando usado inline)
  externalAssinaturas,
  externalAssinaturaAtiva,
  externalSetAssinaturas,
  externalSetAssinaturaAtiva,
  externalAssinaturasPorEmailRef,
  externalModoEscuro,
  isAdmin = false
}: {
  mostrarAdicionarConta?: boolean
  setMostrarAdicionarConta?: (value: boolean) => void
  modalAdicionarPasso?: 'escolher' | 'webmail' | 'google' | 'hotmail'
  setModalAdicionarPasso?: (value: 'escolher' | 'webmail' | 'google' | 'hotmail') => void
  emailOrigem?: string | null
  sites?: any[]
  defaultCompose?: boolean
  onCloseCompose?: () => void
  onComposeStateChange?: (isActive: boolean) => void
  hideSidebar?: boolean
  // Props para assinaturas externas
  externalAssinaturas?: { nome: string, activa: boolean, texto: string, imagemUrl: string }[]
  externalAssinaturaAtiva?: number
  externalSetAssinaturas?: React.Dispatch<React.SetStateAction<{ nome: string, activa: boolean, texto: string, imagemUrl: string }[]>>
  externalSetAssinaturaAtiva?: (index: number) => void
  externalAssinaturasPorEmailRef?: React.MutableRefObject<Record<string, any>>
  externalModoEscuro?: boolean
  isAdmin?: boolean
}) {
  const [pastaActiva, setPastaActiva] = useState('Caixa de Entrada')
  const [emails, setEmails] = useState<any[]>([])
  const [emailsSelecionados, setEmailsSelecionados] = useState<any[]>([])
  const [modalEmail, setModalEmail] = useState<any>(null)
  const [pesquisa, setPesquisa] = useState('')
  const [searchTerm, setSearchTerm] = useState('') // Termo real enviado à API
  const [rascunhos, setRascunhos] = useState([])
  const [rascunhoAtual, setRascunhoAtual] = useState(null)
  const [modoResposta, setModoResposta] = useState<'none' | 'reply' | 'forward'>('none')
  const [compose, setCompose] = useState({ para: '', cc: '', bcc: '', assunto: '', corpo: '' })
  const [mostrarCompose, setMostrarCompose] = useState(defaultCompose)

  // Notificar o componente pai quando o estado do compose muda
  useEffect(() => {
    if (defaultCompose) setMostrarCompose(true)
  }, [defaultCompose])

  useEffect(() => {
    onComposeStateChange?.(mostrarCompose)
  }, [mostrarCompose, onComposeStateChange])


  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [assinatura, setAssinatura] = useState('')
  const [mostrarConfigAssinatura, setMostrarConfigAssinatura] = useState(false)
  const [contactos, setContactos] = useState([
    { nome: 'Suporte Técnico', email: 'suporte@visualdesigne.com' },
  ])
  const [mostrarConfigContactos, setMostrarConfigContactos] = useState(false)
  const [novoContacto, setNovoContacto] = useState({ nome: '', email: '' })
  const [emailsOrigem, setEmailsOrigem] = useState<{ email: string, tipo: string, nome: string, password?: string, senha_cyberpanel?: string }[]>([])
  const [emailOrigem, setEmailOrigem] = useState('')
  const [emailOrigemPassword, setEmailOrigemPassword] = useState('')

  const memoEmailsOrigem = useMemo(() => emailsOrigem, [emailsOrigem])

  // Mapa de credenciais padrão para emails do sistema (fallback)
  const CREDENCIAIS_PADRAO: Record<string, string> = {
    'silva.chamo@visualdesigne.com': 'Meckito#77?*',
    'duduchamatavele@visualdesigne.com': 'Dudu#2425?*',
    'geral@visualdesigne.com': 'Ge.Vd#2425?*',
    'admin@visualdesigne.com': 'Ad.Vd#2425?*',
    'info@visualdesigne.com': 'Informação!#2020?*',
    'suporte@visualdesigne.com': 'SupaEmail#2026?*',
    'noreply@visualdesigne.com': 'VisualDesign#2026',
  }

  // 🚀 FUNÇÃO HELPER: Buscar senha dinamicamente da API segura
  const buscarSenhaDinamica = async (email: string): Promise<string | null> => {
    try {
      const res = await fetch('/api/email-senha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })
      const data = await res.json()
      if (data.success && data.senha) {
        return data.senha
      }
    } catch (e) {
      console.error('[EmailWebmail] Erro ao buscar senha dinâmica:', e)
    }
    return null
  }

  // Configurar email e senha automaticamente quando abre o compositor (APENAS se não houver email selecionado)
  useEffect(() => {
    if (mostrarCompose) {
      const configurarEmailAutomatico = async () => {
        // SÓ configura automaticamente se NÃO houver email já selecionado
        if (emailOrigem) {
          // Já tem email selecionado - só garantir que temos a senha
          if (!emailOrigemPassword) {
            // 🚀 Buscar senha dinamicamente da API segura
            const senhaDinamica = await buscarSenhaDinamica(emailOrigem)
            if (senhaDinamica) {
              setEmailOrigemPassword(senhaDinamica)
            } else if (CREDENCIAIS_PADRAO[emailOrigem]) {
              setEmailOrigemPassword(CREDENCIAIS_PADRAO[emailOrigem])
            }
          }
          return
        }
        
        // Se não tem email selecionado, usar propEmailOrigem ou o primeiro da lista
        if (propEmailOrigem) {
          setEmailOrigem(propEmailOrigem)
          // 🚀 Buscar senha dinamicamente da API segura
          const senhaDinamica = await buscarSenhaDinamica(propEmailOrigem)
          if (senhaDinamica) {
            setEmailOrigemPassword(senhaDinamica)
          } else if (CREDENCIAIS_PADRAO[propEmailOrigem]) {
            setEmailOrigemPassword(CREDENCIAIS_PADRAO[propEmailOrigem])
          }
        } else if (emailsOrigem.length > 0) {
          // Se não tem prop, usa o primeiro email da lista
          const primeiroEmail = emailsOrigem[0]
          setEmailOrigem(primeiroEmail.email)
          // 🚀 Buscar senha dinamicamente da API segura
          const senhaDinamica = await buscarSenhaDinamica(primeiroEmail.email)
          if (senhaDinamica) {
            setEmailOrigemPassword(senhaDinamica)
          } else if (primeiroEmail.password) {
            setEmailOrigemPassword(primeiroEmail.password)
          } else if (CREDENCIAIS_PADRAO[primeiroEmail.email]) {
            setEmailOrigemPassword(CREDENCIAIS_PADRAO[primeiroEmail.email])
          }
        }
      }
      configurarEmailAutomatico()
    }
  }, [mostrarCompose, propEmailOrigem, emailsOrigem, emailOrigem, emailOrigemPassword])

  // NOVO: Configurar email e senha quando o componente monta (para carregar caixa de entrada)
  useEffect(() => {
    const configurarEmailInicial = async () => {
      // Se tem propEmailOrigem, configura imediatamente
      if (propEmailOrigem) {
        setEmailOrigem(propEmailOrigem)
        // Tentar obter senha da API dinâmica primeiro
        const senhaDinamica = await buscarSenhaDinamica(propEmailOrigem)
        if (senhaDinamica) {
          setEmailOrigemPassword(senhaDinamica)
        } else if (CREDENCIAIS_PADRAO[propEmailOrigem]) {
          setEmailOrigemPassword(CREDENCIAIS_PADRAO[propEmailOrigem])
        }
      }
    }
    configurarEmailInicial()
  }, [propEmailOrigem])
  const [todasAsContas, setTodasAsContas] = useState(false)
  const [carregandoEmails, setCarregandoEmails] = useState(false)
  const [erroEmail, setErroEmail] = useState('')
  const [mostrarAlterarSenhaModal, setMostrarAlterarSenhaModal] = useState(false)
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmNovaSenha, setConfirmNovaSenha] = useState('')
  const [alterandoSenha, setAlterandoSenha] = useState(false)
  const editorRef = useRef<HTMLDivElement>(null)
  const [credenciaisNovas, setCredenciaisNovas] = useState<any>(null)
  const [mostrarCredenciais, setMostrarCredenciais] = useState(false)
  const [novaContaForm, setNovaContaForm] = useState({ nome: '', email: '', password: '', servidor: '', porta: '993', smtp: '', smtpPorta: '465', assinatura: '' })
  const [autoconfigurando, setAutoconfigurando] = useState(false)
  const [mostrarAvancado, setMostrarAvancado] = useState(false)

  // Autoconfiguração em tempo real
  useEffect(() => {
    const email = novaContaForm.email
    if (email && email.includes('@') && email.split('@')[1].length > 3) {
      const timer = setTimeout(async () => {
        setAutoconfigurando(true)
        try {
          const res = await fetch('/api/email-autoconfig', {
            method: 'POST',
            body: JSON.stringify({ email })
          })
          const data = await res.json()
          if (data.success && data.config) {
            setNovaContaForm(prev => ({
              ...prev,
              nome: prev.nome || data.config.displayName,
              servidor: data.config.imap,
              porta: String(data.config.ports.imap),
              smtp: data.config.smtp,
              smtpPorta: String(data.config.ports.smtp),
              assinatura: data.config.signature
            }))
          }
        } catch (err) {
          console.error('Erro na autoconfiguração:', err)
        } finally {
          setAutoconfigurando(false)
        }
      }, 600)
      return () => clearTimeout(timer)
    }
  }, [novaContaForm.email])
  const [corTexto, setCorTexto] = useState('#000000')
  const [corFundo, setCorFundo] = useState('#ffff00')
  const [mostrarPaletaCor, setMostrarPaletaCor] = useState<'texto' | 'fundo' | null>(null)
  const [anexos, setAnexos] = useState<File[]>([])
  const [mostrarPopupLink, setMostrarPopupLink] = useState(false)
  const [urlLinkTemp, setUrlLinkTemp] = useState('')
  const [rangeLink, setRangeLink] = useState<Range | null>(null)
  const [mostrarPopupFechar, setMostrarPopupFechar] = useState(false)
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({})
  const toggleExpand = (email: string) => setExpandedMap(prev => ({ ...prev, [email]: !prev[email] }))

  // 🚀 URL direto do SnappyMail - login manual
  const getWebmailUrl = () => {
    return 'https://109.199.104.22:8090/snappymail/'
  }

  // 🔓 Abrir SnappyMail diretamente
  const abrirWebmailAutoLogin = () => {
    window.open(getWebmailUrl(), '_blank')
  }

  // Usar props ou valores locais
  const mostrarAdicionarConta = propMostrarAdicionarConta || false
  const setMostrarAdicionarConta = propSetMostrarAdicionarConta || (() => { })
  const modalAdicionarPasso = propModalAdicionarPasso || 'escolher'
  const setModalAdicionarPasso = propSetModalAdicionarPasso || (() => { })

  const pastasIcones = [
    { nome: 'Caixa de Entrada', icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg> },
    { nome: 'Enviados', icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg> },
    { nome: 'Rascunhos', icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg> },
    { nome: 'Arquivo', icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 3h18v4H3zM5 7v13a1 1 0 001 1h12a1 1 0 001-1V7M10 12h4" /></svg> },
    { nome: 'Lixo', icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" /></svg> },
    { nome: 'Spam', icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg> },
  ]

  // Buscar detalhes do email quando abrir o modal
  useEffect(() => {
    if (modalEmail && !modalEmail.corpo) {
      const carregarCorpo = async () => {
        try {
          const res = await fetch('/api/read-email-detail', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: emailOrigem || (todasAsContas ? modalEmail.conta : ''),
              password: emailOrigemPassword || (() => {
                const senhas: Record<string, string> = {
                  'geral@visualdesigne.com': 'Ge.Vd#2425?*',
                  'silva.chamo@visualdesigne.com': 'Meckito#77?*',
                  'admin@visualdesigne.com': 'Ad.Vd#2425?*',
                  'noreply@visualdesigne.com': 'VisualDesign#2026',
                  'suporte@visualdesigne.com': 'SupaEmail#2026?*',
                }
                return senhas[emailOrigem || ''] || ''
              })(),
              emailId: modalEmail.id,
              folder: pastaParaIMAP(pastaActiva)
            })
          })
          const data = await res.json()
          if (data.success) {
            setModalEmail((prev: any) => ({ ...prev, corpo: data.corpo, anexos: data.anexos }))
          }
        } catch (e) {
          console.error('Erro ao carregar corpo:', e)
        }
      }
      carregarCorpo()
    }
  }, [modalEmail])

  // 🚀 Carregar contas do CyberPanel + Supabase (consolidado)
  // ⚡ OTIMIZAÇÃO: Se hideSidebar=true e propEmailOrigem existe, não carregar todas as contas
  useEffect(() => {
    const carregarContasCyberPanel = async () => {
      // 🎯 MODO RÁPIDO: Painel do cliente com email já selecionado
      if (hideSidebar && propEmailOrigem) {
        console.log('📧 [RÁPIDO] Modo cliente com email predefinido:', propEmailOrigem)
        // Buscar senha das credenciais padrão ou deixar vazio para buscar dinamicamente
        const senhaPadrao = CREDENCIAIS_PADRAO[propEmailOrigem] || ''
        setEmailsOrigem([{
          email: propEmailOrigem,
          tipo: 'webmail',
          nome: propEmailOrigem.split('@')[0],
          password: senhaPadrao
        }])
        setEmailOrigem(propEmailOrigem)
        if (senhaPadrao) setEmailOrigemPassword(senhaPadrao)
        setCarregandoEmails(false)
        return
      }

      console.log('📧 [Contacts] Iniciando carregamento de contactos (CyberPanel + Supabase)...')
      setCarregandoEmails(true)
      
      // Buscar emails consolidados (CyberPanel + Supabase)
      const allEmails: any[] = []
      // 🎯 NO MODO CLIENTE (hideSidebar=true): mostrar apenas emails do domínio do cliente logado
      // No modo admin: mostrar apenas domínios da VisualDesigne
      const dominiosValidos = hideSidebar && propEmailOrigem 
        ? [propEmailOrigem.split('@')[1]]  // Apenas domínio do cliente logado
        : ['visualdesigne.com', 'anap.co.mz', 'entrecampos.co.mz']  // Apenas domínios admin
      
      // ⚡ Timeout para cada requisição (5 segundos max)
      const fetchWithTimeout = async (domain: string) => {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000)
        try {
          // Usar novo endpoint que combina CyberPanel + Supabase
          const res = await fetch(`/api/get-all-contacts?domain=${encodeURIComponent(domain)}&includeSupabase=true`, {
            signal: controller.signal
          })
          clearTimeout(timeoutId)
          return await res.json()
        } catch (e) {
          clearTimeout(timeoutId)
          // Silenciar AbortError (timeout expirado)
          if (e instanceof DOMException && e.name === 'AbortError') {
            console.log(`📧 [Contacts] Timeout ao buscar contactos do domínio ${domain}`)
            return { success: false, emails: [] }
          }
          throw e
        }
      }
      
      for (const domain of dominiosValidos) {
        try {
          console.log(`📧 [Contacts] Buscando contactos do domínio: ${domain}`)
          const data = await fetchWithTimeout(domain)
          
          if (data.success && data.emails?.length > 0) {
            data.emails.forEach((email: string) => {
              // ✅ Emails já filtrados no backend (sem "joao", "teste", etc)
              const emailDomain = email.split('@')[1]
              if (dominiosValidos.includes(emailDomain)) {
                allEmails.push({
                  email,
                  tipo: 'webmail',
                  nome: email.split('@')[0],
                  password: ''
                })
              }
            })
          }
        } catch (e) {
          // Silenciar AbortError (timeout expirado) - já tratado em fetchWithTimeout
          if (e instanceof DOMException && e.name === 'AbortError') {
            // Timeout silencioso - já logado em fetchWithTimeout
          } else {
            console.error(`📧 [Contacts] Erro no domínio ${domain}:`, e)
          }
        }
      }
      
      console.log(`📧 [Contacts] Total contactos carregados: ${allEmails.length}`)
      setEmailsOrigem(allEmails)
      
      // Selecionar o email automaticamente (preferência para silva.chamo@visualdesigne.com)
      if (allEmails.length > 0 && !emailOrigem) {
        const silvaAccount = allEmails.find(a => a.email === 'silva.chamo@visualdesigne.com')
        const defaultAccount = silvaAccount || allEmails[0]
        
        console.log(`📧 [Contacts] Selecionando contacto padrão: ${defaultAccount.email}`)
        setEmailOrigem(defaultAccount.email)
        const senha = CREDENCIAIS_PADRAO[defaultAccount.email] || ''
        if (senha) setEmailOrigemPassword(senha)
      }
      
      setCarregandoEmails(false)
    }
    
    carregarContasCyberPanel()
  }, [sites, hideSidebar, propEmailOrigem])

  // Debounce para a pesquisa
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(pesquisa)
    }, 500)
    return () => clearTimeout(timer)
  }, [pesquisa])

  // Carregar emails da pasta activa
  useEffect(() => {
    // Se "Todas as Contas" estiver ativo, carregamos apenas a pasta equivalente nas contas todas
    const payloadFolders = [pastaParaIMAP(pastaActiva)]

    const carregar = async () => {
      console.log(`📧 [Frontend] Iniciando carregamento...`)
      console.log(`📧 [Frontend] todasAsContas: ${todasAsContas}, emailsOrigem.length: ${emailsOrigem.length}`)
      console.log(`📧 [Frontend] emailOrigem: ${emailOrigem}, pasta: ${pastaActiva}`)
      
      setCarregandoEmails(true)
      setErroEmail('')
      try {
        const body: any = {
          folders: payloadFolders,
          page: 1,
          limit: todasAsContas ? 10 : 20,
          search: searchTerm // Adiciona o termo de pesquisa
        }

        if (todasAsContas) {
          body.allAccounts = true
          body.emails = memoEmailsOrigem.map(e => e.email)
          console.log(`📧 [Frontend] Modo Todas as Contas - emails:`, body.emails)
          
          // Se não tem emails para buscar, não faz sentido chamar a API
          if (body.emails.length === 0) {
            console.log(`📧 [Frontend] Sem emails no modo allAccounts, pulando requisição`)
            setCarregandoEmails(false)
            setEmails([])
            return
          }
        } else {
          // 🚀 Buscar senha dinamicamente se não estiver no estado
          let senhaImap = emailOrigemPassword
          if (!senhaImap && emailOrigem) {
            const senhaObtida = await buscarSenhaDinamica(emailOrigem)
            senhaImap = senhaObtida || ''
          }
          if (!senhaImap) {
            senhaImap = CREDENCIAIS_PADRAO[emailOrigem || ''] || ''
          }
          
          console.log(`📧 [Frontend] Modo conta individual - email: ${emailOrigem}, temSenha: ${!!senhaImap}`)
          if (!emailOrigem || !senhaImap) {
            console.log(`📧 [Frontend] Sem email ou senha, abortando`)
            setCarregandoEmails(false)
            setErroEmail(emailOrigem 
              ? `Senha não encontrada para ${emailOrigem}. Verifique a configuração da conta.` 
              : 'Selecione uma conta de email'
            )
            return
          }
          body.email = emailOrigem
          body.password = senhaImap
        }

        console.log(`📧 [Frontend] Chamando API read-emails...`)
        const res = await fetch('/api/read-emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        })
        const data = await res.json()
        console.log(`📧 [Frontend] Resposta API:`, { success: data.success, total: data.total, emailsCount: data.emails?.length })
        
        if (data && data.success) {
          setEmails(data.emails)
        } else {
          const errMsg = data?.error || data?.message || data?.details || 'Erro desconhecido ao carregar emails'
          console.error(`📧 [Frontend] Erro da API:`, data)
          setErroEmail(errMsg)
        }
      } catch (e: any) { 
        console.error(`📧 [Frontend] Erro na requisição:`, e)
        setErroEmail(e.message) 
      }
      setCarregandoEmails(false)
    }
    carregar()
  }, [pastaActiva, emailOrigem, emailOrigemPassword, todasAsContas, emailsOrigem, searchTerm])

  const pastaParaIMAP = (pasta: string) => {
    if (pasta === 'Caixa de Entrada') return 'INBOX'
    const mapa: Record<string, string> = {
      'Enviados': 'Sent',
      'Rascunhos': 'Drafts',
      'Arquivo': 'Archive',
      'Lixo': 'Deleted Items',
      'Spam': 'Junk E-mail'
    }
    const target = mapa[pasta] || pasta
    return `INBOX.${target}`
  }

  const [mostrarCc, setMostrarCc] = useState(false)
  const [mostrarBcc, setMostrarBcc] = useState(false)
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
        } catch { }
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
  // Usar estado externo quando disponível (quando usado inline no WebmailSection)
  const [assinaturasInternal, setAssinaturasInternal] = useState<{ nome: string, activa: boolean, texto: string, imagemUrl: string }[]>([])
  const [assinaturaAtivaInternal, setAssinaturaAtivaInternal] = useState(0)
  
  const assinaturas = externalAssinaturas !== undefined ? externalAssinaturas : assinaturasInternal
  const setAssinaturas = externalSetAssinaturas !== undefined ? externalSetAssinaturas : setAssinaturasInternal
  const assinaturaAtiva = externalAssinaturaAtiva !== undefined ? externalAssinaturaAtiva : assinaturaAtivaInternal
  const setAssinaturaAtiva = externalSetAssinaturaAtiva !== undefined ? externalSetAssinaturaAtiva : setAssinaturaAtivaInternal

  // SINCRONIZAÇÃO INICIAL: Quando assinaturasPorEmail é carregado do localStorage
  // e emailOrigem já está definido, sincronizar o estado assinaturas
  useEffect(() => {
    if (emailOrigem && assinaturasPorEmail[emailOrigem]) {
      const config = assinaturasPorEmail[emailOrigem]
      console.log('[DEBUG] Sincronização inicial:', emailOrigem, config)
      setAssinaturas(config.assinaturas || [])
      setAssinaturaAtiva(config.assinaturaAtiva || 0)
    }
  }, [assinaturasPorEmail, emailOrigem])

  // Carregar assinaturas quando muda o email de origem
  useEffect(() => {
    console.log('[DEBUG] useEffect carregar assinaturas - emailOrigem:', emailOrigem)
    if (emailOrigem) {
      // Usar ref para evitar dependência circular
      const configAtual = assinaturasPorEmailRef.current[emailOrigem]
      console.log('[DEBUG] Config encontrada para', emailOrigem, ':', configAtual)
      if (configAtual) {
        // Carregar assinaturas salvas para esta conta
        if (configAtual.assinaturas && configAtual.assinaturas.length > 0) {
          setAssinaturas(configAtual.assinaturas)
          setAssinaturaAtiva(configAtual.assinaturaAtiva || 0)
          // Aplicar assinatura padrão automaticamente
          if (configAtual.assinaturaPadrao) {
            setAssinatura(configAtual.assinaturaPadrao)
          } else if (configAtual.assinaturas[configAtual.assinaturaAtiva || 0]?.texto) {
            setAssinatura(configAtual.assinaturas[configAtual.assinaturaAtiva || 0].texto)
          }
        } else {
          // Conta tem config mas sem assinaturas
          console.log('[DEBUG] Conta tem config mas sem assinaturas')
          setAssinaturas([])
          setAssinaturaAtiva(0)
          setAssinatura('')
        }
      } else {
        // Não há assinaturas salvas para esta conta - iniciar vazio
        console.log('[DEBUG] Nenhuma config encontrada para', emailOrigem)
        setAssinaturas([])
        setAssinaturaAtiva(0)
        setAssinatura('')
      }
    }
  }, [emailOrigem, assinaturasPorEmail])

  // DESATIVADO: Salvamento automático causava conflitos
  // Agora só salva manualmente quando muda de conta no dropdown
  // useEffect(() => {
  //   if (emailOrigem && typeof window !== 'undefined') {
  //     const config = { assinaturas, assinaturaAtiva, assinaturaPadrao: assinatura }
  //     const novoEstado = { ...assinaturasPorEmailRef.current, [emailOrigem]: config }
  //     setAssinaturasPorEmail(novoEstado)
  //     assinaturasPorEmailRef.current = novoEstado
  //     localStorage.setItem(STORAGE_KEY, JSON.stringify(novoEstado))
  //   }
  // }, [assinaturas, assinaturaAtiva, assinatura, emailOrigem])

  // Inserir assinatura automaticamente quando abre o compositor
  const jaInseriuAssinaturaRef = useRef(false)
  useEffect(() => {
    // Só executar quando acabou de abrir o compositor (mudou de false para true)
    if (mostrarCompose && !jaInseriuAssinaturaRef.current) {
      jaInseriuAssinaturaRef.current = true
      
      // Aguardar o editor estar montado no DOM
      setTimeout(() => {
        if (!editorRef.current) return
        
        // Verificar se há uma assinatura ativa para a conta atual
        const assinaturaAtivaObj = assinaturas.find((a, i) => i === assinaturaAtiva && (a.texto || a.imagemUrl))
        
        if (assinaturaAtivaObj) {
          if (assinaturaAtivaObj.imagemUrl) {
            // Se for imagem, inserir no editor alinhado à esquerda com 2 linhas vazias acima
            editorRef.current.innerHTML = `<div><br><br></div><div style="text-align:left;"><img src="${assinaturaAtivaObj.imagemUrl}" style="max-width:100%; max-height:200px; display:block; margin:0;" /></div>`
          } else if (assinaturaAtivaObj.texto) {
            // Se for texto, inserir no editor alinhado à esquerda com 2 linhas vazias acima
            const textoFormatado = assinaturaAtivaObj.texto.replace(/\n/g, '<br>')
            editorRef.current.innerHTML = `<div><br><br></div><div style="text-align:left;">--<br>${textoFormatado}</div>`
          }
          
          // Focar no editor e posicionar cursor no inicio (antes da assinatura)
          editorRef.current.focus()
          const range = document.createRange()
          const sel = window.getSelection()
          if (editorRef.current && editorRef.current.firstChild) {
            range.setStart(editorRef.current.firstChild, 0)
            range.collapse(true)
            sel?.removeAllRanges()
            sel?.addRange(range)
          }
        }
      }, 200) // Delay para garantir que o DOM está pronto
    }
    
    // Resetar quando fecha o compositor para permitir inserir novamente na proxima vez
    if (!mostrarCompose) {
      jaInseriuAssinaturaRef.current = false
    }
  }, [mostrarCompose, assinaturas, assinaturaAtiva])

  const execCmd = (cmd: string, value?: string) => {
    editorRef.current?.focus()
    document.execCommand(cmd, false, value)
  }

  const inserirLink = () => {
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0) setRangeLink(sel.getRangeAt(0).cloneRange())
    setUrlLinkTemp('')
    setMostrarPopupLink(true)
  }
  const confirmarLink = () => {
    if (urlLinkTemp) {
      editorRef.current?.focus()
      if (rangeLink) {
        const sel = window.getSelection()
        sel?.removeAllRanges()
        sel?.addRange(rangeLink)
      }
      const url = urlLinkTemp.startsWith('http') ? urlLinkTemp : 'https://' + urlLinkTemp
      document.execCommand('createLink', false, url)
      // Garantir que o link abre numa nova tab
      setTimeout(() => {
        const links = editorRef.current?.querySelectorAll('a')
        if (links?.length) {
          const last = links[links.length - 1] as HTMLAnchorElement
          last.target = '_blank'
          last.style.color = '#3b82f6'
          last.style.textDecoration = 'underline'
        }
      }, 50)
    }
    setMostrarPopupLink(false)
    setUrlLinkTemp('')
    setRangeLink(null)
  }

  const guardarRascunho = async () => {
    try {
      await fetch('/api/save-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailOrigem,
          password: emailOrigemPassword,
          to: compose.para,
          subject: compose.assunto,
          html: editorRef.current?.innerHTML || ''
        })
      })
    } catch (e) {
      console.error('Erro ao guardar rascunho:', e)
    }
    setMostrarPopupFechar(false)
    setMostrarCompose(false)
    setCompose({ para: '', cc: '', bcc: '', assunto: '', corpo: '' })
    setAnexos([])
    if (editorRef.current) editorRef.current.innerHTML = ''
  }

  const inserirImagem = () => {
    const sel = window.getSelection()
    const range = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).cloneRange() : null
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (ev) => {
        const base64 = ev.target?.result as string
        if (range) {
          const sel2 = window.getSelection()
          sel2?.removeAllRanges()
          sel2?.addRange(range)
        } else {
          editorRef.current?.focus()
        }
        document.execCommand('insertImage', false, base64)
        setTimeout(() => {
          const imgs = editorRef.current?.querySelectorAll('img')
          if (imgs?.length) {
            const last = imgs[imgs.length - 1] as HTMLImageElement
            last.style.maxWidth = '100%'
            last.style.borderRadius = '4px'
            last.style.cursor = 'pointer'
            last.style.resize = 'both'
            last.style.overflow = 'hidden'
            makeImageResizable(last)
          }
        }, 50)
      }
      reader.readAsDataURL(file)
    }
    input.click()
  }

  // Sistema simples de redimensionamento de imagens
  const [imagemSelecionada, setImagemSelecionada] = useState<HTMLImageElement | null>(null)

  const makeImageResizable = (img: HTMLImageElement) => {
    img.style.cursor = 'pointer'
    img.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      setImagemSelecionada(img)
    })
  }

  const resizeImagem = (tamanho: 'max' | 'med' | 'peq') => {
    if (!imagemSelecionada) return
    const img = imagemSelecionada
    if (tamanho === 'max') { img.style.width = '100%'; img.style.height = 'auto'; }
    else if (tamanho === 'med') { img.style.width = '50%'; img.style.height = 'auto'; }
    else if (tamanho === 'peq') { img.style.width = '25%'; img.style.height = 'auto'; }
  }

  const alinharImagem = (align: 'left' | 'center' | 'right') => {
    if (!imagemSelecionada) return
    imagemSelecionada.style.float = align === 'left' ? 'left' : align === 'right' ? 'right' : 'none'
    imagemSelecionada.style.display = align === 'center' ? 'block' : 'inline-block'
    imagemSelecionada.style.margin = align === 'center' ? '0 auto' : '0'
  }

  const deletarImagem = () => {
    if (!imagemSelecionada) return
    imagemSelecionada.remove()
    setImagemSelecionada(null)
  }

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.img-toolbar') && !target.closest('.editor-content img')) {
        setImagemSelecionada(null)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  const inserirAnexo = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files
      if (!files) return
      Array.from(files).forEach(file => {
        setAnexos(prev => [...prev, file])
      })
    }
    input.click()
  }

  const inserirTabela = (linhas = 2, colunas = 3) => {
    const table = document.createElement('table')
    table.className = 'editable-table'
    for (let r = 0; r < linhas; r++) {
      const tr = table.insertRow()
      for (let c = 0; c < colunas; c++) {
        const td = r === 0 ? document.createElement('th') : tr.insertCell()
        if (r === 0) {
          td.innerHTML = `Col ${c + 1}`
          tr.appendChild(td)
        } else {
          td.innerHTML = '&nbsp;'
        }
      }
    }
    const br = document.createElement('br')
    editorRef.current?.appendChild(table)
    editorRef.current?.appendChild(br)
  }

  const [mostrarPopupTabela, setMostrarPopupTabela] = useState(false)
  const [tabelaConfig, setTabelaConfig] = useState({ linhas: 3, colunas: 3 })

  const handleCloseModal = () => { setModalEmail(null); setModoResposta('none'); setCompose({ para: '', cc: '', bcc: '', assunto: '', corpo: '' }); setEnviado(false); setAnexos([]) }

  // ✅ DELETAR EMAIL
  const handleDeleteEmail = async (emailIdParam = null) => {
    const emailId = emailIdParam || modalEmail?.id

    // Solução viável: usar credenciais da primeira conta disponível quando "Todas as Contas" está ativo
    let emailParaUsar = emailOrigem
    let passwordParaUsar = emailOrigemPassword

    if (!emailParaUsar && todasAsContas && emailsOrigem.length > 0) {
      emailParaUsar = emailsOrigem[0].email
      passwordParaUsar = emailsOrigem[0].password || 'Ad.Vd#2425?*'
    }

    // Se ainda não tiver credenciais, usar fallback padrão
    if (!passwordParaUsar) {
      emailParaUsar = 'admin@your-domain.com'
      passwordParaUsar = 'Ad.Vd#2425?*'
    }

    // Debug para verificar parâmetros antes de enviar
    console.log('handleDeleteEmail - Parâmetros:', {
      emailId,
      emailParaUsar,
      passwordParaUsar: passwordParaUsar ? '[HIDDEN]' : null,
      pastaActiva,
      pastaIMAP: pastaParaIMAP(pastaActiva),
      todasAsContas,
      emailsOrigemLength: emailsOrigem.length
    })

    if (!emailId || !emailParaUsar) {
      alert('Por favor, selecione uma conta específica para realizar ações')
      return
    }

    try {
      const res = await fetch('/api/delete-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailParaUsar,
          password: passwordParaUsar,
          emailId: emailId,
          folder: pastaParaIMAP(pastaActiva)
        })
      })
      const data = await res.json()
      if (data.success) {
        if (!emailIdParam) setModalEmail(null)

        // Optimistic update: remove apenas o email apagado da lista local
        setEmails(prev => prev.filter(e => e.id !== emailId))
      } else {
        alert('Erro ao deletar: ' + data.error)
      }
    } catch (e: any) {
      alert('Erro: ' + e.message)
    }
  }

  // ✅ ENCAMINHAR EMAIL
  const handleForwardEmail = async () => {
    if (!modalEmail || !emailOrigem) return
    const forwardTo = prompt('Encaminhar para qual email?')
    if (!forwardTo) return
    try {
      const res = await fetch('/api/forward-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailOrigem,
          password: emailOrigemPassword || 'Ad.Vd#2425?*',
          emailId: modalEmail.id,
          forwardTo,
          folder: pastaActiva
        })
      })
      const data = await res.json()
      if (data.success) {
        alert('Email reenviado com sucesso!')
        setModalEmail(null)
      } else {
        alert('Erro ao encaminhar: ' + data.error)
      }
    } catch (e: any) {
      alert('Erro: ' + e.message)
    }
  }

  // ✅ ARQUIVAR EMAIL
  const handleArchiveEmail = async (emailIdParam = null) => {
    const emailId = emailIdParam || modalEmail?.id

    // Solução viável: usar credenciais da primeira conta disponível quando "Todas as Contas" está ativo
    let emailParaUsar = emailOrigem
    let passwordParaUsar = emailOrigemPassword

    if (!emailParaUsar && todasAsContas && emailsOrigem.length > 0) {
      emailParaUsar = emailsOrigem[0].email
      passwordParaUsar = emailsOrigem[0].password || 'Ad.Vd#2425?*'
    }

    // Se ainda não tiver credenciais, usar fallback padrão
    if (!passwordParaUsar) {
      emailParaUsar = 'admin@your-domain.com'
      passwordParaUsar = 'Ad.Vd#2425?*'
    }

    // Debug para verificar parâmetros antes de enviar
    console.log('handleArchiveEmail - Parâmetros:', {
      emailId,
      emailParaUsar,
      passwordParaUsar: passwordParaUsar ? '[HIDDEN]' : null,
      pastaActiva,
      pastaIMAP: pastaParaIMAP(pastaActiva),
      todasAsContas,
      emailsOrigemLength: emailsOrigem.length
    })

    if (!emailId || !emailParaUsar) {
      alert('Por favor, selecione uma conta específica para realizar ações')
      return
    }

    try {
      const res = await fetch('/api/archive-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailParaUsar,
          password: passwordParaUsar,
          emailId: emailId,
          fromFolder: pastaParaIMAP(pastaActiva)
        })
      })
      const data = await res.json()
      if (data.success) {
        if (!emailIdParam) setModalEmail(null)

        // Optimistic update: remove apenas o email arquivado da lista local
        setEmails(prev => prev.filter(e => e.id !== emailId))
      } else {
        alert('Erro ao arquivar: ' + data.error)
      }
    } catch (e: any) {
      alert('Erro: ' + e.message)
    }
  }

  // ✅ SPAM EMAIL
  const handleSpamEmail = async (emailIdParam = null) => {
    const emailId = emailIdParam || modalEmail?.id

    // Solução viável: usar credenciais da primeira conta disponível quando "Todas as Contas" está ativo
    let emailParaUsar = emailOrigem
    let passwordParaUsar = emailOrigemPassword

    if (!emailParaUsar && todasAsContas && emailsOrigem.length > 0) {
      emailParaUsar = emailsOrigem[0].email
      passwordParaUsar = emailsOrigem[0].password || 'Ad.Vd#2425?*'
    }

    // Se ainda não tiver credenciais, usar fallback padrão
    if (!passwordParaUsar) {
      emailParaUsar = 'admin@your-domain.com'
      passwordParaUsar = 'Ad.Vd#2425?*'
    }

    if (!emailId || !emailParaUsar) {
      alert('Por favor, selecione uma conta específica para realizar ações')
      return
    }

    try {
      const res = await fetch('/api/archive-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailParaUsar,
          password: passwordParaUsar,
          emailId: emailId,
          fromFolder: pastaParaIMAP(pastaActiva),
          toFolder: 'Spam'
        })
      })
      const data = await res.json()
      if (data.success) {
        if (!emailIdParam) setModalEmail(null)

        // Optimistic update: remove apenas o email marcado como spam da lista local
        setEmails(prev => prev.filter(e => e.id !== emailId))
      } else {
        alert('Erro ao mover para Spam: ' + data.error)
      }
    } catch (e: any) {
      alert('Erro: ' + e.message)
    }
  }

  // ✅ SALVAR RASCUNHO
  const handleDraftSave = async () => {
    const htmlCorpo = editorRef.current?.innerHTML || compose.corpo || ''
    
    // Rascunho permite salvar vazio
    try {
      const res = await fetch('/api/draft-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailOrigem || 'admin@your-domain.com',
          para: compose.para || '',
          cc: compose.cc || '',
          bcc: compose.bcc || '',
          assunto: compose.assunto || '(Sem Assunto)',
          corpo: htmlCorpo || '(Vazio)'
        })
      })
      const data = await res.json()
      if (data.success) {
        alert('Rascunho salvo!')
        setRascunhoAtual(data.draftId)
      } else {
        alert('Erro: ' + data.error)
      }
    } catch (e: any) {
      alert('Erro: ' + e.message)
    }
  }

  // ✅ CARREGAR RASCUNHO
  const handleDraftLoad = async () => {
    try {
      const res = await fetch('/api/draft-load', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailOrigem || 'admin@your-domain.com'
        })
      })
      const data = await res.json()
      if (data.success) {
        setRascunhos(data.drafts)
        alert(`${data.drafts.length} rascunho(s) carregado(s)`)
      } else {
        alert('Erro: ' + data.error)
      }
    } catch (e: any) {
      alert('Erro: ' + e.message)
    }
  }

  // ✅ DELETAR RASCUNHO
  const handleDraftDelete = async (draftId: any) => {
    try {
      const res = await fetch('/api/draft-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftId })
      })
      const data = await res.json()
      if (data.success) {
        setRascunhos(rascunhos.filter((r: any) => r.id !== draftId))
        alert('Rascunho deletado')
      } else {
        alert('Erro: ' + data.error)
      }
    } catch (e: any) {
      alert('Erro: ' + e.message)
    }
  }

  const [envioNotificacao, setEnvioNotificacao] = useState<{show: boolean, message: string, type: 'success' | 'error' | 'info'}>({show: false, message: '', type: 'info'})

  const handleSend = async () => {
    if (!emailOrigem) {
      alert('Selecciona uma conta de email')
      return
    }

    // 🚀 FECHAR COMPOSER IMEDIATAMENTE - envio em background
    const emailData = {
      from: emailOrigem,
      fromPassword: emailOrigemPassword,
      to: compose.para,
      cc: compose.cc,
      bcc: compose.bcc,
      subject: compose.assunto,
      html: editorRef.current?.innerHTML || '',
      assinatura: assinatura
    }

    // Limpar e fechar composer
    setMostrarCompose(false)
    setCompose({ para: '', cc: '', bcc: '', assunto: '', corpo: '' })
    setAnexos([])
    if (editorRef.current) editorRef.current.innerHTML = ''
    if (onCloseCompose) onCloseCompose()

    // Mostrar notificação de envio
    setEnvioNotificacao({show: true, message: 'A enviar email...', type: 'info'})

    // 🔄 PROCESSAR ENVIO EM BACKGROUND
    try {
      const htmlCorpo = emailData.html
      const htmlFinal = emailData.assinatura ? `${htmlCorpo}<br/><br/>--<br/>${emailData.assinatura.replace(/\n/g, '<br/>')}` : htmlCorpo
      const idempotencyKey = crypto.randomUUID()

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000)

      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          from: emailData.from,
          fromPassword: emailData.fromPassword,
          to: emailData.to,
          cc: emailData.cc,
          bcc: emailData.bcc,
          subject: emailData.subject,
          html: htmlFinal,
          idempotencyKey
        })
      })
      clearTimeout(timeoutId)

      const data = await res.json()
      if (data.success) {
        setEnvioNotificacao({show: true, message: '✅ Email enviado com sucesso!', type: 'success'})
      } else {
        setEnvioNotificacao({show: true, message: '❌ Erro ao enviar: ' + data.error, type: 'error'})
      }
    } catch (e: any) {
      if (e.name === 'AbortError') {
        setEnvioNotificacao({show: true, message: '⏳ Envio em andamento. Verifique a pasta Enviados.', type: 'info'})
      } else {
        setEnvioNotificacao({show: true, message: '❌ Erro: ' + e.message, type: 'error'})
      }
    }

    // Esconder notificação após 4 segundos
    setTimeout(() => {
      setEnvioNotificacao({show: false, message: '', type: 'info'})
    }, 4000)
  }

  const pastas = ['Caixa de Entrada', 'Enviados', 'Rascunhos', 'Arquivo', 'Lixo', 'Spam']

  const botoesFormato = [
    { l: 'N', t: 'Negrito' }, { l: 'I', t: 'Itálico' }, { l: 'S', t: 'Sublinhado' },
    { l: 'ab', t: 'Riscado' },
  ]

  return (
    <div className="flex flex-col h-full w-full relative">

      {/* 🚀 NOTIFICAÇÃO DE ENVIO (Toast) */}
      {envioNotificacao.show && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg border-l-4 flex items-center gap-3 transition-all ${
          envioNotificacao.type === 'success' ? 'bg-green-50 border-green-500 text-green-700' :
          envioNotificacao.type === 'error' ? 'bg-red-50 border-red-500 text-red-700' :
          'bg-blue-50 border-blue-500 text-blue-700'
        }`}>
          <span className="text-lg">
            {envioNotificacao.type === 'success' ? '✅' : envioNotificacao.type === 'error' ? '❌' : '⏳'}
          </span>
          <span className="text-sm font-medium">{envioNotificacao.message}</span>
        </div>
      )}

      {/* TOOLBAR PRINCIPAL - Escondida quando compose está ativo ou hideSidebar=true */}
      <div className={`bg-gray-100 px-4 py-2 flex items-center gap-2 flex-wrap border-b border-gray-200 ${(mostrarCompose || hideSidebar) ? 'hidden' : ''}`}>
        <button onClick={() => {
          setMostrarCompose(true)
          setEnviado(false)
          setCompose({ para: '', cc: '', bcc: '', assunto: '', corpo: '' })
          setAnexos([])
          setTimeout(() => {
            if (editorRef.current) editorRef.current.innerHTML = ''
          }, 50)
        }}
          className="bg-red-50 border border-red-300 text-red-600 hover:bg-red-100 hover:text-red-700  px-4 py-1.5 rounded-md text-sm font-bold flex items-center gap-2 transition-colors">
          Escrever
        </button>
      
      <a href={getWebmailUrl()} target="_blank"
        className="bg-gray-600 hover:bg-red-600  px-4 py-1.5 rounded-md text-sm font-bold flex items-center gap-2 transition-colors">
        {emailOrigem ? 'Webmail' : 'Webmail'}
      </a>
      <div className="w-px h-5 bg-gray-700 mx-1" />
      {emailsOrigem.length > 0 ? (
        <select 
          value={emailOrigem || (emailsOrigem.length > 0 ? emailsOrigem[0].email : '')} 
          onChange={e => { 
            setEmailOrigem(e.target.value); 
            setPastaActiva('Caixa de Entrada'); 
            setModalEmail(null); 
            const senha = CREDENCIAIS_PADRAO[e.target.value] || ''
            if (senha) setEmailOrigemPassword(senha)
          }} 
          className="px-3 py-1.5 rounded-md text-sm border border-gray-300 bg-white font-medium"
        >
          {memoEmailsOrigem.map(e => (
            <option key={e.email} value={e.email}>{e.email}</option>
          ))}
        </select>
      ) : (
        <div className="px-3 py-1.5 text-sm text-gray-500">Carregando emails...</div>
      )}
      <div className="ml-auto flex items-center gap-2">
        <button onClick={() => {
          // Sincronizar estado antes de abrir o modal
          if (emailOrigem && assinaturasPorEmailRef.current[emailOrigem]) {
            const config = assinaturasPorEmailRef.current[emailOrigem]
            console.log('[DEBUG] Abrir modal - sincronizando:', emailOrigem, config)
            setAssinaturas(config.assinaturas || [])
            setAssinaturaAtiva(config.assinaturaAtiva || 0)
          } else if (emailOrigem) {
            console.log('[DEBUG] Abrir modal - sem assinaturas para:', emailOrigem)
            setAssinaturas([])
            setAssinaturaAtiva(0)
          }
          setMostrarConfigAssinatura(true)
        }}
          className="text-gray-600 hover:text-red-500 text-sm px-4 py-1.5 rounded-md border border-gray-300 hover:border-red-500 transition-colors flex items-center gap-2 font-medium bg-white">
          Assinatura
        </button>
        <button onClick={() => setMostrarAdicionarConta(true)}
          className="bg-gray-500 hover:bg-gray-600  text-sm px-4 py-1.5 rounded-md border border-gray-500 hover:border-gray-600 transition-colors flex items-center gap-2 font-medium">
          <Plus className="w-4 h-4" />
          Adicionar Conta
        </button>
      </div>
      </div>

      {/* Mensagem de Erro */}
      {erroEmail && (
        <div className="bg-red-50 border-l-4 border-red-600 px-4 py-3 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">{erroEmail}</p>
            <p className="text-xs text-red-600 mt-0.5">
              Verifique se a senha da conta está correta ou tente novamente mais tarde. <button className="text-sm underline font-semibold" onClick={() => setMostrarAlterarSenhaModal(true)}>senha</button>
            </p>
          </div>
          <button 
            onClick={() => setErroEmail('')}
            className="text-red-400 hover:text-red-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* LISTA DE EMAILS */}
      <div className="flex-1 flex overflow-hidden bg-white relative">
        {/* SIDEBAR DE CONTAS - Escondida quando compose está ativo ou hideSidebar=true */}
        <div className={`shrink-0 border-r border-gray-200 bg-gray-50 flex flex-col overflow-y-auto h-[750px] ${(mostrarCompose || hideSidebar) ? 'hidden' : 'w-72'}`}>
          <div className="px-3 py-2 border-b border-gray-200"><p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Contas</p></div>
          {/* ✅ "TODAS AS CONTAS" - No topo, expandível */}
          <div className="border-b border-gray-100">
            <div className="flex items-center w-full">
              <button
                onClick={() => toggleExpand('todas-contas')}
                className="px-3 py-2.5 hover:bg-white transition-colors"
              >
                <svg
                  className="w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200"
                  style={{ transform: expandedMap['todas-contas'] ? 'rotate(90deg)' : 'rotate(0deg)' }}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
              <button
                onClick={() => {
                  setTodasAsContas(true)
                  setEmailOrigem('')
                  setModalEmail(null)
                }}
                className="flex-1 py-2.5 pr-3 text-left hover:bg-white transition-colors"
              >
                <span className={`text-sm truncate w-full block ${todasAsContas ? 'text-red-600 font-bold' : 'text-gray-700 font-medium'
                  }`}>
                  Todas as Contas
                </span>
              </button>
            </div>

            {expandedMap['todas-contas'] && (
              <div className="pl-5">
                {pastasIcones.map(p => (
                  <button
                    key={p.nome}
                    onClick={() => {
                      setTodasAsContas(true)
                      setEmailOrigem('')
                      setPastaActiva(p.nome)
                      setModalEmail(null)
                    }}
                    className={`flex items-center gap-1.5 w-full px-3 py-1 text-left text-sm hover:bg-white transition-colors ${pastaActiva === p.nome && todasAsContas ? 'text-red-600 font-semibold' : 'text-gray-500'
                      }`}
                  >
                    <span className="shrink-0">{p.icon}</span>
                    <span>{p.nome}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="border-b border-gray-100">
            <div className="px-3 py-2"><p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Pastas</p></div>
            <div className="pl-0">
              {pastasIcones.map(p => (
                <button key={p.nome} onClick={() => {
                    setTodasAsContas(false)
                    setPastaActiva(p.nome)
                    setModalEmail(null)
                  }}
                  className={`flex items-center gap-1.5 w-full px-3 py-2 text-left text-sm hover:bg-white transition-colors ${pastaActiva === p.nome ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                  <span className="shrink-0">{p.icon}</span>
                  <span>{p.nome}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        {/* ÁREA DE CONTEÚDO: Alterna entre Lista de Emails e Compose */}
        <div className={`flex-1 flex flex-col overflow-hidden ${hideSidebar ? 'w-full' : ''}`}>
          {mostrarCompose ? (
            /* ========== VIEW COMPOSE (Página de Escrever) ========== */
            <div className={`flex flex-col bg-white h-full min-h-0 ${hideSidebar ? 'w-full' : ''}`}>
              {/* Header do Compose - compacto, sem overflow */}
              <div className="bg-gray-50 border-b border-gray-200 flex shrink-0">
                {/* Coluna esquerda — botão Enviar */}
                <div className="flex flex-col border-r border-gray-200 shrink-0">
                  <button onClick={handleSend} disabled={enviando || !compose.para || !emailOrigem}
                    className="flex-1 bg-green-50 border border-green-300 text-green-600 hover:bg-green-100 hover:text-green-700 disabled:bg-green-600 disabled:cursor-not-allowed  font-bold px-6 text-sm flex flex-col items-center justify-center gap-1 shadow-sm min-w-[110px]">
                    {enviando
                      ? <><span className="text-xl">⏳</span><span className="text-[11px] tracking-wide">A enviar...</span></>
                      : <><svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg><span className="text-[11px] tracking-wide uppercase">Enviar</span></>
                    }
                  </button>
                </div>
                {/* Coluna direita — Campos */}
                <div className="flex-1 flex flex-col">
                  {/* Linha De + Selector de Assinatura + botão fechar */}
                  <div className="flex items-center border-b border-gray-200 px-3 py-1">
                    <span className="text-gray-500 text-xs w-16 shrink-0 font-medium">De:</span>
                    <select
                      value={emailOrigem}
                      onChange={e => {
                        const novoEmail = e.target.value
                        const emailAnterior = emailOrigem
                        
                        // Salvar assinaturas da conta anterior
                        if (emailAnterior) {
                          const configAnterior = { assinaturas, assinaturaAtiva, assinaturaPadrao: assinatura }
                          const estadoAtualizado = { ...assinaturasPorEmailRef.current, [emailAnterior]: configAnterior }
                          assinaturasPorEmailRef.current = estadoAtualizado
                          localStorage.setItem(STORAGE_KEY, JSON.stringify(estadoAtualizado))
                        }
                        
                        // Mudar para nova conta
                        setEmailOrigem(novoEmail)
                        
                        // Carregar assinaturas da nova conta
                        if (novoEmail && assinaturasPorEmailRef.current[novoEmail]) {
                          const config = assinaturasPorEmailRef.current[novoEmail]
                          setAssinaturas(config.assinaturas || [])
                          setAssinaturaAtiva(config.assinaturaAtiva || 0)
                        } else {
                          setAssinaturas([])
                          setAssinaturaAtiva(0)
                        }
                      }}
                      className="bg-transparent text-gray-900 text-sm outline-none flex-1">
                      <option value="" className="bg-white">Escolher email de origem...</option>
                      {memoEmailsOrigem.map(e => (
                        <option key={e.email} value={e.email} className="bg-white">
                          {e.nome} ({e.email}) {e.tipo === 'google' ? '📧' : e.tipo === 'hotmail' ? '📨' : '🌐'}
                        </option>
                      ))}
                    </select>
                    <button onClick={() => setMostrarPopupFechar(true)}
                      className="ml-2 w-8 h-full min-h-[32px] flex items-center justify-center bg-red-50 border border-red-300 text-red-600 hover:bg-red-100 hover:text-red-700  font-bold text-sm shrink-0 transition-colors -mr-0 self-stretch">✕</button>
                  </div>
                  {/* Linha Para */}
                  <div className="flex items-center border-b border-gray-200 px-3 py-1.5">
                    <span className="text-gray-500 text-xs w-16 shrink-0 font-medium">Para:</span>
                    <input list="contactos-list" value={compose.para} onChange={e => setCompose({ ...compose, para: e.target.value })}
                      className="flex-1 bg-transparent text-gray-900 text-sm outline-none" />
                    <datalist id="contactos-list">
                      {contactos.map(c => <option key={c.email} value={c.email}>{c.nome}</option>)}
                    </datalist>
                    <button title="Seleccionar contacto" className="text-gray-400 hover:text-gray-600 ml-2 text-xs border border-gray-300 rounded px-1.5 py-0.5">📖</button>
                    <button onClick={() => setMostrarCc(!mostrarCc)}
                      className={`ml-1 text-xs px-2 py-0.5 rounded border transition-colors ${mostrarCc ? 'border-blue-500 text-blue-600 bg-blue-50' : 'border-gray-200 text-gray-400 hover:text-gray-600'}`}>Cc</button>
                    <button onClick={() => setMostrarBcc(!mostrarBcc)}
                      className={`ml-1 text-xs px-2 py-0.5 rounded border transition-colors ${mostrarBcc ? 'border-blue-500 text-blue-600 bg-blue-50' : 'border-gray-200 text-gray-400 hover:text-gray-600'}`}>Bcc</button>
                  </div>
                  {/* Linha Cc */}
                  {mostrarCc && (
                    <div className="flex items-center border-b border-gray-200 px-3 py-1.5">
                      <span className="text-gray-500 text-xs w-16 shrink-0 font-medium">Cc:</span>
                      <input
                        value={compose.cc}
                        onChange={e => setCompose({ ...compose, cc: e.target.value })}
                        className="flex-1 bg-transparent text-gray-900 text-sm outline-none"
                      />
                      <button className="text-gray-400 hover:text-gray-600 ml-2 text-xs border border-gray-300 rounded px-1.5 py-0.5">📖</button>
                    </div>
                  )}
                  {/* Linha Bcc */}
                  {mostrarBcc && (
                    <div className="flex items-center border-b border-gray-200 px-3 py-1.5">
                      <span className="text-gray-500 text-xs w-16 shrink-0 font-medium">Bcc:</span>
                      <input
                        value={compose.bcc}
                        onChange={e => setCompose({ ...compose, bcc: e.target.value })}
                        className="flex-1 bg-transparent text-gray-900 text-sm outline-none"
                      />
                      <button className="text-gray-400 hover:text-gray-600 ml-2 text-xs border border-gray-300 rounded px-1.5 py-0.5">📖</button>
                    </div>
                  )}
                  {/* Linha Assunto */}
                  <div className="flex items-center px-3 py-1.5">
                    <span className="text-gray-500 text-xs w-16 shrink-0 font-medium">Assunto:</span>
                    <input
                      value={compose.assunto}
                      onChange={e => setCompose({ ...compose, assunto: e.target.value })}
                      className="flex-1 bg-transparent text-gray-900 text-sm outline-none"
                    />
                  </div>
                </div>
              </div>
              {/* Toolbar de formatação - COMPLETA */}
              <div className="bg-gray-100 px-3 py-1 flex items-center justify-between gap-1 flex-wrap border-b border-gray-200">
                {/* Lado esquerdo — formatação */}
                <div className="flex items-center gap-1 flex-wrap">
                  <button title="Desfazer (Ctrl+Z)" onMouseDown={(e) => { e.preventDefault(); execCmd('undo') }} className="w-7 h-7 flex items-center justify-center rounded hover:bg-white border border-gray-200 text-gray-600 transition-colors">
                    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor"><path d="M4.5 4.5l-3 3 3 3V8a5.5 5.5 0 1 1 5.5 5.5H6v1.5h4A7 7 0 1 0 4 5.6V4.5z" /></svg>
                  </button>
                  <button title="Refazer (Ctrl+Y)" onMouseDown={(e) => { e.preventDefault(); execCmd('redo') }} className="w-7 h-7 flex items-center justify-center rounded hover:bg-white border border-gray-200 text-gray-600 transition-colors">
                    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor"><path d="M11.5 4.5l3 3-3 3V8a5.5 5.5 0 1 0-5.5 5.5H10v1.5H6A7 7 0 1 1 12 5.6V4.5z" /></svg>
                  </button>
                  <div className="w-px h-5 bg-gray-200 mx-1" />
                  <select className="bg-white border border-gray-200 text-gray-900 text-xs px-2 py-1.5 rounded" onChange={(e) => execCmd('fontName', e.target.value)}>
                    <option>Calibri</option><option>Arial</option><option>Times New Roman</option>
                  </select>
                  <select className="bg-white border border-gray-200 text-gray-900 text-xs px-2 py-1.5 rounded w-14" onChange={(e) => {
                    const mapeamento: Record<string, string> = { '11': '1', '12': '2', '14': '3', '16': '4', '18': '5' }
                    execCmd('fontSize', mapeamento[e.target.value] || '3')
                  }}>
                    <option>11</option><option>12</option><option>14</option><option>16</option><option>18</option>
                  </select>
                  {/* Botão cor do texto */}
                  <div className="relative">
                    <button title="Cor do texto"
                      onMouseDown={(e) => { e.preventDefault(); setMostrarPaletaCor(prev => prev === 'texto' ? null : 'texto') }}
                      className="w-7 h-7 flex flex-col items-center justify-center rounded hover:bg-white bg-white border border-gray-200 gap-0.5">
                      <span className="text-gray-900 text-xs font-bold leading-none" style={{ color: corTexto === '#000000' ? '#111827' : corTexto }}>A</span>
                      <div className="w-4 h-1 rounded-sm" style={{ backgroundColor: corTexto }} />
                    </button>
                    {mostrarPaletaCor === 'texto' && (
                      <div className="absolute top-8 left-0 bg-white border border-gray-200 rounded shadow-xl p-2 z-50 w-48">
                        <p className="text-gray-500 text-[10px] mb-1.5 font-bold uppercase">Cor do texto</p>
                        <div className="grid grid-cols-8 gap-0.5">
                          {CORES_PALETA.map(cor => (
                            <button key={cor} title={cor}
                              onMouseDown={(e) => {
                                e.preventDefault()
                                const sel = window.getSelection()
                                const range = sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null
                                setCorTexto(cor)
                                setMostrarPaletaCor(null)
                                if (range) { sel!.removeAllRanges(); sel!.addRange(range) }
                                document.execCommand('foreColor', false, cor)
                              }}
                              className="w-4 h-4 rounded-sm border border-gray-100 hover:scale-125 transition-transform"
                              style={{ backgroundColor: cor }} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Botão cor de fundo/realce */}
                  <div className="relative">
                    <button title="Realçar texto"
                      onMouseDown={(e) => { e.preventDefault(); setMostrarPaletaCor(prev => prev === 'fundo' ? null : 'fundo') }}
                      className="w-7 h-7 flex flex-col items-center justify-center rounded hover:bg-white bg-white border border-gray-200 gap-0.5">
                      <span className="text-gray-900 text-xs leading-none">🖌</span>
                      <div className="w-4 h-1 rounded-sm" style={{ backgroundColor: corFundo }} />
                    </button>
                    {mostrarPaletaCor === 'fundo' && (
                      <div className="absolute top-8 left-0 bg-white border border-gray-200 rounded shadow-xl p-2 z-50 w-48">
                        <p className="text-gray-500 text-[10px] mb-1.5 font-bold uppercase">Realçar texto</p>
                        <div className="grid grid-cols-8 gap-0.5">
                          {CORES_PALETA.map(cor => (
                            <button key={cor} title={cor}
                              onMouseDown={(e) => {
                                e.preventDefault()
                                const sel = window.getSelection()
                                const range = sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null
                                setCorFundo(cor)
                                setMostrarPaletaCor(null)
                                if (range) { sel!.removeAllRanges(); sel!.addRange(range) }
                                document.execCommand('hiliteColor', false, cor)
                              }}
                              className="w-4 h-4 rounded-sm border border-gray-100 hover:scale-125 transition-transform"
                              style={{ backgroundColor: cor }} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="w-px h-5 bg-gray-200 mx-1" />
                  {/* Botões de formatação: Negrito, Itálico, Sublinhado, etc */}
                  {botoesFormato.map((b, i) => {
                    const cmd =
                      b.t === 'Negrito' ? 'bold' :
                        b.t === 'Itálico' ? 'italic' :
                          b.t === 'Sublinhado' ? 'underline' :
                            b.t === 'Riscado' ? 'strikeThrough' :
                              b.t === 'Subscrito' ? 'subscript' :
                                b.t === 'Superscrito' ? 'superscript' : ''
                    const activo = cmd ? document.queryCommandState(cmd) : false
                    return (
                      <button key={i} title={b.t}
                        className={`text-sm px-2.5 py-1.5 rounded border relative group font-bold transition-colors
        ${activo ? 'bg-blue-600 border-blue-500 ' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                        onMouseDown={(e) => {
                          e.preventDefault()
                          if (!cmd) return
                          if (b.t === 'Subscrito' && document.queryCommandState('superscript')) execCmd('superscript')
                          if (b.t === 'Superscrito' && document.queryCommandState('subscript')) execCmd('subscript')
                          execCmd(cmd)
                        }}>
                        {b.t === 'Itálico' ? <em>{b.l}</em> : b.t === 'Riscado' ? <s>{b.l}</s> : b.l}
                        <span className="absolute top-8 left-1/2 -translate-x-1/2 bg-black  text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-20 pointer-events-none">{b.t}</span>
                      </button>
                    )
                  })}
                  <div className="w-px h-5 bg-gray-200 mx-1" />
                  {/* Alinhamento */}
                  <button title="Alinhar à esquerda" className="w-7 h-7 flex items-center justify-center rounded hover:bg-white border border-transparent hover:border-gray-200 text-gray-600 transition-colors" onClick={() => execCmd('justifyLeft')}>
                    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor"><rect x="1" y="2" width="14" height="1.5" rx="0.75" /><rect x="1" y="5.5" width="10" height="1.5" rx="0.75" /><rect x="1" y="9" width="14" height="1.5" rx="0.75" /><rect x="1" y="12.5" width="8" height="1.5" rx="0.75" /></svg>
                  </button>
                  <button title="Centrar" className="w-7 h-7 flex items-center justify-center rounded hover:bg-white border border-transparent hover:border-gray-200 text-gray-600 transition-colors" onClick={() => execCmd('justifyCenter')}>
                    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor"><rect x="1" y="2" width="14" height="1.5" rx="0.75" /><rect x="3" y="5.5" width="10" height="1.5" rx="0.75" /><rect x="1" y="9" width="14" height="1.5" rx="0.75" /><rect x="4" y="12.5" width="8" height="1.5" rx="0.75" /></svg>
                  </button>
                  <button title="Alinhar à direita" className="w-7 h-7 flex items-center justify-center rounded hover:bg-white border border-transparent hover:border-gray-200 text-gray-600 transition-colors" onClick={() => execCmd('justifyRight')}>
                    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor"><rect x="1" y="2" width="14" height="1.5" rx="0.75" /><rect x="5" y="5.5" width="10" height="1.5" rx="0.75" /><rect x="1" y="9" width="14" height="1.5" rx="0.75" /><rect x="7" y="12.5" width="8" height="1.5" rx="0.75" /></svg>
                  </button>
                  <button title="Justificar" className="w-7 h-7 flex items-center justify-center rounded hover:bg-white border border-transparent hover:border-gray-200 text-gray-600 transition-colors" onClick={() => execCmd('justifyFull')}>
                    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor"><rect x="1" y="2" width="14" height="1.5" rx="0.75" /><rect x="1" y="5.5" width="14" height="1.5" rx="0.75" /><rect x="1" y="9" width="14" height="1.5" rx="0.75" /><rect x="1" y="12.5" width="14" height="1.5" rx="0.75" /></svg>
                  </button>
                  {/* Inserir */}
                  <div className="w-px h-5 bg-gray-200 mx-1" />
                  <button title="Ligação" className="h-7 px-2 flex items-center gap-1.5 rounded hover:bg-white border border-gray-200 text-gray-600 transition-colors text-xs font-medium" onClick={() => inserirLink()}>
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                    <span className="text-[10px]">Link</span>
                  </button>
                  <button title="Imagem" className="h-7 px-2 flex items-center gap-1.5 rounded hover:bg-white border border-gray-200 text-gray-600 transition-colors text-xs font-medium" onClick={() => inserirImagem()}>
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                    <span className="text-[10px]">Img</span>
                  </button>
                  <button title="Tabela" className="h-7 px-2 flex items-center gap-1.5 rounded hover:bg-white border border-gray-200 text-gray-600 transition-colors text-xs font-medium" onClick={() => setMostrarPopupTabela(true)}>
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
                    <span className="text-[10px]">Tabela</span>
                  </button>
                  <button title="Anexo" className="h-7 px-2 flex items-center gap-1.5 rounded hover:bg-white border border-gray-200 text-gray-600 transition-colors text-xs font-medium" onClick={() => inserirAnexo()}>
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.59a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                    <span className="text-[10px]">Anexo</span>
                  </button>
                  {/* Botão Assinatura */}
                  <div className="relative flex items-center gap-1">
                    <span className="text-gray-500 text-xs font-medium">Assinatura:</span>
                    <select
                      value={assinaturaAtiva}
                      onChange={e => {
                        const idx = parseInt(e.target.value)
                        setAssinaturaAtiva(idx)
                        // Limpar ou inserir assinatura no editor
                        if (editorRef.current) {
                          if (idx === -1 || !assinaturas[idx]) {
                            // Sem assinatura - limpar assinatura do editor
                            editorRef.current.innerHTML = ''
                          } else {
                            const assinaturaSelecionada = assinaturas[idx]
                            if (assinaturaSelecionada.imagemUrl) {
                              editorRef.current.innerHTML = `<div><br><br></div><div style="text-align:left;"><img src="${assinaturaSelecionada.imagemUrl}" style="max-width:100%; max-height:200px; display:block; margin:0;" /></div>`
                            } else if (assinaturaSelecionada.texto) {
                              const textoFormatado = assinaturaSelecionada.texto.replace(/\n/g, '<br>')
                              editorRef.current.innerHTML = `<div><br><br></div><div style="text-align:left;">--<br>${textoFormatado}</div>`
                            }
                          }
                        }
                      }}
                      className="h-7 px-2 pr-6 text-xs rounded hover:bg-white border border-gray-200 text-gray-600 bg-transparent outline-none cursor-pointer appearance-none"
                    >
                      <option value={-1}>✍️ Sem assinatura</option>
                      {assinaturas.map((s, i) => (
                        <option key={i} value={i}>✍️ {s.nome}</option>
                      ))}
                    </select>
                    <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 text-[10px] pointer-events-none">▼</span>
                  </div>
                </div>
              </div>
              {/* Preview de Anexos - acima do editor */}
              {anexos.length > 0 && (
                <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex flex-wrap gap-2">
                  {anexos.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 shadow-sm">
                      <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.59a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                      <span className="font-medium truncate max-w-[200px]">{f.name}</span>
                      <span className="text-gray-400 text-xs">({(f.size / 1024).toFixed(1)} KB)</span>
                      <button onClick={() => setAnexos(prev => prev.filter((_, j) => j !== i))}
                        className="text-red-500 hover:text-red-700 font-bold ml-1 w-5 h-5 flex items-center justify-center rounded hover:bg-red-50">✕</button>
                    </div>
                  ))}
                </div>
              )}
              {/* Toolbar de Imagem */}
              {imagemSelecionada && (
                <div className="img-toolbar px-4 py-2 bg-blue-50 border-b border-blue-200 flex items-center gap-3">
                  <span className="text-xs font-semibold text-blue-700">📷 Imagem:</span>
                  <div className="flex gap-1">
                    <button onClick={() => resizeImagem('max')} className="px-2 py-1 text-xs bg-blue-600  rounded hover:bg-blue-700">Máx</button>
                    <button onClick={() => resizeImagem('med')} className="px-2 py-1 text-xs bg-blue-500  rounded hover:bg-blue-600">Méd</button>
                    <button onClick={() => resizeImagem('peq')} className="px-2 py-1 text-xs bg-blue-400  rounded hover:bg-blue-500">Peq</button>
                  </div>
                  <div className="w-px h-4 bg-blue-300" />
                  <div className="flex gap-1">
                    <button onClick={() => alinharImagem('left')} className="px-2 py-1 text-xs bg-gray-200 rounded hover:bg-gray-300" title="Esquerda">←</button>
                    <button onClick={() => alinharImagem('center')} className="px-2 py-1 text-xs bg-gray-200 rounded hover:bg-gray-300" title="Centro">↔</button>
                    <button onClick={() => alinharImagem('right')} className="px-2 py-1 text-xs bg-gray-200 rounded hover:bg-gray-300" title="Direita">→</button>
                  </div>
                  <div className="w-px h-4 bg-blue-300" />
                  <button onClick={deletarImagem} className="px-2 py-1 text-xs bg-red-500  rounded hover:bg-red-600" title="Eliminar">🗑️</button>
                  <button onClick={() => setImagemSelecionada(null)} className="ml-auto text-xs text-gray-500 hover:text-gray-700">✕</button>
                </div>
              )}
              {/* Editor */}
              <div className="flex-1 overflow-y-auto bg-gray-50 min-h-0">
                <style>{`
                  .editor-wrapper { border: 1px dashed #e5e7eb; margin: 30px; border-radius: 6px; background: white; height: 750px; }
                  .editor-content img { cursor: pointer; max-width: 100%; border-radius: 4px; margin-left: 15px; margin-right: 15px; }
                  .editor-content img:hover { outline: 2px solid #3b82f6; }
                  .editor-content table { border-collapse: collapse; width: auto; min-width: 100px; resize: both; overflow: auto; max-width: 100%; }
                  .editor-content td, .editor-content th { border: 1px solid #d1d5db; padding: 4px 8px; min-width: 30px; min-height: 20px; resize: horizontal; overflow: auto; }
                  .editor-content th { background: #f3f4f6; font-weight: bold; }
                  .editor-content tr { height: auto; min-height: 20px; }
                  .editor-content tr:hover { background: #f9fafb; }
                  .editor-content table:hover { outline: 2px solid #3b82f6; }
                  .editor-content td:hover, .editor-content th:hover { background: #eff6ff; cursor: text; }
                `}</style>
                <div className="editor-wrapper">
                  <div
                    ref={editorRef}
                    contentEditable
                    suppressContentEditableWarning
                    className="p-6 text-sm outline-none editor-content"
                    style={{ 
                      whiteSpace: 'pre-wrap', 
                      color: '#1f2937', 
                      minHeight: '1024px'
                    }}
                    onInput={(e) => { const el = e.currentTarget as HTMLDivElement; if (el) setCompose(prev => ({ ...prev, corpo: el.innerHTML })) }}
                  />
                </div>
              </div>
            </div>
          ) : (
            /* ========== VIEW LISTA DE EMAILS ========== */
            <>
          <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 bg-gray-50">
            {modalEmail && (
              <button
                onClick={() => setModoResposta('reply')}
                className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-100 transition-colors"
              >
                ↩️ Responder
              </button>
            )}
            {modalEmail && (
              <button onClick={handleForwardEmail} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-900 px-3 py-1.5 rounded border border-blue-300 hover:bg-blue-50 transition-colors">↪️ Fwd</button>
            )}
            {modalEmail && (
              <button
                onClick={() => handleArchiveEmail(modalEmail.id)}
                className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-900 px-3 py-1.5 rounded border border-orange-300 hover:bg-orange-50 transition-colors"
                title="Arquivar"
              >
                📁 Arquivar
              </button>
            )}
            {modalEmail && (
              <button
                onClick={() => handleDeleteEmail(modalEmail.id)}
                className="flex items-center gap-1 text-xs text-red-600 hover:text-red-900 px-3 py-1.5 rounded border border-red-300 hover:bg-red-50 transition-colors"
                title="Eliminar"
              >
                🗑️ Eliminar
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto">
            {!modalEmail ? (
              <>
                {emails.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-3">
                    <span className="text-5xl">📭</span>
                    <p className="text-sm font-medium">A caixa está vazia</p>
                  </div>
                ) : (
                  <>
                    {/* Header com "Select All" e busca */}
                    {emails.length > 0 && (
                      <div className="bg-gray-50 border-b border-gray-200 px-3 py-2 flex items-center gap-2 sticky top-0">
                        <input
                          type="checkbox"
                          checked={emailsSelecionados.length === emails.length && emails.length > 0}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEmailsSelecionados(emails.map(e => e.id))
                            } else {
                              setEmailsSelecionados([])
                            }
                          }}
                          className="w-4 h-4 cursor-pointer"
                        />
                        <span className="text-xs text-gray-600 font-semibold">Seleccionar tudo</span>
                        {emailsSelecionados.length > 0 && (
                          <>
                            <button
                              onClick={async () => {
                                for (const id of emailsSelecionados) {
                                  await handleDeleteEmail(id)
                                }
                                setEmailsSelecionados([])
                              }}
                              className="text-xs px-2 py-1 rounded border border-red-600 text-red-600 font-bold hover:bg-red-50 cursor-pointer"
                            >
                              🗑️ Eliminar
                            </button>
                            <button
                              onClick={async () => {
                                for (const id of emailsSelecionados) {
                                  await handleArchiveEmail(id)
                                }
                                setEmailsSelecionados([])
                              }}
                              className="text-xs px-2 py-1 rounded border border-orange-600 text-orange-600 font-bold hover:bg-orange-50 cursor-pointer"
                            >
                              📁 Arquivar
                            </button>
                            <button
                              onClick={async () => {
                                for (const id of emailsSelecionados) {
                                  await handleSpamEmail(id)
                                }
                                setEmailsSelecionados([])
                              }}
                              className="text-xs px-2 py-1 rounded border border-orange-600 text-orange-600 font-bold hover:bg-orange-50 cursor-pointer"
                            >
                              🚫 Spam
                            </button>
                            <button
                              onClick={() => {
                                if (emailsSelecionados.length === 1) {
                                  const email = emails.find(e => e.id === emailsSelecionados[0])
                                  if (email) {
                                    setModalEmail(email)
                                    setModoResposta('forward')
                                    setEmailsSelecionados([])
                                  }
                                }
                              }}
                              className="text-xs px-2 py-1 rounded border border-blue-600 text-blue-600 font-bold hover:bg-blue-50 cursor-pointer"
                            >
                              ↪️ Reencaminhar
                            </button>
                          </>
                        )}
                        <input
                          type="search"
                          autoComplete="off"
                          placeholder="🔍 Pesquisar emails..."
                          value={pesquisa}
                          onChange={(e) => setPesquisa(e.target.value)}
                          className="ml-auto flex-1 px-3 py-1 border border-gray-300 rounded text-xs outline-none bg-white text-gray-700 placeholder-gray-400 max-w-xs"
                        />
                      </div>
                    )}
                    {/* Skeleton Loader Premium */}
                    {carregandoEmails && emails.length === 0 && (
                      <div className="flex-1 overflow-hidden">
                        {[1, 2, 3, 4, 5, 6].map(n => (
                          <div key={n} className="border-b border-gray-100 flex items-start gap-3 px-3 py-4 bg-white animate-in fade-in duration-500">
                            <div className="w-4 h-4 bg-gray-200 rounded mt-0.5 animate-pulse shrink-0" />
                            <div className="flex-1 space-y-2.5">
                              <div className="flex justify-between items-center">
                                <div className="h-4 bg-gray-300 rounded-md w-1/3 animate-pulse" />
                                <div className="h-3 bg-gray-200 rounded-md w-16 animate-pulse" />
                              </div>
                              <div className="h-4 bg-gray-200 rounded-md w-3/4 animate-pulse" />
                              <div className="h-3 bg-gray-100 rounded-md w-full animate-pulse" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {!carregandoEmails && emails.length === 0 && (
                      <div className="flex-1 flex flex-col items-center justify-center p-10 text-gray-400">
                        <Package className="w-12 h-12 mb-2 opacity-20" />
                        <p className="text-sm">Nenhum email encontrado nesta pasta.</p>
                      </div>
                    )}

                    {/* Lista de emails */}
                    {emails.map((e, i) => (
                      <div
                        key={i}
                        className={`border-b border-gray-100 hover:bg-gray-50 transition flex items-start gap-3 px-3 py-3 group cursor-pointer ${!e.lido ? 'bg-blue-50/30' : ''}`}
                        onClick={() => {
                          if (!emailsSelecionados.includes(e.id)) {
                            setModalEmail(e)
                          }
                        }}
                      >
                        <div className="flex items-start gap-3 flex-1">
                          {/* Checkbox */}
                          <input
                            type="checkbox"
                            checked={emailsSelecionados.includes(e.id)}
                            onClick={(ev) => ev.stopPropagation()}
                            onChange={(ev) => {
                              ev.stopPropagation()
                              if (ev.target.checked) {
                                setEmailsSelecionados([...emailsSelecionados, e.id])
                              } else {
                                setEmailsSelecionados(emailsSelecionados.filter((id: any) => id !== e.id))
                              }
                            }}
                            className="w-4 h-4 cursor-pointer mt-0.5"
                          />
                          {/* Informação do email */}
                          <div className="flex-1 min-w-0 flex items-center gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <p className={`text-xs truncate ${!e.lido ? 'font-bold text-gray-900' : 'text-gray-700'}`}>
                                  {pastaActiva === 'Enviados' ? `Para: ${e.para || e.to || e.conta || 'Desconhecido'}` : (e.deNome || e.from || e.de)}
                                </p>
                                <p className="text-[10px] text-gray-400 shrink-0">
                                  {e.data ? new Date(e.data).toLocaleDateString([], { day: '2-digit', month: '2-digit' }) : ''}
                                </p>
                              </div>
                              <p className={`text-xs truncate ${!e.lido ? 'font-semibold text-gray-800' : 'text-gray-500'}`}>
                                {e.assunto}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Ações ao passar mouse */}
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                          <button
                            onClick={(ev) => { ev.stopPropagation(); handleArchiveEmail(e.id); }}
                            className="p-1.5 rounded-md hover:bg-orange-100 text-orange-600 transition-colors"
                            title="Arquivar"
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={(ev) => { ev.stopPropagation(); handleDeleteEmail(e.id); }}
                            className="p-1.5 rounded-md hover:bg-red-100 text-red-600 transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </>
            ) : (
              <div className="p-6 space-y-4">
                <div className="space-y-3">
                  <h2 className="text-xl font-bold text-gray-900">{modalEmail.assunto}</h2>

                  <div className="flex items-center gap-3 pb-3 border-b border-gray-200">
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center  font-bold text-sm shrink-0">
                      {modalEmail.de?.[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-800 text-sm">{modalEmail.de}</p>
                      <p className="text-xs text-gray-500">{modalEmail.data}</p>
                    </div>
                    <button
                      onClick={() => { setModalEmail(null); setModoResposta('none'); setCompose({ para: '', cc: '', bcc: '', assunto: '', corpo: '' }) }}
                      className="text-gray-400 hover:text-gray-600 text-xl"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <div className="text-gray-700 leading-relaxed whitespace-pre-wrap text-base">
                  {modalEmail.corpo || (carregandoEmails ? '⌛ Carregando conteúdo...' : '(sem conteúdo)')}
                </div>

                {modoResposta !== 'none' && (
                  <div className="border-t border-gray-200 pt-4 mt-6 space-y-3">
                    <h3 className="text-sm font-bold text-gray-600">
                      {modoResposta === 'reply' ? '↩️ Respondendo a:' : '↪️ Reenviando:'}
                    </h3>

                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Para:</label>
                      <input
                        value={compose.para}
                        onChange={e => setCompose({ ...compose, para: e.target.value })}
                        className="w-full border border-gray-200 rounded px-3 py-2 text-sm outline-none focus:border-blue-400"
                        placeholder="email@exemplo.com"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Assunto:</label>
                      <input
                        value={compose.assunto}
                        onChange={e => setCompose({ ...compose, assunto: e.target.value })}
                        className="w-full border border-gray-200 rounded px-3 py-2 text-sm outline-none focus:border-blue-400"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Mensagem:</label>
                      <textarea
                        value={compose.corpo}
                        onChange={e => setCompose({ ...compose, corpo: e.target.value })}
                        rows={6}
                        className="w-full border border-gray-200 rounded px-3 py-2 text-sm outline-none focus:border-blue-400 resize-none"
                        placeholder="Escreve a tua resposta..."
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={handleSend}
                        disabled={enviando || !compose.para}
                        className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400  px-4 py-2 rounded text-sm font-bold transition"
                      >
                        {enviando ? '⏳ Enviando...' : '✈️ Enviar'}
                      </button>
                      <button
                        onClick={() => { setModoResposta('none'); setCompose({ para: '', cc: '', bcc: '', assunto: '', corpo: '' }) }}
                        className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded text-sm font-bold"
                      >
                        Cancelar
                      </button>
                      <button onClick={handleDraftSave} className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded text-sm font-bold">💾 Salvar Rascunho</button>
                      <button onClick={handleDraftLoad} className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded text-sm font-bold">📂 Carregar Rascunhos</button>

                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
            </>
          )}
        </div>
      </div>

      {/* Modal: Alterar Senha (reaproveita flow admin email management) */}
      {mostrarAlterarSenhaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg w-full max-w-md shadow-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Alterar Senha da Conta</h3>
              <button onClick={() => { setMostrarAlterarSenhaModal(false); setNovaSenha(''); setConfirmNovaSenha('') }} className="p-2 text-gray-500 hover:text-gray-800">Fechar</button>
            </div>
            <div className="space-y-3">
              <p className="text-sm text-gray-600">Irá actualizar a senha no CyberPanel e sincronizar a conta aqui.</p>
              <label className="block text-xs font-medium text-gray-700">Nova Senha</label>
              <input type="password" value={novaSenha} onChange={e => setNovaSenha(e.target.value)} className="w-full rounded-md border px-3 py-2" />
              <label className="block text-xs font-medium text-gray-700">Confirmar Nova Senha</label>
              <input type="password" value={confirmNovaSenha} onChange={e => setConfirmNovaSenha(e.target.value)} className="w-full rounded-md border px-3 py-2" />
              <div className="flex justify-end gap-2 mt-3">
                <button onClick={() => { setMostrarAlterarSenhaModal(false); setNovaSenha(''); setConfirmNovaSenha('') }} className="px-3 py-2 rounded-md border">Cancelar</button>
                <button disabled={alterandoSenha} onClick={async () => {
                  // Validations
                  const targetEmail = emailOrigem || (erroEmail.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)?.[0] || '')
                  if (!targetEmail) { alert('Email alvo inválido'); return }
                  if (!novaSenha || novaSenha !== confirmNovaSenha) { alert('Senhas não coincidem'); return }
                  try {
                    setAlterandoSenha(true)
                    const res = await fetch('/api/cyberpanel-email', {
                      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ email: targetEmail, action: 'changePassword', newPassword: novaSenha })
                    })
                    const data = await res.json()
                    if (data.success) {
                      alert('Senha alterada com sucesso!')
                      // Atualizar local: buscar nova senha encriptada no supabase via endpoint
                      setMostrarAlterarSenhaModal(false)
                      setNovaSenha('')
                      setConfirmNovaSenha('')
                      // Trigger reload of accounts to pick up updated senha
                    } else {
                      alert(data.error || data.message || JSON.stringify(data))
                    }
                  } catch (e: any) {
                    console.error('Erro ao alterar senha:', e)
                    alert('Erro ao alterar senha: ' + (e.message || e))
                  } finally { setAlterandoSenha(false) }
                }} className="px-4 py-2 bg-green-600  rounded-md">Atualizar Senha</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========== MODAL ANTIGO (DESATIVADO) ========== */}
      {false && mostrarCompose && (
        <div className="absolute top-0 right-0 bottom-0 left-72 bg-white z-40 flex flex-col hidden">

            {/* LINHA 1 — Layout 2 colunas */}
            <div className="bg-gray-50 border-b border-gray-200 flex">

              {/* Coluna esquerda — só botão Enviar */}
              <div className="flex flex-col border-r border-gray-200 shrink-0">
                <button onClick={handleSend} disabled={enviando || !compose.para || !emailOrigem}
                  className="flex-1 bg-green-50 border border-green-300 text-green-600 hover:bg-green-100 hover:text-green-700 disabled:bg-green-600 disabled:cursor-not-allowed  font-bold px-6 text-sm flex flex-col items-center justify-center gap-1 shadow-sm min-w-[110px]">
                  {enviando
                    ? <><span className="text-xl">⏳</span><span className="text-[11px] tracking-wide">A enviar...</span></>
                    : <><svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg><span className="text-[11px] tracking-wide uppercase">Enviar</span></>
                  }
                </button>
              </div>

              {/* Coluna direita — Campos */}
              <div className="flex-1 flex flex-col">
                {/* Linha De + botão fechar */}
                <div className="flex items-center border-b border-gray-200 px-3 py-1">
                  <span className="text-gray-500 text-xs w-16 shrink-0 font-medium">De:</span>
                  <select value={emailOrigem} onChange={e => setEmailOrigem(e.target.value)}
                    className="bg-transparent text-gray-900 text-sm outline-none flex-1">
                    <option value="" className="bg-white">Escolher email de origem...</option>
                    {memoEmailsOrigem.map(e => (
                      <option key={e.email} value={e.email} className="bg-white">
                        {e.nome} ({e.email}) {e.tipo === 'google' ? '📧' : e.tipo === 'hotmail' ? '📨' : '🌐'}
                      </option>
                    ))}
                  </select>
                  <button onClick={() => setMostrarPopupFechar(true)}
                    className="ml-2 w-8 h-full min-h-[32px] flex items-center justify-center bg-red-50 border border-red-300 text-red-600 hover:bg-red-100 hover:text-red-700  font-bold text-sm shrink-0 transition-colors -mr-0 self-stretch">✕</button>
                </div>
                {/* Linha Para */}
                <div className="flex items-center border-b border-gray-200 px-3 py-1.5">
                  <span className="text-gray-500 text-xs w-16 shrink-0 font-medium">Para:</span>
                  <input list="contactos-list" value={compose.para} onChange={e => setCompose({ ...compose, para: e.target.value })}
                    className="flex-1 bg-transparent text-gray-900 text-sm outline-none" />
                  <datalist id="contactos-list">
                    {contactos.map(c => <option key={c.email} value={c.email}>{c.nome}</option>)}
                  </datalist>
                  <button title="Seleccionar contacto" className="text-gray-400 hover:text-gray-600 ml-2 text-xs border border-gray-300 rounded px-1.5 py-0.5">📖</button>
                  {/* Botões para mostrar Cc e Bcc */}
                  <button onClick={() => setMostrarCc(!mostrarCc)}
                    className={`ml-1 text-xs px-2 py-0.5 rounded border transition-colors ${mostrarCc ? 'border-blue-500 text-blue-600 bg-blue-50' : 'border-gray-200 text-gray-400 hover:text-gray-600'}`}>Cc</button>
                  <button onClick={() => setMostrarBcc(!mostrarBcc)}
                    className={`ml-1 text-xs px-2 py-0.5 rounded border transition-colors ${mostrarBcc ? 'border-blue-500 text-blue-600 bg-blue-50' : 'border-gray-200 text-gray-400 hover:text-gray-600'}`}>Bcc</button>
                </div>
                {/* Linha Cc — só aparece se activado */}
                {mostrarCc && (
                  <div className="flex items-center border-b border-gray-200 px-3 py-1.5">
                    <span className="text-gray-500 text-xs w-16 shrink-0 font-medium">Cc:</span>
                    <input
                      value={compose.cc}
                      onChange={e => setCompose({ ...compose, cc: e.target.value })}
                      className="flex-1 bg-transparent text-gray-900 text-sm outline-none"
                    />
                    <button className="text-gray-400 hover:text-gray-600 ml-2 text-xs border border-gray-300 rounded px-1.5 py-0.5">📖</button>
                  </div>
                )}
                {/* Linha Bcc — só aparece se activado */}
                {mostrarBcc && (
                  <div className="flex items-center border-b border-gray-200 px-3 py-1.5">
                    <span className="text-gray-500 text-xs w-16 shrink-0 font-medium">Bcc:</span>
                    <input
                      value={compose.bcc}
                      onChange={e => setCompose({ ...compose, bcc: e.target.value })}
                      className="flex-1 bg-transparent text-gray-900 text-sm outline-none"
                    />
                    <button className="text-gray-400 hover:text-gray-600 ml-2 text-xs border border-gray-300 rounded px-1.5 py-0.5">📖</button>
                  </div>
                )}
                {/* Linha Assunto */}
                <div className="flex items-center px-3 py-1.5">
                  <span className="text-gray-500 text-xs w-16 shrink-0 font-medium">Assunto:</span>
                  <input
                    value={compose.assunto}
                    onChange={e => setCompose({ ...compose, assunto: e.target.value })}
                    className="flex-1 bg-transparent text-gray-900 text-sm outline-none"
                  />
                </div>
              </div>
            </div>

            {/* LINHA 2 — Formatação */}
            <div className="bg-gray-100 px-3 py-1 flex items-center justify-between gap-1 flex-wrap border-b border-gray-200">
              {/* Lado esquerdo — formatação */}
              <div className="flex items-center gap-1 flex-wrap">
                <button title="Desfazer (Ctrl+Z)"
                  onMouseDown={(e) => { e.preventDefault(); execCmd('undo') }}
                  className="w-7 h-7 flex items-center justify-center rounded hover:bg-white border border-gray-200 text-gray-600 transition-colors">
                  <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor"><path d="M4.5 4.5l-3 3 3 3V8a5.5 5.5 0 1 1 5.5 5.5H6v1.5h4A7 7 0 1 0 4 5.6V4.5z" /></svg>
                </button>
                <button title="Refazer (Ctrl+Y)"
                  onMouseDown={(e) => { e.preventDefault(); execCmd('redo') }}
                  className="w-7 h-7 flex items-center justify-center rounded hover:bg-white border border-gray-200 text-gray-600 transition-colors">
                  <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor"><path d="M11.5 4.5l3 3-3 3V8a5.5 5.5 0 1 0-5.5 5.5H10v1.5H6A7 7 0 1 1 12 5.6V4.5z" /></svg>
                </button>
                <div className="w-px h-5 bg-gray-200 mx-1" />
                <select className="bg-white border border-gray-200 text-gray-900 text-xs px-2 py-1.5 rounded" onChange={(e) => execCmd('fontName', e.target.value)}>
                  <option>Calibri</option><option>Arial</option><option>Times New Roman</option>
                </select>
                <select className="bg-white border border-gray-200 text-gray-900 text-xs px-2 py-1.5 rounded w-14" onChange={(e) => {
                  const mapeamento: Record<string, string> = { '11': '1', '12': '2', '14': '3', '16': '4', '18': '5' }
                  execCmd('fontSize', mapeamento[e.target.value] || '3')
                }}>
                  <option>11</option><option>12</option><option>14</option><option>16</option><option>18</option>
                </select>
                {/* Botão cor do texto */}
                <div className="relative">
                  <button title="Cor do texto"
                    onMouseDown={(e) => { e.preventDefault(); setMostrarPaletaCor(prev => prev === 'texto' ? null : 'texto') }}
                    className="w-7 h-7 flex flex-col items-center justify-center rounded hover:bg-white bg-white border border-gray-200 gap-0.5">
                    <span className="text-gray-900 text-xs font-bold leading-none" style={{ color: corTexto === '#000000' ? '#111827' : corTexto }}>A</span>
                    <div className="w-4 h-1 rounded-sm" style={{ backgroundColor: corTexto }} />
                  </button>
                  {mostrarPaletaCor === 'texto' && (
                    <div className="absolute top-8 left-0 bg-white border border-gray-200 rounded shadow-xl p-2 z-50 w-48">
                      <p className="text-gray-500 text-[10px] mb-1.5 font-bold uppercase">Cor do texto</p>
                      <div className="grid grid-cols-8 gap-0.5">
                        {CORES_PALETA.map(cor => (
                          <button key={cor} title={cor}
                            onMouseDown={(e) => {
                              e.preventDefault()
                              const sel = window.getSelection()
                              const range = sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null
                              setCorTexto(cor)
                              setMostrarPaletaCor(null)
                              if (range) { sel!.removeAllRanges(); sel!.addRange(range) }
                              document.execCommand('foreColor', false, cor)
                            }}
                            className="w-4 h-4 rounded-sm border border-gray-100 hover:scale-125 transition-transform"
                            style={{ backgroundColor: cor }} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Botão cor de fundo/realce */}
                <div className="relative">
                  <button title="Realçar texto"
                    onMouseDown={(e) => { e.preventDefault(); setMostrarPaletaCor(prev => prev === 'fundo' ? null : 'fundo') }}
                    className="w-7 h-7 flex flex-col items-center justify-center rounded hover:bg-white bg-white border border-gray-200 gap-0.5">
                    <span className="text-gray-900 text-xs leading-none">🖌</span>
                    <div className="w-4 h-1 rounded-sm" style={{ backgroundColor: corFundo }} />
                  </button>
                  {mostrarPaletaCor === 'fundo' && (
                    <div className="absolute top-8 left-0 bg-white border border-gray-200 rounded shadow-xl p-2 z-50 w-48">
                      <p className="text-gray-500 text-[10px] mb-1.5 font-bold uppercase">Realçar texto</p>
                      <div className="grid grid-cols-8 gap-0.5">
                        {CORES_PALETA.map(cor => (
                          <button key={cor} title={cor}
                            onMouseDown={(e) => {
                              e.preventDefault()
                              const sel = window.getSelection()
                              const range = sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null
                              setCorFundo(cor)
                              setMostrarPaletaCor(null)
                              if (range) { sel!.removeAllRanges(); sel!.addRange(range) }
                              document.execCommand('hiliteColor', false, cor)
                            }}
                            className="w-4 h-4 rounded-sm border border-gray-100 hover:scale-125 transition-transform"
                            style={{ backgroundColor: cor }} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="w-px h-5 bg-gray-200 mx-1" />
                {botoesFormato.map((b, i) => {
                  const cmd =
                    b.t === 'Negrito' ? 'bold' :
                      b.t === 'Itálico' ? 'italic' :
                        b.t === 'Sublinhado' ? 'underline' :
                          b.t === 'Riscado' ? 'strikeThrough' :
                            b.t === 'Subscrito' ? 'subscript' :
                              b.t === 'Superscrito' ? 'superscript' : ''
                  const activo = cmd ? document.queryCommandState(cmd) : false
                  return (
                    <button key={i} title={b.t}
                      className={`text-sm px-2.5 py-1.5 rounded border relative group font-bold transition-colors
        ${activo
                          ? 'bg-blue-600 border-blue-500 '
                          : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                        }`}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        if (!cmd) return
                        if (b.t === 'Subscrito' && document.queryCommandState('superscript')) execCmd('superscript')
                        if (b.t === 'Superscrito' && document.queryCommandState('subscript')) execCmd('subscript')
                        execCmd(cmd)
                      }}>
                      {b.t === 'Itálico' ? <em>{b.l}</em> :
                        b.t === 'Riscado' ? <s>{b.l}</s> :
                          b.l}
                      <span className="absolute top-8 left-1/2 -translate-x-1/2 bg-black  text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-20 pointer-events-none">{b.t}</span>
                    </button>
                  )
                })}
                <div className="w-px h-5 bg-gray-200 mx-1" />
                <button title="Alinhar à esquerda" className="w-7 h-7 flex items-center justify-center rounded hover:bg-white border border-transparent hover:border-gray-200 text-gray-600 transition-colors" onClick={() => execCmd('justifyLeft')}>
                  <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor"><rect x="1" y="2" width="14" height="1.5" rx="0.75" /><rect x="1" y="5.5" width="10" height="1.5" rx="0.75" /><rect x="1" y="9" width="14" height="1.5" rx="0.75" /><rect x="1" y="12.5" width="8" height="1.5" rx="0.75" /></svg>
                </button>
                <button title="Centrar" className="w-7 h-7 flex items-center justify-center rounded hover:bg-white border border-transparent hover:border-gray-200 text-gray-600 transition-colors" onClick={() => execCmd('justifyCenter')}>
                  <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor"><rect x="1" y="2" width="14" height="1.5" rx="0.75" /><rect x="3" y="5.5" width="10" height="1.5" rx="0.75" /><rect x="1" y="9" width="14" height="1.5" rx="0.75" /><rect x="4" y="12.5" width="8" height="1.5" rx="0.75" /></svg>
                </button>
                <button title="Alinhar à direita" className="w-7 h-7 flex items-center justify-center rounded hover:bg-white border border-transparent hover:border-gray-200 text-gray-600 transition-colors" onClick={() => execCmd('justifyRight')}>
                  <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor"><rect x="1" y="2" width="14" height="1.5" rx="0.75" /><rect x="5" y="5.5" width="10" height="1.5" rx="0.75" /><rect x="1" y="9" width="14" height="1.5" rx="0.75" /><rect x="7" y="12.5" width="8" height="1.5" rx="0.75" /></svg>
                </button>
                <button title="Justificar" className="w-7 h-7 flex items-center justify-center rounded hover:bg-white border border-transparent hover:border-gray-200 text-gray-600 transition-colors" onClick={() => execCmd('justifyFull')}>
                  <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor"><rect x="1" y="2" width="14" height="1.5" rx="0.75" /><rect x="1" y="5.5" width="14" height="1.5" rx="0.75" /><rect x="1" y="9" width="14" height="1.5" rx="0.75" /><rect x="1" y="12.5" width="14" height="1.5" rx="0.75" /></svg>
                </button>
                <button title="Lista de pontos" className="w-7 h-7 flex items-center justify-center rounded hover:bg-white border border-transparent hover:border-gray-200 text-gray-600 transition-colors" onMouseDown={(e) => {
                  e.preventDefault()
                  execCmd('insertUnorderedList')
                }}>
                  <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor"><circle cx="2" cy="4" r="1.2" /><rect x="5" y="3.2" width="9" height="1.5" rx="0.75" /><circle cx="2" cy="8" r="1.2" /><rect x="5" y="7.2" width="9" height="1.5" rx="0.75" /><circle cx="2" cy="12" r="1.2" /><rect x="5" y="11.2" width="9" height="1.5" rx="0.75" /></svg>
                </button>
                <button title="Lista numerada" className="w-7 h-7 flex items-center justify-center rounded hover:bg-white border border-transparent hover:border-gray-200 text-gray-600 transition-colors" onMouseDown={(e) => {
                  e.preventDefault()
                  execCmd('insertOrderedList')
                }}>
                  <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor"><rect x="1" y="2" width="2" height="1.5" rx="0.5" /><rect x="5" y="2" width="9" height="1.5" rx="0.75" /><rect x="1" y="5.5" width="2" height="1.5" rx="0.5" /><rect x="5" y="5.5" width="9" height="1.5" rx="0.75" /><rect x="1" y="9" width="2" height="1.5" rx="0.5" /><rect x="5" y="9" width="9" height="1.5" rx="0.75" /></svg>
                </button>
                <button title="Diminuir indentação" className="w-7 h-7 flex items-center justify-center rounded hover:bg-white border border-transparent hover:border-gray-200 text-gray-600 transition-colors" onClick={() => execCmd('outdent')}>
                  <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor"><rect x="1" y="2" width="14" height="1.5" rx="0.75" /><path d="M5 5.5L2 8l3 2.5V5.5z" /><rect x="6" y="7.2" width="9" height="1.5" rx="0.75" /><rect x="1" y="12.5" width="14" height="1.5" rx="0.75" /></svg>
                </button>
                <button title="Aumentar indentação" className="w-7 h-7 flex items-center justify-center rounded hover:bg-white border border-transparent hover:border-gray-200 text-gray-600 transition-colors" onClick={() => execCmd('indent')}>
                  <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor"><rect x="1" y="2" width="14" height="1.5" rx="0.75" /><path d="M2 5.5l3 2.5-3 2.5V5.5z" /><rect x="6" y="7.2" width="9" height="1.5" rx="0.75" /><rect x="1" y="12.5" width="14" height="1.5" rx="0.75" /></svg>
                </button>
              </div>

              {/* Lado direito — inserir e assinatura */}
              <div className="flex items-center gap-1">
                {[{ l: '🔗', t: 'Ligação' }, { l: <ImageIcon className="w-3.5 h-3.5" />, t: 'Imagem' }, { l: '⊞', t: 'Tabela' }, { l: '📎', t: 'Anexo' }].map((b, i) => (
                  <button key={i} title={b.t} className="text-gray-700 text-sm px-2.5 py-1.5 rounded hover:bg-white border border-gray-200 hover:shadow-sm flex items-center gap-1.5 relative group"
                    onClick={() => {
                      if (b.t === 'Ligação') inserirLink()
                      else if (b.t === 'Imagem') inserirImagem()
                      else if (b.t === 'Tabela') setMostrarPopupTabela(true)
                      else if (b.t === 'Anexo') inserirAnexo()
                    }}>
                    {b.l} <span className="text-gray-600 text-xs font-semibold">{b.t}</span>
                  </button>
                ))}
                <button onClick={() => {
                  // Sincronizar estado antes de abrir o modal
                  if (emailOrigem && assinaturasPorEmailRef.current[emailOrigem]) {
                    const config = assinaturasPorEmailRef.current[emailOrigem]
                    console.log('[DEBUG] Toolbar - sincronizando:', emailOrigem, config)
                    setAssinaturas(config.assinaturas || [])
                    setAssinaturaAtiva(config.assinaturaAtiva || 0)
                  } else if (emailOrigem) {
                    console.log('[DEBUG] Toolbar - sem assinaturas para:', emailOrigem)
                    setAssinaturas([])
                    setAssinaturaAtiva(0)
                  }
                  setMostrarConfigAssinatura(true)
                }}
                  className="text-gray-700 text-sm px-2.5 py-1.5 rounded hover:bg-white border border-gray-200 hover:shadow-sm flex items-center gap-1.5">
                  ✍️ <span className="text-gray-600 text-xs font-semibold">Assinatura</span>
                </button>
              </div>
            </div>

            {/* ÁREA DE ESCRITA */}
            {enviado ? (
              <div className="flex-1 flex items-center justify-center bg-white">
                <div className="text-center">
                  <p className="text-5xl mb-4">✅</p>
                  <p className="text-xl font-bold text-gray-800">Email enviado com sucesso!</p>
                  <button onClick={() => { 
                    setMostrarCompose(false); 
                    setCompose({ para: '', cc: '', bcc: '', assunto: '', corpo: '' }); 
                    setEnviado(false); 
                    setAnexos([]);
                    if (onCloseCompose) onCloseCompose();
                  }}
                    className="mt-5 bg-red-50 border border-red-300 text-red-600 hover:bg-red-100 hover:text-red-700  px-6 py-2.5 rounded-lg text-sm font-bold">Fechar</button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col bg-white h-auto">
                {/* Toolbar de Imagem */}
                {imagemSelecionada && (
                  <div className="img-toolbar px-4 py-2 bg-blue-50 border-b border-blue-200 flex items-center gap-3">
                    <span className="text-xs font-semibold text-blue-700">📷 Imagem:</span>
                    <div className="flex gap-1">
                      <button onClick={() => resizeImagem('max')} className="px-2 py-1 text-xs bg-blue-600  rounded hover:bg-blue-700">Máx</button>
                      <button onClick={() => resizeImagem('med')} className="px-2 py-1 text-xs bg-blue-500  rounded hover:bg-blue-600">Méd</button>
                      <button onClick={() => resizeImagem('peq')} className="px-2 py-1 text-xs bg-blue-400  rounded hover:bg-blue-500">Peq</button>
                    </div>
                    <div className="w-px h-4 bg-blue-300" />
                    <div className="flex gap-1">
                      <button onClick={() => alinharImagem('left')} className="px-2 py-1 text-xs bg-gray-200 rounded hover:bg-gray-300" title="Esquerda">←</button>
                      <button onClick={() => alinharImagem('center')} className="px-2 py-1 text-xs bg-gray-200 rounded hover:bg-gray-300" title="Centro">↔</button>
                      <button onClick={() => alinharImagem('right')} className="px-2 py-1 text-xs bg-gray-200 rounded hover:bg-gray-300" title="Direita">→</button>
                    </div>
                    <div className="w-px h-4 bg-blue-300" />
                    <button onClick={deletarImagem} className="px-2 py-1 text-xs bg-red-500  rounded hover:bg-red-600" title="Eliminar">🗑️</button>
                    <button onClick={() => setImagemSelecionada(null)} className="ml-auto text-xs text-gray-500 hover:text-gray-700">✕</button>
                  </div>
                )}
                <div className="overflow-y-auto bg-gray-50" style={{ maxHeight: 'calc(100vh - 500px)' }}>
                  <style>{`
                    .editor-wrapper { border: 1px dashed #e5e7eb; margin: 0 30px; border-radius: 6px; background: white; height: 750px; }
                    .editor-content img { cursor: pointer; max-width: 100%; border-radius: 4px; margin-left: 15px; margin-right: 15px; }
                    .editor-content img:hover { outline: 2px solid #3b82f6; }
                    .editor-content table { border-collapse: collapse; width: auto; min-width: 100px; resize: both; overflow: auto; max-width: 100%; }
                    .editor-content td, .editor-content th { border: 1px solid #d1d5db; padding: 4px 8px; min-width: 30px; min-height: 20px; resize: horizontal; overflow: auto; }
                    .editor-content th { background: #f3f4f6; font-weight: bold; }
                    .editor-content tr { height: auto; min-height: 20px; }
                    .editor-content tr:hover { background: #f9fafb; }
                    .editor-content table:hover { outline: 2px solid #3b82f6; }
                    .editor-content td:hover, .editor-content th:hover { background: #eff6ff; cursor: text; }
                  `}</style>
                  <div className="editor-wrapper">
                    <div
                      ref={editorRef}
                      contentEditable
                      suppressContentEditableWarning
                      className="p-6 text-sm outline-none editor-content"
                      style={{ 
                        whiteSpace: 'pre-wrap', 
                        color: '#1f2937', 
                        minHeight: '400px'
                      }}
                      onInput={(e) => { const el = e.currentTarget as HTMLDivElement; if (el) setCompose(prev => ({ ...prev, corpo: el.innerHTML })) }}
                    />
                  </div>
                {anexos.length > 0 && (
                  <div className="px-6 py-2 border-t border-gray-200 flex flex-wrap gap-2 bg-white">
                    {anexos.map((f, i) => (
                      <div key={i} className="flex items-center gap-1 bg-gray-100 rounded px-2 py-1 text-xs text-gray-700">
                        📎 {f.name}
                        <button onMouseDown={(e) => { e.preventDefault(); setAnexos(prev => prev.filter((_, j) => j !== i)) }}
                          className="text-red-500 hover:text-red-700 font-bold ml-1">✕</button>
                      </div>
                    ))}
                  </div>
                )}
                {assinatura && (
                  <div className="px-6 py-3 border-t border-gray-200 text-xs text-gray-500 whitespace-pre-wrap bg-white">--{'\n'}{assinatura}</div>
                )}
                </div>
              </div>
            )}
          </div>
        )
      }

      {
        mostrarPopupLink && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl p-6 w-96">
              <p className="text-sm font-bold text-gray-800 mb-3">🔗 Inserir ligação</p>
              <input autoFocus value={urlLinkTemp} onChange={e => setUrlLinkTemp(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') confirmarLink(); if (e.key === 'Escape') setMostrarPopupLink(false) }}
                placeholder="https://exemplo.com"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 mb-4" />
              <div className="flex gap-2 justify-end">
                <button onClick={() => setMostrarPopupLink(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
                <button onClick={confirmarLink}
                  className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700  font-bold rounded-lg">Inserir</button>
              </div>
            </div>
          </div>
        )
      }

      {
        mostrarPopupFechar && (
          <div
            className="absolute inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setMostrarPopupFechar(false)}>
            <div
              className="bg-white rounded-2xl shadow-2xl p-6 w-80 flex flex-col items-center text-center gap-2 relative"
              onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setMostrarPopupFechar(false)}
                className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 font-bold transition-colors">✕</button>
              <div className="w-12 h-12 rounded-full border-2 border-red-500 flex items-center justify-center text-red-500 font-bold text-xl">i</div>
              <p className="text-base font-bold text-gray-800">Guardar rascunho?</p>
              <p className="text-xs text-gray-500">A mensagem não foi enviada. O que pretendes fazer?</p>
              <div className="flex gap-2 w-full mt-1">
                <button onClick={() => {
                  setMostrarPopupFechar(false)
                  setMostrarCompose(false)
                  setCompose({ para: '', cc: '', bcc: '', assunto: '', corpo: '' })
                  setAnexos([])
                  if (editorRef.current) editorRef.current.innerHTML = ''
                  // Notificar o componente pai que o compose foi fechado
                  onCloseCompose?.()
                }}
                  className="flex-1 bg-black/70 hover:bg-red-900  font-bold py-2 rounded-lg text-xs transition-colors">
                  🗑️ Descartar
                </button>
                <button onClick={handleDraftSave}
                  className="flex-1 bg-red-50 border border-red-300 text-red-600 hover:bg-red-100 hover:text-red-700  font-bold py-2 rounded-lg text-xs transition-colors">
                  💾 Guardar
                </button>
              </div>
            </div>
          </div>
        )
      }

      {
        mostrarPopupTabela && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60]">
            <div className="bg-white rounded-xl shadow-2xl p-6 w-80">
              <p className="text-sm font-bold text-gray-800 mb-4">⊞ Inserir Tabela</p>
              <div className="space-y-3 mb-4">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-600 w-16">Linhas:</label>
                  <input type="number" min="1" max="20" value={tabelaConfig.linhas}
                    onChange={e => setTabelaConfig(prev => ({ ...prev, linhas: parseInt(e.target.value) || 1 }))}
                    className="w-20 border border-gray-300 rounded px-2 py-1 text-sm" />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-600 w-16">Colunas:</label>
                  <input type="number" min="1" max="10" value={tabelaConfig.colunas}
                    onChange={e => setTabelaConfig(prev => ({ ...prev, colunas: parseInt(e.target.value) || 1 }))}
                    className="w-20 border border-gray-300 rounded px-2 py-1 text-sm" />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setMostrarPopupTabela(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
                <button onClick={() => {
                  inserirTabela(tabelaConfig.linhas, tabelaConfig.colunas)
                  setMostrarPopupTabela(false)
                }}
                  className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700  font-bold rounded-lg">Inserir</button>
              </div>
            </div>
          </div>
        )
      }

      {
        mostrarConfigAssinatura && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60]">
            <div className={`rounded-xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden border transition-colors ${modoEscuroAssinatura ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'}`}>
              {/* Header macOS style */}
              <div className={`px-5 py-3 flex items-center justify-between border-b transition-colors ${modoEscuroAssinatura ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500 cursor-pointer" onClick={() => setMostrarConfigAssinatura(false)} />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                </div>
                <h2 className={`text-sm font-bold transition-colors ${modoEscuroAssinatura ? '' : 'text-gray-900'}`}>Assinaturas</h2>
                <button
                  onClick={() => setModoEscuroAssinatura(!modoEscuroAssinatura)}
                  title={modoEscuroAssinatura ? "Modo Claro" : "Modo Escuro"}
                  className={`text-xs px-2 py-1 rounded border transition-colors ${modoEscuroAssinatura ? 'bg-yellow-500 border-yellow-600  hover:bg-yellow-600' : 'bg-gray-700 border-gray-600  hover:bg-gray-600'}`}>
                  {modoEscuroAssinatura ? '☀️ Claro' : '🌙 Escuro'}
                </button>
              </div>

              <div className={`p-6 space-y-5 transition-colors ${modoEscuroAssinatura ? 'bg-gray-900' : 'bg-white'}`}>
                {/* Editar assinatura */}
                <div>
                  <h3 className={`text-sm font-bold mb-3 transition-colors ${modoEscuroAssinatura ? '' : 'text-gray-800'}`}>Editar assinatura:</h3>
                  <div className={`rounded-lg border flex overflow-hidden transition-colors ${modoEscuroAssinatura ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`} style={{ minHeight: '200px' }}>
                    {/* Lista */}
                    <div className={`w-52 border-r flex flex-col transition-colors ${modoEscuroAssinatura ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50/50 border-gray-200'}`}>
                      <div className={`px-3 py-2 border-b transition-colors ${modoEscuroAssinatura ? 'bg-gray-800 border-gray-700' : 'bg-gray-100 border-gray-200'}`}>
                        <p className={`text-xs font-bold transition-colors ${modoEscuroAssinatura ? 'text-gray-400' : 'text-gray-500'}`}>Nome da assinatura</p>
                      </div>
                      <div className="flex-1">
                        {assinaturas.length === 0 && (
                          <div className={`px-3 py-4 text-sm text-center transition-colors ${modoEscuroAssinatura ? 'text-gray-500' : 'text-gray-400'}`}>
                            Nenhuma assinatura<br/>Clique em + para adicionar
                          </div>
                        )}
                        {assinaturas.map((s, i) => (
                          <div key={i} onClick={() => setAssinaturaAtiva(i)}
                            className={`px-3 py-2 cursor-pointer text-sm border-b transition-colors ${assinaturaAtiva === i ? 'bg-red-50 text-red-600 font-bold' : modoEscuroAssinatura ? 'text-gray-300 hover:bg-gray-700 border-gray-700' : 'text-gray-600 hover:bg-gray-100 border-gray-100'}`}>
                            {s.nome}
                          </div>
                        ))}
                      </div>
                      <div className={`flex items-center gap-1 p-2 border-t transition-colors ${modoEscuroAssinatura ? 'border-gray-700' : 'border-gray-200'}`}>
                        <button onClick={() => setAssinaturas((prev: { nome: string, activa: boolean, texto: string, imagemUrl: string }[]) => [...prev, { nome: 'Nova Assinatura', activa: false, texto: '', imagemUrl: '' }])}
                          className={`text-xs px-2 py-1 rounded font-bold transition-colors ${modoEscuroAssinatura ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}>+</button>
                        <button onClick={() => setAssinaturas((prev: { nome: string, activa: boolean, texto: string, imagemUrl: string }[]) => prev.filter((_, i) => i !== assinaturaAtiva))}
                          className={`text-xs px-2 py-1 rounded font-bold transition-colors ${modoEscuroAssinatura ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}>−</button>
                        <button onClick={() => { setMostrarConfigAssinatura(false); setMostrarEditarAssinatura(true) }}
                          className={`ml-auto text-xs px-3 py-1 rounded transition-colors border ${modoEscuroAssinatura ? 'bg-gray-800 border-gray-600 hover:bg-gray-700 text-gray-200' : 'bg-white border-gray-300 hover:bg-gray-50 text-gray-600'}`}>Editar</button>
                      </div>
                    </div>
                    {/* Preview - fundo branco SEMPRE para simular email real */}
                    <div className="flex-1 flex-col flex bg-white">
                      <div className={`px-3 py-2 border-b text-center transition-colors ${modoEscuroAssinatura ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                        <p className={`text-xs font-bold transition-colors ${modoEscuroAssinatura ? 'text-gray-400' : 'text-gray-500'}`}>Pré-visualização da Assinatura</p>
                      </div>
                      <div className="flex-1 p-4 bg-white text-gray-700 flex items-center justify-center">
                        {assinaturas[assinaturaAtiva]?.imagemUrl ? (
                          <img src={assinaturas[assinaturaAtiva].imagemUrl} alt="Assinatura" className="max-w-full max-h-32 object-contain mx-auto" />
                        ) : (
                          <div className="text-sm whitespace-pre-wrap w-full">{assinaturas[assinaturaAtiva]?.texto || ''}</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Assinatura predefinida */}
                <div>
                  <h3 className={`text-sm font-bold mb-3 transition-colors ${modoEscuroAssinatura ? '' : 'text-gray-800'}`}>Selecionar assinatura predefinida:</h3>
                  <div className={`rounded-lg border p-4 space-y-3 transition-colors ${modoEscuroAssinatura ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                    {/* Conta - Dropdown com todas as contas */}
                    <div className="flex items-center gap-4">
                      <span className={`text-sm w-44 text-right shrink-0 transition-colors ${modoEscuroAssinatura ? 'text-gray-400' : 'text-gray-500'}`}>Conta:</span>
                      <select
                        value={emailOrigem}
                        onChange={e => {
                          const novoEmail = e.target.value
                          const emailAnterior = emailOrigem
                          console.log('[DEBUG] Dropdown mudou de', emailAnterior, 'para:', novoEmail)

                          // Salvar assinaturas da conta anterior ANTES de mudar
                          if (emailAnterior) {
                            const configAnterior = {
                              assinaturas,
                              assinaturaAtiva,
                              assinaturaPadrao: assinatura
                            }
                            const estadoAtualizado = {
                              ...assinaturasPorEmailRef.current,
                              [emailAnterior]: configAnterior
                            }
                            assinaturasPorEmailRef.current = estadoAtualizado
                            localStorage.setItem(STORAGE_KEY, JSON.stringify(estadoAtualizado))
                            console.log('[DEBUG] Salvo config para', emailAnterior, ':', configAnterior)
                          }

                          // Agora mudar para a nova conta
                          setEmailOrigem(novoEmail)
                        }}
                        className={`flex-1 text-sm px-3 py-2 rounded-lg outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400 ${modoEscuroAssinatura ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-900'}`}
                      >
                        {emailsOrigem.length > 0 ? (
                          memoEmailsOrigem.map((conta) => (
                            <option key={conta.email} value={conta.email}>
                              {conta.nome ? `${conta.nome} (${conta.email})` : conta.email}
                            </option>
                          ))
                        ) : (
                          <option value={emailOrigem}>{emailOrigem || 'Nenhuma conta'}</option>
                        )}
                      </select>
                    </div>

                    {/* Novas mensagens */}
                    <div className="flex items-center gap-4">
                      <span className={`text-sm w-44 text-right shrink-0 transition-colors ${modoEscuroAssinatura ? 'text-gray-400' : 'text-gray-500'}`}>Novas mensagens:</span>
                      <select
                        value={assinaturaAtiva}
                        onChange={e => {
                          const idx = parseInt(e.target.value)
                          setAssinaturaAtiva(idx)
                          // Marcar como ativa (padrão)
                          setAssinaturas(prev => prev.map((a, i) => ({
                            ...a,
                            activa: i === idx
                          })))
                          // Aplicar imediatamente - usar callback para obter valor atual
                          setAssinatura(prev => assinaturas[idx]?.texto || '')
                        }}
                        className={`flex-1 text-sm px-3 py-2 rounded-lg outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400 ${modoEscuroAssinatura ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-900'}`}
                      >
                        <option value="">Nenhuma</option>
                        {assinaturas.map((s, i) => (
                          <option key={s.nome} value={i}>
                            {s.nome}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Respostas/reencaminhamentos */}
                    <div className="flex items-center gap-4">
                      <span className={`text-sm w-44 text-right shrink-0 transition-colors ${modoEscuroAssinatura ? 'text-gray-400' : 'text-gray-500'}`}>Respostas/reenc.:</span>
                      <select
                        value={assinaturaAtiva}
                        onChange={e => {
                          const idx = parseInt(e.target.value)
                          setAssinaturaAtiva(idx)
                          // Marcar como ativa (padrão)
                          setAssinaturas(prev => prev.map((a, i) => ({
                            ...a,
                            activa: i === idx
                          })))
                          // Aplicar imediatamente
                          setAssinatura(prev => assinaturas[idx]?.texto || '')
                        }}
                        className={`flex-1 text-sm px-3 py-2 rounded-lg outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400 ${modoEscuroAssinatura ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-900'}`}
                      >
                        <option value="">Nenhuma</option>
                        {assinaturas.map((s, i) => (
                          <option key={s.nome} value={i}>
                            {s.nome}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <button onClick={() => {
                    // Salvar assinaturas da conta atual antes de fechar
                    if (emailOrigem) {
                      const config = { assinaturas, assinaturaAtiva, assinaturaPadrao: assinatura }
                      const novoEstado = { ...assinaturasPorEmailRef.current, [emailOrigem]: config }
                      assinaturasPorEmailRef.current = novoEstado
                      localStorage.setItem(STORAGE_KEY, JSON.stringify(novoEstado))
                      console.log('[DEBUG] Salvo ao fechar modal:', emailOrigem, config)
                    }
                    if (assinaturas[assinaturaAtiva]) setAssinatura(assinaturas[assinaturaAtiva].texto)
                    setMostrarConfigAssinatura(false)
                  }}
                    className="bg-red-50 border border-red-300 text-red-600 hover:bg-red-100 hover:text-red-700  px-6 py-2.5 rounded-lg text-sm font-bold transition-colors">Guardar</button>
                  <button onClick={() => setMostrarConfigAssinatura(false)}
                    className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-colors ${modoEscuroAssinatura ? 'bg-gray-700 hover:bg-gray-600 ' : 'bg-gray-500 hover:bg-gray-600 '}`}>Cancelar</button>
                </div>
              </div>
            </div>
          </div>
        )
      }
      {
        mostrarEditarAssinatura && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60]">
            <div className={`rounded-xl shadow-2xl w-full max-w-4xl mx-4 h-[85vh] flex flex-col overflow-hidden border transition-colors ${modoEscuroAssinatura ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'}`}>
              {/* Header macOS style - só botões de popup */}
              <div className={`px-5 py-2 flex items-center justify-between border-b transition-colors ${modoEscuroAssinatura ? 'bg-gray-900 border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-3 h-3 rounded-full bg-red-500 cursor-pointer" onClick={() => { setMostrarEditarAssinatura(false); setMostrarConfigAssinatura(true) }} />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                </div>
              </div>

              {/* Nome da assinatura */}
              <div className={`flex items-center gap-3 border-b px-5 py-2 transition-colors ${modoEscuroAssinatura ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                <span className={`text-sm shrink-0 ${modoEscuroAssinatura ? 'text-gray-300' : 'text-gray-500'}`}>Nome da Assinatura:</span>
                <input
                  key={`assinatura-nome-${assinaturaAtiva}`}
                  defaultValue={assinaturas[assinaturaAtiva]?.nome || ''}
                  onBlur={e => {
                    const novoNome = e.target.value
                    setAssinaturas(prev => prev.map((a, i) => i === assinaturaAtiva ? { ...a, nome: novoNome } : a))
                  }}
                  className={`flex-1 border text-sm px-3 py-1.5 rounded outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400 ${modoEscuroAssinatura ? 'bg-gray-700 border-gray-600 ' : 'bg-white border-gray-300 text-gray-900'}`} />
              </div>

              {/* Toolbar - largura total embaixo do nome */}
              <div className={`flex items-center gap-1 flex-wrap border-b px-5 py-2 transition-colors ${modoEscuroAssinatura ? 'bg-gray-900 border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
                <select 
                  onChange={(e) => { if (assinaturaEditorRef.current) { assinaturaEditorRef.current.focus(); document.execCommand('fontName', false, e.target.value) } }}
                  className={`text-xs px-2 py-1.5 rounded outline-none ${modoEscuroAssinatura ? 'bg-gray-800 border-gray-700 text-gray-200' : 'bg-white border-gray-200 text-gray-900'}`}>
                  <option>Calibri</option><option>Arial</option><option>Times New Roman</option>
                </select>
                <select 
                  onChange={(e) => { if (assinaturaEditorRef.current) { assinaturaEditorRef.current.focus(); document.execCommand('fontSize', false, e.target.value) } }}
                  className={`text-xs px-2 py-1.5 rounded w-14 outline-none ${modoEscuroAssinatura ? 'bg-gray-800 border-gray-700 text-gray-200' : 'bg-white border-gray-200 text-gray-900'}`}>
                  <option>11</option><option>12</option><option>14</option><option>16</option>
                </select>
                <div className={`w-px h-5 mx-1 ${modoEscuroAssinatura ? 'bg-gray-700' : 'bg-gray-300'}`} />
                <button 
                  onClick={() => { if (assinaturaEditorRef.current) { assinaturaEditorRef.current.focus(); document.execCommand('bold') } }}
                  title="Negrito" 
                  className={`text-xs px-3 py-1.5 rounded border transition-colors font-bold ${modoEscuroAssinatura ? 'bg-gray-800 border-gray-700 text-gray-200 hover:bg-gray-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}>N</button>
                <button 
                  onClick={() => { if (assinaturaEditorRef.current) { assinaturaEditorRef.current.focus(); document.execCommand('italic') } }}
                  title="Itálico" 
                  className={`text-xs px-3 py-1.5 rounded border transition-colors italic ${modoEscuroAssinatura ? 'bg-gray-800 border-gray-700 text-gray-200 hover:bg-gray-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}>I</button>
                <button 
                  onClick={() => { if (assinaturaEditorRef.current) { assinaturaEditorRef.current.focus(); document.execCommand('underline') } }}
                  title="Sublinhado" 
                  className={`text-xs px-3 py-1.5 rounded border transition-colors underline ${modoEscuroAssinatura ? 'bg-gray-800 border-gray-700 text-gray-200 hover:bg-gray-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}>S</button>
                <button 
                  onClick={() => { if (assinaturaEditorRef.current) { assinaturaEditorRef.current.focus(); document.execCommand('strikeThrough') } }}
                  title="Riscado" 
                  className={`text-xs px-3 py-1.5 rounded border transition-colors line-through ${modoEscuroAssinatura ? 'bg-gray-800 border-gray-700 text-gray-200 hover:bg-gray-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}>ab</button>
                <div className={`w-px h-5 mx-1 ${modoEscuroAssinatura ? 'bg-gray-700' : 'bg-gray-300'}`} />
                <button 
                  onClick={() => {
                    const url = prompt('URL do link:')
                    if (url && assinaturaEditorRef.current) {
                      assinaturaEditorRef.current.focus()
                      document.execCommand('createLink', false, url)
                    }
                  }}
                  title="Ligação" 
                  className={`text-xs px-2 py-1.5 rounded border transition-colors ${modoEscuroAssinatura ? 'bg-gray-800 border-gray-700 text-gray-200 hover:bg-gray-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}>🔗 Ligação</button>
                <div className="flex-1" />
                <button 
                  onClick={() => setModoEscuroAssinatura(!modoEscuroAssinatura)}
                  title={modoEscuroAssinatura ? "Modo Claro" : "Modo Escuro"}
                  className={`text-xs px-2 py-1.5 rounded border transition-colors ${modoEscuroAssinatura ? 'bg-yellow-500 border-yellow-600  hover:bg-yellow-600' : 'bg-gray-700 border-gray-600  hover:bg-gray-600'}`}>{modoEscuroAssinatura ? '☀️ Claro' : '🌙 Escuro'}</button>
              </div>

              {/* Área de edição — fundo branco SEMPRE */}
              <div className="flex-1 flex flex-col bg-white overflow-hidden">
                <div
                  ref={assinaturaEditorRef}
                  contentEditable
                  onFocus={(e) => {
                    // Garantir que existe conteúdo para posicionar o cursor
                    const div = e.target as HTMLDivElement
                    if (!div.innerHTML || div.innerHTML === '<br>') {
                      div.innerHTML = '<div><br></div>'
                    }
                    // Posicionar cursor no final
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
                <div className={`border-t px-5 py-3 flex items-center gap-3 flex-wrap transition-colors ${modoEscuroAssinatura ? 'bg-gray-900 border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
                  <span className={`text-xs font-medium ${modoEscuroAssinatura ? 'text-gray-400' : 'text-gray-600'}`}>Imagem da assinatura:</span>
                  <label className={`text-xs px-3 py-1.5 rounded cursor-pointer transition-colors ${modoEscuroAssinatura ? 'bg-gray-800 text-gray-200 hover:bg-gray-700 border border-gray-700' : 'bg-gray-800  hover:bg-gray-700'}`}>
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
                  <span className={`text-xs ${modoEscuroAssinatura ? 'text-gray-500' : 'text-gray-400'}`}>ou URL:</span>
                  <input
                    placeholder="https://url-da-imagem.png"
                    defaultValue={assinaturas[assinaturaAtiva]?.imagemUrl || ''}
                    onBlur={e => {
                      const url = e.target.value
                      setAssinaturas(prev => prev.map((a, i) => i === assinaturaAtiva ? { ...a, imagemUrl: url } : a))
                    }}
                    className={`flex-1 min-w-40 text-xs rounded px-2 py-1.5 outline-none ${modoEscuroAssinatura ? 'bg-gray-800 border-gray-700 text-gray-200 border' : 'bg-white border-gray-300 border'}`} />
                  {assinaturas[assinaturaAtiva]?.imagemUrl && (
                    <button onClick={() => setAssinaturas(prev => prev.map((a, i) => i === assinaturaAtiva ? { ...a, imagemUrl: '' } : a))}
                      className="text-xs text-red-500 hover:text-red-700 font-bold">✕ Remover</button>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className={`border-t px-5 py-3 flex justify-end gap-3 transition-colors ${modoEscuroAssinatura ? 'bg-gray-900 border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
                <button onClick={() => {
                  // Salvar assinaturas da conta atual antes de voltar
                  if (emailOrigem) {
                    const config = { assinaturas, assinaturaAtiva, assinaturaPadrao: assinatura }
                    const novoEstado = { ...assinaturasPorEmailRef.current, [emailOrigem]: config }
                    assinaturasPorEmailRef.current = novoEstado
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(novoEstado))
                    console.log('[DEBUG] Salvo ao guardar edição:', emailOrigem, config)
                  }
                  setAssinatura(assinaturas[assinaturaAtiva]?.texto || '')
                  setMostrarEditarAssinatura(false)
                  setMostrarConfigAssinatura(true)
                }}
                  className="bg-red-50 border border-red-300 text-red-600 hover:bg-red-100 hover:text-red-700  px-6 py-2 rounded-lg text-sm font-bold transition-colors shadow-sm">Guardar</button>
                <button onClick={() => { setMostrarEditarAssinatura(false); setMostrarConfigAssinatura(true) }}
                  className={`px-6 py-2 rounded-lg text-sm font-bold transition-colors ${modoEscuroAssinatura ? 'bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>Cancelar</button>
              </div>
            </div>
          </div>
        )
      }

      {
        mostrarConfigContactos && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60]">
            <div className="bg-white rounded-lg shadow-2xl p-5 w-full max-w-md mx-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-gray-900">👥 Contactos Guardados</h2>
                <button onClick={() => setMostrarConfigContactos(false)}
                  className="text-gray-400 hover:text-red-600 text-lg font-bold transition-colors">✕</button>
              </div>

              {/* Lista de contactos */}
              <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
                {contactos.map((c, i) => (
                  <div key={i} className="flex items-center justify-between bg-gray-50 rounded-md px-3 py-2 border border-gray-200">
                    <div>
                      <p className="text-sm font-bold text-gray-800">{c.nome}</p>
                      <p className="text-xs text-gray-500">{c.email}</p>
                    </div>
                    <button onClick={() => setContactos(contactos.filter((_, j) => j !== i))}
                      className="text-red-400 hover:text-red-600 text-xs font-bold transition-colors">✕</button>
                  </div>
                ))}
                {contactos.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-3">Nenhum contacto guardado.</p>
                )}
              </div>

              {/* Formulário novo contacto */}
              <div className="border-t border-gray-200 pt-4">
                <p className="text-xs font-bold text-gray-500 uppercase mb-2">Adicionar Contacto</p>
                <div className="space-y-2 mb-3">
                  <input value={novoContacto.nome} onChange={e => setNovoContacto({ ...novoContacto, nome: e.target.value })}
                    placeholder="Nome completo" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm outline-none focus:border-red-400" />
                  <input value={novoContacto.email} onChange={e => setNovoContacto({ ...novoContacto, email: e.target.value })}
                    placeholder="Email" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm outline-none focus:border-red-400" />
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setMostrarConfigContactos(false)}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-md text-sm font-bold transition-colors">
                    Fechar
                  </button>
                  <button
                    onClick={() => {
                      if (novoContacto.nome && novoContacto.email) {
                        setContactos([...contactos, { nome: novoContacto.nome, email: novoContacto.email }])
                        setNovoContacto({ nome: '', email: '' })
                      }
                    }}
                    disabled={!novoContacto.nome || !novoContacto.email}
                    className="flex-1 bg-red-50 border border-red-300 text-red-600 hover:bg-red-100 hover:text-red-700 disabled:opacity-50  py-2 rounded-md text-sm font-bold transition-colors">
                    + Adicionar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Modal Adicionar Conta */}
      {mostrarAdicionarConta && (
        <AddEmailAccountModal 
          isOpen={mostrarAdicionarConta}
          onClose={() => setMostrarAdicionarConta(false)}
          onAccountAdded={(account) => {
            // Inserir nova conta na lista sem reload
            setMostrarAdicionarConta(false)
            if (account && account.email) {
              setEmailsOrigem(prev => {
                const exists = prev.find(p => p.email === account.email)
                if (exists) return prev
                const next = [{
                  email: account.email,
                  tipo: account.tipo === 'webmail' ? 'webmail' : (account.tipo === 'outlook' ? 'outlook' : 'google'),
                  nome: account.nome || account.email.split('@')[0],
                  password: account.password || ''
                }, ...prev]
                return next
              })
              // Selecionar a conta recém-adicionada
              setTimeout(() => {
                setEmailOrigem(account.email)
                setPastaActiva('Caixa de Entrada')
              }, 200)
            }
          }}
        />
      )}
    </div>
  )
}