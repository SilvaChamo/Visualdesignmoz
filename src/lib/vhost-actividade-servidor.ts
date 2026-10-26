/**
 * Sessões e acções nos sites WordPress e no webmail, lidas do servidor (Contas ligadas › Agora e Histórico — pedido do Silva,
 * 25/10/2026, a partir do caso da Tatiana no oshercollective.com: o ModSecurity bloqueava o CSS dela e o painel não via nada).
 *
 * O WordPress e o webmail não avisam o painel; por isso lêem-se os registos que o próprio servidor já guarda:
 *   - o registo de acessos do Apache de cada site (quem entrou no /wp-admin, quem guardou o quê, com que resposta);
 *   - o registo de erros (os bloqueios do ModSecurity, com a regra e o campo, e os erros fatais do PHP);
 *   - as sessões abertas do Roundcube (webmail), na base de dados dele.
 * Só leitura: um script Python corre no servidor (localmente no Contabo, por SSH em desenvolvimento), com baixa prioridade
 * (o servidor tem muita carga), e o resultado fica em memória 45 s; depois devolve o último e lê de novo por trás.
 * Os registos do Apache rodam à meia-noite: a história do servidor chega até ontem (cerca de 24 a 48 h).
 *
 * O IP: o nginx está à frente do Apache e, com o mod_rpaf ligado, o Apache regista o IP do próprio servidor. Nos sites onde está
 * o ficheiro `apache2.conf_vd-ip-real` (ver regras.md) o IP é o verdadeiro; nos outros fica vazio ("IP indisponível").
 */
import { createHash } from 'crypto';
import { executeServerCommand } from '@/lib/server-ssh-exec';
import { lerServidor } from '@/lib/vhost-servidor';
import { aparelhoDe } from '@/lib/vhost-presenca';

export type EstadoResultado = 'ok' | 'bloqueado' | 'erro' | 'aviso' | 'info';

export type LinhaActividade = {
  /** hora da primeira tentativa (ms) e, se houve repetições seguidas, da última */
  t: number;
  ate?: number;
  n: number;
  acao: string;
  /** "WordPress · dominio.com" */
  onde: string;
  origem: 'painel' | 'wordpress';
  estado: EstadoResultado;
  resultado: string;
  detalhe?: string;
  ip: string;
  aparelho: string;
  conta: string;
  /** só para linhas do painel: o que foi clicado e a secção */
  secao?: string;
};

export type SessaoWordPress = {
  id: string;
  dominio: string;
  conta: string;
  ip: string;
  aparelho: string;
  desde: number;
  ultimo: number;
  linhas: LinhaActividade[];
  acoes: number;
  bloqueios: number;
  erros: number;
};

export type SessaoWebmail = { email: string; dominio: string; conta: string; ip: string; ultimo: number };

type Registo = { t: number; ip: string; metodo: string; caminho: string; estado: number; ua: string; ref: string };
type Bloqueio = { t: number; uri: string; ref: string; regras: [string, string, string, string][] };
type DominioLido = { conta: string; acc: [number, string, string, string, number, string, string][]; mod: { t: number; uri: string; ref: string; regras: [string, string, string, string][] }[]; php: [number, string][] };
type Leitura = { gerado: number; dominios: Record<string, DominioLido>; webmail: [number, string, string][]; mailDominios: Record<string, string> };

const JANELA_S = 48 * 3600;
const VALIDADE_MS = 45_000;
const LIMITE_EXTERNAS_MS = 30 * 60_000;
const SESSAO_PAUSA_MS = 30 * 60_000;
/** IP que o Apache regista quando não vê o do visitante (o do próprio servidor): conta como "desconhecido" */
const IPS_PROXY = new Set([(process.env.VH_IP_SERVIDOR || '169.58.148.144').trim(), '127.0.0.1', '::1']);

