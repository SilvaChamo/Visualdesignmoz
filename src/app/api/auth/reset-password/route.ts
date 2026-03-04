import { createClient } from '@supabase/supabase-js'
import { resend } from '@/lib/resend'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { email } = await req.json()

    if (!email) {
      return NextResponse.json({ error: 'Email é obrigatório' }, { status: 400 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Gerar link de recuperação
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        redirectTo: `${new URL(req.url).origin}/auth/reset-password`
      }
    })

    if (error) {
      console.error('Error generating reset link:', error)
      // Não revelamos se o email existe por segurança, mas logamos o erro
      return NextResponse.json({ success: true, message: 'Se o email existir, um link foi enviado.' })
    }

    const resetLink = data.properties.action_link
    const now = new Date().toLocaleString('pt-PT', { timeZone: 'Africa/Maputo' })

    // Enviar email via Resend com template premium
    const emailResult = await resend.emails.send({
      from: 'VisualDesign <noreply@visualdesigne.com>',
      to: email,
      subject: 'Recuperação de Password - VisualDesign',
      html: `
        <div style="font-family: 'Inter', sans-serif; background-color: #000; color: #fff; padding: 40px 40px 30px; border-radius: 16px; max-width: 600px; margin: 0 auto; border: 1px solid #333;">
          <div style="text-align: center; margin-bottom: 30px;">
            <img src="https://gwankhxcbkrtgxopbxwd.supabase.co/storage/v1/object/public/assets/logotipoII.png" alt="VisualDesign" style="height: 60px;">
          </div>
          
          <h1 style="color: #fff; font-size: 24px; font-weight: 800; text-align: center; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 20px;">
            Recuperação de Acesso
          </h1>
          
          <p style="color: #ccc; font-size: 16px; line-height: 1.6; text-align: center; margin-bottom: 30px;">
            Recebemos um pedido para redefinir a password da sua conta. Se não fez este pedido, pode ignorar este email com segurança.
          </p>
          
          <div style="text-align: center; margin-bottom: 30px;">
            <a href="${resetLink}" style="background-color: #cc0000; color: #fff; padding: 16px 32px; border-radius: 8px; font-weight: 700; text-decoration: none; display: inline-block; text-transform: uppercase; letter-spacing: 1px; box-shadow: 0 4px 15px rgba(204, 0, 0, 0.3);">
              Redefinir Password
            </a>
          </div>

          <h3 style="color: #fff; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; text-align: center; margin-bottom: 8px;">Detalhes de Segurança</h3>
          <p style="color: #888; font-size: 13px; text-align: center; margin-bottom: 30px; font-style: italic;">Hora do Pedido: ${now}</p>

          <div style="color: #666; font-size: 12px; text-align: center; border-top: 1px solid #333; padding-top: 20px;">
            <p style="margin-bottom: 10px;">Este link expira em 60 minutos por razões de segurança.</p>
            <p>VisualDesign &copy; 2024. Todos os direitos reservados.</p>
          </div>
          
          <div style="height: 3px; background: linear-gradient(90deg, #7f0000, #cc0000, #7f0000); margin-top: 20px; border-radius: 2px;"></div>
        </div>
      `
    })

    if (emailResult.error) {
      console.error('Resend error:', emailResult.error)
      return NextResponse.json({ error: 'Erro ao enviar email' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Email enviado com sucesso' })
  } catch (err: any) {
    console.error('Reset Password API Route Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
