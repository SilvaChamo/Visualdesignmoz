/**
 * Leituras do painel: espelho Supabase primeiro (resposta imediata);
 * API DirectAdmin só se o espelho estiver vazio.
 */

import type { PanelPackage } from '@/lib/directadmin-hosting-api';

/** União por nome — o espelho prevalece (pacotes criados no painel). */
export function mergePackageListByName(
  mirror: PanelPackage[],
  resolved: PanelPackage[],
): PanelPackage[] {
  const byName = new Map<string, PanelPackage>();
  for (const p of resolved) {
    const key = p.packageName.toLowerCase();
    if (key) byName.set(key, p);
  }
  for (const p of mirror) {
    const key = p.packageName.toLowerCase();
    if (key) byName.set(key, p);
  }
  return [...byName.values()].sort((a, b) => a.packageName.localeCompare(b.packageName));
}

export async function resolveMirrorOrLive<T>(options: {
  mirror: () => Promise<T[]>;
  live: () => Promise<T[]>;
  onStale?: () => void;
  /** @deprecated verificação de stale é feita em background quando o espelho tem dados */
  stale?: boolean;
}): Promise<T[]> {
  const { mirror, live, onStale } = options;

  const data = await mirror();
  const hasMirror = Array.isArray(data) && data.length > 0;

  if (hasMirror) {
    if (onStale) {
      void import('@/lib/panel-mirror-read').then(({ isMirrorStale }) =>
        isMirrorStale(5).then((stale) => {
          if (stale) onStale();
        }),
      );
    }
    return data;
  }

  if (onStale) onStale();

  try {
    const liveData = await live();
    if (Array.isArray(liveData) && liveData.length > 0) return liveData;
  } catch {
    /* IP bloqueado / sem acesso directo — devolver espelho vazio */
  }

  return Array.isArray(data) ? data : [];
}
