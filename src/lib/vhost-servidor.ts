/**
 * VisualHost — leitura do servidor Hestia num só pedido (só comandos v-list-* e leituras do sistema).
 *
 * Um único script corre no servidor (localmente no Contabo, por SSH em desenvolvimento) e devolve, por
 * secções: contas, pacotes, informação do sistema, IPs, recursos (CPU, memória, disco, carga) e, por conta,
 * domínios web (com WordPress), zonas DNS, domínios de e-mail e contas de e-mail. Nada é alterado.
 *
 * Fica em memória 60 s; depois disso devolve a última leitura e lê de novo em segundo plano (até 10 min).
 */
import { executeServerCommand } from '@/lib/server-ssh-exec';

type Linha = Record<string, string>;
type Tabela = Record<string, Linha>;

export type LeituraServidor = {
  users: Tabela;
  packages: Tabela;
  sysinfo: Linha;
  ips: Tabela;
  servicos: Tabela;
  /** versões PHP instaladas (ex.: ["8.2","8.3"]) */
  php: string[];
  /** bases de dados por conta */
  db: Record<string, Tabela>;
  /** discoTotal/discoUsado: a partição do sistema (df /); discoFisico: o tamanho de todos os discos (lsblk) — se for
   *  maior do que a partição, o disco foi aumentado mas a partição ainda não foi alargada. cpuPct: consumo real do CPU
   *  medido durante 1 s (/proc/stat), em % de todos os núcleos */
  recursos: { cpus: number; memTotal: number; memUsada: number; memLivre: number; discoTotal: number; discoUsado: number; discoFisico: number; cpuPct: number; carga: [number, number, number] };
  web: Record<string, Tabela>;
  wp: Record<string, string[]>;
  dns: Record<string, Tabela>;
  mail: Record<string, Tabela>;
  /** contas de e-mail: { conta: { domínio: { utilizador: campos } } } */
  mailAcc: Record<string, Record<string, Tabela>>;
  lidoEm: string;
};

// Tudo em paralelo (cada parte para um ficheiro temporário); o mais lento é o estado dos serviços (~2 s).
const SCRIPT = String.raw`
H=/usr/local/hestia/bin
T=$(mktemp -d)
( echo "@@USERS"; $H/v-list-users json ) > $T/0a &
( echo "@@PACKAGES"; $H/v-list-user-packages json ) > $T/0b &
( echo "@@SYSINFO"; $H/v-list-sys-info json ) > $T/0c &
( echo "@@IPS"; $H/v-list-sys-ips json ) > $T/0d &
( echo "@@SERV"; $H/v-list-sys-services json ) > $T/0e &
( echo "@@PHP"; $H/v-list-sys-php json ) > $T/0g &
( echo "@@RES"; nproc; free -b | awk '/^Mem:/{print $2, $3, $7}'; df -B1 --output=size,used / | tail -1; cat /proc/loadavg
  lsblk -bdno SIZE,TYPE 2>/dev/null | awk '$2=="disk"{s+=$1} END{print s+0}'
  head -1 /proc/stat | cut -d' ' -f2-; sleep 1; head -1 /proc/stat | cut -d' ' -f2- ) > $T/0f &
for u in $(ls /usr/local/hestia/data/users/); do
  ( echo "@@WEB $u"; $H/v-list-web-domains "$u" json
    for d in $($H/v-list-web-domains "$u" plain | cut -f1); do [ -f "/home/$u/web/$d/public_html/wp-config.php" ] && echo "@@WP $u $d"; done ) > "$T/1-$u-web" &
  ( echo "@@DNS $u"; $H/v-list-dns-domains "$u" json ) > "$T/1-$u-dns" &
  ( echo "@@MAIL $u"; $H/v-list-mail-domains "$u" json ) > "$T/1-$u-mail" &
  ( echo "@@DB $u"; $H/v-list-databases "$u" json ) > "$T/1-$u-db" &
  for d in $(cut -d"'" -f2 "/usr/local/hestia/data/users/$u/mail.conf" 2>/dev/null); do
    ( echo "@@MAILACC $u $d"; $H/v-list-mail-accounts "$u" "$d" json ) > "$T/2-$u-$d" &
  done
done
wait
cat $T/*; rm -rf "$T"
echo "@@FIM"
`;

function json<T>(linhas: string[] | undefined, vazio: T): T {
  const txt = (linhas || []).join('\n').trim();
  if (!txt) return vazio;
  try {
    return JSON.parse(txt) as T;
  } catch {
    return vazio;
  }
}

