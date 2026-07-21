import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { sendEmail as sendTransactionalEmail } from '@/lib/email-service'
import { emailHeader, emailFooter, wrapContentInFrame } from '@/lib/renewal-templates'

// Verificar se é admin
async function isAdmin(supabase: any): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const adminEmails = ['admin@visualdesignmoz.com', 'silva.chamo@gmail.com', 'geral@visualdesignmoz.com', 'suporte@visualdesignmoz.com']
  return adminEmails.includes(user.email || '') || user.user_metadata?.role === 'admin'
}

const SUPPORT_EMAIL = 'suporte@visualdesignmoz.com'
const SUPPORT_PHONE = '+258 85 242 5525'
const COMPANY_NAME = 'VisualDesign'

// Tipo de notificação -> cor da barra do quadro no email
function urgencyForType(type: string): string {
  switch (type) {
    case 'error': return 'critical'
    case 'warning': return 'medium'
    case 'success':
    case 'info':
    default: return 'low'
  }
}

function buildNotificationEmailHtml(params: {
  clientName: string
  title: string
  message: string
  link?: string
  linkText?: string
  type: string
}): string {
  const { clientName, title, message, link, linkText, type } = params

  const body = `
    <h2 style="margin: 0 0 12px 0; color: #111827; font-size: 18px; font-family: 'Exo 2', sans-serif; font-weight: 600;">${title}</h2>
    <p style="margin: 0; color: #374151; font-size: 14px; line-height: 1.6; white-space: pre-line; font-family: 'Exo 2', sans-serif; font-weight: normal;">${message}</p>
    ${link ? `<p style="margin: 20px 0 0 0;"><a href="${link}" style="display: inline-block; padding: 10px 20px; background: #dc2626; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 14px; font-family: 'Exo 2', sans-serif;">${linkText || 'Ver mais'}</a></p>` : ''}
  `

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Exo 2', sans-serif; background: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family: 'Exo 2', sans-serif;">
    <tr>
      <td align="center" style="padding: 10px 0; background: #f3f4f6; font-family: 'Exo 2', sans-serif;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.15); font-family: 'Exo 2', sans-serif;">
          <tr><td>${emailHeader(clientName, COMPANY_NAME)}</td></tr>
          <tr><td style="padding: 20px;">${wrapContentInFrame(body, urgencyForType(type))}</td></tr>
          <tr><td>${emailFooter(SUPPORT_EMAIL, SUPPORT_PHONE, COMPANY_NAME)}</td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
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
              html: buildNotificationEmailHtml({ clientName, title, message, link, linkText, type }),
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
              html: buildNotificationEmailHtml({ clientName, title, message, link, linkText, type }),
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
