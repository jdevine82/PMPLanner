import { apiClient } from './client'

export interface IncompletePriorJob {
  month: string
  customer_name: string
  site_name: string
  asset_name: string
  service_title: string
  status: string
  estimated_hours: number
}

export interface ReportData {
  branding: { business_name: string | null; logo_data_uri: string | null }
  customer: { id: number; company_name: string; primary_contact: string | null; phone: string | null; email: string | null }
  generated_date: string
  forecast_months: number
  asset_inventory: Array<{ asset_name: string; serial_number: string; model_number: string; location: string }>
  scheduling: Array<{ asset_name: string; location: string; service_title: string; frequency: string; estimated_hours: number; date_next_due: string; date_last_done: string }>
  history: Array<{ month: string; asset_name: string; location: string; service_title: string; status: string; actual_hours: number | null; refusal_reason: string | null; sync_status: string }>
  forecast: Array<{ due_date: string; asset_name: string; location: string; service_title: string; estimated_hours: number }>
  prior_incomplete: Array<{ month: string; asset_name: string; location: string; service_title: string; status: string; estimated_hours: number | null }>
}

function fetchAndDownload(url: string, filename: string) {
  const token = localStorage.getItem('access_token')
  fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    .then((r) => r.blob())
    .then((blob) => {
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(objectUrl), 100)
    })
}

export const reportsApi = {
  getData: async (customerId: number, forecastMonths = 12): Promise<ReportData> => {
    const { data } = await apiClient.get<ReportData>(`/reports/${customerId}`, { params: { forecast_months: forecastMonths } })
    return data
  },

  downloadPdf: (customerId: number, forecastMonths = 12): void => {
    fetchAndDownload(`/api/v1/reports/${customerId}/pdf?forecast_months=${forecastMonths}`, `PM_Report_${customerId}.pdf`)
  },

  downloadXlsx: (customerId: number, forecastMonths = 12): void => {
    fetchAndDownload(`/api/v1/reports/${customerId}/xlsx?forecast_months=${forecastMonths}`, `PM_Report_${customerId}.xlsx`)
  },

  downloadCallSheet: (monthYear: string): void => {
    fetchAndDownload(`/api/v1/reports/call-sheet/${monthYear}/pdf`, `Call_Sheet_${monthYear}.pdf`)
  },

  downloadWorkloadSchedule: (forecastMonths = 12): void => {
    fetchAndDownload(
      `/api/v1/reports/workload-schedule/pdf?forecast_months=${forecastMonths}`,
      `Workload_Schedule_${forecastMonths}mo.pdf`,
    )
  },

  getIncompletePrior: async (): Promise<IncompletePriorJob[]> => {
    const { data } = await apiClient.get<IncompletePriorJob[]>('/reports/incomplete-prior')
    return data
  },
}
