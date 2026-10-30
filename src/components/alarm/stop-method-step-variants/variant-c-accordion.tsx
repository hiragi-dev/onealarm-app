import { MapPin } from 'lucide-react'

import { LocationPickerMap } from '@/components/map/location-picker-map'
import type { GeoPoint } from '@/lib/geo'
import type { StopMethod } from '@/lib/stop-method'
import { cn } from '@/lib/utils'

/**
 * 【C案】インライン展開案。
 *
 * A案（常時プレビュー）とB案（別画面で確認）の中間。一覧の行自体を選ぶと、
 * その行がその場でアコーディオンのように開いて地図プレビューを見せる
 * （選んでいない行は閉じたまま）。画面遷移は発生させず、かつ地図を常に
 * 全件描画するA案よりは軽い。「選ぶ」と「確認する」を同じ1回のタップに束ねる。
 */
export function StopMethodStepVariantC({
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
  return (
    <div className="space-y-2">
      {methods.map((method) => {
        const isSelected = selectedId === method.id
        return (
          <div
            key={method.id}
            className={cn(
              'overflow-hidden rounded-2xl border transition-colors',
              isSelected ? 'border-primary bg-primary/8' : 'border-white/10 bg-white/4',
            )}
          >
            <button
              type="button"
              disabled={disabled}
              onClick={() => onSelect(method.id)}
              aria-pressed={isSelected}
              aria-expanded={isSelected}
              className="flex w-full items-center gap-3 px-4 py-3 text-left disabled:pointer-events-none disabled:opacity-50"
            >
              <span
                className={cn(
                  'flex size-9 shrink-0 items-center justify-center rounded-full',
                  isSelected ? 'bg-primary text-primary-foreground' : 'bg-white/8 text-muted-foreground',
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

            {isSelected && (
              <div className="h-32 border-t border-primary/20 [&_.leaflet-control-zoom]:hidden">
                <LocationPickerMap
                  initialCenter={method}
                  value={method}
                  onSelect={() => {}}
                  radiusMeters={method.radiusMeters}
                  currentPosition={currentPosition}
                  readOnly
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
