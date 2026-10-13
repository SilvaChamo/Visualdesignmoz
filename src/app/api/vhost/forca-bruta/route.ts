import net from 'net';
import { NextRequest, NextResponse } from 'next/server';
import { requirePanelBootstrapAccess } from '@/lib/panel-api-auth';
import { executeServerCommand } from '@/lib/server-ssh-exec';

export const dynamic = 'force-dynamic';

/**
 * /api/vhost/forca-bruta — página "Força bruta" do painel (só o administrador), no modelo do Brute Force Monitor do
 * DirectAdmin (pedido do Silva, 13/10/2026). No Contabo quem bloqueia é o fail2ban do Hestia.
 * GET  → { bloqueados, tentativas (24 h), registo (48 h), duracoes }
 * POST { acao: 'desbloquear', itens: [{ ip, cadeia }] } | { acao: 'bloquear', ips: string[], cadeia }
 */

// Corre no servidor (python3, como root): lê o Hestia, o fail2ban e os registos; desbloqueia/bloqueia.
const PY = String.raw`
import configparser, datetime, glob, ipaddress, json, re, subprocess, sys, base64
arg = json.loads(base64.b64decode(sys.argv[1]).decode())
def run(c):
    try: return subprocess.run(c, shell=True, capture_output=True, text=True, timeout=40).stdout
    except Exception: return ''
H = '/usr/local/hestia/bin'
cfg = configparser.RawConfigParser(strict=False, interpolation=None)
try: cfg.read(['/etc/fail2ban/jail.conf', '/etc/fail2ban/jail.local'] + sorted(glob.glob('/etc/fail2ban/jail.d/*.local')))
except Exception: pass
jails = [j.strip() for j in re.sub(r'(?s).*Jail list:', '', run('fail2ban-client status')).split(',') if j.strip()]
CONHECIDAS = (('dovecot', 'MAIL'), ('exim', 'MAIL'), ('ssh', 'SSH'), ('hestia', 'HESTIA'), ('vsftpd', 'FTP'), ('proftpd', 'FTP'), ('phpmyadmin', 'WEB'), ('mysql', 'DB'), ('recidive', 'RECIDIVE'))
def cadeia_de(j):
    a = cfg.get(j, 'action', fallback='') if cfg.has_section(j) else ''
    m = re.search(r'name=(\w+)', a)
    if m: return m.group(1).upper()
    return next((c for p, c in CONHECIDAS if j.startswith(p)), j.upper())
cadeia = {j: cadeia_de(j) for j in jails}
def jails_da(c): return [j for j in jails if cadeia[j] == c]

if arg.get('acao') == 'desbloquear':
    feitos = 0
    for it in arg.get('itens', []):
        ip, c = it['ip'], it['cadeia']
        run(f'{H}/v-delete-firewall-ban {ip} {c}')
        for j in jails_da(c): run(f'fail2ban-client set {j} unbanip {ip}')
        feitos += 1
    print(json.dumps({'ok': True, 'feitos': feitos})); sys.exit()

if arg.get('acao') == 'bloquear':
    proprios = set(run('hostname -I').split())
    feitos, recusados = 0, []
    for ip in arg.get('ips', []):
        a = ipaddress.ip_address(ip)
        if a.is_private or a.is_loopback or a.is_link_local or a.is_multicast or ip in proprios:
            recusados.append(ip); continue
        run(f'{H}/v-add-firewall-ban {ip} {arg["cadeia"]}')
        feitos += 1
    print(json.dumps({'ok': True, 'feitos': feitos, 'recusados': recusados})); sys.exit()

# ---- listar ----
redes = []
try: redes = [ipaddress.ip_network(l.strip(), strict=False) for l in open('/etc/fail2ban/ip-mocambique.txt') if l.strip()]
except Exception: pass
def mz(ip):
    try: a = ipaddress.ip_address(ip)
    except ValueError: return False
    return any(a.version == r.version and a in r for r in redes)

duracao, presos = {}, {}
for j in jails:
    try: bt = int((run(f'fail2ban-client get {j} bantime') or '0').strip().split()[0])
    except Exception: bt = 0
    duracao[cadeia[j]] = max(duracao.get(cadeia[j], 0), bt)
    m = re.search(r'Banned IP list:\s*(.*)', run(f'fail2ban-client status {j}'))
    for ip in (m.group(1).split() if m else []): presos.setdefault(cadeia[j], set()).add(ip)

bloqueados = []
for l in run(f'{H}/v-list-firewall-ban plain').splitlines():
    c = l.split()
    if len(c) < 4: continue
    ip, ch, hora, data = c[0], c[1].upper(), c[2], c[3]
    desde = f'{data} {hora}'
    ate = None
    if ip in presos.get(ch, set()) and duracao.get(ch):
        try: ate = (datetime.datetime.strptime(desde, '%Y-%m-%d %H:%M:%S') + datetime.timedelta(seconds=duracao[ch])).strftime('%Y-%m-%d %H:%M:%S')
        except ValueError: pass
    bloqueados.append({'ip': ip, 'cadeia': ch, 'desde': desde, 'ate': ate, 'mz': mz(ip)})

rx = re.compile(r'^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}),\d+\s+fail2ban\.\w+\s+\[\d+\]:\s+\w+\s+\[([^\]]+)\]\s+(Found|Ban|Unban|Restore Ban)\s+(\S+)')
agora = datetime.datetime.now()
eventos = []
for f in ('/var/log/fail2ban.log.1', '/var/log/fail2ban.log'):
    try:
        for l in open(f, errors='ignore'):
            m = rx.match(l)
            if not m: continue
            t = datetime.datetime.strptime(m.group(1), '%Y-%m-%d %H:%M:%S')
            if agora - t > datetime.timedelta(hours=48): continue
            eventos.append((m.group(1), cadeia.get(m.group(2), m.group(2).upper()), m.group(3), m.group(4), t))
    except OSError: pass

ativos = {b['ip'] for b in bloqueados}
tent = {}
for data, ch, acao, ip, t in eventos:
    if acao != 'Found' or agora - t > datetime.timedelta(hours=24): continue
    x = tent.setdefault(ip, {'ip': ip, 'cadeias': set(), 'n': 0, 'ultima': data})
    x['n'] += 1; x['cadeias'].add(ch); x['ultima'] = max(x['ultima'], data)
tentativas = sorted(({**x, 'cadeias': sorted(x['cadeias']), 'bloqueado': x['ip'] in ativos, 'mz': mz(x['ip'])} for x in tent.values()), key=lambda x: -x['n'])[:500]
registo = [{'data': d, 'cadeia': ch, 'acao': a, 'ip': ip, 'mz': mz(ip)} for d, ch, a, ip, t in sorted(eventos, key=lambda e: e[0], reverse=True)[:400]]
print(json.dumps({'bloqueados': bloqueados, 'tentativas': tentativas, 'registo': registo, 'duracoes': duracao}))
`;

