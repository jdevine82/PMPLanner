import { useState, useEffect } from 'react'
import { CheckSquare, Square, Upload } from 'lucide-react'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { rowEstimatedHours } from '@/hooks/useDashboardRows'
import type { DashboardRow } from '@/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  rows: DashboardRow[]
  onConfirm: (jobIds: number[]) => void
  isPending: boolean
}

function rowJobIds(row: DashboardRow): number[] {
  return row.groupedRows ? row.groupedRows.map((r) => r.job.id) : [row.job.id]
}

export function SM8SyncPreviewModal({ open, onOpenChange, rows, onConfirm, isPending }: Props) {
  const [selected, setSelected] = useState<Set<number>>(() => new Set(rows.map((_, i) => i)))

  useEffect(() => {
    if (open) setSelected(new Set(rows.map((_, i) => i)))
  }, [open, rows])

  function toggle(idx: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(idx) ? next.delete(idx) : next.add(idx)
      return next
    })
  }

  function toggleAll() {
    setSelected(selected.size === rows.length ? new Set() : new Set(rows.map((_, i) => i)))
  }

  const selectedHours = rows
    .filter((_, i) => selected.has(i))
    .reduce((sum, r) => sum + rowEstimatedHours(r), 0)

  function handleConfirm() {
    const ids = rows.filter((_, i) => selected.has(i)).flatMap(rowJobIds)
    onConfirm(ids)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Sync to ServiceM8"
      description="Review the jobs below. Uncheck any you want to skip this time, then confirm."
      className="max-w-2xl"
    >
      <div className="mb-2 flex items-center justify-between">
        <button onClick={toggleAll} className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800">
          {selected.size === rows.length
            ? <CheckSquare className="h-3.5 w-3.5" />
            : <Square className="h-3.5 w-3.5" />}
          {selected.size === rows.length ? 'Deselect all' : 'Select all'}
        </button>
        <span className="text-xs text-gray-400">{selected.size} of {rows.length} selected</span>
      </div>

      <div className="max-h-72 overflow-y-auto rounded border border-gray-200 divide-y divide-gray-100">
        {rows.map((row, idx) => {
          const hours = rowEstimatedHours(row)
          const assetCount = row.groupedRows ? row.groupedRows.length : 1
          const assetLabel = row.groupedRows
            ? row.groupedRows.map((r) => r.asset.asset_name).join(', ')
            : row.asset.asset_name
          const isChecked = selected.has(idx)

          return (
            <label key={idx} className={`flex cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-gray-50 ${!isChecked ? 'opacity-50' : ''}`}>
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => toggle(idx)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {row.customer.company_name}
                    <span className="font-normal text-gray-500"> · {row.site.site_name}</span>
                  </p>
                  <span className="shrink-0 text-xs text-gray-500 tabular-nums">{hours}h</span>
                </div>
                <p className="text-xs text-gray-500 truncate">
                  {row.template.title}
                  {assetCount > 1
                    ? <span className="text-gray-400"> · {assetCount} assets: {assetLabel}</span>
                    : <span className="text-gray-400"> · {assetLabel}</span>}
                </p>
              </div>
            </label>
          )
        })}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-xs text-gray-500">
          <strong className="text-gray-700">{selected.size}</strong> SM8 job{selected.size !== 1 ? 's' : ''} to create
          {selected.size > 0 && (
            <> · <strong className="text-gray-700">{selectedHours.toFixed(1)}h</strong> estimated</>
          )}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={selected.size === 0 || isPending}>
            <Upload className="h-3.5 w-3.5" />
            {isPending ? 'Syncing…' : `Sync ${selected.size} to ServiceM8`}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
