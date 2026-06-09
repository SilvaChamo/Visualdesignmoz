import { NextRequest, NextResponse } from 'next/server'
import { getServerHost, getCPUrl } from '@/lib/server-config'

const PANEL_URL = getCPUrl()

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { domain = 'Portal Digital.com', preserveContent = true } = body

    console.log(`[MIGRATION] Starting migration for ${domain}`)

    const migrationData = {
      domain: domain,
      source: {
        server: 'MozServer',
        url: 'https://za4.mozserver.com:2087',
        status: 'existing_content'
      },
      destination: {
        server: 'DirectAdmin',
        url: PANEL_URL,
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

    const manualSteps = [
      {
        step: 1,
        title: 'Acessar DirectAdmin',
        description: `Abra ${PANEL_URL} no navegador`,
      },
      {
        step: 2,
        title: 'Criar Site',
        description: 'Criar domínio e conta de utilizador no DirectAdmin',
        details: {
          domain: domain,
          email: `admin@${domain}`,
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
        panel: {
          url: PANEL_URL,
          ip: getServerHost(),
        },
        status: 'ready_for_manual_execution',
        estimatedTime: '30-60 minutos',
        priority: 'high'
      }
    })

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro interno durante migração'
    console.error('[MIGRATION ERROR]', error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Portal Digital Migration API',
    status: 'ready',
    description: 'API para migrar Portal Digital.com do MozServer para DirectAdmin',
    usage: 'POST /api/migrate-visualdesign',
    parameters: {
      domain: 'Portal Digital.com (opcional)',
      preserveContent: 'true/false (opcional, default: true)'
    }
  })
}
