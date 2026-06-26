import { apiClient } from './client'
import type { Customer } from '@/types'

export const customersApi = {
  list: async (search?: string, hasSchedules?: boolean): Promise<Customer[]> => {
    const params: Record<string, unknown> = {}
    if (search) params.search = search
    if (hasSchedules) params.has_schedules = true
    const { data } = await apiClient.get<Customer[]>('/customers', { params })
    return data
  },

  get: async (id: number): Promise<Customer> => {
    const { data } = await apiClient.get<Customer>(`/customers/${id}`)
    return data
  },

  create: async (payload: Omit<Customer, 'id'>): Promise<Customer> => {
    const { data } = await apiClient.post<Customer>('/customers', payload)
    return data
  },

  update: async (id: number, payload: Partial<Customer>): Promise<Customer> => {
    const { data } = await apiClient.patch<Customer>(`/customers/${id}`, payload)
    return data
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/customers/${id}`)
  },
}
