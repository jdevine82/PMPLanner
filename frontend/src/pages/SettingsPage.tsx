import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { CheckCircle, Download, HardDrive, RefreshCw, Send, Upload, X } from 'lucide-react'
import { apiClient } from '@/api/client'
import { servicem8Api } from '@/api/servicem8'
import { assettrackerApi } from '@/api/assettracker'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { useToast } from '@/components/ui/Toast'
import type { AppSetting } from '@/types'

async function triggerDownload(filename: string) {
  const response = await apiClient.get(`/backup/download/${filename}`, { responseType: 'blob' })
  const url = URL.createObjectURL(response.data)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function BackupSection() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [restoreFilename, setRestoreFilename] = useState('')
  const [restoreConfirm, setRestoreConfirm] = useState('')
  const uploadRef = useRef<HTMLInputElement>(null)

  const { data: logs = [] } = useQuery<Array<{ id: number; filename: string; file_size_bytes: number; created_at: string }>>({
    queryKey: ['backup-logs'],
    queryFn: async () => (await apiClient.get('/backup/logs')).data,
  })

  const backupMutation = useMutation({
    mutationFn: async () => (await apiClient.post('/backup/create')).data,
    onSuccess: (r) => { toast(`Backup created: ${r.filename}`); triggerDownload(r.filename); qc.invalidateQueries({ queryKey: ['backup-logs'] }) },
    onError: () => toast('Backup failed', 'error'),
  })

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData()
      fd.append('file', file)
      return (await apiClient.post('/backup/upload', fd)).data
    },
    onSuccess: (r) => { toast(`Uploaded: ${r.filename}`); setRestoreFilename(r.filename); qc.invalidateQueries({ queryKey: ['backup-logs'] }) },
    onError: () => toast('Upload failed', 'error'),
  })

  const restoreMutation = useMutation({
    mutationFn: async () => (await apiClient.post('/backup/restore', null, { params: { filename: restoreFilename, confirmation: restoreConfirm } })).data,
    onSuccess: () => {
      toast('Database restored — reloading app…')
      setRestoreFilename('')
      setRestoreConfirm('')
      // Force a full page reload so the app reconnects cleanly to the restored DB.
      // All cached state is stale and auth tokens from the restored DB may differ.
      setTimeout(() => window.location.reload(), 1500)
    },
    onError: (e: any) => toast(e?.response?.data?.detail ?? 'Restore failed', 'error'),
  })

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
      <h2 className="font-semibold text-gray-800">Database Backup & Restore</h2>
      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={() => backupMutation.mutate()} disabled={backupMutation.isPending}>
          <HardDrive className="h-3.5 w-3.5" />
          {backupMutation.isPending ? 'Running pg_dump…' : 'Create Backup Now'}
        </Button>
      </div>
      {logs.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Recent Backups</p>
          <div className="rounded border border-gray-200 divide-y divide-gray-100 max-h-36 overflow-y-auto text-xs">
            {logs.map((l) => (
              <div key={l.id} className={`flex items-center justify-between px-3 py-1.5 ${restoreFilename === l.filename ? 'bg-amber-50' : ''}`}>
                <span className="font-mono text-gray-700">{l.filename}</span>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">{(l.file_size_bytes / 1024 / 1024).toFixed(1)} MB</span>
                  <button onClick={() => triggerDownload(l.filename)} className="text-gray-400 hover:text-blue-600 transition-colors" title="Download">
                    <Download className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => setRestoreFilename(l.filename)} className="text-gray-400 hover:text-amber-600 transition-colors" title="Select for restore">
                    <Upload className="h-3.5 w-3.5 rotate-180" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="border-t border-gray-100 pt-4 space-y-2">
        <p className="text-xs font-medium text-red-600">Restore — Danger Zone</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => uploadRef.current?.click()}
            className="flex items-center gap-1.5 rounded border border-dashed border-gray-300 px-3 py-1.5 text-xs text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
          >
            <Upload className="h-3.5 w-3.5" />
            {uploadMutation.isPending ? 'Uploading…' : 'Upload .dump file'}
          </button>
          {restoreFilename && (
            <div className="flex items-center gap-1 rounded bg-amber-50 border border-amber-200 px-2 py-1 text-xs font-mono text-amber-800">
              {restoreFilename}
              <button onClick={() => setRestoreFilename('')} className="ml-1 text-amber-400 hover:text-amber-700"><X className="h-3 w-3" /></button>
            </div>
          )}
        </div>
        <input ref={uploadRef} type="file" accept=".dump" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadMutation.mutate(f); e.target.value = '' }} />
        {!restoreFilename && (
          <p className="text-xs text-gray-400">Upload a .dump file above, or select one from the list</p>
        )}
        <Input placeholder='Type RESTORE to confirm' value={restoreConfirm} onChange={(e) => setRestoreConfirm(e.target.value)} disabled={!restoreFilename} />
        <Button variant="danger" size="sm" onClick={() => restoreMutation.mutate()} disabled={restoreConfirm !== 'RESTORE' || !restoreFilename || restoreMutation.isPending}>
          {restoreMutation.isPending ? 'Restoring…' : 'Restore Database'}
        </Button>
      </div>
    </section>
  )
}

