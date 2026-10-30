import { MapPin } from 'lucide-react'

import { LocationPickerMap } from '@/components/map/location-picker-map'
import type { GeoPoint } from '@/lib/geo'
import type { StopMethod } from '@/lib/stop-method'
import { cn } from '@/lib/utils'

/**
 * 【A案】常時プレビュー案。
 *
 * 一覧の下に、いま選んでいる停止方法の地図プレビューを常時出す。選択を切り替える
 * たびに自動で更新されるため、確認のための追加操作は一切不要。反面、地図分の
 * 縦スペースを常に占有する（一覧が長い場合は地図まで見るのにスクロールが必要）。
 */
export function StopMethodStepVariantA({
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
  const selected = methods.find((m) => m.id === selectedId)

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {methods.map((method) => {
          const isSelected = selectedId === method.id
          return (
            <button
              key={method.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(method.id)}
              aria-pressed={isSelected}
              className={cn(
                'flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors disabled:pointer-events-none disabled:opacity-50',
                isSelected
                  ? 'border-primary bg-primary/8'
                  : 'border-white/10 bg-white/4 hover:bg-white/6',
              )}
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
          )
        })}
      </div>

      {selected && (
        <div>
          <p className="mb-2 text-[0.65rem] tracking-[0.08em] text-muted-foreground uppercase">
            選んだ地点
          </p>
          <div className="h-36 overflow-hidden rounded-2xl [&_.leaflet-control-zoom]:hidden">
            <LocationPickerMap
              initialCenter={selected}
              value={selected}
              onSelect={() => {}}
              radiusMeters={selected.radiusMeters}
              currentPosition={currentPosition}
              readOnly
            />
          </div>
        </div>
      )}
    </div>
  )
}
