import { NextRequest, NextResponse } from 'next/server'
import { runDailyNotificationCheck } from '@/lib/notification-system'

// Endpoint para executar verificação diária de notificações
export async function POST(request: NextRequest) {
  try {
    // Verificar se é uma requisição válida (poderia adicionar autenticação aqui)
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Executar verificação de notificações
    const result = await runDailyNotificationCheck()
    
    return NextResponse.json({
      success: true,
      message: 'Verificação de notificações concluída',
      data: result
    })
  } catch (error) {
    console.error('Erro no endpoint de notificações:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    )
  }
}

// Endpoint para obter status das notificações
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Aqui você poderia buscar estatísticas do banco de dados
    // Por enquanto, retornamos um status básico
    return NextResponse.json({
      success: true,
      message: 'Sistema de notificações activo',
      data: {
        lastCheck: new Date().toISOString(),
        nextCheck: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 horas depois
        status: 'active'
      }
    })
  } catch (error) {
    console.error('Erro no GET de notificações:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Erro interno do servidor'
      },
      { status: 500 }
    )
  }
}
