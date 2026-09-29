import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { sendEmail as sendTransactionalEmail } from '@/lib/email-service'
import { buildSimpleNotificationEmailHtml as buildNotificationEmailHtml } from '@/lib/renewal-templates'

// Verificar se é admin
async function isAdmin(supabase: any): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const adminEmails = ['admin@visualdesignmoz.com', 'silva.chamo@gmail.com', 'geral@visualdesignmoz.com', 'suporte@visualdesignmoz.com']
  return adminEmails.includes(user.email || '') || user.app_metadata?.role === 'admin'
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
      messageHtml,
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
        email_sent: false
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

      let emailsSent = 0
      let emailsFailed = 0

      // Se solicitado, enviar emails (um por usuário, sem derrubar o lote todo em caso de falha pontual)
      if (sendEmail) {
        const sentNotificationIds: string[] = []

        for (let i = 0; i < users.users.length; i++) {
          const user = users.users[i]
          const notification = notifications?.[i]
          if (!user.email || !notification) continue

          try {
            const clientName = user.user_metadata?.full_name || user.email.split('@')[0] || 'Cliente'
            await sendTransactionalEmail({
              to: user.email,
              subject: title,
              html: buildNotificationEmailHtml({ clientName, title, message, messageHtml, link, linkText, type }),
              category: 'transactional'
            })
            emailsSent++
            sentNotificationIds.push(notification.id)
          } catch (emailError) {
            emailsFailed++
            console.error(`❌ Falha ao enviar email de notificação para ${user.email}:`, emailError)
          }
        }

        if (sentNotificationIds.length > 0) {
          await supabaseAdmin
            .from('notifications')
            .update({ email_sent: true })
            .in('id', sentNotificationIds)
        }
      }

      return NextResponse.json({
        success: true,
        message: `Notificação enviada para ${users.users.length} usuários`,
        count: users.users.length,
        emailsSent,
        emailsFailed,
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
          email_sent: false
        })
        .select()
        .single()

      if (error) {
        console.error('Erro ao criar notificação:', error)
        return NextResponse.json({ error: 'Erro ao criar notificação' }, { status: 500 })
      }

      let emailSent = false
      let emailError: string | undefined

      if (sendEmail) {
        const { data: { user: targetUser } } = await supabaseAdmin.auth.admin.getUserById(userId)

        if (!targetUser?.email) {
          emailError = 'Usuário sem email cadastrado'
        } else {
          try {
            const clientName = targetUser.user_metadata?.full_name || targetUser.email.split('@')[0] || 'Cliente'
            await sendTransactionalEmail({
              to: targetUser.email,
              subject: title,
              html: buildNotificationEmailHtml({ clientName, title, message, messageHtml, link, linkText, type }),
              category: 'transactional'
            })
            emailSent = true
            await supabaseAdmin.from('notifications').update({ email_sent: true }).eq('id', data.id)
          } catch (err) {
            emailError = err instanceof Error ? err.message : 'Erro desconhecido'
            console.error(`❌ Falha ao enviar email de notificação para ${targetUser.email}:`, err)
          }
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Notificação criada com sucesso',
        notification: { ...data, email_sent: emailSent },
        emailSent,
        emailError
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
    const category = searchParams.get('category')

    let query = supabaseAdmin
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (userId) {
      query = query.eq('user_id', userId)
    }
    if (category) {
      query = query.eq('category', category)
    }

    // Contagens têm de respeitar os mesmos filtros (userId/category) da lista
    // principal -- caso contrário o cabeçalho mostra totais globais enquanto
    // a lista já vem filtrada, dando números que não batem certo (ex.: "Total: 2"
    // com só 1 linha visível no separador "Servidor").
    function countQuery() {
      let q = supabaseAdmin.from('notifications').select('*', { count: 'exact', head: true })
      if (userId) q = q.eq('user_id', userId)
      if (category) q = q.eq('category', category)
      return q
    }

    // A lista principal e as 3 contagens de estatísticas são independentes
    // entre si — correr em paralelo (Promise.all) em vez de 4 pedidos em
    // sequência. Cada pedido a este Supabase (self-hosted) demora ~0.8s de
    // latência de rede; em sequência isso são ~3-4s só nesta rota.
    const [{ data: notifications, error }, totalRes, unreadRes, emailSentRes] = await Promise.all([
      query,
      countQuery(),
      countQuery().eq('read', false),
      countQuery().eq('email_sent', true),
    ])

    if (error) {
      console.error('Erro ao buscar notificações admin:', error)
      return NextResponse.json({ error: 'Erro ao buscar notificações' }, { status: 500 })
    }

    const totalCount = totalRes.count
    const unreadCount = unreadRes.count
    const emailSentCount = emailSentRes.count

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

// Marcar como lida
export async function PATCH(request: NextRequest) {
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
      .update({
        read: true,
        read_at: new Date().toISOString()
      })
      .eq('id', id)

    if (error) {
      console.error('Erro ao marcar notificação como lida:', error)
      return NextResponse.json({ error: 'Erro ao marcar como lida' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro no PATCH notificação:', error)
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
