import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { Client } from 'ssh2';
import { getServerHost } from '@/lib/server-config';

// HestiaCP Path
const HESTIA_BIN = '/usr/local/hestia/bin/';

// Cliente Supabase Admin
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'
const supabaseAdmin = createAdminClient(supabaseUrl, supabaseKey)

// Encriptação base64
const encrypt = (text: string) => Buffer.from(text).toString('base64')

async function execSSH(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const conn = new Client();
        let out = '';
        const rawKey = process.env.SSH_PRIVATE_KEY || '';
        const privateKey = rawKey.includes('-----BEGIN') 
            ? rawKey.replace(/\\n/g, '\n') 
            : rawKey;

        conn.on('ready', () => {
            const fullCommand = command.startsWith('v-') ? `${HESTIA_BIN}${command}` : command;
            conn.exec(fullCommand, (err, stream) => {
                if (err) { conn.end(); return reject(err); }
                stream.on('data', (d: Buffer) => { out += d.toString(); });
                stream.stderr.on('data', (d: Buffer) => { out += d.toString(); });
                stream.on('close', () => { conn.end(); resolve(out); });
            });
        });

        conn.on('error', (err) => { 
            console.error('SSH EMAIL ERROR:', err.message);
            reject(err); 
        });

        conn.connect({
            host: process.env.CYBERPANEL_IP || getServerHost(),
            port: parseInt(process.env.CYBERPANEL_SSH_PORT || '22'),
            username: process.env.CYBERPANEL_SSH_USER || 'root',
            privateKey,
            password: process.env.CYBERPANEL_PASS, // Fallback to password
        });
    });
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const domain = searchParams.get('domain');
        const user = searchParams.get('user') || 'admin';

        if (!domain) {
            return NextResponse.json({ error: 'Domain param is required.' }, { status: 400 });
        }

        const raw = await execSSH(`v-list-mail-accounts ${user} ${domain} json`);
        try {
            const mailObj = JSON.parse(raw);
            const emails = Object.keys(mailObj).map(account => ({
                email: `${account}@${domain}`,
                user: account,
                domain: domain,
                usage: mailObj[account].U_MAIL_DISK || '0',
                quota: mailObj[account].QUOTA || 'unlimited',
                status: mailObj[account].SUSPENDED === 'no' ? 'active' : 'suspended'
            }));
            return NextResponse.json({ success: true, emails });
        } catch (e) {
            return NextResponse.json({ success: false, error: 'Failed to list emails from Hestia', raw });
        }
    } catch (error: any) {
        console.error('Error listing Emails:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { domainName, userName, password, requesterEmail } = body;
        const user = body.user || 'admin';

        if (!domainName || !userName || !password) {
            return NextResponse.json({ error: 'Missing required parameters (domainName, userName, password).' }, { status: 400 });
        }

        const email = `${userName}@${domainName}`;

        // v-add-mail-account user domain account password
        const command = `v-add-mail-account ${user} ${domainName} ${userName} '${password}'`;
        const output = await execSSH(command);

        if (output === '' || !output.toLowerCase().includes('error')) {
            // 🚀 CRIAR USUÁRIO NO SUPABASE AUTH (para login no sistema)
            let authUserId = ''
            let authUserCreated = false
            try {
                const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers()
                const userExists = existingUser?.users?.find(u => u.email === email)
                
                if (!userExists) {
                    const { data: newAuthUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
                        email: email,
                        password: password,
                        email_confirm: true,
                        user_metadata: {
                            nome: userName,
                            role: 'client',
                            domain: domainName
                        }
                    })
                    
                    if (!authError && newAuthUser?.user) {
                        authUserId = newAuthUser.user.id
                        authUserCreated = true
                    }
                } else {
                    authUserId = userExists.id
                }
            } catch (authError: any) {
                console.error('Erro na criação do usuário Auth:', authError)
            }
            
            // 🚀 SINCRONIZAR COM SUPABASE
            try {
                await supabaseAdmin
                    .from('email_contas')
                    .upsert({
                        cliente_id: authUserId || null,
                        email,
                        tipo_conta: 'webmail',
                        senha_cyberpanel: encrypt(password),
                        status: 'active'
                    }, { onConflict: 'email' });
            } catch (syncError: any) {
                console.error('⚠️ Erro ao sincronizar no Supabase:', syncError.message);
            }
            
            return NextResponse.json({ 
                success: true, 
                message: 'Conta de E-mail criada com sucesso no HestiaCP!',
                authUser: {
                    created: authUserCreated,
                    userId: authUserId
                }
            });
        } else {
            return NextResponse.json({ error: 'Erro ao criar conta no HestiaCP.', details: output }, { status: 400 });
        }

    } catch (error: any) {
        console.error('Error creating Email:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { email, action } = body;
        const user = body.user || 'admin';

        if (!email || !action) {
            return NextResponse.json({ error: 'Email and action are required.' }, { status: 400 });
        }

        const [account, domain] = email.split('@');
        
        if (action === 'suspend' || action === 'unsuspend') {
            const hCmd = action === 'suspend' ? 'v-suspend-mail-account' : 'v-unsuspend-mail-account';
            const raw = await execSSH(`${hCmd} ${user} ${domain} ${account}`);
            return NextResponse.json({ success: raw === '' || !raw.toLowerCase().includes('error'), output: raw });
        }

        if (action === 'changePassword') {
            const { newPassword } = body;
            if (!newPassword) {
                return NextResponse.json({ error: 'Nova senha é obrigatória.' }, { status: 400 });
            }

            const raw = await execSSH(`v-change-mail-account-password ${user} ${domain} ${account} '${newPassword}'`);

            if (raw === '' || !raw.toLowerCase().includes('error')) {
                try {
                    await supabaseAdmin
                        .from('email_contas')
                        .update({ senha_cyberpanel: encrypt(newPassword) })
                        .eq('email', email);
                } catch (e) {}
                return NextResponse.json({ success: true, message: 'Senha alterada no HestiaCP!' });
            } else {
                return NextResponse.json({ error: 'Erro ao alterar senha no HestiaCP.', details: raw }, { status: 400 });
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
        const user = body.user || 'admin';

        if (!email) {
            return NextResponse.json({ error: 'Email parameter is required.' }, { status: 400 });
        }

        const [account, domain] = email.split('@');
        const raw = await execSSH(`v-delete-mail-account ${user} ${domain} ${account}`);

        return NextResponse.json({ 
            success: raw === '' || !raw.toLowerCase().includes('error'), 
            message: 'Conta removida do HestiaCP!', 
            details: raw 
        });
    } catch (error: any) {
        console.error('Error deleting Email:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

