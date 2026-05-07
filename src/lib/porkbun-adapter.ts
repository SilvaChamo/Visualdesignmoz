/**
 * porkbun-adapter.ts
 * 
 * Adaptador para a API V3 da Porkbun.
 * Permite verificar disponibilidade, registar e gerir domínios.
 */

const PORKBUN_API_URL = 'https://api.porkbun.com/api/json/v3';

interface PorkbunResponse {
  status: 'SUCCESS' | 'ERROR';
  message?: string;
  [key: string]: any;
}

export const porkbunAPI = {
  /**
   * Verifica se um domínio está disponível para registo.
   */
  async checkAvailability(domain: string) {
    const apiKey = process.env.PORKBUN_API_KEY;
    const secretKey = process.env.PORKBUN_SECRET_KEY;

    if (!apiKey || !secretKey) {
      console.error('Porkbun Error: API Keys are missing in process.env');
      return { status: 'ERROR', message: 'Chaves da API Porkbun não configuradas' };
    }

    try {
      const response = await fetch(`${PORKBUN_API_URL}/domain/check/${domain}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        body: JSON.stringify({
          apikey: apiKey,
          secretapikey: secretKey,
        }),
      });

      const text = await response.text();
      try {
        return JSON.parse(text);
      } catch (e) {
        console.error('Porkbun Non-JSON Response (HTML?):', text.substring(0, 500));
        return { status: 'ERROR', message: 'Porkbun respondeu com HTML (Erro de URL ou Bloqueio)' };
      }
    } catch (error: any) {
      console.error('Porkbun Network/DNS Error:', error.message || error);
      return { status: 'ERROR', message: `Erro de rede: ${error.message || 'Sem resposta da Porkbun'}` };
    }
  },

  /**
   * Regista um novo domínio.
   * NOTA: Requer que você tenha saldo na conta Porkbun.
   */
  async registerDomain(domain: string) {
    const apiKey = process.env.PORKBUN_API_KEY;
    const secretKey = process.env.PORKBUN_SECRET_KEY;
    
    if (!apiKey || !secretKey) {
      return { status: 'ERROR', message: 'Chaves da API Porkbun não configuradas' };
    }
    
    try {
      const response = await fetch(`${PORKBUN_API_URL}/domain/register/${domain}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          apikey: apiKey,
          secretapikey: secretKey,
        }),
      });

      const data: PorkbunResponse = await response.json();
      return data;
    } catch (error) {
      console.error('Porkbun Register Error:', error);
      return { status: 'ERROR', message: 'Erro ao registar domínio' };
    }
  },

  /**
   * Atualiza os Nameservers de um domínio.
   */
  async updateNameservers(domain: string, nameservers: string[]) {
    const apiKey = process.env.PORKBUN_API_KEY;
    const secretKey = process.env.PORKBUN_SECRET_KEY;
    
    if (!apiKey || !secretKey) {
      return { status: 'ERROR', message: 'Chaves da API Porkbun não configuradas' };
    }
    
    try {
      const response = await fetch(`${PORKBUN_API_URL}/domain/updateNS/${domain}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          apikey: apiKey,
          secretapikey: secretKey,
          ns: nameservers,
        }),
      });

      const data: PorkbunResponse = await response.json();
      return data;
    } catch (error) {
      console.error('Porkbun NS Update Error:', error);
      return { status: 'ERROR', message: 'Erro ao atualizar Nameservers' };
    }
  },

  /**
   * Obtém informações detalhadas de um domínio.
   */
  async getDomainDetails(domain: string) {
    const apiKey = process.env.PORKBUN_API_KEY;
    const secretKey = process.env.PORKBUN_SECRET_KEY;
    
    if (!apiKey || !secretKey) {
      return { status: 'ERROR', message: 'Chaves da API Porkbun não configuradas' };
    }
    
    try {
      const response = await fetch(`${PORKBUN_API_URL}/domain/get/${domain}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          apikey: apiKey,
          secretapikey: secretKey,
        }),
      });

      const data: PorkbunResponse = await response.json();
      return data;
    } catch (error) {
      console.error('Porkbun Details Error:', error);
      return { status: 'ERROR', message: 'Erro ao obter detalhes' };
    }
  }
};
