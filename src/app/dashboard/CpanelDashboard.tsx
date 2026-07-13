'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  FolderOpen, Database, Globe, Mail, Shield, ShieldCheck, Code, Users, Package,
  Server, ChevronUp, ChevronDown, HardDrive,
  Upload, PlusCircle, Lock, RefreshCw, Key,
  Layers, FileText, Edit, Trash2, List,
  RotateCcw, Power, ArrowRight, Filter, Settings,
  Zap, BookOpen, Monitor, Archive, Eye, Layout, ShoppingCart, Bell,
} from 'lucide-react'
import type { DirectAdminWebsite, DirectAdminUser } from '@/lib/directadmin-api'
import { getServerHost } from '@/lib/server-config'
import { panelDashboardToolCardCompact, panelDashboardToolLabel, panelSectionPadding } from '@/lib/panel-ui'
import {
  DASHBOARD_MENU_SECTION_STYLES,
  DASHBOARD_SECTION_ORDER,
  getDashboardMenuSectionDefs,
  getDashboardRelocatedCarouselTools,
  getExposedDashboardMenuParents,
  isToolInExposedDashboardSection,
} from '@/lib/panel-dashboard-menu'

interface Tool {
  id: string
  name: string
  icon: React.ReactNode
  panelPath?: string
  highlight?: boolean
}

interface Section {
  id: string
  name: string
  headerIcon: React.ReactNode
  color: string
  bgColor: string
  tools: Tool[]
}

const CAROUSEL_VISIBLE = 4

const MENU_HEADER_ICONS: Record<string, React.ReactNode> = {
  utilizadores: <Users className="h-5 w-5" />,
  'nov-hospedagem': <Server className="h-5 w-5" />,
  'nov-dominios': <Globe className="h-5 w-5" />,
  'nov-notificacoes': <Bell className="h-5 w-5" />,
  'nov-wordpress': <Layout className="h-5 w-5" />,
  'nov-sistema': <Settings className="h-5 w-5" />,
}

function dashboardToolIcon(toolId: string, accent: string): React.ReactNode {
  const cls = `h-9 w-9 ${accent}`
  const map: Record<string, React.ReactNode> = {
    clientes: <Users className={cls} />,
    'utilizadores-visitantes': <Eye className={cls} />,
    'utilizadores-gestao': <Shield className={cls} />,
    'hospedagem-contas': <Users className={cls} />,
    'hospedagem-mover-revenda': <RefreshCw className={cls} />,
    revendedores: <Package className={cls} />,
    'packages-list': <HardDrive className={cls} />,
    'packages-new': <PlusCircle className={cls} />,
    'cp-reseller': <Package className={cls} />,
    'registrar-domains': <ShoppingCart className={cls} />,
    'domains-registados': <List className={cls} />,
    'cp-subdomains': <Layers className={cls} />,
    'cp-list-subdomains': <List className={cls} />,
    'cp-modify-website': <Edit className={cls} />,
    'cp-suspend-website': <Power className={cls} />,
    'website-preview': <Eye className={cls} />,
    'cp-delete-website': <Trash2 className={cls} />,
    phpmyadmin: <Database className={cls} />,
    'backup-manager': <HardDrive className={cls} />,
    'cp-wp-restore-backup': <RotateCcw className={cls} />,
    'file-manager': <FolderOpen className={cls} />,
    'cp-ftp': <Upload className={cls} />,
    'cp-audit-sync': <ShieldCheck className={cls} />,
    'cp-client-permissions': <Lock className={cls} />,
    'domain-manager': <Globe className={cls} />,
    'dns-central': <Globe className={cls} />,
    'cp-ssl': <Lock className={cls} />,
    'cp-php': <Code className={cls} />,
    'cp-dns-nameserver': <Server className={cls} />,
    'transferir-dominio': <ArrowRight className={cls} />,
    renewals: <RefreshCw className={cls} />,
    'cadastrar-renovacao': <PlusCircle className={cls} />,
    'templates-renovacao': <FileText className={cls} />,
    'wp-sites': <Globe className={cls} />,
    'wordpress-install': <PlusCircle className={cls} />,
    'wp-plugins': <Zap className={cls} />,
    'wp-backup': <Archive className={cls} />,
    'cp-databases': <Database className={cls} />,
    infrastructure: <Monitor className={cls} />,
    'git-deploy': <Upload className={cls} />,
    'cp-reseller-permissions': <Shield className={cls} />,
  }
  return map[toolId] ?? <Settings className={cls} />
}

