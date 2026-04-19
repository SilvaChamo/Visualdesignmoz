import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id } = await params

    // Buscar em domain_renewals
    let { data: domainRenewal, error: domainError } = await supabase
      .from('domain_renewals')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (domainRenewal) {
      return NextResponse.json({
        success: true,
        renewal: { ...domainRenewal, type: 'domain' }
      })
    }

    // Buscar em hosting_renewals
    let { data: hostingRenewal, error: hostingError } = await supabase
      .from('hosting_renewals')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (hostingRenewal) {
      return NextResponse.json({
        success: true,
        renewal: { ...hostingRenewal, type: 'hosting' }
      })
    }

    return NextResponse.json({ error: 'Renovação não encontrada' }, { status: 404 })
  } catch (error) {
    console.error('Erro:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
