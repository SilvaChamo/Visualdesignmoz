#!/usr/bin/env node
/**
 * Script de Warm-up de Emails
 * Envia emails de teste para aquecer o domínio antes de entregar ao cliente
 * 
 * Uso: node scripts/warmup-emails.js [dominio] [quantidade]
 * Exemplo: node scripts/warmup-emails.js oshercollective.com 10
 */

const API_URL = 'https://109.199.104.22:8090/send-email-api.php';
const API_TOKEN = 'vd_api_2024_secure_token';

// Lista de emails de teste para warm-up
const TEST_EMAILS = [
    'silva.chamo@gmail.com',
    'test1@mailinator.com',
    'test2@mailinator.com', 
    'test3@mailinator.com',
    'test4@mailinator.com',
    'test5@mailinator.com',
    'warmup1@yopmail.com',
    'warmup2@yopmail.com',
    'warmup3@yopmail.com',
    'warmup4@yopmail.com'
];

// Templates de emails para warm-up
const TEMPLATES = [
    {
        subject: 'Bem-vindo à nossa newsletter',
        html: `<h1>Bem-vindo!</h1><p>Obrigado por se juntar à nossa comunidade. Estamos empolgados por ter você conosco!</p><p>Atenciosamente,<br>Equipa Osher Collective</p>`
    },
    {
        subject: 'Novidades da semana',
        html: `<h1>Novidades</h1><p>Confira as últimas atualizações e novidades da nossa plataforma.</p><p>Atenciosamente,<br>Equipa Osher Collective</p>`
    },
    {
        subject: 'Dicas exclusivas para você',
        html: `<h1>Dicas Exclusivas</h1><p>Preparamos conteúdo especial para ajudar no seu dia a dia.</p><p>Atenciosamente,<br>Equipa Osher Collective</p>`
    },
    {
        subject: 'Atualização importante',
        html: `<h1>Atualização</h1><p>Temos novidades importantes para partilhar consigo.</p><p>Atenciosamente,<br>Equipa Osher Collective</p>`
    },
    {
        subject: 'Agradecimento pela preferência',
        html: `<h1>Obrigado!</h1><p>Agradecemos a sua confiança e preferência pelos nossos serviços.</p><p>Atenciosamente,<br>Equipa Osher Collective</p>`
    }
];

const { execSync } = require('child_process');

async function sendEmail(to, subject, html, from) {
    try {
        const payload = JSON.stringify({
            to: [to],
            subject,
            html,
            from,
            fromName: from.split('@')[0]
        });
        
        const cmd = `curl -s -X POST "${API_URL}" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer ${API_TOKEN}" \
            -k \
            -d '${payload.replace(/'/g, "'\"'\"'")}'`;
        
        const output = execSync(cmd, { encoding: 'utf8', timeout: 30000 });
        const result = JSON.parse(output);
        return result;
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runWarmup() {
    const domain = process.argv[2] || 'oshercollective.com';
    const count = parseInt(process.argv[3]) || 10;
    const fromEmail = `geral@${domain}`;
    
    console.log(`\n🚀 INICIANDO WARM-UP PARA: ${domain}`);
    console.log(`📧 Quantidade: ${count} emails`);
    console.log(`⏱️  Início: ${new Date().toLocaleString()}\n`);
    
    let success = 0;
    let failed = 0;
    
    for (let i = 0; i < count; i++) {
        const email = TEST_EMAILS[i % TEST_EMAILS.length];
        const template = TEMPLATES[i % TEMPLATES.length];
        
        console.log(`[${i + 1}/${count}] Enviando para ${email}...`);
        
        const result = await sendEmail(email, template.subject, template.html, fromEmail);
        
        if (result.success) {
            success++;
            console.log(`  ✅ Sucesso - Fase: ${result.warmup?.phase || 'unknown'}`);
        } else {
            failed++;
            console.log(`  ❌ Falha: ${result.error || result.message}`);
        }
        
        // Delay entre emails (2-5 segundos)
        if (i < count - 1) {
            const delay = 2000 + Math.random() * 3000;
            console.log(`  ⏱️  Aguardando ${Math.round(delay/1000)}s...`);
            await sleep(delay);
        }
    }
    
    console.log(`\n✅ WARM-UP CONCLUÍDO!`);
    console.log(`📊 Resultados:`);
    console.log(`   Sucesso: ${success}`);
    console.log(`   Falhas: ${failed}`);
    console.log(`   Total: ${count}`);
    console.log(`\n⏱️  Fim: ${new Date().toLocaleString()}\n`);
    
    // Verificar status
    console.log('📊 Verificando status do warm-up...');
    try {
        const checkResponse = await fetch(`${API_URL}?domain=${domain}`, {
            headers: { 'Authorization': `Bearer ${API_TOKEN}` }
        });
        const status = await checkResponse.json();
        if (status.success && status.reputation) {
            console.log(`   Fase atual: ${status.reputation.currentPhase}`);
            console.log(`   Emails enviados hoje: ${status.reputation.emailsSentToday}`);
            console.log(`   Limite diário: ${status.reputation.dailyLimit}`);
            console.log(`   Reputação: ${status.reputation.reputationScore}/100`);
        }
    } catch (e) {
        console.log('   Não foi possível verificar status');
    }
}

// Verificar se fetch está disponível (Node 18+)
if (typeof fetch === 'undefined') {
    console.error('❌ Node.js 18+ necessário para este script');
    console.error('   Instale: npm install node-fetch e modifique o script');
    process.exit(1);
}

runWarmup().catch(console.error);
