import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'

const supabase = createClient(supabaseUrl, supabaseKey)

// Encriptação simples base64 (para produção usar crypto)
const encrypt = (text: string) => Buffer.from(text).toString('base64')
const decrypt = (text: string) => Buffer.from(text, 'base64').toString('utf8')

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const clienteId = searchParams.get('cliente_id') || 'demo'

  try {
    const { data, error } = await supabase
      .from('email_contas')
      .select('*')
      .eq('cliente_id', clienteId)

    if (error) throw error

    const contas = (data || []).map(c => ({
      ...c,
      password_smtp: '' // nunca devolver password
    }))

    return NextResponse.json({ success: true, contas })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { cliente_id = 'demo', email, password, nome, tipo = 'webmail' } = await req.json()

    // Tenta criar no CyberPanel via comando SSH
    const domain = email.split('@')[1]
    const user = email.split('@')[0]

    // Guarda no Supabase com password encriptada
    const { data, error } = await supabase
      .from('email_contas')
      .upsert({
        cliente_id,
        email,
        nome_conta: nome || user,
        servidor_imap: '109.199.104.22',
        porta_imap: 993,
        servidor_smtp: '109.199.104.22',
        porta_smtp: 465,
        ssl_imap: true,
        ssl_smtp: true,
        tipo_conta: tipo,
        password_smtp: encrypt(password),
        activo: true
      }, { onConflict: 'email' })
      .select()

    if (error) throw error

    return NextResponse.json({
      success: true,
      conta: data?.[0],
      credenciais: {
        email,
        servidor_entrada: '109.199.104.22',
        porta_imap: 993,
        servidor_saida: '109.199.104.22',
        porta_smtp: 465,
        ssl: true,
        utilizador: email
      }
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { email } = await req.json()
    const { error } = await supabase.from('email_contas').delete().eq('email', email)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
