'use client'

import { useState, useEffect, useRef } from 'react'

import { 
  Home, Globe, Users, Mail, Shield, Database, Settings, 
  ChevronLeft, ChevronRight, Plus, Search, Download, ExternalLink,
  Edit2, Pause, Play, Trash2, RefreshCw, LogOut, Package, Server, Lock, LockOpen, Edit, Power, FolderOpen, FileText, Archive, Globe as GlobeIcon, ChevronRight as ChevronRightIcon, Image as ImageIcon
} from 'lucide-react'
import { CpanelDashboard } from '../admin/CpanelDashboard'
import {
  SubdomainsSection, DatabasesSection, FTPSection, EmailManagementSection,
  CPUsersSection, SSLSection, SecuritySection, PHPConfigSection,
  APIConfigSection, GitDeploySection, WPListSection, WPPluginsSection,
  ResellerSection, ModifyWebsiteSection, SuspendWebsiteSection,
  DeleteWebsiteSection, DNSNameserverSection, DNSDefaultNSSection,
  DNSCreateZoneSection, DNSDeleteZoneSection, CloudFlareSection,
  DNSResetSection, EmailDeleteSection, EmailLimitsSection,
  EmailForwardingSection, CatchAllEmailSection, PatternForwardingSection,
  PlusAddressingSection, EmailChangePasswordSection, DKIMManagerSection,
  WPRestoreBackupSection, WPRemoteBackupSection, ListSubdomainsSection,
  PackagesSection, DNSZoneEditorSection, FileManagerSection, BackupManagerSection,
  WordPressInstallSection, WPBackupSection, DomainManagerSection, DeploySection
  // ClientesSection // Removido - não usado no painel do cliente
} from '../admin/CyberPanelSections'
import { cyberPanelAPI } from '@/lib/cyberpanel-api'
import { supabase as createClientInstance } from '@/lib/supabase'
import type { CyberPanelWebsite, CyberPanelUser, CyberPanelPackage } from '@/lib/cyberpanel-api'

const CORES_PALETA = [
  '#000000','#434343','#666666','#999999','#b7b7b7','#cccccc','#d9d9d9','#ffffff',
  '#ff0000','#ff4500','#ff9900','#ffff00','#00ff00','#00ffff','#4a86e8','#0000ff',
  '#9900ff','#ff00ff','#e6b8a2','#f4cccc','#fce5cd','#fff2cc','#d9ead3','#d0e0e3',
  '#c9daf8','#cfe2f3','#d9d2e9','#ead1dc','#cc0000','#e69138','#f1c232','#6aa84f',
  '#45818e','#3c78d8','#3d85c6','#674ea7','#a64d79','#85200c','#783f04','#7f6000',
]

// Componente ClienteDashboardHome
function ClienteDashboardHome() {
  const cliente = {
    nome: 'João Silva', email: 'joao@aamihe.com', telefone: '+258 84 123 4567',
    empresa: 'Aamihe', morada: 'Av. Principal, 123', cidade: 'Maputo', pais: 'Moçambique',
    dominio: 'aamihe.com', plano: 'Premium', dataRenovacao: '21/10/2026',
    valorAnual: 1500, ssl: true, estado: 'active', creditoDisponivel: 1282
  }

  const hoje = new Date()
  const renovacao = new Date('2026-10-21')
  const diasRestantes = Math.ceil((renovacao.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))

  return (
    <div className="flex gap-6">
      {/* Conteúdo principal */}
      <div className="flex-1 space-y-6">
        
        {/* Saudação */}
        <div>
          <p className="text-gray-500 text-sm">Bom dia, <strong className="text-gray-900">{cliente.nome}</strong> — aqui está o que está a acontecer hoje.</p>
        </div>

        {/* 4 Cards de resumo */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-start gap-4">
            <div className="bg-blue-100 rounded-lg p-3"><Globe className="w-6 h-6 text-blue-600" /></div>
            <div>
              <p className="text-sm text-gray-500">Serviços Activos</p>
              <p className="text-2xl font-bold text-gray-900">1</p>
              <p className="text-xs text-gray-400 mt-0.5">{cliente.dominio}</p>
              <button className="text-xs text-blue-600 hover:underline mt-1">Ver serviços</button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-start gap-4">
            <div className="bg-green-100 rounded-lg p-3"><Globe className="w-6 h-6 text-green-600" /></div>
            <div>
              <p className="text-sm text-gray-500">Domínios Activos</p>
              <p className="text-2xl font-bold text-gray-900">1</p>
              <p className="text-xs text-gray-400 mt-0.5">Expira: {cliente.dataRenovacao}</p>
              <button className="text-xs text-blue-600 hover:underline mt-1">Ver domínios</button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-start gap-4">
            <div className={`rounded-lg p-3 ${diasRestantes < 30 ? 'bg-red-100' : 'bg-yellow-100'}`}>
              <FileText className={`w-6 h-6 ${diasRestantes < 30 ? 'text-red-600' : 'text-yellow-600'}`} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Próxima Renovação</p>
              <p className={`text-2xl font-bold ${diasRestantes < 30 ? 'text-red-600' : 'text-gray-900'}`}>{diasRestantes} dias</p>
              <p className="text-xs text-gray-400 mt-0.5">{cliente.dataRenovacao} • {new Intl.NumberFormat('pt-MZ').format(cliente.valorAnual)} MZN</p>
              <button className="text-xs text-blue-600 hover:underline mt-1">Ver faturas</button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-start gap-4">
            <div className="bg-purple-100 rounded-lg p-3"><Mail className="w-6 h-6 text-purple-600" /></div>
            <div>
              <p className="text-sm text-gray-500">Faturas Não Pagas</p>
              <p className="text-2xl font-bold text-gray-900">0</p>
              <p className="text-xs text-gray-400 mt-0.5">Conta em dia ✓</p>
              <button className="text-xs text-blue-600 hover:underline mt-1">Ver faturas</button>
            </div>
          </div>
        </div>

        {/* Serviços a renovar em breve */}
        {diasRestantes < 60 && (
          <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-yellow-800">⚠️ Serviços a renovar em breve</h2>
              <button className="bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-bold px-4 py-1.5 rounded-lg transition-colors">Renovar Agora</button>
            </div>
            <p className="text-xs text-yellow-700">O teu serviço <strong>{cliente.dominio}</strong> renova em <strong>{cliente.dataRenovacao}</strong> ({diasRestantes} dias). Renova agora para evitar interrupções.</p>
          </div>
        )}

        {/* Tickets recentes */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h2 className="text-sm font-bold text-gray-700">Tickets de Suporte</h2>
            <button className="text-xs text-red-600 hover:underline font-bold">+ Abrir Ticket</button>
          </div>
          <div className="p-5 text-center text-gray-400 text-sm">0 tickets abertos</div>
        </div>

      </div>

      {/* Barra lateral direita */}
      <div className="w-64 shrink-0 space-y-4">

        {/* Card do cliente */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          {/* Avatar */}
          <div className="flex flex-col items-center mb-4">
            <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center mb-2">
              <span className="text-white text-xl font-bold">
                {cliente.nome.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
              </span>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${cliente.estado === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {cliente.estado === 'active' ? 'Activo' : 'Suspenso'}
            </span>
          </div>
          {/* Dados */}
          <div className="space-y-1.5 text-sm border-t border-gray-100 pt-4">
            <p className="font-bold text-gray-900 text-center">{cliente.empresa}</p>
            <p className="text-gray-600 text-center text-xs">{cliente.nome}</p>
            <p className="text-gray-500 text-xs text-center">{cliente.morada}</p>
            <p className="text-gray-500 text-xs text-center">{cliente.cidade}</p>
            <p className="text-gray-500 text-xs text-center">{cliente.pais}</p>
          </div>
        </div>

        {/* Crédito disponível */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-gray-500 uppercase">Crédito Disponível</p>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </div>
          <p className="text-sm text-gray-600">Tens um saldo de <strong className="text-gray-900">MT {new Intl.NumberFormat('pt-MZ').format(cliente.creditoDisponivel)}</strong> que será aplicado às próximas faturas.</p>
          <button className="w-full mt-3 bg-red-600 hover:bg-red-700 text-white text-xs font-bold py-2 rounded-lg transition-colors">Adicionar Fundos</button>
        </div>

        {/* Contactos */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-gray-500 uppercase">Contactos</p>
          </div>
          <p className="text-xs text-gray-400 mb-3">Nenhum contacto adicional.</p>
          <button className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold py-2 rounded-lg transition-colors">+ Novo Contacto</button>
        </div>

      </div>
    </div>
  )
}


// Componente EmailWebmailSection
function EmailWebmailSection({ 
  mostrarAdicionarConta: propMostrarAdicionarConta,
  setMostrarAdicionarConta: propSetMostrarAdicionarConta,
  modalAdicionarPasso: propModalAdicionarPasso,
  setModalAdicionarPasso: propSetModalAdicionarPasso
}: {
  mostrarAdicionarConta?: boolean
  setMostrarAdicionarConta?: (value: boolean) => void
  modalAdicionarPasso?: 'escolher'|'webmail'|'google'|'hotmail'
  setModalAdicionarPasso?: (value: 'escolher'|'webmail'|'google'|'hotmail') => void
}) {
  const [pastaActiva, setPastaActiva] = useState('Caixa de Entrada')
  const [emails, setEmails] = useState<any[]>([])
  const [modalEmail, setModalEmail] = useState<any>(null)
  const [modoResposta, setModoResposta] = useState<'none'|'reply'|'forward'>('none')
  const [compose, setCompose] = useState({ para: '', cc: '', bcc: '', assunto: '', corpo: '' })
  const [mostrarCompose, setMostrarCompose] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [assinatura, setAssinatura] = useState('')
  const [mostrarConfigAssinatura, setMostrarConfigAssinatura] = useState(false)
  const [contactos, setContactos] = useState([
    { nome: 'Silva Chamo', email: 'silva.chamo@gmail.com' },
    { nome: 'Suporte VisualDesign', email: 'suport@visualdesigne.com' },
  ])
  const [mostrarConfigContactos, setMostrarConfigContactos] = useState(false)
  const [novoContacto, setNovoContacto] = useState({ nome: '', email: '' })
  const [emailsOrigem, setEmailsOrigem] = useState<{email: string, tipo: string, nome: string, password?: string}[]>([])
  const [emailOrigem, setEmailOrigem] = useState('')
  const [emailOrigemPassword, setEmailOrigemPassword] = useState('')
  const [carregandoEmails, setCarregandoEmails] = useState(false)
  const [erroEmail, setErroEmail] = useState('')
  const editorRef = useRef<HTMLDivElement>(null)
  const [credenciaisNovas, setCredenciaisNovas] = useState<any>(null)
  const [mostrarCredenciais, setMostrarCredenciais] = useState(false)
  const [novaContaForm, setNovaContaForm] = useState({ nome: '', email: '', password: '', servidor: '', porta: '993', smtp: '', smtpPorta: '465' })
  const [corTexto, setCorTexto] = useState('#000000')
  const [corFundo, setCorFundo] = useState('#ffff00')
  const [mostrarPaletaCor, setMostrarPaletaCor] = useState<'texto' | 'fundo' | null>(null)
  const [anexos, setAnexos] = useState<File[]>([])
  const [mostrarPopupLink, setMostrarPopupLink] = useState(false)
  const [urlLinkTemp, setUrlLinkTemp] = useState('')
  const [rangeLink, setRangeLink] = useState<Range | null>(null)
  const [mostrarPopupFechar, setMostrarPopupFechar] = useState(false)

  // Usar props ou valores locais
  const mostrarAdicionarConta = propMostrarAdicionarConta || false
  const setMostrarAdicionarConta = propSetMostrarAdicionarConta || (() => {})
  const modalAdicionarPasso = propModalAdicionarPasso || 'escolher'
  const setModalAdicionarPasso = propSetModalAdicionarPasso || (() => {})

  // Carregar contas reais do Supabase
  useEffect(() => {
    const carregarContas = async () => {
      try {
        const res = await fetch('/api/email-contas?cliente_id=demo')
        const data = await res.json()
        if (data.success && data.contas.length > 0) {
          setEmailsOrigem(data.contas.map((c: any) => ({
            email: c.email, tipo: c.tipo_conta, nome: c.nome_conta, password: ''
          })))
        } else {
          // Fallback: carregar do CyberPanel
          const res2 = await fetch('/api/cyberpanel-email?domain=visualdesigne.com')
          const data2 = await res2.json()
          if (data2.success && data2.emails) {
            setEmailsOrigem(data2.emails.map((e: any) => ({
              email: e.email, tipo: 'webmail', nome: e.email.split('@')[0], password: ''
            })))
          }
        }
      } catch {}
    }
    carregarContas()
  }, [])

  // Carregar emails da pasta activa
  useEffect(() => {
    if (!emailOrigem || !emailOrigemPassword) return
    const carregar = async () => {
      setCarregandoEmails(true)
      setErroEmail('')
      try {
        const res = await fetch('/api/read-emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: emailOrigem, password: emailOrigemPassword, folder: pastaParaIMAP(pastaActiva) })
        })
        const data = await res.json()
        if (data.success) setEmails(data.emails)
        else setErroEmail(data.error)
      } catch (e: any) { setErroEmail(e.message) }
      setCarregandoEmails(false)
    }
    carregar()
  }, [pastaActiva, emailOrigem, emailOrigemPassword])

  const pastaParaIMAP = (pasta: string) => {
    const mapa: Record<string, string> = {
      'Caixa de Entrada': 'INBOX',
      'Enviados': 'Sent',
      'Rascunhos': 'Drafts',
      'Arquivo': 'Archive',
      'Lixo': 'Trash',
      'Spam': 'Junk'
    }
    return mapa[pasta] || 'INBOX'
  }

  const [mostrarCc, setMostrarCc] = useState(false)
  const [mostrarBcc, setMostrarBcc] = useState(false)
  const [mostrarEditarAssinatura, setMostrarEditarAssinatura] = useState(false)
  const [assinaturas, setAssinaturas] = useState([
    { nome: 'VisualDESIGN', activa: true, texto: '', imagemUrl: '' },
    { nome: 'ProVisual Corporate', activa: false, texto: '', imagemUrl: '' },
    { nome: 'Sem Título', activa: false, texto: '', imagemUrl: '' },
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
        }
      }, 50)
    }
    reader.readAsDataURL(file)
  }
  input.click()
}

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

const inserirTabela = () => {
  const table = document.createElement('table')
  table.style.cssText = 'border-collapse:collapse;width:100%;margin:8px 0'
  for (let r = 0; r < 3; r++) {
    const tr = table.insertRow()
    for (let c = 0; c < 3; c++) {
      const td = tr.insertCell()
      td.style.cssText = 'border:1px solid #9ca3af;padding:8px;min-width:60px'
      td.innerHTML = '&nbsp;'
    }
  }
  const br = document.createElement('br')
  editorRef.current?.appendChild(table)
  editorRef.current?.appendChild(br)
}

  const handleCloseModal = () => { setModalEmail(null); setModoResposta('none'); setCompose({ para: '', cc: '', bcc: '', assunto: '', corpo: '' }); setEnviado(false); setAnexos([]) }

  const handleSend = async () => {
    if (!emailOrigem || !emailOrigemPassword) {
      alert('Selecciona uma conta de email e introduz a password')
      return
    }
    setEnviando(true)
    try {
      const htmlCorpo = editorRef.current?.innerHTML || ''
      const htmlFinal = assinatura ? `${htmlCorpo}<br/><br/>--<br/>${assinatura.replace(/\n/g, '<br/>')}` : htmlCorpo

      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: emailOrigem,
          fromPassword: emailOrigemPassword,
          to: compose.para,
          cc: compose.cc,
          bcc: compose.bcc,
          subject: compose.assunto,
          html: htmlFinal
        })
      })
      const data = await res.json()
      if (data.success) setEnviado(true)
      else alert('Erro ao enviar: ' + data.error)
    } catch (e: any) {
      alert('Erro: ' + e.message)
    }
    setEnviando(false)
  }

  const pastas = ['Caixa de Entrada','Enviados','Rascunhos','Arquivo','Lixo','Spam']

  const botoesFormato = [
    { l: 'N', t: 'Negrito' }, { l: 'I', t: 'Itálico' }, { l: 'S', t: 'Sublinhado' },
    { l: 'ab', t: 'Riscado' }, { l: 'x₂', t: 'Subscrito' }, { l: 'x²', t: 'Superscrito' },
  ]

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] -mx-6 -mt-6">

      {/* TOOLBAR PRINCIPAL */}
      <div className="bg-gray-900 px-4 py-2 flex items-center gap-2 flex-wrap border-b border-gray-800">
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
  ✏️ Escrever
