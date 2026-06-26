import { apiClient } from './client'
import type { MaintenanceSchedule } from '@/types'

export const schedulesApi = {
  list: async (assetId?: number): Promise<MaintenanceSchedule[]> => {
    const { data } = await apiClient.get<MaintenanceSchedule[]>('/schedules', {
      params: assetId ? { asset_id: assetId } : {},
    })
    return data
  },

  create: async (payload: Omit<MaintenanceSchedule, 'id' | 'created_at'>): Promise<MaintenanceSchedule> => {
    const { data } = await apiClient.post<MaintenanceSchedule>('/schedules', payload)
    return data
  },

  update: async (id: number, payload: Partial<MaintenanceSchedule>): Promise<MaintenanceSchedule> => {
    const { data } = await apiClient.patch<MaintenanceSchedule>(`/schedules/${id}`, payload)
    return data
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/schedules/${id}`)
  },

  pullForward: async (id: number): Promise<MaintenanceSchedule> => {
    const { data } = await apiClient.post<MaintenanceSchedule>(`/schedules/${id}/pull-forward`)
    return data
  },
}
