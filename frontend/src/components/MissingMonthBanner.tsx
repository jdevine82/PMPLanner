import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, X, Zap } from 'lucide-react'
import { jobsApi } from '@/api/jobs'
import { formatMonthYear } from '@/lib/utils'
import { useToast } from '@/components/ui/Toast'

interface Props {
  month: string
}

export function MissingMonthBanner({ month }: Props) {
  const [dismissed, setDismissed] = useState(false)
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const initMutation = useMutation({
    mutationFn: () => jobsApi.initializeMonth(month),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['jobs', month] })
      toast(`Created ${result.created_count} job drafts for ${formatMonthYear(month)}`)
      setDismissed(true)
    },
    onError: () => toast('Failed to initialize schedule', 'error'),
  })

  if (dismissed) return null

  return (
    <div className="flex items-center gap-3 bg-amber-50 border-b border-amber-200 px-4 py-2.5">
      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
      <p className="flex-1 text-sm text-amber-800">
        <span className="font-medium">No jobs scheduled for {formatMonthYear(month)}.</span>{' '}
        Click to auto-generate drafts from active maintenance schedules.
      </p>
      <button
        onClick={() => initMutation.mutate()}
        disabled={initMutation.isPending}
        className="flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-60 transition-colors"
      >
        <Zap className="h-3.5 w-3.5" />
        {initMutation.isPending ? 'Generating…' : 'Run Now'}
      </button>
      <button onClick={() => setDismissed(true)} className="text-amber-500 hover:text-amber-700">
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
