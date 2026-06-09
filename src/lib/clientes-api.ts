'use client'

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// TIPOS
export interface Cliente {
  id: string
  nome: string
  email: string
  telefone?: string
  nif?: string
  empresa?: string
  morada?: string
  cidade?: string
  pais?: string
  status: 'active' | 'suspended' | 'inactive'
  data_cadastro: string
  ultimo_acesso?: string
  observacoes?: string
  created_at: string
  updated_at: string
}

export interface SiteCliente {
  id: string
  cliente_id: string
  dominio: string
  titulo_site?: string
  descricao?: string
  plano: 'basic' | 'premium' | 'enterprise' | 'custom'
  preco_mensal: number
  moeda: string
  data_criacao: string
  data_renovacao?: string
  dias_aviso_pre_renovacao: number
  status: 'active' | 'suspended' | 'expired' | 'pending'
  panel_id?: number
  ssl: boolean
  ssl_expira?: string
  backup_diario: boolean
  backup_semanal: boolean
  espaco_disco_gb: number
  banda_largura_gb: number
  php_version: string
  wordpress_instalado: boolean
  wp_version?: string
  wp_atualizacoes: boolean
  created_at: string
  updated_at: string
}

export interface Pagamento {
  id: string
  cliente_id: string
  site_id?: string
  valor: number
  moeda: string
  data_pagamento?: string
  data_vencimento: string
  metodo_pagamento: 'mpesa' | 'transferencia' | 'paypal' | 'multicaixa' | 'referencia' | 'cash'
  status: 'pending' | 'paid' | 'overdue' | 'cancelled' | 'refunded'
  referencia?: string
  descricao?: string
  notas?: string
  fatura_gerada: boolean
  fatura_enviada: boolean
  recibo_gerado: boolean
  created_at: string
  updated_at: string
}

export interface TicketSuporte {
  id: string
  cliente_id: string
  site_id?: string
  assunto: string
  descricao: string
  categoria: 'general' | 'technical' | 'billing' | 'domain' | 'email' | 'ssl' | 'backup'
  prioridade: 'low' | 'normal' | 'high' | 'urgent'
  status: 'open' | 'in_progress' | 'waiting_client' | 'resolved' | 'closed'
  atribuido_a?: string
  created_at: string
  updated_at: string
  resolvido_em?: string
}

export interface TicketResposta {
  id: string
  ticket_id: string
  cliente_id: string
  resposta: string
  anexo_url?: string
  respondente: 'client' | 'admin' | 'support'
  criado_por?: string
  created_at: string
}

export interface Notificacao {
  id: string
  cliente_id: string
  site_id?: string
  pagamento_id?: string
  tipo: 'renewal_warning' | 'suspension_warning' | 'expiration_notice' | 'payment_confirmation' | 'site_created' | 'site_suspended' | 'site_reactivated' | 'ssl_expiry' | 'backup_success' | 'backup_failed'
  titulo: string
  mensagem: string
  data_envio?: string
  data_leitura?: string
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed'
  canal: 'email' | 'sms' | 'dashboard' | 'whatsapp'
  prioridade: 'low' | 'normal' | 'high' | 'urgent'
  automatica: boolean
  template_usado?: string
  created_at: string
}

// FUNÇÕES PRINCIPAIS
export async function listarClientes() {
  try {
    const { data, error } = await supabase
      .from('clientes')
      .select(`
        *,
        sites_cliente (
          id,
          dominio,
          plano,
          preco_mensal,
          data_renovacao,
          status,
          ssl,
          ssl_expira,
          pagamentos (
            id,
            valor,
            data_vencimento,
            status,
            metodo_pagamento
          )
        )
      `)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Erro ao listar clientes:', error)
    throw error
  }
}

export async function criarCliente(dados: Partial<Cliente>) {
  try {
    const { data, error } = await supabase
      .from('clientes')
      .insert([dados])
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error('Erro ao criar cliente:', error)
    throw error
  }
}

export async function editarCliente(id: string, dados: Partial<Cliente>) {
  try {
    const { data, error } = await supabase
      .from('clientes')
      .update(dados)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error('Erro ao editar cliente:', error)
    throw error
  }
}

export async function listarSitesCliente(clienteId: string) {
  try {
    const { data, error } = await supabase
      .from('sites_cliente')
      .select(`
        *,
        pagamentos (
          id,
          valor,
          data_vencimento,
          status,
          metodo_pagamento
        )
      `)
      .eq('cliente_id', clienteId)
      .order('data_criacao', { ascending: false })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Erro ao listar sites do cliente:', error)
    throw error
  }
}

export async function registarPagamento(dados: Partial<Pagamento>) {
  try {
    const { data, error } = await supabase
      .from('pagamentos')
      .insert([dados])
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error('Erro ao registar pagamento:', error)
    throw error
  }
}

export async function listarPagamentos(clienteId: string) {
  try {
    const { data, error } = await supabase
      .from('pagamentos')
      .select(`
        *,
        sites_cliente (
          dominio
        )
      `)
      .eq('cliente_id', clienteId)
      .order('data_vencimento', { ascending: false })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Erro ao listar pagamentos:', error)
    throw error
  }
}

export async function clientesAExpirar(dias: number = 30) {
  try {
    const { data, error } = await supabase
      .from('dashboard_cliente_sites')
      .select('*')
      .lte('data_renovacao', new Date(Date.now() + dias * 24 * 60 * 60 * 1000).toISOString())
      .gte('data_renovacao', new Date().toISOString())
      .in('status_pagamento', ['ok', 'atencao'])

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Erro ao listar clientes a expirar:', error)
    throw error
  }
}

