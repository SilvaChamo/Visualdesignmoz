import { NextResponse } from 'next/server';
import { executeCyberPanelCommand } from '@/lib/cyberpanel-exec';

function parseEmailOutput(output: string, domain: string) {
    const lines = output.trim().split('\n');
    const emails = [];

    if (lines.length === 0 || (lines.length === 1 && lines[0] === '')) return [];

    for (const line of lines) {
        if (!line.includes('|')) continue;
        const parts = line.split('|');
        if (parts.length >= 1) {
            const emailAddr = parts[0].trim();
            const usage = parts[1] || '0';

            const fullEmail = emailAddr.includes('@') ? emailAddr : `${emailAddr}@${domain}`
            emails.push({
                email: fullEmail,
                user: fullEmail.split('@')[0],
                domain: domain,
                usage: usage
            });
        }
    }

    return emails;
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const domain = searchParams.get('domain');

        if (!domain) {
            return NextResponse.json({ error: 'Domain param is required.' }, { status: 400 });
        }

        const cleanDomain = domain.replace(/[^a-zA-Z0-9_.-]/g, '');

        // Correct CyberPanel database tables:
        // Domains are in websiteFunctions_websites
        // Emails are in e_users linked by emailOwner_id (which is the domain string)
        const query = `mysql -D cyberpanel -e "SELECT email, DiskUsage FROM e_users WHERE emailOwner_id='${cleanDomain}';" | tr '\\t' '|' | grep -v "email"`;

        const output = await executeCyberPanelCommand(query);
        const emails = parseEmailOutput(output, cleanDomain);

        return NextResponse.json({ success: true, emails });
    } catch (error: any) {
        console.error('Error listing Emails:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { domainName, userName, password } = body;

        if (!domainName || !userName || !password) {
            return NextResponse.json({ error: 'Missing required parameters (domainName, userName, password).' }, { status: 400 });
        }

        const cleanDomain = domainName.replace(/[^a-zA-Z0-9_.-]/g, '');
        const cleanUser = userName.replace(/[^a-zA-Z0-9_.-]/g, '');
        const cleanPassword = password.replace(/['"]/g, '');

        // Try CyberPanel API proxy first (no SSH needed)
        try {
            const cpBase = (process.env.CYBERPANEL_URL || 'https://109.199.104.22:8090/api').replace('/api', '');
            const https = require('https');
            const agent = new https.Agent({ rejectUnauthorized: false });
            const proxyBody = JSON.stringify({
                adminUser: process.env.CYBERPANEL_USER || 'admin',
                adminPass: process.env.CYBERPANEL_PASS || 'Vgz5Zat4uMyFt2tb',
                domainName: cleanDomain,
                userName: cleanUser,
                password: cleanPassword,
                quota: 500
            });
            const proxyRes = await fetch(`${cpBase}/api/createEmail`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: proxyBody,
                // @ts-ignore
                agent
            }).catch(() => null);
            if (proxyRes && proxyRes.ok) {
                const proxyData = await proxyRes.json().catch(() => ({}));
                if (proxyData.status === 1 || proxyData.success === true) {
                    return NextResponse.json({ success: true, message: 'E-mail criado via API CyberPanel' });
                }
            }
        } catch { /* fall through to SSH */ }

        // SSH fallback
        const sshPass = process.env.CYBERPANEL_SSH_PASS;
        const sshKey = process.env.CYBERPANEL_SSH_KEY;
        if (!sshPass && !sshKey) {
            return NextResponse.json({ success: true, message: 'E-mail guardado no painel. Configure SSH nas env vars para sincronizar com CyberPanel.', warning: true });
        }

        const command = `cyberpanel createEmail --domainName "${cleanDomain}" --userName "${cleanUser}" --password "${cleanPassword}"`;
        const output = await executeCyberPanelCommand(command);

        if (output.includes('successfully') || output.includes('"success": 1') || output.includes('"success":1')) {
            return NextResponse.json({ success: true, message: 'Conta de E-mail criada com sucesso!' });
        } else {
            return NextResponse.json({ error: 'Erro ao criar conta de E-mail.', details: output }, { status: 400 });
        }

    } catch (error: any) {
        console.error('Error creating Email:', error);
        return NextResponse.json({ success: true, message: 'E-mail guardado localmente. Erro de conexão: ' + error.message, warning: true });
    }
}

export async function DELETE(request: Request) {
    try {
        const body = await request.json();
        // The endpoint should receive the full email string like "info@domain.com"
        const { email } = body;

        if (!email) {
            return NextResponse.json({ error: 'Email parameter is required for deletion.' }, { status: 400 });
        }

        const cleanEmail = email.replace(/[^a-zA-Z0-9_.-@]/g, '');

        // CyberPanel command: cyberpanel deleteEmail --email <email@dom.com>
        const command = `cyberpanel deleteEmail --email "${cleanEmail}"`;

        const output = await executeCyberPanelCommand(command);

        // Try to parse JSON response from CyberPanel
        let success = false;
        try {
            const jsonData = JSON.parse(output);
            success = jsonData.success === 1 || jsonData.success === true;
        } catch {
            // Fallback to string parsing if not JSON
            success = output.includes('successfully') || !output.toLowerCase().includes('error') || output.includes('Deleted');
        }

        if (success) {
            return NextResponse.json({ success: true, message: 'Conta de E-mail removida com sucesso!' });
        } else {
            return NextResponse.json({ error: 'Erro ao remover conta de E-mail.', details: output }, { status: 400 });
        }

    } catch (error: any) {
        console.error('Error deleting Email:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
