#!/usr/bin/env python3
"""
Sincroniza o DNS da Cloudflare para o Hestia do Contabo (ns1..ns4.visualdesignmoz.com).

Os sites continuam com o DNS na Cloudflare (pedido do Silva, 16/10/2026); a Cloudflare manda. Para cada zona da
Cloudflare cujo domínio está numa conta do Hestia, a zona do Hestia fica com os mesmos registos — assim ns1..ns4
respondem com autoridade (sem REFUSED) e dão as mesmas respostas que a Cloudflare. Os registos com proxy (nuvem
laranja) ficam com o IP de destino. Só muda o que difere; nunca toca nos NS da zona do Hestia. Só as zonas já
activas na Cloudflare (as que ainda esperam pelos nameservers ficam como estão).

Instalado em /usr/local/bin/vd-dns-sync; corre depois de cada alteração de DNS no painel, só para esse domínio
(route.ts, espelharNoServidor), e à mão para todos:  vd-dns-sync [--dominio exemplo.co.mz] [--seco]
Credenciais: CLOUDFLARE_EMAIL + CLOUDFLARE_GLOBAL_API_KEY (ou CLOUDFLARE_API_TOKEN_ACCOUNT), do ambiente ou do
.env.local do site.
"""
import argparse
import fcntl
import json
import os
import re
import subprocess
import sys
import urllib.request

H = '/usr/local/hestia/bin'
IP = '169.58.148.144'
NS = ['ns1.visualdesignmoz.com', 'ns2.visualdesignmoz.com', 'ns3.visualdesignmoz.com', 'ns4.visualdesignmoz.com']
ENV_SITE = ['/opt/visualdesign-site-teste/.env.local', '/opt/visualdesign-site/.env.local']
TIPOS = ('A', 'AAAA', 'CNAME', 'MX', 'TXT', 'CAA', 'SRV')
TRAVA = '/var/lock/vd-dns-sync.lock'
os.environ.setdefault('HESTIA', '/usr/local/hestia')  # o cron não traz o ambiente do Hestia


def credenciais():
    env = dict(os.environ)
    for f in ENV_SITE:
        try:
            for linha in open(f, encoding='utf-8'):
                m = re.match(r'^(CLOUDFLARE_[A-Z_]+)=(.*)$', linha.strip())
                if m and not env.get(m.group(1)):
                    env[m.group(1)] = m.group(2).strip().strip('"\'')
        except OSError:
            pass
    if env.get('CLOUDFLARE_EMAIL') and env.get('CLOUDFLARE_GLOBAL_API_KEY'):
        return {'X-Auth-Email': env['CLOUDFLARE_EMAIL'], 'X-Auth-Key': env['CLOUDFLARE_GLOBAL_API_KEY']}
    if env.get('CLOUDFLARE_API_TOKEN_ACCOUNT'):
        return {'Authorization': 'Bearer ' + env['CLOUDFLARE_API_TOKEN_ACCOUNT']}
    sys.exit('Sem credenciais da Cloudflare (CLOUDFLARE_EMAIL/CLOUDFLARE_GLOBAL_API_KEY).')


def cf(cab, caminho):
    """Todas as páginas de um GET da API da Cloudflare"""
    tudo, pagina = [], 1
    while True:
        sep = '&' if '?' in caminho else '?'
        req = urllib.request.Request(f'https://api.cloudflare.com/client/v4{caminho}{sep}per_page=100&page={pagina}', headers=cab)
        r = json.load(urllib.request.urlopen(req, timeout=30))
        if not r.get('success'):
            raise RuntimeError(f'Cloudflare: {r.get("errors")}')
        tudo += r['result']
        info = r.get('result_info') or {}
        if pagina >= (info.get('total_pages') or 1):
            return tudo
        pagina += 1


def hestia(*args, saida=False):
    r = subprocess.run([f'{H}/{args[0]}', *args[1:]], capture_output=True, text=True, timeout=120)
    if saida:
        return r.stdout
    if r.returncode != 0:
        raise RuntimeError((r.stdout + r.stderr).strip()[:200] or f'{args[0]} falhou ({r.returncode})')
    return r.stdout


def hestia_json(*args):
    out = hestia(*args, 'json', saida=True)
    try:
        return json.loads(out) if out.strip() else {}
    except ValueError:
        return {}


def donos():
    """zona → conta do Hestia (pelo site, pelo e-mail ou pela zona DNS que a conta já tem)"""
    d = {}
    for u in hestia_json('v-list-users'):
        for cmd in ('v-list-web-domains', 'v-list-mail-domains', 'v-list-dns-domains'):
            for dom in hestia_json(cmd, u):
                d.setdefault(dom.lower(), u)
    return d


def sem_ponto(v):
    return v.rstrip('.').lower()


def texto_txt(v):
    """"a" "b" (texto partido em pedaços, ex. DKIM) ou "a" → a b juntos, sem aspas"""
    v = v.strip()
    pedacos = re.findall(r'"((?:[^"\\]|\\.)*)"', v)
    return ''.join(pedacos) if pedacos and v.startswith('"') else v


def caa(v):
    m = re.match(r'^\s*(\d+)\s+(\w+)\s+"?(.*?)"?\s*$', v)
    return f'{m.group(1)} {m.group(2).lower()} "{m.group(3)}"' if m else v.strip()