export async function criarTicket(dados: Partial<TicketSuporte>) {
  try {
    const { data, error } = await supabase
      .from('tickets_suporte')
      .insert([dados])
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error('Erro ao criar ticket:', error)
    throw error
  }
}

export async function responderTicket(ticketId: string, resposta: Partial<TicketResposta>) {
  try {
    // Atualizar status do ticket
    await supabase
      .from('tickets_suporte')
      .update({ 
        status: 'waiting_client',
        updated_at: new Date().toISOString()
      })
      .eq('id', ticketId)

    // Inserir resposta
    const { data, error } = await supabase
      .from('ticket_respostas')
      .insert([resposta])
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error('Erro ao responder ticket:', error)
    throw error
  }
}

export async function listarTickets(clienteId?: string) {
  try {
    let query = supabase
      .from('tickets_suporte')
      .select(`
        *,
        ticket_respostas (
          id,
          resposta,
          respondente,
          criado_por,
          created_at
        )
      `)
      .order('created_at', { ascending: false })

    if (clienteId) {
      query = query.eq('cliente_id', clienteId)
    }

    const { data, error } = await query

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Erro ao listar tickets:', error)
    throw error
  }
}

// FUNÇÕES AUXILIARES
export async function getClientePorId(id: string) {
  try {
    const { data, error } = await supabase
      .from('clientes')
      .select(`
        *,
        sites_cliente (
          id,
          dominio,
          plano,
          preco_mensal,
          data_renovacao,
          status,
          ssl,
          ssl_expira,
          pagamentos (
            id,
            valor,
            data_vencimento,
            status,
            metodo_pagamento
          )
        )
      `)
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error('Erro ao obter cliente:', error)
    throw error
  }
}

export async function getSitePorId(id: string) {
  try {
    const { data, error } = await supabase
      .from('sites_cliente')
      .select(`
        *,
        clientes (
          id,
          nome,
          email,
          telefone
        ),
        pagamentos (
          id,
          valor,
          data_vencimento,
          status,
          metodo_pagamento
        )
      `)
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error('Erro ao obter site:', error)
    throw error
  }
}

export async function atualizarUltimoAcesso(clienteId: string) {
  try {
    const { error } = await supabase
      .from('clientes')
      .update({ 
        ultimo_acesso: new Date().toISOString()
      })
      .eq('id', clienteId)

    if (error) throw error
    return true
  } catch (error) {
    console.error('Erro ao atualizar último acesso:', error)
    throw error
  }
}

export async function listarSubscritores(dominio?: string) {
  try {
    let query = supabase
      .from('newsletter_subscribers')
      .select('*')
      .order('created_at', { ascending: false })

    if (dominio) {
      // Filtering by domain in metadata
      query = query.contains('metadata', { domain: dominio })
    }

    const { data, error } = await query

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Erro ao listar subscritores:', error)
    throw error
  }
}

export async function adicionarSubscritor(dados: { email: string, full_name?: string, domain: string }) {
  try {
    const { data, error } = await supabase
      .from('newsletter_subscribers')
      .upsert({
        email: dados.email,
        full_name: dados.full_name,
        metadata: { domain: dados.domain },
        status: 'subscribed',
        updated_at: new Date().toISOString()
      }, { onConflict: 'email' })
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error('Erro ao adicionar subscritor:', error)
    throw error
  }
}

export async function removerSubscritor(id: string) {
  try {
    const { error } = await supabase
      .from('newsletter_subscribers')
      .delete()
      .eq('id', id)

    if (error) throw error
    return true
  } catch (error) {
    console.error('Erro ao remover subscritor:', error)
    throw error
  }
}

export async function listarCampanhas(dominio?: string) {
  try {
    let query = supabase
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
    console.error('Erro ao listar campanhas:', error)
    throw error
  }
}

export async function salvarCampanha(dados: { subject: string, content_html: string, total_recipients?: number, domain: string, status?: string }) {
  try {
    const { data, error } = await supabase
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
    console.error('Erro ao salvar campanha:', error)
    throw error
  }
}

export async function removerCampanha(id: string) {
  try {
    const { error } = await supabase
      .from('email_campaigns')
      .delete()
      .eq('id', id)

    if (error) throw error
    return true
  } catch (error) {
    console.error('Erro ao remover campanha:', error)
    return false
  }
}

export async function registrarAtividade(
  usuarioId: string,
  usuarioTipo: 'admin' | 'client',
  acao: string,
  clienteId?: string,
  siteId?: string,
  detalhes?: string
) {
  try {
    const { error } = await supabase
      .from('activity_logs')
      .insert({
        usuario_id: usuarioId,
        usuario_tipo: usuarioTipo,
        cliente_id: clienteId,
        site_id: siteId,
        acao,
        detalhes,
        ip_address: '127.0.0.1', // TODO: Obter IP real
        user_agent: navigator.userAgent // TODO: Obter user agent real
      })

    if (error) throw error
    return true
  } catch (error) {
    console.error('Erro ao registrar atividade:', error)
    throw error
  }
}

export default {
  listarClientes,
  criarCliente,
  editarCliente,
  listarSitesCliente,
  registarPagamento,
  listarPagamentos,
  clientesAExpirar,
  criarTicket,
  responderTicket,
  listarTickets,
  getClientePorId,
  getSitePorId,
  atualizarUltimoAcesso,
  registrarAtividade,
  listarSubscritores,
  adicionarSubscritor,
  removerSubscritor,
  listarCampanhas,
  salvarCampanha,
  removerCampanha
}
