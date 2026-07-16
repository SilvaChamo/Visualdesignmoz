'use client'

import { useEffect, useState } from 'react'
import { Server, Loader2, CheckCircle2, XCircle, Trash2, PauseCircle, PlayCircle } from 'lucide-react'

type NativeSite = {
  domain: string
  status: string
  owner: string
  php: string
  ssl: boolean
  packageId: string
  packageLabel: string
  quotaMb: number
  quotaEnforced: boolean
}

type NativePackage = { id: string; label: string; quotaMb: number }

const FALLBACK_PACKAGES: NativePackage[] = [
  { id: 'hosting-basico', label: 'Básico', quotaMb: 10000 },
  { id: 'hosting-pro', label: 'Profissional', quotaMb: 20000 },
  { id: 'hosting-business', label: 'Business', quotaMb: 30000 },
  { id: 'hosting-enterprise', label: 'Enterprise', quotaMb: 40000 },
]

function formatQuota(mb: number): string {
  if (mb >= 1000) return `${(mb / 1000).toFixed(mb % 1000 === 0 ? 0 : 1)} GB`
  return `${mb} MB`
}

/**
 * Secção de teste do motor de hospedagem NATIVO (fora da DirectAdmin).
 * Não está ligada ao checkout público — é só para testares manualmente
 * antes de confiarmos nisto para clientes a sério.
 */
