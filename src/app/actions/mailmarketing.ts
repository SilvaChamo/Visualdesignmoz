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

/**
 * 🧹 LIMPA DADOS DE TESTE - Zera contadores de emails enviados
 * Use apenas em ambiente de teste
 */
export async function adminLimparDadosCampanhas(ownerEmail?: string) {
    try {
        // Buscar todas as campanhas (ou apenas do owner especificado)
        let query = supabaseAdmin
            .from('email_campaigns')
            .select('id, subject, recipient_count');
        
        if (ownerEmail) {
            query = query.eq('sender_email', ownerEmail.toLowerCase().trim());
        }
        
        const { data: campanhas, error: fetchError } = await query;
        
        if (fetchError) {
            console.error('Erro ao buscar campanhas:', fetchError);
            throw fetchError;
        }
        
        // Zerar recipient_count de todas as campanhas encontradas
        const updates = (campanhas || []).map(async (campanha: any) => {
            const { error } = await supabaseAdmin
                .from('email_campaigns')
                .update({ 
                    recipient_count: 0,
                    updated_at: new Date().toISOString()
                })
                .eq('id', campanha.id);
            
            if (error) {
                console.error(`Erro ao zerar campanha ${campanha.id}:`, error);
            }
            return { id: campanha.id, subject: campanha.subject, success: !error };
        });
        
        const resultados = await Promise.all(updates);
        
        console.log('[adminLimparDadosCampanhas] Dados zerados:', resultados);
        return {
            success: true,
            message: `${resultados.length} campanha(s) limpa(s)`,
            details: resultados
        };
        
    } catch (error: any) {
        console.error('Erro no Server Action adminLimparDadosCampanhas:', error);
        throw error;
    }
}

/**
 * 🗑️ DELETAR TODAS AS CAMPANHAS - Use com cuidado!
 * Apenas para limpeza completa em testes
 */
export async function adminDeletarTodasCampanhas(ownerEmail?: string) {
    try {
        let query = supabaseAdmin
            .from('email_campaigns')
            .delete();
        
        if (ownerEmail) {
            query = query.eq('sender_email', ownerEmail.toLowerCase().trim());
        }
        
        const { error, count } = await query;
        
        if (error) {
            console.error('Erro ao deletar campanhas:', error);
            throw error;
        }
        
        return {
            success: true,
            message: `Todas as campanhas ${ownerEmail ? 'do usuário ' : ''}foram removidas`,
            deletedCount: count
        };
        
    } catch (error: any) {
        console.error('Erro no Server Action adminDeletarTodasCampanhas:', error);
        throw error;
    }
}

// Função de validação de email
function isValidEmail(email: string): { valid: boolean; error?: string } {
    const normalizedEmail = email.toLowerCase().trim();
    
    // Verificar formato básico
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
        return { valid: false, error: 'Formato de email inválido' };
    }
    
    // Verificar TLD válido
    const validTLDs = ['.com', '.net', '.org', '.edu', '.gov', '.io', '.co', '.pt', '.br', '.mz', '.za', '.uk', '.fr', '.de', '.es', '.it', '.nl', '.be', '.ch', '.at', '.se', '.no', '.dk', '.fi', '.ie', '.pl', '.cz', '.sk', '.hu', '.ro', '.bg', '.hr', '.si', '.lt', '.lv', '.ee', '.lu', '.mt', '.cy', '.ee', '.is', '.li', '.mc', '.sm', '.va', '.ad'];
    const hasValidTLD = validTLDs.some(tld => normalizedEmail.endsWith(tld));
    if (!hasValidTLD) {
        // Não rejeitar, apenas avisar
        console.log('[Email Validation] TLD incomum:', normalizedEmail);
    }
    
    // Verificar emails de função (role-based)
    const roleBasedPatterns = ['admin@', 'info@', 'support@', 'sales@', 'marketing@', 'noreply@', 'no-reply@', 'contact@', 'help@', 'service@', 'webmaster@', 'postmaster@', 'hostmaster@', 'abuse@', 'security@'];
    const isRoleBased = roleBasedPatterns.some(pattern => normalizedEmail.startsWith(pattern));
    if (isRoleBased) {
        return { valid: true, error: 'ROLE_BASED' }; // Válido mas é role-based
    }
    
    return { valid: true };
}

export async function adminAdicionarSubscritor(dados: { email: string, full_name?: string, domain: string, list?: string }) {
    try {
        if (!supabaseUrl || !supabaseServiceKey) {
            throw new Error('Configuração do Supabase ausente no servidor.');
        }

        const normalizedEmail = dados.email.toLowerCase().trim();
        const normalizedDomain = (dados.domain || 'default').toLowerCase();
        
        // VALIDAÇÃO DE EMAIL
        const validation = isValidEmail(normalizedEmail);
        if (!validation.valid) {
            throw new Error(validation.error || 'Email inválido');
        }
        
        // Verificar se email já existe APENAS NESTE DOMÍNIO
        const { data: existingInDomain, error: checkError } = await supabaseAdmin
            .from('newsletter_subscribers')
            .select('id, email')
            .eq('email', normalizedEmail)
            .eq('metadata->>domain', normalizedDomain)
            .eq('metadata->>panel', PANEL_SCOPE_CLIENT)
            .maybeSingle();
        
        if (checkError) {
            console.error('[adminAdicionarSubscritor] Erro ao verificar duplicado:', checkError.message);
        }
        
        // Se já existe neste domínio → ACTUALIZAR
        if (existingInDomain) {
            console.log('[adminAdicionarSubscritor] Email exists in this domain, updating...');
            
            const { data: updated, error: updateError } = await supabaseAdmin
                .from('newsletter_subscribers')
                .update({
                    metadata: {
                        panel: PANEL_SCOPE_CLIENT,
                        domain: normalizedDomain,
                        list: dados.list || 'Contactos'
                    },
                    updated_at: new Date().toISOString()
                })
                .eq('id', existingInDomain.id)
                .select()
                .single();
            
            if (updateError) {
                console.error('ERRO SUPABASE UPDATE:', updateError.message);
                throw new Error('Erro ao actualizar contacto existente.');
            }
            
            return { success: true, updated: true, data: updated, isRoleBased: validation.error === 'ROLE_BASED' };
        }
        
        // Se não existe neste domínio → INSERIR NOVO
        // (pode existir noutros domínios, mas isso é permitido)
        console.log('[adminAdicionarSubscritor] New email for this domain, inserting...');
        
        const { data: inserted, error: insertError } = await supabaseAdmin
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
            .single();
        
        if (insertError) {
            console.error('ERRO SUPABASE INSERT:', insertError.message);
            throw new Error(insertError.message);
        }
        
        return { success: true, updated: false, data: inserted, isRoleBased: validation.error === 'ROLE_BASED' };
        
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
