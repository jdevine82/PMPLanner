import { apiClient } from './client'
import type { Asset } from '@/types'

export const assetsApi = {
  list: async (siteId?: number): Promise<Asset[]> => {
    const { data } = await apiClient.get<Asset[]>('/assets', {
      params: siteId ? { site_id: siteId } : {},
    })
    return data
  },

  create: async (payload: Omit<Asset, 'id' | 'created_at' | 'servicem8_asset_uuid'> & { servicem8_asset_uuid?: string | null }): Promise<Asset> => {
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

  transfer: async (id: number, targetSiteId: number, targetLocationId: number | null): Promise<Asset> => {
    const { data } = await apiClient.post<Asset>(`/assets/${id}/transfer`, {
      target_site_id: targetSiteId,
      target_location_id: targetLocationId,
    })
    return data
  },
}
