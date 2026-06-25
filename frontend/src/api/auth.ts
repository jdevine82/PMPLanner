import { apiClient } from './client'
import type { User } from '@/types'

export const authApi = {
  login: async (username: string, password: string): Promise<string> => {
    const params = new URLSearchParams()
    params.append('username', username)
    params.append('password', password)
    const { data } = await apiClient.post<{ access_token: string }>('/auth/login', params)
    return data.access_token
  },

  me: async (): Promise<User> => {
    const { data } = await apiClient.get<User>('/auth/me')
    return data
  },

  createUser: async (payload: { username: string; password: string; user_role: string }): Promise<User> => {
    const { data } = await apiClient.post<User>('/auth/users', payload)
    return data
  },
}