function ConsolidateSection() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const consolidateMutation = useMutation({
    mutationFn: servicem8Api.consolidateHoursSync,
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['schedule-history'] })
      if (r.failed > 0) {
        toast(`Updated ${r.updated} job(s). ${r.failed} failed — check SM8 API key permissions.`, 'error')
      } else if (r.updated === 0) {
        toast('No completed SM8 jobs found to pull. Jobs must be dispatched and marked Completed in ServiceM8 first.')
      } else {
        toast(`Updated ${r.updated} job(s) with actual labor hours.`)
      }
    },
    onError: (e: any) => toast(e?.response?.data?.detail ?? 'Consolidation failed — check the SM8 API key.', 'error'),
  })
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 space-y-3">
      <h2 className="font-semibold text-gray-800">Labor Hours Consolidation</h2>
      <p className="text-sm text-gray-500">Pull actual hours from completed ServiceM8 jobs and update historical averages on services.</p>
      <Button variant="outline" onClick={() => consolidateMutation.mutate()} disabled={consolidateMutation.isPending}>
        <RefreshCw className={`h-3.5 w-3.5 ${consolidateMutation.isPending ? 'animate-spin' : ''}`} />
        {consolidateMutation.isPending ? 'Running…' : 'Run Consolidation Now'}
      </Button>
    </section>
  )
}

