import { apiClient } from './client'
import type { SM8Badge } from '@/types'

export type { SM8Badge }

export interface SM8Company {
  uuid: string
  name: string
  phone: string | null
  email: string | null
}

export interface SM8CompanyDetail {
  uuid: string
  name: string
  address: string
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

  getCompany: async (companyUuid: string): Promise<SM8CompanyDetail> => {
    const { data } = await apiClient.get<SM8CompanyDetail>(`/servicem8/company/${companyUuid}`)
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

  importCustomers: async (): Promise<{ created: number; updated: number }> => {
    const { data } = await apiClient.post<{ created: number; updated: number }>('/servicem8/import-customers')
    return data
  },

  fetchBadges: async (): Promise<SM8Badge[]> => {
    const { data } = await apiClient.get<SM8Badge[]>('/servicem8/badges')
    return data
  },

}