// Corre no servidor com `python3 -I - <desde> <conta:dominio>…`. Só lê.
const SCRIPT = String.raw`
import sys, os, re, json, time, datetime, subprocess, base64

DESDE = int(sys.argv[1])
PARES = [p.split(':', 1) for p in sys.argv[2:] if ':' in p]
LOGDIR = '/var/log/apache2/domains/'
TAMANHO_MAX = 12_000_000
ACC = re.compile(r'^(\S+) \S+ \S+ \[([^\]]+)\] "(\S+) (\S+)[^"]*" (\d{3}) \S+ "([^"]*)" "([^"]*)"')
RELEVANTE = re.compile(r'^/+(wp-admin|wp-login\.php|wp-json|xmlrpc\.php)')
ESTATICO = re.compile(r'\.(css|js|map|png|jpe?g|gif|svg|webp|ico|woff2?|ttf|eot)(\?|$)', re.I)
ERR_T = re.compile(r'^\[\w{3} (\w{3} +\d+ \d+:\d+:\d+)(?:\.\d+)? (\d{4})\]')
R_ID = re.compile(r'\[id "(\d+)"\]')
R_MSG = re.compile(r'\[msg "([^"]*)"\]')
R_DATA = re.compile(r'\[data "((?:[^"\\]|\\.)*)"')
R_URI = re.compile(r'\[uri "([^"]*)"\]')
R_UID = re.compile(r'\[unique_id "([^"]*)"\]')
R_CAMPO = re.compile(r' at ((?:ARGS|ARGS_NAMES|REQUEST_[A-Z_]+|FILES|FILES_NAMES|XML|JSON)[A-Za-z0-9_:.\[\]-]*)\.')
R_REF = re.compile(r', referer: (\S+)$')
R_PHP = re.compile(r'(PHP (?:Fatal error|Parse error)[^\n]*|Allowed memory size[^\n]*)')


def ler_cauda(caminho):
    try:
        st = os.stat(caminho)
    except OSError:
        return []
    if st.st_mtime < DESDE:
        return []
    with open(caminho, 'rb') as f:
        if st.st_size > TAMANHO_MAX:
            f.seek(st.st_size - TAMANHO_MAX)
            f.readline()
        return f.read().decode('utf-8', 'replace').splitlines()


def hora_erro(l):
    mt = ERR_T.match(l)
    if not mt:
        return None
    try:
        return int(time.mktime(datetime.datetime.strptime(mt.group(1) + ' ' + mt.group(2), '%b %d %H:%M:%S %Y').timetuple()))
    except ValueError:
        return None


def acessos(dominio):
    out = []
    for nome in (dominio + '.log.1', dominio + '.log'):
        for l in ler_cauda(LOGDIR + nome):
            m = ACC.match(l)
            if not m:
                continue
            caminho = m.group(4)
            if not RELEVANTE.match(caminho) or ESTATICO.search(caminho):
                continue
            try:
                t = datetime.datetime.strptime(m.group(2), '%d/%b/%Y:%H:%M:%S %z').timestamp()
            except ValueError:
                continue
            if t < DESDE:
                continue
            out.append([int(t), m.group(1), m.group(3), caminho[:220], int(m.group(5)), m.group(7)[:170], m.group(6)[:170]])
    return out[-6000:]


def erros(dominio):
    bloqueios = {}
    php = []
    for nome in (dominio + '.error.log.1', dominio + '.error.log'):
        for l in ler_cauda(LOGDIR + nome):
            if 'ModSecurity:' in l and ('Access denied' in l or 'Warning.' in l) and 'PCRE limits' not in l:
                u = R_UID.search(l)
                t = hora_erro(l)
                if not u or t is None or t < DESDE:
                    continue
                b = bloqueios.setdefault(u.group(1), {'t': t, 'uri': '', 'ref': '', 'negado': False, 'regras': []})
                uri = R_URI.search(l)
                # o pedido recusado é depois reenviado para /error/403.html: fica o endereço verdadeiro, o primeiro
                if uri and (not b['uri'] or b['uri'].startswith('/error/')):
                    b['uri'] = uri.group(1)[:200]
                ref = R_REF.search(l)
                if ref:
                    b['ref'] = ref.group(1)[:200]
                if 'Access denied' in l:
                    b['negado'] = True
                rid = R_ID.search(l)
                if rid and not rid.group(1).startswith(('949', '980')):
                    msg, data, campo = R_MSG.search(l), R_DATA.search(l), R_CAMPO.search(l)
                    b['regras'].append([rid.group(1), msg.group(1)[:120] if msg else '', campo.group(1) if campo else '', (data.group(1) if data else '')[:200]])
            elif 'PHP' in l or 'Allowed memory' in l:
                mp = R_PHP.search(l)
                t = hora_erro(l)
                if mp and t is not None and t >= DESDE:
                    php.append([t, mp.group(1)[:240]])
    return [{'t': b['t'], 'uri': b['uri'], 'ref': b['ref'], 'regras': b['regras']} for b in bloqueios.values() if b['negado']][-400:], php[-100:]


def webmail():
    # Roundcube 1.7: a sessão tem expires_at (último pedido + 10 min de vida)
    try:
        r = subprocess.run(['mysql', 'roundcube', '-N', '-B', '-e', 'SELECT UNIX_TIMESTAMP(expires_at), ip, vars FROM session WHERE expires_at > NOW() - INTERVAL 20 MINUTE'],
                           capture_output=True, text=True, timeout=6)
    except Exception:
        return []
    out = []
    for linha in r.stdout.splitlines():
        p = linha.split('\t')
        if len(p) < 3:
            continue
        try:
            v = base64.b64decode(p[2]).decode('utf-8', 'replace')
        except Exception:
            continue
        u = re.search(r'username\|s:\d+:"([^"]+)"', v)
        if u:
            out.append([int(p[0]) - 600, p[1], u.group(1)])
    return out


res = {'gerado': int(time.time()), 'dominios': {}, 'webmail': webmail()}
for conta, dominio in PARES:
    acc = acessos(dominio)
    mod, php = erros(dominio)
    res['dominios'][dominio] = {'conta': conta, 'acc': acc, 'mod': mod, 'php': php}
print(json.dumps(res, separators=(',', ':')))
`;

