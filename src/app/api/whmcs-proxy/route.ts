import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-api-auth'

// WHMCS Proxy API - Server-side to bypass CORS and protect credentials
// Só administradores: a rota fala com o WHMCS com as credenciais do servidor, por isso quem a chamasse sem sessão
// podia correr qualquer acção da API (listar clientes, faturas…).
export async function POST(request: NextRequest) {
    const auth = await requireAdmin()
    if ('error' in auth) return auth.error

    try {
        const body = await request.json()
        const { action, params = {} } = body

        if (typeof action !== 'string' || !/^[A-Za-z]{1,64}$/.test(action)) {
            return NextResponse.json({ result: 'error', message: 'Acção inválida.' }, { status: 400 })
        }

        const apiUrl = 'https://www.mozserver.co.mz/includes/api.php'
        const email = process.env.WHMCS_API_EMAIL || ''
        const password = process.env.WHMCS_API_PASSWORD || ''

        if (!email || !password) {
            return NextResponse.json({ result: 'error', message: 'WHMCS_API_EMAIL e WHMCS_API_PASSWORD não configuradas.' }, { status: 503 })
        }

        // Build form data
        const formData = new URLSearchParams()
        formData.append('action', action)
        formData.append('username', email)
        formData.append('password', password)
        formData.append('responsetype', 'json')

        // Add additional params
        Object.keys(params).forEach(key => {
            formData.append(key, String(params[key]))
        })

        console.log(`[WHMCS Proxy] Action: ${action}`)

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData.toString()
        })

        const data = await response.json()

        if (data.result === 'error') {
            console.error(`[WHMCS ERROR] Action: ${action}, Message: ${data.message}`)

            // Check for IP whitelist error
            if (data.message?.includes('Invalid IP')) {
                return NextResponse.json({
                    result: 'error',
                    message: `IP não autorizado na API WHMCS. Contacte o suporte MozServer para adicionar o IP à whitelist.`,
                    details: data.message
                }, { status: 403 })
            }

            return NextResponse.json(data, { status: 400 })
        }

        console.log(`[WHMCS SUCCESS] Action: ${action}`)
        return NextResponse.json(data)

    } catch (error) {
        console.error('WHMCS Proxy Error:', error)
        return NextResponse.json(
            { result: 'error', message: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
            { status: 500 }
        )
    }
}
