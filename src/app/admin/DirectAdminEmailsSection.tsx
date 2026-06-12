'use client'

import React, { useState, useEffect } from 'react'
import {
  Mail, Plus, Trash2, RefreshCw, Eye, EyeOff, Key, CheckCircle,
  AlertCircle, Globe, Loader2, Copy, ExternalLink, Shield
} from 'lucide-react'
import { getDirectAdminAccessUrl } from '@/lib/server-config'
import { DIRECTADMIN_EMAIL_DOMAINS } from '@/lib/email-domains'

const DA_DOMAINS = [...DIRECTADMIN_EMAIL_DOMAINS]

interface EmailAccount {
  email: string
  quota: string
  usage: string
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      className="ml-1 p-1 hover:bg-gray-100 rounded transition-colors"
      title="Copiar"
    >
      {copied ? <CheckCircle className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />}
    </button>
  )
}

export function DirectAdminEmailsSection() {
  const [selectedDomain, setSelectedDomain] = useState(DA_DOMAINS[0])
  const [emails, setEmails] = useState<EmailAccount[]>([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  // Create form
  const [showCreate, setShowCreate] = useState(false)
  const [newUser, setNewUser] = useState('')
  const [newPass, setNewPass] = useState('')
  const [newPassConfirm, setNewPassConfirm] = useState('')
  const [newQuota, setNewQuota] = useState('250')
  const [showPass, setShowPass] = useState(false)
  const [creating, setCreating] = useState(false)

  // Change password
  const [changingPassFor, setChangingPassFor] = useState<string | null>(null)
  const [changePass, setChangePass] = useState('')
  const [changingPass, setChangingPass] = useState(false)

  const loadEmails = async (domain: string) => {
    setLoading(true)
    setMsg(null)
    try {
      const res = await fetch(`/api/da-emails?action=list&domain=${encodeURIComponent(domain)}`)
      const data = await res.json()
      if (data.success) {
        setEmails(data.emails || [])
      } else {
        setMsg({ text: data.error || 'Erro ao carregar emails', ok: false })
        setEmails([])
      }
    } catch (e: any) {
      setMsg({ text: 'Erro de ligação: ' + e.message, ok: false })
    }
    setLoading(false)
  }

  useEffect(() => { loadEmails(selectedDomain) }, [selectedDomain])

  const handleCreate = async () => {
    if (!newUser || !newPass) return setMsg({ text: 'Preencha username e password', ok: false })
    if (newPass !== newPassConfirm) return setMsg({ text: 'As passwords não coincidem', ok: false })
    setCreating(true); setMsg(null)
    try {
      const res = await fetch('/api/da-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', domain: selectedDomain, username: newUser, password: newPass, quota: newQuota }),
      })
      const data = await res.json()
      if (data.success) {
        setMsg({ text: data.message, ok: true })
        setNewUser(''); setNewPass(''); setNewPassConfirm(''); setShowCreate(false)
        loadEmails(selectedDomain)
      } else {
        setMsg({ text: data.error || 'Erro ao criar email', ok: false })
      }
    } catch (e: any) {
      setMsg({ text: e.message, ok: false })
    }
    setCreating(false)
  }

  const handleDelete = async (email: string) => {
    const username = email.split('@')[0]
    if (!confirm(`Eliminar ${email}? Esta acção é irreversível.`)) return
    setMsg(null)
    try {
      const res = await fetch('/api/da-emails', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: selectedDomain, username }),
      })
      const data = await res.json()
      setMsg({ text: data.message || data.error, ok: data.success })
      if (data.success) loadEmails(selectedDomain)
    } catch (e: any) {
      setMsg({ text: e.message, ok: false })
    }
  }

  const handleChangePassword = async (email: string) => {
    if (!changePass) return
    setChangingPass(true)
    try {
      const res = await fetch('/api/da-emails', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: selectedDomain, username: email.split('@')[0], password: changePass }),
      })
      const data = await res.json()
      setMsg({ text: data.message || data.error, ok: data.success })
      if (data.success) { setChangingPassFor(null); setChangePass('') }
    } catch (e: any) {
      setMsg({ text: e.message, ok: false })
    }
    setChangingPass(false)
  }

  const genPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$'
    const pass = Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
    setNewPass(pass); setNewPassConfirm(pass)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">

        <div className="flex items-center gap-2">
          <a
            href={getDirectAdminAccessUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 border border-blue-200 text-blue-600 rounded-[10px] text-xs font-bold hover:bg-blue-100 transition-all"
          >
            <ExternalLink className="w-3.5 h-3.5" /> DirectAdmin
          </a>
          <button
            onClick={() => loadEmails(selectedDomain)}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 border border-gray-200 text-gray-600 rounded-[10px] text-xs font-bold hover:bg-gray-200 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-1.5 px-4 py-2 bg-green-50 border border-green-300 text-green-600 rounded-[10px] text-xs font-bold hover:bg-green-100 transition-all"
          >
            <Plus className="w-3.5 h-3.5" /> Novo Email
          </button>
        </div>
      </div>

      {/* Domain Selector */}
      <div className="flex items-center gap-3">
        <Globe className="w-4 h-4 text-gray-400" />
        <span className="text-sm font-semibold text-gray-600">Domínio:</span>
        <div className="flex gap-2">
          {DA_DOMAINS.map(d => (
            <button
              key={d}
              onClick={() => setSelectedDomain(d)}
              className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all border ${
                selectedDomain === d
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Alert message */}
      {msg && (
        <div className={`flex items-center gap-2.5 px-4 py-3 rounded-[10px] text-sm font-medium border ${
          msg.ok ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
        }`}>
          {msg.ok ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
          {msg.text}
        </div>
      )}

      {/* Create Form */}
      {showCreate && (
        <div className="bg-white border border-green-200 rounded-[10px] shadow-sm p-6">
          <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Mail className="w-4 h-4 text-green-600" /> Criar nova conta de email em @{selectedDomain}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase block mb-1.5">Username</label>
              <div className="flex">
                <input
                  value={newUser}
                  onChange={e => setNewUser(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))}
                  placeholder="ex: info"
                  className="flex-1 px-3 py-2.5 border border-gray-300 rounded-l-[10px] text-sm focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                />
                <span className="px-3 py-2.5 bg-gray-100 border border-l-0 border-gray-300 rounded-r-[10px] text-sm text-gray-500 font-medium">
                  @{selectedDomain}
                </span>
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase block mb-1.5">Quota (MB)</label>
              <select
                value={newQuota}
                onChange={e => setNewQuota(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-[10px] text-sm"
              >
                <option value="100">100 MB</option>
                <option value="250">250 MB</option>
                <option value="500">500 MB</option>
                <option value="1000">1 GB</option>
                <option value="0">Ilimitada</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase block mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={newPass}
                  onChange={e => setNewPass(e.target.value)}
                  placeholder="Password segura"
                  className="w-full px-3 py-2.5 pr-10 border border-gray-300 rounded-[10px] text-sm focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                />
                <button onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase block mb-1.5">Confirmar Password</label>
              <div className="flex gap-2">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={newPassConfirm}
                  onChange={e => setNewPassConfirm(e.target.value)}
                  placeholder="Repetir password"
                  className="flex-1 px-3 py-2.5 border border-gray-300 rounded-[10px] text-sm focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                />
                <button
                  onClick={genPassword}
                  className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-[10px] text-xs font-bold text-gray-600 hover:bg-gray-200 transition-all whitespace-nowrap"
                >
                  Gerar
                </button>
              </div>
            </div>
          </div>
          <div className="flex gap-3 mt-5">
            <button
              onClick={handleCreate}
              disabled={creating || !newUser || !newPass}
              className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-[10px] text-sm font-bold hover:bg-green-700 disabled:opacity-50 transition-all"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              Criar Email
            </button>
            <button onClick={() => setShowCreate(false)} className="px-5 py-2.5 text-sm font-bold text-gray-500 hover:text-gray-700 transition-all">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Emails Table */}
      <div className="bg-white border border-gray-200 rounded-[10px] shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-bold text-gray-700">
              {loading ? 'A carregar...' : `${emails.length} conta${emails.length !== 1 ? 's' : ''} em @${selectedDomain}`}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="animate-pulse">
            {/* Header skeleton */}
            <div className="flex items-center gap-3 px-5 py-3 bg-gray-50 border-b">
              <div className="h-3 bg-gray-200 rounded w-24"></div>
              <div className="h-3 bg-gray-200 rounded w-16 ml-auto"></div>
              <div className="h-3 bg-gray-200 rounded w-12"></div>
              <div className="h-3 bg-gray-200 rounded w-20"></div>
            </div>
            {/* Row skeletons */}
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-4 border-b border-gray-50">
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-8 h-8 bg-gray-200 rounded-full shrink-0"></div>
                  <div className="space-y-1.5">
                    <div className={`h-3 bg-gray-200 rounded ${i % 3 === 0 ? 'w-48' : i % 3 === 1 ? 'w-56' : 'w-40'}`}></div>
                    <div className="h-2.5 bg-gray-100 rounded w-32"></div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="h-5 bg-gray-200 rounded-full w-16"></div>
                  <div className="h-5 bg-gray-100 rounded w-12"></div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="w-7 h-7 bg-gray-200 rounded"></div>
                  <div className="w-7 h-7 bg-gray-200 rounded"></div>
                  <div className="w-7 h-7 bg-gray-200 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        ) : emails.length === 0 ? (
          <div className="py-16 text-center">
            <Mail className="w-12 h-12 mx-auto mb-3 text-gray-200" />
            <p className="text-gray-500 font-medium">Nenhuma conta de email encontrada</p>
            <p className="text-gray-400 text-sm mt-1">Crie a primeira conta para este domínio</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-bold text-gray-500 uppercase bg-gray-50 border-b">
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Quota</th>
                <th className="px-5 py-3">Uso</th>
                <th className="px-5 py-3 w-48">Ações</th>
              </tr>
            </thead>
            <tbody>
              {emails.map((acc) => (
                <React.Fragment key={acc.email}>
                  <tr className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
                          {acc.email[0].toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{acc.email}</div>
                        </div>
                        <CopyBtn text={acc.email} />
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-600">{acc.quota !== 'N/A' ? `${acc.quota} MB` : '—'}</td>
                    <td className="px-5 py-3 text-gray-600">{acc.usage !== '0' ? `${acc.usage} MB` : '0 MB'}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => { setChangingPassFor(changingPassFor === acc.email ? null : acc.email); setChangePass('') }}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 border border-blue-200 text-blue-600 rounded-[8px] text-xs font-bold hover:bg-blue-100 transition-all"
                        >
                          <Key className="w-3 h-3" /> Password
                        </button>
                        <button
                          onClick={() => handleDelete(acc.email)}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-red-50 border border-red-200 text-red-500 rounded-[8px] text-xs font-bold hover:bg-red-100 transition-all"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {changingPassFor === acc.email && (
                    <tr className="bg-blue-50/50 border-b border-blue-100">
                      <td colSpan={4} className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Key className="w-4 h-4 text-blue-500 flex-shrink-0" />
                          <span className="text-xs font-bold text-blue-700">Nova password para {acc.email}:</span>
                          <input
                            type="text"
                            value={changePass}
                            onChange={e => setChangePass(e.target.value)}
                            placeholder="Nova password"
                            className="flex-1 max-w-xs px-3 py-1.5 border border-blue-200 rounded-[8px] text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                          />
                          <button
                            onClick={() => handleChangePassword(acc.email)}
                            disabled={changingPass || !changePass}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-[8px] text-xs font-bold hover:bg-blue-700 disabled:opacity-50 transition-all"
                          >
                            {changingPass ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                            Guardar
                          </button>
                          <button onClick={() => setChangingPassFor(null)} className="text-xs text-gray-400 hover:text-gray-600">
                            Cancelar
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* SMTP Info Card */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-[10px] p-5">
        <h3 className="text-sm font-bold text-blue-800 mb-3 flex items-center gap-2">
          <Shield className="w-4 h-4" /> Configuração SMTP do Servidor DirectAdmin
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          {[
            { label: 'Servidor', value: '109.199.104.22' },
            { label: 'SMTP (TLS)', value: 'Porta 587' },
            { label: 'SMTP (SSL)', value: 'Porta 465' },
            { label: 'IMAP', value: 'Porta 993' },
          ].map(item => (
            <div key={item.label} className="bg-white/60 rounded-[8px] px-3 py-2.5 border border-blue-100">
              <div className="text-blue-500 font-bold uppercase tracking-wider mb-0.5">{item.label}</div>
              <div className="text-blue-900 font-mono font-semibold">{item.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
