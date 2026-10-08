'use server'

import { createClient } from '@supabase/supabase-js'
import { cacheService } from '@/lib/cache-service'
import { requirePanelBootstrapAccess } from '@/lib/panel-api-auth'
import { listMirrorWebsites, listMirrorWebsitesForClientUser } from '@/lib/panel-mirror-read'
import { isEmailPlanPackage } from '@/lib/email-plans'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const PANEL_SCOPE_CLIENT = 'client'
const SUBS_CACHE_TTL_MS = 60_000
const CAMP_CACHE_TTL_MS = 60_000

// O Service Role Key ignora o RLS (Row Level Security), 
// permitindo que os clientes acessem os seus próprios dados mesmo 
// com as politicas limitadas para admin.
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

const normalizeDomain = (value?: string | null) =>
    (value || '')
        .toLowerCase()
        .trim()
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .replace(/^mail\./, '')
        .replace(/\/.*$/, '');

type MailmarketingSession = { email: string; isAdmin: boolean; allowedDomains: Set<string> }

// Nunca confiar em domain/ownerEmail vindos do cliente — cada conta (admin,
// revendedor, ou "manager"/conta profissional) só pode ver e alterar os seus
// próprios contactos e campanhas. Resolve sempre a sessão autenticada e os
// domínios que ela realmente possui antes de tocar em qualquer dado.
async function resolveSession(): Promise<MailmarketingSession | null> {
    // requirePanelBootstrapAccess() é o único helper que também reconhece o
    // papel "client" (contas do portal em /cliente, distintas de "manager" —
    // conta profissional) — requireAdminOrReseller()/requireAdminResellerOrManager()
    // rejeitam "client" com 403, o que bloquearia o Mailmarketing dessas contas.
    const auth = await requirePanelBootstrapAccess()
    if ('error' in auth) return null

    const email = (auth.user.email || '').toLowerCase().trim()
    if (!email) return null

    if (auth.user.role === 'admin') {
        return { email, isAdmin: true, allowedDomains: new Set() }
    }

    const sites = auth.user.role === 'reseller'
        ? await listMirrorWebsites({ role: 'reseller', userId: auth.user.id })
        : await listMirrorWebsitesForClientUser(auth.user.id, email) // 'manager' e 'client'

    // Domínios do plano "Email Básico" (sem hospedagem real) só dão direito a
    // Webmail — o plano não inclui Mail Marketing.
    const allowedDomains = new Set(
        (sites || [])
            .filter((s: any) => !isEmailPlanPackage(s.package))
            .map((s: any) => normalizeDomain(s.domain))
            .filter(Boolean)
    )
    return { email, isAdmin: false, allowedDomains }
}

function domainAllowed(session: MailmarketingSession, domain: string): boolean {
    if (session.isAdmin) return true
    return session.allowedDomains.has(normalizeDomain(domain))
}

export async function adminListarSubscritores(dominio?: string) {
    const session = await resolveSession()
    if (!session) return []

    const requestedDomain = normalizeDomain(dominio);
    if (requestedDomain) {
        if (!domainAllowed(session, requestedDomain)) return []
    } else if (!session.isAdmin) {
        // Sem domínio pedido, uma conta não-admin nunca pode receber "todos".
        return []
    }

    const cacheKey = `mailmarketing_subs_${requestedDomain || 'all'}`;
    const cached = cacheService.get(cacheKey);
    if (cached) return cached as any[];

    try {
        // Filtrar já na query (usa o índice idx_subscribers_email_unique_by_scope) em vez
        // de trazer a tabela toda e filtrar em JS — reduz o tempo de resposta real.
        let query = supabaseAdmin
            .from('newsletter_subscribers')
            .select('id, email, full_name, metadata, created_at, updated_at')
            .eq('metadata->>panel', PANEL_SCOPE_CLIENT)
            .order('created_at', { ascending: false })

        if (requestedDomain) {
            query = query.eq('metadata->>domain', requestedDomain);
        }

        const { data, error } = await query;

        if (error) {
            console.error('ERRO AO FILTRAR POR DOMINIO:', error.message);
            return [];
        }

        cacheService.set(cacheKey, data || [], SUBS_CACHE_TTL_MS);
        return data || [];
    } catch (error) {
        console.error('Erro no Server Action adminListarSubscritores:', error);
        return [];
    }
}

