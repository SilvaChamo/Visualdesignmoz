import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { runBackupScheduleRow } from '@/lib/panel-backup-schedule-run'

export const dynamic = 'force-dynamic'

const CRON_SECRET = process.env.CRON_SECRET || 'default-secret-change-in-production'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  )
}

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  const authHeader = req.headers.get('authorization') || ''
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (secret !== CRON_SECRET && bearer !== CRON_SECRET) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const now = new Date()
  const { data: schedules, error } = await db()
    .from('panel_backup_schedules')
    .select('*')
    .eq('enabled', true)
    .lte('next_run_at', now.toISOString())

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 502 })
  }

  const results: { owner: string; ok: boolean; detail?: string }[] = []

  for (const row of schedules || []) {
    const result = await runBackupScheduleRow(row)
    results.push({ owner: String(row.owner), ok: result.ok, detail: result.error })
  }

  return NextResponse.json({ success: true, processed: results.length, results })
}
