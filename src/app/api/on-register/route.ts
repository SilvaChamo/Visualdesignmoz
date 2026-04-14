import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const STANDARD_EMAIL_PASSWORD = process.env.STANDARD_EMAIL_PASSWORD || 'Ad.Vd#2425?*'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, email, name } = body

    if (!email || !email.includes('@')) {
      return NextResponse.json({ success: false, error: 'Email inválido' }, { status: 400 })
    }

    const admin = createAdminClient(SUPABASE_URL, SUPABASE_KEY)

    // 1) Obter user id se não enviado
    let userId = id
    if (!userId) {
      try {
        const { data: userData } = await admin.from('profiles').select('id').eq('email', email).single()
        userId = userData?.id
      } catch (e) {
        console.warn('Não foi possível obter user by email', e)
      }
    }

    // 2) Upsert perfil na tabela `profiles`
    if (userId) {
      await admin.from('profiles').upsert({ id: userId, nome: name || null, email }, { onConflict: 'id' })
    }

    // 3) Criar conta de email no CyberPanel (via API interna)
    const localPart = email.split('@')[0]
    const domain = email.split('@')[1] || 'visualdesigne.com'

    try {
      const res = await fetch(new URL('/api/cyberpanel-cli', request.url).toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'createEmail', domain, userName: localPart, password: STANDARD_EMAIL_PASSWORD })
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.success === false) {
        console.warn('Falha ao criar email no CyberPanel', json)
      }
    } catch (e) {
      console.error('Erro ao chamar cyberpanel-cli:', e)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
