'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { readWpInstallsCache, writeWpInstallsCache } from '@/lib/panel-wp-cache';
import type { PanelBootstrapScope } from '@/lib/panel-data-from-server';

/**
 * Abre o wp-admin do site já com sessão iniciada (entrada automática do painel,
 * a mesma de "Acessos WordPress"); se falhar, abre o login normal do WordPress.
 */
export async function openWordPressPanel(domain: string): Promise<void> {
  // O separador abre já no clique — depois de um await o browser trata-o como popup e bloqueia.
  const tab = window.open('about:blank', '_blank');
  if (tab) tab.opener = null;
  const fallback = `https://${domain}/wp-admin`;
  let url = fallback;
  try {
    const res = await fetch('/api/admin/wp-users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ domain, action: 'autologin' }),
    });
    const data = await res.json().catch(() => ({}));
    if (data.success && data.url) url = data.url;
  } catch {
    /* fica o login normal do WordPress */
  }
  if (tab) tab.location.href = url;
  else window.open(url, '_blank', 'noopener');
}

/** Selo "WordPress" clicável — leva directamente ao painel do WordPress do site. */
export function WordPressPanelBadge({ domain, className }: { domain: string; className?: string }) {
  const [opening, setOpening] = useState(false);
  return (
    <button
      type="button"
      title={`Entrar no painel WordPress de ${domain}`}
      onClick={async (e) => {
        e.stopPropagation();
        if (opening) return;
        setOpening(true);
        try {
          await openWordPressPanel(domain);
        } finally {
          setOpening(false);
        }
      }}
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-bold hover:bg-blue-200 transition-colors dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-900/50',
        className,
      )}
    >
      WordPress
      {opening ? <Loader2 className="h-3 w-3 animate-spin" /> : <ExternalLink className="h-3 w-3" />}
    </button>
  );
}

/** Domínios com WordPress visíveis para quem está no painel (a API já filtra pelo âmbito). */
export function useWordPressDomains(scope: PanelBootstrapScope = 'admin'): Set<string> {
  const [domains, setDomains] = useState<Set<string>>(
    () => new Set(readWpInstallsCache(scope).map((d) => d.toLowerCase())),
  );
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/admin/wp-update', { credentials: 'include' });
        const data = await res.json().catch(() => ({}));
        if (cancelled || !data.success || !Array.isArray(data.installs)) return;
        const list = data.installs.map((i: { domain: string }) => i.domain.toLowerCase());
        writeWpInstallsCache(list, scope);
        setDomains(new Set(list));
      } catch {
        /* sem selo — o resto da lista continua */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scope]);
  return domains;
}
