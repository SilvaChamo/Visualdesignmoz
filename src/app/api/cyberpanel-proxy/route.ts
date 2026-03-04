import { NextRequest, NextResponse } from 'next/server';
import https from 'https';

// CyberPanel API Configuration
const CYBERPANEL_URL = process.env.CYBERPANEL_URL || 'https://109.199.104.22:8090/api';
const CYBERPANEL_ADMIN_PASS = process.env.CYBERPANEL_PASS || '';
const CYBERPANEL_TIMEOUT_MS = 8000; // 8 seconds

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { endpoint, params } = body;

        const url = `${CYBERPANEL_URL}/${endpoint}`;
        console.log(`[CyberPanel Proxy] Requesting: ${endpoint} for ${params?.domainName || 'all'}`);

        const finalParams = {
            adminUser: process.env.CYBERPANEL_USER || 'admin',
            adminPass: CYBERPANEL_ADMIN_PASS,
            ...params
        };

        const postData = JSON.stringify(finalParams);

        // Function to make HTTPS request natively ignoring SSL errors
        const makeRequest = () => new Promise<string>((resolve, reject) => {
            const parsedUrl = new URL(url);
            const options = {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port || 443,
                path: parsedUrl.pathname + parsedUrl.search,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                },
                rejectUnauthorized: false,
                timeout: CYBERPANEL_TIMEOUT_MS
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    resolve(data);
                });
            });

            req.on('error', (e) => {
                reject(e);
            });

            req.on('timeout', () => {
                req.destroy(new Error('TimeoutError'));
            });

            req.write(postData);
            req.end();
        });

        const data = await makeRequest();

        try {
            const jsonData = JSON.parse(data);

            // Specific known error: API Access Disabled in CyberPanel settings
            if (jsonData.error_message === 'API Access Disabled.' || jsonData.error_message?.includes('API Access Disabled')) {
                console.warn('[CyberPanel] API Access is disabled on the server side.');
                return NextResponse.json({
                    status: 0,
                    error_message: 'API Access Disabled.',
                    fix: 'Acede ao CyberPanel → https://109.199.104.22:8090 → Clica em "Security" → "API Access" → Activa o toggle e guarda.',
                }, { status: 403 });
            }

            console.log(`[CyberPanel SUCCESS] Content: ${endpoint}`);
            return NextResponse.json(jsonData);
        } catch {
            console.log('[CyberPanel] Response is not JSON. Preview:', data.substring(0, 100));
            return NextResponse.json({ raw: data });
        }

    } catch (error: any) {
        console.error('[CyberPanel Proxy Exception]', error?.message || error);

        // Handle timeouts
        if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
            return NextResponse.json(
                {
                    error: 'Servidor CyberPanel indisponível',
                    details: 'O servidor não respondeu dentro do tempo limite. Verifique se o CyberPanel está ativo e se a API está habilitada.'
                },
                { status: 504 }
            );
        }

        return NextResponse.json(
            {
                error: 'Erro no proxy do CyberPanel',
                details: error instanceof Error ? error.message : 'Erro desconhecido'
            },
            { status: 500 }
        );
    }
}
