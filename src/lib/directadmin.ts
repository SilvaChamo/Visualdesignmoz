/**
 * Camada legada — pedidos a painéis de hospedagem externos estão desactivados.
 */

export interface DaResponse {
  error: boolean;
  text?: string;
  details?: string;
  data?: Record<string, unknown>;
}

export function parseDaResponse(responseString: string): DaResponse {
  try {
    const parsed = new URLSearchParams(responseString);
    const result: DaResponse = {
      error: parsed.get('error') === '1',
      text: parsed.get('text') || undefined,
      details: parsed.get('details') || undefined,
      data: {},
    };

    for (const [key, value] of parsed.entries()) {
      if (key !== 'error' && key !== 'text' && key !== 'details') {
        result.data![key] = value;
      }
    }

    return result;
  } catch {
    return { error: true, text: 'Parse Error', details: 'Could not parse response' };
  }
}

export async function daRequest(
  _endpoint: string,
  _method: 'GET' | 'POST' = 'GET',
  _params: Record<string, string> = {}
): Promise<DaResponse> {
  return {
    error: true,
    text: 'Desactivado',
    details: 'Integração com painel de hospedagem externo foi removida.',
  };
}

export async function daJsonRequest(
  endpoint: string,
  method: 'GET' | 'POST' = 'GET',
  params: Record<string, string> = {}
): Promise<DaResponse> {
  return daRequest(endpoint, method, { ...params, json: 'yes' });
}
