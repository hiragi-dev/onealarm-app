import * as React from 'react'
import { MapPin, MapPinned } from 'lucide-react'

import { LocationPickerMap } from '@/components/map/location-picker-map'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { GeoPoint } from '@/lib/geo'
import type { StopMethod } from '@/lib/stop-method'
import { cn } from '@/lib/utils'

/**
 * 【B案】タップして確認案。
 *
 * 一覧はテキストのみで軽いまま維持し、行の右端に地図アイコンを置く。押すと
 * その停止方法だけを全画面の地図で確認できる（既存の「停止」タブの地点確認と
 * 同じ構造）。地図を見るコストは「確認したい人」だけが払い、一覧は地図を
 * 一切描画しないぶん軽量。確認せず一覧の行タップだけで選ぶことも従来どおり可能。
 */
export function StopMethodStepVariantB({
  methods,
  selectedId,
  onSelect,
  disabled,
  currentPosition,
}: {
  methods: StopMethod[]
  selectedId: string
  onSelect: (id: string) => void
  disabled?: boolean
  currentPosition?: GeoPoint | null
}) {
  const [viewingId, setViewingId] = React.useState<string | null>(null)
  const viewing = methods.find((m) => m.id === viewingId)

  return (
    <>
      <div className="space-y-2">
        {methods.map((method) => {
          const isSelected = selectedId === method.id
          return (
            <div
              key={method.id}
              className={cn(
                'flex items-center gap-1 rounded-2xl border pr-1.5 transition-colors',
                isSelected ? 'border-primary bg-primary/8' : 'border-white/10 bg-white/4',
              )}
            >
              <button
                type="button"
                disabled={disabled}
                onClick={() => onSelect(method.id)}
                aria-pressed={isSelected}
                className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left disabled:pointer-events-none disabled:opacity-50"
              >
                <span
                  className={cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-full',
                    isSelected
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-white/8 text-muted-foreground',
                  )}
                >
                  <MapPin className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{method.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    到達判定 半径{method.radiusMeters}m
                  </span>
                </span>
              </button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={disabled}
                aria-label={`${method.label}を地図で確認`}
                onClick={() => setViewingId(method.id)}
                className="shrink-0 text-muted-foreground"
              >
                <MapPinned className="size-4" />
              </Button>
            </div>
          )
        })}
      </div>

      <Dialog open={viewing !== undefined} onOpenChange={(open) => !open && setViewingId(null)}>
        <DialogContent fullScreen>
          <DialogHeader className="px-4 py-3 text-left">
            <DialogTitle>{viewing?.label}</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1">
            {viewing && (
              <LocationPickerMap
                initialCenter={viewing}
                value={viewing}
                onSelect={() => {}}
                radiusMeters={viewing.radiusMeters}
                currentPosition={currentPosition}
                readOnly
              />
            )}
          </div>
          <DialogFooter className="flex-row items-center gap-3 p-4">
            <p className="flex-1 text-sm text-muted-foreground">
              到達判定 半径{viewing?.radiusMeters}m
            </p>
            <Button
              onClick={() => {
                if (viewing) onSelect(viewing.id)
                setViewingId(null)
              }}
            >
              この地点を選択
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
