import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileDown, FileSpreadsheet, Printer, Loader2 } from 'lucide-react'
import { customersApi } from '@/api/customers'
import { reportsApi } from '@/api/reports'
import { ReportPreview } from '@/components/ReportPreview'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Label } from '@/components/ui/Label'

export default function ReportPage() {
  const [customerId, setCustomerId] = useState<number | null>(null)
  const [forecastMonths, setForecastMonths] = useState(12)

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => customersApi.list(),
  })

  const { data: reportData, isLoading, isError, refetch } = useQuery({
    queryKey: ['report', customerId, forecastMonths],
    queryFn: () => reportsApi.getData(customerId!, forecastMonths),
    enabled: !!customerId,
  })

  function handlePrint() {
    window.print()
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-gray-200 bg-white px-5 py-3 print:hidden">
        <h1 className="text-base font-semibold">Client Report Generator</h1>

        <div className="flex items-center gap-3">
          <div className="space-y-0.5">
            <Label className="text-xs">Customer</Label>
            <Select
              className="w-56"
              value={customerId ?? ''}
              onChange={(e) => setCustomerId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Select a customer…</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.company_name}</option>
              ))}
            </Select>
          </div>

          <div className="space-y-0.5">
            <Label className="text-xs">Forecast Horizon</Label>
            <Select
              className="w-32"
              value={forecastMonths}
              onChange={(e) => setForecastMonths(Number(e.target.value))}
            >
              <option value={6}>6 months</option>
              <option value={12}>12 months</option>
              <option value={24}>24 months</option>
            </Select>
          </div>

          <div className="flex items-center gap-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              disabled={!reportData}
            >
              <Printer className="h-3.5 w-3.5" />
              Print
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => customerId && reportsApi.downloadPdf(customerId, forecastMonths)}
              disabled={!reportData}
            >
              <FileDown className="h-3.5 w-3.5" />
              PDF
            </Button>
            <Button
              size="sm"
              onClick={() => customerId && reportsApi.downloadXlsx(customerId, forecastMonths)}
              disabled={!reportData}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Excel
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto bg-gray-100 p-6 print:bg-white print:p-0">
        {!customerId && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <FileSpreadsheet className="h-12 w-12 mb-3 opacity-30" />
            <p className="text-sm">Select a customer above to generate their report.</p>
          </div>
        )}

        {customerId && isLoading && (
          <div className="flex items-center justify-center h-full gap-2 text-gray-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Building report…</span>
          </div>
        )}

        {isError && (
          <div className="flex items-center justify-center h-full text-red-500 text-sm">
            Failed to load report data. The backend may be unreachable.
          </div>
        )}

        {reportData && <ReportPreview data={reportData} />}
      </div>
    </div>
  )
}
