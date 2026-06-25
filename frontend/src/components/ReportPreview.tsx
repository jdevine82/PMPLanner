import type { ReportData } from '@/api/reports'

interface Props { data: ReportData }

function SectionTitle({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="h-px flex-1 bg-gray-200" />
      <span className="shrink-0 rounded-full bg-blue-700 px-3 py-0.5 text-xs font-bold uppercase tracking-widest text-white">{label}</span>
      <div className="h-px flex-1 bg-gray-200" />
    </div>
  )
}

function EmptyRow({ cols }: { cols: number }) {
  return <tr><td colSpan={cols} className="py-4 text-center text-xs text-gray-400 italic">No records.</td></tr>
}

export function ReportPreview({ data }: Props) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-8 text-sm font-[Arial,sans-serif] print:p-0 print:border-0 print:rounded-none max-w-4xl mx-auto">

      {/* Header */}
      <div className="rounded-lg bg-blue-700 text-white px-6 py-5 mb-6">
        <h1 className="text-xl font-bold">{data.customer.company_name}</h1>
        <p className="text-sm text-blue-200 mt-1">
          Preventative Maintenance Report — Generated {data.generated_date} — {data.forecast_months}-month forecast
        </p>
        {(data.customer.primary_contact || data.customer.phone) && (
          <p className="text-xs text-blue-300 mt-1">
            {[data.customer.primary_contact, data.customer.phone, data.customer.email].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>

      {/* Section A */}
      <div className="mb-8">
        <SectionTitle label="A — Asset Inventory Summary" />
        <table className="w-full text-xs border-collapse">
          <thead><tr className="bg-blue-50 text-blue-900">
            <th className="border border-gray-200 px-3 py-2 text-left font-semibold">Asset Name</th>
            <th className="border border-gray-200 px-3 py-2 text-left font-semibold">Serial Number</th>
            <th className="border border-gray-200 px-3 py-2 text-left font-semibold">Model Number</th>
            <th className="border border-gray-200 px-3 py-2 text-left font-semibold">Location / Site</th>
          </tr></thead>
          <tbody>
            {data.asset_inventory.length === 0 ? <EmptyRow cols={4} /> : data.asset_inventory.map((r, i) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="border border-gray-200 px-3 py-2 font-medium">{r.asset_name}</td>
                <td className="border border-gray-200 px-3 py-2 text-gray-500">{r.serial_number}</td>
                <td className="border border-gray-200 px-3 py-2 text-gray-500">{r.model_number}</td>
                <td className="border border-gray-200 px-3 py-2">{r.location}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Section B */}
      <div className="mb-8">
        <SectionTitle label="B — Scheduling Intervals & Settings" />
        <table className="w-full text-xs border-collapse">
          <thead><tr className="bg-blue-50 text-blue-900">
            {['Asset', 'Service Template', 'Frequency', 'Est. Hours', 'Next Due', 'Last Done'].map((h) => (
              <th key={h} className="border border-gray-200 px-3 py-2 text-left font-semibold">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {data.scheduling.length === 0 ? <EmptyRow cols={6} /> : data.scheduling.map((r, i) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="border border-gray-200 px-3 py-2 font-medium">{r.asset_name}</td>
                <td className="border border-gray-200 px-3 py-2">{r.service_title}</td>
                <td className="border border-gray-200 px-3 py-2 text-gray-500">{r.frequency}</td>
                <td className="border border-gray-200 px-3 py-2">{r.estimated_hours.toFixed(2)}h</td>
                <td className="border border-gray-200 px-3 py-2">{r.date_next_due}</td>
                <td className="border border-gray-200 px-3 py-2 text-gray-500">{r.date_last_done}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Section C */}
      <div className="mb-8">
        <SectionTitle label="C — Completed & Refused Service History" />
        <table className="w-full text-xs border-collapse">
          <thead><tr className="bg-blue-50 text-blue-900">
            {['Month', 'Asset', 'Service', 'Status', 'Actual Hours', 'Notes / Refusal Reason'].map((h) => (
              <th key={h} className="border border-gray-200 px-3 py-2 text-left font-semibold">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {data.history.length === 0 ? <EmptyRow cols={6} /> : data.history.map((r, i) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="border border-gray-200 px-3 py-2">{r.month}</td>
                <td className="border border-gray-200 px-3 py-2 font-medium">{r.asset_name}</td>
                <td className="border border-gray-200 px-3 py-2">{r.service_title}</td>
                <td className="border border-gray-200 px-3 py-2">
                  {r.status === 'Refused by Customer'
                    ? <span className="font-bold text-red-600">REFUSED</span>
                    : r.sync_status === 'Completed'
                    ? <span className="font-semibold text-green-700">Completed</span>
                    : <span className="text-blue-700">{r.status}</span>
                  }
                </td>
                <td className="border border-gray-200 px-3 py-2">{r.actual_hours != null ? `${r.actual_hours.toFixed(2)}h` : '—'}</td>
                <td className="border border-gray-200 px-3 py-2 text-gray-500">{r.refusal_reason || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Section D */}
      <div className="mb-4">
        <SectionTitle label={`D — Upcoming Forecast (Next ${data.forecast_months} Months)`} />
        <table className="w-full text-xs border-collapse">
          <thead><tr className="bg-blue-50 text-blue-900">
            {['Due Date', 'Asset', 'Service Template', 'Est. Hours'].map((h) => (
              <th key={h} className="border border-gray-200 px-3 py-2 text-left font-semibold">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {data.forecast.length === 0 ? <EmptyRow cols={4} /> : data.forecast.map((r, i) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="border border-gray-200 px-3 py-2 font-medium">{r.due_date}</td>
                <td className="border border-gray-200 px-3 py-2">{r.asset_name}</td>
                <td className="border border-gray-200 px-3 py-2">{r.service_title}</td>
                <td className="border border-gray-200 px-3 py-2">{r.estimated_hours.toFixed(2)}h</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
