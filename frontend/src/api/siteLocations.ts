import { apiClient } from './client'
import type { SiteLocation } from '@/types'

export const siteLocationsApi = {
  list: async (siteId?: number): Promise<SiteLocation[]> => {
    const { data } = await apiClient.get<SiteLocation[]>('/site-locations', {
      params: siteId ? { site_id: siteId } : {},
    })
    return data
  },

  create: async (payload: { site_id: number; name: string; parent_id?: number | null }): Promise<SiteLocation> => {
    const { data } = await apiClient.post<SiteLocation>('/site-locations', payload)
    return data
  },

  update: async (id: number, payload: { name?: string; parent_id?: number | null }): Promise<SiteLocation> => {
    const { data } = await apiClient.patch<SiteLocation>(`/site-locations/${id}`, payload)
    return data
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/site-locations/${id}`)
  },
}
