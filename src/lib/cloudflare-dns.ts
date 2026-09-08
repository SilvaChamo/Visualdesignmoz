// Cliente mínimo da API da Cloudflare para provisionamento automático de DNS
// de e-mail em domínios de clientes. Só usado quando o domínio já tem uma
// zona própria na Cloudflare (a maioria dos domínios novos, desde que se
// passou a usar a Cloudflare como DNS em vez do BIND interno do
// DirectAdmin) — ver domain-email-auth.ts para a lógica de escolha.
//
// Autenticação (14 ago 2026): usa CLOUDFLARE_EMAIL + CLOUDFLARE_GLOBAL_API_KEY
// (Global API Key, acesso total à conta) quando presentes — confirmado ao
// vivo que consegue criar zonas novas. CLOUDFLARE_API_TOKEN_ACCOUNT (token
// restrito a Zone/DNS) fica como alternativa se algum dia se conseguir dar-lhe
// também a permissão "Account > Zone > Edit" (não encontrada na interface da
// Cloudflare nessa data) — nesse caso volta a bastar só o token, sem a
// Global Key. Precisa também de CLOUDFLARE_ACCOUNT_ID (para criar zonas novas).

const CF_API_BASE = 'https://api.cloudflare.com/client/v4';

function getCloudflareAuthHeaders(): Record<string, string> | undefined {
  const email = process.env.CLOUDFLARE_EMAIL?.trim();
  const globalKey = process.env.CLOUDFLARE_GLOBAL_API_KEY?.trim();
  if (email && globalKey) {
    return { 'X-Auth-Email': email, 'X-Auth-Key': globalKey, 'Content-Type': 'application/json' };
  }
  const token = process.env.CLOUDFLARE_API_TOKEN_ACCOUNT?.trim();
  if (token) {
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  }
  return undefined;
}

export type CloudflareRecordInput = {
  type: 'A' | 'AAAA' | 'CNAME' | 'TXT' | 'MX';
  name: string; // '@' (raiz) ou relativo ao domínio, ex: 'mail', '_dmarc'
  content: string;
  ttl?: number;
  priority?: number; // usado só em MX
  proxied?: boolean;
};

export type CloudflareApplyResult = {
  ok: boolean;
  name: string;
  type: string;
  action: 'created' | 'updated' | 'skipped' | 'error';
  error?: string;
};

/** Devolve o zone id da Cloudflare para um domínio, ou null se a conta não
 *  tiver nenhuma zona com esse nome (nesse caso o domínio não usa a
 *  Cloudflare como DNS, e quem chamar isto deve cair no DNS interno do
 *  DirectAdmin em alternativa). */
