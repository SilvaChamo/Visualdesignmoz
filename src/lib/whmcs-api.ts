// WHMCS API Client for MozServer Domain Management
// Endpoint: https://www.mozserver.co.mz/includes/api.php

export interface WhmcsDomain {
    id: number
    domainname: string
    registrationdate: string
    expirydate: string
    status: string
    registrar: string
    autorenew: boolean
    nameservers?: string[]
}

export interface WhmcsDomainsResponse {
    result: string
    totalresults: number
    domains: { domain: WhmcsDomain[] }
}

export interface WhmcsWhoisResponse {
    result: string
    status: string // 'available' | 'unavailable'
    whois?: string
}

class WhmcsAPI {
    private apiUrl = 'https://www.mozserver.co.mz/includes/api.php'
    private email = process.env.WHMCS_API_EMAIL || ''
    private password = process.env.WHMCS_API_PASSWORD || ''

    private async makeRequest(action: string, params: Record<string, any> = {}): Promise<any> {
        try {
            // Use server-side proxy to avoid CORS
            const response = await fetch('/api/whmcs-proxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, params })
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData.error || `WHMCS API Error: ${response.status}`)
            }

            const data = await response.json()

            if (data.result === 'error') {
                throw new Error(data.message || 'WHMCS API Error')
            }

            return data
        } catch (error) {
            console.error(`WHMCS API Error [${action}]:`, error)
            throw error
        }
    }

    // Get all domains for the client
    async getClientDomains(): Promise<WhmcsDomain[]> {
        try {
            const result = await this.makeRequest('GetClientsDomains', {
                limitnum: 100
            })
            return result.domains?.domain || []
        } catch (error) {
            console.error('Failed to fetch client domains:', error)
            return []
        }
    }

    // Check domain availability (WHOIS)
    async checkDomainAvailability(domain: string): Promise<{ available: boolean; status: string }> {
        try {
            const result = await this.makeRequest('DomainWhois', { domain })
            return {
                available: result.status === 'available',
                status: result.status || 'unknown'
            }
        } catch (error) {
            console.error('Failed to check domain:', error)
            return { available: false, status: 'error' }
        }
    }

    // Get domain details
    async getDomainDetails(domainId: number): Promise<any> {
        try {
            return await this.makeRequest('GetClientsDomains', {
                domainid: domainId,
                limitnum: 1
            })
        } catch (error) {
            console.error('Failed to fetch domain details:', error)
            throw error
        }
    }

    // Get nameservers for a domain
    async getDomainNameservers(domainId: number): Promise<any> {
        try {
            return await this.makeRequest('DomainGetNameservers', {
                domainid: domainId
            })
        } catch (error) {
            console.error('Failed to fetch nameservers:', error)
            throw error
        }
    }

    // Update nameservers for a domain
    async updateDomainNameservers(domainId: number, ns1: string, ns2: string, ns3?: string, ns4?: string): Promise<boolean> {
        try {
            const params: any = { domainid: domainId, ns1, ns2 }
            if (ns3) params.ns3 = ns3
            if (ns4) params.ns4 = ns4

            const result = await this.makeRequest('DomainUpdateNameservers', params)
            return result.result === 'success'
        } catch (error) {
            console.error('Failed to update nameservers:', error)
            return false
        }
    }

    // Toggle auto-renew
    async toggleAutoRenew(domainId: number, autorenew: boolean): Promise<boolean> {
        try {
            const result = await this.makeRequest('DomainToggleIdProtect', {
                domainid: domainId,
            })
            return result.result === 'success'
        } catch (error) {
            console.error('Failed to toggle auto-renew:', error)
            return false
        }
    }

    // Get client details (balance, status, etc)
    async getClientsDetails(): Promise<any> {
        try {
            return await this.makeRequest('GetClientsDetails', {
                email: this.email
            })
        } catch (error) {
            console.error('Failed to fetch client details:', error)
            return null
        }
    }

    // Get invoices (to check payments)
    async getInvoices(status: string = 'Paid'): Promise<any[]> {
        try {
            const result = await this.makeRequest('GetInvoices', {
                limitnum: 50,
                status: status
            })
            return result.invoices?.invoice || []
        } catch (error) {
            console.error('Failed to fetch invoices:', error)
            return []
        }
    }
}

export const whmcsAPI = new WhmcsAPI()