type Memoria = { cache: { at: number; dados: Leitura } | null; aLer: Promise<Leitura | null> | null; falhouEm: number };
// Uma só memória por processo (as rotas e as páginas do Next carregam cópias separadas deste ficheiro)
const g = globalThis as typeof globalThis & { __vhostActividade?: Memoria };
const m: Memoria = (g.__vhostActividade ??= { cache: null, aLer: null, falhouEm: 0 });

const CONTA_OK = /^[a-z0-9_-]{1,32}$/;
const DOMINIO_OK = /^[a-z0-9.-]{1,253}$/;

async function lerAgora(): Promise<Leitura | null> {
  const srv = await lerServidor();
  const pares: string[] = [];
  for (const [conta, dominios] of Object.entries(srv.wp || {})) {
    if (!CONTA_OK.test(conta)) continue;
    for (const d of dominios) if (DOMINIO_OK.test(d)) pares.push(`${conta}:${d}`);
  }
  const mailDominios: Record<string, string> = {};
  for (const [conta, doms] of Object.entries(srv.mail || {})) for (const d of Object.keys(doms || {})) mailDominios[d.toLowerCase()] = conta;
  const desde = Math.floor(Date.now() / 1000) - JANELA_S;
  const out = await executeServerCommand(`nice -n 10 python3 -I - ${desde} ${pares.join(' ')} <<'VHOST_ACT'\n${SCRIPT}\nVHOST_ACT`, { timeoutMs: 40_000 });
  const ini = out.indexOf('{"gerado"');
  if (ini < 0) throw new Error('Resposta inesperada do servidor ao ler a actividade.');
  const dados = JSON.parse(out.slice(ini)) as Omit<Leitura, 'mailDominios'>;
  return { ...dados, mailDominios };
}

/** Última leitura do servidor (45 s de memória; depois devolve a anterior e lê de novo por trás). Sem leitura nenhuma, espera. */
async function actividade(): Promise<Leitura | null> {
  const idade = m.cache ? Date.now() - m.cache.at : Infinity;
  if (m.cache && idade < VALIDADE_MS) return m.cache.dados;
  // servidor sem resposta: não insiste a cada aviso do painel (de 5 em 5 s), espera 20 s
  if (!m.aLer && Date.now() - m.falhouEm < 20_000) return m.cache?.dados ?? null;
  if (!m.aLer) {
    m.aLer = lerAgora()
      .then((dados) => {
        if (dados) m.cache = { at: Date.now(), dados };
        return dados;
      })
      .catch((erro) => {
        m.falhouEm = Date.now();
        console.warn('[vhost/actividade] Não foi possível ler a actividade do servidor:', erro instanceof Error ? erro.message : erro);
        return null;
      })
      .finally(() => {
        m.aLer = null;
      });
  }
  if (m.cache) return m.cache.dados;
  return m.aLer;
}

