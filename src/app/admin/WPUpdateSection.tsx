'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle, Plug, RefreshCw } from 'lucide-react';
import type { DirectAdminWebsite } from '@/lib/directadmin-api';

interface WpPlugin {
  name: string;
  title?: string;
  status: string;
  version: string;
  update: string | null;
  update_version?: string;
}

interface WpInstall {
  domain: string;
  wpVersion?: string;
}

export type WPUpdateSectionProps = {
  sites: DirectAdminWebsite[];
  apiBase?: string;
  /** Domínio pré-seleccionado (ex.: site principal do cliente) */
  initialDomain?: string;
  /** Escolher automaticamente o primeiro site com WordPress */
  autoSelectFirstWp?: boolean;
  /** Ocultar selector (cliente com um único site) */
  hideDomainSelector?: boolean;
};

function pickFirstWpDomain(
  domainOptions: { domain: string; hasWp?: boolean }[],
  wpDomains: WpInstall[],
  sites: DirectAdminWebsite[],
): string {
  if (wpDomains.length > 0) return wpDomains[0].domain;
  const wpSite = sites.find((s) => s.hasWordPress || s.siteType === 'wordpress');
  if (wpSite?.domain) return wpSite.domain.toLowerCase();
  const withWpFlag = domainOptions.find((d) => d.hasWp);
  if (withWpFlag) return withWpFlag.domain;
  if (sites[0]?.domain) return sites[0].domain.toLowerCase();
  return '';
}