const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64');
const CADEIA = /^[A-Z]{2,12}$/;

async function noServidor(arg: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  const out = await executeServerCommand(`python3 -c "$(echo ${b64(PY)} | base64 -d)" ${b64(JSON.stringify(arg))} 2>&1`, { timeoutMs: 90_000 });
  const l = out.split('\n').reverse().find((x) => x.trim().startsWith('{'));
  try {
    return l ? (JSON.parse(l) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

async function soAdmin() {
  const auth = await requirePanelBootstrapAccess();
  if ('error' in auth) return NextResponse.json({ erro: 'Inicie sessão no site.' }, { status: auth.error.status });
  if (auth.user.role !== 'admin') return NextResponse.json({ erro: 'Só o administrador do servidor vê esta página.' }, { status: 403 });
  return null;
}

export async function GET() {
  const recusa = await soAdmin();
  if (recusa) return recusa;
  try {
    const r = await noServidor({ acao: 'listar' });
    if (!r) return NextResponse.json({ erro: 'O servidor não respondeu.' }, { status: 502 });
    return NextResponse.json(r, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ erro: 'Sem ligação ao servidor.' }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  const recusa = await soAdmin();
  if (recusa) return recusa;
  const c = (await req.json().catch(() => ({}))) as { acao?: string; itens?: unknown; ips?: unknown; cadeia?: unknown };
  try {
    if (c.acao === 'desbloquear') {
      const itens = (Array.isArray(c.itens) ? c.itens : [])
        .map((x) => x as { ip?: unknown; cadeia?: unknown })
        .map((x) => ({ ip: String(x.ip || ''), cadeia: String(x.cadeia || '').toUpperCase() }))
        .filter((x) => net.isIP(x.ip) && CADEIA.test(x.cadeia))
        .slice(0, 500);
      if (!itens.length) return NextResponse.json({ erro: 'Escolha os IPs a desbloquear.' }, { status: 400 });
      const r = await noServidor({ acao: 'desbloquear', itens });
      return r ? NextResponse.json(r) : NextResponse.json({ erro: 'O servidor não respondeu.' }, { status: 502 });
    }
    if (c.acao === 'bloquear') {
      const cadeia = String(c.cadeia || 'RECIDIVE').toUpperCase();
      const ips = [...new Set((Array.isArray(c.ips) ? c.ips : []).map((x) => String(x).trim()).filter((x) => net.isIP(x)))].slice(0, 100);
      if (!ips.length) return NextResponse.json({ erro: 'Escreva um endereço IP válido.' }, { status: 400 });
      if (!CADEIA.test(cadeia)) return NextResponse.json({ erro: 'Serviço inválido.' }, { status: 400 });
      const r = await noServidor({ acao: 'bloquear', ips, cadeia });
      return r ? NextResponse.json(r) : NextResponse.json({ erro: 'O servidor não respondeu.' }, { status: 502 });
    }
    return NextResponse.json({ erro: 'Ação desconhecida.' }, { status: 400 });
  } catch {
    return NextResponse.json({ erro: 'Sem ligação ao servidor.' }, { status: 502 });
  }
}
