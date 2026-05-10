/**
 * Adaptador API v3 Porkbun (JSON via POST).
 * Documentação: https://porkbun.com/api/json/v3/documentation
 */

const PORKBUN_API_URL = 'https://api.porkbun.com/api/json/v3';

interface PorkbunBaseResponse {
  status: 'SUCCESS' | 'ERROR';
  message?: string;
  [key: string]: unknown;
}

function getKeys() {
  const apiKey = process.env.PORKBUN_API_KEY;
  const secretKey = process.env.PORKBUN_SECRET_KEY;
  if (!apiKey || !secretKey) return null;
  return { apikey: apiKey, secretapikey: secretKey };
}

async function postJson<T extends PorkbunBaseResponse>(path: string, body: Record<string, unknown>): Promise<T> {
  const keys = getKeys();
  if (!keys) {
    return { status: 'ERROR', message: 'Chaves de API do registrador não configuradas' } as T;
  }

  try {
    const response = await fetch(`${PORKBUN_API_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ ...keys, ...body }),
    });

    const text = await response.text();
    try {
      return JSON.parse(text) as T;
    } catch {
      console.error('Porkbun Non-JSON Response:', text.substring(0, 500));
      return { status: 'ERROR', message: 'Resposta inválida do registrador' } as T;
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Erro de rede';
    console.error('Porkbun request error:', msg);
    return { status: 'ERROR', message: `Erro de rede: ${msg}` } as T;
  }
}

/** Resposta normalizada de checkDomain */
export type PorkbunCheckNormalized = {
  status: 'SUCCESS' | 'ERROR';
  message?: string;
  domain: string;
  avail: 'yes' | 'no' | string;
  priceUsd: number;
  minDuration: number;
  /** Custo total em cêntimos (USD) para domain/create — preço × anos mínimos × 100 */
  costPennies: number;
  raw: Record<string, unknown>;
};

function parseUsdPrice(value: unknown): number {
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (typeof value === 'string') {
    const n = parseFloat(value.replace(/[^0-9.]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function normalizeCheck(domain: string, data: PorkbunBaseResponse): PorkbunCheckNormalized {
  if (data.status !== 'SUCCESS') {
    return {
      status: 'ERROR',
      message: (data.message as string) || 'Erro na verificação',
      domain,
      avail: 'no',
      priceUsd: 0,
      minDuration: 1,
      costPennies: 0,
      raw: data as Record<string, unknown>,
    };
  }

  const inner = (data.response as Record<string, unknown>) || (data as unknown as Record<string, unknown>);
  const avail = (inner.avail as string) || 'no';
  const priceUsd = parseUsdPrice(inner.price);
  const minDuration = Math.max(1, parseInt(String(inner.minDuration ?? 1), 10) || 1);
  const costPennies = Math.round(priceUsd * 100 * minDuration);

  return {
    status: 'SUCCESS',
    domain,
    avail,
    priceUsd,
    minDuration,
    costPennies,
    raw: data as Record<string, unknown>,
  };
}

export const porkbunAPI = {
  /**
   * Verifica disponibilidade e preço (registo mínimo).
   * Endpoint: POST /domain/checkDomain/{domain}
   */
  async checkAvailability(domain: string): Promise<PorkbunCheckNormalized> {
    const keys = getKeys();
    if (!keys) {
      return normalizeCheck(domain, { status: 'ERROR', message: 'Chaves de API do registrador não configuradas' });
    }

    const clean = domain.toLowerCase().trim();
    const data = await postJson<PorkbunBaseResponse>(
      `/domain/checkDomain/${encodeURIComponent(clean)}`,
      {}
    );

    return normalizeCheck(clean, data);
  },

  /**
   * Regista domínio. Endpoint oficial: POST /domain/create/{domain}
   * Requer cost (cêntimos) e agreeToTerms.
   */
  async createDomain(
    domain: string,
    opts: { costPennies: number; agreeToTerms: string }
  ): Promise<PorkbunBaseResponse & { domain?: string; orderId?: number; balance?: number }> {
    const keys = getKeys();
    if (!keys) {
      return { status: 'ERROR', message: 'Chaves de API do registrador não configuradas' };
    }

    const clean = domain.toLowerCase().trim();
    const cost = Math.max(1, Math.round(opts.costPennies));
    const agree = opts.agreeToTerms === 'yes' || opts.agreeToTerms === '1' ? 'yes' : 'no';
    if (agree !== 'yes') {
      return { status: 'ERROR', message: 'É necessário aceitar os termos (agreeToTerms).' };
    }

    return postJson(`/domain/create/${encodeURIComponent(clean)}`, {
      cost,
      agreeToTerms: 'yes',
    });
  },

  /** Compat: registo com verificação automática de preço */
  async registerDomain(domain: string, agreeToTerms = true): Promise<PorkbunBaseResponse> {
    const check = await this.checkAvailability(domain);
    if (check.status !== 'SUCCESS') {
      return { status: 'ERROR', message: check.message || 'Falha ao verificar domínio' };
    }
    if (check.avail !== 'yes') {
      return { status: 'ERROR', message: 'Domínio não está disponível para registo.' };
    }
    if (check.costPennies <= 0) {
      return { status: 'ERROR', message: 'Preço inválido devolvido pelo registrador.' };
    }
    if (!agreeToTerms) {
      return { status: 'ERROR', message: 'Aceite os termos antes de registar.' };
    }
    return this.createDomain(domain, { costPennies: check.costPennies, agreeToTerms: 'yes' });
  },

  async updateNameservers(domain: string, nameservers: string[]) {
    return postJson(`/domain/updateNS/${encodeURIComponent(domain.toLowerCase().trim())}`, {
      ns: nameservers,
    });
  },

  async getDomainDetails(domain: string) {
    return postJson(`/domain/get/${encodeURIComponent(domain.toLowerCase().trim())}`, {});
  },

  /** Registos DNS alojados no registrador (POST /dns/retrieve/{domain}). */
  async retrieveDnsRecords(domain: string) {
    const clean = domain.toLowerCase().trim();
    if (!getKeys()) {
      return { status: 'ERROR', message: 'Chaves de API do registrador não configuradas' } as PorkbunBaseResponse;
    }
    return postJson(`/dns/retrieve/${encodeURIComponent(clean)}`, {});
  },

  async ping() {
    return postJson('/ping', {});
  },

  /** Lista domínios na conta (até 1000 por pedido). */
  async listAllDomains(start = 0) {
    return postJson('/domain/listAll', {
      start: String(start),
      includeLabels: 'no',
    });
  },
};
