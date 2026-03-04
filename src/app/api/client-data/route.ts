import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
    try {
        // Para API routes, usar createClient com service role key para bypass de auth
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // Obter token do header Authorization
        const authHeader = req.headers.get('authorization');
        const token = authHeader?.replace('Bearer ', '');

        if (!token) {
            console.log('No auth token found in client-data API');
            return NextResponse.json({ error: 'Unauthorized - No token' }, { status: 401 });
        }

        // Verificar usuário com token
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) {
            console.log('Invalid token in client-data API:', error);
            return NextResponse.json({ error: 'Unauthorized - Invalid token' }, { status: 401 });
        }

        const adminEmails = ['admin@visualdesigne.com', 'silva.chamo@gmail.com'];
        const userRole = user.user_metadata?.role;
        const isAdmin = adminEmails.includes(user.email || '') || userRole === 'admin' || userRole === 'reseller';

        // Obter o email alvo (usado para admin ver painel de cliente específico)
        const { searchParams } = new URL(req.url);
        const targetEmail = searchParams.get('email');

        const userEmail = (isAdmin && targetEmail) ? targetEmail : (user.email || '');

        // Buscar dados do CyberPanel filtrados por email do cliente
        const response = await fetch('http://localhost:3002/api/server-exec', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'listWebsites',
                params: { filter: userEmail }
            }),
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Failed to fetch client data');
        }

        // Filtrar sites apenas do cliente
        const clientSites = data.data.sites?.filter((site: any) =>
            site.adminEmail === userEmail ||
            site.domain.includes(userEmail.split('@')[0])
        ) || [];

        // Dados mock de serviços (até implementar tabela real)
        const servicosMock = {
            dominios: clientSites.map((site: any) => ({
                nome: site.domain,
                renovacao: '2024-12-15',
                status: site.state === '1' || site.state === 'Active' ? 'active' : 'suspended',
                preco: 250
            })),
            hospedagem: clientSites.map((site: any) => ({
                dominio: site.domain,
                plano: site.package || 'Basic',
                renovacao: '2024-12-15',
                status: 'active',
                preco: 150
            })),
            proximas_renovacoes: [
                { servico: clientSites[0]?.domain || 'meusite.com', dias: 30, valor: 400 },
                { servico: 'Hospedagem', dias: 45, valor: 150 }
            ]
        };

        return NextResponse.json({
            success: true,
            data: {
                sites: clientSites,
                servicos: servicosMock,
                userEmail
            }
        });

    } catch (error) {
        console.error('Client data API error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch client data' },
            { status: 500 }
        );
    }
}
