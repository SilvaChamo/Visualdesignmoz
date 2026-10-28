#!/bin/bash
# Limpa a cache da Cloudflare de um domínio (Silva, 28/10/2026). Corre no servidor, no fim de cada publicação (deploy-contabo.yml): as páginas
# públicas do Next.js trazem `s-maxage=31536000` e a Cloudflare passa a guardá-las; sem limpar, depois de um deploy serviria HTML antigo a
# apontar para ficheiros `_next/static` que já não existem.
# Uso: limpar-cache-cloudflare.sh [domínio]     (por omissão visualdesignmoz.com)
# Usa as mesmas chaves que o painel (CLOUDFLARE_EMAIL + CLOUDFLARE_GLOBAL_API_KEY, ou o token) lidas de .env.local; nunca as imprime.
# Sai com 0 se limpou (ou se não há chave da Cloudflare: nada a fazer) e com 1 se a Cloudflare recusou depois de 3 tentativas.
set -u
DOM="${1:-visualdesignmoz.com}"
echo "$DOM" | grep -qE '^[a-z0-9.-]+$' || { echo "Domínio inválido"; exit 1; }
ENVF="${VD_ENV:-/opt/visualdesignmoz/.env.local}"
lerenv() { grep -E "^$1=" "$ENVF" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'"; }
CF_EMAIL="$(lerenv CLOUDFLARE_EMAIL)"; CF_KEY="$(lerenv CLOUDFLARE_GLOBAL_API_KEY)"; CF_TOKEN="$(lerenv CLOUDFLARE_API_TOKEN_ACCOUNT)"
if [ -z "$CF_EMAIL$CF_TOKEN" ]; then echo "Sem chave da Cloudflare em $ENVF: nada a limpar."; exit 0; fi
export CF_EMAIL CF_KEY CF_TOKEN DOM
exec python3 - <<'PY'
import os, sys, json, time, urllib.request, urllib.error
H = {'Content-Type': 'application/json'}
if os.environ.get('CF_EMAIL') and os.environ.get('CF_KEY'):
    H['X-Auth-Email'] = os.environ['CF_EMAIL']; H['X-Auth-Key'] = os.environ['CF_KEY']
else:
    H['Authorization'] = 'Bearer ' + os.environ['CF_TOKEN']
def api(method, path, body=None):
    req = urllib.request.Request('https://api.cloudflare.com/client/v4' + path, data=json.dumps(body).encode() if body is not None else None, headers=H, method=method)
    try:
        return json.load(urllib.request.urlopen(req, timeout=30))
    except urllib.error.HTTPError as e:
        try: return json.load(e)
        except Exception: return {'success': False, 'errors': [{'message': 'HTTP %s' % e.code}]}
    except Exception as e:
        return {'success': False, 'errors': [{'message': str(e)[:100]}]}
dom = os.environ['DOM']
for tentativa in (1, 2, 3):
    z = api('GET', '/zones?name=' + dom)
    res = z.get('result') or []
    if not res:
        print('tentativa %d: zona %s não encontrada (%s)' % (tentativa, dom, [e.get('message') for e in z.get('errors', [])])); time.sleep(5); continue
    p = api('POST', '/zones/%s/purge_cache' % res[0]['id'], {'purge_everything': True})
    if p.get('success'):
        print('Cache da Cloudflare de %s limpa.' % dom); sys.exit(0)
    print('tentativa %d: a Cloudflare recusou a limpeza (%s)' % (tentativa, [e.get('message') for e in p.get('errors', [])])); time.sleep(5)
print('ATENÇÃO: a cache da Cloudflare de %s NÃO foi limpa; páginas antigas podem ficar à vista até a validade acabar.' % dom)
sys.exit(1)
PY
