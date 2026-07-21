'use client'

import { useState } from 'react'
import { useI18n } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { X, Plus, Trash2, Globe, Server } from 'lucide-react'

interface DNSRecord {
  id?: string
  name: string
  type: string
  value: string
  priority?: number
  ttl?: number
}

interface DNSModalProps {
  domain: string
  isOpen: boolean
  onClose: () => void
  onAddRecord: (record: DNSRecord) => Promise<void>
  onDeleteRecord: (recordId: string) => Promise<void>
  records: DNSRecord[]
}

export function DNSModal({ domain, isOpen, onClose, onAddRecord, onDeleteRecord, records }: DNSModalProps) {
  const { t } = useI18n()
  const [formData, setFormData] = useState<DNSRecord>({
    name: '',
    type: 'A',
    value: '',
    priority: 10,
    ttl: 3600
  })
  const [isAdding, setIsAdding] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name || !formData.value) return

    setIsAdding(true)
    try {
      await onAddRecord(formData)
      setFormData({
        name: '',
        type: 'A',
        value: '',
        priority: 10,
        ttl: 3600
      })
    } catch (error) {
      console.error('Error adding DNS record:', error)
      alert('Erro ao adicionar registo DNS')
    } finally {
      setIsAdding(false)
    }
  }

  const handleDelete = async (recordId: string) => {
    if (!confirm('Tem certeza que deseja apagar este registo DNS?')) return
    
    try {
      await onDeleteRecord(recordId)
    } catch (error) {
      console.error('Error deleting DNS record:', error)
      alert('Erro ao apagar registo DNS')
    }
  }

  const recordTypes = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'SRV', 'NS', 'PTR']

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <Server className="w-5 h-5 text-amber-400" />
            <h2 className="text-xl font-semibold text-white">Gestão DNS: {domain}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {/* Add Record Form */}
          <div className="mb-8">
            <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Adicionar Registo DNS
            </h3>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Nome</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                  placeholder="www ou @ para raiz"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Tipo</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                >
                  {recordTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Valor</label>
                <input
                  type="text"
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                  placeholder="IP ou domínio"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Prioridade (MX)</label>
                <input
                  type="number"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 10 })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                  disabled={formData.type !== 'MX'}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">TTL</label>
                <input
                  type="number"
                  value={formData.ttl}
                  onChange={(e) => setFormData({ ...formData, ttl: parseInt(e.target.value) || 3600 })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex items-end">
                <Button
                  type="submit"
                  disabled={isAdding || !formData.name || !formData.value}
                  className="bg-blue-600 hover:bg-blue-700 text-white w-full"
                >
                  {isAdding ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      A adicionar...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      Adicionar
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>

          {/* Existing Records */}
          <div>
            <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
              <Globe className="w-5 h-5" />
              Registos Existentes
            </h3>
            {records.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Globe className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum registo DNS encontrado</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-300">Nome</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-300">Tipo</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-300">Valor</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-300">Prioridade</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-300">TTL</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-300">Acções</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((record, index) => (
                      <tr key={index} className="border-b border-gray-800 hover:bg-gray-800/50">
                        <td className="py-3 px-4 text-sm text-white">{record.name}</td>
                        <td className="py-3 px-4 text-sm text-white">
                          <span className="px-2 py-1 bg-blue-600/20 text-blue-400 rounded text-xs font-medium">
                            {record.type}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-white">{record.value}</td>
                        <td className="py-3 px-4 text-sm text-gray-400">
                          {record.type === 'MX' ? record.priority || '-' : '-'}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-400">{record.ttl || 3600}</td>
                        <td className="py-3 px-4">
                          <Button
                            onClick={() => handleDelete(record.id || index.toString())}
                            className="bg-red-600 hover:bg-red-700 text-white p-2"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
