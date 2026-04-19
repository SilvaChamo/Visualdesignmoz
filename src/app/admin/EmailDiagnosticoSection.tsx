'use client';

import { useState } from 'react';
import { Loader2, Mail, Server, AlertCircle, CheckCircle, RefreshCw, Activity, Play, Square, RotateCcw, Wrench, Trash2, Shield, FileCheck, List } from 'lucide-react';

export function EmailDiagnosticoSection() {
  const [diagnostico, setDiagnostico] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testResult, setTestResult] = useState<any>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [serviceAction, setServiceAction] = useState<string | null>(null);
  const [maintenanceResult, setMaintenanceResult] = useState<any>(null);
  const [maintenanceLoading, setMaintenanceLoading] = useState<string | null>(null);
  const [checkDomain, setCheckDomain] = useState('visualdesigne.com');

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

  async function runMaintenanceAction(action: string, params?: any) {
    setMaintenanceLoading(action);
    try {
      const res = await fetch('/api/email-diagnostico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, params })
      });
      const data = await res.json();
      setMaintenanceResult({ action, ...data });
      if (action === 'resetPostfix' || action === 'fixPermissions') {
        setTimeout(() => runDiagnostico(), 3000);
      }
    } catch (e) {
      setMaintenanceResult({ action, error: 'Falha na ação de manutenção' });
    }
    setMaintenanceLoading(null);
  }

  async function controlService(service: string, action: 'start' | 'stop' | 'restart') {
    setServiceAction(`${service}-${action}`);
    try {
      const res = await fetch('/api/email-diagnostico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: action === 'start' ? 'serviceStart' : action === 'stop' ? 'serviceStop' : 'serviceRestart', service })
      });
      await res.json();
      runDiagnostico();
    } catch (e) {}
    setServiceAction(null);
  }

  async function sendTestEmail() {
    if (!testEmail) return;
    setTestLoading(true);
    try {
      const res = await fetch('/api/email-diagnostico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sendTest', to: testEmail, from: 'teste@visualdesigne.com', subject: 'Teste ' + new Date().toISOString(), body: 'Email de teste.' })
      });
      setTestResult(await res.json());
    } catch (e) {
      setTestResult({ error: 'Falha' });
    }
    setTestLoading(false);
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
        <button onClick={runDiagnostico} disabled={loading}
          className="bg-cyan-600 hover:bg-cyan-700 text-white px-5 py-2.5 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {loading ? 'Executando...' : 'Executar Diagnóstico'}
        </button>
      </div>

      {/* MANUTENÇÃO — sempre visível */}
      <div className="bg-amber-50 rounded-xl border border-amber-200 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Wrench className="w-5 h-5 text-amber-600" />
          Ações de Manutenção
          <span className="ml-auto text-xs bg-amber-200 text-amber-800 px-2 py-1 rounded">Use com cuidado</span>
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          {[
            { action: 'killProcesses', label: 'Matar Processos', color: 'red', desc: 'pkill postfix/master', Icon: Trash2 },
            { action: 'cleanLocks', label: 'Limpar Locks', color: 'orange', desc: 'Remove .pid e .lock', Icon: Shield },
            { action: 'resetPostfix', label: 'Reset Postfix', color: 'blue', desc: 'Stop + Clean + Start', Icon: RotateCcw },
            { action: 'fixPermissions', label: 'Corrigir Permissões', color: 'green', desc: 'postfix set-permissions', Icon: FileCheck },
            { action: 'fixSASL', label: 'Corrigir SASL', color: 'blue', desc: 'Autenticação Dovecot', Icon: Shield },
            { action: 'fixMainCf', label: 'Limpar main.cf', color: 'green', desc: 'Remove params inválidos', Icon: FileCheck },
            { action: 'testReceive', label: 'Testar Recebimento', color: 'purple', desc: 'Verifica logs entrega', Icon: Mail },
            { action: 'fixPostfixStartup', label: 'Corrigir Postfix', color: 'red', desc: 'Corrige locks e config', Icon: Server },
          ].map(({ action, label, color, desc, Icon }) => (
            <MaintenanceButton key={action} icon={Icon} label={label} color={color}
              onClick={() => runMaintenanceAction(action)}
              loading={maintenanceLoading === action} description={desc} />
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
            <h4 className="text-sm font-semibold text-orange-900 mb-2">Diagnóstico Recebimento (17 verificações)</h4>
            <div className="flex gap-2">
              <input type="text" value={checkDomain} onChange={(e) => setCheckDomain(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              <button onClick={() => runMaintenanceAction('checkEmailReception', { domain: checkDomain })}
                disabled={maintenanceLoading === 'checkEmailReception'}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 text-sm font-medium whitespace-nowrap">
                {maintenanceLoading === 'checkEmailReception' ? 'A verificar...' : 'Executar'}
              </button>
            </div>
          </div>
          <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <h4 className="text-sm font-semibold text-yellow-900 mb-2">Verificar Entrega</h4>
            <div className="flex gap-2">
              <input type="text" value={checkDomain} onChange={(e) => setCheckDomain(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              <button onClick={() => runMaintenanceAction('checkEmailDelivery', { domain: checkDomain })}
                disabled={maintenanceLoading === 'checkEmailDelivery'}
                className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 text-sm font-medium whitespace-nowrap">
                {maintenanceLoading === 'checkEmailDelivery' ? 'A verificar...' : 'Executar'}
              </button>
            </div>
          </div>
        </div>

        <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
          <h4 className="text-sm font-semibold text-purple-900 mb-3">🔧 CyberPanel e Blacklist</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { action: 'checkCyberPanelStatus', label: 'Verificar CyberPanel', color: 'bg-blue-600 hover:bg-blue-700' },
              { action: 'checkCyberPanelLogin', label: 'Diagnóstico Login', color: 'bg-purple-600 hover:bg-purple-700' },
              { action: 'fixCyberPanelLogin', label: 'Corrigir Login', color: 'bg-red-600 hover:bg-red-700' },
            ].map(({ action, label, color }) => (
              <button key={action} onClick={() => runMaintenanceAction(action)}
                disabled={maintenanceLoading === action}
                className={`px-3 py-2 ${color} text-white rounded-lg disabled:opacity-50 text-sm font-medium`}>
                {maintenanceLoading === action ? 'A executar...' : label}
              </button>
            ))}
            <div className="flex gap-2">
              <input type="text" placeholder="Nova senha..." id="newAdminPassword"
                className="flex-1 px-2 py-2 border border-gray-300 rounded-lg text-sm" />
              <button onClick={() => {
                const p = (document.getElementById('newAdminPassword') as HTMLInputElement)?.value || 'Admin123!';
                runMaintenanceAction('resetAdminPassword', { password: p });
              }} disabled={maintenanceLoading === 'resetAdminPassword'}
                className="px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 text-sm font-medium">
                {maintenanceLoading === 'resetAdminPassword' ? '...' : 'Resetar'}
              </button>
            </div>
          </div>
        </div>

        {maintenanceResult && (
          <div className={`p-4 rounded-lg mt-4 ${maintenanceResult.success ? 'bg-green-100 border border-green-300' : 'bg-red-100 border border-red-300'}`}>
            <p className={`font-medium mb-2 ${maintenanceResult.success ? 'text-green-800' : 'text-red-800'}`}>
              {maintenanceResult.success ? '✓ Concluído' : '✗ Falhou'}
            </p>
            <pre className="text-xs font-mono bg-white p-3 rounded border overflow-auto max-h-60">
              {maintenanceResult.output || maintenanceResult.error}
            </pre>
          </div>
        )}
      </div>

      {/* TESTAR ENVIO — sempre visível */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Testar Envio de Email</h3>
        <div className="flex gap-4">
          <input type="email" placeholder="email@destino.com" value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            className="flex-1 bg-gray-50 border border-gray-300 rounded-lg px-4 py-2.5" />
          <button onClick={sendTestEmail} disabled={testLoading || !testEmail}
            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-6 py-2.5 rounded-lg flex items-center gap-2 font-medium">
            {testLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            Enviar Teste
          </button>
        </div>
        {testResult && (
          <div className={`mt-4 p-4 rounded-lg ${testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <p className={`font-medium ${testResult.success ? 'text-green-800' : 'text-red-800'}`}>
              {testResult.success ? '✓ Enviado' : '✗ Falhou'}
            </p>
            <pre className="mt-2 text-sm font-mono bg-white p-3 rounded border overflow-auto">{testResult.output || testResult.error}</pre>
          </div>
        )}
      </div>

      {/* RESULTADOS — só aparecem após Executar Diagnóstico */}
      {loading && <div className="text-center py-8 text-gray-400"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" /><p>A executar diagnóstico...</p></div>}

      {diagnostico && (
        <div className="space-y-6">
          {!diagnostico.tests?.postfixRunning && (
            <div className="bg-red-50 border-l-4 border-red-600 p-4 rounded-r-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                <div>
                  <h3 className="font-bold text-red-800">Postfix está parado!</h3>
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => controlService('postfix', 'start')}
                      className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2">
                      <Play className="w-4 h-4" /> Iniciar
                    </button>
                    <button onClick={() => controlService('postfix', 'restart')}
                      className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2">
                      <RotateCcw className="w-4 h-4" /> Reiniciar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Server className="w-5 h-5 text-gray-500" /> Status dos Serviços
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {['postfix', 'dovecot'].map(svc => (
                <div key={svc} className={`p-4 rounded-lg border ${diagnostico.tests?.[`${svc}Running`] ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    {diagnostico.tests?.[`${svc}Running`] ? <CheckCircle className="w-5 h-5 text-green-600" /> : <AlertCircle className="w-5 h-5 text-red-600" />}
                    <span className="font-semibold">{svc === 'postfix' ? 'Postfix (SMTP)' : 'Dovecot (IMAP/POP3)'}</span>
                    <span className={`ml-auto text-xs px-2 py-1 rounded font-medium ${diagnostico.tests?.[`${svc}Running`] ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
                      {diagnostico.tests?.[`${svc}Running`] ? 'ATIVO' : 'PARADO'}
                    </span>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => controlService(svc, diagnostico.tests?.[`${svc}Running`] ? 'stop' : 'start')}
                      className={`${diagnostico.tests?.[`${svc}Running`] ? 'bg-gray-600' : 'bg-green-600'} text-white px-3 py-1.5 rounded text-xs flex items-center gap-1`}>
                      {diagnostico.tests?.[`${svc}Running`] ? <><Square className="w-3 h-3" /> Parar</> : <><Play className="w-3 h-3" /> Iniciar</>}
                    </button>
                    <button onClick={() => controlService(svc, 'restart')}
                      className="bg-blue-600 text-white px-3 py-1.5 rounded text-xs flex items-center gap-1">
                      <RotateCcw className="w-3 h-3" /> Reiniciar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {[
            { title: 'Fila de Emails (Mailq)', key: 'mailQueue', color: 'text-green-400' },
            { title: 'Logs Recentes do Postfix', key: 'recentLogs', color: 'text-yellow-400' },
            { title: 'Diagnóstico Avançado (journalctl)', key: 'postfixJournal', color: 'text-red-300' },
            { title: 'Configuração Main.cf', key: 'mainCf', color: 'text-cyan-400' },
            { title: 'Configuração Postfix', key: 'postfixConfig', color: 'text-cyan-400' },
          ].map(({ title, key, color }) => (
            <div key={key} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
              <pre className={`bg-gray-900 p-4 rounded-lg text-sm ${color} overflow-auto max-h-80 font-mono`}>
                {diagnostico.tests?.[key] || 'Sem dados'}
              </pre>
            </div>
          ))}

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Rede e DNS</h3>
            <div className="space-y-2 text-sm bg-gray-50 p-4 rounded-lg">
              <p><span className="text-gray-500">Porta 25:</span> <span className="font-mono">{diagnostico.tests?.port25}</span></p>
              <p><span className="text-gray-500">Porta 587:</span> <span className="font-mono text-green-600">{diagnostico.tests?.port587} ✅</span></p>
              <p><span className="text-gray-500">MX Records:</span> <span className="font-mono">{diagnostico.tests?.mxRecords}</span></p>
              <p><span className="text-gray-500">SPF:</span> <span className="font-mono">{diagnostico.tests?.spfRecord}</span></p>
              <p><span className="text-gray-500">IP:</span> <span className="font-mono">{diagnostico.tests?.ipInfo}</span></p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MaintenanceButton({ icon: Icon, label, color, onClick, loading, description }: {
  icon: any, label: string, color: string, onClick: () => void, loading: boolean, description: string
}) {
  const colors: Record<string, string> = {
    red: 'bg-red-100 hover:bg-red-200 text-red-700 border-red-300',
    orange: 'bg-orange-100 hover:bg-orange-200 text-orange-700 border-orange-300',
    blue: 'bg-blue-100 hover:bg-blue-200 text-blue-700 border-blue-300',
    green: 'bg-green-100 hover:bg-green-200 text-green-700 border-green-300',
    purple: 'bg-purple-100 hover:bg-purple-200 text-purple-700 border-purple-300',
  };
  return (
    <button onClick={onClick} disabled={loading}
      className={`p-3 rounded-lg border text-left transition-colors ${colors[color]} disabled:opacity-50`}>
      <div className="flex items-center gap-2 mb-1">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
        <span className="font-medium text-sm">{label}</span>
      </div>
      <span className="text-xs opacity-75">{description}</span>
    </button>
  );
}
