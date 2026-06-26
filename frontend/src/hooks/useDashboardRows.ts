import { useQuery } from '@tanstack/react-query'
import { jobsApi } from '@/api/jobs'
import { schedulesApi } from '@/api/schedules'
import { assetsApi } from '@/api/assets'
import { sitesApi } from '@/api/sites'
import { customersApi } from '@/api/customers'
import { templatesApi } from '@/api/templates'
import type { DashboardRow } from '@/types'

export function useDashboardRows(month: string) {
  const jobs      = useQuery({ queryKey: ['jobs', month], queryFn: () => jobsApi.list(month) })
  const schedules = useQuery({ queryKey: ['schedules'],   queryFn: () => schedulesApi.list() })
  const assets    = useQuery({ queryKey: ['assets'],      queryFn: () => assetsApi.list() })
  const sites     = useQuery({ queryKey: ['sites'],       queryFn: () => sitesApi.list() })
  const customers = useQuery({ queryKey: ['customers'],   queryFn: () => customersApi.list() })
  const templates = useQuery({ queryKey: ['templates'],   queryFn: () => templatesApi.list() })

  const isLoading = [jobs, schedules, assets, sites, customers, templates].some((q) => q.isLoading)
  const isError   = [jobs, schedules, assets, sites, customers, templates].some((q) => q.isError)

  const rows: DashboardRow[] = []

  if (!isLoading && !isError) {
    const scheduleMap  = new Map(schedules.data!.map((s) => [s.id, s]))
    const assetMap     = new Map(assets.data!.map((a) => [a.id, a]))
    const siteMap      = new Map(sites.data!.map((s) => [s.id, s]))
    const customerMap  = new Map(customers.data!.map((c) => [c.id, c]))
    const templateMap  = new Map(templates.data!.map((t) => [t.id, t]))

    // Build individual rows first
    const allRows: DashboardRow[] = []
    for (const job of jobs.data!) {
      const schedule = scheduleMap.get(job.schedule_id)
      if (!schedule) continue
      const asset    = assetMap.get(schedule.asset_id)
      if (!asset) continue
      const site     = siteMap.get(asset.site_id)
      if (!site) continue
      const customer = customerMap.get(site.customer_id)
      if (!customer) continue
      const template = templateMap.get(schedule.service_id)
      if (!template) continue
      allRows.push({ job, schedule, asset, site, customer, template })
    }

    // Group rows that share an sm8_group_tag at the same site in the same month
    const grouped = new Map<string, DashboardRow[]>()
    const ungrouped: DashboardRow[] = []

    for (const row of allRows) {
      const tag = row.schedule.sm8_group_tag
      if (tag) {
        const key = `${tag}::${row.site.id}::${row.job.target_month_year}`
        if (!grouped.has(key)) grouped.set(key, [])
        grouped.get(key)!.push(row)
      } else {
        ungrouped.push(row)
      }
    }

    rows.push(...ungrouped)

    for (const groupRows of grouped.values()) {
      const [lead] = groupRows
      rows.push(groupRows.length > 1 ? { ...lead, groupedRows: groupRows } : lead)
    }
  }

  return { rows, isLoading, isError }
}

// Helper: total estimated hours for a row (summed across group members)
export function rowEstimatedHours(row: DashboardRow): number {
  if (row.groupedRows) return row.groupedRows.reduce((s, r) => s + r.schedule.estimated_labor_hours, 0)
  return row.schedule.estimated_labor_hours
}
