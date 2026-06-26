import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Download, CheckSquare, Square, AlertCircle } from 'lucide-react'
import { servicem8Api } from '@/api/servicem8'
import { assetsApi } from '@/api/assets'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import type { Site, Asset } from '@/types'

interface Props {
  site: Site
  companyUuid: string
  existingAssets: Asset[]
  open: boolean
  onClose: () => void
}

export function AssetImportModal({ site, companyUuid, existingAssets, open, onClose }: Props) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const importedUuids = new Set(existingAssets.map((a) => a.servicem8_asset_uuid).filter(Boolean))

  const { data: rawSm8Assets = [], isLoading, error } = useQuery({
    queryKey: ['sm8-assets', companyUuid],
    queryFn: () => servicem8Api.companyAssets(companyUuid),
    enabled: open,
  })

  const sm8Assets = rawSm8Assets.filter((a) => !importedUuids.has(a.uuid))

  const importMutation = useMutation({
    mutationFn: async () => {
      const toImport = sm8Assets.filter((a) => selected.has(a.uuid))
      await Promise.all(
        toImport.map((a) =>
          assetsApi.create({
            site_id: site.id,
            location_id: null,
            servicem8_asset_uuid: a.uuid,
            asset_name: a.name,
            serial_number: a.serial ?? null,
            model_number: a.model ?? null,
            is_catch_all: false,
          }),
        ),
      )
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assets'] })
      toast(`Imported ${selected.size} asset(s)`)
      setSelected(new Set())
      onClose()
    },
    onError: () => toast('Import failed', 'error'),
  })

  function toggle(uuid: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(uuid) ? next.delete(uuid) : next.add(uuid)
      return next
    })
  }

  function toggleAll() {
    setSelected(selected.size === sm8Assets.length ? new Set() : new Set(sm8Assets.map((a) => a.uuid)))
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()} title={`Import Assets — ${site.site_name}`} description="Assets already linked locally are excluded.">
      {isLoading && <p className="text-sm text-gray-400 py-4 text-center">Fetching from ServiceM8…</p>}

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 py-2 rounded-md border border-red-200 bg-red-50 px-3">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{(error as any)?.response?.data?.detail ?? String(error)}</span>
        </div>
      )}

      {!isLoading && !error && rawSm8Assets.length === 0 && (
        <p className="text-sm text-gray-400 py-4 text-center">No assets found for this customer in ServiceM8.</p>
      )}

      {!isLoading && !error && rawSm8Assets.length > 0 && sm8Assets.length === 0 && (
        <p className="text-sm text-gray-400 py-4 text-center">All {rawSm8Assets.length} SM8 asset{rawSm8Assets.length !== 1 ? 's' : ''} already imported.</p>
      )}

      {sm8Assets.length > 0 && (
        <>
          <div className="mb-2 flex items-center justify-between">
            <button onClick={toggleAll} className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800">
              {selected.size === sm8Assets.length ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
              {selected.size === sm8Assets.length ? 'Deselect all' : 'Select all'}
            </button>
            <span className="text-xs text-gray-400">{selected.size} of {sm8Assets.length} selected</span>
          </div>

          <div className="max-h-64 overflow-y-auto rounded border border-gray-200 divide-y divide-gray-100">
            {sm8Assets.map((a) => (
              <label key={a.uuid} className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-gray-50">
                <input type="checkbox" checked={selected.has(a.uuid)} onChange={() => toggle(a.uuid)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{a.name}</p>
                  {(a.serial || a.model) && (
                    <p className="text-xs text-gray-400">{[a.serial && `S/N: ${a.serial}`, a.model && `Model: ${a.model}`].filter(Boolean).join(' · ')}</p>
                  )}
                </div>
              </label>
            ))}
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={() => importMutation.mutate()} disabled={selected.size === 0 || importMutation.isPending}>
              <Download className="h-3.5 w-3.5" />
              {importMutation.isPending ? 'Importing…' : `Import ${selected.size} Asset(s)`}
            </Button>
          </div>
        </>
      )}
    </Dialog>
  )
}
