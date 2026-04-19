import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { 
  getTemplateByDays, 
  processTemplate, 
  TemplateVariables,
  getActiveReminderDays 
} from '@/lib/renewal-templates'

// Cron secret para segurança
const CRON_SECRET = process.env.CRON_SECRET || 'default-secret-change-in-production'

// Verificar renovações e enviar notificações
export async function GET(request: NextRequest) {
  try {
    // Verificar autorização (pode ser cron job ou admin)
    const authHeader = request.headers.get('authorization')
    const { searchParams } = new URL(request.url)
    const secret = searchParams.get('secret')
    
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    const adminEmails = ['admin@visualdesigne.com', 'silva.chamo@gmail.com', 'geral@visualdesigne.com', 'suporte@visualdesigne.com']
    const isAdmin = user && adminEmails.includes(user.email || '')
    
    if (!isAdmin && secret !== CRON_SECRET) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    const supabaseAdmin = createAdminClient(supabaseUrl, supabaseKey)

    // Buscar dias de lembrete ativos
    const reminderDays = getActiveReminderDays()
    
    const results = {
      processed: 0,
      notifications: 0,
      emails: 0,
      errors: [] as string[],
      details: [] as any[]
    }

    // Processar cada dia de lembrete
    for (const days of reminderDays) {
      try {
        // Buscar renovações próximas usando a função do Supabase
        const { data: upcomingRenewals, error } = await supabaseAdmin
          .rpc('get_upcoming_renewals', { p_days: days })

        if (error) {
          results.errors.push(`Erro ao buscar renovações ${days} dias: ${error.message}`)
          continue
        }

        if (!upcomingRenewals || upcomingRenewals.length === 0) {
          continue
        }

        const template = getTemplateByDays(days)
        if (!template) {
          results.errors.push(`Template não encontrado para ${days} dias`)
          continue
        }

        // Processar cada renovação
        for (const renewal of upcomingRenewals) {
          try {
            // Buscar dados do usuário
            const { data: { user: userData } } = await supabaseAdmin.auth.admin.getUserById(renewal.user_id)
            
            if (!userData) {
              results.errors.push(`Usuário não encontrado: ${renewal.user_id}`)
              continue
            }

            const clientName = userData.user_metadata?.full_name || userData.email?.split('@')[0] || 'Cliente'
            
            // Preparar variáveis
            const variables: TemplateVariables = {
              clientName,
              serviceName: renewal.service_name,
              expirationDate: new Date(renewal.expiration_date).toLocaleDateString('pt-PT'),
              daysRemaining: renewal.days_remaining,
              renewalPrice: `${renewal.renewal_price || 0} €`,
              renewalLink: `https://visualdesigne.com/dashboard/renewals?service=${renewal.service_id}`,
              companyName: 'VisualDesign',
              supportEmail: 'suporte@visualdesigne.com',
              supportPhone: '+351 XXX XXX XXX'
            }

            // Processar template
            const processedTemplate = processTemplate(template, variables)

            // Criar notificação
            const { data: notification, error: notifError } = await supabaseAdmin
              .from('notifications')
              .insert({
                user_id: renewal.user_id,
                title: processedTemplate.title,
                message: processedTemplate.message,
                type: processedTemplate.type,
                category: 'payment',
                link: variables.renewalLink,
                link_text: 'Renovar Agora',
                email_sent: false
              })
              .select()
              .single()

            if (notifError) {
              results.errors.push(`Erro ao criar notificação: ${notifError.message}`)
              continue
            }

            // Registrar lembrete
            await supabaseAdmin.rpc('record_renewal_reminder', {
              p_user_id: renewal.user_id,
              p_service_type: renewal.service_type,
              p_service_id: renewal.service_id,
              p_service_name: renewal.service_name,
              p_expiration_date: renewal.expiration_date,
              p_reminder_days: days,
              p_notification_id: notification.id,
              p_email_sent: false
            })

            results.notifications++
            results.details.push({
              service: renewal.service_name,
              days,
              user: clientName,
              notificationId: notification.id
            })

            // Aqui enviaria email quando o sistema de email estiver pronto
            // sendRenewalEmail(userData.email, processedTemplate.emailSubject, processedTemplate.emailBody)

          } catch (itemError: any) {
            results.errors.push(`Erro ao processar ${renewal.service_name}: ${itemError.message}`)
          }
        }

        results.processed += upcomingRenewals.length

      } catch (daysError: any) {
        results.errors.push(`Erro no processamento de ${days} dias: ${daysError.message}`)
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...results
    })

  } catch (error: any) {
    console.error('Erro no cron de renovação:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Erro interno',
      details: error.message 
    }, { status: 500 })
  }
}

// POST para executar manualmente (admin)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    const adminEmails = ['admin@visualdesigne.com', 'silva.chamo@gmail.com', 'geral@visualdesigne.com', 'suporte@visualdesigne.com']
    
    if (!user || !adminEmails.includes(user.email || '')) {
      return NextResponse.json({ error: 'Acesso restrito a administradores' }, { status: 403 })
    }

    // Executar mesma lógica do GET
    return GET(request)

  } catch (error: any) {
    console.error('Erro ao executar verificação manual:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
