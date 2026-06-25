import { useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { JobRow } from './JobRow'
import type { DashboardRow } from '@/types'

const COL_HEADERS = [
  { label: 'Customer / Site',  className: '' },
  { label: 'Asset',            className: '' },
  { label: 'Template',         className: '' },
  { label: 'Est. Hrs',         className: 'text-right' },
  { label: 'Status',           className: '' },
  { label: 'Instructions / Notes', className: '' },
  { label: '',                 className: '' },
]

interface Props {
  rows: DashboardRow[]
  commentCounts: Record<number, number>
  onOpenComments: (row: DashboardRow) => void
}

export function JobGrid({ rows, commentCounts, onOpenComments }: Props) {
  const parentRef = useRef<HTMLDivElement>(null)

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,
    overscan: 8,
  })

  if (rows.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-gray-400 py-16">
        <p className="text-sm">No jobs for this month.</p>
        <p className="text-xs mt-1">Use the banner above to generate drafts, or check that maintenance schedules are configured.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Sticky header */}
      <div className="grid shrink-0 border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 grid-cols-[2fr_1.5fr_1.2fr_5rem_1.6fr_2fr_2.5rem]">
        {COL_HEADERS.map((h, i) => (
          <div key={i} className={h.className}>{h.label}</div>
        ))}
      </div>

      {/* Virtual scroll container */}
      <div
        ref={parentRef}
        className="flex-1 overflow-y-auto scrollbar-thin"
      >
        <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
          {rowVirtualizer.getVirtualItems().map((vRow) => {
            const row = rows[vRow.index]
            return (
              <div
                key={vRow.key}
                data-index={vRow.index}
                ref={rowVirtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${vRow.start}px)`,
                }}
              >
                <JobRow
                  row={row}
                  onOpenComments={onOpenComments}
                  commentCount={commentCounts[row.job.id] ?? 0}
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
