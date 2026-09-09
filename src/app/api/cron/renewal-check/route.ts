import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import {
  processTemplate,
  TemplateVariables,
  getServerRenewalTemplates
} from '@/lib/renewal-templates'
import { sendEmail } from '@/lib/email-service'
import { EMAIL_PLAN_PACKAGE_NAME } from '@/lib/email-plan-provision'
import { suspendOverdueHostingAccounts } from '@/lib/overdue-hosting-suspend'

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
    
    const adminEmails = ['admin@visualdesignmoz.com', 'silva.chamo@gmail.com', 'geral@visualdesignmoz.com', 'suporte@visualdesignmoz.com']
    const isAdmin = user && adminEmails.includes(user.email || '')
    
    if (!isAdmin && secret !== CRON_SECRET) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    const supabaseAdmin = createAdminClient(supabaseUrl, supabaseKey)

    // Templates reais (com quaisquer edições guardadas em renewal_templates),
    // carregados uma única vez — getTemplateByDays/getActiveReminderDays não
    // servem aqui porque assumem `window` (browser) e no servidor caem sempre
    // no conteúdo padrão, ignorando edições feitas em Templates de Renovação.
    const templates = await getServerRenewalTemplates(supabaseAdmin)

    // Buscar dias de lembrete activos
    const reminderDays = templates
      .filter(t => t.daysBefore > 0)
      .map(t => t.daysBefore)
      .sort((a, b) => b - a)
    
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

        const template = templates.find(t => t.daysBefore === days)
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

            // Marca de deduplicação para este serviço+dias. A tabela renewal_reminders
            // (pensada originalmente para isto) não existe em produção — em vez de
            // depender dela, embutimos a marca no próprio link da notificação e
            // verificamos aqui se já existe uma notificação igual antes de criar
            // outra. Evita reenviar o mesmo aviso em todos os cron runs seguintes.
            const reminderTag = `rid=${renewal.service_type}:${renewal.service_id}:${days}`
            const { data: alreadyReminded } = await supabaseAdmin
              .from('notifications')
              .select('id')
              .eq('user_id', renewal.user_id)
              .ilike('link', `%${reminderTag}%`)
              .limit(1)

            if (alreadyReminded && alreadyReminded.length > 0) {
              continue
            }

            // Planos de email (compra "Email Básico") ficam guardados na mesma
            // tabela de hospedagem, com server='Mail' — não há tabela própria.
            // Aqui só ajustamos o texto do aviso para dizer "Email", não "Hospedagem".
            let serviceLabel = renewal.service_name
            if (renewal.service_type === 'hosting') {
              const { data: hostingRow } = await supabaseAdmin
                .from('hosting_renewals')
                .select('server, package_name')
                .eq('id', renewal.service_id)
                .maybeSingle()
              if (hostingRow?.server === 'Mail' || hostingRow?.package_name === EMAIL_PLAN_PACKAGE_NAME) {
                serviceLabel = `${EMAIL_PLAN_PACKAGE_NAME} - ${renewal.service_name}`
              }
            }

            // Método de pagamento habitual do cliente: último usado num pagamento
            // de renovação real (renewal_payment_requests). Sem histórico, fica
            // por definir — não inventamos um método que o cliente nunca escolheu.
            const { data: lastPayment } = await supabaseAdmin
              .from('renewal_payment_requests')
              .select('metodo_pagamento')
              .eq('user_id', renewal.user_id)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle()

            const paymentMethodLabels: Record<string, string> = {
              mpesa: 'M-Pesa',
              transferencia: 'Transferência Bancária',
              stripe: 'Cartão'
            }
            const paymentMethod = lastPayment?.metodo_pagamento
              ? (paymentMethodLabels[lastPayment.metodo_pagamento] || lastPayment.metodo_pagamento)
              : 'A escolher no pagamento'

            // Saldo de crédito do cliente (client_credits). A tabela pode ainda
            // não existir em produção — nesse caso trata-se sempre como 0,00,
            // nunca inventa um valor.
            const subtotalValue = renewal.renewal_price || 0
            let creditValue = 0
            try {
              const { data: creditRow } = await supabaseAdmin
                .from('client_credits')
                .select('saldo_mt')
                .eq('user_id', renewal.user_id)
                .maybeSingle()
              creditValue = Math.min(creditRow?.saldo_mt || 0, subtotalValue)
            } catch {
              creditValue = 0
            }
            const totalValue = subtotalValue - creditValue
            const formatMt = (n: number) => `${n.toLocaleString('pt-MZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MT`

            // Número da factura do ciclo de cobrança: atribuído uma única vez por
            // (service_type, service_id, expiration_date) — normalmente aqui, na
            // primeira notificação processada para este ciclo (o lembrete de 60
            // dias, o mais distante) — e devolvido tal e qual em todos os
            // lembretes seguintes do mesmo ciclo, incluindo a confirmação. Ver
            // assign_renewal_invoice_number() em supabase-renewal-invoices.sql.
            let invoiceNumber = ''
            let invoiceDate = ''
            try {
              const { data: invoiceRow, error: invoiceError } = await supabaseAdmin
                .rpc('assign_renewal_invoice_number', {
                  p_service_type: renewal.service_type,
                  p_service_id: renewal.service_id,
                  p_user_id: renewal.user_id,
                  p_expiration_date: renewal.expiration_date
                })
                .single()
              if (invoiceError) throw invoiceError
              invoiceNumber = (invoiceRow as any)?.invoice_number || ''
              invoiceDate = (invoiceRow as any)?.issued_at
                ? new Date((invoiceRow as any).issued_at).toLocaleDateString('pt-MZ')
                : ''
            } catch (invoiceErr: any) {
              results.errors.push(`Falha ao atribuir nº de factura (${renewal.service_name}): ${invoiceErr.message}`)
            }

            // Preparar variáveis
            const variables: TemplateVariables = {
              clientName,
              serviceName: serviceLabel,
              expirationDate: new Date(renewal.expiration_date).toLocaleDateString('pt-MZ'),
              daysRemaining: renewal.days_remaining,
              renewalPrice: formatMt(totalValue),
              renewalLink: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://visualdesignmoz.com'}/renovacao/iniciar/${renewal.service_type}/${renewal.service_id}`,
              companyName: 'VisualDesign',
              supportEmail: 'suporte@visualdesignmoz.com',
              supportPhone: '+258 85 242 5525',
              paymentMethod,
              subtotal: formatMt(subtotalValue),
              creditAmount: formatMt(creditValue),
              invoiceNumber,
              invoiceDate
            }

            // Processar template
            const processedTemplate = processTemplate(template, variables)

            // Criar notificação — o link leva a marca de deduplicação (só para uso
            // interno da checagem acima; o botão dentro do email usa variables.renewalLink,
            // que fica limpo, sem esta marca).
            const { data: notification, error: notifError } = await supabaseAdmin
              .from('notifications')
              .insert({
                user_id: renewal.user_id,
                title: processedTemplate.title,
                message: processedTemplate.message,
                type: processedTemplate.type,
                category: 'payment',
                link: `${variables.renewalLink}?${reminderTag}`,
                link_text: 'Renovar Agora',
                email_sent: false
              })
              .select()
              .single()

            if (notifError) {
              results.errors.push(`Erro ao criar notificação: ${notifError.message}`)
              continue
            }

            // Enviar o email a sério. Isto fica no seu próprio try/catch,
            // separado do catch geral do item: se caísse no catch geral, o
            // `continue` saltaria o record_renewal_reminder abaixo, e o
            // próximo cron voltaria a considerar este serviço "por avisar",
            // criando uma notificação duplicada. O lembrete tem de ficar
            // sempre registado, envie o email ou não.
            let emailSent = false
            if (!userData.email) {
              results.errors.push(`Sem email para envio de renovação (user ${renewal.user_id})`)
            } else {
              try {
                await sendEmail({
                  to: userData.email,
                  subject: processedTemplate.emailSubject,
                  html: processedTemplate.emailBody,
                  category: 'transactional'
                })
                emailSent = true
                results.emails++
              } catch (emailError: any) {
                console.error(`Falha ao enviar email de renovação (${renewal.service_name}):`, emailError)
                results.errors.push(`Email não enviado (${renewal.service_name}, ${userData.email}): ${emailError.message}`)
              }
            }

            if (emailSent) {
              await supabaseAdmin.from('notifications').update({ email_sent: true }).eq('id', notification.id)
            }

            // O registo do lembrete já ficou feito acima: a própria notificação
            // criada (com a marca reminderTag no link) é a prova de que este
            // serviço+dias já foi avisado — ver checagem "alreadyReminded" no topo.

            results.notifications++
            results.details.push({
              service: renewal.service_name,
              days,
              user: clientName,
              notificationId: notification.id,
              emailSent
            })

          } catch (itemError: any) {
            results.errors.push(`Erro ao processar ${renewal.service_name}: ${itemError.message}`)
          }
        }

        results.processed += upcomingRenewals.length

      } catch (daysError: any) {
        results.errors.push(`Erro no processamento de ${days} dias: ${daysError.message}`)
      }
    }

    const overdue = await suspendOverdueHostingAccounts(supabaseAdmin)
    if (overdue.errors.length) results.errors.push(...overdue.errors)

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...results,
      overdueSuspend: overdue,
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
    
    const adminEmails = ['admin@visualdesignmoz.com', 'silva.chamo@gmail.com', 'geral@visualdesignmoz.com', 'suporte@visualdesignmoz.com']
    
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
