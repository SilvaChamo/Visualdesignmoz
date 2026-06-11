import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { detectDomainConfig } from '@/lib/email-autoconfig'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const { email } = await req.json()

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
    }

    // 1. Detectar configurações do domínio
    const config = detectDomainConfig(email)

    // 2. Obter dados do perfil do cliente (para nome e empresa)
    const { data: profile } = await supabase
      .from('profiles')
      .select('name, user_id')
      .or(`user_id.eq.${session.user.id},id.eq.${session.user.id}`)
      .maybeSingle()

    const displayName = profile?.name || email.split('@')[0]

    // 3. Gerar assinatura básica
    const signature = displayName

    return NextResponse.json({
      success: true,
      config: {
        ...config,
        displayName,
        organization: '',
        signature: signature
      }
    })
  } catch (error: any) {
    console.error('Autoconfig Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
