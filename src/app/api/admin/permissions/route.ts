import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  try {
    const supabaseInfo = await createClient()
    const { data: { user } } = await supabaseInfo.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const role = searchParams.get('role')

    if (!role) {
      return NextResponse.json({ error: 'Role is required' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    const supabaseAdmin = createAdminClient(supabaseUrl, supabaseKey)

    // Tentar ler da tabela custom (fallback silencioso se falhar)
    try {
      const { data, error } = await supabaseAdmin
        .from('role_permissions')
        .select('permissions')
        .eq('role', role)
        .single()

      if (data) {
        return NextResponse.json({ success: true, permissions: data.permissions })
      }
    } catch {
      // Tabela pode não existir ainda
    }

    // Se falhar ou não encontrar, devolve objecto vazio para usar os defaults no frontend.
    return NextResponse.json({ success: true, permissions: {} })
  } catch (error) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabaseInfo = await createClient()
    const { data: { user } } = await supabaseInfo.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Verificar se é admin
    const isAdmin = user.user_metadata?.role === 'admin' || 
                   ['silva.chamo@gmail.com', 'admin@visualdesignmoz.com'].includes(user.email || '');
    
    if (!isAdmin) {
      return NextResponse.json({ error: 'Acesso restrito a administradores' }, { status: 403 })
    }

    const { role, permissions } = await request.json()

    if (!role || !permissions) {
      return NextResponse.json({ error: 'Role and permissions are required' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    const supabaseAdmin = createAdminClient(supabaseUrl, supabaseKey)

    // Tentar criar a tabela silenciosamente caso não exista, usando RPC exec_sql.
    try {
      await supabaseAdmin.rpc('exec_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS role_permissions (
            role TEXT PRIMARY KEY,
            permissions JSONB NOT NULL DEFAULT '{}',
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
        `
      })
    } catch (e) {
      // pode falhar se rpc não estiver disponível, seguimos o processo na mesma.
    }

    // Guardar os dados via UPSERT na tabela
    const { error } = await supabaseAdmin
      .from('role_permissions')
      .upsert({ 
        role, 
        permissions,
        updated_at: new Date().toISOString()
      }, { onConflict: 'role' })

    if (error) {
      console.error('Erro a guardar permissões:', error)
      return NextResponse.json({ error: 'Erro ao guardar as permissões na BD' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Permissões atualizadas com sucesso' })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 })
  }
}
