import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { email, para, cc, bcc, assunto, corpo } = await req.json()
    if (!email || !para || !assunto || !corpo) {
      return NextResponse.json({ error: 'Campos obrigatórios faltam' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('email_rascunhos')
      .insert({
        email,
        para,
        cc,
        bcc,
        assunto,
        corpo,
        criado_em: new Date()
      })
      .select()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, draftId: data[0].id })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
