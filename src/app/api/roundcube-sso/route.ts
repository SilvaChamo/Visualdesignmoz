import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

const ROUNDCUBE_BASE = process.env.ROUNDCUBE_URL || 'https://mail.visualdesigne.com/roundcube/'

// Credenciais padrão conhecidas (mesmo mapa que WebmailSection)
const CREDENCIAIS_PADRAO: Record<string, string> = {
  'silva.chamo@visualdesigne.com': 'Meckito#77?*',
  'duduchamatavele@visualdesigne.com': 'Dudu#2425?*',
  'geral@visualdesigne.com': 'Ge.Vd#2425?*',
  'admin@visualdesigne.com': 'Ad.Vd#2425?*',
  'info@visualdesigne.com': 'Informação!#2020?*',
  'suporte@visualdesigne.com': 'SupaEmail#2026?*',
  'noreply@visualdesigne.com': 'VisualDesign#2026',
  'marketing@visualdesigne.com': 'mark#mail2026?*',
}

/**
 * GET /api/roundcube-sso?email=xxx@dominio.com
 *
 * Se o utilizador estiver autenticado no painel admin:
 *   → redireciona para RoundCube com auto-login via form POST
 *
 * Se não estiver autenticado:
 *   → redireciona para o RoundCube normal (login manual)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const emailParam = searchParams.get('email')

  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()

    // Utilizador não está autenticado → RoundCube normal
    if (!session) {
      return NextResponse.redirect(ROUNDCUBE_BASE)
    }

    // Determinar o email a usar
    const targetEmail = emailParam || session.user.email || ''

    if (!targetEmail) {
      return NextResponse.redirect(ROUNDCUBE_BASE)
    }

    // Tentar obter a password da conta de email
    let password = CREDENCIAIS_PADRAO[targetEmail] || ''

    // Se não está nas credenciais padrão, tentar buscar na BD
    if (!password) {
      const { data: conta } = await supabaseAdmin
        .from('email_contas')
        .select('senha_cyberpanel')
        .eq('email', targetEmail)
        .single()

      if (conta?.senha_cyberpanel) {
        // Desencriptar base64
        try {
          password = Buffer.from(conta.senha_cyberpanel, 'base64').toString('utf8')
        } catch {
          password = conta.senha_cyberpanel
        }
      }
    }

    // Se temos credenciais, fazer auto-login via HTML com form POST
    if (password) {
      const domain = targetEmail.split('@')[1] || 'visualdesigne.com'
      const roundcubeUrl = `https://mail.${domain}/roundcube/`

      // Página HTML que faz POST automático para o RoundCube
      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>A abrir o Webmail...</title>
  <style>
    body { 
      font-family: 'Inter', sans-serif; 
      display: flex; 
      align-items: center; 
      justify-content: center; 
      height: 100vh; 
      margin: 0;
      background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%);
      color: white;
    }
    .card {
      text-align: center;
      padding: 2rem;
      background: rgba(255,255,255,0.05);
      border-radius: 16px;
      border: 1px solid rgba(255,255,255,0.1);
    }
    .spinner {
      width: 40px; height: 40px;
      border: 3px solid rgba(255,255,255,0.2);
      border-top-color: #3b82f6;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 1rem;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    p { margin: 0; opacity: 0.7; font-size: 0.9rem; }
  </style>
</head>
<body>
  <div class="card">
    <div class="spinner"></div>
    <p>A iniciar sessão no Webmail...</p>
    <p style="margin-top:0.5rem; font-size:0.8rem; opacity:0.5">${targetEmail}</p>
  </div>
  <form id="rc_login" method="POST" action="${roundcubeUrl}" style="display:none">
    <input type="hidden" name="_task" value="login">
    <input type="hidden" name="_action" value="login">
    <input type="hidden" name="_timezone" value="Africa/Maputo">
    <input type="hidden" name="_user" value="${targetEmail}">
    <input type="hidden" name="_pass" value="${password}">
  </form>
  <script>
    setTimeout(function() {
      document.getElementById('rc_login').submit();
    }, 800);
  </script>
</body>
</html>`

      return new NextResponse(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      })
    }

    // Sem credenciais → RoundCube normal para login manual
    const domain = targetEmail.split('@')[1] || 'visualdesigne.com'
    return NextResponse.redirect(`https://mail.${domain}/roundcube/`)

  } catch (error) {
    console.error('[roundcube-sso]', error)
    return NextResponse.redirect(ROUNDCUBE_BASE)
  }
}
