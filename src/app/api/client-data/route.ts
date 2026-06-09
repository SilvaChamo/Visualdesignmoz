import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
    try {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const authHeader = req.headers.get('authorization');
        const token = authHeader?.replace('Bearer ', '');

        if (!token) {
            return NextResponse.json({ error: 'Unauthorized - No token' }, { status: 401 });
        }

        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) {
            return NextResponse.json({ error: 'Unauthorized - Invalid token' }, { status: 401 });
        }

        const adminEmails = ['admin@your-domain.com', 'silva.chamo@gmail.com'];
        const userRole = user.user_metadata?.role;
        const isAdmin = adminEmails.includes(user.email || '') || userRole === 'admin' || userRole === 'reseller';

        const { searchParams } = new URL(req.url);
        const targetEmail = searchParams.get('email');
        const userEmail = (isAdmin && targetEmail) ? targetEmail : (user.email || '');

        const { data: sites, error: sitesError } = await supabase
            .from('panel_sites')
            .select('*')
            .or(`admin_email.eq.${userEmail},owner.eq.${userEmail}`);

        if (sitesError) {
            console.warn('panel_sites query failed:', sitesError.message);
        }

        const clientSites = (sites || []).filter((site) =>
            site.admin_email === userEmail ||
            site.owner === userEmail ||
            site.domain?.includes(userEmail.split('@')[0])
        );

        const servicosMock = {
            dominios: clientSites.map((site) => ({
                nome: site.domain,
                renovacao: '2024-12-15',
                status: site.status === 'Active' ? 'active' : 'suspended',
                preco: 250
            })),
            hospedagem: clientSites.map((site) => ({
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
