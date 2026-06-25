import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { X, MessageSquare, Send, Lock } from 'lucide-react'
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

export function CommentDrawer({ row, onClose }: Props) {
  const [text, setText] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()

  const commentsQuery = useQuery({
    queryKey: ['comments', row?.job.id],
    queryFn: () => jobsApi.listComments(row!.job.id),
    enabled: !!row,
  })

  const addComment = useMutation({
    mutationFn: (comment_text: string) => jobsApi.addComment(row!.job.id, comment_text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', row?.job.id] })
      setText('')
    },
  })

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [commentsQuery.data])

  return (
    <div
      className={cn(
        'fixed inset-y-0 right-0 z-30 flex w-96 flex-col bg-white shadow-2xl border-l border-gray-200',
        'transition-transform duration-300',
        row ? 'translate-x-0' : 'translate-x-full',
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-gray-200 p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-blue-600 shrink-0" />
            <h2 className="font-semibold text-gray-900 text-sm truncate">
              {row?.asset.asset_name}
            </h2>
          </div>
          <p className="mt-0.5 text-xs text-gray-500 truncate">
            {row?.customer.company_name} → {row?.site.site_name}
          </p>
        </div>
        <button onClick={onClose} className="rounded p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Permanent instructions */}
      {row?.schedule.permanent_custom_instructions && (
        <div className="border-b border-gray-200 bg-blue-50 px-4 py-3">
          <p className="text-xs font-medium text-blue-700 mb-1">Permanent Instructions</p>
          <p className="text-xs text-blue-800">{row.schedule.permanent_custom_instructions}</p>
        </div>
      )}

      {/* Refusal reason */}
      {row?.job.approval_status === 'Refused by Customer' && row.job.refusal_reason && (
        <div className="border-b border-red-200 bg-red-50 px-4 py-3">
          <p className="text-xs font-medium text-red-700 mb-1">Refused — Reason on File</p>
          <p className="text-xs text-red-800">{row.job.refusal_reason}</p>
        </div>
      )}

      {/* Comment list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-thin">
        {commentsQuery.isLoading && <p className="text-xs text-gray-400">Loading comments…</p>}
        {commentsQuery.data?.map((comment) => (
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

      {/* Add comment */}
      <div className="border-t border-gray-200 p-3">
        <Textarea
          rows={3}
          placeholder="Write a note…"
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