const EMAIL_SECTION: Section = {
  id: 'email',
  name: 'E-mails',
  headerIcon: <Mail className="h-5 w-5" />,
  color: 'text-cyan-700',
  bgColor: 'bg-cyan-50',
  tools: [
    { id: 'cp-email-mgmt', name: 'E-mails', icon: <Mail className="h-9 w-9 text-cyan-500" /> },
    { id: 'emails-webmail', name: 'Webmail', icon: <Mail className="h-9 w-9 text-cyan-500" /> },
    { id: 'newsletter', name: 'Email Marketing', icon: <Layout className="h-9 w-9 text-cyan-500" /> },
    { id: 'mensagens', name: 'Mensagens', icon: <FileText className="h-9 w-9 text-cyan-500" />, panelPath: '/dashboard/mensagens' },
    { id: 'mensagens-subs', name: 'Subscritores', icon: <Users className="h-9 w-9 text-cyan-500" />, panelPath: '/dashboard/mensagens/subscritores' },
    { id: 'mensagens-camp', name: 'Campanhas', icon: <Archive className="h-9 w-9 text-cyan-500" />, panelPath: '/dashboard/mensagens/campanhas' },
    { id: 'cp-email-delete', name: 'Apagar Email', icon: <Trash2 className="h-9 w-9 text-cyan-500" /> },
    { id: 'cp-email-forwarding', name: 'Encaminhamento', icon: <ArrowRight className="h-9 w-9 text-cyan-500" /> },
    { id: 'cp-email-catchall', name: 'Catch-All Email', icon: <Filter className="h-9 w-9 text-cyan-500" /> },
    { id: 'cp-email-pattern-fwd', name: 'Pattern Forwarding', icon: <Zap className="h-9 w-9 text-cyan-500" /> },
    { id: 'cp-email-plus-addr', name: 'Plus-Addressing', icon: <BookOpen className="h-9 w-9 text-cyan-500" /> },
    { id: 'cp-email-change-pass', name: 'Alterar Password', icon: <Key className="h-9 w-9 text-cyan-500" /> },
    { id: 'cp-email-dkim', name: 'DKIM Manager', icon: <Shield className="h-9 w-9 text-cyan-500" /> },
    { id: 'cp-email-limits', name: 'Limites de Email', icon: <Settings className="h-9 w-9 text-cyan-500" /> },
    { id: 'setup-smtp', name: 'Configurar SMTP', icon: <Server className="h-9 w-9 text-red-500" /> },
  ],
}

interface Props {
  onNavigate: (section: string) => void
  onSetDNSDomain?: (domain: string) => void
  onSetFileManagerDomain?: (domain: string) => void
  sites: DirectAdminWebsite[]
  users: DirectAdminUser[]
  isFetching: boolean
  onRefresh: () => void
  searchQuery?: string
  onSearchChange?: (query: string) => void
  userResources?: {
    cpuLimit?: string
    memoryLimit?: string
    tasksLimit?: string
    ioLimit?: string
    iopsLimit?: string
    cpuUsage?: string
    memoryUsage?: string
    tasksUsage?: string
  } | null
}

