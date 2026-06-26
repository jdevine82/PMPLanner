import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, ChevronRight, Search, X } from 'lucide-react'
import { customersApi } from '@/api/customers'
import { sitesApi } from '@/api/sites'
import { assetsApi } from '@/api/assets'
import { schedulesApi } from '@/api/schedules'
import { templatesApi } from '@/api/templates'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/utils'
import type { Customer, Site, Asset } from '@/types'

type Step = 'customer' | 'site' | 'asset' | 'schedule'

const STEPS: Step[] = ['customer', 'site', 'asset', 'schedule']
const STEP_LABELS: Record<Step, string> = {
  customer: 'Customer',
  site: 'Site',
  asset: 'Asset',
  schedule: 'Schedule',
}

const SELECT_CLASS =
  'block w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function NewProgramWizard({ open, onOpenChange }: Props) {
  const qc = useQueryClient()
  const { toast } = useToast()

  const [step, setStep] = useState<Step>('customer')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [selectedSite, setSelectedSite] = useState<Site | null>(null)
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)

  const [newCustomer, setNewCustomer] = useState(false)
  const [newSite, setNewSite] = useState(false)
  const [newAsset, setNewAsset] = useState(false)

  const [customerSearch, setCustomerSearch] = useState('')
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false)
  const customerSearchRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (customerSearchRef.current && !customerSearchRef.current.contains(e.target as Node)) {
        setCustomerDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const [customerForm, setCustomerForm] = useState({ company_name: '', primary_contact: '', phone: '', email: '' })
  const [siteForm, setSiteForm] = useState({ site_name: '', site_address: '' })
  const [assetForm, setAssetForm] = useState({ asset_name: '', serial_number: '', model_number: '' })
  const today = new Date().toISOString().split('T')[0]
  const [scheduleForm, setScheduleForm] = useState({
    service_id: 0,
    estimated_labor_hours: '1',
    frequency_months: '3',
    date_next_due: today,
    date_last_done: '',
    permanent_custom_instructions: '',
  })

  const { data: customers = [] } = useQuery({
    queryKey: ['customers', 'all'],
    queryFn: () => customersApi.list(),
    staleTime: 0,
    enabled: open,
  })

  const { data: sites = [] } = useQuery({
    queryKey: ['sites', selectedCustomer?.id],
    queryFn: () => sitesApi.list(selectedCustomer!.id),
    enabled: !!selectedCustomer,
  })

  const { data: assets = [] } = useQuery({
    queryKey: ['assets', selectedSite?.id],
    queryFn: () => assetsApi.list(selectedSite!.id),
    enabled: !!selectedSite,
  })

  const { data: templates = [] } = useQuery({
    queryKey: ['templates'],
    queryFn: templatesApi.list,
    enabled: open,
  })

  const createCustomer = useMutation({
    mutationFn: customersApi.create,
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ['customers'] })
      setSelectedCustomer(c)
      setNewCustomer(false)
      setStep('site')
    },
    onError: () => toast('Failed to create customer', 'error'),
  })

  const createSite = useMutation({
    mutationFn: sitesApi.create,
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: ['sites', selectedCustomer?.id] })
      setSelectedSite(s)
      setNewSite(false)
      setStep('asset')
    },
    onError: () => toast('Failed to create site', 'error'),
  })

  const createAsset = useMutation({
    mutationFn: assetsApi.create,
    onSuccess: (a) => {
      qc.invalidateQueries({ queryKey: ['assets', selectedSite?.id] })
      setSelectedAsset(a)
      setNewAsset(false)
      setStep('schedule')
    },
    onError: () => toast('Failed to create asset', 'error'),
  })

  const createSchedule = useMutation({
    mutationFn: schedulesApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedules'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      toast('Maintenance program created!')
      handleClose()
    },
    onError: () => toast('Failed to create schedule', 'error'),
  })

  function resetState() {
    setStep('customer')
    setSelectedCustomer(null)
    setSelectedSite(null)
    setSelectedAsset(null)
    setNewCustomer(false)
    setNewSite(false)
    setNewAsset(false)
    setCustomerSearch('')
    setCustomerDropdownOpen(false)
    setCustomerForm({ company_name: '', primary_contact: '', phone: '', email: '' })
    setSiteForm({ site_name: '', site_address: '' })
    setAssetForm({ asset_name: '', serial_number: '', model_number: '' })
    setScheduleForm({ service_id: 0, estimated_labor_hours: '1', frequency_months: '3', date_next_due: today, date_last_done: '', permanent_custom_instructions: '' })
  }

  function handleClose() {
    onOpenChange(false)
    setTimeout(resetState, 300)
  }

  const currentIdx = STEPS.indexOf(step)

  function handleCustomerNext() {
    if (newCustomer) {
      createCustomer.mutate({
        company_name: customerForm.company_name,
        primary_contact: customerForm.primary_contact || null,
        phone: customerForm.phone || null,
        email: customerForm.email || null,
        servicem8_uuid: null,
      })
    } else if (selectedCustomer) {
      setStep('site')
    }
  }

  function handleSiteNext() {
    if (newSite) {
      createSite.mutate({
        site_name: siteForm.site_name,
        site_address: siteForm.site_address,
        customer_id: selectedCustomer!.id,
        servicem8_client_uuid: null,
      })
    } else if (selectedSite) {
      setStep('asset')
    }
  }

  function handleAssetNext() {
    if (newAsset) {
      createAsset.mutate({
        site_id: selectedSite!.id,
        asset_name: assetForm.asset_name,
        serial_number: assetForm.serial_number || null,
        model_number: assetForm.model_number || null,
      })
    } else if (selectedAsset) {
      setStep('schedule')
    }
  }

  function handleScheduleSubmit() {
    if (!selectedAsset) return
    const serviceId = scheduleForm.service_id || templates[0]?.id || 0
    createSchedule.mutate({
      asset_id: selectedAsset.id,
      service_id: serviceId,
      estimated_labor_hours: parseFloat(scheduleForm.estimated_labor_hours) || 1,
      frequency_months: parseInt(scheduleForm.frequency_months) || 3,
      date_next_due: scheduleForm.date_next_due,
      date_last_done: scheduleForm.date_last_done || null,
      permanent_custom_instructions: scheduleForm.permanent_custom_instructions || null,
      sm8_group_tag: null,
    })
  }

  const effectiveServiceId = scheduleForm.service_id || templates[0]?.id || 0

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && handleClose()}
      title="New Maintenance Program"
      description="Set up a complete maintenance schedule in one place."
      className="max-w-xl"
    >
      {/* Stepper */}
      <div className="flex items-center mb-6">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center">
            <button
              onClick={() => i < currentIdx && setStep(s)}
              disabled={i >= currentIdx}
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold transition-colors',
                i < currentIdx
                  ? 'bg-green-500 text-white hover:bg-green-600 cursor-pointer'
                  : i === currentIdx
                  ? 'bg-blue-600 text-white cursor-default'
                  : 'bg-gray-200 text-gray-400 cursor-default',
              )}
            >
              {i < currentIdx ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
            </button>
            <span
              className={cn(
                'ml-1.5 text-xs font-medium',
                i === currentIdx ? 'text-gray-800' : i < currentIdx ? 'text-green-600' : 'text-gray-400',
              )}
            >
              {STEP_LABELS[s]}
            </span>
            {i < STEPS.length - 1 && <ChevronRight className="h-3.5 w-3.5 text-gray-300 mx-2" />}
          </div>
        ))}
      </div>

      {/* Step 1 — Customer */}
      {step === 'customer' && (
        <div className="space-y-4">
          {!newCustomer ? (
            <>
              <div className="space-y-1">
                <Label>Select existing customer *</Label>
                {selectedCustomer ? (
                  <div className="flex items-center justify-between rounded-md border border-blue-300 bg-blue-50 px-3 py-2 text-sm">
                    <span className="font-medium text-blue-800">{selectedCustomer.company_name}</span>
                    <button
                      type="button"
                      onClick={() => { setSelectedCustomer(null); setCustomerSearch('') }}
                      className="text-blue-400 hover:text-blue-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div ref={customerSearchRef} className="relative">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <input
                      value={customerSearch}
                      onChange={(e) => { setCustomerSearch(e.target.value); setCustomerDropdownOpen(true) }}
                      onFocus={() => setCustomerDropdownOpen(true)}
                      placeholder="Search customers…"
                      className="block w-full rounded-md border border-gray-300 bg-white pl-8 pr-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    {customerDropdownOpen && (
                      <div className="absolute z-50 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg max-h-52 overflow-y-auto">
                        {customers
                          .filter((c) => c.company_name.toLowerCase().includes(customerSearch.toLowerCase()))
                          .map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => { setSelectedCustomer(c); setCustomerSearch(''); setCustomerDropdownOpen(false) }}
                              className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-blue-50 text-sm border-b border-gray-100 last:border-0"
                            >
                              <span className="font-medium text-gray-800">{c.company_name}</span>
                              {c.primary_contact && <span className="text-xs text-gray-400">{c.primary_contact}{c.phone ? ` · ${c.phone}` : ''}</span>}
                            </button>
                          ))}
                        {customers.filter((c) => c.company_name.toLowerCase().includes(customerSearch.toLowerCase())).length === 0 && (
                          <p className="px-3 py-2 text-sm text-gray-400">No customers found for "{customerSearch}"</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <button type="button" className="text-sm text-blue-600 hover:underline" onClick={() => { setNewCustomer(true); setSelectedCustomer(null); setCustomerSearch('') }}>
                + Create new customer instead
              </button>
            </>
          ) : (
            <>
              <div className="rounded-md bg-blue-50 border border-blue-100 px-3 py-2 text-sm font-medium text-blue-700">New Customer</div>
              {(['company_name', 'primary_contact', 'phone', 'email'] as const).map((k) => (
                <div key={k} className="space-y-1">
                  <Label>{k === 'company_name' ? 'Company Name *' : k === 'primary_contact' ? 'Primary Contact' : k === 'phone' ? 'Phone' : 'Email'}</Label>
                  <Input value={customerForm[k]} onChange={(e) => setCustomerForm((p) => ({ ...p, [k]: e.target.value }))} />
                </div>
              ))}
              <button type="button" className="text-sm text-gray-500 hover:underline" onClick={() => setNewCustomer(false)}>
                Back to existing customers
              </button>
            </>
          )}
          <div className="flex justify-end pt-2">
            <Button
              onClick={handleCustomerNext}
              disabled={
                createCustomer.isPending ||
                (newCustomer && !customerForm.company_name) ||
                (!newCustomer && !selectedCustomer)
              }
            >
              {createCustomer.isPending ? 'Creating…' : 'Next'}
            </Button>
          </div>
        </div>
      )}

      {/* Step 2 — Site */}
      {step === 'site' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">Customer: <span className="font-medium text-gray-800">{selectedCustomer?.company_name}</span></p>
          {!newSite ? (
            <>
              <div className="space-y-1">
                <Label>Select existing site *</Label>
                <select
                  className={SELECT_CLASS}
                  value={selectedSite?.id ?? ''}
                  onChange={(e) => setSelectedSite(sites.find((s) => s.id === Number(e.target.value)) ?? null)}
                >
                  <option value="">— choose site —</option>
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>{s.site_name} — {s.site_address}</option>
                  ))}
                </select>
                {sites.length === 0 && <p className="text-xs text-gray-400 mt-1">No sites yet — create one below.</p>}
              </div>
              <button type="button" className="text-sm text-blue-600 hover:underline" onClick={() => { setNewSite(true); setSelectedSite(null) }}>
                + Create new site instead
              </button>
            </>
          ) : (
            <>
              <div className="rounded-md bg-blue-50 border border-blue-100 px-3 py-2 text-sm font-medium text-blue-700">New Site</div>
              <div className="space-y-1"><Label>Site Name *</Label><Input value={siteForm.site_name} onChange={(e) => setSiteForm((p) => ({ ...p, site_name: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Site Address *</Label><Input value={siteForm.site_address} onChange={(e) => setSiteForm((p) => ({ ...p, site_address: e.target.value }))} /></div>
              <button type="button" className="text-sm text-gray-500 hover:underline" onClick={() => setNewSite(false)}>Back to existing sites</button>
            </>
          )}
          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={() => setStep('customer')}>Back</Button>
            <Button
              onClick={handleSiteNext}
              disabled={
                createSite.isPending ||
                (newSite && (!siteForm.site_name || !siteForm.site_address)) ||
                (!newSite && !selectedSite)
              }
            >
              {createSite.isPending ? 'Creating…' : 'Next'}
            </Button>
          </div>
        </div>
      )}

      {/* Step 3 — Asset */}
      {step === 'asset' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            <span className="font-medium text-gray-800">{selectedCustomer?.company_name}</span>
            {' › '}
            <span className="font-medium text-gray-800">{selectedSite?.site_name}</span>
          </p>
          {!newAsset ? (
            <>
              <div className="space-y-1">
                <Label>Select existing asset *</Label>
                <select
                  className={SELECT_CLASS}
                  value={selectedAsset?.id ?? ''}
                  onChange={(e) => setSelectedAsset(assets.find((a) => a.id === Number(e.target.value)) ?? null)}
                >
                  <option value="">— choose asset —</option>
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>{a.asset_name}{a.serial_number ? ` (S/N: ${a.serial_number})` : ''}</option>
                  ))}
                </select>
                {assets.length === 0 && <p className="text-xs text-gray-400 mt-1">No assets yet — create one below.</p>}
              </div>
              <button type="button" className="text-sm text-blue-600 hover:underline" onClick={() => { setNewAsset(true); setSelectedAsset(null) }}>
                + Create new asset instead
              </button>
            </>
          ) : (
            <>
              <div className="rounded-md bg-blue-50 border border-blue-100 px-3 py-2 text-sm font-medium text-blue-700">New Asset</div>
              {(['asset_name', 'serial_number', 'model_number'] as const).map((k) => (
                <div key={k} className="space-y-1">
                  <Label>{k === 'asset_name' ? 'Asset Name *' : k === 'serial_number' ? 'Serial Number' : 'Model Number'}</Label>
                  <Input value={assetForm[k]} onChange={(e) => setAssetForm((p) => ({ ...p, [k]: e.target.value }))} />
                </div>
              ))}
              <button type="button" className="text-sm text-gray-500 hover:underline" onClick={() => setNewAsset(false)}>Back to existing assets</button>
            </>
          )}
          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={() => setStep('site')}>Back</Button>
            <Button
              onClick={handleAssetNext}
              disabled={
                createAsset.isPending ||
                (newAsset && !assetForm.asset_name) ||
                (!newAsset && !selectedAsset)
              }
            >
              {createAsset.isPending ? 'Creating…' : 'Next'}
            </Button>
          </div>
        </div>
      )}

      {/* Step 4 — Schedule */}
      {step === 'schedule' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            <span className="font-medium text-gray-800">{selectedCustomer?.company_name}</span>
            {' › '}
            <span className="font-medium text-gray-800">{selectedSite?.site_name}</span>
            {' › '}
            <span className="font-medium text-gray-800">{selectedAsset?.asset_name}</span>
          </p>

          {templates.length === 0 ? (
            <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-3 text-sm text-amber-700">
              No services found. Create one in the Services page first.
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <Label>Service *</Label>
                <select
                  className={SELECT_CLASS}
                  value={effectiveServiceId}
                  onChange={(e) => {
                    const id = Number(e.target.value)
                    const tpl = templates.find((t) => t.id === id)
                    setScheduleForm((p) => ({
                      ...p,
                      service_id: id,
                      ...(tpl?.interval_months ? { frequency_months: String(tpl.interval_months) } : {}),
                    }))
                  }}
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}{t.interval_months ? ` (every ${t.interval_months}mo)` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Est. Labor Hours *</Label>
                  <Input
                    type="number" min="0" step="0.25"
                    value={scheduleForm.estimated_labor_hours}
                    onChange={(e) => setScheduleForm((p) => ({ ...p, estimated_labor_hours: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Frequency *</Label>
                  <select
                    className={SELECT_CLASS}
                    value={scheduleForm.frequency_months}
                    onChange={(e) => setScheduleForm((p) => ({ ...p, frequency_months: e.target.value }))}
                  >
                    {[1, 3, 6, 12, 24].map((m) => <option key={m} value={m}>{m} month{m > 1 ? 's' : ''}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Next Due Date *</Label>
                  <Input type="date" value={scheduleForm.date_next_due}
                    onChange={(e) => setScheduleForm((p) => ({ ...p, date_next_due: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Last Done Date</Label>
                  <Input type="date" value={scheduleForm.date_last_done}
                    onChange={(e) => setScheduleForm((p) => ({ ...p, date_last_done: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Custom Instructions</Label>
                <textarea
                  className={SELECT_CLASS}
                  rows={3}
                  value={scheduleForm.permanent_custom_instructions}
                  onChange={(e) => setScheduleForm((p) => ({ ...p, permanent_custom_instructions: e.target.value }))}
                  placeholder="Permanent notes for technicians…"
                />
              </div>
            </>
          )}

          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={() => setStep('asset')}>Back</Button>
            <Button
              onClick={handleScheduleSubmit}
              disabled={!scheduleForm.date_next_due || !effectiveServiceId || createSchedule.isPending || templates.length === 0}
            >
              {createSchedule.isPending ? 'Creating…' : 'Create Maintenance Program'}
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  )
}
