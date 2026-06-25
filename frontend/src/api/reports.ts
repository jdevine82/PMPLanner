import { apiClient } from './client'

export interface ReportData {
  customer: { id: number; company_name: string; primary_contact: string | null; phone: string | null; email: string | null }
  generated_date: string
  forecast_months: number
  asset_inventory: Array<{ asset_name: string; serial_number: string; model_number: string; location: string }>
  scheduling: Array<{ asset_name: string; service_title: string; frequency: string; estimated_hours: number; date_next_due: string; date_last_done: string }>
  history: Array<{ month: string; asset_name: string; service_title: string; status: string; actual_hours: number | null; refusal_reason: string | null; sync_status: string }>
  forecast: Array<{ due_date: string; asset_name: string; service_title: string; estimated_hours: number }>
}

export const reportsApi = {
  getData: async (customerId: number, forecastMonths = 12): Promise<ReportData> => {
    const { data } = await apiClient.get<ReportData>(`/reports/${customerId}`, { params: { forecast_months: forecastMonths } })
    return data
  },

  downloadPdf: (customerId: number, forecastMonths = 12): void => {
    const token = localStorage.getItem('access_token')
    const url = `/api/v1/reports/${customerId}/pdf?forecast_months=${forecastMonths}`
    const a = document.createElement('a')
    a.href = url
    // Trigger with auth header via fetch + blob
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        a.href = URL.createObjectURL(blob)
        a.download = `PM_Report_${customerId}.pdf`
        a.click()
        URL.revokeObjectURL(a.href)
      })
  },

  downloadXlsx: (customerId: number, forecastMonths = 12): void => {
    const token = localStorage.getItem('access_token')
    const url = `/api/v1/reports/${customerId}/xlsx?forecast_months=${forecastMonths}`
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `PM_Report_${customerId}.xlsx`
        a.click()
        URL.revokeObjectURL(a.href)
      })
  },
}
