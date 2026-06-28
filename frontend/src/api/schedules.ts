import { apiClient } from './client'
import type { MaintenanceSchedule, JobInstance } from '@/types'

export const schedulesApi = {
  list: async (assetId?: number): Promise<MaintenanceSchedule[]> => {
    const { data } = await apiClient.get<MaintenanceSchedule[]>('/schedules', {
      params: assetId ? { asset_id: assetId } : {},
    })
    return data
  },

  listBySite: async (siteId: number): Promise<MaintenanceSchedule[]> => {
    const { data } = await apiClient.get<MaintenanceSchedule[]>('/schedules', {
      params: { site_id: siteId },
    })
    return data
  },

  bulkCombine: async (siteId: number, serviceId: number, combine: boolean): Promise<{ updated: number }> => {
    const { data } = await apiClient.post<{ updated: number }>('/schedules/bulk-combine', {
      site_id: siteId,
      service_id: serviceId,
      combine,
    })
    return data
  },

  listByLinkGroup: async (linkGroup: string): Promise<MaintenanceSchedule[]> => {
    const { data } = await apiClient.get<MaintenanceSchedule[]>('/schedules', {
      params: { link_group: linkGroup },
    })
    return data
  },

  listLinkGroups: async (siteId?: number): Promise<string[]> => {
    const { data } = await apiClient.get<string[]>('/schedules/link-groups', {
      params: siteId ? { site_id: siteId } : {},
    })
    return data
  },

  history: async (scheduleId: number): Promise<JobInstance[]> => {
    const { data } = await apiClient.get<JobInstance[]>(`/schedules/${scheduleId}/history`)
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
