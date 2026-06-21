'use client';

import React, { useState, useEffect } from 'react';
import {
  RefreshCw, Trash2, Key, ExternalLink, AlertCircle, CheckCircle, User, Shield, Calendar, Mail, Eye, EyeOff, Globe, ChevronRight, Gauge
} from 'lucide-react';
import type { DirectAdminWebsite } from '@/lib/directadmin-api';
import { readWpInstallsCache } from '@/lib/panel-wp-cache';
import { WpUserForm } from './WpUserForm';

interface WpUser {
  ID: string;
  user_login: string;
  user_email: string;
  roles: string;
  user_registered: string;
}

interface WordPressUsersSectionProps {
  sites: DirectAdminWebsite[];
  isActive: boolean;
  setActiveSection?: (section: string) => void;
}

function formatRoleName(role: string): string {
  const r = role.toLowerCase();
  if (r.includes('administrator')) return 'Administrador';
  if (r.includes('editor')) return 'Editor';
  if (r.includes('author')) return 'Autor';
  if (r.includes('contributor')) return 'Colaborador';
  if (r.includes('subscriber')) return 'Subscritor';
  return role;
}

export function WordPressUsersSection({ sites, isActive, setActiveSection }: WordPressUsersSectionProps) {
  const [domains, setDomains] = useState<string[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<string>('');
  const [users, setUsers] = useState<WpUser[]>([]);
  const [loadingDomains, setLoadingDomains] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [actionBusy, setActionBusy] = useState<string>(''); // 'delete-[username]', 'login-[username]'
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Form states
  const [editingUser, setEditingUser] = useState<WpUser | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [usersCache, setUsersCache] = useState<Record<string, WpUser[]>>({});

  // Carregar domínios WordPress
  useEffect(() => {
    if (!isActive) return;

    const fetchDomains = async () => {
      // 1. Obter do cache local primeiro
      const cachedAdmin = readWpInstallsCache('admin');
      const cachedReseller = readWpInstallsCache('reseller');
      const cached = Array.from(new Set([...cachedAdmin, ...cachedReseller]));

      // 2. Obter das propriedades dos sites (do espelho Supabase)
      const fromSites = sites
        .map((s) => s.domain.toLowerCase());

      const mergedInitial = Array.from(new Set([...cached, ...fromSites])).sort();
      setDomains(mergedInitial);
      setLoadingDomains(false);
    };

    void fetchDomains();
  }, [sites, isActive]);

  // Capturar domínio pré-selecionado (ex: quando vem de um card do website)
  useEffect(() => {
    if (!isActive || domains.length === 0) return;

    // @ts-ignore
    const globalSelected = window.__selectedWpDomain;
    if (globalSelected) {
      const normalized = globalSelected.toLowerCase();
      if (domains.includes(normalized)) {
        setSelectedDomain(normalized);
      }
      // @ts-ignore
      window.__selectedWpDomain = null;
    } else if (!selectedDomain && domains.length > 0) {
      setSelectedDomain(domains[0]);
    }
  }, [domains, isActive]);

  // Carregar utilizadores do domínio selecionado
  const loadUsers = async (domain: string) => {
    if (!domain) {
      setUsers([]);
      return;
    }

    if (usersCache[domain]) {
      setUsers(usersCache[domain]);
      return;
    }

    setLoadingUsers(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/wp-users?domain=${encodeURIComponent(domain)}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.users)) {
        setUsers(data.users);
        setUsersCache((prev) => ({ ...prev, [domain]: data.users }));
      } else {
        setUsers([]);
        setMsg({ ok: false, text: data.error || 'Não foi possível carregar os utilizadores.' });
      }
    } catch (e: unknown) {
      setUsers([]);
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Erro ao ligar ao servidor.' });
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    // Hide form if domain changes
    setEditingUser(null);
    setIsCreating(false);
    if (selectedDomain && isActive) {
      void loadUsers(selectedDomain);
    }
  }, [selectedDomain, isActive]);

  // Eliminar Utilizador
  const handleDeleteUser = async (username: string) => {
    if (!selectedDomain) return;
    if (!confirm(`⚠️ Deseja eliminar o utilizador "${username}"?\n\nEsta acção removerá o utilizador de forma definitiva do WordPress.`)) return;

    setActionBusy(`delete-${username}`);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/wp-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: selectedDomain,
          action: 'delete',
          username,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setMsg({ ok: true, text: `Utilizador "${username}" eliminado com sucesso.` });
        
        // Remove from cache and state
        setUsers((prev) => prev.filter((u) => u.user_login !== username));
        setUsersCache((prev) => {
          const newCache = { ...prev };
          if (newCache[selectedDomain]) {
            newCache[selectedDomain] = newCache[selectedDomain].filter((u) => u.user_login !== username);
          }
          return newCache;
        });
      } else {
        setMsg({ ok: false, text: data.error || 'Erro ao eliminar utilizador.' });
      }
    } catch (e: any) {
      setMsg({ ok: false, text: e.message || 'Erro ao ligar ao servidor.' });
    } finally {
      setActionBusy('');
    }
  };

  // Login automático (Entrar)
  const handleAutoLogin = async (username: string) => {
    if (!selectedDomain) return;

    setActionBusy(`login-${username}`);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/wp-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: selectedDomain,
          action: 'autologin',
          username,
        }),
      });

      const data = await res.json();
      if (data.success && data.url) {
        window.open(data.url, '_blank');
      } else {
        setMsg({ ok: false, text: data.error || 'Erro ao gerar token de acesso automático.' });
      }
    } catch (e: any) {
      setMsg({ ok: false, text: e.message || 'Erro ao solicitar acesso automático.' });
    } finally {
      setActionBusy('');
    }
  };

  return (
    <div className="space-y-6 text-gray-900 dark:text-zinc-100">
      
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-200 pb-4 dark:border-zinc-800 flex-wrap">
        {/* Lado Esquerdo: Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          <button
            type="button"
            onClick={() => setActiveSection?.('wp-sites')}
            className="font-medium transition-colors hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            WordPress
          </button>
          <ChevronRight size={12} />
          {(isCreating || editingUser) ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  setEditingUser(null);
                }}
                className="font-medium transition-colors hover:text-red-600 dark:hover:text-red-400"
              >
                Contas WordPress
              </button>
              <ChevronRight size={12} />
              <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                {isCreating ? 'Criar conta' : 'Editar conta'}
              </span>
            </>
          ) : (
            <span className="font-semibold text-zinc-800 dark:text-zinc-200">
              Contas WordPress
            </span>
          )}
        </div>

        {/* Lado Direito: Controlos */}
        <div className="flex items-center gap-3">
          {/* Dropdown de Domínio com Ícone Globe */}
          <div className="relative inline-flex items-center gap-2">
            <Globe className="h-4 w-4 text-zinc-400" />
            <select
              value={selectedDomain}
              onChange={(e) => setSelectedDomain(e.target.value)}
              disabled={loadingDomains || loadingUsers}
              className="rounded border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 pl-2.5 pr-8 text-xs text-zinc-800 dark:text-zinc-300 outline-none focus:border-zinc-400 dark:focus:border-zinc-700 cursor-pointer appearance-none min-w-[140px] h-8"
            >
              {loadingDomains && <option value="">A carregar...</option>}
              {domains.map((domain) => (
                <option key={domain} value={domain}>
                  {domain}
                </option>
              ))}
            </select>
            <div className="absolute right-2.5 pointer-events-none text-zinc-400 select-none">
              <span className="text-[9px]">▼</span>
            </div>
          </div>

          {selectedDomain && (
            <button
              type="button"
              onClick={() => window.open(`https://${selectedDomain}/wp-admin`, '_blank')}
              className="inline-flex items-center justify-center gap-1.5 rounded border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-all cursor-pointer uppercase tracking-wider h-8"
            >
              <Gauge size={13} />
              Painel do WordPress
            </button>
          )}

          {/* Botão de Adicionar Novo */}
          {selectedDomain && !isCreating && !editingUser && (
            <button
              onClick={() => setIsCreating(true)}
              className="inline-flex items-center justify-center gap-1.5 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all uppercase tracking-wider h-8 whitespace-nowrap"
            >
              + Adicionar novo
            </button>
          )}
        </div>
      </div>

      {/* Alertas / Mensagens */}
      {msg && !isCreating && !editingUser && (
        <div
          className={`flex items-start gap-2 rounded border px-4 py-2.5 text-sm font-medium ${
            msg.ok
              ? 'border-emerald-500/20 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-500'
              : 'border-red-500/20 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-500'
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

      {/* Tabela de Utilizadores (Escondida se estiver a criar/editar para focar no form) */}
      {!isCreating && !editingUser && (
        <div className="overflow-x-auto rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
        {loadingUsers ? (
          <div className="py-12 text-center">
            <RefreshCw className="mx-auto h-8 w-8 animate-spin text-zinc-400" />
            <p className="mt-2 text-xs text-zinc-500">A obter utilizadores WordPress do servidor...</p>
          </div>
        ) : users.length > 0 ? (
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">E-mail</th>
                <th className="px-4 py-3">Login</th>
                <th className="px-4 py-3 text-center">Registado</th>
                <th className="px-4 py-3">Funções</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {users.map((user) => {
                const isLoggingIn = actionBusy === `login-${user.user_login}`;
                const isDeleting = actionBusy === `delete-${user.user_login}`;
                
                // Formatar data
                let formattedDate = '—';
                if (user.user_registered) {
                  try {
                    const date = new Date(user.user_registered);
                    formattedDate = date.toLocaleDateString('pt-PT', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    }) + ', ' + date.toLocaleTimeString('pt-PT', {
                      hour: '2-digit',
                      minute: '2-digit',
                    });
                  } catch {
                    formattedDate = user.user_registered;
                  }
                }

                return (
                  <tr key={user.ID} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/20 transition-colors">
                    <td className="px-4 py-3.5 font-medium text-zinc-900 dark:text-zinc-100">{user.user_login}</td>
                    <td className="px-4 py-3.5 text-zinc-600 dark:text-zinc-400">{user.user_email}</td>
                    <td className="px-4 py-3.5 text-zinc-600 dark:text-zinc-400">{user.user_login}</td>
                    <td className="px-4 py-3.5 text-center text-zinc-500 dark:text-zinc-500 text-xs">{formattedDate}</td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-1 rounded bg-zinc-100 dark:bg-zinc-900 px-2 py-0.5 text-xs text-zinc-700 dark:text-zinc-300">
                        {formatRoleName(user.roles)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          disabled={actionBusy !== ''}
                          onClick={() => setEditingUser(user)}
                          className="px-3 py-1 text-xs font-medium rounded border border-zinc-300 dark:border-zinc-700 bg-transparent text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-all disabled:opacity-50 inline-flex items-center"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          disabled={actionBusy !== ''}
                          onClick={() => handleAutoLogin(user.user_login)}
                          className="px-3 py-1 text-xs font-medium rounded border border-zinc-300 dark:border-zinc-700 bg-transparent text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-all disabled:opacity-50 inline-flex items-center gap-1"
                        >
                          {isLoggingIn ? (
                            <RefreshCw className="h-3 w-3 animate-spin" />
                          ) : (
                            <ExternalLink size={12} />
                          )}
                          Entrar
                        </button>
                        <button
                          type="button"
                          disabled={actionBusy !== ''}
                          onClick={() => handleDeleteUser(user.user_login)}
                          className="p-1 rounded border border-red-200 dark:border-red-950/40 bg-transparent text-red-500 hover:bg-red-500/10 transition-all disabled:opacity-50"
                          title="Eliminar utilizador"
                        >
                          {isDeleting ? (
                            <RefreshCw className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 size={13} />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : selectedDomain ? (
          <div className="py-12 text-center text-zinc-500">
            <User className="mx-auto h-8 w-8 text-zinc-400 mb-2" />
            <p className="text-sm">Nenhum utilizador WordPress encontrado para este domínio.</p>
          </div>
        ) : (
          <div className="py-12 text-center text-zinc-500">
            <User className="mx-auto h-8 w-8 text-zinc-400 mb-2" />
            <p className="text-sm">Por favor, seleccione um domínio WordPress.</p>
          </div>
        )}
      </div>
      )}

      {/* Formulário (Criação e Edição) */}
      {(isCreating || editingUser) && selectedDomain && (
        <WpUserForm
          domain={selectedDomain}
          user={editingUser}
          onSave={() => {
            setMsg({ ok: true, text: `Utilizador ${editingUser ? 'atualizado' : 'criado'} com sucesso!` });
            setIsCreating(false);
            setEditingUser(null);
            
            // Invalidate cache for this domain to force reload
            setUsersCache((prev) => {
              const newCache = { ...prev };
              delete newCache[selectedDomain];
              return newCache;
            });
            void loadUsers(selectedDomain);
          }}
          onCancel={() => {
            setIsCreating(false);
            setEditingUser(null);
          }}
        />
      )}
    </div>
  );
}
