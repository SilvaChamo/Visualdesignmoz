/**
 * Contas ligadas ao painel (Admin › Gestão de contas › Contas ligadas — pedido do Silva, 16/10/2026): quem tem o painel
 * aberto agora, em que conta e plano, de onde (IP → cidade e país) e com que aparelho.
 *
 * Cada painel aberto avisa a cada minuto (POST /api/vhost/presenca); aqui fica em memória do servidor (um só processo no
 * Contabo). Uma pessoa some da lista 30 min depois do último aviso. Ao reiniciar o site a lista volta a encher-se num
 * minuto — não é um registo histórico.
 */
export type Presenca = {
  /** id da pessoa (Supabase Auth) */
  uid: string;
  email: string;
  nome: string;
  papel: string;
  /** conta do servidor da própria pessoa */
  conta: string;
  /** conta que está a ver ("entrar como"), quando não é a sua */
  aVer: string;
  ip: string;
  local: string;
  aparelho: string;
  pagina: string;
  desde: number;
  ultimo: number;
};

const GUARDA_MS = 30 * 60_000;
const presencas = new Map<string, Presenca>();

export function registarPresenca(p: Omit<Presenca, 'desde' | 'local'> & { local?: string }): Presenca {
  const antes = presencas.get(p.uid);
  // nova entrada (ou outra máquina): conta outra vez desde agora
  const desde = antes && antes.ip === p.ip && Date.now() - antes.ultimo < GUARDA_MS ? antes.desde : Date.now();
  const nova: Presenca = { ...p, local: p.local || antes?.local || '', desde };
  presencas.set(p.uid, nova);
  return nova;
}

export function listarPresencas(): Presenca[] {
  const limite = Date.now() - GUARDA_MS;
  for (const [k, v] of presencas) if (v.ultimo < limite) presencas.delete(k);
  return [...presencas.values()].sort((a, b) => b.ultimo - a.ultimo);
}

/** "Chrome · Windows", "Safari · iPhone" … */
export function aparelhoDe(ua: string): string {
  const nav = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Navegador';
  const so = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  return so ? `${nav} · ${so}` : nav;
}

const PRIVADO = /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fc|fd|fe80)/i;
const locais = new Map<string, { local: string; ate: number }>();

/** Cidade e país do IP (ipwho.is, guardado 24 h por IP). Sem resposta em 3 s fica vazio e tenta-se no aviso seguinte. */
export async function localDoIp(ip: string): Promise<string> {
  if (!ip || PRIVADO.test(ip)) return ip ? 'Rede local' : '';
  const g = locais.get(ip);
  if (g && g.ate > Date.now()) return g.local;
  try {
    const r = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}?fields=success,city,region,country`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(3_000),
    });
    const j = (await r.json()) as { success?: boolean; city?: string; region?: string; country?: string };
    if (!j.success) return '';
    const local = [j.city || j.region, j.country].filter(Boolean).join(', ');
    locais.set(ip, { local, ate: Date.now() + 24 * 3_600_000 });
    return local;
  } catch {
    return '';
  }
}
