// Gestor de ficheiros do painel VisualHost: um programa Python que corre SEMPRE como o utilizador da conta
// (sudo -u <conta>) e só aceita caminhos dentro de /home/<conta> (depois de seguir atalhos/symlinks).
// Recebe um JSON em base64 no argv: { conta, op, ... } e responde com uma linha JSON.

export const FM_PY = String.raw`
import base64, json, os, shutil, stat, sys, tarfile, time, zipfile
a = json.loads(base64.b64decode(sys.argv[1]).decode('utf-8'))
BASE = os.path.realpath('/home/' + a['conta'])
def fim(x):
    print(json.dumps(x)); sys.exit(0)
def erro(m):
    fim({'erro': m})
def seguro(rel, existe=True):
    p = os.path.realpath(os.path.join(BASE, str(rel or '').lstrip('/')))
    if p != BASE and not p.startswith(BASE + '/'):
        erro('Caminho fora da sua pasta.')
    if existe and not os.path.lexists(p):
        erro('Não existe: ' + os.path.relpath(p, BASE))
    return p
def rel(p):
    r = os.path.relpath(p, BASE)
    return '' if r == '.' else r
def item(p):
    st = os.lstat(p)
    lig = stat.S_ISLNK(st.st_mode)
    try:
        st2 = os.stat(p)
    except OSError:
        st2 = st
    return {'nome': os.path.basename(p), 'pasta': stat.S_ISDIR(st2.st_mode), 'atalho': lig, 'tam': st2.st_size, 'data': time.strftime('%Y-%m-%d %H:%M', time.localtime(st.st_mtime)), 'perm': oct(st2.st_mode & 0o7777)[2:].zfill(3)}
# pastas de que o servidor precisa: não se apagam, não mudam de nome e não se movem
TOPO = {'web', 'mail', 'conf', 'tmp', '.ssh', 'git', 'backup', 'hestia', 'cgi-bin'}
DO_SITE = {'public_html', 'public_shtml', 'logs', 'private', 'stats', 'cgi-bin', 'document_errors'}
def protegido(p):
    r = rel(p)
    if not r: return True
    s = r.split('/')
    if len(s) == 1 and s[0] in TOPO: return True
    if s[0] in ('web', 'mail') and len(s) == 2: return True
    if s[0] == 'web' and len(s) == 3 and s[2] in DO_SITE: return True
    return False
def nome_ok(n):
    if not n or n in ('.', '..') or '/' in n or '\0' in n or len(n) > 255:
        erro('Nome inválido.')
    return n
op = a['op']
try:
    if op == 'listar':
        p = seguro(a.get('caminho'))
        if not os.path.isdir(p): erro('Não é uma pasta.')
        l = []
        for n in sorted(os.listdir(p), key=lambda x: x.lower()):
            try: l.append(item(os.path.join(p, n)))
            except OSError: pass
        l.sort(key=lambda x: (not x['pasta'], x['nome'].lower()))
        fim({'caminho': rel(p), 'itens': l})
    if op == 'ler':
        p = seguro(a.get('caminho'))
        if not os.path.isfile(p): erro('Não é um ficheiro.')
        if os.path.getsize(p) > 2 * 1024 * 1024: erro('O ficheiro passa de 2 MB; descarregue-o para o editar.')
        b = open(p, 'rb').read()
        if b'\0' in b: erro('Parece um ficheiro binário; não se edita aqui.')
        fim({'caminho': rel(p), 'texto': b.decode('utf-8', 'replace')})
    if op == 'confirmar':
        p = seguro(a.get('caminho'))
        if not os.path.isfile(p): erro('Não é um ficheiro.')
        fim({'real': p, 'tam': os.path.getsize(p)})
    if op == 'guardar':
        pasta = seguro(a.get('pasta'))
        n = nome_ok(a['nome'])
        p = seguro(os.path.join(rel(pasta), n), existe=False)
        if a.get('novo') and os.path.lexists(p): erro('Já existe um ficheiro com esse nome.')
        if os.path.isdir(p): erro('É uma pasta.')
        tmp = p + '.vhost-tmp'
        open(tmp, 'wb').write(base64.b64decode(a.get('texto64', '')))
        if os.path.exists(p): shutil.copymode(p, tmp)
        os.replace(tmp, p)
        fim({'ok': True})
    if op == 'pasta':
        pasta = seguro(a.get('pasta'))
        p = seguro(os.path.join(rel(pasta), nome_ok(a['nome'])), existe=False)
        os.mkdir(p, 0o755)
        fim({'ok': True})
    if op == 'renomear':
        p = seguro(a.get('caminho'))
        if protegido(p): erro('Esta pasta é do servidor; não se muda o nome.')
        dest = seguro(os.path.join(rel(os.path.dirname(p)), nome_ok(a['nome'])), existe=False)
        if os.path.lexists(dest): erro('Já existe um item com esse nome.')
        os.rename(p, dest)
        fim({'ok': True})
    if op in ('copiar', 'mover'):
        destino = seguro(a.get('destino'))
        if not os.path.isdir(destino): erro('O destino tem de ser uma pasta.')
        for c in a.get('caminhos', []):
            p = seguro(c)
            if op == 'mover' and protegido(p): erro('Esta pasta é do servidor; não se move: ' + rel(p))
            if p == BASE: erro('Não se copia a pasta da conta inteira.')
            alvo = os.path.join(destino, os.path.basename(p))
            if os.path.realpath(alvo).startswith(p + '/') or os.path.realpath(alvo) == p: erro('Não se copia uma pasta para dentro dela própria.')
            if os.path.lexists(alvo): erro('Já existe no destino: ' + os.path.basename(p))
            if op == 'mover': shutil.move(p, alvo)
            elif os.path.isdir(p) and not os.path.islink(p): shutil.copytree(p, alvo, symlinks=True)
            else: shutil.copy2(p, alvo, follow_symlinks=False)
        fim({'ok': True})
    if op == 'apagar':
        alvos = []
        for c in a.get('caminhos', []):
            c = os.path.normpath('/' + str(c)).lstrip('/')
            nome = os.path.basename(c)
            if not c or nome in ('', '.', '..'): erro('Escolha o que apagar.')
            # a pasta-mãe é resolvida (atalhos seguidos); o próprio item não (um atalho apaga-se a si, não ao destino)
            pai = seguro(os.path.dirname(c))
            p = os.path.join(pai, nome)
            if os.path.normpath(p) == BASE or protegido(p): erro('Esta pasta é do servidor; não se apaga: ' + rel(p))
            if not os.path.lexists(p): erro('Não existe: ' + rel(p))
            alvos.append(p)
        for p in alvos:
            if os.path.islink(p) or not os.path.isdir(p): os.remove(p)
            else: shutil.rmtree(p)
        fim({'ok': True})
    if op == 'permissoes':
        m = str(a.get('modo', ''))
        if not m.isdigit() or len(m) not in (3, 4) or any(x > '7' for x in m): erro('Permissões inválidas (ex.: 644 ou 755).')
        for c in a.get('caminhos', []):
            p = seguro(c)
            if not os.path.islink(p): os.chmod(p, int(m, 8))
        fim({'ok': True})
    if op == 'comprimir':
        pasta = seguro(a.get('pasta'))
        n = nome_ok(a['nome'])
        formato = 'zip' if n.endswith('.zip') else 'tar.gz' if n.endswith('.tar.gz') or n.endswith('.tgz') else ''
        if not formato: erro('O nome tem de acabar em .zip ou .tar.gz')
        dest = seguro(os.path.join(rel(pasta), n), existe=False)
        if os.path.lexists(dest): erro('Já existe um ficheiro com esse nome.')
        itens = [seguro(c) for c in a.get('caminhos', [])]
        if formato == 'zip':
            with zipfile.ZipFile(dest, 'w', zipfile.ZIP_DEFLATED) as z:
                for p in itens:
                    if os.path.isdir(p):
                        for raiz, ds, fs in os.walk(p):
                            for f in fs:
                                fp = os.path.join(raiz, f)
                                if not os.path.islink(fp): z.write(fp, os.path.relpath(fp, pasta))
                    else: z.write(p, os.path.relpath(p, pasta))
        else:
            with tarfile.open(dest, 'w:gz') as t:
                for p in itens: t.add(p, arcname=os.path.relpath(p, pasta))
        fim({'ok': True})
    if op == 'extrair':
        p = seguro(a.get('caminho'))
        destino = seguro(a.get('destino') or rel(os.path.dirname(p)))
        def dentro(n):
            alvo = os.path.realpath(os.path.join(destino, n))
            if alvo != destino and not alvo.startswith(destino + '/'): erro('O arquivo tenta escrever fora da pasta (recusado).')
        if zipfile.is_zipfile(p):
            with zipfile.ZipFile(p) as z:
                for n in z.namelist(): dentro(n)
                z.extractall(destino)
        elif tarfile.is_tarfile(p):
            with tarfile.open(p) as t:
                ms = t.getmembers()
                for m in ms:
                    dentro(m.name)
                    if m.issym() or m.islnk(): erro('O arquivo tem atalhos (recusado por segurança).')
                    if m.isdev(): erro('O arquivo tem ficheiros especiais (recusado).')
                t.extractall(destino, members=ms)
        else: erro('Só se extraem .zip, .tar, .tar.gz e .tgz.')
        fim({'ok': True})
    if op == 'colocar':
        # ficheiro carregado (já é da conta, em /tmp) → pasta escolhida
        pasta = seguro(a.get('pasta'))
        dest = seguro(os.path.join(rel(pasta), nome_ok(a['nome'])), existe=False)
        if os.path.isdir(dest): erro('Já existe uma pasta com esse nome.')
        tmp = a['tmp']
        if not tmp.startswith('/tmp/vhost-up-') or '/' in tmp[len('/tmp/'):]: erro('Envio inválido.')
        shutil.move(tmp, dest)
        os.chmod(dest, 0o644)
        fim({'ok': True})
    erro('Operação desconhecida.')
except SystemExit:
    raise
except PermissionError:
    erro('Sem permissão para isso.')
except FileExistsError:
    erro('Já existe.')
except Exception as e:
    erro(str(e)[:200])
`;
