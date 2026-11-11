// VhostMail ↔ caixa real: o programa que corre no servidor (python3 + doveadm) e lê/altera UMA caixa de correio.
// O programa vai em «python3 -c» e o JSON de argumentos pela entrada do python; devolve uma linha
// «@@JSON{...}» com o resultado. Só faz as acções desta lista; a rota (api/vhost/vhostmail/caixa) já confirmou que a sessão
// pode ver a conta antes de o chamar.
export const CAIXA_PY = String.raw`
import base64, email, email.policy, email.utils, json, re, subprocess, sys, time
from email.message import EmailMessage

A = json.load(sys.stdin)
U = A['user']
DV = '/usr/bin/doveadm'

def run(args, entrada=None, ok=(0,)):
    if entrada is None:
        p = subprocess.run([DV] + args, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    else:
        p = subprocess.run([DV] + args, input=entrada, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if p.returncode not in ok:
        raise RuntimeError(('doveadm ' + ' '.join(args[:3]) + ': ' + p.stderr.decode('utf-8', 'replace').strip())[:300])
    return p.stdout

def jlinhas(txt):
    txt = txt.decode('utf-8', 'replace').strip()
    if not txt:
        return []
    try:
        v = json.loads(txt)
        return v if isinstance(v, list) else [v]
    except Exception:
        pass
    r = []
    for l in txt.splitlines():
        l = l.strip().lstrip('[').rstrip(']').rstrip(',').strip()
        if l.startswith('{'):
            try:
                r.append(json.loads(l))
            except Exception:
                pass
    return r

def so_nome(s):
    return re.sub(r'[\r\n]', ' ', str(s)).strip()

def uids(v):
    r = [str(int(x)) for x in v if str(x).isdigit()]
    if not r:
        raise RuntimeError('Sem mensagens indicadas')
    return ','.join(r)

def pastas():
    nomes = [x.get('mailbox') for x in jlinhas(run(['-f', 'json', 'mailbox', 'list', '-u', U])) if x.get('mailbox')]
    if 'INBOX' not in nomes:
        nomes.insert(0, 'INBOX')
    est = {}
    try:
        for x in jlinhas(run(['-f', 'json', 'mailbox', 'status', '-u', U, 'messages unseen uidnext', '*'])):
            est[x.get('mailbox')] = x
    except Exception:
        pass
    r = []
    for n in nomes:
        x = est.get(n, {})
        r.append({'n': n, 'total': int(x.get('messages') or 0), 'novas': int(x.get('unseen') or 0), 'proximo': int(x.get('uidnext') or 0)})
    return r

def cabecalho(h):
    m = email.message_from_string(h or '', policy=email.policy.default)
    def g(k):
        try:
            return str(m.get(k, '') or '')
        except Exception:
            return str(m.get_all(k, [''])[0])
    de = g('From')
    nome, end = email.utils.parseaddr(de)
    pa = g('To')
    try:
        quando = email.utils.parsedate_to_datetime(g('Date')).timestamp()
    except Exception:
        quando = 0
    return {'de': nome or end, 'end': end, 'para': pa, 'assunto': g('Subject'), 'quando': quando, 'tipo': g('Content-Type').lower(), 'mid': g('Message-ID')}

def lista():
    f = A['pasta']
    st = [p for p in pastas() if p['n'] == f]
    total = st[0]['total'] if st else 0
    lim = int(A.get('max') or 150)
    if total == 0:
        return {'mensagens': [], 'total': 0}
    ini = max(1, total - lim + 1)
    consulta = ['mailbox', f, str(ini) + ':' + str(total)]
    try:
        xs = jlinhas(run(['-f', 'json', 'fetch', '-u', U, 'uid flags date.received hdr size.virtual body.snippet'] + consulta))
    except Exception:
        xs = jlinhas(run(['-f', 'json', 'fetch', '-u', U, 'uid flags date.received hdr size.virtual'] + consulta))
    r = []
    for x in xs:
        h = cabecalho(x.get('hdr', ''))
        fl = (x.get('flags') or '').replace('\\', '')
        try:
            rec = time.mktime(time.strptime(x.get('date.received', '')[:19], '%Y-%m-%d %H:%M:%S'))
        except Exception:
            rec = 0
        r.append({'uid': int(x['uid']), 'de': h['de'], 'end': h['end'], 'para': h['para'], 'assunto': h['assunto'], 'quando': h['quando'] or rec,
                  'anexo': 'multipart/mixed' in h['tipo'] or 'multipart/signed' in h['tipo'] or 'multipart/report' in h['tipo'],
                  'lida': 'Seen' in fl, 'estrela': 'Flagged' in fl, 'rascunho': 'Draft' in fl, 'tam': int(x.get('size.virtual') or 0), 'snippet': (x.get('body.snippet') or '')[:200]})
    r.sort(key=lambda m: -m['uid'])
    return {'mensagens': r, 'total': total}

def cru(f, uid):
    xs = jlinhas(run(['-f', 'json', 'fetch', '-u', U, 'text', 'mailbox', f, 'uid', str(int(uid))]))
    if not xs:
        raise RuntimeError('Mensagem não encontrada')
    t = xs[0].get('text', '')
    return t.encode('utf-8', 'surrogateescape') if isinstance(t, str) else t

def texto_de(parte):
    try:
        return parte.get_content()
    except Exception:
        b = parte.get_payload(decode=True) or b''
        return b.decode(parte.get_content_charset() or 'utf-8', 'replace')

def ler():
    f, uid = A['pasta'], int(A['uid'])
    raw = cru(f, uid)
    m = email.message_from_bytes(raw, policy=email.policy.default)
    corpo = m.get_body(preferencelist=('html', 'plain'))
    html = ''
    txt = ''
    if corpo is not None:
        c = texto_de(corpo)
        if corpo.get_content_type() == 'text/html':
            html = c
        else:
            txt = c
    if html == '':
        pl = m.get_body(preferencelist=('plain',))
        if pl is not None and not txt:
            txt = texto_de(pl)
    anexos = []
    cids = {}
    i = 0
    for p in m.walk():
        if p.is_multipart():
            continue
        nome = p.get_filename()
        cid = (p.get('Content-ID') or '').strip('<> ')
        disp = p.get_content_disposition()
        if p is corpo or (not nome and not cid and p.get_content_maintype() == 'text' and disp != 'attachment'):
            continue
        dados = p.get_payload(decode=True) or b''
        if cid and p.get_content_maintype() == 'image' and len(dados) < 400000:
            cids[cid] = 'data:' + p.get_content_type() + ';base64,' + base64.b64encode(dados).decode()
        if nome or disp == 'attachment' or (not cid and p.get_content_maintype() != 'text'):
            anexos.append({'i': i, 'nome': nome or ('anexo-' + str(i)), 'tipo': p.get_content_type(), 'tam': len(dados)})
        i += 1
    for k, v in cids.items():
        html = html.replace('cid:' + k, v)
    h = cabecalho(raw.split(b'\r\n\r\n', 1)[0].decode('utf-8', 'replace') if b'\r\n\r\n' in raw else raw.split(b'\n\n', 1)[0].decode('utf-8', 'replace'))
    if not A.get('naoLida'):
        run(['flags', 'add', '-u', U, '\\Seen', 'mailbox', f, 'uid', str(uid)])
    return {'html': html, 'texto': txt, 'anexos': anexos, 'de': h['de'], 'end': h['end'], 'para': h['para'], 'assunto': h['assunto'], 'quando': h['quando'], 'cc': str(m.get('Cc', '') or ''), 'mid': h['mid'], 'ref': str(m.get('References', '') or '')}

def anexo():
    raw = cru(A['pasta'], A['uid'])
    m = email.message_from_bytes(raw, policy=email.policy.default)
    i = 0
    for p in m.walk():
        if p.is_multipart():
            continue
        nome = p.get_filename()
        cid = (p.get('Content-ID') or '').strip('<> ')
        disp = p.get_content_disposition()
        corpo = (not nome and not cid and p.get_content_maintype() == 'text' and disp != 'attachment')
        if corpo:
            continue
        if i == int(A['i']):
            d = p.get_payload(decode=True) or b''
            return {'nome': nome or ('anexo-' + str(i)), 'tipo': p.get_content_type(), 'b64': base64.b64encode(d).decode()}
        i += 1
    raise RuntimeError('Anexo não encontrado')

def original():
    return {'texto': cru(A['pasta'], A['uid']).decode('utf-8', 'replace')}

def criar_pasta(nome):
    run(['mailbox', 'create', '-u', U, nome], ok=(0, 65, 68))
    run(['mailbox', 'subscribe', '-u', U, nome], ok=(0, 65, 68))

def marcar():
    f = A['pasta']
    for fl in A.get('juntar', []):
        run(['flags', 'add', '-u', U, '\\' + fl, 'mailbox', f, 'uid', uids(A['uids'])])
    for fl in A.get('tirar', []):
        run(['flags', 'remove', '-u', U, '\\' + fl, 'mailbox', f, 'uid', uids(A['uids'])])
    return {}

def mover():
    criar_pasta(A['destino'])
    run(['move', '-u', U, A['destino'], 'mailbox', A['pasta'], 'uid', uids(A['uids'])])
    return {}

def apagar():
    run(['expunge', '-u', U, 'mailbox', A['pasta'], 'uid', uids(A['uids'])])
    return {}

def entregar(msg_bytes, pasta, flags):
    # entrega na pasta como o exim (dovecot-lda): cria a pasta se faltar e não mexe no resto da caixa
    criar_pasta(pasta)
    p = subprocess.run(['/usr/lib/dovecot/dovecot-lda', '-d', U, '-m', pasta, '-e'], input=msg_bytes, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if p.returncode != 0:
        raise RuntimeError('Não foi possível guardar na pasta ' + pasta + ': ' + p.stderr.decode('utf-8', 'replace').strip()[:200])
    mid = email.message_from_bytes(msg_bytes).get('Message-ID', '').strip()
    if mid and flags:
        for fl in flags:
            run(['flags', 'add', '-u', U, '\\' + fl, 'mailbox', pasta, 'header', 'message-id', mid], ok=(0, 65))

def montar_msg(d):
    m = EmailMessage()
    m['From'] = email.utils.formataddr((d.get('nome', ''), U))
    m['To'] = so_nome(d['para'])
    if d.get('cc'):
        m['Cc'] = so_nome(d['cc'])
    m['Subject'] = so_nome(d.get('assunto') or '(sem assunto)')
    m['Date'] = email.utils.formatdate(localtime=True)
    m['Message-ID'] = email.utils.make_msgid(domain=U.split('@')[1])
    if d.get('responde'):
        m['In-Reply-To'] = so_nome(d['responde'])
        m['References'] = so_nome((d.get('referencias', '') + ' ' + d['responde']).strip())
    txt = d.get('texto', '')
    m.set_content(txt or ' ')
    if d.get('html'):
        m.add_alternative(d['html'], subtype='html')
    for a in d.get('anexos', []):
        tipo = (a.get('tipo') or 'application/octet-stream').split('/', 1)
        if len(tipo) != 2:
            tipo = ['application', 'octet-stream']
        m.add_attachment(base64.b64decode(a['b64']), maintype=tipo[0], subtype=tipo[1], filename=so_nome(a['nome']))
    return m

def enviar():
    d = A['msg']
    m = montar_msg(d)
    destinos = [x for x in [d['para']] + ([d['cc']] if d.get('cc') else []) + ([d['cco']] if d.get('cco') else []) for x in [x]]
    alvo = [e for n, e in email.utils.getaddresses(destinos) if e]
    if not alvo:
        raise RuntimeError('Sem destinatário válido')
    # o exim entrega (local ou para fora) como faz com qualquer e-mail desta conta
    p = subprocess.run(['/usr/sbin/sendmail', '-i', '-f', U] + alvo, input=m.as_bytes(), stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if p.returncode != 0:
        raise RuntimeError('O servidor recusou o envio: ' + p.stderr.decode('utf-8', 'replace').strip()[:200])
    entregar(m.as_bytes(), A.get('pastaEnviados') or 'Sent', ['Seen'])
    if A.get('apagarRascunho'):
        try:
            apagar_uids(A['apagarRascunho']['pasta'], [A['apagarRascunho']['uid']])
        except Exception:
            pass
    return {}

def apagar_uids(pasta, lst):
    run(['expunge', '-u', U, 'mailbox', pasta, 'uid', uids(lst)])

def rascunho():
    m = montar_msg(A['msg'])
    entregar(m.as_bytes(), A.get('pastaRascunhos') or 'Drafts', ['Seen', 'Draft'])
    if A.get('apagarRascunho'):
        try:
            apagar_uids(A['apagarRascunho']['pasta'], [A['apagarRascunho']['uid']])
        except Exception:
            pass
    return {}

def importar():
    # mensagens já escritas (cabeçalhos + texto); não repete a que já lá estiver (Message-ID)
    feitas, ja = 0, 0
    for x in A['mensagens']:
        m = EmailMessage()
        m['From'] = x['de']
        m['To'] = x['para']
        m['Subject'] = x['assunto']
        m['Date'] = email.utils.format_datetime(__import__('datetime').datetime.fromtimestamp(x['quando'], __import__('datetime').timezone.utc))
        m['Message-ID'] = x['mid']
        m.set_content(x['texto'])
        if x.get('html'):
            m.add_alternative(x['html'], subtype='html')
        existe = jlinhas(run(['-f', 'json', 'search', '-u', U, 'mailbox', A.get('pasta') or 'INBOX', 'header', 'message-id', x['mid']]))
        if existe:
            ja += 1
            continue
        entregar(m.as_bytes(), A.get('pasta') or 'INBOX', ['Seen'])
        feitas += 1
    return {'feitas': feitas, 'jaExistiam': ja}

ACOES = {
    'pastas': lambda: {'pastas': pastas()},
    'lista': lista, 'ler': ler, 'anexo': anexo, 'original': original,
    'marcar': marcar, 'mover': mover, 'apagar': apagar,
    'criarPasta': lambda: (criar_pasta(A['nome']), {})[1],
    'enviar': enviar, 'rascunho': rascunho, 'importar': importar,
}
try:
    r = ACOES[A['acao']]()
    print('@@JSON' + json.dumps({'ok': True, 'r': r}, ensure_ascii=False))
except Exception as e:
    print('@@JSON' + json.dumps({'ok': False, 'erro': str(e)[:300]}, ensure_ascii=False))
`;
