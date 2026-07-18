import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getStripe, isStripeConfigured } from '@/lib/stripe'

// Processar pagamento de renovação
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { renewal_id, renewal_type, payment_method_id, amount } = body

    // 1. Buscar detalhes da renovação
    const tableName = renewal_type === 'domain' ? 'domain_renewals' : 'hosting_renewals'
    const { data: renewal, error: renewalError } = await supabase
      .from(tableName)
      .select('*')
      .eq('id', renewal_id)
      .eq('user_id', user.id)
      .single()

    if (renewalError || !renewal) {
      return NextResponse.json({ error: 'Renovação não encontrada' }, { status: 404 })
    }

    // 2. Buscar método de pagamento
    const { data: paymentMethod, error: methodError } = await supabase
      .from('user_payment_methods')
      .select('*')
      .eq('id', payment_method_id)
      .eq('user_id', user.id)
      .single()

    if (methodError || !paymentMethod) {
      return NextResponse.json({ error: 'Método de pagamento não encontrado' }, { status: 404 })
    }

    // 3. Criar registro de pagamento
    const { data: payment, error: paymentError } = await supabase
      .from('renewal_payments')
      .insert({
        user_id: user.id,
        renewal_id,
        renewal_type,
        amount: amount || renewal.renewal_price,
        currency: renewal.currency || 'MZN',
        payment_method_id,
        payment_method_type: paymentMethod.type,
        status: 'processing'
      })
      .select()
      .single()

    if (paymentError) throw paymentError

    // 4. Processar pagamento no gateway apropriado
    let gatewayResult
    
    switch (paymentMethod.type) {
      case 'cartao':
        gatewayResult = await processCardPayment(payment, paymentMethod, renewal)
        break
      case 'paypal':
        gatewayResult = await processPayPalPayment(payment, paymentMethod, renewal)
        break
      default:
        return NextResponse.json({ error: 'Método de pagamento não suportado' }, { status: 400 })
    }

    // 5. Atualizar status do pagamento
    const { data: updatedPayment, error: updateError } = await supabase
      .from('renewal_payments')
      .update({
        status: gatewayResult.success ? 'completed' : 'failed',
        transaction_id: gatewayResult.transaction_id,
        gateway_response: gatewayResult.response,
        paid_at: gatewayResult.success ? new Date().toISOString() : null,
        receipt_url: gatewayResult.success ? gatewayResult.receipt_url : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', payment.id)
      .select()
      .single()

    if (updateError) throw updateError

    // 6. Se pagamento bem-sucedido, atualizar renovação
    if (gatewayResult.success) {
      await supabase
        .from(tableName)
        .update({
          status: 'renewed',
          last_renewal_date: new Date().toISOString(),
          // Estender data de expiração (1 ano para domínios, conforme plano para hosting)
          expiration_date: renewal_type === 'domain' 
            ? new Date(new Date(renewal.expiration_date).setFullYear(new Date(renewal.expiration_date).getFullYear() + 1)).toISOString()
            : calculateNewExpiration(renewal.expiration_date, renewal.plan || 'anual'),
          updated_at: new Date().toISOString()
        })
        .eq('id', renewal_id)

      // Enviar email de confirmação
      if (user.email) {
        await sendPaymentConfirmationEmail(user.email, updatedPayment, renewal)
      }
    }

    return NextResponse.json({
      success: gatewayResult.success,
      payment: updatedPayment,
      message: gatewayResult.success ? 'Pagamento processado com sucesso' : gatewayResult.message
    })

  } catch (error) {
    console.error('Erro ao processar pagamento:', error)
    return NextResponse.json({ error: 'Erro ao processar pagamento' }, { status: 500 })
  }
}

async function processCardPayment(payment: any, method: any, renewal: any) {
  if (!isStripeConfigured()) {
    return {
      success: false,
      transaction_id: null,
      response: {},
      receipt_url: null,
      message: 'Pagamento por cartão ainda não está configurado.'
    }
  }

  // Renovação por cartão exige um cartão previamente guardado na Stripe (SetupIntent) —
  // essa UI de "adicionar cartão" ainda não existe no painel do cliente. Sem
  // stripe_customer_id/stripe_payment_method_id reais, falhamos de forma clara em vez
  // de fingir sucesso (como acontecia antes com o mock).
  if (!method.metadata?.stripe_customer_id || !method.metadata?.stripe_payment_method_id) {
    return {
      success: false,
      transaction_id: null,
      response: {},
      receipt_url: null,
      message: 'Nenhum cartão guardado para renovação automática. Use o checkout para comprar/renovar por agora.'
    }
  }

  try {
    const stripe = getStripe()
    const charge = await stripe.paymentIntents.create({
      amount: Math.round(payment.amount * 100), // Stripe usa centavos
      currency: payment.currency.toLowerCase(),
      customer: method.metadata.stripe_customer_id,
      payment_method: method.metadata.stripe_payment_method_id,
      off_session: true,
      confirm: true,
      description: `Renovação ${renewal.domain_name}`,
      metadata: {
        renewal_id: payment.renewal_id,
        renewal_type: payment.renewal_type,
        payment_id: payment.id
      }
    })

    return {
      success: charge.status === 'succeeded',
      transaction_id: charge.id,
      response: charge,
      receipt_url: null,
      message: charge.status === 'succeeded' ? 'Pagamento confirmado' : 'Erro no pagamento'
    }
  } catch (error: any) {
    console.error('Erro Stripe:', error)
    return {
      success: false,
      transaction_id: null,
      response: { error: error?.message || 'Erro desconhecido' },
      receipt_url: null,
      message: 'Erro ao processar cartão'
    }
  }
}

async function processPayPalPayment(payment: any, method: any, renewal: any) {
  // Integração com PayPal
  try {
    // Implementação PayPal aqui
    return {
      success: false,
      transaction_id: null,
      response: {},
      receipt_url: null,
      message: 'PayPal - Implementação pendente'
    }
  } catch (error: any) {
    return {
      success: false,
      transaction_id: null,
      receipt_url: null,
      response: { error: error.message },
      message: 'Erro PayPal'
    }
  }
}

function calculateNewExpiration(currentDate: string, plan: string): string {
  const date = new Date(currentDate)
  switch (plan) {
    case 'mensal': date.setMonth(date.getMonth() + 1); break
    case 'trimestral': date.setMonth(date.getMonth() + 3); break
    case 'semestral': date.setMonth(date.getMonth() + 6); break
    case 'anual': date.setFullYear(date.getFullYear() + 1); break
    case 'biennial': date.setFullYear(date.getFullYear() + 2); break
    default: date.setFullYear(date.getFullYear() + 1)
  }
  return date.toISOString()
}

async function sendPaymentConfirmationEmail(email: string, payment: any, renewal: any) {
  // Implementar envio de email de confirmação
  console.log(`Enviando confirmação de pagamento para ${email}`)
}
