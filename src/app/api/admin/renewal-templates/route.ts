import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Cliente com service role key para bypass RLS em operações admin
const getServiceClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createServiceClient(supabaseUrl, supabaseServiceKey)
}

// Estes templates viram o conteúdo real enviado por email a clientes —
// sem esta verificação, qualquer pedido não autenticado poderia reescrever
// o que é enviado (incluindo links/HTML arbitrário).
async function checkIsAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const adminEmails = ['admin@visualdesignmoz.com', 'silva.chamo@gmail.com', 'geral@visualdesignmoz.com', 'suporte@visualdesignmoz.com']
  return adminEmails.includes(user.email || '') || user.user_metadata?.role === 'admin'
}

// GET - Carregar todos os templates
export async function GET() {
  try {
    if (!(await checkIsAdmin())) {
      return NextResponse.json({ error: 'Acesso restrito' }, { status: 403 })
    }

    const supabase = await createClient()

    const { data: templates, error } = await supabase
      .from('renewal_templates')
      .select('*')
      .eq('is_active', true)
      .order('days_before', { ascending: false })
    
    if (error) {
      console.error('Erro ao carregar templates:', error)
      // Se a tabela não existe, retornar array vazio (fallback para padrão)
      const errorMsg = error.message || ''
      const isTableNotFound = 
        errorMsg.toLowerCase().includes('does not exist') || 
        errorMsg.toLowerCase().includes('could not find') ||
        errorMsg.toLowerCase().includes('in the schema cache') ||
        error.code === '42P01'
      
      if (isTableNotFound) {
        console.log('Tabela renewal_templates não existe. Retornando vazio para fallback.')
        return NextResponse.json({ 
          success: true, 
          templates: [],
          warning: 'Tabela não configurada. Execute o script SQL.'
        })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ 
      success: true, 
      templates: templates || [] 
    })
  } catch (error: any) {
    console.error('Erro na API de templates:', error)
    return NextResponse.json(
      { error: error.message || 'Erro interno' }, 
      { status: 500 }
    )
  }
}

// POST - Salvar/actualizar templates
export async function POST(request: Request) {
  try {
    if (!(await checkIsAdmin())) {
      return NextResponse.json({ error: 'Acesso restrito' }, { status: 403 })
    }

    const supabase = getServiceClient()
    const body = await request.json()
    const { templates } = body
    
    if (!templates || !Array.isArray(templates)) {
      return NextResponse.json(
        { error: 'Templates inválidos' }, 
        { status: 400 }
      )
    }
    
    // Transformar templates para o formato do banco
    const dbTemplates = templates.map(t => ({
      template_id: t.id,
      name: t.name,
      days_before: t.daysBefore,
      title: t.title,
      message: t.message,
      email_subject: t.emailSubject,
      email_body: t.emailBody,
      type: t.type,
      urgency: t.urgency,
      is_active: true,
      updated_at: new Date().toISOString()
    }))
    
    // Usar upsert para inserir ou actualizar
    const { data, error } = await supabase
      .from('renewal_templates')
      .upsert(dbTemplates, { 
        onConflict: 'template_id',
        ignoreDuplicates: false 
      })
    
    if (error) {
      console.error('Erro ao salvar templates:', error)
      // Se a tabela não existe, retornar erro específico
      const errorMsg = error.message || ''
      const isTableNotFound = 
        errorMsg.toLowerCase().includes('does not exist') || 
        errorMsg.toLowerCase().includes('could not find') ||
        errorMsg.toLowerCase().includes('in the schema cache') ||
        error.code === '42P01'
      
      if (isTableNotFound) {
        return NextResponse.json({ 
          error: 'Tabela renewal_templates não existe. Execute o script SQL primeiro.' 
        }, { status: 400 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Templates salvos com sucesso',
      count: templates.length 
    })
  } catch (error: any) {
    console.error('Erro na API de templates:', error)
    return NextResponse.json(
      { error: error.message || 'Erro interno' }, 
      { status: 500 }
    )
  }
}

// DELETE - Resetar para padrão (desativar customizados)
export async function DELETE() {
  try {
    if (!(await checkIsAdmin())) {
      return NextResponse.json({ error: 'Acesso restrito' }, { status: 403 })
    }

    const supabase = getServiceClient()
    
    // Desativar todos os templates customizados
    const { error } = await supabase
      .from('renewal_templates')
      .update({ is_active: false })
      .neq('template_id', 'placeholder') // condição para actualizar todos
    
    if (error) {
      console.error('Erro ao resetar templates:', error)
      // Se a tabela não existe, retornar erro específico
      const errorMsg = error.message || ''
      const isTableNotFound = 
        errorMsg.toLowerCase().includes('does not exist') || 
        errorMsg.toLowerCase().includes('could not find') ||
        errorMsg.toLowerCase().includes('in the schema cache') ||
        error.code === '42P01'
      
      if (isTableNotFound) {
        return NextResponse.json({ 
          error: 'Tabela renewal_templates não existe. Execute o script SQL primeiro.' 
        }, { status: 400 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Templates resetados para padrão' 
    })
  } catch (error: any) {
    console.error('Erro na API de templates:', error)
    return NextResponse.json(
      { error: error.message || 'Erro interno' }, 
      { status: 500 }
    )
  }
}
