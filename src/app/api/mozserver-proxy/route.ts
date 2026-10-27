import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-api-auth'

// Domain pricing table
const DOMAIN_PRICES: Record<string, { price: number; currency: string }> = {
    '.mz': { price: 1500, currency: 'MT' },
    '.co.mz': { price: 1200, currency: 'MT' },
    '.com': { price: 15, currency: 'USD' },
    '.org': { price: 12, currency: 'USD' },
    '.net': { price: 13, currency: 'USD' },
}

// DNS-based domain availability check
async function checkDomainViaDNS(domain: string): Promise<boolean> {
    try {
        // Use DNS over HTTPS (Cloudflare) to check if domain resolves
        const response = await fetch(
            `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=A`,
            {
                headers: { 'Accept': 'application/dns-json' }
            }
        )

        if (!response.ok) {
            // If DNS query fails, we can't determine — assume available
            return true
        }

        const data = await response.json()

        // Status 3 = NXDOMAIN (domain does not exist) = available
        // Status 0 = NOERROR (domain exists) = unavailable
        if (data.Status === 3) {
            return true // Domain does not exist, likely available
        }

        if (data.Status === 0 && data.Answer && data.Answer.length > 0) {
            return false // Domain exists with records, not available
        }

        // No A records but NOERROR — domain may exist but have no A record
        // This is still "taken" only if it has SOA (registered). Default: available.
        return true
    } catch (error) {
        console.error('DNS check error:', error)
        return true // On error, assume available (user can verify later)
    }
}

// Try MozServer API first, fallback to DNS
async function checkDomainAvailability(domain: string, tld: string) {
    const fullDomain = domain + tld
    const pricing = DOMAIN_PRICES[tld] || { price: 0, currency: 'MT' }

    // Attempt MozServer API first
    try {
        const mozserverUrl = 'https://www.mozserver.co.mz/api'
        const token = process.env.MOZSERVER_API_TOKEN || ''
        if (!token) throw new Error('MOZSERVER_API_TOKEN não configurada')

        const response = await fetch(`${mozserverUrl}/check-domain`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ domain, tld }),
            signal: AbortSignal.timeout(5000) // 5 second timeout
        })

        if (response.ok) {
            const data = await response.json()
            return {
                available: data.available || false,
                price: data.price || pricing.price,
                currency: data.currency || pricing.currency,
                period: data.period || 1,
                source: 'mozserver'
            }
        }
    } catch (e) {
        console.log('MozServer API unavailable, falling back to DNS check')
    }

    // Fallback: DNS-based check
    const available = await checkDomainViaDNS(fullDomain)
    return {
        available,
        price: pricing.price,
        currency: pricing.currency,
        period: 1,
        source: 'dns'
    }
}

// MozServer Proxy API - Server-side to bypass CORS
// Só administradores: a rota fala com a API externa com a chave do servidor, por isso quem a chamasse sem sessão
// podia correr qualquer pedido com essa chave. A chave vem do ambiente (MOZSERVER_API_TOKEN), nunca do código.
export async function POST(request: NextRequest) {
    const auth = await requireAdmin()
    if ('error' in auth) return auth.error

    try {
        const body = await request.json()
        const { endpoint, method = 'POST', payload } = body

        console.log(`MozServer Proxy Request: ${method} ${endpoint}`)

        // Special handling for domain check — use our smart fallback
        if (endpoint === '/check-domain' && payload?.domain) {
            const result = await checkDomainAvailability(payload.domain, payload.tld || '.mz')
            return NextResponse.json(result)
        }

        // Health check — just return OK
        if (endpoint === '/health') {
            return NextResponse.json({ status: 'ok' })
        }

        // For other endpoints, try MozServer API directly
        const mozserverUrl = 'https://www.mozserver.co.mz/api'
        const token = process.env.MOZSERVER_API_TOKEN || ''
        if (!token) {
            return NextResponse.json({ error: 'MOZSERVER_API_TOKEN não configurada.' }, { status: 503 })
        }

        const url = `${mozserverUrl}${endpoint}`
        const fetchOptions: RequestInit = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        }

        if (method !== 'GET' && method !== 'HEAD' && payload) {
            fetchOptions.body = JSON.stringify(payload)
        }

        const response = await fetch(url, fetchOptions)

        if (!response.ok) {
            const errorText = await response.text()
            console.error(`[MozServer ERROR] Status: ${response.status}, Endpoint: ${endpoint}, Response: ${errorText.substring(0, 500)}`)
            return NextResponse.json(
                { error: `MozServer API Error: ${response.status}`, details: errorText },
                { status: response.status }
            )
        }

        const data = await response.json()
        return NextResponse.json(data)

    } catch (error) {
        console.error('MozServer Proxy Error:', error)
        return NextResponse.json(
            { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        )
    }
}
