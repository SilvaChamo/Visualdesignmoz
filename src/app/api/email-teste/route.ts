import { NextRequest, NextResponse } from 'next/server';
import * as https from 'https';

const CYBERPANEL_API_URL = 'https://109.199.104.22:8090/send-email-api.php';
const CYBERPANEL_API_TOKEN = 'vd_api_2024_secure_token';

export async function POST(req: NextRequest): Promise<Response> {
    try {
        const { to, from, subject, html } = await req.json();
        
        console.log('🧪 TESTE DE EMAIL:');
        console.log('  De:', from);
        console.log('  Para:', to);
        console.log('  Assunto:', subject);
        console.log('  HTML length:', html?.length);

        const postData = JSON.stringify({
            to: [to],
            subject,
            html: html || '<p>Teste</p>',
            from,
            fromName: ''
        });

        const options = {
            hostname: '109.199.104.22',
            port: 8090,
            path: '/send-email-api.php',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CYBERPANEL_API_TOKEN}`,
                'Content-Length': Buffer.byteLength(postData)
            },
            rejectUnauthorized: false,
            timeout: 30000
        };

        const result = await new Promise<{ success: boolean; message?: string; error?: string; data?: any; statusCode?: number }>((resolve, reject) => {
            const request = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    console.log('🧪 RESPOSTA RAW:', data.substring(0, 500));
                    
                    try {
                        const result = JSON.parse(data);
                        console.log('🧪 RESULTADO:', result);
                        
                        resolve({
                            success: result.success,
                            message: result.message || result.error,
                            data: {
                                rawResponse: data.substring(0, 200),
                                statusCode: res.statusCode,
                                details: result
                            }
                        });
                    } catch (e: any) {
                        resolve({
                            success: false,
                            error: 'Resposta inválida',
                            data: { rawResponse: data.substring(0, 200) }
                        });
                    }
                });
            });

            request.on('error', (error) => {
                console.error('🧪 ERRO:', error.message);
                resolve({
                    success: false,
                    error: error.message
                });
            });

            request.write(postData);
            request.end();
        });

        return NextResponse.json(result);

    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}
