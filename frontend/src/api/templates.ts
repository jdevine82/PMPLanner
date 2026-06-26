import { apiClient } from './client'
import type { ServiceTemplate, TemplateAttachment, SM8Badge } from '@/types'

export interface TemplateUpdatePayload {
  title?: string
  parsed_document_text?: string
  interval_months?: number | null
  default_estimated_labor_hours?: number | null
  job_description?: string | null
  work_completed?: string | null
  attachments?: TemplateAttachment[] | null
  job_badges?: SM8Badge[] | null
}

export const templatesApi = {
  list: async (): Promise<ServiceTemplate[]> => {
    const { data } = await apiClient.get<ServiceTemplate[]>('/service-templates')
    return data
  },

  createManual: async (
    title: string,
    content: string,
    extras?: Omit<TemplateUpdatePayload, 'title' | 'parsed_document_text'>,
  ): Promise<ServiceTemplate> => {
    const { data } = await apiClient.post<ServiceTemplate>('/service-templates/manual', { title, content, ...extras })
    return data
  },

  create: async (title: string, file: File): Promise<ServiceTemplate> => {
    const form = new FormData()
    form.append('title', title)
    form.append('file', file)
    const { data } = await apiClient.post<ServiceTemplate>('/service-templates', form)
    return data
  },

  update: async (id: number, payload: TemplateUpdatePayload): Promise<ServiceTemplate> => {
    const { data } = await apiClient.patch<ServiceTemplate>(`/service-templates/${id}`, payload)
    return data
  },

  updateContent: async (id: number, content: string): Promise<ServiceTemplate> => {
    const { data } = await apiClient.patch<ServiceTemplate>(`/service-templates/${id}`, { parsed_document_text: content })
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