export function ipVerdadeiro(ip: string): string {
  return !ip || IPS_PROXY.has(ip) ? '' : ip;
}

// ---------- o que cada pedido quer dizer ----------
const semQuery = (c: string) => c.split('?')[0].replace(/\/{2,}/g, '/');
function parametro(c: string, nome: string): string {
  for (const par of (c.split('?')[1] || '').split('&')) {
    const [k, v = ''] = par.split('=');
    if (k === nome) {
      try {
        return decodeURIComponent(v);
      } catch {
        return v;
      }
    }
  }
  return '';
}
const RECURSOS: Record<string, string> = {
  pages: 'página',
  posts: 'artigo',
  'global-styles': 'estilos do site (CSS personalizado)',
  templates: 'modelo do tema',
  'template-parts': 'parte de modelo',
  navigation: 'menu de navegação',
  media: 'ficheiro da biblioteca',
  users: 'utilizador',
  settings: 'definições do site',
  plugins: 'plugin',
  themes: 'tema',
  blocks: 'bloco reutilizável',
  wp_block: 'bloco reutilizável',
  'menu-items': 'item de menu',
  comments: 'comentário',
  categories: 'categoria',
  tags: 'etiqueta',
};

/** `ruido`: pedido normal de navegação que não merece uma linha no histórico (só se falhar) */
function descreverPedido(r: Registo): { acao: string; ruido: boolean } {
  const p = semQuery(r.caminho);
  const escrita = r.metodo !== 'GET' && r.metodo !== 'HEAD';
  if (p === '/wp-login.php') {
    if (r.metodo === 'POST') return { acao: 'Iniciar sessão no WordPress', ruido: false };
    if (parametro(r.caminho, 'action') === 'logout') return { acao: 'Terminar a sessão no WordPress', ruido: false };
    return { acao: 'Abrir a página de entrada do WordPress', ruido: true };
  }
  if (p.startsWith('/wp-json/wp/v2/')) {
    const [recurso, id] = p.split('/').slice(4);
    const nome = RECURSOS[recurso] || `recurso «${recurso}»`;
    if (r.metodo === 'DELETE') return { acao: `Apagar ${nome}${id ? ' #' + id : ''}`, ruido: false };
    if (escrita) return { acao: `Guardar ${nome}${id && recurso !== 'global-styles' ? ' #' + id : ''}`, ruido: false };
    return { acao: `Ler ${nome}`, ruido: true };
  }
  if (p === '/wp-json' || p.startsWith('/wp-json/')) return { acao: escrita ? `Pedido ${r.metodo} à API do WordPress (${p})` : 'Ler a API do WordPress', ruido: !escrita };
  if (p === '/xmlrpc.php') return { acao: 'Pedido ao xmlrpc.php', ruido: false };
  if (p === '/wp-admin/admin.php') {
    const pagina = parametro(r.caminho, 'page');
    if (pagina.startsWith('wpcode')) return { acao: escrita ? 'Guardar snippet de código (WPCode)' : 'Abrir o WPCode', ruido: !escrita };
    if (pagina.startsWith('elementor')) return { acao: escrita ? 'Guardar definições do Elementor' : 'Abrir o Elementor', ruido: !escrita };
    return { acao: escrita ? `Guardar definições («${pagina || 'admin'}»)` : `Abrir a página «${pagina || 'admin'}» do painel`, ruido: !escrita };
  }
  if (p === '/wp-admin/post.php') {
    if (escrita) return { acao: 'Guardar conteúdo (editor clássico)', ruido: false };
    return { acao: parametro(r.caminho, 'action') === 'elementor' ? 'Abrir o Elementor' : 'Abrir o editor de conteúdo', ruido: true };
  }
  if (p === '/wp-admin/post-new.php') return { acao: 'Criar conteúdo novo', ruido: true };
  if (p === '/wp-admin/options.php') return { acao: 'Guardar definições do WordPress', ruido: !escrita };
  if (p === '/wp-admin/customize.php') return { acao: escrita ? 'Guardar no Personalizador' : 'Abrir o Personalizador', ruido: !escrita };
  if (p === '/wp-admin/site-editor.php') return { acao: 'Abrir o Editor do Site', ruido: true };
  if (p === '/wp-admin/plugins.php') {
    const acao = parametro(r.caminho, 'action');
    if (acao === 'activate') return { acao: 'Activar um plugin', ruido: false };
    if (acao === 'deactivate') return { acao: 'Desactivar um plugin', ruido: false };
    if (acao === 'delete-selected' || acao === 'delete') return { acao: 'Apagar um plugin', ruido: false };
    return { acao: escrita ? 'Acção em plugins' : 'Abrir a lista de plugins', ruido: !escrita };
  }
  if (p === '/wp-admin/themes.php') return { acao: parametro(r.caminho, 'action') === 'activate' ? 'Activar um tema' : 'Abrir os temas', ruido: parametro(r.caminho, 'action') !== 'activate' };
  if (p === '/wp-admin/plugin-install.php' || p === '/wp-admin/update.php') return { acao: 'Instalar ou actualizar um plugin ou tema', ruido: !escrita };
  if (p === '/wp-admin/async-upload.php' || p === '/wp-admin/media-new.php') return { acao: 'Enviar um ficheiro para a biblioteca', ruido: !escrita };
  if (p === '/wp-admin/admin-ajax.php') return { acao: 'Pedido do painel do WordPress (admin-ajax)', ruido: true };
  if (p === '/wp-admin/admin-post.php') return { acao: 'Enviar um formulário do painel', ruido: !escrita };
  if (p === '/wp-admin/' || p === '/wp-admin') return { acao: 'Abrir o painel do WordPress', ruido: true };
  return escrita ? { acao: `Pedido ${r.metodo} a ${p}`, ruido: false } : { acao: `Abrir ${p}`, ruido: true };
}

