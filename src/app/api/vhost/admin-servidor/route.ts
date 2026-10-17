import { NextRequest, NextResponse } from 'next/server';
import { requirePanelBootstrapAccess } from '@/lib/panel-api-auth';
import net from 'net';
import { executeServerCommand } from '@/lib/server-ssh-exec';
import { ADMIN_PY } from '@/lib/vhost-admin-py';

export const dynamic = 'force-dynamic';

/**
 * /api/vhost/admin-servidor — páginas do menu "Ferramentas de admin" do painel VisualHost (só o administrador), no
 * modelo do DirectAdmin (Process Monitor e Service Monitor).
 * GET  ?ver=processos  → { processos (CPU medido agora, durante 1 s), cpu, nucleos, memoria, carga }
 * GET  ?ver=servicos   → { servicos } (os do Hestia: estado, CPU, memória, há quanto tempo)
 * GET  ?ver=ips | cron | bd | fila | mail-resumo (&horas=) | mail-rastreio (&q=&horas=) | logs (&ficheiro=&linhas=&q=) |
 *      firewall  → as outras páginas de administração (script em src/lib/vhost-admin-py.ts)
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

/** O script das outras páginas de administração (src/lib/vhost-admin-py.ts) */
async function noServidorAdmin(arg: Record<string, unknown>, timeoutMs = 120_000): Promise<Record<string, unknown> | null> {
  const out = await executeServerCommand(`python3 -c "$(echo ${b64(ADMIN_PY)} | base64 -d)" ${b64(JSON.stringify(arg))} 2>&1`, { timeoutMs });
  const l = out.split('\n').reverse().find((x) => x.trim().startsWith('{'));
  try {
    return l ? (JSON.parse(l) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
const VER_ADMIN = new Set(['ips', 'cron', 'bd', 'fila', 'mail-resumo', 'mail-rastreio', 'logs', 'firewall', 'php', 'atualizacoes', 'pacotes', 'tls', 'definicoes', 'multi', 'backups', 'backup-sistema', 'httpd', 'basedir', 'security-txt', 'modsec', 'extras', 'importar', 'manutencao', 'estatisticas']);
const DOM = /^(?=.{3,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;
const CONTA = /^[a-z0-9][a-z0-9_.-]{0,31}$/;
const HOST = /^(?=.{3,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
const EXIM_ID = /^[0-9A-Za-z-]{16,23}$/;
const lista = (v: unknown) => (Array.isArray(v) ? v : []);

/** Valida um pedido de alteração das páginas de administração; devolve o que segue para o servidor ou o erro */
function pedidoAdmin(c: Record<string, unknown>): Record<string, unknown> | string {
  const acao = String(c.acao || '');
  const ids = (re: RegExp) => [...new Set(lista(c.ids).map(String).filter((x) => re.test(x)))].slice(0, 500);
  switch (acao) {
    case 'ip-estado':
      return net.isIP(String(c.ip)) && ['shared', 'dedicated'].includes(String(c.estado)) ? { acao, ip: String(c.ip), estado: String(c.estado) } : 'Pedido inválido.';
    case 'ip-dono':
      return net.isIP(String(c.ip)) && CONTA.test(String(c.dono)) ? { acao, ip: String(c.ip), dono: String(c.dono) } : 'Pedido inválido.';
    case 'ns-conta': {
      const contas = lista(c.contas).map(String).filter((x) => CONTA.test(x)).slice(0, 500);
      const ns = lista(c.ns).map((x) => String(x).trim().toLowerCase()).filter(Boolean);
      if (!contas.length) return 'Escolha as contas.';
      if (ns.length < 2 || ns.length > 8 || !ns.every((x) => HOST.test(x))) return 'Escreva pelo menos dois servidores de nomes válidos.';
      return { acao, contas, ns };
    }
    case 'cron-apagar':
    case 'cron-suspender':
    case 'cron-retomar': {
      const itens = lista(c.itens)
        .map((x) => x as { conta?: unknown; id?: unknown })
        .map((x) => ({ conta: String(x.conta || ''), id: String(x.id || '') }))
        .filter((x) => CONTA.test(x.conta) && /^\d{1,6}$/.test(x.id))
        .slice(0, 500);
      return itens.length ? { acao, itens } : 'Escolha as tarefas.';
    }
    case 'bd-terminar': {
      const i = ids(/^\d{1,12}$/);
      return i.length ? { acao, ids: i } : 'Escolha as ligações.';
    }
    case 'fila-tentar':
    case 'fila-apagar': {
      const i = ids(EXIM_ID);
      return i.length ? { acao, ids: i } : 'Escolha as mensagens.';
    }
    case 'fila-tudo':
      return { acao };
    case 'fw-adicionar': {
      const regra = String(c.regra || '').toUpperCase();
      const protocolo = String(c.protocolo || '').toUpperCase();
      const ip = String(c.ip || '').trim();
      const porta = String(c.porta || '').trim();
      const comentario = String(c.comentario || '').trim();
      const ipOk = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/.test(ip) || /^ipset:[A-Za-z0-9_-]{1,32}$/.test(ip);
      if (!['ACCEPT', 'DROP'].includes(regra) || !['TCP', 'UDP', 'ICMP'].includes(protocolo)) return 'Regra inválida.';
      if (!ipOk) return 'Endereço IP inválido (ex.: 0.0.0.0/0, 203.0.113.10 ou 203.0.113.0/24).';
      if (!/^(\d{1,5}([-:]\d{1,5})?)(,\d{1,5}([-:]\d{1,5})?)*$/.test(porta) && !(protocolo === 'ICMP' && porta === '0')) return 'Porta inválida (ex.: 22, 80,443 ou 8000-8100).';
      if (!/^[\p{L}\p{N} ._-]{0,40}$/u.test(comentario)) return 'Comentário: letras, números, espaços, . _ - (até 40).';
      return { acao, regra, protocolo, ip, porta, comentario };
    }
    case 'fw-apagar':
    case 'fw-suspender':
    case 'fw-retomar': {
      const i = ids(/^\d{1,5}$/);
      return i.length ? { acao, ids: i } : 'Escolha as regras.';
    }
    // sem mais dados: trabalhos e verificações do servidor
    case 'hestia-atualizar':
    case 'apt-procurar':
    case 'apt-tudo':
    case 'tls-letsencrypt':
    case 'bs-criar':
    case 'modsec-instalar':
    case 'mnt-reconstruir':
    case 'mnt-limpar':
    case 'mnt-reparar':
      return { acao };
    case 'php-instalar':
    case 'php-remover': {
      const versoes = [...new Set(lista(c.versoes).map(String).filter((x) => /^(7\.4|8\.[0-4])$/.test(x)))];
      return versoes.length ? { acao, versoes } : 'Escolha as versões.';
    }
    case 'php-predefinida':
      return /^(7\.4|8\.[0-4])$/.test(String(c.versao)) ? { acao, versao: String(c.versao) } : 'Versão inválida.';
    case 'apt-pacotes': {
      const nomes = [...new Set(lista(c.nomes).map(String).filter((x) => /^[a-z0-9][a-z0-9+.:-]{0,80}$/.test(x)))].slice(0, 300);
      return nomes.length ? { acao, nomes } : 'Escolha os pacotes.';
    }
    case 'def-hostname':
      return DOM.test(String(c.host || '')) ? { acao, host: String(c.host).toLowerCase() } : 'Nome do servidor inválido.';
    case 'def-fuso':
      return /^[A-Za-z_]+(\/[A-Za-z0-9_+-]+){0,2}$/.test(String(c.fuso || '')) ? { acao, fuso: String(c.fuso) } : 'Fuso horário inválido.';
    case 'def-valor':
      return /^[A-Z_]{3,40}$/.test(String(c.chave || '')) && /^[a-z0-9]{1,10}$/.test(String(c.valor ?? '')) ? { acao, chave: String(c.chave), valor: String(c.valor) } : 'Valor inválido.';
    case 'multi-adicionar': {
      const host = String(c.host || '').trim().toLowerCase();
      const porta = Number(c.porta || 8083);
      const user = String(c.user || '').trim();
      const senha = String(c.senha || '');
      const dnsUser = String(c.dnsUser || '').trim();
      if (!DOM.test(host) && !net.isIP(host)) return 'Servidor inválido.';
      if (!Number.isInteger(porta) || porta < 1 || porta > 65535) return 'Porta inválida.';
      if (!/^[a-z0-9_.-]{1,32}$/i.test(user) || (dnsUser && !/^[a-z0-9_.-]{1,32}$/i.test(dnsUser))) return 'Utilizador inválido.';
      if (!senha || senha.length > 128 || /[\r\n]/.test(senha)) return 'Palavra-passe inválida.';
      return { acao, host, porta: String(porta), user, senha, dnsUser };
    }
    case 'multi-apagar': {
      const hosts = lista(c.hosts).map((x) => String(x).toLowerCase()).filter((x) => DOM.test(x) || net.isIP(x)).slice(0, 50);
      return hosts.length ? { acao, hosts } : 'Escolha os servidores.';
    }
    case 'bk-criar':
    case 'httpd-reconstruir': {
      const contas = [...new Set(lista(c.contas).map(String).filter((x) => CONTA.test(x)))].slice(0, 500);
      return contas.length ? { acao, contas } : 'Escolha as contas.';
    }
    case 'bk-restaurar':
      return CONTA.test(String(c.conta)) && /^[A-Za-z0-9._-]{1,120}\.tar(\.gz|\.zst)?$/.test(String(c.nome)) ? { acao, conta: String(c.conta), nome: String(c.nome) } : 'Cópia inválida.';
    case 'bk-apagar': {
      const itens = lista(c.itens)
        .map((x) => x as { conta?: unknown; nome?: unknown })
        .map((x) => ({ conta: String(x.conta || ''), nome: String(x.nome || '') }))
        .filter((x) => CONTA.test(x.conta) && /^[A-Za-z0-9._-]{1,120}\.tar(\.gz|\.zst)?$/.test(x.nome))
        .slice(0, 300);
      return itens.length ? { acao, itens } : 'Escolha as cópias.';
    }
    case 'bs-apagar': {
      const nomes = lista(c.nomes).map(String).filter((x) => /^vhost-sistema-\d{8}-\d{4}\.tar\.gz$/.test(x)).slice(0, 50);
      return nomes.length ? { acao, nomes } : 'Escolha as cópias.';
    }
    case 'httpd-mudar':
    case 'basedir-ligar':
    case 'basedir-desligar': {
      const itens = lista(c.itens)
        .map((x) => x as { conta?: unknown; dominio?: unknown })
        .map((x) => ({ conta: String(x.conta || ''), dominio: String(x.dominio || '').toLowerCase() }))
        .filter((x) => CONTA.test(x.conta) && DOM.test(x.dominio))
        .slice(0, 300);
      if (!itens.length) return 'Escolha os domínios.';
      if (acao !== 'httpd-mudar') return { acao, itens };
      const tipo = String(c.tipo || '');
      const modelo = String(c.modelo || '');
      return ['web', 'proxy', 'backend'].includes(tipo) && /^[A-Za-z0-9_.-]{1,60}$/.test(modelo) ? { acao, itens, tipo, modelo } : 'Modelo inválido.';
    }
    case 'stxt-gravar':
    case 'stxt-apagar': {
      const conta = String(c.conta || '');
      const dominio = String(c.dominio || '').toLowerCase();
      if (!CONTA.test(conta) || !DOM.test(dominio)) return 'Domínio inválido.';
      if (acao === 'stxt-apagar') return { acao, conta, dominio };
      const texto = String(c.texto || '').replace(/\r/g, '');
      if (texto.length > 4000 || !texto.split('\n').every((l) => !l || /^(#.*|[A-Za-z-]{2,40}: \S.{0,300})$/.test(l))) return 'O security.txt só pode ter linhas "Campo: valor" (e comentários com #).';
      return { acao, conta, dominio, texto: texto.endsWith('\n') ? texto : texto + '\n' };
    }
    case 'modsec-modo':
      return ['On', 'DetectionOnly', 'Off'].includes(String(c.modo)) ? { acao, modo: String(c.modo) } : 'Modo inválido.';
    case 'extra-servico':
      return ['redis', 'unit', 'netdata'].includes(String(c.nome)) && ['restart', 'stop', 'start'].includes(String(c.op)) ? { acao, nome: String(c.nome), op: String(c.op) } : 'Pedido inválido.';
    case 'extra-instalar':
      return String(c.nome) === 'redis' ? { acao, nome: 'redis' } : 'Só o Redis se instala daqui.';
    case 'importar':
      return ['cpanel', 'directadmin'].includes(String(c.tipo)) && /^[A-Za-z0-9._-]{1,160}$/.test(String(c.ficheiro)) ? { acao, tipo: String(c.tipo), ficheiro: String(c.ficheiro) } : 'Ficheiro inválido.';
  }
  return 'Ação desconhecida.';
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
  const sp = req.nextUrl.searchParams;
  const ver = sp.get('ver') || '';
  if (VER_ADMIN.has(ver)) {
    try {
      const r = await noServidorAdmin({ ver, ficheiro: sp.get('ficheiro') || '', linhas: Number(sp.get('linhas')) || 0, q: (sp.get('q') || '').slice(0, 120), horas: Number(sp.get('horas')) || 0, dia: Number(sp.get('dia')) || 0 });
      if (!r) return NextResponse.json({ erro: 'O servidor não respondeu.' }, { status: 502 });
      return NextResponse.json(r, { headers: { 'Cache-Control': 'no-store' } });
    } catch {
      return NextResponse.json({ erro: 'Sem ligação ao servidor.' }, { status: 502 });
    }
  }
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
  const c = (await req.json().catch(() => ({}))) as { acao?: string; pids?: unknown; forcar?: unknown; nome?: unknown; op?: unknown; [k: string]: unknown };
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
    const p = pedidoAdmin(c as Record<string, unknown>);
    if (typeof p === 'string') return NextResponse.json({ erro: p }, { status: 400 });
    const r = await noServidorAdmin(p, 180_000);
    if (!r) return NextResponse.json({ erro: 'O servidor não respondeu.' }, { status: 502 });
    return r.ok === false ? NextResponse.json({ erro: String(r.erro || 'Não foi possível.') }, { status: 400 }) : NextResponse.json(r);
  } catch {
    return NextResponse.json({ erro: 'Sem ligação ao servidor.' }, { status: 502 });
  }
}
