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
        const normalizeDomain = (value?: string | null) =>
            (value || '')
                .toLowerCase()
                .trim()
                .replace(/^https?:\/\//, '')
                .replace(/^www\./, '')
                .replace(/^mail\./, '')
                .replace(/\/.*$/, '');

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

export async function adminListarCampanhas(dominio?: string, ownerEmail?: string) {
    try {
        const query = supabaseAdmin
            .from('email_campaigns')
            .select('*')
            .order('created_at', { ascending: false })

        const { data, error } = await query
        if (error) throw error
        const requestedOwner = (ownerEmail || '').toLowerCase().trim()

        // Segurança: campanhas do cliente só visíveis para a própria conta.
        return (data || []).filter((row: any) => {
            const sender = (row?.sender_email || '').toLowerCase().trim()
            if (!sender) return false
            if (sender.startsWith('admin:')) return false
            if (!requestedOwner || sender !== requestedOwner) return false
            return true
        })
    } catch (error) {
        console.error('Erro no Server Action adminListarCampanhas:', error)
        return []
    }
}

export async function adminSalvarCampanha(dados: { subject: string, content_html: string, total_recipients?: number, domain: string, status?: string, owner_email?: string }) {
    try {
        const owner = (dados.owner_email || '').toLowerCase().trim()
        if (!owner) return null

        const { data, error } = await supabaseAdmin
            .from('email_campaigns')
            .insert({
                subject: dados.subject,
                content: dados.content_html,
                sender_email: owner,
                recipient_count: dados.total_recipients || 0
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

export async function adminRemoverCampanha(id: string) {
    try {
        const { error } = await supabaseAdmin
            .from('email_campaigns')
            .delete()
            .eq('id', id)

        if (error) throw error
        return true
    } catch (error) {
        console.error('Erro no Server Action adminRemoverCampanha:', error)
        throw error
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

export async function adminAtualizarSubscritor(
    id: string,
    dados: { email: string, full_name?: string, domain: string, list?: string }
) {
    try {
        if (!supabaseUrl || !supabaseServiceKey) {
            throw new Error('Configuração do Supabase ausente no servidor.');
        }

        const normalizedEmail = dados.email.toLowerCase().trim();
        const normalizedDomain = (dados.domain || 'default').toLowerCase();

        const { data, error } = await supabaseAdmin
            .from('newsletter_subscribers')
            .update({
                email: normalizedEmail,
                full_name: dados.full_name || '',
                metadata: {
                    panel: PANEL_SCOPE_CLIENT,
                    domain: normalizedDomain,
                    list: dados.list || 'Contactos'
                },
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('ERRO SUPABASE UPDATE:', error.message);
            if (error.code === '23505') {
                throw new Error('Já existe outro contacto com este email nesta lista/painel.');
            }
            throw new Error(error.message);
        }

        return data;
    } catch (error: any) {
        console.error('ERRO CRÍTICO NO UPDATE:', error.message);
        throw error;
    }
}
