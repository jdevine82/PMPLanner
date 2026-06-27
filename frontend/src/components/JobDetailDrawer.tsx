import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Send, Lock, Link, FileText, Layers } from 'lucide-react'
import { format } from 'date-fns'
import { jobsApi } from '@/api/jobs'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import type { DashboardRow } from '@/types'

interface Props {
  row: DashboardRow | null
  onClose: () => void
}

export function JobDetailDrawer({ row, onClose }: Props) {
  const [text, setText] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()

  const isGrouped = !!row?.groupedRows
  const allRows = row?.groupedRows ?? (row ? [row] : [])
  const leadRow = allRows[0] ?? row

  // For grouped jobs, load comments from all job instances
  const allJobIds = allRows.map((r) => r.job.id)

  const commentsQueries = useQuery({
    queryKey: ['comments-detail', allJobIds],
    queryFn: async () => {
      const results = await Promise.all(allJobIds.map((id) => jobsApi.listComments(id)))
      return results.flat().sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    },
    enabled: !!row,
  })

  const addComment = useMutation({
    mutationFn: (comment_text: string) => jobsApi.addComment(leadRow!.job.id, comment_text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments-detail', allJobIds] })
      queryClient.invalidateQueries({ queryKey: ['comment-counts', leadRow?.job.target_month_year] })
      setText('')
    },
  })

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [commentsQueries.data])

  const template = leadRow?.template
  const site = leadRow?.site
  const customer = leadRow?.customer

  return (
    <div
      className={cn(
        'fixed inset-y-0 right-0 z-30 flex w-[30rem] flex-col bg-white shadow-2xl border-l border-gray-200',
        'transition-transform duration-300',
        row ? 'translate-x-0' : 'translate-x-full',
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-gray-200 p-4 shrink-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {isGrouped
              ? <Layers className="h-4 w-4 text-violet-600 shrink-0" />
              : <FileText className="h-4 w-4 text-blue-600 shrink-0" />}
            <h2 className="font-semibold text-gray-900 text-sm truncate">
              {isGrouped
                ? allRows.map((r) => r.asset.asset_name).join(', ')
                : leadRow?.asset.asset_name}
            </h2>
          </div>
          <p className="mt-0.5 text-xs text-gray-500 truncate">
            {customer?.company_name} → {site?.site_name}
          </p>
          <p className="mt-0.5 text-xs font-medium text-gray-700 truncate">{template?.title}</p>
          {leadRow?.job.servicem8_job_number != null && (
            <p className="mt-0.5 text-xs text-blue-600 font-mono">SM8 #{leadRow.job.servicem8_job_number}</p>
          )}
        </div>
        <button onClick={onClose} className="rounded p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 shrink-0">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {/* Combined assets list */}
        {isGrouped && (
          <div className="border-b border-gray-200 bg-violet-50 px-4 py-3">
            <p className="text-xs font-semibold text-violet-700 mb-1.5 uppercase tracking-wide">Assets in this job</p>
            <ul className="space-y-0.5">
              {allRows.map((r) => (
                <li key={r.job.id} className="text-xs text-violet-800">
                  <span className="font-medium">{r.asset.asset_name}</span>
                  {r.asset.serial_number && <span className="text-violet-600"> · S/N {r.asset.serial_number}</span>}
                  <span className="text-violet-500"> · {r.schedule.estimated_labor_hours}h est.</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Work to be completed */}
        {template?.work_completed && (
          <div className="border-b border-gray-100 px-4 py-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Work to be Completed</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{template.work_completed}</p>
          </div>
        )}

        {/* Checklist / Instructions */}
        {template?.parsed_document_text && (
          <div className="border-b border-gray-100 px-4 py-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Checklist / Instructions</p>
            <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono leading-relaxed max-h-48 overflow-y-auto scrollbar-thin">
              {template.parsed_document_text}
            </pre>
          </div>
        )}

        {/* Attachments */}
        {template?.attachments && template.attachments.length > 0 && (
          <div className="border-b border-gray-100 px-4 py-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Attachments</p>
            <ul className="space-y-1.5">
              {template.attachments.map((att, i) => (
                <li key={i}>
                  <a
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
                  >
                    <Link className="h-3.5 w-3.5 shrink-0" />
                    {att.label || att.url}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Custom instructions (per-asset, shown per schedule for grouped) */}
        {allRows.some((r) => r.schedule.permanent_custom_instructions) && (
          <div className="border-b border-gray-100 bg-blue-50 px-4 py-3">
            <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1.5">Site Instructions</p>
            {allRows.filter((r) => r.schedule.permanent_custom_instructions).map((r) => (
              <div key={r.job.id} className="mb-1 last:mb-0">
                {isGrouped && <p className="text-xs font-medium text-blue-600">{r.asset.asset_name}</p>}
                <p className="text-xs text-blue-800">{r.schedule.permanent_custom_instructions}</p>
              </div>
            ))}
          </div>
        )}

        {/* Refusal reason */}
        {leadRow?.job.approval_status === 'Refused by Customer' && leadRow.job.refusal_reason && (
          <div className="border-b border-red-200 bg-red-50 px-4 py-3">
            <p className="text-xs font-medium text-red-700 mb-1">Refused — Reason on File</p>
            <p className="text-xs text-red-800">{leadRow.job.refusal_reason}</p>
          </div>
        )}

        {/* Comments */}
        <div className="px-4 py-3 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Notes & Comments</p>
          {commentsQueries.isLoading && <p className="text-xs text-gray-400">Loading…</p>}
          {commentsQueries.data?.length === 0 && (
            <p className="text-xs text-gray-400">No comments yet.</p>
          )}
          {commentsQueries.data?.map((comment) => (
            <div key={comment.id} className={cn('rounded-lg px-3 py-2 text-xs', comment.is_system_generated ? 'bg-gray-100 border border-gray-200' : 'bg-white border border-gray-200')}>
              <div className="flex items-center gap-1.5 mb-1">
                {comment.is_system_generated && <Lock className="h-3 w-3 text-gray-400" />}
                <span className="font-medium text-gray-700">
                  {comment.is_system_generated ? 'System' : `User #${comment.user_id}`}
                </span>
                <span className="text-gray-400">·</span>
                <span className="text-gray-400">{format(new Date(comment.created_at), 'dd/MM/yyyy h:mm a')}</span>
              </div>
              <p className="text-gray-700 whitespace-pre-wrap">{comment.comment_text}</p>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Add comment */}
      <div className="border-t border-gray-200 p-3 shrink-0">
        <Textarea
          rows={3}
          placeholder="Write a note… (Ctrl+Enter to save)"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="text-xs"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && text.trim()) {
              addComment.mutate(text.trim())
            }
          }}
        />
        <div className="mt-2 flex justify-end">
          <Button
            size="sm"
            onClick={() => addComment.mutate(text.trim())}
            disabled={!text.trim() || addComment.isPending}
          >
            <Send className="h-3.5 w-3.5" />
            {addComment.isPending ? 'Saving…' : 'Add Note'}
          </Button>
        </div>
      </div>
    </div>
  )
}
