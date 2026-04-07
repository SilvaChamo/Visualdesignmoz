'use client'

import { useState, useEffect } from 'react'

import { Globe, Database, Mail, Eye, EyeOff, Check, X, Server, FolderOpen, ExternalLink, RefreshCw } from 'lucide-react'

interface Site {
  domain: string
  path: string
  state: string
}

interface InstallForm {
  protocol: 'http' | 'https'
  domain: string
  directory: string
  version: string
  siteName: string
  siteDescription: string
  enableMultisite: boolean
  disableWPCron: boolean
  adminUsername: string
  adminPassword: string
  adminEmail: string
  databaseName: string
  databaseUser: string
  databasePassword: string
}

export default function WordPressInstallPage() {
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showDBPassword, setShowDBPassword] = useState(false)
  const [passwordStrength, setPasswordStrength] = useState<'weak' | 'medium' | 'strong'>('weak')
  const [message, setMessage] = useState('')
  const [success, setSuccess] = useState(false)

  const [form, setForm] = useState<InstallForm>({
    protocol: 'https',
    domain: '',
    directory: '',
    version: '6.7.1',
    siteName: '',
    siteDescription: '',
    enableMultisite: false,
    disableWPCron: false,
    adminUsername: '',
    adminPassword: '',
    adminEmail: '',
    databaseName: '',
    databaseUser: '',
    databasePassword: ''
  })

  const wordpressVersions = ['6.7.1', '6.6.2', '6.5.5', '6.4.3']

  useEffect(() => {
    loadSites()
  }, [])

  const loadSites = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/cyberpanel-db?type=websites')
      const data = await response.json()
      if (data.success) {
        setSites(data.sites || [])
      }
    } catch (error) {
      console.error('Erro ao carregar sites:', error)
    }
    setLoading(false)
  }

  const getPasswordStrength = (password: string): 'weak' | 'medium' | 'strong' => {
    if (!password) return 'weak'
    
    let strength = 0
    if (password.length >= 8) strength++
    if (password.length >= 12) strength++
    if (/[a-z]/.test(password)) strength++
    if (/[A-Z]/.test(password)) strength++
    if (/[0-9]/.test(password)) strength++
    if (/[^a-zA-Z0-9]/.test(password)) strength++

    if (strength <= 2) return 'weak'
    if (strength <= 4) return 'medium'
    return 'strong'
  }

  const handlePasswordChange = (password: string) => {
    setForm({ ...form, adminPassword: password })
    setPasswordStrength(getPasswordStrength(password))
  }

  const generateDBCredentials = () => {
    if (!form.domain) return
    
    const domainClean = form.domain.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
    const dbName = `${domainClean}_wp`
    const dbUser = `${domainClean}_wpuser`
    const dbPassword = Math.random().toString(36).slice(-12)

    setForm({
      ...form,
      databaseName: dbName,
      databaseUser: dbUser,
      databasePassword: dbPassword
    })
  }

  useEffect(() => {
    generateDBCredentials()
  }, [form.domain])

  const getFinalURL = () => {
    const url = `${form.protocol}://${form.domain}`
    return form.directory ? `${url}/${form.directory}` : url
  }

  const handleInstall = async () => {
    setInstalling(true)
    setMessage('')
    
    try {
      const response = await fetch('/api/cyberpanel-wp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'installWordPress',
          ...form
        })
      })

      const data = await response.json()
      
      if (data.success) {
        setSuccess(true)
        setMessage('WordPress instalado com sucesso!')
      } else {
        setMessage(`Erro: ${data.error || 'Falha na instalação'}`)
      }
    } catch (error) {
      setMessage('Erro de conexão com o servidor')
    }
    
    setInstalling(false)
  }

  const getPasswordStrengthColor = () => {
    switch (passwordStrength) {
      case 'weak': return 'text-red-500'
      case 'medium': return 'text-yellow-500'
      case 'strong': return 'text-green-500'
    }
  }

  const getPasswordStrengthText = () => {
    switch (passwordStrength) {
      case 'weak': return 'Fraca'
      case 'medium': return 'Média'
      case 'strong': return 'Forte'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Instalar WordPress</h1>
          <p className="text-gray-600 mt-2">Instale o WordPress em qualquer domínio com configuração avançada</p>
        </div>

        {message && (
          <div className={`mb-6 p-4 rounded-lg ${success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            <div className="flex items-center gap-2">
              {success ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
              <span>{message}</span>
            </div>
            {success && (
              <div className="mt-3 flex gap-3">
                <a href={`${getFinalURL()}/wp-admin`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                  <ExternalLink className="w-4 h-4" />
                  Acessar WP Admin
                </a>
                <a href={getFinalURL()} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors">
                  <Globe className="w-4 h-4" />
                  Ver Site
                </a>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Configuração do Software */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Server className="w-5 h-5 text-blue-600" />
                Configuração do Software
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Protocolo</label>
                <select
                  value={form.protocol}
                  onChange={(e) => setForm({ ...form, protocol: e.target.value as 'http' | 'https' })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="http">http://</option>
                  <option value="https">https://</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Domínio</label>
                <select
                  value={form.domain}
                  onChange={(e) => setForm({ ...form, domain: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={loading}
                >
                  <option value="">Selecione um domínio</option>
                  {sites.map((site) => (
                    <option key={site.domain} value={site.domain}>
                      {site.domain}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Diretório</label>
                <input
                  type="text"
                  value={form.directory}
                  onChange={(e) => setForm({ ...form, directory: e.target.value })}
                  placeholder="wp (vazio para raiz)"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Versão WordPress</label>
                <select
                  value={form.version}
                  onChange={(e) => setForm({ ...form, version: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {wordpressVersions.map((version) => (
                    <option key={version} value={version}>
                      WordPress {version}
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3 bg-gray-50 rounded-lg">
                <label className="block text-sm font-medium text-gray-700 mb-1">URL Final</label>
                <div className="text-sm font-mono text-blue-600">{getFinalURL()}</div>
              </div>
            </div>
          </div>

          {/* Configurações do Site */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Globe className="w-5 h-5 text-blue-600" />
                Configurações do Site
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Nome do Site</label>
                <input
                  type="text"
                  value={form.siteName}
                  onChange={(e) => setForm({ ...form, siteName: e.target.value })}
                  placeholder="Meu Site WordPress"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Descrição do Site</label>
                <textarea
                  value={form.siteDescription}
                  onChange={(e) => setForm({ ...form, siteDescription: e.target.value })}
                  placeholder="Um site WordPress incrível"
                  rows={3}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.enableMultisite}
                    onChange={(e) => setForm({ ...form, enableMultisite: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Ativar Multisite (WPMU)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.disableWPCron}
                    onChange={(e) => setForm({ ...form, disableWPCron: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Desativar WordPress Cron</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Nome de Utilizador</label>
                <input
                  type="text"
                  value={form.adminUsername}
                  onChange={(e) => setForm({ ...form, adminUsername: e.target.value })}
                  placeholder="admin"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Senha</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form.adminPassword}
                    onChange={(e) => handlePasswordChange(e.target.value)}
                    placeholder="Senha forte"
                    className="w-full px-3 py-2.5 pr-10 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {form.adminPassword && (
                  <div className={`mt-1 text-xs ${getPasswordStrengthColor()}`}>
                    Força da senha: {getPasswordStrengthText()}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                <input
                  type="email"
                  value={form.adminEmail}
                  onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
                  placeholder="admin@exemplo.com"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Base de Dados */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Database className="w-5 h-5 text-blue-600" />
                Base de Dados
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Nome da Base de Dados</label>
                <input
                  type="text"
                  value={form.databaseName}
                  onChange={(e) => setForm({ ...form, databaseName: e.target.value })}
                  placeholder="Portal Digital_wp"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Utilizador BD</label>
                <input
                  type="text"
                  value={form.databaseUser}
                  onChange={(e) => setForm({ ...form, databaseUser: e.target.value })}
                  placeholder="Portal Digital_wpuser"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Senha BD</label>
                <div className="relative">
                  <input
                    type={showDBPassword ? 'text' : 'password'}
                    value={form.databasePassword}
                    onChange={(e) => setForm({ ...form, databasePassword: e.target.value })}
                    placeholder="Senha do banco de dados"
                    className="w-full px-3 py-2.5 pr-10 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowDBPassword(!showDBPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showDBPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-700">
                  <strong>Nota:</strong> A base de dados e o utilizador serão criados automaticamente no servidor
                </p>
              </div>
            </div>
          </div>

          {/* Botão Instalar */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <button
              onClick={handleInstall}
              disabled={installing || !form.domain || !form.siteName || !form.adminUsername || !form.adminPassword || !form.adminEmail}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              {installing ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Instalando WordPress...
                </>
              ) : (
                <>
                  <Database className="w-5 h-5" />
                  Instalar WordPress
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
