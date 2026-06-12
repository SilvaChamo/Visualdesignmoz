/**
 * Estatísticas do servidor via SSH (fallback fiável quando CMD_API_SYSTEM não responde).
 */

import { executeServerCommand } from '@/lib/server-ssh-exec';

export type ServerStats = {
  source: 'ssh' | 'directadmin';
  cpu: string;
  memory: string;
  disk: string;
  load?: string;
  uptime?: string;
  cores?: string;
  [key: string]: string | undefined;
};

function parseKeyValueOutput(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of raw.split('\n')) {
    const idx = line.indexOf('=');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key && value) out[key] = value;
  }
  return out;
}

export async function fetchServerStatsViaSsh(): Promise<ServerStats> {
  const cmd = [
    "free -m | awk '/Mem:/ {printf \"MEM_USED=%s\\nMEM_TOTAL=%s\\n\", $3, $2}'",
    "df -h / | awk 'NR==2 {printf \"DISK_USED=%s\\nDISK_TOTAL=%s\\nDISK_PCT=%s\\n\", $3, $2, $5}'",
    "awk '{printf \"LOAD=%s\\n\", $1}' /proc/loadavg",
    'echo "CORES=$(nproc)"',
    "uptime -p 2>/dev/null | sed 's/^/UPTIME=/' || uptime | sed 's/.*,/UPTIME=/'",
  ].join('; ');

  const raw = await executeServerCommand(cmd);
  const kv = parseKeyValueOutput(raw);

  const memUsed = kv.MEM_USED || '?';
  const memTotal = kv.MEM_TOTAL || '?';
  const diskUsed = kv.DISK_USED || '?';
  const diskTotal = kv.DISK_TOTAL || '?';
  const diskPct = kv.DISK_PCT || '';

  return {
    source: 'ssh',
    cpu: kv.CORES ? `${kv.CORES} núcleos` : '—',
    cores: kv.CORES,
    memory: `${memUsed} / ${memTotal} MB`,
    disk: diskPct ? `${diskUsed} / ${diskTotal} (${diskPct})` : `${diskUsed} / ${diskTotal}`,
    load: kv.LOAD,
    uptime: kv.UPTIME?.replace(/^up\s+/i, '') || undefined,
  };
}
