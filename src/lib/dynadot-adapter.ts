/**
 * Adaptador API Dynadot (RESTful v1).
 * Documentação: https://www.dynadot.com/domain/api-document
 *
 * Autenticação: Authorization: Bearer <apiKey> + X-Signature (HMAC-SHA256,
 * hex) de `${apiKey}\n${path}\n${xRequestId}\n${body}`, assinado com a
 * secret key. Todas as respostas vêm com HTTP 200 — o sucesso/erro real está
 * em `body.code` (200 = sucesso), nunca no status HTTP.
 */

import crypto from 'crypto';
import { profileName } from '@/lib/profile-db';

const DYNADOT_ENV = process.env.DYNADOT_ENV === 'production' ? 'production' : 'sandbox';
const BASE_URL =
  DYNADOT_ENV === 'production' ? 'https://api.dynadot.com' : 'https://api-sandbox.dynadot.com';

/**
 * Mapeia o perfil do painel (profiles) para o formato de contacto WHOIS que
 * a Dynadot exige para registar um domínio. Partilhado entre o registo
 * manual (admin, /api/domain-register) e o registo automático depois de uma
 * compra no carrinho (checkout-fulfillment.ts).
 */
export function mapProfileToDynadotContact(
  profile: Record<string, unknown> | null | undefined,
  userEmail: string,
) {
  const name = profileName(profile as { name?: string; nome?: string } | null, 'Utilizador').trim();

  let rawPhone = String(profile?.telefone || '').replace(/[\s\-()]/g, '');
  if (!rawPhone) rawPhone = '840000000';
  if (rawPhone.startsWith('+')) rawPhone = rawPhone.substring(1);

  const ccMap = ['258', '351', '55', '244', '238', '245', '239', '670'];
  let phoneCc = '258';
  let phoneNumber = rawPhone;
  const matchedCc = ccMap.find((cc) => rawPhone.startsWith(cc) && rawPhone.length > cc.length);
  if (matchedCc) {
    phoneCc = matchedCc;
    phoneNumber = rawPhone.substring(matchedCc.length);
  }

  const countryMap: Record<string, string> = {
    'moçambique': 'MZ',
    'mozambique': 'MZ',
    'portugal': 'PT',
    'brasil': 'BR',
    'brazil': 'BR',
    'angola': 'AO',
    'cabo verde': 'CV',
    'guiné-bissau': 'GW',
    'são tomé e príncipe': 'ST',
    'timor-leste': 'TL',
  };
  const cleanCountry = String(profile?.pais || 'Moçambique').toLowerCase().trim();
  const country = countryMap[cleanCountry] || 'MZ';
  const city = String(profile?.cidade || 'Maputo');

  return {
    name,
    email: userEmail || 'admin@your-domain.com',
    phone_cc: phoneCc,
    phone_number: phoneNumber,
    address1: String(profile?.morada || 'Av. Marginal 123'),
    city,
    state: city,
    zip: '1100',
    country,
    organization: profile?.empresa ? String(profile.empresa) : undefined,
  };
}

function getKeys() {
  if (DYNADOT_ENV === 'production') {
    const apiKey = process.env.DYNADOT_API_KEY;
    const secretKey = process.env.DYNADOT_SECRET_KEY;
    if (!apiKey || !secretKey) return null;
    return { apiKey, secretKey };
  }
  const apiKey = process.env.DYNADOT_SANDBOX_API_KEY;
  const secretKey = process.env.DYNADOT_SANDBOX_SECRET_KEY;
  if (!apiKey || !secretKey) return null;
  return { apiKey, secretKey };
}

function signRequest(apiKey: string, secretKey: string, path: string, requestId: string, body: string) {
  const stringToSign = `${apiKey}\n${path}\n${requestId}\n${body}`;
  return crypto.createHmac('sha256', secretKey).update(stringToSign).digest('hex');
}

type DynadotEnvelope<T> = {
  code: number;
  message?: string;
  data?: T;
  error?: { description?: string };
};

