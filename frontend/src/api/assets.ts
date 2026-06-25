import { apiClient } from './client'
import type { Asset } from '@/types'

export const assetsApi = {
  list: async (siteId?: number): Promise<Asset[]> => {
    const { data } = await apiClient.get<Asset[]>('/assets', {
      params: siteId ? { site_id: siteId } : {},
    })
    return data
  },

  create: async (payload: Omit<Asset, 'id' | 'created_at'>): Promise<Asset> => {
    const { data } = await apiClient.post<Asset>('/assets', payload)
    return data
  },

  update: async (id: number, payload: Partial<Asset>): Promise<Asset> => {
    const { data } = await apiClient.patch<Asset>(`/assets/${id}`, payload)
    return data
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/assets/${id}`)
  },
}
