'use client'

import { useEffect, useState } from 'react'
import {
  Globe, Cloud, Lock, LockOpen, RefreshCw, Key, Copy, Calendar,
  Mail, ExternalLink, Trash2, CheckCircle, XCircle, ShieldCheck, ShieldAlert,
  ChevronDown, ChevronRight, ArrowRightLeft, Plus, PlusCircle,
} from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { panelBtnPrimary, panelBtnSecondary, panelField } from '@/lib/panel-ui'
import type { DirectAdminWebsite } from '@/lib/directadmin-api'
import { NameserverManagementSection } from './HostingSections'

type RegistrarInfo = {
  isLocked: boolean | null
  autoRenew: boolean | null
  expireDate: string
  registrationDate: string
  status: string
  nameservers: string[]
  privacyEnabled: boolean | null
  dnssecEnabled: boolean | null
}

type HealthCheck = { ok: boolean; detail: string }
type HealthResult = { dns: HealthCheck; server: HealthCheck; ssl: HealthCheck } | null

type RenewalInfo = {
  registrationDate?: string
  expirationDate?: string
  renewalPrice?: number
  currency?: string
} | null

interface Props {
  domain: string
  sites: DirectAdminWebsite[]
  onNavigate?: (section: string, opts?: { domain?: string }) => void
  onRefresh?: () => void | Promise<void>
  setActiveSection?: (section: string) => void
  /** Painel do cliente: esconde acções destrutivas/staff-only (eliminar domínio, redireccionamentos via server-exec). */
  clientMode?: boolean
}

