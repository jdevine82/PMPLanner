import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Trash2, MessageSquare, Layers, Clock } from 'lucide-react'
import { jobsApi } from '@/api/jobs'
import { schedulesApi } from '@/api/schedules'
import { useDebounce } from '@/hooks/useDebounce'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'
import { rowEstimatedHours } from '@/hooks/useDashboardRows'
import { toCombinedStatus, fromCombinedStatus, COMBINED_STATUS_OPTIONS, COMBINED_STATUS_COLOURS, SM8_ONLY_STATUSES } from '@/lib/jobStatus'
import type { DashboardRow, CombinedStatus, JobInstance } from '@/types'

interface Props {
  row: DashboardRow
  onOpenDetail: (row: DashboardRow) => void
  onDelete?: (ids: number[]) => void
  commentCount?: number
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function formatMonth(yyyyMM: string): string {
  const [year, month] = yyyyMM.split('-')
  return `${MONTH_NAMES[parseInt(month) - 1]} ${year}`
}

export function JobRow({ row, onOpenDetail, onDelete, commentCount = 0 }: Props) {
  const { job, schedule, asset, site, template } = row
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { user } = useAuth()
  const isAdmin = user?.user_role === 'Admin'

  const isGrouped = !!row.groupedRows
  const allRows = row.groupedRows ?? [row]
  const allJobIds = allRows.map((r) => r.job.id)

  const [hours, setHours] = useState(String(rowEstimatedHours(row)))
  const [notes, setNotes] = useState(schedule.permanent_custom_instructions ?? '')
  const [pendingRefusal, setPendingRefusal] = useState('')
  const [showRefusalInput, setShowRefusalInput] = useState(false)

  const debouncedHours = useDebounce(hours, 400)
  const debouncedNotes = useDebounce(notes, 400)

  const combinedStatus = toCombinedStatus(job)  // passes actual_labor_hours via JobInstance
  const isRefused = job.approval_status === 'Refused by Customer'

  // Status mutation — updates all jobs in a group simultaneously
  const statusMutation = useMutation({
    mutationFn: (data: Partial<JobInstance>) =>
      Promise.all(allJobIds.map((id) => jobsApi.update(id, data))),
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: ['jobs', job.target_month_year] })
      const prev = queryClient.getQueryData<JobInstance[]>(['jobs', job.target_month_year])
      queryClient.setQueryData<JobInstance[]>(['jobs', job.target_month_year], (old = []) =>
        old.map((j) => (allJobIds.includes(j.id) ? { ...j, ...data } : j)),
      )
      return { prev }
    },
    onError: (_, __, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['jobs', job.target_month_year], ctx.prev)
      toast('Failed to save — change rolled back', 'error')
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['jobs', job.target_month_year] }),
  })

  const scheduleHoursMutation = useMutation({
    mutationFn: (v: number) => schedulesApi.update(schedule.id, { estimated_labor_hours: v }),
    onError: () => toast('Failed to save hours', 'error'),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['schedules'] }),
  })

  const scheduleNotesMutation = useMutation({
    mutationFn: (v: string) => schedulesApi.update(schedule.id, { permanent_custom_instructions: v }),
    onError: () => toast('Failed to save notes', 'error'),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['schedules'] }),
  })

  useEffect(() => {
    const parsed = parseFloat(debouncedHours)
    if (!isNaN(parsed) && parsed !== rowEstimatedHours(row)) {
      scheduleHoursMutation.mutate(parsed)
    }
  }, [debouncedHours])

  useEffect(() => {
    if (debouncedNotes !== (schedule.permanent_custom_instructions ?? '')) {
      scheduleNotesMutation.mutate(debouncedNotes)
    }
  }, [debouncedNotes])

  function handleCombinedStatusChange(combined: CombinedStatus) {
    if (combined === 'Refused by Customer') { setShowRefusalInput(true); return }
    statusMutation.mutate(fromCombinedStatus(combined))
  }

  function submitRefusal() {
    if (!pendingRefusal.trim()) return
    statusMutation.mutate({ ...fromCombinedStatus('Refused by Customer'), refusal_reason: pendingRefusal.trim() })
    setShowRefusalInput(false)
    setPendingRefusal('')
  }

  const priorIncomplete = allRows
    .map((r) => r.job.prior_incomplete_job)
    .filter((p): p is NonNullable<typeof p> => p != null)
  const priorIncompleteTooltip = priorIncomplete.length === 1
    ? `Incomplete job from ${formatMonth(priorIncomplete[0].month)} — ${priorIncomplete[0].approval_status}`
    : `${priorIncomplete.length} assets have incomplete prior jobs`

  // Asset display
  const assetLabel = isGrouped
    ? allRows.map((r) => r.asset.asset_name).join(', ')
    : asset.asset_name
  const assetSub = isGrouped
    ? `${allRows.length} assets combined`
    : (asset.serial_number ? `S/N: ${asset.serial_number}` : null)

  return (
    <>
      <div
        className={cn(
          'grid items-center border-b border-gray-100 px-3 text-sm transition-colors',
          'grid-cols-[2fr_1.5fr_1.2fr_5rem_1.6fr_2fr_4rem]',
          isRefused && 'bg-red-50',
          !isRefused && 'hover:bg-blue-50/40',
        )}
        style={{ height: 48 }}
      >
        {/* Site — clickable */}
        <div
          className="min-w-0 pr-2 cursor-pointer"
          onClick={() => onOpenDetail(row)}
        >
          <p className="truncate text-gray-700">{site.site_name}</p>
          <p className="truncate text-xs text-gray-400">{site.site_address}</p>
        </div>

        {/* Asset — clickable */}
        <div
          className="min-w-0 pr-2 cursor-pointer"
          onClick={() => onOpenDetail(row)}
        >
          <p className="truncate text-gray-700 flex items-center gap-1">
            {isGrouped && <Layers className="h-3 w-3 text-violet-500 shrink-0" />}
            <span className="truncate">{assetLabel}</span>
          </p>
          {assetSub && <p className="truncate text-xs text-gray-400">{assetSub}</p>}
        </div>

        {/* Template — clickable */}
        <div
          className="min-w-0 pr-2 cursor-pointer"
          onClick={() => onOpenDetail(row)}
        >
          <p className="truncate text-xs text-gray-600">{template.title}</p>
          <div className="flex items-center gap-1">
            <p className="text-xs text-gray-400">{schedule.frequency_months}mo</p>
            {priorIncomplete.length > 0 && (
              <span title={priorIncompleteTooltip}>
                <Clock className="h-3 w-3 text-amber-500 shrink-0" />
              </span>
            )}
          </div>
        </div>

        {/* Hours — editable (grouped: read-only sum) */}
        <div className="pr-2 text-right">
          {isGrouped ? (
            <p className="text-sm tabular-nums text-gray-700 px-1">{rowEstimatedHours(row).toFixed(2)}</p>
          ) : (
            <input
              type="number" min="0" step="0.25" value={hours}
              onChange={(e) => setHours(e.target.value)}
              className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-sm text-right tabular-nums focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          )}
          {job.actual_labor_hours != null && (
            <p className="text-xs text-green-600 tabular-nums">{job.actual_labor_hours}h actual</p>
          )}
        </div>

        {/* Combined status */}
        <div className="pr-2">
          <select
            value={combinedStatus}
            onChange={(e) => handleCombinedStatusChange(e.target.value as CombinedStatus)}
            className={cn(
              'w-full rounded border border-transparent px-1.5 py-0.5 text-xs font-medium focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400',
              COMBINED_STATUS_COLOURS[combinedStatus],
            )}
          >
            {COMBINED_STATUS_OPTIONS.map((s) => {
              const isAuto = SM8_ONLY_STATUSES.includes(s)
              return (
                <option key={s} value={s} disabled={isAuto}>
                  {isAuto ? `— ${s} (auto) —` : s}
                </option>
              )
            })}
          </select>
          {job.servicem8_job_number != null && (
            <p className="mt-0.5 text-[10px] font-mono text-blue-500">SM8 #{job.servicem8_job_number}</p>
          )}
        </div>

        {/* Notes — editable (grouped: shows lead's notes) */}
        <div className="pr-2">
          {isGrouped ? (
            <p
              className="truncate text-xs text-gray-400 cursor-pointer"
              onClick={() => onOpenDetail(row)}
            >
              {allRows.some((r) => r.schedule.permanent_custom_instructions)
                ? 'See details…'
                : 'Open to view…'}
            </p>
          ) : (
            <input
              type="text" value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add instructions…"
              className="w-full truncate rounded border border-transparent bg-transparent px-1 py-0.5 text-xs text-gray-600 placeholder:text-gray-300 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-center gap-1">
          <button
            onClick={() => onOpenDetail(row)}
            className="relative rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors"
            title="View job details"
          >
            <MessageSquare className="h-4 w-4" />
            {commentCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[9px] font-bold text-white">
                {commentCount}
              </span>
            )}
          </button>
          {isAdmin && onDelete && (
            <button
              onClick={() => onDelete(allJobIds)}
              className="rounded p-1 text-gray-300 hover:bg-red-50 hover:text-red-500 transition-colors"
              title={isGrouped ? `Delete all ${allJobIds.length} grouped jobs` : 'Delete job'}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {showRefusalInput && (
        <div className="flex items-center gap-2 border-b border-red-200 bg-red-50 px-3 py-2">
          <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
          <input
            autoFocus type="text" value={pendingRefusal}
            onChange={(e) => setPendingRefusal(e.target.value)}
            placeholder="Enter refusal reason (required)…"
            className="flex-1 rounded border border-red-300 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-red-400"
            onKeyDown={(e) => { if (e.key === 'Enter') submitRefusal(); if (e.key === 'Escape') setShowRefusalInput(false) }}
          />
          <button onClick={submitRefusal} disabled={!pendingRefusal.trim()} className="rounded bg-red-600 px-2 py-1 text-xs text-white disabled:opacity-40 hover:bg-red-700">
            Confirm Refusal
          </button>
          <button onClick={() => setShowRefusalInput(false)} className="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
        </div>
      )}
    </>
  )
}
