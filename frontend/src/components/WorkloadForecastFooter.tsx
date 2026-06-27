import { memo } from 'react'
import { useWorkloadForecast } from '@/hooks/useWorkloadForecast'

function barColor(hours: number, capacity: number): string {
  if (hours === 0) return 'bg-gray-100'
  if (capacity === 0) return 'bg-blue-400'
  const pct = hours / capacity
  if (pct >= 1.0) return 'bg-red-400'
  if (pct >= 0.8) return 'bg-amber-400'
  return 'bg-green-400'
}

export const WorkloadForecastFooter = memo(function WorkloadForecastFooter() {
  const { months, capacityHours } = useWorkloadForecast()
  const maxHours = Math.max(...months.map((m) => m.hours), 1)

  return (
    <footer className="shrink-0 border-t border-gray-100 bg-white px-4 py-2">
      <div className="flex items-center gap-3">
        <span className="shrink-0 w-[3.5rem] text-[9px] font-semibold uppercase tracking-wide text-gray-400 leading-tight">
          24-Month<br />Forecast
        </span>

        <div className="flex flex-1 flex-col gap-0.5 min-w-0">
          {/* Bars */}
          <div className="flex items-end gap-px" style={{ height: 28 }}>
            {months.map((m) => {
              const heightPct = m.hours > 0 ? Math.max((m.hours / maxHours) * 100, 6) : 2
              return (
                <div
                  key={m.key}
                  className={`flex-1 rounded-t-sm ${barColor(m.hours, capacityHours)} transition-all duration-300`}
                  style={{ height: `${heightPct}%` }}
                  title={`${m.label}: ${m.hours.toFixed(1)}h${capacityHours > 0 ? ` / ${capacityHours}h cap` : ''}`}
                />
              )
            })}
          </div>

          {/* Month labels */}
          <div className="flex gap-px">
            {months.map((m) => (
              <div key={m.key} className="flex-1 text-center overflow-hidden">
                <span
                  className={`block text-[8px] leading-none truncate ${
                    m.month === 1 ? 'font-semibold text-gray-500' : 'text-gray-300'
                  }`}
                >
                  {m.month === 1 ? `'${String(m.year).slice(2)}` : m.shortLabel.charAt(0)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {capacityHours > 0 && (
          <div className="shrink-0 text-[9px] text-gray-400 text-right leading-relaxed whitespace-nowrap">
            <span className="flex items-center justify-end gap-1 mb-0.5">
              <span className="inline-block h-2 w-2 rounded-sm bg-green-400" />
              <span>&lt;80%</span>
              <span className="inline-block h-2 w-2 rounded-sm bg-amber-400" />
              <span>80–100%</span>
              <span className="inline-block h-2 w-2 rounded-sm bg-red-400" />
              <span>&gt;100%</span>
            </span>
            <span className="text-gray-300">cap: {capacityHours}h/mo</span>
          </div>
        )}
      </div>
    </footer>
  )
})
