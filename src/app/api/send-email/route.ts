import { NextRequest, NextResponse } from 'next/server';
import * as https from 'https';

// 🚀 CYBERPANEL API - Servidor já tem as credenciais configuradas
// Não precisamos de senha - o servidor resolve internamente
const CYBERPANEL_API_URL = 'https://109.199.104.22:8090/send-email-api.php';
const CYBERPANEL_API_TOKEN = 'vd_api_2024_secure_token';

// 🆕 FUNÇÃO: Enviar via CyberPanel PHP API (SMTP local) - SEM necessidade de senha
async function sendViaCyberPanelAPI(
    to: string | string[], 
    subject: string, 
    html: string, 
    fromEmail: string
): Promise<any> {
    console.log(`🔄 CYBERPANEL API: Enviando email de ${fromEmail} para ${Array.isArray(to) ? to.length : 1} destinatário(s)`);
    
    // Normalizar 'to' para array
    const toArray = Array.isArray(to) ? to : [to];
    
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            to: toArray.slice(0, 100),
            subject,
            html,
            from: fromEmail,
            fromName: ''
        });

        console.log('🔍 DEBUG - URL:', CYBERPANEL_API_URL);
        console.log('🔍 DEBUG - From:', fromEmail);
        console.log('🔍 DEBUG - To:', toArray);

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

// 🆕 FUNÇÃO: Guardar email na pasta Sent via IMAP (fire and forget)
async function saveToSentFolder(
    from: string,
    password: string,
    to: string | string[],
    subject: string,
    html: string
): Promise<void> {
    if (!password) {
        console.log('⚠️ Sem senha IMAP, não é possível guardar na pasta Sent');
        return;
    }
    
    try {
        console.log('📁 [IMAP] A guardar email na pasta Sent...');
        const { ImapFlow } = await import('imapflow');
        
        const imapClient = new ImapFlow({
            host: 'mail.visualdesigne.com',
            port: 993,
            secure: true,
            auth: { user: from, pass: password },
            tls: { rejectUnauthorized: false },
            logger: false
        });

        await imapClient.connect();
        
        // Tentar diferentes nomes de pasta Sent
        const sentFolders = ['INBOX.Sent', 'Sent', '.Sent', 'Enviados', 'INBOX.Sent Items'];
        
        const toArray = Array.isArray(to) ? to : [to];
        const toStr = toArray.join(', ');
        const messageId = `<${Date.now()}.${Math.random().toString(36).substring(2)}@visualdesigne.com>`;
        const dateStr = new Date().toUTCString();
        
        // Construir mensagem RFC822 completa
        const fullMessage = `From: ${from}\r\n` +
            `To: ${toStr}\r\n` +
            `Subject: ${subject}\r\n` +
            `Message-ID: ${messageId}\r\n` +
            `Date: ${dateStr}\r\n` +
            `MIME-Version: 1.0\r\n` +
            `Content-Type: text/html; charset=utf-8\r\n` +
            `\r\n` +
            `${html || ''}`;

        let saved = false;
        for (const folder of sentFolders) {
            try {
                await imapClient.append(folder, fullMessage, ['\\Seen']);
                console.log(`✅ [IMAP] Email guardado na pasta: ${folder}`);
                saved = true;
                break;
            } catch (e: any) {
                console.log(`⚠️ [IMAP] Pasta ${folder} falhou:`, e.message);
                continue;
            }
        }

        if (!saved) {
            console.warn('⚠️ [IMAP] Não foi possível guardar em nenhuma pasta Sent conhecida');
        }
        
        await imapClient.logout();
        
    } catch (error: any) {
        console.error('❌ [IMAP] Erro ao guardar na pasta Sent:', error.message);
        // Não propagar erro - é fire and forget
    }
}

export async function POST(req: NextRequest) {
    console.log('🚀 [send-email] Requisição recebida');
    try {
        const body = await req.json();
        console.log('🚀 [send-email] Body:', JSON.stringify(body, null, 2));
        
        const { from, to, cc, bcc, subject, html, replyTo, fromPassword } = body;

        // Validações básicas
        if (!from || !to || !subject) {
            console.log('🚀 [send-email] Erro: Campos obrigatórios em falta');
            return NextResponse.json({ 
                error: 'Campos obrigatórios em falta (from, to, subject)' 
            }, { status: 400 });
        }

        // 🎯 Enviar via CyberPanel API - NÃO precisa de senha para enviar!
        try {
            console.log('📧 Enviando via CyberPanel API (sem senha)...');
            const result = await sendViaCyberPanelAPI(to, subject, html || '', from);
            
            const messageId = `cp-${Date.now()}`;
            console.log('✅ Email enviado com sucesso via CyberPanel API, ID:', messageId);
            
            // 🚀 FIRE AND FORGET: Guardar na pasta Sent via IMAP (não bloqueia resposta)
            if (fromPassword) {
                (async () => {
                    try {
                        await saveToSentFolder(from, fromPassword, to, subject, html || '');
                    } catch (e) {
                        console.error('❌ [Background] Erro ao guardar Sent:', e);
                    }
                })().catch(err => console.error('❌ [Background] IMAP error:', err));
            } else {
                console.log('ℹ️ Sem senha IMAP fornecida, email não será guardado na pasta Sent');
            }
            
            return NextResponse.json({ 
                success: true, 
                messageId: messageId,
                provider: 'cyberpanel-api',
                savedToSent: !!fromPassword
            });
            
        } catch (apiError: any) {
            console.error('❌ CyberPanel API falhou:', apiError.message);
            return NextResponse.json({ 
                success: false, 
                error: apiError.message 
            }, { status: 500 });
        }
        
    } catch (error: any) {
        console.error('❌ [send-email] Erro:', error);
        return NextResponse.json({ 
            success: false,
            error: error.message 
        }, { status: 500 });
    }
}
