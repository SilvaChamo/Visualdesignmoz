'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Users, Search, Server as ServerIcon, Settings, Target, HelpCircle,
  Menu, Bell, ChevronDown, Check, CreditCard, ChevronDown as ChevronDownIcon,
  Search as SearchIcon, Paperclip as PaperclipIcon, Check as CheckIcon,
  MoreVertical as MoreVerticalIcon, Star as StarIcon, Reply as ReplyIcon,
  CornerUpRight as CornerUpRightIcon, Trash as TrashIcon, Download as DownloadIcon,
  Plus as PlusIcon, LayoutGrid, Palette, Type, MousePointer, Box,
  Trash2 as Trash2Icon, RefreshCw as RefreshCwIcon, LogOut as LogOutIcon, X, Upload,
  Edit2, Pause, Play, Trash2, RefreshCw, LogOut, Package, Server, Lock, LockOpen, Edit, Power, FolderOpen, FileText, Archive, AlertCircle, Globe as GlobeIcon, ChevronRight as ChevronRightIcon, Image as ImageIcon
} from 'lucide-react'
import { detectDomainConfig } from '@/lib/email-autoconfig'
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
  onComposeStateChange
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
  const [emailsOrigem, setEmailsOrigem] = useState<{ email: string, tipo: string, nome: string, password?: string }[]>([])
  const [emailOrigem, setEmailOrigem] = useState('')
  const [emailOrigemPassword, setEmailOrigemPassword] = useState('')

  // Configurar email e senha automaticamente quando abre o compositor
  useEffect(() => {
    if (mostrarCompose) {
      const configurarEmailAutomatico = async () => {
        // Se tem propEmailOrigem, usa ele
        if (propEmailOrigem) {
          setEmailOrigem(propEmailOrigem)
          // Buscar senha da conta automaticamente
          try {
            const res = await fetch('/api/email-contas')
            const data = await res.json()
            if (data.success && data.contas) {
              const conta = data.contas.find((c: any) => c.email === propEmailOrigem)
              if (conta?.password_smtp) {
                setEmailOrigemPassword(conta.password_smtp)
              }
            }
          } catch { }
        } else if (emailsOrigem.length > 0) {
          // Se não tem prop, usa o primeiro email da lista
          const primeiroEmail = emailsOrigem[0]
          setEmailOrigem(primeiroEmail.email)
          if (primeiroEmail.password) {
            setEmailOrigemPassword(primeiroEmail.password)
          }
        }
      }
      configurarEmailAutomatico()
    }
  }, [mostrarCompose, propEmailOrigem, emailsOrigem])
  const [todasAsContas, setTodasAsContas] = useState(false)
  const [carregandoEmails, setCarregandoEmails] = useState(false)
  const [erroEmail, setErroEmail] = useState('')
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

  // Extrair domínio do emailOrigem para o webmail
  const getWebmailUrl = () => {
    return detectDomainConfig(emailOrigem).webmail
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
              password: emailOrigemPassword || (emailOrigem?.endsWith('@your-domain.com') ? 'YourSecurePass' : ''),
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

  // Carregar contas reais do CyberPanel para as abas
  useEffect(() => {
    const carregarContas = async () => {
      if (!sites || sites.length === 0) {
        // Fallback: Tentar buscar todas as contas do Supabase ligadas ao cliente
        try {
          const res2 = await fetch('/api/email-contas')
          const data2 = await res2.json()
          if (data2.success && data2.contas?.length > 0) {
            setEmailsOrigem(data2.contas.map((c: any) => ({
              email: c.email, tipo: c.tipo_conta, nome: c.nome_conta, password: ''
            })))
          }
        } catch { }
        return
      }

      setCarregandoEmails(true)
      try {
        // Carregar contas de TODOS os domínios do cliente em paralelo
        const promises = sites.map(site => 
          fetch(`/api/cyberpanel-email?domain=${encodeURIComponent(site.domain)}`)
            .then(r => r.json())
            .catch(() => ({ success: false }))
        )
        
        const results = await Promise.all(promises)
        const allEmails: any[] = []
        
        results.forEach((data, index) => {
          if (data.success && data.emails) {
            data.emails.forEach((e: any) => {
              allEmails.push({
                email: e.email,
                tipo: 'webmail',
                nome: e.user || e.email.split('@')[0],
                password: '',
                domain: sites[index].domain
              })
            })
          }
        })

        // Filtrar apenas emails do domínio visualdesign para o painel admin
        const filteredEmails = allEmails.filter((e: any) => 
          e.email.includes('@visualdesign') || e.email.endsWith('@visualdesigne.com')
        )
        
        if (filteredEmails.length > 0) {
          setEmailsOrigem(filteredEmails)
        } else if (allEmails.length > 0) {
          // Se não houver emails do visualdesign, mostrar todos (fallback)
          setEmailsOrigem(allEmails)
        } else {
          // Segundo fallback se não vier nada do CyberPanel
          const res2 = await fetch('/api/email-contas')
          const data2 = await res2.json()
          if (data2.success && data2.contas?.length > 0) {
            setEmailsOrigem(data2.contas.map((c: any) => ({
              email: c.email, tipo: c.tipo_conta, nome: c.nome_conta, password: ''
            })))
          }
        }
      } catch (e) {
        console.error('Erro ao carregar contas:', e)
      }
      setCarregandoEmails(false)
    }
    carregarContas()
  }, [sites])

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
          body.emails = emailsOrigem.map(e => e.email)
        } else {
          const senhaImap = emailOrigemPassword || (emailOrigem?.endsWith('@your-domain.com') ? 'Ad.Vd#2425?*' : '')
          if (!emailOrigem || !senhaImap) {
            setCarregandoEmails(false)
            return
          }
          body.email = emailOrigem
          body.password = senhaImap
        }

        const res = await fetch('/api/read-emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        })
        const data = await res.json()
        if (data.success) setEmails(data.emails)
        else setErroEmail(data.error)
      } catch (e: any) { setErroEmail(e.message) }
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
  const [assinaturas, setAssinaturas] = useState([
    { nome: 'Profissional', activa: true, texto: '', imagemUrl: '' },
    { nome: 'Minimalista', activa: false, texto: '', imagemUrl: '' },
  ])
  const [assinaturaActiva, setAssinaturaActiva] = useState(0)

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

  const handleSend = async () => {
    if (!emailOrigem) {
      alert('Selecciona uma conta de email')
      return
    }
    if (!emailOrigemPassword) {
      alert('Introduz a senha da conta de email. Clica no botão "Configurar" ao lado do campo "De:".')
      return
    }
    setEnviando(true)
    try {
      const htmlCorpo = editorRef.current?.innerHTML || ''
      const htmlFinal = assinatura ? `${htmlCorpo}<br/><br/>--<br/>${assinatura.replace(/\n/g, '<br/>')}` : htmlCorpo

      // TAREFA 2: Idempotency key — garante que retries não geram duplicados
      const idempotencyKey = crypto.randomUUID()

      // TAREFA 4: AbortController — timeout de 30s para evitar hang infinito
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000)

      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          from: emailOrigem,
          fromPassword: emailOrigemPassword,
          to: compose.para,
          cc: compose.cc,
          bcc: compose.bcc,
          subject: compose.assunto,
          html: htmlFinal,
          idempotencyKey
        })
      })
      clearTimeout(timeoutId)

      const data = await res.json()
      if (data.success) {
        setEnviado(true)
        // Fechar composer após 2 segundos
        setTimeout(() => {
          setMostrarCompose(false)
          setCompose({ para: '', cc: '', bcc: '', assunto: '', corpo: '' })
          setEnviado(false)
          setAnexos([])
          if (editorRef.current) editorRef.current.innerHTML = ''
          if (onCloseCompose) onCloseCompose()
        }, 2000)
      }
      else alert('Erro ao enviar: ' + data.error)
    } catch (e: any) {
      if (e.name === 'AbortError') {
        alert('O envio demorou demasiado. Verifique a pasta Enviados antes de tentar novamente.')
      } else {
        alert('Erro: ' + e.message)
      }
    }
    setEnviando(false)
  }

  const pastas = ['Caixa de Entrada', 'Enviados', 'Rascunhos', 'Arquivo', 'Lixo', 'Spam']

  const botoesFormato = [
    { l: 'N', t: 'Negrito' }, { l: 'I', t: 'Itálico' }, { l: 'S', t: 'Sublinhado' },
    { l: 'ab', t: 'Riscado' },
  ]

  return (
    <div className="flex flex-col h-full w-full">

      {/* TOOLBAR PRINCIPAL - Escondida quando compose está ativo */}
      <div className={`bg-gray-100 px-4 py-2 flex items-center gap-2 flex-wrap border-b border-gray-200 ${mostrarCompose ? 'hidden' : ''}`}>
        <button onClick={() => {
          setMostrarCompose(true)
          setEnviado(false)
          setCompose({ para: '', cc: '', bcc: '', assunto: '', corpo: '' })
          setAnexos([])
          setTimeout(() => {
            if (editorRef.current) editorRef.current.innerHTML = ''
          }, 50)
        }}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 rounded-md text-sm font-bold flex items-center gap-2 transition-colors">
          Escrever
        </button>
      
      <a href={getWebmailUrl()} target="_blank"
        className="bg-gray-600 hover:bg-red-600 text-white px-4 py-1.5 rounded-md text-sm font-bold flex items-center gap-2 transition-colors">
        {emailOrigem ? 'Webmail' : 'Webmail'}
      </a>
      <div className="w-px h-5 bg-gray-700 mx-1" />
      {pastas.map(p => (
        <button key={p} onClick={() => { setPastaActiva(p); setModalEmail(null); }}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${pastaActiva === p ? 'text-red-600 bg-transparent' : 'text-gray-600 hover:text-red-500 bg-transparent'}`}>
          {p}
        </button>
      ))}
      <div className="ml-auto flex items-center gap-2">
        <button onClick={() => setMostrarConfigAssinatura(true)}
          className="text-gray-600 hover:text-red-500 text-sm px-4 py-1.5 rounded-md border border-gray-300 hover:border-red-500 transition-colors flex items-center gap-2 font-medium bg-white">
          Assinatura
        </button>
      </div>
      </div>

      {/* LISTA DE EMAILS */}
      <div className="flex-1 flex overflow-hidden bg-white relative">
        {/* SIDEBAR DE CONTAS - Escondida quando compose está ativo */}
        <div className={`shrink-0 border-r border-gray-200 bg-gray-50 flex flex-col overflow-y-auto ${mostrarCompose ? 'hidden' : 'w-72'}`}>
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
          {emailsOrigem.map(c => {
            const isSelected = emailOrigem === c.email
            const isExpanded = !!expandedMap[c.email]
            return (
              <div key={c.email} className="border-b border-gray-100">
                <div className="flex items-center w-full">
                  <button onClick={() => toggleExpand(c.email)}
                    className="px-3 py-2.5 hover:bg-white transition-colors">
                    <svg className="w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200" style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
                  </button>
                  <button onClick={() => { setTodasAsContas(false); setEmailOrigem(c.email); setModalEmail(null); if (c.password) setEmailOrigemPassword(c.password) }}
                    className={`flex-1 py-2.5 pr-3 text-left hover:bg-white transition-colors`}>
                    <span className={`text-sm truncate w-full block ${isSelected ? "text-red-600 font-bold" : "text-gray-700 font-medium"}`}>{c.email}</span>
                  </button>
                </div>
                {isExpanded && (
                  <div className="pl-5">
                    {pastasIcones.map(p => (
                      <button key={p.nome} onClick={() => { setPastaActiva(p.nome); setTodasAsContas(false); setEmailOrigem(c.email); setModalEmail(null); if (c.password) setEmailOrigemPassword(c.password) }}
                        className={`flex items-center gap-1.5 w-full px-3 py-1 text-left text-sm hover:bg-white transition-colors ${pastaActiva === p.nome && emailOrigem === c.email ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                        <span className="shrink-0">{p.icon}</span>
                        <span>{p.nome}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        {/* ÁREA DE CONTEÚDO: Alterna entre Lista de Emails e Compose */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {mostrarCompose ? (
            /* ========== VIEW COMPOSE (Página de Escrever) ========== */
            <div className="flex flex-col bg-white h-full overflow-hidden">
              {/* Header do Compose */}
              <div className="bg-gray-50 border-b border-gray-200 flex">
                {/* Coluna esquerda — botão Enviar */}
                <div className="flex flex-col border-r border-gray-200 shrink-0">
                  <button onClick={handleSend} disabled={enviando || !compose.para || !emailOrigem}
                    className="flex-1 bg-green-600 hover:bg-green-500 disabled:bg-green-600 disabled:cursor-not-allowed text-white font-bold px-6 text-sm flex flex-col items-center justify-center gap-1 shadow-sm min-w-[110px]">
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
                      {emailsOrigem.map(e => (
                        <option key={e.email} value={e.email} className="bg-white">
                          {e.nome} ({e.email}) {e.tipo === 'google' ? '📧' : e.tipo === 'hotmail' ? '📨' : '🌐'}
                        </option>
                      ))}
                    </select>
                    <button onClick={() => setMostrarPopupFechar(true)}
                      className="ml-2 w-8 h-full min-h-[32px] flex items-center justify-center bg-red-600 hover:bg-red-700 text-white font-bold text-sm shrink-0 transition-colors -mr-0 self-stretch">✕</button>
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
        ${activo ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                        onMouseDown={(e) => {
                          e.preventDefault()
                          if (!cmd) return
                          if (b.t === 'Subscrito' && document.queryCommandState('superscript')) execCmd('superscript')
                          if (b.t === 'Superscrito' && document.queryCommandState('subscript')) execCmd('subscript')
                          execCmd(cmd)
                        }}>
                        {b.t === 'Itálico' ? <em>{b.l}</em> : b.t === 'Riscado' ? <s>{b.l}</s> : b.l}
                        <span className="absolute top-8 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-20 pointer-events-none">{b.t}</span>
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
                    <button onClick={() => resizeImagem('max')} className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">Máx</button>
                    <button onClick={() => resizeImagem('med')} className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600">Méd</button>
                    <button onClick={() => resizeImagem('peq')} className="px-2 py-1 text-xs bg-blue-400 text-white rounded hover:bg-blue-500">Peq</button>
                  </div>
                  <div className="w-px h-4 bg-blue-300" />
                  <div className="flex gap-1">
                    <button onClick={() => alinharImagem('left')} className="px-2 py-1 text-xs bg-gray-200 rounded hover:bg-gray-300" title="Esquerda">←</button>
                    <button onClick={() => alinharImagem('center')} className="px-2 py-1 text-xs bg-gray-200 rounded hover:bg-gray-300" title="Centro">↔</button>
                    <button onClick={() => alinharImagem('right')} className="px-2 py-1 text-xs bg-gray-200 rounded hover:bg-gray-300" title="Direita">→</button>
                  </div>
                  <div className="w-px h-4 bg-blue-300" />
                  <button onClick={deletarImagem} className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600" title="Eliminar">🗑️</button>
                  <button onClick={() => setImagemSelecionada(null)} className="ml-auto text-xs text-gray-500 hover:text-gray-700">✕</button>
                </div>
              )}
              {/* Editor */}
              <div className="flex-1 overflow-y-auto bg-gray-50 min-h-0">
                <style>{`
                  .editor-wrapper { border: 1px dashed #e5e7eb; margin: 30px; border-radius: 6px; background: white; min-height: 1024px; }
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
                                  {e.tipo === 'enviado' ? `Para: ${e.para || e.de}` : (e.deNome || e.de)}
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
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">
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
                        className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded text-sm font-bold transition"
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

      {/* ========== MODAL ANTIGO (DESATIVADO) ========== */}
      {false && mostrarCompose && (
        <div className="absolute top-0 right-0 bottom-0 left-72 bg-white z-40 flex flex-col hidden">

            {/* LINHA 1 — Layout 2 colunas */}
            <div className="bg-gray-50 border-b border-gray-200 flex">

              {/* Coluna esquerda — só botão Enviar */}
              <div className="flex flex-col border-r border-gray-200 shrink-0">
                <button onClick={handleSend} disabled={enviando || !compose.para || !emailOrigem}
                  className="flex-1 bg-green-600 hover:bg-green-500 disabled:bg-green-600 disabled:cursor-not-allowed text-white font-bold px-6 text-sm flex flex-col items-center justify-center gap-1 shadow-sm min-w-[110px]">
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
                    {emailsOrigem.map(e => (
                      <option key={e.email} value={e.email} className="bg-white">
                        {e.nome} ({e.email}) {e.tipo === 'google' ? '📧' : e.tipo === 'hotmail' ? '📨' : '🌐'}
                      </option>
                    ))}
                  </select>
                  <button onClick={() => setMostrarPopupFechar(true)}
                    className="ml-2 w-8 h-full min-h-[32px] flex items-center justify-center bg-red-600 hover:bg-red-700 text-white font-bold text-sm shrink-0 transition-colors -mr-0 self-stretch">✕</button>
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
                          ? 'bg-blue-600 border-blue-500 text-white'
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
                      <span className="absolute top-8 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-20 pointer-events-none">{b.t}</span>
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
                <button onClick={() => setMostrarConfigAssinatura(true)}
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
                    className="mt-5 bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 rounded-lg text-sm font-bold">Fechar</button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col bg-white h-auto">
                {/* Toolbar de Imagem */}
                {imagemSelecionada && (
                  <div className="img-toolbar px-4 py-2 bg-blue-50 border-b border-blue-200 flex items-center gap-3">
                    <span className="text-xs font-semibold text-blue-700">📷 Imagem:</span>
                    <div className="flex gap-1">
                      <button onClick={() => resizeImagem('max')} className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">Máx</button>
                      <button onClick={() => resizeImagem('med')} className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600">Méd</button>
                      <button onClick={() => resizeImagem('peq')} className="px-2 py-1 text-xs bg-blue-400 text-white rounded hover:bg-blue-500">Peq</button>
                    </div>
                    <div className="w-px h-4 bg-blue-300" />
                    <div className="flex gap-1">
                      <button onClick={() => alinharImagem('left')} className="px-2 py-1 text-xs bg-gray-200 rounded hover:bg-gray-300" title="Esquerda">←</button>
                      <button onClick={() => alinharImagem('center')} className="px-2 py-1 text-xs bg-gray-200 rounded hover:bg-gray-300" title="Centro">↔</button>
                      <button onClick={() => alinharImagem('right')} className="px-2 py-1 text-xs bg-gray-200 rounded hover:bg-gray-300" title="Direita">→</button>
                    </div>
                    <div className="w-px h-4 bg-blue-300" />
                    <button onClick={deletarImagem} className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600" title="Eliminar">🗑️</button>
                    <button onClick={() => setImagemSelecionada(null)} className="ml-auto text-xs text-gray-500 hover:text-gray-700">✕</button>
                  </div>
                )}
                <div className="overflow-y-auto bg-gray-50" style={{ maxHeight: 'calc(100vh - 500px)' }}>
                  <style>{`
                    .editor-wrapper { border: 1px dashed #e5e7eb; margin: 20px 30px; border-radius: 6px; background: white; }
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
                  className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg">Inserir</button>
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
                }}
                  className="flex-1 bg-black/70 hover:bg-red-900 text-white font-bold py-2 rounded-lg text-xs transition-colors">
                  🗑️ Descartar
                </button>
                <button onClick={handleDraftSave}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2 rounded-lg text-xs transition-colors">
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
                  className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg">Inserir</button>
              </div>
            </div>
          </div>
        )
      }

      {
        mostrarConfigAssinatura && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60]">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden border border-gray-200">
              {/* Header macOS style */}
              <div className="bg-gray-50 px-5 py-3 flex items-center justify-between border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500 cursor-pointer" onClick={() => setMostrarConfigAssinatura(false)} />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-gray-300" />
                </div>
                <h2 className="text-sm font-bold text-gray-900">Assinaturas</h2>
                <button className="text-gray-600 hover:text-gray-900 text-xs px-3 py-1 rounded border border-gray-300 transition-colors">Mostrar Tudo</button>
              </div>

              <div className="p-6 space-y-5">
                {/* Editar assinatura */}
                <div>
                  <h3 className="text-sm font-bold text-gray-800 mb-3">Editar assinatura:</h3>
                  <div className="bg-white rounded-lg border border-gray-200 flex overflow-hidden" style={{ minHeight: '200px' }}>
                    {/* Lista */}
                    <div className="w-52 border-r border-gray-200 flex flex-col bg-gray-50/50">
                      <div className="px-3 py-2 bg-gray-100 border-b border-gray-200">
                        <p className="text-xs font-bold text-gray-500">Nome da assinatura</p>
                      </div>
                      <div className="flex-1">
                        {assinaturas.map((s, i) => (
                          <div key={i} onClick={() => setAssinaturaActiva(i)}
                            className={`px-3 py-2 cursor-pointer text-sm border-b border-gray-100 transition-colors ${assinaturaActiva === i ? 'bg-red-50 text-red-600 font-bold' : 'text-gray-600 hover:bg-gray-100'}`}>
                            {s.nome}
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center gap-1 p-2 border-t border-gray-200">
                        <button onClick={() => setAssinaturas([...assinaturas, { nome: 'Nova Assinatura', activa: false, texto: '', imagemUrl: '' }])}
                          className="bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs px-2 py-1 rounded font-bold transition-colors">+</button>
                        <button onClick={() => setAssinaturas(assinaturas.filter((_, i) => i !== assinaturaActiva))}
                          className="bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs px-2 py-1 rounded font-bold transition-colors">−</button>
                        <button onClick={() => { setMostrarConfigAssinatura(false); setMostrarEditarAssinatura(true) }}
                          className="ml-auto bg-white border border-gray-300 hover:bg-gray-50 text-gray-600 text-xs px-3 py-1 rounded transition-colors">Editar</button>
                      </div>
                    </div>
                    {/* Preview */}
                    <div className="flex-1 flex flex-col bg-white">
                      <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 text-center">
                        <p className="text-xs font-bold text-gray-500">Pré-visualização da Assinatura</p>
                      </div>
                      <div className="flex-1 bg-white p-4">
                        {assinaturas[assinaturaActiva]?.imagemUrl ? (
                          <img src={assinaturas[assinaturaActiva].imagemUrl} alt="Assinatura" className="max-w-full max-h-32 object-contain" />
                        ) : (
                          <div className="text-sm text-gray-700 whitespace-pre-wrap">{assinaturas[assinaturaActiva]?.texto || ''}</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Assinatura predefinida */}
                <div>
                  <h3 className="text-sm font-bold text-gray-800 mb-3">Selecionar assinatura predefinida:</h3>
                  <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 space-y-3">
                    {[
                      { label: 'Conta:', valor: 'Silva Chamo (silva.chamo@gmail.com)' },
                      { label: 'Novas mensagens:', valor: 'Nenhuma' },
                      { label: 'Respostas/reenc.:', valor: 'Nenhuma' },
                    ].map(({ label, valor }) => (
                      <div key={label} className="flex items-center gap-4">
                        <span className="text-gray-500 text-sm w-44 text-right shrink-0">{label}</span>
                        <select className="flex-1 bg-white border border-gray-300 text-gray-900 text-sm px-3 py-2 rounded-lg outline-none">
                          <option>{valor}</option>
                          {assinaturas.map(s => <option key={s.nome}>{s.nome}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <button onClick={() => { if (assinaturas[assinaturaActiva]) setAssinatura(assinaturas[assinaturaActiva].texto); setMostrarConfigAssinatura(false) }}
                    className="bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 rounded-lg text-sm font-bold transition-colors">Guardar</button>
                  <button onClick={() => setMostrarConfigAssinatura(false)}
                    className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-2.5 rounded-lg text-sm font-bold transition-colors">Cancelar</button>
                </div>
              </div>
            </div>
          </div>
        )
      }
      {
        mostrarEditarAssinatura && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60]">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl mx-4 h-[85vh] flex flex-col overflow-hidden border border-gray-200">
              {/* Header macOS style com título da assinatura */}
              <div className="bg-gray-50 px-5 py-2 flex items-center gap-3 border-b border-gray-200">
                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-3 h-3 rounded-full bg-red-500 cursor-pointer" onClick={() => { setMostrarEditarAssinatura(false); setMostrarConfigAssinatura(true) }} />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                </div>
                {/* Toolbar */}
                <div className="flex items-center gap-1 flex-wrap ml-2">
                  <button title="Colar" className="bg-white hover:bg-gray-50 text-gray-700 text-xs px-3 py-1.5 rounded border border-gray-200 flex items-center gap-1 transition-colors">📋 Colar</button>
                  <div className="w-px h-5 bg-gray-200 mx-1" />
                  <select className="bg-white border border-gray-200 text-gray-900 text-xs px-2 py-1.5 rounded outline-none">
                    <option>Calibri</option><option>Arial</option><option>Times New Roman</option>
                  </select>
                  <select className="bg-white border border-gray-200 text-gray-900 text-xs px-2 py-1.5 rounded w-14 outline-none">
                    <option>11</option><option>12</option><option>14</option><option>16</option>
                  </select>
                  <div className="w-px h-5 bg-gray-200 mx-1" />
                  {[{ l: 'N', t: 'Negrito' }, { l: 'I', t: 'Itálico' }, { l: 'S', t: 'Sublinhado' }, { l: 'ab', t: 'Riscado' }].map((b, i) => (
                    <button key={i} title={b.t} className="text-gray-700 text-xs px-2 py-1.5 rounded hover:bg-gray-50 border border-gray-200 transition-colors font-bold">{b.l}</button>
                  ))}
                  <div className="w-px h-5 bg-gray-200 mx-1" />
                  {[{ l: <><ImageIcon className="w-3.5 h-3.5 text-gray-600" /> <span className="text-gray-700 text-[10px] font-medium">Imagens</span></>, t: 'Imagens' }, { l: '🔗 Ligação', t: 'Ligação' }, { l: '⊞ Tabela', t: 'Tabela' }, { l: '🌙 Mudar Fundo', t: 'Mudar Fundo' }].map((b, i) => (
                    <button key={i} title={b.t} className="text-gray-700 text-xs px-2 py-1.5 rounded hover:bg-gray-50 border border-gray-200 transition-colors">{b.l}</button>
                  ))}
                </div>
                <span className="ml-auto text-gray-900 text-sm font-bold">{assinaturas[assinaturaActiva]?.nome}</span>
              </div>

              {/* Nome da assinatura */}
              <div className="bg-gray-50 flex items-center border-b border-gray-200 px-5 py-2">
                <span className="text-gray-500 text-sm w-40 shrink-0">Nome da Assinatura:</span>
                <input value={assinaturas[assinaturaActiva]?.nome || ''}
                  onChange={e => { const a = [...assinaturas]; a[assinaturaActiva].nome = e.target.value; setAssinaturas(a) }}
                  className="flex-1 bg-white border border-gray-300 text-gray-900 text-sm px-3 py-1.5 rounded outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400" />
              </div>

              {/* Área de edição — fundo branco */}
              <div className="flex-1 flex flex-col bg-white overflow-hidden">
                <textarea
                  value={assinaturas[assinaturaActiva]?.texto || ''}
                  onChange={e => { const a = [...assinaturas]; a[assinaturaActiva].texto = e.target.value; setAssinaturas(a) }}
                  className="flex-1 p-6 text-sm text-gray-800 outline-none resize-none"
                  placeholder="Escreve aqui a tua assinatura...&#10;&#10;Ex:&#10;Silva Chamo&#10;DR. GERAL — Portal Digital&#10;+258 82 52 88 318&#10;silva.chamo@your-domain.com&#10;https://your-domain.com" />

                {/* Imagem da assinatura */}
                {assinaturas[assinaturaActiva]?.imagemUrl && (
                  <div className="px-6 py-3 border-t border-gray-200">
                    <img src={assinaturas[assinaturaActiva].imagemUrl} alt="Assinatura" className="max-h-32 object-contain" />
                  </div>
                )}

                {/* Upload / URL imagem */}
                <div className="border-t border-gray-200 px-5 py-3 bg-gray-50 flex items-center gap-3 flex-wrap">
                  <span className="text-xs text-gray-600 font-medium">Imagem da assinatura:</span>
                  <input type="file" accept="image/*"
                    onChange={e => {
                      const file = e.target.files?.[0]
                      if (file) {
                        const reader = new FileReader()
                        reader.onload = ev => { const a = [...assinaturas]; a[assinaturaActiva].imagemUrl = ev.target?.result as string; setAssinaturas(a) }
                        reader.readAsDataURL(file)
                      }
                    }}
                    className="text-xs text-gray-600 file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:bg-gray-800 file:text-white hover:file:bg-gray-700 cursor-pointer" />
                  <span className="text-xs text-gray-400">ou URL:</span>
                  <input placeholder="https://url-da-imagem.png"
                    onChange={e => { const a = [...assinaturas]; a[assinaturaActiva].imagemUrl = e.target.value; setAssinaturas(a) }}
                    className="flex-1 min-w-40 text-xs border border-gray-300 rounded px-2 py-1.5 outline-none" />
                  {assinaturas[assinaturaActiva]?.imagemUrl && (
                    <button onClick={() => { const a = [...assinaturas]; a[assinaturaActiva].imagemUrl = ''; setAssinaturas(a) }}
                      className="text-xs text-red-500 hover:text-red-700 font-bold">✕ Remover</button>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="bg-gray-50 border-t border-gray-200 px-5 py-3 flex justify-end gap-3">
                <button onClick={() => { setAssinatura(assinaturas[assinaturaActiva]?.texto || ''); setMostrarEditarAssinatura(false); setMostrarConfigAssinatura(true) }}
                  className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg text-sm font-bold transition-colors shadow-sm">Guardar</button>
                <button onClick={() => { setMostrarEditarAssinatura(false); setMostrarConfigAssinatura(true) }}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-2 rounded-lg text-sm font-bold transition-colors">Cancelar</button>
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
                    className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-2 rounded-md text-sm font-bold transition-colors">
                    + Adicionar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {
        mostrarAdicionarConta && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[70]">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden border border-gray-200">

              {/* Header macOS */}
              <div className="bg-gray-50 px-5 py-3 flex items-center gap-3 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500 cursor-pointer" onClick={() => setMostrarAdicionarConta(false)} />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-gray-300" />
                </div>
                {modalAdicionarPasso !== 'escolher' && (
                  <button onClick={() => setModalAdicionarPasso('escolher')}
                    className="text-gray-500 hover:text-gray-900 text-xs">← Voltar</button>
                )}
                <h2 className="text-sm font-bold text-gray-800 mx-auto">Contas da Internet</h2>
              </div>

              {/* PASSO 1 — Escolher tipo */}
              {modalAdicionarPasso === 'escolher' && (
                <div className="flex">
                  {/* Lista esquerda — contas existentes */}
                  <div className="w-56 border-r border-gray-200 p-3 space-y-1 min-h-64 bg-gray-50/50">
                    <p className="text-xs text-gray-500 uppercase font-bold mb-2 px-2">Contas configuradas</p>
                    {emailsOrigem.length === 0 ? (
                      <p className="text-xs text-gray-400 px-2 italic">Nenhuma conta</p>
                    ) : emailsOrigem.map((c, i) => (
                      <div key={i} className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-white border border-transparent hover:border-gray-200 cursor-pointer transition-colors shadow-sm-hover">
                        <div className="w-7 h-7 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">
                          {c.tipo === 'google' ? 'G' : c.tipo === 'hotmail' ? 'M' : '@'}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-800">{c.nome}</p>
                          <p className="text-[10px] text-gray-500 truncate max-w-[130px]">{c.email}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Direita — escolher tipo */}
                  <div className="flex-1 p-6 bg-white">
                    <p className="text-sm text-gray-500 mb-6 font-medium">Escolhe o tipo de conta a adicionar:</p>
                    <div className="space-y-3">
                      {/* Google */}
                      <button onClick={() => setModalAdicionarPasso('google')}
                        className="w-full flex items-center gap-4 px-4 py-3 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all text-left group">
                        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-xl font-bold shrink-0 border border-gray-100 shadow-sm group-hover:scale-110 transition-transform">
                          <span style={{ background: 'linear-gradient(135deg, #4285F4, #34A853, #FBBC05, #EA4335)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>G</span>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-800">Google</p>
                          <p className="text-xs text-gray-500">Gmail, Google Workspace</p>
                        </div>
                      </button>

                      {/* Hotmail */}
                      <button onClick={() => setModalAdicionarPasso('hotmail')}
                        className="w-full flex items-center gap-4 px-4 py-3 rounded-lg border border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-all text-left group">
                        <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center shrink-0 border border-blue-400 shadow-sm group-hover:scale-110 transition-transform">
                          <span className="text-white font-bold text-sm">M</span>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-800">Microsoft Exchange</p>
                          <p className="text-xs text-gray-500">Outlook, Hotmail, MSN</p>
                        </div>
                      </button>

                      {/* Webmail / Email executivo */}
                      <button onClick={() => setModalAdicionarPasso('webmail')}
                        className="w-full flex items-center gap-4 px-4 py-3 rounded-lg border border-gray-200 hover:border-red-400 hover:bg-red-50 transition-all text-left group">
                        <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center shrink-0 border border-red-400 shadow-sm group-hover:scale-110 transition-transform">
                          <span className="text-white font-bold text-sm">@</span>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-800">Email Executivo</p>
                          <p className="text-xs text-gray-500">Webmail, IMAP/SMTP personalizado</p>
                        </div>
                      </button>

                      <div className="border-t border-gray-200 pt-3">
                        <button className="w-full text-center text-xs text-gray-500 hover:text-gray-900 py-2 transition-colors">
                          Adicionar outra conta...
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* PASSO 2a — Google OAuth */}
              {modalAdicionarPasso === 'google' && (
                <div className="p-8 flex flex-col items-center text-center bg-white">
                  <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-4 border border-blue-100">
                    <span className="text-3xl">@</span>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">Autenticação Google</h3>
                  <p className="text-sm text-gray-500 mb-6 max-w-sm">
                    O Google requer que a autenticação seja concluída no navegador da web. Após a autenticação, a conta será adicionada automaticamente.
                  </p>
                  <div className="flex gap-3">
                    <button onClick={() => setModalAdicionarPasso('escolher')}
                      className="px-6 py-2.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-bold transition-colors">
                      Cancelar
                    </button>
                    <button onClick={() => {
                      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
                      window.open(`${supabaseUrl}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(window.location.origin + '/auth/callback')}`, '_blank')
                      // Após autenticação, simula adição da conta Google
                      setTimeout(() => {
                        const novasConta = { email: 'silva.chamo@gmail.com', tipo: 'google' as const, nome: 'Silva Chamo' }
                        setEmailsOrigem(prev => [...prev.filter(e => e.email !== novasConta.email), novasConta])
                        setMostrarAdicionarConta(false)
                      }, 2000)
                    }} className="px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors shadow-lg shadow-blue-200">
                      Abrir no Navegador
                    </button>
                  </div>
                </div>
              )}

              {/* PASSO 2b — Microsoft/Hotmail */}
              {modalAdicionarPasso === 'hotmail' && (
                <div className="p-6 space-y-4 bg-white">
                  <p className="text-sm text-gray-500 mb-2 font-medium">Configurar conta Microsoft</p>
                  {[
                    { label: 'Endereço de e-mail', field: 'email', placeholder: 'nome@hotmail.com' },
                    { label: 'Nome de utilizador', field: 'nome', placeholder: 'Automático' },
                    { label: 'Palavra-passe', field: 'password', placeholder: '••••••••', type: 'password' },
                  ].map(f => (
                    <div key={f.field} className="flex items-center gap-4">
                      <span className="text-gray-500 text-sm w-44 text-right shrink-0">{f.label}:</span>
                      <input type={f.type || 'text'} placeholder={f.placeholder}
                        value={(novaContaForm as any)[f.field]}
                        onChange={e => setNovaContaForm({ ...novaContaForm, [f.field]: e.target.value })}
                        className="flex-1 bg-white border border-gray-300 text-gray-900 text-sm px-3 py-2 rounded-lg outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400 transition-all" />
                    </div>
                  ))}
                  <div className="flex items-center gap-4">
                    <span className="text-gray-500 text-sm w-44 text-right shrink-0">Tipo de conta:</span>
                    <select className="flex-1 bg-white border border-gray-300 text-gray-900 text-sm px-3 py-2 rounded-lg outline-none">
                      <option>IMAP</option><option>POP3</option><option>Exchange</option>
                    </select>
                  </div>
                  <p className="text-xs text-red-500 text-center">Não foi possível confirmar automaticamente — preenche os servidores manualmente.</p>
                  <div className="flex justify-between pt-2">
                    <button onClick={() => setModalAdicionarPasso('escolher')}
                      className="px-5 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-bold transition-colors">Anterior</button>
                    <button onClick={() => {
                      if (novaContaForm.email) {
                        setEmailsOrigem(prev => [...prev, { email: novaContaForm.email, tipo: 'hotmail', nome: novaContaForm.nome || novaContaForm.email.split('@')[0] }])
                        setEmailOrigem(novaContaForm.email)
                        setMostrarAdicionarConta(false)
                        setNovaContaForm({ nome: '', email: '', password: '', servidor: '', porta: '993', smtp: '', smtpPorta: '465', assinatura: '' })
                      }
                    }}
                      disabled={!novaContaForm.email}
                      className="px-5 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-bold">Iniciar sessão</button>
                  </div>
                </div>
              )}

              {/* PASSO 2c — Email Executivo / Webmail */}
              {modalAdicionarPasso === 'webmail' && (
                <div className="p-6 space-y-3 bg-white">
                  <div className="space-y-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-gray-500 ml-1">Endereço de e-mail</label>
                      <div className="relative">
                        <input type="email" placeholder="nome@empresa.com"
                          value={novaContaForm.email}
                          onChange={e => setNovaContaForm({ ...novaContaForm, [ 'email']: e.target.value })}
                          className="w-full bg-white border border-gray-300 text-gray-900 text-sm px-4 py-2.5 rounded-xl outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400 transition-all font-medium" />
                        {autoconfigurando && (
                          <div className="absolute right-3 top-2.5">
                            <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                          </div>
                        )}
                        {!autoconfigurando && novaContaForm.servidor && (
                          <div className="absolute right-3 top-2.5 text-green-500 flex items-center gap-1.5 bg-green-50 px-2 py-0.5 rounded-full border border-green-100">
                            <span className="text-[10px] font-bold uppercase tracking-wider">Autoconfigurado</span>
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-gray-500 ml-1">Nome de Exibição</label>
                        <input type="text" placeholder="Silva Chamo"
                          value={novaContaForm.nome}
                          onChange={e => setNovaContaForm({ ...novaContaForm, [ 'nome']: e.target.value })}
                          className="w-full bg-white border border-gray-300 text-gray-900 text-sm px-4 py-2.5 rounded-xl outline-none focus:border-red-400 font-medium" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-gray-500 ml-1">Palavra-passe</label>
                        <input type="password" placeholder="••••••••"
                          value={novaContaForm.password}
                          onChange={e => setNovaContaForm({ ...novaContaForm, [ 'password']: e.target.value })}
                          className="w-full bg-white border border-gray-300 text-gray-900 text-sm px-4 py-2.5 rounded-xl outline-none focus:border-red-400 font-medium" />
                      </div>
                    </div>

                    <div className="pt-2">
                       <button onClick={() => setMostrarAvancado(!mostrarAvancado)}
                        className="text-[11px] font-bold text-gray-400 hover:text-red-500 flex items-center gap-1 transition-colors uppercase tracking-widest">
                        {mostrarAvancado ? '↓ Ocultar Definições Técnicas' : '↑ Configurações Avançadas (IMAP/SMTP)'}
                      </button>

                      {mostrarAvancado && (
                        <div className="mt-3 p-4 bg-gray-50 rounded-xl border border-gray-200 grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                          {[
                            { label: 'Servidor IMAP', field: 'servidor' },
                            { label: 'Porta IMAP', field: 'porta' },
                            { label: 'Servidor SMTP', field: 'smtp' },
                            { label: 'Porta SMTP', field: 'smtpPorta' }
                          ].map(f => (
                            <div key={f.field} className="flex flex-col gap-1">
                              <label className="text-[10px] font-bold text-gray-400 uppercase">{f.label}</label>
                              <input type="text"
                                value={(novaContaForm as any)[f.field]}
                                onChange={e => setNovaContaForm({ ...novaContaForm, [f.field]: e.target.value })}
                                className="w-full bg-white border border-gray-200 text-gray-700 text-xs px-3 py-1.5 rounded-lg outline-none focus:border-red-300" />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="bg-blue-50 border-l-4 border-blue-400 rounded-lg p-3 mt-2">
                      <p className="text-[11px] text-blue-700 font-bold mb-1 uppercase tracking-tight">Suporte VisualDesigne:</p>
                      <p className="text-[11px] text-blue-600 leading-relaxed">Detectamos automaticamente as configurações de domínio para garantir um setup sem erros. Webmail e App prontos a usar após clicar em adicionar.</p>
                    </div>
                  </div>
                  <div className="flex justify-between pt-2">
                    <button onClick={() => setModalAdicionarPasso('escolher')}
                      className="px-5 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-bold transition-colors">Anterior</button>
                    <button onClick={async () => {
                      if (novaContaForm.email) {
                        setCarregandoEmails(true)
                        try {
                          const res = await fetch('/api/email-contas', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              email: novaContaForm.email,
                              password: novaContaForm.password,
                              nome: novaContaForm.nome,
                              tipo: 'webmail'
                            })
                          })
                          const data = await res.json()
                          if (data.success) {
                            // Mostra credenciais prontas
                            setCredenciaisNovas(data.credenciais)
                            setMostrarCredenciais(true)
                            // Adiciona à lista de contas
                            setEmailsOrigem(prev => [...prev, {
                              email: data.credenciais.email,
                              tipo: 'webmail',
                              nome: novaContaForm.nome || novaContaForm.email.split('@')[0],
                              password: novaContaForm.password
                            }])
                            setEmailOrigem(data.credenciais.email)
                            setEmailOrigemPassword(novaContaForm.password)
                            
                            // Forçar refresh conforme solicitado pelo utilizador
                            setTimeout(() => {
                              window.location.reload()
                            }, 1500)
                          }
                        } catch (error: any) {
                          alert('Erro ao criar conta: ' + error.message)
                        }
                        setCarregandoEmails(false)
                        setMostrarAdicionarConta(false)
                        setNovaContaForm({ nome: '', email: '', password: '', servidor: '', porta: '993', smtp: '', smtpPorta: '465', assinatura: '' })
                      }
                    }}
                      disabled={!novaContaForm.email || carregandoEmails}
                      className="px-5 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-bold flex items-center gap-2 transition-all shadow-md shadow-red-100">
                      {carregandoEmails ? '⏳ A sincronizar...' : 'Adicionar e Sincronizar'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      }
    </div>
  )
}

// Componente SuporteSection