export function WPUpdateSection({
  sites,
  apiBase = '/api/admin/wp-update',
  initialDomain = '',
  autoSelectFirstWp = false,
  hideDomainSelector = false,
}: WPUpdateSectionProps) {
  const [wpDomains, setWpDomains] = useState<WpInstall[]>([]);
  const [selectedDomain, setSelectedDomain] = useState(initialDomain.toLowerCase());
  const [plugins, setPlugins] = useState<WpPlugin[]>([]);
  const [wpVersion, setWpVersion] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingPlugins, setLoadingPlugins] = useState(false);
  const [updating, setUpdating] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [autoSelected, setAutoSelected] = useState(false);

  const domainOptions = useMemo(() => {
    const fromServer = new Map(wpDomains.map((d) => [d.domain, d]));
    const merged: { domain: string; wpVersion?: string; hasWp?: boolean }[] = [];

    for (const s of sites) {
      const d = s.domain?.toLowerCase();
      if (!d) continue;
      const info = fromServer.get(d);
      merged.push({
        domain: d,
        wpVersion: info?.wpVersion,
        hasWp: Boolean(info) || s.hasWordPress,
      });
    }

    for (const d of wpDomains) {
      if (!merged.some((m) => m.domain === d.domain)) {
        merged.push({ domain: d.domain, wpVersion: d.wpVersion, hasWp: true });
      }
    }

    return merged.sort((a, b) => a.domain.localeCompare(b.domain));
  }, [sites, wpDomains]);

  const loadWpDomains = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch(apiBase);
      const data = await res.json();
      if (data.success && Array.isArray(data.installs)) {
        setWpDomains(data.installs);
      }
    } catch {
      /* sites do painel mantêm o selector */
    } finally {
      setLoadingList(false);
    }
  }, [apiBase]);

  const loadPlugins = useCallback(
    async (domain: string) => {
      if (!domain) {
        setPlugins([]);
        setWpVersion(null);
        return;
      }
      setLoadingPlugins(true);
      setMsg(null);
      try {
        const res = await fetch(`${apiBase}?domain=${encodeURIComponent(domain)}`);
        const data = await res.json();
        if (!data.success) {
          setPlugins([]);
          setWpVersion(null);
          setMsg({ ok: false, text: data.error || 'Não foi possível carregar plugins.' });
          return;
        }
        setPlugins(Array.isArray(data.plugins) ? data.plugins : []);
        setWpVersion(data.install?.wpVersion || null);
      } catch (e: unknown) {
        setPlugins([]);
        setWpVersion(null);
        setMsg({
          ok: false,
          text: e instanceof Error ? e.message : 'Erro de ligação ao servidor.',
        });
      } finally {
        setLoadingPlugins(false);
      }
    },
    [apiBase],
  );

  useEffect(() => {
    void loadWpDomains();
  }, [loadWpDomains]);

  useEffect(() => {
    if (initialDomain && !selectedDomain) {
      setSelectedDomain(initialDomain.toLowerCase());
      setAutoSelected(true);
    }
  }, [initialDomain, selectedDomain]);

  useEffect(() => {
    if (autoSelected || selectedDomain || loadingList) return;
    if (!autoSelectFirstWp && !initialDomain) return;

    const picked =
      initialDomain.toLowerCase() ||
      pickFirstWpDomain(domainOptions, wpDomains, sites);
    if (picked) {
      setSelectedDomain(picked);
      setAutoSelected(true);
    }
  }, [
    autoSelectFirstWp,
    autoSelected,
    domainOptions,
    initialDomain,
    loadingList,
    selectedDomain,
    sites,
    wpDomains,
  ]);

  useEffect(() => {
    if (selectedDomain) void loadPlugins(selectedDomain);
  }, [selectedDomain, loadPlugins]);

  const handleUpdate = async (plugin: string) => {
    if (!selectedDomain) return;
    setUpdating(plugin);
    setMsg(null);
    try {
      const res = await fetch(apiBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: selectedDomain, plugin }),
      });
      const data = await res.json();
      if (data.success) {
        setMsg({ ok: true, text: `Plugin «${plugin}» actualizado.` });
        if (Array.isArray(data.plugins)) setPlugins(data.plugins);
        else await loadPlugins(selectedDomain);
      } else {
        setMsg({ ok: false, text: data.error || data.output || 'Actualização falhou.' });
      }
    } catch (e: unknown) {
      setMsg({
        ok: false,
        text: e instanceof Error ? e.message : 'Erro ao actualizar plugin.',
      });
    } finally {
      setUpdating('');
    }
  };

  const handleUpdateAll = async () => {
    if (!selectedDomain) return;
    const pending = plugins.filter((p) => p.update === 'available');
    if (pending.length === 0) return;
    if (
      !confirm(
        `Actualizar ${pending.length} plugin(s) em ${selectedDomain}? Recomenda-se ter backup recente.`,
      )
    ) {
      return;
    }
    setUpdating('__all__');
    setMsg(null);
    try {
      const res = await fetch(apiBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: selectedDomain, all: true }),
      });
      const data = await res.json();
      if (data.success) {
        setMsg({ ok: true, text: 'Plugins actualizados com sucesso.' });
        if (Array.isArray(data.plugins)) setPlugins(data.plugins);
        else await loadPlugins(selectedDomain);
      } else {
        setMsg({ ok: false, text: data.error || data.output || 'Actualização em lote falhou.' });
      }
    } catch (e: unknown) {
      setMsg({
        ok: false,
        text: e instanceof Error ? e.message : 'Erro ao actualizar plugins.',
      });
    } finally {
      setUpdating('');
    }
  };

  const pendingCount = plugins.filter((p) => p.update === 'available').length;

  return (
    <div className="space-y-4">
      {!hideDomainSelector ? (
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedDomain}
            onChange={(e) => setSelectedDomain(e.target.value)}
            disabled={loadingList}
            className="min-w-[220px] flex-1 max-w-lg rounded border border-gray-300 px-3 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          >
            <option value="">Seleccionar domínio…</option>
            {domainOptions.map((d) => (
              <option key={d.domain} value={d.domain}>
                {d.domain}
                {d.wpVersion ? ` · WP ${d.wpVersion}` : d.hasWp ? '' : ' · (sem WP detectado)'}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => selectedDomain && void loadPlugins(selectedDomain)}
            disabled={!selectedDomain || loadingPlugins}
            className="inline-flex shrink-0 items-center gap-2 rounded border border-gray-300 px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingPlugins ? 'animate-spin' : ''}`} />
            Actualizar lista
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-bold text-gray-800 dark:text-zinc-200">
            {selectedDomain}
            {wpVersion ? ` · WordPress ${wpVersion}` : ''}
          </p>
          <button
            type="button"
            onClick={() => selectedDomain && void loadPlugins(selectedDomain)}
            disabled={!selectedDomain || loadingPlugins}
            className="inline-flex shrink-0 items-center gap-2 rounded border border-gray-300 px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingPlugins ? 'animate-spin' : ''}`} />
            Actualizar lista
          </button>
        </div>
      )}

      <div className="rounded border border-gray-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        {msg && (
          <div
            className={`mb-4 flex items-start gap-2 rounded px-4 py-2.5 text-sm font-medium ${
              msg.ok
                ? 'border border-green-200 bg-green-50 text-green-700'
                : 'border border-red-200 bg-red-50 text-red-700'
            }`}
          >
            {msg.ok ? (
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <span>{msg.text}</span>
          </div>
        )}

        {selectedDomain && pendingCount > 0 && (
          <div className="mb-4 flex justify-end">
            <button
              type="button"
              onClick={() => void handleUpdateAll()}
              disabled={updating !== '' || loadingPlugins}
              className="rounded bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {updating === '__all__' ? (
                <span className="inline-flex items-center gap-2">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" /> A actualizar…
                </span>
              ) : (
                `Actualizar todos (${pendingCount})`
              )}
            </button>
          </div>
        )}

        {loadingPlugins ? (
          <div className="py-12 text-center">
            <RefreshCw className="mx-auto h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : plugins.length > 0 ? (
          <div className="space-y-2">
            {plugins.map((p) => {
              const hasUpdate = p.update === 'available';
              return (
                <div
                  key={p.name}
                  className="flex flex-wrap items-center justify-between gap-3 rounded border border-gray-200 p-3 hover:bg-gray-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Plug className="h-5 w-5 shrink-0 text-gray-400" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-gray-900 dark:text-zinc-100">
                        {p.title || p.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-zinc-400">
                        {p.name} · v{p.version}
                        {hasUpdate && p.update_version ? ` → ${p.update_version}` : ''}
                        {p.status === 'active' ? ' · activo' : ` · ${p.status}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasUpdate ? (
                      <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-800">
                        Actualização disponível
                      </span>
                    ) : (
                      <span className="rounded bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-500 dark:bg-zinc-800 dark:text-zinc-400">
                        Actualizado
                      </span>
                    )}
                    {hasUpdate && (
                      <button
                        type="button"
                        onClick={() => void handleUpdate(p.name)}
                        disabled={updating !== ''}
                        className="rounded bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
                      >
                        {updating === p.name ? (
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          'Actualizar'
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : selectedDomain ? (
          <p className="py-8 text-center text-sm text-gray-400">
            Nenhum plugin encontrado ou WordPress não está instalado neste domínio.
          </p>
        ) : (
          <p className="py-8 text-center text-sm text-gray-400">
            Seleccione um domínio para ver os plugins instalados.
          </p>
        )}
      </div>
    </div>
  );
}
