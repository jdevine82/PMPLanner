import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/context/AuthContext'
import { Plus, Search, Pencil, Trash2, ChevronDown, ChevronRight, Link2, Download, Calendar, ChevronsRight, MapPin, ClipboardList, History } from 'lucide-react'
import { customersApi } from '@/api/customers'
import { sitesApi } from '@/api/sites'
import { assetsApi } from '@/api/assets'
import { siteLocationsApi } from '@/api/siteLocations'
import { schedulesApi } from '@/api/schedules'
import { servicem8Api } from '@/api/servicem8'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Dialog } from '@/components/ui/Dialog'
import { useToast } from '@/components/ui/Toast'
import { useDebounce } from '@/hooks/useDebounce'
import { ServiceM8CustomerSearch } from '@/components/ServiceM8CustomerSearch'
import { AssetImportModal } from '@/components/AssetImportModal'
import { WorkloadForecastFooter } from '@/components/WorkloadForecastFooter'
import type { Customer, Site, SiteLocation, Asset, MaintenanceSchedule, ServiceTemplate } from '@/types'
import type { SM8Company } from '@/api/servicem8'
import { apiClient } from '@/api/client'
import { toCombinedStatus, COMBINED_STATUS_COLOURS } from '@/lib/jobStatus'

// ─── Customer form ────────────────────────────────────────────────────────────

type CustomerFormValues = Omit<Customer, 'id'>

function CustomerForm({ initial, onSubmit, onCancel, loading }: {
  initial?: Partial<Customer>; onSubmit: (v: CustomerFormValues) => void; onCancel: () => void; loading: boolean
}) {
  const [form, setForm] = useState<CustomerFormValues>({
    company_name: initial?.company_name ?? '',
    primary_contact: initial?.primary_contact ?? null,
    phone: initial?.phone ?? null,
    email: initial?.email ?? null,
    servicem8_uuid: initial?.servicem8_uuid ?? null,
  })
  const [showSM8, setShowSM8] = useState(false)
  const set = (k: keyof CustomerFormValues, v: string | null) => setForm((p) => ({ ...p, [k]: v }))

  function handleSM8Select(company: SM8Company) {
    setForm((p) => ({ ...p, company_name: company.name, phone: company.phone ?? p.phone, email: company.email ?? p.email, servicem8_uuid: company.uuid }))
    setShowSM8(false)
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-blue-100 bg-blue-50 p-3">
        <button type="button" className="flex items-center gap-2 text-sm font-medium text-blue-700" onClick={() => setShowSM8((v) => !v)}>
          <Link2 className="h-4 w-4" />{showSM8 ? 'Hide ServiceM8 Import' : 'Import from ServiceM8'}
        </button>
        {showSM8 && (
          <div className="mt-2">
            <ServiceM8CustomerSearch onSelect={handleSM8Select} placeholder="Search ServiceM8 companies…" />
            <p className="mt-1 text-xs text-blue-500">Selecting a company will pre-fill the fields below.</p>
          </div>
        )}
        {form.servicem8_uuid && !showSM8 && (
          <p className="mt-1 text-xs text-blue-600">Linked to SM8: <span className="font-mono">{form.servicem8_uuid}</span></p>
        )}
      </div>
      {([['company_name', 'Company Name', true], ['primary_contact', 'Primary Contact', false], ['phone', 'Phone', false], ['email', 'Email', false]] as const).map(([key, label, req]) => (
        <div key={key} className="space-y-1">
          <Label htmlFor={key}>{label}{req && ' *'}</Label>
          <Input id={key} value={(form[key] as string) ?? ''} onChange={(e) => set(key, e.target.value || null)} required={req} />
        </div>
      ))}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSubmit(form)} disabled={!form.company_name || loading}>{loading ? 'Saving…' : 'Save'}</Button>
      </div>
    </div>
  )
}

// ─── Site form ────────────────────────────────────────────────────────────────

type SiteFormValues = { site_name: string; site_address: string; servicem8_client_uuid: string | null }

function SiteForm({ initial, onSubmit, onCancel, loading }: {
  initial?: Partial<Site>; onSubmit: (v: SiteFormValues) => void; onCancel: () => void; loading: boolean
}) {
  const [form, setForm] = useState<SiteFormValues>({ site_name: initial?.site_name ?? '', site_address: initial?.site_address ?? '', servicem8_client_uuid: initial?.servicem8_client_uuid ?? null })
  const set = (k: keyof SiteFormValues, v: string | null) => setForm((p) => ({ ...p, [k]: v }))

  return (
    <div className="space-y-4">
      <div className="space-y-1"><Label>Site Name *</Label><Input value={form.site_name} onChange={(e) => set('site_name', e.target.value)} required /></div>
      <div className="space-y-1"><Label>Site Address *</Label><Input value={form.site_address} onChange={(e) => set('site_address', e.target.value)} required /></div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSubmit(form)} disabled={!form.site_name || !form.site_address || loading}>{loading ? 'Saving…' : 'Save'}</Button>
      </div>
    </div>
  )
}

// ─── Sublocation form ─────────────────────────────────────────────────────────

function SublocationForm({ initial, onSubmit, onCancel, loading }: {
  initial?: Partial<SiteLocation>; onSubmit: (name: string) => void; onCancel: () => void; loading: boolean
}) {
  const [name, setName] = useState(initial?.name ?? '')
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label>Location Name *</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. South Campus Toilet" />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSubmit(name)} disabled={!name.trim() || loading}>{loading ? 'Saving…' : 'Save'}</Button>
      </div>
    </div>
  )
}

