'use client';

import { useState } from 'react';
import { Loader2, Mail, Server, AlertCircle, CheckCircle, RefreshCw, Activity, Play, Square, RotateCcw, Wrench, Trash2, Shield, FileCheck, FolderOpen } from 'lucide-react';

export function EmailDiagnosticoSection() {
  const [diagnostico, setDiagnostico] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testResult, setTestResult] = useState<any>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [serviceAction, setServiceAction] = useState<string | null>(null);
  const [maintenanceResult, setMaintenanceResult] = useState<any>(null);
  const [maintenanceLoading, setMaintenanceLoading] = useState<string | null>(null);
  const [imapFoldersResult, setImapFoldersResult] = useState<any>(null);
  const [imapFoldersLoading, setImapFoldersLoading] = useState(false);

  async function runDiagnostico() {
    setLoading(true);
    try {
      const res = await fetch('/api/email-diagnostico');
      const data = await res.json();
      setDiagnostico(data);
    } catch (e) {
      setDiagnostico({ error: 'Falha ao executar diagnóstico' });
    }
    setLoading(false);
  }

  async function sendTestEmail() {
    if (!testEmail) return;
    setTestLoading(true);
    try {
      const res = await fetch('/api/email-diagnostico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sendTest',
          to: testEmail,
          from: 'teste@visualdesign.store',
          subject: 'Teste de Email ' + new Date().toISOString(),
          body: 'Este é um email de teste enviado via SSH/Sendmail do servidor CyberPanel.'
        })
      });
      const data = await res.json();
      setTestResult(data);
    } catch (e) {
      setTestResult({ error: 'Falha ao enviar teste' });
    }
    setTestLoading(false);
  }

  async function flushQueue() {
    try {
      const res = await fetch('/api/email-diagnostico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'flushQueue' })
      });
      const data = await res.json();
      alert(data.output || 'Fila atualizada');
    } catch (e) {
      alert('Erro ao atualizar fila');
    }
  }

  async function clearQueue() {
    if (!confirm('Tem certeza que deseja limpar TODA a fila de emails?')) return;
    try {
      const res = await fetch('/api/email-diagnostico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deleteQueue' })
      });
      const data = await res.json();
      alert(data.output || 'Fila limpa');
    } catch (e) {
      alert('Erro ao limpar fila');
    }
  }

  async function controlService(service: string, action: 'start' | 'stop' | 'restart') {
    setServiceAction(`${service}-${action}`);
    try {
      const actionMap = {
        start: 'serviceStart',
        stop: 'serviceStop',
        restart: 'serviceRestart'
      };
      const res = await fetch('/api/email-diagnostico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: actionMap[action], service })
      });
      const data = await res.json();
      alert(data.output || `Serviço ${action === 'start' ? 'iniciado' : action === 'stop' ? 'parado' : 'reiniciado'}`);
      // Atualizar diagnóstico após ação
      runDiagnostico();
    } catch (e) {
      alert(`Erro ao ${action} serviço`);
    }
    setServiceAction(null);
  }

  async function runMaintenanceAction(action: string) {
    setMaintenanceLoading(action);
    try {
      const res = await fetch('/api/email-diagnostico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      const data = await res.json();
      setMaintenanceResult({ action, ...data });
      // Atualizar diagnóstico após ação
      if (action === 'resetPostfix' || action === 'fixPermissions') {
        setTimeout(() => runDiagnostico(), 3000);
      }
    } catch (e) {
      setMaintenanceResult({ action, error: 'Falha na ação de manutenção' });
    }
    setMaintenanceLoading(null);
  }

  async function checkImapFolders() {
    setImapFoldersLoading(true);
    setImapFoldersResult(null);
    try {
      const res = await fetch('/api/debug-imap-folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'silva.chamo@visualdesigne.com',
          password: 'Meckito#1977?*'
        })
      });
      const data = await res.json();
      setImapFoldersResult(data);
    } catch (e) {
      setImapFoldersResult({ error: 'Falha ao verificar pastas IMAP' });
    }
    setImapFoldersLoading(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Activity className="w-7 h-7 text-cyan-600" />
            Diagnóstico de Email
          </h2>
          <p className="text-gray-500 mt-1">Verifique o estado do servidor de emails via SSH</p>
        </div>
        <button
          onClick={runDiagnostico}
          disabled={loading}
          className="bg-cyan-600 hover:bg-cyan-700 text-white px-5 py-2.5 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {loading ? 'Executando...' : 'Executar Diagnóstico'}
        </button>
      </div>

      {/* Skeleton Loading */}
      {loading && (
        <div className="space-y-6 animate-pulse">
          {/* Skeleton Status Cards */}
          <div className="bg-gray-50/50 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-5 h-5 bg-gray-200 rounded"></div>
              <div className="h-5 bg-gray-200 rounded w-40"></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2].map(i => (
                <div key={i} className="bg-white rounded-xl p-5 shadow-sm">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-gray-100 rounded-full"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 rounded w-32 mb-2"></div>
                      <div className="h-3 bg-gray-100 rounded w-48"></div>
                    </div>
                    <div className="h-6 bg-gray-100 rounded w-14"></div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <div className="h-8 bg-gray-100 rounded-lg w-24"></div>
                    <div className="h-8 bg-gray-100 rounded-lg w-24"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Skeleton Maintenance Section (agora 2ª) */}
          <div className="bg-amber-50/50 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-5 h-5 bg-gray-200 rounded"></div>
              <div className="h-5 bg-gray-200 rounded w-56"></div>
              <div className="ml-auto h-5 bg-gray-200 rounded w-24"></div>
            </div>
            <div className="h-3 bg-gray-200 rounded w-full mb-4"></div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="bg-white rounded-lg p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-4 h-4 bg-gray-200 rounded"></div>
                    <div className="h-4 bg-gray-200 rounded w-20"></div>
                  </div>
                  <div className="h-3 bg-gray-100 rounded w-full"></div>
                </div>
              ))}
            </div>
          </div>

          {/* Skeleton Queue (agora 3ª) */}
          <div className="bg-gray-50/50 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 bg-gray-200 rounded"></div>
                <div className="h-5 bg-gray-200 rounded w-36"></div>
              </div>
              <div className="flex gap-2">
                <div className="h-9 bg-gray-200 rounded-lg w-28"></div>
                <div className="h-9 bg-gray-200 rounded-lg w-24"></div>
              </div>
            </div>
            <div className="bg-gray-900 rounded-xl p-4 space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-4 bg-gray-700/50 rounded w-full"></div>
              ))}
            </div>
          </div>

          {/* Skeleton Logs */}
          <div className="bg-gray-50/50 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-5 h-5 bg-gray-200 rounded"></div>
              <div className="h-5 bg-gray-200 rounded w-48"></div>
            </div>
            <div className="bg-gray-900 rounded-xl p-4 space-y-2">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-3 bg-gray-700/50 rounded w-full"></div>
              ))}
            </div>
          </div>
        </div>
      )}

      {diagnostico && (
        <div className="space-y-6">
          {/* Alerta de erro se Postfix parado */}
          {!diagnostico.tests?.postfixRunning && (
            <div className="bg-red-50 border-l-4 border-red-600 p-4 rounded-r-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-bold text-red-800">Postfix está parado!</h3>
                  <p className="text-sm text-red-700 mt-1">
                    O serviço Postfix (SMTP) não está em execução. Os emails não serão enviados nem recebidos.
                  </p>
                  <div className="mt-3 flex gap-2 justify-start">
                    <button 
                      onClick={() => controlService('postfix', 'start')}
                      disabled={serviceAction === 'postfix-start'}
                      className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                    >
                      {serviceAction === 'postfix-start' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                      Iniciar Postfix
                    </button>
                    <button 
                      onClick={() => controlService('postfix', 'restart')}
                      disabled={serviceAction === 'postfix-restart'}
                      className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                    >
                      {serviceAction === 'postfix-restart' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                      Reiniciar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Status Geral */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Server className="w-5 h-5 text-gray-500" />
              Status dos Serviços
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <StatusCard 
                title="Postfix (SMTP)" 
                running={diagnostico.tests?.postfixRunning}
                detail={diagnostico.tests?.postfixStatus?.split('\n')[0]}
                onStart={() => controlService('postfix', 'start')}
                onStop={() => controlService('postfix', 'stop')}
                onRestart={() => controlService('postfix', 'restart')}
                serviceAction={serviceAction}
              />
              <StatusCard 
                title="Dovecot (IMAP/POP3)" 
                running={diagnostico.tests?.dovecotRunning}
                detail={diagnostico.tests?.dovecotStatus?.split('\n')[0]}
                onStart={() => controlService('dovecot', 'start')}
                onStop={() => controlService('dovecot', 'stop')}
                onRestart={() => controlService('dovecot', 'restart')}
                serviceAction={serviceAction}
              />
            </div>
          </div>

          {/* Ações de Manutenção */}
          <div className="bg-amber-50 rounded-xl border border-amber-200 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Wrench className="w-5 h-5 text-amber-600" />
              Ações de Manutenção Avançada
              <span className="ml-auto text-xs bg-amber-200 text-amber-800 px-2 py-1 rounded">Use com cuidado</span>
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Estas ações resolvem problemas quando o Postfix não inicia devido a processos travados ou lock files.
            </p>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <MaintenanceButton
                icon={Trash2}
                label="Matar Processos"
                color="red"
                onClick={() => runMaintenanceAction('killProcesses')}
                loading={maintenanceLoading === 'killProcesses'}
                description="pkill postfix/master"
              />
              <MaintenanceButton
                icon={Shield}
                label="Limpar Locks"
                color="orange"
                onClick={() => runMaintenanceAction('cleanLocks')}
                loading={maintenanceLoading === 'cleanLocks'}
                description="Remove .pid e .lock"
              />
              <MaintenanceButton
                icon={RotateCcw}
                label="Reset Postfix"
                color="blue"
                onClick={() => runMaintenanceAction('resetPostfix')}
                loading={maintenanceLoading === 'resetPostfix'}
                description="Stop + Clean + Start"
              />
              <MaintenanceButton
                icon={FileCheck}
                label="Corrigir Permissões"
                color="green"
                onClick={() => runMaintenanceAction('fixPermissions')}
                loading={maintenanceLoading === 'fixPermissions'}
                description="postfix set-permissions"
              />
            </div>
            
            {/* Botões de Correção de Configuração */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <MaintenanceButton
                icon={Shield}
                label="Corrigir SASL"
                color="blue"
                onClick={() => runMaintenanceAction('fixSASL')}
                loading={maintenanceLoading === 'fixSASL'}
                description="Configura autenticação Dovecot"
              />
              <MaintenanceButton
                icon={FileCheck}
                label="Limpar main.cf"
                color="green"
                onClick={() => runMaintenanceAction('fixMainCf')}
                loading={maintenanceLoading === 'fixMainCf'}
                description="Remove parâmetros inválidos"
              />
              <MaintenanceButton
                icon={Mail}
                label="Testar Recebimento"
                color="purple"
                onClick={() => runMaintenanceAction('testReceive')}
                loading={maintenanceLoading === 'testReceive'}
                description="Verifica logs de entrega"
              />
              <MaintenanceButton
                icon={Server}
                label="Config Entrega"
                color="orange"
                onClick={() => runMaintenanceAction('checkDeliver')}
                loading={maintenanceLoading === 'checkDeliver'}
                description="Verifica LDA/Dovecot"
              />
            </div>

            {/* Resultado da ação de manutenção */}
            {maintenanceResult && (
              <div className={`p-4 rounded-lg ${maintenanceResult.success ? 'bg-green-100 border border-green-300' : 'bg-red-100 border border-red-300'}`}>
                <p className={`font-medium ${maintenanceResult.success ? 'text-green-800' : 'text-red-800'}`}>
                  {maintenanceResult.success ? '✓ Ação concluída' : '✗ Ação falhou'}
                </p>
                <pre className="mt-2 text-xs font-mono bg-white p-3 rounded border overflow-auto max-h-40">
                  {maintenanceResult.output || maintenanceResult.error}
                </pre>
              </div>
            )}
          </div>

          {/* Ações de Correção de Configuração */}
          <div className="bg-blue-50 rounded-xl border border-blue-200 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-600" />
              Correção de Configuração
              <span className="ml-auto text-xs bg-blue-200 text-blue-800 px-2 py-1 rounded">Resolver problemas de autenticação</span>
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Estas ações corrigem problemas específicos de autenticação SASL e configuração do Postfix que impedem o recebimento de emails.
            </p>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <MaintenanceButton
                icon={Shield}
                label="Corrigir SASL"
                color="blue"
                onClick={() => runMaintenanceAction('fixSASL')}
                loading={maintenanceLoading === 'fixSASL'}
                description="Configura autenticação Dovecot"
              />
              <MaintenanceButton
                icon={FileCheck}
                label="Limpar main.cf"
                color="green"
                onClick={() => runMaintenanceAction('fixMainCf')}
                loading={maintenanceLoading === 'fixMainCf'}
                description="Remove parâmetros inválidos"
              />
              <MaintenanceButton
                icon={Mail}
                label="Testar Recebimento"
                color="purple"
                onClick={() => runMaintenanceAction('testReceive')}
                loading={maintenanceLoading === 'testReceive'}
                description="Verifica logs de entrega"
              />
              <MaintenanceButton
                icon={Server}
                label="Config Entrega"
                color="orange"
                onClick={() => runMaintenanceAction('checkDeliver')}
                loading={maintenanceLoading === 'checkDeliver'}
                description="Verifica LDA/Dovecot"
              />
            </div>

            {/* Resultado da ação de correção */}
            {maintenanceResult && (
              <div className={`p-4 rounded-lg ${maintenanceResult.success ? 'bg-green-100 border border-green-300' : 'bg-red-100 border border-red-300'}`}>
                <p className={`font-medium ${maintenanceResult.success ? 'text-green-800' : 'text-red-800'}`}>
                  {maintenanceResult.success ? '✓ Ação concluída' : '✗ Ação falhou'}
                </p>
                <pre className="mt-2 text-xs font-mono bg-white p-3 rounded border overflow-auto max-h-60">
                  {maintenanceResult.output || maintenanceResult.error}
                </pre>
              </div>
            )}

            {/* Resultado do diagnóstico IMAP */}
            {imapFoldersResult && (
              <div className={`p-4 rounded-lg ${imapFoldersResult.success ? 'bg-blue-100 border border-blue-300' : 'bg-red-100 border border-red-300'}`}>
                <p className={`font-medium ${imapFoldersResult.success ? 'text-blue-800' : 'text-red-800'}`}>
                  {imapFoldersResult.success ? '📁 Pastas IMAP encontradas' : '✗ Erro ao listar pastas'}
                </p>
                {imapFoldersResult.success && (
                  <div className="mt-2 text-sm">
                    <p className="font-medium text-blue-700 mb-2">Total de pastas: {imapFoldersResult.allFolders?.length}</p>
                    
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      {Object.entries(imapFoldersResult.commonFolders || {}).map(([name, status]: [string, any]) => (
                        <div key={name} className={`p-2 rounded text-xs ${status.exists ? 'bg-green-200 text-green-800' : 'bg-gray-200 text-gray-600'}`}>
                          {name}: {status.exists ? `${status.total} emails` : 'Não existe'}
                        </div>
                      ))}
                    </div>
                    
                    <details className="mt-2">
                      <summary className="cursor-pointer text-blue-600 hover:text-blue-800">Ver todas as pastas</summary>
                      <pre className="mt-2 text-xs font-mono bg-white p-3 rounded border overflow-auto max-h-60">
                        {JSON.stringify(imapFoldersResult.allFolders, null, 2)}
                      </pre>
                    </details>
                  </div>
                )}
                {imapFoldersResult.error && (
                  <pre className="mt-2 text-xs font-mono bg-white p-3 rounded border text-red-600">
                    {imapFoldersResult.error}
                  </pre>
                )}
              </div>
            )}
          </div>

          {/* Fila de Emails */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Mail className="w-5 h-5 text-gray-500" />
                Fila de Emails (Mailq)
              </h3>
              <div className="flex gap-2">
                <button 
                  onClick={flushQueue} 
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-sm"
                >
                  Forçar Reenvio
                </button>
                <button 
                  onClick={clearQueue}
                  className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded text-sm"
                >
                  Limpar Fila
                </button>
              </div>
            </div>
            <pre className="bg-gray-900 p-4 rounded-lg text-sm text-green-400 overflow-auto max-h-60 font-mono">
              {diagnostico.tests?.mailQueue || 'Sem dados'}
            </pre>
            <p className="mt-2 text-sm text-gray-500">
              Total na fila: <span className="text-gray-900 font-mono font-medium">{diagnostico.tests?.queueCount}</span>
            </p>
          </div>

          {/* Logs Recentes */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Logs Recentes do Postfix</h3>
            <pre className="bg-gray-900 p-4 rounded-lg text-sm text-yellow-400 overflow-auto max-h-80 font-mono">
              {diagnostico.tests?.recentLogs || 'Sem logs'}
            </pre>
          </div>

          {/* Diagnóstico Avançado - Logs do Journal */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              Diagnóstico Avançado (journalctl)
            </h3>
            <pre className="bg-gray-900 p-4 rounded-lg text-sm text-red-300 overflow-auto max-h-96 font-mono">
              {diagnostico.tests?.postfixJournal || 'Sem dados do journal'}
            </pre>
          </div>

          {/* Verificação de Configuração */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Verificação de Configuração (postfix check)</h3>
            <pre className={`p-4 rounded-lg text-sm font-mono overflow-auto max-h-80 ${diagnostico.tests?.postfixCheck?.includes('error') ? 'bg-red-900 text-red-100' : 'bg-green-900 text-green-100'}`}>
              {diagnostico.tests?.postfixCheck || 'Sem verificação'}
            </pre>
          </div>

          {/* Configuração main.cf */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Configuração Main.cf</h3>
            <pre className="bg-gray-900 p-4 rounded-lg text-sm text-cyan-400 overflow-auto max-h-80 font-mono">
              {diagnostico.tests?.mainCf || 'Sem configuração'}
            </pre>
          </div>

          {/* Processos e Permissões */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Processos e Permissões</h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-2">Processos Postfix:</p>
                <pre className="bg-gray-900 p-3 rounded-lg text-sm text-gray-300 font-mono overflow-auto">
                  {diagnostico.tests?.processes || 'Sem dados'}
                </pre>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600 mb-2">Permissões da Fila:</p>
                <pre className="bg-gray-900 p-3 rounded-lg text-sm text-gray-300 font-mono overflow-auto">
                  {diagnostico.tests?.queuePermissions || 'Sem dados'}
                </pre>
              </div>
            </div>
          </div>

          {/* Configuração */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Configuração Postfix</h3>
            <pre className="bg-gray-900 p-4 rounded-lg text-sm text-cyan-400 overflow-auto font-mono">
              {diagnostico.tests?.postfixConfig || 'Sem configuração'}
            </pre>
          </div>

          {/* Portas e DNS */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Rede e DNS</h3>
            <div className="space-y-2 text-sm bg-gray-50 p-4 rounded-lg">
              <p><span className="text-gray-500">Porta 25 (SMTP):</span> <span className="font-mono text-gray-900">{diagnostico.tests?.port25}</span></p>
              <p><span className="text-gray-500 text-green-600 font-semibold">Porta 587 (SMTP Auth):</span> <span className="font-mono text-green-600 font-semibold">{diagnostico.tests?.port587 || 'Verificando...'} ✅</span></p>
              <p><span className="text-gray-500">MX Records:</span> <span className="font-mono text-gray-900">{diagnostico.tests?.mxRecords}</span></p>
              <p><span className="text-gray-500">SPF:</span> <span className="font-mono text-gray-900">{diagnostico.tests?.spfRecord}</span></p>
              <p><span className="text-gray-500">IP do Servidor:</span> <span className="font-mono text-gray-900">{diagnostico.tests?.ipInfo}</span></p>
              <p><span className="text-gray-500">Contas de Email:</span> <span className="font-mono text-gray-900">{diagnostico.tests?.emailAccounts}</span></p>
            </div>
            
            {/* Status SMTP Autenticado */}
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <h4 className="font-semibold text-green-800 mb-2">✅ SMTP Autenticado Configurado</h4>
              <div className="space-y-1 text-sm text-green-700">
                <p><span className="font-medium">Sender Padrão:</span> admin@visualdesigne.com</p>
                <p><span className="font-medium">Porta:</span> 587 (STARTTLS)</p>
                <p><span className="font-medium">Limite Diário:</span> 200 emails (proteção anti-bloqueio)</p>
                <p><span className="font-medium">Fallback Gmail:</span> Apenas em emergência</p>
              </div>
            </div>
          </div>

          {/* Teste de Envio */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Testar Envio de Email</h3>
            <div className="flex gap-4">
              <input
                type="email"
                placeholder="email@destino.com"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                className="flex-1 bg-gray-50 border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
              <button
                onClick={sendTestEmail}
                disabled={testLoading || !testEmail}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-6 py-2.5 rounded-lg flex items-center gap-2 font-medium transition-colors"
              >
                {testLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                Enviar Teste
              </button>
            </div>
            {testResult && (
              <div className={`mt-4 p-4 rounded-lg ${testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <p className={`font-medium ${testResult.success ? 'text-green-800' : 'text-red-800'}`}>
                  {testResult.success ? '✓ Comando executado com sucesso' : '✗ Falha ao executar comando'}
                </p>
                <pre className="mt-2 text-sm font-mono bg-white p-3 rounded border overflow-auto">{testResult.output || testResult.error}</pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MaintenanceButton({ 
  icon: Icon, label, color, onClick, loading, description 
}: { 
  icon: any, label: string, color: string, onClick: () => void, loading: boolean, description: string 
}) {
  const colorClasses: Record<string, string> = {
    red: 'bg-red-100 hover:bg-red-200 text-red-700 border-red-300',
    orange: 'bg-orange-100 hover:bg-orange-200 text-orange-700 border-orange-300',
    blue: 'bg-blue-100 hover:bg-blue-200 text-blue-700 border-blue-300',
    green: 'bg-green-100 hover:bg-green-200 text-green-700 border-green-300',
    purple: 'bg-purple-100 hover:bg-purple-200 text-purple-700 border-purple-300',
  };

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`p-3 rounded-lg border text-left transition-colors ${colorClasses[color]} disabled:opacity-50`}
    >
      <div className="flex items-center gap-2 mb-1">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
        <span className="font-medium text-sm">{label}</span>
      </div>
      <span className="text-xs opacity-75">{description}</span>
    </button>
  );
}

function StatusCard({ 
  title, running, detail, onStart, onStop, onRestart, serviceAction 
}: { 
  title: string, running?: boolean, detail?: string,
  onStart?: () => void, onStop?: () => void, onRestart?: () => void,
  serviceAction?: string | null
}) {
  const serviceName = title.toLowerCase().includes('postfix') ? 'postfix' : 'dovecot';
  const isActionLoading = (action: string) => serviceAction === `${serviceName}-${action}`;
  
  return (
    <div className={`p-4 rounded-lg border ${running ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
      <div className="flex items-center gap-2 mb-2">
        {running ? <CheckCircle className="w-5 h-5 text-green-600" /> : <AlertCircle className="w-5 h-5 text-red-600" />}
        <span className="font-semibold text-gray-900">{title}</span>
        <span className={`ml-auto text-xs px-2 py-1 rounded font-medium ${running ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
          {running ? 'ATIVO' : 'PARADO'}
        </span>
      </div>
      <p className="text-sm text-gray-600 font-mono mb-3">{detail}</p>
      
      {/* Botões de controle - alinhados à esquerda */}
      <div className="flex gap-2 justify-start">
        {!running ? (
          <button 
            onClick={onStart}
            disabled={isActionLoading('start')}
            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            {isActionLoading('start') ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
            Iniciar
          </button>
        ) : (
          <button 
            onClick={onStop}
            disabled={isActionLoading('stop')}
            className="bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white px-4 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            {isActionLoading('stop') ? <Loader2 className="w-3 h-3 animate-spin" /> : <Square className="w-3 h-3" />}
            Parar
          </button>
        )}
        <button 
          onClick={onRestart}
          disabled={isActionLoading('restart')}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-colors"
        >
          {isActionLoading('restart') ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
          Reiniciar
        </button>
      </div>
    </div>
  );
}
