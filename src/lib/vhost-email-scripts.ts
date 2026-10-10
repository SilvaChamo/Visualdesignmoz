// Programas que o painel VisualHost põe no servidor para o menu E-mail (pasta /usr/local/vhost, só do root).
// - FERIAS_PY: liga e desliga as mensagens de férias nas datas marcadas (corre de 15 em 15 min pelo cron).
// - COPIAR_PY: copia uma caixa de correio de um servidor IMAP para outro (Migração de e-mail), sem programas extra.
// - RASTREIO_PY: lê os registos do exim e devolve o percurso dos e-mails de um domínio (só leitura).

export const VHOST_DIR = '/usr/local/vhost';

/** Mensagens de férias: { conta: [{ d, acc, de, ate, msg, ativa }] } em /usr/local/vhost/email/<conta>.json */
export const FERIAS_PY = String.raw`#!/usr/bin/env python3
# VisualHost: liga/desliga as mensagens de férias nas datas marcadas (não editar à mão)
import glob, json, os, subprocess, time
H = '/usr/local/hestia/bin'
agora = time.strftime('%Y-%m-%dT%H:%M')
for f in glob.glob('/usr/local/vhost/email/*.json'):
    conta = os.path.basename(f)[:-5]
    try:
        dados = json.load(open(f))
    except Exception:
        continue
    mudou = False
    fica = []
    for v in dados.get('ferias', []):
        if v['de'] <= agora < v['ate']:
            if not v.get('ativa'):
                r = subprocess.run([H + '/v-add-mail-account-autoreply', conta, v['d'], v['acc'], v['msg']], capture_output=True)
                v['ativa'] = r.returncode == 0
                mudou = True
            fica.append(v)
        elif agora >= v['ate']:
            if v.get('ativa'):
                subprocess.run([H + '/v-delete-mail-account-autoreply', conta, v['d'], v['acc']], capture_output=True)
            mudou = True
        else:
            fica.append(v)
    if mudou:
        dados['ferias'] = fica
        tmp = f + '.tmp'
        with open(tmp, 'w') as o:
            json.dump(dados, o)
        os.chmod(tmp, 0o600)
        os.replace(tmp, f)
`;

/** Cópia IMAP → IMAP. Recebe o caminho de um ficheiro .cfg (JSON com os acessos), apaga-o logo depois de o ler
 *  e vai escrevendo o estado em <id>.json ao lado. Não copia duas vezes a mesma mensagem (Message-ID). */