</button>
<a href="https://webmail.visualdesigne.com" target="_blank"
  className="bg-gray-600 hover:bg-red-600 text-white px-4 py-1.5 rounded-md text-sm font-bold flex items-center gap-2 transition-colors">
  🌐 Webmail
</a>
        <div className="w-px h-5 bg-gray-700 mx-1" />
        {pastas.map(p => (
          <button key={p} onClick={() => setPastaActiva(p)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${pastaActiva === p ? 'text-red-500 bg-transparent' : 'text-gray-400 hover:text-red-500 bg-transparent'}`}>
            {p}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setMostrarConfigAssinatura(true)}
  className="text-gray-300 hover:text-red-500 text-sm px-4 py-1.5 rounded-md border border-gray-600 hover:border-red-500 transition-colors flex items-center gap-2">
  ✍️ Assinatura
</button>
<button onClick={() => setMostrarConfigContactos(true)}
  className="text-gray-300 hover:text-red-500 text-sm px-4 py-1.5 rounded-md border border-gray-600 hover:border-red-500 transition-colors flex items-center gap-2">
  👥 Contactos
</button>
        </div>
      </div>

      {/* LISTA DE EMAILS */}
      <div className="flex-1 flex overflow-hidden bg-white">
        <div className="w-72 shrink-0 border-r border-gray-200 bg-gray-50 flex flex-col overflow-y-auto">
          <div className="px-3 py-2 border-b border-gray-200"><p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Contas</p></div>
          {emailsOrigem.map(c => (
            <button key={c.email} onClick={() => { setEmailOrigem(c.email); if (c.password) setEmailOrigemPassword(c.password) }}
              className={`flex flex-col px-3 py-2 text-left text-xs border-b border-gray-100 hover:bg-white transition-colors ${emailOrigem === c.email ? "bg-white border-l-2 border-l-red-500 text-red-600 font-bold" : "text-gray-600"}`}>
              <span className="truncate w-full">{c.nome || c.email}</span>
              {c.nome && <span className="text-[10px] text-gray-400 truncate w-full">{c.email}</span>}
            </button>
          ))}
        </div>
        <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 bg-gray-50">
          <input type="search" autoComplete="off" placeholder="🔍 Pesquisar emails..." className="flex-1 max-w-sm px-3 py-1.5 border border-gray-300 rounded-lg text-xs outline-none" />
          {[{ i: '↪️', t: 'Reencaminhar' }, { i: '🔄', t: 'Actualizar' }, { i: '📁', t: 'Arquivar' }, { i: '⚠️', t: 'Spam' }, { i: '🗑️', t: 'Eliminar' }].map((b, i) => (
            <button key={i} className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-100 transition-colors">
              {b.i} {b.t}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto">
          {emails.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-3">
              <span className="text-5xl">📭</span>
              <p className="text-sm font-medium">A caixa está vazia</p>
              <p className="text-xs text-gray-300">{pastaActiva}</p>
            </div>
          ) : emails.map((e, i) => (
            <div key={i} onClick={() => setModalEmail(e)}
              className="flex items-center gap-4 px-5 py-3 border-b border-gray-100 hover:bg-blue-50 cursor-pointer">
              <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center shrink-0">
                <span className="text-xs font-bold">{e.de?.[0]?.toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-gray-800 truncate">{e.de}</p>
                  <p className="text-xs text-gray-400">{e.data}</p>
                </div>
                <p className="text-xs text-gray-600 truncate">{e.assunto}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MODAL LER EMAIL — FULLSCREEN */}
      {modalEmail && (
        <div className="fixed inset-0 bg-white z-50 flex flex-col">
          <div className="bg-gray-900 px-6 py-3 flex items-center gap-3">
            <button onClick={() => { setModoResposta('reply'); setCompose({ para: modalEmail.de, cc: '', bcc: '', assunto: 'Re: ' + modalEmail.assunto, corpo: '' }) }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-bold">↩️ Responder</button>
            <button onClick={() => { setModoResposta('forward'); setCompose({ para: '', cc: '', bcc: '', assunto: 'Fwd: ' + modalEmail.assunto, corpo: modalEmail.corpo }) }}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-xs font-bold">↪️ Reencaminhar</button>
            <button onClick={handleCloseModal} className="bg-red-900 hover:bg-red-800 text-white px-4 py-2 rounded-lg text-xs font-bold">🗑️ Eliminar</button>
            <button onClick={handleCloseModal} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-xs font-bold">📁 Arquivar</button>
            <div className="ml-auto">
              <button onClick={handleCloseModal} className="w-9 h-9 flex items-center justify-center rounded-full bg-red-600 hover:bg-red-700 text-white font-bold text-lg">✕</button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-8 max-w-4xl mx-auto w-full">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">{modalEmail.assunto}</h1>
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200">
              <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center">
                <span className="text-white font-bold">{modalEmail.de?.[0]?.toUpperCase()}</span>
              </div>
              <div>
                <p className="font-bold text-gray-800">{modalEmail.de}</p>
                <p className="text-xs text-gray-500">{modalEmail.data}</p>
              </div>
            </div>
            <div className="text-sm text-gray-700 leading-relaxed">{modalEmail.corpo}</div>
            {modoResposta !== 'none' && (
              <div className="mt-8 border-t border-gray-200 pt-6">
                <h3 className="text-sm font-bold text-gray-700 mb-4">{modoResposta === 'reply' ? '↩️ Responder' : '↪️ Reencaminhar'}</h3>
                <div className="border border-gray-300 rounded-xl overflow-hidden">
                  <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 space-y-1">
                    {[{ label: 'Para:', field: 'para' }, { label: 'Cc:', field: 'cc' }, { label: 'Assunto:', field: 'assunto' }].map(f => (
                      <div key={f.field} className="flex items-center gap-3 py-1 border-b border-gray-100 last:border-0">
                        <span className="text-xs font-bold text-gray-500 w-16">{f.label}</span>
                        <input value={(compose as any)[f.field]} onChange={e => setCompose({...compose, [f.field]: e.target.value})}
                          className="flex-1 text-sm bg-transparent outline-none" />
                      </div>
                    ))}
                  </div>
                  <textarea value={compose.corpo} onChange={e => setCompose({...compose, corpo: e.target.value})}
                    rows={6} className="w-full p-4 text-sm outline-none resize-none" placeholder="Escreve a tua resposta..." />
                  {assinatura && <div className="px-4 pb-3 border-t border-gray-100 text-xs text-gray-500 whitespace-pre-wrap">--{'\n'}{assinatura}</div>}
                  <div className="flex gap-2 p-3 border-t border-gray-200 bg-gray-50">
                    <button onClick={handleSend} disabled={enviando}
                      className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg text-xs font-bold disabled:opacity-50">
                      {enviando ? '⏳ A enviar...' : '✈️ Enviar'}
                    </button>
                    <button onClick={() => setModoResposta('none')}
                      className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg text-xs font-bold">Cancelar</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

        </div>
      {/* POPUP ESCREVER — FULLSCREEN */}
      {mostrarCompose && (
        <div className="fixed inset-0 bg-white z-50 flex flex-col">

          {/* LINHA 1 — Layout 2 colunas */}
<div className="bg-gray-900 border-b border-gray-700 flex">

  {/* Coluna esquerda — só botão Enviar */}
  <div className="flex flex-col border-r border-gray-700 shrink-0">
    <button onClick={handleSend} disabled={enviando || !compose.para || !emailOrigem}
  className="flex-1 bg-gradient-to-b from-green-500 to-green-700 hover:from-green-400 hover:to-green-600 disabled:opacity-40 text-white font-bold px-6 text-sm flex flex-col items-center justify-center gap-1 shadow-lg transition-all min-w-[110px] border-r border-green-800">
  {enviando
    ? <><span className="text-xl">⏳</span><span className="text-[11px] tracking-wide">A enviar...</span></>
    : <><svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg><span className="text-[11px] tracking-wide uppercase">Enviar</span></>
  }
</button>
  </div>

  {/* Coluna direita — Campos */}
  <div className="flex-1 flex flex-col">
    {/* Linha De + botão fechar */}
    <div className="flex items-center border-b border-gray-700 px-3 py-1">
      <span className="text-gray-400 text-xs w-16 shrink-0">De:</span>
      <select value={emailOrigem} onChange={e => setEmailOrigem(e.target.value)}
        className="bg-transparent text-white text-sm outline-none flex-1">
        <option value="" className="bg-gray-900">Escolher email de origem...</option>
        {emailsOrigem.map(e => (
          <option key={e.email} value={e.email} className="bg-gray-900">
            {e.nome} ({e.email}) {e.tipo === 'google' ? '📧' : e.tipo === 'hotmail' ? '📨' : '🌐'}
          </option>
        ))}
      </select>
      <button onClick={() => setMostrarPopupFechar(true)}
        className="ml-2 w-8 h-full min-h-[32px] flex items-center justify-center bg-red-600 hover:bg-red-700 text-white font-bold text-sm shrink-0 transition-colors -mr-0 self-stretch">✕</button>
    </div>
    {emailOrigem && (
      <div className="flex items-center border-b border-gray-700 px-3 py-1.5">
        <span className="text-gray-400 text-xs w-16 shrink-0">Password:</span>
        <input
          type="password"
          value={emailOrigemPassword}
          onChange={e => setEmailOrigemPassword(e.target.value)}
          placeholder="Password da conta de email"
          className="flex-1 bg-transparent text-white text-sm outline-none"
        />
      </div>
    )}
    {/* Linha Para */}
    <div className="flex items-center border-b border-gray-700 px-3 py-1.5">
      <span className="text-gray-400 text-xs w-16 shrink-0">Para:</span>
      <input list="contactos-list" value={compose.para} onChange={e => setCompose({...compose, para: e.target.value})}
        className="flex-1 bg-transparent text-white text-sm outline-none" />
      <datalist id="contactos-list">
        {contactos.map(c => <option key={c.email} value={c.email}>{c.nome}</option>)}
      </datalist>
      <button title="Seleccionar contacto" className="text-gray-500 hover:text-gray-300 ml-2 text-xs border border-gray-600 rounded px-1.5 py-0.5">📖</button>
      {/* Botões para mostrar Cc e Bcc */}
      <button onClick={() => setMostrarCc(!mostrarCc)}
        className={`ml-1 text-xs px-2 py-0.5 rounded border transition-colors ${mostrarCc ? 'border-blue-500 text-blue-400' : 'border-gray-600 text-gray-500 hover:text-gray-300'}`}>Cc</button>
      <button onClick={() => setMostrarBcc(!mostrarBcc)}
        className={`ml-1 text-xs px-2 py-0.5 rounded border transition-colors ${mostrarBcc ? 'border-blue-500 text-blue-400' : 'border-gray-600 text-gray-500 hover:text-gray-300'}`}>Bcc</button>
    </div>
    {/* Linha Cc — só aparece se activado */}
    {mostrarCc && (
      <div className="flex items-center border-b border-gray-700 px-3 py-1.5">
        <span className="text-gray-400 text-xs w-16 shrink-0">Cc:</span>
        <input value={compose.cc} onChange={e => setCompose({...compose, cc: e.target.value})}
          className="flex-1 bg-transparent text-white text-sm outline-none" />
        <button className="text-gray-500 hover:text-gray-300 ml-2 text-xs border border-gray-600 rounded px-1.5 py-0.5">📖</button>
      </div>
    )}
    {/* Linha Bcc — só aparece se activado */}
    {mostrarBcc && (
      <div className="flex items-center border-b border-gray-700 px-3 py-1.5">
        <span className="text-gray-400 text-xs w-16 shrink-0">Bcc:</span>
        <input value={compose.bcc} onChange={e => setCompose({...compose, bcc: e.target.value})}
          className="flex-1 bg-transparent text-white text-sm outline-none" />
        <button className="text-gray-500 hover:text-gray-300 ml-2 text-xs border border-gray-600 rounded px-1.5 py-0.5">📖</button>
      </div>
    )}
    {/* Linha Assunto */}
    <div className="flex items-center px-3 py-1.5">
      <span className="text-gray-400 text-xs w-16 shrink-0">Assunto:</span>
      <input value={compose.assunto} onChange={e => setCompose({...compose, assunto: e.target.value})}
        className="flex-1 bg-transparent text-white text-sm outline-none" />
    </div>
  </div>
</div>

          {/* LINHA 2 — Formatação */}
          <div className="bg-gray-800 px-3 py-1 flex items-center justify-between gap-1 flex-wrap border-b border-gray-700">
            {/* Lado esquerdo — formatação */}
            <div className="flex items-center gap-1 flex-wrap">
<button title="Desfazer (Ctrl+Z)"
  onMouseDown={(e) => { e.preventDefault(); execCmd('undo') }}
  className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-600 border border-gray-600 text-white transition-colors">
  <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor"><path d="M4.5 4.5l-3 3 3 3V8a5.5 5.5 0 1 1 5.5 5.5H6v1.5h4A7 7 0 1 0 4 5.6V4.5z"/></svg>
</button>
<button title="Refazer (Ctrl+Y)"
  onMouseDown={(e) => { e.preventDefault(); execCmd('redo') }}
  className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-600 border border-gray-600 text-white transition-colors">
  <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor"><path d="M11.5 4.5l3 3-3 3V8a5.5 5.5 0 1 0-5.5 5.5H10v1.5H6A7 7 0 1 1 12 5.6V4.5z"/></svg>
</button>
<div className="w-px h-5 bg-gray-600 mx-1" />
              <select className="bg-gray-700 border border-gray-600 text-white text-xs px-2 py-1.5 rounded" onChange={(e) => execCmd('fontName', e.target.value)}>
                <option>Calibri</option><option>Arial</option><option>Times New Roman</option>
              </select>
              <select className="bg-gray-700 border border-gray-600 text-white text-xs px-2 py-1.5 rounded w-14" onChange={(e) => {
  const mapeamento: Record<string, string> = { '11': '1', '12': '2', '14': '3', '16': '4', '18': '5' }
  execCmd('fontSize', mapeamento[e.target.value] || '3')
}}>
                <option>11</option><option>12</option><option>14</option><option>16</option><option>18</option>
              </select>
              {/* Botão cor do texto */}
<div className="relative">
  <button title="Cor do texto"
    onMouseDown={(e) => { e.preventDefault(); setMostrarPaletaCor(prev => prev === 'texto' ? null : 'texto') }}
    className="w-7 h-7 flex flex-col items-center justify-center rounded hover:bg-gray-600 bg-gray-700 border border-gray-600 gap-0.5">
    <span className="text-white text-xs font-bold leading-none" style={{ color: corTexto === '#000000' ? 'white' : corTexto }}>A</span>
    <div className="w-4 h-1 rounded-sm" style={{ backgroundColor: corTexto }} />
  </button>
  {mostrarPaletaCor === 'texto' && (
    <div className="absolute top-8 left-0 bg-gray-800 border border-gray-600 rounded shadow-xl p-2 z-50 w-48">
      <p className="text-gray-400 text-[10px] mb-1.5">Cor do texto</p>
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
            className="w-4 h-4 rounded-sm border border-gray-600 hover:scale-125 transition-transform"
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
    className="w-7 h-7 flex flex-col items-center justify-center rounded hover:bg-gray-600 border border-gray-600 gap-0.5">
    <span className="text-white text-xs leading-none">🖌</span>
    <div className="w-4 h-1 rounded-sm" style={{ backgroundColor: corFundo }} />
  </button>
  {mostrarPaletaCor === 'fundo' && (
    <div className="absolute top-8 left-0 bg-gray-800 border border-gray-600 rounded shadow-xl p-2 z-50 w-48">
      <p className="text-gray-400 text-[10px] mb-1.5">Realçar texto</p>
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
            className="w-4 h-4 rounded-sm border border-gray-600 hover:scale-125 transition-transform"
            style={{ backgroundColor: cor }} />
        ))}
      </div>
    </div>
  )}
</div>
              <div className="w-px h-5 bg-gray-600 mx-1" />
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
          : 'bg-transparent border-gray-600 text-white hover:bg-gray-600'
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
              <div className="w-px h-5 bg-gray-600 mx-1" />
              <button title="Alinhar à esquerda" className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-600 text-white transition-colors" onClick={() => execCmd('justifyLeft')}>
  <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor"><rect x="1" y="2" width="14" height="1.5" rx="0.75"/><rect x="1" y="5.5" width="10" height="1.5" rx="0.75"/><rect x="1" y="9" width="14" height="1.5" rx="0.75"/><rect x="1" y="12.5" width="8" height="1.5" rx="0.75"/></svg>
</button>
<button title="Centrar" className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-600 text-white transition-colors" onClick={() => execCmd('justifyCenter')}>
  <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor"><rect x="1" y="2" width="14" height="1.5" rx="0.75"/><rect x="3" y="5.5" width="10" height="1.5" rx="0.75"/><rect x="1" y="9" width="14" height="1.5" rx="0.75"/><rect x="4" y="12.5" width="8" height="1.5" rx="0.75"/></svg>
</button>
<button title="Alinhar à direita" className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-600 text-white transition-colors" onClick={() => execCmd('justifyRight')}>
  <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor"><rect x="1" y="2" width="14" height="1.5" rx="0.75"/><rect x="5" y="5.5" width="10" height="1.5" rx="0.75"/><rect x="1" y="9" width="14" height="1.5" rx="0.75"/><rect x="7" y="12.5" width="8" height="1.5" rx="0.75"/></svg>
</button>
<button title="Justificar" className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-600 text-white transition-colors" onClick={() => execCmd('justifyFull')}>
  <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor"><rect x="1" y="2" width="14" height="1.5" rx="0.75"/><rect x="1" y="5.5" width="14" height="1.5" rx="0.75"/><rect x="1" y="9" width="14" height="1.5" rx="0.75"/><rect x="1" y="12.5" width="14" height="1.5" rx="0.75"/></svg>
</button>
<button title="Lista de pontos" className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-600 text-white transition-colors" onMouseDown={(e) => {
  e.preventDefault()
  execCmd('insertUnorderedList')
}}>
  <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor"><circle cx="2" cy="4" r="1.2"/><rect x="5" y="3.2" width="9" height="1.5" rx="0.75"/><circle cx="2" cy="8" r="1.2"/><rect x="5" y="7.2" width="9" height="1.5" rx="0.75"/><circle cx="2" cy="12" r="1.2"/><rect x="5" y="11.2" width="9" height="1.5" rx="0.75"/></svg>
</button>
<button title="Lista numerada" className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-600 text-white transition-colors" onMouseDown={(e) => {
  e.preventDefault()
  execCmd('insertOrderedList')
}}>
  <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor"><rect x="1" y="2" width="2" height="1.5" rx="0.5"/><rect x="5" y="2" width="9" height="1.5" rx="0.75"/><rect x="1" y="5.5" width="2" height="1.5" rx="0.5"/><rect x="5" y="5.5" width="9" height="1.5" rx="0.75"/><rect x="1" y="9" width="2" height="1.5" rx="0.5"/><rect x="5" y="9" width="9" height="1.5" rx="0.75"/></svg>
</button>
<button title="Diminuir indentação" className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-600 text-white transition-colors" onClick={() => execCmd('outdent')}>
  <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor"><rect x="1" y="2" width="14" height="1.5" rx="0.75"/><path d="M5 5.5L2 8l3 2.5V5.5z"/><rect x="6" y="7.2" width="9" height="1.5" rx="0.75"/><rect x="1" y="12.5" width="14" height="1.5" rx="0.75"/></svg>
</button>
<button title="Aumentar indentação" className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-600 text-white transition-colors" onClick={() => execCmd('indent')}>
  <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor"><rect x="1" y="2" width="14" height="1.5" rx="0.75"/><path d="M2 5.5l3 2.5-3 2.5V5.5z"/><rect x="6" y="7.2" width="9" height="1.5" rx="0.75"/><rect x="1" y="12.5" width="14" height="1.5" rx="0.75"/></svg>
</button>
            </div>

            {/* Lado direito — inserir e assinatura */}
            <div className="flex items-center gap-1">
              {[{ l: '🔗', t: 'Ligação' }, { l: <ImageIcon className="w-3.5 h-3.5" />, t: 'Imagem' }, { l: '⊞', t: 'Tabela' }, { l: '📎', t: 'Anexo' }].map((b, i) => (
                <button key={i} title={b.t} className="text-white text-sm px-2.5 py-1.5 rounded hover:bg-gray-600 border border-gray-600 flex items-center gap-1.5 relative group"
                  onClick={() => {
                    if (b.t === 'Ligação') inserirLink()
                    else if (b.t === 'Imagem') inserirImagem()
                    else if (b.t === 'Tabela') inserirTabela()
                    else if (b.t === 'Anexo') inserirAnexo()
                  }}>
                  {b.l} <span className="text-white text-xs">{b.t}</span>
                </button>
              ))}
              <button onClick={() => setMostrarConfigAssinatura(true)}
                className="text-white text-sm px-2.5 py-1.5 rounded hover:bg-gray-600 border border-gray-600 flex items-center gap-1.5">
                ✍️ <span className="text-white text-xs">Assinatura</span>
              </button>
            </div>
          </div>

          {/* ÁREA DE ESCRITA */}
          {enviado ? (
            <div className="flex-1 flex items-center justify-center bg-white">
              <div className="text-center">
                <p className="text-5xl mb-4">✅</p>
                <p className="text-xl font-bold text-gray-800">Email enviado com sucesso!</p>
                <button onClick={() => { setMostrarCompose(false); setCompose({ para: '', cc: '', bcc: '', assunto: '', corpo: '' }); setEnviado(false); setAnexos([]) }}
                  className="mt-5 bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 rounded-lg text-sm font-bold">Fechar</button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col bg-gray-100 overflow-y-auto">
              <style>{`
  [contenteditable] ul { list-style-type: disc; padding-left: 1.5rem; color: #1f2937; }
  [contenteditable] ol { list-style-type: decimal; padding-left: 1.5rem; color: #1f2937; }
  [contenteditable] li { color: #1f2937; }
`}</style>
              <div className="flex-1 flex justify-center py-6 px-4">
  <div className="w-3/4 bg-white rounded-xl shadow-md">
    <div
      ref={editorRef}
      contentEditable
      suppressContentEditableWarning
      className="p-6 text-sm outline-none min-h-[400px] w-full"
      style={{ whiteSpace: 'pre-wrap', color: '#1f2937' }}
      onInput={(e) => { const el = e.currentTarget as HTMLDivElement; if (el) setCompose(prev => ({ ...prev, corpo: el.innerHTML })) }}
    />
              {anexos.length > 0 && (
                <div className="px-6 py-2 border-t border-gray-200 flex flex-wrap gap-2">
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
                <div className="px-6 py-3 border-t border-gray-200 text-xs text-gray-500 whitespace-pre-wrap">--{'\n'}{assinatura}</div>
              )}
    </div>
  </div>
            </div>
          )}
        </div>
      )}

      {mostrarPopupLink && (
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
)}

      {mostrarPopupFechar && (
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
  <button onClick={guardarRascunho}
    className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2 rounded-lg text-xs transition-colors">
    💾 Guardar
  </button>
</div>
    </div>
  </div>
)}

      {mostrarConfigAssinatura && (
  <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60]">
    <div className="bg-gray-900 rounded-xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden">
      {/* Header macOS style */}
      <div className="bg-gray-800 px-5 py-3 flex items-center justify-between border-b border-gray-700">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500 cursor-pointer" onClick={() => setMostrarConfigAssinatura(false)} />
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <div className="w-3 h-3 rounded-full bg-gray-600" />
        </div>
        <h2 className="text-sm font-bold text-white">Assinaturas</h2>
        <button className="text-gray-400 hover:text-white text-xs px-3 py-1 rounded border border-gray-600 transition-colors">Mostrar Tudo</button>
      </div>

      <div className="p-6 space-y-5">
        {/* Editar assinatura */}
        <div>
          <h3 className="text-sm font-bold text-white mb-3">Editar assinatura:</h3>
          <div className="bg-gray-800 rounded-lg border border-gray-600 flex overflow-hidden" style={{minHeight: '200px'}}>
            {/* Lista */}
            <div className="w-52 border-r border-gray-600 flex flex-col">
              <div className="px-3 py-2 bg-gray-700 border-b border-gray-600">
                <p className="text-xs font-bold text-gray-300">Nome da assinatura</p>
              </div>
              <div className="flex-1">
                {assinaturas.map((s, i) => (
                  <div key={i} onClick={() => setAssinaturaActiva(i)}
                    className={`px-3 py-2 cursor-pointer text-sm border-b border-gray-700 transition-colors ${assinaturaActiva === i ? 'bg-gray-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}>
                    {s.nome}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-1 p-2 border-t border-gray-600">
                <button onClick={() => setAssinaturas([...assinaturas, { nome: 'Nova Assinatura', activa: false, texto: '', imagemUrl: '' }])}
                  className="bg-gray-600 hover:bg-gray-500 text-white text-xs px-2 py-1 rounded font-bold transition-colors">+</button>
                <button onClick={() => setAssinaturas(assinaturas.filter((_, i) => i !== assinaturaActiva))}
                  className="bg-gray-600 hover:bg-gray-500 text-white text-xs px-2 py-1 rounded font-bold transition-colors">−</button>
                <button onClick={() => { setMostrarConfigAssinatura(false); setMostrarEditarAssinatura(true) }}
                  className="ml-auto bg-gray-600 hover:bg-gray-500 text-white text-xs px-3 py-1 rounded transition-colors">Editar</button>
              </div>
            </div>
            {/* Preview */}
            <div className="flex-1 flex flex-col">
              <div className="px-3 py-2 bg-gray-700 border-b border-gray-600 text-center">
                <p className="text-xs font-bold text-gray-300">Pré-visualização da Assinatura</p>
              </div>
              <div className="flex-1 bg-white p-4">
                {assinaturas[assinaturaActiva]?.imagemUrl ? (
                  <img src={assinaturas[assinaturaActiva].imagemUrl} alt="Assinatura" className="max-w-full max-h-32 object-contain" />
                ) : assinaturas[assinaturaActiva]?.texto ? (
                  <div className="text-sm text-gray-700 whitespace-pre-wrap">{assinaturas[assinaturaActiva].texto}</div>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400 text-xs">Sem conteúdo — clica em Editar</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Assinatura predefinida */}
        <div>
          <h3 className="text-sm font-bold text-white mb-3">Selecionar assinatura predefinida:</h3>
          <div className="bg-gray-800 rounded-lg border border-gray-600 p-4 space-y-3">
            {[
              { label: 'Conta:', valor: 'Silva Chamo (silva.chamo@gmail.com)' },
              { label: 'Novas mensagens:', valor: 'Nenhuma' },
              { label: 'Respostas/reenc.:', valor: 'Nenhuma' },
            ].map(({ label, valor }) => (
              <div key={label} className="flex items-center gap-4">
                <span className="text-gray-400 text-sm w-44 text-right shrink-0">{label}</span>
                <select className="flex-1 bg-gray-700 border border-gray-600 text-white text-sm px-3 py-2 rounded-lg outline-none">
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
)}
{mostrarEditarAssinatura && (
  <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60]">
    <div className="bg-gray-900 rounded-xl shadow-2xl w-full max-w-4xl mx-4 h-[85vh] flex flex-col overflow-hidden">
      {/* Header macOS style com título da assinatura */}
      <div className="bg-gray-800 px-5 py-2 flex items-center gap-3 border-b border-gray-700">
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-3 h-3 rounded-full bg-red-500 cursor-pointer" onClick={() => { setMostrarEditarAssinatura(false); setMostrarConfigAssinatura(true) }} />
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <div className="w-3 h-3 rounded-full bg-green-500" />
        </div>
        {/* Toolbar */}
        <div className="flex items-center gap-1 flex-wrap ml-2">
          <button title="Colar" className="bg-gray-700 hover:bg-gray-600 text-white text-xs px-3 py-1.5 rounded border border-gray-600 flex items-center gap-1">📋 Colar</button>
          <div className="w-px h-5 bg-gray-600 mx-1" />
          <select className="bg-gray-700 border border-gray-600 text-white text-xs px-2 py-1.5 rounded">
            <option>Calibri</option><option>Arial</option><option>Times New Roman</option>
          </select>
          <select className="bg-gray-700 border border-gray-600 text-white text-xs px-2 py-1.5 rounded w-14">
            <option>11</option><option>12</option><option>14</option><option>16</option>
          </select>
          <div className="w-px h-5 bg-gray-600 mx-1" />
          {[{ l: 'N', t: 'Negrito' }, { l: 'I', t: 'Itálico' }, { l: 'S', t: 'Sublinhado' }, { l: 'ab', t: 'Riscado' }].map((b, i) => (
            <button key={i} title={b.t} className="text-white text-xs px-2 py-1.5 rounded hover:bg-gray-600 border border-gray-600">{b.l}</button>
          ))}
          <div className="w-px h-5 bg-gray-600 mx-1" />
          {[{ l: <><ImageIcon className="w-3.5 h-3.5" /> <span className="text-gray-300 text-[10px]">Imagens</span></>, t: 'Imagens' }, { l: '🔗 Ligação', t: 'Ligação' }, { l: '⊞ Tabela', t: 'Tabela' }, { l: '🌙 Mudar Fundo', t: 'Mudar Fundo' }].map((b, i) => (
            <button key={i} title={b.t} className="text-white text-xs px-2 py-1.5 rounded hover:bg-gray-600 border border-gray-600">{b.l}</button>
          ))}
        </div>
        <span className="ml-auto text-white text-sm font-bold">{assinaturas[assinaturaActiva]?.nome}</span>
      </div>

      {/* Nome da assinatura */}
      <div className="bg-gray-800 flex items-center border-b border-gray-700 px-5 py-2">
        <span className="text-gray-400 text-sm w-40 shrink-0">Nome da Assinatura:</span>
        <input value={assinaturas[assinaturaActiva]?.nome || ''}
          onChange={e => { const a = [...assinaturas]; a[assinaturaActiva].nome = e.target.value; setAssinaturas(a) }}
          className="flex-1 bg-white text-gray-900 text-sm px-3 py-1.5 rounded outline-none" />
      </div>

      {/* Área de edição — fundo branco */}
      <div className="flex-1 flex flex-col bg-white overflow-hidden">
        <textarea
          value={assinaturas[assinaturaActiva]?.texto || ''}
          onChange={e => { const a = [...assinaturas]; a[assinaturaActiva].texto = e.target.value; setAssinaturas(a) }}
          className="flex-1 p-6 text-sm text-gray-800 outline-none resize-none"
          placeholder="Escreve aqui a tua assinatura...&#10;&#10;Ex:&#10;Silva Chamo&#10;DR. GERAL — VisualDesign&#10;+258 82 52 88 318&#10;silva.chamo@visualdesigne.com&#10;https://visualdesigne.com" />

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
      <div className="bg-gray-800 border-t border-gray-700 px-5 py-3 flex justify-end gap-3">
        <button onClick={() => { setAssinatura(assinaturas[assinaturaActiva]?.texto || ''); setMostrarEditarAssinatura(false); setMostrarConfigAssinatura(true) }}
          className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg text-sm font-bold transition-colors">Guardar</button>
        <button onClick={() => { setMostrarEditarAssinatura(false); setMostrarConfigAssinatura(true) }}
          className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded-lg text-sm font-bold transition-colors">Cancelar</button>
      </div>
    </div>
  </div>
)}

      {mostrarConfigContactos && (
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
          <input value={novoContacto.nome} onChange={e => setNovoContacto({...novoContacto, nome: e.target.value})}
            placeholder="Nome completo" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm outline-none focus:border-red-400" />
          <input value={novoContacto.email} onChange={e => setNovoContacto({...novoContacto, email: e.target.value})}
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
)}

{mostrarAdicionarConta && (
  <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[70]">
    <div className="bg-gray-900 rounded-xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden">

      {/* Header macOS */}
      <div className="bg-gray-800 px-5 py-3 flex items-center gap-3 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500 cursor-pointer" onClick={() => setMostrarAdicionarConta(false)} />
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <div className="w-3 h-3 rounded-full bg-gray-600" />
        </div>
        {modalAdicionarPasso !== 'escolher' && (
          <button onClick={() => setModalAdicionarPasso('escolher')}
            className="text-gray-400 hover:text-white text-xs">← Voltar</button>
        )}
        <h2 className="text-sm font-bold text-white mx-auto">Contas da Internet</h2>
      </div>

      {/* PASSO 1 — Escolher tipo */}
      {modalAdicionarPasso === 'escolher' && (
        <div className="flex">
          {/* Lista esquerda — contas existentes */}
          <div className="w-56 border-r border-gray-700 p-3 space-y-1 min-h-64">
            <p className="text-xs text-gray-500 uppercase font-bold mb-2 px-2">Contas configuradas</p>
            {emailsOrigem.length === 0 ? (
              <p className="text-xs text-gray-600 px-2">Nenhuma conta</p>
            ) : emailsOrigem.map((c, i) => (
              <div key={i} className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-gray-800 cursor-pointer">
                <div className="w-7 h-7 bg-blue-500 rounded-full flex items-center justify-center text-xs">
                  {c.tipo === 'google' ? 'G' : c.tipo === 'hotmail' ? 'M' : '@'}
                </div>
                <div>
                  <p className="text-xs font-bold text-white">{c.nome}</p>
                  <p className="text-[10px] text-gray-400 truncate max-w-[130px]">{c.email}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Direita — escolher tipo */}
          <div className="flex-1 p-6">
            <p className="text-sm text-gray-300 mb-6">Escolhe o tipo de conta a adicionar:</p>
            <div className="space-y-3">
              {/* Google */}
              <button onClick={() => setModalAdicionarPasso('google')}
                className="w-full flex items-center gap-4 px-4 py-3 rounded-lg border border-gray-700 hover:border-gray-500 hover:bg-gray-800 transition-colors text-left">
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-lg font-bold shrink-0">
                  <span style={{background: 'linear-gradient(135deg, #4285F4, #34A853, #FBBC05, #EA4335)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'}}>G</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Google</p>
                  <p className="text-xs text-gray-400">Gmail, Google Workspace</p>
                </div>
              </button>

              {/* Hotmail */}
              <button onClick={() => setModalAdicionarPasso('hotmail')}
                className="w-full flex items-center gap-4 px-4 py-3 rounded-lg border border-gray-700 hover:border-gray-500 hover:bg-gray-800 transition-colors text-left">
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center shrink-0">
                  <span className="text-white font-bold text-sm">M</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Microsoft</p>
                  <p className="text-xs text-gray-400">Hotmail, Outlook, Office 365</p>
                </div>
              </button>

              {/* Webmail / Email executivo */}
              <button onClick={() => setModalAdicionarPasso('webmail')}
                className="w-full flex items-center gap-4 px-4 py-3 rounded-lg border border-gray-700 hover:border-gray-500 hover:bg-gray-800 transition-colors text-left">
                <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center shrink-0">
                  <span className="text-white font-bold text-sm">@</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Email Executivo</p>
                  <p className="text-xs text-gray-400">Webmail, IMAP/SMTP personalizado</p>
                </div>
              </button>

              <div className="border-t border-gray-700 pt-3">
                <button className="w-full text-center text-xs text-gray-500 hover:text-gray-300 py-2 transition-colors">
                  Adicionar outra conta...
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PASSO 2a — Google OAuth */}
      {modalAdicionarPasso === 'google' && (
        <div className="p-8 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mb-4">
            <span className="text-3xl">@</span>
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Autenticação Google</h3>
          <p className="text-sm text-gray-400 mb-6 max-w-sm">
            O Google requer que a autenticação seja concluída no navegador da web. Após a autenticação, a conta será adicionada automaticamente.
          </p>
          <div className="flex gap-3">
            <button onClick={() => setModalAdicionarPasso('escolher')}
              className="px-6 py-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm font-bold transition-colors">
              Cancelar
            </button>
            <button onClick={() => {
              const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
              window.open(`${supabaseUrl}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(window.location.origin + '/auth/callback')}`, '_blank')
              // Após autenticação, simula adição da conta Google
              setTimeout(() => {
                const novasConta = { email: 'silva.chamo@gmail.com', tipo: 'google' as const, nome: 'Silva Chamo' }
                setEmailsOrigem(prev => [...prev.filter(e => e.email !== novasConta.email), novasConta])
                setEmailOrigem(novasConta.email)
                setMostrarAdicionarConta(false)
              }, 3000)
            }}
              className="px-6 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-bold transition-colors">
              Abrir Navegador
            </button>
          </div>
        </div>
      )}

      {/* PASSO 2b — Microsoft/Hotmail */}
      {modalAdicionarPasso === 'hotmail' && (
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-300 mb-2">Configurar conta Microsoft</p>
          {[
            { label: 'Endereço de e-mail', field: 'email', placeholder: 'nome@hotmail.com' },
            { label: 'Nome de utilizador', field: 'nome', placeholder: 'Automático' },
            { label: 'Palavra-passe', field: 'password', placeholder: '••••••••', type: 'password' },
          ].map(f => (
            <div key={f.field} className="flex items-center gap-4">
              <span className="text-gray-400 text-sm w-44 text-right shrink-0">{f.label}:</span>
              <input type={f.type || 'text'} placeholder={f.placeholder}
                value={(novaContaForm as any)[f.field]}
                onChange={e => setNovaContaForm({...novaContaForm, [f.field]: e.target.value})}
                className="flex-1 bg-gray-700 border border-gray-600 text-white text-sm px-3 py-2 rounded-lg outline-none focus:border-red-500" />
            </div>
          ))}
          <div className="flex items-center gap-4">
            <span className="text-gray-400 text-sm w-44 text-right shrink-0">Tipo de conta:</span>
            <select className="flex-1 bg-gray-700 border border-gray-600 text-white text-sm px-3 py-2 rounded-lg outline-none">
              <option>IMAP</option><option>POP3</option><option>Exchange</option>
            </select>
          </div>
          <p className="text-xs text-red-400 text-center">Não foi possível confirmar automaticamente — preenche os servidores manualmente.</p>
          <div className="flex justify-between pt-2">
            <button onClick={() => setModalAdicionarPasso('escolher')}
              className="px-5 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm font-bold">Anterior</button>
            <button onClick={() => {
              if (novaContaForm.email) {
                setEmailsOrigem(prev => [...prev, { email: novaContaForm.email, tipo: 'hotmail', nome: novaContaForm.nome || novaContaForm.email.split('@')[0] }])
                setEmailOrigem(novaContaForm.email)
                setMostrarAdicionarConta(false)
                setNovaContaForm({ nome: '', email: '', password: '', servidor: '', porta: '993', smtp: '', smtpPorta: '465' })
              }
            }}
              disabled={!novaContaForm.email}
              className="px-5 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-bold">Iniciar sessão</button>
          </div>
        </div>
      )}

      {/* PASSO 2c — Email Executivo / Webmail */}
      {modalAdicionarPasso === 'webmail' && (
        <div className="p-6 space-y-3">
          <p className="text-sm text-gray-300 mb-2">Configurar Email Executivo (IMAP/SMTP)</p>
          {[
            { label: 'Endereço de e-mail', field: 'email', placeholder: 'nome@visualdesigne.com' },
            { label: 'Nome de utilizador', field: 'nome', placeholder: 'Silva Chamo' },
            { label: 'Palavra-passe', field: 'password', placeholder: '••••••••', type: 'password' },
            { label: 'Servidor de receção (IMAP)', field: 'servidor', placeholder: 'mail.visualdesigne.com' },
            { label: 'Porta IMAP', field: 'porta', placeholder: '993' },
            { label: 'Servidor de envio (SMTP)', field: 'smtp', placeholder: 'mail.visualdesigne.com' },
            { label: 'Porta SMTP', field: 'smtpPorta', placeholder: '465' },
          ].map(f => (
            <div key={f.field} className="flex items-center gap-4">
              <span className="text-gray-400 text-xs w-48 text-right shrink-0">{f.label}:</span>
              <input type={f.type || 'text'} placeholder={f.placeholder}
                value={(novaContaForm as any)[f.field]}
                onChange={e => setNovaContaForm({...novaContaForm, [f.field]: e.target.value})}
                className="flex-1 bg-gray-700 border border-gray-600 text-white text-sm px-3 py-2 rounded-lg outline-none focus:border-red-500" />
            </div>
          ))}
          <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-3 mt-2">
            <p className="text-xs text-blue-300 font-bold mb-1">Configurações recomendadas VisualDesign:</p>
            <p className="text-xs text-blue-200">Servidor: mail.visualdesigne.com • IMAP: 993 SSL • SMTP: 465 SSL</p>
          </div>
          <div className="flex justify-between pt-2">
            <button onClick={() => setModalAdicionarPasso('escolher')}
              className="px-5 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm font-bold">Anterior</button>
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
                  }
                } catch (error: any) {
                  alert('Erro ao criar conta: ' + error.message)
                }
                setCarregandoEmails(false)
                setMostrarAdicionarConta(false)
                setNovaContaForm({ nome: '', email: '', password: '', servidor: '', porta: '993', smtp: '', smtpPorta: '465' })
              }
            }}
              disabled={!novaContaForm.email || carregandoEmails}
              className="px-5 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-bold flex items-center gap-2">
              {carregandoEmails ? '⏳ A sincronizar...' : 'Adicionar e Sincronizar'}
            </button>
          </div>
        </div>
      )}
    </div>
  </div>
)}
    </div>
  )
}

// Componente SuporteSection
function SuporteSection() {
  const [form, setForm] = useState({ assunto: '', categoria: 'Geral', descricao: '' })
  const [enviado, setEnviado] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  const tickets = [
    { id: 'TK-001', assunto: 'Problema com email', categoria: 'Email', estado: 'Resolvido', data: '15/01/2026', resposta: 'O problema foi resolvido. O email está agora configurado correctamente.' },
    { id: 'TK-002', assunto: 'Renovação do domínio', categoria: 'Facturação', estado: 'Aberto', data: '10/02/2026', resposta: '' },
  ]

  const estadoCor = (e: string) => e === 'Resolvido' ? 'bg-green-100 text-green-700' : e === 'Aberto' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-900">Suporte</h1><p className="text-gray-500 mt-1">Contacta-nos ou abre um ticket de suporte.</p></div>

      {/* Contactos */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-bold text-gray-700 mb-3">Contacto Directo</h2>
          <div className="space-y-2">
            <a href="https://wa.me/258848066605" target="_blank"
              className="flex items-center gap-3 bg-green-50 hover:bg-green-100 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm font-bold transition-colors">
              <span>📱</span> WhatsApp — +258 848 066 605
            </a>
            <a href="mailto:silva.chamo@gmail.com"
              className="flex items-center gap-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 px-4 py-3 rounded-lg text-sm font-bold transition-colors">
              <span>✉️</span> silva.chamo@gmail.com
            </a>
          </div>
          <p className="text-xs text-gray-400 mt-3">Horário: Segunda a Sexta, 8h — 17h</p>
        </div>

        {/* Novo Ticket */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-bold text-gray-700 mb-3">Abrir Novo Ticket</h2>
          {enviado ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <p className="text-green-700 font-bold text-sm">✅ Ticket enviado com sucesso!</p>
              <p className="text-green-600 text-xs mt-1">Responderemos em breve.</p>
              <button onClick={() => { setEnviado(false); setForm({ assunto: '', categoria: 'Geral', descricao: '' }) }}
                className="mt-3 text-xs text-green-700 underline">Abrir outro ticket</button>
            </div>
          ) : (
            <div className="space-y-3">
              <input value={form.assunto} onChange={e => setForm({...form, assunto: e.target.value})}
                placeholder="Assunto" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              <select value={form.categoria} onChange={e => setForm({...form, categoria: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                {['Geral','Técnico','Facturação','Domínio','Email','SSL','Backup'].map(c => <option key={c}>{c}</option>)}
              </select>
              <textarea value={form.descricao} onChange={e => setForm({...form, descricao: e.target.value})}
                placeholder="Descreve o teu problema..." rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none" />
              <button onClick={() => { if (form.assunto && form.descricao) setEnviado(true) }}
                disabled={!form.assunto || !form.descricao}
                className="w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-50">
                Enviar Ticket
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Histórico */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
          <h2 className="text-sm font-bold text-gray-700">Histórico de Tickets</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {tickets.map(t => (
            <div key={t.id}>
              <div className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 cursor-pointer"
                onClick={() => setExpanded(expanded === t.id ? null : t.id)}>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-gray-400">{t.id}</span>
                  <span className="text-sm font-medium text-gray-800">{t.assunto}</span>
                  <span className="text-xs text-gray-400">{t.categoria}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${estadoCor(t.estado)}`}>{t.estado}</span>
                  <span className="text-xs text-gray-400">{t.data}</span>
                </div>
              </div>
              {expanded === t.id && t.resposta && (
                <div className="px-5 py-3 bg-green-50 border-t border-green-100">
                  <p className="text-xs font-bold text-green-700 mb-1">Resposta da VisualDesign:</p>
                  <p className="text-sm text-green-800">{t.resposta}</p>
                </div>
              )}
              {expanded === t.id && !t.resposta && (
                <div className="px-5 py-3 bg-yellow-50 border-t border-yellow-100">
                  <p className="text-xs text-yellow-700">Aguardando resposta...</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Componente FacturacaoSection
function FacturacaoSection() {
  const [expanded, setExpanded] = useState<string | null>(null)

  const faturasPendentes = [
    { id: 'FAT-2026-001', descricao: 'Renovação Anual — aamihe.com', valor: 1500, vencimento: '21/10/2026', estado: 'pendente' }
  ]

  const faturasHistorico = [
    { id: 'FAT-2025-001', descricao: 'Renovação Anual — aamihe.com', valor: 1500, dataPagamento: '21/10/2025', metodo: 'M-Pesa', estado: 'pago' },
    { id: 'FAT-2024-001', descricao: 'Registo de Domínio — aamihe.com', valor: 1200, dataPagamento: '21/10/2024', metodo: 'Transferência', estado: 'pago' },
  ]

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-900">Facturação</h1><p className="text-gray-500 mt-1">Faturas, pagamentos e histórico financeiro.</p></div>

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <p className="text-xs font-bold text-gray-400 uppercase mb-1">Total Pago Este Ano</p>
          <p className="text-2xl font-bold text-green-600">1.500 MZN</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <p className="text-xs font-bold text-gray-400 uppercase mb-1">Próxima Fatura</p>
          <p className="text-2xl font-bold text-gray-900">21/10/2026</p>
          <p className="text-xs text-gray-500 mt-1">1.500 MZN</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <p className="text-xs font-bold text-gray-400 uppercase mb-1">Estado da Conta</p>
          <p className="text-2xl font-bold text-green-600">Em dia ✓</p>
        </div>
      </div>

      {/* Faturas Pendentes */}
      {faturasPendentes.length > 0 && (
        <div className="bg-yellow-50 rounded-xl border border-yellow-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-yellow-200">
            <h2 className="text-sm font-bold text-yellow-800">⚠️ Faturas Pendentes</h2>
          </div>
          {faturasPendentes.map(f => (
            <div key={f.id} className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-bold text-gray-900">{f.descricao}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Vencimento: {f.vencimento} • {f.id}</p>
                </div>
                <p className="text-2xl font-bold text-gray-900">{new Intl.NumberFormat('pt-MZ').format(f.valor)} MZN</p>
              </div>
              <button onClick={() => setExpanded(expanded === f.id ? null : f.id)}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors">
                Como Pagar
              </button>
              {expanded === f.id && (
                <div className="mt-4 grid grid-cols-3 gap-3">
                  <div className="bg-white rounded-lg border border-yellow-200 p-4">
                    <p className="text-xs font-bold text-gray-700 mb-2">📱 M-Pesa</p>
                    <p className="text-xs text-gray-600">Envie <strong>{f.valor} MZN</strong> para:</p>
                    <p className="text-sm font-bold text-gray-900 mt-1">848 066 605</p>
                    <p className="text-xs text-gray-500 mt-1">Referência: aamihe.com</p>
                  </div>
                  <div className="bg-white rounded-lg border border-yellow-200 p-4">
                    <p className="text-xs font-bold text-gray-700 mb-2">📱 E-Mola</p>
                    <p className="text-xs text-gray-600">Envie <strong>{f.valor} MZN</strong> para:</p>
                    <p className="text-sm font-bold text-gray-900 mt-1">848 066 605</p>
                    <p className="text-xs text-gray-500 mt-1">Referência: aamihe.com</p>
                  </div>
                  <div className="bg-white rounded-lg border border-yellow-200 p-4">
                    <p className="text-xs font-bold text-gray-700 mb-2">🏦 Transferência</p>
                    <p className="text-xs text-gray-600">Banco: <strong>BCI</strong></p>
                    <p className="text-xs text-gray-600">NIB: <strong>a preencher</strong></p>
                    <p className="text-xs text-gray-500 mt-1">Referência: aamihe.com</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Histórico */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
          <h2 className="text-sm font-bold text-gray-700">Histórico de Pagamentos</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs font-bold text-gray-500 uppercase border-b bg-gray-50">
              <th className="px-5 py-3 text-left">Descrição</th>
              <th className="px-5 py-3 text-left">Valor</th>
              <th className="px-5 py-3 text-left">Data</th>
              <th className="px-5 py-3 text-left">Método</th>
              <th className="px-5 py-3 text-left">Estado</th>
              <th className="px-5 py-3 text-left">Recibo</th>
            </tr>
          </thead>
          <tbody>
            {faturasHistorico.map(f => (
              <tr key={f.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-5 py-3">
                  <p className="font-medium text-gray-800">{f.descricao}</p>
                  <p className="text-xs text-gray-400">{f.id}</p>
                </td>
                <td className="px-5 py-3 font-bold text-gray-900">{new Intl.NumberFormat('pt-MZ').format(f.valor)} MZN</td>
                <td className="px-5 py-3 text-gray-600">{f.dataPagamento}</td>
                <td className="px-5 py-3 text-gray-600">{f.metodo}</td>
                <td className="px-5 py-3"><span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-bold">Pago</span></td>
                <td className="px-5 py-3">
                  <button onClick={() => alert('Recibo disponível em breve!')}
                    className="text-xs text-blue-600 hover:underline font-medium">↓ Recibo</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Componente ContaSection
function ContaSection() {
  const [dados, setDados] = useState({ nome: 'João Silva', email: 'joao@aamihe.com', telefone: '+258 84 123 4567', empresa: 'Aamihe', morada: 'Av. Principal, 123', cidade: 'Maputo' })
  const [pass, setPass] = useState({ actual: '', nova: '', confirmar: '' })
  const [notif, setNotif] = useState({ dias30: true, dias15: true, dias7: true, pagamentos: true, suporte: false })
  const [savedMsg, setSavedMsg] = useState('')
  const [cancelModal, setCancelModal] = useState(false)
  const [motivoCancelamento, setMotivoCancelamento] = useState('')

  const forcaPassword = (p: string) => {
    if (p.length === 0) return { texto: '', cor: '' }
    if (p.length < 6) return { texto: 'Fraca', cor: 'text-red-500' }
    if (p.length < 10) return { texto: 'Média', cor: 'text-yellow-500' }
    return { texto: 'Forte', cor: 'text-green-500' }
  }

  const guardar = () => {
    setSavedMsg('Dados guardados com sucesso!')
    setTimeout(() => setSavedMsg(''), 3000)
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-900">A Minha Conta</h1><p className="text-gray-500 mt-1">Gere os teus dados pessoais e preferências.</p></div>

      <div className="grid grid-cols-2 gap-6">
        {/* Dados Pessoais */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-bold text-gray-700 mb-4">Dados Pessoais</h2>
          <div className="space-y-3">
            {[
              { label: 'Nome Completo', field: 'nome' },
              { label: 'Email', field: 'email' },
              { label: 'Telefone', field: 'telefone' },
              { label: 'Empresa', field: 'empresa' },
              { label: 'Morada', field: 'morada' },
              { label: 'Cidade', field: 'cidade' },
            ].map(({ label, field }) => (
              <div key={field}>
                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">{label}</label>
                <input value={(dados as any)[field]} onChange={e => setDados({...dados, [field]: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
            ))}
            {savedMsg && <p className="text-green-600 text-xs font-bold bg-green-50 border border-green-200 rounded px-3 py-2">{savedMsg}</p>}
            <button onClick={guardar}
              className="w-full bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-lg text-sm font-bold transition-colors">
              Guardar Alterações
            </button>
          </div>
        </div>

        <div className="space-y-5">
          {/* Alterar Password */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h2 className="text-sm font-bold text-gray-700 mb-4">Alterar Password</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Password Actual</label>
                <input type="password" value={pass.actual} onChange={e => setPass({...pass, actual: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Nova Password</label>
                <input type="password" value={pass.nova} onChange={e => setPass({...pass, nova: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                {pass.nova && <p className={`text-xs font-bold mt-1 ${forcaPassword(pass.nova).cor}`}>Força: {forcaPassword(pass.nova).texto}</p>}
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Confirmar Nova Password</label>
                <input type="password" value={pass.confirmar} onChange={e => setPass({...pass, confirmar: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                {pass.confirmar && pass.nova !== pass.confirmar && <p className="text-xs text-red-500 font-bold mt-1">Passwords não coincidem</p>}
              </div>
              <button disabled={!pass.actual || !pass.nova || pass.nova !== pass.confirmar}
                className="w-full bg-gray-800 hover:bg-gray-900 text-white py-2.5 rounded-lg text-sm font-bold transition-colors disabled:opacity-50">
                Alterar Password
              </button>
            </div>
          </div>

          {/* Notificações */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h2 className="text-sm font-bold text-gray-700 mb-4">Notificações por Email</h2>
            <div className="space-y-3">
              {[
                { key: 'dias30', label: 'Aviso de renovação 30 dias antes' },
                { key: 'dias15', label: 'Aviso de renovação 15 dias antes' },
                { key: 'dias7', label: 'Aviso de renovação 7 dias antes' },
                { key: 'pagamentos', label: 'Confirmação de pagamentos' },
                { key: 'suporte', label: 'Respostas de suporte' },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">{label}</span>
                  <button onClick={() => setNotif({...notif, [key]: !(notif as any)[key]})}
                    className={`w-10 h-5 rounded-full transition-colors ${(notif as any)[key] ? 'bg-red-600' : 'bg-gray-300'} relative`}>
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${(notif as any)[key] ? 'left-5' : 'left-0.5'}`}></span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Informações do Serviço */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h2 className="text-sm font-bold text-gray-700 mb-4">Informações do Serviço</h2>
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Domínio', value: 'aamihe.com' },
            { label: 'Plano', value: 'Premium' },
            { label: 'Data de Início', value: '21/10/2024' },
            { label: 'Data de Renovação', value: '21/10/2026' },
            { label: 'Valor Anual', value: '1.500 MZN' },
            { label: 'SSL', value: '✅ Activo' },
            { label: 'Estado', value: '🟢 Activo' },
            { label: 'PHP', value: '8.2' },
          ].map(({ label, value }) => (
            <div key={label} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <p className="text-xs font-bold text-gray-400 uppercase mb-1">{label}</p>
              <p className="text-sm font-bold text-gray-900">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Zona de Perigo */}
      <div className="bg-red-50 rounded-xl border border-red-200 p-5">
        <h2 className="text-sm font-bold text-red-700 mb-2">⚠️ Zona de Perigo</h2>
        <p className="text-xs text-red-600 mb-4">Acções irreversíveis. Procede com cautela.</p>
        <button onClick={() => setCancelModal(true)}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors">
          Solicitar Cancelamento do Serviço
        </button>
      </div>

      {/* Modal Cancelamento */}
      {cancelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Solicitar Cancelamento</h2>
            <p className="text-sm text-gray-500 mb-4">Lamenta-mos que queiras cancelar. Indica o motivo para podermos melhorar.</p>
            <textarea value={motivoCancelamento} onChange={e => setMotivoCancelamento(e.target.value)}
              placeholder="Motivo do cancelamento..." rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none mb-4" />
            <div className="flex gap-3">
              <button onClick={() => { alert('Pedido de cancelamento enviado. Entraremos em contacto.'); setCancelModal(false) }}
                disabled={!motivoCancelamento}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-lg text-sm font-bold disabled:opacity-50">
                Confirmar Cancelamento
              </button>
              <button onClick={() => setCancelModal(false)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-lg text-sm font-bold">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Secções que precisam de criar websites
function CreateWebsiteSection({ packages, onRefresh }: { packages: CyberPanelPackage[], onRefresh: () => void }) {
  const [form, setForm] = useState({ domain: '', email: '', username: 'admin', packageName: 'Default', php: '8.2' })
  const [creating, setCreating] = useState(false)
  const [msg, setMsg] = useState('')

  const handleCreate = async () => {
    if (!form.domain || !form.email) return
    setCreating(true); setMsg('')
    try {
      const ok = await cyberPanelAPI.createWebsite(form)
      setMsg('Website criado com sucesso!')
      onRefresh()
    } catch (e: any) {
      setMsg('Erro: ' + e.message)
    }
    setCreating(false)
  }

  return (
    <div className="space-y-6 w-full">
      <div><h1 className="text-3xl font-bold text-gray-900">Criar Website</h1><p className="text-gray-500 mt-1">Adicione um novo website ao servidor.</p></div>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div><label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Domínio</label><input value={form.domain} onChange={e => setForm({...form, domain: e.target.value})} placeholder="exemplo.com" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" /></div>
          <div><label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Email Admin</label><input value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="admin@exemplo.com" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" /></div>
          <div><label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Pacote</label>
            <select value={form.packageName} onChange={e => setForm({...form, packageName: e.target.value})} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm">
              <option value="Default">Default</option>
              {packages.map(p => <option key={p.packageName} value={p.packageName}>{p.packageName}</option>)}
            </select>
          </div>
          <div><label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Versão PHP</label>
            <select value={form.php} onChange={e => setForm({...form, php: e.target.value})} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm">
              <option>7.4</option><option>8.0</option><option>8.1</option><option>8.2</option><option>8.3</option>
            </select>
          </div>
        </div>
        {msg && <div className={`mb-4 px-4 py-2.5 rounded-lg text-sm font-medium ${msg.includes('sucesso') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{msg}</div>}
        <button onClick={handleCreate} disabled={creating || !form.domain || !form.email} className="bg-black hover:bg-red-600 text-white px-5 py-2.5 rounded-lg text-sm font-bold transition-all disabled:opacity-50 flex items-center gap-2">
          {creating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />} Criar Website
        </button>
      </div>
    </div>
  )
}

function ListWebsitesSection({ sites, onRefresh, packages, setActiveSection, setFileManagerDomain, setSelectedDNSDomain, loadCyberPanelData, syncing, handleSync }: {
  sites: CyberPanelWebsite[], 
  onRefresh: () => void, 
  packages: CyberPanelPackage[],
  setActiveSection: (section: string) => void,
  setFileManagerDomain: (domain: string) => void,
  setSelectedDNSDomain: (domain: string) => void,
  loadCyberPanelData: () => void,
  syncing: boolean,
  handleSync: () => void
}) {
  const parseState = (state: any) => {
    if (state === 1 || state === '1' || state === 'Active') return 'Active'
    if (state === 0 || state === '0' || state === 'Suspended') return 'Suspended'
    return state || 'Active'
  }
  const [expandedSite, setExpandedSite] = useState<string | null>(null)
  const [editingField, setEditingField] = useState<{domain: string, field: string} | null>(null)
  const [editValue, setEditValue] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 4
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState({ domain: '', email: '', username: 'admin', packageName: 'Default', php: 'PHP 8.2' })
  const [creating, setCreating] = useState(false)
  const [createMsg, setCreateMsg] = useState('')

  // Filtrar sites activos — tem conteúdo real instalado
  const sitesArray = Array.isArray(sites) ? sites : []
  const filtered = sitesArray.filter(s => 
    s.domain.toLowerCase().includes(search.toLowerCase()) &&
    !s.domain.includes('contaboserver') &&
    !s.domain.includes('localhost') &&
    s.isActive === true
  )

  const totalPages = Math.ceil(filtered.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedSites = filtered.slice(startIndex, startIndex + itemsPerPage)

  // Expandir automaticamente o primeiro site ao carregar
  useEffect(() => {
    if (paginatedSites.length > 0 && !expandedSite) {
      setExpandedSite(paginatedSites[0].domain)
    }
  }, [paginatedSites])

  const handleDelete = async (domain: string) => {
    if (!confirm(`⚠️ Apagar "${domain}"?\n\nEsta acção é IRREVERSÍVEL — o site e todos os seus ficheiros serão eliminados do servidor!`)) return
    setLoading(domain)
    try {
      const res = await fetch('/api/server-exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deleteWebsite', params: { domain } })
      })
      const data = await res.json()
      if (data.success) {
        await onRefresh()
      } else {
        alert('Erro ao apagar:\n\n' + (data.data?.output || data.error || 'Erro desconhecido'))
      }
    } catch (e: any) {
      alert('Erro de ligação: ' + e.message)
    }
    setLoading(null)
  }

  const handleSuspend = async (domain: string, state: string) => {
  setLoading(domain)
  const action = state === 'Active' ? 'suspendWebsite' : 'unsuspendWebsite'
  await fetch('/api/server-exec', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, params: { domain } })
  })
  await onRefresh()
  setLoading(null)
}

  const handleSaveField = async (domain: string, field: string, value: string) => {
  setLoading(domain)
  let command = ''
  
  if (field === 'php') {
    command = `cyberpanel changePHP --domainName ${domain} --phpVersion "${value}" 2>&1`
  } else if (field === 'package') {
    command = `cyberpanel changePackage --domainName ${domain} --packageName "${value}" 2>&1`
  } else {
    // Para outros campos, usa modifyWebsite
    await fetch('/api/server-exec', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'modifyWebsite', params: { domain, [field]: value } })
    })
    setEditingField(null)
    await onRefresh()
    setLoading(null)
    return
  }
  
  const res = await fetch('/api/server-exec', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'execCommand', params: { command } })
  })
  const data = await res.json()
  if (!data.success) {
    alert('Erro: ' + (data.data?.output || data.error || 'desconhecido'))
  }
  setEditingField(null)
  await onRefresh()
  setLoading(null)
}

  const EditableField = ({ domain, field, value, label }: { domain: string, field: string, value: string, label: string }) => {
    const isEditing = editingField?.domain === domain && editingField?.field === field
    return (
      <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
        <p className="text-xs font-bold text-gray-400 uppercase mb-1">{label}</p>
        {isEditing ? (
          <div className="flex items-center gap-2">
            {field === 'php' ? (
              <select value={editValue} onChange={e => setEditValue(e.target.value)}
                className="text-sm border border-gray-300 rounded px-2 py-1 bg-white flex-1">
                <option>PHP 7.4</option><option>PHP 8.0</option>
                <option>PHP 8.1</option><option>PHP 8.2</option><option>PHP 8.3</option>
              </select>
            ) : field === 'package' ? (
              <select value={editValue} onChange={e => setEditValue(e.target.value)}
                className="text-sm border border-gray-300 rounded px-2 py-1 bg-white flex-1">
                <option>Default</option>
                {packages.map(p => <option key={p.packageName}>{p.packageName}</option>)}
              </select>
            ) : (
              <input value={editValue} onChange={e => setEditValue(e.target.value)}
                className="text-sm border border-gray-300 rounded px-2 py-1 flex-1" />
            )}
            <button onClick={() => handleSaveField(domain, field, editValue)}
              className="text-xs bg-black text-white px-2 py-1 rounded font-bold">✓</button>
            <button onClick={() => setEditingField(null)}
              className="text-xs bg-gray-200 px-2 py-1 rounded">✕</button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-gray-900">{value || '-'}</p>
            <button onClick={() => { setEditingField({ domain, field }); setEditValue(value) }}
              className="text-gray-400 hover:text-blue-500 ml-2">
              <Edit className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-base font-bold text-gray-900">Websites ({filtered.length})</span>
          <button onClick={handleSync} disabled={syncing}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50">
            <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'A sincronizar...' : 'Sincronizar'}
          </button>
          <button onClick={() => setShowCreateModal(true)}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors">
            <Plus className="w-3 h-3" /> Criar Website
          </button>
          <button onClick={() => {
            const rows = [['Domínio','IP','Estado','Pacote']]
            sites.forEach(s => rows.push([s.domain, '109.199.104.22', s.state || 'Active', (s as any).package || 'Default']))
            const blob = new Blob([rows.map(r => r.join(',')).join('\n')], { type: 'text/csv' })
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'websites.csv'; a.click()
          }} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-xs font-bold">
            ↓ Exportar CSV
          </button>
        </div>
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Pesquisar websites..."
            className="pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm w-52" />
        </div>
      </div>

      {msg && <div className="px-4 py-2.5 rounded-lg text-sm bg-green-50 text-green-700 border border-green-200">{msg}</div>}

      {/* Lista de sites como cards expansíveis */}
      <div className="space-y-2">
        {paginatedSites.map((s, i) => (
          <div key={i} className={`bg-white rounded-xl border ${expandedSite === s.domain ? 'border-blue-200 shadow-md' : 'border-gray-200 shadow-sm'} overflow-hidden transition-all`}>
            
            {/* Linha do site com botões explícitos */}
            <div className="flex items-center justify-between px-4 py-4">
              
              {/* Info do site */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setExpandedSite(expandedSite === s.domain ? null : s.domain)}
                  className="p-1 rounded hover:bg-gray-100 transition-colors"
                  title="Expandir/Colapsar"
                >
                  <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${expandedSite === s.domain ? 'rotate-90' : ''}`} />
                </button>
                <Globe className="w-4 h-4 text-blue-500" />
                <a href={`https://${s.domain}`} target="_blank"
                  className="text-blue-600 hover:underline font-bold text-sm">
                  {s.domain}
                </a>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${parseState(s.state) === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {parseState(s.state) || 'Active'}
                </span>
                {/* Badge por tipo de site */}
                {s.siteType === 'wordpress' && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">WordPress</span>}
                {s.siteType === 'nextjs' && <span className="px-2 py-0.5 bg-black text-white rounded-full text-xs font-bold">Next.js</span>}
                {s.siteType === 'html' && <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-bold">HTML/PHP</span>}
                {s.ssl ? (
                  <span className="flex items-center gap-1 text-green-600 text-xs font-bold">
                    <Lock className="w-3.5 h-3.5" /> SSL Activo
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-red-500 text-xs font-bold">
                    <LockOpen className="w-3.5 h-3.5" /> Sem SSL
                  </span>
                )}
              </div>

              {/* Botões */}
              <div className="flex items-center gap-3">
                {/* Botão Gerir — abre cards de gestão */}
                <button
                  onClick={() => setExpandedSite(expandedSite === s.domain ? null : s.domain)}
                  className="bg-black hover:bg-red-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-colors">
                  Gerir
                </button>
                
                {/* Botão Explorar Directório — sem fundo, texto link */}
                <button
                  onClick={() => {
                    setFileManagerDomain(s.domain)
                    setTimeout(() => setActiveSection('file-manager'), 50)
                  }}
                  className="text-gray-600 hover:text-red-600 text-xs font-medium transition-colors underline-offset-2 hover:underline">
                  Explorar directório
                </button>
              </div>
            </div>

            {/* Conteúdo expandido */}
            {expandedSite === s.domain && (
              <div className="border-t border-gray-100 p-4 space-y-4">
                
                {/* Grid de cards de detalhes editáveis */}
                <div className="grid grid-cols-4 gap-3">

                  {/* COLUNA 1 — Screenshot */}
                  <div className="bg-gray-100 rounded-lg overflow-hidden border border-gray-200 h-36 relative">
                    <iframe
                      src={`https://${s.domain}`}
                      className="absolute top-0 left-0"
                      style={{ width: '400%', height: '400%', transform: 'scale(0.25)', transformOrigin: 'top left', pointerEvents: 'none' }}
                      scrolling="no"
                      sandbox="allow-same-origin"
                    />
                  </div>

                  {/* COLUNA 2 — State + Disk Usage */}
                  <div className="flex flex-col gap-3">
                    <EditableField domain={s.domain} field="state" value={parseState(s.state) || 'Active'} label="State" />
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                      <p className="text-xs font-bold text-gray-400 uppercase mb-1">Disk Usage</p>
                      <p className="text-sm font-bold text-gray-900">{(s as any).diskUsed ? `${(s as any).diskUsed}MB` : '0MB'}</p>
                    </div>
                  </div>

                  {/* COLUNA 3 — IP + Package */}
                  <div className="flex flex-col gap-3">
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                      <p className="text-xs font-bold text-gray-400 uppercase mb-1">IP Address</p>
                      <p className="text-sm font-bold text-gray-900">{(s as any).ip || '109.199.104.22'}</p>
                    </div>
                    <EditableField domain={s.domain} field="package" value={(s as any).package || 'Default'} label="Package" />
                  </div>

                  {/* COLUNA 4 — PHP + Owner */}
                  <div className="flex flex-col gap-3">
                    <EditableField domain={s.domain} field="php" value={(s as any).phpVersion || 'PHP 8.2'} label="PHP Version" />
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                      <p className="text-xs font-bold text-gray-400 uppercase mb-1">Owner</p>
                      <p className="text-sm font-bold text-gray-900">{(s as any).owner || 'admin'}</p>
                    </div>
                  </div>

                </div>

                {/* Botões de acção numa linha */}
                <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                  <a href={`https://${s.domain}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors">
                    <ExternalLink className="w-3.5 h-3.5" /> Visitar Site
                  </a>
                  <button
                    onClick={async () => {
                      setLoading(s.domain + '-ssl')
                      try {
                        // Primeiro verificar se o domínio resolve para o IP correcto
                        const checkRes = await fetch('/api/server-exec', {
                          method: 'POST', headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            action: 'execCommand',
                            params: { command: `dig +short ${s.domain} 2>&1` }
                          })
                        })
                        const checkData = await checkRes.json()
                        const resolvedIP = (checkData.data?.output || '').trim()
                        const serverIP = '109.199.104.22'

                        if (!resolvedIP) {
                          alert(`⚠️ DNS não propagou ainda!\n\nO domínio "${s.domain}" não está a resolver para nenhum IP.\n\nAguarda a propagação DNS (pode demorar até 24h) e tenta novamente.`)
                          setLoading(null)
                          return
                        }

                        if (!resolvedIP.includes(serverIP)) {
                          alert(`⚠️ DNS ainda não propagou!\n\nO domínio "${s.domain}" está a resolver para:\n${resolvedIP}\n\nMas devia resolver para:\n${serverIP}\n\nAguarda a propagação DNS e tenta novamente.`)
                          setLoading(null)
                          return
                        }

                        // DNS está correcto — emitir SSL
                        const sslRes = await fetch('/api/server-exec', {
                          method: 'POST', headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            action: 'execCommand',
                            params: { command: `cyberpanel issueSSL --domainName ${s.domain} 2>&1` }
                          })
                        })
                        const sslData = await sslRes.json()
                        const output = sslData.data?.output || ''

                        if (output.toLowerCase().includes('success') || output.toLowerCase().includes('issued')) {
                          alert(`✅ SSL emitido com sucesso para ${s.domain}!`)
                          onRefresh()
                        } else {
                          alert(`⚠️ Erro ao emitir SSL:\n\n${output}`)
                        }

                      } catch (e: any) {
                        alert('Erro: ' + e.message)
                      }
                      setLoading(null)
                    }} disabled={loading === s.domain + '-ssl'}
                    className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors disabled:opacity-50">
                    <Lock className="w-3.5 h-3.5" /> {loading === s.domain + '-ssl' ? 'A verificar...' : 'Issue SSL'}
                  </button>
                  <button
                    onClick={() => {
                      setSelectedDNSDomain(s.domain)
                      setActiveSection('domains-dns')
                    }}
                    className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors">
                    <Server className="w-3.5 h-3.5" /> Editar DNS
                  </button>
                  <button onClick={async () => {
                    setLoading(s.domain + '-backup')
                    try {
                      await fetch('/api/server-exec', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          action: 'execCommand',
                          params: { command: `mkdir -p /home/backup/full && cyberpanel createBackup --domainName ${s.domain} --backupPath /home/backup/full 2>&1` }
                        })
                      })
                      alert(`✅ Backup de "${s.domain}" criado com sucesso!\n\nPode ver na página Backups.`)
                    } catch (e: any) {
                      alert('Erro ao criar backup: ' + e.message)
                    }
                    setLoading(null)
                  }}
                  disabled={loading === s.domain + '-backup'}
                  className="flex items-center gap-1.5 bg-gray-700 hover:bg-gray-800 text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors disabled:opacity-50">
                    {loading === s.domain + '-backup' 
                      ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      : <Archive className="w-3.5 h-3.5" />
                    }
                    {loading === s.domain + '-backup' ? 'A criar...' : 'Backup'}
                  </button>
                  <button onClick={() => handleSuspend(s.domain, parseState(s.state) || 'Active')}
                    className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors">
                    <Power className="w-3.5 h-3.5" /> {parseState(s.state) === 'Active' ? 'Suspender' : 'Activar'}
                  </button>
                  <button onClick={() => handleDelete(s.domain)} disabled={loading === s.domain}
                    className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors disabled:opacity-50">
                    <Trash2 className="w-3.5 h-3.5" /> {loading === s.domain ? 'A apagar...' : 'Apagar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 rounded-lg text-xs font-bold bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Anterior
          </button>
          
          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${
                  currentPage === page
                    ? 'bg-red-600 text-white'
                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {page}
              </button>
            ))}
          </div>
          
          <button
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="px-4 py-2 rounded-lg text-xs font-bold bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Próximo
          </button>
        </div>
      )}

      {/* Modal de criação de website */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-gray-900">Criar Novo Website</h2>
              <button onClick={() => { setShowCreateModal(false); setCreateMsg('') }}
                className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Domínio</label>
                <input value={createForm.domain} onChange={e => setCreateForm({...createForm, domain: e.target.value})}
                  placeholder="exemplo.com"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Email Admin</label>
                <input value={createForm.email} onChange={e => setCreateForm({...createForm, email: e.target.value})}
                  placeholder="admin@exemplo.com"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Pacote</label>
                <select value={createForm.packageName} onChange={e => setCreateForm({...createForm, packageName: e.target.value})}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm">
                  <option>Default</option>
                  {packages.map(p => <option key={p.packageName} value={p.packageName}>{p.packageName}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Versão PHP</label>
                <select value={createForm.php} onChange={e => setCreateForm({...createForm, php: e.target.value})}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm">
                  <option>PHP 7.4</option><option>PHP 8.0</option>
                  <option>PHP 8.1</option><option>PHP 8.2</option><option>PHP 8.3</option>
                </select>
              </div>
            </div>
            {createMsg && (
              <div className={`mt-4 px-4 py-2.5 rounded-lg text-sm font-medium ${createMsg.includes('sucesso') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {createMsg}
              </div>
            )}
            <div className="flex gap-3 mt-6">
              <button onClick={async () => {
                if (!createForm.domain || !createForm.email) return
                setCreating(true); setCreateMsg('')
                const res = await fetch('/api/server-exec', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action: 'createWebsite', params: createForm })
                })
                const data = await res.json()
                if (data.success) {
                  setCreateMsg('Website criado com sucesso!')
                  setTimeout(() => { setShowCreateModal(false); setCreateMsg(''); onRefresh() }, 1500)
                } else {
                  setCreateMsg('Erro: ' + (data.data?.output || data.error || 'desconhecido'))
                }
                setCreating(false)
              }} disabled={creating || !createForm.domain || !createForm.email}
                className="flex-1 bg-black hover:bg-red-600 text-white py-2.5 rounded-lg text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {creating ? <><RefreshCw className="w-4 h-4 animate-spin" /> A criar...</> : '+ Criar Website'}
              </button>
              <button onClick={() => { setShowCreateModal(false); setCreateMsg('') }}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-lg text-sm font-bold">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )}

export default function AdminPage() {
  const [activeSection, setActiveSection] = useState('dashboard')
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [fileManagerDomain, setFileManagerDomain] = useState('')
  const [cyberPanelSites, setCyberPanelSites] = useState<CyberPanelWebsite[]>([])
  const [cyberPanelUsers, setCyberPanelUsers] = useState<CyberPanelUser[]>([])
  const [cyberPanelPackages, setCyberPanelPackages] = useState<CyberPanelPackage[]>([])
  const [isFetchingCyberPanel, setIsFetchingCyberPanel] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [selectedDNSDomain, setSelectedDNSDomain] = useState<string>('')
  
  // Estados para gestão de contas de email
  const [mostrarAdicionarConta, setMostrarAdicionarConta] = useState(false)
  const [modalAdicionarPasso, setModalAdicionarPasso] = useState<'escolher'|'webmail'|'google'|'hotmail'>('escolher')

  useEffect(() => {
    loadCyberPanelData()
  }, [])

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/server-exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'listWebsites', params: {} })
      })
      const data = await res.json()
      // CORRIGIR — garantir que usa data.data.sites e não data.data
      const sites = Array.isArray(data.data?.sites) ? data.data.sites : 
                    Array.isArray(data.data) ? data.data : []
      if (data.success) setCyberPanelSites(sites)
    } catch (e) { console.error(e) }
    setSyncing(false)
  }

  const loadCyberPanelData = async () => {
    setIsFetchingCyberPanel(true)
    try {
      const [sites, users, packages] = await Promise.all([
        cyberPanelAPI.listWebsites().catch(() => []),
        cyberPanelAPI.listUsers().catch(() => []),
        cyberPanelAPI.listPackages().catch(() => []),
      ])
      setCyberPanelSites(Array.isArray(sites) ? sites : [])
      setCyberPanelUsers(Array.isArray(users) ? users : [])
      setCyberPanelPackages(Array.isArray(packages) ? packages : [])
    } catch (error) {
      console.error('Erro ao carregar dados CyberPanel:', error)
    } finally {
      setIsFetchingCyberPanel(false)
    }
  }

  // Definir domínio principal
  const primaryDomain = cyberPanelSites.length > 0 
    ? cyberPanelSites.find(s => !s.domain.includes('contaboserver'))?.domain || cyberPanelSites[0].domain
    : 'visualdesigne.com'

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'domains', label: 'O Meu Site', icon: Globe },
    { id: 'emails-new', label: 'Email', icon: Mail },
    { id: 'tickets', label: 'Suporte', icon: Users },
    { id: 'faturas', label: 'Faturas', icon: FileText },
    { id: 'conta', label: 'Conta', icon: Settings },
  ]

  const currentSidebarWidth = isCollapsed ? 80 : 250

  const renderSection = () => {
    switch (activeSection) {
      case 'dashboard':
        return <ClienteDashboardHome />
      case 'emails-new':
        return <EmailWebmailSection 
          mostrarAdicionarConta={mostrarAdicionarConta}
          setMostrarAdicionarConta={setMostrarAdicionarConta}
          modalAdicionarPasso={modalAdicionarPasso}
          setModalAdicionarPasso={setModalAdicionarPasso}
        />
      case 'domains':
  return <ListWebsitesSection
    sites={cyberPanelSites.filter(s => s.domain === 'visualdesigne.com')}
    onRefresh={loadCyberPanelData}
    packages={cyberPanelPackages}
    setActiveSection={setActiveSection}
    setFileManagerDomain={setFileManagerDomain}
    setSelectedDNSDomain={setSelectedDNSDomain}
    loadCyberPanelData={loadCyberPanelData}
    syncing={syncing}
    handleSync={handleSync}
  />
      case 'domains-list':
        return <ListWebsitesSection 
        sites={cyberPanelSites} 
        onRefresh={loadCyberPanelData} 
        packages={cyberPanelPackages}
        setActiveSection={setActiveSection}
        setFileManagerDomain={setFileManagerDomain}
        setSelectedDNSDomain={setSelectedDNSDomain}
        loadCyberPanelData={loadCyberPanelData}
        syncing={syncing}
        handleSync={handleSync}
      />
      case 'file-manager':
      case 'cp-file-manager':
        return <FileManagerSection domain={fileManagerDomain || 'visualdesigne.com'} sites={cyberPanelSites} />
      case 'tickets':
        return <SuporteSection />
      case 'faturas':
        return <FacturacaoSection />
      case 'conta':
        return <ContaSection />
      case 'domains-new':
        // return <CreateWebsiteSection packages={cyberPanelPackages} onRefresh={loadCyberPanelData} /> // Removido - não usado no painel do cliente
        return <div className="p-6"><h1 className="text-2xl font-bold">Criar Website</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      case 'cp-subdomains':
        // return <SubdomainsSection sites={cyberPanelSites} /> // Removido - não usado no painel do cliente
        return <div className="p-6"><h1 className="text-2xl font-bold">Subdomínios</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      case 'cp-list-subdomains':
        // return <ListSubdomainsSection sites={cyberPanelSites} /> // Removido - não usado no painel do cliente
        return <div className="p-6"><h1 className="text-2xl font-bold">Listar Subdomínios</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      case 'cp-modify-website':
        // return <ModifyWebsiteSection sites={cyberPanelSites} packages={cyberPanelPackages} /> // Removido - não usado no painel do cliente
        return <div className="p-6"><h1 className="text-2xl font-bold">Modificar Website</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      case 'cp-suspend-website':
        // return <SuspendWebsiteSection sites={cyberPanelSites} onRefresh={loadCyberPanelData} /> // Removido - não usado no painel do cliente
        return <div className="p-6"><h1 className="text-2xl font-bold">Suspender Website</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      case 'cp-delete-website':
        // return <DeleteWebsiteSection sites={cyberPanelSites} onRefresh={loadCyberPanelData} /> // Removido - não usado no painel do cliente
        return <div className="p-6"><h1 className="text-2xl font-bold">Apagar Website</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      case 'cp-databases':
        // return <DatabasesSection sites={cyberPanelSites} /> // Removido - não usado no painel do cliente
        return <div className="p-6"><h1 className="text-2xl font-bold">Bases de Dados</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      case 'cp-ftp':
        // return <FTPSection sites={cyberPanelSites} /> // Removido - não usado no painel do cliente
        return <div className="p-6"><h1 className="text-2xl font-bold">FTP</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      case 'cp-email-delete':
        // return <EmailDeleteSection sites={cyberPanelSites} /> // Removido - não usado no painel do cliente
        return <div className="p-6"><h1 className="text-2xl font-bold">Apagar Email</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      case 'cp-email-limits':
        // return <EmailLimitsSection sites={cyberPanelSites} /> // Removido - não usado no painel do cliente
        return <div className="p-6"><h1 className="text-2xl font-bold">Limites de Email</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      case 'cp-email-forwarding':
        // return <EmailForwardingSection sites={cyberPanelSites} /> // Removido - não usado no painel do cliente
        return <div className="p-6"><h1 className="text-2xl font-bold">Encaminhamento de Email</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      case 'cp-email-catchall':
        // return <CatchAllEmailSection sites={cyberPanelSites} /> // Removido - não usado no painel do cliente
        return <div className="p-6"><h1 className="text-2xl font-bold">Catch All Email</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      case 'cp-email-pattern-fwd':
        // return <PatternForwardingSection sites={cyberPanelSites} /> // Removido - não usado no painel do cliente
        return <div className="p-6"><h1 className="text-2xl font-bold">Pattern Forwarding</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      case 'cp-email-plus-addr':
        // return <PlusAddressingSection sites={cyberPanelSites} /> // Removido - não usado no painel do cliente
        return <div className="p-6"><h1 className="text-2xl font-bold">Plus Addressing</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      case 'cp-email-change-pass':
        // return <EmailChangePasswordSection sites={cyberPanelSites} /> // Removido - não usado no painel do cliente
        return <div className="p-6"><h1 className="text-2xl font-bold">Alterar Senha Email</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      case 'cp-email-dkim':
        // return <DKIMManagerSection sites={cyberPanelSites} /> // Removido - não usado no painel do cliente
        return <div className="p-6"><h1 className="text-2xl font-bold">DKIM Manager</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      case 'cp-users':
        // return <CPUsersSection /> // Removido - não usado no painel do cliente
        return <div className="p-6"><h1 className="text-2xl font-bold">Utilizadores</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      case 'cp-reseller':
        // return <ResellerSection /> // Removido - não usado no painel do cliente
        return <div className="p-6"><h1 className="text-2xl font-bold">Revenda</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      case 'cp-ssl':
        // return <SSLSection sites={cyberPanelSites} /> // Removido - não usado no painel do cliente
        return <div className="p-6"><h1 className="text-2xl font-bold">SSL</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      case 'cp-security':
        // return <SecuritySection sites={cyberPanelSites} /> // Removido - não usado no painel do cliente
        return <div className="p-6"><h1 className="text-2xl font-bold">Segurança</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      case 'cp-php':
        // return <PHPConfigSection sites={cyberPanelSites} /> // Removido - não usado no painel do cliente
        return <div className="p-6"><h1 className="text-2xl font-bold">Configuração PHP</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      case 'cp-api':
      case 'infrastructure':
        // return <APIConfigSection /> // Removido - não usado no painel do cliente
        return <div className="p-6"><h1 className="text-2xl font-bold">Configurações</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      case 'cp-wp-list':
        // return <WPListSection sites={cyberPanelSites} setFileManagerDomain={setFileManagerDomain} setActiveSection={setActiveSection} /> // Removido - não usado no painel do cliente
        return <div className="p-6"><h1 className="text-2xl font-bold">WordPress</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      case 'cp-wp-plugins':
        // return <WPPluginsSection sites={cyberPanelSites} /> // Removido - não usado no painel do cliente
        return <div className="p-6"><h1 className="text-2xl font-bold">Plugins WordPress</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      case 'cp-wp-restore-backup':
        // return <WPRestoreBackupSection sites={cyberPanelSites} /> // Removido - não usado no painel do cliente
        return <div className="p-6"><h1 className="text-2xl font-bold">Restaurar Backup WordPress</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      case 'cp-wp-remote-backup':
        // return <WPRemoteBackupSection sites={cyberPanelSites} /> // Removido - não usado no painel do cliente
        return <div className="p-6"><h1 className="text-2xl font-bold">Backup Remoto WordPress</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      case 'cp-dns-nameserver':
        // return <DNSNameserverSection sites={cyberPanelSites} /> // Removido - não usado no painel do cliente
        return <div className="p-6"><h1 className="text-2xl font-bold">Nameservers DNS</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      case 'cp-dns-default-ns':
        // return <DNSDefaultNSSection /> // Removido - não usado no painel do cliente
        return <div className="p-6"><h1 className="text-2xl font-bold">Default Nameservers</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      case 'cp-dns-create-zone':
        // return <DNSCreateZoneSection sites={cyberPanelSites} /> // Removido - não usado no painel do cliente
        return <div className="p-6"><h1 className="text-2xl font-bold">Criar Zona DNS</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      case 'domains-dns':
        return <DNSZoneEditorSection 
          sites={cyberPanelSites} 
          initialDomain={selectedDNSDomain || primaryDomain} 
        />
      case 'cp-dns-delete-zone':
        // return <DNSDeleteZoneSection sites={cyberPanelSites} /> // Removido - não usado no painel do cliente
        return <div className="p-6"><h1 className="text-2xl font-bold">Apagar Zona DNS</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      case 'cp-dns-cloudflare':
        // return <CloudFlareSection sites={cyberPanelSites} /> // Removido - não usado no painel do cliente
        return <div className="p-6"><h1 className="text-2xl font-bold">Cloudflare</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      case 'cp-dns-reset':
        // return <DNSResetSection sites={cyberPanelSites} /> // Removido - não usado no painel do cliente
        return <div className="p-6"><h1 className="text-2xl font-bold">Reset DNS</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      case 'cp-dns-zone-editor':
        return <DNSZoneEditorSection sites={cyberPanelSites} />
      case 'git-deploy':
        // return <GitDeploySection /> // Removido - não usado no painel do cliente
        return <div className="p-6"><h1 className="text-2xl font-bold">Deploy GitHub</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      case 'backup-manager':
      case 'cp-backup':
        // return <BackupManagerSection sites={cyberPanelSites} /> // Removido - não usado no painel do cliente
        return <div className="p-6"><h1 className="text-2xl font-bold">Backups</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      case 'wordpress-install':
        // return <WordPressInstallSection sites={cyberPanelSites} /> // Removido - não usado no painel do cliente
        return <div className="p-6"><h1 className="text-2xl font-bold">Instalar WordPress</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      case 'cp-wp-backup':
        // return <WPBackupSection sites={cyberPanelSites} /> // Removido - não usado no painel do cliente
        return <div className="p-6"><h1 className="text-2xl font-bold">Backup WordPress</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      case 'domain-manager':
        // return <DomainManagerSection sites={cyberPanelSites} /> // Removido - não usado no painel do cliente
        return <div className="p-6"><h1 className="text-2xl font-bold">Gestor de Domínios</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      case 'deploy':
        // return <DeploySection sites={cyberPanelSites} /> // Removido - não usado no painel do cliente
        return <div className="p-6"><h1 className="text-2xl font-bold">Deploy</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      case 'packages-list':
        // return <PackagesSection packages={cyberPanelPackages} onRefresh={loadCyberPanelData} /> // Removido - não usado no painel do cliente
        return <div className="p-6"><h1 className="text-2xl font-bold">Pacotes</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      default:
        return <CpanelDashboard sites={cyberPanelSites} users={cyberPanelUsers} isFetching={isFetchingCyberPanel} onNavigate={setActiveSection} onRefresh={loadCyberPanelData} onSetFileManagerDomain={setFileManagerDomain} />
    }
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <div
        className="relative bg-white border-r border-gray-200 text-gray-800 flex flex-col shadow-sm"
        style={{ width: `${currentSidebarWidth}px` }}
      >
        {/* Sidebar Header */}
        <div className="px-2 pb-4 border-b border-gray-100 pt-4">
          {isCollapsed ? (
            <div className="flex flex-col items-center gap-3">
              <img src="/assets/simbolo.png" alt="Logo" className="w-20 h-20 object-contain cursor-pointer" onClick={() => window.location.href = '/'} />
              <button onClick={() => setIsCollapsed(!isCollapsed)} className="rounded-lg hover:bg-gray-100 transition-colors">
                <LogOut size={20} className="text-gray-500" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <img src="/assets/simbolo.png" alt="Logo" className="w-14 h-14 object-contain cursor-pointer" onClick={() => window.location.href = '/'} />
              <div className="flex-1">
                <h1 className="text-xl font-bold text-gray-900">Painel Cliente</h1>
                <p className="text-xs text-gray-500">VisualDesign</p>
              </div>
              <button onClick={() => setIsCollapsed(!isCollapsed)} className="rounded-lg hover:bg-gray-100 transition-colors">
                <LogOut size={20} className="text-gray-500 rotate-180" />
              </button>
            </div>
          )}
        </div>

        {/* Menu Items */}
        <nav className="flex-1 overflow-y-auto px-2 py-2.5">
          <div className="space-y-0.5">
            {menuItems.map((item) => {
              const Icon = item.icon
              const isActive = activeSection === item.id ||
                (item.id === 'domains' && ['domains', 'domains-new', 'domains-list'].includes(activeSection)) ||
                (item.id === 'emails-new' && activeSection.startsWith('cp-email')) ||
                (item.id === 'cp-security' && activeSection === 'cp-security')
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={`w-full flex items-center ${isCollapsed ? 'justify-center' : ''} ${isCollapsed ? 'px-2 py-2' : 'p-2.5'} rounded-lg transition-colors ${
                    isActive
                      ? 'bg-red-50 text-red-600 font-bold'
                      : 'hover:bg-gray-100 text-gray-600'
                  }`}
                  title={isCollapsed ? item.label : ''}
                >
                  <Icon size={22} className={isActive ? 'text-red-600' : 'text-gray-500'} />
                  {!isCollapsed && (
                    <span className="ml-3 text-[15px]">{item.label}</span>
                  )}
                  {!isCollapsed && isActive && (
                    <ChevronRight size={14} className="ml-auto text-red-400" />
                  )}
                </button>
              )
            })}
          </div>
        </nav>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-gray-100">
          <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
            <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-bold">SC</span>
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-gray-900 truncate">João Silva</p>
                <p className="text-[10px] text-gray-400 truncate">joao@aamihe.com</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="bg-white border-b border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 ml-2">
                Dashboard
              </h1>
              <p className="text-xs text-gray-400 mt-0.5 ml-6">
                Visão geral do servidor
              </p>
            </div>
            <div className="flex items-center gap-2">
              {activeSection === 'emails-new' && (
                <button
                  onClick={() => { setMostrarAdicionarConta(true); setModalAdicionarPasso('escolher') }}
                  className="ml-2 bg-red-600 hover:bg-red-700 text-white text-xs border border-red-600 rounded-lg px-4 py-2 transition-colors font-bold">
                  + Adicionar Conta
                </button>
              )}
              <button onClick={async () => { await createClientInstance.auth.signOut(); window.location.href = '/auth/login'; }}
                className="bg-gray-700 hover:bg-red-600 text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1.5 transition-colors" title="Sair">
                <LogOut size={13} />
                Sair
              </button>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-6">
            <div
              key={activeSection}
            >
              {renderSection()}
            </div>
        </main>
      </div>
    </div>
  )
}
