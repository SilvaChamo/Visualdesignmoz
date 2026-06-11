import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, email, name } = body

    if (!email || !email.includes('@')) {
      return NextResponse.json({ success: false, error: 'Email inválido' }, { status: 400 })
    }

    const admin = createAdminClient(SUPABASE_URL, SUPABASE_KEY)

    let userId = id
    if (!userId) {
      try {
        const { data: userData } = await admin.from('profiles').select('id').eq('email', email).single()
        userId = userData?.id
      } catch (e) {
        console.warn('Não foi possível obter user by email', e)
      }
    }

    if (userId) {
      const { saveProfileForAuthUser } = await import('@/lib/profile-db');
      await saveProfileForAuthUser(admin, userId, { email, name: name || null });
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro interno'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
