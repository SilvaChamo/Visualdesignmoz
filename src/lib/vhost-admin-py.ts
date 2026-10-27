// Script (python3, como root) das páginas de administração do servidor do painel VisualHost — menus "Gestão do servidor",
// "Ferramentas de admin" e "Sistema e ficheiros". Corre no servidor por /api/vhost/admin-servidor (só o administrador):
// recebe { ver } (leituras) ou { acao } (alterações) em JSON/base64 e escreve uma linha JSON. Só usa os comandos do
// Hestia e do sistema de uma lista fechada; nada vindo do pedido entra numa linha de comandos sem ser validado.
export const ADMIN_PY = String.raw`
import json, os, re, subprocess, sys, base64, time, glob, datetime
arg = json.loads(base64.b64decode(sys.argv[1]).decode())
H = '/usr/local/hestia/bin'
def run(c, t=90):
    try: return subprocess.run(c, capture_output=True, text=True, timeout=t).stdout
    except Exception: return ''
def hj(*c):
    try: return json.loads(run([H + '/' + c[0], *c[1:], 'json']) or '{}')
    except Exception: return {}
def hok(*c):
    try:
        r = subprocess.run([H + '/' + c[0], *[str(x) for x in c[1:]]], capture_output=True, text=True, timeout=180)
        return r.returncode == 0, (r.stdout + r.stderr).strip()[-400:]
    except Exception as e: return False, str(e)
def sai(o): print(json.dumps(o)); sys.exit()
def utilizadores(): return [u for u in hj('v-list-users').keys()]
CONTA = re.compile(r'^[a-z0-9][a-z0-9_.-]{0,31}$')
def tapa(s):
    s = re.sub(r'(Bearer )\S+', r'\1***', s)
    s = re.sub(r'((?:-|_)?pass(?:word)?\d*[ =:])\S+', r'\1***', s, flags=re.I)
    return re.sub(r'((?:key|token|secret)=)[^\s&"]+', r'\1***', s, flags=re.I)

ver, acao = arg.get('ver'), arg.get('acao')

# ---------- IPs ----------
if ver == 'ips':
    ips = hj('v-list-sys-ips')
    sai({'ips': [{'ip': ip, 'dono': v.get('OWNER', ''), 'estado': v.get('STATUS', ''), 'nome': v.get('NAME', ''), 'nat': v.get('NAT', ''), 'interface': v.get('INTERFACE', ''), 'mascara': v.get('NETMASK', ''), 'contas': int(v.get('U_SYS_USERS', '0').count(':') + 1 if v.get('U_SYS_USERS') else 0), 'dominios': int(v.get('U_WEB_DOMAINS') or 0)} for ip, v in ips.items()], 'contas': utilizadores()})
if acao == 'ip-estado':
    ok, out = hok('v-change-sys-ip-status', arg['ip'], arg['estado']); sai({'ok': ok, 'erro': out if not ok else ''})
if acao == 'ip-dono':
    ok, out = hok('v-change-sys-ip-owner', arg['ip'], arg['dono']); sai({'ok': ok, 'erro': out if not ok else ''})

# ---------- Nameservers ----------
if acao == 'ns-conta':
    feitos, erros = 0, []
    for u in arg['contas']:
        ok, out = hok('v-change-user-ns', u, *arg['ns'])
        if ok: feitos += 1
        else: erros.append(u + ': ' + out)
    sai({'ok': not erros, 'feitos': feitos, 'erro': '; '.join(erros)[-400:]})

# ---------- Cron de todas as contas ----------
if ver == 'cron':
    lista = []
    for u in utilizadores():
        for i, v in hj('v-list-cron-jobs', u).items():
            lista.append({'conta': u, 'id': i, 'quando': ' '.join(v.get(k, '*') for k in ('MIN', 'HOUR', 'DAY', 'MONTH', 'WDAY')), 'cmd': tapa(v.get('CMD', '')), 'suspenso': v.get('SUSPENDED') == 'yes', 'data': v.get('DATE', '')})
    sai({'cron': lista})
if acao in ('cron-apagar', 'cron-suspender', 'cron-retomar'):
    cmd = {'cron-apagar': 'v-delete-cron-job', 'cron-suspender': 'v-suspend-cron-job', 'cron-retomar': 'v-unsuspend-cron-job'}[acao]
    erros = []
    for it in arg['itens']:
        ok, out = hok(cmd, it['conta'], it['id'])
        if not ok: erros.append(it['conta'] + '/' + it['id'] + ': ' + out)
    sai({'ok': not erros, 'erro': '; '.join(erros)[-400:]})

# ---------- Monitor da base de dados (MariaDB) ----------
if ver == 'bd':
    def q(s):
        out = run(['mysql', '-N', '-B', '-e', s], 30)
        return [l.split('\t') for l in out.strip().split('\n') if l]
    estado = {k: v for k, v in q("SHOW GLOBAL STATUS WHERE Variable_name IN ('Uptime','Threads_connected','Threads_running','Questions','Slow_queries','Connections','Max_used_connections','Aborted_connects','Bytes_received','Bytes_sent')")}
    var = {k: v for k, v in q("SHOW GLOBAL VARIABLES WHERE Variable_name IN ('version','max_connections','innodb_buffer_pool_size')")}
    proc = [{'id': r[0], 'user': r[1], 'host': r[2], 'bd': r[3], 'comando': r[4], 'tempo': int(r[5] or 0), 'estado': r[6], 'consulta': tapa(r[7] or '')[:300]} for r in q("SELECT ID,USER,HOST,IFNULL(DB,''),COMMAND,TIME,IFNULL(STATE,''),IFNULL(INFO,'') FROM information_schema.PROCESSLIST WHERE COMMAND<>'Daemon' ORDER BY TIME DESC LIMIT 100") if len(r) >= 8]
    bds = [{'nome': r[0], 'mb': float(r[1] or 0), 'tabelas': int(r[2] or 0)} for r in q("SELECT table_schema, ROUND(SUM(data_length+index_length)/1048576,1), COUNT(*) FROM information_schema.TABLES WHERE table_schema NOT IN ('mysql','information_schema','performance_schema','sys') GROUP BY table_schema ORDER BY 2 DESC LIMIT 200")]
    sai({'estado': estado, 'variaveis': var, 'processos': proc, 'bds': bds, 'ativo': bool(estado)})
if acao == 'bd-terminar':
    feitos = 0
    for i in arg['ids']:
        if re.match(r'^\d+$', str(i)) and run(['mysql', '-e', 'KILL ' + str(i)], 20) == '': feitos += 1
    sai({'ok': True, 'feitos': feitos})

# ---------- Fila de e-mail (Exim) ----------
if ver == 'fila':
    out = run(['exim', '-bpra'], 60)
    msgs, cur = [], None
    for l in out.split('\n'):
        m = re.match(r'^\s*(\d+[smhdw])\s+(\S+)\s+([0-9A-Za-z-]{16,23})\s+<(.*?)>(\s+\*\*\* frozen \*\*\*)?', l)
        if m:
            cur = {'idade': m.group(1), 'tamanho': m.group(2), 'id': m.group(3), 'de': m.group(4) or '(sistema)', 'para': [], 'congelada': bool(m.group(5))}
            msgs.append(cur)
        elif cur and l.strip() and not l.strip().startswith('D '):
            cur['para'].append(l.strip())
    sai({'fila': msgs[:1000], 'total': len(msgs)})
if acao in ('fila-tentar', 'fila-apagar'):
    feitos = 0
    for i in arg['ids']:
        if re.match(r'^[0-9A-Za-z-]{16,23}$', i):
            r = subprocess.run(['exim', '-M' if acao == 'fila-tentar' else '-Mrm', i], capture_output=True, text=True, timeout=120)
            feitos += r.returncode == 0
    sai({'ok': True, 'feitos': feitos})
if acao == 'fila-tudo':
    subprocess.Popen(['exim', '-qff'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
    sai({'ok': True})

# ---------- Resumo e rastreio de e-mail (registo do Exim) ----------
def linhas_mail(horas):
    limite = (datetime.datetime.now() - datetime.timedelta(hours=horas)).strftime('%Y-%m-%d %H:%M:%S')
    out = []
    for f in ['/var/log/exim4/mainlog.1', '/var/log/exim4/mainlog']:
        try:
            for l in open(f, errors='replace'):
                if l[:19] >= limite: out.append(l.rstrip('\n'))
        except Exception: pass
    return out
RX = re.compile(r'^(\S+ \S+) (?:\[\d+\] )?([0-9A-Za-z-]{16,23}) (<=|=>|->|==|\*\*|Completed)(?: (\S+))?')
def dominio(a): return a.split('@')[-1].lower().strip('<>') if '@' in a else ''
if ver == 'mail-resumo':
    horas = min(168, max(1, int(arg.get('horas') or 24)))
    por = {}
    tot = {'recebidas': 0, 'entregues': 0, 'adiadas': 0, 'falhadas': 0}
    for l in linhas_mail(horas):
        m = RX.match(l)
        if not m or m.group(3) == 'Completed': continue
        k = {'<=': 'recebidas', '=>': 'entregues', '->': 'entregues', '==': 'adiadas', '**': 'falhadas'}[m.group(3)]
        d = dominio(m.group(4) or '') or '(sem domínio)'
        p = por.setdefault(d, {'dominio': d, 'recebidas': 0, 'entregues': 0, 'adiadas': 0, 'falhadas': 0})
        p[k] += 1; tot[k] += 1
    sai({'horas': horas, 'total': tot, 'dominios': sorted(por.values(), key=lambda x: -(x['recebidas'] + x['entregues']))[:300]})
if ver == 'mail-rastreio':
    q = (arg.get('q') or '').lower().strip()
    horas = min(168, max(1, int(arg.get('horas') or 24)))
    msgs = {}
    for l in linhas_mail(horas):
        m = RX.match(l)
        if not m: continue
        i = m.group(2)
        x = msgs.setdefault(i, {'id': i, 'data': m.group(1), 'de': '', 'para': [], 'estado': 'na fila', 'linhas': []})
        op, end = m.group(3), (m.group(4) or '')
        if op == '<=': x['de'] = end
        elif op in ('=>', '->'): x['para'].append(end); x['estado'] = 'entregue'
        elif op == '==': x['para'].append(end); x['estado'] = 'adiada' if x['estado'] != 'entregue' else x['estado']
        elif op == '**': x['para'].append(end); x['estado'] = 'falhou'
        if len(x['linhas']) < 12: x['linhas'].append(tapa(l[20:])[:300])
    lista = [x for x in msgs.values() if not q or q in (x['de'] + ' ' + ' '.join(x['para'])).lower() or q == x['id'].lower()]
    lista.sort(key=lambda x: x['data'], reverse=True)
    sai({'mensagens': lista[:500], 'total': len(lista)})

# ---------- Logs do sistema ----------
LOGS = {
    'syslog': '/var/log/syslog', 'auth': '/var/log/auth.log', 'nginx': '/var/log/nginx/error.log', 'apache': '/var/log/apache2/error.log',
    'exim': '/var/log/exim4/mainlog', 'exim-rejeitados': '/var/log/exim4/rejectlog', 'dovecot': '/var/log/dovecot.log', 'fail2ban': '/var/log/fail2ban.log',
    'mariadb': '/var/log/mysql/error.log', 'hestia': '/usr/local/hestia/log/system.log', 'hestia-erros': '/usr/local/hestia/log/error.log',
    'hestia-entradas': '/usr/local/hestia/log/auth.log', 'cron-site': '/var/log/visualdesign-cron.log',
    'site': '/root/.pm2/logs/visualdesignmoz-out.log', 'site-erros': '/root/.pm2/logs/visualdesignmoz-error.log',
}
if ver == 'logs':
    f = LOGS.get(arg.get('ficheiro') or 'syslog')
    n = min(5000, max(20, int(arg.get('linhas') or 200)))
    q = (arg.get('q') or '').strip()
    existentes = [k for k, p in LOGS.items() if os.path.exists(p)]
    if not f or not os.path.exists(f): sai({'linhas': [], 'existentes': existentes, 'tamanho': 0})
    out = run(['tail', '-n', str(n if not q else 20000), f], 30).split('\n')
    if q: out = [l for l in out if q.lower() in l.lower()][-n:]
    sai({'linhas': [tapa(l)[:600] for l in out if l], 'existentes': existentes, 'tamanho': os.path.getsize(f)})

# ---------- Firewall (iptables do Hestia) ----------
if ver == 'firewall':
    regras = hj('v-list-firewall')
    ipsets = hj('v-list-firewall-ipset')
    sai({'regras': [{'id': i, 'acao': v.get('ACTION', ''), 'protocolo': v.get('PROTOCOL', ''), 'porta': v.get('PORT', ''), 'ip': v.get('IP', ''), 'comentario': v.get('COMMENT', ''), 'suspensa': v.get('SUSPENDED') == 'yes', 'data': v.get('DATE', '')} for i, v in regras.items()],
         'listas': [{'nome': n, 'origem': v.get('LISTSOURCE', ''), 'ipv': v.get('IP_VERSION', ''), 'auto': v.get('AUTOUPDATE', ''), 'data': v.get('DATE', '')} for n, v in ipsets.items()]})
if acao == 'fw-adicionar':
    ok, out = hok('v-add-firewall-rule', arg['regra'], arg['ip'], arg['porta'], arg['protocolo'], arg.get('comentario') or '')
    sai({'ok': ok, 'erro': out if not ok else ''})
if acao in ('fw-apagar', 'fw-suspender', 'fw-retomar'):
    cmd = {'fw-apagar': 'v-delete-firewall-rule', 'fw-suspender': 'v-suspend-firewall-rule', 'fw-retomar': 'v-unsuspend-firewall-rule'}[acao]
    erros = [i + ': ' + o for i in arg['ids'] for ok, o in [hok(cmd, i)] if not ok]
    sai({'ok': not erros, 'erro': '; '.join(erros)[-400:]})

# ---------- trabalhos longos em segundo plano (instalar PHP, atualizar, reconstruir…) ----------
TRAB = '/var/tmp/vhost-trabalhos'
def a_correr(nome):
    try:
        os.kill(int(open(f'{TRAB}/{nome}.pid').read()), 0); return True
    except Exception: return False
def trabalho(nome, cmd):
    os.makedirs(TRAB, exist_ok=True)
    if a_correr(nome): return False
    log = f'{TRAB}/{nome}.log'
    with open(log, 'a') as f: f.write(f'== início {datetime.datetime.now():%Y-%m-%d %H:%M:%S}\n')
    p = subprocess.Popen(['bash', '-c', f'{cmd} >> {log} 2>&1; echo "== fim (código $?) $(date "+%Y-%m-%d %H:%M:%S")" >> {log}; rm -f {TRAB}/{nome}.pid'],
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True, env={**os.environ, 'DEBIAN_FRONTEND': 'noninteractive', 'PATH': H + ':' + os.environ.get('PATH', '')})
    open(f'{TRAB}/{nome}.pid', 'w').write(str(p.pid))
    return True
def estado_trabalho(nome):
    log = f'{TRAB}/{nome}.log'
    linhas = run(['tail', '-n', '40', log]).split('\n') if os.path.exists(log) else []
    return {'aCorrer': a_correr(nome), 'registo': [tapa(l)[:300] for l in linhas if l]}
def lanca(nome, cmd):
    ok = trabalho(nome, cmd)
    sai({'ok': ok, 'erro': '' if ok else 'Já há um trabalho destes a correr — espere que acabe.'})
def config(): return hj('v-list-sys-config').get('config', {})
def versao_ok(v): return re.match(r'^(5\.6|7\.[0-4]|8\.[0-4])$', v or '')

# ---------- Versões PHP ----------
if ver == 'php':
    inst = set()
    try:
        j = json.loads(run([H + '/v-list-sys-php', 'json']) or '[]')
        inst |= set(j if isinstance(j, list) else j.keys())
    except Exception: pass
    if not inst: inst = {os.path.basename(d) for d in glob.glob('/etc/php/*') if os.path.isdir(d + '/fpm')}
    pred = (re.search(r'PHP (\d\.\d)', run(['php', '-v'])) or [None, ''])[1]
    uso = {}
    for u in utilizadores():
        for d, v in hj('v-list-web-domains', u).items():
            m = re.search(r'(\d)_(\d)', v.get('BACKEND', ''))
            k = m.group(1) + '.' + m.group(2) if m else pred
            uso[k] = uso.get(k, 0) + 1
    sai({'instaladas': sorted(inst), 'predefinida': pred, 'disponiveis': ['7.4', '8.0', '8.1', '8.2', '8.3', '8.4'], 'uso': uso, 'trabalho': estado_trabalho('php')})
if acao in ('php-instalar', 'php-remover'):
    vs = [v for v in arg['versoes'] if versao_ok(v)]
    if not vs: sai({'ok': False, 'erro': 'Escolha as versões.'})
    cmd = 'v-add-web-php' if acao == 'php-instalar' else 'v-delete-web-php'
    lanca('php', '; '.join(f'echo "-- {cmd} {v}"; {H}/{cmd} {v}' for v in vs))
if acao == 'php-predefinida':
    if not versao_ok(arg['versao']): sai({'ok': False, 'erro': 'Versão inválida.'})
    ok, out = hok('v-change-sys-php', arg['versao']); sai({'ok': ok, 'erro': out if not ok else ''})

# ---------- Atualizações do Hestia e do sistema ----------
if ver == 'atualizacoes':
    upd = hj('v-list-sys-hestia-updates')
    sai({'versao': config().get('VERSION', ''), 'pacotes': [{'nome': n, 'versao': v.get('VERSION', ''), 'atual': v.get('UPDATED', '') == 'yes', 'descricao': v.get('DESCR', ''), 'data': v.get('DATE', '')} for n, v in upd.items()], 'trabalho': estado_trabalho('hestia')})
if acao == 'hestia-atualizar':
    lanca('hestia', f'{H}/v-update-sys-hestia-all')
if ver == 'pacotes':
    lista = []
    for l in run(['apt', 'list', '--upgradable'], 90).split('\n'):
        m = re.match(r'^([^/\s]+)/(\S+) (\S+) (\S+) \[upgradable from: ([^\]]+)\]', l)
        if m: lista.append({'nome': m.group(1), 'origem': m.group(2), 'nova': m.group(3), 'atual': m.group(5), 'seguranca': '-security' in m.group(2)})
    hist, cur = [], {}
    try:
        for l in open('/var/log/apt/history.log', errors='replace'):
            if l.startswith('Start-Date:'): cur = {'data': ' '.join(l.split(': ', 1)[1].split())[:16], 'comando': '', 'pacotes': 0, 'tipo': ''}
            elif l.startswith('Commandline:'): cur['comando'] = l.split(': ', 1)[1].strip()[:160]
            elif re.match(r'^(Install|Upgrade|Remove|Purge):', l):
                cur['tipo'] = cur['tipo'] or {'Install': 'Instalar', 'Upgrade': 'Atualizar', 'Remove': 'Remover', 'Purge': 'Remover'}[l.split(':')[0]]
                cur['pacotes'] += l.count('), ') + 1
            elif l.startswith('End-Date:') and cur: hist.append(cur); cur = {}
    except Exception: pass
    stamp = '/var/lib/apt/periodic/update-success-stamp'
    sai({'pacotes': lista, 'historico': hist[-40:][::-1], 'listaDe': datetime.datetime.fromtimestamp(os.path.getmtime(stamp)).strftime('%Y-%m-%d %H:%M') if os.path.exists(stamp) else '', 'trabalho': estado_trabalho('apt')})
APT = 'apt-get -y -o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold'
if acao == 'apt-procurar': lanca('apt', 'apt-get update')
if acao == 'apt-tudo': lanca('apt', f'apt-get update && {APT} upgrade')
if acao == 'apt-pacotes':
    nomes = [n for n in arg['nomes'] if re.match(r'^[a-z0-9][a-z0-9+.:-]{0,80}$', n)]
    if not nomes: sai({'ok': False, 'erro': 'Escolha os pacotes.'})
    lanca('apt', f'{APT} install --only-upgrade ' + ' '.join(nomes))

# ---------- Certificado do painel ----------
if ver == 'tls':
    j = hj('v-list-sys-hestia-ssl')
    c = next(iter(j.values()), {}) if j else {}
    c = {k: v for k, v in c.items() if k not in ('CRT', 'KEY', 'CA')}
    sai({'hostname': run(['hostname', '-f']).strip(), 'cert': c, 'porta': config().get('BACKEND_PORT', '')})
if acao == 'tls-letsencrypt':
    ok, out = hok('v-add-letsencrypt-host'); sai({'ok': ok, 'erro': out if not ok else ''})

# ---------- Definições do servidor ----------
EDITAVEIS = {'BACKUPS': r'^\d{1,2}$', 'UPGRADE_SEND_EMAIL': r'^(true|false)$', 'UPGRADE_SEND_EMAIL_LOG': r'^(true|false)$', 'POLICY_USER_VIEW_LOGS': r'^(yes|no)$', 'POLICY_USER_DELETE_BACKUPS': r'^(yes|no)$'}
if ver == 'definicoes':
    cfg = {k: v for k, v in config().items() if not re.search(r'PASS|KEY|SECRET|TOKEN', k)}
    sai({'hostname': run(['hostname', '-f']).strip(), 'fuso': run(['timedatectl', 'show', '-p', 'Timezone', '--value']).strip(), 'fusos': run(['timedatectl', 'list-timezones']).split(), 'config': cfg, 'editaveis': list(EDITAVEIS)})
if acao == 'def-hostname':
    if not re.match(r'^(?=.{3,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$', arg['host']): sai({'ok': False, 'erro': 'Nome inválido.'})
    ok, out = hok('v-change-sys-hostname', arg['host']); sai({'ok': ok, 'erro': out if not ok else ''})
if acao == 'def-fuso':
    if arg['fuso'] not in run(['timedatectl', 'list-timezones']).split(): sai({'ok': False, 'erro': 'Fuso horário inválido.'})
    ok, out = hok('v-change-sys-timezone', arg['fuso']); sai({'ok': ok, 'erro': out if not ok else ''})
if acao == 'def-valor':
    k, v = arg['chave'], str(arg['valor'])
    if k not in EDITAVEIS or not re.match(EDITAVEIS[k], v): sai({'ok': False, 'erro': 'Valor inválido.'})
    ok, out = hok('v-change-sys-config-value', k, v); sai({'ok': ok, 'erro': out if not ok else ''})

# ---------- Multi-servidor (DNS secundários) ----------
if ver == 'multi':
    sai({'hosts': [{'host': h, 'porta': v.get('PORT', ''), 'tipo': v.get('TYPE', ''), 'user': v.get('USER', ''), 'dnsUser': v.get('DNS_USER', ''), 'suspenso': v.get('SUSPENDED') == 'yes', 'data': v.get('DATE', '')} for h, v in hj('v-list-remote-dns-hosts').items()]})
if acao == 'multi-adicionar':
    ok, out = hok('v-add-remote-dns-host', arg['host'], arg['porta'], arg['user'], arg['senha'], 'api', arg.get('dnsUser') or 'dns-cluster'); sai({'ok': ok, 'erro': out if not ok else ''})
if acao == 'multi-apagar':
    erros = [h + ': ' + o for h in arg['hosts'] for ok, o in [hok('v-delete-remote-dns-host', h)] if not ok]
    sai({'ok': not erros, 'erro': '; '.join(erros)[-400:]})

# ---------- Backups das contas ----------
BK = re.compile(r'^[A-Za-z0-9._-]{1,120}\.tar(\.gz|\.zst)?$')
def fila_backups():
    # o que o servidor está a copiar agora (processos v-backup-user) e o que ainda espera na fila dele
    na_fila = []
    try:
        for l in open('/usr/local/hestia/data/queue/backup.pipe'):
            m = re.search(r'v-backup-user (\S+)', l)
            if m and m.group(1) not in na_fila: na_fila.append(m.group(1))
    except Exception: pass
    a_copiar = []
    for l in run(['pgrep', '-af', '^/bin/bash ' + H + '/v-backup-user ']).split('\n'):
        m = re.search(r'v-backup-user (\S+)', l)
        if m and m.group(1) not in a_copiar: a_copiar.append(m.group(1))
    return {'aCopiar': a_copiar, 'naFila': [u for u in na_fila if u not in a_copiar]}
if ver == 'backups-fila':
    sai({'fila': fila_backups(), 'manual': a_correr('backup-agora')})
if ver == 'backups':
    lista = []
    for u in utilizadores():
        for n, v in hj('v-list-user-backups', u).items():
            lista.append({'conta': u, 'nome': n, 'mb': float(v.get('SIZE') or 0), 'data': v.get('DATE', ''), 'hora': v.get('TIME', ''), 'tipo': v.get('TYPE', ''), 'demorou': v.get('RUNTIME', '')})
    cfg = config()
    sai({'backups': lista, 'config': {k: cfg.get(k, '') for k in ('BACKUP', 'BACKUPS', 'BACKUP_GZIP', 'BACKUP_MODE', 'BACKUP_SYSTEM')}, 'contas': utilizadores(), 'trabalho': estado_trabalho('backup-agora')})
if acao == 'bk-criar':
    # Backup manual: corre já, uma conta a seguir à outra, sem passar pela fila do servidor (a fila recusa com «backup is already scheduled»
    # quando já há um agendado, e um problema urgente não pode esperar pelo agendamento). Em segundo plano e com prioridade baixa; uma conta que a fila
    # do servidor já está a copiar nesse momento fica de fora (duas cópias da mesma conta ao mesmo tempo estragavam-se uma à outra).
    validas = set(utilizadores())
    contas = [u for u in arg['contas'] if u in validas]
    if not contas: sai({'ok': False, 'erro': 'Conta desconhecida.'})
    lanca('backup-agora', '; '.join(f'echo "== {u}: início $(date +%H:%M:%S)"; if pgrep -f "^/bin/bash {H}/v-backup-user {u}( |$)" >/dev/null; then echo "{u}: já está a ser copiada pela fila do servidor, ignorada"; else nice -n 10 ionice -c2 -n7 {H}/v-backup-user {u} && echo "{u}: pronto" || echo "{u}: FALHOU"; fi' for u in contas))
if acao == 'bk-restaurar':
    if not BK.match(arg['nome']): sai({'ok': False, 'erro': 'Cópia inválida.'})
    ok, out = hok('v-schedule-user-restore', arg['conta'], arg['nome']); sai({'ok': ok, 'erro': out if not ok else ''})
if acao == 'bk-apagar':
    erros = [i['conta'] + ': ' + o for i in arg['itens'] if BK.match(i['nome']) for ok, o in [hok('v-delete-user-backup', i['conta'], i['nome'])] if not ok]
    sai({'ok': not erros, 'erro': '; '.join(erros)[-400:]})

# ---------- Backup do sistema (configurações do servidor) ----------
BS = re.compile(r'^vhost-sistema-\d{8}-\d{4}\.tar\.gz$')
if ver == 'backup-sistema':
    pasta = config().get('BACKUP', '/backup') or '/backup'
    fs = sorted(glob.glob(pasta + '/vhost-sistema-*.tar.gz'), reverse=True)
    sai({'pasta': pasta, 'copias': [{'nome': os.path.basename(f), 'mb': round(os.path.getsize(f) / 1048576, 1), 'data': datetime.datetime.fromtimestamp(os.path.getmtime(f)).strftime('%Y-%m-%d %H:%M')} for f in fs], 'trabalho': estado_trabalho('backup-sistema')})
if acao == 'bs-criar':
    pasta = config().get('BACKUP', '/backup') or '/backup'
    lanca('backup-sistema', f'mkdir -p {pasta} && tar --warning=no-file-changed -czf {pasta}/vhost-sistema-$(date +%Y%m%d-%H%M).tar.gz /etc /usr/local/hestia/conf /usr/local/hestia/data /var/spool/cron /root/.pm2/dump.pm2 2>/dev/null; ls -1t {pasta}/vhost-sistema-*.tar.gz | tail -n +6 | xargs -r rm -f; ls -la {pasta}/vhost-sistema-*.tar.gz')
if acao == 'bs-apagar':
    pasta = config().get('BACKUP', '/backup') or '/backup'
    for n in arg['nomes']:
        if BS.match(n) and os.path.exists(pasta + '/' + n): os.remove(pasta + '/' + n)
    sai({'ok': True})

# ---------- Modelos do servidor web e PHP (open_basedir) ----------
TPL = '/usr/local/hestia/data/templates/web'
def modelos(t):
    try:
        j = json.loads(run([H + '/v-list-web-templates' + ({'web': '', 'proxy': '-proxy', 'backend': '-backend'}[t]), 'json']) or '[]')
        return sorted(j if isinstance(j, list) else j.keys())
    except Exception: return []
def dominios_web():
    out = []
    for u in utilizadores():
        for d, v in hj('v-list-web-domains', u).items():
            out.append({'conta': u, 'dominio': d, 'web': v.get('TPL', ''), 'proxy': v.get('PROXY', ''), 'backend': v.get('BACKEND', ''), 'suspenso': v.get('SUSPENDED') == 'yes'})
    return out
if ver == 'httpd':
    sai({'dominios': dominios_web(), 'modelos': {t: modelos(t) for t in ('web', 'proxy', 'backend')}, 'trabalho': estado_trabalho('httpd')})
if acao == 'httpd-mudar':
    t, m = arg['tipo'], arg['modelo']
    if t not in ('web', 'proxy', 'backend') or m not in modelos(t): sai({'ok': False, 'erro': 'Modelo inválido.'})
    cmd = {'web': 'v-change-web-domain-tpl', 'proxy': 'v-change-web-domain-proxy-tpl', 'backend': 'v-change-web-domain-backend-tpl'}[t]
    erros = [i['dominio'] + ': ' + o for i in arg['itens'] for ok, o in [hok(cmd, i['conta'], i['dominio'], m)] if not ok]
    sai({'ok': not erros, 'erro': '; '.join(erros)[-400:]})
if acao == 'httpd-reconstruir':
    lanca('httpd', '; '.join(f'{H}/v-rebuild-web-domains {u} yes' for u in arg['contas']))
SEM = '-sem-basedir'
def basedir_ativo(d):
    for f in glob.glob(f'/etc/php/*/fpm/pool.d/{d}.conf'):
        try:
            if re.search(r'^\s*php_admin_value\[open_basedir\]', open(f).read(), re.M): return True
        except Exception: pass
    return False
if ver == 'basedir':
    sai({'dominios': [dict(x, basedir=basedir_ativo(x['dominio'])) for x in dominios_web()]})
if acao in ('basedir-ligar', 'basedir-desligar'):
    erros = []
    for i in arg['itens']:
        v = hj('v-list-web-domain', i['conta'], i['dominio']).get(i['dominio'], {})
        atual = v.get('BACKEND', '')
        if not atual: erros.append(i['dominio'] + ': sem modelo PHP'); continue
        if acao == 'basedir-desligar':
            if atual.endswith(SEM): continue
            novo = atual + SEM
            orig, dest = f'{TPL}/php-fpm/{atual}.tpl', f'{TPL}/php-fpm/{novo}.tpl'
            if not os.path.exists(orig): erros.append(i['dominio'] + ': modelo ' + atual + ' não encontrado'); continue
            if not os.path.exists(dest):
                open(dest, 'w').write(re.sub(r'^\s*php_admin_value\[open_basedir\].*\n', '', open(orig).read(), flags=re.M))
        else:
            if not atual.endswith(SEM): continue
            novo = atual[: -len(SEM)]
        ok, out = hok('v-change-web-domain-backend-tpl', i['conta'], i['dominio'], novo)
        if not ok: erros.append(i['dominio'] + ': ' + out)
    sai({'ok': not erros, 'erro': '; '.join(erros)[-400:]})

# ---------- security.txt ----------
def raiz(u, d):
    v = hj('v-list-web-domain', u, d).get(d, {})
    return (v.get('DOCUMENT_ROOT') or f'/home/{u}/web/{d}/public_html').rstrip('/')
if ver == 'security-txt':
    out = []
    for x in dominios_web():
        f = raiz(x['conta'], x['dominio']) + '/.well-known/security.txt'
        txt = ''
        try: txt = open(f, errors='replace').read(4000) if os.path.exists(f) else ''
        except Exception: pass
        out.append({'conta': x['conta'], 'dominio': x['dominio'], 'texto': txt})
    sai({'dominios': out})
if acao == 'stxt-gravar':
    u, d = arg['conta'], arg['dominio']
    pasta = raiz(u, d) + '/.well-known'
    r = subprocess.run(['sudo', '-u', u, 'sh', '-c', 'mkdir -p "$1" && cat > "$1/security.txt"', '_', pasta], input=arg['texto'], capture_output=True, text=True, timeout=30)
    sai({'ok': r.returncode == 0, 'erro': r.stderr[-300:]})
if acao == 'stxt-apagar':
    u, d = arg['conta'], arg['dominio']
    r = subprocess.run(['sudo', '-u', u, 'rm', '-f', raiz(u, d) + '/.well-known/security.txt'], capture_output=True, text=True, timeout=30)
    sai({'ok': r.returncode == 0, 'erro': r.stderr[-300:]})

# ---------- ModSecurity, Redis, Nginx Unit, Netdata (estado) ----------
def instalado(pkg): return 'install ok installed' in run(['dpkg-query', '-W', '-f=$' + '{Status}', pkg])
def servico(nome): return run(['systemctl', 'is-active', nome]).strip() == 'active'
if ver == 'modsec':
    conf = '/etc/modsecurity/modsecurity.conf'
    modo = ''
    try: modo = (re.search(r'^\s*SecRuleEngine\s+(\S+)', open(conf).read(), re.M) or [None, ''])[1]
    except Exception: pass
    ev, cur = [], None
    for l in run(['tail', '-n', '4000', '/var/log/apache2/modsec_audit.log']).split('\n'):
        if re.match(r'^--[0-9a-f]+-A--', l): cur = {'data': '', 'ip': '', 'pedido': '', 'regra': ''}; ev.append(cur)
        elif cur is not None and not cur['data'] and re.match(r'^\[', l):
            m = re.match(r'^\[([^\]]+)\] \S+ (\S+)', l)
            if m: cur['data'], cur['ip'] = m.group(1)[:20], m.group(2)
        elif cur is not None and not cur['pedido'] and re.match(r'^(GET|POST|HEAD|PUT|DELETE|OPTIONS) ', l): cur['pedido'] = l[:200]
        elif cur is not None and 'ModSecurity:' in l and not cur['regra']:
            m = re.search(r'\[id "(\d+)"\].*?\[msg "([^"]*)"\]', l); cur['regra'] = (m.group(1) + ' ' + m.group(2)) if m else l[:160]
    sai({'instalado': instalado('libapache2-mod-security2'), 'crs': instalado('modsecurity-crs'), 'modo': modo, 'eventos': [e for e in ev if e['regra']][-200:][::-1], 'trabalho': estado_trabalho('modsec')})
if acao == 'modsec-instalar':
    lanca('modsec', 'apt-get install -y libapache2-mod-security2 modsecurity-crs && cp -n /etc/modsecurity/modsecurity.conf-recommended /etc/modsecurity/modsecurity.conf; a2enmod security2 && apache2ctl configtest && systemctl reload apache2')
if acao == 'modsec-modo':
    conf = '/etc/modsecurity/modsecurity.conf'
    if arg['modo'] not in ('On', 'DetectionOnly', 'Off') or not os.path.exists(conf): sai({'ok': False, 'erro': 'O ModSecurity não está instalado.'})
    antes = open(conf).read()
    open(conf, 'w').write(re.sub(r'^\s*SecRuleEngine\s+\S+', 'SecRuleEngine ' + arg['modo'], antes, flags=re.M) if re.search(r'^\s*SecRuleEngine', antes, re.M) else antes + '\nSecRuleEngine ' + arg['modo'] + '\n')
    if subprocess.run(['apache2ctl', 'configtest'], capture_output=True).returncode != 0:
        open(conf, 'w').write(antes); sai({'ok': False, 'erro': 'A configuração do Apache não passou na verificação; nada mudou.'})
    run(['systemctl', 'reload', 'apache2']); sai({'ok': True})
EXTRAS = {'redis': ('redis-server', 'redis-server'), 'unit': ('unit', 'unit'), 'netdata': ('netdata', 'netdata')}
if ver == 'extras':
    out = {}
    for k, (pkg, svc) in EXTRAS.items():
        inst = instalado(pkg) or bool(run(['sh', '-c', f'command -v {svc}']).strip())
        info = {}
        if k == 'redis' and inst:
            for l in run(['redis-cli', 'info']).split('\n'):
                if ':' in l and l.split(':')[0] in ('redis_version', 'used_memory_human', 'connected_clients', 'uptime_in_days', 'keyspace_hits', 'keyspace_misses', 'maxmemory_human'): info[l.split(':')[0]] = l.split(':', 1)[1].strip()
        out[k] = {'instalado': inst, 'ativo': servico(svc) if inst else False, 'versao': run(['dpkg-query', '-W', '-f=$' + '{Version}', pkg]).strip() if inst else '', 'info': info}
    out['trabalho'] = estado_trabalho('extras')
    sai(out)
if acao == 'extra-servico':
    if arg['nome'] not in EXTRAS or arg['op'] not in ('restart', 'stop', 'start'): sai({'ok': False, 'erro': 'Pedido inválido.'})
    r = subprocess.run(['systemctl', arg['op'], EXTRAS[arg['nome']][1]], capture_output=True, text=True, timeout=120)
    sai({'ok': r.returncode == 0, 'erro': r.stderr[-300:]})
if acao == 'extra-instalar':
    if arg['nome'] != 'redis': sai({'ok': False, 'erro': 'Só o Redis se instala daqui.'})
    lanca('extras', 'apt-get install -y redis-server && systemctl enable --now redis-server')

# ---------- Importar contas (cPanel / DirectAdmin) ----------
if ver == 'importar':
    pasta = config().get('BACKUP', '/backup') or '/backup'
    fs = []
    for f in sorted(glob.glob(pasta + '/*.tar*') + glob.glob(pasta + '/*.zst'), key=os.path.getmtime, reverse=True):
        n = os.path.basename(f)
        tipo = 'cpanel' if re.match(r'^(cpmove-|backup-\d+\.\d+\.\d+_)', n) else 'directadmin' if re.match(r'^(user\.|reseller\.|admin\.).+\.tar', n) or n.startswith('backup-') else ''
        if tipo: fs.append({'nome': n, 'mb': round(os.path.getsize(f) / 1048576, 1), 'data': datetime.datetime.fromtimestamp(os.path.getmtime(f)).strftime('%Y-%m-%d %H:%M'), 'tipo': tipo})
    sai({'pasta': pasta, 'ficheiros': fs, 'scripts': {'cpanel': os.path.exists(H + '/v-import-cpanel'), 'directadmin': os.path.exists(H + '/v-import-directadmin')}, 'trabalho': estado_trabalho('importar')})
if acao == 'importar':
    pasta = config().get('BACKUP', '/backup') or '/backup'
    n, t = arg['ficheiro'], arg['tipo']
    if t not in ('cpanel', 'directadmin') or not re.match(r'^[A-Za-z0-9._-]{1,160}$', n) or not os.path.exists(pasta + '/' + n): sai({'ok': False, 'erro': 'Ficheiro inválido.'})
    if not os.path.exists(H + '/v-import-' + t): sai({'ok': False, 'erro': 'Este Hestia não tem o importador do ' + ('cPanel' if t == 'cpanel' else 'DirectAdmin') + '.'})
    lanca('importar', f'{H}/v-import-{t} {pasta}/{n}')

# ---------- Manutenção ----------
def tamanho(c):
    try: return int(run(['du', '-sm', c]).split()[0])
    except Exception: return 0
if ver == 'manutencao':
    d = os.statvfs('/')
    sai({'discoLivreMb': round(d.f_bavail * d.f_frsize / 1048576), 'discoTotalMb': round(d.f_blocks * d.f_frsize / 1048576), 'registosMb': tamanho('/var/log'), 'aptMb': tamanho('/var/cache/apt'), 'tmpMb': tamanho('/tmp'), 'reparar': os.path.exists(H + '/v-repair-sys-config'), 'trabalho': estado_trabalho('manutencao')})
if acao == 'mnt-reconstruir':
    lanca('manutencao', f'for u in $({H}/v-list-users plain | cut -f1); do echo "-- $u"; {H}/v-rebuild-user "$u" yes; done')
if acao == 'mnt-limpar':
    lanca('manutencao', 'apt-get clean; journalctl --vacuum-time=14d; find /tmp -xdev -type f -atime +7 -delete 2>/dev/null; df -h /')
if acao == 'mnt-reparar':
    if not os.path.exists(H + '/v-repair-sys-config'): sai({'ok': False, 'erro': 'Este Hestia não tem a reparação automática.'})
    lanca('manutencao', f'{H}/v-repair-sys-config')

# ---------- Estatísticas do servidor (sysstat) ----------
if ver == 'estatisticas':
    dia = (datetime.date.today() - datetime.timedelta(days=min(6, max(0, int(arg.get('dia') or 0)))))
    f = f'/var/log/sysstat/sa{dia:%d}'
    def sar(*o):
        rows = []
        for l in run(['sar', *o, '-f', f], 60).split('\n'):
            p = l.split()
            if len(p) > 2 and re.match(r'^\d\d:\d\d:\d\d$', p[0]) and not p[1].isalpha() or (len(p) > 2 and re.match(r'^\d\d:\d\d:\d\d$', p[0]) and p[1] in ('all', 'eth0', 'ens3', 'ens18', 'enp0s3')):
                rows.append(p)
        return rows
    env = {**os.environ, 'LC_ALL': 'C', 'S_TIME_FORMAT': 'ISO'}
    os.environ.update(env)
    cpu = [{'t': r[0][:5], 'user': float(r[2]), 'sistema': float(r[4]), 'espera': float(r[5])} for r in sar('-u') if r[1] == 'all' and len(r) >= 8]
    carga = [{'t': r[0][:5], 'l1': float(r[3]), 'l5': float(r[4]), 'l15': float(r[5])} for r in sar('-q') if len(r) >= 6 and re.match(r'^[\d.]+$', r[3])]
    mem = [{'t': r[0][:5], 'pct': float(r[4])} for r in sar('-r') if len(r) >= 5 and re.match(r'^[\d.]+$', r[4])]
    dev = [r for r in sar('-n', 'DEV') if len(r) >= 6 and re.match(r'^[\d.]+$', r[4]) and not re.match(r'^(lo|veth|docker|br-|virbr|tun|tap)', r[1])]
    soma = {}
    for r in dev: soma[r[1]] = soma.get(r[1], 0) + float(r[4]) + float(r[5])
    iface = max(soma, key=soma.get) if soma else ''
    rede = [{'t': r[0][:5], 'rx': float(r[4]), 'tx': float(r[5])} for r in dev if r[1] == iface]
    sai({'dia': str(dia), 'nucleos': os.cpu_count() or 1, 'cpu': cpu, 'carga': carga, 'memoria': mem, 'rede': rede, 'interface': iface, 'existe': os.path.exists(f), 'sysstat': bool(run(['sh', '-c', 'command -v sar']).strip()), 'trabalho': estado_trabalho('sysstat')})
if acao == 'sysstat-ligar':
    lanca('sysstat', "apt-get install -y sysstat && sed -i 's/^ENABLED=.*/ENABLED=\"true\"/' /etc/default/sysstat; systemctl enable --now sysstat sysstat-collect.timer 2>/dev/null; systemctl restart sysstat; echo 'Os gráficos começam a encher nos próximos 10 minutos.'")

# ---------- Editor de ficheiros do sistema ----------
# Só estes ficheiros; antes de gravar fica uma cópia, a configuração é verificada e, se a verificação falhar, volta a cópia.
ED = {
    'nginx': ('/etc/nginx/nginx.conf', 'Nginx', 'nginx -t', 'systemctl reload nginx'),
    'apache': ('/etc/apache2/apache2.conf', 'Apache', 'apache2ctl configtest', 'systemctl reload apache2'),
    'exim': ('/etc/exim4/exim4.conf.template', 'Exim (e-mail)', 'exim4 -C /etc/exim4/exim4.conf.template -bV', 'systemctl restart exim4'),
    'dovecot': ('/etc/dovecot/dovecot.conf', 'Dovecot (IMAP/POP3)', 'doveconf -n', 'systemctl reload dovecot'),
    'mariadb': ('/etc/mysql/mariadb.conf.d/50-server.cnf', 'MariaDB', 'my_print_defaults mysqld', ''),
    'bind': ('/etc/bind/named.conf.options', 'DNS (Bind)', 'named-checkconf', 'systemctl reload named 2>/dev/null || systemctl reload bind9'),
    'fail2ban': ('/etc/fail2ban/jail.local', 'Força bruta (fail2ban)', 'fail2ban-client -t', 'systemctl reload fail2ban'),
    'vsftpd': ('/etc/vsftpd.conf', 'FTP (vsftpd)', '', 'systemctl restart vsftpd'),
    'proftpd': ('/etc/proftpd/proftpd.conf', 'FTP (ProFTPD)', 'proftpd -t', 'systemctl reload proftpd'),
    'spamassassin': ('/etc/spamassassin/local.cf', 'SpamAssassin', 'spamassassin --lint', ''),
    'clamav': ('/etc/clamav/clamd.conf', 'ClamAV', '', ''),
    'redis': ('/etc/redis/redis.conf', 'Redis', '', ''),
    'crontab': ('/etc/crontab', 'Tarefas do sistema (crontab)', '', ''),
    'hosts': ('/etc/hosts', 'Nomes locais (hosts)', '', ''),
}
for d in sorted(glob.glob('/etc/php/*/fpm/php.ini')):
    v = d.split('/')[3]
    ED['php-' + v] = (d, 'PHP ' + v + ' (php.ini)', f'php-fpm{v} -t', f'systemctl reload php{v}-fpm')
EDB = '/var/backups/vhost-editor'
def ed_info(k):
    c, nome, teste, recarga = ED[k]
    st = os.stat(c) if os.path.exists(c) else None
    return {'id': k, 'nome': nome, 'caminho': c, 'existe': bool(st), 'tamanho': st.st_size if st else 0, 'mtime': str(int(st.st_mtime)) if st else '', 'teste': teste.split(' 2>')[0], 'recarga': recarga.split(' 2>')[0]}
def ed_copias(k):
    fs = sorted(glob.glob(f'{EDB}/{k}.*'), reverse=True)
    return [{'nome': os.path.basename(f), 'tamanho': os.path.getsize(f), 'data': datetime.datetime.fromtimestamp(os.path.getmtime(f)).strftime('%Y-%m-%d %H:%M:%S')} for f in fs]
def ed_gravar(k, novo, mtime):
    c, nome, teste, recarga = ED[k]
    if not os.path.exists(c): sai({'ok': False, 'erro': 'O ficheiro não existe neste servidor.'})
    if mtime and str(int(os.path.getmtime(c))) != mtime: sai({'ok': False, 'erro': 'O ficheiro mudou no servidor desde que o abriu. Abra-o de novo antes de gravar.'})
    antes = open(c, errors='surrogateescape').read()
    os.makedirs(EDB, mode=0o700, exist_ok=True)
    copia = f'{EDB}/{k}.{datetime.datetime.now():%Y%m%d-%H%M%S}'
    open(copia, 'w', errors='surrogateescape').write(antes)
    for velha in sorted(glob.glob(f'{EDB}/{k}.*'), reverse=True)[10:]: os.remove(velha)
    open(c, 'w', errors='surrogateescape').write(novo)
    if teste:
        r = subprocess.run(['bash', '-c', teste], capture_output=True, text=True, timeout=60)
        if r.returncode != 0:
            open(c, 'w', errors='surrogateescape').write(antes)
            sai({'ok': False, 'erro': 'A verificação falhou e o ficheiro voltou ao que estava: ' + tapa((r.stderr or r.stdout).strip())[-500:]})
    aviso = ''
    if recarga:
        r = subprocess.run(['bash', '-c', recarga], capture_output=True, text=True, timeout=120)
        if r.returncode != 0: aviso = 'Gravado, mas o serviço não recarregou: ' + tapa((r.stderr or r.stdout).strip())[-300:]
    else: aviso = 'Gravado. Reinicie o serviço nos Serviços para aplicar.' if k in ('mariadb', 'clamav', 'redis', 'spamassassin') else ''
    sai({'ok': True, 'aviso': aviso, 'copia': os.path.basename(copia), 'mtime': str(int(os.path.getmtime(c)))})
if ver == 'editor':
    sai({'ficheiros': [ed_info(k) for k in ED]})
if ver == 'editor-ler':
    k = arg.get('ficheiro', '')
    if k == 'auto': k = next((x for x in ED if os.path.exists(ED[x][0])), '')
    if k not in ED: sai({'erro': 'Ficheiro desconhecido.'})
    i = ed_info(k)
    if not i['existe']: sai({**i, 'texto': '', 'copias': []})
    if i['tamanho'] > 1048576: sai({**i, 'texto': '', 'grande': True, 'copias': ed_copias(k)})
    sai({**i, 'texto': open(i['caminho'], errors='surrogateescape').read().encode('utf-8', 'replace').decode(), 'copias': ed_copias(k)})
if acao == 'editor-gravar':
    k, tmp = arg['ficheiro'], arg['tmp']
    if k not in ED or not re.match(r'^/var/tmp/vhost-editor-[a-f0-9]{16}\.txt$', tmp) or not os.path.exists(tmp): sai({'ok': False, 'erro': 'Pedido inválido.'})
    novo = open(tmp, errors='surrogateescape').read(); os.remove(tmp)
    ed_gravar(k, novo, arg.get('mtime', ''))
if acao == 'editor-restaurar':
    k, n = arg['ficheiro'], arg['copia']
    if k not in ED or not re.match(r'^' + re.escape(k) + r'\.\d{8}-\d{6}$', n) or not os.path.exists(f'{EDB}/{n}'): sai({'ok': False, 'erro': 'Cópia inválida.'})
    ed_gravar(k, open(f'{EDB}/{n}', errors='surrogateescape').read(), '')

sai({'erro': 'Pedido desconhecido.'})
`;
