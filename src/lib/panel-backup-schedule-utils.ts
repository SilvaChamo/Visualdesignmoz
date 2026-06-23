import type { BackupFrequency } from '@/lib/panel-backup-schedule-types'

function parseRunTime(runTime: string): { h: number; m: number } {
  const [h, m] = runTime.split(':').map((x) => Number(x) || 0)
  return { h: Math.min(23, Math.max(0, h)), m: Math.min(59, Math.max(0, m)) }
}

function atTime(base: Date, h: number, m: number): Date {
  const d = new Date(base)
  d.setHours(h, m, 0, 0)
  return d
}

export function computeNextRunAt(input: {
  frequency: BackupFrequency
  runTime: string
  dayOfWeek: number | null
  runsPerMonth: number
  monthDays: number[]
  from?: Date
}): Date {
  const now = input.from ?? new Date()
  const { h, m } = parseRunTime(input.runTime)

  if (input.frequency === 'daily') {
    let next = atTime(now, h, m)
    if (next <= now) next = atTime(new Date(now.getTime() + 86400000), h, m)
    return next
  }

  if (input.frequency === 'weekly') {
    const target = input.dayOfWeek ?? 1
    const next = atTime(now, h, m)
    let diff = (target - next.getDay() + 7) % 7
    if (diff === 0 && next <= now) diff = 7
    next.setDate(next.getDate() + diff)
    return next
  }

  const days = [...(input.monthDays.length ? input.monthDays : [1])].sort((a, b) => a - b)
  const candidates: Date[] = []
  for (let monthOffset = 0; monthOffset <= 2; monthOffset += 1) {
    const base = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1)
    for (const day of days.slice(0, Math.max(1, input.runsPerMonth))) {
      const d = new Date(base.getFullYear(), base.getMonth(), Math.min(day, 28), h, m, 0, 0)
      if (d > now) candidates.push(d)
    }
  }
  if (candidates.length) return candidates[0]
  const fallback = new Date(now.getFullYear(), now.getMonth() + 1, days[0], h, m, 0, 0)
  return fallback
}

export function formatScheduleWhen(row: {
  frequency: BackupFrequency
  run_time: string
  day_of_week: number | null
  runs_per_month: number
  month_days: number[]
}): string {
  const time = row.run_time.slice(0, 5)
  if (row.frequency === 'daily') return `Todos os dias às ${time}`
  if (row.frequency === 'weekly') {
    const days = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
    const d = days[row.day_of_week ?? 1] || 'segunda'
    return `Todas as ${d}s às ${time}`
  }
  const days = row.month_days.slice(0, row.runs_per_month).join(', ')
  return `${row.runs_per_month}× por mês (dias ${days}) às ${time}`
}
