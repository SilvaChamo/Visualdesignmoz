import { NextResponse } from 'next/server';
import https from 'https';
import { getServerHost, getHestiaUrl } from '@/lib/server-config'

const CYBERPANEL_URL = '${getHestiaUrl()}/api';
const ADMIN_USER = 'admin';
const ADMIN_PASS = process.env.CYBERPANEL_PASS || 'Vgz5Zat4uMyFt2tb';

async function tryEndpoint(endpoint: string, params: Record<string, any> = {}): Promise<any> {
    const body = JSON.stringify({ adminUser: ADMIN_USER, adminPass: ADMIN_PASS, ...params });
    return new Promise((resolve) => {
        const url = new URL(`${CYBERPANEL_URL}/${endpoint}`);
        const req = https.request({
            hostname: url.hostname, port: url.port || 443,
            path: url.pathname, method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
            rejectUnauthorized: false, timeout: 15000,
        }, (res) => {
            let data = '';
            res.on('data', c => { data += c; });
            res.on('end', () => {
                try { resolve({ ok: true, status: res.statusCode, data: JSON.parse(data) }); }
                catch { resolve({ ok: true, status: res.statusCode, raw: data.substring(0, 500) }); }
            });
        });
        req.on('error', e => resolve({ ok: false, error: e.message }));
        req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: 'timeout' }); });
        req.write(body);
        req.end();
    });
}

export async function GET() {
    const results: Record<string, any> = {};

    // Try multiple endpoints to find what works
    results['fetchWebsites_noparams'] = await tryEndpoint('fetchWebsites');
    results['fetchWebsites_admin'] = await tryEndpoint('fetchWebsites', { websiteOwner: 'admin' });
    results['fetchWebsites_email'] = await tryEndpoint('fetchWebsites', { ownerEmail: 'admin' });
    results['listWebsites'] = await tryEndpoint('listWebsites');
    results['fetchSitesv2'] = await tryEndpoint('fetchSitesv2');
    results['getUsersWebsites'] = await tryEndpoint('getUsersWebsites', { websiteOwner: 'admin' });

    return NextResponse.json(results, { status: 200 });
}
