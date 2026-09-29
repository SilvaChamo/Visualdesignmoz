'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Cpu,
  HardDrive,
  AlertTriangle,
  Activity,
  Power,
  Wrench,
  X,
  Server,
  Clock,
  ShieldAlert,
  RotateCcw,
  Database,
  Globe,
  Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getServerHost } from '@/lib/server-config';

export type ProcessInfo = {
  pid?: number;
  user: string;
  cpu: number;
  memory: number;
  name: string;
  type: 'website' | 'app' | 'database' | 'system';
  rawCommand: string;
};

export type SystemStatusData = {
  cpu: {
    usage: number;
    cores: number;
    status: 'normal' | 'warning' | 'critical';
  };
  memory: {
    totalMb: number;
    usedMb: number;
    freeMb: number;
    usage: number;
  };
  services?: {
    database: string;
    nginx: string;
    redis: string;
  };
  topConsumer?: ProcessInfo | null;
  topProcesses?: ProcessInfo[];
  load: number[];
  zombies: number;
  uptime: number;
  maintenance: {
    active: boolean;
    message: string;
    updatedAt?: string;
  };
  timestamp?: string;
};

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// Modal reutilizável de Gestão e Manutenção do Servidor
export function ServerStatusModal({
  isOpen,
  onClose,
  data,
  onRefresh,
}: {
  isOpen: boolean;
  onClose: () => void;
  data: SystemStatusData | null;
  onRefresh: () => Promise<void>;
}) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [confirmReboot, setConfirmReboot] = useState(false);
  const [maintMessageInput, setMaintMessageInput] = useState(data?.maintenance?.message || '');

  useEffect(() => {
    if (data?.maintenance?.message) {
      setMaintMessageInput(data.maintenance.message);
    }
  }, [data]);

  if (!isOpen) return null;

  const handleAction = async (action: string, extraBody: Record<string, any> = {}) => {
    setActionLoading(action);
    setActionMessage(null);
    try {
      const res = await fetch('/api/admin/system-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extraBody }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao executar ação');

      setActionMessage({
        type: 'success',
        text: json.message || 'Operação realizada com sucesso!',
      });
      await onRefresh();
      if (action === 'reboot_server') {
        setConfirmReboot(false);
      }
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: err.message || 'Falha ao executar comando',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const cpuUsage = data?.cpu.usage ?? 0;
  const isCpuHigh = cpuUsage >= 65;
  const isCpuCritical = cpuUsage >= 85;
  const isMaintenanceActive = data?.maintenance.active ?? false;
  const isDbActive = data?.services?.database === 'active';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm p-4 sm:p-6 flex items-start justify-center pt-8 sm:pt-14 animate-in fade-in">
      <div className="relative w-full max-w-3xl rounded-xl border border-zinc-200/80 dark:border-white/10 bg-white dark:bg-zinc-950 p-5 sm:p-6 shadow-2xl text-zinc-900 dark:text-zinc-100 my-auto">
        {/* Header do Modal */}
        <div className="flex items-center justify-between border-b border-zinc-200/80 dark:border-white/10 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <Server className="w-5 h-5 text-red-600 dark:text-red-500" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold leading-tight text-zinc-900 dark:text-zinc-50">Painel de Manutenção do Servidor Multi-Site</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Monitorização de processos, consumo por site e emergências</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mensagem de Feedback de Ação */}
        {actionMessage && (
          <div
            className={cn(
              'p-3 mb-4 rounded-xl border text-xs font-medium flex items-center justify-between',
              actionMessage.type === 'success'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400'
            )}
          >
            <span>{actionMessage.text}</span>
            <button type="button" onClick={() => setActionMessage(null)}>
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Grelha de Métricas do Servidor */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {/* Card CPU */}
          <div className="p-4 rounded-xl border border-zinc-200/80 dark:border-white/10 bg-zinc-50/80 dark:bg-zinc-900/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-red-500" /> CPU Global
              </span>
              <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full', 
                isCpuCritical ? 'bg-red-500/20 text-red-500' : isCpuHigh ? 'bg-amber-500/20 text-amber-500' : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
              )}>
                {data?.cpu.usage}%
              </span>
            </div>
            <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-2 rounded-full overflow-hidden mb-2">
              <div
                className={cn('h-full transition-all duration-500', 
                  isCpuCritical ? 'bg-red-600' : isCpuHigh ? 'bg-amber-500' : 'bg-emerald-500'
                )}
                style={{ width: `${Math.min(100, data?.cpu.usage || 0)}%` }}
              />
            </div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 flex justify-between">
              <span>Cores: {data?.cpu.cores || 1}</span>
              <span>Load: {data?.load?.join(' ') || '-'}</span>
            </div>
          </div>

          {/* Card Memória RAM */}
          <div className="p-4 rounded-xl border border-zinc-200/80 dark:border-white/10 bg-zinc-50/80 dark:bg-zinc-900/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5">
                <HardDrive className="w-4 h-4 text-blue-500" /> Memória RAM
              </span>
              <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                {data?.memory.usage}%
              </span>
            </div>
            <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-2 rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-blue-500 transition-all duration-500"
                style={{ width: `${Math.min(100, data?.memory.usage || 0)}%` }}
              />
            </div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 flex justify-between">
              <span>Usado: {data?.memory.usedMb} MB</span>
              <span>Total: {data?.memory.totalMb} MB</span>
            </div>
          </div>

          {/* Card Base de Dados & Sistema */}
          <div className="p-4 rounded-xl border border-zinc-200/80 dark:border-white/10 bg-zinc-50/80 dark:bg-zinc-900/50 sm:col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5">
                <Database className="w-4 h-4 text-emerald-500" /> Base de Dados
              </span>
              <span className={cn('text-[10px] font-bold uppercase px-2 py-0.5 rounded-full', 
                isDbActive ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 text-red-500'
              )}>
                {isDbActive ? 'Ativo' : 'Inativo'}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-zinc-600 dark:text-zinc-400">Serviço MySQL/MariaDB:</span>
              <span className={cn('font-bold', isDbActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500')}>
                {isDbActive ? 'OK' : 'Parado'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleAction('restart_mysql')}
              disabled={actionLoading === 'restart_mysql'}
              className="mt-2.5 w-full py-1 text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center justify-center gap-1"
            >
              <RotateCcw className={cn('w-3 h-3', actionLoading === 'restart_mysql' && 'animate-spin')} />
              Reiniciar MySQL
            </button>
          </div>
        </div>

        {/* Identificação dos Sites & Processos de Maior Consumo */}
        {data?.topProcesses && data.topProcesses.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold tracking-wider uppercase text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-blue-500" /> Consumo por Site e Serviço no Servidor
              </h3>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400">Identificação em Tempo Real</span>
            </div>
            <div className="divide-y divide-zinc-200 dark:divide-zinc-800 rounded-xl border border-zinc-200/80 dark:border-white/10 overflow-hidden bg-white dark:bg-zinc-950">
              {data.topProcesses.map((proc, idx) => (
                <div key={idx} className="px-3 py-1.5 flex items-center justify-between text-xs gap-3">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className={cn('w-2 h-2 rounded-full shrink-0', proc.cpu > 20 ? 'bg-red-500 animate-pulse' : proc.cpu > 5 ? 'bg-amber-500' : 'bg-emerald-500')} />
                    <p className="font-bold text-zinc-800 dark:text-zinc-200 truncate">{proc.name}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 text-zinc-500 dark:text-zinc-400 tabular-nums">
                    <span className="flex items-center">
                      <span className="w-[5.5rem]">CPU - <strong className={cn('font-bold', proc.cpu > 20 ? 'text-red-500' : 'text-zinc-700 dark:text-zinc-300')}>{proc.cpu}%</strong></span>
                      <span className="mr-2 text-zinc-300 dark:text-zinc-700">|</span>
                      <span className="w-[5.5rem]">RAM - <strong className="font-bold text-zinc-700 dark:text-zinc-300">{proc.memory}%</strong></span>
                    </span>
                    <span className="w-16 flex justify-end">
                    {proc.pid && proc.user !== 'root' && proc.type !== 'database' && (
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            window.confirm(
                              `Terminar "${proc.name}"?\n\nO programa é fechado imediatamente. Se for um site, os pedidos que estiverem a meio falham.`,
                            )
                          ) {
                            handleAction('kill_process', { pid: proc.pid });
                          }
                        }}
                        disabled={actionLoading === 'kill_process'}
                        className="px-2 py-0.5 text-[10px] font-semibold text-red-600 dark:text-red-400 border border-red-500/30 rounded hover:bg-red-500/10 transition-colors"
                        title="Terminar processo deste site"
                      >
                        Terminar
                      </button>
                    )}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Secção de Controlo do Modo de Manutenção */}
        <div className="p-4 sm:p-5 rounded-xl border border-zinc-200/80 dark:border-white/10 bg-zinc-50 dark:bg-zinc-900 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className={cn('w-5 h-5 shrink-0', isMaintenanceActive ? 'text-red-500' : 'text-zinc-400')} />
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Aviso de Manutenção para Visitantes</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Ative para exibir a página /manutencao e banner aos visitantes.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleAction('toggle_maintenance', { active: !isMaintenanceActive, message: maintMessageInput })}
              disabled={actionLoading === 'toggle_maintenance'}
              className={cn(
                'px-4 py-2 rounded text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 shrink-0',
                isMaintenanceActive
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-red-600 hover:bg-red-500 text-white'
              )}
            >
              <Power className="w-4 h-4" />
              {actionLoading === 'toggle_maintenance'
                ? 'A atualizar...'
                : isMaintenanceActive
                ? 'Desativar Manutenção'
                : 'Ativar Manutenção'}
            </button>
          </div>

          <div className="mt-3">
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
              Mensagem de Aviso aos Utilizadores:
            </label>
            <input
              type="text"
              value={maintMessageInput}
              onChange={(e) => setMaintMessageInput(e.target.value)}
              placeholder="Ex: Servidor em manutenção programada. Voltamos em breve."
              className="w-full px-3 py-2 text-xs rounded border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
          </div>
        </div>

        {/* Zona de Perigo / Reboot do Servidor */}
        <div className="pt-4 border-t border-zinc-200/80 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">Reinício do Servidor Hestia</h4>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Executa um reboot completo do sistema operativo em caso de lentidão persistente.</p>
          </div>

          {!confirmReboot ? (
            <button
              type="button"
              onClick={() => setConfirmReboot(true)}
              className="px-3 py-2 rounded text-xs font-bold text-red-600 dark:text-red-400 border border-red-500/30 hover:bg-red-500/10 transition-colors flex items-center justify-center gap-1.5 shrink-0"
            >
              <Power className="w-3.5 h-3.5" />
              Reiniciar Servidor
            </button>
          ) : (
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-bold text-red-600 dark:text-red-400">Tem a certeza?</span>
              <button
                type="button"
                onClick={() => handleAction('reboot_server')}
                disabled={actionLoading === 'reboot_server'}
                className="px-3 py-1.5 rounded bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition-colors"
              >
                Sim, Reiniciar
              </button>
              <button
                type="button"
                onClick={() => setConfirmReboot(false)}
                className="px-3 py-1.5 rounded bg-zinc-200 dark:bg-zinc-800 text-xs font-semibold transition-colors"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Leitura periódica partilhada pelos dois componentes abaixo. Nunca acumula pedidos:
// se o anterior ainda não terminou (por SSH a partir do Mac pode demorar mais do que
// o intervalo), essa volta é saltada em vez de lançar outro pedido em paralelo.
function useSystemStatus() {
  const [data, setData] = useState<SystemStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const inFlight = useRef(0);

  const fetchStatus = useCallback(async () => {
    inFlight.current += 1;
    try {
      const res = await fetch('/api/admin/system-status', { cache: 'no-store' });
      if (!res.ok) throw new Error('Falha ao carregar métricas');
      const json = await res.json();
      setData(json);
    } catch {
      /* ignorar erro */
    } finally {
      inFlight.current -= 1;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const tick = () => {
      if (inFlight.current === 0) fetchStatus();
    };
    tick();
    const interval = setInterval(tick, 8000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  return { data, loading, fetchStatus };
}

// Widget do Topo (Header)
export function ServerStatusWidget({ className }: { className?: string }) {
  const { data, loading, fetchStatus } = useSystemStatus();
  const [modalOpen, setModalOpen] = useState(false);

  const cpuUsage = data?.cpu.usage ?? 0;
  const isCpuHigh = cpuUsage >= 65;
  const isCpuCritical = cpuUsage >= 85;
  const isMaintenanceActive = data?.maintenance.active ?? false;
  const topConsumerName = data?.topConsumer?.name;

  return (
    <div className={cn('relative inline-flex items-center gap-2', className)}>
      {/* Banner de Aviso no topo caso CPU esteja muito alto */}
      {isCpuHigh && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 rounded-xl border border-red-500/40 bg-red-950/90 text-red-200 shadow-2xl backdrop-blur-md animate-bounce">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 animate-pulse" />
          <div className="text-xs sm:text-sm font-medium">
            <span className="font-bold text-white">Alerta do Servidor:</span> Consumo de CPU elevado ({cpuUsage}%)
            {topConsumerName && <span className="ml-1 text-red-200 font-semibold">({topConsumerName})</span>}
          </div>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="px-2.5 py-1 text-xs font-semibold rounded bg-red-600 hover:bg-red-500 text-white transition-colors shrink-0"
          >
            Abrir Manutenção
          </button>
        </div>
      )}

      {/* Widget reduzido para Header */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs font-medium transition-all',
            isCpuCritical
              ? 'border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400 animate-pulse'
              : isCpuHigh
              ? 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400'
              : 'border-zinc-200/80 dark:border-white/10 bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-white/20'
          )}
          title="Ver detalhes de consumo por site e serviço"
        >
          <Cpu className={cn('w-3.5 h-3.5', isCpuCritical && 'animate-spin')} />
          <span>CPU: <strong className="font-bold">{loading ? '...' : `${cpuUsage}%`}</strong></span>
          {isCpuHigh && <AlertTriangle className="w-3.5 h-3.5 ml-0.5 text-amber-500" />}
        </button>

        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs font-semibold transition-all shadow-sm',
            isMaintenanceActive
              ? 'border-red-500/50 bg-red-600 text-white hover:bg-red-700 animate-pulse'
              : 'border-zinc-200/80 dark:border-white/10 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'
          )}
        >
          <Wrench className="w-3.5 h-3.5" />
          <span>{isMaintenanceActive ? 'EM MANUTENÇÃO' : 'Manutenção'}</span>
        </button>
      </div>

      <ServerStatusModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        data={data}
        onRefresh={fetchStatus}
      />
    </div>
  );
}

// Card Completo de Informação do Servidor (para a Barra Lateral do Dashboard)
export function ServerInfoCard({
  sitesCount,
  usersCount,
  diskInfo,
}: {
  sitesCount: number;
  usersCount: number;
  diskInfo: { used: string; total: string; percentage: string } | null;
}) {
  const { data, loading, fetchStatus } = useSystemStatus();
  const [modalOpen, setModalOpen] = useState(false);

  const cpuUsage = data?.cpu.usage ?? 0;
  const isCpuHigh = cpuUsage >= 65;
  const isCpuCritical = cpuUsage >= 85;
  const ramUsage = data?.memory.usage ?? 0;
  const isMaintenanceActive = data?.maintenance.active ?? false;
  const isDbActive = data?.services?.database === 'active';
  const topConsumer = data?.topConsumer;

  return (
    <div className="space-y-4 rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-zinc-900">
      {/* Estado do Servidor */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Servidor</p>
          <span className={cn('h-2.5 w-2.5 rounded-full', isMaintenanceActive ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500')} />
          <span className={cn('text-xs font-bold', isMaintenanceActive ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400')}>
            {isMaintenanceActive ? 'manutenção' : 'activo'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="p-1 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          title="Abrir painel de manutenção"
        >
          <Wrench className="w-4 h-4" />
        </button>
      </div>

      {/* Detalhes de Conta e IP */}
      <div className="space-y-3 text-sm border-b border-zinc-100 dark:border-zinc-800 pb-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Utilizador</p>
          <p className="font-bold text-zinc-900 dark:text-zinc-100">admin</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">IP do Servidor</p>
          <p className="font-mono text-xs text-zinc-800 dark:text-zinc-200">{getServerHost()}</p>
        </div>
        <div className="flex items-center justify-between text-xs">
          <div>
            <span className="font-bold text-zinc-900 dark:text-zinc-100">{sitesCount}</span> <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Websites</span>
          </div>
          <div>
            <span className="font-bold text-zinc-900 dark:text-zinc-100">{usersCount}</span> <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Utilizadores</span>
          </div>
        </div>
      </div>

      {/* Métricas em Tempo Real: Base de Dados, CPU & RAM */}
      <div className="space-y-3 pt-1">
        {/* Status da Base de Dados MySQL */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
            <Database className="w-3 h-3 text-emerald-500" /> Base de Dados (MySQL)
          </span>
          <span className={cn('font-bold text-[11px]', isDbActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500')}>
            {loading ? '...' : isDbActive ? 'Ativo 🟢' : 'Inativo 🔴'}
          </span>
        </div>

        {/* Barra de Consumo de CPU */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
              <Cpu className="w-3 h-3 text-red-500" /> Consumo CPU
            </span>
            <span className={cn('text-xs font-bold', 
              isCpuCritical ? 'text-red-500 animate-pulse' : isCpuHigh ? 'text-amber-500' : 'text-zinc-700 dark:text-zinc-300'
            )}>
              {loading ? '...' : `${cpuUsage}%`}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
            <div
              className={cn('h-1.5 rounded-full transition-all duration-500', 
                isCpuCritical ? 'bg-red-600' : isCpuHigh ? 'bg-amber-500' : 'bg-emerald-500'
              )}
              style={{ width: `${Math.min(100, cpuUsage)}%` }}
            />
          </div>
        </div>

        {/* Barra de Memória RAM */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
              <HardDrive className="w-3 h-3 text-blue-500" /> Uso de RAM
            </span>
            <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
              {loading ? '...' : `${ramUsage}%`}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
            <div
              className="h-1.5 rounded-full bg-blue-500 transition-all duration-500"
              style={{ width: `${Math.min(100, ramUsage)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Destaque do Maior Consumidor no Servidor (Site ou Serviço) */}
      {topConsumer && (
        <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-0.5">
            Maior Consumo Atual:
          </span>
          <p className="font-bold text-zinc-800 dark:text-zinc-200 truncate">{topConsumer.name}</p>
          <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
            CPU: <strong className="text-red-500 font-bold">{topConsumer.cpu}%</strong> | RAM: <strong className="text-zinc-700 dark:text-zinc-300 font-bold">{topConsumer.memory}%</strong>
          </p>
        </div>
      )}

      {/* Espaço em Disco */}
      {diskInfo && (
        <div className="pt-1 border-t border-zinc-100 dark:border-zinc-800">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Espaço em Disco</p>
          <p className="font-bold text-xs text-zinc-900 dark:text-zinc-100">
            {diskInfo.used} / {diskInfo.total}
          </p>
          <div className="mt-1 h-1.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
            <div className="h-1.5 rounded-full bg-purple-500" style={{ width: diskInfo.percentage }} />
          </div>
        </div>
      )}

      {/* Processos Zombie (alerta se existir) */}
      {(data?.zombies || 0) > 0 && (
        <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold flex items-center justify-between">
          <span>⚠️ Zombies: {data?.zombies}</span>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="underline text-[10px]"
          >
            Limpar
          </button>
        </div>
      )}

      <ServerStatusModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        data={data}
        onRefresh={fetchStatus}
      />
    </div>
  );
}