// ─── Asset form ───────────────────────────────────────────────────────────────

function AssetForm({ initial, sublocations, onSubmit, onCancel, loading }: {
  initial?: Partial<Asset>; sublocations: SiteLocation[]; onSubmit: (v: Partial<Asset>) => void; onCancel: () => void; loading: boolean
}) {
  const [form, setForm] = useState({
    asset_name: initial?.asset_name ?? '',
    serial_number: initial?.serial_number ?? '',
    model_number: initial?.model_number ?? '',
    location_id: initial?.location_id ?? null as number | null,
  })
  return (
    <div className="space-y-4">
      {([['asset_name', 'Asset Name'], ['serial_number', 'Serial Number'], ['model_number', 'Model Number']] as const).map(([key, label]) => (
        <div key={key} className="space-y-1">
          <Label>{label}{key === 'asset_name' && ' *'}</Label>
          <Input value={form[key] as string} onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))} />
        </div>
      ))}
      {sublocations.length > 0 && (
        <div className="space-y-1">
          <Label>Sublocation</Label>
          <select
            className="block w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={form.location_id ?? ''}
            onChange={(e) => setForm((p) => ({ ...p, location_id: e.target.value ? Number(e.target.value) : null }))}
          >
            <option value="">— None (unassigned) —</option>
            {sublocations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button
          onClick={() => onSubmit({
            asset_name: form.asset_name,
            serial_number: form.serial_number || null,
            model_number: form.model_number || null,
            location_id: form.location_id,
          })}
          disabled={!form.asset_name || loading}
        >
          {loading ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
  )
}

// ─── Schedule form ────────────────────────────────────────────────────────────

function ScheduleForm({ assetId, initial, templates, onSubmit, onCancel, loading }: {
  assetId: number; initial?: Partial<MaintenanceSchedule>; templates: ServiceTemplate[];
  onSubmit: (v: Omit<MaintenanceSchedule, 'id' | 'created_at'>) => void; onCancel: () => void; loading: boolean
}) {
  const today = new Date().toISOString().split('T')[0]
  const defaultTemplate = templates[0]
  const defaultHours = initial?.estimated_labor_hours
    ?? defaultTemplate?.default_estimated_labor_hours
    ?? 1
  const [form, setForm] = useState({
    service_id: initial?.service_id ?? (defaultTemplate?.id ?? 0),
    estimated_labor_hours: String(defaultHours),
    frequency_months: String(initial?.frequency_months ?? defaultTemplate?.interval_months ?? 3),
    date_next_due: initial?.date_next_due ?? today,
    date_last_done: initial?.date_last_done ?? '',
    permanent_custom_instructions: initial?.permanent_custom_instructions ?? '',
  })
  const autoTag = (svcId: number) => `svc:${svcId}`
  const [combineIntoOne, setCombineIntoOne] = useState(!!initial?.sm8_group_tag)
  const set = (k: string, v: string | number) => setForm((p) => ({ ...p, [k]: v }))

  function handleServiceChange(svcId: number) {
    const t = templates.find((t) => t.id === svcId)
    setForm((p) => ({
      ...p,
      service_id: svcId,
      ...(t?.default_estimated_labor_hours != null && !initial?.estimated_labor_hours
        ? { estimated_labor_hours: String(t.default_estimated_labor_hours) }
        : {}),
      ...(t?.interval_months != null && !initial?.frequency_months
        ? { frequency_months: String(t.interval_months) }
        : {}),
    }))
  }

  const selectedService = templates.find((t) => t.id === Number(form.service_id))

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label>Service *</Label>
        <select className="block w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          value={form.service_id} onChange={(e) => handleServiceChange(Number(e.target.value))}>
          {templates.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Est. Labor Hours *</Label>
          <Input type="number" min="0" step="0.25" value={form.estimated_labor_hours} onChange={(e) => set('estimated_labor_hours', e.target.value)} />
          {selectedService && (
            selectedService.historical_average_labor_hours > 0 ? (
              <div className="flex items-center justify-between rounded-md bg-blue-50 border border-blue-100 px-3 py-1.5">
                <span className="text-xs text-blue-700">Historical avg: <strong>{selectedService.historical_average_labor_hours}h</strong></span>
                <button
                  type="button"
                  className="text-xs font-medium text-blue-600 hover:text-blue-800 underline"
                  onClick={() => set('estimated_labor_hours', String(selectedService.historical_average_labor_hours))}
                >
                  Use avg
                </button>
              </div>
            ) : (
              <p className="text-xs text-gray-400">Historical avg: none yet — updated by labor consolidation</p>
            )
          )}
        </div>
        <div className="space-y-1">
          <Label>Frequency (months) *</Label>
          <select className="block w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={form.frequency_months} onChange={(e) => set('frequency_months', e.target.value)}>
            {[1,2,3,6,12,24].map((m) => <option key={m} value={m}>{m} month{m > 1 ? 's' : ''}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Next Due Date *</Label>
          <Input type="date" value={form.date_next_due} onChange={(e) => set('date_next_due', e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Last Done Date</Label>
          <Input type="date" value={form.date_last_done} onChange={(e) => set('date_last_done', e.target.value)} />
        </div>
      </div>
      <div className="space-y-1">
        <Label>Custom Instructions</Label>
        <textarea className="block w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          rows={3} value={form.permanent_custom_instructions} onChange={(e) => set('permanent_custom_instructions', e.target.value)} placeholder="Permanent notes for technicians…" />
      </div>
      <label className="flex items-start gap-3 rounded-md border border-gray-200 px-3 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors">
        <input
          type="checkbox"
          className="mt-0.5 rounded"
          checked={combineIntoOne}
          onChange={(e) => setCombineIntoOne(e.target.checked)}
        />
        <div>
          <p className="text-sm font-medium text-gray-700">Combine into one SM8 job</p>
          <p className="text-xs text-gray-400 mt-0.5">
            All assets at this site using <span className="font-medium text-gray-600">{selectedService?.title ?? 'this service'}</span> with this option checked will be dispatched as a single ServiceM8 job.
          </p>
        </div>
      </label>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button
          onClick={() => onSubmit({
            asset_id: assetId,
            service_id: Number(form.service_id),
            estimated_labor_hours: parseFloat(form.estimated_labor_hours) || 1,
            frequency_months: parseInt(form.frequency_months) || 3,
            date_next_due: form.date_next_due,
            date_last_done: form.date_last_done || null,
            permanent_custom_instructions: form.permanent_custom_instructions || null,
            sm8_group_tag: combineIntoOne ? autoTag(Number(form.service_id)) : null,
          })}
          disabled={!form.date_next_due || !form.service_id || loading}
        >
          {loading ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
  )
}

// ─── Schedule history (inline past jobs for a single schedule) ────────────────

function ScheduleHistory({ scheduleId }: { scheduleId: number }) {
  const { data: instances = [], isLoading } = useQuery({
    queryKey: ['schedule-history', scheduleId],
    queryFn: () => schedulesApi.history(scheduleId),
  })

  if (isLoading) return <p className="px-8 py-2 text-xs text-gray-400">Loading history…</p>
  if (instances.length === 0) return <p className="px-8 py-2 text-xs text-gray-400">No service history recorded yet.</p>

  return (
    <div className="px-8 pb-2 pt-1 bg-gray-50 border-t border-gray-100">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-gray-400 border-b border-gray-200">
            <th className="text-left py-1 font-medium">Month</th>
            <th className="text-left py-1 font-medium">Status</th>
            <th className="text-left py-1 font-medium">SM8 Job</th>
            <th className="text-left py-1 font-medium">Hours</th>
          </tr>
        </thead>
        <tbody>
          {instances.map((inst) => {
            const combined = toCombinedStatus(inst)
            return (
              <tr key={inst.id} className="border-b border-gray-100 last:border-0">
                <td className="py-1 font-mono text-gray-600">{inst.target_month_year}</td>
                <td className="py-1">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${COMBINED_STATUS_COLOURS[combined]}`}>
                    {combined}
                  </span>
                </td>
                <td className="py-1 text-gray-500">{inst.servicem8_job_number != null ? `#${inst.servicem8_job_number}` : '—'}</td>
                <td className="py-1 text-gray-500">{inst.actual_labor_hours != null ? `${inst.actual_labor_hours}h` : '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Schedule section (under asset) ──────────────────────────────────────────

function ScheduleSection({ assetId, templates, readOnly }: { assetId: number; templates: ServiceTemplate[]; readOnly?: boolean }) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [addOpen, setAddOpen] = useState(false)
  const [editSchedule, setEditSchedule] = useState<MaintenanceSchedule | null>(null)
  const [historyOpen, setHistoryOpen] = useState<number | null>(null)

  const { data: schedules = [] } = useQuery({
    queryKey: ['schedules', assetId],
    queryFn: () => schedulesApi.list(assetId),
  })

  const createSchedule = useMutation({
    mutationFn: schedulesApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['schedules'] }); setAddOpen(false); toast('Schedule created') },
    onError: () => toast('Failed to create schedule', 'error'),
  })

  const updateSchedule = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<MaintenanceSchedule> }) => schedulesApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['schedules'] }); setEditSchedule(null); toast('Schedule updated') },
    onError: () => toast('Failed to update schedule', 'error'),
  })

  const deleteSchedule = useMutation({
    mutationFn: schedulesApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedules'] }),
    onError: () => toast('Cannot delete — schedule may have linked jobs', 'error'),
  })

  const pullForward = useMutation({
    mutationFn: schedulesApi.pullForward,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['schedules'] }); toast('Service pulled forward to today') },
    onError: () => toast('Could not pull forward — service may already be due', 'error'),
  })

  const templateMap = Object.fromEntries(templates.map((t) => [t.id, t]))

  return (
    <div className="border-t border-gray-100 bg-white">
      {schedules.length === 0 && <p className="px-6 py-2 text-xs text-gray-400">No maintenance schedules.</p>}
      {schedules.map((s) => (
        <div key={s.id} className="border-b border-gray-50 last:border-0">
          <div className="flex items-center justify-between px-6 py-1.5">
            <div className="flex items-center gap-4 text-xs text-gray-600">
              <span className="font-medium">{templateMap[s.service_id]?.title ?? `Template #${s.service_id}`}</span>
              <span className="text-gray-400">Every {s.frequency_months}mo</span>
              <span className="text-gray-400">{s.estimated_labor_hours}h est.</span>
              {templateMap[s.service_id]?.historical_average_labor_hours > 0 && (
                <span className="text-blue-500" title="Historical average from completed jobs">
                  {templateMap[s.service_id].historical_average_labor_hours}h avg
                </span>
              )}
              <span className="flex items-center gap-1 text-gray-400">
                <Calendar className="h-3 w-3" />
                Due {s.date_next_due}
                {s.date_anchor_next_due && (
                  <span className="ml-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700" title={`Originally due ${s.date_anchor_next_due}`}>
                    pulled forward
                  </span>
                )}
              </span>
              {s.sm8_group_tag && (
                <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                  Combined
                </span>
              )}
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                title="View service history"
                onClick={() => setHistoryOpen(historyOpen === s.id ? null : s.id)}
                className={historyOpen === s.id ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}
              >
                <History className="h-3 w-3" />
              </Button>
              {!readOnly && (
                <>
                  {!s.date_anchor_next_due && s.date_next_due > new Date().toISOString().slice(0, 10) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Pull service forward to today (next cycle stays on original schedule)"
                      onClick={() => {
                        if (confirm(`Bring this service forward to today?\n\nThe next cycle after completion will remain on the original date (${s.date_next_due}).`)) {
                          pullForward.mutate(s.id)
                        }
                      }}
                      disabled={pullForward.isPending}
                      className="text-amber-600 hover:text-amber-800"
                    >
                      <ChevronsRight className="h-3 w-3" />
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => setEditSchedule(s)}><Pencil className="h-3 w-3" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => deleteSchedule.mutate(s.id)} className="text-red-500 hover:text-red-700"><Trash2 className="h-3 w-3" /></Button>
                </>
              )}
            </div>
          </div>
          {historyOpen === s.id && <ScheduleHistory scheduleId={s.id} />}
        </div>
      ))}
      {!readOnly && (
        <div className="px-6 py-2">
          <Button variant="outline" size="sm" onClick={() => setAddOpen(true)} disabled={templates.length === 0}>
            <Plus className="h-3.5 w-3.5" />Add Schedule
          </Button>
          {templates.length === 0 && <span className="ml-2 text-xs text-gray-400">Create a service first.</span>}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen} title="New Maintenance Schedule">
        <ScheduleForm assetId={assetId} templates={templates}
          onSubmit={(v) => createSchedule.mutate(v as any)}
          onCancel={() => setAddOpen(false)} loading={createSchedule.isPending} />
      </Dialog>
      <Dialog open={!!editSchedule} onOpenChange={(o) => !o && setEditSchedule(null)} title="Edit Schedule">
        {editSchedule && (
          <ScheduleForm assetId={assetId} initial={editSchedule} templates={templates}
            onSubmit={(v) => updateSchedule.mutate({ id: editSchedule.id, data: v as any })}
            onCancel={() => setEditSchedule(null)} loading={updateSchedule.isPending} />
        )}
      </Dialog>
    </div>
  )
}

