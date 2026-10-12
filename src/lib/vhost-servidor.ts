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
  recursos: { cpus: number; memTotal: number; memUsada: number; memLivre: number; discoTotal: number; discoUsado: number; carga: [number, number, number] };
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
( echo "@@RES"; nproc; free -b | awk '/^Mem:/{print $2, $3, $7}'; df -B1 --output=size,used / | tail -1; cat /proc/loadavg ) > $T/0f &
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

export function criarLeituraFallback(): LeituraServidor {
  const agora = new Date().toISOString();
  return {
    users: {
      vdadmin: { ROLE: 'admin', PACKAGE: 'default', DISK_QUOTA: 'unlimited', BANDWIDTH: 'unlimited', U_DISK: '1240', U_BANDWIDTH: '3500' },
      silvachamo: { ROLE: 'admin', PACKAGE: 'default', DISK_QUOTA: 'unlimited', BANDWIDTH: 'unlimited', U_DISK: '850', U_BANDWIDTH: '2100' },
      osher: { ROLE: 'user', PACKAGE: 'default', DISK_QUOTA: '10000', BANDWIDTH: '50000', U_DISK: '420', U_BANDWIDTH: '1200' },
      revenda: { ROLE: 'reseller', PACKAGE: 'default', DISK_QUOTA: '50000', BANDWIDTH: '200000', U_DISK: '1100', U_BANDWIDTH: '4500' },
      cliente1: { ROLE: 'user', PACKAGE: 'default', DISK_QUOTA: '2000', BANDWIDTH: '10000', U_DISK: '95', U_BANDWIDTH: '300' },
    },
    packages: {
      default: { WEB_DOMAINS: 'unlimited', MAIL_DOMAINS: 'unlimited', MAIL_ACCOUNTS: 'unlimited', DATABASES: 'unlimited', DISK_QUOTA: 'unlimited', BANDWIDTH: 'unlimited', SHELL: 'bash' },
      Completo: { WEB_DOMAINS: 'unlimited', MAIL_DOMAINS: 'unlimited', MAIL_ACCOUNTS: 'unlimited', DATABASES: 'unlimited', DISK_QUOTA: 'unlimited', BANDWIDTH: 'unlimited', SHELL: 'bash' },
      'Só e-mail': { WEB_DOMAINS: '0', MAIL_DOMAINS: '1', MAIL_ACCOUNTS: '10', DATABASES: '0', DISK_QUOTA: '2048', BANDWIDTH: '10240', SHELL: 'nologin' },
    },
    sysinfo: {
      OS: 'Ubuntu 24.04 LTS',
      ARCH: 'x86_64',
      HESTIA: '1.9.3',
      PHP: '8.3',
      WEB: 'nginx',
      NAME: 'Contabo-VPS',
    },
    ips: {
      '169.58.148.144': { IP: '169.58.148.144', STATUS: 'shared', U_SYS_USERS: '5', U_WEB_DOMAINS: '8' },
    },
    servicos: {
      nginx: { STATE: 'running', CPU: '0.2', MEM: '45' },
      apache2: { STATE: 'running', CPU: '0.4', MEM: '110' },
      mariadb: { STATE: 'running', CPU: '0.6', MEM: '380' },
      dovecot: { STATE: 'running', CPU: '0.1', MEM: '32' },
      exim4: { STATE: 'running', CPU: '0.1', MEM: '28' },
      named: { STATE: 'running', CPU: '0.1', MEM: '24' },
    },
    php: ['8.1', '8.2', '8.3'],
    recursos: {
      cpus: 4,
      memTotal: 8 * 1024 * 1024 * 1024,
      memUsada: 3.2 * 1024 * 1024 * 1024,
      memLivre: 4.8 * 1024 * 1024 * 1024,
      discoTotal: 200 * 1024 * 1024 * 1024,
      discoUsado: 42 * 1024 * 1024 * 1024,
      carga: [0.35, 0.42, 0.38],
    },
    web: {
      vdadmin: {
        'visualdesignmoz.com': { IP: '169.58.148.144', U_DISK: '1240', U_BANDWIDTH: '3500', SSL: 'yes', PHP_CLI: '8.3', DOCUMENT_ROOT: '/home/vdadmin/web/visualdesignmoz.com/public_html', SUSPENDED: 'no' },
        'teste.visualdesignmoz.com': { IP: '169.58.148.144', U_DISK: '480', U_BANDWIDTH: '1200', SSL: 'yes', PHP_CLI: '8.3', DOCUMENT_ROOT: '/home/vdadmin/web/teste.visualdesignmoz.com/public_html', SUSPENDED: 'no' },
        'loja-exemplo.co.mz': { IP: '169.58.148.144', U_DISK: '220', U_BANDWIDTH: '800', SSL: 'yes', PHP_CLI: '8.3', DOCUMENT_ROOT: '/home/vdadmin/web/loja-exemplo.co.mz/public_html', SUSPENDED: 'no' },
      },
      silvachamo: {
        'silvachamo.co.mz': { IP: '169.58.148.144', U_DISK: '310', U_BANDWIDTH: '900', SSL: 'yes', PHP_CLI: '8.3', DOCUMENT_ROOT: '/home/silvachamo/web/silvachamo.co.mz/public_html', SUSPENDED: 'no' },
        'visualdesignmoz.com': { IP: '169.58.148.144', U_DISK: '1240', U_BANDWIDTH: '3500', SSL: 'yes', PHP_CLI: '8.3', DOCUMENT_ROOT: '/home/silvachamo/web/visualdesignmoz.com/public_html', SUSPENDED: 'no' },
      },
      osher: {
        'oshercollective.com': { IP: '169.58.148.144', U_DISK: '420', U_BANDWIDTH: '1200', SSL: 'yes', PHP_CLI: '8.3', DOCUMENT_ROOT: '/home/osher/web/oshercollective.com/public_html', SUSPENDED: 'no' },
      },
      cliente1: {
        'so-email-exemplo.co.mz': { IP: '169.58.148.144', U_DISK: '95', U_BANDWIDTH: '300', SSL: 'yes', PHP_CLI: '8.3', DOCUMENT_ROOT: '/home/cliente1/web/so-email-exemplo.co.mz/public_html', SUSPENDED: 'no' },
      },
    },
    wp: {
      vdadmin: ['loja-exemplo.co.mz'],
    },
    dns: {
      vdadmin: {
        'visualdesignmoz.com': { TIPO: 'MASTER', IP: '169.58.148.144', SOA: 'ns1.visualdesignmoz.com', TTL: '14400' },
        'teste.visualdesignmoz.com': { TIPO: 'MASTER', IP: '169.58.148.144', SOA: 'ns1.visualdesignmoz.com', TTL: '14400' },
      },
    },
    mail: {
      vdadmin: {
        'visualdesignmoz.com': { U_DISK: '520', ACCOUNTS: '3', ANTIVIRUS: 'yes', SPAMASSASSIN: 'yes' },
      },
    },
    mailAcc: {
      vdadmin: {
        'visualdesignmoz.com': {
          admin: { U_DISK: '210', QUOTA: '2000', SUSPENDED: 'no' },
          geral: { U_DISK: '310', QUOTA: '2000', SUSPENDED: 'no' },
        },
      },
    },
    db: {
      vdadmin: {
        vdadmin_wp: { TYPE: 'mysql', HOST: 'localhost', CHARSET: 'utf8mb4', U_DISK: '45' },
      },
    },
    lidoEm: agora,
  };
}

const FRESCO_MS = 60_000;
const VELHO_MS = 10 * 60_000;
let cache: { at: number; dados: LeituraServidor } | null = null;
let aLer: Promise<LeituraServidor> | null = null;

function lerAgora(): Promise<LeituraServidor> {
  if (!aLer) {
    const timeoutMs = process.env.NODE_ENV === 'development' ? 4_000 : 25_000;
    aLer = executeServerCommand(`bash -s <<'VHOST_FIM'\n${SCRIPT}\nVHOST_FIM`, { fast: process.env.NODE_ENV === 'development', timeoutMs })
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
        if (process.env.NODE_ENV !== 'development') {
          console.error('[vhost-servidor] Não foi possível ler o servidor:', err);
          throw err;
        }
        console.warn('[vhost-servidor] Servidor remoto inacessível (ambiente local/timeout). A ativar dados de contingência.');
        const fallback = criarLeituraFallback();
        cache = { at: Date.now(), dados: fallback };
        return fallback;
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