// Uma lista é um registo próprio em mailmarketing_lists — existe mesmo sem
// nenhum email lá dentro. Também juntamos os nomes de lista já usados pelos
// emails existentes (dados antigos, ou importações por CSV) e auto-registamos
// os que ainda não têm linha própria, para nunca "perder" uma lista em uso.
export async function adminListarListas(dominio?: string): Promise<string[]> {
    const session = await resolveSession()
    if (!session) return ['Contactos']

    const requestedDomain = normalizeDomain(dominio)
    if (!requestedDomain || !domainAllowed(session, requestedDomain)) return ['Contactos']

    try {
        const [{ data: listRows, error: listError }, subs] = await Promise.all([
            supabaseAdmin.from('mailmarketing_lists').select('name').eq('domain', requestedDomain),
            adminListarSubscritores(requestedDomain)
        ])

        if (listError) console.error('Erro ao listar mailmarketing_lists:', listError.message)

        const namesFromTable = (listRows || []).map((r: any) => r.name as string)
        const namesFromContacts = (subs || []).flatMap((s: any) => {
            const lists = s?.metadata?.lists
            if (Array.isArray(lists) && lists.length) return lists
            if (s?.metadata?.list) return [s.metadata.list]
            return []
        }) as string[]

        const missing = [...new Set(namesFromContacts)].filter(n => n && n !== 'Contactos' && !namesFromTable.includes(n))
        if (missing.length > 0) {
            supabaseAdmin
                .from('mailmarketing_lists')
                .upsert(missing.map(name => ({ domain: requestedDomain, name })), { onConflict: 'domain,name', ignoreDuplicates: true })
                .then(({ error }) => { if (error) console.error('Erro ao auto-registar lista:', error.message) })
        }

        return [...new Set(['Contactos', ...namesFromTable, ...namesFromContacts])]
    } catch (error) {
        console.error('Erro no Server Action adminListarListas:', error)
        return ['Contactos']
    }
}

export async function adminCriarLista(dominio: string, nome: string): Promise<string[]> {
    const session = await resolveSession()
    if (!session) throw new Error('Não autorizado.')

    const requestedDomain = normalizeDomain(dominio)
    const name = (nome || '').trim()
    if (!requestedDomain || !domainAllowed(session, requestedDomain)) throw new Error('Domínio fora do seu acesso.')
    if (!name) throw new Error('Nome da lista em falta.')

    const { error } = await supabaseAdmin
        .from('mailmarketing_lists')
        .upsert({ domain: requestedDomain, name }, { onConflict: 'domain,name', ignoreDuplicates: true })

    if (error) {
        console.error('Erro ao criar lista:', error.message)
        throw new Error('Erro ao criar lista.')
    }

    return adminListarListas(requestedDomain)
}

export async function adminRemoverLista(dominio: string, nome: string): Promise<string[]> {
    const session = await resolveSession()
    if (!session) throw new Error('Não autorizado.')

    const requestedDomain = normalizeDomain(dominio)
    if (!requestedDomain || !domainAllowed(session, requestedDomain)) throw new Error('Domínio fora do seu acesso.')
    if (nome === 'Contactos') throw new Error('Não é possível eliminar a lista por omissão.')

    const subs = await adminListarSubscritores(requestedDomain)
    const emEmUso = (subs || []).some((s: any) => {
        const lists = s?.metadata?.lists
        if (Array.isArray(lists)) return lists.includes(nome)
        return s?.metadata?.list === nome
    })
    if (emEmUso) throw new Error('Esta lista ainda tem emails associados — remova-os primeiro.')

    const { error } = await supabaseAdmin
        .from('mailmarketing_lists')
        .delete()
        .eq('domain', requestedDomain)
        .eq('name', nome)

    if (error) {
        console.error('Erro ao eliminar lista:', error.message)
        throw new Error('Erro ao eliminar lista.')
    }

    return adminListarListas(requestedDomain)
}

export async function adminListarCampanhas(dominio?: string, ownerEmail?: string) {
    const session = await resolveSession()
    if (!session) return []
    // ownerEmail do cliente é ignorado de propósito — a sessão autenticada é
    // a única fonte de verdade sobre "quais são as minhas campanhas".
    const requestedOwner = session.email

    const cacheKey = `mailmarketing_camp_${requestedOwner}`;
    const cached = cacheService.get(cacheKey);
    if (cached) return cached as any[];

    try {
        // Filtrar já na query (usa o índice idx_email_campaigns_sender) em vez de
        // trazer a tabela toda (de todos os clientes) e filtrar em JS.
        const { data, error } = await supabaseAdmin
            .from('email_campaigns')
            .select('*')
            .eq('sender_email', requestedOwner)
            .order('created_at', { ascending: false })

        if (error) throw error
        cacheService.set(cacheKey, data || [], CAMP_CACHE_TTL_MS);
        return data || []
    } catch (error) {
        console.error('Erro no Server Action adminListarCampanhas:', error)
        return []
    }
}

