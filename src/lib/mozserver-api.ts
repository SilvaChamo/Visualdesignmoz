// API Integration com MozServer
const MOZSERVER_CONFIG = {
  baseURL: 'https://mozserver.co.mz/api',
  token: process.env.MOZSERVER_TOKEN || '',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.MOZSERVER_TOKEN || ''}`
  }
}

// Função auxiliar para chamadas via Proxy (apenas para Browser)
async function callProxy(endpoint: string, method: string = 'POST', payload?: any) {
  try {
    const response = await fetch('/api/mozserver-proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        endpoint,
        method,
        payload
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const error: any = new Error(errorData.error || `HTTP ${response.status}`);
      error.details = errorData.details || '';
      throw error;
    }

    return await response.json();
  } catch (error) {
    console.error(`Proxy call failed for ${endpoint}:`, error);
    throw error;
  }
}

// Verificar se a API está acessível
export async function checkApiConnection(): Promise<boolean> {
  try {
    await callProxy('/health', 'GET');
    return true;
  } catch (error) {
    console.warn('API /health endpoint failed, but proceeding anyway:', error);
    // Retornamos true para não bloquear a busca se apenas o health check falhar
    return true;
  }
}

// Tipos de resposta
export interface DomainResponse {
  available: boolean;
  price?: number;
  currency?: string;
  period?: number;
  error?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// Verificar disponibilidade de domínio
export async function checkDomainAvailability(domain: string, tld: string = '.mz'): Promise<DomainResponse> {
  try {
    const result = await callProxy('/check-domain', 'POST', {
      domain: domain,
      tld: tld
    });

    return {
      available: result.available || false,
      price: result.price,
      currency: result.currency,
      period: result.period,
      error: result.error
    };
  } catch (error) {
    console.error('Error checking domain availability:', error);
    return {
      available: false,
      error: error instanceof Error ? error.message : 'Failed to check domain availability'
    };
  }
}

// Registrar domínio
export async function registerDomain(domain: string, tld: string = '.mz', period: number = 1): Promise<ApiResponse<any>> {
  try {
    const response = await fetch(`${MOZSERVER_CONFIG.baseURL}/register-domain`, {
      method: 'POST',
      headers: MOZSERVER_CONFIG.headers,
      body: JSON.stringify({
        domain: domain,
        tld: tld,
        period: period
      })
    });

    return await response.json();
  } catch (error) {
    console.error('Error registering domain:', error);
    return {
      success: false,
      error: 'Failed to register domain'
    };
  }
}

// Obter lista de domínios registrados
export async function getRegisteredDomains(): Promise<ApiResponse<any[]>> {
  try {
    const response = await fetch(`${MOZSERVER_CONFIG.baseURL}/domains`, {
      method: 'GET',
      headers: MOZSERVER_CONFIG.headers
    });

    return await response.json();
  } catch (error) {
    console.error('Error fetching domains:', error);
    return {
      success: false,
      error: 'Failed to fetch domains'
    };
  }
}

// Obter preços de domínios
export async function getDomainPrices(): Promise<ApiResponse<any>> {
  try {
    const response = await fetch(`${MOZSERVER_CONFIG.baseURL}/domain-prices`, {
      method: 'GET',
      headers: MOZSERVER_CONFIG.headers
    });

    return await response.json();
  } catch (error) {
    console.error('Error fetching domain prices:', error);
    return {
      success: false,
      error: 'Failed to fetch domain prices'
    };
  }
}

// Funções de Revendedor
export async function getRevendedorClients(): Promise<ApiResponse<any[]>> {
  try {
    const response = await fetch(`${MOZSERVER_CONFIG.baseURL}/reseller/clients`, {
      method: 'GET',
      headers: MOZSERVER_CONFIG.headers
    });

    return await response.json();
  } catch (error) {
    console.error('Error fetching reseller clients:', error);
    return {
      success: false,
      error: 'Failed to fetch reseller clients'
    };
  }
}

export async function createClientAccount(clientData: any): Promise<ApiResponse<any>> {
  try {
    const response = await fetch(`${MOZSERVER_CONFIG.baseURL}/reseller/create-client`, {
      method: 'POST',
      headers: MOZSERVER_CONFIG.headers,
      body: JSON.stringify(clientData)
    });

    return await response.json();
  } catch (error) {
    console.error('Error creating client account:', error);
    return {
      success: false,
      error: 'Failed to create client account'
    };
  }
}

export async function suspendClient(clientId: string): Promise<ApiResponse<any>> {
  try {
    const response = await fetch(`${MOZSERVER_CONFIG.baseURL}/reseller/suspend/${clientId}`, {
      method: 'POST',
      headers: MOZSERVER_CONFIG.headers
    });

    return await response.json();
  } catch (error) {
    console.error('Error suspending client:', error);
    return {
      success: false,
      error: 'Failed to suspend client'
    };
  }
}

export async function deleteClient(clientId: string): Promise<ApiResponse<any>> {
  try {
    const response = await fetch(`${MOZSERVER_CONFIG.baseURL}/reseller/delete/${clientId}`, {
      method: 'DELETE',
      headers: MOZSERVER_CONFIG.headers
    });

    return await response.json();
  } catch (error) {
    console.error('Error deleting client:', error);
    return {
      success: false,
      error: 'Failed to delete client'
    };
  }
}

export async function sendNotificationEmail(clientEmail: string, subject: string, message: string): Promise<ApiResponse<any>> {
  try {
    const response = await fetch(`${MOZSERVER_CONFIG.baseURL}/reseller/send-notification`, {
      method: 'POST',
      headers: MOZSERVER_CONFIG.headers,
      body: JSON.stringify({
        email: clientEmail,
        subject: subject,
        message: message
      })
    });

    return await response.json();
  } catch (error) {
    console.error('Error sending notification email:', error);
    return {
      success: false,
      error: 'Failed to send notification email'
    };
  }
}
