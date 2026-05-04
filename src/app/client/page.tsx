'use client'

import { useState, useEffect, useRef, Suspense, lazy } from 'react'
import { createClient } from '@/utils/supabase/server'
import { supabase } from '@/lib/supabase-client'

// 🚀 Componente de carregamento direto para seções principais
import { WebmailSection } from '@/components/dashboard/WebmailSection'
const EmailWebmailSection = lazy(() => import('@/components/dashboard/EmailWebmailSection').then(m => ({ default: m.EmailWebmailSection })))

import {
  Home, Globe, Users, Mail, Shield, Database, Settings, Target,
  ChevronLeft, ChevronRight, Plus, Search, Download, ExternalLink,
  Edit2, Pause, Play, Trash2, RefreshCw, LogOut, Package, Server, Lock, LockOpen, Edit, Power, FolderOpen, FileText, Archive, Globe as GlobeIcon, ChevronRight as ChevronRightIcon, Image as ImageIcon, MessageSquare, Menu,
  Send, Megaphone, Newspaper, File as FileIcon, Loader2, LayoutTemplate, Sparkles, X as XLucide, History as HistoryIcon, Calendar, Eye, Pencil, BarChart3, TrendingUp, ArrowUpRight, Check, AlertTriangle, X, Bell
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
} from '../admin/CyberPanelSections'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { RichTextEditor } from "@/components/RichTextEditor"
import { MultiFileUpload } from "@/components/admin/MultiFileUpload"
import { SenderEmailSelector } from "@/components/admin/SenderEmailSelector"
import { EmailTemplates } from "@/components/admin/EmailTemplates"
import { toast } from "sonner"
import { cyberPanelAPI } from '@/lib/cyberpanel-api'
import ClientDashboardSkeleton from '@/components/dashboard/ClientDashboardSkeleton'
import { NovoTicketModal } from '@/components/dashboard/NovoTicketModal'
import { supabase as createClientInstance } from '@/lib/supabase'
import { useSupabaseQueue } from '@/lib/supabase-queue'
import {
  adminListarSubscritores as listarSubscritores,
  adminAdicionarSubscritor as adicionarSubscritor,
  adminAtualizarSubscritor as atualizarSubscritor,
  adminRemoverSubscritor as removerSubscritor,
  adminListarCampanhas as listarCampanhas,
  adminSalvarCampanha as salvarCampanha,
  adminRemoverCampanha as removerCampanha,
  adminLimparDadosCampanhas as limparDadosCampanhas
} from '@/app/actions/mailmarketing'
import type { CyberPanelWebsite, CyberPanelUser, CyberPanelPackage } from '@/lib/cyberpanel-api'

const CORES_PALETA = [
  '#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#ffffff',
  '#ff0000', '#ff4500', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff',
  '#9900ff', '#ff00ff', '#e6b8a2', '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3',
  '#9900ff', '#ff00ff', '#e6b8a2', '#f4cccc', '#fce5cd', '#fff2cc', '#d9d9d3', '#d0e0e3',
  '#c9daf8', '#cfe2f3', '#d9d2e9', '#ead1dc', '#cc0000', '#e69138', '#f1c232', '#6aa84f',
  '#45818e', '#3c78d8', '#3d85c6', '#674ea7', '#a64d79', '#85200c', '#783f04', '#7f6000',
]

// 🚀 Componente de loading skeleton para seções
function SectionLoader() {
  return (
    <div className="p-6 space-y-4 animate-pulse">
      <div className="h-8 bg-gray-200 rounded-lg w-1/3" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="h-32 bg-gray-200 rounded-xl" />
        <div className="h-32 bg-gray-200 rounded-xl" />
      </div>
      <div className="h-64 bg-gray-200 rounded-xl" />
    </div>
  )
}

