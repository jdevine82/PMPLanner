import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, FolderOpen } from 'lucide-react'
import { projectsApi } from '@/api/projects'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Dialog } from '@/components/ui/Dialog'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/context/AuthContext'
import type { Project, ProjectCreate, ProjectUpdate } from '@/types'

const ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

interface ForecastMonth {
  key: string
  label: string
  year: number
  month: number
}

function buildMonthKeys(): ForecastMonth[] {
  const now = new Date()
  return Array.from({ length: 24 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    const y = d.getFullYear()
    const m = d.getMonth()
    const key = `${y}-${String(m + 1).padStart(2, '0')}`
    return { key, label: `${ABBR[m]} '${String(y).slice(2)}`, year: y, month: m + 1 }
  })
}

// ── Month Hours Editor ────────────────────────────────────────────────────────

function MonthHoursEditor({
  value,
  onChange,
}: {
  value: Record<string, number>
  onChange: (v: Record<string, number>) => void
}) {
  const months = useMemo(() => buildMonthKeys(), [])

  function handleChange(key: string, raw: string) {
    const n = parseFloat(raw)
    const next = { ...value }
    if (raw === '' || isNaN(n) || n <= 0) {
      delete next[key]
    } else {
      next[key] = n
    }
    onChange(next)
  }

  return (
    <div>
      <div className="grid grid-cols-6 gap-x-2 gap-y-3">
        {months.map((m) => (
          <div key={m.key} className="flex flex-col gap-0.5">
            <span className={`text-[10px] font-medium text-center ${m.month === 1 ? 'text-blue-600' : 'text-gray-500'}`}>
              {m.label}
            </span>
            <input
              type="number"
              min="0"
              step="0.5"
              value={value[m.key] ?? ''}
              onChange={(e) => handleChange(m.key, e.target.value)}
              placeholder="—"
              className="w-full rounded border border-gray-200 px-1.5 py-1 text-center text-xs focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-200"
            />
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-gray-400">Enter hours for each month this project contributes to your workload. Leave blank for months with no project hours.</p>
    </div>
  )
}

// ── Project Dialog ────────────────────────────────────────────────────────────

function ProjectDialog({
  open,
  onOpenChange,
  project,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  project: Project | null
}) {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [name, setName] = useState(project?.name ?? '')
  const [description, setDescription] = useState(project?.description ?? '')
  const [monthHours, setMonthHours] = useState<Record<string, number>>(project?.month_hours ?? {})

  const createMutation = useMutation({
    mutationFn: (data: ProjectCreate) => projectsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      toast('Project created', 'success')
      onOpenChange(false)
    },
    onError: () => toast('Failed to save project', 'error'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: ProjectUpdate) => projectsApi.update(project!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      toast('Project updated', 'success')
      onOpenChange(false)
    },
    onError: () => toast('Failed to save project', 'error'),
  })

  function handleSubmit() {
    if (!name.trim()) return
    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      month_hours: monthHours,
    }
    if (project) {
      updateMutation.mutate(payload)
    } else {
      createMutation.mutate(payload)
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={project ? 'Edit Project' : 'New Project'}
      description="Project hours are added to the projected workload forecast."
      className="max-w-2xl"
    >
      <div className="flex flex-col gap-4">
        <div className="flex gap-4">
          <div className="flex-1">
            <Label htmlFor="proj-name">Name</Label>
            <Input
              id="proj-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Project name"
              className="mt-1"
            />
          </div>
          <div className="flex-1">
            <Label htmlFor="proj-desc">Description</Label>
            <Input
              id="proj-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              className="mt-1"
            />
          </div>
        </div>

        <div>
          <Label className="mb-2 block">Monthly Hours (24-month forecast window)</Label>
          <MonthHoursEditor value={monthHours} onChange={setMonthHours} />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || isPending}>
            {isPending ? 'Saving…' : project ? 'Save Changes' : 'Create Project'}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

// ── Project Card ──────────────────────────────────────────────────────────────

function ProjectCard({
  project,
  onEdit,
  onDelete,
  canEdit,
}: {
  project: Project
  onEdit: () => void
  onDelete: () => void
  canEdit: boolean
}) {
  const totalHours = Object.values(project.month_hours).reduce((sum, h) => sum + h, 0)
  const activeMonths = Object.values(project.month_hours).filter((h) => h > 0).length

  return (
    <div className="flex items-start justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-start gap-3 min-w-0">
        <div className="mt-0.5 shrink-0 rounded-md bg-blue-50 p-2">
          <FolderOpen className="h-4 w-4 text-blue-500" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{project.name}</p>
          {project.description && (
            <p className="text-xs text-gray-500 mt-0.5 truncate">{project.description}</p>
          )}
          <p className="text-xs text-gray-400 mt-1">
            {activeMonths === 0
              ? 'No hours assigned'
              : `${totalHours.toFixed(1)}h across ${activeMonths} month${activeMonths !== 1 ? 's' : ''}`}
          </p>
        </div>
      </div>
      {canEdit && (
        <div className="flex shrink-0 gap-1 ml-4">
          <button
            onClick={onEdit}
            className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list(),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => projectsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      toast('Project deleted', 'success')
    },
    onError: () => toast('Failed to delete project', 'error'),
  })

  const canEdit = user?.user_role === 'Admin' || user?.user_role === 'Staff'
  const canDelete = user?.user_role === 'Admin'

  function openNew() {
    setEditingProject(null)
    setDialogOpen(true)
  }

  function openEdit(project: Project) {
    setEditingProject(project)
    setDialogOpen(true)
  }

  function handleDelete(project: Project) {
    if (!confirm(`Delete project "${project.name}"? This cannot be undone.`)) return
    deleteMutation.mutate(project.id)
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-gray-100 bg-white px-6 py-3.5">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Projects</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Project hours are added to the projected workload forecast.
          </p>
        </div>
        {canEdit && (
          <Button size="sm" onClick={openNew}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            New Project
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {isLoading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <FolderOpen className="h-10 w-10 text-gray-200 mb-3" />
            <p className="text-sm font-medium text-gray-500">No projects yet</p>
            {canEdit && (
              <p className="text-xs text-gray-400 mt-1">
                Add a project to include its hours in the workload forecast.
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2 max-w-2xl">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onEdit={() => openEdit(project)}
                onDelete={() => handleDelete(project)}
                canEdit={canEdit && canDelete}
              />
            ))}
          </div>
        )}
      </div>

      <ProjectDialog
        key={editingProject?.id ?? 'new'}
        open={dialogOpen}
        onOpenChange={(v) => {
          setDialogOpen(v)
          if (!v) setEditingProject(null)
        }}
        project={editingProject}
      />
    </div>
  )
}
