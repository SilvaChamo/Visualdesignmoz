/**
 * Adaptador API Spaceship (JSON via GET).
 * Documentação: https://spaceship.dev/
 */

const SPACESHIP_API_URL = 'https://spaceship.dev/api/v1';

interface SpaceshipAvailabilityResponse {
  available: boolean;
  premiumPricing?: {
    registrationPrice?: number;
    renewalPrice?: number;
  };
}

function getKeys() {
  const apiKey = process.env.SPACESHIP_API_KEY;
  const secretKey = process.env.SPACESHIP_SECRET_KEY;
  if (!apiKey || !secretKey) return null;
  return { apiKey, secretKey };
}

export async function checkAvailability(domain: string) {
  const clean = domain.toLowerCase().trim();
  try {
    const res = await spaceshipFetch(`/domains/${encodeURIComponent(clean)}/available`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        available: false,
        error: body.detail || body.message || `Erro do registador (${res.status})`,
      };
    }
    return {
      available: body.result === 'available',
      price: body.premiumPricing && body.premiumPricing[0]?.registrationPrice,
      currency: 'USD',
    };
  } catch (e: unknown) {
    return {
      available: false,
      error: e instanceof Error ? e.message : 'Erro ao contactar o serviço de registo',
    };
  }
}

type SpaceshipDomainItem = {
  name?: string;
  unicodeName?: string;
  lifecycleStatus?: string;
  expirationDate?: string;
};

type SpaceshipDomainsResponse = {
  items?: SpaceshipDomainItem[];
  total?: number;
};

export type SpaceshipDomainRow = {
  domain: string;
  status?: string;
  expireDate?: string;
  tld?: string;
};

async function spaceshipFetch(path: string, init?: RequestInit): Promise<Response> {
  const keys = getKeys();
  if (!keys) throw new Error('Chaves de API do registador não configuradas');

  return fetch(`${SPACESHIP_API_URL}${path}`, {
    ...init,
    headers: {
      'X-API-Key': keys.apiKey,
      'X-API-Secret': keys.secretKey,
      Accept: 'application/json',
      ...init?.headers,
    },
  });
}

function mapSpaceshipDomain(item: SpaceshipDomainItem): SpaceshipDomainRow {
  const domain = (item.unicodeName || item.name || '').toLowerCase();
  const parts = domain.split('.');
  const tld = parts.length > 1 ? parts.slice(1).join('.') : undefined;
  const expireDate = item.expirationDate
    ? new Date(item.expirationDate).toISOString().slice(0, 10)
    : undefined;

  return {
    domain,
    status: item.lifecycleStatus,
    expireDate,
    tld,
  };
}