export async function findCloudflareZoneId(domain: string): Promise<string | null> {
  const headers = getCloudflareAuthHeaders();
  if (!headers) return null;
  const clean = domain.trim().toLowerCase().replace(/\.$/, '');

  try {
    const res = await fetch(`${CF_API_BASE}/zones?name=${encodeURIComponent(clean)}`, {
      headers,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { success: boolean; result?: Array<{ id: string }> };
    if (!data.success || !data.result?.length) return null;
    return data.result[0].id;
  } catch {
    return null;
  }
}

/**
 * Cria uma zona nova na Cloudflare para um domínio recém-registado (ex: logo
 * a seguir a uma compra através do painel). Devolve os nameservers que a
 * Cloudflare atribuiu — têm de ser postos no registador (ver
 * dynadot-adapter.ts -> setNameservers) para a zona passar a ser a
 * autoritativa de verdade. Idempotente: se a zona já existir, devolve-a em
 * vez de tentar criar outra vez.
 */
export async function createCloudflareZone(
  domain: string,
): Promise<
  | { ok: true; zoneId: string; nameServers: string[]; alreadyExisted: boolean }
  | { ok: false; error: string }
> {
  const headers = getCloudflareAuthHeaders();
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  if (!headers) return { ok: false, error: 'CLOUDFLARE_EMAIL/CLOUDFLARE_GLOBAL_API_KEY (ou CLOUDFLARE_API_TOKEN_ACCOUNT) não configurados' };
  if (!accountId) return { ok: false, error: 'CLOUDFLARE_ACCOUNT_ID não configurado' };

  const clean = domain.trim().toLowerCase().replace(/\.$/, '');

  const existingId = await findCloudflareZoneId(clean);
  if (existingId) {
    try {
      const res = await fetch(`${CF_API_BASE}/zones/${existingId}`, { headers });
      const data = (await res.json()) as { success: boolean; result?: { name_servers?: string[] } };
      if (data.success && data.result?.name_servers?.length) {
        return { ok: true, zoneId: existingId, nameServers: data.result.name_servers, alreadyExisted: true };
      }
    } catch {
      /* segue para tentar criar - o findCloudflareZoneId já confirmou que existe */
    }
    return { ok: true, zoneId: existingId, nameServers: [], alreadyExisted: true };
  }

  try {
    const res = await fetch(`${CF_API_BASE}/zones`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: clean, account: { id: accountId }, type: 'full' }),
    });
    const data = (await res.json()) as {
      success: boolean;
      result?: { id: string; name_servers?: string[] };
      errors?: Array<{ message: string }>;
    };
    if (!data.success || !data.result) {
      return { ok: false, error: data.errors?.map((e) => e.message).join('; ') || `HTTP ${res.status}` };
    }
    return {
      ok: true,
      zoneId: data.result.id,
      nameServers: data.result.name_servers || [],
      alreadyExisted: false,
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
  }
}

function normalizeRecordName(name: string, domain: string): string {
  const n = (name || '').trim();
  if (!n || n === '@' || n === domain) return domain;
  if (n === `${domain}.`) return domain;
  if (n.endsWith(`.${domain}`)) return n;
  return `${n}.${domain}`;
}

function stripTrailingDot(value: string): string {
  return value.endsWith('.') ? value.slice(0, -1) : value;
}

async function findExistingRecords(
  headers: Record<string, string>,
  zoneId: string,
  type: string,
  name: string,
): Promise<Array<{ id: string; content: string }>> {
  const params = new URLSearchParams({ type, name });
  const res = await fetch(`${CF_API_BASE}/zones/${zoneId}/dns_records?${params.toString()}`, {
    headers,
  });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    success: boolean;
    result?: Array<{ id: string; content: string }>;
  };
  if (!data.success) return [];
  return data.result || [];
}

/**
 * Cria (ou actualiza) um registo DNS na zona Cloudflare indicada.
 * Idempotente: A/AAAA/CNAME com o mesmo nome são substituídos (PUT) se já
 * existir um igual; MX/TXT podem legitimamente coexistir com outros valores
 * (ex: DKIM + brevo-code, os dois em TXT), por isso só marca "skipped" se já
 * existir exactamente o mesmo conteúdo — caso contrário cria mais um.
 */