export const COPIAR_PY = String.raw`#!/usr/bin/env python3
# VisualHost: migração de e-mail IMAP -> IMAP (não editar à mão)
import email.utils, imaplib, json, os, re, socket, ssl, sys, time
cfg_path = sys.argv[1]
cfg = json.load(open(cfg_path))
os.remove(cfg_path)
estado_path = cfg_path[:-4] + '.json'
E = {k: cfg[k] for k in ('id', 'tipo', 'origem', 'destino', 'servidorOrigem', 'servidorDestino')}
E.update(estado='a ligar', inicio=time.strftime('%Y-%m-%d %H:%M'), pid=os.getpid(), pastas=0, copiadas=0, existentes=0, total=0, erro='', avisos=[])

def gravar():
    tmp = estado_path + '.tmp'
    with open(tmp, 'w') as o:
        json.dump(E, o)
    os.chmod(tmp, 0o600)
    os.replace(tmp, estado_path)

def ligar(host, user, senha, local, inseguro=False):
    socket.setdefaulttimeout(60)
    if local:
        # caixa deste servidor: pela ligação interna (127.0.0.1), que o dovecot já trata como segura
        m = imaplib.IMAP4('127.0.0.1', 143)
        try:
            m.login(user, senha)
        except imaplib.IMAP4.error:
            raise RuntimeError('Acesso recusado à caixa ' + user + ' (palavra-passe)')
        return m
    # servidor de fora: certificado verificado; sem verificação só se quem pediu a migração o escolheu
    ctx = ssl.create_default_context()
    if inseguro:
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        E['avisos'].append('Certificado de ' + host + ' não verificado (escolhido ao iniciar)')
    erros = []
    for porta, modo in ((993, 'ssl'), (143, 'starttls')):
        try:
            m = imaplib.IMAP4_SSL(host, porta, ssl_context=ctx) if modo == 'ssl' else imaplib.IMAP4(host, porta)
            if modo == 'starttls':
                m.starttls(ssl_context=ctx)
            m.login(user, senha)
            return m
        except imaplib.IMAP4.error:
            raise RuntimeError('Acesso recusado em ' + host + ' (utilizador ou palavra-passe)')
        except ssl.SSLCertVerificationError:
            erros.append('certificado inválido (pode iniciar de novo aceitando certificados não verificados)')
        except Exception as e:
            erros.append(str(e)[:80])
    raise RuntimeError('Não foi possível ligar a ' + host + ': ' + '; '.join(erros[-2:]))

LISTA = re.compile(r'\((?P<flags>[^)]*)\) (?P<sep>"[^"]*"|NIL) (?P<nome>.+)')
def pastas(m):
    tipo, linhas = m.list()
    r = []
    for l in linhas or []:
        if not l:
            continue
        x = LISTA.match(l.decode('utf-8', 'replace'))
        if not x or '\\Noselect' in x.group('flags'):
            continue
        sep = x.group('sep').strip('"') if x.group('sep') != 'NIL' else '/'
        nome = x.group('nome').strip()
        if nome.startswith('"'):
            nome = nome[1:-1].replace('\\"', '"')
        r.append((nome, sep))
    return r

def q(nome):
    return '"' + nome.replace('\\', '\\\\').replace('"', '\\"') + '"'

def ids_existentes(m, pasta):
    ids = set()
    if m.select(q(pasta), readonly=True)[0] != 'OK':
        return ids
    tipo, d = m.uid('SEARCH', None, 'ALL')
    uids = d[0].split() if d and d[0] else []
    for i in range(0, len(uids), 300):
        tipo, d = m.uid('FETCH', b','.join(uids[i:i + 300]), '(BODY.PEEK[HEADER.FIELDS (MESSAGE-ID)])')
        for x in d or []:
            if isinstance(x, tuple):
                v = x[1].decode('utf-8', 'replace').split(':', 1)
                if len(v) == 2 and v[1].strip():
                    ids.add(v[1].strip())
    return ids

try:
    o = cfg['o']; dd = cfg['d']
    src = ligar(o['host'], o['user'], o['senha'], o.get('local', False), o.get('inseguro', False))
    dst = ligar(dd['host'], dd['user'], dd['senha'], dd.get('local', False), dd.get('inseguro', False))
    cfg = None
    E['estado'] = 'a copiar'; gravar()
    lista_dst = pastas(dst)
    sep_dst = lista_dst[0][1] if lista_dst else '.'
    existentes_dst = {n for n, s in lista_dst}
    lista = pastas(src)
    E['pastas'] = len(lista); gravar()
    for nome, sep in lista:
        destino = 'INBOX' if nome.upper() == 'INBOX' else nome.replace(sep, sep_dst) if sep and sep != sep_dst else nome
        if destino not in existentes_dst:
            dst.create(q(destino)); dst.subscribe(q(destino))
        ja = ids_existentes(dst, destino)
        if src.select(q(nome), readonly=True)[0] != 'OK':
            E['avisos'].append('Pasta ignorada: ' + nome); continue
        tipo, d = src.uid('SEARCH', None, 'ALL')
        uids = d[0].split() if d and d[0] else []
        E['total'] += len(uids); gravar()
        for i in range(0, len(uids), 25):
            tipo, d = src.uid('FETCH', b','.join(uids[i:i + 25]), '(FLAGS INTERNALDATE BODY.PEEK[])')
            for x in d or []:
                if not isinstance(x, tuple):
                    continue
                meta = x[0].decode('utf-8', 'replace')
                corpo = x[1]
                mid = ''
                cab = corpo.split(b'\r\n\r\n', 1)[0].decode('utf-8', 'replace')
                r = re.search(r'(?im)^message-id:\s*(\S+)', cab)
                if r:
                    mid = r.group(1)
                if mid and mid in ja:
                    E['existentes'] += 1; continue
                flags = re.search(r'FLAGS \(([^)]*)\)', meta)
                flags = ' '.join(f for f in (flags.group(1).split() if flags else []) if f.lower() != '\\recent')
                data = re.search(r'INTERNALDATE "([^"]+)"', meta)
                dt = imaplib.Time2Internaldate(email.utils.mktime_tz(email.utils.parsedate_tz(data.group(1)))) if data else None
                dst.append(q(destino), '(' + flags + ')' if flags else None, dt, corpo)
                if mid:
                    ja.add(mid)
                E['copiadas'] += 1
            gravar()
    E['estado'] = 'terminada'
except Exception as e:
    E['estado'] = 'falhou'; E['erro'] = str(e)[:300]
E['fim'] = time.strftime('%Y-%m-%d %H:%M')
gravar()
`;

