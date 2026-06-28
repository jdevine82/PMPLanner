import { cn } from '@/lib/utils'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const SELECT_CLASS = 'rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

/** Controlled month/year picker. value and onChange use "YYYY-MM" strings. */
export function MonthYearPicker({
  value,
  onChange,
  className,
  yearRange = 5,
}: {
  value: string
  onChange: (v: string) => void
  className?: string
  yearRange?: number
}) {
  const now = new Date()
  const currentYear = now.getFullYear()

  const month = value ? parseInt(value.slice(5, 7), 10) : now.getMonth() + 1
  const year = value ? parseInt(value.slice(0, 4), 10) : currentYear

  const years: number[] = []
  for (let y = currentYear - 1; y <= currentYear + yearRange; y++) years.push(y)

  const emit = (m: number, y: number) =>
    onChange(`${y}-${String(m).padStart(2, '0')}`)

  return (
    <div className={cn('flex gap-2', className)}>
      <select
        className={cn(SELECT_CLASS, 'flex-1')}
        value={month}
        onChange={(e) => emit(parseInt(e.target.value, 10), year)}
      >
        {MONTHS.map((name, i) => (
          <option key={i + 1} value={i + 1}>{name}</option>
        ))}
      </select>
      <select
        className={cn(SELECT_CLASS, 'w-24')}
        value={year}
        onChange={(e) => emit(month, parseInt(e.target.value, 10))}
      >
        {years.map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
    </div>
  )
}