// Componente ClienteDashboardHome - Recebe dados do componente pai para evitar race conditions
function ClienteDashboardHome({ clienteProp, sitesProp, isLoading }: { clienteProp: any, sitesProp: any[], isLoading: boolean }) {
  const [faturasPendentes, setFaturasPendentes] = useState<any[]>([])
  const [tickets, setTickets] = useState<any[]>([])
  const [showTicketModal, setShowTicketModal] = useState(false)
  const [localLoading, setLocalLoading] = useState(true)
  const dataFetchedRef = useRef(false)

  useEffect(() => {
    // Evitar chamadas duplicadas (React StrictMode)
    if (dataFetchedRef.current) return
    dataFetchedRef.current = true
    
    fetchAdditionalData()
  }, [])

  const fetchAdditionalData = async () => {
    setLocalLoading(true)
    try {
      // Buscar apenas faturas e tickets - usuário e sites vêm do pai
      const { data: { user } } = await createClientInstance.auth.getUser()
      if (!user) return

      // 1. Carregar Faturas (apenas se tabela existir) - com delay entre chamadas
      try {
        await new Promise(resolve => setTimeout(resolve, 100))
        const { data: inv, error: invError } = await createClientInstance
          .from('pagamentos')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'pending')
        
        if (invError) {
          console.warn('Erro ao carregar faturas:', invError.message)
        } else {
          if (inv) setFaturasPendentes(inv)
        }
      } catch (err) {
        console.warn('Tabela pagamentos não existe:', err)
      }

      // 2. Carregar Tickets (apenas se tabela existir) - com delay entre chamadas
      try {
        await new Promise(resolve => setTimeout(resolve, 100))
        const { data: tkt, error: tktError } = await createClientInstance
          .from('tickets_suporte')
          .select('*')
          .eq('user_id', user.id)
        
        if (tktError) {
          console.warn('Erro ao carregar tickets:', tktError.message)
        } else {
          if (tkt) setTickets(tkt)
        }
      } catch (err) {
        console.warn('Tabela tickets_suporte não existe:', err)
      }

    } catch (error) {
      console.error('Erro ao carregar dados adicionais:', error)
    } finally {
      setLocalLoading(false)
    }
  }

  const cliente = clienteProp
  const cyberPanelSites = sitesProp

  if (isLoading || localLoading || !cliente) return <ClientDashboardSkeleton />

  const hoje = new Date()
  const faturasAtrasadas = faturasPendentes.filter(f => new Date(f.vencimento) < hoje).length
  const totalSites = cyberPanelSites.length

  // Encontrar a fatura mais próxima
  const proximaFatura = faturasPendentes.length > 0
    ? faturasPendentes.sort((a, b) => new Date(a.vencimento).getTime() - new Date(b.vencimento).getTime())[0]
    : null

  return (
    <div className="flex gap-5 p-5">
      {/* Conteúdo principal */}
      <div className="flex-1 space-y-5">

        {/* Saudação */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Olá, {cliente.nome}!</h1>
          <p className="text-gray-500 mt-1">Bem-vindo ao teu portal de gestão. Aqui podes gerir os teus serviços e faturas.</p>
        </div>

        {/* Cards de Resumo */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 flex items-start gap-4">
            <div className="p-3 bg-blue-50 rounded-lg"><Globe className="w-6 h-6 text-blue-600" /></div>
            <div>
              <p className="text-sm text-gray-500">Serviços Activos</p>
              <p className="text-2xl font-bold text-gray-900">{totalSites}</p>
              <p className="text-xs text-gray-400 mt-0.5">{totalSites > 0 ? cyberPanelSites[0].domain : 'Nenhum site'}</p>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 flex items-start gap-4">
            <div className="p-3 bg-purple-50 rounded-lg"><Server className="w-6 h-6 text-purple-600" /></div>
            <div>
              <p className="text-sm text-gray-500">Domínios Activos</p>
              <p className="text-2xl font-bold text-gray-900">{totalSites}</p>
              <p className="text-xs text-gray-400 mt-0.5">Expira: Ver faturas</p>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 flex items-start gap-4">
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
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 flex items-start gap-4">
            <div className="p-3 bg-green-50 rounded-lg"><MessageSquare className="w-6 h-6 text-green-600" /></div>
            <div>
              <p className="text-sm text-gray-500">Tickets Abertos</p>
              <p className="text-2xl font-bold text-gray-900">{tickets.filter(t => t.status === 'aberto').length}</p>
              <p className="text-xs text-gray-400 mt-0.5">Aguardando resposta</p>
            </div>
          </div>
        </div>

        {proximaFatura && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg text-yellow-700"><FileText className="w-5 h-5" /></div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-sm font-bold text-yellow-800">⚠️ Fatura pendente</h2>
                <button className="!bg-yellow-500 hover:!bg-red-600 text-white text-xs font-black uppercase tracking-widest px-4 py-1.5 rounded-lg !opacity-100 transition-all">Pagar Agora</button>
              </div>
              <p className="text-xs text-yellow-700">A tua fatura para o serviço <strong>{proximaFatura.domain || 'Digital Service'}</strong> vence em <strong>{new Date(proximaFatura.vencimento).toLocaleDateString()}</strong>.</p>
            </div>
          </div>
        )}

        {/* Tickets recentes - Agora em cima */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h2 className="text-sm font-bold text-gray-700">Tickets de Suporte</h2>
            <button onClick={() => setShowTicketModal(true)} className="text-xs text-red-600 hover:underline font-bold">+ Abrir Ticket</button>
          </div>
          <div className="p-5 text-center text-gray-400 text-sm">
            {tickets.length > 0 ? `${tickets.length} tickets no total` : '0 tickets abertos'}
          </div>
        </div>

        {/* Recibos e Notificações - Agora embaixo com apenas 2 itens */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
              <Bell className="w-4 h-4 text-red-600" />
              Recibos e Notificações
            </h2>
            <button className="text-[10px] text-gray-500 hover:text-red-600 font-bold uppercase tracking-wider transition-colors">Ver Todos</button>
          </div>
          <div className="p-4 space-y-3">
            {/* Notificação de Recibo */}
            <div className="flex items-start gap-3 p-3 bg-blue-50/50 rounded-lg border border-blue-100 hover:bg-blue-50 transition-colors cursor-pointer group">
              <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                <FileText className="w-4 h-4 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">Pagamento Confirmado</p>
                <p className="text-xs text-gray-500 mt-0.5">Recibo #VD-2024-001 disponível para download</p>
                <p className="text-[10px] text-gray-400 mt-1">Hoje, 14:30</p>
              </div>
              <span className="w-2 h-2 bg-blue-500 rounded-full shrink-0"></span>
            </div>
            {/* Notificação de Domínio */}
            <div className="flex items-start gap-3 p-3 bg-green-50/50 rounded-lg border border-green-100 hover:bg-green-50 transition-colors cursor-pointer group">
              <div className="p-2 bg-green-100 rounded-lg group-hover:bg-green-200 transition-colors">
                <Globe className="w-4 h-4 text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">Domínio Ativo</p>
                <p className="text-xs text-gray-500 mt-0.5">visualdesigne.com foi ativado com sucesso</p>
                <p className="text-[10px] text-gray-400 mt-1">Ontem, 09:15</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Barra lateral direita */}
      <div className="w-64 shrink-0 space-y-4">
        {/* Card do cliente */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
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
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 text-center">
          <p className="text-xs font-bold text-gray-500 uppercase mb-2">Crédito Disponível</p>
          <p className="text-2xl font-bold text-gray-900 mb-3">MT 0</p>
          <button className="w-full !bg-red-600 hover:!bg-red-700 text-white text-[10px] font-black uppercase tracking-widest py-2 rounded-lg transition-all !opacity-100">Adicionar Fundos</button>
        </div>
      </div>

      {/* Modal de Novo Ticket */}
      <NovoTicketModal 
        isOpen={showTicketModal}
        onClose={() => setShowTicketModal(false)}
        cliente={cliente}
        sites={cyberPanelSites}
        onTicketCreated={() => {
          const fetchTickets = async () => {
            try {
              const { data: { user } } = await createClientInstance.auth.getUser()
              if (!user) return
              const { data } = await createClientInstance.from('tickets_suporte').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
              if (data) setTickets(data)
            } catch (err) { console.error('Erro ao recarregar tickets:', err) }
          }
          fetchTickets()
        }}
      />
    </div>
  )
}


// Componente SuporteSection
function SuporteSection({ cliente, sites, onComposeEmail }: { cliente: any, sites: any[], onComposeEmail: () => void }) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [tickets, setTickets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showTicketModal, setShowTicketModal] = useState(false)
  
  // Formulário de contacto por email
  const [contactForm, setContactForm] = useState({
    nome: cliente?.nome || '',
    email: cliente?.email || '',
    assunto: '',
    mensagem: ''
  })
  const [contactEnviado, setContactEnviado] = useState(false)
  const [contactEnviando, setContactEnviando] = useState(false)

  useEffect(() => {
    fetchTickets()
  }, [])

  const fetchTickets = async () => {
    setLoading(true)
    try {
      await new Promise(resolve => setTimeout(resolve, 150))
      const { data: { user } } = await createClientInstance.auth.getUser()
      if (!user) return

      await new Promise(resolve => setTimeout(resolve, 100))
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

  const handleTicketCreated = () => {
    fetchTickets()
  }

  const enviarContacto = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!contactForm.assunto || !contactForm.mensagem) return
    
    setContactEnviando(true)
    try {
      const res = await fetch('/api/contact-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: contactForm.nome,
          email: contactForm.email,
          assunto: contactForm.assunto,
          mensagem: contactForm.mensagem,
          tipo: 'suporte'
        })
      })
      if (res.ok) {
        setContactEnviado(true)
        setTimeout(() => {
          setContactEnviado(false)
          setContactForm({ ...contactForm, assunto: '', mensagem: '' })
        }, 3000)
      }
    } catch (err) {
      console.error('Erro ao enviar:', err)
    } finally {
      setContactEnviando(false)
    }
  }

  const estadoCor = (s: string) => {
    const status = (s || 'open').toLowerCase()
    if (status === 'aberto' || status === 'open') return 'bg-green-100 text-green-700 border-green-200'
    if (status === 'pendente' || status === 'waiting_client') return 'bg-yellow-100 text-yellow-700 border-yellow-200'
    return 'bg-gray-100 text-gray-700 border-gray-200'
  }

  return (
    <div className="space-y-5">
      {/* Header - sem contorno */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 py-5">
        <div className="pl-0">
          <h1 className="text-2xl font-bold text-gray-900 -ml-0">Suporte e Ajuda</h1>
          <p className="text-gray-500 mt-1">Esclareça dúvidas ou reporte problemas técnicos.</p>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={() => setShowTicketModal(true)}
            className="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-lg text-sm font-bold border border-red-200 transition-all shadow-sm">
            <span>🎫</span> + Abrir Ticket
          </button>
          <a href="https://wa.me/258825288318" target="_blank"
            className="flex items-center gap-2 bg-green-50 hover:bg-green-100 text-green-700 px-4 py-2 rounded-lg text-sm font-bold border border-green-200 transition-all shadow-sm">
            <span>📱</span> WhatsApp
          </a>
        </div>
      </div>

      {/* Container com duas colunas: Dados empresa + Formulário contacto */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Coluna Esquerda - Dados da Empresa */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-2">VisualDesign</h3>
          <p className="text-sm text-gray-500 mb-6">Estamos aqui para ajudar. Entre em contacto connosco por qualquer canal.</p>
          
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-red-50 text-red-600 rounded-lg flex items-center justify-center shrink-0">
                <span>📞</span>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase">Telefone</p>
                <p className="text-sm font-bold text-gray-900">+258 84 806 6605</p>
                <p className="text-xs text-gray-400">Seg-Sex: 08h às 18h</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-red-50 text-red-600 rounded-lg flex items-center justify-center shrink-0">
                <span>📧</span>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase">Email</p>
                <p className="text-sm font-bold text-gray-900">geral@visualdesigne.com</p>
                <p className="text-sm font-bold text-gray-900">suporte@visualdesigne.com</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-red-50 text-red-600 rounded-lg flex items-center justify-center shrink-0">
                <span>📍</span>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase">Endereço</p>
                <p className="text-sm font-bold text-gray-900">Maputo, Moçambique</p>
                <p className="text-xs text-gray-400">Av. 25 de Setembro, Edifício Whatana, 2º Andar</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-red-50 text-red-600 rounded-lg flex items-center justify-center shrink-0">
                <span>🌐</span>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase">Website</p>
                <p className="text-sm font-bold text-gray-900">www.visualdesigne.com</p>
              </div>
            </div>
          </div>
        </div>

        {/* Coluna Direita - Formulário de Contacto */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-2">Enviar Mensagem</h3>
          <p className="text-sm text-gray-500 mb-6">Preencha o formulário abaixo e responderemos em breve.</p>
          
          {contactEnviado ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-3">✅</div>
              <h4 className="font-bold text-gray-900">Mensagem Enviada!</h4>
              <p className="text-sm text-gray-500">Responderemos o mais breve possível.</p>
            </div>
          ) : (
            <form onSubmit={enviarContacto} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Nome</label>
                  <input 
                    type="text" 
                    value={contactForm.nome}
                    onChange={e => setContactForm({...contactForm, nome: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Email</label>
                  <input 
                    type="email" 
                    value={contactForm.email}
                    onChange={e => setContactForm({...contactForm, email: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none"
                    required
                  />
                </div>
              </div>
              
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Assunto</label>
                <input 
                  type="text" 
                  value={contactForm.assunto}
                  onChange={e => setContactForm({...contactForm, assunto: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none"
                  placeholder="Ex: Dúvida sobre faturação"
                  required
                />
              </div>
              
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Mensagem</label>
                <textarea 
                  value={contactForm.mensagem}
                  onChange={e => {
                    setContactForm({...contactForm, mensagem: e.target.value})
                    e.target.style.height = 'auto'
                    e.target.style.height = Math.max(96, e.target.scrollHeight) + 'px'
                  }}
                  rows={1}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none resize-none overflow-hidden min-h-[96px]"
                  placeholder="Escreva a sua mensagem..."
                  required
                />
              </div>
              
              <div className="flex justify-start">
                <button 
                  type="submit"
                  disabled={contactEnviando}
                  className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg text-sm font-bold transition-all disabled:opacity-50 shadow-lg shadow-red-200"
                >
                  {contactEnviando ? 'A Enviar...' : '🚀 Enviar Mensagem'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Modal de Novo Ticket */}
      <NovoTicketModal
        isOpen={showTicketModal}
        onClose={() => setShowTicketModal(false)}
        cliente={cliente}
        sites={sites}
        onTicketCreated={handleTicketCreated}
      />
    </div>
  )
}

const RECIPIENT_GROUPS = [
  "Contactos"
];

function MailMarketingContactsSkeleton() {
  return (
    <>
      {[1, 2, 3, 4, 5].map((i) => (
        <tr key={i} className="hover:bg-slate-50/50 transition-colors animate-in fade-in duration-500">
          <td className="px-5 py-[5px]">
            <div className="w-4 h-4 bg-slate-200 rounded animate-pulse" />
          </td>
          <td className="px-5 py-4">
            <div className="space-y-2">
              <div className="h-4 w-32 bg-slate-300 rounded animate-pulse" />
              <div className="h-3 w-48 bg-slate-200 rounded animate-pulse" />
            </div>
          </td>
          <td className="px-5 py-4"><div className="h-4 w-28 bg-slate-200 rounded animate-pulse" /></td>
          <td className="px-5 py-4"><div className="h-6 w-20 bg-slate-100 rounded-md animate-pulse" /></td>
          <td className="px-5 py-4"><div className="h-5 w-16 bg-emerald-50 rounded-md animate-pulse" /></td>
          <td className="px-5 py-4">
            <div className="flex items-center justify-end gap-2">
              <div className="w-7 h-7 bg-slate-100 rounded animate-pulse" />
              <div className="w-7 h-7 bg-red-50 rounded animate-pulse" />
            </div>
          </td>
        </tr>
      ))}
    </>
  )
}

function MailMarketingCampaignsSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-white animate-in fade-in duration-500">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-slate-100 rounded-xl border border-slate-50 animate-pulse" />
            <div className="space-y-2">
              <div className="h-4 bg-slate-300 rounded w-48 animate-pulse" />
              <div className="h-3 bg-slate-200 rounded w-32 animate-pulse" />
            </div>
          </div>
          <div className="flex items-center gap-8">
            <div className="text-right space-y-2">
              <div className="h-3 bg-slate-200 rounded w-16 animate-pulse ml-auto" />
              <div className="h-4 bg-slate-300 rounded w-12 animate-pulse ml-auto" />
            </div>
            <div className="w-24 flex justify-end">
              <div className="h-6 bg-slate-100 rounded-md w-16 animate-pulse" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function MailMarketingSection({ sites, currentUserEmail, activeTab, setActiveTab, listas, setListas, searchTerm, setSearchTerm }: { sites: any[], currentUserEmail?: string, activeTab: string, setActiveTab: (tab: any) => void, listas: string[], setListas: (l: string[]) => void, searchTerm: string, setSearchTerm: (value: string) => void }) {
  // Filtrar domínios reais
  const pureSites = sites.filter(s => !s.domain.toLowerCase().startsWith('mail.'));

  // 🎯 Detecção Inteligente: Site → Domínio do Email → Hostname
  // Funciona para clientes COM site ou SEM site (email corporativo apenas)
  const getDefaultDomain = () => {
    // 1. Primeiro: usar site do CyberPanel se existir
    if (pureSites.length > 0) return pureSites[0].domain;

    // 2. Segundo: extrair domínio do email do utilizador (email corporativo sem site)
    if (currentUserEmail && currentUserEmail.includes('@')) {
      const emailDomain = currentUserEmail.split('@')[1];
      if (emailDomain && emailDomain !== 'localhost' && !emailDomain.startsWith('127.')) {
        return emailDomain;
      }
    }
    
    // 3. Terceiro: usar hostname da URL
    if (typeof window !== 'undefined') {
      const host = window.location.hostname.replace('client.', '').replace('portal.', '');
      if (host && host !== 'localhost' && !host.startsWith('127.')) return host;
    }
    
    // Sem domínio detectado - retorna vazio para evitar mostrar contactos errados
    return '';
  };

  const [selectedSite, setSelectedSite] = useState(getDefaultDomain());
  const [campaignToResend, setCampaignToResend] = useState<any>(null);

  // 🔄 Atualizar selectedSite quando não está definido
  useEffect(() => {
    if (!selectedSite) {
      const defaultDomain = getDefaultDomain();
      if (defaultDomain) {
        setSelectedSite(defaultDomain);
      }
    }
  }, [selectedSite, pureSites, currentUserEmail]);

  return (
    <div className="space-y-5 h-full overflow-auto">
      <div className="relative min-h-full">
        <div className={`transition-all duration-300 ${activeTab === 'comp' ? 'block opacity-100 relative z-10' : 'hidden opacity-0 absolute inset-0 z-0 pointer-events-none'}`}>
          <MailMarketingComposer selectedSite={selectedSite} setSelectedSite={setSelectedSite} sites={pureSites} onGoToContacts={() => setActiveTab('subs')} currentUserEmail={currentUserEmail} listas={listas} setListas={setListas} campaignToResend={campaignToResend} setCampaignToResend={setCampaignToResend} />
        </div>
        <div className={`transition-all duration-300 ${activeTab === 'subs' ? 'block opacity-100 relative z-10' : 'hidden opacity-0 absolute inset-0 z-0 pointer-events-none'}`}>
          <MailMarketingContacts selectedSite={selectedSite} setSelectedSite={setSelectedSite} sites={pureSites} listas={listas} searchTerm={searchTerm} setSearchTerm={setSearchTerm} />
        </div>
        <div className={`transition-all duration-300 ${activeTab === 'camp' ? 'block opacity-100 relative z-10' : 'hidden opacity-0 absolute inset-0 z-0 pointer-events-none'}`}>
          <MailMarketingCampaigns selectedSite={selectedSite} currentUserEmail={currentUserEmail} onResend={(camp) => { setCampaignToResend(camp); setActiveTab('comp'); }} />
        </div>
      </div>
    </div>
  )
}

function MailMarketingComposer({ selectedSite, setSelectedSite, sites, onGoToContacts, currentUserEmail, listas, setListas, campaignToResend, setCampaignToResend }: { selectedSite: string, setSelectedSite: (s: string) => void, sites: any[], onGoToContacts: () => void, currentUserEmail?: string, listas: string[], setListas: (l: string[]) => void, campaignToResend?: any, setCampaignToResend?: (c: any) => void }) {
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [selectedPlans, setSelectedPlans] = useState<string[]>(["Contactos"]);
  const [senderEmail, setSenderEmail] = useState(currentUserEmail || "");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showNewListPopup, setShowNewListPopup] = useState(false);
  const [newListTitle, setNewListTitle] = useState("");
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [showValidationError, setShowValidationError] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [user, setUser] = useState<any>(null);
  const [showReputationInfo, setShowReputationInfo] = useState(false);
  
  // Estado removido - sistema simplificado para 200 emails/dia fixo
  
  // 🆕 Estado para guardar dados do último envio (para reenvio)
  const [lastSendData, setLastSendData] = useState<any>(null);
  
  // 🚀 Estado de reputação de domínio (warm-up)
  const [domainReputation, setDomainReputation] = useState<any>(null);
  const [loadingReputation, setLoadingReputation] = useState(false);
  
  // 🚀 Emails disponíveis do domínio selecionado
  const [domainEmails, setDomainEmails] = useState<string[]>([]);
  const [loadingDomainEmails, setLoadingDomainEmails] = useState(false);

  // Email do utilizador é adicionado no fetchDomainEmails se pertencer ao domínio selecionado

  // Obter dados do usuário logado
  useEffect(() => {
    const getUserData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);
        console.log("USUÁRIO LOGADO:", user);
      } catch (error) {
        console.error("Erro ao obter usuário:", error);
      }
    };
    getUserData();
  }, []);
  
  // 🆕 Função para buscar reputação (independente do useEffect)
  const fetchReputation = async () => {
    if (!selectedSite) return;
    
    setLoadingReputation(true);
    try {
      const response = await fetch(`/api/mailmarketing-send?domain=${encodeURIComponent(selectedSite)}`);
      const data = await response.json();
      
      if (data.success) {
        setDomainReputation(data.reputation);
        console.log("📊 Reputação do domínio:", data.reputation);
      }
    } catch (error) {
      console.error("Erro ao buscar reputação:", error);
    } finally {
      setLoadingReputation(false);
    }
  };

  // 🚀 Buscar reputação do domínio quando site muda
  useEffect(() => {
    fetchReputation();
  }, [selectedSite]);

  // 🚀 Buscar emails do domínio quando site muda
  useEffect(() => {
    const fetchDomainEmails = async () => {
      if (!selectedSite) return;
      
      setLoadingDomainEmails(true);
      try {
        // 🆕 BUSCAR DE DUAS FONTES: Supabase + CyberPanel
        const [supabaseRes, cyberpanelRes] = await Promise.allSettled([
          fetch('/api/email-contas'),
          fetch(`/api/cyberpanel-list-emails?domain=${encodeURIComponent(selectedSite)}`)
        ]);
        
        let allEmailsList: string[] = [];
        
        // Processar resultado do Supabase
        if (supabaseRes.status === 'fulfilled') {
          const result = await supabaseRes.value.json();
          const data = result.contas || result;
          if (Array.isArray(data)) {
            const supabaseEmails = data
              .filter((account: any) => {
                const emailDomain = account.email?.split('@')[1]?.toLowerCase();
                return emailDomain === selectedSite.toLowerCase();
              })
              .map((account: any) => account.email);
            allEmailsList = [...allEmailsList, ...supabaseEmails];
            console.log("📧 Emails do Supabase:", supabaseEmails);
          }
        }
        
        // Processar resultado do CyberPanel
        if (cyberpanelRes.status === 'fulfilled') {
          const result = await cyberpanelRes.value.json();
          if (result.success && Array.isArray(result.emails)) {
            allEmailsList = [...allEmailsList, ...result.emails];
            console.log("📧 Emails do CyberPanel:", result.emails);
            console.log("📧 Fonte:", result.source);
          }
        }
        
        // Remover duplicados
        const domainEmailsList = [...new Set(allEmailsList.filter((e: string) => e && e.includes('@')))];
        
        console.log("📧 Total combinado (sem duplicados):", domainEmailsList);
          
          // 🎯 GARANTIR: sempre incluir o email do utilizador logado se pertencer ao domínio
          if (currentUserEmail) {
            const userDomain = currentUserEmail.split('@')[1]?.toLowerCase();
            if (userDomain === selectedSite.toLowerCase() && !domainEmailsList.includes(currentUserEmail)) {
              domainEmailsList.push(currentUserEmail);
              console.log("✅ Email do utilizador adicionado:", currentUserEmail);
            }
          }
          
          // 🚀 Apenas emails REAIS da BD/CyberPanel + email do utilizador
          // NÃO adicionar fallbacks fictícios
          
          // Se ainda não tem emails e tem currentUserEmail, usar como fallback
          if (domainEmailsList.length === 0 && currentUserEmail) {
            domainEmailsList.push(currentUserEmail);
          }
          
          // 🎯 Reordenar: priorizar email do utilizador logado, depois marketing@, depois ordem alfabética
          const sortedEmails = domainEmailsList.sort((a: string, b: string) => {
            const aLower = a.toLowerCase();
            const bLower = b.toLowerCase();
            const userEmail = currentUserEmail?.toLowerCase();
            const selectedDomain = selectedSite.toLowerCase();
            
            // Prioridade 1: email do utilizador logado
            if (aLower === userEmail) return -1;
            if (bLower === userEmail) return 1;
            
            // Prioridade 2: email marketing@dominio
            if (aLower === `marketing@${selectedDomain}`) return -1;
            if (bLower === `marketing@${selectedDomain}`) return 1;
            
            // Prioridade 3: email geral@dominio ou admin@dominio
            if (aLower === `geral@${selectedDomain}` || aLower === `admin@${selectedDomain}`) return -1;
            if (bLower === `geral@${selectedDomain}` || bLower === `admin@${selectedDomain}`) return 1;
            
            // Resto: ordem alfabética
            return aLower.localeCompare(bLower);
          });
          
          // 🚀 Apenas emails REAIS - não adicionar fallbacks fictícios
          // Se não há emails reais, mostrar apenas o email do utilizador logado
          if (domainEmailsList.length === 0) {
            console.log("📧 Nenhum email real encontrado, usando apenas email do utilizador");
            if (currentUserEmail) {
              const userDomain = currentUserEmail.split('@')[1]?.toLowerCase();
              if (userDomain === selectedSite.toLowerCase()) {
                domainEmailsList.push(currentUserEmail);
              }
            }
          }
          
          // Remover duplicados antes de definir estado
          const uniqueEmails = [...new Set(domainEmailsList)];
          setDomainEmails(uniqueEmails);
          
          // Se o senderEmail atual não está na lista, selecionar o primeiro (principal)
          if (uniqueEmails.length > 0 && !uniqueEmails.includes(senderEmail)) {
            setSenderEmail(uniqueEmails[0]);
          }
          
          console.log("📧 Emails do domínio (final):", uniqueEmails);
      } catch (error) {
        console.error("Erro ao buscar emails do domínio:", error);
        // Em caso de erro, apenas usar email do utilizador logado
        if (currentUserEmail) {
          const userDomain = currentUserEmail.split('@')[1]?.toLowerCase();
          if (userDomain === selectedSite.toLowerCase()) {
            setDomainEmails([currentUserEmail]);
            setSenderEmail(currentUserEmail);
          }
        }
      } finally {
        setLoadingDomainEmails(false);
      }
    };
    
    fetchDomainEmails();
  }, [selectedSite, currentUserEmail]);

  useEffect(() => {
    if (showTemplates) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [showTemplates]);

  const normalizeDomain = (value?: string | null) =>
    (value || '')
      .toLowerCase()
      .trim()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/^mail\./, '')
      .replace(/\/.*$/, '');

  // 🎯 Domínios permitidos: sites do CyberPanel OU domínio do email selecionado
  // Isso permite que clientes SEM site (apenas email corporativo) enviem campanhas
  const allowedDomains = new Set(
    (sites || [])
      .map((s: any) => normalizeDomain(s?.domain))
      .filter(Boolean)
      .concat(selectedSite ? [normalizeDomain(selectedSite)] : []) // Adicionar domínio selecionado
  );

  const isPlatformDomain = (domain: string) =>
    domain.includes('visualdesign') || domain.includes('visualdesigne');

  const hasLikelyDomainTypo = (email: string) => {
    const domain = (email.split('@')[1] || '').toLowerCase().trim();
    return ['gail.com', 'gmial.com', 'gmai.com', 'hotnail.com', 'yaho.com'].includes(domain);
  };

  const handlePlanToggle = (plan: string) => {
    if (selectedPlans.includes(plan)) {
      setSelectedPlans(selectedPlans.filter((p: string) => p !== plan));
    } else {
      setSelectedPlans([...selectedPlans, plan]);
    }
  };

  const handleSend = async () => {
    // Validar campos obrigatórios
    const errors = [];
    if (!subject || subject.trim() === '') {
      errors.push('Assunto do email é obrigatório');
    }
    if (!content || content.trim() === '') {
      errors.push('Conteúdo da mensagem é obrigatório');
    }
    if (selectedPlans.length === 0) {
      errors.push('Selecione pelo menos uma lista de destinatários');
    }

    if (errors.length > 0) {
      setValidationErrors(errors);
      setShowValidationError(true);
      return;
    }

    setIsSending(true);

    try {
      let finalHtml = content;
      if (attachments.length > 0) {
        finalHtml += `<br/><div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee;"><strong>Anexos:</strong><ul style="list-style: none; padding: 0; margin-top: 8px;">`;
        attachments.forEach(url => {
          const fileName = url.split('/').pop() || "Documento";
          finalHtml += `<li style="margin-bottom: 8px;"><a href="${url}" target="_blank" style="color: #ea580c; text-decoration: underline; display: inline-flex; align-items: center; gap: 4px;">📎 ${fileName}</a></li>`;
        });
        finalHtml += `</ul></div>`;
      }

      let allRecipients: { id?: string, email: string }[] = [];

      // Modified for multi-tenant contact fetch
      if (selectedPlans.length > 0) {
        console.log("BUSCANDO SUBSCRITORES PARA:", selectedSite);
        console.log("PLANOS SELECIONADOS:", selectedPlans);
        
        let data = await listarSubscritores(selectedSite);
        // Fallback: se o domínio ativo não tiver contactos, usa todas as listas do cliente.
        if ((!data || data.length === 0) && selectedSite) {
          data = await listarSubscritores();
        }
        console.log("DADOS RECEBIDOS:", data);
        
        if (data) {
          const filteredData = data.filter((s: any) => {
            const contactDomain = normalizeDomain(s?.metadata?.domain);
            const listName = s.metadata?.list || 'Contactos';
            
            // 1. Verificar se a lista está selecionada
            if (!selectedPlans.includes(listName)) return false;
            
            // 2. Se não tem domínio ou é domínio da plataforma, permitir (são contactos genéricos do cliente)
            if (!contactDomain || isPlatformDomain(contactDomain)) return true;
            
            // 3. Se tem domínio, verificar se pertence aos domínios do cliente
            if (allowedDomains.size > 0 && allowedDomains.has(contactDomain)) return true;
            
            // 4. Se chegou aqui e não temos domínios permitidos carregados, permitir por segurança
            if (allowedDomains.size === 0) return true;

            return false;
          });
          console.log("DADOS FILTRADOS:", filteredData);
          allRecipients = [...allRecipients, ...filteredData.map((s: any) => ({ email: s.email }))];
        }
      }

      if (allRecipients.length === 0) {
        toast.error("Nenhum destinatário encontrado na sua lista de contactos.");
        setIsSending(false);
        return;
      }

      const uniqueEmails = Array.from(new Set(allRecipients.map((r: any) => r.email)));
      const emailList = uniqueEmails.filter(Boolean);

      const typoEmails = emailList.filter(hasLikelyDomainTypo);
      if (typoEmails.length > 0) {
        toast.error(`Emails com provável erro de domínio: ${typoEmails.slice(0, 3).join(', ')}${typoEmails.length > 3 ? '...' : ''}`);
        setIsSending(false);
        return;
      }

      console.log("INICIANDO PROCESSO DE ENVIO PARA:", emailList.length, "contactos");
      console.log("LISTA DE EMAILS:", emailList);
      let targetDomain = selectedSite;

      if (!targetDomain || targetDomain === "") {
        targetDomain = process.env.NEXT_PUBLIC_DEFAULT_DOMAIN || 'visualdesign.pt';
        console.warn("DOMINIO VAZIO! Usando fallback:", targetDomain);
        alert("AVISO: Domínio não detetado. Tentando via " + targetDomain);
      }

      // Obter dados do usuário logado para remetente
      const clientName =
        user?.user_metadata?.full_name ||
        user?.user_metadata?.nome ||
        senderEmail?.split('@')[0] ||
        user?.email?.split('@')[0] ||
        '';
      const clientEmail = senderEmail || user?.email || '';

      console.log("ENVIANDO PARA API:", {
        to: emailList,
        subject,
        content: finalHtml.substring(0, 100) + "...",
        domain: targetDomain,
        clientName: clientName,
        clientEmail: clientEmail,
        sender: `"${clientName}" <${clientEmail}>`
      });

      // 🆕 Guardar dados para possível reenvio (avançar fase)
      setLastSendData({
        emailList,
        finalHtml,
        targetDomain,
        clientName,
        clientEmail
      });

      const response = await fetch('/api/mailmarketing-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: emailList,
          subject,
          content: finalHtml,
          domain: targetDomain,
          clientName: clientName,
          clientEmail: clientEmail,
          sender: clientEmail ? `"${clientName || clientEmail}" <${clientEmail}>` : undefined
        })
      });

      console.log("STATUS RESPONSE:", response.status);
      const result = await response.json();
      console.log("RESULTADO DA API:", result);
      console.log("RESPONSE OK?", response.ok, "CODE:", result.code);
      
      // ✅ VERIFICAR ERRO DE LIMITE
      if (!response.ok) {
        console.log("🔍 ERRO DA API:", result);
        
        // Se é erro de limite, mostrar toast informativo
        if (result.code === 'DAILY_LIMIT_EXCEEDED') {
          toast.error(`⚠️ ${result.error}`, { duration: 5000 });
          setIsSending(false);
          return;
        }
        
        // Qualquer outro erro
        throw new Error(result.error || result.message || "Erro ao enviar mensagem");
      }
      
      // 🐛 CORREÇÃO: Verificar se realmente enviou algo
      const sentCount = result?.details?.success ?? 0;
      const failedCount = result?.details?.failed ?? emailList.length;
      
      if (sentCount === 0) {
        throw new Error(result?.details?.errors?.[0] || "Nenhum email foi entregue. Verifique a configuração SMTP.");
      } else if (failedCount > 0) {
        toast.warning(`Envio parcial: ${sentCount} entregue(s), ${failedCount} falha(s).`);
      } else {
        toast.success(`Campanha enviada com sucesso para ${sentCount} contactos!`);
      }

      await salvarCampanha({
        subject,
        content_html: finalHtml,
        total_recipients: emailList.length,
        domain: selectedSite,
        owner_email: user?.email || currentUserEmail || ''
      });

      setAttachments([]);

      setShowSuccessDialog(true);

    } catch (error: any) {
      console.error("❌ ERRO:", error);
      
      // Sempre mostrar erro amigável
      toast.error(error.message || "Erro ao enviar mensagem");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="w-full space-y-5 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        <div className="lg:col-span-3 space-y-5">
          <div className="bg-white rounded-lg border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[600px]">
            <div className="bg-slate-200 px-5 py-3 border-b border-slate-300 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Newspaper className="w-5 h-5 text-slate-600" />
                <h2 className="font-black text-slate-800 uppercase tracking-widest text-xs">Editor de Mensagem</h2>
              </div>
              <div className="flex items-center gap-3">
                {/* 🚀 Seletor de Remetente - mostra emails do domínio */}
                <div className="flex items-center gap-2 bg-white rounded-md border border-slate-300 px-2 h-8">
                  <Mail className="w-4 h-4 text-slate-500 shrink-0" />
                  <select
                    value={senderEmail}
                    onChange={(e) => setSenderEmail(e.target.value)}
                    disabled={loadingDomainEmails || domainEmails.length === 0}
                    className="h-full px-1 text-xs font-bold text-slate-700 bg-transparent border-none focus:outline-none focus:ring-0 min-w-[260px] max-w-[340px] truncate"
                  >
                    {loadingDomainEmails ? (
                      <option value="">A carregar...</option>
                    ) : domainEmails.length === 0 ? (
                      <option value="">Nenhum email disponível</option>
                    ) : (
                      [...new Set(domainEmails)].map((email) => (
                        <option key={email} value={email}>{email}</option>
                      ))
                    )}
                  </select>
                </div>

                <Button
                  onClick={handleSend}
                  disabled={isSending || !senderEmail}
                  className="!bg-emerald-600 hover:!bg-red-600 text-white gap-2 font-black uppercase text-[10px] tracking-widest h-8 px-4 rounded-md shadow-xl shadow-emerald-500/20 transition-all border-none !opacity-100 cursor-pointer"
                >
                  {isSending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                  Enviar
                </Button>

                <Button
                  onClick={() => setShowTemplates(true)}
                  className="!bg-slate-800 hover:!bg-red-600 text-white gap-2 font-black uppercase text-[10px] tracking-widest h-8 px-4 rounded-md transition-all shadow-xl shadow-gray-900/10 border-none !opacity-100 cursor-pointer"
                >
                  <LayoutTemplate className="w-3 h-3" />
                  Templates
                </Button>
              </div>
            </div>
            <div className="">
              <RichTextEditor
                value={content}
                onChange={setContent}
                placeholder="Escreva o corpo do seu email aqui..."
                className="min-h-[500px] border-none"
              >
                <div className="px-5 py-0 bg-white border-b border-slate-200 flex items-center gap-4">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest shrink-0 border-r border-slate-200 pr-4">Assunto</span>
                  <input
                    type="text"
                    placeholder="Escreva aqui o assunto da sua campanha..."
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full bg-transparent border-none focus:ring-0 outline-none text-sm font-bold placeholder:text-slate-200 text-slate-800 p-0"
                  />
                  <MultiFileUpload
                    value={attachments}
                    onChange={setAttachments}
                    folder="client-marketing"
                    layout="minimal"
                    showList={false}
                    className="shrink-0"
                  />
                </div>
              </RichTextEditor>
            </div>
          </div>

          <div className="bg-white p-5 rounded-lg border border-slate-100 shadow-sm space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <FileIcon className="w-4 h-4 text-orange-600" />
                Ficheiros em Anexo
              </h3>
              <span className="text-[10px] font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">
                {attachments.length} Ficheiros
              </span>
            </div>

            <MultiFileUpload
              value={attachments}
              onChange={setAttachments}
              folder="client-marketing"
              layout="default"
              description="PDF, Imagens, Documentos (Máx 10MB)"
            />
          </div>
        </div>

        <div className="space-y-5">

          <div className="bg-white p-5 rounded-lg border border-slate-100 shadow-sm space-y-5">
            <div className="flex flex-col">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Destinatários</h3>
            </div>
            <div className="space-y-3">
              {listas.map(plan => (
                <div key={plan} className="group relative">
                  <label className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer ${selectedPlans.includes(plan) ? 'bg-orange-50 border-orange-200 ring-1 ring-orange-500/10' : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'}`}>
                    <Checkbox id={`plan-${plan}`} checked={selectedPlans.includes(plan)} onCheckedChange={() => handlePlanToggle(plan)} className="rounded-md border-slate-300 data-[state=checked]:bg-orange-600 data-[state=checked]:border-orange-600" />
                    <span className={`text-xs font-bold ${selectedPlans.includes(plan) ? 'text-orange-700' : 'text-slate-600'}`}>{plan}</span>
                  </label>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setListas(listas.filter(l => l !== plan));
                      setSelectedPlans(selectedPlans.filter(p => p !== plan));
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all"
                    title="Eliminar lista"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}

              <button onClick={() => setShowNewListPopup(true)} className="w-fit mt-2 ml-1 text-[10px] font-bold text-orange-600 hover:text-slate-900 uppercase tracking-widest underline flex items-center gap-1">
                <Plus size={10} /> Criar nova lista
              </button>
            </div>
            <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-100/50 flex items-start gap-3">
              <Sparkles className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <p className="text-[10px] text-blue-800 font-medium leading-relaxed">Mensagens enviadas apenas para os contactos do domínio selecionado.</p>
            </div>
            
            {/* 🚀 STATUS DE REPUTAÇÃO - SIMPLIFICADO */}
            {selectedSite && (
              <div className="mt-4 p-4 rounded-lg border border-slate-200/70 shadow-sm transition-all duration-300">
                {loadingReputation ? (
                  <div className="flex items-center gap-2 text-slate-400">
                    <div className="w-4 h-4 border-2 border-slate-300 border-t-orange-500 rounded-full animate-spin" />
                    <span className="text-[10px] font-medium">A carregar...</span>
                  </div>
                ) : domainReputation ? (
                  <div className="space-y-3">
                    {/* Título e contador no lado esquerdo */}
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-bold text-slate-700">Limite Diário</span>
                        <div className="text-[10px] text-red-500 font-medium">200 emails disponíveis</div>
                      </div>
                    </div>
                    
                    {/* Barra de progresso */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-slate-500">
                        <span>0 enviados</span>
                        <span>200 limite</span>
                      </div>
                      <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                        {domainReputation.sentToday > 0 && (
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${
                              domainReputation.remainingToday <= 0 ? 'bg-red-500' : 
                              domainReputation.sentToday / 200 > 0.8 ? 'bg-yellow-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${Math.min((domainReputation.sentToday / 200) * 100, 100)}%` }}
                          />
                        )}
                      </div>
                    </div>
                    
                    {/* Alerta quando atingir limite */}
                    {domainReputation.remainingToday <= 0 && (
                      <div className="p-2 bg-red-100/50 rounded border border-red-200">
                        <p className="text-[10px] text-red-700 font-medium text-center">
                          ⚠️ Limite diário atingido. Aguarde até amanhã.
                        </p>
                      </div>
                    )}
                    
                    {/* Linha 6: Info adicional */}
                    <div className="flex justify-between text-[9px] text-slate-400 pt-2 border-t border-slate-200/50">
                      <span>Dias ativos: {domainReputation.daysActive || 0}</span>
                      <span>Total enviado: {domainReputation.sentTotal || 0}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-400">Selecione um domínio para ver o status</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showTemplates && (
        <EmailTemplates
          onSelect={(html: string) => { setContent(html); setShowTemplates(false); toast.success("Template aplicado!"); }}
          onClose={() => setShowTemplates(false)}
        />
      )}
      {showNewListPopup && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[100] animate-in fade-in duration-300">
          <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-sm mx-4 border border-slate-200 animate-in zoom-in-95 duration-300">
            <div className="mb-5">
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Nova Lista</h3>
              <p className="text-xs text-slate-500 font-medium">Atribua um nome à sua nova audiência.</p>
            </div>
            <input
              autoFocus
              type="text"
              placeholder="Ex: Clientes VIP, Black Friday..."
              value={newListTitle}
              onChange={(e) => setNewListTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newListTitle) {
                  setListas([...listas, newListTitle]);
                  setNewListTitle("");
                  setShowNewListPopup(false);
                }
              }}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all mb-5"
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  if (newListTitle) {
                    setListas([...listas, newListTitle]);
                    setNewListTitle("");
                    setShowNewListPopup(false);
                  }
                }}
                disabled={!newListTitle}
                className="flex-1 bg-black hover:bg-red-600 text-white py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
              >
                Adicionar
              </button>
              <button
                onClick={() => { setShowNewListPopup(false); setNewListTitle(""); }}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Popup */}
      {showSuccessDialog && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[100] animate-in fade-in duration-300">
          <div className="bg-white rounded-xl shadow-2xl p-10 w-full max-w-sm mx-4 border border-slate-200 text-center animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight mb-2">Campanha Enviada!</h3>
            <p className="text-sm text-slate-500 font-medium mb-6">A sua mensagem foi enviada com sucesso para a lista selecionada.</p>
            <button 
              onClick={() => {
                setShowSuccessDialog(false);
                setSubject("");
                setContent("");
              }}
              className="w-full bg-emerald-600 hover:bg-red-600 text-white py-3.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/20"
            >
              OK, Fechar Editor
            </button>
          </div>
        </div>
      )}

      {/* Modal de Validação de Campos */}
      {showValidationError && (
        <>
          <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 animate-in fade-in duration-300">
            <div className="bg-white rounded-xl p-8 max-w-sm w-full mx-4 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-300">
              <div className="flex flex-col items-center gap-3 mb-3 text-center">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Campos Obrigatórios</h3>
                  <p className="text-xs text-gray-500">Preencha todos os campos obrigatórios</p>
                </div>
              </div>
              
              <div className="space-y-1.5 mb-4 text-center">
                {validationErrors.map((error, index) => (
                  <div key={index} className="flex items-center justify-center gap-2 text-xs text-red-600">
                    <X className="w-3 h-3 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                ))}
              </div>
              
              <div className="flex justify-center">
                <button
                  onClick={() => setShowValidationError(false)}
                  className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                >
                  Entendido
                </button>
              </div>
            </div>
          </div>
          <style jsx>{`
            body { overflow: hidden; }
          `}</style>
        </>
      )}

      {/* 🚀 Popup Informativo sobre Reputação */}
      {showReputationInfo && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[100] animate-in fade-in duration-300">
          <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-lg mx-4 border border-slate-200 animate-in zoom-in-95 duration-300 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-black text-slate-900 tracking-tight">🛡️ Sistema de Reputação</h3>
              <button 
                onClick={() => setShowReputationInfo(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4 text-sm text-slate-600">
              <p className="leading-relaxed">
                O <strong>sistema de reputação</strong> protege o seu domínio para garantir que os seus emails cheguem à caixa de entrada e não ao spam.
              </p>
              
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                <h4 className="font-bold text-blue-800 mb-2 text-xs uppercase tracking-wider">Como funciona?</h4>
                <ul className="space-y-2 text-xs">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">1.</span>
                    <span>Cada domínio começa com <strong>50 emails/dia</strong> e vai aumentando automaticamente.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">2.</span>
                    <span>A reputação é avaliada a cada <strong>7 dias</strong> e pode subir ou descer.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">3.</span>
                    <span>Se enviar spam ou ter muitos erros, a reputação desce e os limites reduzem.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">4.</span>
                    <span>Se manter boas práticas, a reputação sobe e ganha mais emails/dia.</span>
                  </li>
                </ul>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Fases do Warm-up:</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 bg-slate-50 rounded border border-slate-200">
                    <span className="font-bold text-blue-600">Dias 0-1:</span> 50 emails/dia
                  </div>
                  <div className="p-2 bg-slate-50 rounded border border-slate-200">
                    <span className="font-bold text-yellow-600">Dias 2-3:</span> 100 emails/dia
                  </div>
                  <div className="p-2 bg-slate-50 rounded border border-slate-200">
                    <span className="font-bold text-orange-600">Dias 4-7:</span> 300 emails/dia
                  </div>
                  <div className="p-2 bg-slate-50 rounded border border-slate-200">
                    <span className="font-bold text-green-600">Dias 8-14:</span> 600 emails/dia
                  </div>
                  <div className="p-2 bg-slate-50 rounded border border-slate-200">
                    <span className="font-bold text-emerald-600">Dias 15-30:</span> 1000 emails/dia
                  </div>
                  <div className="p-2 bg-slate-50 rounded border border-slate-200">
                    <span className="font-bold text-purple-600">Dias 30+:</span> 2000 emails/dia
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                <p className="text-xs text-amber-800">
                  <strong>💡 Dica:</strong> Mantenha a sua lista de contactos limpa e atualizada para evitar bounces e manter a reputação alta.
                </p>
              </div>
            </div>
            
            <button 
              onClick={() => setShowReputationInfo(false)}
              className="w-full mt-6 bg-slate-800 hover:bg-red-600 text-white py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-lg"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

function MailMarketingContacts({ selectedSite, setSelectedSite, sites, listas, searchTerm, setSearchTerm }: { selectedSite: string, setSelectedSite: (s: string) => void, sites: any[], listas: string[], searchTerm: string, setSearchTerm: (value: string) => void }) {
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newListLabel, setNewListLabel] = useState('Contactos');
  const [newDomainLabel, setNewDomainLabel] = useState('');
  const [editingSub, setEditingSub] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedSubscriberIds, setSelectedSubscriberIds] = useState<string[]>([]);
  const itemsPerPage = 10;

  const normalizeDomain = (value?: string | null) =>
    (value || '')
      .toLowerCase()
      .trim()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/^mail\./, '')
      .replace(/\/.*$/, '');

  // 🎯 Domínios permitidos: sites do CyberPanel OU domínio do email selecionado
  // Isso permite que clientes SEM site (apenas email corporativo) vejam seus contactos
  const allowedDomains = new Set(
    (sites || [])
      .map((s: any) => normalizeDomain(s?.domain))
      .filter(Boolean)
      .concat(selectedSite ? [normalizeDomain(selectedSite)] : []) // Adicionar domínio selecionado
  );

  const isPlatformDomain = (domain: string) =>
    domain.includes('visualdesign') || domain.includes('visualdesigne');

  const COMMON_EMAIL_DOMAIN_FIXES: Record<string, string> = {
    'gail.com': 'gmail.com',
    'gmial.com': 'gmail.com',
    'gmai.com': 'gmail.com',
    'hotnail.com': 'hotmail.com',
    'yaho.com': 'yahoo.com'
  };

  const normalizeEmailDomainTypos = (rawEmail: string) => {
    const cleaned = (rawEmail || '').toLowerCase().trim();
    const atIndex = cleaned.lastIndexOf('@');
    if (atIndex <= 0 || atIndex === cleaned.length - 1) {
      return cleaned;
    }
    const localPart = cleaned.slice(0, atIndex);
    const domainPart = cleaned.slice(atIndex + 1);
    const correctedDomain = COMMON_EMAIL_DOMAIN_FIXES[domainPart] || domainPart;
    return `${localPart}@${correctedDomain}`;
  };

  const filteredSubscribers = subscribers.filter(s =>
    !searchTerm || s.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calcular itens para página atual
  const totalPages = Math.ceil(filteredSubscribers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = filteredSubscribers.slice(startIndex, endIndex);

  // Resetar página quando mudar busca
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  useEffect(() => {
    if (showAddForm) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showAddForm]);

  const fetchSubs = async () => {
    try {
      setLoading(true);
      let data = await listarSubscritores(selectedSite);
      // Fallback: evita ecrã vazio quando domínio selecionado não coincide com contactos legados.
      if ((!data || data.length === 0) && selectedSite) {
        data = await listarSubscritores();
      }
      let filtered = (data || []).filter((s: any) => {
        const contactDomain = normalizeDomain(s?.metadata?.domain);
        if (!contactDomain || isPlatformDomain(contactDomain)) return false;
        return allowedDomains.has(contactDomain);
      });
      if (searchTerm) {
        filtered = filtered.filter((s: any) => s.email.toLowerCase().includes(searchTerm.toLowerCase()));
      }
      setSubscribers(filtered);
      setSelectedSubscriberIds((prev) => prev.filter((id) => filtered.some((s: any) => s.id === id)));
    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar subscritores");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Migração automática de contatos antigos ao carregar
    const runMigration = async () => {
      try {
        const response = await fetch('/api/migrate-contacts', { method: 'POST' });
        const result = await response.json();
        if (result.migrated > 0) {
          console.log(`Migração: ${result.migrated} contatos atualizados`);
          fetchSubs(); // Recarrega após migração
        }
      } catch (error) {
        console.error('Erro na migração automática:', error);
      }
    };
    runMigration();
    fetchSubs();
  }, [selectedSite, searchTerm]);

  const openEdit = (sub: any) => {
    setEditingSub(sub);
    setNewEmail(sub.email);
    setNewListLabel(sub.metadata?.list || 'Contactos');
    setNewDomainLabel(sub.metadata?.domain || selectedSite || '');
    setShowAddForm(true);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = normalizeEmailDomainTypos(newEmail?.trim() || '');
    if (!email) return;

    try {
      // 🆕 VALIDAÇÃO DE EMAIL ANTES DE ADICIONAR
      toast.loading('A validar email...');
      
      const validationResponse = await fetch(`/api/validate-emails?email=${encodeURIComponent(email)}`);
      const validation = await validationResponse.json();
      
      toast.dismiss();
      
      if (!validation.success || !validation.isValid) {
        const errors = validation.validation?.errors?.join(', ') || 'Email inválido';
        const suggestions = validation.validation?.suggestions;
        
        let errorMsg = `Email inválido: ${errors}`;
        if (suggestions && suggestions.length > 0) {
          errorMsg += `\n\nQuis dizer: ${suggestions.join(', ')}?`;
          
          // Pergunta se quer usar a sugestão
          const useSuggestion = window.confirm(
            `⚠️ ${errorMsg}\n\nDeseja usar "${suggestions[0]}" em vez disso?`
          );
          
          if (useSuggestion) {
            setNewEmail(suggestions[0]);
            return; // Para aqui para o user confirmar
          }
        } else {
          toast.error(errorMsg);
        }
        return;
      }
      
      // Verifica se é email de função (aviso, não bloqueia)
      if (validation.validation?.isRoleBased) {
        const proceed = window.confirm(
          `⚠️ Este parece ser um email de função (${email}).\n` +
          `Emails como admin@, info@, noreply@ têm menor taxa de abertura.\n\n` +
          `Deseja continuar mesmo assim?`
        );
        if (!proceed) return;
      }

      const payload = {
        email: email,
        full_name: newName || '',
        domain: newDomainLabel || selectedSite || '',
        list: newListLabel
      };

      // Em modo edição, atualiza o registo existente em vez de inserir novo.
      const result = editingSub?.id
        ? await atualizarSubscritor(editingSub.id, payload)
        : await adicionarSubscritor(payload);

      if (result) {
        if (newEmail?.trim().toLowerCase() !== email) {
          toast.success(`Email corrigido automaticamente para ${email}`);
        }
        toast.success(editingSub ? "Contacto atualizado com sucesso!" : "Contacto adicionado com sucesso!");
        setNewEmail('');
        setNewName('');
        setNewDomainLabel(selectedSite || '');
        setShowAddForm(false);
        setEditingSub(null);
        fetchSubs();
      }
    } catch (error: any) {
      console.error("ERRO COMPLETO:", error);
      toast.error(`Erro: ${error.message || "Tente novamente mais tarde"}`);
    }
  };

  const handleDelete = async (id: string, email: string) => {
    if (!confirm(`Remover subscritor ${email}?`)) return;
    try {
      await removerSubscritor(id);
      toast.success("Subscritor removido");
      fetchSubs();
    } catch (error) {
      toast.error("Erro ao remover subscritor");
    }
  };

  const toggleSelectSubscriber = (id: string) => {
    setSelectedSubscriberIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAllCurrentItems = () => {
    const currentIds = currentItems.map((sub: any) => sub.id);
    const isAllSelected = currentIds.every((id: string) => selectedSubscriberIds.includes(id));
    if (isAllSelected) {
      setSelectedSubscriberIds((prev) => prev.filter((id) => !currentIds.includes(id)));
    } else {
      setSelectedSubscriberIds((prev) => Array.from(new Set([...prev, ...currentIds])));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedSubscriberIds.length === 0) return;
    if (!confirm(`Remover ${selectedSubscriberIds.length} contacto(s) selecionado(s)?`)) return;
    try {
      const selectedMap = new Set(selectedSubscriberIds);
      const selectedRows = subscribers.filter((s: any) => selectedMap.has(s.id));
      await Promise.all(selectedRows.map((sub: any) => removerSubscritor(sub.id)));
      toast.success(`${selectedRows.length} contacto(s) removido(s).`);
      setSelectedSubscriberIds([]);
      fetchSubs();
    } catch (error) {
      toast.error("Erro ao remover contactos selecionados");
    }
  };

  const exportCSV = () => {
    const headers = ['Email', 'Nome', 'Status', 'Data Subscrição'];
    const rows = subscribers.map(s => [s.email, s.full_name || '', s.status, new Date(s.created_at).toLocaleDateString()]);
    const csvContent = [headers, ...rows].map(e => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `subscritores_${selectedSite}_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
    toast.success("Exportação concluída!");
  };

  return (
    <div className="w-full space-y-5 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 bg-white p-5 rounded-lg border border-slate-100 shadow-sm">
        <div className="flex items-center gap-5">
          <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
            <Users className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">Lista de Contactos</h2>
            <p className="text-sm text-slate-500 font-medium tracking-tight">Gestão da base de dados para {selectedSite || 'o seu domínio'}.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="relative min-w-[220px]">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
            <select
              value={selectedSite}
              onChange={(e) => setSelectedSite(e.target.value)}
              className="h-10 rounded-lg border border-slate-200 bg-white pl-10 pr-8 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-orange-500/20 min-w-[220px]"
            >
              {sites.length > 0 ? (
                // Cliente tem sites no CyberPanel
                sites.map((site: any) => (
                  <option key={site.domain} value={site.domain}>{site.domain}</option>
                ))
              ) : selectedSite ? (
                // Cliente sem site mas com domínio do email
                <option value={selectedSite}>{selectedSite}</option>
              ) : (
                <option value="">Selecione um domínio</option>
              )}
            </select>
          </div>
          {selectedSubscriberIds.length > 1 ? (
            <Button
              onClick={handleDeleteSelected}
              className="!bg-red-600 hover:!bg-red-700 text-white px-5 h-10 rounded-lg font-black uppercase text-[10px] tracking-widest shadow-lg transition-all border-none !opacity-100"
            >
              <Trash2 size={14} className="mr-1" /> Eliminar Selecionados ({selectedSubscriberIds.length})
            </Button>
          ) : (
            <>
              <Button onClick={() => setShowAddForm(true)} className="!bg-emerald-600 hover:bg-[#dc2626] text-white px-5 h-10 rounded-lg font-black uppercase text-[10px] tracking-widest shadow-lg shadow-emerald-500/20 transition-all border-none !opacity-100">
                <Plus size={14} className="mr-1" /> Adicionar
              </Button>
              <Button
                onClick={() => document.getElementById('csv-import-input')?.click()}
                className="!bg-slate-800 hover:bg-[#dc2626] text-white px-5 h-10 rounded-lg font-black uppercase text-[10px] tracking-widest shadow-lg shadow-slate-900/10 transition-all border-none !opacity-100"
              >
                <Download size={14} className="mr-1 rotate-180" /> Importar
              </Button>
              <button onClick={exportCSV} className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all font-black text-[10px] uppercase tracking-widest border border-slate-200 shadow-sm">
                <Download size={16} /> Exportar
              </button>
            </>
          )}
          <input
            id="csv-import-input"
            type="file"
            accept=".csv"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;

              const reader = new FileReader();
              reader.onload = async (event) => {
                const text = event.target?.result as string;
                const lines = text.split('\n');
                let count = 0;
                let invalidCount = 0;
                let duplicateCount = 0;
                
                // Coleta todos os emails primeiro
                const emailsToImport: string[] = [];
                for (let i = 1; i < lines.length; i++) {
                  const line = lines[i].trim();
                  if (!line) continue;
                  const [email] = line.split(',');
                  if (email && email.includes('@')) {
                    emailsToImport.push(normalizeEmailDomainTypos(email.trim()));
                  }
                }
                
                if (emailsToImport.length === 0) {
                  toast.error('Nenhum email válido encontrado no ficheiro');
                  return;
                }
                
                toast.loading(`A validar ${emailsToImport.length} emails...`);
                
                // 🆕 VALIDAÇÃO DE EMAILS ANTES DE IMPORTAR
                try {
                  const response = await fetch('/api/validate-emails', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ emails: emailsToImport, mode: 'bulk' })
                  });
                  
                  const validation = await response.json();
                  
                  if (!validation.success) {
                    toast.error('Erro na validação de emails');
                    return;
                  }
                  
                  const { validEmails, invalidEmails, results } = validation.validation;
                  const summary = validation.summary;
                  
                  toast.dismiss();
                  
                  // Mostra resumo da validação
                  if (invalidEmails.length > 0) {
                    const invalidDetails = results
                      .filter((r: any) => !r.isValid)
                      .map((r: any) => `${r.email} (${r.errors.join(', ')})`)
                      .slice(0, 5);
                    
                    toast.warning(
                      `${summary.valid} válidos, ${summary.invalid} inválidos. \n\nInválidos:\n${invalidDetails.join('\n')}${invalidEmails.length > 5 ? '\n...' : ''}`,
                      { duration: 6000 }
                    );
                  }
                  
                  if (validEmails.length === 0) {
                    toast.error('Nenhum email válido para importar');
                    return;
                  }
                  
                  // Confirmação se muitos inválidos
                  if (summary.validPercentage < 70) {
                    const proceed = window.confirm(
                      `⚠️ ATENÇÃO: Apenas ${summary.validPercentage}% dos emails são válidos.\n\n` +
                      `Válidos: ${summary.valid}\n` +
                      `Inválidos: ${summary.invalid}\n\n` +
                      `Deseja continuar a importar apenas os ${summary.valid} emails válidos?`
                    );
                    if (!proceed) return;
                  }
                  
                  toast.loading(`A importar ${validEmails.length} contactos válidos...`);
                  
                  // Importa apenas emails válidos
                  for (const email of validEmails) {
                    try {
                      await adicionarSubscritor({ email, domain: selectedSite });
                      count++;
                    } catch (err: any) {
                      if (err.message?.includes('duplicate')) {
                        duplicateCount++;
                      } else {
                        console.error(`Erro ao importar ${email}`, err);
                      }
                    }
                  }
                  
                  toast.dismiss();
                  const msg = `${count} contactos importados` + 
                    (duplicateCount > 0 ? ` (${duplicateCount} duplicados ignorados)` : '') +
                    (invalidEmails.length > 0 ? ` - ${invalidEmails.length} inválidos rejeitados` : '');
                  toast.success(msg);
                  fetchSubs();
                  
                } catch (err) {
                  toast.dismiss();
                  toast.error('Erro na validação: ' + (err as Error).message);
                }
              };
              reader.readAsText(file);
            }}
          />
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="px-5 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest w-[40px]">
                  <input
                    type="checkbox"
                    checked={currentItems.length > 0 && currentItems.every((sub: any) => selectedSubscriberIds.includes(sub.id))}
                    onChange={toggleSelectAllCurrentItems}
                    className="accent-orange-600"
                    aria-label="Selecionar todos os contactos visíveis"
                  />
                </th>
                <th className="px-5 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Contacto</th>
                <th className="px-5 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Dominio</th>
                <th className="px-5 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Lista</th>
                <th className="px-5 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                <th className="px-5 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <MailMarketingContactsSkeleton />
              ) : currentItems.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-20 text-center text-slate-400">Nenhum subscritor encontrado.</td></tr>
              ) : currentItems.map((sub: any) => (
                <tr key={sub.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-5 py-[5px]">
                    <input
                      type="checkbox"
                      checked={selectedSubscriberIds.includes(sub.id)}
                      onChange={() => toggleSelectSubscriber(sub.id)}
                      className="accent-orange-600"
                      aria-label={`Selecionar ${sub.email}`}
                    />
                  </td>
                  <td className="px-5 py-[5px]">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-900 text-sm">{sub.email}</span>
                    </div>
                  </td>
                  <td className="px-5 py-[5px]">
                    <span className="text-[10px] font-black px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full border border-blue-100 tracking-widest">
                      {sub.metadata?.domain || '-'}
                    </span>
                  </td>
                  <td className="px-5 py-[5px]">
                    <span className="text-[10px] font-black px-2 py-0.5 bg-orange-50 text-orange-600 rounded-full border border-orange-100 uppercase tracking-widest">
                      {sub.metadata?.list || 'Contactos'}
                    </span>
                  </td>
                  <td className="px-5 py-[5px]">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-600 border border-emerald-100">
                      ACTIVE
                    </span>
                  </td>
                  <td className="px-5 py-[5px] text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEdit(sub)}
                        className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg border border-slate-100 transition-all bg-white shadow-sm"
                        title="Editar"
                      >
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleDelete(sub.id, sub.email)} className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg border border-slate-100 hover:border-red-200 transition-all bg-white shadow-sm">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="bg-white rounded-lg border border-slate-100 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-600">
              Mostrando {startIndex + 1}-{Math.min(endIndex, filteredSubscribers.length)} de {filteredSubscribers.length} contactos
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm bg-slate-100 hover:bg-slate-200 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Anterior
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`px-3 py-1 text-sm rounded-md transition-colors ${
                        currentPage === pageNum
                          ? 'bg-orange-600 text-white'
                          : 'bg-slate-100 hover:bg-slate-200'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-sm bg-slate-100 hover:bg-slate-200 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Próxima
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddForm && (
        <div className="fixed inset-0 h-screen bg-slate-900/40 z-[100] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-lg w-full max-w-md shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-300">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-white text-slate-900">
              <h3 className="text-lg font-black tracking-tight">{editingSub ? 'Editar Contacto' : 'Novo Contacto'}</h3>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setEditingSub(null);
                  setNewEmail('');
                  setNewDomainLabel(selectedSite || '');
                }}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <XLucide className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleAdd} className="p-5 space-y-5">
              <div className="space-y-2">
                <Input type="email" required value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="rounded-lg h-10 border-slate-200 focus:ring-red-500 text-sm" placeholder="Email do contacto" />
              </div>
              <div className="space-y-2">
                <select
                  value={newListLabel}
                  onChange={(e) => setNewListLabel(e.target.value)}
                  className="w-full rounded-lg h-10 border-slate-200 focus:ring-red-500 bg-slate-50 text-sm outline-none px-3 border shadow-sm cursor-pointer font-bold text-slate-700 hover:bg-white transition-colors"
                >
                  <option value="" disabled>Selecionar lista</option>
                  {listas.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <select
                  value={newDomainLabel}
                  onChange={(e) => setNewDomainLabel(e.target.value)}
                  className="w-full rounded-lg h-10 border-slate-200 focus:ring-red-500 bg-slate-50 text-sm outline-none px-3 border shadow-sm cursor-pointer font-bold text-slate-700 hover:bg-white transition-colors"
                >
                  <option value="" disabled>Selecionar dominio</option>
                  {sites.map((site: any) => (
                    <option key={site.domain} value={site.domain}>{site.domain}</option>
                  ))}
                </select>
              </div>
              <div className="pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <Button type="submit" className="h-11 !bg-slate-900 hover:!bg-red-600 text-white font-black uppercase text-[11px] tracking-widest rounded-lg shadow-lg shadow-slate-900/10 transition-all border-none !opacity-100">
                    {editingSub ? 'Guardar Alteracoes' : (
                      <><Plus size={16} /> Adicionar</>
                    )}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false);
                      setEditingSub(null);
                      setNewEmail('');
                      setNewName('');
                      setNewDomainLabel(selectedSite || '');
                    }}
                    className="h-11 !bg-red-600 hover:!bg-red-700 text-white font-black uppercase text-[11px] tracking-widest rounded-lg transition-all border-none !opacity-100"
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function MailMarketingCampaigns({ selectedSite, currentUserEmail, onResend }: { selectedSite: string, currentUserEmail?: string, onResend?: (c: any) => void }) {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<string[]>([]);

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const data = await listarCampanhas(selectedSite, currentUserEmail);
      setCampaigns(data || []);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar campanhas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, [selectedSite]);

  const filteredCampaigns = campaigns.filter(c => !searchTerm || c.subject?.toLowerCase().includes(searchTerm.toLowerCase()));

  const handleClearTestData = async () => {
    if (!confirm('🧹 Limpar dados de teste?\n\nIsso vai zerar o contador de emails enviados em todas as campanhas.\n\nContinuar?')) return;
    
    try {
      toast.loading('A limpar dados de teste...');
      const result = await limparDadosCampanhas(currentUserEmail);
      toast.dismiss();
      
      if (result.success) {
        toast.success(`✅ ${result.message}`);
        fetchCampaigns(); // Recarregar lista
      } else {
        toast.error('Erro ao limpar dados');
      }
    } catch (error: any) {
      toast.dismiss();
      toast.error('Erro: ' + error.message);
    }
  };

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      {/* Header Panel */}
      <div className="flex items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">Histórico de Campanhas</h2>
            <p className="text-sm text-slate-500 font-medium">Análise de desempenho e registo de mensagens enviadas.</p>
          </div>
        </div>
        
        {/* Botão limpar dados de teste */}
        <button
          onClick={handleClearTestData}
          className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[10px] font-bold transition-colors flex items-center gap-2"
          title="Zerar contadores de emails (modo teste)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Limpar Testes
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm relative overflow-hidden">
          <Mail className="absolute -right-4 -bottom-4 w-28 h-28 text-slate-50 opacity-50" />
          <div className="relative z-10 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                <Mail className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total de Envios</span>
            </div>
            <div className="flex items-end gap-3 pb-2 border-slate-100">
              <span className="text-4xl font-black text-slate-900 leading-none">{campaigns.reduce((acc, curr) => acc + (curr.recipient_count || curr.total_recipients || 0), 0)}</span>
              <span className="text-[9px] font-black uppercase text-blue-600 bg-blue-50 px-2 py-1 rounded-md mb-0.5">Acumulado</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm relative overflow-hidden">
          <TrendingUp className="absolute -right-4 -bottom-4 w-28 h-28 text-slate-50 opacity-50" />
          <div className="relative z-10 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
              </div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Taxa de Sucesso</span>
            </div>
            <div className="flex items-end gap-3 pb-2">
              <span className="text-4xl font-black text-slate-900 leading-none">
                {campaigns.length > 0 ? "100" : "0.0"}%
              </span>
              <span className="text-[9px] font-black uppercase text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md mb-0.5">Entrega</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm relative overflow-hidden">
          <Calendar className="absolute -right-4 -bottom-4 w-28 h-28 text-slate-50 opacity-50" />
          <div className="relative z-10 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                <ArrowUpRight className="w-5 h-5 text-purple-600" />
              </div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Campanhas</span>
            </div>
            <div className="flex items-end gap-3 pb-2">
              <span className="text-4xl font-black text-slate-900 leading-none">{campaigns.length}</span>
              <span className="text-[9px] font-black uppercase text-purple-600 bg-purple-50 px-2 py-1 rounded-md mb-0.5">Executadas</span>
            </div>
          </div>
        </div>
      </div>

      {/* List Area */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[400px]">
        {/* Header List */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 border-b border-slate-50">
          <div className="flex items-center gap-3">
            <h3 className="font-black text-slate-900 uppercase tracking-widest text-[11px]">Lista de Envios</h3>
            <span className="px-3 py-1 bg-slate-50 text-slate-400 rounded-full text-[10px] font-bold border border-slate-100">{filteredCampaigns.length} Registos</span>
            
            {selectedCampaignIds.length > 0 && (
              <button
                onClick={async () => {
                  if (confirm(`Tem a certeza que deseja eliminar ${selectedCampaignIds.length} campanhas?`)) {
                    for (const id of selectedCampaignIds) {
                      await removerCampanha(id);
                    }
                    setSelectedCampaignIds([]);
                    fetchCampaigns();
                  }
                }}
                className="ml-4 flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1 rounded-lg text-[10px] font-bold transition-colors"
                title="Apagar seleccionadas"
              >
                <Trash2 className="w-3.5 h-3.5" />
                ({selectedCampaignIds.length}) Apagar
              </button>
            )}
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text"
              placeholder="Pesquisar assunto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-slate-300 transition-all text-slate-700" 
            />
          </div>
        </div>

        {/* List Content */}
        <div className="flex-1 p-5">
          {loading ? (
             <MailMarketingCampaignsSkeleton />
          ) : filteredCampaigns.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full pt-16 pb-12 text-center">
              <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center text-slate-200 mb-6 border border-slate-100">
                <Mail className="w-8 h-8" />
              </div>
              <h4 className="font-black text-slate-900 mb-2">Ainda não enviou nenhuma campanha</h4>
              <p className="text-sm font-medium text-slate-400">Crie a sua primeira mensagem no compositor.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Select All Checkbox - Opcional se houver poucas */}
              <div className="flex items-center gap-3 px-2 border-b border-slate-50 pb-2">
                <input 
                  type="checkbox"
                  checked={filteredCampaigns.length > 0 && selectedCampaignIds.length === filteredCampaigns.length}
                  onChange={(e) => {
                    if (e.target.checked) setSelectedCampaignIds(filteredCampaigns.map(c => c.id));
                    else setSelectedCampaignIds([]);
                  }}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Seleccionar Todas</span>
              </div>
              
              {filteredCampaigns.map((camp) => (
                <div key={camp.id} className={`flex items-center justify-between p-4 rounded-xl border ${selectedCampaignIds.includes(camp.id) ? 'border-blue-200 bg-blue-50/20' : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50/50'} transition-all group`}>
                  <div className="flex items-center gap-4">
                    <input 
                      type="checkbox"
                      checked={selectedCampaignIds.includes(camp.id)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedCampaignIds(prev => [...prev, camp.id]);
                        else setSelectedCampaignIds(prev => prev.filter(id => id !== camp.id));
                      }}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                    />
                    <div className="w-12 h-12 bg-white border border-slate-100 rounded-xl shadow-sm flex items-center justify-center group-hover:scale-105 transition-transform">
                      <Mail className="w-5 h-5 text-slate-400 group-hover:text-orange-600 transition-colors" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 group-hover:text-orange-600 transition-colors">{camp.subject}</h4>
                      <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mt-1">
                        {new Date(camp.sent_at || camp.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-[9px] uppercase tracking-widest text-slate-400 font-black mb-0.5">Contactos</p>
                      <p className="text-sm font-black text-slate-900">{camp.recipient_count || camp.total_recipients || 0}</p>
                    </div>
                    <div className="w-20 flex justify-end">
                      <span className={`px-3 py-1 rounded-md text-[9px] font-black uppercase tracking-widest flex items-center justify-center h-6 ${camp.status === 'sent' || !camp.status ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                        {camp.status === 'sent' || !camp.status ? 'Enviado' : camp.status}
                      </span>
                    </div>
                    
                    {/* Acções */}
                    <div className="flex items-center gap-2">
                       <button
                         onClick={() => {
                           if (onResend) onResend(camp);
                         }}
                         className="flex items-center justify-center w-8 h-8 rounded-lg border border-slate-100 bg-white hover:bg-orange-50 hover:border-orange-200 hover:text-orange-600 text-slate-400 transition-all font-bold"
                         title="Reenviar Campanha"
                       >
                         <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                       </button>
                       <button
                         onClick={async () => {
                           if (confirm(`Tem a certeza que deseja eliminar a campanha "${camp.subject}"?`)) {
                             await removerCampanha(camp.id);
                             fetchCampaigns();
                           }
                         }}
                         className="flex items-center justify-center w-8 h-8 rounded-lg border border-slate-100 bg-white hover:bg-red-50 hover:border-red-200 hover:text-red-600 text-slate-400 transition-all font-bold"
                         title="Apagar Campanha"
                       >
                         <Trash2 className="w-4 h-4" />
                       </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}






function FaturasSkeleton() {
  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      <div>
        <div className="h-8 w-48 bg-gray-200 rounded-lg animate-pulse mb-2"></div>
        <div className="h-4 w-72 bg-gray-100 rounded-md animate-pulse"></div>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
            <div className="h-3 bg-gray-300 rounded w-32 animate-pulse mb-3" />
            <div className="h-8 bg-gray-200 rounded w-24 animate-pulse" />
            {i === 2 && <div className="h-3 bg-gray-100 rounded w-20 animate-pulse mt-2" />}
          </div>
        ))}
      </div>

      {/* Histórico Tabela */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden mt-5">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex">
          <div className="h-4 bg-gray-300 rounded w-48 animate-pulse" />
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="px-5 py-3"><div className="h-3 bg-gray-200 rounded w-16 animate-pulse" /></th>
              <th className="px-5 py-3"><div className="h-3 bg-gray-200 rounded w-12 animate-pulse" /></th>
              <th className="px-5 py-3"><div className="h-3 bg-gray-200 rounded w-10 animate-pulse" /></th>
              <th className="px-5 py-3"><div className="h-3 bg-gray-200 rounded w-16 animate-pulse" /></th>
              <th className="px-5 py-3"><div className="h-3 bg-gray-200 rounded w-14 animate-pulse" /></th>
              <th className="px-5 py-3"><div className="h-3 bg-gray-200 rounded w-16 animate-pulse" /></th>
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4, 5].map(i => (
              <tr key={i} className="border-b border-gray-50">
                <td className="px-5 py-3">
                  <div className="h-4 bg-gray-300 rounded w-32 animate-pulse mb-1.5" />
                  <div className="h-3 bg-gray-200 rounded w-48 animate-pulse" />
                </td>
                <td className="px-5 py-3"><div className="h-4 bg-gray-200 rounded w-24 animate-pulse" /></td>
                <td className="px-5 py-3"><div className="h-4 bg-gray-200 rounded w-20 animate-pulse" /></td>
                <td className="px-5 py-3"><div className="h-4 bg-gray-200 rounded w-16 animate-pulse" /></td>
                <td className="px-5 py-3"><div className="h-5 bg-green-100 rounded-full w-12 animate-pulse" /></td>
                <td className="px-5 py-3"><div className="h-4 bg-blue-100 rounded w-16 animate-pulse" /></td>
              </tr>
            ))}
          </tbody>
        </table>
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
      // Delay para evitar conflito com outras chamadas
      await new Promise(resolve => setTimeout(resolve, 200))
      const { data: { user } } = await createClientInstance.auth.getUser()
      if (!user) return

      await new Promise(resolve => setTimeout(resolve, 100))
      const { data: pendentes } = await createClientInstance
        .from('pagamentos')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'pending')

      await new Promise(resolve => setTimeout(resolve, 100))
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

  if (loading) return <FaturasSkeleton />

  return (
    <div className="space-y-5">
      <div><h1 className="text-2xl font-bold text-gray-900">Facturação</h1><p className="text-gray-500 mt-1">Faturas, pagamentos e histórico financeiro.</p></div>

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
          <p className="text-xs font-bold text-gray-400 uppercase mb-1">Total Pago Este Ano</p>
          <p className="text-2xl font-bold text-green-600">
            {new Intl.NumberFormat('pt-MZ').format(faturasHistorico.reduce((acc, f) => acc + (f.valor || 0), 0))} MZN
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
          <p className="text-xs font-bold text-gray-400 uppercase mb-1">Faturas Pendentes</p>
          <p className="text-2xl font-bold text-red-600">{faturasPendentes.length}</p>
          <p className="text-xs text-gray-500 mt-1">Valor: {new Intl.NumberFormat('pt-MZ').format(faturasPendentes.reduce((acc, f) => acc + (f.valor || 0), 0))} MZN</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
          <p className="text-xs font-bold text-gray-400 uppercase mb-1">Estado da Conta</p>
          <p className={`text-2xl font-bold ${faturasPendentes.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {faturasPendentes.length > 0 ? 'Pagamento Pendente' : 'Em dia ✓'}
          </p>
        </div>
      </div>

      {/* Faturas Pendentes */}
      {faturasPendentes.length > 0 && (
        <div className="bg-yellow-50 rounded-lg border border-yellow-200 overflow-hidden">
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
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
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

// Componente Conta Skeleton
function ContaSkeleton() {
  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      <div>
        <div className="h-8 w-48 bg-gray-200 rounded-lg animate-pulse mb-2"></div>
        <div className="h-4 w-72 bg-gray-100 rounded-md animate-pulse"></div>
      </div>

      <div className="grid grid-cols-2 gap-5">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
          <div className="h-4 w-32 bg-gray-200 rounded mb-6 animate-pulse"></div>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i}>
                <div className="h-3 w-24 bg-gray-100 rounded mb-2 animate-pulse"></div>
                <div className="h-10 w-full bg-slate-50/80 rounded-lg border border-slate-100 animate-pulse"></div>
              </div>
            ))}
            <div className="h-10 w-full bg-slate-200 rounded-lg mt-4 animate-pulse"></div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
            <div className="h-4 w-32 bg-gray-200 rounded mb-6 animate-pulse"></div>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i}>
                  <div className="h-3 w-24 bg-gray-100 rounded mb-2 animate-pulse"></div>
                  <div className="h-10 w-full bg-slate-50/80 rounded-lg border border-slate-100 animate-pulse"></div>
                </div>
              ))}
              <div className="h-10 w-full bg-slate-200 rounded-lg mt-4 animate-pulse"></div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
            <div className="h-4 w-40 bg-gray-200 rounded mb-6 animate-pulse"></div>
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="h-4 w-48 bg-gray-100 rounded animate-pulse"></div>
                  <div className="h-5 w-10 bg-gray-200 rounded-full animate-pulse"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
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
      // Delay para evitar conflito com outras chamadas
      await new Promise(resolve => setTimeout(resolve, 250))
      const { data: { user } } = await createClientInstance.auth.getUser()
      if (!user) return
      await new Promise(resolve => setTimeout(resolve, 100))
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

  if (loading || !dados) return <ContaSkeleton />



  const forcaPassword = (p: string) => {
    if (p.length === 0) return { texto: '', cor: '' }
    if (p.length < 6) return { texto: 'Fraca', cor: 'text-red-500' }
    if (p.length < 10) return { texto: 'Média', cor: 'text-yellow-500' }
    return { texto: 'Forte', cor: 'text-green-500' }
  }

  const guardar = async () => {
    try {
      // Delay para evitar conflito com outras chamadas
      await new Promise(resolve => setTimeout(resolve, 100))
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
    <div className="space-y-5">
      <div><h1 className="text-2xl font-bold text-gray-900">A Minha Conta</h1><p className="text-gray-500 mt-1">Gere os teus dados pessoais e preferências.</p></div>

      <div className="grid grid-cols-2 gap-5">
        {/* Dados Pessoais */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
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
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
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
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
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
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
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
      <div className="bg-red-50 rounded-lg border border-red-200 p-5">
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
          <div className="bg-white rounded-lg shadow-2xl p-5 w-full max-w-md mx-4">
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
    <div className="space-y-5 w-full">
      <div><h1 className="text-3xl font-bold text-gray-900">Criar Website</h1><p className="text-gray-500 mt-1">Adicione um novo website ao servidor.</p></div>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
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

function WebsiteSkeleton() {
  return (
    <div className="w-full space-y-4 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-6 w-32 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-8 w-28 bg-gray-200 rounded-lg animate-pulse"></div>
          <div className="h-8 w-32 bg-gray-200 rounded-lg animate-pulse"></div>
          <div className="h-8 w-28 bg-gray-200 rounded-lg animate-pulse"></div>
        </div>
        <div className="h-9 w-52 bg-gray-100 border border-gray-200 rounded-lg animate-pulse"></div>
      </div>
      <div className="space-y-2 mt-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-lg border border-gray-100 shadow-sm p-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-4 w-4 bg-gray-200 rounded animate-pulse"></div>
              <div className="h-4 w-4 bg-gray-200 rounded animate-pulse"></div>
              <div className="h-4 w-40 bg-gray-200 rounded animate-pulse"></div>
              <div className="h-5 w-16 bg-gray-100 rounded-full animate-pulse"></div>
              <div className="h-5 w-20 bg-gray-100 rounded-full animate-pulse"></div>
              <div className="h-4 w-16 bg-gray-200 rounded animate-pulse"></div>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-8 w-20 bg-gray-200 rounded-lg animate-pulse"></div>
              <div className="h-4 w-28 bg-gray-100 rounded animate-pulse"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ListWebsitesSection({ sites, onRefresh, packages, setActiveSection, setFileManagerDomain, setSelectedDNSDomain, loadCyberPanelData, syncing, handleSync, isFetching }: {
  sites: CyberPanelWebsite[],
  onRefresh: () => void,
  packages: CyberPanelPackage[],
  setActiveSection: (section: string) => void,
  setFileManagerDomain: (domain: string) => void,
  setSelectedDNSDomain: (domain: string) => void,
  loadCyberPanelData: () => void,
  syncing: boolean,
  handleSync: () => void,
  isFetching?: boolean
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
    !s.domain.toLowerCase().startsWith('mail.') &&
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
      const res = await fetch('/api/da', {
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
    await fetch('/api/da', {
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
      await fetch('/api/da', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'modifyWebsite', params: { domain, [field]: value } })
      })
      setEditingField(null)
      await onRefresh()
      setLoading(null)
      return
    }

    const res = await fetch('/api/da', {
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

  if (isFetching) return <WebsiteSkeleton />

  return (
    <div className="w-full space-y-4">
      {/* Header Removido */}

      {msg && <div className="px-4 py-2.5 rounded-lg text-sm bg-green-50 text-green-700 border border-green-200">{msg}</div>}

      {/* Lista de sites */}
      <div className="space-y-2">
        {paginatedSites.map((s, i) => (
          <div key={i} className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden transition-all">

            {/* Linha do site com botões explícitos */}
            <div className="flex items-center justify-between px-4 py-5">

              {/* Info do site */}
              <div className="flex items-center gap-3">
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

            </div>

            {/* Conteúdo Permanente */}
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
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-xs font-bold transition-colors shadow-sm">
                   <ExternalLink className="w-3.5 h-3.5" /> Visitar Site
                </a>
              </div>
            </div>
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
          <div className="bg-white rounded-lg shadow-2xl p-5 w-full max-w-md mx-4">
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
                const res = await fetch('/api/da', {
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
  const [mailMarketingTab, setMailMarketingTab] = useState<'comp' | 'subs' | 'camp'>('comp')
  const [mailMarketingSearchTerm, setMailMarketingSearchTerm] = useState('')
  const [mailMarketingListas, setMailMarketingListas] = useState(['Contactos', 'Clientes', 'Newsletter'])
  const [compondoEmail, setCompondoEmail] = useState(false)
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

  // Estado para controlar visibilidade do header quando compose está ativo
  const [isComposeActive, setIsComposeActive] = useState(false)

  // Obter sessão e perfil do usuário
  useEffect(() => {
    const getData = async () => {
      try {
        // Delay para evitar conflito com outras chamadas
        await new Promise(resolve => setTimeout(resolve, 100))
        const { data: { user } } = await createClientInstance.auth.getUser()
        if (user) {
          setSessionUser(user.email || null)

          // Buscar perfil
          await new Promise(resolve => setTimeout(resolve, 100))
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
    // Delay para garantir que getData execute primeiro
    const timer = setTimeout(() => {
      loadCyberPanelData()
    }, 300)
    return () => clearTimeout(timer)
  }, [])

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/da', {
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
      // Delay para evitar conflito com outras chamadas ao auth
      await new Promise(resolve => setTimeout(resolve, 50))
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
    { id: 'webmail', label: 'Webmail', icon: Mail },
    { id: 'mailmarketing', label: 'Mailmarketing', icon: Target },
    { id: 'tickets', label: 'Suporte', icon: Users },
    { id: 'faturas', label: 'Faturas', icon: FileText },
    { id: 'conta', label: 'Conta', icon: Settings },
  ]

  const currentSidebarWidth = isCollapsed ? 80 : 250

  const renderSection = () => {
    switch (activeSection) {
      case 'dashboard':
        return <ClienteDashboardHome clienteProp={cliente} sitesProp={cyberPanelSites} isLoading={isFetchingCyberPanel} />
      case 'emails-new':
        return <EmailWebmailSection
          mostrarAdicionarConta={mostrarAdicionarConta}
          setMostrarAdicionarConta={setMostrarAdicionarConta}
          modalAdicionarPasso={modalAdicionarPasso}
          setModalAdicionarPasso={setModalAdicionarPasso}
          emailOrigem={sessionUser}
          sites={cyberPanelSites}
          defaultCompose={compondoEmail}
          onCloseCompose={() => setCompondoEmail(false)}
          onComposeStateChange={setIsComposeActive}
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
          isFetching={isFetchingCyberPanel}
        />
      case 'file-manager':
      case 'cp-file-manager':
        return <FileManagerSection domain={fileManagerDomain || cyberPanelSites[0]?.domain || 'oseudominio.com'} sites={cyberPanelSites} />
      case 'tickets':
        return <SuporteSection
          cliente={cliente}
          sites={cyberPanelSites}
          onComposeEmail={() => {
            setActiveSection('email-new'); // ID do menu para Email
            setCompondoEmail(true);
          }}
        />
      case 'mailmarketing':
        return (
          <Suspense fallback={<SectionLoader />}>
            <MailMarketingSection
              sites={cyberPanelSites}
              currentUserEmail={cliente?.email}
              activeTab={mailMarketingTab}
              setActiveTab={setMailMarketingTab}
              listas={mailMarketingListas}
              setListas={setMailMarketingListas}
              searchTerm={mailMarketingSearchTerm}
              setSearchTerm={setMailMarketingSearchTerm}
            />
          </Suspense>
        )
      case 'faturas':
        return <FacturacaoSection />
      case 'conta':
        return <ContaSection />
      case 'webmail':
        return (
          <WebmailSection
            sites={cyberPanelSites}
            userEmail={sessionUser}
            onBack={() => setActiveSection('emails-new')}
            mostrarAdicionarConta={mostrarAdicionarConta}
            setMostrarAdicionarConta={setMostrarAdicionarConta}
            modalAdicionarPasso={modalAdicionarPasso}
            setModalAdicionarPasso={setModalAdicionarPasso}
          />
        )
      case 'domains-new':
        // return <CreateWebsiteSection packages={cyberPanelPackages} onRefresh={loadCyberPanelData} /> // Removido - não usado no painel do cliente
        return <div className="p-5"><h1 className="text-2xl font-bold">Criar Website</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      case 'cp-subdomains':
        // return <SubdomainsSection sites={cyberPanelSites} /> // Removido - não usado no painel do cliente
        return <div className="p-5"><h1 className="text-2xl font-bold">Subdomínios</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      case 'cp-list-subdomains':
        // return <ListSubdomainsSection sites={cyberPanelSites} /> // Removido - não usado no painel do cliente
        return <div className="p-5"><h1 className="text-2xl font-bold">Listar Subdomínios</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      case 'cp-modify-website':
        // return <ModifyWebsiteSection sites={cyberPanelSites} packages={cyberPanelPackages} /> // Removido - não usado no painel do cliente
        return <div className="p-5"><h1 className="text-2xl font-bold">Modificar Website</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      case 'cp-suspend-website':
        // return <SuspendWebsiteSection sites={cyberPanelSites} onRefresh={loadCyberPanelData} /> // Removido - não usado no painel do cliente
        return <div className="p-5"><h1 className="text-2xl font-bold">Suspender Website</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      case 'cp-delete-website':
        // return <DeleteWebsiteSection sites={cyberPanelSites} onRefresh={loadCyberPanelData} /> // Removido - não usado no painel do cliente
        return <div className="p-5"><h1 className="text-2xl font-bold">Apagar Website</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      case 'cp-databases':
        // return <DatabasesSection sites={cyberPanelSites} /> // Removido - não usado no painel do cliente
        return <div className="p-5"><h1 className="text-2xl font-bold">Bases de Dados</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      case 'cp-ftp':
        // return <FTPSection sites={cyberPanelSites} /> // Removido - não usado no painel do cliente
        return <div className="p-5"><h1 className="text-2xl font-bold">FTP</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      case 'cp-email-delete':
        // return <EmailDeleteSection sites={cyberPanelSites} /> // Removido - não usado no painel do cliente
        return <div className="p-5"><h1 className="text-2xl font-bold">Apagar Email</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      case 'cp-email-limits':
        // return <EmailLimitsSection sites={cyberPanelSites} /> // Removido - não usado no painel do cliente
        return <div className="p-5"><h1 className="text-2xl font-bold">Limites de Email</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      case 'cp-email-forwarding':
        // return <EmailForwardingSection sites={cyberPanelSites} /> // Removido - não usado no painel do cliente
        return <div className="p-5"><h1 className="text-2xl font-bold">Encaminhamento de Email</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      case 'cp-email-catchall':
        // return <CatchAllEmailSection sites={cyberPanelSites} /> // Removido - não usado no painel do cliente
        return <div className="p-5"><h1 className="text-2xl font-bold">Catch All Email</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      case 'cp-email-pattern-fwd':
        // return <PatternForwardingSection sites={cyberPanelSites} /> // Removido - não usado no painel do cliente
        return <div className="p-5"><h1 className="text-2xl font-bold">Pattern Forwarding</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      case 'cp-email-plus-addr':
        // return <PlusAddressingSection sites={cyberPanelSites} /> // Removido - não usado no painel do cliente
        return <div className="p-5"><h1 className="text-2xl font-bold">Plus Addressing</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      case 'cp-email-change-pass':
        // return <EmailChangePasswordSection sites={cyberPanelSites} /> // Removido - não usado no painel do cliente
        return <div className="p-5"><h1 className="text-2xl font-bold">Alterar Senha Email</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      case 'cp-email-dkim':
        // return <DKIMManagerSection sites={cyberPanelSites} /> // Removido - não usado no painel do cliente
        return <div className="p-5"><h1 className="text-2xl font-bold">DKIM Manager</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      case 'cp-users':
        // return <CPUsersSection /> // Removido - não usado no painel do cliente
        return <div className="p-5"><h1 className="text-2xl font-bold">Utilizadores</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      case 'cp-reseller':
        // return <ResellerSection /> // Removido - não usado no painel do cliente
        return <div className="p-5"><h1 className="text-2xl font-bold">Revenda</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      case 'cp-ssl':
        // return <SSLSection sites={cyberPanelSites} /> // Removido - não usado no painel do cliente
        return <div className="p-5"><h1 className="text-2xl font-bold">SSL</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      case 'cp-security':
        // return <SecuritySection sites={cyberPanelSites} /> // Removido - não usado no painel do cliente
        return <div className="p-5"><h1 className="text-2xl font-bold">Segurança</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      case 'cp-php':
        // return <PHPConfigSection sites={cyberPanelSites} /> // Removido - não usado no painel do cliente
        return <div className="p-5"><h1 className="text-2xl font-bold">Configuração PHP</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      case 'cp-api':
      case 'infrastructure':
        // return <APIConfigSection /> // Removido - não usado no painel do cliente
        return <div className="p-5"><h1 className="text-2xl font-bold">Configurações</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      case 'cp-wp-list':
        // return <WPListSection sites={cyberPanelSites} setFileManagerDomain={setFileManagerDomain} setActiveSection={setActiveSection} /> // Removido - não usado no painel do cliente
        return <div className="p-5"><h1 className="text-2xl font-bold">WordPress</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      case 'cp-wp-plugins':
        // return <WPPluginsSection sites={cyberPanelSites} /> // Removido - não usado no painel do cliente
        return <div className="p-5"><h1 className="text-2xl font-bold">Plugins WordPress</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      case 'cp-wp-restore-backup':
        // return <WPRestoreBackupSection sites={cyberPanelSites} /> // Removido - não usado no painel do cliente
        return <div className="p-5"><h1 className="text-2xl font-bold">Restaurar Backup WordPress</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      case 'cp-wp-remote-backup':
        // return <WPRemoteBackupSection sites={cyberPanelSites} /> // Removido - não usado no painel do cliente
        return <div className="p-5"><h1 className="text-2xl font-bold">Backup Remoto WordPress</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      case 'cp-dns-nameserver':
        // return <DNSNameserverSection sites={cyberPanelSites} /> // Removido - não usado no painel do cliente
        return <div className="p-5"><h1 className="text-2xl font-bold">Nameservers DNS</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      case 'cp-dns-default-ns':
        // return <DNSDefaultNSSection /> // Removido - não usado no painel do cliente
        return <div className="p-5"><h1 className="text-2xl font-bold">Default Nameservers</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      case 'cp-dns-create-zone':
        // return <DNSCreateZoneSection sites={cyberPanelSites} /> // Removido - não usado no painel do cliente
        return <div className="p-5"><h1 className="text-2xl font-bold">Criar Zona DNS</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      case 'domains-dns':
        return <DNSZoneEditorSection
          sites={cyberPanelSites}
          initialDomain={selectedDNSDomain || primaryDomain}
        />
      case 'cp-dns-delete-zone':
        // return <DNSDeleteZoneSection sites={cyberPanelSites} /> // Removido - não usado no painel do cliente
        return <div className="p-5"><h1 className="text-2xl font-bold">Apagar Zona DNS</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      case 'cp-dns-cloudflare':
        // return <CloudFlareSection sites={cyberPanelSites} /> // Removido - não usado no painel do cliente
        return <div className="p-5"><h1 className="text-2xl font-bold">Cloudflare</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      case 'cp-dns-reset':
        // return <DNSResetSection sites={cyberPanelSites} /> // Removido - não usado no painel do cliente
        return <div className="p-5"><h1 className="text-2xl font-bold">Reset DNS</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      case 'cp-dns-zone-editor':
        return <DNSZoneEditorSection sites={cyberPanelSites} />
      case 'git-deploy':
        // return <GitDeploySection /> // Removido - não usado no painel do cliente
        return <div className="p-5"><h1 className="text-2xl font-bold">Deploy GitHub</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      case 'backup-manager':
      case 'cp-backup':
        // return <BackupManagerSection sites={cyberPanelSites} /> // Removido - não usado no painel do cliente
        return <div className="p-5"><h1 className="text-2xl font-bold">Backups</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      case 'wordpress-install':
        // return <WordPressInstallSection sites={cyberPanelSites} /> // Removido - não usado no painel do cliente
        return <div className="p-5"><h1 className="text-2xl font-bold">Instalar WordPress</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      case 'cp-wp-backup':
        // return <WPBackupSection sites={cyberPanelSites} /> // Removido - não usado no painel do cliente
        return <div className="p-5"><h1 className="text-2xl font-bold">Backup WordPress</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      case 'domain-manager':
        // return <DomainManagerSection sites={cyberPanelSites} /> // Removido - não usado no painel do cliente
        return <div className="p-5"><h1 className="text-2xl font-bold">Gestor de Domínios</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      case 'deploy':
        // return <DeploySection sites={cyberPanelSites} /> // Removido - não usado no painel do cliente
        return <div className="p-5"><h1 className="text-2xl font-bold">Deploy</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      case 'packages-list':
        // return <PackagesSection packages={cyberPanelPackages} onRefresh={loadCyberPanelData} /> // Removido - não usado no painel do cliente
        return <div className="p-5"><h1 className="text-2xl font-bold">Pacotes</h1><p className="text-gray-500 mt-1">Secção não disponível no painel do cliente</p></div>
      default:
        return <CpanelDashboard sites={cyberPanelSites} users={cyberPanelUsers} isFetching={isFetchingCyberPanel} onNavigate={setActiveSection} onRefresh={loadCyberPanelData} onSetFileManagerDomain={setFileManagerDomain} />
    }
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <div
        className="relative bg-white border-r border-gray-200 text-gray-800 flex flex-col shadow-sm transition-all duration-300 ease-in-out"
        style={{ width: `${currentSidebarWidth}px` }}
      >
        {/* Sidebar Header */}
        <div className="px-2 pb-4 border-b border-gray-100 pt-4">
          {isCollapsed ? (
            <div className="flex flex-col items-center gap-3">
              <img
                src="/assets/simbolo.png"
                alt="Logo"
                className="w-12 h-12 object-contain cursor-pointer"
                onClick={() => window.location.href = '/'}
              />
              <button
                onClick={() => setIsCollapsed(false)}
                className="rounded-lg hover:bg-gray-100 transition-colors p-1"
              >
                <ChevronRight size={22} className="text-gray-500" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <img
                src="/assets/simbolo.png"
                alt="Logo"
                className="w-14 h-14 object-contain cursor-pointer"
                onClick={() => window.location.href = '/'}
              />
              <div className="flex-1">
                <h1 className="text-lg font-bold text-gray-900 tracking-tight">VisualDESIGN</h1>
                <p className="text-xs text-gray-500">Gestão de Serviços</p>
              </div>
              <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="rounded-lg hover:bg-gray-100 transition-colors p-1"
                title={isCollapsed ? "Expandir" : "Recolher"}
              >
                {isCollapsed ? (
                  <ChevronRight size={22} className="text-gray-500" />
                ) : (
                  <ChevronLeft size={22} className="text-gray-500" />
                )}
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
                (item.id === 'webmail' && activeSection === 'webmail') ||
                (item.id === 'cp-security' && activeSection === 'cp-security')
              
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2 py-2' : 'p-2.5 px-4'} rounded-lg transition-all duration-200 ease-out hover:translate-x-1 ${
                    isActive
                      ? 'bg-red-50 text-red-600 font-bold'
                      : 'hover:bg-gray-100 text-gray-600'
                    }`}
                >
                  <Icon size={22} className={
                    isActive ? 'text-red-600' : 'text-gray-500'
                  } />
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
          <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3 px-2'}`}>
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
      <div className="flex-1 flex flex-col overflow-hidden bg-white">
        {/* Top Header - Escondido quando compose está ativo na seção de emails */}
        <header className={`bg-white border-b border-gray-200 px-6 py-4 mb-0 ${isComposeActive && activeSection === 'emails-new' ? 'hidden' : ''}`}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                {menuItems.find(i => i.id === activeSection)?.label || 'Painel de Gestão'}
              </h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                VisualDesign Admin Cloud
              </p>
            </div>
            <div className="flex items-center gap-2">
              {activeSection === 'mailmarketing' && (
                <div className="flex items-center gap-3 mr-4">
                  {mailMarketingTab === 'subs' && (
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                      <Input
                        placeholder="Pesquisar contacto..."
                        value={mailMarketingSearchTerm}
                        onChange={(e) => setMailMarketingSearchTerm(e.target.value)}
                        className="pl-9 h-9 min-w-[230px] rounded-lg"
                      />
                    </div>
                  )}
                  <div className="flex relative bg-slate-100 p-1 rounded-lg shadow-inner">
                    <div 
                      className="absolute top-1 bottom-1 bg-white rounded-md shadow-sm transition-all duration-300 ease-out"
                      style={{
                        width: 'calc(33.33% - 2.66px)',
                        left: mailMarketingTab === 'comp' ? '4px' : mailMarketingTab === 'camp' ? 'calc(33.33% + 1.33px)' : 'calc(66.66% - 1.33px)',
                      }}
                    />
                    <button onClick={() => setMailMarketingTab('comp')}
                      className={`relative z-10 w-[95px] flex items-center justify-center py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${mailMarketingTab === 'comp' ? 'text-orange-600' : 'text-slate-500 hover:text-slate-700'}`}>
                      Compor
                    </button>
                    <button onClick={() => setMailMarketingTab('camp')}
                      className={`relative z-10 w-[95px] flex items-center justify-center py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${mailMarketingTab === 'camp' ? 'text-orange-600' : 'text-slate-500 hover:text-slate-700'}`}>
                      Campanhas
                    </button>
                    <button onClick={() => setMailMarketingTab('subs')}
                      className={`relative z-10 w-[95px] flex items-center justify-center py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${mailMarketingTab === 'subs' ? 'text-orange-600' : 'text-slate-500 hover:text-slate-700'}`}>
                      Contactos
                    </button>
                  </div>
                </div>
              )}
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
        <main className={`flex-1 ${isComposeActive && activeSection === 'emails-new' ? 'overflow-hidden p-0' : 'overflow-y-auto'} ${['dashboard', 'webmail', 'emails-new', 'email-new'].includes(activeSection) ? 'p-0' : 'p-5'} bg-slate-50/50`}>
          <div className={`${isComposeActive && activeSection === 'emails-new' ? 'h-full min-h-0' : 'min-h-full'}`}>
            {renderSection()}
          </div>
        </main>
      </div>
    </div>
  )
}
