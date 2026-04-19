import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// Verificar se é admin
async function isAdmin(supabase: any): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  
  const adminEmails = ['admin@visualdesigne.com', 'silva.chamo@gmail.com', 'geral@visualdesigne.com', 'suporte@visualdesigne.com']
  return adminEmails.includes(user.email || '') || user.user_metadata?.role === 'admin'
}

// Criar notificação para usuário específico ou todos
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    if (!(await isAdmin(supabase))) {
      return NextResponse.json({ error: 'Acesso restrito a administradores' }, { status: 403 })
    }

    const { 
      userId, 
      title, 
      message, 
      type = 'info', 
      category = 'general',
      link,
      linkText,
      sendEmail = false,
      sendToAll = false 
    } = await request.json()

    if (!title || !message) {
      return NextResponse.json({ error: 'Título e mensagem são obrigatórios' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    const supabaseAdmin = createAdminClient(supabaseUrl, supabaseKey)

    let notifications = []

    if (sendToAll) {
      // Enviar para todos os usuários
      const { data: users } = await supabaseAdmin.auth.admin.listUsers()
      
      if (!users?.users?.length) {
        return NextResponse.json({ error: 'Nenhum usuário encontrado' }, { status: 404 })
      }

      const notificationsToInsert = users.users.map((user: any) => ({
        user_id: user.id,
        title,
        message,
        type,
        category,
        link,
        link_text: linkText,
        email_sent: sendEmail
      }))

      const { data, error } = await supabaseAdmin
        .from('notifications')
        .insert(notificationsToInsert)
        .select()

      if (error) {
        console.error('Erro ao criar notificações em massa:', error)
        return NextResponse.json({ error: 'Erro ao criar notificações' }, { status: 500 })
      }

      notifications = data

      // Se solicitado, enviar emails
      if (sendEmail) {
        // Aqui integraríamos com o sistema de email
        // Por enquanto, apenas registramos que deveria enviar
        console.log(`📧 Deveria enviar ${users.users.length} emails de notificação`)
      }

      return NextResponse.json({
        success: true,
        message: `Notificação enviada para ${users.users.length} usuários`,
        count: users.users.length,
        notifications
      })
    } else if (userId) {
      // Enviar para usuário específico
      const { data, error } = await supabaseAdmin
        .from('notifications')
        .insert({
          user_id: userId,
          title,
          message,
          type,
          category,
          link,
          link_text: linkText,
          email_sent: sendEmail
        })
        .select()
        .single()

      if (error) {
        console.error('Erro ao criar notificação:', error)
        return NextResponse.json({ error: 'Erro ao criar notificação' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: 'Notificação criada com sucesso',
        notification: data
      })
    } else {
      return NextResponse.json({ error: 'userId ou sendToAll obrigatório' }, { status: 400 })
    }
  } catch (error) {
    console.error('Erro no POST notificação admin:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// Listar todas as notificações (com estatísticas)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    if (!(await isAdmin(supabase))) {
      return NextResponse.json({ error: 'Acesso restrito' }, { status: 403 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    const supabaseAdmin = createAdminClient(supabaseUrl, supabaseKey)

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '100')
    const userId = searchParams.get('userId')

    let query = supabaseAdmin
      .from('notifications')
      .select('*, users:auth.users!inner(email)')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (userId) {
      query = query.eq('user_id', userId)
    }

    const { data: notifications, error } = await query

    if (error) {
      console.error('Erro ao buscar notificações admin:', error)
      return NextResponse.json({ error: 'Erro ao buscar notificações' }, { status: 500 })
    }

    // Estatísticas
    const { count: totalCount } = await supabaseAdmin
      .from('notifications')
      .select('*', { count: 'exact', head: true })

    const { count: unreadCount } = await supabaseAdmin
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('read', false)

    const { count: emailSentCount } = await supabaseAdmin
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('email_sent', true)

    return NextResponse.json({
      success: true,
      notifications: notifications || [],
      stats: {
        total: totalCount || 0,
        unread: unreadCount || 0,
        emailSent: emailSentCount || 0
      }
    })
  } catch (error) {
    console.error('Erro no GET notificações admin:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// Deletar notificação
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    if (!(await isAdmin(supabase))) {
      return NextResponse.json({ error: 'Acesso restrito' }, { status: 403 })
    }

    const { id } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    const supabaseAdmin = createAdminClient(supabaseUrl, supabaseKey)

    const { error } = await supabaseAdmin
      .from('notifications')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Erro ao deletar notificação:', error)
      return NextResponse.json({ error: 'Erro ao deletar' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Notificação deletada'
    })
  } catch (error) {
    console.error('Erro no DELETE notificação:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
