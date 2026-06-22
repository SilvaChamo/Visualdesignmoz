// Sistema de Notificações Automáticas
import { sendNotificationEmail } from './mozserver-api'
import { supabase } from './supabase'

interface NotificationTemplate {
  id: string;
  name: string;
  subject: string;
  message: string;
  daysBeforeExpiry: number;
  enabled: boolean;
}

interface Client {
  id: string;
  name: string;
  email: string;
  domain: string;
  status: 'active' | 'suspended' | 'expired';
  plan: string;
  price: number;
  currency: string;
  expiryDate: string;
  registeredAt: string;
}

// Templates de notificação padrão
export const defaultNotificationTemplates: NotificationTemplate[] = [
  {
    id: '1',
    name: 'Notificação 30 dias',
    subject: 'Seu domínio expira em 30 dias',
    message: 'Prezado(a) {name},\n\nSeu domínio {domain} expira em 30 dias. Para evitar interrupção do serviço, por favor, renove seu plano antes da data de expiração.\n\nData de expiração: {expiryDate}\nPlano: {plan}\nValor: {price} {currency}\n\nPara renovar, acesse nosso site ou entre em contato conosco.\n\nAtenciosamente,\nEquipe Visual Design',
    daysBeforeExpiry: 30,
    enabled: true
  },
  {
    id: '2',
    name: 'Notificação 15 dias',
    subject: 'Seu domínio expira em 15 dias',
    message: 'Prezado(a) {name},\n\nSeu domínio {domain} expira em 15 dias. Esta é uma lembrança importante para que você não perca seu serviço.\n\nData de expiração: {expiryDate}\nPlano: {plan}\nValor: {price} {currency}\n\nRenove agora mesmo para garantir continuidade do serviço!\n\nAtenciosamente,\nEquipe Visual Design',
    daysBeforeExpiry: 15,
    enabled: true
  },
  {
    id: '3',
    name: 'Notificação 7 dias',
    subject: 'URGENTE: Seu domínio expira em 7 dias',
    message: 'Prezado(a) {name},\n\nURGENTE: Seu domínio {domain} expira em apenas 7 dias!\n\nEsta é sua última chance de renovar antes da expiração. Não deixe para a última hora!\n\nData de expiração: {expiryDate}\nPlano: {plan}\nValor: {price} {currency}\n\nRenove imediatamente para evitar perda do serviço.\n\nAtenciosamente,\nEquipe Visual Design',
    daysBeforeExpiry: 7,
    enabled: true
  },
  {
    id: '4',
    name: 'Notificação 1 dia',
    subject: 'ÚLTIMO DIA: Domínio expira hoje',
    message: 'Prezado(a) {name},\n\nATENÇÃO MÁXIMA: Seu domínio {domain} expira HOJE!\n\nSe você não renovar hoje, seu serviço será interrompido imediatamente.\n\nData de expiração: {expiryDate}\nPlano: {plan}\nValor: {price} {currency}\n\nRENOVE AGORA MESMO!\n\nAtenciosamente,\nEquipe Visual Design',
    daysBeforeExpiry: 1,
    enabled: true
  },
  {
    id: '5',
    name: 'Domínio Expirado',
    subject: 'Seu domínio expirou',
    message: 'Prezado(a) {name},\n\nSeu domínio {domain} expirou em {expiryDate}.\n\nSeu serviço está temporariamente suspenso. Para reativar, renove seu plano assim que possível.\n\nPlano: {plan}\nValor: {price} {currency}\n\nAguardamos seu contato para reativação.\n\nAtenciosamente,\nEquipe Visual Design',
    daysBeforeExpiry: 0,
    enabled: true
  }
]

// Calcular dias até a expiração
export function calculateDaysUntilExpiry(expiryDate: string): number {
  const expiry = new Date(expiryDate)
  const today = new Date()
  today.setHours(0, 0, 0, 0) // Zerar horas para comparação precisa

  const diffTime = expiry.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  return diffDays
}

// Personalizar mensagem com dados do cliente
export function personalizeMessage(template: string, client: Client): string {
  return template
    .replace(/{name}/g, client.name)
    .replace(/{email}/g, client.email)
    .replace(/{domain}/g, client.domain)
    .replace(/{plan}/g, client.plan)
    .replace(/{price}/g, client.price.toString())
    .replace(/{currency}/g, client.currency)
    .replace(/{expiryDate}/g, client.expiryDate)
    .replace(/{registeredAt}/g, client.registeredAt)
}

