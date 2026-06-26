import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatMonthYear } from '@/lib/utils'

interface Props {
  value: string
  onChange: (month: string) => void
}

function offset(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function MonthPicker({ value, onChange }: Props) {
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onChange(offset(value, -1))}
        className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
        aria-label="Previous month"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      {/* Native month input — allows jumping to any month */}
      <input
        type="month"
        value={value}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        className="rounded border border-gray-200 bg-white px-2 py-0.5 text-sm font-semibold text-gray-800 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
        style={{ minWidth: '10rem' }}
        title={formatMonthYear(value)}
      />

      <button
        onClick={() => onChange(offset(value, 1))}
        className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
        aria-label="Next month"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}
