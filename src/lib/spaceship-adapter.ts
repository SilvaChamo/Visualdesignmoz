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
  const keys = getKeys();
  if (!keys) {
    return { available: false, error: 'Chaves de API da Spaceship não configuradas' };
  }

  const clean = domain.toLowerCase().trim();
  const url = `${SPACESHIP_API_URL}/domains/${encodeURIComponent(clean)}/available`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-API-Key': keys.apiKey,
        'X-API-Secret': keys.secretKey,
        'Content-Type': 'application/json',
      },
    });

    const text = await response.text();
    try {
      const data = JSON.parse(text);
      let isAvailable = false;
      let price: number | undefined;

      if (Array.isArray(data.domains) && data.domains.length > 0) {
        isAvailable = data.domains[0].available;
        const regPrice = data.domains[0].price?.registration;
        price = regPrice ? parseFloat(regPrice) : undefined;
      } else if (typeof data.available === 'boolean') {
        isAvailable = data.available;
        price = data.premiumPricing?.registrationPrice;
      }

      return {
        available: isAvailable,
        price: price,
        currency: 'USD',
      };
    } catch {
      console.error('Spaceship Non-JSON Response:', text.substring(0, 500));
      return { available: false, error: 'Resposta inválida da Spaceship' };
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Erro de rede';
    console.error('Spaceship request error:', msg);
    return { available: false, error: `Erro de rede: ${msg}` };
  }
}
