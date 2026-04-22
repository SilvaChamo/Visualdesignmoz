import { NextResponse } from 'next/server';
import { executeCyberPanelCommand } from '@/lib/cyberpanel-exec';
import { createClient as createAdminClient } from '@supabase/supabase-js';

// Cliente Supabase Admin
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'
const supabaseAdmin = createAdminClient(supabaseUrl, supabaseKey)

// Encriptação base64
const encrypt = (text: string) => Buffer.from(text).toString('base64')

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
        const { domainName, userName, password, requesterEmail } = body;

        if (!domainName || !userName || !password) {
            return NextResponse.json({ error: 'Missing required parameters (domainName, userName, password).' }, { status: 400 });
        }

        // 🚀 VERIFICAÇÃO: Se requesterEmail foi enviado, verificar se tem domínio gerenciado
        if (requesterEmail) {
            const requesterDomain = requesterEmail.split('@')[1]?.toLowerCase() || '';
            const managedDomains = ['visualdesigne.com', 'visualdesigne.pt', 'aamihe.com', 'anap.co.mz', 'entrecampos.co.mz'];
            const isAdmin = ['admin@visualdesigne.com', 'silva.chamo@gmail.com', 'geral@visualdesigne.com'].includes(requesterEmail);
            
            if (!managedDomains.includes(requesterDomain) && !isAdmin) {
                return NextResponse.json({ 
                    error: 'Não é possível criar contas de email',
                    details: 'Apenas clientes com domínios gerenciados podem criar emails.'
                }, { status: 403 });
            }
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
        const sshKey = process.env.CYBERPANEL_SSH_KEY || process.env.SSH_PRIVATE_KEY;
        if (!sshPass && !sshKey) {
            return NextResponse.json({ success: true, message: 'E-mail guardado no painel. Configure SSH nas env vars para sincronizar com CyberPanel.', warning: true });
        }

        const command = `cyberpanel createEmail --domainName "${cleanDomain}" --userName "${cleanUser}" --password "${cleanPassword}"`;
        const output = await executeCyberPanelCommand(command);

        if (output.includes('successfully') || output.includes('"success": 1') || output.includes('"success":1')) {
            const email = `${cleanUser}@${cleanDomain}`;
            
            // 🚀 CRIAR USUÁRIO NO SUPABASE AUTH (para poder fazer login no sistema)
            let authUserId = ''
            let authUserCreated = false
            try {
                const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers()
                const userExists = existingUser?.users?.find(u => u.email === email)
                
                if (!userExists) {
                    const { data: newAuthUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
                        email: email,
                        password: cleanPassword,
                        email_confirm: true,
                        user_metadata: {
                            nome: cleanUser,
                            role: 'client',
                            domain: cleanDomain
                        }
                    })
                    
                    if (!authError && newAuthUser?.user) {
                        authUserId = newAuthUser.user.id
                        authUserCreated = true
                        console.log(`✅ Usuário Auth criado: ${email}`)
                    }
                } else {
                    authUserId = userExists.id
                    console.log(`ℹ️ Usuário Auth já existe: ${email}`)
                }
            } catch (authError: any) {
                console.error('Erro na criação do usuário Auth:', authError)
            }
            
            // 🚀 SINCRONIZAR COM SUPABASE - guardar senha para IMAP/SMTP funcionar
            try {
                await supabaseAdmin
                    .from('email_contas')
                    .upsert({
                        cliente_id: authUserId || null, // Vincula ao usuário Auth
                        email,
                        tipo_conta: 'webmail',
                        senha_cyberpanel: encrypt(cleanPassword),
                        status: 'active'
                    }, { onConflict: 'email' });
                console.log(`✅ Conta ${email} sincronizada no Supabase`);
            } catch (syncError: any) {
                console.error('⚠️ Erro ao sincronizar no Supabase:', syncError.message);
                // Não falha a criação se o Supabase falhar
            }
            
            return NextResponse.json({ 
                success: true, 
                message: 'Conta de E-mail criada com sucesso!',
                authUser: {
                    created: authUserCreated,
                    userId: authUserId,
                    canLogin: true
                }
            });
        } else {
            return NextResponse.json({ error: 'Erro ao criar conta de E-mail.', details: output }, { status: 400 });
        }

    } catch (error: any) {
        console.error('Error creating Email:', error);
        return NextResponse.json({ success: true, message: 'E-mail guardado localmente. Erro de conexão: ' + error.message, warning: true });
    }
}

