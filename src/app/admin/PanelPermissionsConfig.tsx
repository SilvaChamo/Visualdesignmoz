'use client'

import React, { useState, useEffect } from 'react'
import { Shield, Save, CheckSquare, Square, CheckCircle2, ExternalLink } from 'lucide-react'

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
      { id: 'install_wp', label: 'Instalações 1-Click (WordPress)', description: 'Ativar instalador automático do WordPress.', default: true },
      { id: 'file_manager', label: 'Gestor de Ficheiros', description: 'Acesso completo aos ficheiros via browser (File Manager).', default: true },
      { id: 'manage_dns', label: 'Gestão Completa de DNS', description: 'Adicionar/Modificar registos DNS (A, TXT, CNAME).', default: false }
    ]
  },
  {
    title: 'Bases de Dados e Backups',
    options: [
      { id: 'create_db', label: 'Criar Base de Dados', description: 'Criar banco de dados MySQL e utilizadores.', default: true },
      { id: 'access_phpmyadmin', label: 'Acesso ao phpMyAdmin', description: 'Abre a hiperligação direta para o phpMyAdmin do servidor.', default: true },
      { id: 'manage_backups', label: 'Efetuar Backups', description: 'Permite exportar e descarregar cópias de segurança do site.', default: false }
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

export function PanelPermissionsConfig({ role }: Props) {
  const [permissions, setPermissions] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedStatus, setSavedStatus] = useState(false)

  const roleName = role === 'client' ? 'Painel do Cliente' : 'Painel do Revendedor'
  const roleDesc = role === 'client' 
    ? 'Defina quais os módulos e acessos que os seus clientes finais podem visualizar e interagir no painel principal.'
    : 'Configuração dos limites e funcionalidades visíveis para quem subscreve planos de Revenda.'

  // Carregar configurações da base de dados
  useEffect(() => {
    // Como ainda não temos o endpoint oficial pronto, inicializamos com as defaults ou valores mokados
    // Em produção, faremos o fetch a /api/admin/permissions?role={role}
    const fetchPerms = async () => {
      try {
        const res = await fetch(`/api/admin/permissions?role=${role}`)
        if (res.ok) {
          const data = await res.json()
          setPermissions(data.permissions || {})
        } else {
          // Fallback para defaults
          const defaults: Record<string, boolean> = {}
          PERMISSION_GRID.forEach(cat => cat.options.forEach(opt => {
            defaults[opt.id] = role === 'reseller' ? true : opt.default // resellers têm mais acessos
          }))
          setPermissions(defaults)
        }
      } catch (error) {
        // Fallback
        const defaults: Record<string, boolean> = {}
        PERMISSION_GRID.forEach(cat => cat.options.forEach(opt => {
          defaults[opt.id] = role === 'reseller' ? true : opt.default
        }))
        setPermissions(defaults)
      } finally {
        setLoading(false)
      }
    }
    fetchPerms()
  }, [role])

  const togglePermission = (id: string) => {
    setPermissions(prev => ({
      ...prev,
      [id]: !prev[id]
    }))
    setSavedStatus(false)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // API call (a criar em breve)
      await fetch('/api/admin/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, permissions })
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
              href="/dashboard" 
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
      </div>
    </div>
  )
}
