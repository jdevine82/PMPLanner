import { apiClient } from './client'

export interface ATDispatchResult {
  dispatched: number
  failed: number
  skipped: number
  message?: string
}

export interface ATPullResult {
  updated: number
  failed: number
  message?: string
}

export const assettrackerApi = {
  testConnection: async (): Promise<{ status: string; user: Record<string, unknown> }> => {
    const { data } = await apiClient.get('/assettracker/test-connection')
    return data
  },

  dispatchSync: async (): Promise<ATDispatchResult> => {
    const { data } = await apiClient.post<ATDispatchResult>('/assettracker/dispatch/sync')
    return data
  },

  pullCompletedSync: async (): Promise<ATPullResult> => {
    const { data } = await apiClient.post<ATPullResult>('/assettracker/pull-completed/sync')
    return data
  },
}
