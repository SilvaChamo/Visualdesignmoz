import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import {
  HOSTING_DOMAIN_REGEX,
  provisionHostingAccountOnPanel,
} from '@/lib/checkout-fulfillment'

async function checkIsAdmin(supabase: any): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const adminEmails = ['admin@visualdesignmoz.com', 'silva.chamo@gmail.com', 'geral@visualdesignmoz.com', 'suporte@visualdesignmoz.com']
  return adminEmails.includes(user.email || '') || user.app_metadata?.role === 'admin'
}

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) return null
  return createAdminClient(supabaseUrl, serviceKey)
}

/**
 * #32 — hospedagens que ficaram "presas" porque a compra chegou sem um
 * domínio de destino válido (ver #6 em checkout-fulfillment.ts). Ficam em
 * hosting_renewals com domain_name='' e status='pending', sem qualquer ecrã
 * para as retomar — isto dá ao admin essa lista e a acção de as concluir.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    if (!(await checkIsAdmin(supabase))) {
      return NextResponse.json({ error: 'Acesso restrito' }, { status: 403 })
    }

    const admin = getAdminClient()
    if (!admin) {
      return NextResponse.json({ error: 'Configuração do servidor em falta' }, { status: 500 })
    }

    const { data: rows, error } = await admin
      .from('hosting_renewals')
      .select('*')
      .eq('domain_name', '')
      .eq('status', 'pending')
      .order('start_date', { ascending: true })

    if (error) throw error

    const withEmail = await Promise.all(
      (rows || []).map(async (row) => {
        let userEmail = ''
        try {
          const { data } = await admin.auth.admin.getUserById(row.user_id)
          userEmail = data?.user?.email || ''
        } catch {
          /* linha fica sem email; utilizador identificado só pelo user_id */
        }
        return { ...row, user_email: userEmail }
      }),
    )

    return NextResponse.json({ success: true, pending: withEmail })
  } catch (error: any) {
    console.error('[hosting-pending] GET:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    if (!(await checkIsAdmin(supabase))) {
      return NextResponse.json({ error: 'Acesso restrito' }, { status: 403 })
    }

    const { renewalId, domain } = await request.json()
    if (!renewalId || typeof renewalId !== 'string') {
      return NextResponse.json({ error: 'renewalId em falta' }, { status: 400 })
    }

    const domainName = String(domain || '').toLowerCase().trim()
    if (!HOSTING_DOMAIN_REGEX.test(domainName)) {
      return NextResponse.json({ error: 'Domínio inválido — usa o formato exemplo.com' }, { status: 400 })
    }

    const admin = getAdminClient()
    if (!admin) {
      return NextResponse.json({ error: 'Configuração do servidor em falta' }, { status: 500 })
    }

    const { data: row, error: rowErr } = await admin
      .from('hosting_renewals')
      .select('*')
      .eq('id', renewalId)
      .maybeSingle()

    if (rowErr) throw rowErr
    if (!row) {
      return NextResponse.json({ error: 'Hospedagem pendente não encontrada' }, { status: 404 })
    }
    if (row.domain_name || row.status !== 'pending') {
      return NextResponse.json(
        { error: 'Esta hospedagem já tem domínio associado ou já não está pendente — recarrega a lista.' },
        { status: 409 },
      )
    }

    const { data: authUser } = await admin.auth.admin.getUserById(row.user_id)
    const email = authUser?.user?.email
    if (!email) {
      return NextResponse.json({ error: 'Não foi possível identificar o email do cliente' }, { status: 500 })
    }
    const metadata = authUser?.user?.user_metadata || {}
    const displayName = metadata.nome || metadata.full_name || email.split('@')[0]

    // Passo 1 (síncrono): associar o domínio no registo — visível de imediato,
    // mesmo antes de a conta ficar pronta no servidor.
    const { error: updErr } = await admin
      .from('hosting_renewals')
      .update({ domain_name: domainName })
      .eq('id', renewalId)
    if (updErr) throw updErr

    // Passo 2: conta no painel (mirror + password) — síncrono; a criação real
    // no DirectAdmin corre a seguir, em segundo plano (mesmo caminho do checkout).
    const result = await provisionHostingAccountOnPanel({
      admin,
      userId: row.user_id,
      email,
      displayName,
      domainName,
      packageName: row.package_name || 'VisualDESIGN',
      renewalId: row.id,
    })

    if (!result.ok) {
      return NextResponse.json({
        success: false,
        steps: {
          domainAssociado: true,
          contaPainel: false,
        },
        error: result.error || 'Falha ao registar a conta no painel',
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      steps: {
        domainAssociado: true,
        contaPainel: true,
        directAdminEmSegundoPlano: true,
      },
      daUsername: result.daUsername,
      message: `Domínio associado e conta do painel criada (utilizador ${result.daUsername}). A criação no DirectAdmin está a decorrer em segundo plano — actualiza a secção Hospedagem daqui a pouco para confirmar.`,
    })
  } catch (error: any) {
    console.error('[hosting-pending] POST:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
