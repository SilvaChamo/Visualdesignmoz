'use client'

import React, { useState, useEffect } from 'react'
import { Shield, Save, CheckSquare, Square, CheckCircle2, ExternalLink, Plus, X } from 'lucide-react'
import { ResellerMenuPermissionsConfig } from './ResellerMenuPermissionsConfig'

interface PermissionOption {
  id: string
  label: string
  description: string
  default: boolean
}

interface PermissionCategory {
  title: string
  options: PermissionOption[]
}

const PERMISSION_GRID: PermissionCategory[] = [
  {
    title: 'Gestão de Utilizadores e Segurança',
    options: [
      { id: 'create_users', label: 'Criar Novos Utilizadores', description: 'Permite criar contas adicionais de utilizadores.', default: false },
      { id: 'manage_ssl', label: 'Gestão de Certificados SSL', description: 'Atribuição e renovação manual de SSL para domínios.', default: true },
      { id: 'view_logs', label: 'Ver Registos de Sistema', description: 'Visualizar relatórios de erros ou estado da infraestrutura.', default: false }
    ]
  },
  {
    title: 'Hospedagem e Websites',
    options: [
      { id: 'create_website', label: 'Criar Novos Websites', description: 'Adicionar novos domínios e criar diretórios de websites.', default: false },
      { id: 'install_wp', label: 'Instalações 1-Click (WordPress)', description: 'Activar instalador automático do WordPress.', default: true },
      { id: 'update_wp_plugins', label: 'Actualização WP (plugins)', description: 'Permite actualizar plugins WordPress do site principal da conta.', default: false },
      { id: 'file_manager', label: 'Gestor de Ficheiros', description: 'Acesso completo aos ficheiros via browser (File Manager).', default: true },
      { id: 'manage_dns', label: 'Gestão Completa de DNS', description: 'Adicionar/Modificar registos DNS (A, TXT, CNAME).', default: false }
    ]
  },
  {
    title: 'Bases de Dados e Backups',
    options: [
      { id: 'create_db', label: 'Criar Base de Dados', description: 'Criar banco de dados MySQL e utilizadores.', default: true },
      { id: 'access_phpmyadmin', label: 'Acesso ao phpMyAdmin', description: 'Abre a hiperligação direta para o phpMyAdmin do servidor.', default: true },
      { id: 'manage_backups', label: 'Efectuar Backups', description: 'Permite exportar e descarregar cópias de segurança do site.', default: false }
    ]
  },
  {
    title: 'E-mail e Comunicação',
    options: [
      { id: 'create_email', label: 'Criar Caixas de E-mail', description: 'Abertura de novas caixas e password de e-mail.', default: true },
      { id: 'access_webmail', label: 'Acesso Rápido ao Webmail', description: 'Atalho no painel para aceder ao SnappyMail.', default: true },
      { id: 'email_marketing', label: 'Ferramenta de Newsletter', description: 'Acesso à ferramenta de envio em massa (se aplicável).', default: false },
      { id: 'email_forwarding', label: 'Configurar Encaminhamentos', description: 'Criação de regras de "Forwarding".', default: true }
    ]
  }
]

interface Props {
  role: 'client' | 'reseller'
}

