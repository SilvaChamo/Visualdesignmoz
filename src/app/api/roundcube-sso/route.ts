import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createHmac } from 'crypto'
import { getDirectAdminUrl } from '@/lib/server-config'

const SSO_SECRET = 'vd2026sso_secret_key_32chars!!'
const ROUNDCUBE_URL = `${getDirectAdminUrl()}/roundcube`

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const emailParam = searchParams.get('email')
  const password = searchParams.get('pass') || ''

  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) return NextResponse.redirect(ROUNDCUBE_URL)

    const targetEmail = emailParam || session.user.email || ''
    if (!targetEmail || !password) return NextResponse.redirect(ROUNDCUBE_URL)

    const ts = Math.floor(Date.now() / 1000)
    const sig = createHmac('sha256', SSO_SECRET).update(targetEmail + ts).digest('hex')
    const token = Buffer.from(JSON.stringify({ user: targetEmail, pass: password, ts, sig })).toString('base64')
    const ssoUrl = `${ROUNDCUBE_URL}/?_sso=${encodeURIComponent(token)}`

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>A abrir Webmail...</title>
  <style>
    body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:linear-gradient(135deg,#0f172a,#1e3a5f);color:white}
    .card{text-align:center;padding:2rem;background:rgba(255,255,255,0.05);border-radius:16px;border:1px solid rgba(255,255,255,0.1)}
    .spinner{width:40px;height:40px;border:3px solid rgba(255,255,255,0.2);border-top-color:#3b82f6;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 1rem}
    @keyframes spin{to{transform:rotate(360deg)}}
    p{margin:0;opacity:0.7;font-size:0.9rem}
  </style>
</head>
<body>
  <div class="card">
    <div class="spinner"></div>
    <p>A iniciar sessão no Webmail...</p>
    <p style="margin-top:0.5rem;font-size:0.8rem;opacity:0.5">${targetEmail}</p>
  </div>
  <script>setTimeout(()=>window.location.href="${ssoUrl}",800)</script>
</body>
</html>`

    return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  } catch (e) {
    console.error('[roundcube-sso]', e)
    return NextResponse.redirect(ROUNDCUBE_URL)
  }
}
