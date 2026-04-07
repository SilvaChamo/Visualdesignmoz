'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/utils/supabase/server'

import {
  Home, Globe, Users, Mail, Shield, Database, Settings,
  ChevronLeft, ChevronRight, Plus, Search, Download, ExternalLink,
  Edit2, Pause, Play, Trash2, RefreshCw, LogOut, Package, Server, Lock, LockOpen, Edit, Power, FolderOpen, FileText, Archive, Globe as GlobeIcon, ChevronRight as ChevronRightIcon, Image as ImageIcon, MessageSquare
} from 'lucide-react'
import { CpanelDashboard } from '../admin/CpanelDashboard'
import { EmailWebmailSection } from '@/components/dashboard/EmailWebmailSection'
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
  '#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#ffffff',
  '#ff0000', '#ff4500', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff',
  '#9900ff', '#ff00ff', '#e6b8a2', '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3',
  '#9900ff', '#ff00ff', '#e6b8a2', '#f4cccc', '#fce5cd', '#fff2cc', '#d9d9d3', '#d0e0e3',
  '#c9daf8', '#cfe2f3', '#d9d2e9', '#ead1dc', '#cc0000', '#e69138', '#f1c232', '#6aa84f',
  '#45818e', '#3c78d8', '#3d85c6', '#674ea7', '#a64d79', '#85200c', '#783f04', '#7f6000',
]