export async function adminSalvarCampanha(dados: { subject: string, content_html: string, total_recipients?: number, domain: string, status?: string, owner_email?: string }) {
    try {
        const session = await resolveSession()
        if (!session) return null
        // owner_email do cliente é ignorado — a campanha fica sempre associada à sessão autenticada.
        const owner = session.email

        // Chamada sempre depois de um envio bem sucedido (ver handleSend em
        // MailMarketingSection.tsx) — por isso grava logo como 'sent', com os
        // totais preenchidos. Sem isto, esta linha (usada pelo Histórico do
        // cliente) ficava presa no 'draft' por omissão, mesmo com o envio
        // real já concluído.
        const { data, error } = await supabaseAdmin
            .from('email_campaigns')
            .insert({
                subject: dados.subject,
                content: dados.content_html,
                content_html: dados.content_html,
                sender_email: owner,
                recipient_count: dados.total_recipients || 0,
                total_recipients: dados.total_recipients || 0,
                successful_sends: dados.total_recipients || 0,
                status: dados.status || 'sent',
                sent_at: new Date().toISOString()
            })
            .select()
            .single()

        if (error) {
            console.error('Erro ao salvar campanha:', error);
            // Se falhar, retorna null para não interromper o fluxo
            return null;
        }

        cacheService.clearPattern('mailmarketing_camp_');
        return data;
    } catch (error) {
        console.error('Erro no Server Action adminSalvarCampanha:', error)
        // Retorna null para não interromper o fluxo de envio
        return null;
    }
}

