'use client'

import React, { useState } from 'react'
import type { DirectAdminWebsite } from '@/lib/directadmin-api'
import { RefreshCw } from 'lucide-react'
import { getServerHost } from '@/lib/server-config'

type DNSFilterType = 'All' | 'A' | 'CNAME' | 'MX' | 'TXT' | 'SRV' | 'NS'

type DNSRecordRow = {
  id: string
  name: string
  type: string
  content: string
  ttl: number
}

type DNSFormState = {
  name: string
  type: string
  value: string
  ttl: string
  priority?: string
}

export function DNSZoneEditorSection({ sites }: { sites: DirectAdminWebsite[] }) {
  const [selectedDomain, setSelectedDomain] = useState('')
  const [records, setRecords] = useState<DNSRecordRow[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<DNSFilterType>('All')
  const [search, setSearch] = useState('')
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<DNSFormState | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newRecord, setNewRecord] = useState<DNSFormState>({
    name: '',
    type: 'A',
    value: '',
    ttl: '14400',
    priority: '10',
  })
  const [msg, setMsg] = useState('')
  const [page, setPage] = useState(1)
  const perPage = 20
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const typeColors: Record<string, string> = {
    A: 'bg-blue-100 text-blue-800',
    CNAME: 'bg-green-100 text-green-800',
    MX: 'bg-orange-100 text-orange-800',
    TXT: 'bg-purple-100 text-purple-800',
    SRV: 'bg-pink-100 text-pink-800',
    NS: 'bg-gray-100 text-gray-800',
  }

  const loadRecords = async (domain: string) => {
    if (!domain) return
    setLoading(true)
    setMsg('')
    setEditingRecordId(null)
    setEditForm(null)
    setSelectedIds([])
    try {
      const res = await fetch(`/api/directadmin-dns?domain=${encodeURIComponent(domain)}`)
      const json = await res.json()
      if (!res.ok || json.error) {
        setRecords([])
        setMsg(json.error || 'Erro ao carregar os registos DNS.')
        return
      }
      const list = Array.isArray(json.records) ? json.records : []
      setRecords(
        list.map((r: any) => ({
          id: String(r.id),
          name: String(r.name || ''),
          type: String(r.type || '').toUpperCase(),
          content: String(r.content || ''),
          ttl: Number(r.ttl) || 0,
        })),
      )
      setPage(1)
    } catch (e: any) {
      setRecords([])
      setMsg(e?.message || 'Erro inesperado ao carregar registos DNS.')
    } finally {
      setLoading(false)
    }
  }

  const handleDomainChange = (domain: string) => {
    setSelectedDomain(domain)
    if (domain) {
      void loadRecords(domain)
    } else {
      setRecords([])
      setSelectedIds([])
      setEditingRecordId(null)
      setEditForm(null)
    }
  }

  const handleFilterChange = (next: DNSFilterType) => {
    setFilter(next)
    setPage(1)
  }

  const handleSearchChange = (value: string) => {
    setSearch(value)
    setPage(1)
  }

  const parseMxContent = (content: string) => {
    const parts = content.trim().split(/\s+/)
    if (parts.length < 2) return { priority: '', value: content.trim() }
    return {
      priority: parts[0],
      value: parts.slice(1).join(' '),
    }
  }

  const handleCreateRecord = async () => {
    if (!selectedDomain || !newRecord.name || !newRecord.type || !newRecord.value) return
    setLoading(true)
    setMsg('')
    try {
      const ttlNumber = parseInt(newRecord.ttl || '14400', 10) || 14400
      const value =
        newRecord.type === 'MX' && newRecord.priority
          ? `${newRecord.priority} ${newRecord.value}`
          : newRecord.value

      const res = await fetch('/api/directadmin-dns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domainName: selectedDomain,
          name: newRecord.name,
          type: newRecord.type,
          value,
          ttl: ttlNumber,
        }),
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        setMsg(json.error || 'Erro ao criar registo DNS.')
      } else {
        setMsg(json.message || 'Registo DNS criado com sucesso.')
        setShowAddForm(false)
        setNewRecord({
          name: '',
          type: 'A',
          value: '',
          ttl: '14400',
          priority: '10',
        })
        void loadRecords(selectedDomain)
      }
    } catch (e: any) {
      setMsg(e?.message || 'Erro inesperado ao criar registo DNS.')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteRecord = async (record: DNSRecordRow) => {
    if (!selectedDomain) return
    if (!confirm(`Remover o registo "${record.name}" (${record.type})?`)) return
    setLoading(true)
    setMsg('')
    try {
      const res = await fetch('/api/directadmin-dns', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domainName: selectedDomain, id: record.id }),
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        setMsg(json.error || 'Erro ao remover registo DNS.')
      } else {
        setMsg(json.message || 'Registo DNS removido com sucesso.')
        void loadRecords(selectedDomain)
      }
    } catch (e: any) {
      setMsg(e?.message || 'Erro inesperado ao remover registo DNS.')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteSelected = async () => {
    if (!selectedDomain || selectedIds.length === 0) return
    if (!confirm(`Remover ${selectedIds.length} registo(s) seleccionado(s)?`)) return
    setLoading(true)
    setMsg('')
    try {
      await Promise.all(
        selectedIds.map(id =>
          fetch('/api/directadmin-dns', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ domainName: selectedDomain, id }),
          }),
        ),
      )
      setMsg('Registos seleccionados removidos com sucesso.')
      setSelectedIds([])
      void loadRecords(selectedDomain)
    } catch (e: any) {
      setMsg(e?.message || 'Erro ao remover registos seleccionados.')
    } finally {
      setLoading(false)
    }
  }

  const startEditRecord = (record: DNSRecordRow) => {
    setEditingRecordId(record.id)
    if (record.type === 'MX') {
      const { priority, value } = parseMxContent(record.content)
      setEditForm({
        name: record.name,
        type: record.type,
        value,
        ttl: String(record.ttl || 14400),
        priority: priority || '10',
      })
    } else {
      setEditForm({
        name: record.name,
        type: record.type,
        value: record.content,
        ttl: String(record.ttl || 14400),
      })
    }
  }

  const cancelEditRecord = () => {
    setEditingRecordId(null)
    setEditForm(null)
  }

  const handleSaveEditRecord = async () => {
    if (!selectedDomain || !editingRecordId || !editForm) return
    if (!editForm.name || !editForm.type || !editForm.value) return
    setLoading(true)
    setMsg('')
    try {
      await fetch('/api/directadmin-dns', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domainName: selectedDomain, id: editingRecordId }),
      })

      const ttlNumber = parseInt(editForm.ttl || '14400', 10) || 14400
      const value =
        editForm.type === 'MX' && editForm.priority
          ? `${editForm.priority} ${editForm.value}`
          : editForm.value

      const res = await fetch('/api/directadmin-dns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domainName: selectedDomain,
          name: editForm.name,
          type: editForm.type,
          value,
          ttl: ttlNumber,
        }),
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        setMsg(json.error || 'Erro ao guardar alterações no registo.')
      } else {
        setMsg(json.message || 'Registo actualizado com sucesso.')
        setEditingRecordId(null)
        setEditForm(null)
        void loadRecords(selectedDomain)
      }
    } catch (e: any) {
      setMsg(e?.message || 'Erro inesperado ao actualizar registo DNS.')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleSelectAllVisible = (checked: boolean, visibleRecords: DNSRecordRow[]) => {
    if (!checked) {
      setSelectedIds(prev => prev.filter(id => !visibleRecords.some(r => r.id === id)))
      return
    }
    const idsToAdd = visibleRecords.map(r => r.id)
    setSelectedIds(prev => Array.from(new Set([...prev, ...idsToAdd])))
  }

  const handleToggleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => (prev.includes(id) ? prev : [...prev, id]))
    } else {
      setSelectedIds(prev => prev.filter(x => x !== id))
    }
  }

  const filters: DNSFilterType[] = ['All', 'A', 'CNAME', 'MX', 'TXT', 'SRV', 'NS']

  const filteredRecords = records.filter(r => {
    if (filter !== 'All' && r.type !== filter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!r.name.toLowerCase().includes(q) && !r.content.toLowerCase().includes(q)) return false
    }
    return true
  })

  const total = filteredRecords.length
  const totalPages = total === 0 ? 1 : Math.ceil(total / perPage)
  const currentPage = Math.min(page, totalPages)
  const startIndex = (currentPage - 1) * perPage
  const endIndex = startIndex + perPage
  const pageRecords = filteredRecords.slice(startIndex, endIndex)
  const displayFrom = total === 0 ? 0 : startIndex + 1
  const displayTo = total === 0 ? 0 : Math.min(endIndex, total)

  const allVisibleSelected = pageRecords.length > 0 && pageRecords.every(r => selectedIds.includes(r.id))

  const handleSaveAll = () => {
    if (selectedDomain) {
      void loadRecords(selectedDomain)
    }
  }

  return (
    <div className="w-full space-y-4">
      {/* LINHA 1: Título apenas */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">DNS Zone Editor</h1>
          {selectedDomain ? (
            <p className="text-gray-500 mt-1">
              Zone records for <span className="font-semibold">&quot;{selectedDomain}&quot;</span>
            </p>
          ) : (
            <p className="text-gray-500 mt-1">Selecione um domínio para gerir os registos DNS.</p>
          )}
        </div>
      </div>

      {/* LINHA 2: Nameservers do domínio como tags cinzentas */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="uppercase font-semibold text-gray-500 mr-1">Nameservers:</span>
        <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 font-mono">
          ns1.contabo.net
        </span>
        <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 font-mono">
          ns2.contabo.net
        </span>
      </div>

      {/* LINHA 3: Filtros por tipo + pesquisa + paginação */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {filters.map(f => (
            <button
              key={f}
              type="button"
              onClick={() => handleFilterChange(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                filter === f ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={e => handleSearchChange(e.target.value)}
              placeholder="Filter by name"
              className="w-full sm:w-64 px-3 py-2.5 border border-gray-300 rounded-lg text-sm pl-3"
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <button
              type="button"
              onClick={() => setPage(1)}
              disabled={currentPage === 1}
              className="px-2 py-1 border border-gray-200 rounded disabled:opacity-40"
            >
              {'<<'}
            </button>
            <button
              type="button"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-2 py-1 border border-gray-200 rounded disabled:opacity-40"
            >
              {'<'}
            </button>
            <span className="px-2">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-2 py-1 border border-gray-200 rounded disabled:opacity-40"
            >
              {'>'}
            </button>
            <button
              type="button"
              onClick={() => setPage(totalPages)}
              disabled={currentPage === totalPages}
              className="px-2 py-1 border border-gray-200 rounded disabled:opacity-40"
            >
              {'>>'}
            </button>
            <span className="ml-2">
              Displaying {displayFrom} to {displayTo} of {total} items
            </span>
          </div>
        </div>
      </div>

      {/* LINHA 4: Botões de acção */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {/* Botão Acções */}
          <div className="relative">
            <button
              type="button"
              disabled={selectedIds.length === 0 || loading}
              onClick={handleDeleteSelected}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 bg-white text-xs font-semibold text-gray-700 disabled:opacity-50"
            >
              Acções
              <span className="text-gray-400 text-[10px]">▼</span>
            </button>
          </div>
          {/* Seletor de domínio */}
          <div className="w-56">
            <select
              value={selectedDomain}
              onChange={e => handleDomainChange(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-xs bg-white"
            >
              <option value="">Seleccione um domínio...</option>
              {sites.map(s => (
                <option key={s.domain} value={s.domain}>
                  {s.domain}
                </option>
              ))}
            </select>
          </div>
        </div>
        {/* Botões Save All Records e Add Record juntos */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSaveAll}
            disabled={loading || !selectedDomain}
            className="inline-flex items-center px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold disabled:opacity-50"
          >
            Save All Records
          </button>
          <button
            type="button"
            onClick={() => setShowAddForm(v => !v)}
            disabled={!selectedDomain}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-semibold disabled:opacity-50"
          >
            + Add Record
          </button>
        </div>
      </div>

      {/* FORMULÁRIO ADICIONAR — aparece quando showAddForm=true */}
      {showAddForm && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          {/* DICA RÁPIDA */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs">
            <p className="font-semibold text-blue-800 mb-1">📧 Para configurar Email (DKIM/SPF/DMARC):</p>
            <ul className="text-blue-700 space-y-0.5 list-disc list-inside">
              <li><strong>DKIM:</strong> Nome: <code>default._domainkey</code> | Tipo: <code>TXT</code></li>
              <li><strong>SPF:</strong> Nome: <code>@</code> | Tipo: <code>TXT</code> | Valor: <code>v=spf1 ip4:{getServerHost()} ~all</code></li>
              <li><strong>DMARC:</strong> Nome: <code>_dmarc</code> | Tipo: <code>TXT</code> | Valor: <code>v=DMARC1; p=quarantine;</code></li>
            </ul>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Nome</label>
              <input
                type="text"
                value={newRecord.name}
                onChange={e => setNewRecord({ ...newRecord, name: e.target.value })}
                placeholder={`sub.${selectedDomain || 'example.com'}`}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">TTL</label>
              <input
                type="number"
                value={newRecord.ttl}
                onChange={e => setNewRecord({ ...newRecord, ttl: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Tipo</label>
              <select
                value={newRecord.type}
                onChange={e =>
                  setNewRecord({
                    ...newRecord,
                    type: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="A">A</option>
                <option value="CNAME">CNAME</option>
                <option value="MX">MX</option>
                <option value="TXT">TXT</option>
                <option value="SRV">SRV</option>
                <option value="NS">NS</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">
                {newRecord.type === 'MX' ? 'Prioridade' : '—'}
              </label>
              {newRecord.type === 'MX' ? (
                <input
                  type="number"
                  value={newRecord.priority}
                  onChange={e => setNewRecord({ ...newRecord, priority: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              ) : (
                <div className="text-xs text-gray-400 mt-2">MX only</div>
              )}
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Valor / Registo</label>
            <input
              type="text"
              value={newRecord.value}
              onChange={e => setNewRecord({ ...newRecord, value: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder={
                newRecord.type === 'A'
                  ? '192.0.2.1'
                  : newRecord.type === 'CNAME' || newRecord.type === 'MX'
                  ? 'mail.example.com'
                  : 'Valor do registo'
              }
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 rounded-lg border border-gray-300 text-xs font-semibold text-gray-700"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={loading || !selectedDomain}
              onClick={handleCreateRecord}
              className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-semibold disabled:opacity-50"
            >
              Guardar
            </button>
          </div>
        </div>
      )}

      {/* TABELA DE REGISTOS */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="py-12 text-center">
            <RefreshCw className="w-8 h-8 animate-spin text-gray-400 mx-auto" />
          </div>
        ) : !selectedDomain ? (
          <div className="py-12 text-center text-gray-400 text-sm">Selecione um domínio para ver os registos.</div>
        ) : pageRecords.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">Nenhum registo encontrado para este filtro.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-bold text-gray-500 uppercase border-b bg-gray-50">
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={e => handleToggleSelectAllVisible(e.target.checked, pageRecords)}
                  />
                </th>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3 w-24">TTL</th>
                <th className="px-4 py-3 w-24">Tipo</th>
                <th className="px-4 py-3 min-w-[200px]">Registo</th>
                <th className="px-4 py-3 w-40">Acções</th>
              </tr>
            </thead>
            <tbody>
              {pageRecords.map(record => {
                const isEditing = editingRecordId === record.id
                const displayContent =
                  record.type === 'MX'
                    ? (() => {
                        const { priority, value } = parseMxContent(record.content)
                        return `Prioridade: ${priority || '-'} / Destino: ${value || '-'}`
                      })()
                    : record.content
                return (
                  <React.Fragment key={record.id}>
                    <tr className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3 align-top">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(record.id)}
                          onChange={e => handleToggleSelectOne(record.id, e.target.checked)}
                        />
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="font-medium text-gray-900 break-all">{record.name}</div>
                      </td>
                      <td className="px-4 py-3 align-top text-gray-600">{record.ttl || 0}</td>
                      <td className="px-4 py-3 align-top">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                            typeColors[record.type] || 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {record.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top text-gray-700 break-all">{displayContent}</td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => startEditRecord(record)}
                            className="text-blue-600 hover:text-blue-800 text-xs font-bold"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRecord(record)}
                            className="text-red-600 hover:text-red-800 text-xs font-bold"
                          >
                            Remover
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isEditing && editForm && (
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <td />
                        <td colSpan={5} className="px-4 py-4">
                          <div className="space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                              <div>
                                <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Nome</label>
                                <input
                                  type="text"
                                  value={editForm.name}
                                  onChange={e => setEditForm({ ...(editForm || newRecord), name: e.target.value })}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                />
                              </div>
                              <div>
                                <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">TTL</label>
                                <input
                                  type="number"
                                  value={editForm.ttl}
                                  onChange={e => setEditForm({ ...(editForm || newRecord), ttl: e.target.value })}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                />
                              </div>
                              <div>
                                <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Tipo</label>
                                <select
                                  value={editForm.type}
                                  onChange={e =>
                                    setEditForm({
                                      ...(editForm || newRecord),
                                      type: e.target.value,
                                    })
                                  }
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                >
                                  <option value="A">A</option>
                                  <option value="CNAME">CNAME</option>
                                  <option value="MX">MX</option>
                                  <option value="TXT">TXT</option>
                                  <option value="SRV">SRV</option>
                                  <option value="NS">NS</option>
                                </select>
                              </div>
                              <div>
                                <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">
                                  {editForm.type === 'MX' ? 'Prioridade' : '—'}
                                </label>
                                {editForm.type === 'MX' ? (
                                  <input
                                    type="number"
                                    value={editForm.priority || ''}
                                    onChange={e =>
                                      setEditForm({
                                        ...(editForm || newRecord),
                                        priority: e.target.value,
                                      })
                                    }
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                  />
                                ) : (
                                  <div className="text-xs text-gray-400 mt-2">MX only</div>
                                )}
                              </div>
                            </div>
                            <div>
                              <label className="text-xs font-bold text-gray-600 uppercase block mb-1.5">
                                Valor / Registo
                              </label>
                              <input
                                type="text"
                                value={editForm.value}
                                onChange={e => setEditForm({ ...(editForm || newRecord), value: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                              />
                            </div>
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={cancelEditRecord}
                                className="px-4 py-2 rounded-lg border border-gray-300 text-xs font-semibold text-gray-700"
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                disabled={loading}
                                onClick={handleSaveEditRecord}
                                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold disabled:opacity-50"
                              >
                                Guardar
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {msg && (
        <div
          className={`px-4 py-2.5 rounded-lg text-sm font-medium ${
            msg.toLowerCase().includes('erro')
              ? 'bg-red-50 text-red-700 border border-red-200'
              : 'bg-green-50 text-green-700 border border-green-200'
          }`}
        >
          {msg}
        </div>
      )}
    </div>
  )
}

