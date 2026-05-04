'use client'

import React, { useState } from 'react'
import {
  FolderOpen, Database, Globe, Mail, Shield, ShieldCheck, Code, Users, Package,
  Server, BarChart2, ChevronUp, ChevronDown, ExternalLink, HardDrive,
  Upload, Download, PlusCircle, Lock, RefreshCw, Cloud, Key,
  Layers, Globe2, FileText, AlertCircle, Edit, Trash2, List,
  RotateCcw, Power, Plug, ArrowRight, Filter, Settings, Search,
  Wifi, Zap, BookOpen, Monitor, Archive, Eye, Layout, Activity
} from 'lucide-react'
import type { CyberPanelWebsite, CyberPanelUser } from '@/lib/cyberpanel-api'
import { getServerHost, getHestiaUrl } from '@/lib/server-config'

interface Tool {
  id: string
  name: string
  icon: React.ReactNode
  external?: string
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

interface Props {
  onNavigate: (section: string) => void
  onSetDNSDomain?: (domain: string) => void
  onSetFileManagerDomain?: (domain: string) => void
  sites: CyberPanelWebsite[]
  users: CyberPanelUser[]
  isFetching: boolean
  onRefresh: () => void
  searchQuery?: string
  onSearchChange?: (query: string) => void
}

export function CpanelDashboard({ onNavigate, onSetDNSDomain, onSetFileManagerDomain, sites, users, isFetching, onRefresh, searchQuery = '', onSearchChange }: Props) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [diskInfo, setDiskInfo] = useState<{ used: string; total: string; percentage: string } | null>(null)

