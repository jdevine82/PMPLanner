import { useRef, useState, useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { JobRow } from './JobRow'
import { rowEstimatedHours } from '@/hooks/useDashboardRows'
import type { DashboardRow } from '@/types'

const COL_HEADERS = [
  { label: 'Site',                  className: '' },
  { label: 'Asset',                 className: '' },
  { label: 'Template',              className: '' },
  { label: 'Est. / Actual Hrs',     className: 'text-right' },
  { label: 'Status',                 className: '' },
  { label: 'Instructions / Notes',  className: '' },
  { label: '',                      className: '' },
]

type FlatItem =
  | { type: 'header'; customerId: number; name: string; jobCount: number; totalHours: number }
  | { type: 'row'; row: DashboardRow }

interface Props {
  rows: DashboardRow[]
  commentCounts: Record<number, number>
  onOpenDetail: (row: DashboardRow) => void
  onDeleteJob?: (ids: number[]) => void
}

export function JobGrid({ rows, commentCounts, onOpenDetail, onDeleteJob }: Props) {
  const parentRef = useRef<HTMLDivElement>(null)
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set())

  const flatItems = useMemo<FlatItem[]>(() => {
    const groups = new Map<number, { name: string; rows: DashboardRow[] }>()
    for (const row of rows) {
      const id = row.customer.id
      if (!groups.has(id)) groups.set(id, { name: row.customer.company_name, rows: [] })
      groups.get(id)!.rows.push(row)
    }
    const sorted = [...groups.entries()].sort(([, a], [, b]) => a.name.localeCompare(b.name))

    const items: FlatItem[] = []
    for (const [customerId, { name, rows: groupRows }] of sorted) {
      const totalHours = groupRows.reduce((s, r) => s + rowEstimatedHours(r), 0)
      items.push({ type: 'header', customerId, name, jobCount: groupRows.length, totalHours })
      if (!collapsed.has(customerId)) {
        for (const row of groupRows) items.push({ type: 'row', row })
      }
    }
    return items
  }, [rows, collapsed])

  const rowVirtualizer = useVirtualizer({
    count: flatItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (i) => flatItems[i].type === 'header' ? 36 : 48,
    overscan: 8,
  })

  function toggleCollapse(customerId: number) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      next.has(customerId) ? next.delete(customerId) : next.add(customerId)
      return next
    })
  }

  // For a row, sum comment counts across all job IDs in the group
  function rowCommentCount(row: DashboardRow): number {
    const ids = row.groupedRows ? row.groupedRows.map((r) => r.job.id) : [row.job.id]
    return ids.reduce((sum, id) => sum + (commentCounts[id] ?? 0), 0)
  }

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
      <div className="grid shrink-0 border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 grid-cols-[2fr_1.5fr_1.2fr_5rem_1.6fr_2fr_4rem]">
        {COL_HEADERS.map((h, i) => (
          <div key={i} className={h.className}>{h.label}</div>
        ))}
      </div>

      <div ref={parentRef} className="flex-1 overflow-y-auto scrollbar-thin">
        <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
          {rowVirtualizer.getVirtualItems().map((vItem) => {
            const item = flatItems[vItem.index]
            return (
              <div
                key={vItem.key}
                data-index={vItem.index}
                ref={rowVirtualizer.measureElement}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${vItem.start}px)` }}
              >
                {item.type === 'header' ? (
                  <button
                    onClick={() => toggleCollapse(item.customerId)}
                    className="flex w-full items-center gap-2 border-b border-gray-200 bg-gray-100 px-3 py-1.5 text-left hover:bg-gray-200 transition-colors"
                  >
                    {collapsed.has(item.customerId)
                      ? <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                      : <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-400" />}
                    <span className="font-semibold text-sm text-gray-800">{item.name}</span>
                    <span className="text-xs text-gray-400">{item.jobCount} job{item.jobCount !== 1 ? 's' : ''}</span>
                    <span className="text-xs text-gray-400">· {item.totalHours.toFixed(1)}h est.</span>
                  </button>
                ) : (
                  <JobRow
                    row={item.row}
                    onOpenDetail={onOpenDetail}
                    onDelete={onDeleteJob}
                    commentCount={rowCommentCount(item.row)}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
