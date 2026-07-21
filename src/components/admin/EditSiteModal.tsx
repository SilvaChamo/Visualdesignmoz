'use client'

import { useState } from 'react'
import { useI18n } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { X, Save, Trash2, Globe, Mail, Shield, Code } from 'lucide-react'

interface Site {
  domain: string
  package: string
  admin: string
  state: string
  ssl: string
}

interface EditSiteModalProps {
  site: Site | null
  packages: any[]
  isOpen: boolean
  onClose: () => void
  onSave: (siteData: any) => Promise<void>
  onDelete: (domain: string) => Promise<void>
}

export function EditSiteModal({ site, packages, isOpen, onClose, onSave, onDelete }: EditSiteModalProps) {
  const { t } = useI18n()
  const [formData, setFormData] = useState({
    domain: site?.domain || '',
    ownerEmail: site?.admin || '',
    packageName: site?.package || 'Default',
    phpVersion: 'PHP 8.2',
    ssl: site?.ssl === 'Enabled',
    state: site?.state === 'Active'
  })
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  if (!isOpen || !site) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    
    try {
      await onSave(formData)
      onClose()
    } catch (error) {
      console.error('Error saving site:', error)
      alert('Erro ao salvar site')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Tem certeza que deseja apagar o site ${site.domain}? Esta acção é irreversível!`)) return
    
    setIsDeleting(true)
    try {
      await onDelete(site.domain)
      onClose()
    } catch (error) {
      console.error('Error deleting site:', error)
      alert('Erro ao apagar site')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <Globe className="w-5 h-5 text-blue-400" />
            <h2 className="text-xl font-semibold text-white">Editar Site: {site.domain}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Domain (readonly) */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Domínio
            </label>
            <input
              type="text"
              value={formData.domain}
              disabled
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 cursor-not-allowed"
            />
          </div>

          {/* Owner Email */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <Mail className="inline w-4 h-4 mr-2" />
              Email do Administrador
            </label>
            <input
              type="email"
              value={formData.ownerEmail}
              onChange={(e) => setFormData({ ...formData, ownerEmail: e.target.value })}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
              placeholder="admin@exemplo.com"
            />
          </div>

          {/* Package */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Pacote
            </label>
            <select
              value={formData.packageName}
              onChange={(e) => setFormData({ ...formData, packageName: e.target.value })}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
            >
              {packages.map((pkg: any) => (
                <option key={pkg.packageName} value={pkg.packageName}>
                  {pkg.packageName} ({pkg.diskSpace}MB)
                </option>
              ))}
            </select>
          </div>

          {/* PHP Version */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <Code className="inline w-4 h-4 mr-2" />
              Versão PHP
            </label>
            <select
              value={formData.phpVersion}
              onChange={(e) => setFormData({ ...formData, phpVersion: e.target.value })}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
            >
              <option value="PHP 8.2">PHP 8.2</option>
              <option value="PHP 8.1">PHP 8.1</option>
              <option value="PHP 8.0">PHP 8.0</option>
              <option value="PHP 7.4">PHP 7.4</option>
            </select>
          </div>

          {/* SSL and State toggles */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-4 bg-gray-800 border border-gray-700 rounded-lg">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-green-400" />
                <span className="text-sm text-gray-300">SSL</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.ssl}
                  onChange={(e) => setFormData({ ...formData, ssl: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-800 border border-gray-700 rounded-lg">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-blue-400" />
                <span className="text-sm text-gray-300">Estado</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-6 border-t border-gray-800">
            <Button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  A apagar...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Apagar Site
                </>
              )}
            </Button>

            <div className="flex gap-3">
              <Button
                type="button"
                onClick={onClose}
                className="bg-gray-700 hover:bg-gray-600 text-white"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSaving}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    A salvar...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Salvar
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
