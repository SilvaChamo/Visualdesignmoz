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
      .select('nome, empresa')
      .eq('id', session.user.id)
      .single()

    // 3. Gerar assinatura básica
    const signature = profile?.empresa 
      ? `${profile.nome}\n${profile.empresa}`
      : profile?.nome || email.split('@')[0]

    return NextResponse.json({
      success: true,
      config: {
        ...config,
        displayName: profile?.nome || email.split('@')[0],
        organization: profile?.empresa || '',
        signature: signature
      }
    })
  } catch (error: any) {
    console.error('Autoconfig Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
