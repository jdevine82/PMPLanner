import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Upload, Trash2, FileText } from 'lucide-react'
import { templatesApi } from '@/api/templates'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Dialog } from '@/components/ui/Dialog'
import { useToast } from '@/components/ui/Toast'
import type { ServiceTemplate } from '@/types'

function UploadForm({ onSubmit, onCancel, loading }: { onSubmit: (t: string, f: File) => void; onCancel: () => void; loading: boolean }) {
  const [title, setTitle] = useState('')
  const [file, setFile] = useState<File | null>(null)
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="title">Template Title *</Label>
        <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. HVAC Quarterly Service" />
      </div>
      <div className="space-y-1">
        <Label>Word Document (.docx) *</Label>
        <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-gray-300 px-4 py-6 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors">
          <Upload className="h-5 w-5" />
          <span>{file ? file.name : 'Click to select .docx file'}</span>
          <input type="file" accept=".docx" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => file && onSubmit(title, file)} disabled={!title || !file || loading}>
          {loading ? 'Uploading…' : 'Upload Template'}
        </Button>
      </div>
    </div>
  )
}

export default function TemplatesPage() {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [createOpen, setCreateOpen] = useState(false)
  const [previewTemplate, setPreviewTemplate] = useState<ServiceTemplate | null>(null)
  const replaceInputRef = useRef<HTMLInputElement>(null)
  const [replaceId, setReplaceId] = useState<number | null>(null)

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: templatesApi.list,
  })

  const createMutation = useMutation({
    mutationFn: ({ title, file }: { title: string; file: File }) => templatesApi.create(title, file),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['templates'] }); setCreateOpen(false); toast('Template created') },
    onError: () => toast('Upload failed — ensure the file is a valid .docx', 'error'),
  })

  const replaceMutation = useMutation({
    mutationFn: ({ id, file }: { id: number; file: File }) => templatesApi.replaceDocument(id, file),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['templates'] }); toast('Document replaced') },
    onError: () => toast('Replace failed', 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: templatesApi.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['templates'] }); toast('Template deleted') },
    onError: () => toast('Cannot delete — template may be in use by schedules', 'error'),
  })

  function handleReplaceFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file && replaceId != null) {
      replaceMutation.mutate({ id: replaceId, file })
      setReplaceId(null)
    }
    e.target.value = ''
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-5 py-3">
        <h1 className="text-base font-semibold">Service Templates</h1>
        <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="h-3.5 w-3.5" />Add Template</Button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
        {isLoading && <p className="text-sm text-gray-400 text-center py-8">Loading…</p>}
        <div className="space-y-2">
          {templates.map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="h-5 w-5 text-blue-500 shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium text-gray-800 truncate">{t.title}</p>
                  <p className="text-xs text-gray-400">
                    Avg {t.historical_average_labor_hours}h
                    {t.original_filename && ` · ${t.original_filename}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="sm" onClick={() => setPreviewTemplate(t)}>Preview</Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setReplaceId(t.id); replaceInputRef.current?.click() }}
                >
                  <Upload className="h-3.5 w-3.5" />
                  Replace
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteMutation.mutate(t.id)}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Hidden file input for replace */}
      <input ref={replaceInputRef} type="file" accept=".docx" className="hidden" onChange={handleReplaceFile} />

      <Dialog open={createOpen} onOpenChange={setCreateOpen} title="Upload New Template">
        <UploadForm
          onSubmit={(title, file) => createMutation.mutate({ title, file })}
          onCancel={() => setCreateOpen(false)}
          loading={createMutation.isPending}
        />
      </Dialog>

      <Dialog open={!!previewTemplate} onOpenChange={(o) => !o && setPreviewTemplate(null)} title={previewTemplate?.title ?? ''} className="max-w-2xl">
        <div className="max-h-96 overflow-y-auto rounded bg-gray-50 p-4 text-sm text-gray-700 whitespace-pre-wrap scrollbar-thin font-mono">
          {previewTemplate?.parsed_document_text}
        </div>
      </Dialog>
    </div>
  )
}
