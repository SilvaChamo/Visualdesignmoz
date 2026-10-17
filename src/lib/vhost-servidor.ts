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
   *  (/proc/stat) entre a leitura anterior e esta, em % de todos os núcleos; -1 quando não há medida (ver cpuEntreLeituras) */
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
# CPU: /proc/stat no início e no fim da leitura (o consumo calcula-se entre leituras, ver cpuEntreLeituras)
C1=$(head -1 /proc/stat | cut -d' ' -f2-)
( echo "@@USERS"; $H/v-list-users json ) > $T/0a &
( echo "@@PACKAGES"; $H/v-list-user-packages json ) > $T/0b &
( echo "@@SYSINFO"; $H/v-list-sys-info json ) > $T/0c &
( echo "@@IPS"; $H/v-list-sys-ips json ) > $T/0d &
( echo "@@SERV"; $H/v-list-sys-services json ) > $T/0e &
( echo "@@PHP"; $H/v-list-sys-php json ) > $T/0g &
( echo "@@RES"; nproc; free -b | awk '/^Mem:/{print $2, $3, $7}'; df -B1 --output=size,used / | tail -1; cat /proc/loadavg
  lsblk -bdno SIZE,TYPE 2>/dev/null | awk '$2=="disk"{s+=$1} END{print s+0}' ) > $T/0f &
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
echo "@@CPU"; echo "$C1"; head -1 /proc/stat | cut -d' ' -f2-
cat $T/*; rm -rf "$T"
echo "@@FIM"
`;

/** Mais do que isto desde a leitura anterior, a média já não diz como está o CPU agora: o painel usa a carga média */
const CPU_INTERVALO_MAX_MS = 10 * 60_000;

/**
 * Consumo do CPU (% de todos os núcleos) entre o fim da leitura anterior e o início desta — o tempo em que a leitura do
 * painel não está a correr. Medido durante a leitura dava sempre 100% (é ela que ocupa os núcleos — Silva, 15/10/2026)
 * e descontar o que ela gasta também não serve (rouba CPU aos outros processos e o valor saía mais baixo do que o
 * real); antes parava-se 1 s antes de cada leitura para medir, e cada leitura (a do login também) demorava +1 s.
 * Com o painel aberto há uma leitura a cada 1–2 min, por isso é a média desse tempo. -1 (o painel usa então a carga
 * média) na primeira leitura depois de arrancar e com mais de 10 min desde a anterior.
 * /proc/stat: user nice system idle iowait irq softirq steal … (em centésimos de segundo, por núcleo)
 */
