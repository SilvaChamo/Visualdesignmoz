import { executeServerCommand } from '@/lib/server-ssh-exec';
import { hestiaCall, hestiaCallJson } from '@/lib/hestia-client';

/**
 * Passar um domínio de uma conta do servidor (Hestia) para outra, com tudo o que lhe pertence (plano
 * VisualHost/07-plano-passar-dominios-entre-contas.md, aprovado pelo Silva a 12/10/2026):
 * site, e-mails (com as palavras-passe), certificado, zona DNS e FTP (`v-change-domain-owner`), as bases de dados
 * escolhidas (`v-change-database-owner`, que muda o prefixo do nome), o WordPress a apontar para o nome novo
 * (só as linhas DB_NAME e DB_USER, escritas como o dono do site), a regra do webmail em /webmail e as tarefas cron
 * do domínio. Antes de tudo guarda uma cópia em /root/vh-passagens; se um passo falhar, desfaz o que já fez.
 * O DNS não muda (é o mesmo servidor).
 */

export const DOMINIO_OK = /^(?=.{3,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;
export const CONTA_OK = /^[a-z][a-z0-9_-]{1,31}$/;
const BASE_OK = /^[a-z0-9][a-z0-9_]{1,63}$/;
const CONTAS_DO_SISTEMA = new Set(['admin', 'root']);

/** Regra do webmail (o mesmo texto para todos os domínios; ver VisualHost/ferramentas/servidor/LEIA-ME.md) */
export const WEBMAIL_NGINX = `# VisualHost: Roundcube em https://<domínio>/webmail (e /roundcube), como no DA. Aprovado pelo Silva a 11/10/2026.
# Posto pelo painel (nginx.conf_webmail e nginx.ssl.conf_webmail); o mesmo texto serve para todos os sites.
# O cabeçalho X-VH-Webmail diz ao painel que este domínio já abre o webmail aqui (e não no servidor antigo).
location = /webmail { return 301 /webmail/$is_args$args; }
location = /roundcube { return 301 /webmail/$is_args$args; }
location /roundcube/ { return 301 /webmail/$is_args$args; }
location /webmail/ {
	add_header X-VH-Webmail 1 always;
	proxy_set_header Host webmail.teste.visualdesignmoz.com;
	proxy_set_header X-Real-IP $remote_addr;
	proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
	proxy_set_header X-Forwarded-Proto https;
	proxy_pass http://169.58.148.144:8080/;
	proxy_redirect ~^https?://webmail\\.teste\\.visualdesignmoz\\.com(?::\\d+)?/(.*)$ /webmail/$1;
	# o Roundcube não sabe que está em /webmail: os redirecionamentos para "/..." ganham o /webmail à frente
	proxy_redirect / /webmail/;
}
`;

const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64');
const linhas = (out: string) => Object.fromEntries(out.split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));

export type Previsao = {
  dominio: string;
  /** conta onde está agora (vazio: não existe no servidor) */
  dono: string;
  site: boolean;
  ssl: boolean;
  dns: boolean;
  emails: number;
  wordpress: boolean;
  /** base que o WordPress usa (lida do wp-config.php, só o nome) */
  baseWp: string;
  /** bases sugeridas: a do WordPress e as que têm o nome do domínio */
  bases: string[];
  /** todas as bases da conta (para escolher outras) */
  todasBases: string[];
  ftp: string[];
  cron: number;
};

/** O que vai passar, visto agora no servidor */
export async function preverPassagem(dominio: string): Promise<Previsao | { erro: string }> {
  const d = dominio.trim().toLowerCase();
  if (!DOMINIO_OK.test(d)) return { erro: 'Domínio inválido.' };
  // nome curto do domínio, só letras e números (ex.: mltmark.com → mltmark), para achar as bases com esse nome
  const raiz = d.split('.')[0].replace(/[^a-z0-9]/g, '');
  const script = `H=/usr/local/hestia/bin; HD=/usr/local/hestia/data/users; D='${d}'
o=$($H/v-search-domain-owner "$D" 2>/dev/null | head -1)
echo "DONO=$o"
[ -z "$o" ] && exit 0
w=$(grep "DOMAIN='$D'" "$HD/$o/web.conf" 2>/dev/null)
[ -n "$w" ] && echo SITE=1
echo "$w" | grep -q "SSL='yes'" && echo SSL=1
echo "FTP=$(echo "$w" | grep -o "FTP_USER='[^']*'" | cut -d"'" -f2 | tr ':' ' ')"
grep -q "DOMAIN='$D'" "$HD/$o/dns.conf" 2>/dev/null && echo DNS=1
if [ -f "$HD/$o/mail/$D.conf" ]; then echo "EMAILS=$(grep -c "^ACCOUNT=" "$HD/$o/mail/$D.conf")"; else echo EMAILS=0; fi
cfg="/home/$o/web/$D/public_html/wp-config.php"
if [ -f "$cfg" ]; then echo WP=1; echo "BASEWP=$(grep -oP "define\\(\\s*['\\"]DB_NAME['\\"]\\s*,\\s*['\\"]\\K[^'\\"]+" "$cfg" | head -1)"; fi
echo "TODAS=$(grep -o "^DB='[^']*'" "$HD/$o/db.conf" 2>/dev/null | cut -d"'" -f2 | tr '\\n' ' ')"
echo "CRON=$(grep -c "/web/$D/" "$HD/$o/cron.conf" 2>/dev/null || true)"`;
  const out = await executeServerCommand(`bash -s <<'VHOST_FIM'\n${script}\nVHOST_FIM`, { timeoutMs: 60_000 });
  const v = linhas(out);
  const dono = (v.DONO || '').trim();
  const todasBases = (v.TODAS || '').split(/\s+/).filter((b) => BASE_OK.test(b));
  const baseWp = todasBases.includes(v.BASEWP || '') ? v.BASEWP : '';
  const comNome = raiz.length >= 4 ? todasBases.filter((b) => b.startsWith(dono + '_') && b.slice(dono.length + 1).includes(raiz)) : [];
  return {
    dominio: d,
    dono,
    site: v.SITE === '1',
    ssl: v.SSL === '1',
    dns: v.DNS === '1',
    emails: Number(v.EMAILS) || 0,
    wordpress: v.WP === '1',
    baseWp,
    bases: [...new Set([baseWp, ...comNome].filter(Boolean))],
    todasBases,
    ftp: (v.FTP || '').split(/\s+/).filter(Boolean),
    cron: Number(v.CRON) || 0,
  };
}

export type Passagem = { ok: boolean; passos: string[]; erro?: string; avisos: string[]; bases: { de: string; para: string }[]; copia?: string };

/** Passa o domínio para a conta `para`, com as bases escolhidas. `quem` só entra no registo. */
export async function passarDominio(dominio: string, para: string, bases: string[], quem: string): Promise<Passagem> {
  const d = dominio.trim().toLowerCase();
  const p = para.trim().toLowerCase();
  const falha = (erro: string): Passagem => ({ ok: false, erro, passos: [], avisos: [], bases: [] });
  if (!DOMINIO_OK.test(d)) return falha('Domínio inválido.');
  if (!CONTA_OK.test(p) || CONTAS_DO_SISTEMA.has(p)) return falha('Conta de destino inválida.');
  const prev = await preverPassagem(d);
  if ('erro' in prev) return falha(prev.erro);
  const de = prev.dono;
  if (!de) return falha('Este domínio não existe no servidor.');
  if (de === p) return falha('O domínio já está nessa conta.');
  if (CONTAS_DO_SISTEMA.has(de)) return falha('Conta de origem inválida.');
  const escolhidas = [...new Set(bases)].filter((b) => prev.todasBases.includes(b) && b.startsWith(de + '_'));
  const quemLimpo = quem.replace(/[^A-Za-z0-9@._-]/g, '').slice(0, 80) || 'painel';

  const script = `set -u
H=/usr/local/hestia/bin; HD=/usr/local/hestia/data/users
D='${d}'; DE='${de}'; PARA='${p}'; BASES='${escolhidas.join(' ')}'; QUEM='${quemLimpo}'
$H/v-list-user "$PARA" >/dev/null 2>&1 || { echo "FALHA=A conta $PARA não existe."; exit 1; }
# antes de mexer: nenhuma base pode já existir com o nome novo na conta de destino
for b in $BASES; do r="\${b#\${DE}_}"; if grep -q "^DB='\${PARA}_$r'" "$HD/$PARA/db.conf" 2>/dev/null; then echo "FALHA=Já existe a base \${PARA}_$r na conta $PARA; nada foi mudado."; exit 1; fi; done
B="/root/vh-passagens/$(date +%Y%m%d-%H%M%S)-$D"; install -d -m 700 /root/vh-passagens "$B"; echo "COPIA=$B"
w=$(grep "DOMAIN='$D'" "$HD/$DE/web.conf" 2>/dev/null)
ip=$(echo "$w" | grep -o "IP='[^']*'" | cut -d"'" -f2); ssl=0; echo "$w" | grep -q "SSL='yes'" && ssl=1
url() { [ -z "$w" ] && { echo 000; return; }; if [ $ssl = 1 ]; then curl -sk -o /dev/null -w '%{http_code}' --max-time 20 --resolve "$D:443:$ip" "https://$D/"; else curl -s -o /dev/null -w '%{http_code}' --max-time 20 --resolve "$D:80:$ip" "http://$D/"; fi; }
emails() { f="$HD/$1/mail/$D.conf"; if [ -f "$f" ]; then grep -c "^ACCOUNT=" "$f" || true; else echo 0; fi; }
ANTES=$(url); MA=$(emails "$DE"); echo "ANTES=$ANTES"
cfg_de="/home/$DE/web/$D/public_html/wp-config.php"
[ -f "$cfg_de" ] && cp -p "$cfg_de" "$B/wp-config.php"
cp -p "/home/$DE/conf/web/$D/"nginx*.conf_webmail "$B/" 2>/dev/null
echo "$DE" > "$B/de"; echo "$BASES" > "$B/bases"
movido=0; movidas=""
webmail() { dir="/home/$1/conf/web/$D"; [ -d "$dir" ] || return 0
  echo '${b64(WEBMAIL_NGINX)}' | base64 -d > "$dir/nginx.conf_webmail"; cp "$dir/nginx.conf_webmail" "$dir/nginx.ssl.conf_webmail"
  if nginx -t >/dev/null 2>&1; then systemctl reload nginx; return 0; fi
  rm -f "$dir/nginx.conf_webmail" "$dir/nginx.ssl.conf_webmail"; nginx -t >/dev/null 2>&1 && systemctl reload nginx; return 1; }
desfazer() {
  echo "DESFAZER=sim"
  for r in $movidas; do $H/v-change-database-owner "\${PARA}_$r" "$DE" >/dev/null 2>&1 || echo "AVISO=A base \${PARA}_$r não voltou para $DE."; done
  if [ $movido = 1 ]; then
    $H/v-change-domain-owner "$D" "$DE" >/dev/null 2>&1 || echo "AVISO=O domínio não voltou para $DE."
    [ -f "$B/wp-config.php" ] && [ -f "$cfg_de" ] && cat "$B/wp-config.php" | runuser -u "$DE" -- sh -c 'cat > "$1"' sh "$cfg_de"
    webmail "$DE" || true
  fi
}
out=$($H/v-change-domain-owner "$D" "$PARA" 2>&1)
if [ "$($H/v-search-domain-owner "$D" 2>/dev/null | head -1)" != "$PARA" ]; then echo "FALHA=O servidor não passou o domínio: $(echo "$out" | tail -1)"; exit 1; fi
movido=1; echo "PASSO=Site, e-mails, certificado, DNS e FTP passaram para $PARA"
for b in $BASES; do
  r="\${b#\${DE}_}"
  out=$($H/v-change-database-owner "$b" "$PARA" 2>&1); rc=$?
  # só passou se o comando correu bem, a base nova está no destino e a antiga já não está na origem
  if [ $rc = 0 ] && grep -q "^DB='\${PARA}_$r'" "$HD/$PARA/db.conf" 2>/dev/null && ! grep -q "^DB='$b'" "$HD/$DE/db.conf" 2>/dev/null; then movidas="$movidas $r"; echo "BASE=$b>\${PARA}_$r"; echo "PASSO=Base de dados $b passou a \${PARA}_$r"
  else echo "FALHA=A base $b não passou: $(echo "$out" | tail -1)"; desfazer; exit 1; fi
done
cfg="/home/$PARA/web/$D/public_html/wp-config.php"
if [ -f "$cfg" ] && [ -n "$movidas" ]; then
  if runuser -u "$PARA" -- sed -i -E "/define\\(\\s*['\\"](DB_NAME|DB_USER)['\\"]/ s/(['\\"])\${DE}_/\\1\${PARA}_/" "$cfg"; then echo "PASSO=WordPress a usar a base nova"
  else echo "FALHA=Não foi possível ajustar o WordPress."; desfazer; exit 1; fi
fi
if webmail "$PARA"; then echo "PASSO=Webmail em https://$D/webmail"; else echo "AVISO=A regra do webmail não foi posta (o nginx recusou)."; fi
sleep 2
DEPOIS=$(url); MD=$(emails "$PARA"); echo "DEPOIS=$DEPOIS"
if [ "$ANTES" != 000 ] && [ "\${ANTES:0:1}" != "\${DEPOIS:0:1}" ]; then echo "FALHA=O site respondia $ANTES e passou a responder $DEPOIS."; desfazer; exit 1; fi
if [ "$MA" != "$MD" ]; then echo "FALHA=Havia $MA caixas de e-mail e ficaram $MD."; desfazer; exit 1; fi
echo "PASSO=Verificado: o site responde ($DEPOIS) e as $MD caixas de e-mail estão na conta nova"
echo "$(date -Is) $D $DE -> $PARA bases:[$movidas ] por:$QUEM copia:$B" >> /root/vh-passagens/registo.log
echo "OK=1"`;

  let out = '';
  try {
    out = await executeServerCommand(`bash -s <<'VHOST_FIM'\n${script}\nVHOST_FIM`, { timeoutMs: 20 * 60_000 });
  } catch (e) {
    return falha('O servidor não respondeu a tempo: ' + (e instanceof Error ? e.message : 'erro') + '. Veja o domínio antes de tentar outra vez.');
  }
  const ls = out.split('\n');
  const passos = ls.filter((l) => l.startsWith('PASSO=')).map((l) => l.slice(6));
  const avisos = ls.filter((l) => l.startsWith('AVISO=')).map((l) => l.slice(6));
  const basesFeitas = ls.filter((l) => l.startsWith('BASE=')).map((l) => { const [a, b] = l.slice(5).split('>'); return { de: a, para: b }; });
  const copia = ls.find((l) => l.startsWith('COPIA='))?.slice(6);
  const erro = ls.find((l) => l.startsWith('FALHA='))?.slice(6);
  if (!ls.includes('OK=1')) {
    const desfeito = ls.includes('DESFAZER=sim');
    return { ok: false, erro: (erro || 'A passagem não terminou.') + (desfeito ? ' Tudo voltou para ' + de + '.' : ''), passos, avisos, bases: basesFeitas, copia };
  }

  // tarefas cron do domínio: passam para a conta nova com o caminho trocado
  if (prev.cron > 0) {
    const lista = await hestiaCallJson<Record<string, { MIN: string; HOUR: string; DAY: string; MONTH: string; WDAY: string; CMD: string }>>('v-list-cron-jobs', [de]);
    if (lista.ok) {
      let n = 0;
      for (const [job, c] of Object.entries(lista.data)) {
        if (!c.CMD.includes('/web/' + d + '/')) continue;
        const cmd = c.CMD.split('/home/' + de + '/').join('/home/' + p + '/');
        const add = await hestiaCall('v-add-cron-job', [p, c.MIN, c.HOUR, c.DAY, c.MONTH, c.WDAY, cmd]);
        if (add.ok && (await hestiaCall('v-delete-cron-job', [de, job])).ok) n++;
        else avisos.push('A tarefa cron ' + job + ' ficou na conta ' + de + '.');
      }
      if (n) passos.push(n + ' tarefa(s) cron passaram para ' + p);
    } else avisos.push('As tarefas cron não foram lidas; veja-as na conta ' + de + '.');
  }
  return { ok: true, passos, avisos, bases: basesFeitas, copia };
}

/** Conta do administrador do servidor, onde ficam os "sites da VisualDesign" */
export const contaAdmin = () => (process.env.HESTIA_USER || 'vdadmin').trim();

/**
 * Proteção combinada com o Silva (como em /api/vhost/acoes): sem VHOST_ACOES_TODAS=1 só se passam domínios de
 * teste para contas de teste (o destino pode ser a conta do administrador, para voltar atrás).
 * Devolve o motivo da recusa, ou null se pode.
 */
export function protegidoPassagem(dominio: string, para: string): string | null {
  if (process.env.VHOST_ACOES_TODAS === '1') return null;
  const d = dominio.trim().toLowerCase();
  const p = para.trim().toLowerCase();
  if (d.startsWith('teste') && (p.startsWith('teste') || p === contaAdmin())) return null;
  return 'Por agora só se passam domínios de teste para contas de teste (nomes a começar por "teste").';
}

export type EstadoDominio =
  | { estado: 'novo' }
  | { estado: 'ja-na-conta' }
  | { estado: 'passou'; passagem: Passagem }
  | { estado: 'noutra-conta'; dono: string }
  | { estado: 'falhou'; erro: string; passagem?: Passagem };

/**
 * Antes de pôr um domínio numa conta que acabou de nascer: onde está agora?
 *  - não existe no servidor → 'novo' (quem chama cria o site);
 *  - já está na própria conta → 'ja-na-conta';
 *  - está numa das contas em `origens` (a do administrador, ou a do revendedor que cria) → passa com tudo o que
 *    tem (site, e-mails, bases de dados…) e devolve 'passou';
 *  - está na conta de outro cliente → nunca passa sozinho: 'noutra-conta' (fica para o administrador decidir).
 */
export async function dominioParaConta(conta: string, dominio: string, origens: string[], quem: string): Promise<EstadoDominio> {
  const prev = await preverPassagem(dominio);
  if ('erro' in prev) return { estado: 'falhou', erro: prev.erro };
  if (!prev.dono) return { estado: 'novo' };
  if (prev.dono === conta) return { estado: 'ja-na-conta' };
  if (!origens.includes(prev.dono)) return { estado: 'noutra-conta', dono: prev.dono };
  const prot = protegidoPassagem(dominio, conta);
  if (prot) return { estado: 'falhou', erro: prot };
  const passagem = await passarDominio(dominio, conta, prev.bases, quem);
  return passagem.ok ? { estado: 'passou', passagem } : { estado: 'falhou', erro: passagem.erro || 'A passagem não terminou.', passagem };
}

/** Põe a regra do webmail (/webmail) num domínio da conta (domínios novos); se o nginx a recusar, tira-a */
export async function instalarWebmail(conta: string, dominio: string): Promise<boolean> {
  const c = conta.trim().toLowerCase();
  const d = dominio.trim().toLowerCase();
  if (!CONTA_OK.test(c) || CONTAS_DO_SISTEMA.has(c) || !DOMINIO_OK.test(d)) return false;
  const script = `dir="/home/${c}/conf/web/${d}"; [ -d "$dir" ] || { echo SEM; exit 0; }
echo '${b64(WEBMAIL_NGINX)}' | base64 -d > "$dir/nginx.conf_webmail"; cp "$dir/nginx.conf_webmail" "$dir/nginx.ssl.conf_webmail"
if nginx -t >/dev/null 2>&1; then systemctl reload nginx; echo OK; else rm -f "$dir/nginx.conf_webmail" "$dir/nginx.ssl.conf_webmail"; nginx -t >/dev/null 2>&1 && systemctl reload nginx; echo NAO; fi`;
  const out = await executeServerCommand(`bash -s <<'VHOST_FIM'\n${script}\nVHOST_FIM`, { timeoutMs: 60_000 }).catch(() => '');
  return out.trim().split('\n').pop() === 'OK';
}