  React.useEffect(() => {
    const fetchDisk = async () => {
      try {
        const res = await fetch('/api/da', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'serverDiskUsage', params: {} })
        })
        const data = await res.json()
        if (data.success) setDiskInfo(data.data)
      } catch (e) { console.error(e) }
    }
    fetchDisk()
  }, [])

  // Definir domínio principal
  const primaryDomain = sites.length > 0
    ? sites.find(s => !s.domain.includes('contaboserver'))?.domain || sites[0].domain
    : 'your-domain.com'

  const handleDNSNavigate = (section: string) => {
    if (section === 'domains-dns' && onSetDNSDomain) {
      onSetDNSDomain(primaryDomain)
    }
    onNavigate(section)
  }

  const toggle = (id: string) => setCollapsed(p => ({ ...p, [id]: !p[id] }))

  const sections: Section[] = [
    {
      id: 'email', name: 'E-mails',
      headerIcon: <Mail className="w-5 h-5" />,
      color: 'text-cyan-700', bgColor: 'bg-cyan-50',
      tools: [
        { id: 'cp-email-mgmt', name: 'E-mails', icon: <Mail className="w-9 h-9 text-cyan-500" /> },
        { id: 'emails-webmail', name: 'Webmail', icon: <ExternalLink className="w-9 h-9 text-cyan-500" /> },
        { id: 'newsletter', name: 'Email Marketing', icon: <Layout className="w-9 h-9 text-cyan-500" /> },
        { id: 'cp-email-delete', name: 'Apagar Email', icon: <Trash2 className="w-9 h-9 text-cyan-500" /> },
        { id: 'cp-email-forwarding', name: 'Encaminhamento', icon: <ArrowRight className="w-9 h-9 text-cyan-500" /> },
        { id: 'cp-email-catchall', name: 'Catch-All Email', icon: <Filter className="w-9 h-9 text-cyan-500" /> },
        { id: 'cp-email-pattern-fwd', name: 'Pattern Forwarding', icon: <Zap className="w-9 h-9 text-cyan-500" /> },
        { id: 'cp-email-plus-addr', name: 'Plus-Addressing', icon: <BookOpen className="w-9 h-9 text-cyan-500" /> },
        { id: 'cp-email-change-pass', name: 'Alterar Password', icon: <Key className="w-9 h-9 text-cyan-500" /> },
        { id: 'cp-email-dkim', name: 'DKIM Manager', icon: <Shield className="w-9 h-9 text-cyan-500" /> },
        { id: 'cp-email-limits', name: 'Limites de Email', icon: <Settings className="w-9 h-9 text-cyan-500" /> },
        { id: 'setup-smtp', name: 'Configurar SMTP', icon: <Server className="w-9 h-9 text-red-500" /> },
        { id: 'email-diagnostico', name: 'Diagnóstico', icon: <Activity className="w-9 h-9 text-cyan-500" /> },
      ]
    },
    {
      id: 'ficheiros', name: 'Ficheiros',
      headerIcon: <FolderOpen className="w-5 h-5" />,
      color: 'text-amber-700', bgColor: 'bg-amber-50',
      tools: [
        { id: 'cp-filemanager', name: 'Gestor de Ficheiros', icon: <FolderOpen className="w-9 h-9 text-amber-500" /> },
        { id: 'cp-ftp', name: 'Contas FTP', icon: <Upload className="w-9 h-9 text-amber-500" /> },
        { id: 'infrastructure', name: 'Estado do Servidor', icon: <Monitor className="w-9 h-9 text-amber-500" /> },
      ]
    },
    {
      id: 'dominios', name: 'Domínios',
      headerIcon: <Globe className="w-5 h-5" />,
      color: 'text-blue-700', bgColor: 'bg-blue-50',
      tools: [
        { id: 'domains-new', name: 'Criar Website', icon: <PlusCircle className="w-9 h-9 text-blue-500" /> },
        { id: 'domain-manager', name: 'Domínios', icon: <Globe className="w-9 h-9 text-blue-500" /> },
        { id: 'domains', name: 'Listar Websites', icon: <Globe className="w-9 h-9 text-blue-500" /> },
        { id: 'cp-subdomains', name: 'Criar Subdomínio', icon: <Layers className="w-9 h-9 text-blue-500" /> },
        { id: 'cp-list-subdomains', name: 'Listar Sub/Addon', icon: <List className="w-9 h-9 text-blue-500" /> },
        { id: 'cp-modify-website', name: 'Modificar Website', icon: <Edit className="w-9 h-9 text-blue-500" /> },
        { id: 'cp-suspend-website', name: 'Suspender/Activar', icon: <Power className="w-9 h-9 text-blue-500" /> },
        { id: 'website-preview', name: 'Website Preview', icon: <Eye className="w-9 h-9 text-blue-500" /> },
        { id: 'cp-delete-website', name: 'Apagar Website', icon: <Trash2 className="w-9 h-9 text-red-500" /> },
      ]
    },
    {
      id: 'wordpress', name: 'WordPress',
      headerIcon: <Globe2 className="w-5 h-5" />,
      color: 'text-indigo-700', bgColor: 'bg-indigo-50',
      tools: [
        { id: 'wordpress-install', name: 'Instalar WordPress', icon: <Globe className="w-9 h-9 text-blue-500" /> },
        { id: 'cp-wp-list', name: 'Painel WP Admin', icon: <Monitor className="w-9 h-9 text-indigo-500" /> },
        { id: 'cp-wp-plugins', name: 'Gerir Plugins', icon: <Plug className="w-9 h-9 text-indigo-500" /> },
      ]
    },
    {
      id: 'backup', name: 'BackUp',
      headerIcon: <Archive className="w-5 h-5" />,
      color: 'text-violet-700', bgColor: 'bg-violet-50',
      tools: [
        { id: 'cp-wp-backup', name: 'Fazer Backup', icon: <Archive className="w-9 h-9 text-violet-500" /> },
        { id: 'cp-wp-restore-backup', name: 'Restaurar Backup', icon: <RotateCcw className="w-9 h-9 text-violet-500" /> },
        { id: 'cp-wp-remote-backup', name: 'Backup Remoto', icon: <Cloud className="w-9 h-9 text-violet-500" /> },
        { id: 'backup-manager', name: 'Gestão de Backups', icon: <HardDrive className="w-9 h-9 text-violet-500" /> },
      ]
    },
    {
      id: 'databases', name: 'Databases',
      headerIcon: <Database className="w-5 h-5" />,
      color: 'text-orange-700', bgColor: 'bg-orange-50',
      tools: [
        { id: 'cp-databases', name: 'Criar Base de Dados', icon: <PlusCircle className="w-9 h-9 text-orange-500" /> },
        { id: 'cp-databases', name: 'Gerir Bases de Dados', icon: <Database className="w-9 h-9 text-orange-500" /> },
        { id: 'phpmyadmin', name: 'phpMyAdmin', icon: <ExternalLink className="w-9 h-9 text-orange-500" />, external: `${getHestiaUrl()}/phpmyadmin/` },
      ]
    },
    {
      id: 'dns', name: 'DNS',
      headerIcon: <Server className="w-5 h-5" />,
      color: 'text-amber-800', bgColor: 'bg-yellow-50',
      tools: [
        { id: 'domains-dns', name: 'Editar DNS', icon: <Edit className="w-9 h-9 text-amber-600" /> },
        { id: 'dns-central', name: 'DNS Central', icon: <Globe className="w-9 h-9 text-amber-600" /> },
        { id: 'cp-dns-nameserver', name: 'Criar Nameserver', icon: <Server className="w-9 h-9 text-amber-600" /> },
        { id: 'cp-dns-default-ns', name: 'Nameservers Padrão', icon: <Settings className="w-9 h-9 text-amber-600" /> },
        { id: 'cp-dns-create-zone', name: 'Criar Zona DNS', icon: <PlusCircle className="w-9 h-9 text-amber-600" /> },
        { id: 'cp-dns-delete-zone', name: 'Apagar Zona DNS', icon: <Trash2 className="w-9 h-9 text-red-500" /> },
        { id: 'domains-dns', name: 'Adicionar Registos', icon: <FileText className="w-9 h-9 text-amber-600" /> },
        { id: 'cp-dns-cloudflare', name: 'CloudFlare', icon: <Cloud className="w-9 h-9 text-amber-600" /> },
        { id: 'cp-dns-reset', name: 'Reset DNS', icon: <RotateCcw className="w-9 h-9 text-amber-600" /> },
      ]
    },
    {
      id: 'seguranca', name: 'Segurança',
      headerIcon: <Shield className="w-5 h-5" />,
      color: 'text-red-700', bgColor: 'bg-red-50',
      tools: [
        { id: 'cp-ssl', name: 'SSL / TLS', icon: <Lock className="w-9 h-9 text-red-500" /> },
        { id: 'cp-security', name: 'Firewall & ModSecurity', icon: <Shield className="w-9 h-9 text-red-500" /> },
        { id: 'cp-security', name: 'IPs Bloqueados', icon: <AlertCircle className="w-9 h-9 text-red-500" /> },
        { id: 'cp-api', name: 'Configurações API', icon: <Settings className="w-9 h-9 text-red-500" /> },
      ]
    },
    {
      id: 'software', name: 'Software / PHP',
      headerIcon: <Code className="w-5 h-5" />,
      color: 'text-purple-700', bgColor: 'bg-purple-50',
      tools: [
        { id: 'cp-php', name: 'Configuração PHP', icon: <Code className="w-9 h-9 text-purple-500" /> },
      ]
    },
    {
      id: 'utilizadores', name: 'Utilizadores',
      headerIcon: <Users className="w-5 h-5" />,
      color: 'text-green-700', bgColor: 'bg-green-50',
      tools: [
        { id: 'cp-reseller', name: 'Centro de Revenda', icon: <Package className="w-9 h-9 text-green-500" /> },
      ]
    },
    {
      id: 'pacotes', name: 'Pacotes de Hosting',
      headerIcon: <Package className="w-5 h-5" />,
      color: 'text-teal-700', bgColor: 'bg-teal-50',
      tools: [
        { id: 'packages-new', name: 'Criar Pacote', icon: <PlusCircle className="w-9 h-9 text-teal-500" /> },
        { id: 'packages-list', name: 'Listar Pacotes', icon: <HardDrive className="w-9 h-9 text-teal-500" /> },
      ]
    },
    {
      id: 'metricas', name: 'Métricas e Relatórios',
      headerIcon: <BarChart2 className="w-5 h-5" />,
      color: 'text-slate-700', bgColor: 'bg-slate-50',
      tools: [
        { id: 'infrastructure', name: 'Estado do Servidor', icon: <Server className="w-9 h-9 text-slate-500" /> },
        { id: 'reports', name: 'Relatórios', icon: <BarChart2 className="w-9 h-9 text-slate-500" /> },
        { id: 'analyses', name: 'Análises', icon: <Wifi className="w-9 h-9 text-slate-500" /> },
      ]
    },
    {
      id: 'manutencao', name: 'Manutenção',
      headerIcon: <ShieldCheck className="w-5 h-5" />,
      color: 'text-red-700', bgColor: 'bg-red-50',
      tools: [
        { id: 'cp-audit-sync', name: 'Auditoria & Sync', icon: <ShieldCheck className="w-9 h-9 text-red-500" /> },
        { id: 'diagnostico', name: 'Diagnóstico', icon: <Activity className="w-9 h-9 text-red-500" /> },
      ]
    },
  ]

  const filtered = searchQuery.trim()
    ? sections.map(s => ({
      ...s,
      tools: s.tools.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()))
    })).filter(s => s.tools.length > 0)
    : sections

  return (
    <div className="flex gap-6">
      {/* Main Grid */}
      <div className="flex-1 min-w-0 space-y-3">
        {filtered.map(section => (
          <div key={section.id} className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <button
              onClick={() => toggle(section.id)}
              className={`w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors border-b ${collapsed[section.id] ? 'border-transparent' : 'border-gray-100'}`}
            >
              <div className="flex items-center gap-3">
                <div className={`${section.bgColor} ${section.color} p-1.5 rounded`}>
                  {section.headerIcon}
                </div>
                <span className="font-bold text-gray-800 text-sm">{section.name}</span>
                <span className="text-xs text-gray-400 font-normal">({section.tools.length})</span>
              </div>
              {collapsed[section.id]
                ? <ChevronDown className="w-4 h-4 text-gray-400" />
                : <ChevronUp className="w-4 h-4 text-gray-400" />}
            </button>

            {!collapsed[section.id] && (
              <div className="p-4">
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                  {section.tools.map((tool, i) =>
                    tool.external ? (
                      <a key={i} href={tool.external} target="_blank" rel="noopener noreferrer"
                        className={`flex flex-col items-center gap-2 p-3 rounded hover:bg-gray-50 border transition-all group text-center ${tool.highlight ? 'bg-blue-50 border-blue-200 hover:border-blue-300' : 'border-transparent hover:border-gray-200'
                          }`}>
                        <div className="group-hover:scale-110 transition-transform">{tool.icon}</div>
                        <span className={`text-xs font-medium leading-tight ${tool.highlight ? 'text-blue-700' : 'text-gray-600'}`}>{tool.name}</span>
                      </a>
                    ) : (
                      <button key={i} onClick={() => handleDNSNavigate(tool.id)}
                        className={`flex flex-col items-center gap-2 p-3 rounded hover:bg-gray-50 border transition-all group text-center w-full ${tool.highlight ? 'bg-blue-50 border-blue-200 hover:border-blue-300' : 'border-transparent hover:border-gray-200'
                          }`}>
                        <div className="group-hover:scale-110 transition-transform">{tool.icon}</div>
                        <span className={`text-xs font-medium leading-tight ${tool.highlight ? 'text-blue-700' : 'text-gray-600'}`}>{tool.name}</span>
                      </button>
                    )
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Right Sidebar */}
      <div className="w-60 shrink-0 space-y-4">
        {/* Server Info */}
        <div className="bg-white rounded border border-gray-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Servidor</p>

          </div>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Utilizador</p>
              <p className="font-bold text-gray-900">admin</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">IP do Servidor</p>
              <p className="font-mono text-gray-800 text-xs">{getServerHost()}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Websites Activos</p>
              <p className="font-bold text-gray-900">{sites.length}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Utilizadores CP</p>
              <p className="font-bold text-gray-900">{users.length}</p>
            </div>
            {diskInfo && (
              <div>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Espaço em Disco</p>
                <p className="font-bold text-gray-900">{diskInfo.used} / {diskInfo.total}</p>
                <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
                  <div className="bg-red-500 h-1.5 rounded-full" style={{ width: diskInfo.percentage }}></div>
                </div>
              </div>
            )}
            <div className="pt-1">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                <span className="text-xs text-green-600 font-bold">Servidor Online</span>
              </div>
            </div>
          </div>
          <a href={getHestiaUrl()} target="_blank" rel="noopener noreferrer"
            className="w-full bg-red-50 border border-red-300 text-red-600 hover:bg-red-100 hover:text-red-700 text-xs font-bold py-2.5 px-4 rounded transition-all flex items-center justify-center gap-2">
            <ExternalLink className="w-3.5 h-3.5" /> Abrir HestiaCP
          </a>
        </div>

        {/* Quick Access */}
        <div className="bg-white rounded border border-gray-200 shadow-sm p-4">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3">Acesso Rápido</p>
          <div className="space-y-1">
            {[
              { label: 'Criar Website', id: 'domains-new', icon: <Globe className="w-3.5 h-3.5" /> },
              { label: 'Criar Email', id: 'emails-new', icon: <Mail className="w-3.5 h-3.5" /> },
              { label: 'Instalar WordPress', id: 'wordpress-deploy', icon: <Download className="w-3.5 h-3.5" /> },
              { label: 'Criar Utilizador', id: 'cp-users', icon: <Users className="w-3.5 h-3.5" /> },
              { label: 'Emitir SSL', id: 'cp-ssl', icon: <Lock className="w-3.5 h-3.5" /> },
              { label: 'Criar Pacote', id: 'packages-new', icon: <Package className="w-3.5 h-3.5" /> },
              { label: 'Zona DNS', id: 'cp-dns-create-zone', icon: <Server className="w-3.5 h-3.5" /> },
            ].map((item, i) => (
              <button key={i} onClick={() => onNavigate(item.id)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 hover:text-red-600 rounded transition-colors text-left font-medium">
                <span className="text-gray-400">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sites list */}
        {sites.length > 0 && (
          <div className="bg-white rounded border border-gray-200 shadow-sm p-4">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3">Websites ({sites.length})</p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {sites.map((s, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center gap-2 text-xs">
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.state === 'Active' ? 'bg-green-500' : 'bg-red-400'}`}></div>
                    <span className="text-gray-700 truncate font-medium flex-1">{s.domain}</span>
                  </div>
                  <div className="flex gap-1.5 pl-3.5">
                    <button
                      onClick={() => {
                        if (onSetFileManagerDomain) onSetFileManagerDomain(s.domain)
                        onNavigate('file-manager')
                      }}
                      title="Abrir ficheiros do site"
                      className="text-[10px] text-amber-600 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5 transition-colors">
                      <FolderOpen className="w-2.5 h-2.5" /> Ficheiros
                    </button>
                    <a
                      href={`https://${s.domain}/wp-admin`}
                      target="_blank" rel="noopener noreferrer"
                      title="Abrir WP Admin (se tiver WordPress)"
                      className="text-[10px] text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5 transition-colors">
                      <Globe2 className="w-2.5 h-2.5" /> WP Admin
                    </a>
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
