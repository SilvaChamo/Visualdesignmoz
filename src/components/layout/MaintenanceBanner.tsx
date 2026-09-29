'use client';

import React, { useState, useEffect } from 'react';
import { Wrench, X, ExternalLink } from 'lucide-react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

export function MaintenanceBanner() {
  const [maintenance, setMaintenance] = useState<{ active: boolean; message: string } | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const checkMaintenance = async () => {
      try {
        const res = await fetch('/api/system-status', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (data.maintenance) {
          setMaintenance(data.maintenance);
        }
      } catch {
        /* ignorar erro de ligação silencioso */
      }
    };

    checkMaintenance();
    const interval = setInterval(checkMaintenance, 12000);
    return () => clearInterval(interval);
  }, []);

  // Não mostrar se inativo, se já dispensado ou se está na própria página /manutencao
  if (!maintenance?.active || dismissed || pathname === '/manutencao') return null;

  return (
    <div className="relative z-50 bg-gradient-to-r from-amber-600 via-red-600 to-amber-600 text-white px-4 py-2.5 shadow-lg animate-in fade-in">
      <div className="container mx-auto max-w-7xl flex items-center justify-between gap-3 text-xs sm:text-sm font-medium">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1 rounded-md bg-white/20 shrink-0">
            <Wrench className="w-4 h-4 text-white animate-pulse" />
          </div>
          <p className="truncate">
            <strong className="font-extrabold uppercase tracking-wide mr-1.5">Aviso de Manutenção:</strong>
            <span>{maintenance.message || 'Servidor em manutenção temporária. Voltamos em breve!'}</span>
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Link
            href="/manutencao"
            className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white/20 hover:bg-white/30 text-white text-xs font-semibold transition-colors"
          >
            Ver Página <ExternalLink className="w-3 h-3" />
          </Link>

          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="p-1 rounded-md hover:bg-white/20 transition-colors"
            title="Fechar aviso"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