export async function adminRemoverCampanha(id: string, ownerEmail: string) {
    try {
        const session = await resolveSession()
        if (!session) throw new Error('Não autorizado.')
        // ownerEmail do cliente é ignorado — só a sessão autenticada conta.
        const owner = session.email

        const { data: existing, error: fetchError } = await supabaseAdmin
            .from('email_campaigns')
            .select('sender_email')
            .eq('id', id)
            .maybeSingle()
        if (fetchError) throw fetchError
        if (!existing || (existing.sender_email || '').toLowerCase().trim() !== owner) {
            throw new Error('Campanha não encontrada ou fora do seu acesso.')
        }

        const { error } = await supabaseAdmin
            .from('email_campaigns')
            .delete()
            .eq('id', id)

        if (error) throw error
        cacheService.clearPattern('mailmarketing_camp_');
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
        const session = await resolveSession()
        if (!session) throw new Error('Não autorizado.')
        // ownerEmail do cliente é ignorado — nunca zera campanhas de outra conta.
        const query = supabaseAdmin
            .from('email_campaigns')
            .select('id, subject, recipient_count')
            .eq('sender_email', session.email);

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
        cacheService.clearPattern('mailmarketing_camp_');
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
        const session = await resolveSession()
        if (!session) throw new Error('Não autorizado.')
        // ownerEmail do cliente é ignorado — nunca apaga campanhas de outra conta.
        const { error, count } = await supabaseAdmin
            .from('email_campaigns')
            .delete()
            .eq('sender_email', session.email);
        
        if (error) {
            console.error('Erro ao deletar campanhas:', error);
            throw error;
        }

        cacheService.clearPattern('mailmarketing_camp_');
        return {
            success: true,
            message: `Todas as campanhas do utilizador foram removidas`,
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

// Um contacto pode pertencer a várias listas em simultâneo (como no Mailchimp) —
// por isso "adicionar" faz sempre merge das listas pedidas com as que já
// existem, nunca substitui. Para trocar o conjunto todo, usar adminAtualizarSubscritor.
function mergeLists(existing: unknown, incoming: string[]): string[] {
    const existingLists = Array.isArray(existing)
        ? existing
        : (typeof existing === 'string' && existing ? [existing] : []);
    return [...new Set([...existingLists, ...incoming].filter(Boolean))];
}

export async function adminAdicionarSubscritor(dados: { email: string, full_name?: string, domain: string, list?: string, lists?: string[] }) {
    try {
        if (!supabaseUrl || !supabaseServiceKey) {
            throw new Error('Configuração do Supabase ausente no servidor.');
        }

        const session = await resolveSession()
        if (!session) throw new Error('Não autorizado.')

        const normalizedEmail = dados.email.toLowerCase().trim();
        const normalizedDomain = (dados.domain || 'default').toLowerCase();
        const requestedLists = (dados.lists?.length ? dados.lists : (dados.list ? [dados.list] : ['Contactos']));

        if (!domainAllowed(session, normalizedDomain)) {
            throw new Error('Domínio fora do seu acesso.')
        }

        // VALIDAÇÃO DE EMAIL
        const validation = isValidEmail(normalizedEmail);
        if (!validation.valid) {
            throw new Error(validation.error || 'Email inválido');
        }

        // Verificar se email já existe APENAS NESTE DOMÍNIO
        const { data: existingInDomain, error: checkError } = await supabaseAdmin
            .from('newsletter_subscribers')
            .select('id, email, metadata')
            .eq('email', normalizedEmail)
            .eq('metadata->>domain', normalizedDomain)
            .eq('metadata->>panel', PANEL_SCOPE_CLIENT)
            .maybeSingle();

        if (checkError) {
            console.error('[adminAdicionarSubscritor] Erro ao verificar duplicado:', checkError.message);
        }

        // Se já existe neste domínio → ACTUALIZAR (junta as listas, não substitui)
        if (existingInDomain) {
            console.log('[adminAdicionarSubscritor] Email exists in this domain, updating...');

            const mergedLists = mergeLists((existingInDomain.metadata as any)?.lists ?? (existingInDomain.metadata as any)?.list, requestedLists);

            const { data: updated, error: updateError } = await supabaseAdmin
                .from('newsletter_subscribers')
                .update({
                    metadata: {
                        panel: PANEL_SCOPE_CLIENT,
                        domain: normalizedDomain,
                        lists: mergedLists
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

            cacheService.clearPattern('mailmarketing_subs_');
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
                    lists: [...new Set(requestedLists.filter(Boolean))]
                },
                updated_at: new Date().toISOString()
            })
            .select()
            .single();

        if (insertError) {
            console.error('ERRO SUPABASE INSERT:', insertError.message);
            throw new Error(insertError.message);
        }

        cacheService.clearPattern('mailmarketing_subs_');
        return { success: true, updated: false, data: inserted, isRoleBased: validation.error === 'ROLE_BASED' };

    } catch (error: any) {
        console.error('ERRO CRÍTICO NO SERVIDOR:', error.message);
        throw error;
    }
}

export async function adminRemoverSubscritor(id: string, dominio: string) {
    try {
        const session = await resolveSession()
        if (!session) throw new Error('Não autorizado.')

        const requestedDomain = normalizeDomain(dominio)
        if (!requestedDomain || !domainAllowed(session, requestedDomain)) throw new Error('Não autorizado.')

        const { data: existing, error: fetchError } = await supabaseAdmin
            .from('newsletter_subscribers')
            .select('metadata')
            .eq('id', id)
            .maybeSingle()
        if (fetchError) throw fetchError
        const rowDomain = normalizeDomain((existing?.metadata as any)?.domain)
        if (!existing || rowDomain !== requestedDomain) {
            throw new Error('Contacto não encontrado ou fora do seu acesso.')
        }

        const { error } = await supabaseAdmin
            .from('newsletter_subscribers')
            .delete()
            .eq('id', id)

        if (error) throw error
        cacheService.clearPattern('mailmarketing_subs_');
        return true
    } catch (error) {
        console.error('Erro no Server Action adminRemoverSubscritor:', error)
        throw error
    }
}

export async function adminAtualizarSubscritor(
    id: string,
    dados: { email: string, full_name?: string, domain: string, list?: string, lists?: string[] }
) {
    try {
        if (!supabaseUrl || !supabaseServiceKey) {
            throw new Error('Configuração do Supabase ausente no servidor.');
        }

        const session = await resolveSession()
        if (!session) throw new Error('Não autorizado.')

        const normalizedEmail = dados.email.toLowerCase().trim();
        const normalizedDomain = (dados.domain || 'default').toLowerCase();
        // Aqui substitui-se o conjunto todo (não é merge) — o popup de edição
        // mostra sempre todas as listas do contacto, por isso reflecte
        // exactamente o que o utilizador escolheu, incluindo remoções.
        const requestedLists = (dados.lists?.length ? dados.lists : (dados.list ? [dados.list] : ['Contactos']));

        if (!domainAllowed(session, normalizedDomain)) {
            throw new Error('Domínio fora do seu acesso.')
        }

        const { data, error } = await supabaseAdmin
            .from('newsletter_subscribers')
            .update({
                email: normalizedEmail,
                full_name: dados.full_name || '',
                metadata: {
                    panel: PANEL_SCOPE_CLIENT,
                    domain: normalizedDomain,
                    lists: [...new Set(requestedLists.filter(Boolean))]
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

        cacheService.clearPattern('mailmarketing_subs_');
        return data;
    } catch (error: any) {
        console.error('ERRO CRÍTICO NO UPDATE:', error.message);
        throw error;
    }
}
