import { NextRequest, NextResponse } from 'next/server';
import { requirePanelBootstrapAccess } from '@/lib/panel-api-auth';
import { executeServerCommand } from '@/lib/server-ssh-exec';

export const dynamic = 'force-dynamic';

/**
 * /api/vhost/admin-servidor — páginas do menu "Ferramentas de admin" do painel VisualHost (só o administrador), no
 * modelo do DirectAdmin (Process Monitor e Service Monitor).
 * GET  ?ver=processos  → { processos (CPU medido agora, durante 1 s), cpu, nucleos, memoria, carga }
 * GET  ?ver=servicos   → { servicos } (os do Hestia: estado, CPU, memória, há quanto tempo)
 * POST { acao: 'processo-parar', pids: number[], forcar?: boolean }   (SIGTERM; forcar = SIGKILL)
 * POST { acao: 'servico', nome, op: 'reiniciar' | 'parar' | 'iniciar' }
 * Os processos do próprio site, do SSH, do Hestia e do sistema não se param daqui (os serviços reiniciam-se nos Serviços).
 */

// Corre no servidor (python3, como root). Os argumentos das linhas de comando vão com as palavras-passe tapadas.
const PY = String.raw`
import json, os, re, signal, subprocess, sys, time, base64, pwd
arg = json.loads(base64.b64decode(sys.argv[1]).decode())
H = '/usr/local/hestia/bin'
def run(c, t=60):
    try: return subprocess.run(c, shell=True, capture_output=True, text=True, timeout=t).stdout
    except Exception: return ''
HZ = os.sysconf('SC_CLK_TCK')
PROTEGIDOS = re.compile(r'^(systemd.*|init|kthreadd|sshd|PM2.*|pm2.*|hestia.*|mariadbd|mysqld|postgres|dockerd|containerd.*|cron|rsyslogd|dbus-daemon|fail2ban-server|named|agetty|polkitd|networkd-dispat|udisksd|unattended-upgr)$')
def tapa(s):
    s = re.sub(r'(Bearer )\S+', r'\1***', s)
    s = re.sub(r'((?:-|_)?pass(?:word)?\d*[ =:])\S+', r'\1***', s, flags=re.I)
    return re.sub(r'((?:key|token|secret)=)[^\s&"]+', r'\1***', s, flags=re.I)
def proprio(pid, args):
    # o site (next-server / npm start) e o que corre nesta mesma pasta: parar era desligar o painel
    return 'visualdesign-site' in args or args.startswith('next-server') or pid == os.getpid() or pid == os.getppid()
def ler_stat():
    r = {}
    for p in os.listdir('/proc'):
        if not p.isdigit(): continue
        try:
            s = open(f'/proc/{p}/stat').read()
            f = s[s.rfind(')') + 2:].split()
            r[int(p)] = (int(f[11]) + int(f[12]), int(f[21]), s[s.find('(') + 1:s.rfind(')')], int(f[1]))
        except Exception: pass
    return r
def total_cpu():
    v = [int(x) for x in open('/proc/stat').readline().split()[1:]]
    return sum(v), v[3] + v[4]

acao = arg.get('acao')
if acao == 'processo-parar':
    sinal = signal.SIGKILL if arg.get('forcar') else signal.SIGTERM
    feitos, recusados = [], []
    for pid in arg.get('pids', []):
        try:
            comm = open(f'/proc/{pid}/comm').read().strip()
            args = open(f'/proc/{pid}/cmdline').read().replace('\0', ' ').strip()
        except Exception:
            recusados.append({'pid': pid, 'porque': 'já não existe'}); continue
        if pid <= 2 or not args or PROTEGIDOS.match(comm) or proprio(pid, args) or args.startswith('nginx: master') or args.startswith('/usr/sbin/exim4 -bd') or comm == 'dovecot':
            recusados.append({'pid': pid, 'porque': 'protegido'}); continue
        try:
            os.kill(pid, sinal); feitos.append(pid)
        except Exception as e:
            recusados.append({'pid': pid, 'porque': str(e)})
    time.sleep(2)
    vivos = [p for p in feitos if os.path.exists(f'/proc/{p}')]
    print(json.dumps({'ok': True, 'parados': [p for p in feitos if p not in vivos], 'ainda': vivos, 'recusados': recusados})); sys.exit()

if acao == 'servico':
    nome, op = arg['nome'], arg['op']
    lista = json.loads(run(f'{H}/v-list-sys-services json') or '{}')
    if nome not in lista: print(json.dumps({'ok': False, 'erro': 'Serviço desconhecido.'})); sys.exit()
    if op == 'parar' and re.match(r'^(nginx|hestia|ssh|sshd|mariadb|mysql)$', nome):
        print(json.dumps({'ok': False, 'erro': 'Este serviço não se pára daqui (o site ou o painel ficavam em baixo). Pode reiniciá-lo.'})); sys.exit()
    cmd = {'reiniciar': 'v-restart-service', 'parar': 'v-stop-service', 'iniciar': 'v-start-service'}[op]
    out = subprocess.run([f'{H}/{cmd}', nome], capture_output=True, text=True, timeout=120)
    print(json.dumps({'ok': out.returncode == 0, 'erro': (out.stdout + out.stderr).strip()[-300:] if out.returncode else ''})); sys.exit()

if arg.get('ver') == 'servicos':
    lista = json.loads(run(f'{H}/v-list-sys-services json') or '{}')
    print(json.dumps({'servicos': [{'nome': n, 'sistema': v.get('SYSTEM', ''), 'ativo': v.get('STATE') == 'running', 'cpu': float(v.get('CPU') or 0), 'memMb': float(v.get('MEM') or 0), 'ha': int(float(v.get('RTIME') or 0))} for n, v in lista.items()]})); sys.exit()

# ---- processos: CPU de cada um medido agora (1 s), como o "top" ----
a, (ta, ia) = ler_stat(), total_cpu()
time.sleep(1.0)
b, (tb, ib) = ler_stat(), total_cpu()
nucleos = os.cpu_count() or 1
dt = max(1, tb - ta)
cpu_total = round(100.0 * (dt - (ib - ia)) / dt, 1)
paginas = os.sysconf('SC_PAGE_SIZE')
mem = {l.split(':')[0]: int(l.split()[1]) for l in open('/proc/meminfo') if l.split(':')[0] in ('MemTotal', 'MemAvailable')}
procs = []
for pid, (t1, rss, comm, ppid) in b.items():
    t0 = a.get(pid, (t1,))[0]
    try:
        args = open(f'/proc/{pid}/cmdline').read().replace('\0', ' ').strip()
        uid = os.stat(f'/proc/{pid}').st_uid
        try: user = pwd.getpwuid(uid).pw_name
        except Exception: user = str(uid)
    except Exception: continue
    if not args: continue  # tarefas do núcleo
    pc = round(100.0 * (t1 - t0) / HZ / ((tb - ta) / nucleos / HZ if tb > ta else 1), 1)
    procs.append({'pid': pid, 'ppid': ppid, 'user': user, 'nome': comm, 'cpu': max(0.0, pc), 'tempo': round(t1 / HZ), 'memMb': round(rss * paginas / 1048576, 1), 'cmd': tapa(args)[:220],
                  'protegido': bool(pid <= 2 or PROTEGIDOS.match(comm) or proprio(pid, args) or args.startswith('nginx: master') or args.startswith('/usr/sbin/exim4 -bd') or comm == 'dovecot')})
procs.sort(key=lambda p: (-p['cpu'], -p['tempo']))
print(json.dumps({'processos': procs[:300], 'total': len(procs), 'cpu': cpu_total, 'nucleos': nucleos, 'memTotalMb': round(mem.get('MemTotal', 0) / 1024), 'memLivreMb': round(mem.get('MemAvailable', 0) / 1024), 'carga': [float(x) for x in open('/proc/loadavg').read().split()[:3]]}))
`;

