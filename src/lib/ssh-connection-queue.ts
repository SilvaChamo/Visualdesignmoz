/**
 * Limita ligações SSH simultâneas (Vercel abre 1 TCP por comando).
 * Evita MaxStartups / PORTFLOOD no servidor sem bloquear produção.
 */

const MAX_CONCURRENT = Math.max(
  1,
  Math.min(8, Number(process.env.SSH_MAX_CONCURRENT || 4) || 4),
);

let active = 0;
const waiters: Array<() => void> = [];

function acquire(): Promise<void> {
  if (active < MAX_CONCURRENT) {
    active++;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    waiters.push(() => {
      active++;
      resolve();
    });
  });
}

function release(): void {
  active = Math.max(0, active - 1);
  const next = waiters.shift();
  if (next) next();
}

export async function withSshSlot<T>(fn: () => Promise<T>): Promise<T> {
  await acquire();
  try {
    return await fn();
  } finally {
    release();
  }
}
