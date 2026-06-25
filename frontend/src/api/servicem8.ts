import { apiClient } from './client'

export interface SM8Company {
  uuid: string
  name: string
  phone: string | null
  email: string | null
}

export interface SM8Asset {
  uuid: string
  name: string
  serial: string | null
  model: string | null
}

export interface DispatchResult {
  dispatched: number
  failed: number
  skipped: number
}

export const servicem8Api = {
  searchCompanies: async (term: string): Promise<SM8Company[]> => {
    const { data } = await apiClient.get<SM8Company[]>('/servicem8/search-companies', { params: { term } })
    return data
  },

  companyAssets: async (companyUuid: string): Promise<SM8Asset[]> => {
    const { data } = await apiClient.get<SM8Asset[]>(`/servicem8/company-assets/${companyUuid}`)
    return data
  },

  dispatchSync: async (): Promise<DispatchResult> => {
    const { data } = await apiClient.post<DispatchResult>('/servicem8/dispatch/sync')
    return data
  },

  consolidateHoursSync: async (): Promise<{ updated: number; failed: number }> => {
    const { data } = await apiClient.post('/servicem8/consolidate-hours/sync')
    return data
  },
}