const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64');
const SERVICO = /^[a-z0-9@._-]{2,60}$/;

async function noServidor(arg: Record<string, unknown>, timeoutMs = 60_000): Promise<Record<string, unknown> | null> {
  const out = await executeServerCommand(`python3 -c "$(echo ${b64(PY)} | base64 -d)" ${b64(JSON.stringify(arg))} 2>&1`, { timeoutMs });
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

export async function GET(req: NextRequest) {
  const recusa = await soAdmin();
  if (recusa) return recusa;
  const ver = req.nextUrl.searchParams.get('ver');
  if (ver !== 'processos' && ver !== 'servicos') return NextResponse.json({ erro: 'Página desconhecida.' }, { status: 400 });
  try {
    const r = await noServidor({ ver });
    if (!r) return NextResponse.json({ erro: 'O servidor não respondeu.' }, { status: 502 });
    return NextResponse.json(r, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ erro: 'Sem ligação ao servidor.' }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  const recusa = await soAdmin();
  if (recusa) return recusa;
  const c = (await req.json().catch(() => ({}))) as { acao?: string; pids?: unknown; forcar?: unknown; nome?: unknown; op?: unknown };
  try {
    if (c.acao === 'processo-parar') {
      const pids = [...new Set((Array.isArray(c.pids) ? c.pids : []).map(Number).filter((n) => Number.isSafeInteger(n) && n > 2))].slice(0, 50);
      if (!pids.length) return NextResponse.json({ erro: 'Escolha os processos a parar.' }, { status: 400 });
      const r = await noServidor({ acao: 'processo-parar', pids, forcar: c.forcar === true });
      return r ? NextResponse.json(r) : NextResponse.json({ erro: 'O servidor não respondeu.' }, { status: 502 });
    }
    if (c.acao === 'servico') {
      const nome = String(c.nome || '');
      const op = String(c.op || '');
      if (!SERVICO.test(nome) || !['reiniciar', 'parar', 'iniciar'].includes(op)) return NextResponse.json({ erro: 'Pedido inválido.' }, { status: 400 });
      const r = await noServidor({ acao: 'servico', nome, op }, 150_000);
      if (!r) return NextResponse.json({ erro: 'O servidor não respondeu.' }, { status: 502 });
      return r.ok ? NextResponse.json(r) : NextResponse.json({ erro: String(r.erro || 'Não foi possível.') }, { status: 400 });
    }
    return NextResponse.json({ erro: 'Ação desconhecida.' }, { status: 400 });
  } catch {
    return NextResponse.json({ erro: 'Sem ligação ao servidor.' }, { status: 502 });
  }
}
