import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { listMirrorPackages } from '@/lib/panel-mirror-read'

async function checkIsAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const adminEmails = ['admin@visualdesignmoz.com', 'silva.chamo@gmail.com', 'geral@visualdesignmoz.com', 'suporte@visualdesignmoz.com']
  return adminEmails.includes(user.email || '') || user.user_metadata?.role === 'admin'
}

// Lista os pacotes de hospedagem reais, tal como existem no DirectAdmin
// (espelho panel_packages) — usado para o seletor de pacote no formulário
// de renovações, em vez de nomes inventados.
export async function GET() {
  try {
    if (!(await checkIsAdmin())) {
      return NextResponse.json({ error: 'Acesso restrito' }, { status: 403 })
    }

    const packages = await listMirrorPackages({ role: 'admin' })

    return NextResponse.json({
      success: true,
      packages: packages.map(p => ({
        packageName: p.packageName,
        allowedDomains: p.allowedDomains,
        diskSpace: p.diskSpace,
        bandwidth: p.bandwidth,
      }))
    })
  } catch (error: any) {
    console.error('Erro ao listar pacotes:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