function AssetTrackerSection({ settings }: { settings: AppSetting | undefined }) {
  const { toast } = useToast()
  const qc = useQueryClient()

  const [form, setForm] = useState({
    assettracker_enabled: settings?.assettracker_enabled ?? false,
    assettracker_base_url: settings?.assettracker_base_url ?? '',
    assettracker_email: settings?.assettracker_email ?? '',
    assettracker_password: '',
    assettracker_default_asset_id: settings?.assettracker_default_asset_id?.toString() ?? '',
  })
  const set = (k: string, v: string | boolean) => setForm((p) => ({ ...p, [k]: v }))

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        assettracker_enabled: form.assettracker_enabled,
        assettracker_base_url: form.assettracker_base_url || null,
        assettracker_email: form.assettracker_email || null,
        assettracker_default_asset_id: form.assettracker_default_asset_id
          ? parseInt(form.assettracker_default_asset_id)
          : null,
      }
      if (form.assettracker_password) {
        payload.assettracker_password = form.assettracker_password
      }
      return (await apiClient.patch('/settings', payload)).data
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['app-settings'] }); toast('AssetTracker settings saved') },
    onError: () => toast('Failed to save AssetTracker settings', 'error'),
  })

  const testMutation = useMutation({
    mutationFn: assettrackerApi.testConnection,
    onSuccess: (r) => toast(`Connected as ${(r.user as any)?.full_name ?? (r.user as any)?.email ?? 'unknown'}`),
    onError: (e: any) => toast(e?.response?.data?.detail ?? 'Connection test failed', 'error'),
  })

  const dispatchMutation = useMutation({
    mutationFn: assettrackerApi.dispatchSync,
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['jobs'] })
      if (r.message) {
        toast(r.message)
      } else if (r.failed > 0) {
        toast(`Dispatched ${r.dispatched} job(s). ${r.failed} failed — check AssetTracker settings.`, 'error')
      } else if (r.dispatched === 0) {
        toast('No approved jobs to dispatch. Jobs must be Approved and Unsynced first.')
      } else {
        toast(`Dispatched ${r.dispatched} job(s) to AssetTracker.`)
      }
    },
    onError: (e: any) => toast(e?.response?.data?.detail ?? 'Dispatch failed', 'error'),
  })

  const pullMutation = useMutation({
    mutationFn: assettrackerApi.pullCompletedSync,
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['jobs'] })
      if (r.message) {
        toast(r.message)
      } else if (r.updated === 0) {
        toast('No completed AssetTracker work orders found to pull.')
      } else {
        toast(`Updated ${r.updated} job(s) from AssetTracker.`)
      }
    },
    onError: (e: any) => toast(e?.response?.data?.detail ?? 'Pull failed', 'error'),
  })

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-800">AssetTracker Integration</h2>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            checked={form.assettracker_enabled}
            onChange={(e) => set('assettracker_enabled', e.target.checked)}
          />
          <span className="text-sm text-gray-600">Enabled</span>
        </label>
      </div>

      <div className="space-y-1">
        <Label>AssetTracker URL</Label>
        <Input
          placeholder="http://10.0.30.29:8001"
          value={form.assettracker_base_url}
          onChange={(e) => set('assettracker_base_url', e.target.value)}
        />
        <p className="text-xs text-gray-400">Base URL of the AssetTracker API (no trailing slash)</p>
      </div>

      <div className="space-y-1">
        <Label>Service Account Email</Label>
        <Input
          type="email"
          placeholder="admin@b2bassets.com"
          value={form.assettracker_email}
          onChange={(e) => set('assettracker_email', e.target.value)}
        />
      </div>

      <div className="space-y-1">
        <Label>Service Account Password</Label>
        <Input
          type="password"
          placeholder={settings?.assettracker_email ? '••••••••' : 'Enter password'}
          value={form.assettracker_password}
          onChange={(e) => set('assettracker_password', e.target.value)}
        />
        <p className="text-xs text-gray-400">Leave blank to keep existing password</p>
      </div>

      <div className="space-y-1">
        <Label>Default Asset ID</Label>
        <Input
          type="number"
          min={1}
          placeholder="e.g. 42"
          value={form.assettracker_default_asset_id}
          onChange={(e) => set('assettracker_default_asset_id', e.target.value)}
          className="w-32"
        />
        <p className="text-xs text-gray-400">The AssetTracker asset ID to link work orders to (use a catch-all PM asset)</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} variant="outline">
          {saveMutation.isPending ? 'Saving…' : 'Save Settings'}
        </Button>
        <Button
          onClick={() => testMutation.mutate()}
          disabled={testMutation.isPending || !settings?.assettracker_base_url}
          variant="outline"
        >
          <CheckCircle className="h-3.5 w-3.5" />
          {testMutation.isPending ? 'Testing…' : 'Test Connection'}
        </Button>
      </div>

      {settings?.assettracker_enabled && (
        <div className="border-t border-gray-100 pt-4 space-y-3">
          <p className="text-xs font-medium text-gray-600">Actions</p>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => dispatchMutation.mutate()}
              disabled={dispatchMutation.isPending}
              variant="outline"
            >
              <Send className="h-3.5 w-3.5" />
              {dispatchMutation.isPending ? 'Dispatching…' : 'Dispatch Approved Jobs'}
            </Button>
            <Button
              onClick={() => pullMutation.mutate()}
              disabled={pullMutation.isPending}
              variant="outline"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${pullMutation.isPending ? 'animate-spin' : ''}`} />
              {pullMutation.isPending ? 'Pulling…' : 'Pull Completed Work Orders'}
            </Button>
          </div>
          <p className="text-xs text-gray-400">
            Dispatch sends Approved+Unsynced jobs to AssetTracker as work orders.
            Pull updates PMPlanner when those work orders are marked completed.
          </p>
        </div>
      )}
    </section>
  )
}

export default function SettingsPage() {
  const qc = useQueryClient()
  const { toast } = useToast()

  const { data: settings, isLoading } = useQuery<AppSetting>({
    queryKey: ['app-settings'],
    queryFn: async () => (await apiClient.get('/settings')).data,
  })

  const [form, setForm] = useState({ servicem8_api_key: '', generation_buffer_days: '14', monthly_capacity_hours: '0', business_name: '' })
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }))
  const logoInputRef = useRef<HTMLInputElement>(null)

  const logoUploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData()
      fd.append('file', file)
      return (await apiClient.post('/settings/logo', fd)).data
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['app-settings'] }); toast('Logo updated') },
    onError: () => toast('Logo upload failed', 'error'),
  })

  const logoDeleteMutation = useMutation({
    mutationFn: async () => (await apiClient.delete('/settings/logo')).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['app-settings'] }); toast('Logo removed') },
    onError: () => toast('Failed to remove logo', 'error'),
  })

  const saveMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      if (settings) {
        return (await apiClient.patch('/settings', data)).data
      } else {
        return (await apiClient.post('/settings', { ...data, file_storage_path: '/opt/pmplanner/uploads' })).data
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['app-settings'] }); toast('Settings saved') },
    onError: () => toast('Failed to save settings', 'error'),
  })

  if (isLoading) return <div className="flex flex-1 items-center justify-center text-gray-400">Loading…</div>

  const current = settings ?? { servicem8_api_key: '', generation_buffer_days: 14, monthly_capacity_hours: 0, business_name: null, logo_filename: null }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="border-b border-gray-200 bg-white px-5 py-3">
        <h1 className="text-base font-semibold">Settings</h1>
      </header>
      <div className="flex-1 overflow-y-auto p-5 scrollbar-thin">
        <div className="max-w-lg space-y-6">

          <section className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
            <h2 className="font-semibold text-gray-800">Branding</h2>
            <div className="space-y-1">
              <Label>Business Name</Label>
              <Input
                placeholder={current.business_name ?? 'Your company name'}
                defaultValue={current.business_name ?? ''}
                onChange={(e) => set('business_name', e.target.value)}
              />
              <p className="text-xs text-gray-400">Shown above the customer name on all reports</p>
            </div>
            <div className="space-y-2">
              <Label>Logo</Label>
              {settings?.logo_filename ? (
                <div className="flex items-center gap-3">
                  <img
                    src={`/uploads/logo/${settings.logo_filename}`}
                    alt="Logo"
                    className="h-14 max-w-[160px] object-contain rounded border border-gray-200 bg-gray-50 p-1"
                  />
                  <div className="flex flex-col gap-1">
                    <Button variant="outline" size="sm" onClick={() => logoInputRef.current?.click()} disabled={logoUploadMutation.isPending}>
                      <Upload className="h-3.5 w-3.5" />Replace
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => logoDeleteMutation.mutate()} disabled={logoDeleteMutation.isPending} className="text-red-500 hover:text-red-700">
                      <X className="h-3.5 w-3.5" />Remove
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-gray-300 px-6 py-6 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors w-full"
                >
                  <Upload className="h-5 w-5" />
                  <span>{logoUploadMutation.isPending ? 'Uploading…' : 'Click to upload logo'}</span>
                  <span className="text-xs text-gray-400">PNG, JPG, or WebP recommended</span>
                </button>
              )}
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) logoUploadMutation.mutate(f); e.target.value = '' }}
              />
            </div>
            <Button
              onClick={() => saveMutation.mutate({ business_name: form.business_name || null })}
              disabled={saveMutation.isPending || (!settings && !form.servicem8_api_key)}
              variant="outline"
            >
              {saveMutation.isPending ? 'Saving…' : 'Save Branding'}
            </Button>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
            <h2 className="font-semibold text-gray-800">ServiceM8 Integration</h2>
            <div className="space-y-1">
              <Label>API Key{!settings && <span className="text-red-500 ml-0.5">*</span>}</Label>
              <Input
                type="password"
                placeholder={settings?.servicem8_api_key ? '••••••••••••' : 'Paste your ServiceM8 API key'}
                value={form.servicem8_api_key}
                onChange={(e) => set('servicem8_api_key', e.target.value)}
              />
              <p className="text-xs text-gray-400">Generate in ServiceM8 → Settings → API Keys</p>
              {!settings && !form.servicem8_api_key && (
                <p className="text-xs text-amber-600">Required for first-time setup — SM8 features won't work without it.</p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Job Generation Buffer (days)</Label>
              <Input
                type="number"
                min={0}
                max={60}
                defaultValue={current.generation_buffer_days}
                onChange={(e) => set('generation_buffer_days', e.target.value)}
                className="w-24"
              />
              <p className="text-xs text-gray-400">How many days ahead to look when generating next month's jobs</p>
            </div>
            <div className="space-y-1">
              <Label>Monthly Capacity (hours)</Label>
              <Input
                type="number"
                min={0}
                defaultValue={current.monthly_capacity_hours}
                onChange={(e) => set('monthly_capacity_hours', e.target.value)}
                className="w-24"
              />
              <p className="text-xs text-gray-400">Total available PM labour hours per month — shown as a gauge on the dashboard</p>
            </div>
            <Button
              onClick={() => saveMutation.mutate({
                ...(form.servicem8_api_key ? { servicem8_api_key: form.servicem8_api_key } : {}),
                generation_buffer_days: parseInt(form.generation_buffer_days),
                monthly_capacity_hours: parseInt(form.monthly_capacity_hours),
              })}
              disabled={saveMutation.isPending || (!settings && !form.servicem8_api_key)}
            >
              {saveMutation.isPending ? 'Saving…' : 'Save Settings'}
            </Button>
          </section>

          <BackupSection />

          <ConsolidateSection />

          <AssetTrackerSection settings={settings} />

        </div>
      </div>
    </div>
  )
}
