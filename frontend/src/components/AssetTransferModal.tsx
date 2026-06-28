import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowRightLeft } from 'lucide-react'
import { customersApi } from '@/api/customers'
import { sitesApi } from '@/api/sites'
import { siteLocationsApi } from '@/api/siteLocations'
import { assetsApi } from '@/api/assets'
import { schedulesApi } from '@/api/schedules'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Label } from '@/components/ui/Label'
import { useToast } from '@/components/ui/Toast'
import type { Asset } from '@/types'

const SELECT_CLASS = 'block w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400'

interface Props {
  asset: Asset
  currentSiteId: number
  open: boolean
  onClose: () => void
}

export function AssetTransferModal({ asset, currentSiteId, open, onClose }: Props) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [customerId, setCustomerId] = useState<number | null>(null)
  const [siteId, setSiteId] = useState<number | null>(null)
  const [locationId, setLocationId] = useState<number | null>(null)

  const { data: customers = [] } = useQuery({
    queryKey: ['customers-all-transfer'],
    queryFn: () => customersApi.list(),
    enabled: open,
  })

  const { data: sites = [] } = useQuery({
    queryKey: ['sites-transfer', customerId],
    queryFn: () => sitesApi.list(customerId!),
    enabled: !!customerId,
  })

  const { data: locations = [] } = useQuery({
    queryKey: ['locations-transfer', siteId],
    queryFn: () => siteLocationsApi.list(siteId!),
    enabled: !!siteId,
  })

  const { data: schedules = [] } = useQuery({
    queryKey: ['schedules', asset.id],
    queryFn: () => schedulesApi.list(asset.id),
    enabled: open,
  })

  const transfer = useMutation({
    mutationFn: () => assetsApi.transfer(asset.id, siteId!, locationId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assets'] })
      toast(`"${asset.asset_name}" moved successfully`)
      handleClose()
    },
    onError: () => toast('Transfer failed', 'error'),
  })

  function handleClose() {
    setCustomerId(null)
    setSiteId(null)
    setLocationId(null)
    onClose()
  }

  function handleCustomerChange(id: number | null) {
    setCustomerId(id)
    setSiteId(null)
    setLocationId(null)
  }

  function handleSiteChange(id: number | null) {
    setSiteId(id)
    setLocationId(null)
  }

  const targetSiteIsCurrentSite = siteId === currentSiteId
  const canTransfer = !!siteId && !targetSiteIsCurrentSite && !transfer.isPending

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()} title="Transfer Asset to New Site">
      <div className="space-y-4">
        <div className="rounded-md border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800">
          <div className="flex items-start gap-2">
            <ArrowRightLeft className="h-4 w-4 shrink-0 mt-0.5 text-blue-500" />
            <div>
              <p className="font-medium">{asset.asset_name}</p>
              <p className="text-xs text-blue-600 mt-0.5">
                {schedules.length === 0
                  ? 'No maintenance schedules.'
                  : `${schedules.length} maintenance schedule${schedules.length !== 1 ? 's' : ''} and all service history will move with this asset.`}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <Label>Customer *</Label>
          <select
            className={SELECT_CLASS}
            value={customerId ?? ''}
            onChange={(e) => handleCustomerChange(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">— Select customer —</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.company_name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <Label>Site *</Label>
          <select
            className={SELECT_CLASS}
            value={siteId ?? ''}
            disabled={!customerId}
            onChange={(e) => handleSiteChange(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">— Select site —</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>{s.site_name}</option>
            ))}
          </select>
          {customerId && sites.length === 0 && (
            <p className="text-xs text-gray-400">No sites for this customer.</p>
          )}
          {targetSiteIsCurrentSite && (
            <p className="text-xs text-amber-600">This asset is already at this site.</p>
          )}
        </div>

        {siteId && locations.length > 0 && (
          <div className="space-y-1">
            <Label>Sublocation (optional)</Label>
            <select
              className={SELECT_CLASS}
              value={locationId ?? ''}
              onChange={(e) => setLocationId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">— Unassigned —</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button
            onClick={() => transfer.mutate()}
            disabled={!canTransfer}
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            {transfer.isPending ? 'Transferring…' : 'Transfer Asset'}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
