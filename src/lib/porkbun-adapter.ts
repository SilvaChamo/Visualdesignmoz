/**
 * porkbun-adapter.ts
 * 
 * Adaptador para a API V3 da Porkbun.
 * Permite verificar disponibilidade, registar e gerir domínios.
 */

const PORKBUN_API_URL = 'https://porkbun.com/api/json/v3';
const API_KEY = process.env.PORKBUN_API_KEY;
const SECRET_KEY = process.env.PORKBUN_SECRET_KEY;

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
    try {
      const response = await fetch(`${PORKBUN_API_URL}/domain/check/${domain}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apikey: API_KEY,
          secretapikey: SECRET_KEY,
        }),
      });

      const data: PorkbunResponse = await response.json();
      return data;
    } catch (error) {
      console.error('Porkbun Check Error:', error);
      return { status: 'ERROR', message: 'Erro ao contactar Porkbun' };
    }
  },

  /**
   * Regista um novo domínio.
   * NOTA: Requer que você tenha saldo na conta Porkbun.
   */
  async registerDomain(domain: string) {
    try {
      const response = await fetch(`${PORKBUN_API_URL}/domain/register/${domain}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apikey: API_KEY,
          secretapikey: SECRET_KEY,
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
    try {
      const response = await fetch(`${PORKBUN_API_URL}/domain/updateNS/${domain}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apikey: API_KEY,
          secretapikey: SECRET_KEY,
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
    try {
      const response = await fetch(`${PORKBUN_API_URL}/domain/get/${domain}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apikey: API_KEY,
          secretapikey: SECRET_KEY,
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
