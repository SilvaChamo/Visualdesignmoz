'use client'

import { useState, useEffect, useRef } from 'react'

import { 
  Home, Globe, Users, Mail, Shield, Database, Settings, 
  ChevronLeft, ChevronRight, Plus, Search, Download, ExternalLink,
  Edit2, Pause, Play, Trash2, RefreshCw, LogOut, Package, Server, Lock, LockOpen, Edit, Power, FolderOpen, FileText, Archive, Globe as GlobeIcon
} from 'lucide-react'
import { CpanelDashboard } from './CpanelDashboard'
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
} from './CyberPanelSections'
import { cyberPanelAPI } from '@/lib/cyberpanel-api'
import type { CyberPanelWebsite, CyberPanelUser, CyberPanelPackage } from '@/lib/cyberpanel-api'

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
  }, [paginatedSites, expandedSite])

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
    { id: 'clientes', label: 'Clientes', icon: Users },
    { id: 'domains', label: 'Websites', icon: Globe },
    { id: 'cp-users', label: 'Contas', icon: Users },
    { id: 'backup-manager', label: 'Backups', icon: Archive },
    { id: 'cp-databases', label: 'Databases', icon: Database },
    { id: 'emails-new', label: 'Email', icon: Mail },
    { id: 'cp-ssl', label: 'SSL', icon: Lock },
    { id: 'cp-security', label: 'Segurança', icon: Shield },
    { id: 'cp-php', label: 'PHP', icon: Server },
    { id: 'git-deploy', label: 'Deploy / GitHub', icon: Download },
    { id: 'cp-api', label: 'Configurações', icon: Settings },
  ]

  const currentSidebarWidth = isCollapsed ? 80 : 250

  const renderSection = () => {
    switch (activeSection) {
      case 'dashboard':
        return <CpanelDashboard 
          sites={cyberPanelSites} 
          users={cyberPanelUsers} 
          isFetching={isFetchingCyberPanel} 
          onNavigate={setActiveSection} 
          onRefresh={loadCyberPanelData}
          onSetDNSDomain={setSelectedDNSDomain}
          onSetFileManagerDomain={setFileManagerDomain}
        />
      case 'domains':
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
      case 'clientes':
        return <div className="p-6"><h1 className="text-2xl font-bold">Clientes</h1><p className="text-gray-500 mt-1">Secção em desenvolvimento</p></div>
      case 'domains-new':
        return <CreateWebsiteSection packages={cyberPanelPackages} onRefresh={loadCyberPanelData} />
      case 'cp-subdomains':
        return <SubdomainsSection sites={cyberPanelSites} />
      case 'cp-list-subdomains':
        return <ListSubdomainsSection sites={cyberPanelSites} />
      case 'cp-modify-website':
        return <ModifyWebsiteSection sites={cyberPanelSites} packages={cyberPanelPackages} />
      case 'cp-suspend-website':
        return <SuspendWebsiteSection sites={cyberPanelSites} onRefresh={loadCyberPanelData} />
      case 'cp-delete-website':
        return <DeleteWebsiteSection sites={cyberPanelSites} onRefresh={loadCyberPanelData} />
      case 'cp-databases':
        return <DatabasesSection sites={cyberPanelSites} />
      case 'cp-ftp':
        return <FTPSection sites={cyberPanelSites} />
      case 'emails-new':
      case 'cp-email-mgmt':
        return <EmailManagementSection sites={cyberPanelSites} />
      case 'cp-email-delete':
        return <EmailDeleteSection sites={cyberPanelSites} />
      case 'cp-email-limits':
        return <EmailLimitsSection sites={cyberPanelSites} />
      case 'cp-email-forwarding':
        return <EmailForwardingSection sites={cyberPanelSites} />
      case 'cp-email-catchall':
        return <CatchAllEmailSection sites={cyberPanelSites} />
      case 'cp-email-pattern-fwd':
        return <PatternForwardingSection sites={cyberPanelSites} />
      case 'cp-email-plus-addr':
        return <PlusAddressingSection sites={cyberPanelSites} />
      case 'cp-email-change-pass':
        return <EmailChangePasswordSection sites={cyberPanelSites} />
      case 'cp-email-dkim':
        return <DKIMManagerSection sites={cyberPanelSites} />
      case 'cp-users':
        return <CPUsersSection />
      case 'cp-reseller':
        return <ResellerSection />
      case 'cp-ssl':
        return <SSLSection sites={cyberPanelSites} />
      case 'cp-security':
        return <SecuritySection sites={cyberPanelSites} />
      case 'cp-php':
        return <PHPConfigSection sites={cyberPanelSites} />
      case 'cp-api':
      case 'infrastructure':
        return <APIConfigSection />
      case 'cp-wp-list':
        return <WPListSection sites={cyberPanelSites} setFileManagerDomain={setFileManagerDomain} setActiveSection={setActiveSection} />
      case 'cp-wp-plugins':
        return <WPPluginsSection sites={cyberPanelSites} />
      case 'cp-wp-restore-backup':
        return <WPRestoreBackupSection sites={cyberPanelSites} />
      case 'cp-wp-remote-backup':
        return <WPRemoteBackupSection sites={cyberPanelSites} />
      case 'cp-dns-nameserver':
        return <DNSNameserverSection sites={cyberPanelSites} />
      case 'cp-dns-default-ns':
        return <DNSDefaultNSSection />
      case 'cp-dns-create-zone':
        return <DNSCreateZoneSection sites={cyberPanelSites} />
      case 'domains-dns':
        return <DNSZoneEditorSection 
          sites={cyberPanelSites} 
          initialDomain={selectedDNSDomain || primaryDomain} 
        />
      case 'cp-dns-delete-zone':
        return <DNSDeleteZoneSection sites={cyberPanelSites} />
      case 'cp-dns-cloudflare':
        return <CloudFlareSection sites={cyberPanelSites} />
      case 'cp-dns-reset':
        return <DNSResetSection sites={cyberPanelSites} />
      case 'cp-dns-zone-editor':
        return <DNSZoneEditorSection sites={cyberPanelSites} />
      case 'git-deploy':
        return <GitDeploySection />
      case 'backup-manager':
      case 'cp-backup':
        return <BackupManagerSection sites={cyberPanelSites} />
      case 'wordpress-install':
        return <WordPressInstallSection sites={cyberPanelSites} />
      case 'cp-wp-backup':
        return <WPBackupSection sites={cyberPanelSites} />
      case 'domain-manager':
        return <DomainManagerSection sites={cyberPanelSites} />
      case 'git-deploy':
      case 'deploy':
        return <DeploySection sites={cyberPanelSites} />
      case 'packages-list':
        return <PackagesSection packages={cyberPanelPackages} onRefresh={loadCyberPanelData} />
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
                <h1 className="text-xl font-bold text-gray-900">Painel Admin</h1>
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
                <p className="text-xs font-bold text-gray-900 truncate">Silva Chamo</p>
                <p className="text-[10px] text-gray-400 truncate">silva.chamo@gmail.com</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 ml-6">
                Dashboard
              </h1>
              <p className="text-xs text-gray-400 mt-0.5 ml-6">
                Visão geral do servidor
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleSync} disabled={syncing}
                className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50" title="Actualizar dados">
                <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
                {syncing ? 'A sincronizar...' : 'Actualizar'}
              </button>
              <a href="https://109.199.104.22:8090" target="_blank" rel="noopener noreferrer"
                className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1.5 transition-colors">
                <Globe size={13} /> Painel CyberPanel
              </a>
              <button onClick={() => window.location.href = '/'}
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