// Verificar quais clientes precisam de notificação
export function getNotificationCandidates(clients: Client[], templates: NotificationTemplate[]): Array<{
  client: Client;
  template: NotificationTemplate;
  daysUntilExpiry: number;
}> {
  const candidates: Array<{
    client: Client;
    template: NotificationTemplate;
    daysUntilExpiry: number;
  }> = []

  for (const client of clients) {
    if (client.status === 'suspended' || client.status === 'expired') {
      continue // Pular clientes já suspensos ou expirados
    }

    const daysUntilExpiry = calculateDaysUntilExpiry(client.expiryDate)

    for (const template of templates) {
      if (!template.enabled) continue

      // Verificar se o cliente precisa desta notificação
      if (
        (template.daysBeforeExpiry === 0 && daysUntilExpiry < 0) || // Domínio já expirou
        (template.daysBeforeExpiry > 0 && daysUntilExpiry === template.daysBeforeExpiry) // Exatamente nos dias antes
      ) {
        candidates.push({
          client,
          template,
          daysUntilExpiry
        })
      }
    }
  }

  return candidates
}

// Enviar notificações em lote
export async function sendBatchNotifications(
  candidates: Array<{
    client: Client;
    template: NotificationTemplate;
    daysUntilExpiry: number;
  }>
): Promise<{
  success: number;
  failed: number;
  errors: Array<{ client: Client; error: string }>;
}> {
  let success = 0
  let failed = 0
  const errors: Array<{ client: Client; error: string }> = []

  for (const candidate of candidates) {
    try {
      const personalizedMessage = personalizeMessage(candidate.template.message, candidate.client)

      const result = await sendNotificationEmail(
        candidate.client.email,
        candidate.template.subject,
        personalizedMessage
      )

      if (result.success) {
        success++
        console.log(`✅ Notificação enviada para ${candidate.client.email}`)
      } else {
        failed++
        errors.push({
          client: candidate.client,
          error: result.error || 'Erro desconhecido'
        })
        console.error(`❌ Falha ao enviar para ${candidate.client.email}:`, result.error)
      }
    } catch (error) {
      failed++
      errors.push({
        client: candidate.client,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      })
      console.error(`❌ Erro ao processar ${candidate.client.email}:`, error)
    }
  }

  return { success, failed, errors }
}

// Executar verificação diária de notificações
export async function runDailyNotificationCheck(): Promise<{
  totalChecked: number;
  notificationsSent: number;
  notificationsFailed: number;
  errors: Array<{ client: Client; error: string }>;
}> {
  try {
    // Buscar todos os clientes do Supabase (Subscrições)
    const { data: subscriptions, error } = await supabase
      .from('subscriptions')
      .select('*')

    if (error) throw error

    const clients: Client[] = (subscriptions || []).map((s: any) => ({
      id: s.id,
      name: s.vhm_username, // Usando username como nome
      email: s.client_email,
      domain: s.domain,
      status: s.status as any,
      plan: s.plan,
      price: 0, // Ajustar se tivermos preços no banco
      currency: 'MT',
      expiryDate: s.expiry_date || '',
      registeredAt: s.created_at
    }))

    const templates = defaultNotificationTemplates.filter(t => t.enabled)

    // Verificar candidatos a notificação
    const candidates = getNotificationCandidates(clients, templates)

    // Enviar notificações
    const result = await sendBatchNotifications(candidates)

    return {
      totalChecked: clients.length,
      notificationsSent: result.success,
      notificationsFailed: result.failed,
      errors: result.errors
    }
  } catch (error) {
    console.error('Erro na verificação diária de notificações:', error)
    return {
      totalChecked: 0,
      notificationsSent: 0,
      notificationsFailed: 0,
      errors: []
    }
  }
}

// Gerar relatório de notificações
export function generateNotificationReport(clients: Client[]): {
  totalClients: number;
  activeClients: number;
  expiringIn30Days: number;
  expiringIn15Days: number;
  expiringIn7Days: number;
  expiringIn1Day: number;
  expired: number;
  suspended: number;
} {
  const report = {
    totalClients: clients.length,
    activeClients: clients.filter(c => c.status === 'active').length,
    expiringIn30Days: 0,
    expiringIn15Days: 0,
    expiringIn7Days: 0,
    expiringIn1Day: 0,
    expired: 0,
    suspended: clients.filter(c => c.status === 'suspended').length
  }

  for (const client of clients) {
    if (client.status === 'active') {
      const daysUntilExpiry = calculateDaysUntilExpiry(client.expiryDate)

      if (daysUntilExpiry < 0) {
        report.expired++
      } else if (daysUntilExpiry <= 1) {
        report.expiringIn1Day++
      } else if (daysUntilExpiry <= 7) {
        report.expiringIn7Days++
      } else if (daysUntilExpiry <= 15) {
        report.expiringIn15Days++
      } else if (daysUntilExpiry <= 30) {
        report.expiringIn30Days++
      }
    }
  }

  return report
}