/** Rastreio: lê mainlog (+ rodados, também .gz) e junta as linhas de cada mensagem.
 *  Argumentos (JSON): { d, de, ate, end, estado, dir, max } */
export const RASTREIO_PY = String.raw`
import glob, gzip, json, re, sys
a = json.loads(sys.argv[1])
d = a['d'].lower(); de = a['de']; ate = a['ate']; end = a.get('end', '').lower(); est = a.get('estado', ''); dire = a.get('dir', ''); mx = int(a.get('max', 100))
fich = sorted(glob.glob('/var/log/exim4/mainlog*'), key=lambda f: (f != '/var/log/exim4/mainlog', int(re.sub(r'\D', '', f.split('mainlog')[1]) or 0)))
msgs = {}
L = re.compile(r'^(\d{4}-\d\d-\d\d) (\d\d:\d\d:\d\d)(?:\.\d+)? (?:\[\d+\] )?(\S{16,23}) (<=|=>|->|\*\*|==) (\S+)(.*)$')
for f in fich[:12]:
    try:
        h = gzip.open(f, 'rt', errors='replace') if f.endswith('.gz') else open(f, errors='replace')
    except Exception:
        continue
    for l in h:
        x = L.match(l)
        if not x:
            continue
        dia, hora, mid, op, quem, resto = x.groups()
        if dia < de or dia > ate:
            continue
        m = msgs.setdefault(mid, {'data': dia + ' ' + hora, 'de': '', 'para': [], 'estado': 'recebida', 'tam': 0, 'auth': False, 'motivo': ''})
        if op == '<=':
            m['de'] = '' if quem == '<>' else quem.lower()
            s = re.search(r' S=(\d+)', resto); m['tam'] = int(s.group(1)) if s else 0
            m['auth'] = ' A=' in resto or ' P=local' in resto
            m['data'] = dia + ' ' + hora
        else:
            dest = quem.lower()
            r = re.search(r'<([^>]+)>', resto)
            if r and '@' not in dest:
                dest = r.group(1).lower()
            if dest not in m['para']:
                m['para'].append(dest)
            if op in ('=>', '->'):
                m['estado'] = 'entregue' if m['estado'] != 'falhou' else m['estado']
            elif op == '**':
                m['estado'] = 'falhou'; m['motivo'] = resto.strip()[:160]
            elif op == '==' and m['estado'] not in ('entregue', 'falhou'):
                m['estado'] = 'adiada'; m['motivo'] = resto.strip()[:160]
    h.close()
fora = []
for mid, m in msgs.items():
    nosso_de = m['de'].endswith('@' + d)
    nosso_para = any(p.endswith('@' + d) for p in m['para'])
    if not (nosso_de or nosso_para):
        continue
    m['dir'] = 'saida' if nosso_de and m['auth'] else 'entrada'
    if dire and m['dir'] != dire:
        continue
    if est and m['estado'] != est:
        continue
    if end and end not in m['de'] and not any(end in p for p in m['para']):
        continue
    m['id'] = mid
    del m['auth']
    fora.append(m)
fora.sort(key=lambda m: m['data'], reverse=True)
print(json.dumps(fora[:mx]))
`;