// Componente ClienteDashboardHome
function ClienteDashboardHome() {
  const [cliente, setCliente] = useState<any>(null)
  const [cyberPanelSites, setCyberPanelSites] = useState<any[]>([])
  const [faturasPendentes, setFaturasPendentes] = useState<any[]>([])
  const [tickets, setTickets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchClientData()
  }, [])

  const fetchClientData = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await createClientInstance.auth.getUser()
      if (!user) return
      const email = user.email

      // 1. Carregar Perfil
      const { data: profile } = await createClientInstance
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      setCliente({
        nome: profile?.nome || user.user_metadata?.nome || 'Utilizador',
        empresa: profile?.empresa || 'Cliente Individual',
        email: user.email,
        avatar: '/assets/simbolo.png'
      })

      // 2. Carregar Sites (via API do CyberPanel filtrada)
      const sites = await cyberPanelAPI.listWebsites().catch(() => [])
      const allSites = Array.isArray(sites) ? sites : []
      const filteredSites = email ? allSites.filter(s => s.adminEmail === email || s.owner === email || s.domain.includes(email.split('@')[0])) : []
      setCyberPanelSites(filteredSites)

      // 3. Carregar Faturas
      const { data: inv } = await createClientInstance
        .from('pagamentos')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'pending')
      if (inv) setFaturasPendentes(inv)

      // 4. Carregar Tickets
      const { data: tkt } = await createClientInstance
        .from('tickets_suporte')
        .select('*')
        .eq('user_id', user.id)
      if (tkt) setTickets(tkt)

    } catch (error) {
      console.error('Erro ao carregar dados do cliente:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading || !cliente) return <div>Carregando...</div>

  const hoje = new Date()
  const faturasAtrasadas = faturasPendentes.filter(f => new Date(f.vencimento) < hoje).length
  const totalSites = cyberPanelSites.length
  
  // Encontrar a fatura mais próxima
  const proximaFatura = faturasPendentes.length > 0 
    ? faturasPendentes.sort((a,b) => new Date(a.vencimento).getTime() - new Date(b.vencimento).getTime())[0]
    : null

  return (
    <div className="flex gap-6">
      {/* Conteúdo principal */}
      <div className="flex-1 space-y-6">

        {/* Saudação */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Olá, {cliente.nome}!</h1>
          <p className="text-gray-500 mt-1">Bem-vindo ao teu portal de gestão. Aqui podes gerir os teus serviços e faturas.</p>
        </div>

        {/* Cards de Resumo */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-start gap-4">
            <div className="p-3 bg-blue-50 rounded-lg"><Globe className="w-6 h-6 text-blue-600" /></div>
            <div>
              <p className="text-sm text-gray-500">Serviços Activos</p>
              <p className="text-2xl font-bold text-gray-900">{totalSites}</p>
              <p className="text-xs text-gray-400 mt-0.5">{totalSites > 0 ? cyberPanelSites[0].domain : 'Nenhum site'}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-start gap-4">
            <div className="p-3 bg-purple-50 rounded-lg"><Server className="w-6 h-6 text-purple-600" /></div>
            <div>
              <p className="text-sm text-gray-500">Domínios Activos</p>
              <p className="text-2xl font-bold text-gray-900">{totalSites}</p>
              <p className="text-xs text-gray-400 mt-0.5">Expira: Ver faturas</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-start gap-4">
            <div className="p-3 bg-red-50 rounded-lg"><FileText className="w-6 h-6 text-red-600" /></div>
            <div>
              <p className="text-sm text-gray-500">Próxima Renovação</p>
              <p className="text-2xl font-bold text-gray-900">
                {proximaFatura ? new Date(proximaFatura.vencimento).toLocaleDateString() : 'N/A'}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {proximaFatura ? `${proximaFatura.valor} MZN` : 'Sem faturas pendentes'}
              </p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-start gap-4">
            <div className="p-3 bg-green-50 rounded-lg"><MessageSquare className="w-6 h-6 text-green-600" /></div>
            <div>
              <p className="text-sm text-gray-500">Tickets Abertos</p>
              <p className="text-2xl font-bold text-gray-900">{tickets.filter(t => t.status === 'aberto').length}</p>
              <p className="text-xs text-gray-400 mt-0.5">Aguardando resposta</p>
            </div>
          </div>
        </div>

        {proximaFatura && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg text-yellow-700"><FileText className="w-5 h-5" /></div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-sm font-bold text-yellow-800">⚠️ Fatura pendente</h2>
                <button className="bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-bold px-4 py-1.5 rounded-lg">Pagar Agora</button>
              </div>
              <p className="text-xs text-yellow-700">A tua fatura para o serviço <strong>{proximaFatura.domain || 'Digital Service'}</strong> vence em <strong>{new Date(proximaFatura.vencimento).toLocaleDateString()}</strong>.</p>
            </div>
          </div>
        )}

        {/* Tickets recentes */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h2 className="text-sm font-bold text-gray-700">Tickets de Suporte</h2>
            <button className="text-xs text-red-600 hover:underline font-bold">+ Abrir Ticket</button>
          </div>
          <div className="p-5 text-center text-gray-400 text-sm">
            {tickets.length > 0 ? `${tickets.length} tickets no total` : '0 tickets abertos'}
          </div>
        </div>
      </div>

      {/* Barra lateral direita */}
      <div className="w-64 shrink-0 space-y-4">
        {/* Card do cliente */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex flex-col items-center mb-4">
            <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center mb-2">
              <span className="text-white text-xl font-bold">
                {cliente.nome?.substring(0, 2).toUpperCase()}
              </span>
            </div>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">Activo</span>
          </div>
          <div className="space-y-1.5 text-sm border-t border-gray-100 pt-4 text-center">
            <p className="font-bold text-gray-900">{cliente.empresa}</p>
            <p className="text-gray-600 text-xs">{cliente.nome}</p>
            <p className="text-gray-500 text-xs">{cliente.email}</p>
          </div>
        </div>

        {/* Crédito disponível */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 text-center">
          <p className="text-xs font-bold text-gray-500 uppercase mb-2">Crédito Disponível</p>
          <p className="text-2xl font-bold text-gray-900 mb-3">MT 0</p>
          <button className="w-full bg-red-600 hover:bg-red-700 text-white text-xs font-bold py-2 rounded-lg transition-colors">Adicionar Fundos</button>
        </div>
      </div>
    </div>
  )
}


// Componente SuporteSection
function SuporteSection({ cliente, sites }: { cliente: any, sites: any[] }) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [tickets, setTickets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ 
    nome: cliente?.nome || '',
    email: cliente?.email || '',
    assunto: '', 
    categoria: 'Geral', 
    descricao: '',
    prioridade: 'Normal',
    siteId: '',
    website_url: '' // honeypot
  })
  const [enviado, setEnviado] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [ticketRef, setTicketRef] = useState('')
  const [erroEnvio, setErroEnvio] = useState('')
  
  // Anti-spam math challenge
  const [captcha, setCaptcha] = useState({ n1: 0, n2: 0, result: 0 })
  const [userAnswer, setUserAnswer] = useState('')
  
  // Attachment
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  useEffect(() => {
    fetchTickets()
    generateCaptcha()
  }, [])

  const generateCaptcha = () => {
    const n1 = Math.floor(Math.random() * 10) + 1
    const n2 = Math.floor(Math.random() * 10) + 1
    setCaptcha({ n1, n2, result: n1 + n2 })
    setUserAnswer('')
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) {
      if (f.size > 5 * 1024 * 1024) {
        alert('Imagem muito grande. Limite: 5MB')
        return
      }
      setFile(f)
      setPreview(URL.createObjectURL(f))
    }
  }

  const fetchTickets = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await createClientInstance.auth.getUser()
      if (!user) return

      const { data } = await createClientInstance
        .from('tickets_suporte')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (data) setTickets(data)
    } finally {
      setLoading(false)
    }
  }

  const enviarTicket = async () => {
    if (!form.assunto || !form.descricao || !userAnswer) return
    if (parseInt(userAnswer) !== captcha.result) {
      setErroEnvio('Resposta de segurança incorrecta.')
      return
    }

    setEnviando(true)
    setErroEnvio('')
    try {
      let anexoUrl = ''
      
      // 1. Upload anexo if exists
      if (file) {
        const fileExt = file.name.split('.').pop()
        const fileName = `${Math.random()}.${fileExt}`
        const { data: uploadData, error: uploadError } = await createClientInstance.storage
          .from('ticket-attachments')
          .upload(fileName, file)

        if (uploadError) {
          console.error('Erro upload:', uploadError)
        } else {
          const { data: { publicUrl } } = createClientInstance.storage
            .from('ticket-attachments')
            .getPublicUrl(fileName)
          anexoUrl = publicUrl
        }
      }

      const res = await fetch('/api/submit-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          clienteNome: form.nome,
          clienteEmail: form.email,
          anexoUrl,
          captchaAnswer: userAnswer,
          captchaResult: captcha.result
        })
      })
      const data = await res.json()
      if (data.success) {
        setTicketRef(data.ticketId || '')
        setEnviado(true)
        fetchTickets()
      } else {
        setErroEnvio(data.error || 'Erro ao enviar ticket.')
        generateCaptcha()
      }
    } catch (err: any) {
      setErroEnvio(err?.message || 'Erro de ligação ao servidor.')
    } finally {
      setEnviando(false)
    }
  }

  const estadoCor = (s: string) => {
    const status = (s || 'open').toLowerCase()
    if (status === 'aberto' || status === 'open') return 'bg-green-100 text-green-700 border-green-200'
    if (status === 'pendente' || status === 'waiting_client') return 'bg-yellow-100 text-yellow-700 border-yellow-200'
    return 'bg-gray-100 text-gray-700 border-gray-200'
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Suporte e Ajuda</h1>
          <p className="text-gray-500 mt-1">Esclareça dúvidas ou reporte problemas técnicos.</p>
        </div>
        <div className="flex gap-2">
          <a href="https://wa.me/258848066605" target="_blank"
            className="flex items-center gap-2 bg-green-50 hover:bg-green-100 text-green-700 px-4 py-2 rounded-lg text-sm font-bold border border-green-200 transition-all">
            <span>📱</span> WhatsApp
          </a>
          <a href="mailto:suporte@visualdesigne.com"
            className="flex items-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 px-4 py-2 rounded-lg text-sm font-bold border border-blue-200 transition-all">
            <span>✉️</span> Email
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Formulário Novo Ticket */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 bg-gray-50 flex items-center gap-3">
             <div className="p-2 bg-red-100 rounded-lg"><span className="text-red-600">🎫</span></div>
             <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Novo Ticket de Suporte</h2>
          </div>
          
          {enviado ? (
            <div className="p-10 text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto text-2xl">✅</div>
              <h3 className="text-xl font-bold text-gray-900">Ticket Enviado com Sucesso!</h3>
              {ticketRef && <p className="text-gray-600">A sua referência é: <span className="font-mono font-bold bg-gray-100 px-2 py-1 rounded text-red-600">{ticketRef}</span></p>}
              <p className="text-sm text-gray-500 max-w-sm mx-auto">Receberá uma confirmação no seu email em instantes. A nossa equipa irá analisar o seu pedido.</p>
              <div className="pt-4">
                <button onClick={() => { setEnviado(false); setTicketRef(''); setForm({ ...form, assunto: '', descricao: '' }); setPreview(null); setFile(null); generateCaptcha(); }}
                  className="px-6 py-2 bg-gray-800 text-white rounded-lg text-sm font-bold hover:bg-gray-900 transition-all shadow-sm">
                  Abrir outro ticket
                </button>
              </div>
            </div>
          ) : (
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {/* Nome */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">O Teu Nome</label>
                  <input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all" />
                </div>
                {/* Email */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Teu Endereço de Email</label>
                  <input value={form.email} readOnly
                    className="w-full px-4 py-2.5 border border-gray-100 bg-gray-50 text-gray-400 rounded-lg text-sm cursor-not-allowed" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {/* Assunto */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Assunto do Pedido</label>
                  <input value={form.assunto} onChange={e => setForm({ ...form, assunto: e.target.value })}
                    placeholder="Ex: Não consigo aceder ao meu email"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all" />
                </div>
                {/* Categoria */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Categoria</label>
                  <select value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all bg-white">
                    {['Geral', 'Técnico', 'Facturação', 'Domínio', 'Email', 'SSL', 'Backup'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                 {/* Serviço Relacionado */}
                 <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Serviço Relacionado</label>
                  <select value={form.siteId} onChange={e => setForm({ ...form, siteId: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all bg-white">
                    <option value="">Nenhum / Geral</option>
                    {sites.map(s => <option key={s.id} value={s.id}>{s.domain}</option>)}
                  </select>
                </div>
                {/* Prioridade */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Prioridade</label>
                  <div className="flex gap-2 h-full items-center">
                     {['Baixa', 'Normal', 'Alta', 'Urgente'].map(p => (
                       <button key={p} onClick={() => setForm({...form, prioridade: p})}
                         className={`flex-1 py-1.5 rounded text-[10px] font-bold uppercase transition-all border ${form.prioridade === p ? 'bg-red-600 text-white border-red-600' : 'bg-gray-50 text-gray-400 border-gray-200 hover:border-gray-300'}`}>
                         {p}
                       </button>
                     ))}
                  </div>
                </div>
              </div>

              {/* Descrição */}
              <div className="space-y-1 mb-4">
                <label className="text-xs font-bold text-gray-500 uppercase">Descrição Detalhada</label>
                <textarea value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })}
                  placeholder="Por favor, descreva o problema com o máximo detalhe possível..." rows={4}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all resize-none" />
              </div>

              {/* Anexo e Segurança */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                {/* Anexo */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase block">Anexar Imagem (Opcional)</label>
                  <div className="flex items-center gap-4">
                    <label className="cursor-pointer flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2 rounded-lg text-xs font-bold border border-gray-200 transition-all border-dashed">
                      <span>📸</span> {file ? 'Alterar Imagem' : 'Escolher Ficheiro'}
                      <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                    </label>
                    {preview && (
                      <div className="relative w-12 h-12 border rounded-lg overflow-hidden group">
                        <img src={preview} alt="preview" className="w-full h-full object-cover" />
                        <button onClick={() => { setFile(null); setPreview(null); }}
                          className="absolute inset-0 bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Anti-Spam / Math Captcha */}
                <div className="space-y-2">
                   <label className="text-xs font-bold text-gray-500 uppercase block text-right">Verificação de Segurança</label>
                   <div className="flex items-center justify-end gap-3">
                      <span className="text-sm font-bold text-gray-600 italic">Quanto é {captcha.n1} + {captcha.n2}?</span>
                      <input type="number" value={userAnswer} onChange={e => setUserAnswer(e.target.value)}
                        placeholder="?" className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-center text-sm font-bold focus:ring-2 focus:ring-red-500 outline-none" />
                   </div>
                </div>
              </div>

              {/* Honeypot (Spam Prevention) */}
              <input type="text" name="website_url" value={form.website_url} onChange={e => setForm({...form, website_url: e.target.value})} className="hidden" tabIndex={-1} />

              <div className="mt-6 pt-6 border-t border-gray-100 flex items-center justify-between">
                <div className="text-[11px] text-gray-400">
                  <p>🔹 Tempo de resposta médio: 2 horas</p>
                  <p>🔹 Responderemos para {form.email}</p>
                </div>
                {erroEnvio && <p className="text-xs text-red-600 font-bold bg-red-50 border border-red-200 rounded px-3 py-2">{erroEnvio}</p>}
                <button onClick={enviarTicket}
                  disabled={!form.assunto || !form.descricao || !userAnswer || enviando}
                  className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-50 shadow-lg shadow-red-200 flex items-center gap-2">
                  {enviando ? <>⏳ <span className="animate-pulse">A Enviar Pedido...</span></> : <>🚀 Enviar Ticket de Suporte</>}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Histórico Simplificado */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Meus Pedidos Recentes</h2>
            <button onClick={fetchTickets} className="text-[10px] font-bold text-blue-600 hover:underline">Actualizar Lista</button>
          </div>
          <div className="divide-y divide-gray-100">
            {loading ? (
              <div className="p-10 text-center text-gray-400 animate-pulse text-sm">A carregar histórico...</div>
            ) : tickets.length === 0 ? (
              <div className="p-10 text-center text-gray-400 text-sm italic">Ainda não abriu nenhum ticket.</div>
            ) : (
              tickets.map(t => (
                <div key={t.id} className="group">
                  <div className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => setExpanded(expanded === t.id ? null : t.id)}>
                    <div className="flex items-center gap-4">
                      <div className="w-2 h-2 rounded-full bg-red-400"></div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-gray-800 group-hover:text-red-600 transition-colors">{t.assunto}</span>
                        <div className="flex items-center gap-3 mt-0.5">
                           <span className="text-[10px] text-gray-400 font-mono">ID: #{String(t.id).substring(0,8)}</span>
                           <span className="text-[10px] text-gray-400">•</span>
                           <span className="text-[10px] text-gray-400 italic">{new Date(t.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border uppercase ${estadoCor(t.status)}`}>{t.status}</span>
                      <span className="text-gray-300 text-xs">{expanded === t.id ? '▲' : '▼'}</span>
                    </div>
                  </div>
                  {expanded === t.id && (
                    <div className="px-5 py-4 bg-gray-50 border-t border-gray-100 space-y-3">
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-gray-400 uppercase">Mensagem Original:</p>
                        <p className="text-sm text-gray-600 bg-white p-3 rounded-lg border border-gray-200">{t.descricao}</p>
                      </div>
                      {t.anexo_url && (
                        <div className="pt-1">
                           <a href={t.anexo_url} target="_blank" className="text-[10px] font-bold text-blue-600 flex items-center gap-1 hover:underline">
                             <span>🖼️</span> Ver imagem em anexo
                           </a>
                        </div>
                      )}
                      <div className="pt-2">
                        {t.status === 'resolved' || t.status === 'closed' ? (
                          <div className="bg-green-100 border border-green-200 text-green-700 p-3 rounded-lg text-xs font-bold text-center">
                            ✅ Este ticket foi resolvido.
                          </div>
                        ) : (
                          <div className="bg-blue-50 border border-blue-100 text-blue-700 p-3 rounded-lg text-xs font-medium italic">
                            Aguardando resposta da nossa equipa...
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}


// Componente FacturacaoSection
function FacturacaoSection() {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [faturasPendentes, setFaturasPendentes] = useState<any[]>([])
  const [faturasHistorico, setFaturasHistorico] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchFaturas()
  }, [])

  const fetchFaturas = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await createClientInstance.auth.getUser()
      if (!user) return

      const { data: pendentes } = await createClientInstance
        .from('pagamentos')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'pending')

      const { data: historico } = await createClientInstance
        .from('pagamentos')
        .select('*')
        .eq('user_id', user.id)
        .neq('status', 'pending')

      if (pendentes) setFaturasPendentes(pendentes)
      if (historico) setFaturasHistorico(historico)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-900">Facturação</h1><p className="text-gray-500 mt-1">Faturas, pagamentos e histórico financeiro.</p></div>

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <p className="text-xs font-bold text-gray-400 uppercase mb-1">Total Pago Este Ano</p>
          <p className="text-2xl font-bold text-green-600">
            {new Intl.NumberFormat('pt-MZ').format(faturasHistorico.reduce((acc, f) => acc + (f.valor || 0), 0))} MZN
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <p className="text-xs font-bold text-gray-400 uppercase mb-1">Faturas Pendentes</p>
          <p className="text-2xl font-bold text-red-600">{faturasPendentes.length}</p>
          <p className="text-xs text-gray-500 mt-1">Valor: {new Intl.NumberFormat('pt-MZ').format(faturasPendentes.reduce((acc, f) => acc + (f.valor || 0), 0))} MZN</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <p className="text-xs font-bold text-gray-400 uppercase mb-1">Estado da Conta</p>
          <p className={`text-2xl font-bold ${faturasPendentes.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {faturasPendentes.length > 0 ? 'Pagamento Pendente' : 'Em dia ✓'}
          </p>
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
                    <p className="text-xs text-gray-500 mt-1">Referência: {f.descricao || 'Serviço Digital'}</p>
                  </div>
                  <div className="bg-white rounded-lg border border-yellow-200 p-4">
                    <p className="text-xs font-bold text-gray-700 mb-2">📱 E-Mola</p>
                    <p className="text-xs text-gray-600">Envie <strong>{f.valor} MZN</strong> para:</p>
                    <p className="text-sm font-bold text-gray-900 mt-1">848 066 605</p>
                    <p className="text-xs text-gray-500 mt-1">Referência: {f.descricao || 'Serviço Digital'}</p>
                  </div>
                  <div className="bg-white rounded-lg border border-yellow-200 p-4">
                    <p className="text-xs font-bold text-gray-700 mb-2">🏦 Transferência</p>
                    <p className="text-xs text-gray-600">Banco: <strong>BCI</strong></p>
                    <p className="text-xs text-gray-600">NIB: <strong>a preencher</strong></p>
                    <p className="text-xs text-gray-500 mt-1">Referência: {f.descricao || 'Serviço Digital'}</p>
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
  const [dados, setDados] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [pass, setPass] = useState({ actual: '', nova: '', confirmar: '' })
  const [notif, setNotif] = useState({ dias30: true, dias15: true, dias7: true, pagamentos: true, suporte: false })
  const [savedMsg, setSavedMsg] = useState('')
  const [passMsg, setPassMsg] = useState({ text: '', type: '' })

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await createClientInstance.auth.getUser()
      if (!user) return
      const { data: profile } = await createClientInstance
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      
      if (profile) {
        setDados({
          nome: profile.nome || '',
          email: user.email || '',
          telefone: profile.telefone || '',
          empresa: profile.empresa || '',
          morada: profile.morada || '',
          cidade: profile.cidade || ''
        })
      } else {
        setDados({
          nome: user.user_metadata?.nome || '',
          email: user.email || '',
          telefone: '', empresa: '', morada: '', cidade: ''
        })
      }
    } finally {
      setLoading(false)
    }
  }

  const [cancelModal, setCancelModal] = useState(false)
  const [motivoCancelamento, setMotivoCancelamento] = useState('')

  if (loading || !dados) return <div className="p-6">Carregando dados da conta...</div>


  const forcaPassword = (p: string) => {
    if (p.length === 0) return { texto: '', cor: '' }
    if (p.length < 6) return { texto: 'Fraca', cor: 'text-red-500' }
    if (p.length < 10) return { texto: 'Média', cor: 'text-yellow-500' }
    return { texto: 'Forte', cor: 'text-green-500' }
  }

  const guardar = async () => {
    try {
      const { data: { user } } = await createClientInstance.auth.getUser()
      if (!user) {
        setSavedMsg('Erro: Sessão expirada. Faz login novamente.')
        setTimeout(() => setSavedMsg(''), 3000)
        return
      }

      const profileData = { 
        id: user.id, 
        nome: dados.nome, 
        telefone: dados.telefone, 
        empresa: dados.empresa, 
        morada: dados.morada, 
        cidade: dados.cidade,
        email: dados.email,
        updated_at: new Date().toISOString()
      }

      const { error } = await createClientInstance
        .from('profiles')
        .upsert(profileData, { onConflict: 'id' })
      
      if (error) {
        console.error('Erro ao guardar dados:', error.message, error.code, error.details, error.hint)
        setSavedMsg(`Erro: ${error.message || 'Falha ao guardar dados.'}`)
        setTimeout(() => setSavedMsg(''), 5000)
        return
      }

      setSavedMsg('Dados guardados com sucesso!')
      setTimeout(() => window.location.reload(), 1500)
    } catch (err: any) {
      console.error('Erro ao guardar dados (exception):', err?.message || err)
      setSavedMsg(`Erro: ${err?.message || 'Falha inesperada ao guardar dados.'}`)
    }
    setTimeout(() => setSavedMsg(''), 5000)
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
                <input value={(dados as any)[field]} onChange={e => setDados({ ...dados, [field]: e.target.value })}
                  disabled={field === 'email'}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm ${field === 'email' ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`} />
              </div>
            ))}
            {savedMsg && <p className={`text-xs font-bold border rounded px-3 py-2 ${savedMsg.startsWith('Erro') ? 'text-red-600 bg-red-50 border-red-200' : 'text-green-600 bg-green-50 border-green-200'}`}>{savedMsg}</p>}
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
                <input type="password" value={pass.actual} onChange={e => setPass({ ...pass, actual: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Nova Password</label>
                <input type="password" value={pass.nova} onChange={e => setPass({ ...pass, nova: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                {pass.nova && <p className={`text-xs font-bold mt-1 ${forcaPassword(pass.nova).cor}`}>Força: {forcaPassword(pass.nova).texto}</p>}
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Confirmar Nova Password</label>
                <input type="password" value={pass.confirmar} onChange={e => setPass({ ...pass, confirmar: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                {pass.confirmar && pass.nova !== pass.confirmar && <p className="text-xs text-red-500 font-bold mt-1">Passwords não coincidem</p>}
              </div>
              <button disabled={!pass.actual || !pass.nova || pass.nova !== pass.confirmar}
                onClick={async () => {
                  try {
                    const { error } = await createClientInstance.auth.updateUser({ password: pass.nova })
                    if (error) throw error
                    setPassMsg({ text: 'Password alterada com sucesso!', type: 'success' })
                    setPass({ actual: '', nova: '', confirmar: '' })
                    setTimeout(() => window.location.reload(), 1500)
                  } catch (err: any) {
                    setPassMsg({ text: err.message || 'Erro ao alterar password.', type: 'error' })
                  }
                  setTimeout(() => setPassMsg({ text: '', type: '' }), 4000)
                }}
                className="w-full bg-gray-800 hover:bg-gray-900 text-white py-2.5 rounded-lg text-sm font-bold transition-colors disabled:opacity-50">
                Alterar Password
              </button>
            </div>
            {passMsg.text && (
              <p className={`mt-3 text-xs font-bold px-3 py-2 border rounded ${passMsg.type === 'success' ? 'text-green-600 bg-green-50 border-green-200' : 'text-red-600 bg-red-50 border-red-200'}`}>
                {passMsg.text}
              </p>
            )}
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
                  <button onClick={() => setNotif({ ...notif, [key]: !(notif as any)[key] })}
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
          <div><label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Domínio</label><input value={form.domain} onChange={e => setForm({ ...form, domain: e.target.value })} placeholder="exemplo.com" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" /></div>
          <div><label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Email Admin</label><input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="admin@exemplo.com" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" /></div>
          <div><label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Pacote</label>
            <select value={form.packageName} onChange={e => setForm({ ...form, packageName: e.target.value })} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm">
              <option value="Default">Default</option>
              {packages.map(p => <option key={p.packageName} value={p.packageName}>{p.packageName}</option>)}
            </select>
          </div>
          <div><label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Versão PHP</label>
            <select value={form.php} onChange={e => setForm({ ...form, php: e.target.value })} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm">
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
  const [editingField, setEditingField] = useState<{ domain: string, field: string } | null>(null)
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
            const rows = [['Domínio', 'IP', 'Estado', 'Pacote']]
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
                className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${currentPage === page
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
                <input value={createForm.domain} onChange={e => setCreateForm({ ...createForm, domain: e.target.value })}
                  placeholder="exemplo.com"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Email Admin</label>
                <input value={createForm.email} onChange={e => setCreateForm({ ...createForm, email: e.target.value })}
                  placeholder="admin@exemplo.com"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Pacote</label>
                <select value={createForm.packageName} onChange={e => setCreateForm({ ...createForm, packageName: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm">
                  <option>Default</option>
                  {packages.map(p => <option key={p.packageName} value={p.packageName}>{p.packageName}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Versão PHP</label>
                <select value={createForm.php} onChange={e => setCreateForm({ ...createForm, php: e.target.value })}
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
  )
}

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
  const [sessionUser, setSessionUser] = useState<string | null>(null)
  const [cliente, setCliente] = useState<any>(null)

  // Estados para gestão de contas de email
  const [mostrarAdicionarConta, setMostrarAdicionarConta] = useState(false)
  const [modalAdicionarPasso, setModalAdicionarPasso] = useState<'escolher' | 'webmail' | 'google' | 'hotmail'>('escolher')

  // Obter sessão e perfil do usuário
  useEffect(() => {
    const getData = async () => {
      try {
        const { data: { user } } = await createClientInstance.auth.getUser()
        if (user) {
          setSessionUser(user.email || null)
          
          // Buscar perfil
          const { data: profile } = await createClientInstance
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single()
          
          setCliente({
            nome: profile?.nome || user.user_metadata?.nome || 'Utilizador',
            email: user.email
          })
        }
      } catch (error) {
        console.error('Erro ao obter dados:', error)
      }
    }
    getData()
  }, [])

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
      const { data: { user } } = await createClientInstance.auth.getUser()
      const email = user?.email

      const [sites, users, packages] = await Promise.all([
        cyberPanelAPI.listWebsites().catch(() => []),
        cyberPanelAPI.listUsers().catch(() => []),
        cyberPanelAPI.listPackages().catch(() => []),
      ])

      // Filtrar sites pelo email do administrador/cliente
      const allSites = Array.isArray(sites) ? sites : []
      const filteredSites = email ? allSites.filter(s => s.adminEmail === email || s.owner === email || s.domain.includes(email.split('@')[0])) : []
      
      setCyberPanelSites(filteredSites)
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
    : 'oseudominio.com'

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
          emailOrigem={sessionUser}
          sites={cyberPanelSites}
        />
      case 'domains':
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
        return <FileManagerSection domain={fileManagerDomain || cyberPanelSites[0]?.domain || 'oseudominio.com'} sites={cyberPanelSites} />
      case 'tickets':
        return <SuporteSection cliente={cliente} sites={cyberPanelSites} />
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
              <img src="/assets/simbolo.png" alt="Logo" className="w-16 h-16 object-contain cursor-pointer" onClick={() => window.location.href = '/'} />
              <button onClick={() => setIsCollapsed(!isCollapsed)} className="rounded-lg hover:bg-gray-100 transition-colors">
                <LogOut size={20} className="text-gray-500" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <img src="/assets/simbolo.png" alt="Logo" className="w-16 h-16 object-contain cursor-pointer" onClick={() => window.location.href = '/'} />
              <div className="flex-1">
                <h1 className="text-lg font-bold text-gray-900 tracking-tight">VisualDESIGN</h1>
                <p className="text-xs text-gray-500">Gestão de Serviços</p>
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
                  className={`w-full flex items-center ${isCollapsed ? 'justify-center' : ''} ${isCollapsed ? 'px-2 py-2' : 'p-2.5'} rounded-lg transition-colors ${isActive
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
              <span className="text-white text-xs font-bold">
                {cliente?.nome?.substring(0, 2).toUpperCase() || '??'}
              </span>
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-gray-900 truncate">{cliente?.nome || 'Carregando...'}</p>
                <p className="text-[10px] text-gray-400 truncate">{cliente?.email || '...'}</p>
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
              <h1 className="text-2xl font-bold text-gray-900">
                Dashboard
              </h1>
              <p className="text-xs text-gray-400 mt-0.5">
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