const getDaysUntilExpiration = (dateStr: string): number | null => {
  const exp = new Date(dateStr)
  if (Number.isNaN(exp.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  exp.setHours(0, 0, 0, 0)
  return Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

const formatDateLabel = (dateStr?: string): string => {
  if (!dateStr) return '—'
  const parsed = new Date(dateStr)
  if (Number.isNaN(parsed.getTime())) return dateStr
  return parsed.toLocaleDateString('pt-PT')
}

export function DomainDetailSection({ domain, sites, onNavigate, onRefresh, setActiveSection, clientMode }: Props) {
  const site = sites.find((s) => s.domain?.toLowerCase() === domain?.toLowerCase())
  const isHostingActive = (site?.state || site?.status || 'Active') !== 'Suspended'

  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState<'success' | 'error'>('success')
  const showMsg = (text: string, type: 'success' | 'error' = 'success') => {
    setMsg(text)
    setMsgType(type)
    setTimeout(() => setMsg(''), 4000)
  }

  const [registrarLoading, setRegistrarLoading] = useState(false)
  const [registrar, setRegistrar] = useState<RegistrarInfo>({ isLocked: null, autoRenew: null, expireDate: '', registrationDate: '', status: '', nameservers: [], privacyEnabled: null, dnssecEnabled: null })
  const [authCode, setAuthCode] = useState('')
  const [authCodeExpires, setAuthCodeExpires] = useState('')

  const [healthLoading, setHealthLoading] = useState(false)
  const [health, setHealth] = useState<HealthResult>(null)

  const [renewal, setRenewal] = useState<RenewalInfo>(null)

  const [pointerOpen, setPointerOpen] = useState(false)
  const [pointerLoading, setPointerLoading] = useState(false)
  const [pointers, setPointers] = useState<string[]>([])
  const [pointerFrom, setPointerFrom] = useState('')
  const [pointerSaving, setPointerSaving] = useState(false)

  // #24: domínios comprados antes das chaves da Cloudflare estarem no servidor
  // ficaram registados mas sem zona/nameservers configurados — este botão
  // corre outra vez a mesma automação do checkout, passo a passo.
  const [reprovisionLoading, setReprovisionLoading] = useState(false)
  const [reprovisionSteps, setReprovisionSteps] = useState<{ step: string; ok: boolean; error?: string }[] | null>(null)

  // #20 — desfazer a associação a uma conta de hospedagem (só o registo no painel).
  const [detachingHosting, setDetachingHosting] = useState(false)
  const handleDetachHosting = async () => {
    if (!domain || !confirm(`Remover a associação de "${domain}" a esta conta de hospedagem? Só o registo no painel muda — a conta e o site no servidor ficam intactos.`)) return
    setDetachingHosting(true)
    try {
      const res = await fetch('/api/admin/domains/attach-hosting', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ domain }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.success) {
        showMsg(data.message || 'Associação removida.')
        await onRefresh?.()
      } else {
        showMsg(data.error || 'Erro ao remover associação', 'error')
      }
    } catch (e: unknown) {
      showMsg(e instanceof Error ? e.message : 'Erro de ligação', 'error')
    } finally {
      setDetachingHosting(false)
    }
  }

  const loadRegistrarInfo = async () => {
    if (!domain) return
    setRegistrarLoading(true)
    try {
      const res = await fetch(`/api/registrar/domain/manage?domain=${encodeURIComponent(domain)}`, {
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (data.success) {
        const ns = Array.isArray(data.nameservers) ? data.nameservers : []
        setRegistrar({
          isLocked: typeof data.isLocked === 'boolean' ? data.isLocked : null,
          autoRenew: typeof data.autoRenew === 'boolean' ? data.autoRenew : null,
          expireDate: data.expireDate || '',
          registrationDate: data.registrationDate || '',
          status: data.status || '',
          nameservers: ns,
          privacyEnabled: typeof data.privacyEnabled === 'boolean' ? data.privacyEnabled : null,
          dnssecEnabled: typeof data.dnssecEnabled === 'boolean' ? data.dnssecEnabled : null,
        })
      }
    } catch {
      /* domínio pode ser só de hospedagem, sem registo neste registador */
    } finally {
      setRegistrarLoading(false)
    }
  }

  const loadHealth = async () => {
    if (!domain) return
    setHealthLoading(true)
    try {
      const res = await fetch(`/api/registrar/domain/health?domain=${encodeURIComponent(domain)}`, {
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (data.success) {
        setHealth({ dns: data.dns, server: data.server, ssl: data.ssl })
      } else {
        setHealth(null)
      }
    } catch {
      setHealth(null)
    } finally {
      setHealthLoading(false)
    }
  }

  const loadRenewalInfo = async () => {
    if (!domain) return
    try {
      const res = await fetch('/api/renewals?type=domain', { credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (data.success) {
        const row = (data.domains || []).find(
          (r: { domain_name?: string }) => r.domain_name?.toLowerCase() === domain.toLowerCase(),
        )
        if (row) {
          setRenewal({
            registrationDate: row.registration_date,
            expirationDate: row.expiration_date,
            renewalPrice: row.renewal_price,
            currency: row.currency,
          })
        }
      }
    } catch {
      /* sem dados de renovação para este domínio */
    }
  }

  useEffect(() => {
    setRegistrar({ isLocked: null, autoRenew: null, expireDate: '', registrationDate: '', status: '', nameservers: [], privacyEnabled: null, dnssecEnabled: null })
    setAuthCode('')
    setAuthCodeExpires('')
    setHealth(null)
    setRenewal(null)
    void loadRegistrarInfo()
    void loadHealth()
    void loadRenewalInfo()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domain])

  const handleReprovision = async () => {
    if (!domain) return
    setReprovisionLoading(true)
    setReprovisionSteps(null)
    try {
      const res = await fetch('/api/admin/domains/reprovision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ domain }),
      })
      const data = await res.json().catch(() => ({}))
      if (data.success) {
        setReprovisionSteps(data.result?.steps || [])
        const base = data.dnsOk ? 'Configuração concluída.' : 'Alguns passos ainda falharam — ver detalhe abaixo.'
        showMsg(data.hint ? `${base} ${data.hint}` : base, data.dnsOk ? 'success' : 'error')
      } else {
        showMsg(data.error || 'Erro ao reprocessar configuração', 'error')
      }
    } catch (e: unknown) {
      showMsg(e instanceof Error ? e.message : 'Erro de ligação', 'error')
    } finally {
      setReprovisionLoading(false)
    }
  }

  const handleToggleLock = async () => {
    if (registrar.isLocked === null) return
    const wantLock = !registrar.isLocked
    setRegistrarLoading(true)
    try {
      const res = await fetch('/api/registrar/domain/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ domain, action: wantLock ? 'lock' : 'unlock' }),
      })
      const data = await res.json()
      if (data.success) {
        setRegistrar((prev) => ({ ...prev, isLocked: wantLock }))
        showMsg(data.message || (wantLock ? 'Domínio bloqueado para transferência.' : 'Domínio desbloqueado para transferência.'))
      } else {
        showMsg(data.error || 'Erro ao alterar bloqueio', 'error')
      }
    } catch (e: unknown) {
      showMsg(e instanceof Error ? e.message : 'Erro de ligação', 'error')
    } finally {
      setRegistrarLoading(false)
    }
  }

  const handleFetchAuthCode = async () => {
    setRegistrarLoading(true)
    try {
      const res = await fetch('/api/registrar/domain/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ domain, action: 'auth-code' }),
      })
      const data = await res.json()
      if (data.success && data.authCode) {
        setAuthCode(data.authCode)
        setAuthCodeExpires(data.expires || '')
        showMsg(data.message || 'Código obtido.')
      } else {
        showMsg(data.error || 'Erro ao obter código', 'error')
      }
    } catch (e: unknown) {
      showMsg(e instanceof Error ? e.message : 'Erro de ligação', 'error')
    } finally {
      setRegistrarLoading(false)
    }
  }

  const handleToggleAutoRenew = async () => {
    if (registrar.autoRenew === null) return
    const next = !registrar.autoRenew
    setRegistrarLoading(true)
    try {
      const res = await fetch('/api/registrar/domain/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ domain, action: 'autorenew', isEnabled: next }),
      })
      const data = await res.json()
      if (data.success) {
        setRegistrar((prev) => ({ ...prev, autoRenew: next }))
        showMsg(data.message || (next ? 'Renovação automática activada.' : 'Renovação automática desactivada.'))
      } else {
        showMsg(data.error || 'Erro ao actualizar renovação automática', 'error')
      }
    } catch (e: unknown) {
      showMsg(e instanceof Error ? e.message : 'Erro de ligação', 'error')
    } finally {
      setRegistrarLoading(false)
    }
  }

  const loadPointers = async () => {
    if (!domain) return
    setPointerLoading(true)
    try {
      const res = await fetch('/api/server-exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'listDomainPointers', params: { domain } }),
      })
      const data = await res.json()
      if (data.success) setPointers(Array.isArray(data.data) ? data.data : [])
    } catch {
      /* lista fica vazia — sem espelho para isto, é sempre pedido ao vivo */
    } finally {
      setPointerLoading(false)
    }
  }

  const togglePointerPanel = () => {
    const next = !pointerOpen
    setPointerOpen(next)
    if (next && pointers.length === 0) void loadPointers()
  }

  const handleAddPointer = async () => {
    const from = pointerFrom.trim().toLowerCase()
    if (!from) return
    setPointerSaving(true)
    try {
      const res = await fetch('/api/server-exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'addDomainPointer', params: { domain, from } }),
      })
      const data = await res.json()
      if (data.success) {
        showMsg(`"${from}" passa a redireccionar para "${domain}".`)
        setPointerFrom('')
        await loadPointers()
      } else {
        showMsg(data.error || 'Erro ao criar redireccionamento', 'error')
      }
    } catch (e: unknown) {
      showMsg(e instanceof Error ? e.message : 'Erro de ligação', 'error')
    } finally {
      setPointerSaving(false)
    }
  }

  const handleDeletePointer = async (from: string) => {
    if (!confirm(`Remover o redireccionamento de "${from}"?`)) return
    try {
      const res = await fetch('/api/server-exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deleteDomainPointer', params: { domain, from } }),
      })
      const data = await res.json()
      if (data.success) {
        showMsg(`Redireccionamento de "${from}" removido.`)
        await loadPointers()
      } else {
        showMsg(data.error || 'Erro ao remover redireccionamento', 'error')
      }
    } catch (e: unknown) {
      showMsg(e instanceof Error ? e.message : 'Erro de ligação', 'error')
    }
  }

  const handleRemoveHosting = async () => {
    if (!confirm(`Eliminar "${domain}"? Esta acção é irreversível!`)) return
    try {
      // Provider-aware (DirectAdmin/Hestia) — /api/server-exec só sabia falar
      // com o DirectAdmin, o que falhava sempre em silêncio para contas
      // Hestia (o domínio nem existe do lado do DirectAdmin).
      const res = await fetch('/api/admin/domains/delete-website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ domain }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.success) {
        showMsg(data.message || `Domínio "${domain}" eliminado.`)
        await onRefresh?.()
        setActiveSection?.('domain-manager')
      } else {
        showMsg('Erro: ' + (data.error || 'Falha ao eliminar'), 'error')
      }
    } catch (e: unknown) {
      showMsg(e instanceof Error ? e.message : 'Erro de ligação', 'error')
    }
  }

  if (!domain) {
    return (
      <div className="p-6 text-center text-sm text-gray-500 dark:text-zinc-400">
        Nenhum domínio seleccionado.
      </div>
    )
  }

  const registrationDate = registrar.registrationDate || renewal?.registrationDate || ''
  const expireDate = registrar.expireDate || renewal?.expirationDate || ''
  const daysRemaining = expireDate ? getDaysUntilExpiration(expireDate) : null
  const allHealthy = health ? health.dns.ok && health.server.ok && health.ssl.ok : false

  return (
    <div className="w-full space-y-5 p-5">
      {msg && (
        <div
          className={`rounded border px-4 py-2.5 text-sm font-medium ${
            msgType === 'success'
              ? 'border-gray-200 bg-gray-50 text-gray-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
              : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400'
          }`}
        >
          {msg}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-green-50 rounded-lg dark:bg-green-950/40">
            <Globe className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-zinc-100">{domain}</h2>
          <span
            className={`px-3 py-1 rounded text-xs font-bold uppercase tracking-wider ${
              isHostingActive
                ? 'bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400'
                : 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400'
            }`}
          >
            Status: {isHostingActive ? 'Activo' : 'Suspenso'}
          </span>
        </div>
        {!clientMode && (
          <button
            type="button"
            onClick={() => void handleReprovision()}
            disabled={reprovisionLoading}
            title="Reprocessar Configuração DNS (Cloudflare/nameservers)"
            className="flex items-center gap-1.5 rounded border border-red-300 bg-red-50 px-3 py-1 text-xs font-bold text-red-600 hover:bg-red-100 disabled:opacity-50 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400"
          >
            {reprovisionLoading ? <Spinner className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Reprocessar DNS
          </button>
        )}
      </div>

      <div className="grid w-full grid-cols-1 gap-4 lg:grid-cols-[1fr_242px]">
        <div className="space-y-4">
          <div className="rounded border border-gray-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded border border-gray-100 bg-gray-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
                <p className="text-xs text-gray-500 dark:text-zinc-400">Data de Registo</p>
                <p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-gray-900 dark:text-zinc-100">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  {formatDateLabel(registrationDate)}
                </p>
              </div>
              <div className="rounded border border-gray-100 bg-gray-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
                <p className="text-xs text-gray-500 dark:text-zinc-400">Próximo Vencimento</p>
                <p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-gray-900 dark:text-zinc-100">
                  <Calendar className="h-4 w-4 text-red-400" />
                  {formatDateLabel(expireDate)}
                </p>
                {daysRemaining !== null && (
                  <p className="mt-0.5 text-xs text-red-500">{daysRemaining} dias restantes</p>
                )}
              </div>
              {site && (
                <div className="rounded border border-gray-100 bg-gray-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
                  <p className="text-xs text-gray-500 dark:text-zinc-400">Pacote</p>
                  <p className="mt-1 text-sm font-bold text-gray-900 dark:text-zinc-100">{site.package || '—'}</p>
                </div>
              )}
              {site && (
                <div className="rounded border border-gray-100 bg-gray-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
                  <p className="text-xs text-gray-500 dark:text-zinc-400">Conta de Hospedagem</p>
                  <p className="mt-1 truncate font-mono text-sm font-bold text-gray-900 dark:text-zinc-100" title={site.owner || undefined}>
                    {site.owner || '—'}
                  </p>
                  {site.owner && !clientMode && (
                    <button
                      type="button"
                      onClick={() => void handleDetachHosting()}
                      disabled={detachingHosting}
                      className="mt-1 text-xs font-semibold text-red-600 hover:underline disabled:opacity-50"
                      title="Remove só a associação no painel — não apaga a conta nem o site no servidor."
                    >
                      {detachingHosting ? 'A remover…' : 'Remover associação'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="rounded border border-gray-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-900 dark:text-zinc-100">Diagnóstico de conectividade</h3>
              <button
                type="button"
                onClick={() => void loadHealth()}
                disabled={healthLoading}
                className="flex items-center gap-1.5 text-xs font-bold text-gray-600 hover:text-red-600 disabled:opacity-50 dark:text-zinc-400 dark:hover:text-red-400"
              >
                {healthLoading ? <Spinner className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Reavaliar
              </button>
            </div>

            {healthLoading && !health ? (
              <div className="py-6 text-center">
                <Spinner className="mx-auto h-6 w-6" />
              </div>
            ) : health ? (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {[
                    { key: 'dns', label: 'Mapeamento DNS', ok: health.dns.ok, detail: health.dns.ok ? 'Resolvendo' : health.dns.detail },
                    { key: 'server', label: 'Resposta do Servidor', ok: health.server.ok, detail: health.server.ok ? 'Activo / Responde' : health.server.detail },
                    { key: 'ssl', label: 'Criptografia SSL', ok: health.ssl.ok, detail: health.ssl.ok ? 'Configurado' : health.ssl.detail },
                  ].map((row) => (
                    <div key={row.key} className="flex items-center gap-2.5 rounded border border-gray-100 p-3 dark:border-zinc-800">
                      {row.ok ? (
                        <CheckCircle className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
                      ) : (
                        <XCircle className="h-4 w-4 shrink-0 text-red-500" />
                      )}
                      <div className="min-w-0">
                        <p className="text-xs text-gray-500 dark:text-zinc-400">{row.label}</p>
                        <p className={`truncate text-xs font-bold ${row.ok ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {row.detail}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <div
                  className={`mt-3 rounded px-4 py-2.5 text-sm font-medium ${
                    allHealthy
                      ? 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400'
                      : 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400'
                  }`}
                >
                  {allHealthy
                    ? `Tudo certo! O domínio ${domain} passou em todos os testes de conectividade (DNS, HTTP e criptografia SSL).`
                    : 'Foram encontrados problemas de conectividade — reveja os testes acima.'}
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-400 dark:text-zinc-500">Não foi possível avaliar a conectividade agora.</p>
            )}
          </div>

          {!clientMode && (
            <div className="rounded border border-gray-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
              <h3 className="mb-3 text-sm font-bold text-gray-900 dark:text-zinc-100">Nameservers</h3>
              {registrar.isLocked === null ? (
                // Sem dados do registador (ex.: domínio não encontrado na Dynadot,
                // registado noutro sítio fora do nosso controlo) — mostrar a
                // selecção "DNS predefinido Visual Design" pré-marcada aqui seria
                // afirmar algo que não confirmámos. Confirmado ao vivo 1 set:
                // o utilizador via sempre essa opção marcada mesmo em domínios
                // já apontados para a Cloudflare, só porque currentNameservers
                // vinha vazio (não por os nameservers serem mesmo os nossos).
                <p className="text-sm text-gray-400 dark:text-zinc-500">
                  {registrarLoading
                    ? 'A verificar…'
                    : 'Não disponível — domínio não encontrado no registador (pode estar registado noutro sítio). Não é possível confirmar os nameservers reais aqui.'}
                </p>
              ) : (
                <NameserverManagementSection
                  sites={sites}
                  initialDomain={domain}
                  lockDomain
                  currentNameservers={registrar.nameservers}
                  onChanged={() => void loadRegistrarInfo()}
                />
              )}
            </div>
          )}

          <div className="rounded border border-gray-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
            <p className="mb-4 text-xs text-gray-500 dark:text-zinc-500">Gestão de registo e transferência</p>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded border border-gray-100 p-4 dark:border-zinc-800">
                <p className="text-sm font-medium text-gray-900 dark:text-zinc-100">Bloqueio de transferência</p>
                <p className="mb-3 text-xs text-gray-500 dark:text-zinc-500">
                  {registrar.isLocked === null
                    ? registrarLoading
                      ? 'A verificar…'
                      : 'Não disponível — domínio não encontrado no registador.'
                    : registrar.isLocked
                      ? 'Bloqueado — desbloqueie antes de transferir'
                      : 'Desbloqueado — pronto para transferência'}
                </p>
                <button
                  type="button"
                  onClick={() => void handleToggleLock()}
                  disabled={registrarLoading || registrar.isLocked === null}
                  className={`inline-flex items-center gap-2 rounded px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${
                    registrar.isLocked === null
                      ? 'bg-gray-100 text-gray-400 dark:bg-zinc-800 dark:text-zinc-500'
                      : registrar.isLocked
                        ? 'bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-950/30 dark:text-green-400 dark:hover:bg-green-950/50'
                        : 'bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/50'
                  }`}
                >
                  {registrarLoading ? (
                    <Spinner className="h-4 w-4" />
                  ) : registrar.isLocked === null ? (
                    <Lock className="h-4 w-4" />
                  ) : registrar.isLocked ? (
                    <Lock className="h-4 w-4" />
                  ) : (
                    <LockOpen className="h-4 w-4" />
                  )}
                  {registrar.isLocked === null ? '—' : registrar.isLocked ? 'Desbloquear' : 'Bloquear'}
                </button>
              </div>

              <div className="rounded border border-gray-100 p-4 dark:border-zinc-800">
                <p className="mb-2 text-sm font-medium text-gray-900 dark:text-zinc-100">Código de transferência (EPP)</p>
                <p className="mb-3 text-xs text-gray-500 dark:text-zinc-500">
                  Obtenha o código sem sair desta página e use-o no novo registador.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => void handleFetchAuthCode()} disabled={registrarLoading} className={panelBtnPrimary}>
                    {registrarLoading ? <Spinner className="h-4 w-4" /> : <Key className="h-4 w-4" />}
                    Obter código
                  </button>
                  {authCode && (
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(authCode)
                        showMsg('Código copiado.')
                      }}
                      className={panelBtnSecondary}
                    >
                      <Copy className="h-4 w-4" /> Copiar
                    </button>
                  )}
                </div>
                {authCode && (
                  <div className="mt-3 rounded border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-sm text-gray-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                    {authCode}
                    {authCodeExpires && (
                      <p className="mt-1 font-sans text-xs text-gray-500 dark:text-zinc-500">
                        Expira: {new Date(authCodeExpires).toLocaleString('pt-PT')}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {site && !clientMode && (
            <div className="rounded border border-gray-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
              <p className="mb-3 text-xs font-bold uppercase text-gray-500 dark:text-zinc-500">Zona perigosa</p>
              <button
                type="button"
                onClick={() => void handleRemoveHosting()}
                className={`${panelBtnSecondary} border-red-300 text-red-600 hover:text-red-600 dark:border-red-800 dark:text-red-400`}
              >
                <Trash2 className="h-4 w-4" /> Eliminar domínio de hospedagem
              </button>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded border border-gray-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
            <div className="border-b border-gray-100 px-4 py-3 dark:border-zinc-800">
              <h3 className="text-xs font-bold uppercase text-gray-500 dark:text-zinc-500">Gerenciar</h3>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-zinc-800">
              {registrar.isLocked !== null && (
                <div
                  className="flex w-full items-center gap-3 px-4 py-3 text-sm text-gray-700 dark:text-zinc-300"
                  title={registrar.isLocked ? 'Bloqueado para transferência' : 'Desbloqueado — pode ser transferido'}
                >
                  {registrar.isLocked ? (
                    <Lock className="h-4 w-4 shrink-0 text-green-600" />
                  ) : (
                    <LockOpen className="h-4 w-4 shrink-0 text-amber-500" />
                  )}
                  <span className="flex-1">
                    Bloqueio de transferência
                    <span className="mt-0.5 block text-xs text-gray-500 dark:text-zinc-500">
                      {registrar.isLocked ? 'Bloqueado' : 'Desbloqueado'}
                    </span>
                  </span>
                </div>
              )}
              <div className="flex w-full items-center gap-3 px-4 py-3 text-sm text-gray-700 dark:text-zinc-300">
                <RefreshCw className="h-4 w-4 shrink-0 text-gray-400" />
                <span className="flex-1">
                  Renovação Automática
                  {registrar.autoRenew !== null && (
                    <span className="mt-0.5 block text-xs text-gray-500 dark:text-zinc-500">
                      {registrar.autoRenew ? 'Activa' : 'Inactiva'}
                    </span>
                  )}
                </span>
                {registrarLoading ? (
                  <Spinner className="h-4 w-4 shrink-0" />
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleToggleAutoRenew()}
                    disabled={registrar.autoRenew === null}
                    aria-pressed={registrar.autoRenew === true}
                    aria-label="Alternar renovação automática"
                    className={`relative h-6 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
                      registrar.autoRenew ? 'bg-green-500' : 'bg-gray-300 dark:bg-zinc-700'
                    }`}
                  >
                    <span
                      className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                        registrar.autoRenew ? 'translate-x-6' : ''
                      }`}
                    />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => showMsg('Disponível em breve — a gestão de WHOIS ainda não está ligada ao registador.', 'error')}
                className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-gray-400 dark:text-zinc-600"
              >
                <ShieldCheck className="h-4 w-4 shrink-0" />
                <span className="flex-1">
                  Informações de Contacto
                  <span className="mt-0.5 block text-xs text-gray-400 dark:text-zinc-600">Em breve</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate?.('dns-central', { domain })}
                className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-gray-700 hover:text-red-600 dark:text-zinc-300 dark:hover:text-red-400"
              >
                <Cloud className="h-4 w-4 shrink-0" />
                Gerenciar DNS
              </button>
              <div className="flex w-full items-center gap-3 px-4 py-3 text-sm text-gray-700 dark:text-zinc-300">
                <ShieldCheck className={`h-4 w-4 shrink-0 ${registrar.privacyEnabled ? 'text-green-600' : 'text-gray-400'}`} />
                <span className="flex-1">
                  Protecção de Privacidade
                  <span className="mt-0.5 block text-xs text-gray-500 dark:text-zinc-500">
                    {registrar.privacyEnabled === null ? '—' : registrar.privacyEnabled ? 'Activa (dados WHOIS ocultos)' : 'Inactiva'}
                  </span>
                </span>
              </div>
              <div className="flex w-full items-center gap-3 px-4 py-3 text-sm text-gray-700 dark:text-zinc-300">
                <ShieldAlert className={`h-4 w-4 shrink-0 ${registrar.dnssecEnabled ? 'text-green-600' : 'text-gray-400'}`} />
                <span className="flex-1">
                  DNSSEC
                  <span className="mt-0.5 block text-xs text-gray-500 dark:text-zinc-500">
                    {registrar.dnssecEnabled === null ? '—' : registrar.dnssecEnabled ? 'Configurado' : 'Não configurado'}
                  </span>
                </span>
              </div>
              <button
                type="button"
                onClick={() => showMsg('O registador não disponibiliza redireccionamento de URL por API. Use "Redireccionar domínio" mais abaixo, que funciona através da hospedagem.', 'error')}
                className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-gray-400 dark:text-zinc-600"
              >
                <ArrowRightLeft className="h-4 w-4 shrink-0" />
                <span className="flex-1">
                  Encaminhamento de URL
                  <span className="mt-0.5 block text-xs text-gray-400 dark:text-zinc-600">Não suportado pelo registador</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate?.('cp-email-mgmt', { domain })}
                className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-gray-700 hover:text-red-600 dark:text-zinc-300 dark:hover:text-red-400"
              >
                <Mail className="h-4 w-4 shrink-0" />
                Criar e-mail
              </button>
              <button
                type="button"
                onClick={() => window.open(`https://${domain}`, '_blank', 'noopener,noreferrer')}
                className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-gray-700 hover:text-red-600 dark:text-zinc-300 dark:hover:text-red-400"
              >
                <ExternalLink className="h-4 w-4 shrink-0" />
                Abrir site
              </button>
            </div>
          </div>

          <div className="rounded border border-gray-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
            <div className="border-b border-gray-100 px-4 py-3 dark:border-zinc-800">
              <h3 className="text-xs font-bold uppercase text-gray-500 dark:text-zinc-500">Acções</h3>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-zinc-800">
              <button
                type="button"
                onClick={() => onNavigate?.('cadastrar-renovacao', { domain })}
                className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-gray-700 hover:text-red-600 dark:text-zinc-300 dark:hover:text-red-400"
              >
                <RefreshCw className="h-4 w-4 shrink-0" />
                Renovar Domínio
              </button>
              <button
                type="button"
                onClick={() => window.open('/servicos/dominios', '_blank', 'noopener,noreferrer')}
                className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-gray-700 hover:text-red-600 dark:text-zinc-300 dark:hover:text-red-400"
              >
                <PlusCircle className="h-4 w-4 shrink-0" />
                Registrar Novo Domínio
              </button>
            </div>
            {reprovisionSteps && (
              <div className="border-t border-gray-100 p-4 dark:border-zinc-800">
                <div className="space-y-1.5">
                  {reprovisionSteps.map((s) => (
                    <div key={s.step} className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-gray-600 dark:text-zinc-400">{s.step}</span>
                      {s.ok ? (
                        <span className="flex items-center gap-1 text-green-600 dark:text-green-400"><CheckCircle className="h-3.5 w-3.5" /> OK</span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-600 dark:text-red-400" title={s.error}><XCircle className="h-3.5 w-3.5" /> {s.error || 'falhou'}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {!clientMode && (
            <div className="rounded border border-gray-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
              <button
                type="button"
                onClick={togglePointerPanel}
                className="flex w-full items-center justify-between px-4 py-3 text-left"
              >
                <span className="flex items-center gap-2 text-xs font-bold uppercase text-gray-500 dark:text-zinc-500">
                  <ArrowRightLeft className="h-4 w-4 shrink-0" />
                  Redireccionar domínio
                </span>
                {pointerOpen ? <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" /> : <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />}
              </button>
              {pointerOpen && (
                <div className="border-t border-gray-100 p-4 dark:border-zinc-800">
                  <p className="mb-3 text-xs text-gray-500 dark:text-zinc-400">
                    Outro domínio que já possuis passa a redireccionar para <span className="font-mono">{domain}</span>.
                  </p>

                  {pointerLoading ? (
                    <div className="flex items-center gap-2 py-2 text-sm text-gray-400 dark:text-zinc-500">
                      <Spinner className="h-4 w-4" /> A carregar...
                    </div>
                  ) : pointers.length > 0 ? (
                    <div className="mb-3 space-y-1.5">
                      {pointers.map((from) => (
                        <div
                          key={from}
                          className="flex items-center justify-between gap-2 rounded border border-gray-100 bg-gray-50 px-3 py-1.5 text-sm dark:border-zinc-800 dark:bg-zinc-800/50"
                        >
                          <span className="truncate font-mono text-xs text-gray-700 dark:text-zinc-300">
                            {from} <span className="text-gray-400 dark:text-zinc-500">→ {domain}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => void handleDeletePointer(from)}
                            className="shrink-0 text-gray-300 hover:text-red-600 dark:text-zinc-600 dark:hover:text-red-500"
                            title="Remover redireccionamento"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mb-3 text-sm text-gray-400 dark:text-zinc-500">Nenhum domínio a redireccionar para aqui ainda.</p>
                  )}

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="outro-dominio.co.mz"
                      value={pointerFrom}
                      onChange={(e) => setPointerFrom(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') void handleAddPointer() }}
                      className={`${panelField} min-w-0 flex-1`}
                    />
                    <button
                      type="button"
                      onClick={() => void handleAddPointer()}
                      disabled={pointerSaving || !pointerFrom.trim()}
                      className={`${panelBtnSecondary} shrink-0 disabled:opacity-50`}
                    >
                      {pointerSaving ? <Spinner className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
