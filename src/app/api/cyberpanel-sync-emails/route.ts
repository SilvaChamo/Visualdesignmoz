import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/server'
import { executeCyberPanelCommand } from '@/lib/cyberpanel-exec'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'
const supabaseAdmin = createAdminClient(supabaseUrl, supabaseKey)

// Encriptação simples base64
const encrypt = (text: string) => Buffer.from(text).toString('base64')

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { domain = 'visualdesignmoz.com' } = body

    console.log(`🔄 [SYNC] Iniciando sincronização para ${domain}`)

    // 1. Buscar emails do CyberPanel
    const cpOutput = await executeCyberPanelCommand(`cyberpanel listEmails --domainName ${domain}`)
    console.log(`🔄 [SYNC] Output CyberPanel:`, cpOutput)

    let cyberPanelEmails: string[] = []
    try {
      const cpData = JSON.parse(cpOutput)
      if (cpData?.data) {
        cyberPanelEmails = cpData.data.map((e: any) => `${e.user}@${domain}`)
      }
    } catch (e) {
      // Tentar extrair do formato texto
      const lines = cpOutput.split('\n')
      cyberPanelEmails = lines
        .filter(line => line.includes('@') || line.includes('user:'))
        .map(line => {
          const match = line.match(/user:\s*(\w+)/)
          if (match) return `${match[1]}@${domain}`
          const emailMatch = line.match(/(\S+@\S+)/)
          return emailMatch ? emailMatch[1] : null
        })
        .filter(Boolean) as string[]
    }

    console.log(`🔄 [SYNC] Emails do CyberPanel:`, cyberPanelEmails)

    // 2. Buscar emails do Supabase
    const { data: supabaseEmails, error: sbError } = await supabaseAdmin
      .from('email_contas')
      .select('email, senha_cyberpanel')
      .ilike('email', `%@${domain}`)

    if (sbError) {
      console.error(`🔄 [SYNC] Erro Supabase:`, sbError)
    }

    const sbEmailList = supabaseEmails?.map(e => e.email) || []
    console.log(`🔄 [SYNC] Emails do Supabase:`, sbEmailList)

    // 3. Encontrar emails que existem no CP mas não no SB
    const missingInSupabase = cyberPanelEmails.filter(e => !sbEmailList.includes(e))
    console.log(`🔄 [SYNC] Faltando no Supabase:`, missingInSupabase)

    // 4. Adicionar emails faltantes com senha padrão
    const added: string[] = []
    for (const email of missingInSupabase) {
      const user = email.split('@')[0]
      // Senha padrão temporária - usuário deve alterar
      const defaultPassword = `TempPass${Date.now()}`
      
      try {
        await supabaseAdmin
          .from('email_contas')
          .upsert({
            email,
            tipo_conta: 'webmail',
            senha_cyberpanel: encrypt(defaultPassword),
            status: 'active',
            cliente_id: session.user.id
          }, { onConflict: 'email' })
        
        added.push(email)
        console.log(`🔄 [SYNC] Adicionado: ${email}`)
      } catch (e) {
        console.error(`🔄 [SYNC] Erro ao adicionar ${email}:`, e)
      }
    }

    // 5. Encontrar emails no SB que não existem mais no CP (opcional: marcar inativos)
    const orphanedInSupabase = sbEmailList.filter(e => !cyberPanelEmails.includes(e))
    console.log(`🔄 [SYNC] Órfãos no Supabase:`, orphanedInSupabase)

    return NextResponse.json({
      success: true,
      domain,
      cyberPanel: {
        total: cyberPanelEmails.length,
        emails: cyberPanelEmails
      },
      supabase: {
        total: sbEmailList.length,
        emails: sbEmailList
      },
      added: {
        total: added.length,
        emails: added
      },
      orphaned: {
        total: orphanedInSupabase.length,
        emails: orphanedInSupabase
      }
    })

  } catch (error: any) {
    console.error(`🔄 [SYNC] Erro geral:`, error)
    return NextResponse.json({ 
      success: false,
      error: error.message 
    }, { status: 500 })
  }
}
