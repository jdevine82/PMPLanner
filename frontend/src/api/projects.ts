import { apiClient } from './client'
import type { Project, ProjectCreate, ProjectUpdate } from '@/types'

export const projectsApi = {
  list: async (): Promise<Project[]> => (await apiClient.get('/projects')).data,
  get: async (id: number): Promise<Project> => (await apiClient.get(`/projects/${id}`)).data,
  create: async (data: ProjectCreate): Promise<Project> => (await apiClient.post('/projects', data)).data,
  update: async (id: number, data: ProjectUpdate): Promise<Project> =>
    (await apiClient.patch(`/projects/${id}`, data)).data,
  delete: async (id: number): Promise<void> => { await apiClient.delete(`/projects/${id}`) },
}
