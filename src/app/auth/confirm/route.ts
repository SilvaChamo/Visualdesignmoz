import { type EmailOtpType } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { isPanelRoute, resolvePostLoginUrl } from '@/lib/panel-origin'
import { createAppServerClient } from '@/lib/supabase-cookies'

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const token_hash = searchParams.get('token_hash')
    const type = searchParams.get('type') as EmailOtpType | null
    const code = searchParams.get('code')
    const next = searchParams.get('next') ?? '/'
    const redirectTo = request.nextUrl.clone()
    redirectTo.pathname = next
    redirectTo.search = ''

    const cookieJar = NextResponse.next()
    const supabase = createAppServerClient(request, cookieJar)

    const finish = (path: string) => {
        const target =
            isPanelRoute(path)
                ? resolvePostLoginUrl({
                      origin: request.nextUrl.origin,
                      role: 'guest',
                      from: path,
                  })
                : path.startsWith('http')
                  ? path
                  : new URL(path, request.nextUrl.origin).toString()
        const response = NextResponse.redirect(target)
        cookieJar.cookies.getAll().forEach((c) => response.cookies.set(c.name, c.value))
        return response
    }

    if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) {
            return finish(next)
        }
        console.error('Auth Confirm (code) Error:', error)
    }

    if (token_hash && type) {
        const { error } = await supabase.auth.verifyOtp({
            type,
            token_hash,
        })

        if (!error) {
            return finish(next)
        }

        console.error('Auth Confirm (token_hash) Error:', error)
    }

    const loginUrl = new URL('/auth/login', request.url)
    loginUrl.searchParams.set('error', 'token_invalid')
    loginUrl.searchParams.set('error_description', 'Token de confirmação inválido ou expirado.')
    return NextResponse.redirect(loginUrl)
}
