import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import https from 'https';
import { 
  canSendEmail, 
  recordSuccessfulSends, 
  recordBounce,
  getDomainReputation,
  getPhaseDisplay,
  getReputationRecommendations,
  advanceToNextPhase,
  WARMUP_LIMITS 
} from '@/lib/warmup-service';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

import { resend } from '@/lib/resend';

// 🆕 FUNÇÃO FALLBACK 1: Enviar via CyberPanel PHP API (SMTP local)
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
        // Chamar API PHP no CyberPanel
        const response = await fetch(CYBERPANEL_API_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CYBERPANEL_API_TOKEN}`
            },
            body: JSON.stringify({
                to: to.slice(0, 100), // Limitar a 100 por chamada
                subject,
                html: content,
                from: fromEmail,
                fromName: fromEmail.split('@')[0]
            }),
            // @ts-ignore - agent não está no tipo padrão mas funciona com node-fetch
            agent: httpsAgent
        });
        
        const result = await response.json();
        
        if (!response.ok || !result.success) {
            throw new Error(result.error || 'Falha na API CyberPanel');
        }
        
        console.log('✅ Envio via CyberPanel API:', result);
        
        // Atualizar reputação
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
        // 🆕 FALLBACK 2: Tentar Resend
        return await sendViaResend(to, subject, content, fromEmail, clientDomain, warmupCheck);
    }
}

// 🆕 FUNÇÃO FALLBACK 2: Enviar via Resend quando CyberPanel falhar
async function sendViaResend(
    to: string[], 
    subject: string, 
    content: string, 
    fromEmail: string,
    clientDomain: string,
    warmupCheck: any
) {
    console.log(`🔄 FALLBACK RESEND: Enviando para ${to.length} destinatários`);
    
    const results = {
        success: 0,
        failed: 0,
        errors: [] as string[]
    };
    
    try {
        // Resend Free: máximo 100/dia, limitar a 50 por chamada
        const limitedTo = to.slice(0, 50);
        
        for (const recipient of limitedTo) {
            try {
                const { data, error } = await resend.emails.send({
                    from: fromEmail || 'VisualDesign <noreply@visualdesigne.com>',
                    to: [recipient],
                    subject,
                    html: content,
                });
                
                if (error) {
                    console.error(`❌ Erro Resend para ${recipient}:`, error);
                    results.failed++;
                    results.errors.push(`${recipient}: ${error.message}`);
                } else {
                    console.log(`✅ Resend: Enviado para ${recipient}`, data?.id);
                    results.success++;
                }
            } catch (err: any) {
                console.error(`❌ Exceção Resend para ${recipient}:`, err.message);
                results.failed++;
                results.errors.push(`${recipient}: ${err.message}`);
            }
        }
        
        // Atualizar reputação
        await recordSuccessfulSends(clientDomain, results.success);
        
        return NextResponse.json({
            success: true,
            message: `Enviados ${results.success} emails via Resend (Free: 100/dia)`,
            details: results,
            method: 'resend',
            reputation: warmupCheck.reputation,
            limit: { plan: 'free', maxPerDay: 100 }
        });
        
    } catch (error: any) {
        console.error('❌ Fallback Resend falhou:', error);
        return NextResponse.json({ 
            error: 'Falha no envio via CyberPanel e Resend.',
            code: 'ALL_METHODS_FAILED',
            details: error.message
        }, { status: 503 });
    }
}

// Configuração da API CyberPanel
const CYBERPANEL_API_URL = 'https://109.199.104.22:8090/send-email-api.php';
const CYBERPANEL_API_TOKEN = 'vd_api_2024_secure_token';

// Agente HTTPS que ignora certificado inválido
const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
});

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

        // 🚀 VERIFICAÇÃO DE WARM-UP (SISTEMA FLEXÍVEL)
        // Verificar se cliente quer avançar fase automaticamente
        const advancePhase = req.headers.get('x-advance-phase') === 'true';
        const warmupCheck = await canSendEmail(clientDomain, to.length, { allowPhaseAdvance: advancePhase });
        
        if (!warmupCheck.allowed) {
            const phaseInfo = getPhaseDisplay(warmupCheck.reputation.currentPhase);
            
            // 🆕 NOVO: Se pode avançar de fase, oferece essa opção em vez de bloquear
            if (warmupCheck.canAdvancePhase && warmupCheck.nextPhaseInfo) {
                return NextResponse.json({ 
                    error: warmupCheck.message,
                    code: 'CAN_ADVANCE_PHASE',
                    canAdvancePhase: true,
                    excessCount: warmupCheck.excessCount,
                    options: {
                        stay: {
                            phase: warmupCheck.reputation.currentPhase,
                            limit: warmupCheck.dailyLimit,
                            remaining: warmupCheck.remainingToday,
                            description: phaseInfo.description
                        },
                        advance: {
                            phase: warmupCheck.nextPhaseInfo.phase,
                            limit: warmupCheck.nextPhaseInfo.limit,
                            description: warmupCheck.nextPhaseInfo.description,
                            excessEmails: warmupCheck.excessCount
                        }
                    },
                    message: `Você excedeu o limite desta fase em ${warmupCheck.excessCount} emails. Deseja avançar para a fase ${warmupCheck.nextPhaseInfo.phase} com limite de ${warmupCheck.nextPhaseInfo.limit} emails/dia?`
                }, { status: 429 });
            }
            
            // Bloqueio normal (reputação baixa ou outro problema)
            return NextResponse.json({ 
                error: warmupCheck.message,
                code: 'WARMUP_LIMIT_EXCEEDED',
                details: {
                    dailyLimit: warmupCheck.dailyLimit,
                    sentToday: warmupCheck.reputation.emailsSentToday,
                    remainingToday: warmupCheck.remainingToday,
                    phase: warmupCheck.reputation.currentPhase,
                    phaseLabel: phaseInfo.label,
                    phaseDescription: phaseInfo.description,
                    daysActive: warmupCheck.reputation.daysSinceFirstSend,
                    reputationScore: warmupCheck.reputation.reputationScore,
                    recommendations: getReputationRecommendations(warmupCheck.reputation)
                }
            }, { status: 429 });
        }

        // Configurar email de envio
        const fromEmail = sender || `marketing@${clientDomain}`;
        
        console.log(`� CONFIGURAÇÃO ENVIO:`, {
            domain: clientDomain,
            from: fromEmail,
            phase: warmupCheck.reputation.currentPhase,
            dailyLimit: warmupCheck.dailyLimit,
            sending: to.length,
            remaining: warmupCheck.remainingToday
        });

        // 🚀 USAR DIRETAMENTE CYBERPANEL API (MAIS FIÁVEL)
        // O SMTP direto foi desativado - usamos a API PHP do CyberPanel que está configurada
        console.log('🚀 Usando CyberPanel API diretamente (mais fiável)...');
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
        const phaseInfo = getPhaseDisplay(reputation.currentPhase);
        const recommendations = getReputationRecommendations(reputation);
        
        return NextResponse.json({
            success: true,
            domain,
            reputation: {
                phase: reputation.currentPhase,
                phaseLabel: phaseInfo.label,
                phaseDescription: phaseInfo.description,
                color: phaseInfo.color,
                dailyLimit: reputation.dailyLimit,
                sentToday: reputation.emailsSentToday,
                remainingToday: reputation.dailyLimit - reputation.emailsSentToday,
                sentTotal: reputation.emailsSentTotal,
                score: reputation.reputationScore,
                daysActive: reputation.daysSinceFirstSend,
                bounceRate: reputation.bounceRate,
                complaintRate: reputation.complaintRate
            },
            recommendations,
            nextPhase: reputation.daysSinceFirstSend < 30 ? {
                daysUntilNext: reputation.currentPhase === 'NEW' ? 2 : 
                              reputation.currentPhase === 'PHASE_1' ? 2 :
                              reputation.currentPhase === 'PHASE_2' ? 4 :
                              reputation.currentPhase === 'PHASE_3' ? 7 :
                              reputation.currentPhase === 'PHASE_4' ? 15 : 0,
                nextLimit: reputation.currentPhase === 'NEW' ? WARMUP_LIMITS.PHASE_1 :
                           reputation.currentPhase === 'PHASE_1' ? WARMUP_LIMITS.PHASE_2 :
                           reputation.currentPhase === 'PHASE_2' ? WARMUP_LIMITS.PHASE_3 :
                           reputation.currentPhase === 'PHASE_3' ? WARMUP_LIMITS.PHASE_4 :
                           reputation.currentPhase === 'PHASE_4' ? WARMUP_LIMITS.ESTABLISHED : null
            } : null
        });
        
    } catch (error: any) {
        console.error('Erro ao obter reputação:', error);
        return NextResponse.json({ 
            error: error.message || 'Erro ao obter reputação' 
        }, { status: 500 });
    }
}
