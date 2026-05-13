import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import https from 'https';
import { getServerHost, getHestiaUrl } from '@/lib/server-config'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Configuração da API CyberPanel
const CYBERPANEL_API_URL = '${getHestiaUrl()}/send-email-api.php';
const CYBERPANEL_API_TOKEN = 'vd_api_2024_secure_token';

// Agente HTTPS que ignora certificado inválido
const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
});

// Pausa entre chunks
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function POST(req: Request) {
    try {
        const { to, subject, html, replyTo, attachments, targetAudiences } = await req.json();

        // 1. Validação básica
        if (!to || !Array.isArray(to) || to.length === 0) {
            return NextResponse.json({ error: 'Recipientes em falta' }, { status: 400 });
        }
        if (!subject || !html) {
            return NextResponse.json({ error: 'Assunto ou conteúdo em falta' }, { status: 400 });
        }

        const senderEmail = replyTo || process.env.SMTP_MASTER_EMAIL || 'admin@visualdesignmoz.com';
        const campaignSenderKey = `admin:${senderEmail.toLowerCase()}`;
        
        // Extrair domínio do email do remetente
        const clientDomain = senderEmail.split('@')[1] || 'visualdesignmoz.com';

        // 3. Criar registo de campanha na base de dados
        let campaignId: string | null = null;

        try {
            const { data: msgData } = await supabaseAdmin
                .from('messages')
                .insert({
                    subject,
                    content: html,
                    sender_email: senderEmail,
                    target_roles: targetAudiences || ['newsletter_subscribers'],
                })
                .select('id')
                .single();

            const { data: campaign } = await supabaseAdmin
                .from('email_campaigns')
                .insert({
                    subject,
                    content: html,
                    sender_email: campaignSenderKey,
                    target_audiences: (targetAudiences || []).join(', '),
                    recipient_count: to.length,
                    status: 'enviando',
                    sent_at: null
                })
                .select('id')
                .single();

            if (campaign) campaignId = campaign.id;
        } catch (e) {
            console.error("Erro ao criar registo de campanha:", e);
        }

        // 4. Enviar via CyberPanel API (que funciona!)
        const CHUNK_SIZE = 10; // Limitado pela API
        let totalSent = 0;
        let totalFailed = 0;
        let errors: string[] = [];
        
        for (let i = 0; i < to.length; i += CHUNK_SIZE) {
            const chunk = to.slice(i, i + CHUNK_SIZE);
            
            try {
                const response = await fetch(CYBERPANEL_API_URL, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${CYBERPANEL_API_TOKEN}`
                    },
                    body: JSON.stringify({
                        to: chunk,
                        subject,
                        html,
                        from: senderEmail,
                        fromName: ''  // Deixar vazio para evitar duplicação
                    }),
                    // @ts-ignore
                    agent: httpsAgent
                });
                
                const result = await response.json();
                
                if (result.success) {
                    totalSent += result.details?.success || chunk.length;
                    totalFailed += result.details?.failed || 0;
                    if (result.details?.errors) {
                        errors.push(...result.details.errors);
                    }
                    console.log(`✅ Chunk ${Math.floor(i/CHUNK_SIZE) + 1} enviado: ${result.details?.success || chunk.length} emails`);
                } else {
                    totalFailed += chunk.length;
                    errors.push(result.error || 'Falha na API');
                    console.error(`❌ Chunk ${Math.floor(i/CHUNK_SIZE) + 1} falhou:`, result.error);
                }
                
            } catch (error: any) {
                totalFailed += chunk.length;
                errors.push(error.message);
                console.error(`❌ Erro no chunk ${Math.floor(i/CHUNK_SIZE) + 1}:`, error.message);
            }
            
            // Pausa entre chunks
            if (i + CHUNK_SIZE < to.length) {
                await sleep(1000);
            }
        }

        // 6. Actualizar campanha com resultados reais
        if (campaignId) {
            try {
                await supabaseAdmin
                    .from('email_campaigns')
                    .update({
                        status: totalFailed === to.length ? 'failed' : totalFailed > 0 ? 'partial' : 'sent',
                        sent_at: new Date().toISOString(),
                        recipient_count: totalSent
                    })
                    .eq('id', campaignId);
            } catch (e) {
                console.error("Erro ao actualizar campanha:", e);
            }
        }

        // 7. Resposta ao cliente
        if (totalFailed === to.length) {
            return NextResponse.json({ 
                error: errors[0] || 'Falha total no envio',
                details: { success: 0, failed: totalFailed, errors }
            }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            campaignId,
            provider: 'directadmin-hosting-api',
            details: {
                success: totalSent,
                failed: totalFailed,
                errors: errors.length > 0 ? errors : undefined
            },
            stats: {
                total: to.length,
                sent: totalSent,
                failed: totalFailed
            }
        });

    } catch (error: any) {
        console.error("Erro na API de envio:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
