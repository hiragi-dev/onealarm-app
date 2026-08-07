import * as React from 'react'
import { Circle, MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { match } from 'ts-pattern'
import { LocateFixed } from 'lucide-react'

import {
  MAP_ACCENT_COLOR,
  currentLocationIcon,
  stopPointIcon,
} from '@/components/map/marker-icons'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import type { GeoPoint } from '@/lib/geo'
import {
  MAX_STOP_METHOD_RADIUS_METERS,
  MIN_STOP_METHOD_RADIUS_METERS,
} from '@/lib/stop-method'

function ClickHandler({ onSelect }: { onSelect: (point: GeoPoint) => void }) {
  useMapEvents({
    click(e) {
      onSelect({ lat: e.latlng.lat, lng: e.latlng.lng })
    },
  })
  return null
}

type Props = {
  /** 初期表示の中心地点（マウント後の変更では再センタリングしない） */
  initialCenter: GeoPoint
  /** 選択済みの地点。未選択ならマーカーを表示しない */
  value: GeoPoint | null
  onSelect: (point: GeoPoint) => void
  /** 現在地（取得済みなら「現在地」ボタンを表示する） */
  currentPosition?: GeoPoint | null
  /** 選択地点に描画する到達判定半径(m)。value が無ければ描画しない */
  radiusMeters?: number
  /** 指定すると地図下部に半径調整スライダーを表示する */
  onRadiusChange?: (radiusMeters: number) => void
  /**
   * 閲覧専用。タップしても地点を選択せず、半径スライダーも表示しない。
   * 登録済みの停止方法がどこなのかを確認するだけの用途で使う
   */
  readOnly?: boolean
}

/**
 * タップした地点にマーカーを立てて位置を選択させる地図。OpenStreetMap タイルを使う。
 * radiusMeters を渡すと選択地点に到達判定の円を描き、onRadiusChange を渡すと
 * 地図下部に半径調整スライダーを表示する。
 */
export function LocationPickerMap({
  initialCenter,
  value,
  onSelect,
  currentPosition,
  radiusMeters,
  onRadiusChange,
  readOnly = false,
}: Props) {
  const mapRef = React.useRef<L.Map | null>(null)

  // ダイアログのアニメーション中などコンテナがまだ最終サイズになっていない状態で
  // Leaflet が初期サイズを測ると、タイルが正しく並ばないことがある。
  // マウント後に一度サイズを再計算させて確実に描画させる。
  React.useEffect(() => {
    const id = setTimeout(() => mapRef.current?.invalidateSize(), 300)
    return () => clearTimeout(id)
  }, [])

  const goToCurrentLocation = () => {
    if (!currentPosition) return
    mapRef.current?.flyTo([currentPosition.lat, currentPosition.lng], 17)
  }

  const showRadiusSlider = !!onRadiusChange && !!value && !readOnly

  return (
    <div className="relative size-full">
      <MapContainer
        ref={mapRef}
        center={[initialCenter.lat, initialCenter.lng]}
        zoom={16}
        maxZoom={19}
        className="size-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
          // タイルの URL が座標そのものなので、せめて参照元は渡さない
          referrerPolicy="no-referrer"
        />
        {!readOnly && <ClickHandler onSelect={onSelect} />}
        {currentPosition && (
          <Marker
            position={[currentPosition.lat, currentPosition.lng]}
            icon={currentLocationIcon}
            zIndexOffset={-1000}
            interactive={false}
          />
        )}
        {value && radiusMeters != null && radiusMeters > 0 && (
          <Circle
            center={[value.lat, value.lng]}
            radius={radiusMeters}
            pathOptions={{
              color: MAP_ACCENT_COLOR,
              fillColor: MAP_ACCENT_COLOR,
              fillOpacity: 0.15,
              weight: 2,
            }}
          />
        )}
        {value && <Marker position={[value.lat, value.lng]} icon={stopPointIcon} />}
      </MapContainer>

      {currentPosition && (
        <Button
          type="button"
          size="icon"
          variant="secondary"
          onClick={goToCurrentLocation}
          aria-label={match(readOnly)
            .with(true, () => '現在地へ移動')
            .with(false, () => '現在地を使う')
            .exhaustive()}
          className="absolute top-3 right-3 z-[1000] shadow-lg"
        >
          <LocateFixed className="text-primary" />
        </Button>
      )}

      {showRadiusSlider && (
        <div className="absolute inset-x-3 bottom-3 z-[1000] rounded-xl border bg-popover/95 px-4 py-3 shadow-lg backdrop-blur">
          <p className="mb-2 text-xs text-muted-foreground">
            到達判定の半径: {radiusMeters}m
          </p>
          <Slider
            value={[radiusMeters ?? MIN_STOP_METHOD_RADIUS_METERS]}
            onValueChange={([next]) => onRadiusChange?.(next)}
            min={MIN_STOP_METHOD_RADIUS_METERS}
            max={MAX_STOP_METHOD_RADIUS_METERS}
            step={5}
          />
        </div>
      )}
    </div>
  )
}
