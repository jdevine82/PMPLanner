import { apiClient } from './client'
import type { Site } from '@/types'

export const sitesApi = {
  list: async (customerId?: number): Promise<Site[]> => {
    const { data } = await apiClient.get<Site[]>('/sites', {
      params: customerId ? { customer_id: customerId } : {},
    })
    return data
  },

  create: async (payload: Omit<Site, 'id' | 'created_at'>): Promise<Site> => {
    const { data } = await apiClient.post<Site>('/sites', payload)
    return data
  },

  update: async (id: number, payload: Partial<Site>): Promise<Site> => {
    const { data } = await apiClient.patch<Site>(`/sites/${id}`, payload)
    return data
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/sites/${id}`)
  },
}
