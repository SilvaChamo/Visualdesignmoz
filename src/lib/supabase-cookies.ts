import { createServerClient } from '@supabase/ssr'
import type { NextRequest, NextResponse } from 'next/server'
import { applySharedAuthCookieOptions } from '@/lib/panel-origin'

type CookieJar = Pick<NextResponse, 'cookies'>

export function copyAuthCookies(
  from: CookieJar,
  to: CookieJar,
  hostname?: string,
) {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(
      cookie.name,
      cookie.value,
      applySharedAuthCookieOptions({}, hostname),
    )
  })
}

export function createAppServerClient(
  request: NextRequest,
  cookieJar: CookieJar,
) {
  const hostname = request.headers.get('host') ?? undefined

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieJar.cookies.set(
              name,
              value,
              applySharedAuthCookieOptions(options, hostname),
            )
          })
        },
      },
    },
  )
}
