import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

// Listar métodos de pagamento do usuário
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { data: methods, error } = await supabase
      .from('user_payment_methods')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('is_default', { ascending: false })

    if (error) throw error

    return NextResponse.json({ success: true, methods: methods || [] })
  } catch (error) {
    console.error('Erro ao buscar métodos de pagamento:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// Adicionar novo método de pagamento
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { type, provider, account_number, account_name, is_default, metadata } = body

    // Cartões só podem ser adicionados através do fluxo Stripe SetupIntent
    // (/api/payments/setup-intent + /api/payments/confirm-card), que verifica o
    // cartão junto da Stripe antes de gravar. Isto impede que alguém insira
    // metadata (stripe_customer_id/stripe_payment_method_id) inventada e passe
    // a "pagar" com um cartão que não foi validado.
    if (type === 'cartao') {
      return NextResponse.json(
        { error: 'Use o fluxo de adicionar cartão em /pagamento/metodos.' },
        { status: 400 },
      )
    }

    // Se for default, remove default dos outros
    if (is_default) {
      await supabase
        .from('user_payment_methods')
        .update({ is_default: false })
        .eq('user_id', user.id)
    }

    const { data, error } = await supabase
      .from('user_payment_methods')
      .insert({
        user_id: user.id,
        type,
        provider,
        account_number,
        account_name,
        is_default: is_default || false,
        metadata: metadata || {}
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, method: data })
  } catch (error) {
    console.error('Erro ao adicionar método de pagamento:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// Actualizar método de pagamento
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { id, is_default, is_active } = body

    // Se for default, remove default dos outros
    if (is_default) {
      await supabase
        .from('user_payment_methods')
        .update({ is_default: false })
        .eq('user_id', user.id)
        .neq('id', id)
    }

    const { data, error } = await supabase
      .from('user_payment_methods')
      .update({ is_default, is_active, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, method: data })
  } catch (error) {
    console.error('Erro ao actualizar método de pagamento:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
