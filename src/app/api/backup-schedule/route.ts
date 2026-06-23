import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdminOrReseller } from '@/lib/panel-api-auth'
import { listMirrorWebsites } from '@/lib/panel-mirror-read'
import { resolvePanelDaContext } from '@/lib/panel-api-context'
import { PANEL_SLUG } from '@/lib/panel-tenant'
import { TAB_BACKUP_ITEMS } from '@/lib/da-backup-types'
import type { BackupItemId, BackupTab } from '@/lib/da-backup-types'
import type { BackupScheduleInput, BackupScheduleRow } from '@/lib/panel-backup-schedule-types'
import { computeNextRunAt } from '@/lib/panel-backup-schedule-utils'
import { runBackupScheduleRow } from '@/lib/panel-backup-schedule-run'
import { ensureBackupSchema } from '@/lib/panel-backup-schema'
import type { PanelAuthSuccess } from '@/lib/panel-api-auth'

export const dynamic = 'force-dynamic'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  )
}

function rowToClient(r: Record<string, unknown>): BackupScheduleRow {
  return {
    id: String(r.id),
    panel_slug: String(r.panel_slug),
    owner: String(r.owner),
    enabled: Boolean(r.enabled),
    frequency: r.frequency as BackupScheduleRow['frequency'],
    run_time: String(r.run_time).slice(0, 5),
    day_of_week: r.day_of_week == null ? null : Number(r.day_of_week),
    runs_per_month: Number(r.runs_per_month) || 1,
    month_days: Array.isArray(r.month_days) ? r.month_days.map(Number) : [1],
    domain_mode: r.domain_mode as BackupScheduleRow['domain_mode'],
    domains: Array.isArray(r.domains) ? r.domains.map(String) : [],
    backup_scope: r.backup_scope as BackupTab,
    backup_items: Array.isArray(r.backup_items) ? r.backup_items.map(String) as BackupItemId[] : [],
    bucket_name: String(r.bucket_name || 'panel-backups'),
    retention_days: Number(r.retention_days) || 30,
    last_run_at: r.last_run_at ? String(r.last_run_at) : null,
    next_run_at: r.next_run_at ? String(r.next_run_at) : null,
    updated_at: String(r.updated_at),
  }
}

async function resolveOwnerForDomain(domain: string, auth?: PanelAuthSuccess): Promise<string | null> {
  if (!domain) return null
  const session = auth ?? await requireAdminOrReseller()
  if ('error' in session) return null
  const { mirrorScope } = await resolvePanelDaContext(session)
  const sites = await listMirrorWebsites(mirrorScope)
  return sites.find((s) => s.domain === domain)?.owner?.toLowerCase() || null
}

async function ownersInScope(auth: PanelAuthSuccess): Promise<string[]> {
  const { mirrorScope } = await resolvePanelDaContext(auth)
  const sites = await listMirrorWebsites(mirrorScope)
  return [...new Set(sites.map((s) => s.owner?.toLowerCase()).filter(Boolean) as string[])]
}