function estadoDoPedido(r: Registo): { estado: EstadoResultado; resultado: string; detalhe?: string } {
  const p = semQuery(r.caminho);
  if (p === '/wp-login.php' && r.metodo === 'POST') {
    if (r.estado >= 300 && r.estado < 400) return { estado: 'ok', resultado: 'OK' };
    if (r.estado === 200) return { estado: 'aviso', resultado: 'Falhou: utilizador ou palavra-passe errados' };
  }
  if (r.estado === 403) return { estado: 'bloqueado', resultado: 'Bloqueado (403)' };
  if (r.estado === 429) return { estado: 'bloqueado', resultado: 'Bloqueado: demasiados pedidos (429)', detalhe: 'O limite de pedidos por minuto do servidor foi atingido.' };
  if (r.estado === 401) return { estado: 'erro', resultado: 'Sem permissão (401)' };
  if (r.estado === 404) return { estado: 'erro', resultado: 'Não encontrado (404)' };
  if (r.estado >= 500) return { estado: 'erro', resultado: `Erro do servidor (${r.estado})` };
  if (r.estado >= 400) return { estado: 'erro', resultado: `Recusado (${r.estado})` };
  return { estado: 'ok', resultado: 'OK' };
}

const FAMILIAS: [RegExp, string][] = [
  [/^932/, 'Costuma ser um falso positivo ao guardar CSS, JavaScript ou PHP no WordPress (ex.: «{ top:» é lido como o comando Unix top).'],
  [/^933/, 'O pedido leva código PHP; é normal ao guardar snippets de PHP.'],
  [/^941/, 'O pedido leva código de script (XSS); é normal ao guardar JavaScript ou HTML.'],
  [/^942/, 'O texto lembra uma instrução SQL.'],
  [/^930/, 'O pedido parece tentar ler ficheiros do sistema.'],
  [/^920/, 'O pedido HTTP está mal formado.'],
  [/^913/, 'O pedido vem de uma ferramenta de varrimento conhecida.'],
];