export async function upsertCloudflareRecord(
  zoneId: string,
  domain: string,
  record: CloudflareRecordInput,
): Promise<CloudflareApplyResult> {
  const headers = getCloudflareAuthHeaders();
  if (!headers) {
    return {
      ok: false,
      name: record.name,
      type: record.type,
      action: 'error',
      error: 'CLOUDFLARE_EMAIL/CLOUDFLARE_GLOBAL_API_KEY (ou CLOUDFLARE_API_TOKEN_ACCOUNT) não configurados',
    };
  }

  const name = normalizeRecordName(record.name, domain);
  const content = record.type === 'MX' || record.type === 'CNAME'
    ? stripTrailingDot(record.content)
    : record.content;

  try {
    const existing = await findExistingRecords(headers, zoneId, record.type, name);
    const sameContent = existing.find((r) => r.content === content);
    if (sameContent) {
      return { ok: true, name, type: record.type, action: 'skipped' };
    }

    // Para A/AAAA/CNAME (registos "singulares" na prática deste uso) troca
    // o existente em vez de duplicar; MX/TXT podem coexistir, cria novo.
    const singular = record.type === 'A' || record.type === 'AAAA' || record.type === 'CNAME';
    const toReplace = singular ? existing[0] : undefined;

    const body: Record<string, unknown> = {
      type: record.type,
      name,
      content,
      ttl: record.ttl || 3600,
      proxied: record.proxied ?? false,
    };
    if (record.type === 'MX' && record.priority != null) {
      body.priority = record.priority;
    }
    if (record.type === 'MX' || record.type === 'TXT') {
      delete body.proxied; // MX/TXT não suportam proxy
    }

    const method = toReplace ? 'PUT' : 'POST';
    const url = toReplace
      ? `${CF_API_BASE}/zones/${zoneId}/dns_records/${toReplace.id}`
      : `${CF_API_BASE}/zones/${zoneId}/dns_records`;

    const res = await fetch(url, { method, headers, body: JSON.stringify(body) });
    const data = (await res.json()) as { success: boolean; errors?: Array<{ message: string }> };
    if (!data.success) {
      return {
        ok: false,
        name,
        type: record.type,
        action: 'error',
        error: data.errors?.map((e) => e.message).join('; ') || `HTTP ${res.status}`,
      };
    }
    return { ok: true, name, type: record.type, action: toReplace ? 'updated' : 'created' };
  } catch (error) {
    return {
      ok: false,
      name,
      type: record.type,
      action: 'error',
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}

/** Aplica uma lista de registos de uma vez, devolvendo o relatório de cada um. */
export async function applyCloudflareRecords(
  domain: string,
  zoneId: string,
  records: CloudflareRecordInput[],
): Promise<CloudflareApplyResult[]> {
  const results: CloudflareApplyResult[] = [];
  for (const record of records) {
    results.push(await upsertCloudflareRecord(zoneId, domain, record));
  }
  return results;
}

/**
 * Remove os registos de e-mail (MX, A de mail/ftp/pop/smtp, DMARC) criados
 * pela automação para um domínio — chamado quando o domínio é removido do
 * painel. Não toca em registos que não sejam de e-mail (ex: A da raiz para
 * Shopify/Vercel/etc, registos do Brevo DKIM ficam porque não fazem mal
 * ficarem lá mesmo sem domínio activo).
 */
export async function deleteCloudflareEmailRecords(
  domain: string,
  zoneId: string,
): Promise<{ ok: boolean; deleted: number; error?: string }> {
  const headers = getCloudflareAuthHeaders();
  if (!headers) return { ok: false, deleted: 0, error: 'CLOUDFLARE_EMAIL/CLOUDFLARE_GLOBAL_API_KEY (ou CLOUDFLARE_API_TOKEN_ACCOUNT) não configurados' };

  const clean = domain.trim().toLowerCase().replace(/\.$/, '');
  const emailSubdomains = new Set([`mail.${clean}`, `ftp.${clean}`, `pop.${clean}`, `smtp.${clean}`]);

  try {
    const res = await fetch(`${CF_API_BASE}/zones/${zoneId}/dns_records?per_page=100`, {
      headers,
    });
    if (!res.ok) return { ok: false, deleted: 0, error: `HTTP ${res.status}` };
    const data = (await res.json()) as {
      success: boolean;
      result?: Array<{ id: string; name: string; type: string }>;
    };
    if (!data.success) return { ok: false, deleted: 0, error: 'Falha ao listar registos' };

    let deleted = 0;
    for (const rec of data.result || []) {
      const isEmailRecord =
        (rec.type === 'MX' && rec.name === clean) ||
        (rec.type === 'A' && emailSubdomains.has(rec.name)) ||
        (rec.type === 'TXT' && rec.name === `_dmarc.${clean}`);
      if (!isEmailRecord) continue;
      const del = await fetch(`${CF_API_BASE}/zones/${zoneId}/dns_records/${rec.id}`, {
        method: 'DELETE',
        headers,
      });
      if (del.ok) deleted += 1;
    }
    return { ok: true, deleted };
  } catch (error) {
    return { ok: false, deleted: 0, error: error instanceof Error ? error.message : 'Erro desconhecido' };
  }
}
