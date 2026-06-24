import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { applySharedAuthCookieOptions } from '@/lib/panel-origin'
import { type UserRole } from '@/lib/user-roles'

/** Grava sessão Supabase em cookies HTTP — o proxy/middleware lê estes cookies. */
export async function POST(request: NextRequest) {
  let body: { access_token?: string; refresh_token?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Pedido inválido' }, { status: 400 })
  }

  const access_token = body.access_token?.trim()
  const refresh_token = body.refresh_token?.trim()
  if (!access_token || !refresh_token) {
    return NextResponse.json({ error: 'Tokens em falta' }, { status: 400 })
  }

  // Descodificar token para obter o papel do utilizador
  const tempSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
  const {
    data: { user },
  } = await tempSupabase.auth.getUser(access_token)
  const role = (user?.user_metadata?.role as UserRole) || 'client'

  const response = NextResponse.json({ ok: true })
  const hostname = request.headers.get('host') ?? undefined
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(
              name,
              value,
              applySharedAuthCookieOptions(options, hostname, role),
            )
          })
        },
      },
    },
  )

  const { data, error } = await supabase.auth.setSession({
    access_token,
    refresh_token,
  })

  if (error || !data.session) {
    return NextResponse.json(
      { error: error?.message || 'Sessão inválida' },
      { status: 401 },
    )
  }

  response.headers.set('Cache-Control', 'no-store')
  return response
}
