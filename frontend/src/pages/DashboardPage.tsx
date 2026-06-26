import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, CheckSquare, DownloadCloud, FileDown } from 'lucide-react'
import { useDashboardRows, rowEstimatedHours } from '@/hooks/useDashboardRows'
import { jobsApi } from '@/api/jobs'
import { reportsApi } from '@/api/reports'
import { servicem8Api } from '@/api/servicem8'
import { JobGrid } from '@/components/JobGrid'
import { MissingMonthBanner } from '@/components/MissingMonthBanner'
import { MonthPicker } from '@/components/MonthPicker'
import { JobDetailDrawer } from '@/components/JobDetailDrawer'
import { WorkloadForecastFooter } from '@/components/WorkloadForecastFooter'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { apiClient } from '@/api/client'
import { nextMonthYear } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import type { AppSetting, DashboardRow } from '@/types'

export default function DashboardPage() {
  const [month, setMonth] = useState(nextMonthYear)
  const [activeDetailRow, setActiveDetailRow] = useState<DashboardRow | null>(null)
  const qc = useQueryClient()
  const { toast } = useToast()
  const { user } = useAuth()
  const isWorker = user?.user_role === 'Worker'

  const { rows, isLoading, isError } = useDashboardRows(month)

  const monthCheck = useQuery({
    queryKey: ['month-check', month],
    queryFn: () => jobsApi.checkMonth(month),
  })

  const { data: commentCounts = {} } = useQuery({
    queryKey: ['comment-counts', month],
    queryFn: () => jobsApi.commentCounts(month),
    enabled: rows.length > 0,
  })

  const refreshMutation = useMutation({
    mutationFn: () => jobsApi.initializeMonth(month),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['jobs', month] })
      qc.invalidateQueries({ queryKey: ['schedules'] })
      qc.invalidateQueries({ queryKey: ['assets'] })
      qc.invalidateQueries({ queryKey: ['month-check', month] })
      qc.invalidateQueries({ queryKey: ['comment-counts', month] })
      if (result.created_count > 0) {
        toast(`Added ${result.created_count} new job draft${result.created_count !== 1 ? 's' : ''} for this month.`)
      } else {
        toast('Jobs are up to date.')
      }
    },
    onError: () => toast('Refresh failed', 'error'),
  })

  const syncMutation = useMutation({
    mutationFn: servicem8Api.dispatchSync,
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['jobs', month] })
      toast(`Dispatched ${result.dispatched} job(s) to ServiceM8.${result.failed > 0 ? ` ${result.failed} failed.` : ''}`)
    },
    onError: (e: any) => toast(e?.response?.data?.detail ?? 'Sync failed', 'error'),
  })

  const consolidateMutation = useMutation({
    mutationFn: servicem8Api.consolidateHoursSync,
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['jobs', month] })
      qc.invalidateQueries({ queryKey: ['schedule-history'] })
      if (result.failed > 0) {
        toast(`Updated ${result.updated} job(s). ${result.failed} failed — check SM8 API key permissions.`, 'error')
      } else if (result.updated === 0) {
        toast('No completed SM8 jobs found to pull. Jobs must be dispatched and marked Completed in ServiceM8 first.')
      } else {
        toast(`Updated ${result.updated} job(s) with actual labor hours.`)
      }
    },
    onError: (e: any) => toast(e?.response?.data?.detail ?? 'Labor consolidation failed — check the SM8 API key.', 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: (ids: number[]) => Promise.all(ids.map((id) => jobsApi.delete(id))),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs', month] })
      qc.invalidateQueries({ queryKey: ['comment-counts', month] })
      toast('Job deleted')
    },
    onError: (e: any) => toast(e?.response?.data?.detail ?? 'Failed to delete job', 'error'),
  })

  const showBanner = !monthCheck.isLoading && !monthCheck.data?.has_jobs

  const { data: settings } = useQuery<AppSetting>({
    queryKey: ['app-settings'],
    queryFn: async () => (await apiClient.get('/settings')).data,
  })

  const stats = useMemo(() => ({
    total:    rows.length,
    approved: rows.filter((r) => r.job.approval_status === 'Approved').length,
    refused:  rows.filter((r) => r.job.approval_status === 'Refused by Customer').length,
    unsynced: rows.filter((r) => r.job.sync_status === 'Unsynced').length,
  }), [rows])

  const capacityHours = settings?.monthly_capacity_hours ?? 0
  const estimatedHours = useMemo(
    () => rows.reduce((sum, r) => sum + rowEstimatedHours(r), 0),
    [rows],
  )
  const capacityPct = capacityHours > 0 ? Math.min((estimatedHours / capacityHours) * 100, 100) : 0
  const capacityColor =
    capacityHours === 0 ? 'bg-gray-300'
    : capacityPct >= 100 ? 'bg-red-500'
    : capacityPct >= 80  ? 'bg-amber-400'
    : 'bg-green-500'

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-gray-200 bg-white px-5 py-3">
        <div className="flex items-center gap-4">
          <MonthPicker value={month} onChange={setMonth} />
          <div className="h-5 w-px bg-gray-200" />
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span>Total: <strong className="text-gray-800">{stats.total}</strong></span>
            <span>Approved: <strong className="text-green-700">{stats.approved}</strong></span>
            <span>Refused: <strong className="text-red-600">{stats.refused}</strong></span>
            <span>Unsynced: <strong className="text-gray-800">{stats.unsynced}</strong></span>
          </div>

          {capacityHours > 0 && (
            <>
              <div className="h-5 w-px bg-gray-200" />
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 whitespace-nowrap">Workload for Month</span>
                <div className="w-32 h-2 rounded-full bg-gray-200 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${capacityColor}`}
                    style={{ width: `${capacityPct}%` }}
                  />
                </div>
                <span className={`text-xs font-medium tabular-nums ${capacityPct >= 100 ? 'text-red-600' : capacityPct >= 80 ? 'text-amber-600' : 'text-gray-700'}`}>
                  {estimatedHours.toFixed(1)} / {capacityHours}h
                </span>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refreshMutation.mutate()} disabled={refreshMutation.isPending || isWorker}>
            <RefreshCw className={`h-3.5 w-3.5 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
            {refreshMutation.isPending ? 'Checking…' : 'Refresh'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => reportsApi.downloadCallSheet(month)} disabled={rows.length === 0}>
            <FileDown className="h-3.5 w-3.5" />Call Sheet PDF
          </Button>
          {!isWorker && (
            <>
              <Button variant="outline" size="sm" onClick={() => consolidateMutation.mutate()} disabled={consolidateMutation.isPending}>
                <DownloadCloud className="h-3.5 w-3.5" />
                {consolidateMutation.isPending ? 'Pulling…' : 'Pull SM8 Updates'}
              </Button>
              <Button size="sm" disabled={stats.approved === 0 || syncMutation.isPending} onClick={() => syncMutation.mutate()}>
                <CheckSquare className="h-3.5 w-3.5" />
                {syncMutation.isPending ? 'Syncing…' : `Sync ${stats.approved} Approved to ServiceM8`}
              </Button>
            </>
          )}
        </div>
      </header>

      {showBanner && <MissingMonthBanner month={month} readOnly={isWorker} />}

      {isLoading && (
        <div className="flex flex-1 items-center justify-center text-gray-400 text-sm">Loading jobs…</div>
      )}
      {isError && (
        <div className="flex flex-1 items-center justify-center text-red-500 text-sm">
          Failed to load data. Check the backend is running.
        </div>
      )}
      {!isLoading && !isError && (
        <JobGrid
          rows={rows}
          commentCounts={commentCounts}
          onOpenDetail={setActiveDetailRow}
          onDeleteJob={isWorker ? undefined : (ids) => deleteMutation.mutate(ids)}
        />
      )}

      <JobDetailDrawer
        row={activeDetailRow}
        onClose={() => setActiveDetailRow(null)}
      />

      <WorkloadForecastFooter />
    </div>
  )
}
