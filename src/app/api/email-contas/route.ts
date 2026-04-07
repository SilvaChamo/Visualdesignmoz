import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/server'
import { executeCyberPanelCommand } from '@/lib/cyberpanel-exec'

const adminEmails = ['admin@your-domain.com', 'silva.chamo@gmail.com', 'geral@your-domain.com'];

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'

// Cliente com privilégios de admin para operações na BD
const supabaseAdmin = createAdminClient(supabaseUrl, supabaseKey)

// Encriptação simples base64 (para produção usar crypto)
const encrypt = (text: string) => Buffer.from(text).toString('base64')
const decrypt = (text: string) => Buffer.from(text, 'base64').toString('utf8')

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url)
  const clienteId = searchParams.get('cliente_id') || session.user.id

  // Proteção: utilizador só vê o seu próprio ID, a menos que seja admin
  const isExplicitAdmin = adminEmails.includes(session.user?.email || '');
  if (clienteId !== session.user.id && session.user?.user_metadata?.role !== 'admin' && !isExplicitAdmin) {
    return NextResponse.json({ error: 'Acesso proibido a dados de terceiros' }, { status: 403 });
  }

  try {
    const { data, error } = await supabaseAdmin
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
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const { cliente_id = session.user.id, email, password, nome, tipo = 'webmail' } = await req.json()

    // Proteção: não deixar criar conta para outro cliente ID se não for admin
    const isExplicitAdmin = adminEmails.includes(session.user?.email || '');
    if (cliente_id !== session.user.id && session.user?.user_metadata?.role !== 'admin' && !isExplicitAdmin) {
      return NextResponse.json({ error: 'Operação não autorizada' }, { status: 403 });
    }

    // Tenta criar no CyberPanel via comando SSH
    const domain = email.split('@')[1]
    const user = email.split('@')[0]

    if (domain === 'your-domain.com' || domain.includes('Portal Digitale')) {
      try {
        await executeCyberPanelCommand(`cyberpanel createEmail --domainName ${domain} --userName ${user} --password '${password}'`);
      } catch (cpError) {
        console.error('Erro ao criar no CyberPanel:', cpError);
        // Continuamos para guardar no Supabase mesmo que falhe o CP (o utilizador pode configurar depois)
      }
    }

    // Guarda no Supabase com password encriptada
    const { data, error } = await supabaseAdmin
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
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const { email } = await req.json()

    // Primeiro verificar se a conta pertence ao utilizador ou se é admin
    const { data: conta } = await supabaseAdmin.from('email_contas').select('cliente_id').eq('email', email).single();

    const isExplicitAdmin = adminEmails.includes(session.user?.email || '');
    if (conta?.cliente_id !== session.user.id && session.user?.user_metadata?.role !== 'admin' && !isExplicitAdmin) {
      return NextResponse.json({ error: 'Não tens permissão para eliminar esta conta' }, { status: 403 });
    }

    const { error } = await supabaseAdmin.from('email_contas').delete().eq('email', email)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
