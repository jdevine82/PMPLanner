import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { HardDrive, RefreshCw } from 'lucide-react'
import { apiClient } from '@/api/client'
import { servicem8Api } from '@/api/servicem8'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { useToast } from '@/components/ui/Toast'
import type { AppSetting } from '@/types'

function BackupSection() {
  const { toast } = useToast()
  const [restoreFilename, setRestoreFilename] = useState('')
  const [restoreConfirm, setRestoreConfirm] = useState('')

  const { data: logs = [] } = useQuery<Array<{ id: number; filename: string; file_size_bytes: number; created_at: string }>>({
    queryKey: ['backup-logs'],
    queryFn: async () => (await apiClient.get('/backup/logs')).data,
  })

  const backupMutation = useMutation({
    mutationFn: async () => (await apiClient.post('/backup/create')).data,
    onSuccess: (r) => toast(`Backup created: ${r.filename}`),
    onError: () => toast('Backup failed', 'error'),
  })

  const restoreMutation = useMutation({
    mutationFn: async () => (await apiClient.post('/backup/restore', null, { params: { filename: restoreFilename, confirmation: restoreConfirm } })).data,
    onSuccess: () => { toast('Database restored successfully'); setRestoreFilename(''); setRestoreConfirm('') },
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
              <div key={l.id} className="flex items-center justify-between px-3 py-1.5">
                <span className="font-mono text-gray-700">{l.filename}</span>
                <span className="text-gray-400">{(l.file_size_bytes / 1024 / 1024).toFixed(1)} MB</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="border-t border-gray-100 pt-4 space-y-2">
        <p className="text-xs font-medium text-red-600">Restore — Danger Zone</p>
        <Input placeholder="Backup filename (e.g. pmplanner_backup_20260625_120000.dump)" value={restoreFilename} onChange={(e) => setRestoreFilename(e.target.value)} className="text-xs font-mono" />
        <Input placeholder='Type RESTORE to confirm' value={restoreConfirm} onChange={(e) => setRestoreConfirm(e.target.value)} />
        <Button variant="danger" size="sm" onClick={() => restoreMutation.mutate()} disabled={restoreConfirm !== 'RESTORE' || !restoreFilename || restoreMutation.isPending}>
          {restoreMutation.isPending ? 'Restoring…' : 'Restore Database'}
        </Button>
      </div>
    </section>
  )
}

function ConsolidateSection() {
  const { toast } = useToast()
  const consolidateMutation = useMutation({
    mutationFn: servicem8Api.consolidateHoursSync,
    onSuccess: (r) => toast(`Updated ${r.updated} job(s) with actual labor hours.`),
    onError: () => toast('Consolidation failed', 'error'),
  })
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 space-y-3">
      <h2 className="font-semibold text-gray-800">Labor Hours Consolidation</h2>
      <p className="text-sm text-gray-500">Pull actual hours from completed ServiceM8 jobs and update historical averages on templates.</p>
      <Button variant="outline" onClick={() => consolidateMutation.mutate()} disabled={consolidateMutation.isPending}>
        <RefreshCw className={`h-3.5 w-3.5 ${consolidateMutation.isPending ? 'animate-spin' : ''}`} />
        {consolidateMutation.isPending ? 'Running…' : 'Run Consolidation Now'}
      </Button>
    </section>
  )
}

export default function SettingsPage() {
  const qc = useQueryClient()
  const { toast } = useToast()

  const { data: settings, isLoading } = useQuery<AppSetting>({
    queryKey: ['app-settings'],
    queryFn: async () => (await apiClient.get('/settings/')).data,
  })

  const [form, setForm] = useState({ servicem8_api_key: '', generation_buffer_days: '14' })
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }))

  const saveMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      if (settings) {
        return (await apiClient.patch('/settings/', data)).data
      } else {
        return (await apiClient.post('/settings/', { ...data, file_storage_path: '/opt/pmplanner/uploads' })).data
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['app-settings'] }); toast('Settings saved') },
    onError: () => toast('Failed to save settings', 'error'),
  })

  if (isLoading) return <div className="flex flex-1 items-center justify-center text-gray-400">Loading…</div>

  const current = settings ?? { servicem8_api_key: '', generation_buffer_days: 14 }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="border-b border-gray-200 bg-white px-5 py-3">
        <h1 className="text-base font-semibold">Settings</h1>
      </header>
      <div className="flex-1 overflow-y-auto p-5 scrollbar-thin">
        <div className="max-w-lg space-y-6">

          <section className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
            <h2 className="font-semibold text-gray-800">ServiceM8 Integration</h2>
            <div className="space-y-1">
              <Label>API Key</Label>
              <Input
                type="password"
                placeholder={settings?.servicem8_api_key ? '••••••••••••' : 'Paste your ServiceM8 API key'}
                value={form.servicem8_api_key}
                onChange={(e) => set('servicem8_api_key', e.target.value)}
              />
              <p className="text-xs text-gray-400">Generate in ServiceM8 → Settings → API Keys</p>
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
            <Button
              onClick={() => saveMutation.mutate({
                ...(form.servicem8_api_key ? { servicem8_api_key: form.servicem8_api_key } : {}),
                generation_buffer_days: parseInt(form.generation_buffer_days),
              })}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? 'Saving…' : 'Save Settings'}
            </Button>
          </section>

          <BackupSection />

          <ConsolidateSection />

        </div>
      </div>
    </div>
  )
}
