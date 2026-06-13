'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Bell, CheckCircle, AlertTriangle, Info, RefreshCw, XCircle } from 'lucide-react';

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  category?: string;
  read: boolean;
  created_at: string;
};

const TYPE_ICON = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: XCircle,
};

function formatDate(value: string): string {
  try {
    return new Date(value).toLocaleString('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

export function ResellerNotificationsInbox({
  onUnreadChange,
}: {
  onUnreadChange?: (count: number) => void;
}) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/notifications/user', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Não foi possível carregar notificações');
      }
      const list = Array.isArray(data.notifications) ? data.notifications : [];
      setItems(list);
      onUnreadChange?.(Number(data.unreadCount) || 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar');
      setItems([]);
      onUnreadChange?.(0);
    } finally {
      setLoading(false);
    }
  }, [onUnreadChange]);

  useEffect(() => {
    void load();
  }, [load]);

  const markRead = async (id: string) => {
    try {
      await fetch('/api/notifications/user', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, read: true }),
      });
      setItems((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
      );
      const nextUnread = items.filter((n) => n.id !== id && !n.read).length;
      onUnreadChange?.(nextUnread);
    } catch {
      /* silencioso */
    }
  };

  const markAllRead = async () => {
    try {
      await fetch('/api/notifications/user', { method: 'PUT' });
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
      onUnreadChange?.(0);
    } catch {
      /* silencioso */
    }
  };

  const unread = items.filter((n) => !n.read).length;

  return (
    <div className="w-full space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-zinc-100">Notificações recebidas</h2>
          <p className="text-sm text-gray-500 dark:text-zinc-400 mt-0.5">
            {unread > 0 ? `${unread} por ler` : 'Tudo lido'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unread > 0 && (
            <button
              type="button"
              onClick={() => void markAllRead()}
              className="text-xs font-bold text-gray-600 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400 transition-colors"
            >
              Marcar todas como lidas
            </button>
          )}
          <button
            type="button"
            onClick={() => void load()}
            className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
            title="Actualizar"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}

      {loading && items.length === 0 ? (
        <div className="flex justify-center py-16">
          <RefreshCw className="w-8 h-8 animate-spin text-red-600" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded border border-gray-200 bg-white p-10 text-center dark:border-zinc-800 dark:bg-zinc-950">
          <Bell className="w-10 h-10 text-gray-300 dark:text-zinc-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-zinc-400 text-sm">Sem notificações por agora.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {items.map((n) => {
            const Icon = TYPE_ICON[n.type] || Info;
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => !n.read && void markRead(n.id)}
                className={`text-left rounded border p-4 transition-colors w-full ${
                  n.read
                    ? 'border-gray-200 bg-white dark:border-zinc-800 dark:bg-zinc-950'
                    : 'border-red-200 bg-red-50/40 dark:border-red-900/40 dark:bg-red-950/20'
                } hover:border-red-300 dark:hover:border-red-800`}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded border border-gray-200 dark:border-zinc-700 shrink-0">
                    <Icon className="w-4 h-4 text-gray-600 dark:text-zinc-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-gray-900 dark:text-zinc-100 truncate">{n.title}</p>
                      {!n.read && (
                        <span className="w-2 h-2 rounded-full bg-red-600 shrink-0" aria-hidden />
                      )}
                    </div>
                    <p className="text-xs text-gray-600 dark:text-zinc-400 mt-1 line-clamp-3">{n.message}</p>
                    <p className="text-[10px] text-gray-400 dark:text-zinc-500 mt-2">{formatDate(n.created_at)}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Badge partilhado — conta notificações não lidas do utilizador */
export function useResellerNotificationBadge(pollMs = 120_000) {
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications/user?limit=1', { cache: 'no-store' });
      const data = await res.json();
      if (data.success) setUnreadCount(Number(data.unreadCount) || 0);
    } catch {
      /* silencioso */
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), pollMs);
    return () => window.clearInterval(id);
  }, [refresh, pollMs]);

  return { unreadCount, refreshUnread: refresh };
}
