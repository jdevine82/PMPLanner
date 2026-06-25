import { apiClient } from './client'
import type { JobInstance, JobComment, MonthInitResult } from '@/types'

export const jobsApi = {
  list: async (month: string): Promise<JobInstance[]> => {
    const { data } = await apiClient.get<JobInstance[]>('/jobs', { params: { month } })
    return data
  },

  update: async (
    id: number,
    payload: Partial<Pick<JobInstance, 'approval_status' | 'refusal_reason' | 'sync_status' | 'customer_po_link' | 'actual_labor_hours'>>,
  ): Promise<JobInstance> => {
    const { data } = await apiClient.patch<JobInstance>(`/jobs/${id}`, payload)
    return data
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/jobs/${id}`)
  },

  initializeMonth: async (month: string): Promise<MonthInitResult> => {
    const { data } = await apiClient.post<MonthInitResult>(`/jobs/initialize/${month}`)
    return data
  },

  checkMonth: async (month: string): Promise<{ month: string; has_jobs: boolean }> => {
    const { data } = await apiClient.get(`/jobs/check/${month}`)
    return data
  },

  listComments: async (jobId: number): Promise<JobComment[]> => {
    const { data } = await apiClient.get<JobComment[]>(`/jobs/${jobId}/comments`)
    return data
  },

  addComment: async (jobId: number, comment_text: string): Promise<JobComment> => {
    const { data } = await apiClient.post<JobComment>(`/jobs/${jobId}/comments`, { comment_text })
    return data
  },
}