export async function GET(req: NextRequest) {
  const auth = await requireAdminOrReseller()
  if ('error' in auth) return auth.error

  await ensureBackupSchema()

  const sp = req.nextUrl.searchParams
  const listAll = sp.get('list') === '1'

  if (listAll) {
    const owners = await ownersInScope(auth)
    if (!owners.length) return NextResponse.json({ success: true, data: [] })
    const { data, error } = await db()
      .from('panel_backup_schedules')
      .select('*')
      .eq('panel_slug', PANEL_SLUG)
      .in('owner', owners)
      .order('updated_at', { ascending: false })
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 502 })
    return NextResponse.json({ success: true, data: (data || []).map(rowToClient) })
  }

  const domain = sp.get('domain') || ''
  const owner = await resolveOwnerForDomain(domain, auth)
  if (!owner) {
    return NextResponse.json({ success: false, error: 'Conta de hospedagem não encontrada.' }, { status: 400 })
  }

  const { data, error } = await db()
    .from('panel_backup_schedules')
    .select('*')
    .eq('panel_slug', PANEL_SLUG)
    .eq('owner', owner)
    .maybeSingle()

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 502 })
  return NextResponse.json({ success: true, data: data ? rowToClient(data) : null })
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminOrReseller()
  if ('error' in auth) return auth.error

  await ensureBackupSchema()

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido.' }, { status: 400 })
  }

  const action = String(body.action || 'save')
  const domain = String(body.domain || '')
  const owner = await resolveOwnerForDomain(domain, auth)
  if (!owner && action !== 'save') {
    return NextResponse.json({ success: false, error: 'Conta de hospedagem não encontrada.' }, { status: 400 })
  }

  if (action === 'delete') {
    const { error } = await db()
      .from('panel_backup_schedules')
      .delete()
      .eq('panel_slug', PANEL_SLUG)
      .eq('owner', owner!)
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 502 })
    return NextResponse.json({ success: true })
  }

  if (action === 'run-now') {
    const { data: row, error } = await db()
      .from('panel_backup_schedules')
      .select('*')
      .eq('panel_slug', PANEL_SLUG)
      .eq('owner', owner!)
      .maybeSingle()
    if (error || !row) {
      return NextResponse.json({ success: false, error: error?.message || 'Agendamento não encontrado.' }, { status: 404 })
    }
    const { mirrorScope } = await resolvePanelDaContext(auth)
    const result = await runBackupScheduleRow(row, mirrorScope)
    if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: 502 })
    return NextResponse.json({ success: true })
  }

  if (!owner) {
    return NextResponse.json({ success: false, error: 'Conta de hospedagem não encontrada.' }, { status: 400 })
  }

  const scope = (String(body.backupScope || 'full') as BackupTab)
  const backupItems = Array.isArray(body.backupItems) && body.backupItems.length
    ? body.backupItems.map(String) as BackupItemId[]
    : TAB_BACKUP_ITEMS[scope] || TAB_BACKUP_ITEMS.full

  const input: BackupScheduleInput = {
    owner,
    enabled: Boolean(body.enabled),
    frequency: (String(body.frequency || 'weekly') as BackupScheduleInput['frequency']),
    runTime: String(body.runTime || '03:00'),
    dayOfWeek: body.dayOfWeek == null ? 1 : Number(body.dayOfWeek),
    runsPerMonth: Math.min(4, Math.max(1, Number(body.runsPerMonth) || 1)),
    monthDays: Array.isArray(body.monthDays) && body.monthDays.length
      ? body.monthDays.map(Number)
      : [1],
    domainMode: body.domainMode === 'selected' ? 'selected' : 'all',
    domains: Array.isArray(body.domains) ? body.domains.map(String) : [],
    backupScope: scope,
    backupItems,
    retentionDays: Math.min(365, Math.max(1, Number(body.retentionDays) || 30)),
  }

  const nextRunAt = input.enabled
    ? computeNextRunAt({
        frequency: input.frequency,
        runTime: input.runTime,
        dayOfWeek: input.dayOfWeek,
        runsPerMonth: input.runsPerMonth,
        monthDays: input.monthDays,
      })
    : null

  const payload = {
    panel_slug: PANEL_SLUG,
    owner,
    enabled: input.enabled,
    frequency: input.frequency,
    run_time: input.runTime,
    day_of_week: input.frequency === 'weekly' ? (input.dayOfWeek ?? 1) : null,
    runs_per_month: input.runsPerMonth,
    month_days: input.monthDays,
    domain_mode: input.domainMode,
    domains: input.domains,
    backup_scope: input.backupScope,
    backup_items: input.backupItems,
    bucket_name: 'panel-backups',
    retention_days: input.retentionDays,
    next_run_at: nextRunAt?.toISOString() ?? null,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await db()
    .from('panel_backup_schedules')
    .upsert(payload, { onConflict: 'panel_slug,owner' })
    .select('*')
    .single()

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 502 })
  return NextResponse.json({ success: true, data: rowToClient(data) })
}