// ─── Catch-all service form (label + full schedule, creates both in one step) ──

const SELECT_CLASS = 'block w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

type CatchAllSubmitValues = {
  label: string
  location_id: number | null
  service_id: number
  estimated_labor_hours: number
  frequency_months: number
  date_next_due: string
  date_last_done: string | null
  permanent_custom_instructions: string | null
}

function CatchAllServiceForm({ sublocations, templates, initialLocationId, onSubmit, onCancel, loading }: {
  sublocations: SiteLocation[]
  templates: ServiceTemplate[]
  initialLocationId?: number | null
  onSubmit: (v: CatchAllSubmitValues) => void
  onCancel: () => void
  loading: boolean
}) {
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    label: '',
    location_id: initialLocationId ?? null as number | null,
    service_id: templates[0]?.id ?? 0,
    estimated_labor_hours: '1',
    frequency_months: '3',
    date_next_due: today,
    date_last_done: '',
    permanent_custom_instructions: '',
  })
  const set = (k: string, v: string | number | null) => setForm((p) => ({ ...p, [k]: v }))

  const canSubmit = form.label.trim() && form.date_next_due && (form.service_id || templates[0]?.id)

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label>Description *</Label>
        <Input
          value={form.label}
          onChange={(e) => set('label', e.target.value)}
          placeholder="e.g. All Air Conditioners, General Plumbing…"
        />
        <p className="text-xs text-gray-400">A short label for this location-wide service.</p>
      </div>

      {sublocations.length > 0 && (
        <div className="space-y-1">
          <Label>Sublocation</Label>
          <select
            className={SELECT_CLASS}
            value={form.location_id ?? ''}
            onChange={(e) => set('location_id', e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">— Whole site —</option>
            {sublocations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
      )}

      <div className="border-t border-gray-100 pt-4 space-y-4">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Maintenance Schedule</p>
        <div className="space-y-1">
          <Label>Service *</Label>
          <select className={SELECT_CLASS} value={form.service_id} onChange={(e) => set('service_id', Number(e.target.value))}>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Est. Labor Hours *</Label>
            <Input type="number" min="0" step="0.25" value={form.estimated_labor_hours} onChange={(e) => set('estimated_labor_hours', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Frequency *</Label>
            <select className={SELECT_CLASS} value={form.frequency_months} onChange={(e) => set('frequency_months', e.target.value)}>
              {[1, 2, 3, 6, 12, 24].map((m) => <option key={m} value={m}>{m} month{m > 1 ? 's' : ''}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Next Due Date *</Label>
            <Input type="date" value={form.date_next_due} onChange={(e) => set('date_next_due', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Last Done Date</Label>
            <Input type="date" value={form.date_last_done} onChange={(e) => set('date_last_done', e.target.value)} />
          </div>
        </div>
        <div className="space-y-1">
          <Label>Custom Instructions</Label>
          <textarea
            className={SELECT_CLASS}
            rows={2}
            value={form.permanent_custom_instructions}
            onChange={(e) => set('permanent_custom_instructions', e.target.value)}
            placeholder="Permanent notes for technicians…"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button
          onClick={() => onSubmit({
            label: form.label.trim(),
            location_id: form.location_id,
            service_id: form.service_id || templates[0]?.id || 0,
            estimated_labor_hours: parseFloat(form.estimated_labor_hours) || 1,
            frequency_months: parseInt(form.frequency_months) || 3,
            date_next_due: form.date_next_due,
            date_last_done: form.date_last_done || null,
            permanent_custom_instructions: form.permanent_custom_instructions || null,
          })}
          disabled={!canSubmit || loading}
        >
          {loading ? 'Saving…' : 'Add Service'}
        </Button>
      </div>
    </div>
  )
}

// ─── Asset list (shared between sublocation sections) ─────────────────────────

function AssetList({ assets, sublocations, templates, readOnly, onUpdate, onDelete }: {
  assets: Asset[]
  sublocations: SiteLocation[]
  templates: ServiceTemplate[]
  readOnly?: boolean
  onUpdate: (id: number, data: Partial<Asset>) => void
  onDelete: (id: number) => void
}) {
  const [expandedAssets, setExpandedAssets] = useState<Set<number>>(new Set())
  const [editAsset, setEditAsset] = useState<Asset | null>(null)
  const [editCatchAllLabel, setEditCatchAllLabel] = useState('')

  function toggleAsset(id: number) {
    setExpandedAssets((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const regularAssets = assets.filter((a) => !a.is_catch_all)
  const catchAllAssets = assets.filter((a) => a.is_catch_all)

  return (
    <>
      {/* Regular tracked assets */}
      {regularAssets.map((a) => (
        <div key={a.id} className="border-b border-gray-100 last:border-0">
          <div className="flex items-center justify-between px-5 py-2 hover:bg-gray-50 cursor-pointer" onClick={() => toggleAsset(a.id)}>
            <div className="flex items-center gap-2 text-sm">
              {expandedAssets.has(a.id) ? <ChevronDown className="h-3.5 w-3.5 text-gray-400" /> : <ChevronRight className="h-3.5 w-3.5 text-gray-400" />}
              <span className="font-medium text-gray-700">{a.asset_name}</span>
              {a.serial_number && <span className="text-xs text-gray-400">S/N: {a.serial_number}</span>}
              {a.model_number && <span className="text-xs text-gray-400">· {a.model_number}</span>}
            </div>
            {!readOnly && (
              <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="sm" onClick={() => setEditAsset(a)}><Pencil className="h-3 w-3" /></Button>
                <Button variant="ghost" size="sm" onClick={() => onDelete(a.id)} className="text-red-500 hover:text-red-700"><Trash2 className="h-3 w-3" /></Button>
              </div>
            )}
          </div>
          {expandedAssets.has(a.id) && <ScheduleSection assetId={a.id} templates={templates} readOnly={readOnly} />}
        </div>
      ))}

      {/* Catch-all / location-wide services */}
      {catchAllAssets.map((a) => (
        <div key={a.id} className="border-b border-amber-100 last:border-0 bg-amber-50">
          <div className="flex items-center justify-between px-5 py-2">
            <div className="flex items-center gap-2 text-sm">
              <ClipboardList className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              <span className="font-medium text-amber-800">{a.asset_name}</span>
              <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-medium text-amber-700">Location service</span>
            </div>
            {!readOnly && (
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => { setEditAsset(a); setEditCatchAllLabel(a.asset_name) }}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onDelete(a.id)} className="text-red-500 hover:text-red-700">
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
          <div className="pl-4">
            <ScheduleSection assetId={a.id} templates={templates} readOnly={readOnly} />
          </div>
        </div>
      ))}

      {/* Edit dialog: regular asset */}
      {editAsset && !editAsset.is_catch_all && (
        <Dialog open onOpenChange={(o) => !o && setEditAsset(null)} title="Edit Asset">
          <AssetForm
            initial={editAsset}
            sublocations={sublocations}
            onSubmit={(v) => { onUpdate(editAsset.id, v); setEditAsset(null) }}
            onCancel={() => setEditAsset(null)}
            loading={false}
          />
        </Dialog>
      )}

      {/* Edit dialog: catch-all label only */}
      {editAsset && editAsset.is_catch_all && (
        <Dialog open onOpenChange={(o) => !o && setEditAsset(null)} title="Edit Location Service">
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Description *</Label>
              <Input value={editCatchAllLabel} onChange={(e) => setEditCatchAllLabel(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditAsset(null)}>Cancel</Button>
              <Button
                disabled={!editCatchAllLabel.trim()}
                onClick={() => { onUpdate(editAsset.id, { asset_name: editCatchAllLabel.trim() }); setEditAsset(null) }}
              >
                Save
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </>
  )
}

// ─── Asset section (under site) ───────────────────────────────────────────────

function AssetSection({ site, sm8CompanyUuid, templates, readOnly }: { site: Site; sm8CompanyUuid: string | null; templates: ServiceTemplate[]; readOnly?: boolean }) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [addAssetOpen, setAddAssetOpen] = useState(false)
  const [addAssetLocationId, setAddAssetLocationId] = useState<number | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [expandedLocations, setExpandedLocations] = useState<Set<number>>(new Set())
  const [addLocationOpen, setAddLocationOpen] = useState(false)
  const [editLocation, setEditLocation] = useState<SiteLocation | null>(null)
  const [addCatchAllOpen, setAddCatchAllOpen] = useState(false)
  const [addCatchAllLocationId, setAddCatchAllLocationId] = useState<number | null>(null)

  const { data: assets = [] } = useQuery({
    queryKey: ['assets', site.id],
    queryFn: () => assetsApi.list(site.id),
  })

  const { data: locations = [] } = useQuery({
    queryKey: ['site-locations', site.id],
    queryFn: () => siteLocationsApi.list(site.id),
  })

  const createAsset = useMutation({
    mutationFn: (v: Partial<Asset> & { location_id?: number | null }) =>
      assetsApi.create({ site_id: site.id, asset_name: v.asset_name!, serial_number: v.serial_number ?? null, model_number: v.model_number ?? null, location_id: v.location_id ?? null, is_catch_all: false }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['assets'] }); setAddAssetOpen(false); toast('Asset added') },
    onError: () => toast('Failed to add asset', 'error'),
  })

  const createCatchAllService = useMutation({
    mutationFn: async (v: CatchAllSubmitValues) => {
      const asset = await assetsApi.create({
        site_id: site.id,
        location_id: v.location_id,
        asset_name: v.label,
        serial_number: null,
        model_number: null,
        is_catch_all: true,
      })
      await schedulesApi.create({
        asset_id: asset.id,
        service_id: v.service_id,
        estimated_labor_hours: v.estimated_labor_hours,
        frequency_months: v.frequency_months,
        date_next_due: v.date_next_due,
        date_last_done: v.date_last_done,
        permanent_custom_instructions: v.permanent_custom_instructions,
        sm8_group_tag: null,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assets'] })
      qc.invalidateQueries({ queryKey: ['schedules'] })
      setAddCatchAllOpen(false)
      toast('Location service added')
    },
    onError: () => toast('Failed to add location service', 'error'),
  })

  const updateAsset = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Asset> }) => assetsApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['assets'] }); toast('Asset updated') },
    onError: () => toast('Failed to update asset', 'error'),
  })

  const deleteAsset = useMutation({
    mutationFn: assetsApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assets'] }),
    onError: () => toast('Cannot delete — asset may have linked schedules', 'error'),
  })

  const createLocation = useMutation({
    mutationFn: (name: string) => siteLocationsApi.create({ site_id: site.id, name }),
    onSuccess: (loc) => {
      qc.invalidateQueries({ queryKey: ['site-locations', site.id] })
      setAddLocationOpen(false)
      setExpandedLocations((prev) => new Set([...prev, loc.id]))
      toast('Sublocation added')
    },
    onError: () => toast('Failed to add sublocation', 'error'),
  })

  const updateLocation = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => siteLocationsApi.update(id, { name }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['site-locations', site.id] }); setEditLocation(null); toast('Sublocation updated') },
    onError: () => toast('Failed to update sublocation', 'error'),
  })

  const deleteLocation = useMutation({
    mutationFn: siteLocationsApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['site-locations', site.id] }),
    onError: () => toast('Cannot delete — sublocation may have linked assets', 'error'),
  })

  function toggleLocation(id: number) {
    setExpandedLocations((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  function openAddAsset(locationId: number | null = null) {
    setAddAssetLocationId(locationId)
    setAddAssetOpen(true)
  }

  function openAddCatchAll(locationId: number | null = null) {
    setAddCatchAllLocationId(locationId)
    setAddCatchAllOpen(true)
  }

  const unassignedAssets = assets.filter((a) => a.location_id == null)
  const locationAssets = (locId: number) => assets.filter((a) => a.location_id === locId)

  return (
    <div className="bg-white">
      {/* Sublocations */}
      {locations.map((loc) => {
        const locAssets = locationAssets(loc.id)
        const expanded = expandedLocations.has(loc.id)
        return (
          <div key={loc.id} className="border-b border-gray-100 last:border-0">
            <div
              className="flex items-center justify-between px-5 py-2 bg-indigo-50 hover:bg-indigo-100 cursor-pointer transition-colors"
              onClick={() => toggleLocation(loc.id)}
            >
              <div className="flex items-center gap-2 text-sm">
                {expanded ? <ChevronDown className="h-3.5 w-3.5 text-indigo-400" /> : <ChevronRight className="h-3.5 w-3.5 text-indigo-400" />}
                <MapPin className="h-3.5 w-3.5 text-indigo-400" />
                <span className="font-medium text-indigo-700">{loc.name}</span>
                <span className="text-xs text-indigo-400">{locAssets.length} asset{locAssets.length !== 1 ? 's' : ''}</span>
              </div>
              {!readOnly && (
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="sm" onClick={() => openAddAsset(loc.id)} title="Add asset to this sublocation">
                    <Plus className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-amber-600 hover:bg-amber-50 hover:text-amber-800" onClick={() => openAddCatchAll(loc.id)}>
                    <ClipboardList className="h-3 w-3" />Add Service
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditLocation(loc)}><Pencil className="h-3 w-3" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => deleteLocation.mutate(loc.id)} className="text-red-500 hover:text-red-700"><Trash2 className="h-3 w-3" /></Button>
                </div>
              )}
            </div>
            {expanded && (
              <div className="pl-4">
                {locAssets.length === 0 && <p className="px-5 py-2 text-xs text-gray-400">No assets in this sublocation.</p>}
                <AssetList
                  assets={locAssets}
                  sublocations={locations}
                  templates={templates}
                  readOnly={readOnly}
                  onUpdate={(id, data) => updateAsset.mutate({ id, data })}
                  onDelete={(id) => deleteAsset.mutate(id)}
                />
              </div>
            )}
          </div>
        )
      })}

      {/* Unassigned assets */}
      {(unassignedAssets.length > 0 || locations.length === 0) && (
        <div>
          {locations.length > 0 && (
            <div className="px-5 py-1.5 bg-gray-50 border-b border-gray-100">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Unassigned</span>
            </div>
          )}
          {unassignedAssets.length === 0 && locations.length === 0 && (
            <p className="px-5 py-2 text-xs text-gray-400">No assets. Import from ServiceM8 or add manually.</p>
          )}
          <AssetList
            assets={unassignedAssets}
            sublocations={locations}
            templates={templates}
            readOnly={readOnly}
            onUpdate={(id, data) => updateAsset.mutate({ id, data })}
            onDelete={(id) => deleteAsset.mutate(id)}
          />
        </div>
      )}

      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2 px-5 py-2 border-t border-gray-100">
          <Button variant="outline" size="sm" onClick={() => openAddAsset(null)}>
            <Plus className="h-3.5 w-3.5" />Add Asset
          </Button>
          <Button size="sm" className="bg-amber-500 text-white hover:bg-amber-600" onClick={() => openAddCatchAll(null)}>
            <ClipboardList className="h-3.5 w-3.5" />Add Location Service
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAddLocationOpen(true)}>
            <MapPin className="h-3.5 w-3.5" />Add Sublocation
          </Button>
          {sm8CompanyUuid && (
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Download className="h-3.5 w-3.5" />Import from SM8
            </Button>
          )}
        </div>
      )}

      <Dialog open={addAssetOpen} onOpenChange={(o) => !o && setAddAssetOpen(false)} title="Add Asset">
        <AssetForm
          initial={addAssetLocationId != null ? { location_id: addAssetLocationId } : undefined}
          sublocations={locations}
          onSubmit={(v) => createAsset.mutate(v)}
          onCancel={() => setAddAssetOpen(false)}
          loading={createAsset.isPending}
        />
      </Dialog>

      <Dialog open={addLocationOpen} onOpenChange={(o) => !o && setAddLocationOpen(false)} title="Add Sublocation">
        <SublocationForm onSubmit={(name) => createLocation.mutate(name)} onCancel={() => setAddLocationOpen(false)} loading={createLocation.isPending} />
      </Dialog>

      {editLocation && (
        <Dialog open onOpenChange={(o) => !o && setEditLocation(null)} title="Edit Sublocation">
          <SublocationForm
            initial={editLocation}
            onSubmit={(name) => updateLocation.mutate({ id: editLocation.id, name })}
            onCancel={() => setEditLocation(null)}
            loading={updateLocation.isPending}
          />
        </Dialog>
      )}

      <Dialog open={addCatchAllOpen} onOpenChange={(o) => !o && setAddCatchAllOpen(false)} title="Add Location Service">
        <CatchAllServiceForm
          sublocations={locations}
          templates={templates}
          initialLocationId={addCatchAllLocationId}
          onSubmit={(v) => createCatchAllService.mutate(v)}
          onCancel={() => setAddCatchAllOpen(false)}
          loading={createCatchAllService.isPending}
        />
      </Dialog>

      {sm8CompanyUuid && (
        <AssetImportModal site={site} companyUuid={sm8CompanyUuid} existingAssets={assets} open={importOpen} onClose={() => { setImportOpen(false); qc.invalidateQueries({ queryKey: ['assets'] }) }} />
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CustomersPage() {
  const qc = useQueryClient()
  const { toast } = useToast()
  const { user } = useAuth()
  const isWorker = user?.user_role === 'Worker'
  const [search, setSearch] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [expandedCustomer, setExpandedCustomer] = useState<number | null>(null)
  const [expandedSites, setExpandedSites] = useState<Set<number>>(new Set())
  const [createOpen, setCreateOpen] = useState(false)
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null)
  const [addSiteFor, setAddSiteFor] = useState<number | null>(null)
  const [editSite, setEditSite] = useState<Site | null>(null)

  const debouncedSearch = useDebounce(search, 200)

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['customers', debouncedSearch, showAll],
    queryFn: () => customersApi.list(debouncedSearch || undefined, !showAll),
  })

  const { data: sites = [] } = useQuery({
    queryKey: ['sites', expandedCustomer],
    queryFn: () => sitesApi.list(expandedCustomer!),
    enabled: !!expandedCustomer,
  })

  const { data: templates = [] } = useQuery<ServiceTemplate[]>({
    queryKey: ['templates'],
    queryFn: async () => (await apiClient.get('/service-templates')).data,
  })

  const importAllMutation = useMutation({
    mutationFn: servicem8Api.importCustomers,
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ['customers'] }); toast(`SM8 import: ${r.created} created, ${r.updated} updated`) },
    onError: () => toast('Import from ServiceM8 failed', 'error'),
  })

  const createCustomer = useMutation({
    mutationFn: customersApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['customers'] }); setCreateOpen(false); toast('Customer created') },
    onError: () => toast('Failed to create customer', 'error'),
  })

  const updateCustomer = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Customer> }) => customersApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['customers'] }); setEditCustomer(null); toast('Customer updated') },
    onError: () => toast('Failed to update customer', 'error'),
  })

  const deleteCustomer = useMutation({
    mutationFn: customersApi.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['customers'] }); toast('Customer deleted') },
    onError: () => toast('Cannot delete — customer has linked data', 'error'),
  })

  const createSite = useMutation({
    mutationFn: (v: SiteFormValues & { customer_id: number }) => sitesApi.create(v),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sites'] }); setAddSiteFor(null); toast('Site created') },
    onError: () => toast('Failed to create site', 'error'),
  })

  const updateSite = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Site> }) => sitesApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sites'] }); setEditSite(null); toast('Site updated') },
    onError: () => toast('Failed to update site', 'error'),
  })

  const deleteSite = useMutation({
    mutationFn: sitesApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sites'] }),
    onError: () => toast('Cannot delete site — it may have linked assets', 'error'),
  })

  function toggleCustomer(id: number) {
    setExpandedCustomer((prev) => prev === id ? null : id)
    setExpandedSites(new Set())
  }

  function toggleSite(id: number) {
    setExpandedSites((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-5 py-3">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold">PM Schedules</h1>
          <div className="flex rounded-md border border-gray-200 overflow-hidden text-xs font-medium">
            <button className={`px-3 py-1 transition-colors ${!showAll ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`} onClick={() => setShowAll(false)}>Active</button>
            <button className={`px-3 py-1 transition-colors ${showAll ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`} onClick={() => setShowAll(true)}>All</button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <Input className="pl-8 w-48" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {!isWorker && (
            <>
              <Button size="sm" variant="outline" onClick={() => importAllMutation.mutate()} disabled={importAllMutation.isPending}>
                <Download className="h-3.5 w-3.5" />{importAllMutation.isPending ? 'Syncing customers…' : 'Sync customers from SM8'}
              </Button>
              <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="h-3.5 w-3.5" />Add Customer</Button>
            </>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
        {isLoading && <p className="text-sm text-gray-400 text-center py-8">Loading…</p>}
        {!isLoading && customers.length === 0 && !showAll && (
          <p className="text-sm text-gray-400 text-center py-8">
            No active clients with recurring jobs.{' '}
            <button className="text-blue-500 hover:underline" onClick={() => setShowAll(true)}>Show all customers</button>
          </p>
        )}
        <div className="space-y-2">
          {customers.map((c) => (
            <div key={c.id} className="rounded-lg border border-gray-200 bg-white overflow-hidden">
              {/* Customer row */}
              <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => toggleCustomer(c.id)}>
                <div className="flex items-center gap-2">
                  {expandedCustomer === c.id ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-800">{c.company_name}</p>
                      {c.servicem8_uuid && <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600"><Link2 className="h-3 w-3" />SM8</span>}
                    </div>
                    {c.primary_contact && <p className="text-xs text-gray-400">{c.primary_contact}{c.phone && ` · ${c.phone}`}</p>}
                  </div>
                </div>
                {!isWorker && (
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" onClick={() => setEditCustomer(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => deleteCustomer.mutate(c.id)} className="text-red-500 hover:text-red-700"><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                )}
              </div>

              {/* Sites */}
              {expandedCustomer === c.id && (
                <div className="border-t border-gray-100 bg-gray-50">
                  {sites.length === 0 && <p className="px-4 py-2 text-xs text-gray-400">No sites linked.</p>}
                  {sites.map((s) => (
                    <div key={s.id} className="border-b border-gray-100 last:border-0">
                      {/* Site row */}
                      <div className="flex items-center justify-between px-4 py-2 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => toggleSite(s.id)}>
                        <div className="flex items-center gap-2 text-sm">
                          {expandedSites.has(s.id) ? <ChevronDown className="h-3.5 w-3.5 text-gray-400" /> : <ChevronRight className="h-3.5 w-3.5 text-gray-400" />}
                          <div>
                            <p className="font-medium text-gray-700">{s.site_name}</p>
                            <p className="text-xs text-gray-400">{s.site_address}</p>
                            {s.servicem8_client_uuid && <p className="text-xs text-blue-400 flex items-center gap-1"><Link2 className="h-3 w-3" />SM8 linked</p>}
                          </div>
                        </div>
                        {!isWorker && (
                          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="sm" onClick={() => setEditSite(s)}><Pencil className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="sm" onClick={() => deleteSite.mutate(s.id)} className="text-red-500 hover:text-red-700"><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        )}
                      </div>
                      {/* Assets + Schedules */}
                      {expandedSites.has(s.id) && <AssetSection site={s} sm8CompanyUuid={s.servicem8_client_uuid ?? c.servicem8_uuid} templates={templates} readOnly={isWorker} />}
                    </div>
                  ))}
                  {!isWorker && (
                    <div className="px-4 py-2">
                      <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); setAddSiteFor(c.id) }}>
                        <Plus className="h-3.5 w-3.5" />Add Site
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <WorkloadForecastFooter />

      <Dialog open={createOpen} onOpenChange={setCreateOpen} title="New Customer">
        <CustomerForm onSubmit={(d) => createCustomer.mutate(d)} onCancel={() => setCreateOpen(false)} loading={createCustomer.isPending} />
      </Dialog>
      <Dialog open={!!editCustomer} onOpenChange={(o) => !o && setEditCustomer(null)} title="Edit Customer">
        {editCustomer && <CustomerForm initial={editCustomer} onSubmit={(d) => updateCustomer.mutate({ id: editCustomer.id, data: d })} onCancel={() => setEditCustomer(null)} loading={updateCustomer.isPending} />}
      </Dialog>
      <Dialog open={!!addSiteFor} onOpenChange={(o) => !o && setAddSiteFor(null)} title="New Site">
        {addSiteFor && <SiteForm onSubmit={(v) => createSite.mutate({ ...v, customer_id: addSiteFor })} onCancel={() => setAddSiteFor(null)} loading={createSite.isPending} />}
      </Dialog>
      <Dialog open={!!editSite} onOpenChange={(o) => !o && setEditSite(null)} title="Edit Site">
        {editSite && <SiteForm initial={editSite} onSubmit={(v) => updateSite.mutate({ id: editSite.id, data: v })} onCancel={() => setEditSite(null)} loading={updateSite.isPending} />}
      </Dialog>
    </div>
  )
}
