import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// Verificar se é admin
async function checkIsAdmin(supabase: any): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  
  const adminEmails = ['admin@visualdesigne.com', 'silva.chamo@gmail.com', 'geral@visualdesigne.com', 'suporte@visualdesigne.com']
  return adminEmails.includes(user.email || '') || user.user_metadata?.role === 'admin'
}

// Listar renovações do usuário
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const userIsAdmin = await checkIsAdmin(supabase)
    const userId = userIsAdmin ? (searchParams.get('userId') || user.id) : user.id
    const type = searchParams.get('type') // 'domain' ou 'hosting'
    const status = searchParams.get('status')
    const days = searchParams.get('days') // dias até vencimento

    let result: any = { domains: [], hosting: [] }

    // Buscar domínios
    if (!type || type === 'domain') {
      let query = supabase
        .from('domain_renewals')
        .select('*')
        .eq('user_id', userId)
        .order('expiration_date', { ascending: true })

      if (status) query = query.eq('status', status)
      if (days) {
        const targetDate = new Date()
        targetDate.setDate(targetDate.getDate() + parseInt(days))
        query = query.lte('expiration_date', targetDate.toISOString().split('T')[0])
      }

      const { data: domains } = await query
      result.domains = domains || []
    }

    // Buscar hospedagens
    if (!type || type === 'hosting') {
      let query = supabase
        .from('hosting_renewals')
        .select('*')
        .eq('user_id', userId)
        .order('expiration_date', { ascending: true })

      if (status) query = query.eq('status', status)
      if (days) {
        const targetDate = new Date()
        targetDate.setDate(targetDate.getDate() + parseInt(days))
        query = query.lte('expiration_date', targetDate.toISOString().split('T')[0])
      }

      const { data: hosting } = await query
      result.hosting = hosting || []
    }

    // Calcular estatísticas
    const allServices = [...result.domains, ...result.hosting]
    const stats = {
      total: allServices.length,
      active: allServices.filter(s => s.status === 'active').length,
      expired: allServices.filter(s => s.status === 'expired').length,
      expiring30Days: allServices.filter(s => {
        const days = Math.ceil((new Date(s.expiration_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        return days <= 30 && days > 0
      }).length,
      expiring60Days: allServices.filter(s => {
        const days = Math.ceil((new Date(s.expiration_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        return days <= 60 && days > 30
      }).length
    }

    return NextResponse.json({
      success: true,
      ...result,
      stats
    })
  } catch (error) {
    console.error('Erro ao buscar renovações:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// Criar renovação (admin)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    if (!(await checkIsAdmin(supabase))) {
      return NextResponse.json({ error: 'Acesso restrito' }, { status: 403 })
    }

    const { 
      type, // 'domain' ou 'hosting'
      userId,
      domainName,
      expirationDate,
      renewalPrice,
      autoRenew = false,
      notes = ''
    } = await request.json()

    if (!type || !userId || !domainName || !expirationDate) {
      return NextResponse.json({ error: 'Campos obrigatórios: type, userId, domainName, expirationDate' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    const supabaseAdmin = createAdminClient(supabaseUrl, supabaseKey)

    let data

    if (type === 'domain') {
      const { data: domain, error } = await supabaseAdmin
        .from('domain_renewals')
        .insert({
          user_id: userId,
          domain_name: domainName,
          expiration_date: expirationDate,
          renewal_price: renewalPrice || 15.00,
          auto_renew: autoRenew,
          notes
        })
        .select()
        .single()

      if (error) throw error
      data = domain
    } else {
      const { data: hosting, error } = await supabaseAdmin
        .from('hosting_renewals')
        .insert({
          user_id: userId,
          domain_name: domainName,
          expiration_date: expirationDate,
          renewal_price: renewalPrice || 50.00,
          auto_renew: autoRenew,
          notes
        })
        .select()
        .single()

      if (error) throw error
      data = hosting
    }

    return NextResponse.json({
      success: true,
      message: `${type === 'domain' ? 'Domínio' : 'Hospedagem'} cadastrado com sucesso`,
      data
    })
  } catch (error) {
    console.error('Erro ao criar renovação:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
