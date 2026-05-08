import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// Verificar se é admin
async function isAdmin(supabase: any): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  
  const adminEmails = ['admin@visualdesignmoz.com', 'silva.chamo@gmail.com', 'geral@visualdesignmoz.com', 'suporte@visualdesignmoz.com']
  return adminEmails.includes(user.email || '') || user.user_metadata?.role === 'admin'
}

// Buscar usuário por email
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    if (!(await isAdmin(supabase))) {
      return NextResponse.json({ error: 'Acesso restrito a administradores' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')

    if (!email) {
      return NextResponse.json({ error: 'Email obrigatório' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    const supabaseAdmin = createAdminClient(supabaseUrl, supabaseKey)

    // Buscar usuário por email
    const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers()

    if (error) {
      console.error('Erro ao buscar usuários:', error)
      return NextResponse.json({ error: 'Erro ao buscar usuários' }, { status: 500 })
    }

    const user = users?.find((u: any) => u.email?.toLowerCase() === email.toLowerCase())

    if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at,
        user_metadata: user.user_metadata
      }
    })
  } catch (error) {
    console.error('Erro na busca de usuário:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
