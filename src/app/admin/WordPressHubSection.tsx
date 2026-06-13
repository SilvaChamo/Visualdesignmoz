'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Archive,
  CheckCircle,
  ExternalLink,
  FolderOpen,
  Globe,
  Plug,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
  Upload,
} from 'lucide-react';
import type { DirectAdminWebsite } from '@/lib/directadmin-api';
import type { WpPluginAction } from '@/lib/wp-update-handlers';
import {
  invalidateWpPluginsCache,
  readWpInstallsCache,
  readWpPluginsCache,
  writeWpInstallsCache,
  writeWpPluginsCache,
} from '@/lib/wp-panel-cache';

import { loadScreenshot, prefetchScreenshot } from '@/lib/site-screenshot-cache';

const SELECTED_DOMAIN_KEY = 'vd_wp_selected_domain';

function WpSiteScreenshot({ domain }: { domain: string }) {
  const [src, setSrc] = useState<string | null>(() =>
    typeof window !== 'undefined' ? null : null,
  );

  useEffect(() => {
    let cancelled = false;
    setSrc(null);

    const load = async () => {
      for (let attempt = 0; attempt < 2 && !cancelled; attempt++) {
        const url = await loadScreenshot(domain, 400);
        if (cancelled) return;
        if (url) {
          setSrc(url);
          return;
        }
        await new Promise((r) => setTimeout(r, 1200));
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [domain]);

  return (
    <div className="relative h-32 w-full overflow-hidden rounded border border-gray-200 bg-gray-100 dark:border-zinc-800 dark:bg-zinc-900">
      {src ? (
        <img
          src={src}
          alt={`Pré-visualização de ${domain}`}
          className="h-full w-full object-cover object-top"
          loading="eager"
          decoding="async"
        />
      ) : (
        <div className="flex h-full items-center justify-center">
          <RefreshCw className="h-5 w-5 animate-spin text-gray-400 dark:text-zinc-500" />
        </div>
      )}
    </div>
  );
}

const WordPressInstallSection = dynamic(
  () => import('./HostingSections').then((m) => ({ default: m.WordPressInstallSection })),
  { loading: () => <div className="py-8 text-center text-sm text-gray-400">A carregar…</div> },
);
const BackupManagerSection = dynamic(
  () => import('./HostingSections').then((m) => ({ default: m.BackupManagerSection })),
  { loading: () => <div className="py-8 text-center text-sm text-gray-400">A carregar…</div> },
);

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
  path?: string;
}

export type WordPressHubTab = 'sites' | 'plugins' | 'install' | 'backup';

export type WordPressHubSectionProps = {
  sites: DirectAdminWebsite[];
  apiBase?: string;
  initialDomain?: string;
  initialTab?: WordPressHubTab;
  autoSelectFirstWp?: boolean;
  hideDomainSelector?: boolean;
  setFileManagerDomain?: (domain: string) => void;
  setActiveSection?: (section: string) => void;
  onRefresh?: () => void | Promise<void>;
};

function readPersistedDomain(): string {
  if (typeof window === 'undefined') return '';
  try {
    return sessionStorage.getItem(SELECTED_DOMAIN_KEY)?.toLowerCase() || '';
  } catch {
    return '';
  }
}

function persistDomain(domain: string) {
  if (typeof window === 'undefined' || !domain) return;
  try {
    sessionStorage.setItem(SELECTED_DOMAIN_KEY, domain.toLowerCase());
  } catch {
    /* ignore */
  }
}

function pickFirstWpDomain(
  domainOptions: { domain: string; hasWp?: boolean }[],
  wpDomains: WpInstall[],
  sites: DirectAdminWebsite[],
): string {
  const isActiveSite = (domain: string) => {
    const site = sites.find((s) => s.domain?.toLowerCase() === domain.toLowerCase());
    if (!site) return true;
    const state = String(site.state || site.status || '').toLowerCase();
    return state !== 'suspended' && state !== 'disabled' && state !== 'inactive';
  };

  if (wpDomains.length > 0) {
    const active = wpDomains.find((d) => isActiveSite(d.domain));
    if (active) return active.domain;
    return wpDomains[0].domain;
  }
  const wpSite = sites.find(
    (s) => (s.hasWordPress || s.siteType === 'wordpress') && isActiveSite(s.domain || ''),
  );
  if (wpSite?.domain) return wpSite.domain.toLowerCase();
  const withWpFlag = domainOptions.find((d) => d.hasWp && isActiveSite(d.domain));
  if (withWpFlag) return withWpFlag.domain;
  if (sites[0]?.domain) return sites[0].domain.toLowerCase();
  return '';
}

export function WordPressHubSection({
  sites,
  apiBase = '/api/admin/wp-update',
  initialDomain = '',
  initialTab = 'plugins',
  autoSelectFirstWp = false,
  hideDomainSelector = false,
  setFileManagerDomain,
  setActiveSection,
  onRefresh,
}: WordPressHubSectionProps) {
  const [tab, setTab] = useState<WordPressHubTab>(initialTab);
  const [wpDomains, setWpDomains] = useState<WpInstall[]>(() => readWpInstallsCache() || []);
  const [selectedDomain, setSelectedDomain] = useState(
    () => initialDomain.toLowerCase() || readPersistedDomain(),
  );
  const [plugins, setPlugins] = useState<WpPlugin[]>(() => {
    const d = initialDomain.toLowerCase() || readPersistedDomain();
    return d ? readWpPluginsCache(d)?.plugins || [] : [];
  });
  const [wpVersion, setWpVersion] = useState<string | null>(() => {
    const d = initialDomain.toLowerCase() || readPersistedDomain();
    return d ? readWpPluginsCache(d)?.wpVersion ?? null : null;
  });
  const [loadingList, setLoadingList] = useState(() => !readWpInstallsCache());
  const [loadingPlugins, setLoadingPlugins] = useState(false);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [autoSelected, setAutoSelected] = useState(false);
  const [highlightedSite, setHighlightedSite] = useState('');
  const [installSlug, setInstallSlug] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const loadWpDomains = useCallback(async (options?: { fresh?: boolean }) => {
    if (!options?.fresh) {
      const cached = readWpInstallsCache();
      if (cached?.length) {
        setWpDomains(cached);
        setLoadingList(false);
      } else {
        setLoadingList(true);
      }
    } else {
      setLoadingList(true);
    }

    try {
      const res = await fetch(apiBase, { credentials: 'include' });
      const data = await res.json();
      if (data.success && Array.isArray(data.installs)) {
        setWpDomains(data.installs);
        writeWpInstallsCache(data.installs);
      }
    } catch {
      /* mantém cache ou sites do painel */
    } finally {
      setLoadingList(false);
    }
  }, [apiBase]);

  const loadPlugins = useCallback(
    async (domain: string, options?: { fresh?: boolean }) => {
      if (!domain) {
        setPlugins([]);
        setWpVersion(null);
        return;
      }

      const cached = !options?.fresh ? readWpPluginsCache(domain) : null;
      if (cached) {
        setPlugins(cached.plugins);
        setWpVersion(cached.wpVersion);
        if (!options?.fresh) return;
      }

      setLoadingPlugins(true);
      setMsg(null);
      try {
        const res = await fetch(`${apiBase}?domain=${encodeURIComponent(domain)}`, {
          credentials: 'include',
        });
        const data = await res.json();
        if (!data.success) {
          if (!cached) {
            setPlugins([]);
            setWpVersion(null);
            setMsg({ ok: false, text: data.error || 'Não foi possível carregar plugins.' });
          }
          return;
        }
        const rows = Array.isArray(data.plugins) ? data.plugins : [];
        const version = data.install?.wpVersion || null;
        setPlugins(rows);
        setWpVersion(version);
        writeWpPluginsCache(domain, rows, version);
      } catch (e: unknown) {
        if (!cached) {
          setPlugins([]);
          setWpVersion(null);
          setMsg({
            ok: false,
            text: e instanceof Error ? e.message : 'Erro de ligação ao servidor.',
          });
        }
      } finally {
        setLoadingPlugins(false);
      }
    },
    [apiBase],
  );

  const postAction = useCallback(
    async (payload: Record<string, unknown>) => {
      if (!selectedDomain) return;
      setBusy(String(payload.action || payload.plugin || '__all__'));
      setMsg(null);
      try {
        const res = await fetch(apiBase, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ domain: selectedDomain, ...payload }),
        });
        const data = await res.json();
        if (data.success) {
          setMsg({ ok: true, text: data.output || 'Operação concluída.' });
          if (Array.isArray(data.plugins)) {
            setPlugins(data.plugins);
            writeWpPluginsCache(selectedDomain, data.plugins, wpVersion);
          } else {
            invalidateWpPluginsCache(selectedDomain);
            await loadPlugins(selectedDomain, { fresh: true });
          }
        } else {
          setMsg({ ok: false, text: data.error || data.output || 'Operação falhou.' });
        }
      } catch (e: unknown) {
        setMsg({
          ok: false,
          text: e instanceof Error ? e.message : 'Erro na operação.',
        });
      } finally {
        setBusy('');
      }
    },
    [apiBase, loadPlugins, selectedDomain],
  );

  const handlePluginAction = (action: WpPluginAction, plugin?: string) => {
    if (action === 'updateAll') {
      const pending = plugins.filter((p) => p.update === 'available');
      if (pending.length === 0) return;
      if (!confirm(`Actualizar ${pending.length} plugin(s) em ${selectedDomain}?`)) return;
      void postAction({ all: true, action: 'updateAll' });
      return;
    }
    void postAction({ action, plugin });
  };

  const handleInstallFromRepo = () => {
    const slug = installSlug.trim();
    if (!slug) return;
    void postAction({ action: 'install', slug, activate: true });
    setInstallSlug('');
  };

  const handleUploadZip = async (file: File | null) => {
    if (!file || !selectedDomain) return;
    if (!file.name.toLowerCase().endsWith('.zip')) {
      setMsg({ ok: false, text: 'Seleccione um ficheiro .zip' });
      return;
    }
    setBusy('upload');
    setMsg(null);
    try {
      const form = new FormData();
      form.append('domain', selectedDomain);
      form.append('action', 'upload');
      form.append('file', file);
      const res = await fetch(apiBase, { method: 'POST', credentials: 'include', body: form });
      const data = await res.json();
      if (data.success) {
        setMsg({ ok: true, text: data.output || 'Plugin instalado a partir do ZIP.' });
        if (Array.isArray(data.plugins)) {
          setPlugins(data.plugins);
          writeWpPluginsCache(selectedDomain, data.plugins, wpVersion);
        } else {
          invalidateWpPluginsCache(selectedDomain);
          await loadPlugins(selectedDomain, { fresh: true });
        }
      } else {
        setMsg({ ok: false, text: data.error || data.output || 'Upload falhou.' });
      }
    } catch (e: unknown) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Erro no upload.' });
    } finally {
      setBusy('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (selectedDomain) persistDomain(selectedDomain);
  }, [selectedDomain]);

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
    if (selectedDomain && tab === 'plugins') {
      void loadPlugins(selectedDomain);
    }
  }, [selectedDomain, tab, loadPlugins]);

  const pendingCount = plugins.filter((p) => p.update === 'available').length;
  const siteCards =
    wpDomains.length > 0
      ? wpDomains.map((w) => ({
          domain: w.domain,
          version: w.wpVersion,
          owner: sites.find((s) => s.domain?.toLowerCase() === w.domain)?.owner || '',
        }))
      : domainOptions
          .filter((d) => d.hasWp)
          .map((d) => ({
            domain: d.domain,
            version: d.wpVersion,
            owner: sites.find((s) => s.domain?.toLowerCase() === d.domain)?.owner || '',
          }));

  useEffect(() => {
    siteCards.forEach((s) => void prefetchScreenshot(s.domain, 400));
  }, [siteCards]);

  useEffect(() => {
    if (tab !== 'sites' || siteCards.length === 0) return;
    const firstActive =
      siteCards.find((s) => {
        const site = sites.find((x) => x.domain?.toLowerCase() === s.domain);
        if (!site) return true;
        const state = String(site.state || site.status || '').toLowerCase();
        return state !== 'suspended' && state !== 'disabled' && state !== 'inactive';
      })?.domain || siteCards[0].domain;
    if (!highlightedSite && firstActive) {
      setHighlightedSite(firstActive);
      persistDomain(firstActive);
      setSelectedDomain(firstActive);
    }
  }, [tab, siteCards, sites, highlightedSite]);

  return (
    <div className="space-y-4">
      {tab === 'sites' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void loadWpDomains({ fresh: true })}
              disabled={loadingList}
              className="inline-flex items-center gap-2 rounded border border-gray-300 px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingList ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
          </div>
          {loadingList && siteCards.length === 0 ? (
            <div className="py-16 text-center">
              <RefreshCw className="mx-auto h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : siteCards.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {siteCards.map((s) => (
                <div
                  key={s.domain}
                  className={`space-y-4 rounded border bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:bg-zinc-950 ${
                    highlightedSite === s.domain
                      ? 'border-red-400 ring-2 ring-red-500/40 dark:border-red-500'
                      : 'border-gray-200 dark:border-zinc-800'
                  }`}
                  onClick={() => {
                    setHighlightedSite(s.domain);
                    persistDomain(s.domain);
                    setSelectedDomain(s.domain);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      setHighlightedSite(s.domain);
                      persistDomain(s.domain);
                      setSelectedDomain(s.domain);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <WpSiteScreenshot domain={s.domain} />
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-gray-900 dark:text-zinc-100">
                        {s.domain}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-zinc-500">
                        {s.owner || 'admin'}
                        {s.version ? ` · WP ${s.version}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <a
                      href={`https://${s.domain}/wp-admin`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex w-full items-center justify-center gap-2 rounded border border-gray-300 bg-gray-50 px-4 py-2.5 text-xs font-bold text-gray-700 transition-all hover:border-red-400 hover:bg-red-50 hover:text-red-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-red-500 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Abrir WP Admin
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        if (setFileManagerDomain) setFileManagerDomain(s.domain);
                        setTimeout(() => setActiveSection?.('file-manager'), 50);
                      }}
                      className="flex w-full items-center justify-center gap-2 rounded border border-gray-300 bg-gray-50 px-4 py-2 text-xs font-bold text-gray-700 transition-all hover:border-red-400 hover:bg-red-50 hover:text-red-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-red-500 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                    >
                      <FolderOpen className="h-3.5 w-3.5" /> Ficheiros
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        persistDomain(s.domain);
                        setSelectedDomain(s.domain);
                        setActiveSection?.('wp-plugins');
                      }}
                      className="flex w-full items-center justify-center gap-2 rounded border border-gray-300 bg-gray-50 px-4 py-2 text-xs font-bold text-gray-700 transition-all hover:border-red-400 hover:bg-red-50 hover:text-red-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-red-500 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                    >
                      <Plug className="h-3.5 w-3.5" /> Gerir plugins
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-16 text-center text-gray-400">
              <Globe className="mx-auto mb-3 h-12 w-12 opacity-30" />
              <p className="font-medium">Nenhum WordPress detectado no servidor.</p>
              <button
                type="button"
                onClick={() => setActiveSection?.('wordpress-install')}
                className="mt-3 text-sm font-bold text-indigo-600 hover:underline"
              >
                Instalar WordPress
              </button>
            </div>
          )}
        </div>
      )}

      {tab === 'plugins' && (
        <div className="space-y-4">
          {!hideDomainSelector ? (
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={selectedDomain}
                onChange={(e) => setSelectedDomain(e.target.value)}
                disabled={loadingList}
                className="min-w-[220px] max-w-lg flex-1 rounded border border-gray-300 px-3 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              >
                <option value="">Seleccionar domínio…</option>
                {domainOptions.map((d) => (
                  <option key={d.domain} value={d.domain}>
                    {d.domain}
                    {d.wpVersion ? ` · WP ${d.wpVersion}` : d.hasWp ? '' : ' · (sem WP)'}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => selectedDomain && void loadPlugins(selectedDomain, { fresh: true })}
                disabled={!selectedDomain || loadingPlugins}
                className="inline-flex shrink-0 items-center gap-2 rounded border border-gray-300 px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingPlugins ? 'animate-spin' : ''}`} />
                Actualizar lista
              </button>
            </div>
          ) : (
            <p className="text-sm font-bold text-gray-800 dark:text-zinc-200">
              {selectedDomain}
              {wpVersion ? ` · WordPress ${wpVersion}` : ''}
            </p>
          )}

          {selectedDomain && (
            <div className="flex flex-wrap gap-2 rounded border border-gray-200 bg-gray-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
              <div className="flex min-w-[200px] flex-1 items-center gap-2">
                <input
                  value={installSlug}
                  onChange={(e) => setInstallSlug(e.target.value)}
                  placeholder="Instalar do repositório (ex: litespeed-cache)"
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  onKeyDown={(e) => e.key === 'Enter' && handleInstallFromRepo()}
                />
                <button
                  type="button"
                  onClick={handleInstallFromRepo}
                  disabled={!installSlug.trim() || busy !== ''}
                  className="inline-flex shrink-0 items-center gap-1 rounded bg-green-600 px-3 py-2 text-xs font-bold text-white hover:bg-green-700 disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" /> Instalar
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip"
                className="hidden"
                onChange={(e) => void handleUploadZip(e.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={busy !== ''}
                className="inline-flex items-center gap-2 rounded border border-indigo-300 bg-indigo-50 px-4 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
              >
                {busy === 'upload' ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
                Upload ZIP
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
                  onClick={() => handlePluginAction('updateAll')}
                  disabled={busy !== '' || loadingPlugins}
                  className="rounded bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {busy === 'updateAll' ? (
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
                  const isActive = p.status === 'active';
                  const hasUpdate = p.update === 'available';
                  const isBusy = busy === p.name;
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
                            {isActive ? ' · activo' : ` · ${p.status}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {hasUpdate && (
                          <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-800">
                            Actualização
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            handlePluginAction(isActive ? 'deactivate' : 'activate', p.name)
                          }
                          disabled={busy !== ''}
                          className={`rounded px-3 py-1.5 text-xs font-bold disabled:opacity-50 ${
                            isActive
                              ? 'bg-red-50 text-red-700 hover:bg-red-100'
                              : 'bg-green-50 text-green-700 hover:bg-green-100'
                          }`}
                        >
                          {isBusy ? (
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          ) : isActive ? (
                            'Desactivar'
                          ) : (
                            'Activar'
                          )}
                        </button>
                        {hasUpdate && (
                          <button
                            type="button"
                            onClick={() => handlePluginAction('update', p.name)}
                            disabled={busy !== ''}
                            className="rounded bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
                          >
                            Actualizar
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            if (!confirm(`Apagar plugin «${p.title || p.name}»?`)) return;
                            handlePluginAction('delete', p.name);
                          }}
                          disabled={busy !== ''}
                          className="rounded bg-gray-100 px-2 py-1.5 text-xs text-gray-600 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                          title="Apagar"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
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
                Seleccione um domínio para gerir plugins.
              </p>
            )}
          </div>
        </div>
      )}

      {tab === 'install' && (
        <WordPressInstallSection sites={sites} onRefresh={onRefresh} />
      )}

      {tab === 'backup' && (
        <BackupManagerSection sites={sites} initialDomain={selectedDomain || sites[0]?.domain} />
      )}
    </div>
  );
}

/** @deprecated Use WordPressHubSection */
export function WPUpdateSection(props: WordPressHubSectionProps) {
  return <WordPressHubSection {...props} initialTab="plugins" />;
}
