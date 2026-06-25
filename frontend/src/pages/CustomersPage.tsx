import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Pencil, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import { customersApi } from '@/api/customers'
import { sitesApi } from '@/api/sites'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Dialog } from '@/components/ui/Dialog'
import { useToast } from '@/components/ui/Toast'
import { useDebounce } from '@/hooks/useDebounce'
import type { Customer, Site } from '@/types'

function CustomerForm({
  initial,
  onSubmit,
  onCancel,
  loading,
}: {
  initial?: Partial<Customer>
  onSubmit: (v: Omit<Customer, 'id'>) => void
  onCancel: () => void
  loading: boolean
}) {
  const [form, setForm] = useState({
    company_name: initial?.company_name ?? '',
    primary_contact: initial?.primary_contact ?? '',
    phone: initial?.phone ?? '',
    email: initial?.email ?? '',
  })
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }))
  return (
    <div className="space-y-4">
      {[
        { key: 'company_name',    label: 'Company Name', required: true },
        { key: 'primary_contact', label: 'Primary Contact' },
        { key: 'phone',           label: 'Phone' },
        { key: 'email',           label: 'Email' },
      ].map(({ key, label, required }) => (
        <div key={key} className="space-y-1">
          <Label htmlFor={key}>{label}{required && ' *'}</Label>
          <Input id={key} value={(form as Record<string, string>)[key]} onChange={(e) => set(key, e.target.value)} required={required} />
        </div>
      ))}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSubmit(form as Omit<Customer, 'id'>)} disabled={!form.company_name || loading}>
          {loading ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
  )
}

function SiteRow({ site, onEdit, onDelete }: { site: Site; onEdit: (s: Site) => void; onDelete: (id: number) => void }) {
  return (
    <div className="flex items-center justify-between px-4 py-2 text-sm border-b border-gray-100 last:border-0">
      <div>
        <p className="font-medium text-gray-700">{site.site_name}</p>
        <p className="text-xs text-gray-400">{site.site_address}</p>
      </div>
      <div className="flex gap-1">
        <Button variant="ghost" size="sm" onClick={() => onEdit(site)}><Pencil className="h-3.5 w-3.5" /></Button>
        <Button variant="ghost" size="sm" onClick={() => onDelete(site.id)} className="text-red-500 hover:text-red-700"><Trash2 className="h-3.5 w-3.5" /></Button>
      </div>
    </div>
  )
}

export default function CustomersPage() {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<number | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null)

  const debouncedSearch = useDebounce(search, 200)

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['customers', debouncedSearch],
    queryFn: () => customersApi.list(debouncedSearch || undefined),
  })

  const { data: sites = [] } = useQuery({
    queryKey: ['sites', expanded],
    queryFn: () => sitesApi.list(expanded!),
    enabled: !!expanded,
  })

  const createMutation = useMutation({
    mutationFn: customersApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['customers'] }); setCreateOpen(false); toast('Customer created') },
    onError: () => toast('Failed to create customer', 'error'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Customer> }) => customersApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['customers'] }); setEditCustomer(null); toast('Customer updated') },
    onError: () => toast('Failed to update customer', 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: customersApi.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['customers'] }); toast('Customer deleted') },
    onError: () => toast('Cannot delete — customer may have linked data', 'error'),
  })

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-5 py-3">
        <h1 className="text-base font-semibold">Customers</h1>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <Input className="pl-8 w-56" placeholder="Search customers…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="h-3.5 w-3.5" />Add Customer</Button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
        {isLoading && <p className="text-sm text-gray-400 text-center py-8">Loading…</p>}
        <div className="space-y-2">
          {customers.map((c) => (
            <div key={c.id} className="rounded-lg border border-gray-200 bg-white overflow-hidden">
              <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setExpanded(expanded === c.id ? null : c.id)}
              >
                <div className="flex items-center gap-2">
                  {expanded === c.id ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                  <div>
                    <p className="font-medium text-gray-800">{c.company_name}</p>
                    {c.primary_contact && <p className="text-xs text-gray-400">{c.primary_contact} {c.phone && `· ${c.phone}`}</p>}
                  </div>
                </div>
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="sm" onClick={() => setEditCustomer(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(c.id)} className="text-red-500 hover:text-red-700"><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>

              {expanded === c.id && (
                <div className="border-t border-gray-100 bg-gray-50">
                  {sites.length === 0
                    ? <p className="px-4 py-3 text-xs text-gray-400">No sites linked.</p>
                    : sites.map((s) => <SiteRow key={s.id} site={s} onEdit={() => {}} onDelete={() => qc.invalidateQueries({ queryKey: ['sites'] })} />)
                  }
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen} title="New Customer">
        <CustomerForm onSubmit={(d) => createMutation.mutate(d)} onCancel={() => setCreateOpen(false)} loading={createMutation.isPending} />
      </Dialog>

      <Dialog open={!!editCustomer} onOpenChange={(o) => !o && setEditCustomer(null)} title="Edit Customer">
        {editCustomer && (
          <CustomerForm
            initial={editCustomer}
            onSubmit={(d) => updateMutation.mutate({ id: editCustomer.id, data: d })}
            onCancel={() => setEditCustomer(null)}
            loading={updateMutation.isPending}
          />
        )}
      </Dialog>
    </div>
  )
}