function limparDado(dado: string): string {
  return dado.replace(/\\+x0[ad]/gi, ' ').replace(/\\+n/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Do texto que o ModSecurity apanhou tira-se o primeiro nome de CSS, para dizer de que botão ou elemento se trata */
function seletorDe(dado: string): string {
  const depois = dado.split(/within [A-Za-z_:.\[\]-]+: /)[1] || dado;
  return limparDado(depois).match(/[.#][A-Za-z_][\w-]*/)?.[0] || '';
}

function enriquecerBloqueio(linha: { acao: string }, b: Bloqueio | null): { resultado: string; detalhe: string } {
  if (!b || !b.regras.length) {
    return { resultado: 'Bloqueado (403)', detalhe: 'O servidor recusou o pedido (403). Não há registo da regra do ModSecurity para este pedido.' };
  }
  const r = b.regras[0];
  const [id, msg, campo, dado] = r;
  const familia = FAMILIAS.find(([rx]) => rx.test(id))?.[1] || '';
  const sel = seletorDe(dado);
  if (sel) linha.acao += sel.startsWith('.gt_switcher') ? ` — botão de tradução (${sel})` : ` — ${sel}`;
  const outras = b.regras.length > 1 ? ` Também disparou: ${b.regras.slice(1, 4).map((x) => x[0]).join(', ')}.` : '';
  return {
    resultado: `Bloqueado pelo ModSecurity · regra ${id}`,
    detalhe: `${msg}${campo ? ` — campo ${campo}` : ''}. ${familia} Solução: excepção desta regra para esse campo, só neste site.${outras}`.replace(/\s+/g, ' ').trim(),
  };
}

// ---------- sessões ----------
const hashUa = (ua: string) => createHash('md5').update(ua).digest('hex').slice(0, 8);

function ehEvidencia(r: Registo): boolean {
  const p = semQuery(r.caminho);
  if (p === '/wp-login.php') return r.metodo === 'POST' && r.estado >= 300 && r.estado < 400;
  if (p.startsWith('/wp-admin/')) return r.estado === 200 && !/^\/wp-admin\/(admin-ajax|admin-post|load-|css\/|js\/|images\/)/.test(p);
  if (p.startsWith('/wp-json/wp/v2/')) return r.metodo !== 'GET' && r.metodo !== 'HEAD' && r.estado >= 200 && r.estado < 300;
  return false;
}

function juntarRepeticoes(linhas: LinhaActividade[]): LinhaActividade[] {
  const out: LinhaActividade[] = [];
  for (const l of linhas) {
    const ant = out[out.length - 1];
    if (ant && ant.acao === l.acao && ant.estado === l.estado && ant.resultado === l.resultado && l.t - (ant.ate ?? ant.t) < 15 * 60_000) {
      ant.n += l.n;
      ant.ate = l.t;
      continue;
    }
    out.push({ ...l });
  }
  return out.map((l) => {
    if (l.n < 2) return l;
    const primeira = l.acao.charAt(0).toLowerCase() + l.acao.slice(1);
    return { ...l, acao: l.estado === 'bloqueado' || l.estado === 'erro' || l.estado === 'aviso' ? `Tentativas de ${primeira}` : `${l.acao} (${l.n}×)` };
  });
}

function sessoesDoDominio(dominio: string, d: DominioLido): SessaoWordPress[] {
  const registos: Registo[] = d.acc.map(([t, ip, metodo, caminho, estado, ua, ref]) => ({ t: t * 1000, ip, metodo, caminho, estado, ua, ref }));
  registos.sort((a, b) => a.t - b.t);
  const grupos = new Map<string, Registo[][]>();
  for (const r of registos) {
    const chave = `${r.ip}|${hashUa(r.ua)}`;
    const lista = grupos.get(chave) || [];
    grupos.set(chave, lista);
    const ult = lista[lista.length - 1];
    if (ult && r.t - ult[ult.length - 1].t <= SESSAO_PAUSA_MS) ult.push(r);
    else lista.push([r]);
  }
  const bloqueios: Bloqueio[] = d.mod.map((b) => ({ t: b.t * 1000, uri: b.uri, ref: b.ref, regras: b.regras }));
  const usados = new Set<Bloqueio>();
  const sessoes: SessaoWordPress[] = [];
  for (const [chave, partes] of grupos) {
    const ip = ipVerdadeiro(chave.split('|')[0]);
    for (const parte of partes) {
      if (!parte.some(ehEvidencia)) continue; // visitantes e robôs que nunca entraram não são sessões
      const ua = parte[0].ua;
      let abriu = false;
      const linhas: LinhaActividade[] = [];
      for (const r of parte) {
        const { acao, ruido } = descreverPedido(r);
        const est = estadoDoPedido(r);
        if (ruido && est.estado === 'ok') {
          if (!abriu && ehEvidencia(r) && semQuery(r.caminho).startsWith('/wp-admin/')) {
            abriu = true;
            linhas.push({ t: r.t, n: 1, acao: 'Abrir o painel do WordPress', onde: `WordPress · ${dominio}`, origem: 'wordpress', estado: 'ok', resultado: 'OK', ip, aparelho: aparelhoDe(ua), conta: d.conta });
          }
          continue;
        }
        const linha: LinhaActividade = { t: r.t, n: 1, acao, onde: `WordPress · ${dominio}`, origem: 'wordpress', ...est, ip, aparelho: aparelhoDe(ua), conta: d.conta };
        if (r.estado === 403) {
          const alvo = semQuery(r.caminho);
          let melhor: Bloqueio | null = null;
          for (const b of bloqueios) {
            if (usados.has(b) || Math.abs(b.t - r.t) > 2500 || semQuery(b.uri) !== alvo) continue;
            if (!melhor || Math.abs(b.t - r.t) < Math.abs(melhor.t - r.t)) melhor = b;
          }
          if (melhor) usados.add(melhor);
          const e = enriquecerBloqueio(linha, melhor);
          linha.resultado = e.resultado;
          linha.detalhe = e.detalhe;
        } else if (r.estado >= 500) {
          const fatal = d.php.find(([t]) => Math.abs(t * 1000 - r.t) <= 3000);
          if (fatal) linha.detalhe = fatal[1];
        }
        linhas.push(linha);
      }
      const juntas = juntarRepeticoes(linhas);
      sessoes.push({
        id: `w|${dominio}|${ip || '-'}|${hashUa(ua)}|${parte[0].t}`,
        dominio,
        conta: d.conta,
        ip,
        aparelho: aparelhoDe(ua),
        desde: parte[0].t,
        ultimo: parte[parte.length - 1].t,
        linhas: juntas,
        acoes: juntas.reduce((s, l) => s + l.n, 0),
        bloqueios: juntas.filter((l) => l.estado === 'bloqueado').reduce((s, l) => s + l.n, 0),
        erros: juntas.filter((l) => l.estado === 'erro' || l.estado === 'aviso').reduce((s, l) => s + l.n, 0),
      });
    }
  }
  return sessoes;
}

/** Todas as sessões de WordPress que os registos do servidor ainda guardam (mais recentes primeiro). `null`: servidor sem resposta. */
export async function sessoesWordPress(): Promise<SessaoWordPress[] | null> {
  const dados = await actividade();
  if (!dados) return null;
  return Object.entries(dados.dominios)
    .flatMap(([dominio, d]) => sessoesDoDominio(dominio, d))
    .sort((a, b) => b.ultimo - a.ultimo);
}

/** Sessões de WordPress e de webmail abertas agora (a última actividade há menos de 30 min), para "Contas ligadas › Agora". */
export async function sessoesExternasAgora(): Promise<{ wordpress: SessaoWordPress[]; webmail: SessaoWebmail[] } | null> {
  const dados = await actividade();
  if (!dados) return null;
  const limite = Date.now() - LIMITE_EXTERNAS_MS;
  const wordpress = (await sessoesWordPress())?.filter((s) => s.ultimo >= limite) || [];
  const webmail: SessaoWebmail[] = dados.webmail.map(([t, ip, email]) => {
    const dominio = (email.split('@')[1] || '').toLowerCase();
    return { email, dominio, conta: dados.mailDominios[dominio] || '', ip: ipVerdadeiro(ip), ultimo: t * 1000 };
  });
  return { wordpress, webmail: webmail.filter((w) => w.ultimo >= limite).sort((a, b) => b.ultimo - a.ultimo) };
}