export const spaceshipAPI = {
  async listAllDomains(): Promise<{ success: true; domains: SpaceshipDomainRow[] } | { success: false; error: string }> {
    if (!getKeys()) {
      return { success: false, error: 'Chaves de API do registador não configuradas' };
    }

    const domains: SpaceshipDomainRow[] = [];
    const take = 100;
    let skip = 0;
    let total = Infinity;

    try {
      while (skip < total) {
        const res = await spaceshipFetch(`/domains?take=${take}&skip=${skip}&orderBy=name`);
        const body = (await res.json().catch(() => ({}))) as SpaceshipDomainsResponse & { detail?: string; message?: string };

        if (!res.ok) {
          const msg = body.detail || body.message || `Erro do registador (${res.status})`;
          return { success: false, error: msg };
        }

        const items = body.items || [];
        items.forEach((item) => domains.push(mapSpaceshipDomain(item)));

        total = typeof body.total === 'number' ? body.total : skip + items.length;
        if (items.length < take) break;
        skip += take;
      }

      return { success: true, domains };
    } catch (e: unknown) {
      return {
        success: false,
        error: e instanceof Error ? e.message : 'Erro ao contactar o serviço de registo',
      };
    }
  },

  async getDomainDetails(domain: string): Promise<
    | {
        success: true;
        isLocked?: boolean;
        autoRenew?: boolean;
        expireDate?: string;
        status?: string;
      }
    | { success: false; error: string }
  > {
    if (!getKeys()) {
      return { success: false, error: 'Chaves de API do registador não configuradas' };
    }
    try {
      const res = await spaceshipFetch(`/domains/${encodeURIComponent(domain.toLowerCase())}`);
      const body = (await res.json().catch(() => ({}))) as {
        transferLock?: { isLocked?: boolean };
        isLocked?: boolean;
        autoRenew?: { isEnabled?: boolean };
        hasAutoRenew?: boolean;
        expirationDate?: string;
        lifecycleStatus?: string;
        detail?: string;
        message?: string;
      };
      if (!res.ok) {
        return { success: false, error: body.detail || body.message || `Erro do registador (${res.status})` };
      }
      const isLocked = body.transferLock?.isLocked ?? body.isLocked;
      const autoRenew = body.autoRenew?.isEnabled ?? body.hasAutoRenew;
      const expireDate = body.expirationDate
        ? new Date(body.expirationDate).toISOString().slice(0, 10)
        : undefined;
      return {
        success: true,
        isLocked,
        autoRenew,
        expireDate,
        status: body.lifecycleStatus,
      };
    } catch (e: unknown) {
      return { success: false, error: e instanceof Error ? e.message : 'Erro ao contactar o serviço de registo' };
    }
  },

  async getTransferAuthCode(domain: string): Promise<
    | { success: true; authCode: string; expires?: string }
    | { success: false; error: string }
  > {
    if (!getKeys()) {
      return { success: false, error: 'Chaves de API do registador não configuradas' };
    }
    try {
      const res = await spaceshipFetch(`/domains/${encodeURIComponent(domain.toLowerCase())}/transfer/auth-code`);
      const body = (await res.json().catch(() => ({}))) as {
        authCode?: string;
        expires?: string;
        detail?: string;
        message?: string;
      };
      if (!res.ok) {
        return { success: false, error: body.detail || body.message || `Erro do registador (${res.status})` };
      }
      if (!body.authCode) {
        return { success: false, error: 'Código de transferência não disponível' };
      }
      return { success: true, authCode: body.authCode, expires: body.expires };
    } catch (e: unknown) {
      return { success: false, error: e instanceof Error ? e.message : 'Erro ao contactar o serviço de registo' };
    }
  },

  async setTransferLock(
    domain: string,
    isLocked: boolean,
  ): Promise<{ success: true; isLocked: boolean } | { success: false; error: string }> {
    if (!getKeys()) {
      return { success: false, error: 'Chaves de API do registador não configuradas' };
    }
    try {
      const res = await spaceshipFetch(`/domains/${encodeURIComponent(domain.toLowerCase())}/transfer/lock`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isLocked }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        isLocked?: boolean;
        detail?: string;
        message?: string;
      };
      if (!res.ok) {
        return { success: false, error: body.detail || body.message || `Erro do registador (${res.status})` };
      }
      return { success: true, isLocked: body.isLocked ?? isLocked };
    } catch (e: unknown) {
      return { success: false, error: e instanceof Error ? e.message : 'Erro ao contactar o serviço de registo' };
    }
  },

  async setAutoRenew(
    domain: string,
    isEnabled: boolean,
  ): Promise<{ success: true; isEnabled: boolean } | { success: false; error: string }> {
    if (!getKeys()) {
      return { success: false, error: 'Chaves de API do registador não configuradas' };
    }
    try {
      const res = await spaceshipFetch(`/domains/${encodeURIComponent(domain.toLowerCase())}/autorenew`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isEnabled }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        isEnabled?: boolean;
        detail?: string;
        message?: string;
      };
      if (!res.ok) {
        return { success: false, error: body.detail || body.message || `Erro do registador (${res.status})` };
      }
      return { success: true, isEnabled: body.isEnabled ?? isEnabled };
    } catch (e: unknown) {
      return { success: false, error: e instanceof Error ? e.message : 'Erro ao contactar o serviço de registo' };
    }
  },

  async createContact(contactData: {
    firstName: string;
    lastName: string;
    email: string;
    address1: string;
    city: string;
    country: string;
    phone: string;
    postalCode: string;
    organization?: string;
    state?: string;
  }): Promise<{ success: true; contactId: string } | { success: false; error: string }> {
    if (!getKeys()) {
      return { success: false, error: 'Chaves de API do registador não configuradas' };
    }
    try {
      const res = await spaceshipFetch('/contacts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactData),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errorDetail = body.detail || body.message || (body.data && JSON.stringify(body.data)) || `Erro ao criar contacto (${res.status})`;
        return { success: false, error: errorDetail };
      }

      if (!body.contactId) {
        return { success: false, error: 'ID do contacto não retornado pela API' };
      }

      return { success: true, contactId: body.contactId };
    } catch (e: unknown) {
      return { success: false, error: e instanceof Error ? e.message : 'Erro ao contactar o serviço de registo' };
    }
  },

  async registerDomain(
    domain: string,
    contactId: string,
    years = 1,
    autoRenew = true
  ): Promise<{ success: true; message: string; operationId?: string; raw?: any } | { success: false; error: string; raw?: any }> {
    if (!getKeys()) {
      return { success: false, error: 'Chaves de API do registador não configuradas' };
    }
    const clean = domain.toLowerCase().trim();
    try {
      const res = await spaceshipFetch(`/domains/${encodeURIComponent(clean)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          years,
          autoRenew,
          privacyProtection: {
            level: 'high',
            userConsent: true
          },
          contacts: {
            registrant: contactId,
            admin: contactId,
            tech: contactId,
            billing: contactId
          }
        })
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errorDetail = body.detail || body.message || (body.data && JSON.stringify(body.data)) || `Erro do registador (${res.status})`;
        return { success: false, error: errorDetail, raw: body };
      }

      const operationId = res.headers.get('spaceship-async-operationid') || body.operationId || body.id;

      return {
        success: true,
        message: `Registo do domínio ${clean} iniciado com sucesso.`,
        operationId,
        raw: body
      };
    } catch (e: unknown) {
      return { success: false, error: e instanceof Error ? e.message : 'Erro ao contactar o serviço de registo' };
    }
  },
};
