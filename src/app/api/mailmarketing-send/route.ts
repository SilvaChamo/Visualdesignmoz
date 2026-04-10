import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';
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

// Configuração do CyberPanel SMTP Master
const CYBERPANEL_HOST = process.env.SMTP_HOST || '109.199.104.22';
const CYBERPANEL_PORT = Number(process.env.SMTP_PORT || 465);
const CYBERPANEL_SECURE = true;

// 🚀 CREDENCIAIS CYBERPANEL (configuradas)
const CYBERPANEL_MASTER_EMAIL = process.env.SMTP_MASTER_EMAIL || 'admin@visualdesigne.com';
const CYBERPANEL_MASTER_PASSWORD = process.env.SMTP_MASTER_PASSWORD || 'EmailAdmin#2425';

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

        // Buscar conta de email de marketing do cliente no banco de dados
        // Procura por email que comece com 'marketing@' e seja do tipo 'mailbox'
        const { data: emailConta, error: contaError } = await supabaseAdmin
            .from('email_contas')
            .select('*')
            .eq('domain', clientDomain)
            .eq('tipo_conta', 'mailbox')
            .ilike('email', 'marketing@%')
            .single();

        let smtpUser: string;
        let smtpPass: string;
        let fromEmail: string;
        let replyToEmail: string;

        if (emailConta && emailConta.password_smtp) {
            // Usar conta dedicada do cliente
            smtpUser = emailConta.email;
            smtpPass = Buffer.from(emailConta.password_smtp, 'base64').toString('utf8');
            fromEmail = emailConta.email;
            replyToEmail = clientEmail || emailConta.email;
            
            console.log(`📧 Usando conta dedicada: ${smtpUser}`);
        } else {
            // Fallback: Usar conta master do CyberPanel com envelope personalizado
            console.log(`⚠️ Conta de marketing não encontrada para ${clientDomain}, usando fallback`);
            
            smtpUser = CYBERPANEL_MASTER_EMAIL;
            smtpPass = CYBERPANEL_MASTER_PASSWORD;
            fromEmail = `marketing@${clientDomain}`;
            replyToEmail = clientEmail || `geral@${clientDomain}`;
            
            console.log(`🔍 Fallback SMTP (CyberPanel):`, {
                user: smtpUser,
                host: CYBERPANEL_HOST,
                port: CYBERPANEL_PORT,
                secure: CYBERPANEL_SECURE,
                hasPassword: !!smtpPass
            });
        }
        
        // � Verificação de credenciais
        console.log(`📧 Configuração final SMTP:`, {
            smtpUser,
            host: CYBERPANEL_HOST,
            port: CYBERPANEL_PORT,
            fromEmail,
            replyToEmail
        });

        const safeClientName = (clientName || '').toString().trim();
        const safeClientEmail = (clientEmail || '').toString().trim();
        const safeSender = (sender || '').toString().trim();

        console.log(`🚀 CONFIGURAÇÃO SMTP CYBERPANEL:`, {
            host: CYBERPANEL_HOST,
            port: CYBERPANEL_PORT,
            domain: clientDomain,
            phase: warmupCheck.reputation.currentPhase,
            dailyLimit: warmupCheck.dailyLimit,
            sending: to.length,
            remaining: warmupCheck.remainingToday
        });

        // Configurar transporter CyberPanel
        const transporter = nodemailer.createTransport({
            host: CYBERPANEL_HOST,
            port: CYBERPANEL_PORT,
            secure: CYBERPANEL_SECURE,
            auth: {
                user: smtpUser,
                pass: smtpPass
            },
            tls: { 
                rejectUnauthorized: false,
                servername: CYBERPANEL_HOST
            },
            connectionTimeout: 30000,
            socketTimeout: 30000,
            greetingTimeout: 30000
        });

        // Testar conexão
        try {
            console.log('🔍 Testando conexão SMTP:', {
                host: CYBERPANEL_HOST,
                port: CYBERPANEL_PORT,
                user: smtpUser,
                hasPassword: !!smtpPass
            });
            await transporter.verify();
            console.log('✅ Conexão CyberPanel SMTP verificada');
        } catch (verifyError: any) {
            console.error('❌ Falha na verificação SMTP:', verifyError.message);
            console.error('🔍 Detalhes do erro:', {
                code: verifyError.code,
                command: verifyError.command,
                responseCode: verifyError.responseCode,
                host: CYBERPANEL_HOST,
                port: CYBERPANEL_PORT,
                user: smtpUser
            });
            return NextResponse.json({ 
                error: 'Falha na conexão com servidor de email. Tente novamente em alguns instantes.',
                details: process.env.NODE_ENV === 'development' ? verifyError.message : undefined
            }, { status: 503 });
        }

        console.log(`📤 Iniciando envio para ${to.length} contactos via CyberPanel (${clientDomain})...`);
        console.log(`📊 Status Warm-up: ${warmupCheck.reputation.currentPhase} | Limite: ${warmupCheck.dailyLimit}/dia | Enviando: ${to.length}`);

        // Envio individual para evitar que um e-mail inválido bloqueie todos
        const results = {
            success: 0,
            failed: 0,
            errors: [] as string[]
        };
        
        const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const LIKELY_TYPO_DOMAINS = new Set(['gail.com', 'gmial.com', 'gmai.com', 'hotnail.com', 'yaho.com']);

        // Processamento em LOTES (Batches) para velocidade e segurança
        // Warm-up: lotes menores para novos domínios
        const getBatchSize = (phase: string) => {
            if (phase === 'NEW') return 5;
            if (phase === 'PHASE_1') return 8;
            if (phase === 'PHASE_2') return 10;
            return 15; // PHASE_3, PHASE_4, ESTABLISHED
        };
        
        const BATCH_SIZE = getBatchSize(warmupCheck.reputation.currentPhase);
        
        // Delay entre lotes para aquecimento gradual
        const getBatchDelay = (phase: string) => {
            if (phase === 'NEW') return 2000; // 2s entre lotes
            if (phase === 'PHASE_1') return 1500;
            if (phase === 'PHASE_2') return 1000;
            return 500; // 0.5s para domínios estabelecidos
        };

        for (let i = 0; i < to.length; i += BATCH_SIZE) {
            const batch = to.slice(i, i + BATCH_SIZE);
            const batchNum = Math.floor(i / BATCH_SIZE) + 1;
            const totalBatches = Math.ceil(to.length / BATCH_SIZE);
            
            console.log(`📦 Lote ${batchNum}/${totalBatches}: ${batch.length} emails`);
            
            await Promise.all(batch.map(async (email: string) => {
                try {
                    const normalizedEmail = (email || '').toString().trim().toLowerCase();
                    if (!EMAIL_REGEX.test(normalizedEmail)) {
                        results.failed++;
                        results.errors.push(`${normalizedEmail || 'destinatario_vazio'}: formato de email invalido`);
                        await recordBounce(clientDomain);
                        return;
                    }
                    
                    const domainPart = normalizedEmail.split('@')[1] || '';
                    if (LIKELY_TYPO_DOMAINS.has(domainPart)) {
                        results.failed++;
                        results.errors.push(`${normalizedEmail}: dominio parece incorreto (${domainPart})`);
                        await recordBounce(clientDomain);
                        return;
                    }

                    // Remetente personalizado do cliente
                    const personalizedSender = safeSender || 
                        (safeClientEmail ? `"${safeClientName || safeClientEmail}" <${safeClientEmail}>` : fromEmail);

                    // Configuração de envelope para entrega profissional
                    // O "from" visível usa o domínio do cliente, mas o envelope SMTP usa a conta autenticada
                    const visibleFrom = safeClientName 
                        ? `"${safeClientName}" <${fromEmail}>` 
                        : fromEmail;

                    const info = await transporter.sendMail({
                        from: visibleFrom,
                        replyTo: replyToEmail,
                        to: normalizedEmail,
                        subject: subject,
                        html: content,
                        headers: {
                            'X-Mailer': 'VisualDesign Email Marketing',
                            'X-Domain': clientDomain,
                            'X-Campaign-Type': 'marketing'
                        }
                    });

                    const accepted = (info.accepted || []).map(String).map((v: string) => v.toLowerCase());
                    const rejected = (info.rejected || []).map(String).map((v: string) => v.toLowerCase());
                    const acceptedCurrent = accepted.includes(normalizedEmail) || (accepted.length > 0 && rejected.length === 0);

                    if (acceptedCurrent) {
                        results.success++;
                        console.log(`✅ Email aceite: ${normalizedEmail}`);
                    } else {
                        results.failed++;
                        results.errors.push(`${normalizedEmail}: rejeitado pelo SMTP`);
                        await recordBounce(clientDomain);
                        console.error(`❌ SMTP rejeitou ${normalizedEmail}`, { accepted, rejected, response: info.response });
                    }
                } catch (err: any) {
                    console.error(`❌ Falha ao enviar para ${email}:`, err.message);
                    results.failed++;
                    results.errors.push(`${email}: ${err.message}`);
                    await recordBounce(clientDomain);
                }
            }));
            
            // Delay entre lotes (warm-up)
            if (i + BATCH_SIZE < to.length) {
                const delay = getBatchDelay(warmupCheck.reputation.currentPhase);
                console.log(`⏱️ Aguardando ${delay}ms antes do próximo lote...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        // 📝 Registrar envios bem-sucedidos no sistema de warm-up
        if (results.success > 0) {
            await recordSuccessfulSends(clientDomain, results.success);
        }

        // 📊 Retornar resultado com informações de warm-up
        const updatedReputation = await getDomainReputation(clientDomain);
        const phaseInfo = getPhaseDisplay(updatedReputation.currentPhase);

        if (results.success === 0) {
            return NextResponse.json({
                error: 'Nenhum email foi entregue.',
                code: 'ALL_FAILED',
                details: {
                    ...results,
                    domain: clientDomain,
                    reputation: {
                        phase: updatedReputation.currentPhase,
                        phaseLabel: phaseInfo.label,
                        dailyLimit: updatedReputation.dailyLimit,
                        sentToday: updatedReputation.emailsSentToday,
                        remainingToday: updatedReputation.dailyLimit - updatedReputation.emailsSentToday,
                        score: updatedReputation.reputationScore
                    }
                }
            }, { status: 500 });
        }

        return NextResponse.json({ 
            success: true, 
            message: `Processamento concluído: ${results.success} enviados, ${results.failed} falhas.`,
            details: {
                ...results,
                domain: clientDomain,
                reputation: {
                    phase: updatedReputation.currentPhase,
                    phaseLabel: phaseInfo.label,
                    phaseDescription: phaseInfo.description,
                    dailyLimit: updatedReputation.dailyLimit,
                sentToday: updatedReputation.emailsSentToday,
                remainingToday: updatedReputation.dailyLimit - updatedReputation.emailsSentToday,
                    score: updatedReputation.reputationScore,
                    daysActive: updatedReputation.daysSinceFirstSend,
                    recommendations: getReputationRecommendations(updatedReputation)
                }
            }
        });

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
