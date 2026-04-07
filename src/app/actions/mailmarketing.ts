'use server'

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// O Service Role Key ignora o RLS (Row Level Security), 
// permitindo que os clientes acessem os seus próprios dados mesmo 
// com as politicas limitadas para admin.
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export async function adminListarSubscritores(dominio?: string) {
    try {
        let query = supabaseAdmin
            .from('newsletter_subscribers')
            .select('*')
            .order('created_at', { ascending: false })

        if (dominio) {
            query = query.contains('metadata', { domain: dominio })
        }

        const { data, error } = await query
        if (error) throw error
        return data || []
    } catch (error) {
        console.error('Erro no Server Action adminListarSubscritores:', error)
        throw error
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
        if (error) throw error
        return data || []
    } catch (error) {
        console.error('Erro no Server Action adminListarCampanhas:', error)
        throw error
    }
}

export async function adminSalvarCampanha(dados: { subject: string, content_html: string, total_recipients?: number, domain: string, status?: string }) {
    try {
        const { data, error } = await supabaseAdmin
            .from('email_campaigns')
            .insert({
                subject: dados.subject,
                content_html: dados.content_html,
                status: dados.status || 'sent',
                sent_at: dados.status === 'sent' ? new Date().toISOString() : null,
                total_recipients: dados.total_recipients || 0,
                metadata: { domain: dados.domain },
                updated_at: new Date().toISOString()
            })
            .select()
            .single()

        if (error) throw error
        return data
    } catch (error) {
        console.error('Erro no Server Action adminSalvarCampanha:', error)
        throw error
    }
}

export async function adminAdicionarSubscritor(dados: { email: string, full_name?: string, domain: string }) {
    try {
        const { data, error } = await supabaseAdmin
            .from('newsletter_subscribers')
            .upsert({
                email: dados.email,
                full_name: dados.full_name || '',
                status: 'subscribed',
                metadata: { domain: dados.domain },
                updated_at: new Date().toISOString()
            }, { onConflict: 'email' })
            .select()
            .single()

        if (error) throw error
        return data
    } catch (error) {
        console.error('Erro no Server Action adminAdicionarSubscritor:', error)
        throw error
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