function ClientPanelPermissionsConfig() {
  const [permissions, setPermissions] = useState<Record<string, boolean>>({})
  const [customOptions, setCustomOptions] = useState<PermissionOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedStatus, setSavedStatus] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newOption, setNewOption] = useState({ id: '', label: '', description: '' })

  const roleName = 'Painel do Cliente'
  const roleDesc = 'Defina quais os módulos e acessos que os seus clientes finais podem visualizar e interagir no painel principal.'

  // Carregar configurações da base de dados
  useEffect(() => {
    const fetchPerms = async () => {
      try {
        const res = await fetch('/api/admin/permissions?role=client')
        if (res.ok) {
          const data = await res.json()
          setPermissions(data.permissions || {})
          setCustomOptions(data.customOptions || [])
        } else {
          // Fallback para defaults
          const defaults: Record<string, boolean> = {}
          PERMISSION_GRID.forEach(cat => cat.options.forEach(opt => {
            defaults[opt.id] = opt.default
          }))
          setPermissions(defaults)
          setCustomOptions([])
        }
      } catch (error) {
        // Fallback
        const defaults: Record<string, boolean> = {}
        PERMISSION_GRID.forEach(cat => cat.options.forEach(opt => {
          defaults[opt.id] = opt.default
        }))
        setPermissions(defaults)
        setCustomOptions([])
      } finally {
        setLoading(false)
      }
    }
    fetchPerms()
  }, [])

  const togglePermission = (id: string) => {
    setPermissions(prev => ({
      ...prev,
      [id]: !prev[id]
    }))
    setSavedStatus(false)
  }

  const handleAddOption = () => {
    if (!newOption.id || !newOption.label) return
    
    // Verificar se já existe
    const allExistingIds = [
      ...PERMISSION_GRID.flatMap(cat => cat.options.map(opt => opt.id)),
      ...customOptions.map(opt => opt.id)
    ]
    
    if (allExistingIds.includes(newOption.id)) {
      alert('Este ID já existe. Escolha um ID único.')
      return
    }
    
    const option: PermissionOption = {
      id: newOption.id,
      label: newOption.label,
      description: newOption.description || 'Opção personalizada',
      default: true
    }
    
    setCustomOptions(prev => [...prev, option])
    // NOVA OPÇÃO FICA ACTIVA (checked) automaticamente
    setPermissions(prev => ({ ...prev, [option.id]: true }))
    setNewOption({ id: '', label: '', description: '' })
    setShowAddForm(false)
    setSavedStatus(false)
  }

  const handleRemoveCustomOption = (id: string) => {
    setCustomOptions(prev => prev.filter(opt => opt.id !== id))
    setPermissions(prev => {
      const updated = { ...prev }
      delete updated[id]
      return updated
    })
    setSavedStatus(false)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // Salvar permissões e opções personalizadas
      await fetch('/api/admin/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          role: 'client',
          permissions,
          customOptions 
        })
      })
      setTimeout(() => setSavedStatus(true), 500)
    } catch (e) {
      console.error(e)
    } finally {
      setTimeout(() => setSaving(false), 500)
    }
  }

  if (loading) return <div className="p-10 flex justify-center text-gray-500">A carregar configurações...</div>

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden p-6 relative">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">{roleName}</h2>
            </div>
            <p className="text-sm text-gray-600 max-w-2xl">{roleDesc}</p>
          </div>
          
          <div className="flex items-center gap-3">
            <a
              href="/cliente"
              target="_blank"
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg font-bold transition-all"
            >
              <ExternalLink className="w-4 h-4" /> Aceder ao Painel
            </a>
            <button 
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg font-bold transition-all disabled:opacity-70"
            >
            {saving ? (
              'A Guardar...'
            ) : savedStatus ? (
              <><CheckCircle2 className="w-4 h-4" /> Guardado!</>
            ) : (
              <><Save className="w-4 h-4" /> Guardar Alterações</>
            )}
          </button>
          </div>
        </div>
      </div>

      {/* Botão para adicionar nova opção */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-4 py-2 rounded-lg text-sm font-bold transition-all"
        >
          <Plus className="w-4 h-4" />
          {showAddForm ? 'Cancelar' : 'Adicionar Opção'}
        </button>
      </div>

      {/* Formulário para adicionar nova opção */}
      {showAddForm && (
        <div className="bg-indigo-50 rounded-xl border border-indigo-200 p-5">
          <h3 className="font-bold text-indigo-900 mb-4">Nova Opção de Menu</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-indigo-700 mb-1">ID (único)*</label>
              <input
                type="text"
                value={newOption.id}
                onChange={(e) => setNewOption(prev => ({ ...prev, id: e.target.value.replace(/\s+/g, '_').toLowerCase() }))}
                placeholder="ex: meu_componente"
                className="w-full px-3 py-2 border border-indigo-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-xs text-indigo-500 mt-1">Sem espaços, use underscore</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-indigo-700 mb-1">Nome*</label>
              <input
                type="text"
                value={newOption.label}
                onChange={(e) => setNewOption(prev => ({ ...prev, label: e.target.value }))}
                placeholder="ex: Meu Componente"
                className="w-full px-3 py-2 border border-indigo-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-indigo-700 mb-1">Descrição</label>
              <input
                type="text"
                value={newOption.description}
                onChange={(e) => setNewOption(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Descrição da funcionalidade"
                className="w-full px-3 py-2 border border-indigo-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={handleAddOption}
              disabled={!newOption.id || !newOption.label}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg text-sm font-bold transition-all disabled:opacity-50"
            >
              <Plus className="w-4 h-4 inline mr-1" />
              Adicionar ao Menu
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {PERMISSION_GRID.map((category, idx) => (
          <div key={idx} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
            <div className="bg-gray-50 px-5 py-3 border-b border-gray-100">
              <h3 className="font-bold text-gray-800">{category.title}</h3>
            </div>
            <div className="p-2 flex-1">
              <div className="divide-y divide-gray-50">
                {category.options.map(option => (
                  <label 
                    key={option.id} 
                    className="flex items-start gap-4 p-3 hover:bg-gray-50/80 cursor-pointer rounded-lg transition-colors group"
                  >
                    <button 
                      type="button"
                      role="checkbox"
                      aria-checked={permissions[option.id]}
                      onClick={() => togglePermission(option.id)}
                      className="mt-0.5 focus:outline-none"
                    >
                      {permissions[option.id] ? (
                        <CheckSquare className="w-5 h-5 text-indigo-600" />
                      ) : (
                        <Square className="w-5 h-5 text-gray-300 group-hover:text-gray-400" />
                      )}
                    </button>
                    <div>
                      <p className="font-semibold text-sm text-gray-900">{option.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{option.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        ))}
        
        {/* Card para opções personalizadas */}
        {customOptions.length > 0 && (
          <div className="bg-white rounded-xl border border-indigo-200 shadow-sm overflow-hidden flex flex-col">
            <div className="bg-indigo-50 px-5 py-3 border-b border-indigo-100">
              <h3 className="font-bold text-indigo-800">Opções Personalizadas</h3>
            </div>
            <div className="p-2 flex-1">
              <div className="divide-y divide-gray-50">
                {customOptions.map(option => (
                  <label 
                    key={option.id} 
                    className="flex items-start gap-4 p-3 hover:bg-gray-50/80 cursor-pointer rounded-lg transition-colors group"
                  >
                    <button 
                      type="button"
                      role="checkbox"
                      aria-checked={permissions[option.id]}
                      onClick={() => togglePermission(option.id)}
                      className="mt-0.5 focus:outline-none"
                    >
                      {permissions[option.id] ? (
                        <CheckSquare className="w-5 h-5 text-indigo-600" />
                      ) : (
                        <Square className="w-5 h-5 text-gray-300 group-hover:text-gray-400" />
                      )}
                    </button>
                    <div className="flex-1">
                      <p className="font-semibold text-sm text-gray-900">{option.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{option.description}</p>
                      <p className="text-xs text-indigo-500 mt-0.5">ID: {option.id}</p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleRemoveCustomOption(option.id)
                      }}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                      title="Remover opção"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function PanelPermissionsConfig({ role }: Props) {
  if (role === 'reseller') {
    return <ResellerMenuPermissionsConfig />
  }
  return <ClientPanelPermissionsConfig />
}
