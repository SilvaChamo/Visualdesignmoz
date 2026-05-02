import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { executeCyberPanelCommand } from '@/lib/cyberpanel-exec'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const STANDARD_PASSWORD = process.env.STANDARD_EMAIL_PASSWORD || 'Ad.Vd#2425?*'

export async function POST(req: NextRequest) {
  try {
    const admin = createAdminClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    
    // 1. Obter todos os domínios
    console.log('🔄 [SYNC] Listando domínios do CyberPanel...')
    const domainsOutput = await executeCyberPanelCommand('cyberpanel listWebsites')
    let domains: string[] = []
    
    try {
      const data = JSON.parse(domainsOutput)
      if (data?.status === 'success') {
        domains = data.data.map((d: any) => d.domain)
      } else {
        // Fallback para parse manual se não for JSON válido
        domains = domainsOutput.split('\n')
          .filter(l => l.includes('domain:'))
          .map(l => l.split('domain:')[1].trim().split(',')[0].trim())
      }
    } catch (e) {
      domains = domainsOutput.split('\n')
        .map(l => l.trim())
        .filter(l => l && !l.includes(' ') && l.includes('.'))
    }

    if (domains.length === 0) {
      domains = ['visualdesigne.com'] // Fallback se falhar tudo
    }

    console.log(`🔄 [SYNC] Domínios encontrados: ${domains.join(', ')}`)

    const results: any = {
      totalDomains: domains.length,
      emailsFound: 0,
      usersCreated: 0,
      errors: []
    }

    // 2. Para cada domínio, obter emails
    for (const domain of domains) {
      console.log(`🔄 [SYNC] Processando emails para o domínio: ${domain}`)
      const emailsOutput = await executeCyberPanelCommand(`cyberpanel listEmails --domainName ${domain}`)
      
      let emailList: string[] = []
      try {
        const data = JSON.parse(emailsOutput)
        if (data?.status === 'success') {
          emailList = data.data.map((e: any) => `${e.user}@${domain}`)
        }
      } catch (e) {
        // Parse manual do formato "user: name, quota: X"
        emailList = emailsOutput.split('\n')
          .filter(l => l.includes('user:'))
          .map(l => {
            const match = l.match(/user:\s*([^,]+)/)
            return match ? `${match[1].trim()}@${domain}` : null
          })
          .filter(Boolean) as string[]
      }

      console.log(`🔄 [SYNC] ${emailList.length} emails encontrados em ${domain}`)
      results.emailsFound += emailList.length

      // 3. Sincronizar cada email com Supabase Auth
      for (const email of emailList) {
        try {
          // Verificar se o utilizador já existe no Supabase Auth
          const { data: users, error: listError } = await admin.auth.admin.listUsers()
          if (listError) throw listError

          const existingUser = users.users.find(u => u.email?.toLowerCase() === email.toLowerCase())

          let userId: string

          if (!existingUser) {
            console.log(`➕ [SYNC] Criando utilizador no Auth: ${email}`)
            const { data: newUser, error: createError } = await admin.auth.admin.createUser({
              email,
              password: STANDARD_PASSWORD,
              email_confirm: true,
              user_metadata: { role: 'client', nome: email.split('@')[0] }
            })

            if (createError) throw createError
            userId = newUser.user.id
            results.usersCreated++
          } else {
            userId = existingUser.id
          }

          // 4. Garantir perfil na tabela `profiles`
          await admin.from('profiles').upsert({
            id: userId,
            email: email,
            nome: email.split('@')[0],
            role: 'client'
          }, { onConflict: 'id' })

          // 5. Garantir entrada na tabela `email_contas`
          const parts = email.split('@')
          const userName = parts[0]
          const domainName = parts[1]

          // Tentar encontrar o site_id correspondente
          const { data: siteData } = await admin.from('site_clientes')
            .select('id')
            .eq('dominio', domainName)
            .single()

          await admin.from('email_contas').upsert({
            email,
            status: 'active',
            tipo_conta: 'webmail',
            cliente_id: userId,
            site_id: siteData?.id || null
          }, { onConflict: 'email' })

        } catch (err: any) {
          console.error(`❌ [SYNC] Erro ao processar ${email}:`, err.message)
          results.errors.push(`${email}: ${err.message}`)
        }
      }
    }

    return NextResponse.json({ success: true, results })

  } catch (error: any) {
    console.error('❌ [SYNC] Erro global:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
