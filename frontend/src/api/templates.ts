import { apiClient } from './client'
import type { ServiceTemplate } from '@/types'

export const templatesApi = {
  list: async (): Promise<ServiceTemplate[]> => {
    const { data } = await apiClient.get<ServiceTemplate[]>('/service-templates')
    return data
  },

  create: async (title: string, file: File): Promise<ServiceTemplate> => {
    const form = new FormData()
    form.append('title', title)
    form.append('file', file)
    const { data } = await apiClient.post<ServiceTemplate>('/service-templates', form)
    return data
  },

  update: async (id: number, payload: { title?: string }): Promise<ServiceTemplate> => {
    const { data } = await apiClient.patch<ServiceTemplate>(`/service-templates/${id}`, payload)
    return data
  },

  replaceDocument: async (id: number, file: File): Promise<ServiceTemplate> => {
    const form = new FormData()
    form.append('file', file)
    const { data } = await apiClient.put<ServiceTemplate>(`/service-templates/${id}/document`, form)
    return data
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/service-templates/${id}`)
  },
}
