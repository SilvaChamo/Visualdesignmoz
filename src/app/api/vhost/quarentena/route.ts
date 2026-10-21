import { NextRequest, NextResponse } from 'next/server';
import { requirePanelBootstrapAccess } from '@/lib/panel-api-auth';
import { executeServerCommand } from '@/lib/server-ssh-exec';

export const dynamic = 'force-dynamic';

/**
 * /api/vhost/quarentena — Admin › Quarentena (só o administrador): os ficheiros que a guarda dos sites (deploy/seguranca/vd-guarda-sites)
 * e as limpezas manuais puseram de lado em /root/quarentena-*, no servidor.
 * GET                                       → { itens: [{ id, nome, original, site, motivo, tam, data, lote }], total }
 * POST { acao: 'repor' | 'apagar', ids: string[] }  → { feitos: string[], falhas: { id, erro }[] }
 * Os ids são caminhos relativos a /root. O script valida tudo outra vez no servidor (como root): só ficheiros normais, sem ligações
 * simbólicas, dentro das pastas de quarentena; repor nunca substitui um ficheiro que já exista.
 */

// Corre no servidor (python3, como root).
const PY = String.raw`
import base64, glob, json, os, re, shutil, sys, time, hashlib
arg = json.loads(base64.b64decode(sys.argv[1]).decode())
LOG = '/var/log/vd-guarda.log'
HASHES = 'LEIA-ME-hashes.txt'
def raizes():
    return [d for d in ['/root/quarentena-guarda'] + sorted(glob.glob('/root/quarentena-mltmark-*')) if os.path.isdir(d) and not os.path.islink(d)]
def original(p):
    """O caminho de onde o ficheiro saiu: a guarda guarda /root/quarentena-guarda/<data>/<caminho sob /home>; a limpeza manual do mltmark guarda a partir de public_html"""
    if p.startswith('/root/quarentena-guarda/'):
        resto = p[len('/root/quarentena-guarda/'):].split('/', 1)
        return '/home/' + resto[1] if len(resto) == 2 else ''
    if p.startswith('/root/quarentena-mltmark-'):
        resto = p.split('/', 3)
        return '/home/mltmark/web/mltmark.com/public_html/' + resto[3] if len(resto) == 4 else ''
    return ''
def lote(p):
    if p.startswith('/root/quarentena-guarda/'): return p.split('/')[3]
    return 'mltmark (limpeza manual de ' + p.split('/')[2].replace('quarentena-mltmark-', '') + ')'
def motivos():
    m = {}
    try:
        for l in open(LOG, errors='replace'):
            r = re.match(r'^\S+ \S+ QUARENTENA (.+?) \((.*)\) sha256=', l)
            if r: m[r.group(1)] = r.group(2)
    except Exception: pass
    return m
def valido(rel):
    """O caminho absoluto de um ficheiro normal dentro de uma pasta de quarentena, ou None"""
    if not isinstance(rel, str) or '\0' in rel or '..' in rel.split('/'): return None
    p = os.path.abspath('/root/' + rel)
    try:
        if os.path.realpath(p) != p or os.path.islink(p) or not os.path.isfile(p): return None
    except Exception: return None
    if os.path.basename(p) == HASHES: return None
    return p if any(p.startswith(r + '/') for r in raizes()) else None
def registar(txt):
    try: open(LOG, 'a').write(time.strftime('%Y-%m-%d %H:%M:%S ') + txt + '\n')
    except Exception: pass
def sha(p):
    try: return hashlib.sha256(open(p, 'rb').read()).hexdigest()
    except Exception: return ''
def limpar_pastas(p):
    d = os.path.dirname(p)
    while any(d.startswith(r + '/') for r in raizes()):
        try: os.rmdir(d)
        except OSError: break
        d = os.path.dirname(d)

acao = arg.get('acao')
if acao == 'listar':
    mot = motivos()
    itens = []
    for r in raizes():
        for d, subs, fs in os.walk(r):
            for f in fs:
                p = os.path.join(d, f)
                if f == HASHES or os.path.islink(p): continue
                try: st = os.lstat(p)
                except Exception: continue
                o = original(p)
                m = re.match(r'^/home/[^/]+/web/([^/]+)/', o)
                itens.append({'id': p[len('/root/'):], 'nome': f, 'original': o, 'site': m.group(1) if m else '', 'motivo': mot.get(o) or 'Ficheiro malicioso (limpeza manual)', 'tam': st.st_size, 'data': time.strftime('%Y-%m-%d %H:%M', time.localtime(st.st_mtime)), 'lote': lote(p)})
    itens.sort(key=lambda x: (x['data'], x['original']), reverse=True)
    print(json.dumps({'itens': itens[:3000], 'total': len(itens)}))
elif acao in ('apagar', 'repor'):
    feitos, falhas = [], []
    for rel in arg.get('ids', []):
        p = valido(rel)
        if not p:
            falhas.append({'id': rel, 'erro': 'Ficheiro inválido ou já não existe.'}); continue
        o = original(p)
        if acao == 'apagar':
            h = sha(p)
            try:
                os.remove(p)
                registar('APAGADO DA QUARENTENA ' + o + ' sha256=' + h)
                limpar_pastas(p)
                feitos.append(rel)
            except Exception as e:
                falhas.append({'id': rel, 'erro': str(e)[:120]})
        else:
            m = re.match(r'^(/home/([^/]+)/web/[^/]+/public_html)/(.+)$', o)
            if not m: falhas.append({'id': rel, 'erro': 'Não se sabe de onde saiu.'}); continue
            raiz, conta, resto = m.group(1), m.group(2), m.group(3)
            pai = os.path.dirname(o)
            if not os.path.isdir(pai) or os.path.realpath(pai) != pai or not (pai == raiz or pai.startswith(raiz + '/')):
                falhas.append({'id': rel, 'erro': 'A pasta de origem já não existe.'}); continue
            if os.path.lexists(o):
                falhas.append({'id': rel, 'erro': 'Já existe um ficheiro no sítio de origem.'}); continue
            try:
                h = sha(p)
                shutil.move(p, o)
                os.chmod(o, 0o644)
                st = os.stat(raiz)
                os.chown(o, st.st_uid, st.st_gid)
                registar('REPOSTO DA QUARENTENA ' + o + ' sha256=' + h)
                limpar_pastas(p)
                feitos.append(rel)
            except Exception as e:
                falhas.append({'id': rel, 'erro': str(e)[:120]})
    print(json.dumps({'feitos': feitos, 'falhas': falhas}))
else:
    print(json.dumps({'erro': 'Ação desconhecida.'}))
`;

const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64');
// o id é um caminho relativo a /root dentro de uma pasta de quarentena; o script valida tudo outra vez no servidor
const ID = /^quarentena-[A-Za-z0-9._-]{1,60}\/[^\0\n\r]{1,900}$/;

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
  const c = (await req.json().catch(() => ({}))) as { acao?: unknown; ids?: unknown };
  const acao = String(c.acao || '');
  const ids = [...new Set(Array.isArray(c.ids) ? c.ids.filter((x): x is string => typeof x === 'string' && ID.test(x)) : [])].slice(0, 200);
  if (!['apagar', 'repor'].includes(acao) || !ids.length) return NextResponse.json({ erro: 'Escolha os ficheiros.' }, { status: 400 });
  try {
    const r = await noServidor({ acao, ids }, 120_000);
    if (!r) return NextResponse.json({ erro: 'O servidor não respondeu.' }, { status: 502 });
    return NextResponse.json(r);
  } catch {
    return NextResponse.json({ erro: 'Sem ligação ao servidor.' }, { status: 502 });
  }
}
