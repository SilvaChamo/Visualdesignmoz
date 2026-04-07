import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    // Caminho para o arquivo de alertas gerado pelo script Python
    const alertsPath = '/tmp/cyberpanel_renewal_alerts.json';
    
    // Verificar se o arquivo existe
    if (!fs.existsSync(alertsPath)) {
      return NextResponse.json({
        success: false,
        message: 'Nenhum alerta encontrado',
        alerts: []
      });
    }

    // Ler arquivo de alertas
    const alertsData = fs.readFileSync(alertsPath, 'utf8');
    const alerts = JSON.parse(alertsData);

    return NextResponse.json({
      success: true,
      alerts: alerts,
      lastUpdated: new Date().toISOString()
    });

  } catch (error) {
    console.error('Erro ao buscar alertas de renovação:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Erro ao carregar alertas',
      alerts: []
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, alertId, userId } = body;

    // Aqui você pode implementar ações como:
    // - Marcar alerta como lido
    // - Enviar notificação manual
    // - Atualizar status da renovação

    switch (action) {
      case 'markAsRead':
        // Implementar lógica para marcar como lido
        return NextResponse.json({
          success: true,
          message: 'Alerta marcado como lido'
        });

      case 'sendReminder':
        // Implementar lógica para enviar lembrete
        return NextResponse.json({
          success: true,
          message: 'Lembrete enviado com sucesso'
        });

      default:
        return NextResponse.json({
          success: false,
          message: 'Ação não reconhecida'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Erro ao processar ação de alerta:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Erro ao processar ação'
    }, { status: 500 });
  }
}