def chave(nome, tipo, valor, prio):
    """Forma comparável de um registo (o TTL não conta: a Cloudflare usa "automático")"""
    if tipo in ('CNAME', 'MX'):
        valor = sem_ponto(valor)
    elif tipo == 'TXT':
        valor = texto_txt(valor)
    elif tipo == 'CAA':
        valor = caa(valor)
    elif tipo == 'SRV':
        partes = valor.split()
        valor = ' '.join(partes[:-1] + [sem_ponto(partes[-1])]) if partes else valor
    return (nome.lower(), tipo, valor, str(prio or '') if tipo in ('MX', 'SRV') else '')


def desejados(zona, registos):
    """Registos da Cloudflare na forma do Hestia: {chave: (nome, tipo, valor, prioridade, ttl)}"""
    out = {}
    for r in registos:
        tipo = r['type']
        if tipo not in TIPOS:
            continue
        nome = '@' if r['name'] == zona else r['name'][: -(len(zona) + 1)]
        valor, prio = r['content'], ''
        if tipo == 'MX':
            prio = str(r.get('priority', 10))
        if tipo == 'SRV':
            d = r.get('data') or {}
            prio = str(d.get('priority', r.get('priority', 0)))
            valor = f"{d.get('weight', 0)} {d.get('port', 0)} {d.get('target', '')}"
        if tipo == 'TXT':
            valor = texto_txt(valor)
        if tipo == 'CAA':
            valor = caa(valor)
        ttl = 3600 if r.get('ttl', 1) == 1 else r['ttl']
        out[chave(nome, tipo, valor, prio)] = (nome, tipo, valor, prio, ttl)
    return out


def para_hestia(tipo, valor):
    if tipo in ('CNAME', 'MX'):
        return sem_ponto(valor) + '.'
    if tipo == 'SRV':
        p = valor.split()
        return ' '.join(p[:-1] + [sem_ponto(p[-1]) + '.'])
    return valor


def linha(nome, tipo, valor, prio):
    return f'{tipo} {nome} {(prio + " ") if prio else ""}{valor}'


def sincronizar(zona, conta, registos_cf, seco):
    """Devolve (zona criada?, adicionados, removidos, erros, detalhe do que muda)"""
    criada = False
    quer = desejados(zona, registos_cf)
    if not quer:
        raise RuntimeError('a Cloudflare não devolveu registos — a zona do Hestia não se esvazia')
    atuais = {}
    if not hestia_json('v-list-dns-domains', conta).get(zona):
        criada = True
        if not seco:
            hestia('v-add-dns-domain', conta, zona, IP, *NS)
    if not (seco and criada):
        for rid, x in hestia_json('v-list-dns-records', conta, zona).items():
            tipo = (x.get('TYPE') or '').upper()
            if tipo == 'NS':
                continue
            k = chave(x.get('RECORD') or '@', tipo, x.get('VALUE') or '', x.get('PRIORITY') or '')
            atuais.setdefault(k, []).append((rid, linha(x.get('RECORD') or '@', tipo, x.get('VALUE') or '', x.get('PRIORITY') or '')))
    sair = [r for k, ids in atuais.items() for r in (ids if k not in quer else ids[1:])]
    entrar = [v for k, v in quer.items() if k not in atuais]
    detalhe = [f'- {d}' for _, d in sair] + [f'+ {linha(n, t, v, p)}' for n, t, v, p, _ in entrar]
    erros = []
    if seco:
        return criada, len(entrar), len(sair), erros, detalhe
    for rid, _ in sair:
        try:
            hestia('v-delete-dns-record', conta, zona, rid, 'no')
        except RuntimeError as e:
            erros.append(f'apagar {rid}: {e}')
    for nome, tipo, valor, prio, ttl in entrar:
        try:
            hestia('v-add-dns-record', conta, zona, nome, tipo, para_hestia(tipo, valor), prio, '', 'no', str(ttl))
        except RuntimeError as e:
            erros.append(f'{tipo} {nome}: {e}')
    return criada, len(entrar), len(sair), erros, detalhe


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dominio', help='só esta zona (ex.: depois de uma alteração no painel)')
    ap.add_argument('--seco', action='store_true', help='só mostra o que mudaria')
    a = ap.parse_args()
    trava = open(TRAVA, 'w')
    fcntl.flock(trava, fcntl.LOCK_EX)
    cab = credenciais()
    falar = a.seco or a.dominio  # no cron só se escreve o que mudou e os erros (o registo não cresce à toa)
    contas = donos()
    mudou = False
    for z in sorted(cf(cab, '/zones'), key=lambda z: z['name']):
        zona = z['name'].lower()
        if a.dominio and zona != a.dominio.lower().strip():
            continue
        if z.get('status') != 'active':
            # zona ainda não activa na Cloudflare: quem responde pelo domínio não é a Cloudflare — não se toca
            if falar:
                print(f'{zona}: zona da Cloudflare ainda não activa ({z.get("status")}) — fica como está')
            continue
        conta = contas.get(zona)
        if not conta:
            if falar:
                print(f'{zona}: sem conta no Hestia — fica só na Cloudflare')
            continue
        try:
            criada, mais, menos, erros, detalhe = sincronizar(zona, conta, cf(cab, f"/zones/{z['id']}/dns_records"), a.seco)
        except Exception as e:  # uma zona com problema não pára as outras
            print(f'{zona} ({conta}): ERRO {e}')
            continue
        if criada or mais or menos:
            mudou = True
            print(f'{zona} ({conta}):{" zona criada," if criada else ""} +{mais} -{menos}' + (' [seco]' if a.seco else ''))
            if a.seco:
                for d in detalhe:
                    print(f'    {d}')
        for e in erros:
            print(f'  {zona}: {e}')
    if mudou and not a.seco:
        hestia('v-restart-dns')


if __name__ == '__main__':
    main()