export function cpuEntreLeituras(linhas: string[] | undefined, cpus: number): number {
  const nums = (l: string | undefined) => (l || '').trim().split(/\s+/).map(Number).filter((n) => !Number.isNaN(n));
  const inicio = nums(linhas?.[0]), fim = nums(linhas?.[1]);
  const ant = m.cpuAnterior;
  let pct = -1;
  if (ant && inicio.length >= 4 && Date.now() - ant.at <= CPU_INTERVALO_MAX_MS) {
    const tot = (v: number[]) => v.slice(0, 8).reduce((x, y) => x + y, 0);
    const livre = (v: number[]) => (v[3] || 0) + (v[4] || 0);
    const dt = tot(inicio) - tot(ant.fim);
    // menos de 1 s entre as duas (ex.: uma leitura logo a seguir a outra, depois de uma alteração): fica o valor anterior
    if (dt > 0 && dt < 100 * Math.max(1, cpus)) pct = ant.pct;
    else if (dt > 0) pct = Math.max(0, Math.min(100, Math.round(((dt - (livre(inicio) - livre(ant.fim))) / dt) * 1000) / 10));
  }
  if (fim.length >= 4) m.cpuAnterior = { fim, at: Date.now(), pct };
  return pct;
}

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
      cpuPct: cpuEntreLeituras(secs.get('CPU'), res[0]?.[0] || 1),
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
type Memoria = {
  cache: { at: number; dados: LeituraServidor } | null;
  aLer: { geracao: number; p: Promise<LeituraServidor> } | null;
  // Cada alteração (esquecerLeitura) abre uma geração nova: uma leitura que começou antes da alteração já não pode voltar
  // a pôr os dados velhos na memória. Antes, mudar o pacote de uma conta a meio de uma leitura deixava o painel a mostrar
  // o pacote antigo até 10 min — "o servidor diz que mudou mas não muda" (Silva, 16/10/2026).
  geracao: number;
  /** A última leitura que correu bem, que fica mesmo depois de uma alteração (esquecerLeitura) — só para a página do
   *  painel vir já desenhada ao recarregar, nunca em branco à espera do servidor (Silva, 16/10/2026); o painel lê a
   *  versão nova logo a seguir (/api/vhost/dados) */
  ultima: { at: number; dados: LeituraServidor } | null;
  /** /proc/stat no fim da leitura anterior, quando foi e o consumo calculado nessa altura (ver cpuEntreLeituras) */
  cpuAnterior?: { fim: number[]; at: number; pct: number } | null;
};
// Uma só memória por processo: a leitura feita ao arrancar o site (src/instrumentation-node.ts) carrega este ficheiro
// numa cópia à parte da das páginas e rotas — sem isto, não servia ao primeiro pedido do painel
const g = globalThis as typeof globalThis & { __vhostServidor?: Memoria };
const m: Memoria = (g.__vhostServidor ??= { cache: null, aLer: null, geracao: 0, ultima: null });
/** Até quando a última leitura serve para desenhar a página (só mostra; o painel atualiza-a no segundo seguinte) */
const PAGINA_MS = 24 * 60 * 60_000;

function lerAgora(): Promise<LeituraServidor> {
  if (!m.aLer || m.aLer.geracao !== m.geracao) {
    const minha = m.geracao;
    // o mesmo tempo no computador local e em produção: 4 s no local não chegava e o painel mostrava dados inventados
    const p: Promise<LeituraServidor> = executeServerCommand(`bash -s <<'VHOST_FIM'\n${SCRIPT}\nVHOST_FIM`, { timeoutMs: 25_000 })
      .then((out) => {
        const dados = interpretarLeitura(out);
        if (minha === m.geracao) m.cache = { at: Date.now(), dados };
        m.ultima = { at: Date.now(), dados };
        return dados;
      })
      .catch((err) => {
        if (m.cache) {
          console.warn('[vhost-servidor] Servidor remoto não respondeu, a usar último cache:', err?.message || err);
          return m.cache.dados;
        }
        // nunca dados inventados no lugar dos reais (pedido do Silva, 13/10/2026): sem leitura, o painel avisa e deixa
        // tentar de novo
        console.error('[vhost-servidor] Não foi possível ler o servidor:', err);
        throw err;
      })
      .finally(() => {
        if (m.aLer?.p === p) m.aLer = null;
      });
    m.aLer = { geracao: minha, p };
  }
  return m.aLer.p;
}

/** Leitura do servidor (com memória de 60 s). `forcar` lê já, por exemplo depois de uma alteração. */
export async function lerServidor(forcar = false): Promise<LeituraServidor> {
  const { cache } = m;
  const idade = cache ? Date.now() - cache.at : Infinity;
  if (!forcar && cache && idade < FRESCO_MS) return cache.dados;
  if (!forcar && cache && idade < VELHO_MS) {
    lerAgora().catch(() => {});
    return cache.dados;
  }
  return lerAgora();
}

/** Para a página do painel: a última leitura que houver (lendo a seguinte por trás, se já não for fresca); só espera
 *  pelo servidor se ainda não leu nada desde que o site arrancou */
export async function lerServidorParaPagina(): Promise<LeituraServidor> {
  const { ultima, cache } = m;
  if (!ultima || Date.now() - ultima.at > PAGINA_MS) return lerAgora();
  if (!cache || Date.now() - cache.at >= FRESCO_MS) lerAgora().catch(() => {});
  return ultima.dados;
}

/** Esquece a leitura guardada (a próxima vai ao servidor). */
export function esquecerLeitura(): void {
  m.cache = null;
  m.geracao++;
}
