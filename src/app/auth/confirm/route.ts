import { createServerClient } from '@supabase/ssr'
import { type EmailOtpType } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

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
                        cookieJar.cookies.set(name, value, options)
                    })
                },
            },
        }
    )

    if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) {
            const response = NextResponse.redirect(redirectTo)
            cookieJar.cookies.getAll().forEach((c) => response.cookies.set(c.name, c.value))
            return response
        }
        console.error('Auth Confirm (code) Error:', error)
    }

    if (token_hash && type) {
        const { error } = await supabase.auth.verifyOtp({
            type,
            token_hash,
        })

        if (!error) {
            const response = NextResponse.redirect(redirectTo)
            cookieJar.cookies.getAll().forEach((c) => response.cookies.set(c.name, c.value))
            return response
        }

        console.error('Auth Confirm (token_hash) Error:', error)
    }

    const loginUrl = new URL('/auth/login', request.url)
    loginUrl.searchParams.set('error', 'token_invalid')
    loginUrl.searchParams.set('error_description', 'Token de confirmação inválido ou expirado.')
    return NextResponse.redirect(loginUrl)
}
