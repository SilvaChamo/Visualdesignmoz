import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { draftId } = await req.json()
    if (!draftId) {
      return NextResponse.json({ error: 'DraftId obrigatório' }, { status: 400 })
    }

    const { error } = await supabase
      .from('email_rascunhos')
      .delete()
      .eq('id', draftId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
