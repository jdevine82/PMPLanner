import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { schedulesApi } from '@/api/schedules'
import { apiClient } from '@/api/client'
import type { AppSetting, MaintenanceSchedule } from '@/types'

export interface ForecastMonth {
  key: string
  label: string      // "Jul '26"
  shortLabel: string // "Jul"
  year: number
  month: number      // 1-12
  hours: number
}

const ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function buildMonthKeys(): ForecastMonth[] {
  const now = new Date()
  return Array.from({ length: 24 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    const y = d.getFullYear()
    const m = d.getMonth()
    const key = `${y}-${String(m + 1).padStart(2, '0')}`
    return { key, label: `${ABBR[m]} '${String(y).slice(2)}`, shortLabel: ABBR[m], year: y, month: m + 1, hours: 0 }
  })
}

function projectHours(schedules: MaintenanceSchedule[], monthKeys: string[]): Record<string, number> {
  const totals: Record<string, number> = Object.fromEntries(monthKeys.map((k) => [k, 0]))
  if (schedules.length === 0) return totals

  const [fy, fm] = monthKeys[0].split('-').map(Number)
  const firstDate = new Date(fy, fm - 1, 1)
  const [ly, lm] = monthKeys[monthKeys.length - 1].split('-').map(Number)
  const lastDate = new Date(ly, lm, 1) // first day of month after last key

  for (const sched of schedules) {
    if (!sched.date_next_due || !sched.estimated_labor_hours) continue
    const [dy, dm] = sched.date_next_due.split('-').map(Number)
    const freq = Math.max(sched.frequency_months || 1, 1)
    const hours = sched.estimated_labor_hours

    let y = dy
    let m = dm - 1 // 0-indexed

    // Roll forward until we reach the window
    while (new Date(y, m, 1) < firstDate) {
      m += freq
      y += Math.floor(m / 12)
      m %= 12
    }

    // Iterate through the 24-month window
    while (new Date(y, m, 1) < lastDate) {
      const key = `${y}-${String(m + 1).padStart(2, '0')}`
      if (key in totals) totals[key] += hours
      m += freq
      y += Math.floor(m / 12)
      m %= 12
    }
  }

  return totals
}

export function useWorkloadForecast() {
  const { data: schedules = [] } = useQuery({
    queryKey: ['schedules'],
    queryFn: () => schedulesApi.list(),
  })

  const { data: settings } = useQuery<AppSetting>({
    queryKey: ['app-settings'],
    queryFn: async () => (await apiClient.get('/settings')).data,
  })

  const capacityHours = settings?.monthly_capacity_hours ?? 0

  const months = useMemo(() => {
    const base = buildMonthKeys()
    const totals = projectHours(schedules, base.map((m) => m.key))
    return base.map((m) => ({ ...m, hours: totals[m.key] ?? 0 }))
  }, [schedules])

  return { months, capacityHours }
}
