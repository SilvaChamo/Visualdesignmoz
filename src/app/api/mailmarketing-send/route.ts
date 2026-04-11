import { NextRequest, NextResponse } from 'next/server';
import * as nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';
import * as https from 'https';
import fetch from 'node-fetch';
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

// 🆕 FUNÇÃO: Enviar via CyberPanel PHP API (SMTP local)
async function sendViaCyberPanelAPI(
    to: string[], 
    subject: string, 
    content: string, 
    fromEmail: string,
    clientDomain: string,
    warmupCheck: any
) {
    console.log(`🔄 CYBERPANEL API: Enviando para ${to.length} destinatários`);
    
    try {
        console.log('🔍 DEBUG - URL:', CYBERPANEL_API_URL);
        console.log('🔍 DEBUG - From:', fromEmail);
        console.log('🔍 DEBUG - To count:', to.length);
        
        // Chamar API PHP no CyberPanel
        let response;
        try {
            response = await fetch(CYBERPANEL_API_URL, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${CYBERPANEL_API_TOKEN}`
                },
                body: JSON.stringify({
                    to: to.slice(0, 100),
                    subject,
                    html: content,
                    from: fromEmail,
                    fromName: ''
                }),
                // @ts-ignore
                agent: httpsAgent
            });
        } catch (fetchError: any) {
            console.error('❌ FETCH ERROR:', fetchError.message);
            throw new Error(`Erro de conexão: ${fetchError.message}. Verifique se o servidor está online.`);
        }
        
        console.log('🔍 DEBUG - Response status:', response.status);
        
        let result;
        try {
            result = await response.json();
        } catch (jsonError: any) {
            const text = await response.text();
            console.error('❌ JSON PARSE ERROR. Response text:', text.substring(0, 200));
            throw new Error(`Resposta inválida do servidor: ${text.substring(0, 100)}`);
        }
        
        console.log('🔍 DEBUG - Result:', result);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${result.error || 'Erro desconhecido'}`);
        }
        
        if (!result.success) {
            throw new Error(result.error || 'API retornou success=false');
        }
        
        console.log('✅ Envio via CyberPanel API:', result);
        
        // Atualizar contador
        await recordSuccessfulSends(clientDomain, result.details?.success || 0);
        
        return NextResponse.json({
            success: true,
            message: `Enviados ${result.details?.success || 0} emails via CyberPanel API`,
            details: result.details,
            method: 'cyberpanel-api',
            warmup: result.warmup,
            reputation: warmupCheck.reputation
        });
        
    } catch (error: any) {
        console.error('❌ CyberPanel API falhou:', error);
        const errorMsg = error.message || '';
        const isLimitError = errorMsg.toLowerCase().includes('limite') || 
                             errorMsg.toLowerCase().includes('limit') ||
                             errorMsg.toLowerCase().includes('daily');
        
        // ✅ Limite diário atingido - mensagem simples
        if (isLimitError) {
            return NextResponse.json({ 
                error: `Limite diário de ${warmupCheck.dailyLimit} emails atingido. Você já enviou ${warmupCheck.reputation.emailsSentToday} hoje.`,
                code: 'DAILY_LIMIT_EXCEEDED',
                details: {
                    dailyLimit: warmupCheck.dailyLimit,
                    sentToday: warmupCheck.reputation.emailsSentToday,
                    remainingToday: warmupCheck.remainingToday
                }
            }, { status: 429 });
        }
        
        // Erro genérico do CyberPanel
        return NextResponse.json({ 
            error: `Falha no envio: ${error.message}`,
            code: 'CYBERPANEL_FAILED',
            details: error.message,
            suggestion: 'Verifique a configuração do servidor de email'
        }, { status: 503 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const { to, subject, content, sender, clientName, clientEmail, domain } = await req.json();

        if (!to || !Array.isArray(to) || to.length === 0) {
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

        // 🚀 VERIFICAÇÃO DE LIMITE DIÁRIO (200 emails/dia - conta gratuita)
        const warmupCheck = await canSendEmail(clientDomain, to.length);
        
        if (!warmupCheck.allowed) {
            return NextResponse.json({ 
                error: warmupCheck.message,
                code: 'DAILY_LIMIT_EXCEEDED',
                details: {
                    dailyLimit: warmupCheck.dailyLimit,
                    sentToday: warmupCheck.reputation.emailsSentToday,
                    remainingToday: warmupCheck.remainingToday
                }
            }, { status: 429 });
        }

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
        console.log('🚀 Usando CyberPanel API diretamente...');
        return await sendViaCyberPanelAPI(to, subject, content, fromEmail, clientDomain, warmupCheck);

    } catch (error: any) {
        console.error('Erro na API de MailMarketing:', error);
        return NextResponse.json({ 
            error: error.message || 'Erro interno no servidor',
            code: 'INTERNAL_ERROR'
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
                emailsSentToday: reputation.emailsSentToday,
                emailsSentTotal: reputation.emailsSentTotal,
                remainingToday: 200 - reputation.emailsSentToday,
                bounceRate: reputation.bounceRate,
                complaintRate: reputation.complaintRate,
                lastSendDate: reputation.lastSendDate
            }
        });
        
    } catch (error: any) {
        console.error('Erro ao obter reputação:', error);
        return NextResponse.json({ 
            error: error.message || 'Erro ao obter reputação' 
        }, { status: 500 });
    }
}
