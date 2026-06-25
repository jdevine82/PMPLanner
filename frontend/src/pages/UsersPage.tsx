import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Shield, User } from 'lucide-react'
import { apiClient } from '@/api/client'
import { authApi } from '@/api/auth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { Dialog } from '@/components/ui/Dialog'
import { useToast } from '@/components/ui/Toast'
import type { User as UserType } from '@/types'

export default function UsersPage() {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState({ username: '', password: '', user_role: 'Staff' })
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }))

  const { data: users = [], isLoading } = useQuery<UserType[]>({
    queryKey: ['users'],
    queryFn: async () => (await apiClient.get('/users/')).data,
  })

  const createMutation = useMutation({
    mutationFn: () => authApi.createUser(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setCreateOpen(false); toast('User created'); setForm({ username: '', password: '', user_role: 'Staff' }) },
    onError: () => toast('Failed to create user', 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiClient.delete(`/users/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast('User deleted') },
    onError: () => toast('Failed to delete user', 'error'),
  })

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-5 py-3">
        <h1 className="text-base font-semibold">Users</h1>
        <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="h-3.5 w-3.5" />Add User</Button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
        {isLoading && <p className="text-sm text-gray-400 text-center py-8">Loading…</p>}
        <div className="max-w-lg space-y-2">
          {users.map((u) => (
            <div key={u.id} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3">
              <div className="flex items-center gap-3">
                {u.user_role === 'Admin'
                  ? <Shield className="h-5 w-5 text-blue-600" />
                  : <User className="h-5 w-5 text-gray-400" />
                }
                <div>
                  <p className="font-medium text-gray-800">{u.username}</p>
                  <p className="text-xs text-gray-400">{u.user_role}</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(u.id)} className="text-red-500 hover:text-red-700">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen} title="New User">
        <div className="space-y-4">
          {[
            { key: 'username', label: 'Username', type: 'text' },
            { key: 'password', label: 'Password', type: 'password' },
          ].map(({ key, label, type }) => (
            <div key={key} className="space-y-1">
              <Label>{label}</Label>
              <Input type={type} value={(form as Record<string, string>)[key]} onChange={(e) => set(key, e.target.value)} />
            </div>
          ))}
          <div className="space-y-1">
            <Label>Role</Label>
            <Select value={form.user_role} onChange={(e) => set('user_role', e.target.value)}>
              <option value="Staff">Staff</option>
              <option value="Admin">Admin</option>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!form.username || !form.password || createMutation.isPending}>
              {createMutation.isPending ? 'Creating…' : 'Create User'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