export function NativeHostingSection() {
  const [sites, setSites] = useState<NativeSite[]>([])
  const [packages, setPackages] = useState<NativePackage[]>(FALLBACK_PACKAGES)
  const [loading, setLoading] = useState(true)
  const [domain, setDomain] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [packageId, setPackageId] = useState('hosting-basico')
  const [creating, setCreating] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string; details?: any } | null>(null)
  const [changingPackageFor, setChangingPackageFor] = useState<string | null>(null)

  const loadSites = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/site-manager?action=list')
      const data = await res.json()
      setSites(data.sites || [])
      if (Array.isArray(data.packages) && data.packages.length) setPackages(data.packages)
    } catch {
      setSites([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSites()
  }, [])

  const handleCreate = async () => {
    if (!domain.trim()) return
    setCreating(true)
    setResult(null)
    try {
      const res = await fetch('/api/site-manager', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', domain: domain.trim(), ownerEmail: ownerEmail.trim(), packageId }),
      })
      const data = await res.json()
      if (data.success) {
        setResult({ ok: true, message: `Conta criada: ${data.domain} (utilizador ${data.linuxUsername}, pacote ${data.packageLabel})${data.warning ? ' — ' + data.warning : ''}`, details: data })
        setDomain('')
        setOwnerEmail('')
        loadSites()
      } else {
        setResult({ ok: false, message: data.error || 'Falha desconhecida', details: data })
      }
    } catch (err: any) {
      setResult({ ok: false, message: err?.message || 'Erro de rede' })
    } finally {
      setCreating(false)
    }
  }

  const handleChangePackage = async (targetDomain: string, newPackageId: string) => {
    setChangingPackageFor(targetDomain)
    try {
      const res = await fetch('/api/site-manager', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setPackage', domain: targetDomain, packageId: newPackageId }),
      })
      const data = await res.json()
      if (data.success) {
        setResult({ ok: true, message: `Pacote de ${targetDomain} atualizado para ${data.packageLabel}.${data.warning ? ' — ' + data.warning : ''}` })
        loadSites()
      } else {
        setResult({ ok: false, message: data.error || 'Falha ao mudar o pacote' })
      }
    } catch (err: any) {
      setResult({ ok: false, message: err?.message || 'Erro de rede' })
    } finally {
      setChangingPackageFor(null)
    }
  }

  const handleAction = async (targetDomain: string, action: 'suspend' | 'unsuspend' | 'delete') => {
    if (action === 'delete' && !confirm(`Apagar mesmo "${targetDomain}"? Os ficheiros do site ficam preservados por defeito.`)) return
    try {
      await fetch('/api/site-manager', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, domain: targetDomain, deleteFiles: false }),
      })
      loadSites()
    } catch {
      /* silencioso — a lista recarrega e mostra o estado real */
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-amber-50 border border-amber-300 text-amber-800 text-sm rounded p-4">
        <strong>Modo de teste.</strong> Isto cria contas a sério no servidor (utilizador Linux + site Apache + SSL), fora
        da DirectAdmin — mas ainda não está ligado ao checkout público. Usa só para testares.
      </div>

      <div className="bg-white rounded shadow-sm border border-gray-200 p-6">
        <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Server className="w-5 h-5 text-gray-600" /> Criar conta nativa (teste)
        </h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="dominio-de-teste.com"
            className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm"
          />
          <input
            type="email"
            value={ownerEmail}
            onChange={(e) => setOwnerEmail(e.target.value)}
            placeholder="email do dono (opcional)"
            className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm"
          />
          <select
            value={packageId}
            onChange={(e) => setPackageId(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 text-sm"
          >
            {packages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label} ({formatQuota(p.quotaMb)})
              </option>
            ))}
          </select>
          <button
            onClick={handleCreate}
            disabled={creating || !domain.trim()}
            className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-5 py-2 rounded text-sm font-bold flex items-center justify-center gap-2 whitespace-nowrap"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Server className="w-4 h-4" />}
            Criar conta
          </button>
        </div>

        {result && (
          <div className={`mt-4 rounded p-3 text-sm flex items-start gap-2 ${result.ok ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
            {result.ok ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 shrink-0 mt-0.5" />}
            <span>{result.message}</span>
          </div>
        )}
      </div>

      <div className="bg-white rounded shadow-sm border border-gray-200 p-6">
        <h3 className="font-bold text-gray-900 mb-4">Contas nativas existentes</h3>
        {loading ? (
          <p className="text-sm text-gray-500">A carregar…</p>
        ) : sites.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma conta nativa criada ainda.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2">Domínio</th>
                <th className="py-2">Estado</th>
                <th className="py-2">SSL</th>
                <th className="py-2">Pacote</th>
                <th className="py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {sites.map((s) => (
                <tr key={s.domain} className="border-b last:border-0">
                  <td className="py-2 font-mono">{s.domain}</td>
                  <td className="py-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${s.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="py-2">{s.ssl ? '✅' : '—'}</td>
                  <td className="py-2">
                    <select
                      value={s.packageId}
                      disabled={changingPackageFor === s.domain}
                      onChange={(e) => handleChangePackage(s.domain, e.target.value)}
                      className="border border-gray-300 rounded px-2 py-1 text-xs disabled:opacity-50"
                      title={s.quotaEnforced ? 'Limite de disco bloqueado a sério' : 'Limite de disco só registado (sem bloqueio real)'}
                    >
                      {packages.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label} ({formatQuota(p.quotaMb)})
                        </option>
                      ))}
                    </select>
                    {!s.quotaEnforced && <span className="ml-1 text-amber-600 text-xs" title="Sem bloqueio real de disco">⚠</span>}
                  </td>
                  <td className="py-2 text-right space-x-2">
                    {s.status === 'active' ? (
                      <button onClick={() => handleAction(s.domain, 'suspend')} className="text-amber-600 hover:text-amber-800" title="Suspender">
                        <PauseCircle className="w-4 h-4 inline" />
                      </button>
                    ) : (
                      <button onClick={() => handleAction(s.domain, 'unsuspend')} className="text-green-600 hover:text-green-800" title="Reativar">
                        <PlayCircle className="w-4 h-4 inline" />
                      </button>
                    )}
                    <button onClick={() => handleAction(s.domain, 'delete')} className="text-red-600 hover:text-red-800" title="Apagar">
                      <Trash2 className="w-4 h-4 inline" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
