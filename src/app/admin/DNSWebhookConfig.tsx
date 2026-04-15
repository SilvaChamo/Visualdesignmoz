'use client'

import { useState, useEffect } from 'react'
import { 
  Webhook, Server, Globe, CheckCircle, AlertCircle, 
  Copy, RefreshCw, Shield, Terminal
} from 'lucide-react'

export function DNSWebhookConfig() {
  const [webhookStatus, setWebhookStatus] = useState<'online' | 'offline' | 'checking'>('checking')
  const [copied, setCopied] = useState(false)
  const [logs, setLogs] = useState<string[]>([])

  const WEBHOOK_URL = typeof window !== 'undefined' 
    ? `${window.location.origin}/api/webhook/mozserver`
    : 'https://visualdesigne.com/api/webhook/mozserver'

  useEffect(() => {
    checkWebhookStatus()
  }, [])

  const checkWebhookStatus = async () => {
    try {
      setWebhookStatus('checking')
      const response = await fetch('/api/webhook/mozserver')
      if (response.ok) {
        setWebhookStatus('online')
      } else {
        setWebhookStatus('offline')
      }
    } catch {
      setWebhookStatus('offline')
    }
  }

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(WEBHOOK_URL)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const addLog = (message: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${message}`, ...prev].slice(0, 50))
  }

  const testWebhook = async () => {
    addLog('Enviando teste para webhook...')
    try {
      const response = await fetch('/api/webhook/mozserver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'domain.registered',
          domain: 'teste',
          tld: '.co.mz',
          fullDomain: 'teste.co.mz',
          clientEmail: 'test@visualdesigne.com',
          timestamp: new Date().toISOString()
        })
      })
      
      const data = await response.json()
      addLog(`Resposta: ${data.success ? 'SUCESSO' : 'FALHA'} - ${data.message}`)
      
      if (data.actions) {
        data.actions.forEach((action: string) => addLog(`  → ${action}`))
      }
    } catch (error) {
      addLog(`Erro no teste: ${error}`)
    }
  }

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <div className={`rounded-lg border p-4 ${
        webhookStatus === 'online' ? 'bg-green-50 border-green-200' :
        webhookStatus === 'offline' ? 'bg-red-50 border-red-200' :
        'bg-yellow-50 border-yellow-200'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${
              webhookStatus === 'online' ? 'bg-green-500 animate-pulse' :
              webhookStatus === 'offline' ? 'bg-red-500' :
              'bg-yellow-500'
            }`} />
            <div>
              <h3 className="font-semibold text-gray-900">
                Webhook {webhookStatus === 'online' ? 'Online' : webhookStatus === 'offline' ? 'Offline' : 'Verificando...'}
              </h3>
              <p className="text-sm text-gray-600">
                Endpoint pronto para receber eventos da Mozserver
              </p>
            </div>
          </div>
          <button
            onClick={checkWebhookStatus}
            className="p-2 hover:bg-white/50 rounded-lg transition-colors"
          >
            <RefreshCw className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* URL do Webhook */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <label className="text-sm font-medium text-gray-700 mb-2 block">
          URL do Webhook (copiar para Mozserver)
        </label>
        <div className="flex items-center gap-2">
          <code className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono text-gray-700">
            {WEBHOOK_URL}
          </code>
          <button
            onClick={copyWebhookUrl}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              copied 
                ? 'bg-green-600 text-white' 
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copiado!' : 'Copiar'}
          </button>
        </div>
      </div>

      {/* Como Funciona */}
      <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
        <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
          <Terminal className="w-5 h-5" />
          Como funciona a automação
        </h4>
        
        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-3">
            <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0">1</span>
            <div>
              <p className="font-medium text-blue-900">Cliente regista domínio na Mozserver</p>
              <p className="text-blue-700">Ex: exemplo.co.mz</p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0">2</span>
            <div>
              <p className="font-medium text-blue-900">Mozserver envia webhook automático</p>
              <p className="text-blue-700">POST para {WEBHOOK_URL}</p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0">3</span>
            <div>
              <p className="font-medium text-blue-900">Painel Admin cria zona DNS no CyberPanel</p>
              <p className="text-blue-700">IP: 109.199.104.22 (Contabo)</p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0">4</span>
            <div>
              <p className="font-medium text-blue-900">Registros padrão são criados automaticamente</p>
              <p className="text-blue-700">A, MX, TXT SPF, NS, www</p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0">5</span>
            <div>
              <p className="font-medium text-blue-900">Website é criado no CyberPanel</p>
              <p className="text-blue-700">Pacote Default, owner: admin</p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0">6</span>
            <div>
              <p className="font-medium text-blue-900">Domínio pronto para usar!</p>
              <p className="text-blue-700">Cliente pode subir website imediatamente</p>
            </div>
          </div>
        </div>
      </div>

      {/* Registros Criados */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h4 className="font-semibold text-gray-900 mb-3">Registros DNS criados automaticamente</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Tipo</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Nome</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Valor</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">TTL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 font-mono text-xs">
              <tr>
                <td className="px-3 py-2"><span className="bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">A</span></td>
                <td className="px-3 py-2">@</td>
                <td className="px-3 py-2">109.199.104.22</td>
                <td className="px-3 py-2">14400</td>
              </tr>
              <tr>
                <td className="px-3 py-2"><span className="bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">A</span></td>
                <td className="px-3 py-2">www</td>
                <td className="px-3 py-2">109.199.104.22</td>
                <td className="px-3 py-2">14400</td>
              </tr>
              <tr>
                <td className="px-3 py-2"><span className="bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">A</span></td>
                <td className="px-3 py-2">mail</td>
                <td className="px-3 py-2">109.199.104.22</td>
                <td className="px-3 py-2">14400</td>
              </tr>
              <tr>
                <td className="px-3 py-2"><span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">MX</span></td>
                <td className="px-3 py-2">@</td>
                <td className="px-3 py-2">10 mail.dominio.co.mz</td>
                <td className="px-3 py-2">14400</td>
              </tr>
              <tr>
                <td className="px-3 py-2"><span className="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">TXT</span></td>
                <td className="px-3 py-2">@</td>
                <td className="px-3 py-2">v=spf1 a mx ~all</td>
                <td className="px-3 py-2">14400</td>
              </tr>
              <tr>
                <td className="px-3 py-2"><span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">NS</span></td>
                <td className="px-3 py-2">@</td>
                <td className="px-3 py-2">ns1.dominio.co.mz</td>
                <td className="px-3 py-2">86400</td>
              </tr>
              <tr>
                <td className="px-3 py-2"><span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">NS</span></td>
                <td className="px-3 py-2">@</td>
                <td className="px-3 py-2">ns2.dominio.co.mz</td>
                <td className="px-3 py-2">86400</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Teste */}
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-gray-900 flex items-center gap-2">
            <Terminal className="w-5 h-5" />
            Testar Webhook
          </h4>
          <button
            onClick={testWebhook}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Simular Registro de Domínio
          </button>
        </div>
        
        {logs.length > 0 && (
          <div className="bg-black rounded-lg p-3 font-mono text-xs text-green-400 max-h-48 overflow-y-auto">
            {logs.map((log, i) => (
              <div key={i} className="py-0.5">{log}</div>
            ))}
          </div>
        )}
      </div>

      {/* Configuração Mozserver */}
      <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-4">
        <h4 className="font-semibold text-yellow-900 mb-2 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          Configuração necessária na Mozserver
        </h4>
        <ol className="text-sm text-yellow-800 space-y-2 list-decimal list-inside">
          <li>Aceder ao painel de revenda da Mozserver</li>
          <li>Ir a Configurações → Webhooks/API</li>
          <li>Adicionar URL do webhook: <code className="bg-yellow-100 px-1 py-0.5 rounded">{WEBHOOK_URL}</code></li>
          <li>Selecionar eventos: <code className="bg-yellow-100 px-1 py-0.5 rounded">domain.registered</code>, <code className="bg-yellow-100 px-1 py-0.5 rounded">domain.transferred</code></li>
          <li>Guardar configuração</li>
        </ol>
      </div>

      {/* Segurança */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Shield className="w-4 h-4" />
        <span>Webhook protegido. Recomendado adicionar validação de assinatura HMAC em produção.</span>
      </div>
    </div>
  )
}
