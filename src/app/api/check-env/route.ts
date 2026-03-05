
export async function GET() {
    return new Response(JSON.stringify({
        clientId: process.env.GOOGLE_CLIENT_ID?.substring(0, 10) + '...',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET?.substring(0, 10) + '...',
        match: process.env.GOOGLE_CLIENT_SECRET === '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'
    }), {
        headers: { 'Content-Type': 'application/json' }
    });
}
