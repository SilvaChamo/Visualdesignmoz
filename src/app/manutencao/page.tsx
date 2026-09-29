'use client';

import React, { useState, useEffect } from 'react';
import { Wrench, Server, Shield, RefreshCw, Clock } from 'lucide-react';
import Link from 'next/link';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

export default function MaintenancePage() {
  const [maintenance, setMaintenance] = useState<{ active: boolean; message: string; updatedAt?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/system-status', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setMaintenance(data.maintenance);
      }
    } catch {
      /* ignorar erro */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex items-center justify-center p-4 sm:p-6 relative overflow-hidden font-sans transition-colors duration-300">
      {/* Botão de Tema no topo direito */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle size="sm" />
      </div>

      {/* Elementos decorativos de fundo */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-red-500/10 dark:bg-red-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[350px] h-[350px] bg-amber-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="container mx-auto max-w-2xl relative z-10">
        <div className="rounded-xl border border-zinc-200/80 dark:border-white/10 bg-white/90 dark:bg-zinc-900/80 backdrop-blur-xl p-6 sm:p-10 shadow-2xl text-center">
          
          {/* Ícone Animado de Manutenção */}
          <div className="relative inline-flex items-center justify-center mb-6">
            <div className="w-20 h-20 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center animate-pulse">
              <Wrench className="w-10 h-10 text-red-600 dark:text-red-500" />
            </div>
            <div className="absolute -bottom-1 -right-1 p-1.5 rounded-lg bg-amber-500 text-zinc-950 font-bold shadow-md">
              <Clock className="w-4 h-4" />
            </div>
          </div>

          {/* Título Principal */}
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 mb-3">
            Servidor em Manutenção
          </h1>

          <p className="text-zinc-600 dark:text-zinc-400 text-sm sm:text-base max-w-lg mx-auto mb-6 leading-relaxed">
            Estamos a realizar atualizações programadas no sistema para otimizar o desempenho e a segurança da nossa infraestrutura.
          </p>

          {/* Caixa de Mensagem Customizada do Admin */}
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-950/60 text-left mb-8">
            <div className="flex items-center gap-2 mb-2 text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              <Shield className="w-4 h-4" /> Mensagem da Equipa Técnica:
            </div>
            <p className="text-xs sm:text-sm text-zinc-800 dark:text-zinc-200 font-medium leading-normal">
              "{maintenance?.message || 'Servidor em manutenção temporária. Voltamos muito em breve!'}"
            </p>
          </div>

          {/* Indicador de Estado */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-zinc-200 dark:border-white/10 text-xs text-zinc-600 dark:text-zinc-400">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
              <span>Estado: <strong className="text-amber-600 dark:text-amber-400 font-semibold">Atualização em Curso</strong></span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={fetchStatus}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                Atualizar Estado
              </button>

              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold transition-colors shadow-sm"
              >
                <Server className="w-3.5 h-3.5" />
                Painel Admin
              </Link>
            </div>
          </div>

        </div>

        {/* Rodapé Simples */}
        <p className="text-center text-xs text-zinc-500 dark:text-zinc-500 mt-6">
          VisualDesign &copy; {new Date().getFullYear()} — Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
}
