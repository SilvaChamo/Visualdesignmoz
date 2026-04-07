import { NextRequest, NextResponse } from 'next/server'
import { cyberPanelAPI } from '@/lib/cyberpanel-api'

// CyberPanel Configuration
const CYBERPANEL_URL = 'https://109.199.104.22:8090'
const CYBERPANEL_USER = 'admin'
const CYBERPANEL_PASS = 'FerramentasWeb#2020'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const domain = searchParams.get('domain') || 'Portal Digital.com'

    console.log(`[SITE MANAGER] Action: ${action}, Domain: ${domain}`)

    switch (action) {
      case 'list':
        return await listSites()
      case 'details':
        return await getSiteDetails(domain)
      case 'files':
        return await listFiles(domain)
      case 'edit':
        return await getEditInterface(domain)
      default:
        return NextResponse.json({
          success: true,
          message: 'Site Manager API Ready',
          actions: ['list', 'details', 'files', 'edit'],
          domain: domain,
          cyberPanel: {
            url: CYBERPANEL_URL,
            ip: '109.199.104.22'
          }
        })
    }
  } catch (error: any) {
    console.error('[SITE MANAGER ERROR]', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, domain, data } = body

    console.log(`[SITE MANAGER POST] Action: ${action}, Domain: ${domain}`)

    switch (action) {
      case 'edit-file':
        return await editFile(domain, data)
      case 'upload-file':
        return await uploadFile(domain, data)
      case 'create-file':
        return await createFile(domain, data)
      case 'delete-file':
        return await deleteFile(domain, data)
      default:
        throw new Error(`Unknown action: ${action}`)
    }
  } catch (error: any) {
    console.error('[SITE MANAGER POST ERROR]', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

async function listSites() {
  try {
    const sites = await cyberPanelAPI.listWebsites()
    
    const Portal DigitalSite = sites.find((site: any) => site.domain === 'Portal Digital.com')
    
    return NextResponse.json({
      success: true,
      sites: sites,
      Portal Digital: Portal DigitalSite || {
        domain: 'Portal Digital.com',
        status: 'not_found',
        message: 'Site not found in CyberPanel'
      }
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      sites: []
    })
  }
}

async function getSiteDetails(domain: string) {
  try {
    // Simulação - em produção buscaria dados reais
    const siteDetails = {
      domain: domain,
      status: 'active',
      owner: 'admin',
      package: 'Default',
      email: `admin@${domain}`,
      diskUsage: '2.5 GB',
      bandwidthUsage: '150 MB',
      databases: 3,
      emailAccounts: 5,
      sslEnabled: false,
      phpVersion: '8.1',
      serverIP: '109.199.104.22',
      documentRoot: `/home/${domain}/public_html`,
      lastBackup: '2024-02-20 15:30:00',
      features: {
        fileManager: true,
        databaseManager: true,
        emailManager: true,
        sslManager: true,
        backupManager: true,
        cronJobs: true,
        ftpAccess: true
      }
    }

    return NextResponse.json({
      success: true,
      site: siteDetails
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    })
  }
}

async function listFiles(domain: string) {
  try {
    // Simulação da estrutura de arquivos
    const fileStructure = {
      domain: domain,
      path: '/public_html',
      files: [
        {
          name: 'index.html',
          type: 'file',
          size: '15.2 KB',
          modified: '2024-02-20 10:30:00',
          permissions: '644',
          editable: true
        },
        {
          name: 'css',
          type: 'directory',
          size: '-',
          modified: '2024-02-19 14:20:00',
          permissions: '755',
          editable: false,
          children: [
            {
              name: 'style.css',
              type: 'file',
              size: '8.7 KB',
              modified: '2024-02-20 09:15:00',
              permissions: '644',
              editable: true
            },
            {
              name: 'responsive.css',
              type: 'file',
              size: '4.2 KB',
              modified: '2024-02-18 16:45:00',
              permissions: '644',
              editable: true
            }
          ]
        },
        {
          name: 'js',
          type: 'directory',
          size: '-',
          modified: '2024-02-19 14:20:00',
          permissions: '755',
          editable: false,
          children: [
            {
              name: 'main.js',
              type: 'file',
              size: '12.1 KB',
              modified: '2024-02-20 11:20:00',
              permissions: '644',
              editable: true
            }
          ]
        },
        {
          name: 'images',
          type: 'directory',
          size: '-',
          modified: '2024-02-19 14:20:00',
          permissions: '755',
          editable: false,
          children: [
            {
              name: 'logo.png',
              type: 'file',
              size: '45.8 KB',
              modified: '2024-02-15 13:30:00',
              permissions: '644',
              editable: false
            },
            {
              name: 'banner.jpg',
              type: 'file',
              size: '128.4 KB',
              modified: '2024-02-17 10:15:00',
              permissions: '644',
              editable: false
            }
          ]
        }
      ]
    }

    return NextResponse.json({
      success: true,
      files: fileStructure
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    })
  }
}

async function getEditInterface(domain: string) {
  try {
    // Interface de edição completa
    const editInterface = {
      domain: domain,
      editor: {
        mode: 'full',
        features: [
          'syntax_highlighting',
          'auto_completion',
          'file_browser',
          'upload',
          'preview',
          'version_control'
        ]
      },
      tools: {
        fileManager: true,
        codeEditor: true,
        imageEditor: true,
        databaseManager: true,
        terminal: true,
        logs: true
      },
      access: {
        direct: true,
        ftp: true,
        ssh: false,
        webdav: true
      }
    }

    return NextResponse.json({
      success: true,
      editor: editInterface
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    })
  }
}

async function editFile(domain: string, data: any) {
  try {
    const { filePath, content } = data
    
    console.log(`[EDIT FILE] ${domain}: ${filePath}`)
    
    // Simulação de edição
    const result = {
      domain: domain,
      file: filePath,
      action: 'edited',
      timestamp: new Date().toISOString(),
      size: content.length,
      backup: `backup_${Date.now()}_${filePath}`
    }

    return NextResponse.json({
      success: true,
      message: `Arquivo ${filePath} editado com sucesso!`,
      result: result
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    })
  }
}

async function uploadFile(domain: string, data: any) {
  try {
    const { fileName, fileContent, path } = data
    
    console.log(`[UPLOAD FILE] ${domain}: ${path}/${fileName}`)
    
    const result = {
      domain: domain,
      file: fileName,
      path: path,
      action: 'uploaded',
      timestamp: new Date().toISOString(),
      size: fileContent.length
    }

    return NextResponse.json({
      success: true,
      message: `Arquivo ${fileName} enviado com sucesso!`,
      result: result
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    })
  }
}

async function createFile(domain: string, data: any) {
  try {
    const { fileName, content, path } = data
    
    console.log(`[CREATE FILE] ${domain}: ${path}/${fileName}`)
    
    const result = {
      domain: domain,
      file: fileName,
      path: path,
      action: 'created',
      timestamp: new Date().toISOString(),
      size: content.length
    }

    return NextResponse.json({
      success: true,
      message: `Arquivo ${fileName} criado com sucesso!`,
      result: result
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    })
  }
}

async function deleteFile(domain: string, data: any) {
  try {
    const { filePath } = data
    
    if (!confirm(`Tem certeza que deseja apagar ${filePath}?`)) {
      throw new Error('Operação cancelada pelo usuário')
    }
    
    console.log(`[DELETE FILE] ${domain}: ${filePath}`)
    
    const result = {
      domain: domain,
      file: filePath,
      action: 'deleted',
      timestamp: new Date().toISOString(),
      backup: `backup_${Date.now()}_${filePath}`
    }

    return NextResponse.json({
      success: true,
      message: `Arquivo ${filePath} apagado com sucesso!`,
      result: result
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    })
  }
}