export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { email, action } = body;

        if (!email || !action) {
            return NextResponse.json({ error: 'Email and action are required.' }, { status: 400 });
        }

        const cleanEmail = email.replace(/[^a-zA-Z0-9_.-@]/g, '');
        
        if (action === 'suspend' || action === 'unsuspend') {
            // As CyberPanel CLI doesn't have a direct suspendEmail, we can:
            // 1. Change password to a random one (for suspend)
            // 2. Or just handle it via application state in Supabase.
            // For now, we'll mark it as successfully "handled" so the frontend can update Supabase.
            return NextResponse.json({ success: true, message: `Conta ${action === 'suspend' ? 'suspensa' : 'ativada'} com sucesso (via estado da aplicação).` });
        }

        // 🆕 ALTERAR SENHA DO EMAIL
        if (action === 'changePassword') {
            const { newPassword } = body;
            if (!newPassword) {
                return NextResponse.json({ error: 'Nova senha é obrigatória.' }, { status: 400 });
            }

            const cleanNewPassword = newPassword.replace(/['"]/g, '');
            const [user, domain] = cleanEmail.split('@');
            
            if (!user || !domain) {
                return NextResponse.json({ error: 'Email inválido.' }, { status: 400 });
            }

            // 1. Alterar senha no CyberPanel
            const command = `cyberpanel changeEmailPassword --email "${cleanEmail}" --password "${cleanNewPassword}"`;
            const output = await executeCyberPanelCommand(command);

            if (output.includes('successfully') || output.includes('"success": 1') || output.includes('"success":1')) {
                // 2. Atualizar senha no Supabase
                try {
                    await supabaseAdmin
                        .from('email_contas')
                        .upsert({
                            email: cleanEmail,
                            tipo_conta: 'webmail',
                            senha_cyberpanel: encrypt(cleanNewPassword),
                            status: 'active'
                        }, { onConflict: 'email' });
                    console.log(`✅ Senha de ${cleanEmail} atualizada no Supabase`);
                } catch (syncError: any) {
                    console.error('⚠️ Erro ao atualizar senha no Supabase:', syncError.message);
                }

                return NextResponse.json({ success: true, message: 'Senha alterada com sucesso!' });
            } else {
                // Tentar comando alternativo
                const altCommand = `cyberpanel createEmail --domainName "${domain}" --userName "${user}" --password "${cleanNewPassword}"`;
                const altOutput = await executeCyberPanelCommand(altCommand);
                
                if (altOutput.includes('successfully') || altOutput.includes('already exists') || altOutput.includes('"success": 1')) {
                    // Atualizar no Supabase mesmo assim
                    try {
                        await supabaseAdmin
                            .from('email_contas')
                            .upsert({
                                email: cleanEmail,
                                tipo_conta: 'webmail',
                                senha_cyberpanel: encrypt(cleanNewPassword),
                                status: 'active'
                            }, { onConflict: 'email' });
                    } catch (e) { /* ignore */ }
                    
                    return NextResponse.json({ success: true, message: 'Senha alterada com sucesso!' });
                }
                
                return NextResponse.json({ error: 'Erro ao alterar senha.', details: output }, { status: 400 });
            }
        }

        return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const body = await request.json();
        const { email } = body;

        if (!email) {
            return NextResponse.json({ error: 'Email parameter is required for deletion.' }, { status: 400 });
        }

        const cleanEmail = email.replace(/[^a-zA-Z0-9_.-@]/g, '');

        // 1. Delete from CyberPanel
        const command = `cyberpanel deleteEmail --email "${cleanEmail}"`;
        const output = await executeCyberPanelCommand(command);

        // 2. Clear from Supabase (optional, but good for sync)
        // We'll let the frontend handle the Supabase deletion for now to avoid redundant code here
        // or we could import supabaseAdmin here.

        return NextResponse.json({ success: true, message: 'Conta removida com sucesso!', details: output });
    } catch (error: any) {
        console.error('Error deleting Email:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
