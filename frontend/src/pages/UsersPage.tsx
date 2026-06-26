import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Shield, User, HardHat, Pencil } from 'lucide-react'
import { apiClient } from '@/api/client'
import { authApi } from '@/api/auth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { Dialog } from '@/components/ui/Dialog'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/context/AuthContext'
import type { User as UserType } from '@/types'

export default function UsersPage() {
  const qc = useQueryClient()
  const { toast } = useToast()
  const { user: currentUser } = useAuth()
  const [createOpen, setCreateOpen] = useState(false)
  const [editUser, setEditUser] = useState<UserType | null>(null)
  const [createForm, setCreateForm] = useState({ username: '', password: '', user_role: 'Staff' })
  const [editForm, setEditForm] = useState({ password: '', user_role: 'Staff' })

  const { data: users = [], isLoading } = useQuery<UserType[]>({
    queryKey: ['users'],
    queryFn: async () => (await apiClient.get('/users')).data,
  })

  const createMutation = useMutation({
    mutationFn: () => authApi.createUser(createForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      setCreateOpen(false)
      setCreateForm({ username: '', password: '', user_role: 'Staff' })
      toast('User created')
    },
    onError: () => toast('Failed to create user', 'error'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { password?: string; user_role?: string } }) =>
      apiClient.patch(`/users/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      setEditUser(null)
      toast('User updated')
    },
    onError: () => toast('Failed to update user', 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiClient.delete(`/users/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast('User deleted') },
    onError: () => toast('Failed to delete user', 'error'),
  })

  function openEdit(u: UserType) {
    setEditUser(u)
    setEditForm({ password: '', user_role: u.user_role })
  }

  function submitEdit() {
    if (!editUser) return
    const payload: Record<string, string> = { user_role: editForm.user_role }
    if (editForm.password.trim()) payload.password = editForm.password.trim()
    updateMutation.mutate({ id: editUser.id, data: payload })
  }

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
                  : u.user_role === 'Worker'
                  ? <HardHat className="h-5 w-5 text-amber-500" />
                  : <User className="h-5 w-5 text-gray-400" />
                }
                <div>
                  <p className="font-medium text-gray-800">{u.username}</p>
                  <p className="text-xs text-gray-400">{u.user_role}</p>
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => openEdit(u)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost" size="sm"
                  onClick={() => deleteMutation.mutate(u.id)}
                  disabled={u.id === currentUser?.id}
                  className="text-red-500 hover:text-red-700 disabled:opacity-30"
                  title={u.id === currentUser?.id ? "Cannot delete your own account" : "Delete user"}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Create user */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen} title="New User">
        <div className="space-y-4">
          {[
            { key: 'username', label: 'Username', type: 'text' },
            { key: 'password', label: 'Password', type: 'password' },
          ].map(({ key, label, type }) => (
            <div key={key} className="space-y-1">
              <Label>{label}</Label>
              <Input type={type} value={(createForm as Record<string, string>)[key]} onChange={(e) => setCreateForm((p) => ({ ...p, [key]: e.target.value }))} />
            </div>
          ))}
          <div className="space-y-1">
            <Label>Role</Label>
            <Select value={createForm.user_role} onChange={(e) => setCreateForm((p) => ({ ...p, user_role: e.target.value }))}>
              <option value="Worker">Worker</option>
              <option value="Staff">Staff</option>
              <option value="Admin">Admin</option>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!createForm.username || !createForm.password || createMutation.isPending}>
              {createMutation.isPending ? 'Creating…' : 'Create User'}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Edit user */}
      <Dialog open={!!editUser} onOpenChange={(o) => !o && setEditUser(null)} title={`Edit — ${editUser?.username}`}>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>New Password <span className="text-gray-400 font-normal">(leave blank to keep current)</span></Label>
            <Input type="password" placeholder="Enter new password…" value={editForm.password} onChange={(e) => setEditForm((p) => ({ ...p, password: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label>Role</Label>
            <Select value={editForm.user_role} onChange={(e) => setEditForm((p) => ({ ...p, user_role: e.target.value }))}>
              <option value="Worker">Worker</option>
              <option value="Staff">Staff</option>
              <option value="Admin">Admin</option>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setEditUser(null)}>Cancel</Button>
            <Button onClick={submitEdit} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
