import { NextRequest, NextResponse } from 'next/server';
import * as nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';
import * as https from 'https';
import { 
  canSendEmail, 
  recordSuccessfulSends,
  getDomainReputation,
  DAILY_EMAIL_LIMIT
} from '@/lib/warmup-service';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Configuração da API CyberPanel
const CYBERPANEL_API_URL = 'https://109.199.104.22:8090/send-email-api.php';
const CYBERPANEL_API_TOKEN = 'vd_api_2024_secure_token';

// Agente HTTPS que ignora certificado inválido
const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
});

// 🆕 FUNÇÃO: Enviar via CyberPanel PHP API (SMTP local) usando https nativo
async function sendViaCyberPanelAPI(
    to: string[], 
    subject: string, 
    content: string, 
    fromEmail: string,
    clientDomain: string,
    warmupCheck: any
): Promise<any> {
    console.log(`🔄 CYBERPANEL API: Enviando para ${to.length} destinatários`);
    
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            to: to.slice(0, 100),
            subject,
            html: content,
            from: fromEmail,
            fromName: ''
        });

        console.log('🔍 DEBUG - URL:', CYBERPANEL_API_URL);
        console.log('🔍 DEBUG - From:', fromEmail);
        console.log('🔍 DEBUG - To count:', to.length);
        console.log('🔍 DEBUG - Post data length:', postData.length);

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
            timeout: 30000 // 30 segundos timeout
        };

        const req = https.request(options, (res) => {
            console.log('🔍 DEBUG - Response status:', res.statusCode);
            
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                console.log('🔍 DEBUG - Raw response:', data.substring(0, 500));
                
                try {
                    const result = JSON.parse(data);
                    console.log('🔍 DEBUG - Parsed result:', result);
                    
                    if (res.statusCode && res.statusCode >= 400) {
                        reject(new Error(`HTTP ${res.statusCode}: ${result.error || 'Erro desconhecido'}`));
                        return;
                    }
                    
                    if (!result.success) {
                        reject(new Error(result.error || 'API retornou success=false'));
                        return;
                    }
                    
                    resolve(result);
                } catch (jsonError: any) {
                    console.error('❌ JSON PARSE ERROR:', jsonError.message);
                    reject(new Error(`Resposta inválida do servidor: ${data.substring(0, 100)}`));
                }
            });
        });

        req.on('error', (error: any) => {
            console.error('❌ HTTPS REQUEST ERROR:', error.message, error.code);
            reject(new Error(`Erro de conexão: ${error.message}. Verifique se o servidor está online.`));
        });

        req.on('timeout', () => {
            console.error('❌ HTTPS REQUEST TIMEOUT');
            req.destroy();
            reject(new Error('Timeout na conexão com o servidor. Tente novamente.'));
        });

        req.write(postData);
        req.end();
    });
}

export async function POST(req: NextRequest) {
    console.log('🚀 [mailmarketing-send] Requisição recebida');
    try {
        const body = await req.json();
        console.log('🚀 [mailmarketing-send] Body:', JSON.stringify(body, null, 2));
        
        const { to, subject, content, sender, clientName, clientEmail, domain } = body;

        if (!to || !Array.isArray(to) || to.length === 0) {
            console.log('🚀 [mailmarketing-send] Erro: Lista vazia');
            return NextResponse.json({ error: 'Lista de destinatários vazia' }, { status: 400 });
        }

        if (!subject || !content) {
            return NextResponse.json({ error: 'Assunto e conteúdo são obrigatórios' }, { status: 400 });
        }

        // Determinar o domínio do cliente
        const clientDomain = domain || (clientEmail ? clientEmail.split('@')[1] : null);
        
        if (!clientDomain) {
            return NextResponse.json({ 
                error: 'Domínio não especificado. Envie o parâmetro "domain" ou "clientEmail".' 
            }, { status: 400 });
        }

        // 🚫 VERIFICAÇÃO DE LIMITE DESATIVADA
        // const warmupCheck = await canSendEmail(clientDomain, to.length);
        const warmupCheck = { 
            allowed: true, 
            dailyLimit: 999999, 
            remainingToday: 999999,
            reputation: { emailsSentToday: 0, dailyLimit: 999999 }
        };
        
        // if (!warmupCheck.allowed) {
        //     return NextResponse.json({ 
        //         error: warmupCheck.message,
        //         code: 'DAILY_LIMIT_EXCEEDED',
        //         details: {
        //             dailyLimit: warmupCheck.dailyLimit,
        //             sentToday: warmupCheck.reputation.emailsSentToday,
        //             remainingToday: warmupCheck.remainingToday
        //         }
        //     }, { status: 429 });
        // }

        // Configurar email de envio
        const fromEmail = sender || `marketing@${clientDomain}`;
        
        console.log(`🚀 CONFIGURAÇÃO ENVIO:`, {
            domain: clientDomain,
            from: fromEmail,
            dailyLimit: warmupCheck.dailyLimit,
            sending: to.length,
            remaining: warmupCheck.remainingToday
        });

        // 🚀 USAR DIRETAMENTE CYBERPANEL API
        console.log('🚀 [mailmarketing-send] Chamando sendViaCyberPanelAPI...');
        try {
            const result = await sendViaCyberPanelAPI(to, subject, content, fromEmail, clientDomain, warmupCheck);
            console.log('🚀 [mailmarketing-send] Resultado:', JSON.stringify(result, null, 2));
            return NextResponse.json(result);
        } catch (cpError: any) {
            console.error('❌ [mailmarketing-send] Erro CyberPanel:', cpError.message);
            return NextResponse.json({ 
                error: cpError.message || 'Erro ao enviar via CyberPanel',
                code: 'CYBERPANEL_ERROR'
            }, { status: 500 });
        }

    } catch (error: any) {
        console.error('❌ [mailmarketing-send] Erro geral:', error?.message, error?.stack);
        return NextResponse.json({ 
            error: error?.message || 'Erro interno no servidor',
            code: 'INTERNAL_ERROR',
            stack: error?.stack
        }, { status: 500 });
    }
}

/**
 * GET - Obter status de reputação do domínio
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const domain = searchParams.get('domain');
        
        if (!domain) {
            return NextResponse.json({ 
                error: 'Domínio não especificado. Use ?domain=exemplo.com' 
            }, { status: 400 });
        }

        const reputation = await getDomainReputation(domain);
        
        return NextResponse.json({
            success: true,
            domain,
            reputation: {
                dailyLimit: 200,
                emailsSentToday: 0,  // Sempre 0 - não persiste
                emailsSentTotal: 0,  // Sempre 0 - não persiste
                remainingToday: 200,  // Sempre 200 disponíveis
                sentToday: 0,
                sentTotal: 0,
                bounceRate: 0,
                complaintRate: 0,
                lastSendDate: new Date().toISOString()
            }
        });
        
    } catch (error: any) {
        console.error('Erro ao obter reputação:', error);
        return NextResponse.json({ 
            error: error.message || 'Erro ao obter reputação' 
        }, { status: 500 });
    }
}