async function dynadotFetch<T = unknown>(
  method: string,
  path: string,
  body?: Record<string, unknown>,
  successCodes: number[] = [200],
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const keys = getKeys();
  if (!keys) return { ok: false, error: 'Chaves de API do registador não configuradas' };

  const bodyStr = body !== undefined ? JSON.stringify(body) : '';
  const requestId = crypto.randomUUID();
  const signature = signRequest(keys.apiKey, keys.secretKey, path, requestId, bodyStr);

  const headers: Record<string, string> = {
    Accept: 'application/json',
    Authorization: `Bearer ${keys.apiKey}`,
    'X-Request-ID': requestId,
    'X-Signature': signature,
  };
  if (bodyStr) headers['Content-Type'] = 'application/json';

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: bodyStr || undefined,
    });
    const json = (await res.json().catch(() => ({}))) as DynadotEnvelope<T>;

    if (!successCodes.includes(json.code)) {
      return { ok: false, error: json.error?.description || json.message || `Erro do registador (código ${json.code})` };
    }
    return { ok: true, data: (json.data as T) ?? ({} as T) };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erro ao contactar o serviço de registo' };
  }
}

/**
 * A "API3" da Dynadot (legado, key+command por query string, sem assinatura
 * HMAC) — a RESTful v1 usada no resto deste ficheiro não tem endpoint de
 * preços; `tld_price` só existe na API3. Nunca usada para mutações, só
 * consulta de preço, por isso o formato mais simples/antigo aqui não é
 * problema de segurança.
 */
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * API3 legada, resposta no formato `{ <Comando>Response: { ResponseCode, Status,
 * Error?, ... } }`.
 *
 * Só existe porque a **RESTful v1** recusa TODAS as operações de domínio único
 * para `.app`/`.dev` (Google Registry) com "Unsupported domain type" — mas a
 * API3 legada trata-as bem (confirmado ao vivo: `domain_info` de um `.app`
 * responde `success`). Usado como recurso quando a RESTful falha.
 */
async function dynadotApi3Command(
  command: string,
  params: Record<string, string> = {},
): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; error: string }> {
  const keys = getKeys();
  if (!keys) return { ok: false, error: 'Chaves de API do registador não configuradas' };
  const qs = new URLSearchParams({ key: keys.apiKey, command, ...params });
  try {
    const res = await fetch(`https://api.dynadot.com/api3.json?${qs.toString()}`);
    const json = (await res.json().catch(() => ({}))) as Record<string, { ResponseCode?: number | string; Status?: string; Error?: string; [k: string]: unknown }>;
    const key = Object.keys(json).find((k) => /Response$/.test(k));
    const resp = key ? json[key] : undefined;
    if (!resp) return { ok: false, error: 'Resposta inesperada da API3 da Dynadot' };
    if (String(resp.ResponseCode) !== '0' && String(resp.Status).toLowerCase() !== 'success') {
      return { ok: false, error: resp.Error || `Erro da API3 (código ${resp.ResponseCode})` };
    }
    return { ok: true, data: resp };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erro ao contactar a API3 da Dynadot' };
  }
}

/** A RESTful v1 devolve isto para `.app`/`.dev` em qualquer operação de domínio único. */
function isUnsupportedDomainType(error: string): boolean {
  return /unsupported domain type/i.test(error);
}

/**
 * Procura, em qualquer profundidade de uma resposta JSON da API3, um
 * indicador explícito de erro (`Error`, `ResponseCode` != 0, `Status` de
 * falha) — usado por `getAllTldPrices`, que não pode assumir nenhuma forma
 * de envelope específica (nunca confirmada ao vivo para o comando
 * `tld_price`). Devolve `undefined` se não encontrar nada parecido com erro.
 */
