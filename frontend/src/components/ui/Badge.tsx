import { cn } from '@/lib/utils'
import { COMBINED_STATUS_COLOURS, toCombinedStatus } from '@/lib/jobStatus'
import type { ApprovalStatus, SyncStatus } from '@/types'

const approvalColors: Record<ApprovalStatus, string> = {
  'Waiting Approval':   'bg-yellow-100 text-yellow-800',
  'Approved':           'bg-green-100 text-green-800',
  'Refused by Customer':'bg-red-100 text-red-800',
  'Cancelled':          'bg-gray-100 text-gray-600',
}

const syncColors: Record<SyncStatus, string> = {
  'Unsynced':    'bg-slate-100 text-slate-700',
  'In-Progress': 'bg-blue-100 text-blue-800',
  'Completed':   'bg-green-100 text-green-800',
  'Bypassed':    'bg-gray-100 text-gray-600',
}

export function ApprovalBadge({ status }: { status: ApprovalStatus }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', approvalColors[status])}>
      {status}
    </span>
  )
}

export function SyncBadge({ status }: { status: SyncStatus }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', syncColors[status])}>
      {status}
    </span>
  )
}

export function CombinedStatusBadge({ approval_status, sync_status }: { approval_status: ApprovalStatus; sync_status: SyncStatus }) {
  const combined = toCombinedStatus({ approval_status, sync_status })
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', COMBINED_STATUS_COLOURS[combined])}>
      {combined}
    </span>
  )
}

export function Badge({ label, className }: { label: string; className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700', className)}>
      {label}
    </span>
  )
}