export function interpretarLeitura(out: string): LeituraServidor {
  const secs = new Map<string, string[]>();
  let cur: string[] | null = null;
  for (const line of out.split('\n')) {
    if (line.startsWith('@@')) {
      cur = [];
      secs.set(line.slice(2).trim(), cur);
    } else if (cur) cur.push(line);
  }
  if (!secs.has('FIM')) throw new Error('Leitura do servidor incompleta');

  const res = (secs.get('RES') || []).map((l) => l.trim().split(/\s+/).map(Number));
  const r: LeituraServidor = {
    users: json<Tabela>(secs.get('USERS'), {}),
    packages: json<Tabela>(secs.get('PACKAGES'), {}),
    sysinfo: Object.values(json<Tabela>(secs.get('SYSINFO'), {}))[0] || {},
    ips: json<Tabela>(secs.get('IPS'), {}),
    servicos: json<Tabela>(secs.get('SERV'), {}),
    php: (() => {
      const p = json<unknown>(secs.get('PHP'), []);
      const l = Array.isArray(p) ? p : Object.keys(p as object);
      return l.map(String).filter((v) => /^\d+\.\d+$/.test(v)).sort();
    })(),
    db: {},
    recursos: {
      cpus: res[0]?.[0] || 1,
      memTotal: res[1]?.[0] || 0,
      memUsada: res[1]?.[1] || 0,
      memLivre: res[1]?.[2] || 0,
      discoTotal: res[2]?.[0] || 0,
      discoUsado: res[2]?.[1] || 0,
      carga: [res[3]?.[0] || 0, res[3]?.[1] || 0, res[3]?.[2] || 0],
      discoFisico: res[4]?.[0] || 0,
      cpuPct: (() => {
        // /proc/stat: user nice system idle iowait irq softirq steal … — duas leituras com 1 s de intervalo
        const a = (res[5] || []).filter((n) => !Number.isNaN(n)), b = (res[6] || []).filter((n) => !Number.isNaN(n));
        if (a.length < 4 || b.length < 4) return -1;
        const tot = (v: number[]) => v.slice(0, 8).reduce((x, y) => x + y, 0);
        const livre = (v: number[]) => (v[3] || 0) + (v[4] || 0);
        const dt = tot(b) - tot(a);
        return dt > 0 ? Math.max(0, Math.min(100, Math.round(((dt - (livre(b) - livre(a))) / dt) * 1000) / 10)) : -1;
      })(),
    },
    web: {},
    wp: {},
    dns: {},
    mail: {},
    mailAcc: {},
    lidoEm: new Date().toISOString(),
  };
  for (const [k, v] of secs) {
    const [tipo, u, d] = k.split(' ');
    if (!u) continue;
    if (tipo === 'WEB') r.web[u] = json<Tabela>(v, {});
    else if (tipo === 'DNS') r.dns[u] = json<Tabela>(v, {});
    else if (tipo === 'MAIL') r.mail[u] = json<Tabela>(v, {});
    else if (tipo === 'DB') r.db[u] = json<Tabela>(v, {});
    else if (tipo === 'WP' && d) (r.wp[u] ||= []).push(d);
    else if (tipo === 'MAILACC' && d) (r.mailAcc[u] ||= {})[d] = json<Tabela>(v, {});
  }
  return r;
}


const FRESCO_MS = 60_000;
const VELHO_MS = 10 * 60_000;
let cache: { at: number; dados: LeituraServidor } | null = null;
let aLer: Promise<LeituraServidor> | null = null;

function lerAgora(): Promise<LeituraServidor> {
  if (!aLer) {
    // o mesmo tempo no computador local e em produção: 4 s no local não chegava e o painel mostrava dados inventados
    aLer = executeServerCommand(`bash -s <<'VHOST_FIM'\n${SCRIPT}\nVHOST_FIM`, { timeoutMs: 25_000 })
      .then((out) => {
        const dados = interpretarLeitura(out);
        cache = { at: Date.now(), dados };
        return dados;
      })
      .catch((err) => {
        if (cache) {
          console.warn('[vhost-servidor] Servidor remoto não respondeu, a usar último cache:', err?.message || err);
          return cache.dados;
        }
        // nunca dados inventados no lugar dos reais (pedido do Silva, 13/10/2026): sem leitura, o painel avisa e deixa
        // tentar de novo
        console.error('[vhost-servidor] Não foi possível ler o servidor:', err);
        throw err;
      })
      .finally(() => {
        aLer = null;
      });
  }
  return aLer;
}

/** Leitura do servidor (com memória de 60 s). `forcar` lê já, por exemplo depois de uma alteração. */
export async function lerServidor(forcar = false): Promise<LeituraServidor> {
  const idade = cache ? Date.now() - cache.at : Infinity;
  if (!forcar && cache && idade < FRESCO_MS) return cache.dados;
  if (!forcar && cache && idade < VELHO_MS) {
    lerAgora().catch(() => {});
    return cache.dados;
  }
  return lerAgora();
}

/** Esquece a leitura guardada (a próxima vai ao servidor). */
export function esquecerLeitura(): void {
  cache = null;
}
