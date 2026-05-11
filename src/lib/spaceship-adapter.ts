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

  // Vamos simular que domínios .com estão ocupados e os outros estão livres
  // para que o utilizador consiga ver as duas cores de botões (Verde e Azul)
  const isCom = clean.endsWith('.com');
  
  return {
    available: !isCom,
    price: undefined, // Vai usar o preço fallback do DomainSearch.tsx
    currency: 'USD',
  };
}
