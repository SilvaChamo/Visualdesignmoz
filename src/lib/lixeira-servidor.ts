import { executeServerCommand } from '@/lib/server-ssh-exec';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * Lixeira de sites e contas apagados (Silva, 31/10/2026): nada que se apague no painel desaparece logo — antes de o Hestia
 * apagar, copia-se para /backup/lixeira/<id>/ no servidor (dados.tar.gz ou o .tar do v-backup-user + info.json) para o Silva
 * poder repor (Admin › Lixeira, /api/vhost/lixeira). Sem tabela nova: tudo vive no servidor, como a Quarentena.
 * `painel` guarda as linhas da base de dados do painel (renovação, site, conta) para voltarem juntas ao repor.
 */

export const LIXEIRA_DIR = '/backup/lixeira';

const CONTA_RE = /^[a-z0-9][a-z0-9_-]{0,31}$/;
const DOMINIO_RE = /^[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?$/;

export type PainelSnapshot = Record<string, Record<string, unknown>[]>;

export type InfoLixeira = {
  id: string;
  tipo: 'site' | 'conta';
  conta: string;
  dominio: string;
  data: string;
  origem: string;
  tam: number;
  /** nome do ficheiro .tar do Hestia (só nas contas), para repor com v-restore-user */
  arquivoHestia?: string;
  painel?: PainelSnapshot;
  /** bases de dados apagadas com o site: ficam em <base>.sql.gz na pasta da lixeira (repor à mão) */
  bases?: string[];
};

export function idLixeiraValido(id: unknown): id is string {
  return typeof id === 'string' && /^\d{14}-(site|conta)-[a-z0-9_.-]{1,300}$/.test(id) && !id.includes('..');
}

const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64');

function ultimaLinhaJson(out: string): Record<string, unknown> | null {
  const l = out.split('\n').reverse().find((x) => x.trim().startsWith('{'));
  try {
    return l ? (JSON.parse(l) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Guarda uma cópia do site (ficheiros + configuração do servidor web) antes de o apagar. Se não conseguir guardar, devolve
 * ok:false e o chamador NÃO deve apagar. Se o site não tem ficheiros no servidor, regista só os dados do painel.
 */
export async function arquivarSite(
  conta: string,
  dominio: string,
  origem: string,
  painel?: PainelSnapshot,
  bases: string[] = [],
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const c = conta.trim().toLowerCase();
  const d = dominio.trim().toLowerCase();
  if (!CONTA_RE.test(c) || !DOMINIO_RE.test(d) || bases.some((b) => !/^[a-z0-9_]{1,64}$/.test(b))) return { ok: false, error: 'Conta ou domínio inválido para a lixeira.' };
  const ts = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  const id = `${ts}-site-${c}-${d}`;
  const info = { id, tipo: 'site', conta: c, dominio: d, data: new Date().toISOString(), origem, painel: painel || {}, bases } as Record<string, unknown>;
  const script = `
set -e
D=${LIXEIRA_DIR}/${id}
mkdir -p ${LIXEIRA_DIR} "$D"; chmod 700 ${LIXEIRA_DIR} "$D"
cd /home/${c}
LISTA=""
for p in web/${d} conf/web/${d}; do [ -e "$p" ] && LISTA="$LISTA $p"; done
BASES="${bases.join(' ')}"
if [ -z "$LISTA" ] && [ -z "$BASES" ]; then rm -rf "$D"; echo '{"ok":true,"vazio":true}'; exit 0; fi
for b in $BASES; do
  mariadb-dump --single-transaction --routines "$b" | gzip > "$D/$b.sql.gz" || { rm -rf "$D"; echo '{"ok":false,"erro":"Não foi possível guardar a base de dados '"$b"' na lixeira."}'; exit 0; }
done
if [ -n "$LISTA" ]; then
  NEC=$(du -sk $LISTA 2>/dev/null | awk '{s+=$1} END {print s+0}')
  LIVRE=$(df -Pk ${LIXEIRA_DIR} | awk 'NR==2 {print $4}')
  if [ "$LIVRE" -lt $((NEC * 2 + 1048576)) ]; then rm -rf "$D"; echo '{"ok":false,"erro":"Sem espaço no servidor para guardar na lixeira."}'; exit 0; fi
  tar -czf "$D/dados.tar.gz" $LISTA
  chmod 600 "$D/dados.tar.gz"
fi
TAM=$(stat -c %s "$D/dados.tar.gz" 2>/dev/null || echo 0)
echo ${b64(JSON.stringify(info))} | base64 -d | python3 -c 'import json,sys; i=json.load(sys.stdin); i["tam"]=int(sys.argv[1]); json.dump(i,open(sys.argv[2],"w"))' "$TAM" "$D/info.json"
chmod 600 "$D/info.json"
echo '{"ok":true}'
`;
  try {
    const out = await executeServerCommand(`bash -c "$(echo ${b64(script)} | base64 -d)" 2>&1`, { timeoutMs: 600_000 });
    const r = ultimaLinhaJson(out);
    if (r?.ok === true) return { ok: true, id: r.vazio ? undefined : id };
    return { ok: false, error: String(r?.erro || 'Não foi possível guardar na lixeira: ' + out.slice(-200)) };
  } catch (e) {
    return { ok: false, error: 'Não foi possível guardar na lixeira: ' + (e instanceof Error ? e.message : String(e)) };
  }
}

/** Guarda uma cópia completa da conta (v-backup-user: sites, bases de dados, e-mail) antes de a apagar. */
export async function arquivarConta(
  conta: string,
  origem: string,
  painel?: PainelSnapshot,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const c = conta.trim().toLowerCase();
  if (!CONTA_RE.test(c)) return { ok: false, error: 'Conta inválida para a lixeira.' };
  const ts = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  const id = `${ts}-conta-${c}`;
  const info = { id, tipo: 'conta', conta: c, dominio: '', data: new Date().toISOString(), origem, painel: painel || {} } as Record<string, unknown>;
  const script = `
set -e
export PATH=$PATH:/usr/local/hestia/bin
D=${LIXEIRA_DIR}/${id}
v-list-user ${c} >/dev/null 2>&1 || { echo '{"ok":true,"vazio":true}'; exit 0; }
mkdir -p ${LIXEIRA_DIR} "$D"; chmod 700 ${LIXEIRA_DIR} "$D"
NEC=$(du -sk /home/${c} 2>/dev/null | awk '{print $1+0}')
LIVRE=$(df -Pk ${LIXEIRA_DIR} | awk 'NR==2 {print $4}')
if [ "$LIVRE" -lt $((NEC * 2 + 1048576)) ]; then rm -rf "$D"; echo '{"ok":false,"erro":"Sem espaço no servidor para guardar na lixeira."}'; exit 0; fi
ANTES=$(ls -1 /backup/${c}.*.tar 2>/dev/null | sort || true)
v-backup-user ${c} >/dev/null 2>&1 || true
NOVO=$(ls -1t /backup/${c}.*.tar 2>/dev/null | head -n1)
if [ -z "$NOVO" ] || echo "$ANTES" | grep -qxF "$NOVO"; then rm -rf "$D"; echo '{"ok":false,"erro":"O servidor não conseguiu criar a cópia da conta."}'; exit 0; fi
NOME=$(basename "$NOVO")
mv "$NOVO" "$D/$NOME"; chmod 600 "$D/$NOME"
TAM=$(stat -c %s "$D/$NOME")
echo ${b64(JSON.stringify(info))} | base64 -d | python3 -c 'import json,sys; i=json.load(sys.stdin); i["tam"]=int(sys.argv[1]); i["arquivoHestia"]=sys.argv[2]; json.dump(i,open(sys.argv[3],"w"))' "$TAM" "$NOME" "$D/info.json"
chmod 600 "$D/info.json"
echo '{"ok":true}'
`;
  try {
    const out = await executeServerCommand(`bash -c "$(echo ${b64(script)} | base64 -d)" 2>&1`, { timeoutMs: 900_000 });
    const r = ultimaLinhaJson(out);
    if (r?.ok === true) return { ok: true, id: r.vazio ? undefined : id };
    return { ok: false, error: String(r?.erro || 'Não foi possível guardar a conta na lixeira: ' + out.slice(-200)) };
  } catch (e) {
    return { ok: false, error: 'Não foi possível guardar a conta na lixeira: ' + (e instanceof Error ? e.message : String(e)) };
  }
}

/**
 * As linhas do painel que vão juntas com o site/conta (renovação de hospedagem, site e conta espelhados), para voltarem ao repor.
 * Best-effort: se a base de dados não responder, arquiva-se na mesma só o que está no servidor.
 */
export async function snapshotPainel(opts: { dominio?: string; conta?: string }): Promise<PainelSnapshot> {
  const out: PainelSnapshot = {};
  const admin = getSupabaseAdmin();
  if (!admin) return out;
  try {
    const dominios = new Set<string>();
    if (opts.dominio) dominios.add(opts.dominio.toLowerCase());
    if (opts.conta) {
      const { data: sites } = await admin.from('panel_sites').select('*').eq('owner', opts.conta);
      if (sites?.length) out.panel_sites = sites;
      for (const s of sites || []) if (s.domain) dominios.add(String(s.domain).toLowerCase());
      const { data: us } = await admin.from('panel_users').select('*').eq('username', opts.conta);
      if (us?.length) out.panel_users = us.map((u) => ({ ...u, da_password_encrypted: null }));
    } else if (opts.dominio) {
      const { data: sites } = await admin.from('panel_sites').select('*').eq('domain', opts.dominio.toLowerCase());
      if (sites?.length) out.panel_sites = sites;
    }
    if (dominios.size) {
      const { data: ren } = await admin.from('hosting_renewals').select('*').in('domain_name', [...dominios]);
      if (ren?.length) out.hosting_renewals = ren;
    }
  } catch {
    /* best-effort */
  }
  return out;
}

/** Volta a gravar no painel as linhas arquivadas (só as que ainda não existem). */
export async function reporPainel(painel: PainelSnapshot | undefined): Promise<string[]> {
  const avisos: string[] = [];
  const admin = getSupabaseAdmin();
  if (!admin || !painel) return avisos;
  for (const tabela of ['panel_users', 'panel_sites', 'hosting_renewals']) {
    const linhas = painel[tabela];
    if (!linhas?.length) continue;
    const { error } = await admin.from(tabela).upsert(linhas, { onConflict: 'id', ignoreDuplicates: true });
    if (error) avisos.push(`Não consegui repor ${tabela} no painel: ${error.message}`);
  }
  return avisos;
}

export async function listarLixeira(): Promise<InfoLixeira[]> {
  const out = await executeServerCommand(
    `for f in ${LIXEIRA_DIR}/*/info.json; do [ -f "$f" ] && python3 -c 'import json,sys; print(json.dumps(json.load(open(sys.argv[1]))))' "$f"; done 2>/dev/null; true`,
    { timeoutMs: 60_000 },
  );
  const itens: InfoLixeira[] = [];
  for (const l of out.split('\n')) {
    if (!l.trim().startsWith('{')) continue;
    try {
      const i = JSON.parse(l) as InfoLixeira;
      if (idLixeiraValido(i.id)) itens.push(i);
    } catch {
      /* linha estranha: ignora */
    }
  }
  return itens.sort((a, b) => (b.data || '').localeCompare(a.data || ''));
}

export async function lerInfoLixeira(id: string): Promise<InfoLixeira | null> {
  if (!idLixeiraValido(id)) return null;
  return (await listarLixeira()).find((i) => i.id === id) ?? null;
}

/** Repõe o site ou a conta no servidor. A reposição das linhas do painel é feita pelo chamador (precisa da base de dados). */
export async function reporNoServidor(info: InfoLixeira): Promise<{ ok: boolean; error?: string }> {
  if (!idLixeiraValido(info.id)) return { ok: false, error: 'Identificador inválido.' };
  const c = info.conta;
  const d = info.dominio;
  if (!CONTA_RE.test(c) || (info.tipo === 'site' && !DOMINIO_RE.test(d))) return { ok: false, error: 'Dados da lixeira inválidos.' };
  let script: string;
  if (info.tipo === 'site') {
    script = `
export PATH=$PATH:/usr/local/hestia/bin
D=${LIXEIRA_DIR}/${info.id}
v-list-user ${c} >/dev/null 2>&1 || { echo '{"ok":false,"erro":"A conta ${c} já não existe no servidor: restaure primeiro a conta."}'; exit 0; }
if ! v-list-web-domain ${c} ${d} plain >/dev/null 2>&1; then
  v-add-web-domain ${c} ${d} >/dev/null 2>&1 || { echo '{"ok":false,"erro":"O servidor não criou o site ${d}."}'; exit 0; }
fi
if [ -f "$D/dados.tar.gz" ]; then
  tar -xzf "$D/dados.tar.gz" -C /home/${c} web/${d} || { echo '{"ok":false,"erro":"Não foi possível repor os ficheiros."}'; exit 0; }
fi
v-rebuild-web-domains ${c} >/dev/null 2>&1 || true
( nohup v-add-letsencrypt-domain ${c} ${d} www.${d} >/dev/null 2>&1 & ) >/dev/null 2>&1
echo '{"ok":true}'
`;
  } else {
    const f = String(info.arquivoHestia || '');
    if (!/^[a-z0-9_-]{1,32}\.[0-9_-]{10,30}\.tar$/.test(f)) return { ok: false, error: 'Ficheiro da conta inválido.' };
    script = `
export PATH=$PATH:/usr/local/hestia/bin
D=${LIXEIRA_DIR}/${info.id}
v-list-user ${c} >/dev/null 2>&1 && { echo '{"ok":false,"erro":"A conta ${c} já existe no servidor."}'; exit 0; }
[ -f "$D/${f}" ] || { echo '{"ok":false,"erro":"A cópia da conta já não existe."}'; exit 0; }
cp -a "$D/${f}" /backup/${f}
v-restore-user ${c} ${f} yes yes yes yes yes yes >/tmp/vd-restore-${c}.log 2>&1; RC=$?
rm -f /backup/${f}
[ $RC -eq 0 ] && echo '{"ok":true}' || echo '{"ok":false,"erro":"O servidor não conseguiu repor a conta (ver /tmp/vd-restore-${c}.log)."}'
`;
  }
  try {
    const out = await executeServerCommand(`bash -c "$(echo ${b64(script)} | base64 -d)" 2>&1`, { timeoutMs: 900_000 });
    const r = ultimaLinhaJson(out);
    if (r?.ok === true) return { ok: true };
    return { ok: false, error: String(r?.erro || 'O servidor não respondeu como esperado: ' + out.slice(-200)) };
  } catch (e) {
    return { ok: false, error: 'Sem ligação ao servidor: ' + (e instanceof Error ? e.message : String(e)) };
  }
}

/** Apaga de vez uma entrada da lixeira. Não se pode desfazer. */
export async function apagarDaLixeira(id: string): Promise<{ ok: boolean; error?: string }> {
  if (!idLixeiraValido(id)) return { ok: false, error: 'Identificador inválido.' };
  try {
    await executeServerCommand(`rm -rf -- ${LIXEIRA_DIR}/${id}`, { timeoutMs: 120_000 });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Depois de repor com sucesso: a cópia sai da lista mas fica guardada em _repostos (por segurança) até se apagar à mão. */
export async function marcarReposto(id: string): Promise<void> {
  if (!idLixeiraValido(id)) return;
  await executeServerCommand(
    `mkdir -p ${LIXEIRA_DIR}/_repostos && chmod 700 ${LIXEIRA_DIR}/_repostos && mv -- ${LIXEIRA_DIR}/${id} ${LIXEIRA_DIR}/_repostos/${id}`,
    { timeoutMs: 120_000 },
  ).catch(() => '');
}
