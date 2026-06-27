import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/context/AuthContext'
import { Plus, Trash2, FileText, Pencil, Link, Tag, RefreshCw, X } from 'lucide-react'
import { templatesApi } from '@/api/templates'
import { servicem8Api } from '@/api/servicem8'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Dialog } from '@/components/ui/Dialog'
import { useToast } from '@/components/ui/Toast'
import type { ServiceTemplate, TemplateAttachment, SM8Badge } from '@/types'

// ── Attachments editor ────────────────────────────────────────────────────────

function AttachmentsEditor({
  value,
  onChange,
}: {
  value: TemplateAttachment[]
  onChange: (v: TemplateAttachment[]) => void
}) {
  function update(index: number, field: keyof TemplateAttachment, text: string) {
    const next = value.map((a, i) => (i === index ? { ...a, [field]: text } : a))
    onChange(next)
  }
  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index))
  }
  return (
    <div className="space-y-2">
      {value.map((att, i) => (
        <div key={i} className="flex gap-2 items-center">
          <Input
            placeholder="Label (e.g. Site Map)"
            value={att.label}
            onChange={(e) => update(i, 'label', e.target.value)}
            className="w-36 shrink-0"
          />
          <Input
            placeholder="URL"
            value={att.url}
            onChange={(e) => update(i, 'url', e.target.value)}
          />
          <button
            type="button"
            onClick={() => remove(i)}
            className="text-gray-400 hover:text-red-500 transition-colors shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        onClick={() => onChange([...value, { label: '', url: '' }])}
      >
        <Link className="h-3.5 w-3.5" />Add Link
      </Button>
    </div>
  )
}

// ── Badges selector ──────────────────────────────────────────────────────────

function BadgesSelector({
  selected,
  onChange,
}: {
  selected: SM8Badge[]
  onChange: (v: SM8Badge[]) => void
}) {
  const [available, setAvailable] = useState<SM8Badge[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const badges = await servicem8Api.fetchBadges()
      setAvailable(badges)
    } catch {
      setError('Could not load badges from ServiceM8')
    } finally {
      setLoading(false)
    }
  }

  function toggle(badge: SM8Badge) {
    const isSelected = selected.some((b) => b.uuid === badge.uuid)
    if (isSelected) {
      onChange(selected.filter((b) => b.uuid !== badge.uuid))
    } else {
      onChange([...selected, badge])
    }
  }

  const selectedUuids = new Set(selected.map((b) => b.uuid))

  // Merge available + already-selected so selected badges always appear
  const merged = [
    ...selected.filter((b) => !available.some((a) => a.uuid === b.uuid)),
    ...available,
  ]

  return (
    <div className="space-y-2">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((b) => (
            <span
              key={b.uuid}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium text-white bg-indigo-500"
            >
              {b.name}
              <button
                type="button"
                onClick={() => toggle(b)}
                className="ml-0.5 hover:opacity-75"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      {available.length === 0 ? (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Loading…' : 'Load from ServiceM8'}
          </Button>
          {error && <span className="text-xs text-red-500">{error}</span>}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-1 max-h-40 overflow-y-auto rounded-md border border-gray-200 p-2 scrollbar-thin">
          {merged.map((b) => (
            <label key={b.uuid} className="flex items-center gap-2 cursor-pointer text-sm py-0.5">
              <input
                type="checkbox"
                checked={selectedUuids.has(b.uuid)}
                onChange={() => toggle(b)}
                className="rounded"
              />
              <span className="h-3 w-3 rounded-full shrink-0 bg-indigo-500" />
              {b.name}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Create dialog ─────────────────────────────────────────────────────────────

const INTERVAL_OPTIONS = [1, 3, 6, 12, 24]

function CreateDialog({ onClose, loading, onManual }: {
  onClose: () => void
  loading: boolean
  onManual: (title: string, content: string, extras: {
    interval_months: number | null
    default_estimated_labor_hours: number | null
    work_completed: string
    attachments: TemplateAttachment[]
    job_badges: SM8Badge[]
  }) => void
}) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [intervalMonths, setIntervalMonths] = useState<string>('')
  const [defaultHours, setDefaultHours] = useState<string>('')
  const [workCompleted, setWorkCompleted] = useState('')
  const [attachments, setAttachments] = useState<TemplateAttachment[]>([])
  const [badges, setBadges] = useState<SM8Badge[]>([])

  function submit() {
    const interval = intervalMonths ? parseInt(intervalMonths) : null
    const estHours = defaultHours ? parseFloat(defaultHours) : null
    onManual(title, content, {
      interval_months: interval,
      default_estimated_labor_hours: estHours,
      work_completed: workCompleted,
      attachments,
      job_badges: badges,
    })
  }

  const canSubmit = title.trim() && content.trim()

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="title">Service Name *</Label>
        <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. HVAC Quarterly Service" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="interval">Service Interval</Label>
          <select
            id="interval"
            value={intervalMonths}
            onChange={(e) => setIntervalMonths(e.target.value)}
            className="block w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">— not set —</option>
            {INTERVAL_OPTIONS.map((m) => <option key={m} value={m}>{m} month{m > 1 ? 's' : ''}</option>)}
          </select>
          <p className="text-xs text-gray-400">Pre-fills frequency when added to an asset.</p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="default_hours">Default Est. Labor Hours</Label>
          <Input
            id="default_hours"
            type="number"
            min="0"
            step="0.25"
            placeholder="e.g. 2.5"
            value={defaultHours}
            onChange={(e) => setDefaultHours(e.target.value)}
          />
          <p className="text-xs text-gray-400">Pre-fills est. hours when scheduling this service.</p>
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="content">Service Checklist / Instructions *</Label>
        <textarea
          id="content"
          rows={6}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Enter the service checklist, steps, or instructions…"
          className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="work_completed">Work Completed</Label>
        <textarea
          id="work_completed"
          rows={3}
          value={workCompleted}
          onChange={(e) => setWorkCompleted(e.target.value)}
          placeholder="Describe what work is to be completed…"
          className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y"
        />
      </div>
      <div className="space-y-1">
        <Label>Attachments / Map Links</Label>
        <AttachmentsEditor value={attachments} onChange={setAttachments} />
      </div>
      <div className="space-y-1">
        <Label>Job Badges <span className="text-gray-400 font-normal">(SM8)</span></Label>
        <BadgesSelector selected={badges} onChange={setBadges} />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={!canSubmit || loading}>
          {loading ? 'Saving…' : 'Create Service'}
        </Button>
      </div>
    </div>
  )
}

// ── Edit dialog ───────────────────────────────────────────────────────────────

function EditDialog({ template, onClose, loading, onSave }: {
  template: ServiceTemplate
  onClose: () => void
  loading: boolean
  onSave: (data: {
    title: string
    content: string
    interval_months: number | null
    default_estimated_labor_hours: number | null
    work_completed: string
    attachments: TemplateAttachment[]
    job_badges: SM8Badge[]
  }) => void
}) {
  const [title, setTitle] = useState(template.title)
  const [content, setContent] = useState(template.parsed_document_text)
  const [intervalMonths, setIntervalMonths] = useState<string>(template.interval_months?.toString() ?? '')
  const [defaultHours, setDefaultHours] = useState<string>(template.default_estimated_labor_hours?.toString() ?? '')
  const [workCompleted, setWorkCompleted] = useState(template.work_completed ?? '')
  const [attachments, setAttachments] = useState<TemplateAttachment[]>(template.attachments ?? [])
  const [badges, setBadges] = useState<SM8Badge[]>(template.job_badges ?? [])

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label>Service Name *</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Service Interval</Label>
          <select
            value={intervalMonths}
            onChange={(e) => setIntervalMonths(e.target.value)}
            className="block w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">— not set —</option>
            {INTERVAL_OPTIONS.map((m) => <option key={m} value={m}>{m} month{m > 1 ? 's' : ''}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <Label>Default Est. Labor Hours</Label>
          <Input
            type="number"
            min="0"
            step="0.25"
            placeholder="e.g. 2.5"
            value={defaultHours}
            onChange={(e) => setDefaultHours(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label>Service Checklist / Instructions *</Label>
        <textarea
          rows={6}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y"
        />
      </div>

      <div className="space-y-1">
        <Label>Work Completed</Label>
        <textarea
          rows={3}
          value={workCompleted}
          onChange={(e) => setWorkCompleted(e.target.value)}
          placeholder="Describe what work is to be completed…"
          className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y"
        />
      </div>

      <div className="space-y-1">
        <Label>Attachments / Map Links</Label>
        <AttachmentsEditor value={attachments} onChange={setAttachments} />
      </div>

      <div className="space-y-1">
        <Label>Job Badges <span className="text-gray-400 font-normal">(SM8)</span></Label>
        <BadgesSelector selected={badges} onChange={setBadges} />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button
          onClick={() => onSave({ title, content, interval_months: intervalMonths ? parseInt(intervalMonths) : null, default_estimated_labor_hours: defaultHours ? parseFloat(defaultHours) : null, work_completed: workCompleted, attachments, job_badges: badges })}
          disabled={!title.trim() || loading}
        >
          {loading ? 'Saving…' : 'Save Changes'}
        </Button>
      </div>
    </div>
  )
}

// ── Preview dialog extras ─────────────────────────────────────────────────────

function TemplatePreview({ template }: { template: ServiceTemplate }) {
  return (
    <div className="space-y-4">
      {template.work_completed && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Work Completed</p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{template.work_completed}</p>
        </div>
      )}
      {template.parsed_document_text && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Checklist / Instructions</p>
          <div className="max-h-48 overflow-y-auto rounded bg-gray-50 p-3 text-sm text-gray-700 whitespace-pre-wrap font-mono scrollbar-thin">
            {template.parsed_document_text}
          </div>
        </div>
      )}
      {template.attachments && template.attachments.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Attachments</p>
          <ul className="space-y-1">
            {template.attachments.map((att, i) => (
              <li key={i}>
                <a
                  href={att.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
                >
                  <Link className="h-3.5 w-3.5" />
                  {att.label || att.url}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      {template.job_badges && template.job_badges.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Job Badges</p>
          <div className="flex flex-wrap gap-1.5">
            {template.job_badges.map((b) => (
              <span
                key={b.uuid}
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium text-white bg-indigo-500"
              >
                <Tag className="h-3 w-3" />{b.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TemplatesPage() {
  const qc = useQueryClient()
  const { toast } = useToast()
  const { user } = useAuth()
  const isWorker = user?.user_role === 'Worker'
  const [createOpen, setCreateOpen] = useState(false)
  const [editTemplate, setEditTemplate] = useState<ServiceTemplate | null>(null)
  const [previewTemplate, setPreviewTemplate] = useState<ServiceTemplate | null>(null)

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: templatesApi.list,
  })

  const createManualMutation = useMutation({
    mutationFn: ({ title, content, extras }: {
      title: string
      content: string
      extras: { interval_months: number | null; default_estimated_labor_hours: number | null; work_completed: string; attachments: TemplateAttachment[]; job_badges: SM8Badge[] }
    }) =>
      templatesApi.createManual(title, content, {
        interval_months: extras.interval_months,
        default_estimated_labor_hours: extras.default_estimated_labor_hours,
        work_completed: extras.work_completed || null,
        attachments: extras.attachments.length ? extras.attachments : null,
        job_badges: extras.job_badges.length ? extras.job_badges : null,
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['templates'] }); setCreateOpen(false); toast('Service created') },
    onError: () => toast('Failed to create service', 'error'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: {
      id: number
      data: {
        title: string
        content: string
        interval_months: number | null
        default_estimated_labor_hours: number | null
        work_completed: string
        attachments: TemplateAttachment[]
        job_badges: SM8Badge[]
      }
    }) =>
      templatesApi.update(id, {
        title: data.title,
        parsed_document_text: data.content,
        interval_months: data.interval_months,
        default_estimated_labor_hours: data.default_estimated_labor_hours,
        work_completed: data.work_completed || null,
        attachments: data.attachments.length ? data.attachments : null,
        job_badges: data.job_badges.length ? data.job_badges : null,
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['templates'] }); setEditTemplate(null); toast('Service saved') },
    onError: () => toast('Failed to save service', 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: templatesApi.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['templates'] }); toast('Service deleted') },
    onError: () => toast('Cannot delete — service may be in use by schedules', 'error'),
  })

  const isCreating = createManualMutation.isPending

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-5 py-3">
        <h1 className="text-base font-semibold">Services</h1>
        {!isWorker && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5" />Add Service
          </Button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
        {isLoading && <p className="text-sm text-gray-400 text-center py-8">Loading…</p>}
        {!isLoading && templates.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <FileText className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm">No services yet.</p>
            <p className="text-xs mt-1">Import from SM8 or create one manually.</p>
          </div>
        )}
        <div className="space-y-2">
          {templates.map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="h-5 w-5 text-blue-500 shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium text-gray-800 truncate">{t.title}</p>
                  <div className="flex items-center gap-2 flex-wrap mt-0.5">
                    <p className="text-xs text-gray-400">
                      {t.interval_months ? `Every ${t.interval_months}mo · ` : ''}
                      {t.default_estimated_labor_hours != null ? `Est. ${t.default_estimated_labor_hours}h · ` : ''}
                      {t.historical_average_labor_hours > 0 ? `Avg ${t.historical_average_labor_hours}h` : ''}
                    </p>
                    {t.attachments && t.attachments.length > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs text-blue-500">
                        <Link className="h-3 w-3" />{t.attachments.length} link{t.attachments.length !== 1 ? 's' : ''}
                      </span>
                    )}
                    {t.job_badges && t.job_badges.length > 0 && (
                      <div className="flex gap-1">
                        {t.job_badges.map((b) => (
                          <span
                            key={b.uuid}
                            className="inline-block rounded-full px-2 py-0.5 text-xs font-medium text-white bg-indigo-500"
                          >
                            {b.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="sm" onClick={() => setPreviewTemplate(t)}>Preview</Button>
                {!isWorker && (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => setEditTemplate(t)}>
                      <Pencil className="h-3.5 w-3.5" />Edit
                    </Button>
                    <Button
                      variant="ghost" size="sm"
                      onClick={() => deleteMutation.mutate(t.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen} title="New Service" className="max-w-4xl">
        <CreateDialog
          onClose={() => setCreateOpen(false)}
          loading={isCreating}
          onManual={(title, content, extras) => createManualMutation.mutate({ title, content, extras })}
        />
      </Dialog>

      <Dialog open={!!editTemplate} onOpenChange={(o) => !o && setEditTemplate(null)} title="Edit Service" className="max-w-4xl">
        {editTemplate && (
          <EditDialog
            template={editTemplate}
            onClose={() => setEditTemplate(null)}
            loading={updateMutation.isPending}
            onSave={(data) => updateMutation.mutate({ id: editTemplate.id, data })}
          />
        )}
      </Dialog>

      <Dialog open={!!previewTemplate} onOpenChange={(o) => !o && setPreviewTemplate(null)} title={previewTemplate?.title ?? ''}>
        {previewTemplate && <TemplatePreview template={previewTemplate} />}
      </Dialog>
    </div>
  )
}
