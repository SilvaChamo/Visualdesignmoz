'use client'

import { useState } from 'react'
import { Server, Database, Cloud, Play, CheckCircle, XCircle, Loader2, Globe, Github, Rocket, ArrowRight } from 'lucide-react'

export function InfraManagerSection() {
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle')
  const [logs, setLogs] = useState<string[]>([])
  const [targetUrl, setTargetUrl] = useState('https://aamihe.com')
  const [currentStep, setCurrentStep] = useState(2) // Iniciamos no 2 pois o 1 já foi feito
  const [infraDone, setInfraDone] = useState(true) // Marcamos como feito conforme solicitado

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`])
  }

  const runSetup = async () => {
    setStatus('running')
    addLog('🚀 Re-verificando servidor central...')
    try {
      const res = await fetch('/api/admin/infra-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setup-supabase' })
      })
      const data = await res.json()
      if (data.success) {
        addLog('✅ Servidor central confirmado e pronto.')
        setInfraDone(true)
        setCurrentStep(2)
        setStatus('success')
      } else {
        addLog(`❌ Erro: ${data.error}`)
        setStatus('error')
      }
    } catch (e: any) {
      addLog(`❌ Erro: ${e.message}`)
      setStatus('error')
    }
  }

  const runClone = async () => {
    setStatus('running')
    addLog(`🌐 Clonando site ${targetUrl}...`)
    try {
      const res = await fetch('/api/admin/infra-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clone-site', url: targetUrl })
      })
      const data = await res.json()
      if (data.success) {
        addLog(`✅ Clone concluído (${data.pages} páginas).`)
        setCurrentStep(3)
        setStatus('success')
      } else {
        addLog(`❌ Erro: ${data.error}`)
        setStatus('error')
      }
    } catch (e: any) {
      addLog(`❌ Erro: ${e.message}`)
      setStatus('error')
    }
  }

  const runDeploy = async () => {
    setStatus('running')
    addLog(`📤 Criando repositório GitHub...`)
    try {
      const res = await fetch('/api/admin/infra-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deploy-github', url: targetUrl })
      })
      const data = await res.json()
      if (data.success) {
        addLog(`✅ Repositório ${data.repo} criado!`)
        addLog('🚀 Deploy Vercel ativo.')
        setStatus('success')
      } else {
        addLog(`❌ Erro GitHub: ${data.error}`)
        setStatus('error')
      }
    } catch (e: any) {
      addLog(`❌ Erro: ${e.message}`)
      setStatus('error')
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 py-4">
      <div className="flex items-center justify-between border-b border-gray-100 pb-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900 flex items-center gap-3">
            <Rocket className="w-8 h-8 text-red-600" />
            Pipeline de Migração
          </h2>
          <p className="text-sm text-gray-500">Fluxo sequencial para conversão de sites WordPress.</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold border border-emerald-100">
          <Database className="w-4 h-4" />
          Infraestrutura Contabo Ativa
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* COL 1: INFRA */}
        <div className={`p-5 rounded-2xl border-2 transition-all flex flex-col ${infraDone ? 'bg-gray-50 border-emerald-200' : 'bg-white border-gray-200 shadow-lg'}`}>
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${infraDone ? 'bg-emerald-500 text-white' : 'bg-gray-900 text-white'}`}>
              {infraDone ? <CheckCircle className="w-5 h-5" /> : "1"}
            </div>
            <h3 className="font-bold text-gray-900">1. Servidor Central</h3>
          </div>
          <p className="text-[11px] text-gray-500 mb-4 flex-1">Configuração do PostgreSQL/Supabase no VPS Contabo. (Já executado)</p>
          <button 
            onClick={runSetup}
            disabled={status === 'running'}
            className={`w-full py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all ${infraDone ? 'bg-white border border-gray-200 text-gray-500' : 'bg-gray-900 text-white'}`}
          >
            {infraDone ? "Verificar Status" : "Configurar Agora"}
          </button>
        </div>

        {/* COL 2: CLONE */}
        <div className={`p-5 rounded-2xl border-2 transition-all flex flex-col ${currentStep === 2 ? 'bg-white border-blue-500 shadow-xl' : 'bg-gray-50 border-gray-100'}`}>
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${currentStep > 2 ? 'bg-emerald-500 text-white' : 'bg-blue-600 text-white'}`}>
              {currentStep > 2 ? <CheckCircle className="w-5 h-5" /> : "2"}
            </div>
            <h3 className="font-bold text-gray-900">2. Clonar Site</h3>
          </div>
          <div className="flex-1 space-y-3">
            <p className="text-[11px] text-gray-500">Copia o WordPress (PT, EN, FR) para ficheiros estáticos.</p>
            <input 
              value={targetUrl}
              onChange={e => setTargetUrl(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg font-mono text-[10px] bg-white outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button 
            onClick={runClone}
            disabled={status === 'running'}
            className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {status === 'running' && currentStep === 2 ? <Loader2 className="w-3 h-3 animate-spin" /> : <Globe className="w-3 h-3" />}
            Clonar Agora
          </button>
        </div>

        {/* COL 3: DEPLOY */}
        <div className={`p-5 rounded-2xl border-2 transition-all flex flex-col ${currentStep === 3 ? 'bg-white border-red-500 shadow-xl' : 'bg-gray-50 border-gray-100'}`}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center font-bold">
              3
            </div>
            <h3 className="font-bold text-gray-900">3. Deploy Vercel</h3>
          </div>
          <p className="text-[11px] text-gray-500 mb-4 flex-1">Cria o repositório no GitHub e finaliza a migração para o domínio real.</p>
          <button 
            onClick={runDeploy}
            disabled={status === 'running' || currentStep < 3}
            className="w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-md"
          >
            <Github className="w-4 h-4" />
            Publicar Site
          </button>
        </div>

      </div>

      {/* Terminal Compacto */}
      <div className="bg-[#0f172a] rounded-xl border border-black p-4 shadow-2xl">
        <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/50"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/50"></div>
          </div>
          <span className="text-[9px] text-slate-500 font-mono tracking-widest uppercase">Console de Migração</span>
        </div>
        <div className="font-mono text-sm h-48 overflow-y-auto space-y-1.5 scrollbar-hide">
          {logs.length === 0 && <p className="text-slate-600 italic">Aguardando início do processo...</p>}
          {logs.map((log, i) => (
            <div key={i} className="flex gap-3 py-0.5 border-b border-slate-800/50 last:border-0">
              <span className="text-slate-500 shrink-0 tabular-nums">{log.substring(0, 10)}</span>
              <span className={log.includes('❌') ? 'text-red-400' : log.includes('✅') ? 'text-emerald-400' : 'text-slate-200'}>
                {log.substring(10)}
              </span>
            </div>
          ))}
          {status === 'running' && (
            <div className="flex items-center gap-2 text-blue-400 animate-pulse mt-2">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Processando no servidor...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
