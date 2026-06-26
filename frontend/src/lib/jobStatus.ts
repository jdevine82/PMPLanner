import type { CombinedStatus, ApprovalStatus, SyncStatus } from '@/types'

export const COMBINED_STATUS_OPTIONS: CombinedStatus[] = [
  'Pending Approval',
  'Approved',
  'Sent to SM8',
  'Job in Progress',
  'Completed',
  'Refused by Customer',
  'Done (no SM8)',
]

// Options that are set by SM8 sync only — shown greyed out in the picker
export const SM8_ONLY_STATUSES: CombinedStatus[] = ['Sent to SM8', 'Job in Progress']

export const COMBINED_STATUS_COLOURS: Record<CombinedStatus, string> = {
  'Pending Approval':    'bg-yellow-100 text-yellow-800',
  'Approved':            'bg-blue-100 text-blue-800',
  'Sent to SM8':         'bg-amber-100 text-amber-800',
  'Job in Progress':     'bg-orange-100 text-orange-800',
  'Completed':           'bg-green-100 text-green-800',
  'Refused by Customer': 'bg-red-100 text-red-800',
  'Done (no SM8)':       'bg-purple-100 text-purple-700',
}

export function toCombinedStatus(job: {
  approval_status: ApprovalStatus
  sync_status: SyncStatus
  actual_labor_hours?: number | null
}): CombinedStatus {
  if (job.sync_status === 'Completed') return 'Completed'
  if (job.sync_status === 'Bypassed') return 'Done (no SM8)'
  if (job.sync_status === 'In-Progress') {
    return (job.actual_labor_hours != null && job.actual_labor_hours > 0)
      ? 'Job in Progress'
      : 'Sent to SM8'
  }
  if (job.approval_status === 'Refused by Customer') return 'Refused by Customer'
  if (job.approval_status === 'Approved') return 'Approved'
  return 'Pending Approval'
}

export function fromCombinedStatus(status: CombinedStatus): { approval_status: ApprovalStatus; sync_status: SyncStatus } {
  switch (status) {
    case 'Pending Approval':    return { approval_status: 'Waiting Approval',    sync_status: 'Unsynced' }
    case 'Approved':            return { approval_status: 'Approved',            sync_status: 'Unsynced' }
    case 'Sent to SM8':         return { approval_status: 'Approved',            sync_status: 'In-Progress' }
    case 'Job in Progress':     return { approval_status: 'Approved',            sync_status: 'In-Progress' }
    case 'Completed':           return { approval_status: 'Approved',            sync_status: 'Completed' }
    case 'Refused by Customer': return { approval_status: 'Refused by Customer', sync_status: 'Unsynced' }
    case 'Done (no SM8)':       return { approval_status: 'Approved',            sync_status: 'Bypassed' }
  }
}
