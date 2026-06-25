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
      <span className="min-w-36 text-center text-sm font-semibold text-gray-800">
        {formatMonthYear(value)}
      </span>
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