function ToolCard({
  tool,
  onClick,
}: {
  tool: Tool
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${panelDashboardToolCardCompact} w-full ${tool.highlight ? 'bg-blue-50 border-blue-200 hover:border-blue-300 dark:bg-blue-950/20' : ''}`}
    >
      <div className="group-hover:scale-110 transition-transform">{tool.icon}</div>
      <span
        className={`${panelDashboardToolLabel} ${tool.highlight ? 'text-blue-700' : ''}`}
      >
        {tool.name}
      </span>
    </button>
  )
}

function DashboardToolsCarousel({
  tools,
  onToolClick,
}: {
  tools: Tool[]
  onToolClick: (tool: Tool) => void
}) {
  const [offset, setOffset] = useState(0)
  const [transition, setTransition] = useState(true)
  const loopTools = useMemo(() => (tools.length ? [...tools, ...tools] : []), [tools])
  const loopCount = loopTools.length

  useEffect(() => {
    if (tools.length <= CAROUSEL_VISIBLE) return
    const id = window.setInterval(() => {
      setOffset((prev) => prev + 1)
    }, 2800)
    return () => window.clearInterval(id)
  }, [tools.length])

  useEffect(() => {
    if (tools.length === 0 || offset < tools.length) return
    const snap = window.setTimeout(() => {
      setTransition(false)
      setOffset(0)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setTransition(true))
      })
    }, 500)
    return () => window.clearTimeout(snap)
  }, [offset, tools.length])

  if (tools.length === 0) return null

  if (tools.length <= CAROUSEL_VISIBLE) {
    return (
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <div className="border-b border-gray-100 px-4 py-3 dark:border-zinc-800">
          <span className="text-sm font-bold text-gray-800 dark:text-zinc-100">Mais ferramentas</span>
          <span className="ml-2 text-xs font-normal text-gray-400">({tools.length})</span>
        </div>
        <div className={`${panelSectionPadding} grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3 lg:grid-cols-5 xl:grid-cols-6`}>
          {tools.map((tool, i) => (
            <ToolCard key={`${tool.id}-${i}`} tool={tool} onClick={() => onToolClick(tool)} />
          ))}
        </div>
      </div>
    )
  }

  const shiftPercent = loopCount > 0 ? (offset * 100) / loopCount : 0
  const trackWidthPercent = loopCount > 0 ? (loopCount / CAROUSEL_VISIBLE) * 100 : 100
  const cardWidthPercent = loopCount > 0 ? 100 / loopCount : 100

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <div className="border-b border-gray-100 px-4 py-3 dark:border-zinc-800">
        <span className="text-sm font-bold text-gray-800 dark:text-zinc-100">Mais ferramentas</span>
        <span className="ml-2 text-xs font-normal text-gray-400">({tools.length})</span>
      </div>
      <div className={panelSectionPadding}>
        <div className="overflow-hidden">
          <div
            className={`flex ${transition ? 'transition-transform duration-500 ease-in-out' : ''}`}
            style={{
              width: `${trackWidthPercent}%`,
              transform: `translateX(-${shiftPercent}%)`,
            }}
          >
            {loopTools.map((tool, i) => (
              <div
                key={`${tool.id}-${i}`}
                className="shrink-0 px-1.5"
                style={{ width: `${cardWidthPercent}%` }}
              >
                <ToolCard tool={tool} onClick={() => onToolClick(tool)} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function SectionAccordion({
  section,
  collapsed,
  onToggle,
  onToolClick,
  twoColumns = false,
}: {
  section: Section
  collapsed: boolean
  onToggle: () => void
  onToolClick: (tool: Tool) => void
  twoColumns?: boolean
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <button
        type="button"
        onClick={onToggle}
        className={`flex w-full items-center justify-between border-b px-4 py-3 transition-colors hover:bg-gray-50 dark:hover:bg-white/5 md:px-5 md:py-3.5 ${collapsed ? 'border-transparent' : 'border-gray-100 dark:border-zinc-800'}`}
      >
        <div className="flex items-center gap-3">
          <div className={`${section.bgColor} ${section.color} rounded p-1.5`}>{section.headerIcon}</div>
          <span className="text-sm font-bold text-gray-800 dark:text-zinc-100">{section.name}</span>
          <span className="text-xs font-normal text-gray-400">({section.tools.length})</span>
        </div>
        {collapsed ? (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronUp className="h-4 w-4 text-gray-400" />
        )}
      </button>

      {!collapsed && (
        <div className={`${panelSectionPadding} md:p-4`}>
          <div
            className={
              twoColumns
                ? 'grid grid-cols-2 gap-2 md:gap-3'
                : 'grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6'
            }
          >
            {section.tools.map((tool, i) => (
              <ToolCard key={`${tool.id}-${i}`} tool={tool} onClick={() => onToolClick(tool)} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function CpanelDashboard({
  onNavigate,
  onSetDNSDomain,
  onSetFileManagerDomain,
  sites,
  users,
  isFetching,
  onRefresh,
  searchQuery = '',
  onSearchChange,
  userResources,
}: Props) {
  const router = useRouter()
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [diskInfo, setDiskInfo] = useState<{ used: string; total: string; percentage: string } | null>(null)

  useEffect(() => {
    const fetchDisk = async () => {
      try {
        const res = await fetch('/api/da', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'serverDiskUsage', params: {} }),
        })
        const data = await res.json()
        if (data.success) setDiskInfo(data.data)
      } catch (e) {
        console.error(e)
      }
    }
    void fetchDisk()
  }, [])

  const primaryDomain =
    sites.length > 0
      ? sites.find((s) => !s.domain.includes('contaboserver'))?.domain || sites[0].domain
      : 'your-domain.com'

  const handleToolClick = useCallback(
    (tool: Tool) => {
      if (tool.panelPath) {
        router.push(tool.panelPath)
        return
      }
      if (tool.id === 'phpmyadmin') {
        window.location.assign(`https://${primaryDomain}:2222/phpMyAdmin/`)
        return
      }
      if (tool.id === 'dns-central' && onSetDNSDomain) {
        onSetDNSDomain(primaryDomain)
      }
      onNavigate(tool.id)
    },
    [onNavigate, onSetDNSDomain, primaryDomain, router],
  )

  const toggle = (id: string) => setCollapsed((p) => ({ ...p, [id]: !p[id] }))

  const menuMirrorSections: Section[] = useMemo(
    () =>
      getDashboardMenuSectionDefs().map((def) => {
        const style = DASHBOARD_MENU_SECTION_STYLES[def.menuItemId] ?? {
          color: 'text-gray-700',
          bgColor: 'bg-gray-50',
          toolAccent: 'text-gray-500',
        }
        return {
          id: def.id,
          name: def.name,
          headerIcon: MENU_HEADER_ICONS[def.menuItemId] ?? <Settings className="h-5 w-5" />,
          color: style.color,
          bgColor: style.bgColor,
          tools: def.tools.map((tool) => ({
            id: tool.id,
            name: tool.name,
            panelPath: tool.panelPath,
            highlight: tool.highlight,
            icon: dashboardToolIcon(tool.id, style.toolAccent),
          })),
        }
      }),
    [],
  )

  const query = searchQuery.trim().toLowerCase()

  const { orderedSections, carouselTools } = useMemo(() => {
    const byId = new Map<string, Section>([
      ...menuMirrorSections.map((s) => [s.id, s] as const),
      [EMAIL_SECTION.id, EMAIL_SECTION],
    ])

    const filterTools = (tools: Tool[]) =>
      query ? tools.filter((t) => t.name.toLowerCase().includes(query)) : tools

    const mapSection = (section: Section | undefined): Section | null => {
      if (!section) return null
      const tools = filterTools(section.tools)
      return tools.length > 0 ? { ...section, tools } : null
    }

    const mainSections = DASHBOARD_SECTION_ORDER.map((id) => mapSection(byId.get(id))).filter(
      Boolean,
    ) as Section[]

    const exposedToolIds = new Set<string>()
    for (const section of mainSections) {
      for (const tool of section.tools) exposedToolIds.add(tool.id)
    }

    const exposedMenuParents = getExposedDashboardMenuParents()
    const relocatedCarousel = getDashboardRelocatedCarouselTools().map((tool) => ({
      id: tool.id,
      name: tool.name,
      panelPath: tool.panelPath,
      highlight: tool.highlight,
      icon: dashboardToolIcon(tool.id, 'text-gray-500'),
    }))
    const carousel = filterTools(relocatedCarousel).filter(
      (tool) => !isToolInExposedDashboardSection(tool.id, exposedToolIds, exposedMenuParents),
    )

    return { orderedSections: mainSections, carouselTools: carousel }
  }, [menuMirrorSections, query])

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
      <div className="min-w-0 flex-1 space-y-3">
        {orderedSections.map((section) => (
          <SectionAccordion
            key={section.id}
            section={section}
            collapsed={Boolean(collapsed[section.id])}
            onToggle={() => toggle(section.id)}
            onToolClick={handleToolClick}
          />
        ))}
        <DashboardToolsCarousel tools={carouselTools} onToolClick={handleToolClick} />
      </div>

      <div className="hidden w-60 shrink-0 space-y-4 lg:block">
        <div className="space-y-4 rounded border border-gray-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <div className="flex items-center gap-2">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Servidor</p>
            <span className="h-2 w-2 rounded-full bg-green-500" aria-hidden />
            <span className="text-xs font-bold text-green-600">activo</span>
          </div>

          <div className="space-y-3 text-sm">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Utilizador</p>
              <p className="font-bold text-gray-900 dark:text-zinc-100">admin</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">IP do Servidor</p>
              <p className="font-mono text-xs text-gray-800 dark:text-zinc-200">{getServerHost()}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                <span className="text-gray-900 dark:text-zinc-100">{sites.length}</span> Websites
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                <span className="text-gray-900 dark:text-zinc-100">{users.length}</span> Utilizadores
              </p>
            </div>
          </div>

          {diskInfo && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Espaço em Disco</p>
              <p className="font-bold text-gray-900 dark:text-zinc-100">
                {diskInfo.used} / {diskInfo.total}
              </p>
              <div className="mt-1 h-1.5 w-full rounded-full bg-gray-100 dark:bg-zinc-800">
                <div className="h-1.5 rounded-full bg-red-500" style={{ width: diskInfo.percentage }} />
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={async () => {
              if (
                confirm(
                  '⚠️ ATENÇÃO: Tem a certeza que deseja REINICIAR o servidor?\n\nIsto irá interromper todos os serviços temporariamente.',
                )
              ) {
                try {
                  const res = await fetch('/api/da', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'rebootServer' }),
                  })
                  const data = await res.json()
                  if (data.success) alert('🔄 Comando de reinicialização enviado com sucesso. Aguarde alguns minutos.')
                  else alert('❌ Erro ao reiniciar: ' + (data.error || 'Desconhecido'))
                } catch {
                  alert('Erro de ligação.')
                }
              }
            }}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded bg-gray-900 px-4 py-2.5 text-xs font-bold text-white transition-all hover:bg-red-600"
          >
            <Power className="h-3.5 w-3.5" /> Reiniciar Servidor
          </button>
        </div>

        {userResources && (
          <div className="space-y-4 rounded border border-gray-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Limites de Recursos</p>
              <Zap className="h-4 w-4 text-amber-500" />
            </div>
            <div className="space-y-4 text-sm">
              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] font-bold uppercase">
                  <span className="text-gray-400">CPU</span>
                  <span className="text-gray-900 dark:text-zinc-100">{userResources.cpuLimit}</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-zinc-800">
                  <div className="h-1.5 rounded-full bg-blue-500" style={{ width: userResources.cpuUsage || '10%' }} />
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] font-bold uppercase">
                  <span className="text-gray-400">RAM</span>
                  <span className="text-gray-900 dark:text-zinc-100">{userResources.memoryLimit}</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-zinc-800">
                  <div className="h-1.5 rounded-full bg-purple-500" style={{ width: userResources.memoryUsage || '15%' }} />
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] font-bold uppercase">
                  <span className="text-gray-400">IO / IOPS</span>
                  <span className="text-gray-900 dark:text-zinc-100">
                    {userResources.ioLimit} / {userResources.iopsLimit}
                  </span>
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] font-bold uppercase">
                  <span className="text-gray-400">Máx. de Tarefas</span>
                  <span className="text-gray-900 dark:text-zinc-100">{userResources.tasksLimit}</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-zinc-800">
                  <div className="h-1.5 rounded-full bg-indigo-500" style={{ width: userResources.tasksUsage || '5%' }} />
                </div>
              </div>
              <div className="border-t border-gray-50 pt-2 dark:border-zinc-800">
                <p className="text-[9px] italic leading-tight text-gray-400">
                  * Valores baseados no LVE Manager. Se atingir 100%, verá o erro 508.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="rounded border border-gray-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-gray-500">Acesso Rápido</p>
          <div className="space-y-1">
            {[
              { label: 'Registar domínio', id: 'registrar-domains', icon: <ShoppingCart className="h-3.5 w-3.5" /> },
              { label: 'Domínios', id: 'domain-manager', icon: <Globe className="h-3.5 w-3.5" /> },
              { label: 'Mensagens', panelPath: '/dashboard/mensagens', icon: <FileText className="h-3.5 w-3.5" /> },
              { label: 'Criar Email', id: 'emails-new', icon: <Mail className="h-3.5 w-3.5" /> },
              { label: 'Contas hospedagem', id: 'hospedagem-contas', icon: <Users className="h-3.5 w-3.5" /> },
              { label: 'Emitir SSL', id: 'cp-ssl', icon: <Lock className="h-3.5 w-3.5" /> },
              { label: 'Criar Pacote', id: 'packages-new', icon: <Package className="h-3.5 w-3.5" /> },
            ].map((item, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  if (item.panelPath) {
                    router.push(item.panelPath)
                    return
                  }
                  onNavigate(item.id!)
                }}
                className="flex w-full items-center gap-2.5 rounded px-3 py-2 text-left text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 hover:text-red-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <span className="text-gray-400">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {sites.length > 0 && (
          <div className="rounded border border-gray-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-gray-500">
              <span className="text-gray-900 dark:text-zinc-100">{sites.length}</span> Websites
            </p>
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {sites.map((s, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center gap-2 text-xs">
                    <div
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${s.state === 'Active' ? 'bg-green-500' : 'bg-red-400'}`}
                    />
                    <span className="flex-1 truncate font-medium text-gray-700 dark:text-zinc-300">{s.domain}</span>
                  </div>
                  <div className="flex gap-1.5 pl-3.5">
                    <button
                      type="button"
                      onClick={() => {
                        if (onSetFileManagerDomain) onSetFileManagerDomain(s.domain)
                        onNavigate('file-manager')
                      }}
                      title="Abrir ficheiros do site"
                      className="flex items-center gap-0.5 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-600 transition-colors hover:bg-amber-100 hover:text-amber-800"
                    >
                      <FolderOpen className="h-2.5 w-2.5" /> Ficheiros
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        // @ts-ignore
                        window.__selectedManageDomain = s.domain
                        onNavigate('manage-website')
                      }}
                      title="Gerir website"
                      className="flex items-center gap-0.5 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-600 transition-colors hover:bg-indigo-100 hover:text-indigo-800"
                    >
                      <Lock className="h-2.5 w-2.5" /> Gerir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
