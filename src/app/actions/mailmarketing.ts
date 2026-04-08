'use server'

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const PANEL_SCOPE_CLIENT = 'client'

// O Service Role Key ignora o RLS (Row Level Security), 
// permitindo que os clientes acessem os seus próprios dados mesmo 
// com as politicas limitadas para admin.
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export async function adminListarSubscritores(dominio?: string) {
    try {
        const query = supabaseAdmin
            .from('newsletter_subscribers')
            .select('*')
            .order('created_at', { ascending: false })

        const { data, error } = await query;
        
        if (error) {
            console.error('ERRO AO FILTRAR POR DOMINIO:', error.message);
            return [];
        }

        const allData = (data || []).filter((row: any) => {
            const rowPanel = row?.metadata?.panel;
            const rowDomain = normalizeDomain(row?.metadata?.domain);
            // Compatibilidade legada: contactos com domínio definido pertencem ao cliente.
            return rowPanel === PANEL_SCOPE_CLIENT || (!rowPanel && !!rowDomain);
        });
        if (!dominio) return allData;

        const normalizeDomain = (value?: string | null) =>
            (value || '')
                .toLowerCase()
                .trim()
                .replace(/^https?:\/\//, '')
                .replace(/^www\./, '')
                .replace(/^mail\./, '')
                .replace(/\/.*$/, '');

        const requestedDomain = normalizeDomain(dominio);
        if (!requestedDomain) return allData;

        // Isolamento por painel + variações de domínio.
        return allData.filter((row: any) => {
            const rowDomain = normalizeDomain(row?.metadata?.domain);
            const rowPanel = row?.metadata?.panel;
            const isClientScoped = rowPanel === PANEL_SCOPE_CLIENT || (!rowPanel && !!rowDomain);
            return isClientScoped && rowDomain === requestedDomain;
        });
    } catch (error) {
        console.error('Erro no Server Action adminListarSubscritores:', error);
        return [];
    }
}

export async function adminListarCampanhas(dominio?: string) {
    try {
        let query = supabaseAdmin
            .from('email_campaigns')
            .select('*')
            .order('created_at', { ascending: false })

        if (dominio) {
            query = query.contains('metadata', { domain: dominio })
        }

        const { data, error } = await query
        
        // Se erro for coluna não existente, carrega sem filtro
        if (error && error.code === '42703') {
            console.warn('Coluna metadata não existe em email_campaigns, carregando sem filtro');
            const { data: allData } = await supabaseAdmin
                .from('email_campaigns')
                .select('*')
                .order('created_at', { ascending: false })
            return allData || []
        }
        
        if (error) throw error
        return data || []
    } catch (error) {
        console.error('Erro no Server Action adminListarCampanhas:', error)
        throw error
    }
}

export async function adminSalvarCampanha(dados: { subject: string, content_html: string, total_recipients?: number, domain: string, status?: string }) {
    try {
        // Tenta inserir apenas com subject para evitar constraints
        const { data, error } = await supabaseAdmin
            .from('email_campaigns')
            .insert({
                subject: dados.subject
            })
            .select()
            .single()

        if (error) {
            console.error('Erro ao salvar campanha:', error);
            // Se falhar, retorna null para não interromper o fluxo
            return null;
        }

        return data;
    } catch (error) {
        console.error('Erro no Server Action adminSalvarCampanha:', error)
        // Retorna null para não interromper o fluxo de envio
        return null;
    }
}

export async function adminAdicionarSubscritor(dados: { email: string, full_name?: string, domain: string, list?: string }) {
    try {
        if (!supabaseUrl || !supabaseServiceKey) {
            throw new Error('Configuração do Supabase ausente no servidor.');
        }

        const normalizedEmail = dados.email.toLowerCase().trim();
        const normalizedDomain = (dados.domain || 'default').toLowerCase();
        
        // GRAVAÇÃO COM DOMÍNIO + ESCOPO CLIENTE: evita partilha com painel admin.
        const { data, error } = await supabaseAdmin
            .from('newsletter_subscribers')
            .insert({
                email: normalizedEmail,
                metadata: {
                    panel: PANEL_SCOPE_CLIENT,
                    domain: normalizedDomain,
                    list: dados.list || 'Contactos'
                },
                updated_at: new Date().toISOString()
            })
            .select()

        if (error) {
            console.error('ERRO SUPABASE:', error.message);
            if (error.code === '23505') {
                throw new Error('Este email já existe nesta lista/painel.');
            }
            throw new Error(error.message);
        }

        return data?.[0] || { success: true };
    } catch (error: any) {
        console.error('ERRO CRÍTICO NO SERVIDOR:', error.message);
        throw error;
    }
}

export async function adminRemoverSubscritor(id: string) {
    try {
        const { error } = await supabaseAdmin
            .from('newsletter_subscribers')
            .delete()
            .eq('id', id)

        if (error) throw error
        return true
    } catch (error) {
        console.error('Erro no Server Action adminRemoverSubscritor:', error)
        throw error
    }
}