function findFirstErrorMessage(node: unknown, depth = 0): string | undefined {
  if (depth > 4 || node === null || typeof node !== 'object' || Array.isArray(node)) return undefined;
  const obj = node as Record<string, unknown>;
  const errField = obj.Error ?? obj.error;
  if (typeof errField === 'string' && errField.trim()) return errField.trim();
  const status = obj.Status ?? obj.status;
  if (typeof status === 'string' && /error|fail/i.test(status)) {
    return typeof errField === 'string' ? errField : `Erro da API3 (status ${status})`;
  }
  const code = obj.ResponseCode ?? obj.response_code;
  if (code !== undefined && String(code) !== '0') {
    return typeof errField === 'string' ? errField : `Erro da API3 (código ${code})`;
  }
  for (const value of Object.values(obj)) {
    const found = findFirstErrorMessage(value, depth + 1);
    if (found) return found;
  }
  return undefined;
}

/**
 * Pesquisa de disponibilidade — não exige X-Signature.
 *
 * A pesquisa de domínio na página inicial faz até 7 pedidos a esta API em
 * paralelo (um por TLD popular) — sob esse pico de concorrência a Dynadot
 * por vezes falha ou limita 1-2 pedidos, que nada têm a ver com o domínio em
 * si (ver "Erro de verificação" reportado como falso "indisponível" na UI).
 * Duas tentativas extra com pausa curta absorvem isso sem o utilizador notar.
 */
export async function checkAvailability(domain: string) {
  const clean = domain.toLowerCase().trim();
  let lastError = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await sleep(attempt * 500);
    const result = await dynadotFetch<{ domain_name: string; available: 'Yes' | 'No' }>(
      'GET',
      `/restful/v1/domains/${encodeURIComponent(clean)}/search`,
    );
    if (result.ok) {
      return {
        available: result.data.available === 'Yes',
        currency: 'USD',
      };
    }
    lastError = result.error;
  }
  return { available: false, error: lastError };
}

type DynadotDomainInfo = {
  domainName: string;
  expiration: number;
  registration: number;
  glueInfo?: { name_server_settings?: { name_servers?: { server_name: string }[] } };
  locked?: 'Yes' | 'No';
  renew_option?: string;
  status?: string;
  privacy?: string;
};

export type DynadotDomainRow = {
  domain: string;
  status?: string;
  expireDate?: string;
  tld?: string;
};

function mapDynadotDomain(item: DynadotDomainInfo): DynadotDomainRow {
  const domain = item.domainName.toLowerCase();
  const parts = domain.split('.');
  const tld = parts.length > 1 ? parts.slice(1).join('.') : undefined;
  return {
    domain,
    status: item.status,
    expireDate: item.expiration ? new Date(item.expiration).toISOString().slice(0, 10) : undefined,
    tld,
  };
}

