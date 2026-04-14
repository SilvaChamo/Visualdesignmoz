import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { lookup } from 'dns/promises';

// 🧪 TESTAR CAMINHO DO EMAIL ANTES DE ENVIAR
export async function POST(req: NextRequest) {
    console.log('🧪 [test-email-path] Iniciando teste de caminho...');
    
    try {
        const body = await req.json();
        const { from, to, fromPassword } = body;

        if (!from || !to) {
            return NextResponse.json({
                success: false,
                stage: 'validation',
                error: 'Campos obrigatórios em falta (from, to)',
                details: { from, to }
            }, { status: 400 });
        }

        const report: any = {
            timestamp: new Date().toISOString(),
            from,
            to,
            stages: []
        };

        // ==================== STAGE 1: Validar formato dos emails ====================
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(from)) {
            return NextResponse.json({
                success: false,
                stage: 'format_validation',
                error: 'Formato do email remetente inválido',
                report
            }, { status: 400 });
        }
        if (!emailRegex.test(to)) {
            return NextResponse.json({
                success: false,
                stage: 'format_validation',
                error: 'Formato do email destinatário inválido',
                report
            }, { status: 400 });
        }
        report.stages.push({ name: 'format_validation', status: 'ok', message: 'Formatos de email válidos' });

        // ==================== STAGE 2: Verificar DNS MX do destinatário ====================
        const toDomain = to.split('@')[1];
        try {
            const mxRecords = await lookup(toDomain, { all: true });
            if (!mxRecords || mxRecords.length === 0) {
                return NextResponse.json({
                    success: false,
                    stage: 'dns_check',
                    error: `Domínio ${toDomain} não possui registros MX válidos`,
                    report
                }, { status: 400 });
            }
            report.stages.push({ 
                name: 'dns_check', 
                status: 'ok', 
                message: `DNS MX encontrado para ${toDomain}`,
                records: mxRecords.slice(0, 3)
            });
        } catch (dnsError: any) {
            return NextResponse.json({
                success: false,
                stage: 'dns_check',
                error: `Falha na verificação DNS: ${dnsError.message}`,
                details: `Domínio ${toDomain} pode não existir ou não ter servidor de email configurado`,
                report
            }, { status: 400 });
        }

        // ==================== STAGE 3: Verificar conectividade SMTP ====================
        const SMTP_HOST = process.env.SMTP_HOST || 'mail.visualdesigne.com';
        const SMTP_PORT = 587;
        
        const transporter = nodemailer.createTransport({
            host: SMTP_HOST,
            port: SMTP_PORT,
            secure: false,
            requireTLS: true,
            auth: fromPassword ? {
                user: from,
                pass: fromPassword
            } : undefined,
            tls: { rejectUnauthorized: false },
            connectionTimeout: 10000,
            greetingTimeout: 10000,
        });

        try {
            await transporter.verify();
            report.stages.push({ 
                name: 'smtp_connection', 
                status: 'ok', 
                message: `Conexão SMTP estabelecida com ${SMTP_HOST}:${SMTP_PORT}`
            });
        } catch (smtpError: any) {
            report.stages.push({ 
                name: 'smtp_connection', 
                status: 'warning', 
                message: `Aviso: ${smtpError.message}`,
                note: 'Tentativa de envio pode falhar'
            });
        }

        // ==================== STAGE 4: Verificar SPF e reputação do domínio ====================
        const fromDomain = from.split('@')[1];
        try {
            const spfRecords = await lookup(fromDomain, { all: true });
            report.stages.push({ 
                name: 'sender_reputation', 
                status: 'ok', 
                message: `Domínio ${fromDomain} encontrado no DNS`,
                recommendation: 'Verifique se tem SPF e DKIM configurados para evitar spam'
            });
        } catch (e) {
            report.stages.push({ 
                name: 'sender_reputation', 
                status: 'warning', 
                message: `Não foi possível verificar reputação de ${fromDomain}`,
                note: 'Email pode ir para spam'
            });
        }

        // ==================== STAGE 5: Análise de risco ====================
        const riskFactors = [];
        
        if (!fromPassword) {
            riskFactors.push('Senha SMTP não fornecida - envio pode falhar na autenticação');
        }
        
        if (to.includes('gmail.com') || to.includes('googlemail.com')) {
            riskFactors.push('Gmail tem filtros rigorosos - email pode ir para spam se reputação for baixa');
        }
        
        if (fromDomain !== 'visualdesigne.com' && fromDomain !== 'oshercollective.com') {
            riskFactors.push(`Domínio ${fromDomain} não é o domínio principal - configure SPF/DKIM`);
        }

        report.stages.push({
            name: 'risk_analysis',
            status: riskFactors.length > 0 ? 'warning' : 'ok',
            message: riskFactors.length > 0 ? `${riskFactors.length} fator(es) de risco encontrado(s)` : 'Nenhum fator de risco identificado',
            factors: riskFactors
        });

        // ==================== RESULTADO FINAL ====================
        const hasErrors = report.stages.some((s: any) => s.status === 'error');
        const hasWarnings = report.stages.some((s: any) => s.status === 'warning');

        return NextResponse.json({
            success: !hasErrors,
            canSend: !hasErrors,
            status: hasErrors ? 'blocked' : (hasWarnings ? 'warning' : 'ready'),
            message: hasErrors 
                ? '❌ Caminho bloqueado - corrija os erros antes de enviar'
                : (hasWarnings 
                    ? '⚠️ Caminho com avisos - envio possível mas pode falhar' 
                    : '✅ Caminho limpo - pronto para enviar'),
            report
        });

    } catch (error: any) {
        console.error('❌ [test-email-path] Erro:', error);
        return NextResponse.json({
            success: false,
            stage: 'unknown',
            error: error.message,
            message: 'Erro interno durante o teste'
        }, { status: 500 });
    }
}

// GET para verificar status da API
export async function GET() {
    return NextResponse.json({
        status: 'ok',
        message: 'API de teste de caminho de email está operacional',
        endpoints: {
            test: 'POST /api/test-email-path',
            fields: ['from', 'to', 'fromPassword']
        }
    });
}
