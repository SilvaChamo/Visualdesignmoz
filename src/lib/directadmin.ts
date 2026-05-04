/**
 * DirectAdmin API Integration Core
 * Handles authentication and HTTP requests to the DirectAdmin server.
 */

// These should be configured in your .env.local file
const DA_HOST = process.env.DIRECTADMIN_HOST || '109.199.104.22';
const DA_PORT = process.env.DIRECTADMIN_PORT || '2222';
const DA_USER = process.env.DIRECTADMIN_USER || 'admin';
const DA_PASSWORD = process.env.DIRECTADMIN_PASSWORD || process.env.DIRECTADMIN_LOGIN_KEY || '';
const DA_PROTOCOL = process.env.DIRECTADMIN_PROTOCOL || 'https'; // Use 'http' if SSL is not yet configured

export interface DaResponse {
  error: boolean;
  text?: string;
  details?: string;
  data?: Record<string, any>;
}

/**
 * Parses DirectAdmin API urlencoded response string into an object.
 * DirectAdmin returns data in the format: error=0&text=Success&details=Account%20Created
 */
export function parseDaResponse(responseString: string): DaResponse {
  try {
    const parsed = new URLSearchParams(responseString);
    const result: DaResponse = {
      error: parsed.get('error') === '1',
      text: parsed.get('text') || undefined,
      details: parsed.get('details') || undefined,
      data: {}
    };

    // Store the rest of the keys in data object
    for (const [key, value] of parsed.entries()) {
      if (key !== 'error' && key !== 'text' && key !== 'details') {
        result.data![key] = value;
      }
    }

    return result;
  } catch (error) {
    return { error: true, text: 'Parse Error', details: 'Could not parse DirectAdmin response' };
  }
}

/**
 * Makes a direct request to the DirectAdmin API.
 * 
 * @param endpoint The API command, e.g. 'CMD_API_POP'
 * @param method 'GET' | 'POST'
 * @param params Query parameters or POST body data
 */
export async function daRequest(
  endpoint: string,
  method: 'GET' | 'POST' = 'GET',
  params: Record<string, string> = {}
): Promise<DaResponse> {
  const url = new URL(`${DA_PROTOCOL}://${DA_HOST}:${DA_PORT}/${endpoint}`);
  
  const headers = new Headers();
  headers.append(
    'Authorization',
    `Basic ${Buffer.from(`${DA_USER}:${DA_PASSWORD}`).toString('base64')}`
  );
  
  const options: RequestInit = {
    method,
    headers,
  };

  if (method === 'GET') {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  } else {
    // DirectAdmin usually expects application/x-www-form-urlencoded for POST
    headers.append('Content-Type', 'application/x-www-form-urlencoded');
    const body = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      body.append(key, value);
    });
    options.body = body.toString();
  }

  try {
    const response = await fetch(url.toString(), options);
    
    // Some DA endpoints might return JSON if specifically requested (json=yes), 
    // but the standard is urlencoded text.
    const textData = await response.text();
    
    // Check if the response is JSON (some newer DA commands support json=yes parameter)
    if (params.json === 'yes' || textData.startsWith('{')) {
      try {
        const jsonData = JSON.parse(textData);
        // Normalize error flag
        if (jsonData.error !== undefined) {
           // DA returns error="0" string in some json responses
           jsonData.error = jsonData.error === "1" || jsonData.error === true;
        }
        return jsonData;
      } catch (e) {
        // Fallback to urlencoded parser
        return parseDaResponse(textData);
      }
    }

    return parseDaResponse(textData);
  } catch (error: any) {
    console.error('DirectAdmin API Error:', error);
    return {
      error: true,
      text: 'Connection Error',
      details: error.message || 'Failed to connect to DirectAdmin',
    };
  }
}

/**
 * Helper to execute commands specifically formatted for JSON responses
 * This is preferred for modern DirectAdmin APIs
 */
export async function daJsonRequest(
  endpoint: string,
  method: 'GET' | 'POST' = 'GET',
  params: Record<string, string> = {}
): Promise<any> {
  // Add json=yes to enforce JSON response from DirectAdmin
  const finalParams = { ...params, json: 'yes' };
  return daRequest(endpoint, method, finalParams);
}
