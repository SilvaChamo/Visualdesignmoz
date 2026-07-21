import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getDaSyncAdmin } from '@/lib/da-sync-schema'
import { getMirrorSiteOwner } from '@/lib/panel-mirror-read'
import { daRequest } from '@/lib/directadmin'

async function checkIsAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const adminEmails = ['admin@visualdesignmoz.com', 'silva.chamo@gmail.com', 'geral@visualdesignmoz.com', 'suporte@visualdesignmoz.com']
  return adminEmails.includes(user.email || '') || user.user_metadata?.role === 'admin'
}

// DirectAdmin devolve date_created no formato "Mon May  4 00:11:54 2026"
// (estilo asctime, com espaço extra em dias de um dígito) — o Date do V8
// interpreta isto nativamente depois de normalizar os espaços.
function parseDaDate(raw: string | undefined): string | null {
  if (!raw) return null
  const normalized = raw.replace(/\s+/g, ' ').trim()
  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString().split('T')[0]
}

// Procura um domínio já hospedado (espelho panel_sites/panel_users) e sugere
// a data de registo real (via DirectAdmin) e o pacote atribuído, para
// pré-preencher o formulário de cadastro de renovações em vez de o admin
// ter de descobrir isto manualmente a cada novo cliente.
export async function GET(request: NextRequest) {
  try {
    if (!(await checkIsAdmin())) {
      return NextResponse.json({ error: 'Acesso restrito' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const domain = (searchParams.get('domain') || '').toLowerCase().trim()
    if (!domain) {
      return NextResponse.json({ error: 'Parâmetro domain obrigatório' }, { status: 400 })
    }

    const owner = await getMirrorSiteOwner(domain)
    if (!owner) {
      return NextResponse.json({ found: false })
    }

    const admin = getDaSyncAdmin()
    const { data: ownerRow } = admin
      ? await admin.from('panel_users').select('package_name, created_at').eq('username', owner).maybeSingle()
      : { data: null }

    let registrationDate: string | null = null
    let dateSource: 'directadmin' | 'sync_estimate' = 'sync_estimate'

    try {
      const config = await daRequest('CMD_API_SHOW_USER_CONFIG', 'GET', { user: owner }, 'admin')
      const liveDate = parseDaDate(config?.data?.date_created as string | undefined)
      if (liveDate) {
        registrationDate = liveDate
        dateSource = 'directadmin'
      }
    } catch (e) {
      console.error('[domain-lookup] falha ao consultar DirectAdmin ao vivo:', e)
    }

    if (!registrationDate && ownerRow?.created_at) {
      registrationDate = String(ownerRow.created_at).split('T')[0]
      dateSource = 'sync_estimate'
    }

    return NextResponse.json({
      found: true,
      owner,
      suggestedPackage: ownerRow?.package_name || null,
      registrationDate,
      dateSource,
    })
  } catch (error: any) {
    console.error('Erro no domain-lookup:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
