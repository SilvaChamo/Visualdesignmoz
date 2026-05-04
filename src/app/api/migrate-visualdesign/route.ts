import { NextRequest, NextResponse } from 'next/server'
import { getServerHost, getCPUrl } from '@/lib/server-config'

// Server Panel API Configuration
const CYBERPANEL_URL = getCPUrl()
const CYBERPANEL_USER = 'admin'
const CYBERPANEL_PASS = 'FerramentasWeb#2020'

// MozServer Configuration (para ler dados existentes)
const MOZSERVER_URL = 'https://za4.mozserver.com:2087'
const MOZSERVER_USER = 'yknrnlev'
const MOZSERVER_PASS = 'FerramentasWeb#2020'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { domain = 'Portal Digital.com', preserveContent = true } = body

    console.log(`[MIGRATION] Starting migration for ${domain}`)

    // 1. Preparar dados da migração
    console.log('[MIGRATION] Preparing migration data...')
    
    const migrationData = {
      domain: domain,
      source: {
        server: 'MozServer',
        url: 'https://za4.mozserver.com:2087',
        status: 'existing_content'
      },
      destination: {
        server: 'Server Panel',
        url: CYBERPANEL_URL,
        ip: getServerHost(),
        status: 'ready_for_migration'
      },
      dns: {
        records: [
          {
            type: 'A',
            name: '@',
            content: getServerHost(),
            ttl: 3600,
            action: 'update_when_ready'
          },
          {
            type: 'A',
            name: 'www',
            content: getServerHost(),
            ttl: 3600,
            action: 'update_when_ready'
          }
        ]
      },
      content: {
        preserve: preserveContent,
        backup: 'recommended',
        migration_method: 'manual'
      }
    }

    console.log('[MIGRATION] Migration data prepared:', migrationData)

    // 2. Gerar instruções manuais
    const manualSteps = [
      {
        step: 1,
        title: 'Acessar Painel do Servidor',
        description: `Abra ${CYBERPANEL_URL} no navegador`,
        credentials: {
          username: 'admin',
          password: 'FerramentasWeb#2020'
        }
      },
      {
        step: 2,
        title: 'Criar Site',
        description: 'Vá em Websites → Create Website',
        details: {
          domain: domain,
          email: `admin@${domain}`,
          package: 'Default',
          owner: 'admin'
        }
      },
      {
        step: 3,
        title: 'Configurar DNS',
        description: 'Adicionar registros DNS no painel do domínio',
        records: migrationData.dns.records
      },
      {
        step: 4,
        title: 'Migrar Conteúdo',
        description: preserveContent 
          ? 'Fazer backup do conteúdo atual e migrar para novo servidor'
          : 'Configurar novo site do zero'
      }
    ]

    return NextResponse.json({
      success: true,
      message: `Plano de migração para ${domain} criado com sucesso!`,
      data: {
        migration: migrationData,
        manualSteps: manualSteps,
        cyberPanel: {
          url: CYBERPANEL_URL,
          ip: getServerHost(),
          credentials: {
            username: 'admin',
            password: 'FerramentasWeb#2020'
          }
        },
        status: 'ready_for_manual_execution',
        estimatedTime: '30-60 minutos',
        priority: 'high'
      }
    })

  } catch (error: any) {
    console.error('[MIGRATION ERROR]', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Erro interno durante migração',
        details: error.stack 
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Portal Digital Migration API',
    status: 'ready',
    description: 'API para migrar Portal Digital.com do MozServer para CyberPanel',
    usage: 'POST /api/migrate-Portal Digital',
    parameters: {
      domain: 'Portal Digital.com (opcional)',
      preserveContent: 'true/false (opcional, default: true)'
    }
  })
}
