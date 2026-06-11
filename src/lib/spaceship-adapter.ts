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
  
  // Simulação para o Frontend (já que a API real spaceship.dev não está acessível)
  // Simulamos um pequeno delay de rede
  await new Promise(resolve => setTimeout(resolve, 800));

  // Vamos simular que domínios com a palavra "indisponivel" estão ocupados
  // Tudo o resto fica livre
  const isAvailable = !clean.includes('indisponivel');
  
  return {
    available: isAvailable,
    price: undefined, // Vai usar o preço fallback do DomainSearch.tsx
    currency: 'USD',
  };
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
  if (!keys) throw new Error('Chaves de API do Spaceship não configuradas');

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
      return { success: false, error: 'Chaves de API do Spaceship não configuradas' };
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
          const msg = body.detail || body.message || `Spaceship API ${res.status}`;
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
        error: e instanceof Error ? e.message : 'Erro ao contactar Spaceship',
      };
    }
  },
};
