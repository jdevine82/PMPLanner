import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, CheckSquare, DownloadCloud } from 'lucide-react'
import { useDashboardRows } from '@/hooks/useDashboardRows'
import { jobsApi } from '@/api/jobs'
import { servicem8Api } from '@/api/servicem8'
import { JobGrid } from '@/components/JobGrid'
import { MissingMonthBanner } from '@/components/MissingMonthBanner'
import { MonthPicker } from '@/components/MonthPicker'
import { CommentDrawer } from '@/components/CommentDrawer'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { nextMonthYear } from '@/lib/utils'
import type { DashboardRow } from '@/types'

export default function DashboardPage() {
  const [month, setMonth] = useState(nextMonthYear)
  const [activeCommentRow, setActiveCommentRow] = useState<DashboardRow | null>(null)
  const qc = useQueryClient()
  const { toast } = useToast()

  const { rows, isLoading, isError } = useDashboardRows(month)

  const monthCheck = useQuery({
    queryKey: ['month-check', month],
    queryFn: () => jobsApi.checkMonth(month),
  })

  const syncMutation = useMutation({
    mutationFn: servicem8Api.dispatchSync,
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['jobs', month] })
      toast(`Dispatched ${result.dispatched} job(s) to ServiceM8. ${result.failed > 0 ? `${result.failed} failed.` : ''}`)
    },
    onError: (e: any) => toast(e?.response?.data?.detail ?? 'Sync failed', 'error'),
  })

  const consolidateMutation = useMutation({
    mutationFn: servicem8Api.consolidateHoursSync,
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['jobs', month] })
      toast(`Updated ${result.updated} job(s) with actual labor hours.`)
    },
    onError: () => toast('Labor consolidation failed', 'error'),
  })

  const showBanner = !monthCheck.isLoading && !monthCheck.data?.has_jobs

  // Derive simple stats
  const stats = useMemo(() => ({
    total:    rows.length,
    approved: rows.filter((r) => r.job.approval_status === 'Approved').length,
    refused:  rows.filter((r) => r.job.approval_status === 'Refused by Customer').length,
    unsynced: rows.filter((r) => r.job.sync_status === 'Unsynced').length,
  }), [rows])

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Top bar */}
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
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ['jobs', month] })}>
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => consolidateMutation.mutate()} disabled={consolidateMutation.isPending}>
            <DownloadCloud className="h-3.5 w-3.5" />
            {consolidateMutation.isPending ? 'Pulling…' : 'Pull Hours'}
          </Button>
          <Button size="sm" disabled={stats.approved === 0 || syncMutation.isPending} onClick={() => syncMutation.mutate()}>
            <CheckSquare className="h-3.5 w-3.5" />
            {syncMutation.isPending ? 'Syncing…' : `Sync ${stats.approved} Approved to ServiceM8`}
          </Button>
        </div>
      </header>

      {/* Missing month banner */}
      {showBanner && <MissingMonthBanner month={month} />}

      {/* Grid */}
      {isLoading && (
        <div className="flex flex-1 items-center justify-center text-gray-400 text-sm">
          Loading jobs…
        </div>
      )}
      {isError && (
        <div className="flex flex-1 items-center justify-center text-red-500 text-sm">
          Failed to load data. Check the backend is running.
        </div>
      )}
      {!isLoading && !isError && (
        <JobGrid
          rows={rows}
          commentCounts={{}}
          onOpenComments={setActiveCommentRow}
        />
      )}

      {/* Comment drawer */}
      <CommentDrawer
        row={activeCommentRow}
        onClose={() => setActiveCommentRow(null)}
      />
    </div>
  )
}
