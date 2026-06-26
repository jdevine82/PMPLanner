import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Trash2, MessageSquare, Layers } from 'lucide-react'
import { jobsApi } from '@/api/jobs'
import { schedulesApi } from '@/api/schedules'
import { ApprovalBadge } from '@/components/ui/Badge'
import { useDebounce } from '@/hooks/useDebounce'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'
import { rowEstimatedHours } from '@/hooks/useDashboardRows'
import type { DashboardRow, ApprovalStatus, SyncStatus, JobInstance } from '@/types'

interface Props {
  row: DashboardRow
  onOpenDetail: (row: DashboardRow) => void
  onDelete?: (ids: number[]) => void
  commentCount?: number
}

const APPROVAL_OPTIONS: ApprovalStatus[] = ['Waiting Approval', 'Approved', 'Refused by Customer', 'Cancelled']

const SYNC_COLOURS: Record<SyncStatus, string> = {
  'Unsynced':    'bg-gray-100 text-gray-500',
  'In-Progress': 'bg-yellow-100 text-yellow-700',
  'Completed':   'bg-green-100 text-green-700',
  'Bypassed':    'bg-purple-100 text-purple-600',
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

  function handleStatusChange(newStatus: ApprovalStatus) {
    if (newStatus === 'Refused by Customer') { setShowRefusalInput(true); return }
    statusMutation.mutate({ approval_status: newStatus })
  }

  function submitRefusal() {
    if (!pendingRefusal.trim()) return
    statusMutation.mutate({ approval_status: 'Refused by Customer', refusal_reason: pendingRefusal.trim() })
    setShowRefusalInput(false)
    setPendingRefusal('')
  }

  const isRefused = job.approval_status === 'Refused by Customer'
  const syncStatus = job.sync_status as SyncStatus

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
          <p className="text-xs text-gray-400">{schedule.frequency_months}mo</p>
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

        {/* Approval status + sync badge */}
        <div className="pr-2">
          {isRefused ? (
            <div className="flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
              <ApprovalBadge status={job.approval_status} />
            </div>
          ) : (
            <select
              value={job.approval_status}
              onChange={(e) => handleStatusChange(e.target.value as ApprovalStatus)}
              className="w-full rounded border border-gray-200 bg-white px-1.5 py-0.5 text-xs focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              {APPROVAL_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          <span className={cn('mt-0.5 inline-block rounded-full px-1.5 py-px text-[10px] font-medium', SYNC_COLOURS[syncStatus])}>
            {syncStatus}
          </span>
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
