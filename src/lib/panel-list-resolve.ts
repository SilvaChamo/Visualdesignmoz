/**
 * Leituras do painel: espelho Supabase primeiro (resposta imediata);
 * API DirectAdmin só se o espelho estiver vazio.
 */

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