export const dynadotAPI = {
  async listAllDomains(): Promise<{ success: true; domains: DynadotDomainRow[] } | { success: false; error: string }> {
    const result = await dynadotFetch<{ domainInfo: DynadotDomainInfo[] }>('GET', '/restful/v1/domains');
    if (!result.ok) return { success: false, error: result.error };
    return { success: true, domains: (result.data.domainInfo || []).map(mapDynadotDomain) };
  },

  async getDomainDetails(domain: string): Promise<
    | {
        success: true;
        isLocked?: boolean;
        autoRenew?: boolean;
        expireDate?: string;
        registrationDate?: string;
        status?: string;
        nameservers?: string[];
        privacyEnabled?: boolean;
      }
    | { success: false; error: string }
  > {
    const clean = domain.toLowerCase().trim();
    const result = await dynadotFetch<{ domainInfo: DynadotDomainInfo[] }>(
      'GET',
      `/restful/v1/domains/${encodeURIComponent(clean)}`,
    );
    if (result.ok) {
      const info = result.data.domainInfo?.[0];
      if (!info) return { success: false, error: 'Domínio não encontrado' };
      return {
        success: true,
        isLocked: info.locked === 'Yes',
        autoRenew: info.renew_option === 'auto-renew',
        expireDate: info.expiration ? new Date(info.expiration).toISOString().slice(0, 10) : undefined,
        registrationDate: info.registration ? new Date(info.registration).toISOString().slice(0, 10) : undefined,
        status: info.status,
        nameservers: (info.glueInfo?.name_server_settings?.name_servers || [])
          .map((n) => n.server_name)
          .filter(Boolean),
        privacyEnabled: /privacy/i.test(info.privacy || ''),
      };
    }

    // .app/.dev (ou qualquer domínio que a RESTful recuse) — a API3 legada
    // trata destes. Sem isto o painel dizia "não está na conta Dynadot" para
    // um domínio que está mesmo lá.
    const legacy = await dynadotApi3Command('domain_info', { domain: clean });
    if (!legacy.ok) return { success: false, error: result.error };
    const di = (legacy.data.DomainInfo || {}) as Record<string, unknown>;
    const nsSettings = (di.NameServerSettings || {}) as {
      Type?: string;
      NameServers?: Array<{ ServerName?: string }>;
    };
    return {
      success: true,
      isLocked: String(di.Locked || '').toLowerCase() === 'yes',
      autoRenew: /auto/i.test(String(di.RenewOption || '')),
      expireDate: di.Expiration ? new Date(Number(di.Expiration)).toISOString().slice(0, 10) : undefined,
      registrationDate: di.Registration ? new Date(Number(di.Registration)).toISOString().slice(0, 10) : undefined,
      status: (di.Status as string) || undefined,
      nameservers: (nsSettings.NameServers || []).map((n) => n.ServerName || '').filter(Boolean),
      privacyEnabled: /(^|[^n])privacy/i.test(String(di.Privacy || '')) && String(di.Privacy).toLowerCase() !== 'none',
    };
  },

  /** Estado do DNSSEC — lista vazia significa que não está configurado. */
  async getDnssecStatus(
    domain: string,
  ): Promise<{ success: true; enabled: boolean; recordCount: number } | { success: false; error: string }> {
    const clean = domain.toLowerCase().trim();
    const result = await dynadotFetch<{ dnssec_info_list?: unknown[] }>(
      'GET',
      `/restful/v1/domains/${encodeURIComponent(clean)}/dnssec`,
    );
    if (!result.ok) return { success: false, error: result.error };
    const count = result.data.dnssec_info_list?.length || 0;
    return { success: true, enabled: count > 0, recordCount: count };
  },

  async getTransferAuthCode(domain: string): Promise<
    { success: true; authCode: string } | { success: false; error: string }
  > {
    const clean = domain.toLowerCase().trim();
    const result = await dynadotFetch<{ auth_code: string }>(
      'GET',
      `/restful/v1/domains/${encodeURIComponent(clean)}/transfer_auth_code`,
    );
    if (!result.ok) return { success: false, error: result.error };
    if (!result.data.auth_code) return { success: false, error: 'Código de transferência não disponível' };
    return { success: true, authCode: result.data.auth_code };
  },

  async setTransferLock(
    domain: string,
    isLocked: boolean,
  ): Promise<{ success: true; isLocked: boolean } | { success: false; error: string }> {
    const clean = domain.toLowerCase().trim();
    const result = await dynadotFetch('PUT', `/restful/v1/domains/${encodeURIComponent(clean)}/domain_lock`, {
      lock: isLocked,
    });
    if (!result.ok) {
      // A Dynadot devolve erro se o domínio já estiver no estado pedido — não é uma falha real.
      if (/already/i.test(result.error)) return { success: true, isLocked };
      return { success: false, error: result.error };
    }
    return { success: true, isLocked };
  },

  async setAutoRenew(
    domain: string,
    isEnabled: boolean,
  ): Promise<{ success: true; isEnabled: boolean } | { success: false; error: string }> {
    const clean = domain.toLowerCase().trim();
    const result = await dynadotFetch('PUT', `/restful/v1/domains/${encodeURIComponent(clean)}/renew_option`, {
      renew_option: isEnabled ? 'auto' : 'reset',
    });
    if (!result.ok) return { success: false, error: result.error };
    return { success: true, isEnabled };
  },

  /**
   * Aponta o domínio para nameservers próprios (ex: os que a Cloudflare
   * atribuiu a uma zona nova). Sem isto o domínio fica registado mas sem
   * nenhum DNS a apontar.
   */
  async setNameservers(
    domain: string,
    hosts: string[],
  ): Promise<{ success: true; hosts: string[] } | { success: false; error: string }> {
    if (hosts.length < 2) {
      return { success: false, error: 'São precisos pelo menos 2 nameservers' };
    }
    const clean = domain.toLowerCase().trim();
    const result = await dynadotFetch('PUT', `/restful/v1/domains/${encodeURIComponent(clean)}/nameservers`, {
      nameserver_list: hosts,
    });
    if (result.ok) return { success: true, hosts };

    // .app/.dev — a RESTful recusa; a API3 legada aceita. O `set_ns` exige que
    // os nameservers já existam na conta, por isso tenta registá-los primeiro
    // (`add_ns` — "já existe" é inofensivo).
    if (isUnsupportedDomainType(result.error)) {
      for (const host of hosts) {
        await dynadotApi3Command('add_ns', { host });
      }
      const nsParams: Record<string, string> = { domain: clean };
      hosts.forEach((h, i) => {
        nsParams[`ns${i}`] = h;
      });
      const legacy = await dynadotApi3Command('set_ns', nsParams);
      if (legacy.ok) return { success: true, hosts };
      return { success: false, error: legacy.error };
    }

    return { success: false, error: result.error };
  },

  async createContact(contactData: {
    name: string;
    email: string;
    phone_cc: string;
    phone_number: string;
    address1: string;
    city: string;
    state?: string;
    zip: string;
    country: string;
    organization?: string;
  }): Promise<{ success: true; contactId: string } | { success: false; error: string }> {
    const result = await dynadotFetch<{ contact_id: number }>('POST', '/restful/v1/contacts', {
      contact: contactData,
    });
    if (!result.ok) return { success: false, error: result.error };
    if (!result.data.contact_id) return { success: false, error: 'ID do contacto não retornado pela API' };
    return { success: true, contactId: String(result.data.contact_id) };
  },

  async registerDomain(
    domain: string,
    contactId: string,
    years = 1,
    autoRenew = true,
  ): Promise<{ success: true; message: string; raw?: unknown } | { success: false; error: string; raw?: unknown }> {
    const clean = domain.toLowerCase().trim();
    const result = await dynadotFetch<{ domain_name: string; expiration_date: string }>(
      'POST',
      `/restful/v1/domains/${encodeURIComponent(clean)}/register`,
      {
        domain: {
          duration: years,
          privacy: 'full',
          registrant_contactId: Number(contactId),
          admin_contactId: Number(contactId),
          tech_contactId: Number(contactId),
          billing_contactId: Number(contactId),
        },
      },
    );

    if (!result.ok) {
      return { success: false, error: result.error };
    }

    if (autoRenew) {
      await dynadotAPI.setAutoRenew(clean, true);
    }

    return {
      success: true,
      message: `Domínio ${clean} registado com sucesso.`,
      raw: result.data,
    };
  },

  /**
   * Pede a transferência de um domínio de outro registador para a Dynadot,
   * usando o código de autorização (EPP) do dono. Não é instantâneo — o
   * registador antigo tem de aprovar (ou não fazer nada 5-7 dias, o que
   * conta como aprovação silenciosa); ver getTransferStatus() para
   * acompanhar o progresso. Descoberto por tentativa/erro em sandbox: exige
   * privacy e duration mesmo não sendo um registo novo.
   */
  async initiateTransferIn(
    domain: string,
    authCode: string,
    years = 1,
  ): Promise<{ success: true } | { success: false; error: string }> {
    const clean = domain.toLowerCase().trim();
    const result = await dynadotFetch(
      'POST',
      `/restful/v1/domains/${encodeURIComponent(clean)}/transfer_in`,
      { domain: { auth_code: authCode, privacy: 'full', duration: years } },
      [200, 202],
    );
    if (!result.ok) return { success: false, error: result.error };
    return { success: true };
  },

  /** Estado actual de um pedido de transferência já submetido. */
  async getTransferStatus(domain: string): Promise<
    | { success: true; status: string; orderId?: string; createdDate?: string; completedDate?: string | null }
    | { success: false; error: string }
  > {
    const clean = domain.toLowerCase().trim();
    const result = await dynadotFetch<{
      domain_transfer_status_list?: Array<{
        order_id: string;
        transfer_status: string;
        order_created_date: number;
        order_completed_date: number;
      }>;
    }>('GET', `/restful/v1/domains/${encodeURIComponent(clean)}/transfer_status?transfer_type=transfer_in`);
    if (!result.ok) return { success: false, error: result.error };
    const entry = result.data.domain_transfer_status_list?.[0];
    if (!entry) return { success: false, error: 'Nenhum pedido de transferência encontrado para este domínio' };
    return {
      success: true,
      status: entry.transfer_status,
      orderId: entry.order_id,
      createdDate: entry.order_created_date ? new Date(entry.order_created_date).toISOString() : undefined,
      completedDate:
        entry.order_completed_date && entry.order_completed_date > 0
          ? new Date(entry.order_completed_date).toISOString()
          : null,
    };
  },

  /**
   * Preços reais actuais da Dynadot para TODAS as extensões de uma vez —
   * regista, renova e transferência, em USD. Usado para manter a nossa
   * tabela de preços (domain-tld-prices.ts) sincronizada em vez de fixa no
   * código.
   *
   * #10 (2026-09-13, backport de visualdesign-teste): substituiu um
   * `getTldPrice(tld)` que pedia um preço de cada vez com `tld=<extensão>`
   * — esse parâmetro NÃO existe no comando `tld_price` da API3 (confirmado
   * na documentação pública da Dynadot: só aceita
   * `currency`/`count_per_page`/`page_index`/`sort`, devolve sempre uma
   * LISTA paginada de todas as extensões). Por não existir esse filtro, a
   * chamada antiga falhava sempre, nas 44 extensões, todas as semanas,
   * desde que este sync foi criado — nunca escreveu um preço sequer (ver
   * `domain_tld_price_overrides`, sempre vazia). Isto pede a lista completa
   * (paginada) de uma vez, em vez de 44 pedidos individuais.
   *
   * A forma exacta dos campos de cada linha da lista não está documentada,
   * por isso a leitura é tolerante a várias grafias possíveis. Se a forma da
   * resposta não for reconhecida (envelope ou lista), devolve o corpo em
   * bruto (`raw`) para diagnóstico em vez de aplicar um preço adivinhado —
   * nunca escreve nada na base de dados nesse caso (ver domain-price-sync.ts).
   */
  async getAllTldPrices(): Promise<
    | { success: true; prices: Map<string, { priceUsd: number; renewPriceUsd: number; transferPriceUsd?: number }> }
    | { success: false; error: string; raw?: unknown }
  > {
    const keys = getKeys();
    if (!keys) return { success: false, error: 'Chaves de API do registador não configuradas' };

    const prices = new Map<string, { priceUsd: number; renewPriceUsd: number; transferPriceUsd?: number }>();
    const pageSize = 200;
    const maxPages = 10; // cobre até 2000 extensões — a Dynadot lista pouco mais de 500

    const pickStr = (row: Record<string, unknown>, ...names: string[]): string | undefined => {
      for (const k of names) {
        const v = row[k];
        if (typeof v === 'string' && v.trim()) return v.trim().replace(/^\./, '').toLowerCase();
      }
      return undefined;
    };
    const pickNum = (row: Record<string, unknown>, ...names: string[]): number | undefined => {
      for (const k of names) {
        const v = row[k];
        const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : undefined;
        if (n !== undefined && Number.isFinite(n) && n > 0) return n;
      }
      return undefined;
    };
    // Não confiamos em nenhum nome de campo de envelope específico (nunca
    // confirmado ao vivo) — procura recursivamente, em toda a árvore JSON,
    // o primeiro array de objectos que pareça linhas de preço por extensão
    // (tem um campo de nome de TLD reconhecível).
    function findTldList(node: unknown, depth = 0): Record<string, unknown>[] | undefined {
      if (depth > 4 || node === null || typeof node !== 'object') return undefined;
      if (Array.isArray(node)) {
        if (node.length > 0 && typeof node[0] === 'object' && node[0] !== null) {
          const first = node[0] as Record<string, unknown>;
          if (pickStr(first, 'Tld', 'tld', 'TldName', 'Name', 'name', 'Extension')) {
            return node as Record<string, unknown>[];
          }
        }
        for (const item of node) {
          const found = findTldList(item, depth + 1);
          if (found) return found;
        }
        return undefined;
      }
      for (const value of Object.values(node as Record<string, unknown>)) {
        const found = findTldList(value, depth + 1);
        if (found) return found;
      }
      return undefined;
    }

    let lastRaw: unknown;
    for (let page = 0; page < maxPages; page++) {
      const qs = new URLSearchParams({
        key: keys.apiKey,
        command: 'tld_price',
        currency: 'USD',
        count_per_page: String(pageSize),
        page_index: String(page),
      });
      let json: unknown;
      try {
        const res = await fetch(`https://api.dynadot.com/api3.json?${qs.toString()}`);
        json = await res.json().catch(() => undefined);
      } catch (e: unknown) {
        if (page === 0) {
          return { success: false, error: e instanceof Error ? e.message : 'Erro ao contactar a API3 da Dynadot' };
        }
        break;
      }
      if (!json || typeof json !== 'object') {
        if (page === 0) return { success: false, error: 'Resposta vazia/inválida da API3 da Dynadot' };
        break;
      }
      lastRaw = json;

      // Erro explícito reportado pela Dynadot (qualquer forma de envelope).
      const errMsg = findFirstErrorMessage(json);
      if (errMsg) {
        if (page === 0) return { success: false, error: errMsg, raw: json };
        break;
      }

      const listCandidate = findTldList(json);
      if (!listCandidate) {
        if (page === 0) {
          return { success: false, error: 'Formato de resposta de preços não reconhecido (sem lista)', raw: json };
        }
        break;
      }

      for (const row of listCandidate) {
        const tld = pickStr(row, 'Tld', 'tld', 'TldName', 'Name', 'name', 'Extension');
        const priceUsd = pickNum(row, 'Price', 'price', 'RegisterPrice', 'register_price', 'NewRegistrationPrice', 'NewPrice');
        const renewPriceUsd = pickNum(row, 'RenewPrice', 'renew_price', 'RenewalPrice');
        const transferPriceUsd = pickNum(row, 'TransferPrice', 'transfer_price');
        if (tld && priceUsd !== undefined && renewPriceUsd !== undefined) {
          prices.set(tld, { priceUsd, renewPriceUsd, transferPriceUsd });
        }
      }

      if (listCandidate.length < pageSize) break; // última página
    }

    if (prices.size === 0) {
      return { success: false, error: 'Nenhuma extensão reconhecida na resposta da Dynadot', raw: lastRaw };
    }
    return { success: true, prices };
  },

  /**
   * Renova a sério no registador. A Dynadot exige o ano de expiração ACTUAL
   * como confirmação (protecção contra corridas — renovar o domínio errado
   * ou uma segunda vez sem dar por isso), por isso vamos sempre buscar
   * getDomainDetails primeiro para saber que ano passar.
   */
  async renewDomain(
    domain: string,
    years = 1,
  ): Promise<{ success: true; newExpireDate: string } | { success: false; error: string }> {
    const clean = domain.toLowerCase().trim();
    const details = await dynadotAPI.getDomainDetails(clean);
    if (!details.success) return { success: false, error: details.error };
    if (!details.expireDate) {
      return { success: false, error: 'Data de expiração actual do domínio desconhecida' };
    }
    const currentYear = new Date(details.expireDate).getFullYear();
    const result = await dynadotFetch<{ expiration_date: number }>(
      'POST',
      `/restful/v1/domains/${encodeURIComponent(clean)}/renew`,
      { duration: years, year: currentYear },
    );
    if (!result.ok) return { success: false, error: result.error };
    return {
      success: true,
      newExpireDate: new Date(result.data.expiration_date).toISOString().slice(0, 10),
    };
  },
};
