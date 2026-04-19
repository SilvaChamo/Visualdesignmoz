import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

// Listar notificações do usuário
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const unreadOnly = searchParams.get('unread') === 'true'
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)
      .range(offset, offset + limit - 1)

    if (unreadOnly) {
      query = query.eq('read', false)
    }

    const { data: notifications, error } = await query

    if (error) {
      console.error('Erro ao buscar notificações:', error)
      return NextResponse.json({ error: 'Erro ao buscar notificações' }, { status: 500 })
    }

    // Contar não lidas
    const { count: unreadCount } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('read', false)

    return NextResponse.json({
      success: true,
      notifications: notifications || [],
      unreadCount: unreadCount || 0,
      total: notifications?.length || 0
    })
  } catch (error) {
    console.error('Erro no GET notificações:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// Marcar notificação como lida
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id, read = true } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'ID da notificação obrigatório' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('notifications')
      .update({ 
        read, 
        read_at: read ? new Date().toISOString() : null 
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Erro ao atualizar notificação:', error)
      return NextResponse.json({ error: 'Erro ao atualizar notificação' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: read ? 'Notificação marcada como lida' : 'Notificação marcada como não lida',
      notification: data
    })
  } catch (error) {
    console.error('Erro no PATCH notificação:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// Marcar todas como lidas
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { error } = await supabase
      .from('notifications')
      .update({ 
        read: true, 
        read_at: new Date().toISOString() 
      })
      .eq('user_id', user.id)
      .eq('read', false)

    if (error) {
      console.error('Erro ao marcar todas como lidas:', error)
      return NextResponse.json({ error: 'Erro ao atualizar notificações' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Todas as notificações marcadas como lidas'
    })
  } catch (error) {
    console.error('Erro no PUT notificações:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
