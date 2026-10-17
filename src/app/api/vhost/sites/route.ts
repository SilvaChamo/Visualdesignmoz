import { NextResponse } from 'next/server';
import { requirePanelBootstrapAccess } from '@/lib/panel-api-auth';
import { executeServerCommand } from '@/lib/server-ssh-exec';

export const dynamic = 'force-dynamic';

/**
 * /api/vhost/sites — Admin › Gestão de contas › Sites das contas (Silva, 17/10/2026: "deve haver uma forma de ter
 * certeza que o site está no servidor, seja qual for a linguagem usada").
 * GET (só o administrador) → { sites: [{ conta, plano, dominio, linguagem, onde, titulo, espera }], lidoEm }
 * Para cada site do servidor: pede-se de fora a página com uma marca única no endereço e procura-se essa marca nos
 * registos do nginx/apache deste servidor — se lá está, o que o público vê vem daqui (vale para qualquer linguagem e
 * também atrás da Cloudflare). A linguagem vê-se pelos ficheiros e pela configuração do site; a página de espera
 * ("Brevemente"…) pelo título da página que o site serve de facto. O plano da conta diz o que a página de espera quer
 * dizer: num plano de e-mail ou só domínio, a conta não tem site; nos outros, o site está em preparação.
 */
const PY = String.raw`
import json, os, re, subprocess, sys, time, glob, uuid
from concurrent.futures import ThreadPoolExecutor
H = '/usr/local/hestia/bin'
def run(c, t=60):
    try: return subprocess.run(c, shell=True, capture_output=True, text=True, timeout=t).stdout
    except Exception: return ''
def js(c):
    try: return json.loads(run(c) or '{}')
    except Exception: return {}
sites = []
for u, x in js(H + '/v-list-users json').items():
    for d, w in js(H + '/v-list-web-domains ' + u + ' json').items():
        sites.append({'conta': u, 'plano': x.get('PACKAGE', ''), 'dominio': d, 'w': w, 'marca': 'vdverificar' + uuid.uuid4().hex[:12]})
def linguagem(s):
    u, d, w = s['conta'], s['dominio'], s['w']
    R = '/home/%s/web/%s/public_html' % (u, d)
    if w.get('REDIRECT'): return 'Redireccionamento'
    conf = ''
    for f in glob.glob('/home/%s/conf/web/%s/*nginx*.conf' % (u, d)):
        try: conf += open(f).read()
        except Exception: pass
    if re.search(r'proxy_pass\s+https?://(127\.0\.0\.1|localhost):(3\d{3}|4\d{3}|5\d{3})', conf): return 'Node.js'
    if os.path.exists(R + '/wp-config.php'): return 'WordPress'
    if os.path.exists(R + '/artisan') or os.path.exists(R + '/../artisan'): return 'Laravel'
    if os.path.exists(R + '/index.php'): return 'PHP'
    if glob.glob(R + '/*.py'): return 'Python'
    if os.path.exists(R + '/index.html'): return 'HTML'
    return 'Sem página'
def pedir(s):
    d = s['dominio']
    corpo = run("curl -s -m 15 -L 'https://%s/?%s=1'" % (d, s['marca']), 20)
    m = re.search(r'<title[^>]*>([^<]*)', corpo, re.I)
    s['titulo'] = (m.group(1).strip() if m else '')[:120]
    s['dns'] = bool(run('dig +short A %s @1.1.1.1' % d, 10).strip())
    s['linguagem'] = linguagem(s)
with ThreadPoolExecutor(max_workers=12) as ex: list(ex.map(pedir, sites))
time.sleep(2)
logs = [f for f in glob.glob('/var/log/nginx/domains/*.log') + glob.glob('/var/log/nginx/*.log') + glob.glob('/var/log/apache2/domains/*.log') if os.path.isfile(f)]
achadas = set()
if sites and logs:
    padrao = '|'.join(s['marca'] for s in sites)
    out = subprocess.run(['grep', '-ohsE', padrao] + logs, capture_output=True, text=True, timeout=120).stdout
    achadas = set(out.split())
espera = re.compile(r'brevemente|em constru|coming soon|under construction', re.I)
print(json.dumps({'sites': [{'conta': s['conta'], 'plano': s['plano'], 'dominio': s['dominio'], 'linguagem': s['linguagem'], 'titulo': s['titulo'],
    'onde': 'aqui' if s['marca'] in achadas else ('fora' if s['dns'] else 'sem-dns'), 'espera': bool(espera.search(s['titulo']))} for s in sites]}))
`;

const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64');

export async function GET() {
  const auth = await requirePanelBootstrapAccess();
  if ('error' in auth) return NextResponse.json({ erro: 'Inicie sessão.' }, { status: 401 });
  if (auth.user.role !== 'admin') return NextResponse.json({ erro: 'Só o administrador vê os sites de todas as contas.' }, { status: 403 });
  const out = await executeServerCommand(`python3 -c "$(echo ${b64(PY)} | base64 -d)" 2>&1`, { timeoutMs: 240_000 }).catch(() => '');
  const l = out.split('\n').reverse().find((x) => x.trim().startsWith('{'));
  try {
    const j = l ? (JSON.parse(l) as { sites: unknown[] }) : null;
    if (!j) return NextResponse.json({ erro: 'O servidor não respondeu à verificação.' }, { status: 502 });
    return NextResponse.json({ sites: j.sites, lidoEm: Date.now() });
  } catch {
    return NextResponse.json({ erro: 'Resposta do servidor inválida.' }, { status: 502 });
  }
}
